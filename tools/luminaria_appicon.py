"""루미나리아 앱 아이콘(PWA·홈 화면·파비콘)을 그린다.
가운데 금빛 나침반 별, 그 둘레의 고리 위에 여덟 히로인의 색. 2048px로 그린 뒤 줄여 매끄럽게 만든다.
    python3 tools/luminaria_appicon.py
"""
import math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'luminaria', 'icons')
N = 2048
COLORS = ['#9aa6e8', '#e0b878', '#d0505a', '#e8d6a8', '#b4a6e0', '#e46a48', '#8a7a90', '#b0703a']


def rgb(h, a=255):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def background(n):
    """짙은 자줏빛 밤하늘 (가운데가 조금 밝은 원형 그라데이션) + 작은 별"""
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    t = np.clip(np.hypot(x - n * .5, y - n * .44) / (n * .72), 0, 1)[..., None] ** 1.4
    c0, c1 = np.array((52, 34, 62), np.float32), np.array((12, 9, 18), np.float32)
    bg = Image.fromarray((c0 * (1 - t) + c1 * t + .5).astype(np.uint8))
    d = ImageDraw.Draw(bg, 'RGBA')
    rnd = random.Random(7)
    for _ in range(90):
        x, y, r = rnd.uniform(0, n), rnd.uniform(0, n), rnd.uniform(.6, 2.2) * n / 1024
        if math.hypot(x - n / 2, y - n / 2) < n * .3:
            continue
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 244, 214, rnd.randint(60, 170)))
    return bg


def emblem(n, scale=1.0):
    """투명 배경 위의 문장: 고리 + 여덟 색 + 나침반 별"""
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = cy = n / 2
    R = n * .40 * scale

    # 고리 (두 겹의 얇은 금선)
    for rr, w, a in ((R * .86, .0065, 210), (R * .80, .0028, 120)):
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=rgb('#d9b56c', a), width=max(1, round(n * w * scale)))
    # 고리의 눈금
    for k in range(32):
        a = k * math.pi / 16
        r0, r1 = R * .80, R * (.835 if k % 4 else .86)
        d.line((cx + r0 * math.cos(a), cy + r0 * math.sin(a), cx + r1 * math.cos(a), cy + r1 * math.sin(a)), fill=rgb('#d9b56c', 150), width=max(1, round(n * .003 * scale)))

    # 여덟 색 구슬 (별 꼭짓점 사이)
    glow = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for k, c in enumerate(COLORS):
        a = -math.pi / 2 + math.pi / 8 + k * math.pi / 4
        x, y = cx + R * .86 * math.cos(a), cy + R * .86 * math.sin(a)
        r = n * .022 * scale
        gd.ellipse((x - r * 2.2, y - r * 2.2, x + r * 2.2, y + r * 2.2), fill=rgb(c, 140))
        d.ellipse((x - r, y - r, x + r, y + r), fill=rgb(c), outline=rgb('#fff4dc', 230), width=max(1, round(n * .004 * scale)))
        hr = r * .38
        d.ellipse((x - r * .45 - hr, y - r * .45 - hr, x - r * .45 + hr, y - r * .45 + hr), fill=(255, 255, 255, 150))
    glow = glow.filter(ImageFilter.GaussianBlur(n * .012))

    # 나침반 별: 꼭짓점마다 밝은 면/어두운 면 두 삼각형
    star = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    sd = ImageDraw.Draw(star)
    inner = R * .13
    for k in range(8):
        a = -math.pi / 2 + k * math.pi / 4
        L = R * (.74 if k % 2 == 0 else .44)
        tip = (cx + L * math.cos(a), cy + L * math.sin(a))
        l = (cx + inner * math.cos(a - math.pi / 4), cy + inner * math.sin(a - math.pi / 4))
        r = (cx + inner * math.cos(a + math.pi / 4), cy + inner * math.sin(a + math.pi / 4))
        light, dark = ('#fff3cf', '#e2b45e') if k % 2 == 0 else ('#f6dfa6', '#b88a3e')
        sd.polygon([(cx, cy), tip, l], fill=rgb(light))
        sd.polygon([(cx, cy), tip, r], fill=rgb(dark))
    sglow = star.copy()
    sglow.putalpha(sglow.getchannel('A').point(lambda v: v * .8))
    sglow = sglow.filter(ImageFilter.GaussianBlur(n * .03))
    # 가운데 무색의 빛
    cr = R * .07
    core = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    ImageDraw.Draw(core).ellipse((cx - cr * 3, cy - cr * 3, cx + cr * 3, cy + cr * 3), fill=(255, 255, 255, 120))
    core = core.filter(ImageFilter.GaussianBlur(n * .015))
    ImageDraw.Draw(core).ellipse((cx - cr, cy - cr, cx + cr, cy + cr), fill=(255, 255, 255, 255))

    out = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    for layer in (glow, im, sglow, star, core):
        out = Image.alpha_composite(out, layer)
    return out


def make(size, scale, rounded=False):
    bg = background(N).convert('RGBA')
    im = Image.alpha_composite(bg, emblem(N, scale))
    if rounded:  # 파비콘은 둥근 모서리
        m = Image.new('L', (N, N), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, N - 1, N - 1), radius=N * .22, fill=255)
        im.putalpha(m)
    return im.resize((size, size), Image.LANCZOS)


big = make(512, 1.0)
big.convert('RGB').save(f'{OUT}/icon-512.png', optimize=True)
make(192, 1.0).convert('RGB').save(f'{OUT}/icon-192.png', optimize=True)
make(180, 1.0).convert('RGB').save(f'{OUT}/apple-touch-icon.png', optimize=True)
make(512, .78).convert('RGB').save(f'{OUT}/maskable-512.png', optimize=True)  # 안전 영역(80%) 안에 들어가게
make(32, 1.12, rounded=True).save(f'{OUT}/favicon-32.png', optimize=True)
print('icons ->', OUT)
