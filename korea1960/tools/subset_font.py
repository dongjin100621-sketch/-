"""게임에 쓰인 글자만 담은 Chronicle KR(Noto Sans KR 서브셋) WOFF2를 만든다. 개발용 도구.

필요: fontTools, brotli (pip install fonttools brotli) — 게임 실행·빌드에는 필요 없다.
원본: @expo-google-fonts/noto-sans-kr 0.4.4의 NotoSansKR_400Regular.ttf, NotoSansKR_700Bold.ttf (SIL OFL 1.1)
  npm pack @expo-google-fonts/noto-sans-kr@0.4.4  →  압축을 풀어 아래 경로를 넘긴다.

python3 tools/subset_font.py <NotoSansKR_400Regular.ttf> <NotoSansKR_700Bold.ttf>
결과: assets/fonts/ChronicleKR-Regular.woff2, assets/fonts/ChronicleKR-Bold.woff2
원래의 ChronicleKR-Regular.ttf(제작 패키지 v1, example/ 참조 구현용)는 지우지 않는다.
콘텐츠나 화면 문구를 바꾼 뒤 새 글자가 시스템 글꼴로 보이면 이 도구를 다시 실행한다.
"""
from pathlib import Path
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
sources = [root / 'data/game.json'] + sorted((root / 'game').glob('*.mjs')) + sorted((root / 'game').glob('*.html')) + sorted((root / 'game').glob('*.css'))
text = ''.join(p.read_text(encoding='utf-8') for p in sources)
extra = ''.join(chr(c) for c in range(0x20, 0x7f)) + '·→←↑↓▲▼–—…✓■▨□±−×≥≤〈〉「」『』‘’“”%‰°'
chars = sorted({c for c in text + extra if c.isprintable() or c == ' '})

def build(src, weight, out):
    opts = subset.Options()
    opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.name_languages = ['*']; opts.notdef_outline = True; opts.hinting = False
    font = TTFont(src)
    sub = subset.Subsetter(opts); sub.populate(text=''.join(chars)); sub.subset(font)
    style = 'Bold' if weight == 700 else 'Regular'
    for rec in font['name'].names:
        if rec.nameID in (1, 16): rec.string = 'Chronicle KR'
        elif rec.nameID in (2, 17): rec.string = style
        elif rec.nameID == 4: rec.string = f'Chronicle KR {style}'
        elif rec.nameID == 6: rec.string = f'ChronicleKR-{style}'
    font.flavor = 'woff2'; font.save(out)
    return Path(out).stat().st_size

if __name__ == '__main__':
    if len(sys.argv) != 3: sys.exit(__doc__)
    covered = []
    for src, weight in ((sys.argv[1], 400), (sys.argv[2], 700)):
        out = root / f'assets/fonts/ChronicleKR-{"Bold" if weight == 700 else "Regular"}.woff2'
        size = build(src, weight, out)
        cmap = TTFont(out).getBestCmap(); covered = [c for c in chars if ord(c) in cmap]
        print(f'{out.relative_to(root)}: {size:,} bytes')
    missing = [c for c in chars if c not in covered and not c.isspace()]
    print(f'{len(chars)} characters requested, {len(missing)} not in the source font (system fallback): {"".join(missing)}')
