"""심연의 불씨 앱 아이콘(PWA·홈 화면·파비콘)을 그린다.
게임의 도트 자료(dungeon/js/sprites.js)에서 불씨 그림을 읽어 32×32 도트 아이콘을 만들고 정수배로 키운다.
    python3 tools/dungeon_appicon.py
"""
import os, re
from PIL import Image

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, 'dungeon', 'js', 'sprites.js'), encoding='utf8').read()
OUT = os.path.join(root, 'dungeon', 'icons')
pal = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in re.findall(r"'(\w)': '(#[0-9a-f]{6})'", src.split('const SPR')[0])}


def sprite(name):
    m = re.search(r'\n  ' + name + r': \[\s*((?:"[^"]*",?\s*)+)\]', src)
    return re.findall(r'"([^"]*)"', m.group(1))


def art(n=32):
    """32×32: 어두운 벽돌 위에 빛 무리와 첫 불씨"""
    im = Image.new('RGB', (n, n), (14, 11, 22))
    px = im.load()
    bricks = [(43, 34, 64), (52, 41, 76), (37, 29, 56)]
    mortar = (20, 15, 30)
    for y in range(n):
        for x in range(n):
            row = y // 4
            off = 4 if row % 2 else 0
            if y % 4 == 0 or (x + off) % 8 == 0:
                px[x, y] = mortar
            else:
                px[x, y] = bricks[((x + off) // 8 * 7 + row * 3) % 3]
    # 계단식 빛 무리
    c = (n - 1) / 2
    for y in range(n):
        for x in range(n):
            d = ((x - c) ** 2 + (y - c - 1) ** 2) ** 0.5
            k = 0.55 if d < 6 else 0.38 if d < 9 else 0.22 if d < 12 else 0.1 if d < 14 else 0
            if k:
                r, g, b = px[x, y]
                px[x, y] = (round(r + (255 - r) * k * 0.9), round(g + (170 - g) * k * 0.75), round(b + (80 - b) * k * 0.5))
    em = sprite('ember')
    ox, oy = (n - 16) // 2, (n - 16) // 2
    for y, row in enumerate(em):
        for x, ch in enumerate(row):
            if ch != '.':
                px[ox + x, oy + y] = pal[ch]
    return im


os.makedirs(OUT, exist_ok=True)
a = art()
a.save(os.path.join(OUT, 'favicon-32.png'))
a.resize((512, 512), Image.NEAREST).save(os.path.join(OUT, 'icon-512.png'))
a.resize((192, 192), Image.NEAREST).save(os.path.join(OUT, 'icon-192.png'))
a.resize((192, 192), Image.NEAREST).resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, 'apple-touch-icon.png'))
# 마스커블: 가운데 80% 안에 들도록 테두리를 덧댄다 (40칸 도화지 가운데에 32칸 그림)
m = Image.new('RGB', (40, 40), (14, 11, 22))
m.paste(a, (4, 4))
m.resize((520, 520), Image.NEAREST).crop((4, 4, 516, 516)).save(os.path.join(OUT, 'maskable-512.png'))
print('icons ->', OUT)
