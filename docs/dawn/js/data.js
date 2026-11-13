'use strict';
/* 여명의 종 — 게임 자료: 일행, 기술, 적, 아이템, 장비.
   DOM 을 쓰지 않아 node 에서도 읽힌다 (tools/dawn_sim.js 의 전투 시뮬레이션). */

/* 공격 종류: 무기 6종 + 속성 6종. 적은 이 가운데 몇 개에 약하다. */
const WEAPON_TYPES = ['sword', 'spear', 'dagger', 'axe', 'bow', 'staff'];
const ELEMENT_TYPES = ['fire', 'ice', 'thunder', 'wind', 'light', 'dark'];
const ALL_TYPES = [...WEAPON_TYPES, ...ELEMENT_TYPES];
const TYPE_NAME = {
  sword: '검', spear: '창', dagger: '단검', axe: '도끼', bow: '활', staff: '지팡이',
  fire: '불', ice: '얼음', thunder: '번개', wind: '바람', light: '빛', dark: '어둠'
};
const STAT_NAME = { hp: 'HP', sp: 'SP', patk: '물리 공격', matk: '마법 공격', pdef: '물리 방어', mdef: '마법 방어', spd: '속도', crit: '치명' };
const BUFF_NAME = { patk: '물공', matk: '마공', pdef: '물방', mdef: '마방', spd: '속도' };
const STATUS_NAME = { poison: '독', blind: '실명', sleep: '수면' };

/* 다음 레벨까지 필요한 경험치 */
const expToNext = (lv) => Math.round(18 * Math.pow(lv, 1.7) + 30);
const MAX_LEVEL = 50;

/* ── 일행 8명 ──
   base: 1레벨 능력치, grow: 레벨당 증가. skills: [기술, 배우는 레벨] */
const HEROES = {
  rian: {
    name: '리안', job: '검사', spr: 'rian', color: '#4796dc', weapons: ['sword', 'spear'],
    base: { hp: 240, sp: 30, patk: 36, matk: 15, pdef: 30, mdef: 18, spd: 24, crit: 6 },
    grow: { hp: 30, sp: 2.2, patk: 3.6, matk: 1.3, pdef: 3.0, mdef: 1.8, spd: 1.4 },
    latent: 'valor', joinLv: 1,
    equip: { weapon: 'sword1', armor: 'armor1', acc: null },
    skills: [['r_sweep', 1], ['r_pierce', 1], ['r_double', 5], ['r_guard', 9], ['r_whirl', 14], ['r_rally', 19], ['r_radiant', 25], ['r_sky', 32]],
    bio: '여명 마을 종지기의 견습생. 멈춰 버린 종을 다시 울리겠다고 길을 나섰다. 검과 창을 쓴다.'
  },
  seira: {
    name: '세이라', job: '신관', spr: 'seira', color: '#ffd447', weapons: ['staff'],
    base: { hp: 190, sp: 44, patk: 20, matk: 34, pdef: 20, mdef: 30, spd: 22, crit: 4 },
    grow: { hp: 23, sp: 3.4, patk: 1.6, matk: 3.4, pdef: 2.0, mdef: 3.0, spd: 1.3 },
    latent: 'grace', joinLv: 1,
    equip: { weapon: 'staff1', armor: 'robe1', acc: null },
    skills: [['s_heal', 1], ['s_holy', 1], ['s_rain', 5], ['s_ward', 8], ['s_revive', 11], ['s_holyrain', 16], ['s_purify', 21], ['s_angel', 29]],
    bio: '여명 마을 성당의 젊은 신관. 종소리가 그친 날부터 아이들이 깨어나지 않는 병을 앓고 있다.'
  },
  kyle: {
    name: '카일', job: '도적', spr: 'kyle', color: '#56b048', weapons: ['dagger', 'bow'],
    base: { hp: 210, sp: 30, patk: 33, matk: 22, pdef: 23, mdef: 20, spd: 32, crit: 12 },
    grow: { hp: 25, sp: 2.4, patk: 3.2, matk: 2.0, pdef: 2.3, mdef: 2.0, spd: 1.9 },
    latent: 'twice', joinLv: 2,
    equip: { weapon: 'dagger1', armor: 'armor1', acc: null },
    skills: [['k_twin', 1], ['k_gale', 1], ['k_steal', 3], ['k_venom', 7], ['k_haste', 11], ['k_cyclone', 15], ['k_shadow', 22], ['k_storm', 30]],
    bio: '종탑의 청동 장식을 훔치러 왔다가 일행에 붙은 떠돌이 도적. 말이 많지만 손은 더 빠르다.'
  },
  mir: {
    name: '미르', job: '마도사', spr: 'mir', color: '#9c66dc', weapons: ['staff'],
    base: { hp: 175, sp: 48, patk: 17, matk: 38, pdef: 18, mdef: 32, spd: 25, crit: 4 },
    grow: { hp: 21, sp: 3.6, patk: 1.3, matk: 3.8, pdef: 1.8, mdef: 3.1, spd: 1.4 },
    latent: 'surge', joinLv: 2,
    equip: { weapon: 'staff1', armor: 'robe1', acc: null },
    skills: [['m_fire', 1], ['m_ice', 1], ['m_bolt', 3], ['m_fireall', 7], ['m_iceall', 9], ['m_boltall', 11], ['m_focus', 14], ['m_inferno', 20], ['m_zero', 23], ['m_judge', 30]],
    bio: '왕립 학술원에서 종의 공명을 연구하는 마도사. 할머니 말투를 흉내 내지만 아직 열일곱이다.'
  },
  born: {
    name: '보른', job: '용병', spr: 'born', color: '#e0503f', weapons: ['axe', 'sword'],
    base: { hp: 290, sp: 26, patk: 40, matk: 12, pdef: 32, mdef: 15, spd: 19, crit: 8 },
    grow: { hp: 35, sp: 1.9, patk: 3.9, matk: 1.0, pdef: 3.2, mdef: 1.5, spd: 1.2 },
    latent: 'berserk', joinLv: 9,
    equip: { weapon: 'axe2', armor: 'armor2', acc: null },
    skills: [['b_crush', 1], ['b_cleave', 1], ['b_quake', 13], ['b_roar', 15], ['b_last', 19], ['b_wall', 23], ['b_giant', 31]],
    bio: '모래항에서 고용된 무덤 탐사의 호위. 돈 얘기만 하지만, 부하를 잃은 무덤에 다시 들어가려는 이유가 따로 있다.'
  },
  elda: {
    name: '엘다', job: '사냥꾼', spr: 'elda', color: '#2a6e38', weapons: ['bow', 'spear'],
    base: { hp: 215, sp: 32, patk: 35, matk: 20, pdef: 24, mdef: 21, spd: 29, crit: 10 },
    grow: { hp: 26, sp: 2.4, patk: 3.5, matk: 1.8, pdef: 2.4, mdef: 2.0, spd: 1.7 },
    latent: 'hawk', joinLv: 9,
    equip: { weapon: 'bow2', armor: 'armor2', acc: null },
    skills: [['e_volley', 1], ['e_frost', 1], ['e_scan', 1], ['e_rain', 13], ['e_mark', 16], ['e_blizzard', 21], ['e_star', 29]],
    bio: '사막 너머 설원에서 내려온 사냥꾼. 짐승이 이상하게 사나워진 까닭을 쫓고 있다.'
  },
  hazel: {
    name: '하젤', job: '무희', spr: 'hazel', color: '#e286c4', weapons: ['dagger'],
    base: { hp: 200, sp: 40, patk: 30, matk: 30, pdef: 21, mdef: 26, spd: 33, crit: 9 },
    grow: { hp: 24, sp: 3.0, patk: 2.8, matk: 2.9, pdef: 2.1, mdef: 2.6, spd: 2.0 },
    latent: 'encore', joinLv: 17,
    equip: { weapon: 'dagger3', armor: 'robe2', acc: null },
    skills: [['h_blade', 1], ['h_flame', 1], ['h_cheer', 1], ['h_swift', 19], ['h_charm', 19], ['h_tango', 22], ['h_song', 25], ['h_crimson', 31]],
    bio: '서리골 주막에서 춤추는 유랑 무희. 불꽃 같은 춤으로 사람들의 언 마음을 녹인다.'
  },
  luka: {
    name: '루카', job: '연금술사', spr: 'luka', color: '#3fb0a6', weapons: ['spear'],
    base: { hp: 220, sp: 38, patk: 31, matk: 33, pdef: 25, mdef: 25, spd: 23, crit: 6 },
    grow: { hp: 27, sp: 2.9, patk: 2.9, matk: 3.1, pdef: 2.5, mdef: 2.5, spd: 1.4 },
    latent: 'catalyst', joinLv: 17,
    equip: { weapon: 'spear3', armor: 'armor3', acc: null },
    skills: [['l_stab', 1], ['l_dark', 1], ['l_spark', 1], ['l_aid', 1], ['l_hex', 20], ['l_mist', 22], ['l_leech', 25], ['l_life', 27], ['l_black', 32]],
    bio: '마도의 탑에서 쫓겨난 연금술사. 탑의 주인이 무엇을 만들고 있는지 알고 있다.'
  }
};
const HERO_ORDER = ['rian', 'seira', 'kyle', 'mir', 'born', 'elda', 'hazel', 'luka'];

/* ── 잠재력: 게이지가 가득 차면 한 번 쓸 수 있는 고유 능력 ── */
const LATENTS = {
  valor:    { name: '용기의 검', desc: '이번 턴의 공격은 약점이 아니어도 실드를 깎고, 반드시 치명타가 된다.' },
  grace:    { name: '축복의 기도', desc: '이번 턴 기술에 SP가 들지 않고, 아군 하나에게 쓰는 기술이 아군 전체로 퍼진다.' },
  twice:    { name: '그림자 걸음', desc: '이번 턴에 두 번 행동한다.' },
  surge:    { name: '마력 폭주', desc: '이번 턴의 마법이 적 전체를 노리고 위력이 1.5배가 된다.' },
  berserk:  { name: '광전사의 피', desc: 'BP가 가득 차고(5), 이번 턴엔 부스트를 5까지 쓸 수 있다.' },
  hawk:     { name: '매의 눈', desc: '모든 적의 약점을 드러내고, 이번 턴엔 실드를 두 배로 깎는다.' },
  encore:   { name: '앙코르', desc: '고른 아군이 하젤의 행동이 끝난 뒤 바로 한 번 더 행동한다.' },
  catalyst: { name: '만능 촉매', desc: '이번 턴에 쓰는 아이템의 효과가 두 배가 되고, 같은 편 전체에 퍼진다.' }
};

