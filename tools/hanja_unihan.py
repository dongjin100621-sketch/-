"""한자 서당(hanja/) 자료를 Unicode Unihan 자료로 검사하고, 획수·부수 파일(hanja/js/unihan.js)을 만든다.

    python3 tools/hanja_unihan.py [Unihan.zip 또는 압축을 푼 폴더]

경로를 주지 않으면 ~/.cache/hanja/Unihan.zip 을 쓰고, 없으면 unicode.org 에서 내려받는다.
검사하는 것
  - 급수별 글자 수(8급 50 · 7급Ⅱ 50 · 7급 50 · 6급Ⅱ 75 · 6급 75 · 5급Ⅱ 100 · 5급 100), 겹치는 글자
  - 호환용 한자(U+F900~)가 섞이지 않았는지
  - 훈음의 음이 Unihan kHangul 의 읽기와 맞는지
  - 예시 낱말·성어·명구의 독음이 글자마다 맞는지 (두음 법칙, 不의 '부', 렬·률→열·율 반영)
  - 성어·명구의 글자가 모두 훈음을 가졌는지
문제가 있으면 목록을 보여 주고 1 로 끝난다.
"""
import io, json, os, re, sys, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'hanja', 'js', 'data.js')
OUT = os.path.join(ROOT, 'hanja', 'js', 'unihan.js')
URL = 'https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip'

GRADES = {'8': 50, '7Ⅱ': 50, '7': 50, '6Ⅱ': 75, '6': 75, '5Ⅱ': 100, '5': 100, '4Ⅱ': 250, '4': 250}
LEVEL_SIZE = {'beginner': 150, 'mid': 150, 'adv': 200, 'master': 500}

# 강희자전 부수 214자와 이름
RADICAL_CHARS = ('一丨丶丿乙亅二亠人儿入八冂冖冫几凵刀力勹匕匚匸十卜卩厂厶又口囗土士夂夊夕大女子宀寸小尢尸屮山巛工己巾干幺广廴廾弋弓彐彡彳'
                 '心戈戶手支攴文斗斤方无日曰月木欠止歹殳毋比毛氏气水火爪父爻爿片牙牛犬玄玉瓜瓦甘生用田疋疒癶白皮皿目矛矢石示禸禾穴立'
                 '竹米糸缶网羊羽老而耒耳聿肉臣自至臼舌舛舟艮色艸虍虫血行衣襾見角言谷豆豕豸貝赤走足身車辛辰辵邑酉釆里金長門阜隶隹雨靑非'
                 '面革韋韭音頁風飛食首香馬骨高髟鬥鬯鬲鬼魚鳥鹵鹿麥麻黃黍黑黹黽鼎鼓鼠鼻齊齒龍龜龠')
