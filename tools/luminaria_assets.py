"""Crop the Luminaria character sheets into game sprites.
Usage: python3 tools/luminaria_assets.py <uploads_dir> <out_dir>"""
import sys, os
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
SHEETS = {
    'serena': '4044e8b9', 'luna': 'f72e38f4', 'camilla': '1ccf7d36', 'aria': '3495a997',
    'lizette': '40060b52', 'rose': '4da34166', 'noelle': 'dfc9cf43', 'beatrix': 'b2da1a7e',
}
STD = dict(key=(300, 0, 730, 540),
           cols=[(1066, 1214), (1220, 1368), (1373, 1522)], rows=[(42, 198), (234, 390)],
           chibi=(18, 868, 142, 986))
LAYOUT = {k: dict(STD) for k in SHEETS}
LAYOUT['camilla'] = dict(STD, chibi=(18, 878, 140, 978))
LAYOUT['serena'] = dict(key=(262, 0, 735, 545),
                        cols=[(1063, 1215), (1220, 1370), (1376, 1528)], rows=[(44, 196), (234, 388)],
                        chibi=(16, 872, 134, 992))

def jpg(im, path, q=86):
    im.convert('RGB').save(path, 'JPEG', quality=q, optimize=True, progressive=True)

for name, fid in SHEETS.items():
    im = Image.open(os.path.join(src, fid + '-image.png')).convert('RGB')
    L = LAYOUT[name]
    jpg(im, f'{out}/{name}_sheet.jpg', 80)
    jpg(im.crop(L['key']), f'{out}/{name}_key.jpg', 90)
    i = 0
    for (y0, y1) in L['rows']:
        for (x0, x1) in L['cols']:
            jpg(im.crop((x0, y0, x1, y1)), f'{out}/{name}_e{i}.jpg', 90); i += 1
    im.crop(L['chibi']).save(f'{out}/{name}_chibi.png', optimize=True)

# Blurred location backgrounds taken from the scenery behind each key art.
BG = {  # name: (sheet, box)
    'library':  ('noelle',  (0, 0, 745, 540)),
    'class':    ('serena',  (0, 0, 745, 540)),
    'training': ('camilla', (0, 0, 745, 540)),
    'outskirts':('luna',    (0, 0, 745, 540)),
    'chapel':   ('aria',    (0, 0, 745, 540)),
    'market':   ('beatrix', (0, 0, 745, 540)),
    'lab':      ('rose',    (0, 0, 745, 540)),
    'tower':    ('lizette', (0, 0, 745, 540)),
}
for bg, (sheet, box) in BG.items():
    im = Image.open(os.path.join(src, SHEETS[sheet] + '-image.png')).convert('RGB').crop(box)
    im = im.resize((960, 696), Image.LANCZOS).filter(ImageFilter.GaussianBlur(18))
    jpg(im, f'{out}/bg_{bg}.jpg', 78)
# Dorm: the mockup's academy room.
ui = Image.open(os.path.join(src, '6ff88620-image.png')).convert('RGB')
jpg(ui.crop((240, 0, 1060, 400)).resize((960, 468), Image.LANCZOS).filter(ImageFilter.GaussianBlur(14)), f'{out}/bg_dorm.jpg', 78)
