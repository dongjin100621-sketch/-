"""루미나리아 배경 이미지 만들기.

Wikimedia Commons의 퍼블릭 도메인(일부 CC BY) 명화를 내려받아
여백을 자르고 16:10으로 맞춘 뒤 luminaria/img/bg_*.jpg 로 저장한다.
출처는 luminaria/img/CREDITS.json 에 기록된다.

    python3 tools/luminaria_bg.py [캐시 폴더] [배경 이름…]   (이름을 주면 그 배경만 다시 만든다)
"""
import json, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image, ImageEnhance

ROOT = os.path.join(os.path.dirname(__file__), '..', 'luminaria', 'img')
CACHE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/luminaria_bg_cache'
UA = {'User-Agent': 'LuminariaBuild/1.0 (game asset build script)'}

# 배경 이름: (Commons 파일 이름, 여백 자르기 상자(1280px 기준) 또는 None, 초점 x 또는 (x, y), 0~1)
PICK = {
    'class':     ('Giovanni Paolo Panini – Ancient Rome.jpg', None, .5),
    'library':   ('Charlotte Bosanquet - The Library at Dingestow - Google Art Project.jpg', (80, 110, 1178, 836), .5),
    'training':  ('Bellotto - The Fortress of Königstein Courtyard with the Magdalenenburg, 1756-1758, 1996.64.1.jpg', None, (.5, .7)),
    'outskirts': ('Hubert Robert - Landscape with the Ruins of the Round Temple, with a Statue of Venus and a Monument to Marcus Aurelius.jpg', None, .55),
    'lab':       ('An alchemist in his laboratory. Oil painting by James Nasmyt Wellcome V0017640.jpg', None, .5),
    'chapel':    ('Georg Pezolt Blick in den Klostergarten.jpg', None, .6),
    'church':    ('Neeffs, Peeter the elder - Interior of a Gothic Church - Google Art Project.jpg', None, .5),
    'market':    ('Domenico Quaglio Braunschweig Altstadtmarkt 1834.jpg', None, .5),
    'dorm':      ('Interior of a Library - Google Art Project.jpg', (140, 100, 1156, 784), .5),
    'tower':     ('Abraham Pether (1756-1812) - View of Pendragon Castle by Moonlight - 960239 - National Trust.jpg', None, .45),
    'festival':  ('Oswald Achenbach Feuerwerk in Toree dell Annunziata.jpg', None, .5),
    'sea':       ('Caspar David Friedrich - Mondaufgang am Meer - Google Art Project.jpg', None, .5),
    # 2학년 1학기 (year2.js)
    'blossom':   ('Camille Pissarro, Orchard in Bloom, Louveciennes, 1872, NGA 52195.jpg', None, .5),
    'north':     ('Pieter Bruegel the Elder - Hunters in the Snow (Winter) - Google Art Project.jpg', None, .55),
    'aurora':    ('Frederic Edwin Church - Aurora Borealis - Google Art Project.jpg', None, (.5, .35)),
    'rain':      ('Gustave Caillebotte - Paris Street; Rainy Day - Google Art Project.jpg', None, .5),
    # 3학년 · 졸업 (year3c.js)
    'plum':      ('Vincent van Gogh - The white orchard - Google Art Project.jpg', None, .5),
    'ballroom':  ('Adolph Menzel - Das Ballsouper - Google Art Project.jpg', None, (.5, .4)),
}
W, H = 2400, 1500  # 고해상도 화면(레티나)용
# Real-ESRGAN realesr-general-x4v3 가중치 경로 (같은 폴더에 realesr-general-wdn-x4v3.pth).
# 주면 작은 원본을 AI로 4배 키운다 (없으면 단순 확대). 붓 질감을 남기려고 잡음 제거는 약하게(.2) 건다
SR = os.environ.get('LUMI_SR')
_up = None


def enlarge(im):
    global _up
    if not SR:
        return im
    if _up is None:
        sys.path.insert(0, os.path.dirname(__file__))
        from esrgan import Upscaler
        _up = Upscaler(SR, compact=32, wdn=os.path.join(os.path.dirname(SR), 'realesr-general-wdn-x4v3.pth'), denoise=.2)
    if im.width < W * .75:
        im = _up(im)
    return im


def api(params):
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({**params, 'format': 'json'})
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return json.load(r)


def fetch(name, title):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name + '.jpg')
    meta_path = path + '.json'
    if os.path.exists(path) and os.path.exists(meta_path):
        return path, json.load(open(meta_path))
    d = api({'action': 'query', 'titles': 'File:' + title, 'prop': 'imageinfo',
             'iiprop': 'url|size|extmetadata', 'iiurlwidth': 1920})
    ii = next(iter(d['query']['pages'].values()))['imageinfo'][0]
    m = ii['extmetadata']
    clean = lambda k: re.sub(r'\s+', ' ', re.sub('<[^>]+>', ' ', m.get(k, {}).get('value', ''))).strip()
    # 원본 직접 받기는 자주 막힌다(429). 표준 크기 1920px 썸네일을 받는다
    url = ii['thumburl'] if ii['width'] > 1920 else ii['url']
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        open(path, 'wb').write(r.read())
    artist = clean('Artist').replace('Details on Google Art Project', '').replace('– Artist', '').strip()
    artist = re.sub(r'(Unknown author\s*)+', 'Unknown author', artist).strip()
    meta = {'title': title, 'artist': artist[:60], 'license': clean('LicenseShortName'), 'source': ii['descriptionurl']}
    json.dump(meta, open(meta_path, 'w'), ensure_ascii=False)
    time.sleep(3)  # Wikimedia 요청 간격
    return path, meta


def fit(im, focus):
    """16:10으로 자른 뒤 W×H로 맞춘다."""
    r = W / H
    fx, fy = focus if isinstance(focus, tuple) else (focus, .45)
    if im.width / im.height > r:
        nw = round(im.height * r)
        x = round((im.width - nw) * fx)
        im = im.crop((x, 0, x + nw, im.height))
    else:
        nh = round(im.width / r)
        y = round((im.height - nh) * fy)
        im = im.crop((0, y, im.width, y + nh))
    return im.resize((W, H), Image.LANCZOS)


def main():
    only = sys.argv[2:]
    old = {c['bg']: c for c in json.load(open(os.path.join(ROOT, 'CREDITS.json')))} if only else {}
    credits = []
    for name, (title, box, focus) in PICK.items():
        if only and name not in only:
            if name in old:
                credits.append(old[name])
            continue
        path, meta = fetch(name, title)
        im = Image.open(path).convert('RGB')
        if box:
            s = im.width / 1280
            im = im.crop(tuple(round(v * s) for v in box))
        im = fit(enlarge(im), focus)
        im = ImageEnhance.Contrast(im).enhance(1.06)
        im = ImageEnhance.Color(im).enhance(1.08)
        im.save(os.path.join(ROOT, f'bg_{name}.jpg'), quality=82, optimize=True, progressive=True)
        credits.append({'bg': name, **meta})
        print(name, meta['artist'], '|', meta['license'])
    json.dump(credits, open(os.path.join(ROOT, 'CREDITS.json'), 'w'), ensure_ascii=False, indent=1)
    ep = os.path.join(ROOT, '..', 'js', 'episodes.js')
    src = open(ep, encoding='utf-8').read()
    src = re.sub(r'/\*CREDITS\*/.*?/\*END\*/', lambda m: '/*CREDITS*/' + json.dumps(credits, ensure_ascii=False) + '/*END*/', src, flags=re.S)
    open(ep, 'w', encoding='utf-8').write(src)


if __name__ == '__main__':
    main()
