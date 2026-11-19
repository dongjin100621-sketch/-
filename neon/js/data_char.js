'use strict';
/* ────────────────────────────────────────────────────────────
   능력치 5종 · 특성 30종 · 스킬 15종
   레벨이 오를 때마다 능력치 포인트 1, 특성 포인트 1을 얻는다.
   능력치를 올리면 그 계열의 특성과 스킬이 열리고, 특성 포인트로 해금한다.
   ──────────────────────────────────────────────────────────── */
const ATTRS = [
  { k: 'body',   n: '신체', en: 'BODY',   c: '#ff4f6d', d: '체력 +18, 둔기·사이버 암·샷건 피해 +2.5%' },
  { k: 'reflex', n: '반사', en: 'REFLEX', c: '#3ee8ff', d: '치명타 확률 +1%, 이동 속도 +1%, 검·SMG 피해 +2.5%' },
  { k: 'tech',   n: '기술', en: 'TECH',   c: '#ffd23e', d: '방어력 +3, 재사용 대기 -1%, 런처 피해 +2.5%, 회복 아이템 +2%' },
  { k: 'intel',  n: '지능', en: 'INTEL',  c: '#7c6bff', d: '최대 RAM +6, RAM 회복 +4%, 스킬 피해 +3%, 와이어 피해 +2.5%' },
  { k: 'cool',   n: '침착', en: 'COOL',   c: '#d9e8ff', d: '치명타 피해 +3%, 치명타 확률 +0.5%, 권총·소총·저격총 피해 +2.5%' },
];
const ATTR_MAX = 20;
const LEVEL_MAX = 40;
const expNeed = (lv) => Math.round(50 + 26 * Math.pow(lv, 1.62));

/* 특성: req = 필요한 능력치 수치 */
const PERKS = [
  { id: 'p_tough',    a: 'body', req: 4,  n: '강인한 육체', d: '최대 체력 +15%' },
  { id: 'p_iron',     a: 'body', req: 6,  n: '철권',       d: '근접 피해 +15%' },
  { id: 'p_regen',    a: 'body', req: 9,  n: '재생',       d: '초당 최대 체력의 0.6% 회복' },
  { id: 'p_undying',  a: 'body', req: 12, n: '불굴',       d: '치명적인 피해를 받아도 체력 1로 버팀 (90초마다)' },
  { id: 'p_predator', a: 'body', req: 15, n: '포식자',     d: '적을 처치하면 체력 5% 회복' },
  { id: 'p_colossus', a: 'body', req: 18, n: '거신',       d: '받는 피해 -15%, 넉백 무시' },

  { id: 'p_agile',    a: 'reflex', req: 4,  n: '민첩',     d: '이동 속도 +10%' },
  { id: 'p_dance',    a: 'reflex', req: 6,  n: '칼날 춤',  d: '검 피해 +15%, 공격 속도 +10%' },
  { id: 'p_djump',    a: 'reflex', req: 9,  n: '이단 점프', d: '공중에서 한 번 더 점프' },
  { id: 'p_counter',  a: 'reflex', req: 12, n: '반격 태세', d: '회피 대시 후 3초 동안 치명타 확률 +30%' },
  { id: 'p_finisher', a: 'reflex', req: 15, n: '마무리 일격', d: '근접 연속 공격의 마지막 타격 피해 +60%' },
  { id: 'p_afterimg', a: 'reflex', req: 18, n: '잔상',     d: '모든 공격을 12% 확률로 회피' },

  { id: 'p_engineer', a: 'tech', req: 4,  n: '공학자',     d: '방어력 +20%' },
  { id: 'p_medic',    a: 'tech', req: 6,  n: '응급 처치 개량', d: '회복 아이템 효과 +30%' },
  { id: 'p_cooling',  a: 'tech', req: 9,  n: '냉각 회로',  d: '모든 스킬 재사용 대기 -12%' },
  { id: 'p_demo',     a: 'tech', req: 12, n: '폭발 전문가', d: '폭발 피해 +35%, 폭발 범위 +25%' },
  { id: 'p_repair',   a: 'tech', req: 15, n: '수리 드론',  d: '5초마다 체력 3% 회복' },
  { id: 'p_overload', a: 'tech', req: 18, n: '과충전',     d: '스킬 피해 +25%' },

  { id: 'p_ramup',    a: 'intel', req: 4,  n: '램 확장',   d: '최대 RAM +25%' },
  { id: 'p_ramflow',  a: 'intel', req: 6,  n: '램 순환',   d: 'RAM 회복 +35%' },
  { id: 'p_chain',    a: 'intel', req: 9,  n: '연쇄 해킹', d: '지능 스킬이 근처 적 하나에게 옮겨 감' },
  { id: 'p_firewall', a: 'intel', req: 12, n: '방화벽',    d: 'RAM이 절반 이상이면 받는 피해 -12%' },
  { id: 'p_absorb',   a: 'intel', req: 15, n: '데이터 흡수', d: '적을 처치하면 RAM 8 회복' },
  { id: 'p_erosion',  a: 'intel', req: 18, n: '신경 침식', d: '해킹당한 적이 받는 피해 +20%' },

  { id: 'p_cold',     a: 'cool', req: 4,  n: '냉철함',   d: '치명타 확률 +8%' },
  { id: 'p_marksman', a: 'cool', req: 6,  n: '사수',     d: '원거리 피해 +15%' },
  { id: 'p_assassin', a: 'cool', req: 9,  n: '암살',     d: '체력이 가득 찬 적에게 피해 +40%' },
  { id: 'p_coldblood',a: 'cool', req: 12, n: '냉혈',     d: '처치할 때마다 6초 동안 피해 +4% (최대 5중첩)' },
  { id: 'p_headhunt', a: 'cool', req: 15, n: '헤드헌터', d: '치명타 피해 +35%' },
  { id: 'p_executor', a: 'cool', req: 18, n: '집행자',   d: '체력 25% 이하 적에게 피해 +50%' },
];

