"""한자 서당 앱 아이콘(PWA·홈 화면·파비콘)을 그린다.
한지 빛 바탕 위에 살짝 기울어진 붉은 낙관(인장)과 흰 「書」. 2048px로 그린 뒤 줄여 매끄럽게 만든다.
    python3 tools/hanja_appicon.py [Noto Serif KR 글꼴 파일]
글꼴을 주지 않으면 Google Fonts 에서 「書」 한 글자만 담은 Noto Serif KR(OFL) 을 받아 쓴다.
"""
import math, os, random, sys, tempfile, urllib.request
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'hanja', 'icons')
N = 2048
PAPER0, PAPER1 = (250, 245, 234), (236, 226, 207)
SEAL = (179, 54, 44)
SEAL_INK = (255, 248, 241)
GLYPH = '書'


def font_file():
    if len(sys.argv) > 1:
        return sys.argv[1]
    css_url = 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700&text=' + urllib.parse.quote(GLYPH)
    req = urllib.request.Request(css_url, headers={'User-Agent': 'Mozilla/4.0'})  # 옛 브라우저로 물으면 TTF 주소를 준다
    css = urllib.request.urlopen(req).read().decode()
    url = css.split('url(')[1].split(')')[0]
    path = os.path.join(tempfile.gettempdir(), 'hanja_icon_font.ttf')
    urllib.request.urlretrieve(url, path)
    return path


def paper(n):
    """한지 바탕: 위가 조금 밝은 그라데이션 + 닥 섬유 같은 옅은 결"""
    col = Image.new('RGB', (1, n))
    for y in range(n):
        t = (y / n) ** 1.2
        col.putpixel((0, y), tuple(round(PAPER0[i] * (1 - t) + PAPER1[i] * t) for i in range(3)))
    im = col.resize((n, n))
    d = ImageDraw.Draw(im, 'RGBA')
    rnd = random.Random(3)
    for _ in range(260):
        x, y = rnd.uniform(0, n), rnd.uniform(0, n)
        a = rnd.uniform(0, math.pi)
        L = rnd.uniform(.01, .05) * n
        d.line((x, y, x + L * math.cos(a), y + L * math.sin(a)), fill=(150, 120, 80, rnd.randint(10, 26)), width=max(1, n // 900))
    return im


def seal(n, size, font_path, rot=-5.0, border=True):
    """투명 바탕 위의 낙관 한 개"""
    S = int(size)
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = S * .14
    d.rounded_rectangle((0, 0, S - 1, S - 1), radius=r, fill=SEAL + (255,))
    if border:
        w = max(2, round(S * .028))
        m = S * .07
        d.rounded_rectangle((m, m, S - 1 - m, S - 1 - m), radius=r * .62, outline=SEAL_INK + (235,), width=w)
    f = ImageFont.truetype(font_path, int(S * (.66 if border else .8)))
    bb = d.textbbox((0, 0), GLYPH, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((S - tw) / 2 - bb[0], (S - th) / 2 - bb[1]), GLYPH, font=f, fill=SEAL_INK + (255,))
    # 인주가 고르게 묻지 않은 듯한 얼룩
    rnd = random.Random(11)
    mask = im.split()[3]
    spots = Image.new('L', (S, S), 0)
    sd = ImageDraw.Draw(spots)
    for _ in range(int(S * .18)):
        x, y = rnd.uniform(0, S), rnd.uniform(0, S)
        rr = rnd.uniform(.002, .009) * S
        sd.ellipse((x - rr, y - rr, x + rr, y + rr), fill=rnd.randint(40, 120))
    spots = spots.filter(ImageFilter.GaussianBlur(S * .002))
    im.putalpha(Image.composite(Image.new('L', (S, S), 0), mask, spots.point(lambda v: 255 if v > 60 else 0)))
    return im.rotate(rot, resample=Image.BICUBIC, expand=True)


def icon(n, seal_frac, font_path, bg=True):
    base = paper(n).convert('RGBA') if bg else Image.new('RGBA', (n, n), (0, 0, 0, 0))
    s = seal(n, n * seal_frac, font_path)
    # 살짝 번진 그림자
    sh = Image.new('RGBA', s.size, (0, 0, 0, 0))
    sh.putalpha(s.split()[3].point(lambda v: int(v * .22)))
    sh = sh.filter(ImageFilter.GaussianBlur(n * .012))
    x, y = (n - s.width) // 2, (n - s.height) // 2
    base.alpha_composite(sh, (x, y + int(n * .012)))
    base.alpha_composite(s, (x, y))
    return base


def main():
    os.makedirs(OUT, exist_ok=True)
    fp = font_file()
    big = icon(N, .62, fp)
    for name, size in (('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)):
        big.resize((size, size), Image.LANCZOS).convert('RGB').save(os.path.join(OUT, name), optimize=True)
    # 마스커블: 안전 영역(가운데 80%) 안에 들어가게 낙관을 줄인다
    icon(N, .48, fp).resize((512, 512), Image.LANCZOS).convert('RGB').save(os.path.join(OUT, 'maskable-512.png'), optimize=True)
    # 파비콘: 작아도 또렷하게 바탕 없이 낙관만, 테두리 없이
    fav = seal(256, 236, fp, rot=0, border=False)
    canvas = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    canvas.alpha_composite(fav, ((256 - fav.width) // 2, (256 - fav.height) // 2))
    canvas.resize((32, 32), Image.LANCZOS).save(os.path.join(OUT, 'favicon-32.png'), optimize=True)
    print('→', os.path.relpath(OUT))


if __name__ == '__main__':
    import urllib.parse
    main()
