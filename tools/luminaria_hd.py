"""루미나리아 캐릭터 이미지를 고화질로 다시 만든다.

캐릭터 시트(1536×1024 PNG)를 Real-ESRGAN(realesr-general-x4v3)으로 4배 키운 뒤 잘라 쓴다.
애니 전용 모델(anime 6B)은 머리카락·눈의 붓 질감을 뭉개 버려서, 잡음 제거를 약하게(.2) 건
범용 모델로 바꿨다. 스탠딩·꼬마 캐릭터는 isnet-anime 로 배경을 지워 투명 WebP 로 저장한다.

    python3 tools/luminaria_hd.py <시트 폴더> <모델 폴더> [이름 ...]
    모델 폴더: realesr-general-x4v3.pth, realesr-general-wdn-x4v3.pth, isnet-anime.onnx

필요: torch, onnxruntime, numpy, scipy, pillow
"""
import os, sys
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
from esrgan import Upscaler  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', 'luminaria', 'img')
SHEETS = {
    'serena': '4044e8b9', 'luna': 'f72e38f4', 'camilla': '1ccf7d36', 'aria': '3495a997',
    'lizette': '40060b52', 'rose': '4da34166', 'noelle': 'dfc9cf43', 'beatrix': 'b2da1a7e',
    # 히든 히로인
    'elin': 'e014570b', 'rena': 'bb69a57b', 'sia': 'c2cbaf19', 'elise': '43079487',
}


def grid(cols, rows, pick=range(6)):
    """표정 칸 상자들. pick: 왼쪽 위부터 센 칸 번호 → e0, e1, …"""
    cells = [(x0, y0, x1, y1) for (y0, y1) in rows for (x0, x1) in cols]
    return [cells[i] for i in pick]


# 시트 좌표(원본 1536×1024 기준). key: 왼쪽 일러스트에서 글씨를 피한 부분
STD = dict(key=(292, 0, 736, 540),
           faces=grid([(1066, 1214), (1220, 1368), (1373, 1522)], [(42, 198), (234, 390)]),
           chibi=(6, 850, 150, 985))
LAYOUT = {k: dict(STD) for k in SHEETS}
LAYOUT['serena'] = dict(key=(302, 0, 736, 545),
                        faces=grid([(1063, 1215), (1220, 1370), (1376, 1528)], [(44, 196), (234, 388)]),
                        chibi=(8, 860, 146, 993))
# 새 시트는 표정이 4×2(엘리제만 3×2). 쓰는 여섯 칸의 순서가 data.js 의 ex 와 맞아야 한다
COL4 = [(1068, 1182), (1191, 1297), (1306, 1412), (1421, 1526)]
ROW2 = [(43, 200), (233, 393)]
LAYOUT['elin'] = dict(key=(222, 0, 702, 535), faces=grid(COL4, ROW2, [0, 2, 1, 3, 4, 5]),  # 기본 옅은미소 생각중 놀람 진지 냉담
                      chibi=(28, 860, 142, 982))
LAYOUT['rena'] = dict(key=(192, 0, 702, 535), faces=grid(COL4, ROW2, [0, 2, 1, 3, 4, 5]),  # 기본 웃음 냉소 놀람 진지 생각중
                      chibi=(28, 861, 148, 982),
                      ctx=(0, 0, 708, 540),  # 배경을 넓게 보고 지운다
                      # 그래도 남는 뒤편 가죽 소파는 손으로 그린 다각형으로 지운다 (시트 좌표)
                      cut=[[(610, 0), (600, 110), (562, 150), (541, 200), (545, 262), (575, 305), (640, 335), (702, 352), (702, 0)]])
LAYOUT['sia'] = dict(key=(228, 0, 702, 535),
                     faces=grid([(1067, 1182), (1190, 1295), (1302, 1407), (1417, 1522)], ROW2, [0, 1, 2, 3, 4, 7]),  # 기본 환한웃음 놀람 진지 분노 여유
                     chibi=(28, 860, 145, 982))
LAYOUT['elise'] = dict(key=(226, 0, 702, 535),
                       faces=grid([(1067, 1215), (1222, 1367), (1375, 1522)], [(42, 200), (232, 395)]),  # 기본 환한웃음 놀라움 생각중 진지함 윙크
                       chibi=(26, 860, 152, 982))
KEY_H, STAND_H, FACE_H, CHIBI_W = 1440, 1620, 336, 420


def jpg(im, path, q=88):
    im.convert('RGB').save(path, 'JPEG', quality=q, optimize=True, progressive=True)


def webp(im, path, q=88):
    im.save(path, 'WEBP', quality=q, alpha_quality=92, method=6)