/* 스킬: slot = atk(공격 스킬) / util(범용 스킬) / ult(필살기)
   mult = 공격력 배율, cd = 재사용 대기(초), ram = 필요한 RAM. 필살기는 필살 게이지 100이 필요하다. */
const SKILLS = [
  { id: 's_slam',     a: 'body',   req: 5,  slot: 'atk',  n: '충격파 강타',  icon: '✊', c: '#ff4f6d', cd: 6,  ram: 12, mult: 2.4, d: '땅을 내려쳐 앞쪽 넓은 범위에 충격파를 일으키고 적을 띄운다.' },
  { id: 's_adren',    a: 'body',   req: 9,  slot: 'util', n: '아드레날린',   icon: '♥', c: '#ff4f6d', cd: 18, ram: 15, d: '3초에 걸쳐 체력 25% 회복, 5초 동안 받는 피해 -30%.' },
  { id: 's_berserk',  a: 'body',   req: 14, slot: 'ult',  n: '광전사',       icon: '☠', c: '#ff2a4a', cd: 3,  ram: 0,  d: '10초 동안 공격력 +60%, 공격 속도 +40%, 흡혈 8%.' },

  { id: 's_flash',    a: 'reflex', req: 3,  slot: 'atk',  n: '섬광 베기',    icon: '⚡', c: '#3ee8ff', cd: 5,  ram: 8,  mult: 1.9, start: true, d: '앞으로 순식간에 돌진하며 길 위의 모든 적을 벤다.' },
  { id: 's_dodge',    a: 'reflex', req: 3,  slot: 'util', n: '회피 대시',    icon: '»', c: '#3ee8ff', cd: 2.5, ram: 4, start: true, d: '짧게 돌진한다. 돌진하는 동안 무적.' },
  { id: 's_chrono',   a: 'reflex', req: 12, slot: 'ult',  n: '크로노 가속',  icon: '◷', c: '#3ee8ff', cd: 3,  ram: 0,  d: '6초 동안 주변의 시간이 느려진다. 카이만 원래 속도로 움직인다.' },

  { id: 's_grenade',  a: 'tech',   req: 5,  slot: 'atk',  n: '플라즈마 수류탄', icon: '◎', c: '#ffd23e', cd: 7,  ram: 10, mult: 2.8, d: '포물선으로 수류탄을 던져 넓은 범위에 폭발을 일으킨다.' },
  { id: 's_shield',   a: 'tech',   req: 9,  slot: 'util', n: '나노 방어막',  icon: '⬡', c: '#ffd23e', cd: 20, ram: 15, d: '6초 동안 최대 체력 35%만큼 피해를 흡수하는 방어막.' },
  { id: 's_orbital',  a: 'tech',   req: 14, slot: 'ult',  n: '궤도 포격',    icon: '☄', c: '#ffb02e', cd: 3,  ram: 0,  mult: 4.2, d: '하늘에서 레이저 여섯 줄기가 차례로 내리꽂힌다.' },

  { id: 's_overheat', a: 'intel',  req: 5,  slot: 'atk',  n: '과열',         icon: '♨', c: '#7c6bff', cd: 6,  ram: 18, mult: 3.2, d: '가장 가까운 적의 회로를 과열시켜 4초 동안 불태운다.' },
  { id: 's_reset',    a: 'intel',  req: 9,  slot: 'util', n: '시스템 리셋',  icon: '⏻', c: '#7c6bff', cd: 16, ram: 28, d: '화면의 모든 적을 2초 동안 멈춘다. (보스는 0.6초)' },
  { id: 's_synapse',  a: 'intel',  req: 14, slot: 'ult',  n: '시냅스 소각',  icon: '✺', c: '#a07cff', cd: 3,  ram: 0,  mult: 5.0, d: '화면의 모든 적에게 큰 피해. 체력 30% 이하인 적에게는 두 배.' },

  { id: 's_snipe',    a: 'cool',   req: 5,  slot: 'atk',  n: '정밀 사격',    icon: '➶', c: '#d9e8ff', cd: 5,  ram: 8,  mult: 3.0, d: '적을 꿰뚫는 한 발. 치명타 확률 +30%.' },
  { id: 's_cloak',    a: 'cool',   req: 9,  slot: 'util', n: '광학 위장',    icon: '◌', c: '#d9e8ff', cd: 18, ram: 15, d: '4초 동안 모습을 감춘다. 적이 공격하지 않고, 다음 공격은 반드시 치명타.' },
  { id: 's_deadeye',  a: 'cool',   req: 14, slot: 'ult',  n: '데드아이',     icon: '◉', c: '#ffffff', cd: 3,  ram: 0,  mult: 4.6, d: '적을 최대 여섯 명까지 표시하고 한 명씩 정확히 쏜다.' },
];
const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
const PERK = Object.fromEntries(PERKS.map((p) => [p.id, p]));
const SLOT_NAME = { atk: '공격 스킬', util: '범용 스킬', ult: '필살기' };
