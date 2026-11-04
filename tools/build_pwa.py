"""luminaria/sw.js 의 파일 목록을 갱신하고 docs/luminaria/ (GitHub Pages 배포용)로 복사한다.
사용법: python3 tools/build_pwa.py   (게임 파일을 고친 뒤 실행)"""
import os, re, shutil, hashlib
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(root, 'luminaria')
dst = os.path.join(root, 'docs', 'luminaria')

files = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css']
files += sorted('js/' + f for f in os.listdir(f'{src}/js') if f.endswith('.js'))
files += sorted('icons/' + f for f in os.listdir(f'{src}/icons') if f.endswith('.png'))
# 설정 자료(sheet)는 용량이 커서 처음 열 때 받지 않고, 볼 때 보관한다.
files += sorted('img/' + f for f in os.listdir(f'{src}/img') if '_sheet' not in f and f.endswith(('.jpg', '.png')))

h = hashlib.sha1()
for f in files:
    p = os.path.join(src, f)
    if os.path.isfile(p):
        h.update(open(p, 'rb').read())
version = 'luminaria-' + h.hexdigest()[:8]

sw = open(f'{src}/sw.js', encoding='utf8').read()
sw = re.sub(r"const VERSION = '.*?';", f"const VERSION = '{version}';", sw)
sw = re.sub(r"const SHELL = \[.*?\];", "const SHELL = " + repr(files).replace("'", '"') + ";", sw, flags=re.S)
open(f'{src}/sw.js', 'w', encoding='utf8').write(sw)

if os.path.isdir(dst):
    shutil.rmtree(dst)
shutil.copytree(src, dst)
print(version, len(files), 'files ->', dst)
