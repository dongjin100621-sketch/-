"""강·호수 그림과 지역 사이의 강 건너기, 지역의 교통 거점 점을 map.json에 더한다. 개발용 도구이며 게임 실행·빌드에는 필요 없다.

필요: shapely 2.1 이상
원본: Natural Earth 1:10m Physical Vectors (퍼블릭 도메인, https://www.naturalearthdata.com)
  ne_10m_rivers_lake_centerlines.geojson, ne_10m_lakes.geojson (github.com/nvkelso/natural-earth-vector 의 geojson/ 폴더)

python3 tools/make_rivers.py <ne_10m_rivers_lake_centerlines.geojson> <ne_10m_lakes.geojson>
결과: data/map.json 의 rivers(그림), lakes(그림), crossings(지역 쌍 → 'large' | 'small'), nodes(지역의 대표 도시 점)

강 건너기: 두 지역의 이름 자리에서 공유 경계의 가운데를 지나 다른 지역의 이름 자리로 가는 꺾은선이
아래 목록의 강 하나를 홀수 번 지나면 그 사이에 강이 있다고 본다(길을 따라 굽이치는 강은 짝수 번 만난다). 지역 경계가 대략적이므로 강 건너기도 근사다.
"""
from pathlib import Path
import json, sys, re
import shapely
from shapely.geometry import shape, box, LineString, Point
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_map import proj, project_geom, SEEDS, LON0, LON1, LAT_TOP, LAT_BOT  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
# 큰 강(건너기 어려움)과 작은 강. Natural Earth의 영어 이름.
LARGE = {'Yangtze', 'Huang', 'Yellow', 'Amur', 'Ergun', 'Mekong', 'Irrawaddy', 'Irrawaddy Delta', 'Brahmaputra', 'Dihang', 'Ganges',
         'Salween', 'Nu', 'Xi', 'Sungari', "Song'acha", 'Ussuri', 'Wusuli', 'Yenisey', 'Verkhniy Yenisey', 'Ob', 'Irtysh', 'Ertis',
         'Lena', 'Angara', 'Selenga', 'Murray', 'Indus'}
SMALL = {'Liao', 'Xiliao', 'Han', 'Gan', 'Yuan', 'Red', 'Huai', 'Xiang', 'Min', 'Hongshui', 'Nanpan', 'Chindwin', 'Yalu', 'Tumen',
         'Nen', 'Wei', 'Fen', 'Jialing', 'Wu', 'Chao Phraya', 'Ping', 'Yom', 'Mun', 'Chi', 'Nakdong', 'Namhan', 'Zeya', 'Hailar',
         'Darling', 'Godävari', 'Krishna', 'Narmada', 'Mahäna Nadï', 'Yamuna', 'Sutlej', 'Chenab', 'Fly', 'Sepik', 'Mamberamo',
         'Kapuas', 'Barito', 'Mahakam', 'Cagayan', 'Daling', 'Luan', 'Yongding', 'Dadu', 'Yalong', 'Tarim', 'Yarkant', 'Aldan',
         "Tom'", 'Tom’', 'Kamchatka', 'Ishikari', 'Tone', 'Dong', 'Bei', 'Mae Klong', 'Wuding', 'Cauvery', 'Kaladan', 'Digul'}
TOL = .7  # 단순화(지도 단위)
# 근사가 틀리는 곳의 손 보정(지역 쌍 → 'large' | 'small' | None). 랑군에서 만달레이로는 이라와디강을 건너지 않고 시탕강 골짜기를 따라간다.
OVERRIDE = {'rangoon|mandalay': None}


def fmt(g):
    """선·면을 SVG 경로로."""
    out = []
    def line(cs, close=False):
        cs = list(cs)
        if len(cs) < 2: return
        out.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in cs) + ('Z' if close else ''))
    def walk(h):
        t = h.geom_type
        if t == 'LineString': line(h.coords)
        elif t == 'Polygon':
            line(h.exterior.coords, True)
            for i in h.interiors: line(i.coords, True)
        elif t in ('MultiLineString', 'MultiPolygon', 'GeometryCollection'):
            for p in h.geoms: walk(p)
    walk(g)
    return ''.join(out)


