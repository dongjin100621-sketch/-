"""루미나리아 캐릭터 이미지를 고화질로 다시 만든다.

캐릭터 시트(1536×1024 PNG)를 Real-ESRGAN(anime 6B)으로 4배 키운 뒤 잘라 쓴다.
스탠딩·꼬마 캐릭터는 isnet-anime 로 배경을 지워 투명 WebP 로 저장한다.

    python3 tools/luminaria_hd.py <시트 폴더> <RealESRGAN_x4plus_anime_6B.pth> <isnet-anime.onnx>

필요: torch, onnxruntime, numpy, scipy, pillow
"""
import os, sys
import numpy as np
import onnxruntime as ort
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
from esrgan import Upscaler  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', 'luminaria', 'img')
SHEETS = {
    'serena': '4044e8b9', 'luna': 'f72e38f4', 'camilla': '1ccf7d36', 'aria': '3495a997',
    'lizette': '40060b52', 'rose': '4da34166', 'noelle': 'dfc9cf43', 'beatrix': 'b2da1a7e',
}
# 시트 좌표(원본 1536×1024 기준). key: 왼쪽 일러스트에서 글씨를 피한 부분
STD = dict(key=(292, 0, 736, 540),
           cols=[(1066, 1214), (1220, 1368), (1373, 1522)], rows=[(42, 198), (234, 390)],
           chibi=(6, 850, 150, 985))
LAYOUT = {k: dict(STD) for k in SHEETS}
LAYOUT['serena'] = dict(key=(302, 0, 736, 545),
                        cols=[(1063, 1215), (1220, 1370), (1376, 1528)], rows=[(44, 196), (234, 388)],
                        chibi=(8, 860, 146, 993))
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
    src, weights, isnet = sys.argv[1:4]
    up, matte = Upscaler(weights), Matte(isnet)
    only = sys.argv[4:] or list(SHEETS)
    for name in only:
        L = LAYOUT[name]
        sheet = Image.open(os.path.join(src, SHEETS[name] + '-image.png')).convert('RGB')
        big = up(sheet)
        # 붓 질감을 조금 남기려고 단순 확대본을 15% 섞는다
        big = Image.blend(big, sheet.resize(big.size, Image.LANCZOS), .15)
        X = lambda b: tuple(v * 4 for v in b)

        jpg(big.resize((3072, 2048), Image.LANCZOS), f'{OUT}/{name}_sheet.jpg', 84)

        key = big.crop(X(L['key']))
        jpg(fit_h(key, KEY_H), f'{OUT}/{name}_key.jpg', 86)
        a = edge_fade(matte(key))
        webp(fit_h(with_alpha(key, a), STAND_H), f'{OUT}/{name}_stand.webp', 88)

        i = 0
        for (y0, y1) in L['rows']:
            for (x0, x1) in L['cols']:
                jpg(fit_h(big.crop(X((x0, y0, x1, y1))), FACE_H), f'{OUT}/{name}_e{i}.jpg', 90)
                i += 1

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
