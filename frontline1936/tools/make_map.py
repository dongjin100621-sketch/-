"""동아시아·태평양 전역 지도(지역·해역의 SVG 경로, 인접, 해안, 경계선)를 만든다. 개발용 도구이며 게임 실행·빌드에는 필요 없다.

필요: shapely 2.1 이상 (pip install shapely)
원본: Natural Earth 1:10m Cultural Vectors (퍼블릭 도메인, https://www.naturalearthdata.com)
  ne_10m_admin_1_states_provinces.geojson (github.com/nvkelso/natural-earth-vector 의 geojson/ 폴더)

python3 tools/make_map.py <ne_10m_admin_1_states_provinces.geojson>
결과: data/map.json

방법: 아래 SEEDS의 점(지역마다 하나 이상)으로 지금의 1급 행정구역을 묶는다. 한 행정구역 안에 점이 둘 이상이면 그 점들의
보로노이 칸으로 나누고, 점이 없으면 같은 나라 목록의 가장 가까운 점에 붙인다. 그래서 국경은 지금의 국경을 따르고,
나라 안의 지역 경계는 대략적이다. 1936년의 실제 행정 경계를 재현하지 않는다(예: 러허·차하르·쑤이위안은 점으로 근사).
해역은 바다 점들의 보로노이 칸이다. 투영은 메르카토르(동경 75°~서경 155°, 남위 47°~북위 60°)이다.
"""
from pathlib import Path
import json, math, sys
import numpy as np
import shapely
import shapely.ops
from shapely.geometry import shape, box, Point, MultiPoint, Polygon, MultiPolygon, LineString, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
LON0, LON1, LAT_TOP, LAT_BOT = 75.0, 205.0, 60.0, -47.0
W = 2600.0
K = W / (LON1 - LON0)
merc = lambda lat: math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))
H = round((merc(LAT_TOP) - merc(LAT_BOT)) * K, 1)


def proj(lon, lat):
    if lon < 0: lon += 360
    return ((lon - LON0) * K, (merc(LAT_TOP) - merc(max(-85, min(85, lat)))) * K)


