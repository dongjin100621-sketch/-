#!/usr/bin/env python3
"""여명의 종 — 고해상도 캐릭터 도트 생성기.

캐릭터를 부위(얼굴·머리칼·모자·옷·망토·무기)의 도형으로 조합한 뒤,
· 재질마다 색상 단계(외곽·어둠·중간·밝음·빛) 를 색조를 틀어 만들고
· 왼쪽 위에서 오는 빛으로 가장자리 명암을 넣고
· 실루엣에는 재질 색의 외곽선(selective outline)을 둘러
도트 그림(32×48 몸, 40×48 전투, 48×48 초상)을 만든다.
모든 디자인은 이 게임만의 것이다(다른 게임의 그림을 옮기지 않는다).

출력: dawn/js/chars.js (HD 그림 자료), --preview 로 미리보기 PNG.
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


# ───────────────────────────── 머리 (정규 좌표) ─────────────────────────────
# 머리 좌표계: 얼굴 중심 (cx, cy), 단위 r(얼굴 반폭). N(X, Y) → 픽셀.

class Head:
    def __init__(self, cx, cy, r, look=0.0):
        self.cx, self.cy, self.r, self.look = cx, cy, r, look   # look: 얼굴이 오른쪽을 보는 정도(0 정면, 1 옆)

    def P(self, X, Y):
        return (self.cx + X * self.r, self.cy + Y * self.r)

    def E(self, X, Y, RX, RY):
        x, y = self.P(X, Y)
        return ell(x, y, RX * self.r, RY * self.r)

    def Poly(self, pts):
        return poly([self.P(X, Y) for X, Y in pts])

    def face(self):
        L = self.look
        if L > 0.6:
            return union(self.E(0.12, -0.08, 1.0, 0.98), self.Poly([(-0.6, 0.05), (1.05, 0.05), (1.12, 0.38), (0.98, 0.52), (0.9, 0.8), (0.4, 1.05), (-0.4, 0.85)]))
        return union(self.E(0.05 * L, -0.08, 1.0, 0.98),
                     self.Poly([(-0.97 + .3 * L, 0.05), (0.97 + .05 * L, 0.05), (0.62 + .25 * L, 0.86), (0.05 + .3 * L, 1.06), (-0.55 + .3 * L, 0.86)]))


def hair_shapes(h, style, L):
    """(뒷머리, 앞머리) 도형. 뒷머리는 몸보다 먼저 그린다."""
    P = h.Poly
    E = h.E
    sh = L * 0.35
    cap = E(-sh * 0.4, -0.38, 1.3, 1.18)
    # 앞머리 아래 선: 톱니 모양
    def bangs(depth=0.0, teeth=5, jag=0.22, top=-0.32):
        pts = [(-1.4, -2.0), (1.4, -2.0), (1.4, top + depth)]
        for i in range(teeth * 2 + 1):
            X = 1.2 - 2.4 * i / (teeth * 2)
            Y = top + depth + (jag if i % 2 else 0) + (0.12 if abs(X) > 0.9 else 0)
            pts.append((X + sh * 0.5, Y))
        pts.append((-1.4, top + depth))
        return P(pts)
    side_l = P([(-1.33, -0.6), (-0.82, -0.5), (-0.86, 0.45), (-1.05, 0.62), (-1.3, 0.3)])
    side_r = P([(1.33 - sh, -0.6), (0.82 - sh * .3, -0.5), (0.86 - sh * .3, 0.45), (1.05 - sh, 0.62), (1.3 - sh, 0.3)])
    back, front = None, None
    if style == 'messy':
        spikes = P([(-1.2, -0.9), (-1.45, -1.25), (-0.85, -1.3), (-0.9, -1.75), (-0.35, -1.5), (0.0, -1.95), (0.3, -1.52), (0.85, -1.72), (0.8, -1.25), (1.42, -1.2), (1.2, -0.8)])
        front = union(both(cap, bangs(0.05, 4, 0.3)), spikes, side_l, side_r)
        back = E(0, -0.2, 1.3, 1.15)
    elif style == 'long':
        front = union(both(cap, bangs(0.0, 5, 0.18, -0.38)), side_l, side_r,
                      P([(-1.32, -0.3), (-0.86, -0.2), (-0.9, 1.25), (-1.4, 1.55), (-1.5, 0.6)]),
                      P([(1.32 - sh, -0.3), (0.86 - sh, -0.2), (0.9 - sh, 1.25), (1.4 - sh, 1.55), (1.5 - sh, 0.6)]))
        back = union(E(0, -0.3, 1.36, 1.2), P([(-1.45, -0.2), (1.45, -0.2), (1.62, 2.9), (0, 3.2), (-1.62, 2.9)]))
    elif style == 'wavy':
        front = union(both(cap, bangs(0.0, 4, 0.25, -0.36)), side_l, side_r,
                      P([(-1.32, -0.3), (-0.86, -0.2), (-0.95, 0.9), (-0.8, 1.5), (-1.3, 1.9), (-1.6, 1.2), (-1.45, 0.5)]),
                      P([(1.32 - sh, -0.3), (0.86 - sh, -0.2), (0.95 - sh, 0.9), (0.8 - sh, 1.5), (1.3 - sh, 1.9), (1.6 - sh, 1.2), (1.45 - sh, 0.5)]))
        back = union(E(0, -0.3, 1.4, 1.22), P([(-1.5, -0.2), (1.5, -0.2), (1.85, 1.6), (1.6, 2.6), (0, 2.8), (-1.6, 2.6), (-1.85, 1.6)]))
    elif style == 'bob':
        front = union(both(cap, bangs(0.08, 5, 0.12, -0.3)),
                      P([(-1.35, -0.6), (-0.85, -0.4), (-0.88, 0.75), (-1.38, 0.8)]),
                      P([(1.35 - sh, -0.6), (0.85 - sh, -0.4), (0.88 - sh, 0.75), (1.38 - sh, 0.8)]))
        back = E(0, -0.2, 1.36, 1.2)
    elif style == 'short':
        front = union(both(cap, bangs(-0.08, 4, 0.18, -0.42)),
                      P([(-1.3, -0.6), (-0.86, -0.5), (-0.9, 0.1), (-1.2, 0.15)]),
                      P([(1.3 - sh, -0.6), (0.86 - sh, -0.5), (0.9 - sh, 0.1), (1.2 - sh, 0.15)]))
        back = E(0, -0.3, 1.28, 1.1)
    elif style == 'ponytail':
        front = union(both(cap, bangs(0.0, 4, 0.22, -0.36)), side_l, side_r)
        tail_x = -1.0 + sh * 3
        back = union(E(0, -0.3, 1.3, 1.15), E(tail_x - 0.35, -1.0, 0.5, 0.45),
                     P([(tail_x - 0.7, -0.9), (tail_x - 0.1, -0.95), (tail_x - 0.9, 1.4), (tail_x - 1.5, 2.2), (tail_x - 1.25, 0.9)]))
    elif style == 'bun':
        front = union(both(cap, bangs(-0.05, 3, 0.15, -0.4)), side_l, side_r, E(0, -1.62, 0.55, 0.45))
        back = E(0, -0.3, 1.3, 1.12)
    elif style == 'bald':
        front = union(P([(-1.08, -0.35), (-0.9, -0.3), (-0.92, 0.25), (-1.1, 0.2)]), P([(1.08 - sh, -0.35), (0.9 - sh, -0.3), (0.92 - sh, 0.25), (1.1 - sh, 0.2)]))
        back = None
    elif style == 'none':
        front, back = None, None
    if L > 0.6 and front is not None and style != 'bald':
        # 옆모습: 뒤통수·정수리는 머리칼, 얼굴 쪽은 창을 낸다(앞머리 몇 가닥은 남김)
        win = P([(-0.05, -0.28), (0.15, -0.12), (0.35, -0.3), (0.55, -0.14), (0.8, -0.32), (1.6, -0.32), (1.6, 1.8), (-0.05, 1.8)])
        front = minus(union(front, E(-0.3, -0.38, 1.25, 1.15)), win)
        if back is not None:
            back = minus(back, win)
    return back, front


# ───────────────────────────── 캐릭터 그리기 ─────────────────────────────

def hair_tex(c, h, L, big):
    """머리칼 광택 띠(정수리 아래 둥근 띠)와 앞머리 가닥 사이 그늘"""
    def inner(x, y):
        return all(0 <= x + a < c.w and 0 <= y + b < c.h and c.mat[y + b][x + a] == 'hair' for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    th = 0.075 if big else 0.1
    for y in range(c.h):
        for x in range(c.w):
            if c.mat[y][x] != 'hair' or not inner(x, y):
                continue
            X = (x + .5 - h.cx) / h.r - 0.25 * L
            Y = (y + .5 - h.cy) / h.r
            if abs(X) < 0.95:
                band = -0.98 + 0.32 * X * X
                d = Y - band
                if abs(d) < th * (1.6 if big else 1.0):
                    c.shadeat(x, y, 4 if (abs(d) < th * 0.6 and abs(X) < 0.6 and big) or (not big and abs(X) < 0.35) else 3)
                elif big and th * 1.6 <= d < th * 3.2 and abs(X) < 0.8:
                    c.shadeat(x, y, 2)
            # 앞머리 가닥: 아래 끝에서 위로 짧은 그늘 줄
            if big and -0.75 < Y < -0.1 and abs(X) < 1.0:
                below = [c.mat[y + k][x] if y + k < c.h else None for k in (1, 2, 3)]
                col = int((x - h.cx) // 1)
                if col % 4 == 1 and 'hair' in below and below.count('hair') < 3:
                    c.shadeat(x, y, 1)

SKINS = {'light': '#f4c9a3', 'fair': '#f7d6bd', 'tan': '#d99a6c', 'brown': '#a8683f', 'pale': '#e8d4d8', 'old': '#e6b994'}


def setup(c, sp):
    c.material('skin', sp['skin'] if sp['skin'].startswith('#') else SKINS[sp['skin']], 'skin')
    c.material('hair', sp['hair'])
    for k, v in sp.get('colors', {}).items():
        kind = 'metal' if k in ('metal', 'steel', 'gold', 'blade', 'silver') else 'cloth'
        c.material(k, v, kind)
    c.material('eye', sp.get('eye', '#3a5fb0'))
    c.material('white', '#f2eef8', flat=True)


def eyes_small(c, h, sp, L):
    """몸 그림의 눈(2×3). L: 옆을 보는 정도"""
    er = c.mats['eye']
    lash = '#2a1a22'
    ey = int(round(h.cy + 0.18 * h.r))
    xs = [int(round(h.cx + (-0.5 + 0.35 * L) * h.r)), int(round(h.cx + (0.45 + 0.3 * L) * h.r))]
    if L > 0.75:
        xs = xs[1:]
    for i, x0 in enumerate(xs):
        far = L > 0.2 and i == 0
        if sp.get('closed'):
            c.dot(x0, ey + 1, lash); c.dot(x0 + 1, ey + 1, lash)
            continue
        c.dot(x0, ey - 1, lash); c.dot(x0 + 1, ey - 1, lash)
        if sp.get('lashes') and not far:
            c.dot(x0 + (2 if i == 1 or L > .2 else -1), ey - 1, lash)
        c.dot(x0, ey, er[1]); c.dot(x0 + 1, ey, '#ffffff' if not far else er[1])
        c.dot(x0, ey + 1, er[2]); c.dot(x0 + 1, ey + 1, er[3])
        if far:
            c.dots.pop((x0 + 1, ey), None); c.dots.pop((x0 + 1, ey + 1), None); c.dots.pop((x0 + 1, ey - 1), None)
            c.dot(x0 + 1, ey - 1, lash)
            c.dot(x0 + 1, ey, er[1]); c.dot(x0 + 1, ey + 1, er[2])
            c.dots.pop((x0, ey), None); c.dots.pop((x0, ey + 1), None); c.dots.pop((x0, ey - 1), None)
    # 입
    mx = int(round(h.cx + (0.05 + 0.4 * L) * h.r)); my = int(round(h.cy + 0.66 * h.r))
    sk = c.mats['skin']
    if sp.get('mouth', 'small') == 'smile':
        c.dot(mx - 1, my, sk[0]); c.dot(mx, my + 0, sk[0]) if False else c.dot(mx, my, '#a0404a')
    else:
        c.dot(mx, my, sk[0] if not sp.get('lips') else '#c0485a')
    if sp.get('blush'):
        for x0 in xs:
            c.dot(x0 - (1 if x0 < h.cx else -2), ey + 2, '#f09a9a')


def eyes_big(c, h, sp, L):
    """초상의 큰 눈(4×6 안팎)"""
    er = c.mats['eye']
    lash, lash2 = '#24161e', '#4a2e38'
    ey = int(round(h.cy + 0.12 * h.r))
    xs = [int(round(h.cx + (-0.55 + 0.3 * L) * h.r)) - 2, int(round(h.cx + (0.5 + 0.3 * L) * h.r)) - 1]
    sk = c.mats['skin']
    old = sp.get('old')
    for i, x0 in enumerate(xs):
        if sp.get('closed') or old == 'closed':
            for k in range(4):
                c.dot(x0 + k, ey + 2 + (1 if k in (0, 3) else 0) - (0 if k in (0, 3) else 0), lash)
            continue
        w = 4
        # 눈썹
        bx = x0 - (1 if i == 0 else 0)
        brow = sp.get('brow', 'soft')
        by = ey - 4 if brow != 'stern' else ey - 3
        for k in range(5):
            yy = by + (1 if (brow == 'stern' and ((i == 0 and k >= 3) or (i == 1 and k <= 1))) else 0) + (1 if brow == 'sad' and ((i == 0 and k <= 1) or (i == 1 and k >= 3)) else 0)
            c.dot(bx + k, yy, sp.get('browc', c.mats['hair'][1]))
        if old:
            # 가는 눈 + 주름
            for k in range(w):
                c.dot(x0 + k, ey + 1, lash)
            c.dot(x0 + 1, ey + 2, er[1]); c.dot(x0 + 2, ey + 2, er[2])
            c.dot(x0 - 1 if i == 0 else x0 + w, ey + 3, sk[1])
            continue
        # 위 속눈썹
        for k in range(-1 if i == 0 else 0, w + (1 if i == 1 else 0)):
            c.dot(x0 + k, ey - 1, lash)
        if sp.get('lashes'):
            c.dot(x0 - 1 if i == 0 else x0 + w, ey - 2, lash)
        # 흰자 테두리 + 눈동자
        for yy in range(ey, ey + 5):
            for k in range(w):
                c.dot(x0 + k, yy, er[1] if yy < ey + 2 else (er[2] if yy < ey + 4 else er[3]))
        c.dot(x0 + (0 if i == 0 else w - 1), ey + 1, '#f4f0f6') if False else None
        c.dot(x0 + 1, ey + 1, '#ffffff'); c.dot(x0 + 1, ey + 2, '#ffffff')
        c.dot(x0 + 2, ey + 3, er[4] if len(er) > 4 else er[3])
        c.dot(x0 + 1, ey + 4, er[1]); c.dot(x0 + 2, ey + 4, er[3])
        # 동공
        c.dot(x0 + 2, ey + 1, er[0]); c.dot(x0 + 2, ey + 2, er[0])
        # 아래 선
        for k in range(w):
            c.dot(x0 + k, ey + 5, sk[1])
        c.dot(x0 + (w if i == 1 else -1), ey, lash2)
    # 코·입
    nx = int(round(h.cx + (0.02 + 0.35 * L) * h.r)); ny = int(round(h.cy + 0.48 * h.r))
    c.dot(nx, ny, sk[1]); c.dot(nx + 1, ny + 1, sk[1]) if L > .2 else None
    my = int(round(h.cy + 0.74 * h.r))
    mouth = sp.get('mouth', 'small')
    lipc = '#b04050' if sp.get('lips') else sk[0]
    if mouth == 'smile':
        c.dot(nx - 2, my, lipc); c.dot(nx - 1, my + 1, lipc); c.dot(nx, my + 1, lipc); c.dot(nx + 1, my + 1, lipc); c.dot(nx + 2, my, lipc)
    elif mouth == 'grin':
        for k in range(-2, 3):
            c.dot(nx + k, my, sk[0])
        for k in range(-1, 2):
            c.dot(nx + k, my + 1, '#fbf4f0')
        c.dot(nx - 2, my + 1, sk[0]); c.dot(nx + 2, my + 1, sk[0])
    elif mouth == 'frown':
        c.dot(nx - 1, my + 1, lipc); c.dot(nx, my, lipc); c.dot(nx + 1, my, lipc); c.dot(nx + 2, my + 1, lipc)
    else:
        c.dot(nx - 1, my, lipc); c.dot(nx, my, lipc); c.dot(nx + 1, my, lipc)
    if sp.get('blush'):
        for x0 in xs:
            c.dot(x0, ey + 7, '#f2a0a0'); c.dot(x0 + 2, ey + 7, '#f2a0a0'); c.dot(x0 + 1, ey + 7, '#f6b6aa')
    if sp.get('scar'):
        for k in range(4):
            c.dot(xs[1] + 1 + k // 2, ey - 3 + k * 2 // 1 if False else ey - 2 + k, '#b05a4a')


def draw_hat(c, h, sp, L, layer):
    """모자·두건 등. layer 'back' 은 머리 뒤, 'front' 는 앞."""
    hat = sp.get('hat')
    if not hat:
        return
    P, E = h.Poly, h.E
    s = L * 0.35
    if hat == 'witch' and layer == 'front':
        c.fill(P([(-2.3, -0.55), (2.3, -0.55), (1.7, -0.2), (-1.7, -0.2)]), 'hat')
        c.fill(P([(-1.15, -0.5), (1.1, -0.5), (0.55, -1.7), (0.9, -2.4), (1.6, -2.55), (0.9, -2.75), (0.1, -2.3), (-0.6, -1.4)]), 'hat')
        c.fill(P([(-1.1, -0.72), (1.06, -0.72), (1.0, -0.52), (-1.05, -0.52)]), 'band')
    if hat == 'hood':
        if layer == 'back':
            c.fill(union(E(-s * .3, -0.3, 1.5, 1.42), P([(-1.6, 0.0), (1.6, 0.0), (1.9, 1.9), (-1.9, 1.9)])), 'hood')
        else:
            ring = minus(E(-s * .3, -0.3, 1.5, 1.42), E(0.05 + s * .2, 0.05, 1.08, 1.12))
            c.fill(both(ring, lambda x, y: y < h.cy + 0.55 * h.r), 'hood')
            c.fill(P([(-1.45, 0.3), (-1.0, 0.3), (-0.95, 1.4), (-1.6, 1.5)]), 'hood')
            c.fill(P([(1.45 - s, 0.3), (1.0 - s, 0.3), (0.95 - s, 1.4), (1.6 - s, 1.5)]), 'hood')
    if hat == 'bandana' and layer == 'front':
        c.fill(both(E(0, -0.38, 1.34, 1.2), lambda x, y: h.cy - 0.95 * h.r <= y <= h.cy - 0.45 * h.r), 'band')
        c.fill(P([(-1.25, -0.75), (-1.85, -0.35), (-1.7, 0.25), (-1.35, -0.4)]), 'band')
    if hat == 'helmet' and layer == 'front':
        c.fill(both(E(0, -0.42, 1.38, 1.3), lambda x, y: y < h.cy - 0.2 * h.r), 'steel')
        c.fill(P([(-1.4, -0.45), (1.4, -0.45), (1.42, -0.18), (-1.42, -0.18)]), 'steel')
        c.fill(P([(-1.42, -0.2), (-1.0, -0.2), (-1.0, 0.6), (-1.36, 0.5)]), 'steel')
        c.fill(P([(1.42, -0.2), (1.0, -0.2), (1.0, 0.6), (1.36, 0.5)]), 'steel')
        c.fill(P([(-0.12, -1.75), (0.12, -1.75), (0.18, -0.5), (-0.18, -0.5)]), 'gold')
    if hat == 'cap' and layer == 'front':
        c.fill(both(E(0, -0.5, 1.32, 1.15), lambda x, y: y < h.cy - 0.45 * h.r), 'hat')
        c.fill(P([(-1.3, -0.55), (1.6, -0.55), (1.5, -0.36), (-1.25, -0.4)]), 'hat')
    if hat == 'wide' and layer == 'front':
        c.fill(P([(-2.1, -0.55), (2.1, -0.55), (1.6, -0.3), (-1.6, -0.3)]), 'hat')
        c.fill(both(E(0, -0.75, 1.1, 0.95), lambda x, y: y < h.cy - 0.5 * h.r), 'hat')
        c.fill(P([(-1.05, -0.75), (1.05, -0.75), (1.05, -0.58), (-1.05, -0.58)]), 'band')
    if hat == 'veil':
        if layer == 'back':
            c.fill(P([(-1.4, -0.9), (1.4, -0.9), (1.9, 2.6), (-1.9, 2.6)]), 'veil')
        else:
            c.fill(P([(-1.25, -0.72), (1.25, -0.72), (1.25, -0.56), (-1.25, -0.56)]), 'gold')
            c.fill(E(0, -0.68, 0.18, 0.18), 'gem')
    if hat == 'nun':
        if layer == 'back':
            c.fill(union(E(0, -0.3, 1.45, 1.4), P([(-1.5, -0.2), (1.5, -0.2), (1.9, 2.2), (-1.9, 2.2)])), 'hood')
        else:
            ring = minus(E(0, -0.3, 1.45, 1.4), E(0.03 + s * .2, 0.05, 1.04, 1.1))
            c.fill(ring, 'hood')
            c.fill(both(minus(E(0, -0.15, 1.18, 1.2), E(0.03 + s * .2, 0.08, 1.0, 1.06)), lambda x, y: y < h.cy + 0.1 * h.r), 'white')
    if hat == 'crown' and layer == 'front':
        c.fill(P([(-0.8, -1.25), (-0.85, -1.75), (-0.5, -1.45), (-0.2, -1.95), (0.0, -1.5), (0.2, -1.95), (0.5, -1.45), (0.85, -1.75), (0.8, -1.25)]), 'gold')
        c.fill(E(0, -1.42, 0.14, 0.14), 'gem')
    if hat == 'goggles' and layer == 'front':
        c.fill(P([(-1.3, -0.95), (1.3, -0.95), (1.3, -0.75), (-1.3, -0.75)]), 'strap')
        c.fill(E(-0.48, -0.95, 0.36, 0.3), 'brass'); c.fill(E(0.48, -0.95, 0.36, 0.3), 'brass')
        c.fill(E(-0.48, -0.95, 0.2, 0.17), 'lens'); c.fill(E(0.48, -0.95, 0.2, 0.17), 'lens')
    if hat == 'headband' and layer == 'front':
        c.fill(P([(-1.3, -0.8), (1.3, -0.8), (1.3, -0.58), (-1.3, -0.58)]), 'band')
        c.fill(P([(-1.3, -0.75), (-1.95, -0.2), (-1.75, 0.0), (-1.2, -0.55)]), 'band')
    if hat == 'fur' :
        if layer == 'back':
            c.fill(union(E(0, -0.3, 1.55, 1.45)), 'fur')
        else:
            ring = minus(E(0, -0.3, 1.55, 1.45), E(0.04 + s * .2, 0.0, 1.05, 1.15))
            c.fill(both(ring, lambda x, y: y < h.cy + 0.7 * h.r), 'fur')


def head_back(c, h, sp, L):
    """몸보다 먼저 그리는 뒷머리·두건 뒤쪽"""
    bk, fr = hair_shapes(h, sp.get('hairstyle', 'short'), L)
    draw_hat(c, h, sp, L, 'back')
    if bk:
        c.fill(bk, 'hair')


def head(c, h, sp, L, big=False, back_view=False):
    """머리 앞쪽. 순서: (뒷머리는 head_back) → 얼굴 → 앞머리 → 모자"""
    style = sp.get('hairstyle', 'short')
    bk, fr = hair_shapes(h, style, L)
    if back_view:
        hood = sp.get('hat') in ('hood', 'nun', 'fur')
        if not hood:
            if bk:
                c.fill(bk, 'hair')
            if fr:
                c.fill(fr, 'hair')
            if style in ('bald',):
                c.fill(h.face(), 'skin')
                c.fill(h.E(0, -0.1, 1.0, 1.0), 'skin')
                if fr:
                    c.fill(fr, 'hair')
        draw_hat(c, h, sp, L, 'front') if sp.get('hat') not in ('veil',) else None
        return
    if bk:
        # 얼굴 둘레의 뒷머리(몸에 가린 부분은 다시 그리지 않는다)
        c.fill(both(bk, lambda x, y: y < h.cy + 0.9 * h.r), 'hair')
    c.fill(h.face(), 'skin')
    # 귀
    if style in ('short', 'messy', 'bald', 'ponytail', 'bun') and sp.get('hat') not in ('hood', 'nun', 'helmet', 'fur'):
        ex = h.cx + (-1.02 + 0.6 * L) * h.r
        c.fill(ell(ex, h.cy + 0.2 * h.r, 0.2 * h.r + .3, 0.3 * h.r + .3), 'skin')
    if sp.get('beard'):
        bd = sp['beard']
        if bd == 'full':
            c.fill(h.Poly([(-1.0 + .3 * L, 0.15), (1.0, 0.15), (0.95, 0.9), (0.4 + .3 * L, 1.55), (0.0 + .3 * L, 1.7), (-0.5 + .3 * L, 1.5), (-1.0 + .3 * L, 0.8)]), 'beard')
            c.erase(lambda x, y: False)
            mx, my = h.P(0.02 + 0.4 * L, 0.66)
            c.fill(both(ell(mx, my + 0.1 * h.r, 0.42 * h.r, 0.16 * h.r + .3), lambda x, y: True), 'skin')
        elif bd == 'long':
            c.fill(h.Poly([(-0.95 + .3 * L, 0.2), (0.95, 0.2), (0.8, 1.0), (0.35 + .3 * L, 2.4), (0.0 + .3 * L, 2.7), (-0.35 + .3 * L, 2.4), (-0.85 + .3 * L, 1.0)]), 'beard')
            mx, my = h.P(0.02 + 0.4 * L, 0.6)
            c.fill(ell(mx, my, 0.5 * h.r, 0.13 * h.r + .3), 'beard2')
        elif bd == 'stubble':
            c.fill(both(h.face(), lambda x, y: y > h.cy + 0.45 * h.r), 'beard', only=('skin',))
    if sp.get('mask'):
        c.fill(both(h.face(), lambda x, y: y > h.cy + (0.42 if big else 0.5) * h.r), 'mask')
    if big:
        eyes_big(c, h, sp, L)
    else:
        eyes_small(c, h, sp, L)
    if fr:
        c.fill(fr, 'hair')
        hair_tex(c, h, L, big)
    if L > 0.6 and sp.get('hat') not in ('hood', 'nun', 'helmet', 'fur') and style not in ('long', 'wavy', 'bob'):
        c.fill(h.E(-0.12, 0.22, 0.2, 0.3), 'skin')
    draw_hat(c, h, sp, L, 'front')
    if sp.get('earring'):
        ex, ey = h.P(-0.98 + 0.5 * L, 0.55)
        c.fill(ell(ex, ey + 0.6, 0.9, 1.1), 'gold')


# ── 몸 ──

def body_front(c, sp, f, view='front', walk=0):
    """정면/뒷모습 몸. f: 몸 비율(아이 0.8, 거구 1.15). walk: -1/0/1 다리"""
    cx = 16
    build = sp.get('build', 'normal')
    wide = {'normal': 1.0, 'big': 1.28, 'slim': 0.9, 'child': 0.85, 'old': 1.0}[build]
    top = 22 if build != 'child' else 27
    hip = 33 if build != 'child' else 37
    foot = 46
    sw = 6.2 * wide           # 어깨 반폭
    ww = 5.0 * wide           # 허리 반폭
    outfit = sp.get('outfit', 'tunic')
    lower = sp.get('lower', 'pants')
    # 망토 (뒤)
    if sp.get('cape') and view == 'front':
        c.fill(poly([(cx - sw - 0.5, top + 1), (cx + sw + 0.5, top + 1), (cx + sw + 2.5, foot - 6), (cx - sw - 2.5, foot - 6)]), 'cape')
    # 다리
    lx, rx = cx - 3.0 * min(wide, 1.15), cx + 3.0 * min(wide, 1.15)
    lr = 2.0 * min(wide, 1.2)
    ly0 = hip
    dl = -1 if walk == 1 else 0
    dr = -1 if walk == -1 else 0
    if lower in ('pants', 'shorts', 'skirt', 'tights'):
        legmat = 'legs' if lower != 'tights' else 'tights'
        knee = hip + 6
        c.fill(seg(lx, ly0, lx, foot - 4 + dl, lr), legmat if lower in ('pants', 'tights') else 'skin')
        c.fill(seg(rx, ly0, rx, foot - 4 + dr, lr), legmat if lower in ('pants', 'tights') else 'skin')
        if lower == 'shorts':
            c.fill(rect(int(lx - lr), hip, int(rx + lr) - 1, knee - 2), 'legs')
    # 신발
    for x0, d in ((lx, dl), (rx, dr)):
        c.fill(union(rect(int(x0 - lr), foot - 5 + d, int(x0 + lr) - 1, foot - 1 + d), rect(int(x0 - lr), foot + d, int(x0 + lr) - 1 + (0 if view == 'back' else 0), foot + d)), 'boots')
    # 긴 옷자락(로브·드레스)
    if lower in ('robe', 'dress', 'gown'):
        flare = {'robe': 2.5, 'dress': 3.5, 'gown': 5.0}[lower]
        hem = foot - (1 if lower != 'gown' else 0)
        c.fill(poly([(cx - ww, hip - 3), (cx + ww, hip - 3), (cx + ww + flare, hem), (cx - ww - flare, hem)]), 'lower')
        if lower == 'gown':
            c.fill(poly([(cx - 1.5, hip - 2), (cx + 1.5, hip - 2), (cx + 3.5, hem), (cx - 3.5, hem)]), 'lower2')
    if lower == 'skirt':
        c.fill(poly([(cx - ww, hip - 2), (cx + ww, hip - 2), (cx + ww + 2.5, hip + 5), (cx - ww - 2.5, hip + 5)]), 'lower')
    if lower == 'harem':
        c.fill(union(seg(lx - .3, hip, lx - 0.5, foot - 5, lr + 1.0), seg(rx + .3, hip, rx + 0.5, foot - 5, lr + 1.0)), 'lower')
        c.fill(rect(int(lx - lr - 1), foot - 6, int(lx + lr), foot - 5), 'gold')
        c.fill(rect(int(rx - lr), foot - 6, int(rx + lr + 1) - 1, foot - 5), 'gold')
    # 몸통
    torso = poly([(cx - sw + 0.5, top), (cx + sw - 0.5, top), (cx + sw + 0.4, top + 2.5), (cx + ww + 0.3, hip), (cx - ww - 0.3, hip), (cx - sw - 0.4, top + 2.5)])
    if outfit == 'dancer':
        c.fill(torso, 'skin')
        c.fill(both(torso, lambda x, y: top + 1.5 <= y <= top + 5.5), 'top')
        c.fill(rect(int(cx - ww - 1), hip - 2, int(cx + ww), hip - 1), 'gold')
    else:
        c.fill(torso, 'top')
    # 옷 모양
    if outfit in ('tunic', 'coat', 'armor', 'vest', 'robe', 'dress') and view == 'front':
        if outfit == 'vest':
            c.fill(poly([(cx - 2.2, top), (cx + 2.2, top), (cx + 1.0, hip - 2), (cx - 1.0, hip - 2)]), 'shirt')
        if outfit == 'coat':
            c.fill(poly([(cx - 1.4, top), (cx + 1.4, top), (cx + 0.6, hip), (cx - 0.6, hip)]), 'shirt')
            c.fill(poly([(cx - ww - 0.3, hip - 1), (cx - 0.4, hip - 1), (cx - 0.6, foot - 6), (cx - ww - 2.3, foot - 6)]), 'top')
            c.fill(poly([(cx + 0.4, hip - 1), (cx + ww + 0.3, hip - 1), (cx + ww + 2.3, foot - 6), (cx + 0.6, foot - 6)]), 'top')
        if outfit == 'armor':
            c.fill(poly([(cx - sw + 1.2, top + 1.5), (cx + sw - 1.2, top + 1.5), (cx + ww - 0.5, hip - 3), (cx - ww + 0.5, hip - 3)]), 'steel')
        if outfit == 'robe':
            c.fill(poly([(cx - 1.0, top + 1), (cx + 1.0, top + 1), (cx + 1.0, hip + 6), (cx - 1.0, hip + 6)]), 'trim')
        if outfit == 'dress' and sp.get('apron'):
            c.fill(poly([(cx - ww + 0.5, top + 4), (cx + ww - 0.5, top + 4), (cx + ww + 1.5, foot - 4), (cx - ww - 1.5, foot - 4)]), 'apron')
    if sp.get('belt', True) and outfit not in ('robe', 'dancer') and lower not in ('gown',):
        c.fill(rect(int(cx - ww - 0.5), hip - 2, int(cx + ww), hip - 1), 'belt')
        if view == 'front':
            c.fill(rect(cx - 1, hip - 2, cx, hip - 1), 'gold')
    # 어깨 장식
    if sp.get('pauldron'):
        c.fill(ell(cx - sw, top + 1.6, 2.6, 2.0), 'steel'); c.fill(ell(cx + sw, top + 1.6, 2.6, 2.0), 'steel')
    # 팔
    arm = 'skin' if outfit == 'dancer' else ('sleeve' if 'sleeve' in c.mats else 'top')
    al, ar = cx - sw - 0.6, cx + sw + 0.6
    hand = top + 11 if build != 'child' else top + 8
    swing = 1 if walk else 0
    c.fill(seg(al, top + 1.8, al - 0.8, hand - 1 + (swing if walk == 1 else 0), 1.7 * min(wide, 1.2)), arm)
    c.fill(seg(ar, top + 1.8, ar + 0.8, hand - 1 + (swing if walk == -1 else 0), 1.7 * min(wide, 1.2)), arm)
    if outfit == 'robe' or sp.get('wide_sleeve'):
        c.fill(poly([(al - 1.6, hand - 5), (al + 1.4, hand - 5), (al + 1.2, hand), (al - 2.8, hand)]), arm)
        c.fill(poly([(ar - 1.4, hand - 5), (ar + 1.6, hand - 5), (ar + 2.8, hand), (ar - 1.2, hand)]), arm)
    if outfit == 'dancer':
        c.fill(rect(int(al - 2), hand - 4, int(al), hand - 4), 'gold'); c.fill(rect(int(ar), hand - 4, int(ar + 1), hand - 4), 'gold')
    c.fill(ell(al - 0.9, hand + 0.4 + (swing if walk == 1 else 0), 1.5, 1.4), 'skin')
    c.fill(ell(ar + 0.9, hand + 0.4 + (swing if walk == -1 else 0), 1.5, 1.4), 'skin')
    # 목
    if outfit != 'robe' or True:
        c.fill(rect(cx - 2, top - 2, cx + 1, top), 'skin', under=True)
    # 목도리·옷깃
    if sp.get('scarf'):
        c.fill(poly([(cx - 4.5, top - 1), (cx + 4.5, top - 1), (cx + 4.2, top + 2), (cx - 4.2, top + 2)]), 'scarf')
        if view == 'front':
            c.fill(poly([(cx + 2.0, top + 1), (cx + 4.2, top + 1), (cx + 3.4, top + 8), (cx + 1.6, top + 7)]), 'scarf')
        else:
            c.fill(poly([(cx - 2.0, top + 1), (cx - 4.2, top + 1), (cx - 3.4, top + 8), (cx - 1.6, top + 7)]), 'scarf')
    if sp.get('collar'):
        c.fill(poly([(cx - 4.5, top - 1), (cx + 4.5, top - 1), (cx + 5, top + 2), (cx, top + 3), (cx - 5, top + 2)]), 'collar')
    if sp.get('cape') and view == 'back':
        c.fill(poly([(cx - sw - 0.5, top), (cx + sw + 0.5, top), (cx + sw + 2.5, foot - 6), (cx - sw - 2.5, foot - 6)]), 'cape')
    if sp.get('bag') and view == 'back':
        c.fill(rect(cx - 4, top + 2, cx + 3, top + 9), 'bag')


def body_side(c, sp, walk=0):
    """옆모습(오른쪽을 봄). walk: 0 섬, 1/2 걸음"""
    cx = 16
    build = sp.get('build', 'normal')
    wide = {'normal': 1.0, 'big': 1.25, 'slim': 0.9, 'child': 0.85, 'old': 1.0}[build]
    top, hip, foot = 22, 33, 46
    outfit, lower = sp.get('outfit', 'tunic'), sp.get('lower', 'pants')
    hw = 4.1 * wide
    if sp.get('cape'):
        c.fill(poly([(cx - hw - 0.5, top + 1), (cx - 1, top + 1), (cx - 2, foot - 6), (cx - hw - 4.0 - walk * 0.5, foot - 6)]), 'cape')
    # 다리: 걸음에 따라 앞뒤
    stride = [0.9, 2.8, -2.8][walk]
    legs = [(cx + stride, 1), (cx - stride, 0)]
    for k, (fx, front) in enumerate(sorted(legs, key=lambda a: a[1])):
        mat = 'legs' if lower in ('pants', 'tights', 'coatp') else ('skin' if lower in ('skirt', 'shorts') else 'legs')
        if lower == 'tights':
            mat = 'tights'
        c.fill(seg(cx + 0.2 * (fx - cx) , hip, fx, foot - 4, 1.9), mat if front else mat)
        if not front:
            for yy in range(hip + 1, foot - 3):
                for xx in range(int(fx) - 2, int(fx) + 3):
                    c.shadeat(xx, yy, 1) if c.mat[yy][xx] == mat else None
        c.fill(union(rect(int(fx - 2), foot - 5, int(fx + 1), foot - 1), rect(int(fx - 2), foot, int(fx + 3), foot)), 'boots')
    if lower in ('robe', 'dress', 'gown'):
        fl = {'robe': 2.5, 'dress': 3.2, 'gown': 4.5}[lower]
        c.fill(poly([(cx - hw, hip - 3), (cx + hw, hip - 3), (cx + hw + fl + stride * 0.3, foot - 1), (cx - hw - fl + stride * 0.3, foot - 1)]), 'lower')
    if lower == 'skirt':
        c.fill(poly([(cx - hw, hip - 2), (cx + hw, hip - 2), (cx + hw + 2, hip + 5), (cx - hw - 2, hip + 5)]), 'lower')
    if lower == 'harem':
        c.fill(union(seg(cx + stride * .2, hip, cx + stride, foot - 5, 2.7), seg(cx - stride * .2, hip, cx - stride, foot - 5, 2.7)), 'lower')
    torso = poly([(cx - hw, top), (cx + hw - 0.5, top), (cx + hw + 0.6, top + 3), (cx + hw, hip), (cx - hw, hip), (cx - hw - 0.4, top + 3)])
    if outfit == 'dancer':
        c.fill(torso, 'skin'); c.fill(both(torso, lambda x, y: top + 1.5 <= y <= top + 5.5), 'top')
    else:
        c.fill(torso, 'top')
    if outfit == 'coat':
        c.fill(poly([(cx - hw, hip - 1), (cx + hw, hip - 1), (cx + hw + 1.5, foot - 6), (cx - hw - 2.5, foot - 6)]), 'top')
    if sp.get('belt', True) and outfit not in ('robe', 'dancer') and lower != 'gown':
        c.fill(rect(int(cx - hw), hip - 2, int(cx + hw), hip - 1), 'belt')
    if sp.get('bag'):
        c.fill(rect(int(cx - hw - 3), top + 2, int(cx - hw), top + 9), 'bag')
    if sp.get('scarf'):
        c.fill(poly([(cx - 3.5, top - 1), (cx + 3.5, top - 1), (cx + 3.5, top + 2), (cx - 3.5, top + 2)]), 'scarf')
        c.fill(poly([(cx - 3.0, top), (cx - 1.5, top), (cx - 5.5 - walk, top + 6), (cx - 7 - walk, top + 5)]), 'scarf')
    if sp.get('collar'):
        c.fill(poly([(cx - 3.5, top - 1), (cx + 3.5, top - 1), (cx + 4, top + 2), (cx - 4, top + 2)]), 'collar')
    # 팔(앞 팔만)
    arm = 'skin' if outfit == 'dancer' else ('sleeve' if 'sleeve' in c.mats else 'top')
    sw_ = [0, -2.2, 2.2][walk]
    c.fill(seg(cx + 0.5, top + 2, cx + 0.5 + sw_, top + 10, 1.7), arm)
    c.fill(ell(cx + 0.5 + sw_ * 1.1, top + 11, 1.5, 1.4), 'skin')
    c.fill(rect(cx - 1, top - 2, cx + 1, top), 'skin', under=True)


WEAPONS = {
    'sword': dict(kind='sword', blade='#d8dde8', hilt='#6e4228', guard='#e8b84a'),
    'spear': dict(kind='spear', blade='#d8dde8', hilt='#8a5a34', guard='#e8b84a'),
    'dagger': dict(kind='dagger', blade='#d8dde8', hilt='#3e2a30', guard='#c0c8d8'),
    'bow': dict(kind='bow', blade='#8a5a34', hilt='#e8e0c8', guard='#e8b84a'),
    'axe': dict(kind='axe', blade='#c8ccd8', hilt='#6e4228', guard='#8a8ca0'),
    'staff': dict(kind='staff', blade='#6e4228', hilt='#9a6a3c', guard='#ffd447'),
    'staff_dark': dict(kind='staff', blade='#3a2a40', hilt='#5a3a58', guard='#b070ff'),
    'cane': dict(kind='cane', blade='#8a5a34', hilt='#6e4228', guard='#6e4228'),
}


def weapon(c, wid, hx_, hy_, pose='battle', orb=None):
    """손 위치 (hx_, hy_)에서 무기를 그린다"""
    w = WEAPONS[wid]
    c.material('blade', w['blade'], 'metal' if w['kind'] in ('sword', 'spear', 'dagger', 'axe') else 'cloth')
    c.material('hilt', w['hilt'])
    c.material('guard', w['guard'], 'metal')
    k = w['kind']
    if k == 'sword':
        c.fill(seg(hx_ - 1.2, hy_ + 2.2, hx_ + 0.4, hy_ - 0.6, 0.8), 'hilt')
        c.fill(seg(hx_ - 1.6, hy_ - 1.6, hx_ + 2.2, hy_ + 0.8, 0.85), 'guard')
        c.fill(poly([(hx_ + 0.2, hy_ - 1.6), (hx_ + 1.7, hy_ - 0.6), (hx_ + 9.6, hy_ - 12.2), (hx_ + 9.4, hy_ - 13.6), (hx_ + 8.0, hy_ - 13.1)]), 'blade')
        for t in range(2, 11):
            c.shadeat(hx_ + 0.9 + t * 0.78, hy_ - 1.0 - t * 1.08, 4)
    elif k == 'spear':
        c.fill(seg(hx_ - 4.5, hy_ + 7, hx_ + 6.5, hy_ - 13, 0.75), 'hilt')
        c.fill(poly([(hx_ + 5.6, hy_ - 12.2), (hx_ + 7.6, hy_ - 11.0), (hx_ + 9.6, hy_ - 18.5)]), 'blade')
        c.fill(seg(hx_ + 5.0, hy_ - 11.0, hx_ + 7.6, hy_ - 12.6, 0.7), 'guard')
    elif k == 'dagger':
        c.fill(seg(hx_ - 0.6, hy_ + 1.6, hx_ + 0.2, hy_ - 0.2, 0.8), 'hilt')
        c.fill(seg(hx_ - 1.0, hy_ - 1.0, hx_ + 1.6, hy_ + 0.6, 0.7), 'guard')
        c.fill(poly([(hx_ + 0.6, hy_ - 1.4), (hx_ + 1.8, hy_ - 0.6), (hx_ + 6.2, hy_ - 4.6), (hx_ + 6.4, hy_ - 5.6), (hx_ + 5.2, hy_ - 5.4)]), 'blade')
    elif k == 'bow':
        pts = []
        for i in range(13):
            a = -1.15 + 2.3 * i / 12
            pts.append((hx_ - 3.0 + 7.6 * math.cos(a), hy_ + 9.2 * math.sin(a)))
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            c.fill(seg(x1, y1, x2, y2, 0.75), 'blade')
        c.fill(seg(pts[0][0], pts[0][1], pts[-1][0], pts[-1][1], 0.4), 'hilt')
        c.fill(ell(hx_ + 4.4, hy_, 0.9, 1.4), 'guard')
    elif k == 'axe':
        c.fill(seg(hx_ - 1.5, hy_ + 5, hx_ + 4.5, hy_ - 11, 0.85), 'hilt')
        c.fill(poly([(hx_ + 3.0, hy_ - 7.5), (hx_ + 9.5, hy_ - 12.5), (hx_ + 10.2, hy_ - 7.0), (hx_ + 8.5, hy_ - 3.5), (hx_ + 2.6, hy_ - 5.0)]), 'blade')
        c.fill(poly([(hx_ + 3.6, hy_ - 9.5), (hx_ + 1.0, hy_ - 12.0), (hx_ + 0.6, hy_ - 8.5), (hx_ + 3.0, hy_ - 7.8)]), 'blade')
    elif k in ('staff', 'cane'):
        top = hy_ - (15 if k == 'staff' else 3)
        c.fill(seg(hx_ + 0.5, hy_ + 13, hx_ + 1.5, top, 0.85), 'blade')
        if k == 'staff':
            c.fill(ell(hx_ + 1.6, top - 1.5, 2.0, 2.2), 'guard')
            c.fill(seg(hx_ - 0.6, top + 0.6, hx_ + 3.6, top + 0.6, 0.6), 'hilt')
            if orb:
                c.material('orb', orb)
                c.fill(ell(hx_ + 1.6, top - 1.5, 1.2, 1.3), 'orb')
        else:
            c.fill(seg(hx_ + 1.5, top, hx_ + 3.2, top - 0.6, 0.85), 'blade')


def body_battle(c, sp):
    """전투 자세(3/4, 오른쪽을 봄, 40×48 캔버스 중심 x=17)"""
    cx = 17
    build = sp.get('build', 'normal')
    wide = {'normal': 1.0, 'big': 1.25, 'slim': 0.9, 'child': 0.85, 'old': 1.0}[build]
    top, hip, foot = 22, 33, 46
    outfit, lower = sp.get('outfit', 'tunic'), sp.get('lower', 'pants')
    sw, ww = 5.8 * wide, 4.6 * wide
    if sp.get('cape'):
        c.fill(poly([(cx - sw - 0.5, top + 1), (cx + 1, top + 1), (cx - 1, foot - 5), (cx - sw - 5.5, foot - 7)]), 'cape')
    # 뒤 팔(어두움)
    arm = 'skin' if outfit == 'dancer' else ('sleeve' if 'sleeve' in c.mats else 'top')
    c.fill(seg(cx - sw + 0.2, top + 2, cx - sw - 1.6, top + 9.5, 1.6), arm)
    c.fill(ell(cx - sw - 1.8, top + 10.6, 1.5, 1.4), 'skin')
    for yy in range(top, top + 13):
        for xx in range(int(cx - sw - 4), int(cx - sw + 2)):
            if 0 <= xx < c.w and c.mat[yy][xx] in (arm, 'skin'):
                c.shadeat(xx, yy, 1)
    # 다리(벌린 자세)
    lmat = 'tights' if lower == 'tights' else ('skin' if lower in ('skirt', 'shorts') else 'legs')
    c.fill(seg(cx - 2.2, hip, cx - 4.6, foot - 4, 1.95), lmat)
    for yy in range(hip, foot - 3):
        for xx in range(int(cx - 8), int(cx - 1)):
            if c.mat[yy][xx] == lmat:
                c.shadeat(xx, yy, 1)
    c.fill(seg(cx + 2.0, hip, cx + 4.0, foot - 4, 1.95), lmat)
    c.fill(union(rect(int(cx - 7), foot - 5, int(cx - 3), foot - 1), rect(int(cx - 7), foot, int(cx - 2), foot)), 'boots')
    c.fill(union(rect(int(cx + 2), foot - 5, int(cx + 5), foot - 1), rect(int(cx + 2), foot, int(cx + 7), foot)), 'boots')
    if lower in ('robe', 'dress', 'gown'):
        fl = {'robe': 3.0, 'dress': 3.8, 'gown': 5.0}[lower]
        c.fill(poly([(cx - ww, hip - 3), (cx + ww, hip - 3), (cx + ww + fl + 1, foot - 1), (cx - ww - fl, foot - 1)]), 'lower')
    if lower == 'skirt':
        c.fill(poly([(cx - ww, hip - 2), (cx + ww, hip - 2), (cx + ww + 3, hip + 5), (cx - ww - 2.5, hip + 5)]), 'lower')
    if lower == 'harem':
        c.fill(union(seg(cx - 2.2, hip, cx - 4.6, foot - 5, 2.8), seg(cx + 2.0, hip, cx + 4.0, foot - 5, 2.8)), 'lower')
        c.fill(rect(int(cx - 7), foot - 6, int(cx - 3), foot - 5), 'gold'); c.fill(rect(int(cx + 2), foot - 6, int(cx + 6), foot - 5), 'gold')
    torso = poly([(cx - sw + 0.8, top), (cx + sw - 0.2, top), (cx + sw + 0.6, top + 2.5), (cx + ww + 0.6, hip), (cx - ww - 0.2, hip), (cx - sw - 0.2, top + 2.5)])
    if outfit == 'dancer':
        c.fill(torso, 'skin'); c.fill(both(torso, lambda x, y: top + 1.5 <= y <= top + 5.5), 'top')
        c.fill(rect(int(cx - ww - 1), hip - 2, int(cx + ww), hip - 1), 'gold')
    else:
        c.fill(torso, 'top')
    if outfit == 'vest':
        c.fill(poly([(cx - 0.5, top), (cx + 3.5, top), (cx + 2.2, hip - 2), (cx + 0.2, hip - 2)]), 'shirt')
    if outfit == 'coat':
        c.fill(poly([(cx + 0.6, top), (cx + 3.0, top), (cx + 2.0, hip), (cx + 1.0, hip)]), 'shirt')
        c.fill(poly([(cx - ww - 0.2, hip - 1), (cx + 1.2, hip - 1), (cx + 0.5, foot - 6), (cx - ww - 3.5, foot - 6)]), 'top')
        c.fill(poly([(cx + 1.6, hip - 1), (cx + ww + 0.6, hip - 1), (cx + ww + 3.2, foot - 7), (cx + 1.8, foot - 6)]), 'top')
    if outfit == 'armor':
        c.fill(poly([(cx - sw + 1.6, top + 1.5), (cx + sw - 0.4, top + 1.5), (cx + ww, hip - 3), (cx - ww + 0.8, hip - 3)]), 'steel')
    if outfit == 'robe':
        c.fill(poly([(cx + 0.6, top + 1), (cx + 2.4, top + 1), (cx + 3.2, hip + 6), (cx + 1.4, hip + 6)]), 'trim')
    if outfit == 'dress' and sp.get('apron'):
        c.fill(poly([(cx - ww + 1, top + 4), (cx + ww, top + 4), (cx + ww + 2.5, foot - 4), (cx - ww - 1, foot - 4)]), 'apron')
    if sp.get('belt', True) and outfit not in ('robe', 'dancer') and lower != 'gown':
        c.fill(rect(int(cx - ww), hip - 2, int(cx + ww + 0.5), hip - 1), 'belt')
        c.fill(rect(cx + 1, hip - 2, cx + 2, hip - 1), 'gold')
    if sp.get('pauldron'):
        c.fill(ell(cx + sw - 0.4, top + 1.6, 2.6, 2.0), 'steel')
    c.fill(rect(cx - 1, top - 2, cx + 2, top), 'skin', under=True)
    if sp.get('scarf'):
        c.fill(poly([(cx - 4.2, top - 1), (cx + 4.6, top - 1), (cx + 4.2, top + 2), (cx - 4.2, top + 2)]), 'scarf')
        c.fill(poly([(cx - 3.0, top), (cx - 1.0, top), (cx - 6.5, top + 7), (cx - 8.5, top + 5.5)]), 'scarf')
    if sp.get('collar'):
        c.fill(poly([(cx - 4.5, top - 1), (cx + 5, top - 1), (cx + 5.5, top + 2), (cx + 0.5, top + 3), (cx - 4.5, top + 2)]), 'collar')
    # 앞 팔 + 무기
    hand = (cx + sw + 3.4, top + 8.4)
    if sp.get('weapon') in ('staff', 'staff_dark'):
        hand = (cx + sw + 2.6, top + 9.5)
    if sp.get('weapon') == 'bow':
        hand = (cx + sw + 4.4, top + 5.5)
    c.fill(seg(cx + sw - 0.4, top + 2, hand[0] - 0.8, hand[1] - 0.6, 1.6), arm)
    if outfit == 'robe' or sp.get('wide_sleeve'):
        c.fill(poly([(cx + sw - 1.6, top + 3), (cx + sw + 1.4, top + 2.2), (hand[0] + 0.6, hand[1] - 2.5), (hand[0] - 2.4, hand[1] + 0.4)]), arm)
    if outfit == 'dancer':
        c.fill(seg(hand[0] - 2.4, hand[1] - 2.2, hand[0] - 1.6, hand[1] - 1.0, 0.7), 'gold')
    if sp.get('weapon'):
        weapon(c, sp['weapon'], hand[0], hand[1], orb=sp.get('orb'))
    c.fill(ell(hand[0], hand[1], 1.5, 1.45), 'skin')


def make_sprite(sp, view, walk=0):
    if view == 'battle':
        c = Canvas(40, 48)
    else:
        c = Canvas(32, 48)
    setup(c, sp)
    child = sp.get('build') == 'child'
    hy = 14.5 if not child else 20.5
    hr = 6.3 if not child else 5.8
    if view == 'front':
        head_back(c, Head(16, hy, hr), sp, 0)
        body_front(c, sp, 1, 'front', walk)
        head(c, Head(16, hy, hr), sp, 0)
        if sp.get('prop') and walk == 0:
            weapon(c, sp['prop'], 25.2, 33.5 if not child else 35, orb=sp.get('orb'))
            c.fill(ell(24.9, 33.4 if not child else 35, 1.5, 1.4), 'skin')
    elif view == 'back':
        body_front(c, sp, 1, 'back', walk)
        head(c, Head(16, hy, hr), sp, 0, back_view=True)
    elif view == 'side':
        head_back(c, Head(16.6, hy, hr, look=0.9), sp, 0.9)
        body_side(c, sp, walk)
        head(c, Head(16.6, hy, hr, look=0.9), sp, 0.9)
    elif view == 'battle':
        head_back(c, Head(17.6, hy, hr, look=0.35), sp, 0.35)
        body_battle(c, sp)
        head(c, Head(17.6, hy, hr, look=0.35), sp, 0.35)
    if child:
        pass
    return c.render()


def make_portrait(sp):
    """48×48 흉상"""
    c = Canvas(48, 48)
    setup(c, sp)
    h = Head(23.5, 21.5, 11.0, look=0.15)
    L = 0.15
    build = sp.get('build', 'normal')
    wide = {'normal': 1.0, 'big': 1.3, 'slim': 0.92, 'child': 0.85, 'old': 1.0}[build]
    outfit = sp.get('outfit', 'tunic')
    # 뒷머리·두건 먼저(어깨 뒤)
    style = sp.get('hairstyle', 'short')
    bk, fr = hair_shapes(h, style, L)
    draw_hat(c, h, sp, L, 'back')
    if bk:
        c.fill(bk, 'hair')
    # 어깨·몸
    cx = 23.5
    sw = 17 * wide
    c.fill(rect(int(cx - 3.5), 31, int(cx + 3.5), 40), 'skin')
    sh = poly([(cx - sw, 48), (cx - sw + 2, 41), (cx - 8, 37.5), (cx + 8, 37.5), (cx + sw - 2, 41), (cx + sw, 48)])
    if outfit == 'dancer':
        c.fill(sh, 'skin')
        c.fill(both(sh, lambda x, y: y >= 44), 'top')
    else:
        c.fill(sh, 'top')
    if outfit in ('vest', 'coat'):
        c.fill(poly([(cx - 5, 37.5), (cx + 5, 37.5), (cx + 2, 48), (cx - 2, 48)]), 'shirt')
    if outfit == 'armor':
        c.fill(poly([(cx - 9, 40), (cx + 9, 40), (cx + 8, 48), (cx - 8, 48)]), 'steel')
    if outfit == 'robe':
        c.fill(poly([(cx - 1.6, 38), (cx + 1.6, 38), (cx + 1.6, 48), (cx - 1.6, 48)]), 'trim')
    if sp.get('pauldron'):
        c.fill(ell(cx - sw + 4, 42, 5.5, 4), 'steel'); c.fill(ell(cx + sw - 4, 42, 5.5, 4), 'steel')
    if sp.get('cape'):
        c.fill(poly([(cx - sw - 1, 48), (cx - sw + 1, 41), (cx - sw + 5, 39), (cx - sw + 4, 48)]), 'cape')
        c.fill(poly([(cx + sw + 1, 48), (cx + sw - 1, 41), (cx + sw - 5, 39), (cx + sw - 4, 48)]), 'cape')
    if sp.get('scarf'):
        c.fill(poly([(cx - 8.5, 35), (cx + 8.5, 35), (cx + 9.5, 41), (cx - 9.5, 41)]), 'scarf')
        c.fill(poly([(cx + 3, 39), (cx + 8, 39), (cx + 7, 48), (cx + 3, 48)]), 'scarf')
    if sp.get('collar'):
        c.fill(poly([(cx - 9, 36), (cx + 9, 36), (cx + 10, 41), (cx, 43), (cx - 10, 41)]), 'collar')
    if sp.get('hat') in ('hood', 'nun', 'fur'):
        c.fill(poly([(cx - 13, 30), (cx + 13, 30), (cx + 16, 44), (cx + 7, 40), (cx - 7, 40), (cx - 16, 44)]), {'hood': 'hood', 'nun': 'hood', 'fur': 'fur'}[sp['hat']])
    # 얼굴
    c.fill(h.face(), 'skin')
    if style in ('short', 'messy', 'bald', 'ponytail', 'bun') and sp.get('hat') not in ('hood', 'nun', 'helmet', 'fur'):
        ex = h.cx + (-1.02 + 0.5 * L) * h.r
        c.fill(ell(ex, h.cy + 0.25 * h.r, 1.6, 2.6), 'skin')
        ex2 = h.cx + (1.0 + 0.1 * L) * h.r
        c.fill(ell(ex2, h.cy + 0.25 * h.r, 1.4, 2.5), 'skin')
    if sp.get('beard'):
        bd = sp['beard']
        if bd == 'full':
            c.fill(h.Poly([(-1.02, 0.15), (1.02, 0.15), (0.98, 0.85), (0.45, 1.5), (0.0, 1.62), (-0.45, 1.5), (-0.98, 0.85)]), 'beard')
            c.fill(h.E(0.04, 0.78, 0.36, 0.12), 'skin')
        elif bd == 'long':
            c.fill(h.Poly([(-0.98, 0.25), (0.98, 0.25), (0.85, 1.05), (0.35, 2.2), (0.0, 2.45), (-0.35, 2.2), (-0.85, 1.05)]), 'beard')
            c.fill(h.E(0.04, 0.62, 0.55, 0.14), 'beard2')
        elif bd == 'stubble':
            c.fill(both(h.face(), lambda x, y: y > h.cy + 0.5 * h.r), 'beard', only=('skin',))
    if sp.get('mask'):
        c.fill(both(h.face(), lambda x, y: y > h.cy + 0.5 * h.r), 'mask')
    eyes_big(c, h, sp, L)
    if sp.get('mask'):
        for k in list(c.dots):
            if k[1] > h.cy + 0.5 * h.r:
                c.dots.pop(k)
    if fr:
        c.fill(fr, 'hair')
        hair_tex(c, h, L, True)
    draw_hat(c, h, sp, L, 'front')
    if sp.get('earring'):
        ex, ey = h.P(-1.0 + 0.5 * L, 0.6)
        c.fill(ell(ex, ey + 1.5, 1.3, 1.6), 'gold')
    return c.render()


# ───────────────────────────── 캐릭터 정의 ─────────────────────────────
# 모두 이 게임의 인물을 위한 새 디자인이다.

CHARS = {
    # 리안: 종지기 견습생. 갈색 뻗친 머리, 푸른 윗옷, 붉은 목도리, 가죽 어깨받이
    'rian': dict(skin='light', hair='#8a5a36', hairstyle='messy', eye='#3f78c8', outfit='tunic', lower='pants', scarf=True, pauldron=False,
                 colors=dict(top='#3a6cc0', sleeve='#2f5aa8', legs='#4a3a58', boots='#6e4228', belt='#7a4a2a', gold='#e8b84a', scarf='#d84a3a', steel='#9aa2b8', cape='#2a3a6a'),
                 weapon='sword', brow='soft', mouth='small'),
    # 세이라: 성당 신관. 금빛 긴 머리, 흰 사제복에 금 테두리, 하늘색 숄
    'seira': dict(skin='fair', hair='#f0c860', hairstyle='long', eye='#4a8ad8', outfit='robe', lower='robe', lashes=True, blush=True, collar=True, wide_sleeve=True,
                  colors=dict(top='#eae6f2', sleeve='#e0dcec', lower='#eae6f2', trim='#e8b84a', boots='#c8a070', gold='#e8b84a', collar='#7ab8e8', belt='#e8b84a'),
                  weapon='staff', orb='#7ae0ff', brow='soft', mouth='smile', lips=True),
    # 카일: 떠돌이 도적. 초록 두건, 입가리개, 가죽 조끼
    'kyle': dict(skin='light', hair='#c86a3a', hairstyle='short', eye='#5aa848', outfit='vest', lower='pants', hat='hood', mask=True,
                 colors=dict(top='#5a4434', shirt='#3a6a3a', sleeve='#3a6a3a', legs='#3a3444', boots='#4a3428', belt='#2a2028', gold='#c0c8d8', hood='#3e8a46', mask='#2a3a34'),
                 weapon='dagger', brow='stern'),
    # 미르: 학술원의 어린 마도사. 은빛 단발, 보랏빛 마녀 모자와 로브
    'mir': dict(skin='fair', hair='#d8dcea', hairstyle='bob', eye='#a86ae0', outfit='robe', lower='robe', hat='witch', lashes=True, wide_sleeve=True,
                colors=dict(top='#6a3ab0', sleeve='#5a30a0', lower='#5a30a0', trim='#e8b84a', hat='#4a2a8a', band='#e8b84a', boots='#3a2a40', gold='#e8b84a', belt='#e8b84a'),
                weapon='staff', orb='#ff8ad8', brow='soft', mouth='small', blush=True),
    # 보른: 용병. 민머리에 붉은 머리띠, 덥수룩한 수염, 거구
    'born': dict(skin='tan', hair='#5a3424', hairstyle='bald', eye='#7a4a2a', build='big', outfit='armor', lower='pants', hat='headband', beard='full', pauldron=True, scar=True,
                 colors=dict(top='#7a3a2a', sleeve='#7a3a2a', legs='#4a3a34', boots='#3a2a24', belt='#3a2a24', gold='#c8a050', steel='#8a90a4', band='#d83a30', beard='#5a3424'),
                 weapon='axe', brow='stern', mouth='grin'),
    # 엘다: 설원 사냥꾼. 검은 말총머리, 털 깃, 짙은 초록 사냥복
    'elda': dict(skin='light', hair='#2a2a3a', hairstyle='ponytail', eye='#3a8a6a', outfit='tunic', lower='pants', collar=True, cape=True, lashes=True,
                 colors=dict(top='#2f6a40', sleeve='#285a36', legs='#4a3a2a', boots='#5a3a24', belt='#5a3a24', gold='#c8a050', collar='#e8e0d0', cape='#6a4a30'),
                 weapon='bow', brow='stern', mouth='small'),
    # 하젤: 유랑 무희. 붉은 물결머리, 금 장신구, 분홍 무희복과 너울
    'hazel': dict(skin='light', hair='#d8402a', hairstyle='wavy', eye='#e0a030', outfit='dancer', lower='harem', hat='veil', lashes=True, earring=True, lips=True, belt=False,
                  colors=dict(top='#e86aa8', lower='#f0a0c8', veil='#f8c8e0', gold='#f0c040', gem='#40c0a0', boots='#c8584a', legs='#f0a0c8'),
                  weapon='dagger', brow='soft', mouth='smile'),
    # 루카: 쫓겨난 연금술사. 청록 머리, 이마의 보안경, 긴 갈색 외투
    'luka': dict(skin='light', hair='#3ab0a0', hairstyle='messy', eye='#e0a040', outfit='coat', lower='pants', hat='goggles', scarf=True,
                 colors=dict(top='#7a5434', shirt='#e8e0c8', sleeve='#6a4a2e', legs='#3a3a4a', boots='#4a3428', belt='#3a2a24', gold='#d0a040', scarf='#3a7a8a', strap='#4a3428', brass='#d0a040', lens='#8ae0f0'),
                 weapon='spear', brow='soft', mouth='grin'),
    # 노크테: 황혼의 사제. 창백한 얼굴, 은발, 보랏빛 두건 사제복
    'nocte': dict(skin='pale', hair='#c8c8dc', hairstyle='long', eye='#d04a6a', outfit='robe', lower='robe', hat='hood', collar=False, wide_sleeve=True, build='slim',
                  colors=dict(top='#3a2a5a', sleeve='#32244e', lower='#2a2048', trim='#c8a050', hood='#4a3470', boots='#1a1428', gold='#c8a050', belt='#c8a050'),
                  weapon='staff_dark', orb='#ff5a8a', brow='sad', mouth='frown'),
    # ── 마을 사람들 ──
    'man': dict(skin='light', hair='#6a4228', hairstyle='short', eye='#5a4a3a', outfit='tunic', lower='pants', colors=dict(top='#5a9a48', sleeve='#4a8a3e', legs='#6a5040', boots='#4a3428', belt='#4a3428', gold='#a8803a'), mouth='smile', brow='soft'),
    'villager2': dict(skin='tan', hair='#3a2a24', hairstyle='short', eye='#5a4a3a', outfit='vest', lower='pants', hat='cap', colors=dict(top='#3a5a8a', shirt='#e8e4d8', sleeve='#e8e4d8', legs='#4a4a5a', boots='#3a2a24', belt='#3a2a24', gold='#a8803a', hat='#2a3a6a'), mouth='small'),
    'villager3': dict(skin='tan', hair='#2a2420', hairstyle='short', eye='#4a3a2a', outfit='coat', lower='pants', beard='stubble', colors=dict(top='#8a6a44', shirt='#c8b890', sleeve='#7a5a3a', legs='#4a3a2a', boots='#3a2a24', belt='#2a2020', gold='#a8803a', beard='#7a5a40'), brow='stern'),
    'woman': dict(skin='light', hair='#8a4a2a', hairstyle='bun', eye='#6a4a3a', outfit='dress', lower='dress', apron=True, lashes=True, blush=True, colors=dict(top='#c86a8a', sleeve='#b85a7a', lower='#c86a8a', apron='#f4f0e8', boots='#6a4a3a', belt='#f4f0e8', gold='#a8803a'), mouth='smile'),
    'woman2': dict(skin='fair', hair='#3a2a3a', hairstyle='long', eye='#4a6ab0', outfit='dress', lower='dress', lashes=True, colors=dict(top='#4a7ac0', sleeve='#3a6ab0', lower='#3a5aa0', boots='#4a3a3a', belt='#e8e0d0', gold='#c8a050'), mouth='small'),
    'woman3': dict(skin='light', hair='#c8783a', hairstyle='ponytail', eye='#4a8a5a', outfit='dress', lower='dress', apron=True, lashes=True, blush=True, colors=dict(top='#5a9a5a', sleeve='#4a8a4a', lower='#4a7a4a', apron='#f0ead8', boots='#5a3a2a', belt='#f0ead8', gold='#a8803a'), mouth='smile'),
    'elder': dict(skin='old', hair='#e8e4ec', hairstyle='bald', eye='#5a4a3a', outfit='robe', lower='robe', beard='long', old=True, wide_sleeve=True, prop='cane',
                  colors=dict(top='#7a5a3a', sleeve='#6a4a30', lower='#6a4a30', trim='#c8a050', boots='#4a3428', beard='#eeeaf2', beard2='#d8d4e0', gold='#c8a050', belt='#c8a050'), mouth='small', brow='soft'),
    'child': dict(skin='light', hair='#e8b840', hairstyle='messy', eye='#3a7ac0', build='child', outfit='tunic', lower='shorts', blush=True, colors=dict(top='#4a8ad0', sleeve='#4a8ad0', legs='#6a5040', boots='#7a4a2a', belt='#6a4a2a', gold='#a8803a'), mouth='smile'),
    'child2': dict(skin='fair', hair='#7a4a8a', hairstyle='bob', eye='#8a5ab0', build='child', outfit='dress', lower='dress', blush=True, lashes=True, colors=dict(top='#e070a0', sleeve='#e070a0', lower='#d0608a', boots='#7a4a5a', belt='#f0e0e8', gold='#a8803a'), mouth='smile'),
    'guard': dict(skin='light', hair='#6a4a2a', hairstyle='short', eye='#4a5a7a', outfit='armor', lower='pants', hat='helmet', pauldron=True, prop='spear', beard='stubble',
                  colors=dict(top='#3a5a9a', sleeve='#3a5a9a', legs='#3a3a4a', boots='#3a3040', belt='#3a2a24', gold='#e8b84a', steel='#a8b0c4', beard='#9a7a5a'), brow='stern'),
    'merchant': dict(skin='tan', hair='#4a3428', hairstyle='short', eye='#4a3a2a', outfit='coat', lower='pants', hat='wide', beard='full', bag=True,
                     colors=dict(top='#6a3a8a', shirt='#e8c870', sleeve='#5a307a', legs='#4a3a3a', boots='#3a2a24', belt='#3a2a24', gold='#e8b84a', hat='#5a3a2a', band='#e8b84a', beard='#5a3a2a', bag='#8a5a34'), mouth='grin', brow='soft'),
    'nun': dict(skin='fair', hair='#3a2a2a', hairstyle='none', eye='#4a6a8a', outfit='robe', lower='robe', hat='nun', wide_sleeve=True, lashes=True,
                colors=dict(top='#2a2834', sleeve='#2a2834', lower='#2a2834', trim='#e8e4ec', hood='#22202c', boots='#1a1820', gold='#c8a050', belt='#c8a050'), mouth='smile', brow='soft'),
    'queen': dict(skin='fair', hair='#e8d8b0', hairstyle='long', eye='#5a8ad0', outfit='dress', lower='gown', hat='crown', lashes=True, lips=True, collar=True,
                  colors=dict(top='#f0ecf6', sleeve='#e0dcec', lower='#4a6ab0', lower2='#f0ecf6', boots='#c8a050', belt='#c8a050', gold='#f0c848', gem='#e04a6a', collar='#c8a050'), mouth='small', brow='sad'),
    'lumi': dict(skin='pale', hair='#e0e0f0', hairstyle='long', eye='#8a9ad8', build='child', outfit='dress', lower='dress', blush=True, lashes=True,
                 colors=dict(top='#f4f0f8', sleeve='#f4f0f8', lower='#e8e4f4', boots='#c8c0d8', belt='#a8b8e8', gold='#c8a050'), mouth='small', brow='soft'),
    'scholar': dict(skin='light', hair='#5a5a6a', hairstyle='short', eye='#4a4a6a', outfit='robe', lower='robe', wide_sleeve=True, beard='stubble',
                    colors=dict(top='#3a4a6a', sleeve='#34405e', lower='#2e3a58', trim='#c8a050', boots='#2a2a34', gold='#c8a050', beard='#8a8a9a', belt='#c8a050'), mouth='small', brow='stern'),
    'morga': dict(skin='pale', hair='#2a1a3a', hairstyle='wavy', eye='#40e0a0', outfit='robe', lower='gown', hat='witch', lashes=True, lips=True, wide_sleeve=True,
                  colors=dict(top='#2a4a4a', sleeve='#1e3a3a', lower='#1a3434', lower2='#2a5a5a', trim='#7ae0c0', hat='#1a2a30', band='#7ae0c0', boots='#1a1a24', gold='#7ae0c0', belt='#7ae0c0'), mouth='smile', brow='stern'),
}


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
SHEET = []
for hid in ('rian', 'seira', 'kyle', 'mir', 'born', 'elda', 'hazel', 'luka', 'nocte'):
    SHEET.append((hid, hid, 'battle', 0))       # 전투(오른쪽을 봄)
    SHEET.append((hid + '_f', hid, 'front', 0))  # 필드에서 사람으로 서 있을 때
for v, w in (('d', 'front'), ('u', 'back'), ('s', 'side')):
    SHEET.append(('rian_%s0' % v, 'rian', w, 0))
    SHEET.append(('rian_%s1' % v, 'rian', w, 1))
    SHEET.append(('rian_%s2' % v, 'rian', w, 2 if w == 'side' else -1))
for nid in ('man', 'villager2', 'villager3', 'woman', 'woman2', 'woman3', 'elder', 'child', 'child2', 'guard', 'merchant', 'nun', 'queen', 'lumi', 'scholar'):
    SHEET.append((nid, nid, 'front', 0))
PORTRAITS = ['rian', 'seira', 'kyle', 'mir', 'born', 'elda', 'hazel', 'luka', 'nocte', 'man', 'villager2', 'villager3', 'woman', 'woman2', 'woman3',
             'elder', 'child', 'child2', 'guard', 'merchant', 'nun', 'queen', 'lumi', 'scholar', 'morga']

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
    out = {}
    for name, cid, view, walk in SHEET:
        out[name] = encode(make_sprite(CHARS[cid], view, walk))
    for pid in PORTRAITS:
        out['pt_' + pid] = encode(make_portrait(CHARS[pid]))
    for k, fn in PROPS.items():
        out[k] = encode(fn())
    return out


def write_js(data):
    lines = ["'use strict';",
             '/* 여명의 종 — 고해상도 캐릭터 도트 (tools/dawn_chars.py 가 만든다. 직접 고치지 말 것).',
             '   pal: 6자리 색을 이어 붙인 것, rows: 글자 하나가 픽셀 하나(.은 투명). 몸 32×48, 전투 40×48, 초상(pt_) 48×48. */',
             'const HD = {']
    for k, v in data.items():
        lines.append('  %s: { pal: %s, rows: [%s] },' % (k, json.dumps(v['pal']), ','.join(json.dumps(r) for r in v['rows'])))
    lines.append('};')
    path = os.path.join(ROOT, 'dawn', 'js', 'chars.js')
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
        heroes = [n for n, *_ in SHEET if n in CHARS and n in ('rian', 'seira', 'kyle', 'mir', 'born', 'elda', 'hazel', 'luka', 'nocte')]
        preview(data, os.path.join(d, 'battle.png'), heroes)
        preview(data, os.path.join(d, 'front.png'), [n for n, c, v, w in SHEET if v != 'battle' and not n.startswith('rian_')])
        preview(data, os.path.join(d, 'walk.png'), [n for n, *_ in SHEET if n.startswith('rian_')])
        preview(data, os.path.join(d, 'portraits.png'), ['pt_' + p for p in PORTRAITS[:13]], scale=3)
        preview(data, os.path.join(d, 'portraits2.png'), ['pt_' + p for p in PORTRAITS[13:]], scale=3)
        preview(data, os.path.join(d, 'props.png'), list(PROPS), scale=3)
    else:
        print(write_js(data), len(data))