RADICAL_NAMES = (
    '한 일,뚫을 곤,점 주,삐침 별,새 을,갈고리 궐,두 이,돼지해머리,사람 인,어진사람 인,들 입,여덟 팔,멀 경,민갓머리,이수변,안석 궤,'
    '위튼입구,칼 도,힘 력,쌀 포,비수 비,튼입구,감출 혜,열 십,점 복,병부 절,민엄호,마늘모,또 우,입 구,큰입구,흙 토,선비 사,'
    '뒤져올 치,천천히걸을 쇠,저녁 석,큰 대,계집 녀,아들 자,갓머리,마디 촌,작을 소,절름발이 왕,주검 시,왼손 좌,메 산,개미허리,'
    '장인 공,몸 기,수건 건,방패 간,작을 요,엄호,민책받침,스물입발,주살 익,활 궁,튼가로왈,터럭 삼,두인변,'
    '마음 심,창 과,지게 호,손 수,지탱할 지,등글월문,글월 문,말 두,날 근,모 방,없을 무,날 일,가로 왈,달 월,나무 목,하품 흠,'
    '그칠 지,죽을사변,갖은등글월문,말 무,견줄 비,터럭 모,각시 씨,기운기엄,물 수,불 화,손톱 조,아비 부,점괘 효,장수장변,조각 편,'
    '어금니 아,소 우,개 견,검을 현,구슬 옥,오이 과,기와 와,달 감,날 생,쓸 용,밭 전,필 필,병질엄,필발머리,흰 백,가죽 피,'
    '그릇 명,눈 목,창 모,화살 시,돌 석,보일 시,짐승발자국 유,벼 화,구멍 혈,설 립,'
    '대 죽,쌀 미,실 사,장군 부,그물 망,양 양,깃 우,늙을 로,말이을 이,쟁기 뢰,귀 이,붓 율,고기 육,신하 신,스스로 자,이를 지,'
    '절구 구,혀 설,어그러질 천,배 주,괘이름 간,빛 색,풀 초,범호엄,벌레 훼,피 혈,다닐 행,옷 의,덮을 아,볼 견,뿔 각,말씀 언,'
    '골 곡,콩 두,돼지 시,갖은돼지시변,조개 패,붉을 적,달릴 주,발 족,몸 신,수레 거,매울 신,별 진,책받침,고을 읍,닭 유,'
    '분별할 변,마을 리,쇠 금,긴 장,문 문,언덕 부,미칠 이,새 추,비 우,푸를 청,아닐 비,'
    '낯 면,가죽 혁,다룸가죽 위,부추 구,소리 음,머리 혈,바람 풍,날 비,밥 식,머리 수,향기 향,말 마,뼈 골,높을 고,터럭발,싸울 투,'
    '울창주 창,솥 력,귀신 귀,물고기 어,새 조,소금밭 로,사슴 록,보리 맥,삼 마,누를 황,기장 서,검을 흑,바느질할 치,맹꽁이 맹,'
    '솥 정,북 고,쥐 서,코 비,가지런할 제,이 치,용 룡,거북 귀,피리 약').split(',')
assert len(RADICAL_CHARS) == 214 and len(RADICAL_NAMES) == 214

SPECIAL_WORDS = {'六月': '유월', '十月': '시월', '困難': '곤란'}  # 활음조로 굳어진 읽기
# Unihan kHangul 에 빠진, 사전에 실린 읽기
KNOWN_READINGS = {'畫': {'획'}, '則': {'즉'}, '布': {'보'}, '推': {'퇴'}, '覆': {'부'}}

# ---------------- 한글 음절 ----------------
CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'


def split(s):
    n = ord(s) - 0xAC00
    return n // 588, (n % 588) // 28, n % 28


def join(c, j, t):
    return chr(0xAC00 + c * 588 + j * 28 + t)


IY = {JUNG.index(v) for v in 'ㅑㅕㅖㅛㅠㅣ'}


def dueum(s):
    """낱말 첫머리의 두음 법칙: 녀→여, 리→이, 로→노 …"""
    c, j, t = split(s)
    if c == CHO.index('ㄹ'):
        c = CHO.index('ㅇ') if j in IY else CHO.index('ㄴ')
    elif c == CHO.index('ㄴ') and j in IY:
        c = CHO.index('ㅇ')
    return join(c, j, t)


def variants(eum, first, prev, nxt):
    """한 글자 음이 낱말 안에서 날 수 있는 모양들"""
    out = {eum}
    if first:
        out.add(dueum(eum))
    elif eum in ('렬', '률') and prev is not None:
        c, j, t = split(prev)
        if t == 0 or t == 4:  # 받침 없음 또는 ㄴ
            out.add('열' if eum == '렬' else '율')
    return out


# ---------------- 자료 읽기 ----------------
def read_template(src, name):
    m = re.search(r'const ' + name + r' = `(.*?)`;', src, re.S)
    return m.group(1) if m else ''


def parse_chars(text):
    chars, level, unit = [], None, None
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith('@'):
            level, unit = line[1:].strip(), None
            continue
        if line.startswith('#'):
            unit = line[1:].strip()
            continue
        c, g, hun, words = line.split('|')
        readings = []
        for r in hun.split('/'):
            *h, e = r.strip().split(' ')
            readings.append((' '.join(h), e))
        ws = []
        for w in words.split(','):
            w, r = w.strip().split(' ')
            ws.append((w, r))
        chars.append(dict(c=c, g=g, level=level, unit=unit, readings=readings, words=ws))
    return chars


