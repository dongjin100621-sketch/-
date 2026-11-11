"""분리 소스를 더블클릭으로 여는 단일 HTML 하나로 묶는다. 표준 라이브러리만 사용한다.

python3 tools/build_standalone.py               # game/ → KOREA1960.html (현재 게임)
python3 tools/build_standalone.py --pages       # 위와 같고, 저장소의 docs/korea1960/index.html(GitHub Pages)에도 복사
python3 tools/build_standalone.py --reference   # example/ → PLAYABLE_SAMPLE.html (제작 패키지 v1 참조 구현)
python3 tools/build_standalone.py --artifact --output <파일>
    # Claude 아티팩트(웹 링크)용 판: 문서 골격(doctype·html·head·body)을 빼고 <title>·<style>을 맨 앞에 둔다
    # (게시할 때 골격이 씌워진다). 그 보기 화면은 파일 다운로드를 막으므로 내보내기가 '저장 텍스트 복사'로 바뀐다.

시장 모형(economy.mjs)과 엔진(engine.mjs)의 export를 지워 네임스페이스 객체 EC·E로 감싸고, 앱의 import 줄을 지운 뒤 인라인 module로 넣는다.
콘텐츠(game.json)·권역 지도(assets/map/korea_map.json)·삽화 WebP 4장·SVG 아이콘·글꼴은 내장한다. 외부 요청이 없다.
HTML을 직접 고치면 분리 소스에 반영되지 않는다. game/·data/game.json을 고친 뒤 다시 빌드한다.
"""
from pathlib import Path
import base64, json, re, argparse, shutil
ROOT = Path(__file__).resolve().parents[1]

def uri(path, mime): return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode('ascii')

def common(d):
    assets = {x: uri(ROOT / f'assets/art/{x}.webp', 'image/webp') for x in ['cover', 'cabinet', 'industry', 'civic']}
    icons = {p.stem: uri(p, 'image/svg+xml') for p in sorted((ROOT / 'assets/ui').glob('*.svg'))}
    mapdata = (ROOT / 'assets/map/korea_map.json').read_text(encoding='utf-8').strip()
    return 'globalThis.__DATA__=' + json.dumps(d, ensure_ascii=False) + ';\nglobalThis.__MAP__=' + mapdata + ';\nglobalThis.__ASSETS__=' + json.dumps(assets) + ';\nglobalThis.__ICONS__=' + json.dumps(icons) + ';\n'

def page(css, script, title='대한민국 1960 · 선택의 연대기', artifact=False):
    script = script.replace('</script', '<\\/script')
    if artifact:
        return (f'<title>{title}</title><meta name="theme-color" content="#1a1b1d"><style>{css}</style>'
                '<div id="app"><p class="boot" style="padding:30px">기록을 준비하고 있습니다…</p></div>'
                '<div id="live" class="sr-only" aria-live="polite"></div><noscript><p style="padding:30px">JavaScript를 켜면 게임을 실행할 수 있습니다.</p></noscript>'
                '<script>document.documentElement.lang="ko";globalThis.__EMBED__="artifact";</script>'
                f'<script type="module">{script}</script>\n')
    return ('<!doctype html>\n<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<meta name="theme-color" content="#1a1b1d"><meta name="description" content="1960~1979년 대한민국을 배경으로 한 월 단위 역사 정치·경제 시뮬레이션. 모든 수치와 선택 결과는 가상이다.">'
            f'<title>{title}</title><style>{css}</style></head><body><div id="app"><p class="boot" style="padding:30px">기록을 준비하고 있습니다…</p></div>'
            '<div id="live" class="sr-only" aria-live="polite"></div><noscript><p style="padding:30px">JavaScript를 켜면 게임을 실행할 수 있습니다.</p></noscript>'
            f'<script type="module">{script}</script></body></html>\n')