/* ── 기술 ──
   kind: phys(물리 공격력) | mag(마법 공격력) | heal | buff | debuff | special
   type: 약점 판정에 쓰는 종류 (무기 또는 속성)
   target: enemy | enemies | random | ally | allies | self | ko(쓰러진 아군)
   boost: hits(부스트마다 1타 추가) | power(위력 증가) | turns(지속 +1) | none */
const SKILLS = {
  /* 리안 */
  r_sweep:   { name: '횡베기', sp: 7, kind: 'phys', type: 'sword', power: 75, target: 'enemies', boost: 'power', desc: '적 전체를 검으로 벤다.' },
  r_pierce:  { name: '꿰뚫기', sp: 6, kind: 'phys', type: 'spear', power: 150, target: 'enemy', boost: 'power', desc: '적 하나를 창으로 깊게 찌른다.' },
  r_double:  { name: '연속 베기', sp: 10, kind: 'phys', type: 'sword', power: 70, hits: 2, target: 'enemy', boost: 'hits', desc: '적 하나를 검으로 두 번 벤다. 부스트마다 1타 추가.' },
  r_guard:   { name: '수호 태세', sp: 10, kind: 'buff', target: 'self', boost: 'turns', turns: 2, taunt: true, buffs: { pdef: 1 }, desc: '적의 공격을 끌어들이고 물리 방어를 올린다.' },
  r_whirl:   { name: '창 회오리', sp: 18, kind: 'phys', type: 'spear', power: 60, hits: 2, target: 'enemies', boost: 'hits', desc: '적 전체를 창으로 두 번 휩쓴다.' },
  r_rally:   { name: '투지의 함성', sp: 16, kind: 'buff', target: 'allies', boost: 'turns', turns: 2, buffs: { patk: 1 }, desc: '아군 전체의 물리 공격을 올린다.' },
  r_radiant: { name: '광휘의 일섬', sp: 30, kind: 'phys', type: 'light', power: 240, target: 'enemy', boost: 'power', desc: '빛을 두른 검으로 적 하나를 벤다(빛 속성).' },
  r_sky:     { name: '천공의 창', sp: 34, kind: 'phys', type: 'spear', power: 75, hits: 4, target: 'random', boost: 'hits', desc: '무작위 적에게 창을 네 번 내리꽂는다.' },
  /* 세이라 */
  s_heal:    { name: '치유의 빛', sp: 6, kind: 'heal', power: 100, target: 'ally', boost: 'power', desc: '아군 하나의 HP를 회복한다.' },
  s_holy:    { name: '성광', sp: 7, kind: 'mag', type: 'light', power: 130, target: 'enemy', boost: 'power', desc: '적 하나에게 빛 마법.' },
  s_rain:    { name: '축복의 비', sp: 15, kind: 'heal', power: 60, target: 'allies', boost: 'power', desc: '아군 전체의 HP를 회복한다.' },
  s_ward:    { name: '빛의 장막', sp: 10, kind: 'buff', target: 'allies', boost: 'turns', turns: 2, buffs: { mdef: 1 }, desc: '아군 전체의 마법 방어를 올린다.' },
  s_revive:  { name: '소생', sp: 18, kind: 'heal', target: 'ko', boost: 'power', revive: 0.3, desc: '쓰러진 아군을 HP 30%로 일으킨다. 부스트마다 +20%.' },
  s_holyrain:{ name: '성광의 비', sp: 20, kind: 'mag', type: 'light', power: 95, target: 'enemies', boost: 'power', desc: '적 전체에게 빛 마법.' },
  s_purify:  { name: '정화', sp: 8, kind: 'heal', power: 30, target: 'allies', boost: 'power', cure: true, desc: '아군 전체의 상태 이상을 고치고 조금 회복한다.' },
  s_angel:   { name: '천사의 노래', sp: 40, kind: 'heal', power: 110, target: 'allies', boost: 'power', regen: 3, desc: '아군 전체를 크게 회복하고 3턴 동안 재생시킨다.' },
  /* 카일 */
  k_twin:    { name: '이중 찌르기', sp: 6, kind: 'phys', type: 'dagger', power: 65, hits: 2, target: 'enemy', boost: 'hits', desc: '적 하나를 단검으로 두 번 찌른다.' },
  k_gale:    { name: '질풍', sp: 7, kind: 'mag', type: 'wind', power: 130, target: 'enemy', boost: 'power', desc: '적 하나에게 바람 마법.' },
  k_steal:   { name: '훔치기', sp: 3, kind: 'special', target: 'enemy', boost: 'power', steal: true, desc: '적의 물건을 훔친다. 부스트하면 성공률이 오른다.' },
  k_venom:   { name: '독칼', sp: 8, kind: 'phys', type: 'dagger', power: 100, target: 'enemy', boost: 'power', status: ['poison', 0.7], desc: '단검으로 베고 독에 빠뜨린다.' },
  k_haste:   { name: '속도 강탈', sp: 10, kind: 'debuff', target: 'enemy', boost: 'turns', turns: 2, debuffs: { spd: -1 }, selfBuffs: { spd: 1 }, desc: '적의 속도를 빼앗아 자신의 속도를 올린다.' },
  k_cyclone: { name: '회오리', sp: 18, kind: 'mag', type: 'wind', power: 95, target: 'enemies', boost: 'power', desc: '적 전체에게 바람 마법.' },
  k_shadow:  { name: '그림자 난도', sp: 24, kind: 'phys', type: 'dagger', power: 50, hits: 5, target: 'random', boost: 'hits', desc: '무작위 적에게 단검을 다섯 번 휘두른다.' },
  k_storm:   { name: '폭풍', sp: 36, kind: 'mag', type: 'wind', power: 170, target: 'enemies', boost: 'power', desc: '적 전체에게 강한 바람 마법.' },
  /* 미르 */
  m_fire:    { name: '화염', sp: 7, kind: 'mag', type: 'fire', power: 130, target: 'enemy', boost: 'power', desc: '적 하나에게 불 마법.' },
  m_ice:     { name: '빙결', sp: 7, kind: 'mag', type: 'ice', power: 130, target: 'enemy', boost: 'power', desc: '적 하나에게 얼음 마법.' },
  m_bolt:    { name: '번개', sp: 7, kind: 'mag', type: 'thunder', power: 130, target: 'enemy', boost: 'power', desc: '적 하나에게 번개 마법.' },
  m_fireall: { name: '화염 폭풍', sp: 17, kind: 'mag', type: 'fire', power: 95, target: 'enemies', boost: 'power', desc: '적 전체에게 불 마법.' },
  m_iceall:  { name: '눈보라', sp: 17, kind: 'mag', type: 'ice', power: 95, target: 'enemies', boost: 'power', desc: '적 전체에게 얼음 마법.' },
  m_boltall: { name: '뇌운', sp: 17, kind: 'mag', type: 'thunder', power: 95, target: 'enemies', boost: 'power', desc: '적 전체에게 번개 마법.' },
  m_focus:   { name: '마력 집중', sp: 4, kind: 'buff', target: 'self', boost: 'turns', turns: 3, buffs: { matk: 1 }, spGain: 12, desc: '자신의 마법 공격을 올리고 SP를 조금 되찾는다.' },
  m_inferno: { name: '대화염', sp: 30, kind: 'mag', type: 'fire', power: 270, target: 'enemy', boost: 'power', desc: '적 하나를 거대한 불길로 태운다.' },
  m_zero:    { name: '절대영도', sp: 30, kind: 'mag', type: 'ice', power: 270, target: 'enemy', boost: 'power', desc: '적 하나를 얼려 부순다.' },
  m_judge:   { name: '천뢰', sp: 42, kind: 'mag', type: 'thunder', power: 170, target: 'enemies', boost: 'power', desc: '적 전체에 하늘의 번개를 내린다.' },
  /* 보른 */
  b_crush:   { name: '갑옷 부수기', sp: 9, kind: 'phys', type: 'axe', power: 120, target: 'enemy', boost: 'power', debuffs: { pdef: -1 }, turns: 2, desc: '도끼로 내리찍어 적의 물리 방어를 낮춘다.' },
  b_cleave:  { name: '휘둘러 베기', sp: 8, kind: 'phys', type: 'sword', power: 80, target: 'enemies', boost: 'power', desc: '적 전체를 검으로 휘둘러 벤다.' },
  b_quake:   { name: '대지 가르기', sp: 18, kind: 'phys', type: 'axe', power: 110, target: 'enemies', boost: 'power', desc: '도끼로 땅을 갈라 적 전체를 친다.' },
  b_roar:    { name: '전투의 함성', sp: 8, kind: 'buff', target: 'self', boost: 'turns', turns: 3, buffs: { patk: 1 }, bpGain: 1, desc: '자신의 물리 공격을 올리고 BP를 1 얻는다.' },
  b_last:    { name: '결사의 일격', sp: 16, kind: 'phys', type: 'axe', power: 110, target: 'enemy', boost: 'power', desperate: true, desc: '잃은 HP가 많을수록 강해지는 일격(최대 3배).' },
  b_wall:    { name: '철벽', sp: 14, kind: 'buff', target: 'allies', boost: 'turns', turns: 2, buffs: { pdef: 1 }, desc: '아군 전체의 물리 방어를 올린다.' },
  b_giant:   { name: '거인 쪼개기', sp: 32, kind: 'phys', type: 'axe', power: 95, hits: 3, target: 'enemy', boost: 'hits', desc: '적 하나에게 도끼를 세 번 내리친다.' },
  /* 엘다 */
  e_volley:  { name: '연사', sp: 8, kind: 'phys', type: 'bow', power: 50, hits: 3, target: 'random', boost: 'hits', desc: '무작위 적에게 화살을 세 발 쏜다.' },
  e_frost:   { name: '서리 화살', sp: 8, kind: 'phys', type: 'ice', power: 140, target: 'enemy', boost: 'power', desc: '얼음을 두른 화살(얼음 속성).' },
  e_scan:    { name: '약점 간파', sp: 3, kind: 'special', target: 'enemy', boost: 'power', reveal: 2, desc: '적 하나의 약점을 둘 드러낸다. 부스트마다 하나 더.' },
  e_rain:    { name: '화살비', sp: 18, kind: 'phys', type: 'bow', power: 55, hits: 2, target: 'enemies', boost: 'hits', desc: '적 전체에 화살을 두 번 퍼붓는다.' },
  e_mark:    { name: '사냥 표식', sp: 12, kind: 'debuff', target: 'enemy', boost: 'turns', turns: 2, debuffs: { pdef: -1, mdef: -1 }, desc: '적의 물리·마법 방어를 낮춘다.' },
  e_blizzard:{ name: '얼음 화살비', sp: 22, kind: 'phys', type: 'ice', power: 110, target: 'enemies', boost: 'power', desc: '적 전체에 얼음 화살(얼음 속성).' },
  e_star:    { name: '천궁', sp: 32, kind: 'phys', type: 'bow', power: 60, hits: 5, target: 'enemy', boost: 'hits', desc: '적 하나에게 화살을 다섯 발 꽂는다.' },
  /* 하젤 */
  h_blade:   { name: '칼춤', sp: 7, kind: 'phys', type: 'dagger', power: 50, hits: 3, target: 'random', boost: 'hits', desc: '무작위 적을 단검으로 세 번 벤다.' },
  h_flame:   { name: '불꽃 춤', sp: 12, kind: 'mag', type: 'fire', power: 85, target: 'enemies', boost: 'power', desc: '적 전체에게 불 마법.' },
  h_cheer:   { name: '응원', sp: 10, kind: 'special', target: 'ally', boost: 'power', bpGive: 1, notSelf: true, desc: '다른 아군 하나에게 BP를 1 준다. 부스트마다 +1.' },
  h_swift:   { name: '신속의 춤', sp: 14, kind: 'buff', target: 'allies', boost: 'turns', turns: 2, buffs: { spd: 1 }, desc: '아군 전체의 속도를 올린다.' },
  h_charm:   { name: '매혹의 춤', sp: 12, kind: 'debuff', target: 'enemy', boost: 'turns', turns: 2, debuffs: { patk: -1, matk: -1 }, desc: '적의 물리·마법 공격을 낮춘다.' },
  h_tango:   { name: '정열의 탱고', sp: 22, kind: 'buff', target: 'allies', boost: 'turns', turns: 2, buffs: { patk: 1, matk: 1 }, desc: '아군 전체의 물리·마법 공격을 올린다.' },
  h_song:    { name: '회복의 노래', sp: 16, kind: 'heal', power: 50, target: 'allies', boost: 'power', cure: true, desc: '아군 전체를 회복하고 상태 이상을 고친다.' },
  h_crimson: { name: '홍련의 무도', sp: 38, kind: 'mag', type: 'fire', power: 85, hits: 2, target: 'enemies', boost: 'hits', desc: '적 전체를 불꽃으로 두 번 휘감는다.' },
  /* 루카 */
  l_stab:    { name: '독 찌르기', sp: 7, kind: 'phys', type: 'spear', power: 110, target: 'enemy', boost: 'power', status: ['poison', 0.5], desc: '독 바른 창으로 찌른다.' },
  l_dark:    { name: '암흑구', sp: 7, kind: 'mag', type: 'dark', power: 130, target: 'enemy', boost: 'power', desc: '적 하나에게 어둠 마법.' },
  l_spark:   { name: '전격 촉매', sp: 7, kind: 'mag', type: 'thunder', power: 125, target: 'enemy', boost: 'power', desc: '촉매를 터뜨려 번개를 일으킨다.' },
  l_aid:     { name: '응급 조제', sp: 6, kind: 'heal', power: 75, target: 'ally', boost: 'power', cure: true, desc: '아군 하나를 회복하고 상태 이상을 고친다.' },
  l_hex:     { name: '저주', sp: 12, kind: 'debuff', target: 'enemy', boost: 'turns', turns: 2, debuffs: { mdef: -1 }, status: ['blind', 0.6], desc: '적의 마법 방어를 낮추고 실명시킨다.' },
  l_mist:    { name: '어둠의 안개', sp: 18, kind: 'mag', type: 'dark', power: 95, target: 'enemies', boost: 'power', status: ['blind', 0.3], desc: '적 전체에게 어둠 마법. 가끔 실명.' },
  l_leech:   { name: '흡혈의 창', sp: 14, kind: 'phys', type: 'spear', power: 150, target: 'enemy', boost: 'power', drain: 0.4, desc: '준 피해의 40%만큼 HP를 빨아들인다.' },
  l_life:    { name: '생명 연성', sp: 24, kind: 'heal', target: 'ko', boost: 'power', revive: 0.5, desc: '쓰러진 아군을 HP 50%로 일으킨다.' },
  l_black:   { name: '흑염', sp: 38, kind: 'mag', type: 'dark', power: 170, target: 'enemies', boost: 'power', desc: '적 전체를 검은 불꽃으로 태운다.' }
};

