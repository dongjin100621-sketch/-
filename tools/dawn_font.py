"""여명의 종에 쓰는 한글 도트 글꼴(갈무리11, SIL OFL 1.1)을 게임에 나오는 글자만 남겨 줄인다.
게임 글(dawn/ 의 html·js)을 고친 뒤 다시 실행하세요.

    npm pack galmuri && tar xzf galmuri-*.tgz      # package/dist 에 원본 글꼴이 생김
    python3 tools/dawn_font.py package/dist

필요: pip install fonttools brotli
"""
import os, re, shutil, sys
from fontTools import subset

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app = os.path.join(root, 'dawn')
if len(sys.argv) < 2:
    sys.exit(__doc__)
dist = sys.argv[1]

chars = set(chr(c) for c in range(0x20, 0x7f))
chars |= set('·…「」『』—–→←↑↓▲▼◀▶●○■□★☆♪♥%×÷±、。！？：；')
for base, _, files in os.walk(app):
    for f in files:
        if f.endswith(('.html', '.js', '.css', '.webmanifest')):
            chars |= set(open(os.path.join(base, f), encoding='utf8').read())
chars = {c for c in chars if c.isprintable() and not re.match(r'\s', c) or c == ' '}
text = ''.join(sorted(chars))
print(len(text), 'glyphs')

out = os.path.join(app, 'fonts')
os.makedirs(out, exist_ok=True)
for src, dst in (('Galmuri11.ttf', 'galmuri11.woff2'), ('Galmuri11-Bold.ttf', 'galmuri11-bold.woff2')):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = subset.load_font(os.path.join(dist, src), opts)
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    subset.save_font(font, os.path.join(out, dst), opts)
    print(dst, os.path.getsize(os.path.join(out, dst)) // 1024, 'KB')
lic = os.path.join(dist, 'LICENSE.txt')
if os.path.isfile(lic):
    shutil.copy(lic, os.path.join(out, 'OFL.txt'))