# 지역 점: (지역 ID, 위도, 경도, 나라 코드 목록). 같은 ID가 여러 번 나오면 한 지역의 여러 점이다.
SEEDS = [
    # 일본 본토·류큐·오가사와라·가라후토·지시마
    ('hokkaido', 43.4, 142.8, 'JPN'), ('tohoku', 39.3, 140.8, 'JPN'), ('kanto', 35.69, 139.69, 'JPN'), ('chubu', 36.2, 137.5, 'JPN'),
    ('kansai', 34.6, 135.6, 'JPN'), ('chugoku', 34.8, 132.4, 'JPN'), ('shikoku', 33.7, 133.4, 'JPN'), ('kyushu', 32.6, 130.8, 'JPN'),
    ('ryukyu', 26.3, 127.8, 'JPN'), ('ogasawara', 26.2, 142.2, 'JPN'),
    ('karafuto', 47.3, 142.7, 'RUS'), ('chishima', 47.0, 152.0, 'RUS'),
    # 조선
    ('gyeongseong', 37.5, 127.0, 'KOR PRK'), ('gangwon', 37.7, 128.4, 'KOR PRK'), ('chungcheong', 36.5, 127.2, 'KOR'), ('jeolla', 35.1, 126.9, 'KOR'),
    ('gyeongsang', 35.8, 128.7, 'KOR'), ('hwanghae', 38.4, 125.6, 'PRK'), ('pyongan', 39.6, 125.9, 'PRK'), ('hamgyong', 41.0, 129.0, 'PRK'),
    ('taiwan', 23.7, 121.0, 'TWN'),
    # 만주국·관동주·몽강
    ('fengtian', 41.9, 123.6, 'CHN'), ('jinzhou', 41.2, 120.9, 'CHN'), ('andong', 40.5, 124.3, 'CHN'), ('kwantung', 38.95, 121.6, 'CHN'),
    ('hsinking', 43.8, 125.2, 'CHN'), ('jiandao', 43.0, 129.2, 'CHN'), ('harbin', 45.8, 126.6, 'CHN'), ('qiqihar', 47.5, 124.0, 'CHN'),
    ('heihe', 50.4, 126.5, 'CHN'), ('mudanjiang', 44.8, 130.2, 'CHN'), ('jiamusi', 46.9, 131.3, 'CHN'), ('hulunbuir', 49.4, 119.5, 'CHN'),
    ('xingan', 46.3, 121.7, 'CHN'), ('jehol', 42.4, 119.0, 'CHN'), ('jehol', 41.2, 117.6, 'CHN'), ('chahar', 43.8, 115.6, 'CHN'),
    # 중국 본토
    ('peiping', 40.1, 116.4, 'CHN'), ('tianjin', 39.2, 117.3, 'CHN'), ('hebei', 38.1, 115.0, 'CHN'), ('kalgan', 40.7, 115.2, 'CHN'),
    ('jinan', 36.5, 117.2, 'CHN'), ('qingdao', 36.3, 120.0, 'CHN'), ('kaifeng', 34.9, 114.3, 'CHN'), ('nanyang', 33.0, 112.9, 'CHN'),
    ('taiyuan', 37.9, 112.5, 'CHN'), ('datong', 39.9, 113.0, 'CHN'), ('shanxi_s', 35.8, 111.6, 'CHN'), ('suiyuan', 41.0, 110.5, 'CHN'),
    ('yanan', 37.0, 109.4, 'CHN'), ('xian', 34.3, 108.9, 'CHN'), ('hanzhong', 33.0, 107.2, 'CHN'),
    ('lanzhou', 36.0, 104.0, 'CHN'), ('hexi', 39.8, 98.5, 'CHN'), ('alxa', 40.0, 103.0, 'CHN'), ('yinchuan', 38.0, 106.2, 'CHN'),
    ('xining', 36.3, 101.0, 'CHN'), ('qinghai_w', 35.0, 93.5, 'CHN'),
    ('urumqi', 44.0, 87.5, 'CHN'), ('kashgar', 39.5, 77.0, 'CHN'), ('hami', 42.5, 93.0, 'CHN'), ('khotan', 36.5, 81.5, 'CHN'),
    ('lhasa', 30.2, 91.0, 'CHN'), ('ngari', 32.5, 82.0, 'CHN'), ('chamdo', 31.0, 96.5, 'CHN'),
    ('chengdu', 30.5, 104.2, 'CHN'), ('xikang', 30.5, 100.0, 'CHN'), ('chongqing', 29.8, 107.2, 'CHN'),
    ('kunming', 25.0, 103.0, 'CHN'), ('dali', 25.0, 99.6, 'CHN'), ('guiyang', 26.7, 106.8, 'CHN'),
    ('nanning', 23.0, 107.8, 'CHN'), ('guilin', 25.0, 110.3, 'CHN'),
    ('guangzhou', 23.4, 113.4, 'CHN'), ('shantou', 23.7, 116.3, 'CHN'), ('leizhou', 21.6, 110.0, 'CHN'), ('guangzhouwan', 21.15, 110.4, 'CHN'),
    ('hainan', 19.2, 109.7, 'CHN'), ('hongkong', 22.35, 114.15, 'HKG'), ('macau', 22.17, 113.55, 'MAC'),
    ('fuzhou', 26.3, 119.0, 'CHN'), ('xiamen', 24.7, 117.6, 'CHN'), ('nanchang', 28.5, 115.8, 'CHN'), ('ganzhou', 25.9, 115.0, 'CHN'),
    ('hangzhou', 30.1, 120.0, 'CHN'), ('wenzhou', 28.2, 120.3, 'CHN'), ('shanghai', 31.2, 121.4, 'CHN'),
    ('nanjing', 32.4, 119.0, 'CHN'), ('xuzhou', 34.0, 118.0, 'CHN'), ('anhui', 31.6, 117.0, 'CHN'),
    ('wuhan', 30.6, 114.3, 'CHN'), ('yichang', 31.0, 111.0, 'CHN'), ('changsha', 28.3, 112.9, 'CHN'), ('hengyang', 26.4, 112.4, 'CHN'),
    # 몽골
    ('urga', 47.9, 106.9, 'MNG'), ('khovd', 48.0, 92.5, 'MNG'), ('dornod', 47.8, 114.5, 'MNG'), ('gobi', 43.8, 104.0, 'MNG'),
    # 소련 극동·시베리아·중앙아시아
    ('vladivostok', 43.4, 132.2, 'RUS'), ('iman', 46.2, 134.5, 'RUS'), ('khabarovsk', 48.8, 135.0, 'RUS'), ('lower_amur', 53.2, 139.5, 'RUS'),
    ('okhotsk', 58.5, 140.0, 'RUS'), ('amur', 51.0, 127.5, 'RUS'), ('chita', 52.0, 115.0, 'RUS'), ('ulanude', 51.8, 108.0, 'RUS'),
    ('irkutsk', 54.0, 104.0, 'RUS'), ('krasnoyarsk', 56.5, 93.0, 'RUS'), ('tuva', 51.7, 94.4, 'RUS'),
    ('novosibirsk', 55.5, 81.0, 'RUS'), ('altai', 52.0, 84.0, 'RUS'), ('kuzbass', 55.0, 87.0, 'RUS'),
    ('aldan', 58.0, 127.0, 'RUS'), ('magadan', 59.6, 151.0, 'RUS'), ('kamchatka', 54.5, 159.0, 'RUS'), ('nsakhalin', 52.6, 142.9, 'RUS'),
    ('almaty', 43.8, 78.5, 'KAZ KGZ'), ('semipalatinsk', 49.5, 81.0, 'KAZ'),
    # 영국령 인도·네팔·부탄·실론
    ('delhi', 28.8, 77.5, 'IND'), ('punjab', 31.0, 76.0, 'IND'), ('rajputana', 25.5, 75.6, 'IND'), ('up', 26.8, 81.0, 'IND'),
    ('central_india', 22.5, 79.5, 'IND'), ('hyderabad', 17.5, 78.5, 'IND'), ('madras', 12.8, 79.6, 'IND'), ('mysore', 12.0, 76.3, 'IND'),
    ('bihar', 25.4, 85.3, 'IND'), ('orissa', 20.5, 84.5, 'IND'), ('bengal', 22.8, 88.0, 'IND BGD'), ('dacca', 23.9, 90.5, 'BGD IND'),
    ('assam', 26.3, 92.5, 'IND'), ('imphal', 24.5, 94.0, 'IND'), ('ceylon', 7.8, 80.7, 'LKA'),
    ('nepal', 28.0, 84.0, 'NPL'), ('bhutan', 27.4, 90.4, 'BTN'),
    # 버마·시암·인도차이나
    ('rangoon', 17.2, 96.0, 'MMR'), ('mandalay', 21.8, 95.8, 'MMR'), ('myitkyina', 25.8, 97.3, 'MMR'), ('arakan', 20.3, 93.4, 'MMR'),
    ('tenasserim', 13.5, 98.6, 'MMR'), ('shan', 21.0, 97.8, 'MMR'),
    ('bangkok', 14.0, 100.3, 'THA'), ('chiangmai', 18.6, 99.4, 'THA'), ('korat', 15.6, 103.0, 'THA'), ('siam_s', 8.0, 99.8, 'THA'),
    ('tonkin', 21.4, 105.4, 'VNM'), ('annam', 15.5, 108.3, 'VNM'), ('cochinchina', 10.8, 106.2, 'VNM'), ('cambodia', 12.5, 104.8, 'KHM'), ('laos', 18.5, 103.0, 'LAO'),
    # 말라야·보르네오·네덜란드령 동인도·티모르
    ('malaya_n', 5.6, 100.9, 'MYS'), ('kuala_lumpur', 3.4, 101.9, 'MYS'), ('johor', 2.0, 103.4, 'MYS'), ('singapore', 1.35, 103.82, 'SGP'),
    ('sarawak', 2.3, 112.8, 'MYS'), ('north_borneo', 5.4, 117.0, 'MYS'), ('brunei', 4.6, 114.7, 'BRN'),
    ('borneo_w', 0.0, 110.5, 'IDN'), ('borneo_e', 0.2, 116.3, 'IDN'), ('borneo_s', -2.5, 113.8, 'IDN'),
    ('batavia', -6.6, 106.8, 'IDN'), ('java_c', -7.3, 110.3, 'IDN'), ('surabaya', -7.7, 112.8, 'IDN'),
    ('palembang', -3.2, 104.5, 'IDN'), ('padang', -0.6, 101.0, 'IDN'), ('medan', 3.0, 98.6, 'IDN'),
    ('makassar', -3.5, 120.0, 'IDN'), ('manado', 0.8, 123.5, 'IDN'), ('ambon', -3.2, 129.5, 'IDN'), ('lesser_sunda', -8.7, 118.0, 'IDN'),
    ('kupang', -9.8, 124.0, 'IDN'), ('vogelkop', -1.5, 133.0, 'IDN'), ('hollandia', -3.8, 138.5, 'IDN'),
    ('timor_p', -8.8, 125.8, 'TLS'),
    # 필리핀
    ('manila', 14.7, 121.0, 'PHL'), ('luzon_n', 17.3, 121.3, 'PHL'), ('bicol', 13.3, 123.6, 'PHL'), ('visayas', 10.6, 123.3, 'PHL'), ('mindanao', 7.5, 124.8, 'PHL'),
    # 뉴기니·솔로몬·피지·뉴칼레도니아
    ('port_moresby', -8.5, 145.5, 'PNG'), ('lae', -5.6, 144.0, 'PNG'), ('rabaul', -5.0, 151.5, 'PNG'), ('bougainville', -6.3, 155.4, 'PNG'),
    ('guadalcanal', -9.0, 160.0, 'SLB'), ('fiji', -17.8, 178.0, 'FJI'), ('new_caledonia', -21.3, 165.5, 'NCL'),
    # 오스트레일리아·뉴질랜드
    ('darwin', -14.0, 132.5, 'AUS'), ('outback', -24.0, 134.0, 'AUS'), ('kimberley', -20.0, 123.0, 'AUS'), ('perth', -31.0, 117.0, 'AUS'),
    ('adelaide', -33.5, 138.0, 'AUS'), ('queensland_n', -18.5, 144.5, 'AUS'), ('brisbane', -26.0, 150.0, 'AUS'), ('sydney', -32.5, 149.0, 'AUS'),
    ('melbourne', -37.2, 144.5, 'AUS'), ('tasmania', -42.0, 146.5, 'AUS'),
    ('north_island', -38.5, 175.5, 'NZL'), ('south_island', -43.8, 171.0, 'NZL'),
    # 태평양의 섬
    ('guam', 13.44, 144.79, 'GUM'), ('saipan', 15.18, 145.75, 'MNP'), ('palau', 7.5, 134.6, 'PLW'), ('truk', 7.4, 151.8, 'FSM'),
    ('marshalls', 8.7, 167.7, 'MHL'), ('wake', 19.28, 166.65, 'UMI'), ('midway', 28.2, -177.37, 'UMI'), ('hawaii', 20.8, -157.5, 'USA'),
    ('aleutians', 52.5, 178.0, 'USA'), ('alaska', 58.8, -158.0, 'USA'), ('gilberts', 1.4, 173.0, 'KIR'),
]

