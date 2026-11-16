"""별을 삼킨 탑 앱 아이콘(PWA·홈 화면·파비콘)을 그린다.
밤하늘 아래 솟은 탑과, 꼭대기로 빨려 드는 별을 32×32 도트로 찍고 정수배로 키운다.
    python3 tools/tower_appicon.py
"""
import os, math
from PIL import Image

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(root, 'tower', 'icons')


def art(n=32):
    im = Image.new('RGB', (n, n))
    px = im.load()
    top, bot = (6, 3, 16), (46, 22, 70)
    for y in range(n):
        k = y / (n - 1)
        for x in range(n):
            px[x, y] = tuple(round(top[i] + (bot[i] - top[i]) * k) for i in range(3))
    # 별가루
    for (x, y, c) in [(4, 5, (200, 184, 255)), (27, 8, (255, 255, 255)), (7, 14, (122, 106, 168)), (24, 17, (200, 184, 255)), (3, 22, (122, 106, 168)), (29, 24, (200, 184, 255)), (12, 3, (122, 106, 168))]:
        px[x, y] = c
    # 꼭대기 빛 무리(계단식)
    cx, cy = 16, 6
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - cx, (y - cy) * 1.2)
            k = 0.55 if d < 3 else 0.35 if d < 5 else 0.18 if d < 8 else 0.08 if d < 11 else 0
            if k:
                r, g, b = px[x, y]
                px[x, y] = (round(r + (190 - r) * k), round(g + (120 - g) * k), round(b + (255 - b) * k))
    # 먼 산
    for x in range(n):
        h = 26 + round(2 * math.sin(x * 0.45) + math.sin(x * 1.3))
        for y in range(h, n):
            px[x, y] = (20, 12, 34)
    # 탑(윤곽선 + 몸통 + 창문)
    body, edge, lit = (12, 8, 22), (58, 40, 92), (255, 190, 110)
    for y in range(9, n):
        w = 2 + (y - 9) * 6 // (n - 9)
        for x in range(cx - w - 1, cx + w + 1):
            px[x, y] = edge if x in (cx - w - 1, cx + w) else body
    for y in range(6, 9):
        px[cx - 1, y] = px[cx, y] = edge
    for (x, y) in [(15, 13), (17, 17), (15, 21), (17, 25)]:
        px[x, y] = lit
    # 별(가운데 흰빛, 네 갈래)
    for (x, y, c) in [(16, 3, (255, 255, 255)), (15, 3, (255, 236, 150)), (17, 3, (255, 236, 150)), (16, 2, (255, 236, 150)), (16, 4, (255, 236, 150)),
                      (14, 3, (200, 140, 255)), (18, 3, (200, 140, 255)), (16, 1, (200, 140, 255)), (16, 5, (200, 140, 255))]:
        px[x, y] = c
    return im


os.makedirs(OUT, exist_ok=True)
a = art()
a.save(os.path.join(OUT, 'favicon-32.png'))
a.resize((512, 512), Image.NEAREST).save(os.path.join(OUT, 'icon-512.png'))
a.resize((192, 192), Image.NEAREST).save(os.path.join(OUT, 'icon-192.png'))
a.resize((192, 192), Image.NEAREST).resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, 'apple-touch-icon.png'))
m = Image.new('RGB', (40, 40), (6, 3, 16))
m.paste(a, (4, 4))
m.resize((520, 520), Image.NEAREST).crop((4, 4, 516, 516)).save(os.path.join(OUT, 'maskable-512.png'))
print('icons ->', OUT)