def parse_rows(text):
    rows, level, unit = [], None, None
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith('@'):
            level = line[1:].strip()
            continue
        if line.startswith('#'):
            unit = line[1:].strip()
            continue
        rows.append(dict(f=line.split('|'), level=level, unit=unit))
    return rows


def load_unihan(path):
    if path is None:
        cache = os.path.expanduser('~/.cache/hanja')
        path = os.path.join(cache, 'Unihan.zip')
        if not os.path.exists(path):
            os.makedirs(cache, exist_ok=True)
            print('Unihan 자료를 내려받는 중…', URL)
            with urllib.request.urlopen(URL) as r, open(path, 'wb') as f:
                f.write(r.read())
    keys = ('kHangul', 'kTotalStrokes', 'kRSUnicode')
    d = {}

    def feed(lines):
        for line in lines:
            if not line.startswith('U+'):
                continue
            cp, k, v = line.rstrip('\n').split('\t', 2)
            if k in keys:
                d.setdefault(chr(int(cp[2:], 16)), {})[k] = v

    if os.path.isdir(path):
        for f in os.listdir(path):
            if f.startswith('Unihan_') and f.endswith('.txt'):
                with open(os.path.join(path, f), encoding='utf8') as fh:
                    feed(fh)
    else:
        with zipfile.ZipFile(path) as z:
            for n in z.namelist():
                if n.endswith('.txt'):
                    feed(io.TextIOWrapper(z.open(n), encoding='utf8'))
    return d


