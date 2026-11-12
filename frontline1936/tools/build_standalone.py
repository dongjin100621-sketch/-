"""분리 소스를 더블클릭으로 여는 단일 HTML 하나로 묶는다. 표준 라이브러리만 쓴다.

python3 tools/build_standalone.py                                  # → FRONTLINE1936.html
python3 tools/build_standalone.py --artifact --output <파일>       # Claude 아티팩트(웹 링크)용: 문서 골격을 빼고, 파일 내려받기 대신 저장 텍스트를 쓴다

모듈(core → economy → military → politics → ai → engine → app)을 각각 함수로 감싸 내보낸 이름의 객체로 만들고,
import 줄을 그 객체에서 꺼내는 줄로 바꾼다. 데이터(game.json)·지도(map.json)·글꼴을 내장해 외부 요청이 없다.
"""
from pathlib import Path
import base64, json, re, argparse
ROOT = Path(__file__).resolve().parents[1]
ORDER = ['core', 'weather', 'transport', 'economy', 'military', 'politics', 'ai', 'engine', 'app']

def uri(path, mime): return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode('ascii')

def convert(name):
    src = (ROOT / f'game/{name}.mjs').read_text(encoding='utf-8')
    def imp(m):
        what, mod = m.group(1).strip(), m.group(2)
        ns = f'__m_{mod}'
        if what.startswith('* as '): return f'const {what[5:].strip()} = {ns};'
        names = [x.strip() for x in what.strip('{} ').split(',') if x.strip()]
        return 'const { ' + ', '.join(n.replace(' as ', ': ') for n in names) + f' }} = {ns};'
    src = re.sub(r"^import\s+(.+?)\s+from\s+'\./(\w+)\.mjs';\s*$", imp, src, flags=re.M)
    exported = re.findall(r'^export\s+(?:async\s+)?(?:const|function|let|class)\s+(\w+)', src, flags=re.M)
    for m in re.finditer(r'^export\s*\{([^}]*)\};?\s*$', src, flags=re.M): exported += [x.strip() for x in m.group(1).split(',') if x.strip()]
    src = re.sub(r'^export\s*\{[^}]*\};?\s*$', '', src, flags=re.M)
    src = re.sub(r'^export\s+(?=(?:async\s+)?(?:const|function|let|class))', '', src, flags=re.M)
    if re.search(r'^\s*(import|export)\s', src, flags=re.M): raise SystemExit(f'{name}.mjs에 처리하지 못한 import/export가 있습니다.')
    if name == 'app': return src
    return f'const __m_{name} = await (async () => {{\n{src}\nreturn {{ {", ".join(exported)} }};\n}})();\n'

def build(artifact=False):
    d = (ROOT / 'data/game.json').read_text(encoding='utf-8')
    m = (ROOT / 'data/map.json').read_text(encoding='utf-8')
    script = 'globalThis.__DATA__=' + json.dumps(json.loads(d), ensure_ascii=False, separators=(',', ':')) + ';\nglobalThis.__MAP__=' + m.strip() + ';\n' + ''.join(convert(n) for n in ORDER)
    script = script.replace('</script', '<\\/script')
    css = (ROOT / 'game/style.css').read_text(encoding='utf-8')
    for w in ('Regular', 'Bold'):
        f = ROOT / f'assets/fonts/FrontlineKR-{w}.woff2'
        css = css.replace(f'../assets/fonts/ChronicleKR-{w}.woff2', uri(f, 'font/woff2') if f.exists() else '')
    f = ROOT / 'assets/fonts/FrontlineSerif-Bold.woff2'
    css = css.replace('../assets/fonts/FrontlineSerif-Bold.woff2', uri(f, 'font/woff2') if f.exists() else '')
    title = '전선과 공장 1936'
    if artifact:
        return (f'<title>{title}</title><meta name="theme-color" content="#121518"><style>{css}</style>'
                '<div id="app"><p class="boot">지도를 준비하고 있습니다…</p></div><div id="live" class="sr-only" aria-live="polite"></div>'
                '<script>document.documentElement.lang="ko";globalThis.__EMBED__="artifact";</script>'
                f'<script type="module">{script}</script>\n')
    return ('<!doctype html>\n<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<meta name="theme-color" content="#121518"><meta name="description" content="1936~1945년 동아시아·태평양을 배경으로 한 하루 단위 대전략 게임. 수치와 선택 결과는 창작이다.">'
            f'<title>{title}</title><style>{css}</style></head><body><div id="app"><p class="boot">지도를 준비하고 있습니다…</p></div>'
            '<div id="live" class="sr-only" aria-live="polite"></div><noscript><p class="boot">JavaScript를 켜면 게임을 실행할 수 있습니다.</p></noscript>'
            f'<script type="module">{script}</script></body></html>\n')

if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--output'); p.add_argument('--artifact', action='store_true'); a = p.parse_args()
    dest = Path(a.output) if a.output else ROOT / 'FRONTLINE1936.html'
    dest.parent.mkdir(parents=True, exist_ok=True); dest.write_text(build(a.artifact), encoding='utf-8')
    print(f'Built: {dest} ({dest.stat().st_size:,} bytes)')
