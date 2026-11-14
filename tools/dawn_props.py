#!/usr/bin/env python3
"""여명의 종 — 맵 사물 도트 생성기.

나무·바위·덤불·선인장·수정·상자·등불·표지판·울타리를 도형으로 조합한 뒤,
· 재질마다 색상 단계(외곽·어둠·중간·밝음·빛) 를 색조를 틀어 만들고
· 왼쪽 위에서 오는 빛으로 가장자리 명암을 넣고
· 실루엣에는 재질 색의 외곽선(selective outline)을 둘러
32×32 타일과 같은 밀도의 도트를 만든다.

출력: dawn/js/props.js (HD 그림 자료), --preview 폴더 로 미리보기 PNG.
"""
import colorsys
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ───────────────────────────── 색 ─────────────────────────────

def hx(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def tohex(rgb):
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(v)))) for v in rgb)


def shift_hue(h, target, amt):
    d = ((target - h + 0.5) % 1.0) - 0.5
    return (h + d * amt) % 1.0


def ramp(base, kind='cloth'):
    """[외곽, 어둠, 중간, 밝음, 빛] — 어두울수록 푸른보라, 밝을수록 노랑 쪽으로 색조를 튼다."""
    r, g, b = [v / 255 for v in hx(base)]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    cool, warm = 0.72, 0.13
    def mk(hh, ll, ss):
        return tohex([v * 255 for v in colorsys.hls_to_rgb(hh % 1, max(0, min(1, ll)), max(0, min(1, ss)))])
    if kind == 'metal':
        return [mk(shift_hue(h, cool, .3), l * .30, s * .6), mk(shift_hue(h, cool, .2), l * .62, s * .8), base,
                mk(shift_hue(h, warm, .1), l + (1 - l) * .45, s * .7), mk(shift_hue(h, warm, .15), l + (1 - l) * .85, s * .4)]
    if kind == 'skin':
        return [mk(shift_hue(h, 0.98, .6), l * .42, s * .55), mk(shift_hue(h, 0.99, .35), l * .82, s * .95), base,
                mk(shift_hue(h, warm, .2), l + (1 - l) * .35, s * .9), mk(shift_hue(h, warm, .3), l + (1 - l) * .62, s * .8)]
    return [mk(shift_hue(h, cool, .28), l * .34, min(1, s * 1.0 + .05)), mk(shift_hue(h, cool, .14), l * .70, min(1, s * 1.05)), base,
            mk(shift_hue(h, warm, .08), l + (1 - l) * .30, s * .95), mk(shift_hue(h, warm, .14), l + (1 - l) * .58, s * .85)]


# ───────────────────────────── 캔버스 ─────────────────────────────