def path_line(d):
    """M/L/Z만 쓰는 SVG 경로를 선으로."""
    pts = [tuple(map(float, p.split(','))) for p in re.findall(r'-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?', d)]
    return LineString(pts) if len(pts) >= 2 else None


def main(rivers_path, lakes_path):
    mp = json.loads((ROOT / 'data/map.json').read_text(encoding='utf-8'))
    view = box(-20, -20, 2620, mp['viewBox'][3] + 20)
    ll = box(LON0 - 1, LAT_BOT - 1, 180, LAT_TOP + 1)
    groups = {'large': [], 'small': []}; named = {}
    for f in json.loads(Path(rivers_path).read_text(encoding='utf-8'))['features']:
        p = f['properties']; n = p.get('name_en') or p.get('name') or ''
        k = 'large' if n in LARGE else 'small' if n in SMALL else None
        if not k: continue
        g = shape(f['geometry'])
        if not g.intersects(ll): continue
        g = project_geom(g.intersection(ll)).intersection(view)
        groups[k].append(g); named.setdefault((k, n), []).append(g)
    geo = {k: unary_union(v).simplify(TOL) for k, v in groups.items()}
    rivers = [(k, unary_union(v).simplify(TOL)) for (k, n), v in sorted(named.items())]
    lakes = []
    for f in json.loads(Path(lakes_path).read_text(encoding='utf-8'))['features']:
        p = f['properties']
        if p.get('scalerank', 9) > 4: continue
        g = shape(f['geometry'])
        if not g.intersects(ll): continue
        g = project_geom(g.intersection(ll)).intersection(view).simplify(TOL)
        if g.area > 25: lakes.append(g)
    lake_geo = unary_union(lakes) if lakes else None

    # 강 건너기
    lab = {k: Point(v['label']) for k, v in mp['regions'].items()}
    cross = {}
    def crossings(seg, g):
        x = seg.intersection(g)
        if x.is_empty: return 0
        if x.geom_type == 'Point': return 1
        return sum(1 for q in getattr(x, 'geoms', [x]) if q.geom_type == 'Point') or 1
    for a, b in mp['adjacency']:
        if a not in lab or b not in lab: continue
        bd = mp['borders'].get(f'{a}|{b}') or mp['borders'].get(f'{b}|{a}')
        bl = path_line(bd) if bd else None
        mid = bl.interpolate(.5, normalized=True) if bl is not None and bl.length > 0 else None
        pts = [lab[a], mid, lab[b]] if mid is not None else [lab[a], lab[b]]
        seg = LineString([(q.x, q.y) for q in pts])
        # 같은 강을 홀수 번 지나야 건너는 것으로 본다(길을 따라 굽이치는 강은 짝수 번 만난다).
        hit = {k for k, g in rivers if crossings(seg, g) % 2 == 1}
        if 'large' in hit: cross[f'{a}|{b}'] = 'large'
        elif 'small' in hit: cross[f'{a}|{b}'] = 'small'
    for k, v in OVERRIDE.items():
        a, b = k.split('|'); cross.pop(f'{a}|{b}', None); cross.pop(f'{b}|{a}', None)
        if v: cross[k] = v

    # 지역의 대표 도시 점(첫 씨앗 점). 지도 밖 본국은 없음.
    nodes = {}
    for rid, lat, lon, _ in SEEDS:
        if rid in nodes or rid not in mp['regions']: continue
        x, y = proj(lon, lat); nodes[rid] = [round(x, 1), round(y, 1)]

    mp['rivers'] = {k: fmt(g) for k, g in geo.items()}
    mp['lakes'] = fmt(lake_geo) if lake_geo is not None else ''
    mp['crossings'] = cross
    mp['nodes'] = nodes
    (ROOT / 'data/map.json').write_text(json.dumps(mp, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'강 경로 {sum(len(v) for v in mp["rivers"].values()):,}자, 호수 {len(mp["lakes"]):,}자, 강 건너기 {len(cross)}'
          f'(큰 강 {sum(1 for v in cross.values() if v == "large")}), 거점 점 {len(nodes)}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
