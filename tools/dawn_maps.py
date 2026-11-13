"""여명의 종 맵을 만든다 → dawn/js/maps.js
마을·던전을 좌표로 그리고(집·길·물·숲), NPC·문·상자·사건 위치를 함께 적는다.
모든 사람·문·상자·출구가 입구에서 걸어서 닿는지 검사한다.

    python3 tools/dawn_maps.py            # maps.js 만들기
    python3 tools/dawn_maps.py --png DIR  # 맵 미리보기 그림도 저장

타일 글자
  .  땅(풀·모래·눈·돌바닥)   ,  땅 무늬   :  길   *  꽃·장식(지나감)   %  잔해(지나감)   _  양탄자
  ~  물(막힘)   +  다리   T  나무   P  다른 나무   B  덤불   R  바위   #  벽   |  기둥   =  울타리
  C  선인장   ^  지붕   H  집 벽   n  창문   o  문(조사)   b  종(조사)   l  가로등   c  상자   x  수정(회복·저장)   s  표지판
"""
import json, os, random, sys
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WALK = set('.,:*%_+')


class M:
    def __init__(s, w, h, fill='.'):
        s.w, s.h = w, h
        s.g = [[fill] * w for _ in range(h)]
        s.npcs, s.doors, s.chests, s.signs, s.events, s.crystals, s.exits = [], [], [], [], [], [], []

    def put(s, x, y, ch):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.g[y][x] = ch

    def get(s, x, y):
        return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else '#'

    def rect(s, x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                s.put(x, y, ch)

    def frame(s, ch, t=1):
        for y in range(s.h):
            for x in range(s.w):
                if x < t or y < t or x >= s.w - t or y >= s.h - t:
                    s.g[y][x] = ch

    def path(s, pts, ch=':', wide=1):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            dx = (x1 > x0) - (x1 < x0)
            dy = (y1 > y0) - (y1 < y0)
            x, y = x0, y0
            while True:
                for k in range(wide):
                    s.put(x + (k if dy else 0), y + (k if dx else 0), ch)
                if (x, y) == (x1, y1):
                    break
                x += dx
                y += dy

    def house(s, x, y, w, door, windows=(), kind=None, **kw):
        """지붕 한 줄 + 벽 한 줄. door 는 왼쪽에서 몇 칸째인지."""
        s.rect(x, y, x + w - 1, y, '^')
        for i in range(w):
            s.put(x + i, y + 1, 'o' if i == door else ('n' if i in windows else 'H'))
        if kind:
            s.doors.append(dict(x=x + door, y=y + 1, kind=kind, **kw))
        return (x + door, y + 2)

    def scatter(s, ch, n, x0, y0, x1, y1, seed, on='.', keep=()):
        r = random.Random(seed)
        tries = 0
        while n > 0 and tries < n * 50:
            tries += 1
            x, y = r.randint(x0, x1), r.randint(y0, y1)
            if s.g[y][x] == on and (x, y) not in keep:
                s.g[y][x] = ch
                n -= 1

    def npc(s, id, x, y, spr, name, talk, **kw):
        s.npcs.append(dict(id=id, x=x, y=y, spr=spr, name=name, talk=talk, **kw))

    def chest(s, id, x, y, **kw):
        s.put(x, y, 'c')
        s.chests.append(dict(id=id, x=x, y=y, **kw))

    def sign(s, x, y, text):
        s.put(x, y, 's')
        s.signs.append(dict(x=x, y=y, text=text))

    def crystal(s, x, y):
        s.put(x, y, 'x')
        s.crystals.append(dict(x=x, y=y))

    def event(s, x, y, script, **kw):
        s.events.append(dict(x=x, y=y, script=script, **kw))

    def exit(s, x, y, to='world', **kw):
        s.exits.append(dict(x=x, y=y, to=to, **kw))

    def rows(s):
        return [''.join(r) for r in s.g]


def check(name, m, entry):
    """입구에서 걸어서 닿는 칸을 구해, 조사 대상은 이웃 칸이 닿는지, 출구·사건은 그 칸이 닿는지 본다."""
    blocked = {(n['x'], n['y']) for n in m.npcs}
    seen = {(entry['x'], entry['y'])}
    q = deque(seen)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if (nx, ny) in seen or not (0 <= nx < m.w and 0 <= ny < m.h):
                continue
            if m.g[ny][nx] in WALK:
                seen.add((nx, ny))
                q.append((nx, ny))
    bad = []
    def near(x, y):
        return any((x + dx, y + dy) in seen for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    for kind, lst in (('npc', m.npcs), ('door', m.doors), ('chest', m.chests), ('sign', m.signs), ('crystal', m.crystals)):
        for o in lst:
            if not near(o['x'], o['y']):
                bad.append((kind, o.get('id', o.get('kind')), o['x'], o['y']))
    for kind, lst in (('exit', m.exits), ('event', m.events)):
        for o in lst:
            if o.get('check'):
                if not near(o['x'], o['y']):
                    bad.append((kind, o.get('script', o.get('to')), o['x'], o['y']))
            elif (o['x'], o['y']) not in seen:
                bad.append((kind, o.get('script', o.get('to')), o['x'], o['y']))
    for d in m.doors:
        if m.g[d['y']][d['x']] != 'o':
            bad.append(('door-not-o', d.get('kind'), d['x'], d['y'], m.g[d['y']][d['x']]))
    for c in m.chests:
        if m.g[c['y']][c['x']] != 'c':
            bad.append(('chest-overwritten', c['id'], c['x'], c['y']))
    for n in m.npcs:
        if m.g[n['y']][n['x']] not in WALK:
            bad.append(('npc-on-block', n['id'], n['x'], n['y']))
    if bad:
        print('!!', name, bad)
    return not bad


MAPS = {}


def done(id, m, **meta):
    MAPS[id] = (m, meta)


# ─────────────────────────────── 여명 마을 ───────────────────────────────
m = M(28, 20)
m.frame('T')
m.rect(1, 1, 26, 1, 'T'); m.put(1, 2, 'P'); m.put(26, 2, 'P')
# 종탑 (가운데 위)
m.rect(11, 1, 16, 1, '^'); m.rect(11, 2, 16, 3, '#'); m.put(13, 2, 'b'); m.put(14, 2, 'b')
m.put(13, 3, 'o'); m.put(14, 3, 'o')
m.doors.append(dict(x=13, y=3, kind='event', script='v_tower'))
m.doors.append(dict(x=14, y=3, kind='event', script='v_tower'))
# 성당 (왼쪽 위)
m.house(2, 3, 6, 3, (1, 5), kind='event', script='v_church')
# 촌장 집 (오른쪽 위)
m.house(20, 3, 6, 2, (4,), kind='event', script='v_elderhouse')
# 여관·상점·무기점
m.house(2, 9, 5, 2, (0, 4), kind='inn', price=10, label='여관')
m.house(9, 12, 5, 2, (0, 4), kind='shop', shop='v_items', label='도구점')
m.house(15, 12, 5, 2, (4,), kind='shop', shop='v_gear', label='무기·방어구')
m.house(21, 9, 5, 2, (0, 4), kind='house', text='「종지기 할아범이 잠든 뒤로 밤마다 우는 소리가 들려요…」')
# 길
m.path([(13, 4), (13, 7)], wide=2)
m.path([(4, 6), (24, 6)])
m.path([(5, 5), (5, 6)]); m.path([(22, 5), (22, 6)])
m.path([(4, 11), (4, 14), (13, 14)]); m.path([(23, 11), (23, 14), (14, 14)])
m.path([(13, 7), (13, 18)], wide=2)
# 연못과 꽃
m.rect(19, 16, 24, 17, '~'); m.rect(20, 15, 23, 15, '~')
m.rect(2, 16, 5, 17, ','); m.put(7, 17, 'B'); m.put(8, 17, 'B')
m.scatter('*', 9, 1, 2, 26, 17, 3)
m.put(10, 7, 'l'); m.put(16, 7, 'l'); m.put(10, 16, 'l'); m.put(16, 16, 'l')
m.rect(13, 19, 14, 19, ':')
m.sign(11, 18, '남쪽 길 — 고요의 숲, 그리고 세상 끝까지')
m.exit(13, 19); m.exit(14, 19)
m.npc('elder', 18, 7, 'elder', '촌장 오도', [['ch1', 'v_elder2'], [None, 'v_elder']])
m.npc('seira0', 6, 6, 'seira', '세이라', 'v_seira0', hide='j_seira')
m.npc('kid', 8, 15, 'child', '아이 토비', [['bell1', 'v_kid2'], [None, 'v_kid']], wander=True)
m.npc('woman', 21, 13, 'woman', '빵집 아주머니', [['bell1', 'v_woman2'], [None, 'v_woman']], wander=True)
m.npc('guard', 15, 18, 'guard', '문지기 한스', [['ch1', 'v_guard2'], [None, 'v_guard']])
m.npc('mir0', 3, 12, 'mir', '낯선 마도사', 'v_mir0', show='p_elder', hide='j_mir')
m.npc('man', 7, 8, 'villager2', '나무꾼 벤', [['bell1', 'v_man2'], [None, 'v_man']], wander=True)
m.event(13, 17, 'v_gate', unless='ch1')
m.event(14, 17, 'v_gate', unless='ch1')
done('village', m, name='여명 마을', theme='village', music='town', entry=dict(x=13, y=17, dir='up'), bg='plains')

# ─────────────────────────────── 고요의 숲 ───────────────────────────────
m = M(36, 32, 'T')
r = random.Random(11)
# 구불구불한 숲길 (아래 → 위)
pts = [(17, 31), (17, 27), (8, 27), (8, 21), (5, 21), (5, 15), (12, 15), (12, 10), (22, 10), (22, 16), (29, 16), (29, 8), (25, 8), (25, 4), (17, 4)]
for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
    for x in range(min(x0, x1) - 1, max(x0, x1) + 2):
        for y in range(min(y0, y1) - 1, max(y0, y1) + 2):
            m.put(x, y, '.')
m.path(pts, ':')
# 빈터
m.rect(13, 1, 21, 6, '.'); m.rect(15, 1, 19, 1, 'T')
m.rect(25, 18, 33, 24, '.')   # 동쪽 빈터 (보물)
m.path([(29, 16), (29, 19)], ':')
m.rect(2, 26, 7, 30, '.')     # 남서 샘터
m.rect(3, 28, 5, 29, '~')
m.rect(1, 10, 6, 13, '.')     # 서쪽 막다른 길
m.path([(5, 15), (5, 13)], ':')
m.scatter('P', 70, 0, 0, 35, 31, 5, on='T')
m.scatter('*', 26, 1, 1, 34, 30, 6)
m.scatter(',', 30, 1, 1, 34, 30, 7)
m.scatter('B', 10, 1, 1, 34, 30, 8, keep={(x, y) for x, y in pts})
# 종 (빈터 위)
m.put(17, 2, 'b')
m.event(17, 2, 'f_bell', check=True)
m.event(17, 6, 'f_boss', unless='boss1')
m.event(16, 6, 'f_boss', unless='boss1')
m.event(18, 6, 'f_boss', unless='boss1')
m.crystal(15, 8)
m.chest('fc1', 2, 11, item='herb', n=3)
m.chest('fc2', 32, 19, gear='spear2')
m.chest('fc3', 6, 27, item='ether', n=1)
m.chest('fc4', 30, 23, gear='ring_pow')
m.chest('fc5', 25, 3, item='feather', n=1)
m.chest('fc6', 9, 22, gold=150)
m.sign(18, 29, '고요의 숲 — 숲의 종은 북쪽 빈터에 있다')
m.npc('hunter', 9, 15, 'villager3', '쓰러진 사냥꾼', 'f_hunter')
m.rect(16, 31, 18, 31, ':')
m.exit(16, 31); m.exit(17, 31); m.exit(18, 31)
m.event(17, 30, 'f_enter', once=True)
done('forest', m, name='고요의 숲', theme='forest', music='field', entry=dict(x=17, y=30, dir='up'), bg='forest',
     enc=dict(rate=[16, 30], table=[['f1a', 3], ['f1b', 3], ['f1c', 2], ['f1d', 3], ['f1e', 2], ['f1f', 2], ['f1g', 2], ['f1h', 1]]),
     safe=[[12, 0, 22, 7]])

# ─────────────────────────────── 모래항 ───────────────────────────────
m = M(30, 20, '.')
m.frame('C')
m.rect(0, 0, 29, 2, '~'); m.rect(1, 3, 28, 3, ',')   # 북쪽 바다
m.rect(12, 1, 17, 3, '+')                             # 부두
m.rect(0, 0, 0, 19, 'C'); m.rect(29, 0, 29, 19, 'C')
m.house(2, 5, 6, 2, (0, 5), kind='inn', price=30, label='선술집 겸 여관')
m.house(10, 5, 5, 2, (4,), kind='shop', shop='s_items', label='항구 잡화점')
m.house(17, 5, 5, 2, (0,), kind='shop', shop='s_gear', label='사막 무구점')
m.house(23, 5, 5, 2, (4,), kind='event', script='s_harbor')
m.house(3, 11, 5, 2, (1,), kind='house', text='「배가 뜨질 않으니 생선도 없고… 황혼이 언제 끝나려나.」')
m.house(21, 11, 6, 3, (1, 5), kind='house', text='「무덤에 들어간 보른네 용병단 말이야, 한 명도 돌아오지 않았대.」')
m.path([(4, 7), (26, 7)]); m.path([(14, 3), (14, 18)], wide=2)
m.path([(4, 13), (13, 13)]); m.path([(22, 13), (16, 13)])
m.scatter('C', 8, 1, 9, 28, 18, 21, keep={(14, y) for y in range(20)} | {(15, y) for y in range(20)})
m.scatter('*', 10, 1, 4, 28, 18, 22)
m.put(10, 9, 'l'); m.put(19, 9, 'l'); m.put(10, 16, 'l'); m.put(19, 16, 'l')
m.rect(14, 19, 15, 19, ':')
m.exit(14, 19); m.exit(15, 19)
m.npc('born0', 6, 8, 'born', '용병 보른', 'p_born', hide='j_born')
m.npc('elda0', 17, 9, 'elda', '사냥꾼 엘다', 'p_elda', hide='j_elda')
m.npc('sailor', 13, 4, 'villager2', '뱃사람', [['bell2', 's_sailor2'], [None, 's_sailor']])
m.npc('merchant', 23, 9, 'merchant', '떠돌이 상인', 's_merchant', wander=True)
m.npc('girl', 8, 15, 'woman3', '물 긷는 아가씨', [['bell2', 's_girl2'], [None, 's_girl']], wander=True)
m.npc('oldman', 25, 16, 'elder', '모래항 노인', 's_oldman')
m.sign(16, 17, '남쪽 — 잊힌 왕의 무덤')
m.event(14, 18, 's_enter', once=True); m.event(15, 18, 's_enter', once=True)
done('sandport', m, name='모래항', theme='desert', music='town2', entry=dict(x=14, y=18, dir='up'), bg='desert')

# ─────────────────────────────── 잊힌 왕의 무덤 ───────────────────────────────
m = M(36, 34, '#')
# 아래: 사막 (모래)
m.rect(1, 22, 34, 33, '.')
m.scatter('C', 22, 1, 22, 34, 32, 31)
m.scatter('R', 8, 1, 22, 34, 32, 32)
m.scatter(',', 30, 1, 22, 34, 32, 33)
m.path([(17, 33), (17, 26), (9, 26), (9, 22)], ':', wide=2)
m.rect(7, 19, 11, 21, '.'); m.put(7, 19, '|'); m.put(11, 19, '|')
# 위: 무덤 안 (방과 복도)
rooms = [(5, 13, 13, 18), (16, 13, 24, 18), (27, 12, 33, 19), (2, 3, 9, 9), (12, 3, 23, 9), (26, 3, 33, 8)]
for x0, y0, x1, y1 in rooms:
    m.rect(x0, y0, x1, y1, '.')
m.path([(9, 18), (9, 22)], '.', wide=2)
m.path([(13, 15), (16, 15)], '.'); m.path([(24, 16), (27, 16)], '.')
m.path([(30, 12), (30, 8)], '.'); m.path([(26, 5), (23, 5)], '.')
m.path([(6, 13), (6, 9)], '.')
m.path([(12, 6), (9, 6)], '.')
for x0, y0, x1, y1 in rooms[:5]:
    m.put(x0 + 1, y0 + 1, '|'); m.put(x1 - 1, y0 + 1, '|')
m.scatter('%', 16, 1, 1, 34, 20, 34)
m.rect(16, 4, 19, 8, '_')
m.put(17, 4, 'b'); m.put(18, 4, 'b')
m.put(18, 4, '|')
m.event(17, 4, 't_bell', check=True)
m.event(17, 9, 't_boss', unless='boss2'); m.event(18, 9, 't_boss', unless='boss2')
m.rect(17, 9, 18, 12, '.'); m.rect(17, 12, 18, 13, '.')
m.crystal(22, 15)
m.chest('tc1', 3, 4, gear='axe3')
m.chest('tc2', 32, 13, gear='staff3')
m.chest('tc3', 32, 4, gear='armor3')
m.chest('tc4', 6, 17, item='remedy', n=2)
m.chest('tc5', 33, 30, gear='bow3')
m.chest('tc6', 2, 31, gear='badge_bp')
m.chest('tc7', 13, 8, item='herb2', n=2)
m.chest('tc8', 28, 18, gold=800)
m.npc('ghostsoldier', 20, 17, 'skeleton', '용병의 망령', 't_ghost', show='j_born', hide='boss2')
m.sign(19, 30, '이 아래 모래의 왕이 잠들다 — 깨우는 자에게 저주를')
m.rect(16, 33, 18, 33, ':')
m.exit(16, 33); m.exit(17, 33); m.exit(18, 33)
m.event(17, 32, 't_enter', once=True)
done('tomb', m, name='잊힌 왕의 무덤', theme='tomb', music='tomb', entry=dict(x=17, y=32, dir='up'), bg='tomb',
     enc=dict(rate=[14, 26], table=[['f2a', 3], ['f2b', 3], ['f2c', 2], ['f2d', 3], ['f2e', 3], ['f2f', 1], ['f2g', 2], ['f2h', 1]]),
     zones=[dict(rect=[0, 22, 35, 33], table=[['f2a', 3], ['f2b', 3], ['f2c', 2]]), dict(rect=[0, 0, 35, 21], table=[['f2d', 3], ['f2e', 3], ['f2f', 1], ['f2g', 2], ['f2h', 1]])],
     safe=[[12, 3, 23, 12]], tintRect=[0, 0, 35, 21])

# ─────────────────────────────── 서리골 ───────────────────────────────
m = M(26, 18, '.')
m.frame('T')
m.scatter('P', 14, 1, 1, 24, 16, 41)
m.rect(2, 2, 23, 15, '.')
m.house(2, 2, 6, 2, (0, 5), kind='inn', price=60, label='주막 「따뜻한 난로」')
m.house(10, 2, 5, 2, (4,), kind='shop', shop='f_items', label='설원 잡화')
m.house(17, 2, 6, 3, (0, 5), kind='shop', shop='f_gear', label='대장간')
m.house(3, 9, 5, 2, (0,), kind='event', script='r_lukahouse')
m.house(18, 9, 6, 2, (0, 5), kind='house', text='「아들이 잠든 채 깨어나질 않아요. 몸은 따뜻한데…」')
m.path([(4, 4), (21, 4)]); m.path([(12, 4), (12, 17)], wide=2)
m.path([(5, 11), (5, 13), (12, 13)]); m.path([(20, 11), (20, 13), (13, 13)])
m.rect(9, 7, 15, 9, ',')
m.put(12, 8, 'R')
m.scatter('*', 8, 1, 1, 24, 16, 42)
m.put(9, 6, 'l'); m.put(16, 6, 'l')
m.rect(12, 17, 13, 17, ':')
m.exit(12, 17); m.exit(13, 17)
m.npc('hazel0', 6, 5, 'hazel', '무희 하젤', 'r_hazel', hide='j_hazel')
m.npc('snowkid', 15, 8, 'child2', '눈사람 만드는 아이', [['bell3', 'r_kid2'], [None, 'r_kid']], wander=True)
m.npc('smith', 20, 6, 'villager3', '대장장이', 'r_smith')
m.npc('granny', 9, 12, 'elder', '서리골 할머니', [['bell3', 'r_granny2'], [None, 'r_granny']])
m.sign(10, 15, '북쪽 동굴 — 서리 비룡의 둥지. 들어가지 마시오')
m.event(12, 16, 'r_enter', once=True); m.event(13, 16, 'r_enter', once=True)
done('frostvale', m, name='서리골', theme='snow', music='town3', entry=dict(x=12, y=16, dir='up'), bg='snow')

# ─────────────────────────────── 빙하 동굴 ───────────────────────────────
m = M(36, 34, '#')
m.rect(1, 24, 34, 33, '.')
m.scatter('P', 26, 1, 24, 34, 32, 51)
m.scatter('R', 6, 1, 24, 34, 32, 52)
m.path([(17, 33), (17, 28), (26, 28), (26, 23)], ':', wide=2)
caves = [(22, 17, 30, 22), (12, 15, 20, 21), (3, 14, 9, 22), (3, 4, 10, 10), (13, 3, 24, 9), (26, 5, 33, 12)]
for x0, y0, x1, y1 in caves:
    m.rect(x0, y0, x1, y1, '.')
m.path([(26, 22), (26, 23)], '.', wide=2)
m.path([(22, 19), (20, 19)], '.'); m.path([(12, 18), (9, 18)], '.')
m.path([(6, 14), (6, 10)], '.'); m.path([(10, 7), (13, 7)], '.')
m.path([(24, 6), (26, 6)], '.'); m.path([(30, 12), (30, 17)], '.')
m.rect(14, 14, 15, 14, '~'); m.rect(4, 19, 5, 20, '~'); m.rect(28, 8, 29, 9, '~')
m.scatter(',', 40, 1, 1, 34, 23, 53)
m.scatter('R', 8, 1, 1, 34, 23, 54)
m.rect(16, 3, 21, 5, '.')
m.put(18, 3, 'b'); m.put(19, 3, '|')
m.event(18, 3, 'i_bell', check=True)
m.event(17, 8, 'i_boss', unless='boss3'); m.event(18, 8, 'i_boss', unless='boss3'); m.event(19, 8, 'i_boss', unless='boss3')
m.crystal(21, 20)
m.chest('ic1', 4, 5, gear='spear4')
m.chest('ic2', 32, 6, gear='robe4')
m.chest('ic3', 4, 21, item='herb2', n=3)
m.chest('ic4', 33, 32, gear='gem_latent')
m.chest('ic5', 13, 16, item='ether2', n=1)
m.chest('ic6', 33, 11, gear='dagger4')
m.chest('ic7', 2, 32, item='feather', n=2)
m.chest('ic8', 9, 4, gold=2000)
m.sign(19, 31, '빙하 동굴 — 얼음이 우는 소리가 들린다')
m.rect(16, 33, 18, 33, ':')
m.exit(16, 33); m.exit(17, 33); m.exit(18, 33)
m.event(17, 32, 'i_enter', once=True)
done('icecave', m, name='빙하 동굴', theme='ice', music='cave', entry=dict(x=17, y=32, dir='up'), bg='ice',
     enc=dict(rate=[14, 26], table=[['f3a', 3], ['f3b', 3], ['f3c', 3], ['f3d', 2], ['f3e', 1], ['f3f', 2], ['f3g', 1]]),
     zones=[dict(rect=[0, 24, 35, 33], table=[['f3a', 3], ['f3c', 3], ['f3b', 1]]), dict(rect=[0, 0, 35, 23], table=[['f3b', 3], ['f3d', 3], ['f3e', 1], ['f3f', 2], ['f3g', 2]])],
     safe=[[15, 2, 22, 9]], tintRect=[0, 0, 35, 23])

# ─────────────────────────────── 안개성 ───────────────────────────────
m = M(30, 22, '.')
m.frame('P')
m.scatter('P', 16, 1, 1, 28, 20, 61)
m.rect(2, 2, 27, 19, '.')
m.rect(10, 1, 19, 3, '#'); m.rect(10, 1, 19, 1, '^'); m.put(14, 3, 'o'); m.put(15, 3, 'o')
m.doors.append(dict(x=14, y=3, kind='event', script='c_castle'))
m.doors.append(dict(x=15, y=3, kind='event', script='c_castle'))
m.put(10, 4, '|'); m.put(19, 4, '|')
m.house(2, 6, 6, 2, (0, 5), kind='inn', price=100, label='안개 여관')
m.house(21, 6, 6, 3, (0, 5), kind='shop', shop='c_items', label='연금 약방')
m.house(2, 13, 6, 3, (1, 5), kind='shop', shop='c_gear', label='왕실 무기고')
m.house(21, 13, 6, 2, (0, 4), kind='house', text='「탑에서 내려오는 안개를 마시면 사람들이 잠들어요. 문을 꼭 닫으세요.」')
m.path([(14, 4), (14, 21)], wide=2)
m.path([(4, 8), (27, 8)]); m.path([(5, 15), (24, 15)]); m.path([(23, 8), (23, 9)])
m.rect(7, 10, 9, 11, '~'); m.rect(20, 10, 22, 11, '~')
m.rect(5, 18, 9, 20, '~'); m.rect(20, 18, 24, 20, '~')
m.scatter('*', 10, 1, 1, 28, 20, 62)
m.put(12, 5, 'l'); m.put(17, 5, 'l'); m.put(12, 18, 'l'); m.put(17, 18, 'l')
m.exit(14, 21); m.exit(15, 21)
m.npc('knight0', 16, 5, 'guard', '안개성 기사', [['bell4', 'c_knight2'], [None, 'c_knight']])
m.npc('scholar', 9, 9, 'villager2', '왕실 학자', 'c_scholar', wander=True)
m.npc('nun', 19, 16, 'nun', '수녀', [['bell4', 'c_nun2'], [None, 'c_nun']], wander=True)
m.npc('boy', 11, 17, 'child', '심부름하는 소년', 'c_boy', wander=True)
m.sign(16, 20, '동쪽 늪 너머 — 마도의 탑')
m.event(14, 20, 'c_enter', once=True); m.event(15, 20, 'c_enter', once=True)
done('mistcastle', m, name='안개성', theme='swamp', music='town4', entry=dict(x=14, y=20, dir='up'), bg='swamp')

# ─────────────────────────────── 마도의 탑 ───────────────────────────────
m = M(34, 32, '#')
halls = [(13, 25, 20, 30), (3, 22, 11, 29), (22, 22, 30, 29), (3, 12, 11, 19), (22, 12, 30, 19), (13, 14, 20, 20), (8, 3, 25, 9)]
for x0, y0, x1, y1 in halls:
    m.rect(x0, y0, x1, y1, '.')
m.path([(13, 27), (11, 27)], '.'); m.path([(20, 27), (22, 27)], '.')
m.path([(6, 22), (6, 19)], '.'); m.path([(27, 22), (27, 19)], '.')
m.path([(11, 15), (13, 15)], '.'); m.path([(20, 15), (22, 15)], '.')
m.path([(6, 12), (6, 9), (8, 9)], '.'); m.path([(27, 12), (27, 9), (25, 9)], '.')
m.rect(14, 21, 19, 24, '#')  # 가운데 막힘 — 돌아가야 한다
m.rect(13, 3, 20, 7, '_')
for x0, y0, x1, y1 in halls:
    m.put(x0, y0, '|'); m.put(x1, y0, '|')
m.scatter('%', 10, 1, 1, 32, 30, 71)
m.put(16, 4, 'b'); m.put(17, 4, '|')
m.event(16, 4, 'm_bell', check=True)
m.event(15, 9, 'm_boss', unless='boss4'); m.event(16, 9, 'm_boss', unless='boss4'); m.event(17, 9, 'm_boss', unless='boss4')
m.path([(16, 9), (16, 14)], '.', wide=2)
m.crystal(19, 16)
m.chest('mc1', 4, 13, gear='sword4')
m.chest('mc2', 29, 13, gear='staff4')
m.chest('mc3', 4, 28, gear='armor5')
m.chest('mc4', 29, 28, gear='bow4')
m.chest('mc5', 9, 4, gear='ring_crit')
m.chest('mc6', 24, 4, item='ether2', n=2)
m.chest('mc7', 14, 15, gear='axe4')
m.chest('mc8', 29, 23, gear='robe5')
m.rect(16, 31, 17, 31, '.')
m.exit(16, 31); m.exit(17, 31)
m.event(16, 30, 'm_enter', once=True); m.event(17, 30, 'm_enter', once=True)
done('magetower', m, name='마도의 탑', theme='tower', music='tower', entry=dict(x=16, y=30, dir='up'), bg='tower',
     enc=dict(rate=[13, 24], table=[['f4a', 3], ['f4b', 3], ['f4c', 3], ['f4d', 3], ['f4e', 2], ['f4f', 1], ['f4g', 2]]),
     safe=[[8, 3, 25, 10]])

# ─────────────────────────────── 황혼의 탑 ───────────────────────────────
m = M(30, 36, '#')
floors = [(11, 30, 18, 34), (3, 25, 26, 28), (3, 18, 8, 24), (21, 18, 26, 24), (8, 14, 21, 18), (12, 8, 17, 13), (9, 2, 20, 7)]
for x0, y0, x1, y1 in floors:
    m.rect(x0, y0, x1, y1, '.')
for x0, y0, x1, y1 in floors:
    m.put(x0, y0, '|'); m.put(x1, y0, '|')
m.path([(14, 28), (14, 30)], '.', wide=2)
m.rect(10, 26, 19, 27, '~')
m.path([(5, 24), (5, 25)], '.'); m.path([(24, 24), (24, 25)], '.')
m.path([(7, 19), (9, 19), (9, 18)], '.'); m.path([(22, 19), (20, 19), (20, 18)], '.')
m.path([(14, 13), (14, 14)], '.', wide=2)
m.path([(14, 7), (14, 8)], '.', wide=2)
m.rect(12, 2, 17, 5, '_')
m.put(14, 3, 'b'); m.put(15, 3, 'b')
m.crystal(16, 10)
m.event(14, 7, 'd_boss', unless='boss5'); m.event(15, 7, 'd_boss', unless='boss5')
m.chest('dc1', 4, 19, gear='sword5')
m.chest('dc2', 25, 19, gear='staff5')
m.chest('dc3', 4, 27, gear='axe5')
m.chest('dc4', 25, 27, gear='bow5')
m.chest('dc5', 9, 15, gear='spear5')
m.chest('dc6', 20, 15, gear='dagger5')
m.chest('dc7', 12, 33, gear='armor6')
m.chest('dc8', 17, 33, item='elixir', n=2)
m.chest('dc9', 13, 9, gear='neck_star')
m.chest('dc10', 25, 23, gear='ring_sage')
m.chest('dc11', 4, 23, item='bpfruit', n=2)
m.rect(14, 35, 15, 35, '.')
m.exit(14, 35); m.exit(15, 35)
m.event(14, 34, 'd_enter', once=True); m.event(15, 34, 'd_enter', once=True)
done('dusktower', m, name='황혼의 탑', theme='dusk', music='dusk', entry=dict(x=14, y=34, dir='up'), bg='dusk',
     enc=dict(rate=[13, 24], table=[['f5a', 3], ['f5b', 3], ['f5c', 2], ['f5d', 3], ['f5e', 1], ['f5f', 2]]),
     safe=[[9, 0, 20, 13]])

# ─────────────────────────────── 내보내기 ───────────────────────────────
ok = True
out = {}
for id, (m, meta) in MAPS.items():
    ok &= check(id, m, meta['entry'])
    out[id] = dict(meta, w=m.w, h=m.h, tiles=m.rows(), npcs=m.npcs, doors=m.doors, chests=m.chests,
                   signs=m.signs, events=m.events, crystals=m.crystals, exits=m.exits)
js = "'use strict';\n/* 여명의 종 — 맵 자료. tools/dawn_maps.py 가 만든다(직접 고치지 말고 그 파일을 고친 뒤 다시 실행). */\nconst MAPS = " + \
     json.dumps(out, ensure_ascii=False, separators=(',', ':')).replace('],"', '],\n"').replace('},"', '},\n"') + ';\n'
open(os.path.join(ROOT, 'dawn', 'js', 'maps.js'), 'w', encoding='utf8').write(js)
print('maps:', ', '.join(f'{k} {v[0].w}x{v[0].h}' for k, v in MAPS.items()), '' if ok else '— 문제 있음')

if '--png' in sys.argv:
    from PIL import Image
    d = sys.argv[sys.argv.index('--png') + 1]
    os.makedirs(d, exist_ok=True)
    C = {'.': (120, 170, 90), ',': (100, 150, 80), ':': (190, 160, 110), '*': (230, 150, 200), '%': (140, 120, 100), '_': (170, 50, 60),
         '~': (60, 110, 200), '+': (150, 110, 70), 'T': (30, 90, 40), 'P': (20, 70, 40), 'C': (80, 160, 70), 'B': (60, 130, 60), 'R': (130, 130, 140),
         '#': (60, 55, 70), '|': (200, 200, 210), '=': (150, 110, 60), '^': (170, 70, 60), 'H': (210, 190, 150), 'n': (240, 220, 120), 'o': (120, 70, 40),
         'b': (255, 210, 60), 'l': (255, 255, 160), 'c': (255, 170, 0), 'x': (180, 120, 255), 's': (160, 120, 80)}
    for id, (m, meta) in MAPS.items():
        S = 8
        im = Image.new('RGB', (m.w * S, m.h * S))
        for y in range(m.h):
            for x in range(m.w):
                col = C.get(m.g[y][x], (255, 0, 255))
                for dy in range(S):
                    for dx in range(S):
                        im.putpixel((x * S + dx, y * S + dy), col)
        for n in m.npcs:
            for dy in range(2, 6):
                for dx in range(2, 6):
                    im.putpixel((n['x'] * S + dx, n['y'] * S + dy), (255, 255, 255))
        for e in m.exits:
            for dx in range(S):
                im.putpixel((e['x'] * S + dx, e['y'] * S + S - 1), (255, 0, 0))
        im.save(os.path.join(d, id + '.png'))
