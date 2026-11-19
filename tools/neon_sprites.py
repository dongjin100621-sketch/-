"""네온 하트: 사용자가 보낸 캐릭터 시트(tools/neon_src/sheet1.png, sheet2.png)에서
포즈별 스프라이트와 초상화를 잘라 neon/img/sprites.png(아틀라스)와 neon/js/atlas.js 로 만든다.
사용법: python3 tools/neon_sprites.py   (scipy, pillow 필요)

각 항목: 이름: (시트, x0, y0, x1, y1, 바라보는 방향(1=오른쪽, -1=왼쪽))
잘라낸 사각형 안에 이웃 포즈의 조각이 끼어들면, 그 조각(연결 요소)의 대부분이 사각형 밖에 있을 때 지운다."""
import os, json
import numpy as np
from PIL import Image
from scipy import ndimage

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(root, 'tools', 'neon_src')
OUT_IMG = os.path.join(root, 'neon', 'img', 'sprites.png')
OUT_JS = os.path.join(root, 'neon', 'js', 'atlas.js')

S = {
    # ── 주인공 (카이) ──
    'kai_idle':   ('sheet2', 0, 35, 122, 222, 1),
    'kai_idle2':  ('sheet2', 118, 35, 212, 222, 1),
    'kai_walk1':  ('sheet2', 0, 428, 90, 598, 1),
    'kai_walk2':  ('sheet2', 82, 420, 172, 598, 1),
    'kai_jump':   ('sheet2', 210, 58, 334, 216, 1),
    'kai_slash':  ('sheet2', 222, 318, 336, 418, 1),
    'kai_blade':  ('sheet2', 165, 455, 252, 598, 1),
    'kai_dash':   ('sheet2', 205, 215, 334, 312, 1),
    'kai_skill':  ('sheet2', 238, 432, 336, 596, 1),
    'kai_face':   ('sheet1', 8, 38, 142, 205, 1),
    # ── 히로인 (세라) ──
    'sera_idle':  ('sheet2', 336, 33, 446, 258, 1),
    'sera_idle2': ('sheet2', 440, 33, 604, 258, 1),
    'sera_cast':  ('sheet2', 468, 338, 636, 452, 1),
    'sera_face':  ('sheet1', 515, 22, 700, 250, 1),
    # ── 중간보스 1 (헤일로) ──
    'halo_idle':  ('sheet2', 612, 30, 888, 326, 1),
    'halo_atk':   ('sheet2', 616, 296, 894, 598, 1),
    'halo_face':  ('sheet1', 648, 356, 792, 528, 1),
    # ── 중간보스 2 (레드 조) ──
    'red_idle':   ('sheet2', 860, 28, 1212, 284, 1),
    'red_atk':    ('sheet2', 856, 262, 1214, 484, 1),
    'red_face':   ('sheet1', 4, 332, 138, 478, 1),
    # ── 최종보스 (오라클) ──
    'ora_idle':   ('sheet2', 1162, 0, 1536, 350, 1),
    'ora_atk':    ('sheet2', 1162, 338, 1536, 600, 1),
    'ora_face':   ('sheet2', 1262, 55, 1440, 235, 1),
    # ── 엑스트라 (NPC) ──
    'raven':      ('sheet2', 0, 610, 100, 814, 1),     # 운반책
    'kage':       ('sheet2', 272, 604, 386, 834, 1),   # 픽서
    'momo':       ('sheet2', 376, 618, 556, 834, 1),   # 넷러너
    'nova':       ('sheet2', 708, 610, 888, 834, 1),   # 리퍼닥
    'lyla':       ('sheet2', 1140, 618, 1294, 834, 1), # 바 가수
    'lyla_drone': ('sheet2', 1252, 606, 1302, 662, 1),
    'toto':       ('sheet2', 1302, 620, 1464, 824, 1), # 무기상
    'bolt':       ('sheet2', 1452, 758, 1534, 826, 1), # 토토의 로봇
    # ── 적 ──
    'sec_idle':   ('sheet2', 546, 604, 652, 814, 1),   # 헬리오스 보안대
    'sec_atk':    ('sheet2', 552, 812, 672, 1008, 1),
    'thug_idle':  ('sheet2', 882, 608, 1032, 832, 1),  # 볼트 갱
    'thug_atk':   ('sheet2', 998, 828, 1142, 1004, 1),
    'gun_idle':   ('sheet2', 182, 604, 280, 812, 1),   # 검은 코트 총잡이
    'gun_atk':    ('sheet2', 282, 826, 412, 1008, 1),
    'sin_idle':   ('sheet2', 94, 608, 192, 812, 1),    # 암살자
    'sin_atk':    ('sheet2', 92, 892, 208, 1008, 1),
    'psy_idle':   ('sheet2', 1034, 610, 1142, 824, 1), # 사이버사이코
    'drone1':     ('sheet2', 1456, 640, 1534, 706, 1),
    'drone2':     ('sheet2', 1470, 704, 1534, 762, 1),
    # 초상화(엑스트라)
    'raven_face': ('sheet2', 0, 610, 100, 720, 1),
    'kage_face':  ('sheet2', 280, 604, 380, 714, 1),
    'momo_face':  ('sheet2', 396, 618, 520, 728, 1),
    'nova_face':  ('sheet2', 720, 610, 860, 730, 1),
    'lyla_face':  ('sheet2', 1160, 618, 1270, 728, 1),
    'toto_face':  ('sheet2', 1320, 620, 1450, 730, 1),
}