class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.mat = [[None] * w for _ in range(h)]   # 재질 이름
        self.z = [[-1] * w for _ in range(h)]       # 그린 순서
        self.force = [[None] * w for _ in range(h)]  # 명암 강제(0~4)
        self.dots = {}                               # 명암 뒤에 찍는 고정 색
        self.mats = {}
        self.part = 0
        self.flat = set()                            # 명암을 넣지 않는 재질

    def material(self, name, base, kind='cloth', flat=False):
        self.mats[name] = ramp(base, kind) if isinstance(base, str) else base
        if flat:
            self.flat.add(name)

    def fill(self, test, mat, only=None, under=False):
        self.part += 1
        for y in range(self.h):
            for x in range(self.w):
                if test(x + .5, y + .5):
                    if only is not None and self.mat[y][x] not in only:
                        continue
                    if under and self.mat[y][x] is not None:
                        continue
                    self.mat[y][x] = mat
                    self.z[y][x] = self.part
                    self.force[y][x] = None

    def erase(self, test):
        for y in range(self.h):
            for x in range(self.w):
                if test(x + .5, y + .5):
                    self.mat[y][x] = None
                    self.force[y][x] = None

    def px(self, x, y, mat, level=None):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.part += 1
            self.mat[y][x] = mat
            self.z[y][x] = self.part
            self.force[y][x] = level

    def shadeat(self, x, y, level):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h and self.mat[y][x]:
            self.force[y][x] = level

    def dot(self, x, y, col):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.dots[(x, y)] = col

    def render(self, outline=True):
        W, H, M = self.w, self.h, self.mat
        out = [[None] * W for _ in range(H)]
        def run(x, y, dx, dy, m):
            n = 0
            x += dx; y += dy
            while 0 <= x < W and 0 <= y < H and M[y][x] == m and n < 6:
                n += 1; x += dx; y += dy
            return n
        for y in range(H):
            for x in range(W):
                m = M[y][x]
                if m is None:
                    continue
                rm = self.mats[m]
                if self.force[y][x] is not None:
                    out[y][x] = rm[self.force[y][x]]
                    continue
                if m in self.flat:
                    out[y][x] = rm[2]
                    continue
                du, dd, dl, dr = run(x, y, 0, -1, m), run(x, y, 0, 1, m), run(x, y, -1, 0, m), run(x, y, 1, 0, m)
                lv = 2
                above = M[y - 1][x] if y > 0 else None
                zab = self.z[y - 1][x] if y > 0 else -1
                # 위에서 덮는 것(앞머리·모자챙)이 있으면 그 아래는 그늘
                if above is not None and above != m and zab > self.z[y][x]:
                    lv = 1
                elif du == 0 and dd >= 1:
                    lv = 3
                elif dl == 0 and dr >= 2 and du >= 1:
                    lv = 3
                if dr == 0 and dl >= 2:
                    lv = 1
                elif dr == 1 and dl >= 4:
                    lv = min(lv, 1) if lv != 3 else 2
                if dd == 0 and du >= 2:
                    lv = 1
                # 다른 재질이 앞에 겹쳐 있는 경계(오른쪽·아래)는 한 단계 어둡게
                for ax, ay in ((1, 0), (0, 1)):
                    nx, ny = x + ax, y + ay
                    if 0 <= nx < W and 0 <= ny < H and M[ny][nx] not in (None, m) and self.z[ny][nx] > self.z[y][x]:
                        lv = min(lv, 1)
                out[y][x] = rm[lv]
        if outline:
            for y in range(H):
                for x in range(W):
                    m = M[y][x]
                    if m is None:
                        continue
                    edge = False
                    for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + ax, y + ay
                        if not (0 <= nx < W and 0 <= ny < H) or M[ny][nx] is None:
                            edge = True
                            break
                    if edge and self.force[y][x] is None:
                        out[y][x] = self.mats[m][0]
        for (x, y), c in self.dots.items():
            out[y][x] = c
        return out


# ───────────────────────────── 도형 ─────────────────────────────

def ell(cx, cy, rx, ry):
    return lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def rect(x0, y0, x1, y1):
    """칸 좌표로 x0..x1, y0..y1 (양끝 포함)"""
    return lambda x, y: x0 <= x - .5 <= x1 and y0 <= y - .5 <= y1


def poly(pts):
    def t(x, y):
        inside = False
        n = len(pts)
        for i in range(n):
            x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % n]
            if (y1 > y) != (y2 > y):
                xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
                if x < xi:
                    inside = not inside
        return inside
    return t


def seg(x1, y1, x2, y2, r):
    def t(x, y):
        dx, dy = x2 - x1, y2 - y1
        L = dx * dx + dy * dy
        k = 0 if L == 0 else max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / L))
        px, py = x1 + k * dx, y1 + k * dy
        return (x - px) ** 2 + (y - py) ** 2 <= r * r
    return t


def union(*ts):
    return lambda x, y: any(t(x, y) for t in ts)


def minus(a, b):
    return lambda x, y: a(x, y) and not b(x, y)


def both(a, b):
    return lambda x, y: a(x, y) and b(x, y)


# ───────────────────────────── 맵 사물 (32 밀도) ─────────────────────────────
# 바닥에 선 사물. 그림의 아래 가운데가 칸의 아래 가운데에 놓인다.

def leaves(c, blobs, mats):
    for i, b in enumerate(blobs):
        c.fill(ell(*b), mats[i % len(mats)])


def speck(c, mat, n, seed, region, level):
    import random
    r = random.Random(seed)
    x0, y0, x1, y1 = region
    for _ in range(n):
        x, y = r.randint(x0, x1), r.randint(y0, y1)
        if 0 <= x < c.w and 0 <= y < c.h and c.mat[y][x] and c.mat[y][x].startswith(mat):
            c.shadeat(x, y, level)


