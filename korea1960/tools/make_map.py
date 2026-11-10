"""한반도 남부 권역 지도(SVG 경로)를 만든다. 개발용 도구이며 게임 실행·빌드에는 필요 없다.

필요: shapely (pip install shapely)
원본: Natural Earth 1:10m Cultural Vectors (퍼블릭 도메인, https://www.naturalearthdata.com)
  ne_10m_admin_1_states_provinces.geojson, ne_10m_admin_0_countries.geojson
  (github.com/nvkelso/natural-earth-vector 의 geojson/ 폴더)

python3 tools/make_map.py <admin_1.geojson> <admin_0.geojson>
결과: assets/map/korea_map.json — viewBox, 게임 권역 10개의 경로, 이웃 나라 땅, 군사분계선, 이름표·도시 좌표.

게임 권역은 1960년대 행정구역에 가깝게 지금의 시·도를 묶은 것이다(인천→경기, 대전·세종→충남, 대구→경북,
광주→전남, 울산→경남; 부산은 1963년 직할시). 실제 당시 경계를 재현하지 않는다(data/game.json의 권역 설명과 같다).
"""
from pathlib import Path
import json, math, sys
from shapely.geometry import shape, box, mapping, Point
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
LON0, LON1, LAT0, LAT1 = 124.0, 132.2, 32.9, 39.2
COS = math.cos(math.radians(36.0))
W = 1000.0
K = W / ((LON1 - LON0) * COS)
H = round((LAT1 - LAT0) * K, 1)
REGIONS = {
    'capital': ['KR-11', 'KR-41', 'KR-28'], 'gangwon': ['KR-42'], 'chungnam': ['KR-44', 'KR-30', 'KR-50'], 'chungbuk': ['KR-43'],
    'jeonbuk': ['KR-45'], 'gyeongbuk': ['KR-47', 'KR-27'], 'jeonnam': ['KR-46', 'KR-29'], 'gyeongnam': ['KR-48', 'KR-31'],
    'busan': ['KR-26'], 'jeju': ['KR-49'],
}
CITIES = [  # 이름, 위도, 경도, 종류(capital/major/minor)
    ('서울', 37.566, 126.978, 'capital'), ('인천', 37.456, 126.705, 'minor'), ('춘천', 37.881, 127.730, 'minor'), ('강릉', 37.752, 128.876, 'minor'),
    ('청주', 36.642, 127.489, 'minor'), ('대전', 36.351, 127.385, 'major'), ('전주', 35.824, 127.148, 'minor'), ('광주', 35.160, 126.852, 'major'),
    ('목포', 34.811, 126.392, 'minor'), ('대구', 35.871, 128.601, 'major'), ('포항', 36.019, 129.343, 'minor'), ('울산', 35.538, 129.311, 'minor'),
    ('마산', 35.214, 128.581, 'minor'), ('부산', 35.180, 129.075, 'major'), ('제주', 33.500, 126.531, 'minor'),
    ('평양', 39.019, 125.738, 'foreign'),
]
# 권역 이름표 위치(위도, 경도). 도시 이름과 겹치지 않게 손으로 정했다.
LABEL_AT = {
    'capital': (37.33, 127.33), 'gangwon': (37.62, 128.35), 'chungnam': (36.55, 126.86), 'chungbuk': (36.92, 127.78), 'jeonbuk': (35.70, 127.05),
    'gyeongbuk': (36.40, 128.78), 'jeonnam': (34.86, 127.02), 'gyeongnam': (35.38, 128.15), 'busan': (34.92, 129.42), 'jeju': (33.33, 126.56),
}
LABELS = [  # 지명 표기(바다·이웃·섬). 국가 경계와 이름은 표시용이다.
    ('동해', 37.6, 130.0, 'sea'), ('서해', 36.2, 125.0, 'sea'), ('남해', 33.9, 128.0, 'sea'),
    ('북한', 38.95, 126.7, 'land'), ('일본', 33.75, 130.75, 'land'), ('울릉도', 37.32, 130.86, 'island'), ('독도', 37.24, 131.87, 'dokdo'),
]

def xy(lon, lat): return ((lon - LON0) * COS * K, (LAT1 - lat) * K)

def path(geom, keep=lambda p: True):
    parts = []
    polys = [geom] if geom.geom_type == 'Polygon' else list(getattr(geom, 'geoms', []))
    for poly in polys:
        if poly.is_empty or poly.geom_type != 'Polygon' or not keep(poly): continue
        for ring in [poly.exterior, *poly.interiors]:
            pts = [xy(*c) for c in ring.coords]
            if len(pts) < 4: continue
            d = 'M' + ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts[:-1]) + 'Z'
            parts.append(d)
    return ''.join(parts)