/* ── 아이템 ── */
const ITEMS = {
  herb:    { name: '약초', price: 30, icon: 'potion_green', target: 'ally', heal: 220, desc: 'HP를 220 회복한다.' },
  herb2:   { name: '고급 약초', price: 140, icon: 'potion_green', target: 'ally', heal: 650, desc: 'HP를 650 회복한다.' },
  herb3:   { name: '신록의 잎', price: 420, icon: 'potion_gold', target: 'ally', heal: 1600, desc: 'HP를 1600 회복한다.' },
  ether:   { name: '마력수', price: 180, icon: 'potion_blue', target: 'ally', spHeal: 40, desc: 'SP를 40 회복한다.' },
  ether2:  { name: '상급 마력수', price: 560, icon: 'potion_blue', target: 'ally', spHeal: 120, desc: 'SP를 120 회복한다.' },
  feather: { name: '불사조 깃털', price: 300, icon: 'scroll_red', target: 'ko', revive: 0.5, desc: '쓰러진 아군을 HP 50%로 일으킨다.' },
  antidote:{ name: '해독초', price: 20, icon: 'mushroom', target: 'ally', cure: ['poison'], desc: '독을 고친다.' },
  remedy:  { name: '만병 물약', price: 90, icon: 'potion', target: 'ally', cure: ['poison', 'blind', 'sleep'], desc: '상태 이상을 모두 고친다.' },
  elixir:  { name: '여명의 영약', price: 0, icon: 'potion_gold', target: 'ally', heal: 99999, spHeal: 9999, desc: 'HP와 SP를 모두 회복한다. 팔지 않는다.' },
  bpfruit: { name: '용기의 열매', price: 0, icon: 'ember', target: 'ally', bp: 2, desc: 'BP를 2 얻는다. 팔지 않는다.' },
  fire1:   { name: '화염석', price: 120, icon: 'fireball', target: 'enemy', dmg: 260, type: 'fire', desc: '적 하나에게 불 피해 260.' },
  ice1:    { name: '빙결석', price: 120, icon: 'bolt', target: 'enemy', dmg: 260, type: 'ice', desc: '적 하나에게 얼음 피해 260.' },
  thunder1:{ name: '뇌전석', price: 120, icon: 'crystal_gold', target: 'enemy', dmg: 260, type: 'thunder', desc: '적 하나에게 번개 피해 260.' },
  wind1:   { name: '질풍석', price: 120, icon: 'grass', target: 'enemy', dmg: 260, type: 'wind', desc: '적 하나에게 바람 피해 260.' },
  light1:  { name: '성광석', price: 120, icon: 'ember', target: 'enemy', dmg: 260, type: 'light', desc: '적 하나에게 빛 피해 260.' },
  dark1:   { name: '암흑석', price: 120, icon: 'shadowball', target: 'enemy', dmg: 260, type: 'dark', desc: '적 하나에게 어둠 피해 260.' },
  fire2:   { name: '화염 결정', price: 520, icon: 'fireball', target: 'enemies', dmg: 700, type: 'fire', desc: '적 전체에게 불 피해 700.' },
  ice2:    { name: '빙결 결정', price: 520, icon: 'bolt', target: 'enemies', dmg: 700, type: 'ice', desc: '적 전체에게 얼음 피해 700.' },
  thunder2:{ name: '뇌전 결정', price: 520, icon: 'crystal_gold', target: 'enemies', dmg: 700, type: 'thunder', desc: '적 전체에게 번개 피해 700.' },
  wind2:   { name: '질풍 결정', price: 520, icon: 'grass', target: 'enemies', dmg: 700, type: 'wind', desc: '적 전체에게 바람 피해 700.' },
  light2:  { name: '성광 결정', price: 520, icon: 'ember', target: 'enemies', dmg: 700, type: 'light', desc: '적 전체에게 빛 피해 700.' },
  dark2:   { name: '암흑 결정', price: 520, icon: 'shadowball', target: 'enemies', dmg: 700, type: 'dark', desc: '적 전체에게 어둠 피해 700.' }
};

