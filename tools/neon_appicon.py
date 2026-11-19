"""네온 하트 앱 아이콘: 세라와 카이의 초상 위에 네온 하트 테두리를 그린다.
사용법: python3 tools/neon_appicon.py  (neon/img/sprites.png, neon/js/atlas.js 필요)"""
import os, json
from PIL import Image, ImageDraw, ImageFilter
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, 'neon/js/atlas.js'), encoding='utf8').read()
A = json.loads(src[src.index('{'):src.rindex('}') + 1])
sheet = Image.open(os.path.join(root, 'neon/img/sprites.png')).convert('RGBA')
def face(name, size):
    x, y, w, h, _ = A[name]; s = min(w, h)
    return sheet.crop((x + (w - s) // 2, y, x + (w - s) // 2 + s, y + s)).resize((size, size), Image.NEAREST)
def icon(N, pad=0):
    im = Image.new('RGBA', (N, N), (7, 4, 15, 255))
    d = ImageDraw.Draw(im)
    for i in range(N):  # 세로 그라데이션
        t = i / N; d.line([(0, i), (N, i)], fill=(int(20 + 60 * t), int(6 + 10 * t), int(40 + 50 * t), 255))
    inner = N - pad * 2
    k = face('kai_face', int(inner * 0.62)); s = face('sera_face', int(inner * 0.62))
    im.alpha_composite(k, (pad + int(inner * 0.02), pad + int(inner * 0.34)))
    im.alpha_composite(s, (pad + int(inner * 0.36), pad + int(inner * 0.2)))
    glow = Image.new('RGBA', (N, N), (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
    c = (255, 63, 164, 255); w = max(2, N // 40)
    cx, cy, r = N / 2, pad + inner * 0.2, inner * 0.13
    pts = [(cx, cy + r * 1.6), (cx - r * 1.5, cy), (cx - r * 0.75, cy - r * 0.9), (cx, cy - r * 0.2), (cx + r * 0.75, cy - r * 0.9), (cx + r * 1.5, cy), (cx, cy + r * 1.6)]
    g.line(pts, fill=c, width=w * 2, joint='curve')
    g.rectangle([pad + w, pad + w, N - pad - w, N - pad - w], outline=(62, 232, 255, 255), width=w)
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(w * 1.5)))
    im.alpha_composite(glow)
    return im
out = os.path.join(root, 'neon/icons'); os.makedirs(out, exist_ok=True)
icon(512).convert('RGB').save(os.path.join(out, 'icon-512.png'))
icon(192).convert('RGB').save(os.path.join(out, 'icon-192.png'))
icon(180).convert('RGB').save(os.path.join(out, 'apple-touch-icon.png'))
icon(32).convert('RGB').save(os.path.join(out, 'favicon-32.png'))
icon(512, 60).convert('RGB').save(os.path.join(out, 'maskable-512.png'))
print('icons ->', out)
