"""전체 소스와 단일 HTML을 하나의 ZIP으로 묶는다. 표준 라이브러리만 사용한다.

python3 tools/package_zip.py      # → FILE_MANIFEST.json 갱신 후 dist/KOREA1960_v<버전>.zip
먼저 python3 tools/build_standalone.py로 KOREA1960.html을 최신으로 만든다(이 도구가 빌드하지는 않는다).
테스트 산출물(tests/browser/out), dist/, 캐시 폴더는 넣지 않는다.
"""
from pathlib import Path
import json, zipfile, hashlib
ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {'dist', 'node_modules', '__pycache__', '.git'}
SKIP_PARTS = [('tests', 'browser', 'out')]

def included(p: Path) -> bool:
    rel = p.relative_to(ROOT).parts
    if any(part in SKIP_DIRS for part in rel) or p.name in ('.DS_Store',):
        return False
    return not any(rel[:len(x)] == x for x in SKIP_PARTS)

if __name__ == '__main__':
    version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    html = ROOT / 'KOREA1960.html'
    if not html.is_file(): raise SystemExit('KOREA1960.html이 없습니다. 먼저 python3 tools/build_standalone.py를 실행하세요.')
    newest_src = max(p.stat().st_mtime for p in [*(ROOT / 'game').glob('*'), ROOT / 'data/game.json'] if p.is_file())
    if html.stat().st_mtime < newest_src: raise SystemExit('KOREA1960.html이 소스보다 오래되었습니다. 다시 빌드하세요.')
    out = ROOT / 'dist' / f'KOREA1960_v{version}.zip'; out.parent.mkdir(exist_ok=True)
    manifest = ROOT / 'FILE_MANIFEST.json'
    listed = sorted(p for p in ROOT.rglob('*') if p.is_file() and included(p) and p != manifest)
    manifest.write_text(json.dumps({'version': version, 'files': [{'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in listed]}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    files = sorted(p for p in ROOT.rglob('*') if p.is_file() and included(p))
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in files: z.write(p, Path('KOREA1960') / p.relative_to(ROOT))
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    print(f'{out.relative_to(ROOT)}: {len(files)} files, {out.stat().st_size:,} bytes, sha256 {digest[:16]}…')