/* ── 장비 ── slot: weapon(type 필요) | armor | acc */
const EQUIP = {
  sword1: { name: '청동검', slot: 'weapon', type: 'sword', price: 80, patk: 10 },
  sword2: { name: '강철검', slot: 'weapon', type: 'sword', price: 420, patk: 22 },
  sword3: { name: '기사검', slot: 'weapon', type: 'sword', price: 1300, patk: 38 },
  sword4: { name: '미스릴검', slot: 'weapon', type: 'sword', price: 3600, patk: 58 },
  sword5: { grade: 'good', name: '여명의 검', slot: 'weapon', type: 'sword', price: 0, patk: 84, crit: 5 },
  spear1: { name: '나무창', slot: 'weapon', type: 'spear', price: 80, patk: 10 },
  spear2: { name: '강철창', slot: 'weapon', type: 'spear', price: 420, patk: 23 },
  spear3: { name: '기사창', slot: 'weapon', type: 'spear', price: 1300, patk: 39 },
  spear4: { name: '미스릴창', slot: 'weapon', type: 'spear', price: 3600, patk: 59 },
  spear5: { grade: 'good', name: '새벽별 창', slot: 'weapon', type: 'spear', price: 0, patk: 85 },
  dagger1:{ name: '청동 단검', slot: 'weapon', type: 'dagger', price: 70, patk: 8, spd: 2, crit: 3 },
  dagger2:{ name: '강철 단검', slot: 'weapon', type: 'dagger', price: 380, patk: 19, spd: 3, crit: 4 },
  dagger3:{ name: '은빛 단검', slot: 'weapon', type: 'dagger', price: 1200, patk: 33, spd: 5, crit: 5 },
  dagger4:{ name: '미스릴 단검', slot: 'weapon', type: 'dagger', price: 3400, patk: 51, spd: 6, crit: 6 },
  dagger5:{ grade: 'good', name: '바람칼', slot: 'weapon', type: 'dagger', price: 0, patk: 76, spd: 10, crit: 8 },
  axe1:   { name: '손도끼', slot: 'weapon', type: 'axe', price: 90, patk: 12, spd: -1 },
  axe2:   { name: '전투 도끼', slot: 'weapon', type: 'axe', price: 460, patk: 26, spd: -2 },
  axe3:   { name: '양날 도끼', slot: 'weapon', type: 'axe', price: 1400, patk: 43, spd: -2 },
  axe4:   { name: '미스릴 도끼', slot: 'weapon', type: 'axe', price: 3800, patk: 64, spd: -3 },
  axe5:   { grade: 'good', name: '거인의 도끼', slot: 'weapon', type: 'axe', price: 0, patk: 92, spd: -3 },
  bow1:   { name: '단궁', slot: 'weapon', type: 'bow', price: 80, patk: 9, spd: 1 },
  bow2:   { name: '장궁', slot: 'weapon', type: 'bow', price: 400, patk: 21, spd: 1 },
  bow3:   { name: '사냥꾼의 활', slot: 'weapon', type: 'bow', price: 1250, patk: 36, spd: 2, crit: 3 },
  bow4:   { name: '미스릴 활', slot: 'weapon', type: 'bow', price: 3500, patk: 55, spd: 3 },
  bow5:   { grade: 'good', name: '별빛 활', slot: 'weapon', type: 'bow', price: 0, patk: 80, spd: 4, crit: 5 },
  staff1: { name: '떡갈나무 지팡이', slot: 'weapon', type: 'staff', price: 80, patk: 4, matk: 10 },
  staff2: { name: '마법 지팡이', slot: 'weapon', type: 'staff', price: 420, patk: 8, matk: 22 },
  staff3: { name: '수정 지팡이', slot: 'weapon', type: 'staff', price: 1300, patk: 14, matk: 38, sp: 10 },
  staff4: { name: '현자의 지팡이', slot: 'weapon', type: 'staff', price: 3600, patk: 20, matk: 58, sp: 20 },
  staff5: { grade: 'good', name: '여명의 지팡이', slot: 'weapon', type: 'staff', price: 0, patk: 28, matk: 84, sp: 30 },

  armor1: { name: '여행자 옷', slot: 'armor', price: 60, pdef: 7, mdef: 4 },
  armor2: { name: '가죽 갑옷', slot: 'armor', price: 360, pdef: 16, mdef: 9 },
  armor3: { name: '사슬 갑옷', slot: 'armor', price: 1100, pdef: 28, mdef: 16 },
  armor4: { name: '기사 갑옷', slot: 'armor', price: 3000, pdef: 44, mdef: 27 },
  armor5: { name: '미스릴 갑옷', slot: 'armor', price: 6400, pdef: 62, mdef: 40 },
  armor6: { grade: 'good', name: '여명의 갑옷', slot: 'armor', price: 0, pdef: 82, mdef: 58 },
  robe1:  { name: '견습 로브', slot: 'armor', price: 60, pdef: 4, mdef: 8 },
  robe2:  { name: '마도 로브', slot: 'armor', price: 360, pdef: 9, mdef: 18 },
  robe3:  { name: '현자 로브', slot: 'armor', price: 1100, pdef: 16, mdef: 30 },
  robe4:  { name: '별의 로브', slot: 'armor', price: 3000, pdef: 26, mdef: 46 },
  robe5:  { name: '월광 로브', slot: 'armor', price: 6400, pdef: 38, mdef: 64 },

  ring_pow:  { name: '힘의 반지', slot: 'acc', price: 600, patk: 12, desc: '물리 공격 +12' },
  ring_mag:  { name: '마력의 반지', slot: 'acc', price: 600, matk: 12, desc: '마법 공격 +12' },
  charm_def: { name: '수호의 부적', slot: 'acc', price: 600, pdef: 14, desc: '물리 방어 +14' },
  charm_mdef:{ name: '신비의 부적', slot: 'acc', price: 600, mdef: 14, desc: '마법 방어 +14' },
  feather_spd:{ name: '질풍의 깃', slot: 'acc', price: 900, spd: 8, desc: '속도 +8' },
  neck_life: { name: '생명의 목걸이', slot: 'acc', price: 900, hp: 200, desc: '최대 HP +200' },
  badge_bp:  { name: '용기의 휘장', slot: 'acc', price: 1500, startBp: 1, desc: '전투를 BP 2로 시작한다' },
  charm_poison:{ name: '독막이 부적', slot: 'acc', price: 400, immune: ['poison'], desc: '독에 걸리지 않는다' },
  ring_crit: { name: '회심의 반지', slot: 'acc', price: 1200, crit: 15, desc: '치명타 +15%' },
  gem_latent:{ grade: 'good', name: '각성의 보석', slot: 'acc', price: 0, latentUp: 0.6, desc: '잠재력이 1.6배 빨리 찬다' },
  neck_star: { grade: 'good', name: '별의 목걸이', slot: 'acc', price: 0, patk: 10, matk: 10, pdef: 10, mdef: 10, spd: 5, desc: '모든 능력 상승' },
  ring_sage: { grade: 'good', name: '현자의 반지', slot: 'acc', price: 0, sp: 40, matk: 8, desc: '최대 SP +40, 마법 공격 +8' },

  /* ── 낡은 장비: 기본보다 약하다. 적이 떨어뜨리거나 상자에서 나온다 ── */
  sword_w1: { name: '녹슨 검', grade: 'worn', slot: 'weapon', type: 'sword', price: 30, patk: 7 },
  spear_w1: { name: '금 간 창', grade: 'worn', slot: 'weapon', type: 'spear', price: 30, patk: 7 },
  dagger_w1:{ name: '무뎌진 단검', grade: 'worn', slot: 'weapon', type: 'dagger', price: 25, patk: 6, spd: 1, crit: 2 },
  axe_w1:   { name: '이 빠진 손도끼', grade: 'worn', slot: 'weapon', type: 'axe', price: 35, patk: 9, spd: -1 },
  bow_w1:   { name: '시위 늘어진 활', grade: 'worn', slot: 'weapon', type: 'bow', price: 30, patk: 6, spd: 1 },
  staff_w1: { name: '갈라진 지팡이', grade: 'worn', slot: 'weapon', type: 'staff', price: 30, patk: 3, matk: 7 },
  armor_w1: { name: '해진 옷', grade: 'worn', slot: 'armor', price: 20, pdef: 5, mdef: 3 },
  robe_w1:  { name: '해진 로브', grade: 'worn', slot: 'armor', price: 20, pdef: 3, mdef: 6 },
  sword_w3: { name: '녹슨 기사검', grade: 'worn', slot: 'weapon', type: 'sword', price: 400, patk: 28 },
  bow_w3:   { name: '휘어진 사냥꾼 활', grade: 'worn', slot: 'weapon', type: 'bow', price: 380, patk: 26, spd: 1 },
  armor_w3: { name: '구멍 난 사슬 갑옷', grade: 'worn', slot: 'armor', price: 330, pdef: 20, mdef: 11 },
  staff_w3: { name: '빛바랜 수정 지팡이', grade: 'worn', slot: 'weapon', type: 'staff', price: 400, patk: 10, matk: 28, sp: 5 },
  axe_w4:   { name: '녹슨 미스릴 도끼', grade: 'worn', slot: 'weapon', type: 'axe', price: 1100, patk: 46, spd: -3 },
  armor_w4: { name: '찌그러진 기사 갑옷', grade: 'worn', slot: 'armor', price: 900, pdef: 32, mdef: 19 },
  /* 낡았지만 무언가 깃든 장비 — awaken 조건을 채우면 유물로 깨어난다(팔 수 없다). grow: 레벨마다 붙는 능력치 */
  seed_sword: { name: '녹슨 종지기의 검', grade: 'worn', slot: 'weapon', type: 'sword', price: 0, patk: 4, grow: { patk: 1.3 }, awaken: { into: 'relic_bellsword', kind: 'breaks', n: 30 } },
  seed_bow:   { name: '금 간 사냥꾼의 활', grade: 'worn', slot: 'weapon', type: 'bow', price: 0, patk: 3, spd: 1, grow: { patk: 1.2 }, awaken: { into: 'relic_windbow', kind: 'kills', n: 50 } },
  seed_axe:   { name: '이 빠진 용병 도끼', grade: 'worn', slot: 'weapon', type: 'axe', price: 0, patk: 6, spd: -2, grow: { patk: 1.5 }, awaken: { into: 'relic_axe', kind: 'maxhit', n: 6000 } },
  seed_robe:  { name: '해진 순례자 로브', grade: 'worn', slot: 'armor', price: 0, pdef: 4, mdef: 6, grow: { pdef: 0.6, mdef: 1.0 }, awaken: { into: 'relic_saintrobe', kind: 'heal', n: 10000 } },
  seed_ring:  { name: '빛바랜 은반지', grade: 'worn', slot: 'acc', price: 0, spd: 2, awaken: { into: 'relic_moonring', kind: 'rare', n: 3 } },
  seed_staff: { name: '갈라진 현자의 지팡이', grade: 'worn', slot: 'weapon', type: 'staff', price: 0, patk: 4, matk: 6, sp: 5, grow: { matk: 1.4 }, awaken: { into: 'relic_timestaff', kind: 'skills', n: 80 } },

  /* ── 쓸만한 장비: 같은 단계의 기본보다 조금 강하고 덤 능력이 붙는다. 던전·들판 상자, 드문 전리품 ── */
  spear_g2: { name: '사냥꾼의 강철창', grade: 'good', slot: 'weapon', type: 'spear', price: 520, patk: 26, spd: 2 },
  dagger_g2:{ name: '날렵한 강철 단검', grade: 'good', slot: 'weapon', type: 'dagger', price: 480, patk: 21, spd: 5, crit: 6 },
  armor_g2: { name: '덧댄 가죽 갑옷', grade: 'good', slot: 'armor', price: 450, pdef: 19, mdef: 11, hp: 40 },
  ring_g1:  { name: '행운의 동전', grade: 'good', slot: 'acc', price: 400, spd: 2, crit: 6 },
  sword_g3: { name: '기사단장의 검', grade: 'good', slot: 'weapon', type: 'sword', price: 1600, patk: 43, crit: 3 },
  axe_g3:   { name: '용병단의 양날 도끼', grade: 'good', slot: 'weapon', type: 'axe', price: 1700, patk: 48, spd: -1, crit: 3 },
  bow_g3:   { name: '모래바람 활', grade: 'good', slot: 'weapon', type: 'bow', price: 1550, patk: 40, spd: 3, crit: 4 },
  staff_g3: { name: '사막 현자의 지팡이', grade: 'good', slot: 'weapon', type: 'staff', price: 1600, patk: 15, matk: 42, sp: 15 },
  armor_g3: { name: '왕실 사슬 갑옷', grade: 'good', slot: 'armor', price: 1400, pdef: 32, mdef: 19, hp: 80 },
  spear_g4: { name: '빙결 미스릴창', grade: 'good', slot: 'weapon', type: 'spear', price: 4300, patk: 64, spd: 2 },
  dagger_g4:{ name: '서리 송곳', grade: 'good', slot: 'weapon', type: 'dagger', price: 4100, patk: 56, spd: 8, crit: 8 },
  sword_g4: { name: '마도 기사의 검', grade: 'good', slot: 'weapon', type: 'sword', price: 4300, patk: 64, crit: 4 },
  axe_g4:   { name: '거룡 미스릴 도끼', grade: 'good', slot: 'weapon', type: 'axe', price: 4500, patk: 70, spd: -2 },
  bow_g4:   { name: '정령 미스릴 활', grade: 'good', slot: 'weapon', type: 'bow', price: 4200, patk: 60, spd: 4, crit: 4 },
  staff_g4: { name: '별빛 현자의 지팡이', grade: 'good', slot: 'weapon', type: 'staff', price: 4300, patk: 22, matk: 64, sp: 25 },
  robe_g4:  { name: '오로라 로브', grade: 'good', slot: 'armor', price: 3600, pdef: 29, mdef: 52, sp: 15 },
  armor_g5: { name: '마도 기사의 갑옷', grade: 'good', slot: 'armor', price: 7600, pdef: 68, mdef: 44, hp: 120 },
  robe_g5:  { name: '달그림자 로브', grade: 'good', slot: 'armor', price: 7600, pdef: 42, mdef: 70, sp: 20 },

  /* ── 유물: 세상에 하나뿐. 맵마다 숨겨진 상자, 또는 낡은 장비가 깨어나서만 얻는다(팔 수 없다).
     무기·방어구는 주인의 레벨에 맞춰 강해지고(grow), 저마다 고유한 힘(note)이 있다 ── */
  relic_bell:     { name: '종지기의 손종', grade: 'relic', slot: 'acc', price: 0, partyExp: 0.25, note: '착용자가 살아서 이기면 일행 모두 경험치 +25%' },
  relic_wreath:   { name: '들꽃 화관', grade: 'relic', slot: 'acc', price: 0, hp: 150, regen: 0.04, note: '라운드가 끝날 때 HP 4% 회복' },
  relic_forestspear: { name: '숲지기의 창', grade: 'relic', slot: 'weapon', type: 'spear', price: 0, spd: 2, grow: { patk: 2.4 }, alt: ['wind'], note: '일반 공격이 바람 약점도 찌른다' },
  relic_compass:  { name: '선장의 나침반', grade: 'relic', slot: 'acc', price: 0, spd: 4, goldUp: 0.5, note: '착용자가 살아서 이기면 얻는 골드 +50%' },
  relic_kingdagger: { name: '모래 왕의 단검', grade: 'relic', slot: 'weapon', type: 'dagger', price: 0, spd: 6, crit: 10, grow: { patk: 2.1 }, drain: 0.08, note: '준 피해의 8%만큼 HP 회복' },
  relic_mirage:   { name: '신기루 망토', grade: 'relic', slot: 'armor', price: 0, grow: { pdef: 1.5, mdef: 1.5 }, evade: 0.12, note: '물리 공격을 12% 확률로 피한다' },
  relic_hearth:   { name: '난롯불 부적', grade: 'relic', slot: 'acc', price: 0, mdef: 12, immune: ['poison', 'sleep', 'blind'], note: '독·잠·어둠에 걸리지 않는다' },
  relic_wyrmmail: { name: '빙룡 비늘 갑옷', grade: 'relic', slot: 'armor', price: 0, hp: 150, grow: { pdef: 2.0, mdef: 1.5 }, resist: ['ice', 'fire'], note: '얼음·불꽃 피해 절반' },
  relic_snowbow:  { name: '설원의 활', grade: 'relic', slot: 'weapon', type: 'bow', price: 0, spd: 4, crit: 8, grow: { patk: 2.3 }, alt: ['ice'], note: '일반 공격이 얼음 약점도 찌른다' },
  relic_tiara:    { name: '왕녀의 티아라', grade: 'relic', slot: 'acc', price: 0, matk: 12, sp: 30, spCost: 0.75, note: '기술 SP 소모 25% 감소' },
  relic_morgastaff: { name: '모르가의 지팡이', grade: 'relic', slot: 'weapon', type: 'staff', price: 0, sp: 20, grow: { patk: 0.6, matk: 2.4 }, magUp: 0.2, note: '마법 피해 +20%' },
  relic_lantern:  { name: '망자의 등불', grade: 'relic', slot: 'acc', price: 0, hp: 100, autoRevive: 0.3, note: '전투마다 한 번, 쓰러지면 HP 30%로 일어난다' },
  relic_duskcrown:{ name: '황혼의 왕관', grade: 'relic', slot: 'acc', price: 0, bpUp: 1, note: '라운드마다 BP를 1 더 얻는다(부스트한 뒤에도)' },
  relic_bellsword:{ name: '새벽종의 검', grade: 'relic', slot: 'weapon', type: 'sword', price: 0, crit: 5, grow: { patk: 2.5 }, alt: ['light'], note: '일반 공격이 빛 약점도 찌른다' },
  relic_windbow:  { name: '바람길 활', grade: 'relic', slot: 'weapon', type: 'bow', price: 0, spd: 6, grow: { patk: 2.2 }, hitsUp: 1, note: '일반 공격 타수 +1' },
  relic_axe:      { name: '불굴의 도끼', grade: 'relic', slot: 'weapon', type: 'axe', price: 0, spd: -2, grow: { patk: 2.7 }, breakDmg: 0.3, note: '브레이크된 적에게 주는 피해 +30%' },
  relic_saintrobe:{ name: '성녀의 옷', grade: 'relic', slot: 'armor', price: 0, sp: 20, grow: { pdef: 1.1, mdef: 1.9 }, regen: 0.05, note: '라운드가 끝날 때 HP 5% 회복' },
  relic_moonring: { name: '달빛 반지', grade: 'relic', slot: 'acc', price: 0, spd: 8, noFlee: true, note: '전열에 있으면 적이 달아나지 못한다' },
  relic_timestaff:{ name: '시간의 지팡이', grade: 'relic', slot: 'weapon', type: 'staff', price: 0, sp: 30, grow: { patk: 0.7, matk: 2.5 }, spCost: 0.5, note: '기술 SP 소모 절반' }
};

