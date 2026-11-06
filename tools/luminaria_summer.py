"""루미나리아 여름 의상 이미지 (여름방학 해변 이벤트용).

여름 캐릭터 시트(1484×1060 · 1448×1086 PNG)에서 필요한 부분만 잘라 Real-ESRGAN(realesr-general-x4v3)으로
4배 키운다. 뭉개짐을 막으려고 8방향(회전·반전)으로 키워 평균 내고(TTA), 다시 줄였을 때 원본과
같아지도록 역투영해 잔 디테일을 되살린다. 줄이지 않고 4배 크기 그대로 저장한다 (일러스트·스탠딩 2100px).
스탠딩·꼬마 캐릭터는 isnet-anime 로 배경을 지운다 (luminaria_hd.py 와 같은 방식).

    python3 tools/luminaria_summer.py <시트 폴더> <모델 폴더> [이름 ...] [--preview 파일]

만드는 파일 (luminaria/img):
    {id}_skey.jpg     여름 일러스트 (CG) — 왼쪽 글귀·서명을 피해서 자른다
    {id}_sstand.webp  여름 스탠딩 (배경 지움)
    {id}_se0~5.jpg    여름 표정 — data.js 의 ex 순서와 같은 칸을 고른다
    {id}_schibi.webp  여름 꼬마 캐릭터 (기본 대기)
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from esrgan import Upscaler, backproject  # noqa: E402
from luminaria_hd import Matte, edge_fade, with_alpha, fit_h, jpg, webp  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', 'luminaria', 'img')
# 업로드된 시트 (로제 시트에는 이름이 「리제트」로 잘못 적혀 있다 — 붉은 단발·고글의 발명가가 로제)
SHEETS = {
    'beatrix': 'cd37077b', 'rose': '304a9a16', 'noelle': '94cd02da', 'serena': 'f4e81c41',
    'luna': '9f526a18', 'aria': '60145697', 'lizette': '5dea2ceb', 'camilla': 'd77214ee',
}
# key: 왼쪽 일러스트에서 글귀·서명을 피한 부분 / cols·rows: 표정 칸 / pick: ex 순서대로 쓸 칸 번호 / chibi: 기본 대기
LAYOUT = {
    'beatrix': dict(key=(232, 0, 641, 525), cols=[(1005, 1097), (1104, 1192), (1199, 1287), (1293, 1381), (1386, 1474)],
                    rows=[(39, 186), (216, 387)], pick=[0, 6, 2, 7, 8, 1],  # 기본 장난스러움 윙크 진지 살짝당황 부드러운미소
                    chibi=(4, 886, 131, 1038),
                    cut=[[(520, 0), (660, 0), (660, 262), (585, 262), (548, 232), (528, 180), (520, 140), (512, 60)]]),  # 파라솔·쿠션
    'rose': dict(key=(180, 0, 635, 525), cols=[(1010, 1100), (1106, 1196), (1200, 1290), (1293, 1383), (1387, 1477)],
                 rows=[(40, 185), (220, 380)], pick=[0, 1, 4, 2, 5, 8],  # 기본 활짝웃음 놀람 윙크 집중 당당
                 chibi=(7, 877, 121, 1035)),
    'noelle': dict(key=(200, 0, 641, 525), cols=[(1017, 1127), (1137, 1247), (1252, 1362), (1370, 1478)],
                   rows=[(40, 188), (220, 385)], pick=[0, 2, 1, 6, 3, 7],  # 기본 살짝미소 생각중 의아함 놀람 졸림(손으로 입)
                   chibi=(7, 879, 133, 1031)),
    'serena': dict(key=(230, 0, 641, 522), cols=[(1015, 1128), (1132, 1245), (1248, 1362), (1366, 1478)],
                   rows=[(40, 190), (220, 380)], pick=[0, 2, 5, 4, 1, 6],  # 기본 은은한미소 난처 진지 생각중 만족
                   chibi=(1, 874, 125, 1035),
                   cut=[[(566, 0), (660, 0), (660, 282), (622, 282), (616, 215), (604, 145)]]),  # 커튼·의자
    'luna': dict(key=(210, 0, 633, 525), cols=[(995, 1104), (1111, 1216), (1222, 1328), (1337, 1437)],
                 rows=[(40, 187), (217, 379)], pick=[0, 1, 4, 2, 6, 5],  # 기본 활짝웃음 살짝당황 윙크 삐짐 감동
                 chibi=(17, 903, 139, 1034)),
    'aria': dict(key=(195, 0, 633, 525), cols=[(1007, 1117), (1121, 1226), (1230, 1334), (1338, 1441)],
                 rows=[(38, 187), (216, 376)], pick=[0, 1, 7, 4, 6, 0],  # 기본 환한미소 조금부끄러움 걱정 기도 기본
                 chibi=(4, 885, 143, 1029)),
    'lizette': dict(key=(200, 0, 633, 525), cols=[(1004, 1116), (1120, 1226), (1229, 1333), (1337, 1439)],
                    rows=[(39, 192), (220, 385)], pick=[0, 5, 6, 3, 4, 2],  # 기본 만족 의아 놀람 진지 부드러운미소
                    chibi=(5, 887, 125, 1031),
                    cut=[[(190, 0), (292, 0), (272, 24), (240, 50), (190, 62)]]),  # 야자수 잎
    'camilla': dict(key=(230, 0, 633, 516), cols=[(995, 1098), (1107, 1212), (1222, 1328), (1335, 1440)],
                    rows=[(40, 190), (222, 385)], pick=[0, 2, 3, 4, 5, 4],  # 기본 환한미소 놀람 결의 따뜻한시선 결의
                    chibi=(9, 887, 131, 1025)),
}
PAD = 10  # 키우기 전에 둘레를 조금 더 잘라 가장자리 얼룩을 피한다
# 4배 크기 그대로 (시트의 일러스트가 525px → 2100px). 표정·꼬마는 화면에서 커 보여도 흐리지 않게 넉넉히
KEY_H, STAND_H, FACE_H, CHIBI_W = 2100, 2100, 432, 540


def face_box(c, r):
    """표정 칸 위쪽에서 얼굴이 가운데 오도록 319:336 비율로 자른다"""
    (x0, x1), (y0, y1) = c, r
    w = x1 - x0 - 6
    h = round(w * 336 / 319)
    dy = max(0, round(.40 * (y1 - y0) - .47 * h))
    return (x0 + 3, y0 + 3 + dy, x0 + 3 + w, y0 + 3 + dy + h)


def main():
    args = [a for a in sys.argv[1:]]
    preview = None
    if '--preview' in args:
        i = args.index('--preview'); preview = args[i + 1]; del args[i:i + 2]
    src, models = args[:2]
    only = args[2:] or list(SHEETS)
    m = lambda f: os.path.join(models, f)
    up = Upscaler(m('realesr-general-x4v3.pth'), compact=32, wdn=m('realesr-general-wdn-x4v3.pth'), denoise=.2)
    matte = Matte(m('isnet-anime.onnx'))

    def big(sheet, box):
        x0, y0, x1, y1 = box
        p = (max(0, x0 - PAD), max(0, y0 - PAD), min(sheet.width, x1 + PAD), min(sheet.height, y1 + PAD))
        c = sheet.crop(p)
        b = backproject(c, up.tta(c))
        return b.crop(((x0 - p[0]) * 4, (y0 - p[1]) * 4, (x1 - p[0]) * 4, (y1 - p[1]) * 4))

    shots = []
    for name in only:
        L = LAYOUT[name]
        sheet = Image.open(os.path.join(src, SHEETS[name] + '-image.png')).convert('RGB')
        key = big(sheet, L['key'])
        jpg(fit_h(key, KEY_H), f'{OUT}/{name}_skey.jpg', 86)
        a = matte(key)
        for poly in L.get('cut', []):  # 남은 배경 (시트 좌표 다각형, 가장자리는 부드럽게)
            mk = Image.new('L', key.size, 0)
            ImageDraw.Draw(mk).polygon([((x - L['key'][0]) * 4, (y - L['key'][1]) * 4) for x, y in poly], fill=255)
            a = a * (1 - np.asarray(mk.filter(ImageFilter.GaussianBlur(10)), np.float32) / 255)
        a = edge_fade(a)
        stand = fit_h(with_alpha(key, a), STAND_H)
        webp(stand, f'{OUT}/{name}_sstand.webp', 88)

        cells = [(c, r) for r in L['rows'] for c in L['cols']]
        faces = []
        for i, k in enumerate(L['pick']):
            f = fit_h(big(sheet, face_box(*cells[k])), FACE_H)
            jpg(f, f'{OUT}/{name}_se{i}.jpg', 90)
            faces.append(f)

        ch = big(sheet, L['chibi'])
        a = matte(ch)
        ys, xs = np.nonzero(a > .05)
        pad = 12
        box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(ch.width, xs.max() + pad), min(ch.height, ys.max() + pad))
        c = with_alpha(ch, a).crop(box)
        chibi = c.resize((CHIBI_W, round(c.height * CHIBI_W / c.width)), Image.LANCZOS)
        webp(chibi, f'{OUT}/{name}_schibi.webp', 90)
        shots.append((name, fit_h(key, 360), fit_h(stand, 360), [fit_h(f, 120) for f in faces], fit_h(chibi, 200)))
        print(name, 'ok', flush=True)

    if preview:  # 한눈에 보는 확인용 시트
        W = 1500
        out = Image.new('RGB', (W, 380 * len(shots)), (40, 36, 44))
        d = ImageDraw.Draw(out)
        for i, (n, k, s, fs, c) in enumerate(shots):
            y = i * 380 + 10
            out.paste(k, (10, y)); bg = Image.new('RGB', s.size, (90, 140, 190)); bg.paste(s, (0, 0), s); out.paste(bg, (20 + k.width, y))
            x = 30 + k.width + s.width
            for j, f in enumerate(fs):
                out.paste(f, (x + (j % 3) * 120, y + (j // 3) * 130))
            cb = Image.new('RGB', c.size, (90, 140, 190)); cb.paste(c, (0, 0), c); out.paste(cb, (x + 370, y))
            d.text((12, y + 2), n, fill='yellow')
        out.save(preview)


if __name__ == '__main__':
    main()