class Matte:
    def __init__(self, model):
        self.s = ort.InferenceSession(model, providers=['CPUExecutionProvider'])

    def __call__(self, im):
        x = np.asarray(im.convert('RGB').resize((1024, 1024), Image.LANCZOS)).astype(np.float32)
        x = (x / max(1.0, x.max()) - np.array([.485, .456, .406], np.float32)).transpose(2, 0, 1)[None]
        o = self.s.run(None, {self.s.get_inputs()[0].name: x.astype(np.float32)})[0][0, 0]
        o = (o - o.min()) / (o.max() - o.min() + 1e-8)
        a = np.asarray(Image.fromarray((o * 255).astype(np.uint8)).resize(im.size, Image.LANCZOS), np.float32) / 255
        # 가장 큰 덩어리(캐릭터)만 남기고 떨어진 배경 조각·장식은 지운다
        lab, n = ndimage.label(a > .5)
        if n > 1:
            sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
            keep = lab == (int(np.argmax(sizes)) + 1)
            keep = ndimage.binary_dilation(keep, iterations=max(2, im.width // 200))
            a *= ndimage.gaussian_filter(keep.astype(np.float32), 1.5)
        a[a < .04] = 0
        return a


def ramp(n, w):
    """0→1 부드러운 경사 (smoothstep)"""
    t = np.clip(np.arange(n, dtype=np.float32) / max(1, w), 0, 1)
    return t * t * (3 - 2 * t)


def edge_fade(a, left=.12, right=.06, top=.04, bottom=.16):
    """잘린 테두리가 칼로 벤 듯 보이지 않게 가장자리만 살짝 흐리게"""
    h, w = a.shape
    fx = ramp(w, w * left) * ramp(w, w * right)[::-1]
    fy = ramp(h, h * top) * ramp(h, h * bottom)[::-1]
    return a * fy[:, None] * fx[None, :]


def with_alpha(rgb, a):
    im = rgb.convert('RGBA')
    im.putalpha(Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8)))
    return im


def fit_h(im, h):
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def main():
    src, models = sys.argv[1:3]
    m = lambda f: os.path.join(models, f)
    up = Upscaler(m('realesr-general-x4v3.pth'), compact=32, wdn=m('realesr-general-wdn-x4v3.pth'), denoise=.2)
    matte = Matte(m('isnet-anime.onnx'))
    only = sys.argv[3:] or list(SHEETS)
    for name in only:
        L = LAYOUT[name]
        sheet = Image.open(os.path.join(src, SHEETS[name] + '-image.png')).convert('RGB')
        big = up(sheet)
        X = lambda b: tuple(v * 4 for v in b)

        jpg(big.resize((3072, 2048), Image.LANCZOS), f'{OUT}/{name}_sheet.jpg', 84)

        key = big.crop(X(L['key']))
        jpg(fit_h(key, KEY_H), f'{OUT}/{name}_key.jpg', 86)
        if 'ctx' in L:  # 넓은 범위로 배경을 지운 뒤 key 영역만 잘라 쓴다
            cx = X(L['ctx']); k = X(L['key'])
            a = matte(big.crop(cx))[k[1] - cx[1]:k[3] - cx[1], k[0] - cx[0]:k[2] - cx[0]]
        else:
            a = matte(key)
        for poly in L.get('cut', []):  # 지울 영역 (가장자리는 부드럽게)
            m = Image.new('L', key.size, 0)
            ImageDraw.Draw(m).polygon([((x - L['key'][0]) * 4, (y - L['key'][1]) * 4) for x, y in poly], fill=255)
            a = a * (1 - np.asarray(m.filter(ImageFilter.GaussianBlur(10)), np.float32) / 255)
        a = edge_fade(a)
        webp(fit_h(with_alpha(key, a), STAND_H), f'{OUT}/{name}_stand.webp', 88)

        for i, box in enumerate(L['faces']):
            jpg(fit_h(big.crop(X(box)), FACE_H), f'{OUT}/{name}_e{i}.jpg', 90)

        ch = big.crop(X(L['chibi']))
        a = matte(ch)
        ys, xs = np.nonzero(a > .05)  # 투명한 여백은 잘라낸다
        pad = 12
        box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(ch.width, xs.max() + pad), min(ch.height, ys.max() + pad))
        c = with_alpha(ch, a).crop(box)
        webp(c.resize((CHIBI_W, round(c.height * CHIBI_W / c.width)), Image.LANCZOS), f'{OUT}/{name}_chibi.webp', 90)
        print(name, 'ok', flush=True)


if __name__ == '__main__':
    main()