/* ── 장비 등급 ──
   낡은: 기본보다 약하다. 적이 떨어뜨리거나 상자에서 나온다. 몇몇(awaken)은 조건을 채우면 유물로 깨어난다.
   기본: 상점에서 파는 보통 장비(등급을 적지 않으면 기본).
   쓸만한: 같은 단계의 기본보다 강하고 덤 능력이 붙는다. 던전·들판 상자와 드문 전리품.
   유물: 하나뿐인 장비. 맵마다 숨겨진 상자나 낡은 장비가 깨어나서만 얻는다. */
const GRADES = {
  worn:  { name: '낡은', order: 0 },
  basic: { name: '기본', order: 1 },
  good:  { name: '쓸만한', order: 2 },
  relic: { name: '유물', order: 3 }
};
const gradeOf = (id) => (EQUIP[id] && EQUIP[id].grade) || 'basic';
/* 깨어남 조건 설명 */
const AWAKEN_TEXT = {
  breaks: (n) => `이 장비를 든 사람이 적을 ${n}번 브레이크하면`,
  kills:  (n) => `이 장비를 든 사람이 적을 ${n}번 쓰러뜨리면`,
  maxhit: (n) => `이 장비를 든 사람이 한 번에 ${n.toLocaleString()} 이상의 피해를 주면`,
  heal:   (n) => `이 장비를 입은 사람이 기술로 HP를 모두 ${n.toLocaleString()} 회복시키면`,
  rare:   (n) => `이 장비를 낀 채 드문 금속빛 적을 ${n}번 쓰러뜨리면`,
  skills: (n) => `이 장비를 든 사람이 기술을 ${n}번 쓰면`
};