def build_game(artifact=False):
    d = json.loads((ROOT / 'data/game.json').read_text(encoding='utf-8'))
    def module(name):
        src = (ROOT / f'game/{name}').read_text(encoding='utf-8')
        exported = re.findall(r'^export\s+(?:const|function|let)\s+(\w+)', src, flags=re.M)
        return re.sub(r'^export\s+(?=const|function|let|class)', '', src, flags=re.M), exported
    econ, econ_names = module('economy.mjs')
    engine, names = module('engine.mjs')
    engine, n = re.subn(r"^import \* as EC from '\./economy\.mjs';\n", '', engine, flags=re.M)
    if n != 1: raise SystemExit('engine.mjs의 economy import 줄을 찾지 못했습니다.')
    for name, src in (('economy.mjs', econ), ('engine.mjs', engine)):
        if re.search(r'^\s*(import|export)\s', src, flags=re.M): raise SystemExit(f'{name}에 처리하지 못한 import/export가 있습니다.')
    app = (ROOT / 'game/app.mjs').read_text(encoding='utf-8')
    app, n = re.subn(r"^import \* as E from '\./engine\.mjs';\n", '', app, flags=re.M)
    if n != 1: raise SystemExit('app.mjs의 엔진 import 줄을 찾지 못했습니다.')
    if re.search(r'^\s*(import|export)\s', app, flags=re.M): raise SystemExit('app.mjs에 처리하지 못한 import/export가 있습니다.')
    script = common(d) + 'const EC=(()=>{\n' + econ + '\nreturn {' + ','.join(econ_names) + '};\n})();\nconst E=(()=>{\n' + engine + '\nreturn {' + ','.join(names) + '};\n})();\n' + app
    css = (ROOT / 'game/style.css').read_text(encoding='utf-8')
    for weight in ('Regular', 'Bold'):
        css = css.replace(f'../assets/fonts/ChronicleKR-{weight}.woff2', uri(ROOT / f'assets/fonts/ChronicleKR-{weight}.woff2', 'font/woff2'))
    if '../assets/' in css: raise SystemExit('style.css에 내장하지 못한 자원 경로가 있습니다.')
    return page(css, script, artifact=artifact)

def build_reference():
    d = json.loads((ROOT / 'example/game.json').read_text(encoding='utf-8'))  # 참조 구현은 데이터 1.3.0 사본으로 고정
    engine = re.sub(r'\bexport\s+(?=const|function|class)', '', (ROOT / 'example/engine.mjs').read_text(encoding='utf-8'))
    app = re.sub(r'^import[^\n]+\n', '', (ROOT / 'example/app.mjs').read_text(encoding='utf-8'), flags=re.M)
    css = (ROOT / 'example/style.css').read_text(encoding='utf-8').replace('../assets/fonts/ChronicleKR-Regular.ttf', uri(ROOT / 'assets/fonts/ChronicleKR-Regular.ttf', 'font/ttf'))
    return page(css, common(d) + engine + '\n' + app)

if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--output'); p.add_argument('--reference', action='store_true'); p.add_argument('--pages', action='store_true'); p.add_argument('--artifact', action='store_true'); a = p.parse_args()
    if a.artifact and (a.reference or a.pages or not a.output): raise SystemExit('--artifact는 --output과 함께, --reference·--pages 없이 씁니다.')
    html = build_reference() if a.reference else build_game(artifact=a.artifact)
    dest = Path(a.output) if a.output else ROOT / ('PLAYABLE_SAMPLE.html' if a.reference else 'KOREA1960.html')
    dest.parent.mkdir(parents=True, exist_ok=True); dest.write_text(html, encoding='utf-8')
    print(f'Built: {dest.name} ({dest.stat().st_size:,} bytes)')
    if a.pages and not a.reference:
        pages = ROOT.parent / 'docs/korea1960/index.html'
        pages.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(dest, pages)
        print(f'Copied: {pages.relative_to(ROOT.parent)}')
