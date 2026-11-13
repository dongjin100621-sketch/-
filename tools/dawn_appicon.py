"""여명의 종 앱 아이콘(PWA·홈 화면·파비콘)을 그린다.
게임의 도트 자료(dawn/js/sprites.js)에서 종 그림을 읽어, 해 뜨는 하늘 위에 얹은 32×32 도트 아이콘을 만들고 정수배로 키운다.
    python3 tools/dawn_appicon.py
"""
import os, re
from PIL import Image

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, 'dawn', 'js', 'sprites.js'), encoding='utf8').read()
OUT = os.path.join(root, 'dawn', 'icons')
pal = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in re.findall(r"'(\w)': '(#[0-9a-f]{6})'", src.split('const SPR')[0])}


def sprite(name):
    m = re.search(r'\n  ' + name + r': \[\s*((?:"[^"]*",?\s*)+)\]', src)
    return re.findall(r'"([^"]*)"', m.group(1))


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def art(n=32):
    """32×32: 위는 보랏빛 황혼, 아래로 갈수록 주황빛 새벽. 지평선의 해와 종"""
    im = Image.new('RGB', (n, n))
    px = im.load()
    stops = [(0, (29, 20, 56)), (0.45, (110, 50, 100)), (0.75, (240, 130, 80)), (1, (255, 214, 140))]
    for y in range(n):
        t = y / (n - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                col = lerp(c0, c1, (t - t0) / (t1 - t0))
        for x in range(n):
            px[x, y] = col
    # 계단식 햇무리 (아래 가운데)
    cx, cy = (n - 1) / 2, n - 4
    for y in range(n):
        for x in range(n):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            k = 0.7 if d < 5 else 0.45 if d < 8 else 0.25 if d < 11 else 0.1 if d < 14 else 0
            if k:
                r, g, b = px[x, y]
                px[x, y] = (round(r + (255 - r) * k), round(g + (236 - g) * k), round(b + (170 - b) * k))
    # 땅
    for y in range(n - 3, n):
        for x in range(n):
            px[x, y] = (36, 24, 46) if y > n - 3 else (60, 40, 70)
    bell = sprite('bell')
    ox, oy = (n - 16) // 2, 6
    for y, row in enumerate(bell):
        for x, ch in enumerate(row):
            if ch != '.':
                px[ox + x, oy + y] = pal[ch]
    # 별 두 개
    for (x, y) in ((5, 4), (26, 7)):
        px[x, y] = (255, 244, 176)
    return im


os.makedirs(OUT, exist_ok=True)
a = art()
a.save(os.path.join(OUT, 'favicon-32.png'))
a.resize((512, 512), Image.NEAREST).save(os.path.join(OUT, 'icon-512.png'))
a.resize((192, 192), Image.NEAREST).save(os.path.join(OUT, 'icon-192.png'))
a.resize((192, 192), Image.NEAREST).resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, 'apple-touch-icon.png'))
m = Image.new('RGB', (40, 40), (29, 20, 56))
m.paste(a, (4, 4))
m.resize((520, 520), Image.NEAREST).crop((4, 4, 516, 516)).save(os.path.join(OUT, 'maskable-512.png'))
print('icons ->', OUT)