/* ── 적의 행동 ── */
const ENEMY_ACTS = {
  attack:   { name: '공격', kind: 'phys', power: 100, target: 'one' },
  bite:     { name: '물어뜯기', kind: 'phys', power: 125, target: 'one' },
  claw:     { name: '할퀴기', kind: 'phys', power: 75, hits: 2, target: 'one' },
  venom:    { name: '독니', kind: 'phys', power: 85, target: 'one', status: ['poison', 0.5] },
  sting:    { name: '독침', kind: 'phys', power: 110, target: 'one', status: ['poison', 0.6] },
  tackle:   { name: '몸통 박치기', kind: 'phys', power: 145, target: 'one' },
  smash:    { name: '내려치기', kind: 'phys', power: 175, target: 'one' },
  sweep:    { name: '휩쓸기', kind: 'phys', power: 70, target: 'all' },
  arrow:    { name: '활쏘기', kind: 'phys', power: 110, target: 'one' },
  arrows:   { name: '화살비', kind: 'phys', power: 60, target: 'all' },
  dust:     { name: '모래 뿌리기', kind: 'none', target: 'all', status: ['blind', 0.35] },
  howl:     { name: '울부짖기', kind: 'buff', target: 'self', buffs: { patk: 1 }, turns: 3 },
  harden:   { name: '단단해지기', kind: 'buff', target: 'self', buffs: { pdef: 1 }, turns: 3 },
  drain:    { name: '흡혈', kind: 'phys', power: 90, target: 'one', drain: 0.6 },
  lullaby:  { name: '자장가', kind: 'none', target: 'all', status: ['sleep', 0.3] },
  curse:    { name: '저주', kind: 'debuff', target: 'one', debuffs: { pdef: -1, mdef: -1 }, turns: 2 },
  fire:     { name: '불꽃', kind: 'mag', type: 'fire', power: 115, target: 'one' },
  fireall:  { name: '화염의 숨결', kind: 'mag', type: 'fire', power: 80, target: 'all' },
  ice:      { name: '얼음 송곳', kind: 'mag', type: 'ice', power: 115, target: 'one' },
  iceall:   { name: '서리 숨결', kind: 'mag', type: 'ice', power: 80, target: 'all' },
  bolt:     { name: '벼락', kind: 'mag', type: 'thunder', power: 115, target: 'one' },
  boltall:  { name: '번개 폭풍', kind: 'mag', type: 'thunder', power: 80, target: 'all' },
  wind:     { name: '돌풍', kind: 'mag', type: 'wind', power: 80, target: 'all' },
  dark:     { name: '어둠의 화살', kind: 'mag', type: 'dark', power: 120, target: 'one' },
  darkall:  { name: '어둠의 파동', kind: 'mag', type: 'dark', power: 85, target: 'all' },
  regen:    { name: '재생', kind: 'healself', power: 0.08, target: 'self' },
  summon:   { name: '부르기', kind: 'summon', target: 'self' },
  /* 보스 전용 */
  thorns:   { name: '가시 폭풍', kind: 'phys', power: 85, target: 'all' },
  rootbind: { name: '뿌리 옭죄기', kind: 'phys', power: 90, target: 'one', status: ['sleep', 0.5] },
  pollen:   { name: '독 꽃가루', kind: 'none', target: 'all', status: ['poison', 0.5] },
  quake:    { name: '대지의 분노', kind: 'phys', power: 165, target: 'all', charged: true },
  sandstorm:{ name: '모래 폭풍', kind: 'mag', type: 'wind', power: 95, target: 'all', status: ['blind', 0.3] },
  kingslash:{ name: '왕의 참격', kind: 'phys', power: 140, hits: 2, target: 'one' },
  doom:     { name: '망자의 심판', kind: 'mag', type: 'dark', power: 175, target: 'all', charged: true },
  frostfang:{ name: '서리 송곳니', kind: 'phys', power: 150, target: 'one' },
  wingbeat: { name: '날갯짓', kind: 'phys', power: 75, target: 'all' },
  absolute: { name: '절대 빙하', kind: 'mag', type: 'ice', power: 190, target: 'all', charged: true },
  hex:      { name: '안개의 저주', kind: 'debuff', target: 'all', debuffs: { patk: -1, matk: -1 }, turns: 2 },
  witchbolt:{ name: '마녀의 번개', kind: 'mag', type: 'thunder', power: 135, hits: 2, target: 'random' },
  miasma:   { name: '독 안개', kind: 'mag', type: 'dark', power: 80, target: 'all', status: ['poison', 0.5] },
  eclipse:  { name: '일식', kind: 'mag', type: 'dark', power: 210, target: 'all', charged: true },
  duskfire: { name: '황혼의 불', kind: 'mag', type: 'fire', power: 120, target: 'all' },
  bellring: { name: '거꾸로 울리는 종', kind: 'none', target: 'all', status: ['sleep', 0.35] },
  nightfall:{ name: '영원한 밤', kind: 'mag', type: 'dark', power: 250, target: 'all', charged: true },
  duskblade:{ name: '황혼의 칼날', kind: 'phys', power: 135, hits: 3, target: 'random' }
};

/* ── 적 ──
   weak: 약점, shield: 실드 수, acts: 한 라운드 행동 수, ai: [[행동, 무게, 조건?]]
   pattern: 보스는 정해진 순서로 행동, phases: HP 비율 아래로 떨어질 때 바뀌는 것 */