def main():
    uni = load_unihan(sys.argv[1] if len(sys.argv) > 1 else None)
    src = open(DATA, encoding='utf8').read()
    chars = parse_chars(read_template(src, 'CHAR_SRC'))
    idioms = parse_rows(read_template(src, 'IDIOM_SRC'))
    phrases = parse_rows(read_template(src, 'PHRASE_SRC'))
    extra = {}
    for line in read_template(src, 'EXTRA_SRC').splitlines():
        line = line.strip()
        if line:
            c, hun = line.split('|')
            extra[c] = [tuple(x.strip().rsplit(' ', 1)) for x in hun.split('/')]

    errors = []
    by_char = {}
    for ch in chars:
        if ch['c'] in by_char:
            errors.append(f"겹친 글자 {ch['c']}")
        by_char[ch['c']] = ch
    for c in extra:
        if c in by_char:
            errors.append(f'EXTRA 에 배정 한자가 있음: {c}')

    # 개수
    from collections import Counter
    gc = Counter(ch['g'] for ch in chars)
    for g, n in GRADES.items():
        if gc.get(g) != n:
            errors.append(f'{g}급 글자 수 {gc.get(g)} (기대 {n})')
    lc = Counter(ch['level'] for ch in chars)
    for l, n in LEVEL_SIZE.items():
        if lc.get(l) != n:
            errors.append(f'{l} 글자 수 {lc.get(l)} (기대 {n})')

    def readings_of(c):
        """그 글자가 가질 수 있는 음 (자료 + Unihan)"""
        s = set()
        if c in by_char:
            s |= {e for _, e in by_char[c]['readings']}
        if c in extra:
            s |= {e for _, e in extra[c]}
        k = uni.get(c, {}).get('kHangul', '')
        s |= {x.split(':')[0] for x in k.split()}
        return s | KNOWN_READINGS.get(c, set())

    all_chars = list(by_char) + list(extra)
    for c in all_chars:
        if not ('一' <= c <= '鿿' or '㐀' <= c <= '䶿'):
            errors.append(f'통합 한자가 아님: {c} U+{ord(c):04X}')
        if c not in uni:
            errors.append(f'Unihan 에 없음: {c}')
            continue
        k = {x.split(':')[0] for x in uni[c].get('kHangul', '').split()} | KNOWN_READINGS.get(c, set())
        mine = by_char[c]['readings'] if c in by_char else extra[c]
        for _, e in mine:
            if e not in k and dueum(e) not in k:
                errors.append(f'{c}: 음 "{e}" 이 Unihan 읽기 {sorted(k)} 에 없음')

    def check_reading(hanja, reading, where, glyph_ok=None):
        hs = [c for c in hanja if not c.isspace() and c not in '，。、']
        rs = [s for s in reading if '가' <= s <= '힣']
        if len(hs) != len(rs):
            errors.append(f'{where}: 글자 수 {len(hs)} ≠ 독음 {len(rs)} ({hanja} / {reading})')
            return
        # 낱말(띄어쓰기 단위)의 첫 글자에만 두음 법칙
        words_h = hanja.split()
        idx = 0
        firsts = set()
        for w in words_h:
            firsts.add(idx)
            idx += len(w)
        for i, (c, s) in enumerate(zip(hs, rs)):
            ok = False
            for e in readings_of(c):
                v = variants(e, i in firsts, rs[i - 1] if i else None, None)
                if c == '不' and i + 1 < len(rs) and split(rs[i + 1])[0] in (CHO.index('ㄷ'), CHO.index('ㅈ')):
                    v.add('부')
                if s in v:
                    ok = True
                    break
            if not ok:
                errors.append(f'{where}: {c} 를 "{s}" 로 읽음 (가능한 음 {sorted(readings_of(c))}) — {hanja} {reading}')

    for ch in chars:
        for w, r in ch['words']:
            if ch['c'] not in w:
                errors.append(f"{ch['c']}: 예시 낱말 {w} 에 그 글자가 없음")
            if SPECIAL_WORDS.get(w) == r:
                continue
            check_reading(w, r, f"{ch['c']} 낱말")

    missing = []
    for row in idioms:
        h, r = row['f'][0], row['f'][1]
        if len(h) != 4:
            errors.append(f'성어 {h}: 네 글자가 아님')
        check_reading(h, r, f'성어 {h}')
        missing += [c for c in h if c not in by_char and c not in extra]
        if len(row['f']) > 6 and row['f'][6]:
            for g in row['f'][6].split(';'):
                if g.split('=')[0] not in h:
                    errors.append(f'성어 {h}: 고친 글자 {g} 가 성어에 없음')
    for row in phrases:
        h, r = row['f'][0], row['f'][1]
        # 명구는 한 구절 전체가 한 덩어리로 읽힌다고 보고 띄어쓰기 단위마다 두음 법칙을 적용
        check_reading(h, r, f'명구 {h}')
        missing += [c for c in h if not c.isspace() and c not in by_char and c not in extra]
        if len(row['f']) > 4 and row['f'][4]:
            for g in row['f'][4].split(';'):
                c, hun = g.split('=')
                if c not in h:
                    errors.append(f'명구 {h}: 고친 글자 {c} 가 원문에 없음')
    missing = sorted(set(missing), key=lambda c: ord(c))
    if missing:
        errors.append('훈음이 없는 글자(EXTRA_SRC 에 추가): ' + ''.join(missing))
        for c in missing:
            k = uni.get(c, {}).get('kHangul', '')
            print(f'  {c}|  ({k})')

    # 획수·부수
    out, used_rad = {}, set()
    for c in all_chars:
        u = uni.get(c, {})
        strokes = u.get('kTotalStrokes', '0').split()
        # 값이 둘이면 두 번째가 번체(대만) 기준 — 한국 한자와 같은 자형
        st = int(strokes[-1]) if strokes else 0
        rs = u.get('kRSUnicode', '0.0').split()[0]
        rad, add = rs.replace("'", '').split('.')
        out[c] = [st, int(rad)]
        used_rad.add(int(rad))
    rads = {n: [RADICAL_CHARS[n - 1], RADICAL_NAMES[n - 1]] for n in sorted(used_rad)}

    if errors:
        print('\n'.join('✗ ' + e for e in errors))
        print(f'\n문제 {len(errors)}건')
        sys.exit(1)

    js = ("'use strict';\n/* tools/hanja_unihan.py 가 Unicode Unihan 자료(kTotalStrokes, kRSUnicode)로 만든 파일. 직접 고치지 마세요.\n"
          "   UNIHAN[글자] = [총획수, 부수 번호],  RADICALS[부수 번호] = [부수, 이름] */\n"
          'const UNIHAN = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
          'const RADICALS = ' + json.dumps(rads, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open(OUT, 'w', encoding='utf8').write(js)
    print(f'검사 통과: 한자 {len(chars)}자, 성어 {len(idioms)}개, 명구 {len(phrases)}개, 덧붙인 글자 {len(extra)}자')
    print('→', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
