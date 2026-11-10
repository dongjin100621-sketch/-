"""사자성어 시험용 자료(hanja/js/tiers.js)를 만든다.

    python3 tools/hanja_tiers.py [Unihan.zip 또는 폴더]

· 자료: data.js 의 사자성어 + tools/hanja_tier_idioms.txt 의 추가 성어
· 단계: 성어에 든 글자 가운데 가장 어려운 글자의 급수로 정한다
    초급 = 8·7급, 중급 = 6·5급, 고급 = 4급, 최상 = 3급~1급, 극상 = 특급
  급수는 tools/hanja_grades.tsv(한국어문회 배정 한자)와 data.js 의 한자 단계로 찾는다.
· 검사: 네 글자가 맞는지, 독음이 글자마다 Unihan 읽기와 맞는지, 급수를 모르는 글자가 없는지
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hanja_unihan as hu

ROOT = hu.ROOT
EXTRA = os.path.join(ROOT, 'tools', 'hanja_tier_idioms.txt')
GRADES = os.path.join(ROOT, 'tools', 'hanja_grades.tsv')
OUT = os.path.join(ROOT, 'hanja', 'js', 'tiers.js')
NAMES = {1: '초급', 2: '중급', 3: '고급', 4: '최상', 5: '극상'}
LEVEL_TIER = {'beginner': 1, 'mid': 2, 'adv': 2, 'master': 3, 'top': 4, 'ultra': 5}
OVERRIDE = {'強': 2, '琢': 4}   # 목록에 모양이 달리 적힌 글자


def main():
    uni = hu.load_unihan(sys.argv[1] if len(sys.argv) > 1 else None)
    tier = {}
    for line in open(GRADES, encoding='utf8'):
        if line[0] != '#' and line.strip():
            c, t = line.split()
            tier[c] = int(t)
    src = open(hu.DATA, encoding='utf8').read()
    level = None
    for line in hu.read_template(src, 'CHAR_SRC').splitlines():
        line = line.strip()
        if line.startswith('@'):
            level = line[1:].strip()
        elif line and line[0] != '#':
            tier[line.split('|')[0]] = LEVEL_TIER[level]   # 이 앱에서 가르치는 단계가 우선
    tier.update(OVERRIDE)

    rows, seen, errors = [], set(), []
    for r in hu.parse_rows(hu.read_template(src, 'IDIOM_SRC')):
        f = r['f']
        rows.append((f[0], f[1], f[3]))
    for line in open(EXTRA, encoding='utf8'):
        line = line.strip()
        if line and line[0] != '#':
            f = line.split('|')
            rows.append((f[0], f[1], f[2]))

    out = {k: [] for k in NAMES}
    for h, r, mean in rows:
        if h in seen:
            continue
        seen.add(h)
        if len(h) != 4:
            continue                       # 사자성어만 (네 글자)
        rs = [s for s in r if '가' <= s <= '힣']
        if len(rs) != 4:
            errors.append(f'{h}: 독음 글자 수 {r}')
            continue
        bad = False
        for i, (c, s) in enumerate(zip(h, rs)):
            k = {x.split(':')[0] for x in uni.get(c, {}).get('kHangul', '').split()} | hu.KNOWN_READINGS.get(c, set())
            if not k:
                errors.append(f'{h}: {c} 의 읽기를 모름'); bad = True; break
            if s not in k and hu.dueum(s) not in k and not (c == '不' and s in ('부', '불')):
                errors.append(f'{h}: {c} 를 "{s}" 로 읽음 (가능한 음 {sorted(k)})'); bad = True; break
        if bad:
            continue
        miss = [c for c in h if c not in tier]
        if miss:
            errors.append(f'{h}: 급수를 모르는 글자 {"".join(miss)}')
            continue
        out[max(tier[c] for c in h)].append((h, r, mean))

    for e in errors:
        print('✗', e)
    lines = ['/* 사자성어 시험용 자료 — tools/hanja_tiers.py 가 만든다. 직접 고치지 않는다.',
             '   @1 초급(8·7급) @2 중급(6·5급) @3 고급(4급) @4 최상(3급~1급) @5 극상(특급)   성어|독음|뜻 */',
             'const TIER_SRC = `']
    for k in sorted(out):
        lines.append('@' + str(k))
        lines += ['|'.join(x) for x in out[k]]
    lines.append('`;')
    open(OUT, 'w', encoding='utf8').write('\n'.join(lines) + '\n')
    print({NAMES[k]: len(v) for k, v in out.items()}, '→', os.path.relpath(OUT))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