const ENEMIES = {
  /* 1장: 고요의 숲 */
  slime:    { name: '숲 슬라임', spr: 'slime', hp: 530, patk: 44, matk: 34, pdef: 18, mdef: 16, spd: 15, shield: 2, weak: ['sword', 'fire'], exp: 46, gold: 14, drop: ['herb', 0.2], steal: 'herb', gearDrop: ['staff_w1', 0.06], ai: [['attack', 3], ['tackle', 1]] },
  rat:      { name: '들쥐', spr: 'rat_brown', hp: 440, patk: 47, matk: 13, pdef: 15, mdef: 12, spd: 27, shield: 2, weak: ['spear', 'dagger', 'ice'], exp: 41, gold: 12, drop: ['antidote', 0.2], steal: 'antidote', gearDrop: ['dagger_w1', 0.06], ai: [['bite', 2], ['venom', 1]] },
  bat:      { name: '숲 박쥐', spr: 'bat1', hp: 460, patk: 43, matk: 26, pdef: 14, mdef: 18, spd: 30, shield: 2, weak: ['bow', 'wind'], evade: 0.15, exp: 43, gold: 13, steal: 'herb', gearDrop: ['bow_w1', 0.06], ai: [['attack', 2], ['drain', 1]], fly: true },
  goblin:   { name: '고블린', spr: 'goblin', hp: 690, patk: 52, matk: 18, pdef: 22, mdef: 14, spd: 21, shield: 3, weak: ['spear', 'axe', 'light'], exp: 62, gold: 26, drop: ['herb', 0.3], steal: 'fire1', gearDrop: ['sword_w1', 0.06], ai: [['attack', 3], ['smash', 1]] },
  spider:   { name: '독거미', spr: 'spider', hp: 600, patk: 48, matk: 31, pdef: 20, mdef: 18, spd: 23, shield: 3, weak: ['axe', 'fire', 'light'], exp: 58, gold: 22, drop: ['antidote', 0.3], steal: 'antidote', gearDrop: ['robe_w1', 0.06], ai: [['venom', 2], ['attack', 1]] },
  wolf:     { name: '회색 늑대', spr: 'wolf', hp: 740, patk: 56, matk: 16, pdef: 20, mdef: 15, spd: 29, shield: 3, weak: ['sword', 'bow', 'fire'], exp: 70, gold: 24, drop: ['herb', 0.25], steal: 'herb', gearDrop: ['armor_w1', 0.06], ai: [['bite', 3], ['claw', 2], ['howl', 1, 'once']] },
  treant:   { name: '가시나무 거인', spr: 'treant', big: true, boss: true, hp: 13000, patk: 62, matk: 52, pdef: 30, mdef: 24, spd: 18, shield: 6, weak: ['axe', 'sword', 'fire', 'wind'], exp: 600, gold: 400, acts: 2,
    pattern: ['attack', 'thorns', 'rootbind', 'attack', 'pollen', 'thorns'],
    phases: [{ hp: 0.5, shield: 2, acts: 2, msg: '가시나무 거인의 껍질이 단단해진다! (실드 +2)', pattern: ['thorns', 'charge:quake', 'attack', 'rootbind', 'pollen', 'thorns'] }] },

  /* 2장: 모래항 사막·잊힌 왕의 무덤 */
  scorpion: { name: '모래 전갈', spr: 'scorpion', hp: 1170, patk: 103, matk: 36, pdef: 54, mdef: 30, spd: 33, shield: 3, weak: ['axe', 'ice', 'spear'], exp: 228, gold: 66, drop: ['antidote', 0.3], steal: 'herb2', ai: [['sting', 2], ['claw', 2]] },
  bat_fire: { name: '불꽃 박쥐', spr: 'bat_fire1', hp: 1050, patk: 96, matk: 84, pdef: 40, mdef: 46, spd: 41, shield: 3, weak: ['bow', 'ice', 'wind'], evade: 0.15, exp: 216, gold: 60, steal: 'fire1', ai: [['attack', 2], ['fire', 2]], fly: true },
  slime_red:{ name: '붉은 슬라임', spr: 'slime_red', hp: 1230, patk: 91, matk: 86, pdef: 42, mdef: 52, spd: 26, shield: 3, weak: ['sword', 'ice', 'thunder'], exp: 210, gold: 58, drop: ['fire1', 0.2], steal: 'fire1', ai: [['tackle', 2], ['fire', 2]] },
  skeleton: { name: '해골 병사', spr: 'skeleton', hp: 1350, patk: 108, matk: 24, pdef: 56, mdef: 36, spd: 29, shield: 4, weak: ['axe', 'light', 'staff'], exp: 252, gold: 72, drop: ['herb2', 0.2], steal: 'light1', gearDrop: ['sword_w3', 0.06], ai: [['attack', 3], ['smash', 1]] },
  archer:   { name: '해골 궁수', spr: 'archer', hp: 1170, patk: 110, matk: 24, pdef: 46, mdef: 36, spd: 35, shield: 4, weak: ['sword', 'light', 'thunder'], exp: 246, gold: 72, steal: 'herb2', gearDrop: ['bow_w3', 0.06], ai: [['arrow', 3], ['arrows', 1]] },
  mummy:    { name: '미라', spr: 'mummy', hp: 1580, patk: 106, matk: 48, pdef: 50, mdef: 30, spd: 22, shield: 4, weak: ['fire', 'light', 'dagger'], exp: 276, gold: 79, drop: ['remedy', 0.25], steal: 'remedy', gearDrop: ['armor_w3', 0.06], ai: [['attack', 2], ['drain', 2], ['curse', 1]] },
  golem_sand:{ name: '사암 골렘', spr: 'golem_sand', hp: 2100, patk: 120, matk: 24, pdef: 80, mdef: 30, spd: 18, shield: 5, weak: ['axe', 'ice', 'thunder'], exp: 348, gold: 96, drop: ['herb2', 0.3], steal: 'ice1', ai: [['smash', 2], ['harden', 1, 'once'], ['attack', 1]] },
  boneking: { name: '모래 왕의 망령', spr: 'boneking_sand', big: true, boss: true, hp: 15000, patk: 120, matk: 112, pdef: 66, mdef: 56, spd: 30, shield: 8, weak: ['axe', 'light', 'ice', 'spear'], exp: 2600, gold: 1600, acts: 2,
    pattern: ['kingslash', 'sandstorm', 'attack', 'summon:skeleton', 'kingslash', 'curse'],
    phases: [{ hp: 0.5, shield: 2, acts: 3, msg: '왕의 망령이 분노한다! (행동 3회, 실드 +2)', pattern: ['kingslash', 'charge:doom', 'sandstorm', 'summon:archer', 'kingslash', 'curse'] }] },

  /* 3장: 서리골 설원·빙하 동굴 */
  wolf_white:{ name: '설원 늑대', spr: 'wolf_white', hp: 2160, patk: 154, matk: 36, pdef: 74, mdef: 54, spd: 46, shield: 4, weak: ['sword', 'fire', 'bow'], exp: 588, gold: 126, drop: ['herb2', 0.25], steal: 'herb2', ai: [['bite', 3], ['claw', 2], ['howl', 1, 'once']] },
  slime_blue:{ name: '얼음 슬라임', spr: 'slime_blue', hp: 2000, patk: 132, matk: 134, pdef: 70, mdef: 84, spd: 32, shield: 4, weak: ['fire', 'thunder', 'axe'], exp: 560, gold: 119, drop: ['ice1', 0.2], steal: 'ice1', ai: [['tackle', 2], ['ice', 2]] },
  bat_ice:  { name: '얼음 박쥐', spr: 'bat_ice1', hp: 1760, patk: 139, matk: 125, pdef: 60, mdef: 70, spd: 52, shield: 4, weak: ['bow', 'fire', 'light'], evade: 0.15, exp: 546, gold: 112, steal: 'ether', ai: [['drain', 2], ['iceall', 1]], fly: true },
  ghost:    { name: '원혼', spr: 'ghost_blue', hp: 1840, patk: 108, matk: 149, pdef: 100, mdef: 64, spd: 40, shield: 4, weak: ['light', 'staff', 'fire'], evade: 0.2, exp: 602, gold: 133, drop: ['ether', 0.15], steal: 'ether', ai: [['ice', 2], ['lullaby', 1], ['dark', 1]] },
  golem_ice:{ name: '서리 골렘', spr: 'golem_ice', hp: 3360, patk: 168, matk: 72, pdef: 112, mdef: 60, spd: 24, shield: 6, weak: ['axe', 'fire', 'thunder', 'spear'], exp: 784, gold: 182, drop: ['herb2', 0.4], steal: 'fire1', ai: [['smash', 2], ['iceall', 1], ['harden', 1, 'once']] },
  yeti:     { name: '빙하 고블린', spr: 'goblin_red', hp: 2400, patk: 158, matk: 48, pdef: 78, mdef: 50, spd: 38, shield: 5, weak: ['spear', 'dagger', 'fire', 'dark'], exp: 658, gold: 154, drop: ['remedy', 0.3], steal: 'herb2', gearDrop: ['axe_w4', 0.06], ai: [['attack', 2], ['smash', 2], ['dust', 1]] },
  wyrm:     { name: '서리 비룡', spr: 'wyrm', big: true, boss: true, hp: 30000, patk: 192, matk: 195, pdef: 96, mdef: 92, spd: 44, shield: 10, weak: ['fire', 'bow', 'thunder', 'spear'], exp: 6400, gold: 3000, acts: 2,
    pattern: ['frostfang', 'iceall', 'wingbeat', 'frostfang', 'charge:absolute', 'wingbeat'],
    phases: [{ hp: 0.55, shield: 2, acts: 3, msg: '서리 비룡의 비늘이 얼음으로 덮인다! (실드 +2, 행동 3회)', pattern: ['wingbeat', 'frostfang', 'iceall', 'charge:absolute', 'frostfang', 'howl'] }] },

  /* 4장: 안개성 늪·마도의 탑 */
  slime_purple:{ name: '늪 슬라임', spr: 'slime_purple', hp: 2660, patk: 172, matk: 172, pdef: 96, mdef: 110, spd: 40, shield: 5, weak: ['sword', 'light', 'thunder'], exp: 900, gold: 175, drop: ['remedy', 0.25], steal: 'remedy', ai: [['tackle', 2], ['miasma', 1], ['regen', 1, 'hp<0.5']] },
  imp:      { name: '불꽃 임프', spr: 'imp', hp: 2380, patk: 161, matk: 193, pdef: 88, mdef: 104, spd: 56, shield: 5, weak: ['ice', 'spear', 'bow'], exp: 862, gold: 188, steal: 'fire2', ai: [['fire', 2], ['fireall', 1], ['attack', 1]] },
  imp_green:{ name: '독 임프', spr: 'imp_green', hp: 2380, patk: 175, matk: 172, pdef: 92, mdef: 98, spd: 54, shield: 5, weak: ['fire', 'axe', 'light'], exp: 862, gold: 188, steal: 'antidote', ai: [['sting', 2], ['miasma', 1], ['wind', 1]] },
  knight:   { name: '마도 기사', spr: 'knight', hp: 3780, patk: 205, matk: 103, pdef: 144, mdef: 92, spd: 42, shield: 6, weak: ['axe', 'thunder', 'dark', 'spear'], exp: 1125, gold: 250, drop: ['herb3', 0.15], steal: 'herb3', gearDrop: ['armor_w4', 0.06], ai: [['attack', 2], ['smash', 2], ['harden', 1, 'once']] },
  mage:     { name: '그림자 마법사', spr: 'mage', hp: 2660, patk: 115, matk: 214, pdef: 80, mdef: 138, spd: 48, shield: 5, weak: ['sword', 'dagger', 'light'], exp: 1025, gold: 238, drop: ['ether', 0.3], steal: 'ether2', ai: [['dark', 2], ['boltall', 1], ['curse', 1]] },
  mimic:    { name: '미믹', spr: 'mimic', hp: 3640, patk: 218, matk: 138, pdef: 120, mdef: 120, spd: 50, shield: 6, weak: ['dagger', 'light', 'wind', 'ice'], exp: 1750, gold: 1125, drop: ['bpfruit', 0.5], steal: 'elixir', ai: [['bite', 3], ['drain', 1], ['lullaby', 1]] },
  spider_giant:{ name: '늪 거미', spr: 'spider_giant', hp: 3080, patk: 193, matk: 126, pdef: 104, mdef: 88, spd: 46, shield: 5, weak: ['fire', 'axe', 'sword'], exp: 975, gold: 200, drop: ['antidote', 0.4], steal: 'remedy', ai: [['venom', 2], ['attack', 1], ['dust', 1]] },
  witch:    { name: '안개의 마녀 모르가', spr: 'abyss_fog', big: true, boss: true, hp: 31000, patk: 160, matk: 200, pdef: 120, mdef: 140, spd: 54, shield: 12, weak: ['sword', 'light', 'axe', 'wind', 'bow'], exp: 13000, gold: 5000, acts: 2,
    pattern: ['witchbolt', 'hex', 'miasma', 'witchbolt', 'summon:mage', 'darkall'],
    phases: [{ hp: 0.5, shield: 3, acts: 3, msg: '모르가가 안개 속에 몸을 숨긴다! (실드 +3, 행동 3회)', pattern: ['witchbolt', 'charge:eclipse', 'miasma', 'hex', 'witchbolt', 'regen'] }] },

  /* 5장: 황혼의 탑 */
  knight_dusk:{ name: '황혼의 기사', spr: 'knight_dusk', hp: 4500, patk: 249, matk: 134, pdef: 176, mdef: 120, spd: 52, shield: 7, weak: ['axe', 'ice', 'light', 'spear'], exp: 1430, gold: 286, drop: ['herb3', 0.25], steal: 'herb3', ai: [['smash', 2], ['sweep', 1], ['attack', 2]] },
  mage_red: { name: '황혼의 마법사', spr: 'mage_red', hp: 3380, patk: 134, matk: 264, pdef: 100, mdef: 170, spd: 58, shield: 6, weak: ['sword', 'dagger', 'ice', 'bow'], exp: 1320, gold: 264, drop: ['ether2', 0.2], steal: 'ether2', ai: [['fire', 2], ['duskfire', 1], ['curse', 1]] },
  wolf_shadow:{ name: '그림자 늑대', spr: 'wolf_shadow', hp: 3750, patk: 240, matk: 67, pdef: 130, mdef: 110, spd: 70, shield: 6, weak: ['light', 'fire', 'sword'], exp: 1342, gold: 253, steal: 'herb3', ai: [['bite', 3], ['claw', 2]] },
  golem_bell:{ name: '종지기 인형', spr: 'golem_bell', hp: 5500, patk: 260, matk: 112, pdef: 196, mdef: 110, spd: 34, shield: 8, weak: ['thunder', 'axe', 'dark'], exp: 1650, gold: 330, drop: ['ether2', 0.3], steal: 'thunder2', ai: [['smash', 2], ['bellring', 1], ['harden', 1, 'once']] },
  slime_gold:{ name: '금빛 슬라임', spr: 'slime_gold', hp: 1600, patk: 150, matk: 150, pdef: 220, mdef: 220, spd: 80, shield: 3, weak: ['dagger', 'thunder'], exp: 6000, gold: 3000, flee: 0.5, steal: 'bpfruit', ai: [['attack', 1]] },
  nocte:    { name: '황혼의 사제 노크테', spr: 'nocte', boss: true, hp: 32000, patk: 168, matk: 196, pdef: 150, mdef: 170, spd: 60, shield: 14, weak: ['sword', 'staff', 'light', 'thunder', 'bow'], exp: 0, gold: 0, acts: 2,
    pattern: ['duskfire', 'duskblade', 'bellring', 'darkall', 'summon:golem_bell', 'duskblade'],
    phases: [{ hp: 0.5, shield: 2, acts: 3, msg: '노크테가 거꾸로 된 종을 높이 든다! (실드 +2, 행동 3회)', pattern: ['duskblade', 'charge:eclipse', 'duskfire', 'bellring', 'darkall'] }] },
  avatar:   { name: '황혼의 화신', spr: 'abyss_dusk', big: true, boss: true, hp: 52000, patk: 211, matk: 238, pdef: 170, mdef: 180, spd: 66, shield: 16, weak: ['spear', 'dagger', 'axe', 'fire', 'light', 'wind'], exp: 30000, gold: 0, acts: 3,
    pattern: ['duskblade', 'darkall', 'duskfire', 'hex', 'charge:nightfall', 'miasma'],
    phases: [{ hp: 0.6, shield: 2, acts: 3, msg: '황혼의 화신이 날개를 펼친다! (실드 +2)' },
             { hp: 0.3, shield: 2, acts: 4, msg: '밤이 몰려온다… 화신이 마지막 힘을 끌어낸다! (실드 +2, 행동 4회)', pattern: ['duskblade', 'charge:nightfall', 'darkall', 'duskfire', 'charge:eclipse', 'miasma'] }] },

  /* 들판 (잡몹 사냥터) — 드문 금속빛 적은 단단하고 잘 달아나지만 경험치를 많이 준다. 브레이크하면 달아나지 못한다 */
  golem_moss: { name: '이끼 골렘', spr: 'golem_moss', hp: 1150, patk: 56, matk: 20, pdef: 34, mdef: 16, spd: 12, shield: 4, weak: ['axe', 'spear', 'fire'], exp: 112, gold: 40, drop: ['herb', 0.4], steal: 'herb', gearDrop: ['axe_w1', 0.08], ai: [['attack', 3], ['smash', 1], ['harden', 1, 'once']] },
  slime_silver: { name: '은빛 슬라임', spr: 'slime_silver', hp: 300, patk: 40, matk: 30, pdef: 250, mdef: 250, spd: 60, shield: 5, weak: ['dagger', 'thunder'], flee: 0.4, exp: 600, gold: 90, drop: ['ether', 0.5], steal: 'ether', gearDrop: ['ring_g1', 0.25], ai: [['attack', 1]] },
  scorpion_red: { name: '붉은 전갈', spr: 'scorpion_red', hp: 1450, patk: 112, matk: 88, pdef: 58, mdef: 36, spd: 36, shield: 4, weak: ['axe', 'ice', 'bow'], exp: 290, gold: 84, drop: ['herb2', 0.2], steal: 'fire1', ai: [['sting', 2], ['claw', 1], ['fire', 1]] },
  scorpion_gold: { name: '황금 전갈', spr: 'scorpion_gold', hp: 480, patk: 96, matk: 40, pdef: 330, mdef: 330, spd: 70, shield: 5, weak: ['spear', 'thunder'], flee: 0.4, exp: 2400, gold: 500, drop: ['herb2', 0.6], steal: 'remedy', gearDrop: ['bow_g3', 0.2], ai: [['sting', 1], ['attack', 1]] },
  ghost_snow: { name: '눈보라 망령', spr: 'ghost', hp: 2050, patk: 110, matk: 156, pdef: 104, mdef: 70, spd: 44, shield: 4, weak: ['light', 'fire', 'sword'], evade: 0.15, exp: 640, gold: 140, drop: ['ether', 0.15], steal: 'ice1', gearDrop: ['staff_w3', 0.05], ai: [['ice', 2], ['iceall', 1], ['lullaby', 1]] },
  golem_crystal: { name: '수정 골렘', spr: 'golem_crystal', hp: 780, patk: 150, matk: 60, pdef: 520, mdef: 520, spd: 72, shield: 5, weak: ['axe', 'dark'], flee: 0.4, exp: 5600, gold: 900, drop: ['ether2', 0.5], steal: 'ether', gearDrop: ['dagger_g4', 0.2], ai: [['smash', 1], ['attack', 1]] },
  ghoul:    { name: '늪 구울', spr: 'ghoul', hp: 3200, patk: 190, matk: 80, pdef: 98, mdef: 84, spd: 40, shield: 5, weak: ['fire', 'light', 'spear'], exp: 960, gold: 196, drop: ['remedy', 0.3], steal: 'remedy', gearDrop: ['armor_w4', 0.05], ai: [['drain', 2], ['venom', 2], ['attack', 1]] },
  mage_teal:{ name: '늪지 주술사', spr: 'mage_teal', hp: 2700, patk: 110, matk: 200, pdef: 82, mdef: 130, spd: 50, shield: 5, weak: ['sword', 'bow', 'thunder'], exp: 1000, gold: 230, drop: ['ether', 0.3], steal: 'ether2', ai: [['ice', 2], ['wind', 1], ['miasma', 1], ['curse', 1]] },
  imp_gold: { name: '황금 임프', spr: 'imp_gold', hp: 1250, patk: 170, matk: 170, pdef: 700, mdef: 700, spd: 80, shield: 5, weak: ['bow', 'ice'], flee: 0.4, exp: 9600, gold: 1600, drop: ['bpfruit', 0.3], steal: 'elixir', gearDrop: ['staff_g4', 0.2], ai: [['fire', 1], ['attack', 1]] }
};

