"""<앱>/sw.js 의 파일 목록과 버전을 갱신하고 docs/<앱>/ (GitHub Pages 배포용)로 복사한다.
사용법: python3 tools/build_pwa.py [luminaria|hanja|dungeon|dawn]   (앱 파일을 고친 뒤 실행, 기본값 luminaria)"""
import os, re, shutil, hashlib, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app = sys.argv[1] if len(sys.argv) > 1 else 'luminaria'
src = os.path.join(root, app)
dst = os.path.join(root, 'docs', app)
if not os.path.isfile(os.path.join(src, 'sw.js')):
    sys.exit(f'{app}/sw.js 가 없습니다')

files = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css']
files += sorted('js/' + f for f in os.listdir(f'{src}/js') if f.endswith('.js'))
files += sorted('icons/' + f for f in os.listdir(f'{src}/icons') if f.endswith('.png'))
if os.path.isdir(f'{src}/fonts'):
    files += sorted('fonts/' + f for f in os.listdir(f'{src}/fonts') if f.endswith('.woff2'))
# 설정 자료(sheet)는 용량이 커서 처음 열 때 받지 않고, 볼 때 보관한다.
if os.path.isdir(f'{src}/img'):
    files += sorted('img/' + f for f in os.listdir(f'{src}/img') if '_sheet' not in f and f.endswith(('.jpg', '.png', '.webp')))

h = hashlib.sha1()
for f in files:
    p = os.path.join(src, f)
    if os.path.isfile(p):
        h.update(open(p, 'rb').read())
version = app + '-' + h.hexdigest()[:8]

sw = open(f'{src}/sw.js', encoding='utf8').read()
sw = re.sub(r"const VERSION = '.*?';", f"const VERSION = '{version}';", sw)
sw = re.sub(r"const SHELL = \[.*?\];", "const SHELL = " + repr(files).replace("'", '"') + ";", sw, flags=re.S)
open(f'{src}/sw.js', 'w', encoding='utf8').write(sw)

if os.path.isdir(dst):
    shutil.rmtree(dst)
shutil.copytree(src, dst)
print(version, len(files), 'files ->', dst)
