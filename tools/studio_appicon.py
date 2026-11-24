"""소리 공방 앱 아이콘(PWA·홈 화면·파비콘)을 그린다.
어두운 남색 바탕 위에 피아노 롤처럼 놓인 호박색 음표 막대 다섯 개와 건반 줄. 2048px로 그린 뒤 줄여 매끄럽게 만든다.
    python3 tools/studio_appicon.py
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'studio', 'icons')
N = 2048
TOP, BOT = (38, 43, 56), (17, 19, 25)
AMBER, AMBER2 = (242, 177, 85), (255, 214, 140)
BLUE, GREEN, PINK = (95, 179, 240), (123, 211, 137), (239, 111, 140)


def art(n, pad):
    """pad: 가장자리 여백 비율(마스커블은 크게)"""
    col = Image.new('RGB', (1, n))
    for y in range(n):
        t = y / (n - 1)
        col.putpixel((0, y), tuple(round(TOP[i] * (1 - t) + BOT[i] * t) for i in range(3)))
    im = col.resize((n, n))
    d = ImageDraw.Draw(im, 'RGBA')
    x0, x1 = n * pad, n * (1 - pad)
    y0, y1 = n * (pad + .04), n * (1 - pad - .04)
    rows = 7
    rh = (y1 - y0) / rows
    # 줄무늬(피아노 롤 바탕)
    for r in range(rows):
        if r % 2:
            d.rectangle((x0, y0 + r * rh, x1, y0 + (r + 1) * rh), fill=(255, 255, 255, 10))
    # 박 선
    for k in range(1, 4):
        x = x0 + (x1 - x0) * k / 4
        d.rectangle((x - n * .002, y0, x + n * .002, y1), fill=(255, 255, 255, 22))
    # 음표 막대: (시작, 길이, 줄, 색)
    notes = [(0.00, 0.30, 4, BLUE), (0.25, 0.22, 2, AMBER), (0.45, 0.20, 3, GREEN), (0.62, 0.38, 1, AMBER2), (0.08, 0.50, 6, PINK)]
    rad = rh * .28
    for s, L, r, c in notes:
        a = x0 + (x1 - x0) * s
        b = x0 + (x1 - x0) * (s + L)
        d.rounded_rectangle((a + n * .006, y0 + r * rh + rh * .14, b - n * .006, y0 + (r + 1) * rh - rh * .14), radius=rad, fill=c + (255,))
    # 재생 선
    px = x0 + (x1 - x0) * .56
    d.rectangle((px - n * .006, y0 - n * .02, px + n * .006, y1 + n * .02), fill=(255, 255, 255, 230))
    d.polygon([(px - n * .03, y0 - n * .045), (px + n * .03, y0 - n * .045), (px, y0 - n * .005)], fill=(255, 255, 255, 230))
    return im.convert('RGBA')


def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), radius=r, fill=255)
    im.putalpha(m)
    return im


os.makedirs(OUT, exist_ok=True)
base = art(N, .14)
full = art(N, .20)
rounded(base.copy(), int(N * .22)).resize((512, 512), Image.LANCZOS).save(f'{OUT}/icon-512.png')
rounded(base.copy(), int(N * .22)).resize((192, 192), Image.LANCZOS).save(f'{OUT}/icon-192.png')
full.convert('RGB').resize((512, 512), Image.LANCZOS).save(f'{OUT}/maskable-512.png')
base.convert('RGB').resize((180, 180), Image.LANCZOS).save(f'{OUT}/apple-touch-icon.png')
small = art(N, .06)
rounded(small, int(N * .2)).resize((32, 32), Image.LANCZOS).save(f'{OUT}/favicon-32.png')
print('icons ->', os.path.normpath(OUT))