/* ── 적 무리 ── */
const FORMATIONS = {
  /* 숲 */
  f1a: ['slime', 'slime'], f1b: ['rat', 'slime', 'rat'], f1c: ['bat', 'bat'], f1d: ['goblin', 'slime'],
  f1e: ['spider', 'rat'], f1f: ['wolf'], f1g: ['goblin', 'bat', 'spider'], f1h: ['wolf', 'wolf'],
  boss1: ['treant'],
  /* 사막·무덤 */
  f2a: ['scorpion', 'scorpion'], f2b: ['bat_fire', 'slime_red'], f2c: ['scorpion', 'bat_fire', 'scorpion'],
  f2d: ['skeleton', 'archer'], f2e: ['mummy', 'skeleton'], f2f: ['golem_sand'], f2g: ['archer', 'mummy', 'archer'], f2h: ['skeleton', 'golem_sand'],
  boss2: ['boneking'],
  /* 설원·동굴 */
  f3a: ['wolf_white', 'wolf_white'], f3b: ['slime_blue', 'bat_ice'], f3c: ['yeti', 'wolf_white'],
  f3d: ['ghost', 'bat_ice', 'ghost'], f3e: ['golem_ice'], f3f: ['slime_blue', 'yeti', 'slime_blue'], f3g: ['ghost', 'golem_ice'],
  boss3: ['wyrm'],
  /* 늪·탑 */
  f4a: ['slime_purple', 'imp_green'], f4b: ['spider_giant', 'slime_purple'], f4c: ['imp', 'imp_green', 'imp'],
  f4d: ['knight', 'mage'], f4e: ['mage', 'mage', 'imp'], f4f: ['mimic'], f4g: ['knight', 'spider_giant'],
  boss4: ['witch'],
  /* 황혼의 탑 */
  f5a: ['knight_dusk', 'mage_red'], f5b: ['wolf_shadow', 'wolf_shadow'], f5c: ['golem_bell', 'mage_red'],
  f5d: ['knight_dusk', 'wolf_shadow', 'mage_red'], f5e: ['slime_gold'], f5f: ['golem_bell', 'knight_dusk'],
  boss5: ['golem_bell', 'nocte', 'golem_bell'], boss6: ['avatar'],
  /* 들판 (g1 바람 들판 · g2 붉은 사구 · g3 은빛 설원 · g4 안개 늪, 끝의 r은 드문 적) */
  g1a: ['slime', 'rat'], g1b: ['rat', 'rat'], g1c: ['goblin', 'slime'], g1d: ['bat', 'rat', 'bat'],
  g1e: ['golem_moss'], g1f: ['wolf', 'goblin'], g1g: ['spider', 'slime', 'spider'], g1h: ['golem_moss', 'bat'], g1r: ['slime_silver'],
  g2a: ['scorpion', 'scorpion_red'], g2b: ['bat_fire', 'slime_red', 'bat_fire'], g2c: ['scorpion_red'], g2d: ['slime_red', 'scorpion', 'slime_red'],
  g2e: ['golem_sand', 'scorpion'], g2f: ['scorpion_red', 'bat_fire', 'scorpion_red'], g2r: ['scorpion_gold'],
  g3a: ['wolf_white', 'ghost_snow'], g3b: ['slime_blue', 'bat_ice', 'slime_blue'], g3c: ['ghost_snow', 'ghost_snow'], g3d: ['yeti', 'wolf_white', 'yeti'],
  g3e: ['golem_ice', 'ghost_snow'], g3f: ['wolf_white', 'wolf_white', 'wolf_white'], g3r: ['golem_crystal'],
  g4a: ['ghoul', 'slime_purple'], g4b: ['mage_teal', 'ghoul'], g4c: ['spider_giant', 'ghoul'], g4d: ['imp_green', 'mage_teal', 'imp_green'],
  g4e: ['slime_purple', 'slime_purple', 'mage_teal'], g4f: ['ghoul', 'ghoul'], g4r: ['imp_gold']
};
