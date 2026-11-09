"""Build the same reference game as one offline HTML. Standard library only."""
from pathlib import Path
import base64, json, re, argparse
ROOT=Path(__file__).resolve().parents[1]

def uri(path,mime): return f'data:{mime};base64,'+base64.b64encode(path.read_bytes()).decode('ascii')
def build(destination=None):
    d=json.loads((ROOT/'data/game.json').read_text(encoding='utf-8'))
    assets={x:uri(ROOT/f'assets/art/{x}.webp','image/webp') for x in ['cover','cabinet','industry','civic']}
    icons={p.stem:uri(p,'image/svg+xml') for p in (ROOT/'assets/ui').glob('*.svg')}
    engine=(ROOT/'example/engine.mjs').read_text(encoding='utf-8')
    engine=re.sub(r'\bexport\s+(?=const|function|class)', '', engine)
    app=(ROOT/'example/app.mjs').read_text(encoding='utf-8')
    app=re.sub(r'^import[^\n]+\n','',app,flags=re.M)
    script='globalThis.__DATA__='+json.dumps(d,ensure_ascii=False)+';\nglobalThis.__ASSETS__='+json.dumps(assets)+';\nglobalThis.__ICONS__='+json.dumps(icons)+';\n'+engine+'\n'+app
    script=script.replace('</script','<\\/script')
    css=(ROOT/'example/style.css').read_text(encoding='utf-8')
    css=css.replace('../assets/fonts/ChronicleKR-Regular.ttf',uri(ROOT/'assets/fonts/ChronicleKR-Regular.ttf','font/ttf'))
    result='<!doctype html>\n<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b1e24"><title>대한민국 1960 · 선택의 연대기</title><style>'+css+'</style></head><body><div id="app"><p style="padding:30px">기록을 준비하고 있습니다…</p></div><noscript>JavaScript를 활성화해 주세요.</noscript><script type="module">'+script+'</script></body></html>\n'
    dest=Path(destination) if destination else ROOT/'PLAYABLE_SAMPLE.html'
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(result,encoding='utf-8')
    return dest
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output');a=p.parse_args();path=build(a.output);print(f'Built: {path.name} ({path.stat().st_size:,} bytes)')