def prop_tree(leaf, bark='#7a4e30', snow=False, w=40, h=52):
    c = Canvas(w, h)
    for k in ('l1', 'l2', 'l3'):
        c.material(k, leaf)
    c.material('bark', bark)
    cx = w / 2
    c.fill(poly([(cx - 3, 34), (cx + 3, 34), (cx + 3.5, 48), (cx + 6, 51), (cx - 6, 51), (cx - 3.5, 48)]), 'bark')
    leaves(c, [(cx, 21, 15, 13), (cx - 9.5, 28, 8.5, 7.5), (cx + 9.5, 28, 8.5, 7.5), (cx - 1, 11, 10, 8), (cx - 6, 36, 7, 5), (cx + 6.5, 36, 7, 5), (cx + 7, 15, 7, 6), (cx - 8, 17, 7, 6)], ['l1', 'l2', 'l3'])
    speck(c, 'l', 18, 7, (4, 4, w - 12, 30), 4)
    speck(c, 'l', 14, 9, (6, 26, w - 4, 44), 1)
    for x in range(int(cx) - 1, int(cx) + 2):
        c.shadeat(x, 41, 1)
    return c.render()


def prop_pine(leaf, snow=False, w=36, h=56):
    c = Canvas(w, h)
    for k in ('l1', 'l2', 'l3'):
        c.material(k, leaf)
    c.material('bark', '#6a4228')
    c.material('snow', '#f4f8ff')
    cx = w / 2
    c.fill(rect(int(cx) - 2, 44, int(cx) + 1, 54), 'bark')
    tiers = [(cx, 3, 6, 16), (cx, 12, 10, 28), (cx, 22, 14, 40), (cx, 31, 16.5, 49)]
    for i, (x, top, half, bot) in enumerate(tiers):
        c.fill(poly([(x, top), (x + half, bot), (x + half * 0.4, bot - 1.5), (x, bot + 0.5), (x - half * 0.45, bot - 1.5), (x - half, bot)]), ['l1', 'l2', 'l3'][i % 3])
        if snow:
            c.fill(both(poly([(x, top), (x + half, bot), (x - half, bot)]), lambda xx, yy, top=top, x=x, half=half: yy < top + 2.6 + abs(xx - x) * (bot - top) / half * 0.55), 'snow')
    speck(c, 'l', 14, 3, (4, 6, w - 6, 48), 1)
    return c.render()


def prop_dead(bark, w=40, h=52):
    c = Canvas(w, h)
    c.material('bark', bark)
    c.material('bark2', bark)
    cx = w / 2
    c.fill(poly([(cx - 3, 22), (cx + 3, 22), (cx + 3.5, 48), (cx + 6, 51), (cx - 6, 51), (cx - 3.5, 48)]), 'bark')
    for a in [(cx, 24, cx - 11, 12, 1.4), (cx, 22, cx + 10, 8, 1.4), (cx - 6, 17, cx - 14, 14, 0.9), (cx + 5, 15, cx + 14, 15, 0.9), (cx, 23, cx + 2, 4, 1.2), (cx - 1, 30, cx - 13, 26, 1.0), (cx + 1, 32, cx + 12, 27, 1.0)]:
        c.fill(seg(*a), 'bark2')
    return c.render()


def prop_cactus(w=32, h=48):
    c = Canvas(w, h)
    c.material('cac', '#4f9a4a'); c.material('cac2', '#4f9a4a')
    c.fill(seg(16, 10, 16, 45, 4.2), 'cac')
    c.fill(union(seg(8, 18, 8, 28, 2.6), seg(8, 28, 13, 29, 2.6)), 'cac2')
    c.fill(union(seg(24.5, 22, 24.5, 32, 2.6), seg(24.5, 32, 19, 33, 2.6)), 'cac2')
    for x in (14, 18):
        for y in range(9, 44):
            if c.mat[y][x] == 'cac':
                c.shadeat(x, y, 1 if x == 18 else 3)
    c.dot(16, 6, '#ff7a9a'); c.dot(15, 7, '#ff7a9a'); c.dot(17, 7, '#ffb0c0')
    return c.render()


def prop_bush(leaf, w=32, h=26):
    c = Canvas(w, h)
    for k in ('l1', 'l2'):
        c.material(k, leaf)
    leaves(c, [(16, 12, 9, 7.5), (8, 17, 7, 6), (24, 17, 7, 6), (16, 19, 8, 5.5)], ['l1', 'l2'])
    speck(c, 'l', 10, 5, (3, 3, 26, 14), 4)
    return c.render()