# 지도 범위 밖의 땅이 가장 가까운 점에 붙지 않도록, 아래 나라의 1급 행정구역 가운데 이 경도 범위 밖은 버린다.
SEA_SEEDS = [
    ('okhotsk_sea', 53.5, 148.0), ('japan_sea_n', 43.5, 136.5), ('japan_sea_s', 38.5, 133.0), ('tsushima_strait', 34.0, 129.3),
    ('yellow_sea', 35.5, 123.5), ('bohai', 38.8, 120.0), ('east_china_sea', 29.0, 125.0), ('formosa_strait', 24.2, 119.6),
    ('scs_n', 19.0, 115.0), ('scs_s', 9.5, 112.5), ('tonkin_gulf', 19.8, 107.6), ('siam_gulf', 9.5, 102.0),
    ('malacca', 3.8, 99.8), ('andaman_sea', 11.5, 96.0), ('bengal_bay', 16.0, 88.5), ('indian_n', 4.0, 86.0), ('laccadive', 10.0, 76.0),
    ('indian_se', -15.0, 100.0), ('indian_s', -32.0, 108.0), ('java_sea', -5.0, 111.0), ('sulu_sea', 8.5, 120.0), ('celebes_sea', 3.5, 123.5),
    ('molucca_sea', 0.2, 126.6), ('banda_sea', -6.0, 126.5), ('timor_sea', -11.5, 127.0), ('arafura_sea', -9.5, 136.0),
    ('coral_sea', -16.5, 152.0), ('solomon_sea', -8.0, 153.5), ('bismarck_sea', -2.5, 148.0), ('tasman_sea', -38.0, 160.0), ('australia_s', -41.5, 135.0),
    ('philippine_sea', 16.0, 130.0), ('palau_sea', 6.0, 135.0), ('marianas', 17.0, 145.5), ('carolines', 5.0, 152.0), ('marshalls_sea', 9.0, 168.0),
    ('japan_south', 30.5, 140.0), ('japan_east', 38.0, 147.0), ('kuril_sea', 46.0, 157.0), ('north_pacific', 45.0, 173.0), ('bering', 57.0, 175.0),
    ('wake_sea', 20.0, 166.0), ('midway_sea', 28.5, -179.0), ('hawaii_sea', 22.0, -160.0), ('central_pacific', 10.0, -175.0),
    ('gilbert_sea', 0.0, 173.5), ('south_pacific', -14.0, 175.0), ('pacific_ne', 38.0, -160.0),
]