sheets = {}
labels = {}
for name in ('sheet1', 'sheet2'):
    a = np.array(Image.open(os.path.join(SRC, name + '.png')).convert('RGBA'))
    a[a[:, :, 3] < 24] = 0
    sheets[name] = a
    m = ndimage.binary_dilation(a[:, :, 3] > 0, iterations=2)
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    lab[a[:, :, 3] == 0] = 0
    labels[name] = (lab, np.bincount(lab.ravel(), minlength=n + 1))

crops = {}
for key, (sh, x0, y0, x1, y1, face) in S.items():
    a = sheets[sh][y0:y1, x0:x1].copy()
    lab, total = labels[sh]
    sub = lab[y0:y1, x0:x1]
    inside = np.bincount(sub.ravel(), minlength=len(total))
    opaque = inside[1:].sum()
    keep = np.zeros(len(total), bool)
    for l in np.nonzero(inside)[0]:
        if l == 0:
            continue
        if inside[l] >= 0.55 * total[l] or inside[l] >= 0.25 * opaque:
            keep[l] = True
    a[~keep[sub]] = 0
    ys, xs = np.nonzero(a[:, :, 3])
    if len(xs) == 0:
        raise SystemExit('empty: ' + key)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    crops[key] = (Image.fromarray(a), face)

# 선반(shelf) 방식으로 아틀라스에 배치
W = 2048
order = sorted(crops, key=lambda k: -crops[k][0].height)
x = y = rowh = 0
pos = {}
for k in order:
    im = crops[k][0]
    if x + im.width + 2 > W:
        x, y, rowh = 0, y + rowh + 2, 0
    pos[k] = (x, y)
    x += im.width + 2
    rowh = max(rowh, im.height)
H = y + rowh
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
meta = {}
for k, (x, y) in pos.items():
    im, face = crops[k]
    atlas.paste(im, (x, y))
    meta[k] = [x, y, im.width, im.height, face]
atlas.save(OUT_IMG, optimize=True)
with open(OUT_JS, 'w', encoding='utf8') as f:
    f.write("'use strict';\n/* tools/neon_sprites.py 가 만든다. 이름: [x, y, 너비, 높이, 바라보는 방향] */\n")
    f.write('const ATLAS = ' + json.dumps(meta, separators=(',', ':')).replace('],"', '],\n"') + ';\n')
print(len(meta), 'sprites', W, 'x', H, '->', OUT_IMG, os.path.getsize(OUT_IMG) // 1024, 'KB')