def prop_rock(col, w=32, h=26):
    c = Canvas(w, h)
    c.material('r1', col); c.material('r2', col)
    c.fill(poly([(3, 24), (5, 14), (11, 6), (20, 4), (27, 9), (30, 18), (29, 24)]), 'r1')
    c.fill(poly([(17, 24), (20, 13), (27, 9), (30, 18), (29, 24)]), 'r2')
    c.fill(poly([(5, 14), (11, 6), (20, 4), (21, 9), (12, 12)]), 'r1')
    for x, y in ((9, 12), (10, 12), (14, 9), (15, 9), (16, 9)):
        c.shadeat(x, y, 4)
    for yy in range(14, 24):
        c.shadeat(19 + (yy - 14) // 4, yy, 1)
    return c.render()


def prop_crystal(col, w=32, h=44, save=False):
    c = Canvas(w, h)
    c.material('c1', col); c.material('c2', col); c.material('c3', col)
    if save:
        c.fill(poly([(16, 3), (24, 16), (16, 34), (8, 16)]), 'c1')
        c.fill(poly([(16, 3), (24, 16), (16, 18)]), 'c2')
        c.fill(poly([(16, 18), (24, 16), (16, 34)]), 'c3')
        for k in range(4):
            c.shadeat(12 + k, 9 + k * 2, 4)
        return c.render()
    c.fill(poly([(13, 42), (11, 18), (16, 8), (21, 18), (19, 42)]), 'c1')
    c.fill(poly([(16, 8), (21, 18), (19, 42), (16, 42)]), 'c2')
    c.fill(poly([(6, 42), (5, 28), (8, 22), (11, 28), (11, 42)]), 'c3')
    c.fill(poly([(21, 42), (21, 30), (25, 24), (28, 31), (27, 42)]), 'c3')
    for k in range(6):
        c.shadeat(13, 18 + k * 3, 4)
    return c.render()


def prop_chest(opened=False, w=32, h=28):
    c = Canvas(w, h)
    c.material('wood', '#9a5a30'); c.material('lid', '#a8643a'); c.material('iron', '#7a7a90', 'metal'); c.material('gold', '#f0c040', 'metal'); c.material('in', '#2a1810')
    c.fill(rect(4, 13, 27, 26), 'wood')
    if opened:
        c.fill(rect(4, 2, 27, 10), 'lid'); c.fill(rect(6, 10, 25, 14), 'in')
        c.fill(rect(9, 11, 22, 13), 'gold')
        for x in (5, 26):
            c.fill(rect(x, 3, x, 10), 'iron')
    else:
        c.fill(union(rect(4, 8, 27, 13), ell(16, 9, 12, 4.5)), 'lid')
        c.fill(rect(4, 12, 27, 13), 'iron')
        c.fill(rect(14, 11, 17, 17), 'gold')
        c.dot(15, 15, '#3a2410')
    for x in (7, 24):
        c.fill(rect(x, 13, x + 1, 26), 'iron')
    return c.render()


def prop_lamp(w=24, h=56):
    c = Canvas(w, h)
    c.material('post', '#3a3a4a', 'metal'); c.material('glass', '#ffe08a', flat=True); c.material('cap', '#2a2a38', 'metal')
    c.fill(rect(11, 18, 12, 54), 'post'); c.fill(rect(8, 52, 15, 55), 'post')
    c.fill(rect(8, 7, 15, 17), 'glass'); c.fill(poly([(6, 8), (12, 2), (18, 8)]), 'cap'); c.fill(rect(7, 17, 16, 18), 'cap')
    for y in range(8, 17):
        c.shadeat(9, y, 4)
    return c.render()


def prop_sign(w=32, h=30):
    c = Canvas(w, h)
    c.material('post', '#6a4228'); c.material('board', '#b8804a')
    c.fill(rect(15, 14, 16, 29), 'post')
    c.fill(rect(4, 4, 27, 17), 'board')
    for y in (8, 11, 14):
        for x in range(7, 25):
            if (x + y) % 5:
                c.shadeat(x, y, 1)
    return c.render()


def prop_fence(w=32, h=28):
    c = Canvas(w, h)
    c.material('wood', '#9a6a3c'); c.material('rail', '#a8784a')
    c.fill(rect(0, 9, 31, 12), 'rail'); c.fill(rect(0, 18, 31, 21), 'rail')
    for x in (3, 25):
        c.fill(rect(x, 4, x + 3, 27), 'wood')
        c.fill(poly([(x, 4), (x + 2, 1.5), (x + 4, 4)]), 'wood')
    return c.render()


PROPS = {
    'o_tree': lambda: prop_tree('#4a9a40'), 'o_tree_dead': lambda: prop_dead('#6a5a5a'), 'o_tree_dusk': lambda: prop_tree('#d8683a', '#5a3028'),
    'o_tree_swamp': lambda: prop_tree('#5a7a40', '#4a3a30'),
    'o_pine': lambda: prop_pine('#2f7a48'), 'o_pine_snow': lambda: prop_pine('#3a6a5a', snow=True),
    'o_cactus': prop_cactus, 'o_bush': lambda: prop_bush('#4f9a44'), 'o_bush_snow': lambda: prop_bush('#dfe8f2'), 'o_bush_dry': lambda: prop_bush('#a89a4a'),
    'o_rock': lambda: prop_rock('#8a8698'), 'o_rock_sand': lambda: prop_rock('#c8a068'), 'o_rock_ice': lambda: prop_rock('#9ccae8'),
    'o_crystal': lambda: prop_crystal('#a070e8'), 'o_crystal_gold': lambda: prop_crystal('#f0c040'), 'o_crystal_ice': lambda: prop_crystal('#8ad8f8'),
    'o_save': lambda: prop_crystal('#9a7af0', save=True), 'o_save_gold': lambda: prop_crystal('#f0c850', save=True),
    'o_chest': prop_chest, 'o_chest_open': lambda: prop_chest(True), 'o_lamp': prop_lamp, 'o_sign': prop_sign, 'o_fence': prop_fence,
}

# 생성할 그림: (이름, 캐릭터, 보기, 걸음)
ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-/:;<=>?@[]^_{|}~'


def encode(img):
    cols = []
    idx = {}
    rows = []
    for r in img:
        s = ''
        for v in r:
            if v is None:
                s += '.'
                continue
            if v not in idx:
                idx[v] = ALPHA[len(cols)]
                cols.append(v)
            s += idx[v]
        rows.append(s)
    if len(cols) > len(ALPHA):
        raise SystemExit('too many colors')
    return {'pal': ''.join(c.lstrip('#') for c in cols), 'rows': rows}


def build():
    return {k: encode(fn()) for k, fn in PROPS.items()}


def write_js(data):
    lines = ["'use strict';",
             '/* 여명의 종 — 맵 사물 도트 (tools/dawn_props.py 가 만든다. 직접 고치지 말 것).',
             '   pal: 6자리 색을 이어 붙인 것, rows: 글자 하나가 픽셀 하나(.은 투명). 타일과 같은 32 밀도. */',
             'const HD = {']
    for k, v in data.items():
        lines.append('  %s: { pal: %s, rows: [%s] },' % (k, json.dumps(v['pal']), ','.join(json.dumps(r) for r in v['rows'])))
    lines.append('};')
    path = os.path.join(ROOT, 'dawn', 'js', 'props.js')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    return path


def preview(data, path, names=None, scale=4, bg=(70, 96, 70)):
    from PIL import Image
    names = names or list(data)
    items = [(n, data[n]) for n in names]
    W = sum(len(v['rows'][0]) + 4 for _, v in items) * scale
    H = (max(len(v['rows']) for _, v in items) + 4) * scale
    img = Image.new('RGB', (W, H), bg)
    x0 = 2 * scale
    for n, v in items:
        pal = [tuple(int(v['pal'][i:i + 2], 16) for i in (j * 6, j * 6 + 2, j * 6 + 4)) for j in range(len(v['pal']) // 6)]
        for y, r in enumerate(v['rows']):
            for x, ch in enumerate(r):
                if ch == '.':
                    continue
                col = pal[ALPHA.index(ch)]
                for a in range(scale):
                    for b in range(scale):
                        img.putpixel((x0 + x * scale + a, 2 * scale + y * scale + b), col)
        x0 += (len(v['rows'][0]) + 4) * scale
    img.save(path)


if __name__ == '__main__':
    data = build()
    if '--preview' in sys.argv:
        d = sys.argv[sys.argv.index('--preview') + 1]
        os.makedirs(d, exist_ok=True)
        preview(data, os.path.join(d, 'props.png'), list(PROPS), scale=3)
    else:
        print(write_js(data), len(data))