# 바다 위에 찍은 섬 지역의 점: 그 점을 품는 행정구역(볼록 껍질 기준)을 나눈다(도쿄도의 오가사와라, 알래스카의 알류샨, 사할린주의 쿠릴).
HULL_SEEDS = {'ogasawara', 'aleutians', 'chishima'}
THEATER = sorted({c for s in SEEDS for c in s[3].split()})


def project_geom(g):
    return shapely.transform(g, lambda a: np.array([proj(x, y) for x, y in a]).reshape(-1, 2))


def as_polys(g):
    if g.is_empty: return []
    if isinstance(g, Polygon): return [g]
    if isinstance(g, MultiPolygon): return list(g.geoms)
    return [p for p in getattr(g, 'geoms', []) if isinstance(p, (Polygon, MultiPolygon)) for p in as_polys(p)]


def main(admin1_path):
    frame = box(0, 0, W, H)
    seeds = {}
    for rid, lat, lon, iso in SEEDS:
        seeds.setdefault(rid, []).append((Point(proj(lon, lat)), iso.split()))
    feats = [f for f in json.load(open(admin1_path, encoding='utf-8'))['features'] if f['properties']['adm0_a3'] in THEATER]
    print(len(feats), 'admin-1 features in theater', file=sys.stderr)
    pieces = {rid: [] for rid in seeds}
    for f in feats:
        iso = f['properties']['adm0_a3']
        g = shapely.make_valid(project_geom(shape(f['geometry'])))
        g = g.intersection(frame)
        if g.is_empty or g.area < .01: continue
        cand = [(rid, p) for rid, lst in seeds.items() for p, isos in lst if iso in isos]
        if not cand: continue
        hull = g.convex_hull
        inside = [(rid, p) for rid, p in cand if g.buffer(.5).contains(p) or (rid in HULL_SEEDS and hull.contains(p))]
        if len(inside) >= 2:
            pts = MultiPoint([p for _, p in inside])
            cells = shapely.voronoi_polygons(pts, extend_to=g.envelope.buffer(50))
            for cell in cells.geoms:
                owner = next(rid for rid, p in inside if cell.buffer(1e-6).contains(p))
                part = g.intersection(cell)
                if not part.is_empty: pieces[owner].append(part)
        elif len(inside) == 1:
            pieces[inside[0][0]].append(g)
        else:
            c = g.representative_point()
            rid = min(cand, key=lambda x: x[1].distance(c))[0]
            pieces[rid].append(g)
    regions = {}
    for rid, parts in pieces.items():
        if not parts: print('EMPTY REGION', rid, file=sys.stderr); continue
        u = unary_union(parts).buffer(0)
        # 점에서 멀리 떨어진 조각(같은 나라 코드의 먼 섬: 라인 제도, 존스턴 등)은 버린다.
        polys = as_polys(u); pts = [p for p, _ in seeds[rid]]
        near = [p for p in polys if min(p.distance(q) for q in pts) <= 260]
        regions[rid] = unary_union(near or [min(polys, key=lambda p: min(p.distance(q) for q in pts))])
    ids = list(regions)
    # 공유 경계를 지키며 단순화
    simp = shapely.coverage_simplify([regions[i] for i in ids], 1.1, simplify_boundary=True)
    out_regions, geoms = {}, {}
    for rid, g in zip(ids, simp):
        polys = sorted(as_polys(g), key=lambda p: -p.area)
        keep = [p for i, p in enumerate(polys) if i == 0 or p.area >= .6]
        geoms[rid] = MultiPolygon(keep) if len(keep) > 1 else keep[0]
    land = unary_union(list(geoms.values()))
    # 인접(땅): 공유 경계 길이가 1 이상
    adj = []
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            ga, gb = geoms[a], geoms[b]
            if not ga.buffer(.3).intersects(gb): continue
            shared = ga.buffer(.4).intersection(gb.boundary)
            if shared.length >= 1.5: adj.append([a, b, shared])
    # 해역: 보로노이 칸
    sea_pts = {sid: Point(proj(lon, lat)) for sid, lat, lon in SEA_SEEDS}
    cells = shapely.voronoi_polygons(MultiPoint(list(sea_pts.values())), extend_to=frame.buffer(200))
    seas = {}
    for cell in cells.geoms:
        sid = next(s for s, p in sea_pts.items() if cell.buffer(1e-6).contains(p))
        seas[sid] = cell.intersection(frame)
    # 해안: 지역 경계 가운데 다른 땅과 닿지 않는 부분
    edge = frame.exterior.buffer(2)
    coast = {}
    for rid in ids:
        g = geoms[rid]
        others = unary_union([geoms[o] for o in ids if o != rid and geoms[o].buffer(.5).intersects(g)])
        line = g.boundary
        if others and not others.is_empty: line = line.difference(others.buffer(.6))
        line = line.difference(edge)
        if line.length < .5: continue
        touching = []
        for sid, cell in seas.items():
            L = line.intersection(cell).length
            if L >= .5 or (L > 0 and g.area < 30): touching.append((sid, L))
        if touching: coast[rid] = [s for s, _ in sorted(touching, key=lambda x: -x[1])]
    # 해역 인접: 공유 변이 땅 위로만 지나지 않는 경우
    sids = list(seas)
    sea_adj = []
    for i, a in enumerate(sids):
        for b in sids[i + 1:]:
            e = seas[a].intersection(seas[b])
            if e.length < 1: continue
            water = e.difference(land.buffer(3))
            if water.length >= 8: sea_adj.append([a, b])

    def path(g, nd=1):
        out = []
        for p in as_polys(g):
            for ring in [p.exterior, *p.interiors]:
                cs = list(ring.coords)[:-1]
                if len(cs) < 3: continue
                out.append('M' + 'L'.join(f'{x:.{nd}f},{y:.{nd}f}' for x, y in cs) + 'Z')
        return ''.join(out)

    def lines(g):
        out = []
        parts = [g] if isinstance(g, LineString) else [x for x in getattr(g, 'geoms', []) if isinstance(x, LineString)]
        if g.geom_type == 'MultiLineString' or g.geom_type == 'GeometryCollection': parts = [x for x in g.geoms if x.geom_type == 'LineString']
        merged = shapely.line_merge(shapely.MultiLineString(parts)) if parts else None
        segs = [merged] if isinstance(merged, LineString) else list(getattr(merged, 'geoms', []))
        for s in segs:
            cs = list(s.coords)
            if len(cs) >= 2: out.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in cs))
        return ''.join(out)

    def label(g):
        big = max(as_polys(g), key=lambda p: p.area)
        c = shapely.ops.polylabel(big, .5)
        return [round(c.x, 1), round(c.y, 1)]

    for rid in ids:
        g = geoms[rid]
        out_regions[rid] = {'d': path(g), 'label': label(g), 'area': round(g.area, 1), 'bbox': [round(v, 1) for v in g.bounds]}
    out = {
        'note': 'Natural Earth 1:10m admin-1(퍼블릭 도메인)을 tools/make_map.py가 묶고 단순화한 지도. 지역 경계는 대략적이며 1936년 행정 경계가 아니다.',
        'viewBox': [0, 0, W, H], 'projection': {'type': 'mercator', 'lon0': LON0, 'lon1': LON1, 'latTop': LAT_TOP, 'latBottom': LAT_BOT, 'scale': K},
        'regions': out_regions,
        'seas': {sid: {'d': path(g), 'label': [round(sea_pts[sid].x, 1), round(sea_pts[sid].y, 1)]} for sid, g in seas.items()},
        'adjacency': sorted([a, b] for a, b, _ in adj),
        'borders': {f'{a}|{b}': lines(sh) for a, b, sh in adj},
        'coast': coast,
        'seaAdjacency': sorted(sea_adj),
    }
    dest = ROOT / 'data/map.json'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{dest}: {len(out_regions)} regions, {len(seas)} seas, {len(adj)} land links, {len(sea_adj)} sea links, {len(coast)} coastal, {dest.stat().st_size:,} bytes', file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv[1])