def line(geom):
    out = []
    lines = [geom] if geom.geom_type == 'LineString' else [g for g in getattr(geom, 'geoms', []) if g.geom_type == 'LineString']
    for ln in lines:
        pts = [xy(*c) for c in ln.coords]
        if len(pts) > 1: out.append('M' + ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts))
    return ''.join(out)

if __name__ == '__main__':
    if len(sys.argv) != 3: sys.exit(__doc__)
    adm1 = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    adm0 = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
    frame = box(LON0 - .5, LAT0 - .5, LON1 + .5, LAT1 + .5)
    by_iso = {f['properties']['iso_3166_2']: shape(f['geometry']) for f in adm1['features'] if f['properties'].get('adm0_a3') == 'KOR'}
    keep = lambda p: p.area > .0016 or p.centroid.x > 131.5  # 작은 섬은 빼되 울릉도·독도는 남긴다
    out = {
        'source': 'Natural Earth 1:10m admin 0·admin 1 (퍼블릭 도메인). tools/make_map.py로 단순화·투영. 경계는 표시용이며 1960년대 행정구역을 재현하지 않는다.',
        'viewBox': [0, 0, W, H], 'projection': {'lon0': LON0, 'lat1': LAT1, 'cos': round(COS, 6), 'k': round(K, 4)},
        'regions': {}, 'anchors': {}, 'neighbors': {}, 'mdl': '', 'coast': '', 'graticule': '', 'cities': [], 'labels': [],
    }
    south = []
    for rid, codes in REGIONS.items():
        g = unary_union([by_iso[c].buffer(0) for c in codes]).buffer(0.0008).buffer(-0.0008)
        g = g.simplify(0.0045, preserve_topology=True)
        south.append(g)
        out['regions'][rid] = path(g, keep)
        lat, lon = LABEL_AT[rid]
        out['anchors'][rid] = [round(v, 1) for v in xy(lon, lat)]
    # 이웃 나라(북한·중국·일본·러시아): 화면 틀로 자른 땅
    for f in adm0['features']:
        code = f['properties']['ADM0_A3']
        if code not in ('PRK', 'CHN', 'JPN', 'RUS'): continue
        g = shape(f['geometry']).intersection(frame).simplify(0.006, preserve_topology=True)
        if not g.is_empty: out['neighbors'][code.lower()] = path(g, lambda p: p.area > .002)
    kor = unary_union([shape(f['geometry']) for f in adm0['features'] if f['properties']['ADM0_A3'] == 'KOR'])
    prk = unary_union([shape(f['geometry']) for f in adm0['features'] if f['properties']['ADM0_A3'] == 'PRK'])
    mdl = kor.buffer(0.004).boundary.intersection(prk.buffer(0.004)).simplify(0.004)
    out['mdl'] = line(mdl)
    grat = []
    for lon in range(124, 133):
        grat.append('M' + ' '.join(f'{x:.1f},{y:.1f}' for x, y in [xy(lon, LAT0), xy(lon, LAT1)]))
    for lat in range(33, 40):
        grat.append('M' + ' '.join(f'{x:.1f},{y:.1f}' for x, y in [xy(LON0, lat), xy(LON1, lat)]))
    out['graticule'] = ''.join(grat)
    out['graticuleLabels'] = [[f'{lon}°E', *[round(v, 1) for v in xy(lon, LAT0)]] for lon in range(125, 132)] + [[f'{lat}°N', *[round(v, 1) for v in xy(LON0, lat)]] for lat in range(34, 39)]
    for name, lat, lon, kind in CITIES: out['cities'].append({'name': name, 'kind': kind, 'x': round(xy(lon, lat)[0], 1), 'y': round(xy(lon, lat)[1], 1)})
    for name, lat, lon, kind in LABELS: out['labels'].append({'name': name, 'kind': kind, 'x': round(xy(lon, lat)[0], 1), 'y': round(xy(lon, lat)[1], 1)})
    dest = ROOT / 'assets/map/korea_map.json'
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{dest.relative_to(ROOT)}: {dest.stat().st_size:,} bytes, viewBox 0 0 {W:.0f} {H}, regions {len(out["regions"])}, neighbors {sorted(out["neighbors"])}')
