'use strict';
/* 은빛 유랑기 — 성장 시스템 데이터: 장비 등급·투구 칸·새 장비, 룬과 룬어, 스킬 트리, 전직
   bonus 키: str dex int cha con hp mp ac hit dmg spell heal crit check lifesteal mpregen thorns fire chillon */

const SLOTS = ['weapon', 'helm', 'armor', 'acc'];
const SLOT_NAMES = { weapon: '무기', helm: '투구', armor: '방어구', acc: '장신구' };
const GRADES = ['일반', '고급', '희귀', '영웅', '전설'];
const BONUS_NAMES = {
  str: '힘', dex: '민첩', int: '지능', cha: '매력', con: '체질', hp: '최대 체력', mp: '최대 마나', ac: '방어도', hit: '명중',
  dmg: '무기 피해', spell: '주문 피해', heal: '회복량', crit: '치명타 범위', check: '모든 판정', lifesteal: '흡혈(%)',
  mpregen: '턴마다 마나', thorns: '가시 반사', fire: '화염 추가 피해(d6)', chillon: '빙결 확률(%)'
};

/* ─────────────── 새 스킬 ─────────────── */
Object.assign(SKILLS, {
  poisonarrow: { name: '독화살', mp: 3, kind: 'dot', dot: 4, dotDmg: '1d6', desc: '명중하면 4턴 동안 독(턴마다 1d6)', atk: true },
  holylight:   { name: '성스러운 빛', mp: 4, kind: 'heal', heal: '3d8', stat: 'cha', cure: true, desc: '체력 3d8+매력 회복, 독 해제' },
  judgment:    { name: '심판의 일격', mp: 4, kind: 'atk', hit: 3, extra: '2d8', undead2: true, desc: '명중 +3, 피해 +2d8, 망령에게 두 배' },
  rage:        { name: '광폭화', mp: 3, kind: 'buff', buff: { hit: 2, dmg: 6, turns: 4 }, desc: '4턴 동안 명중 +2, 피해 +6' },
  bloodcleave: { name: '피의 가르기', mp: 4, kind: 'atk', hit: 1, extra: '2d10', drain: 0.5, desc: '피해 +2d10, 준 피해의 절반만큼 회복' },
  pierce:      { name: '관통 사격', mp: 4, kind: 'atk', hit: 6, extra: '3d8', desc: '명중 +6, 피해 +3d8' },
  deadeye:     { name: '필중의 눈', mp: 5, kind: 'atk', hit: 20, extra: '4d8', critAlways: true, desc: '반드시 명중하는 치명타 (피해 +4d8)' },
  wolfcall:    { name: '늑대 부르기', mp: 3, kind: 'pet', desc: '늑대 동료 소환: 이번 전투 동안 매 턴 함께 공격' },
  feral:       { name: '야성의 포효', mp: 4, kind: 'buff', buff: { hit: 2, dmg: 4, ac: 2, turns: 4 }, desc: '4턴 동안 명중 +2, 피해 +4, 방어도 +2' },
  meteor:      { name: '운석 낙하', mp: 9, kind: 'spell', dmg: '9d6', stat: 'int', fire: true, desc: '자동 명중 9d6+지능, 식물·얼음에게 강함' },
  inferno:     { name: '불꽃 폭풍', mp: 5, kind: 'spell', dmg: '5d6', stat: 'int', fire: true, desc: '자동 명중 5d6+지능' },
  timestop:    { name: '시간 정지', mp: 6, kind: 'timestop', desc: '적이 2턴(우두머리 1턴) 동안 멈춘다. 실패하지 않는다' },
  rewind:      { name: '되감기', mp: 5, kind: 'heal', heal: '4d6', stat: 'int', mpBack: 3, desc: '체력 4d6+지능 회복, 마나 3 되돌려받음' },
  bladedance:  { name: '칼춤', mp: 5, kind: 'multi', n: 3, extra: '1d4', desc: '세 번 공격, 각각 피해 +1d4' },
  finale:      { name: '마지막 춤', mp: 9, kind: 'multi', n: 4, extra: '1d8', desc: '네 번 공격, 각각 피해 +1d8' },
  hymn:        { name: '찬가', mp: 5, kind: 'heal', heal: '4d8', stat: 'cha', cure: true, desc: '체력 4d8+매력 회복, 독 해제' },
  blessing:    { name: '축복', mp: 4, kind: 'buff', buff: { hit: 3, dmg: 3, ac: 3, turns: 4 }, desc: '4턴 동안 명중·피해·방어도 +3' },
  sanctus:     { name: '성가', mp: 6, kind: 'spell', dmg: '6d8', stat: 'cha', undead2: true, desc: '자동 명중 6d8+매력, 망령에게 두 배' }
});

/* ─────────────── 스킬 트리 ───────────────
   노드: { id, name, lv, req:[노드], skill | bonus, desc }  레벨마다 기술 포인트 1 */
const TREES = {
  sword: [
    { id: 'sw_tough', name: '강인함', lv: 2, bonus: { hp: 8 }, desc: '최대 체력 +8' },
    { id: 'sw_master', name: '무기 숙련', lv: 2, bonus: { hit: 1, dmg: 1 }, desc: '명중 +1, 무기 피해 +1' },
    { id: 'sw_second', name: '재기', lv: 3, skill: 'secondwind', req: ['sw_tough'] },
    { id: 'sw_iron', name: '강철 피부', lv: 4, bonus: { ac: 1 }, req: ['sw_tough'], desc: '방어도 +1' },
    { id: 'sw_whirl', name: '회오리 베기', lv: 5, skill: 'whirl', req: ['sw_master'] },
    { id: 'sw_crit', name: '급소 노리기', lv: 6, bonus: { crit: 1 }, req: ['sw_master'], desc: '19~20에 치명타' },
    { id: 'sw_titan', name: '거인 베기', lv: 7, skill: 'titan', req: ['sw_whirl'] },
    { id: 'sw_last', name: '최후의 보루', lv: 9, bonus: { hp: 15, ac: 1 }, req: ['sw_iron'], desc: '최대 체력 +15, 방어도 +1' }
  ],
  ranger: [
    { id: 'ra_eagle', name: '매의 눈', lv: 2, bonus: { hit: 1 }, desc: '명중 +1' },
    { id: 'ra_trail', name: '숲의 발걸음', lv: 2, bonus: { dex: 1 }, desc: '민첩 +1' },
    { id: 'ra_volley', name: '연사', lv: 3, skill: 'volley', req: ['ra_eagle'] },
    { id: 'ra_crit', name: '약점 간파', lv: 4, bonus: { crit: 1 }, req: ['ra_eagle'], desc: '19~20에 치명타' },
    { id: 'ra_poison', name: '독화살', lv: 5, skill: 'poisonarrow', req: ['ra_trail'] },
    { id: 'ra_second', name: '재기', lv: 5, skill: 'secondwind', req: ['ra_trail'] },
    { id: 'ra_star', name: '별비 화살', lv: 7, skill: 'starfall', req: ['ra_volley'] },
    { id: 'ra_hunter', name: '노련한 사냥꾼', lv: 9, bonus: { dmg: 3 }, req: ['ra_crit'], desc: '무기 피해 +3' }
  ],
  mage: [
    { id: 'ma_mana', name: '마나 저장고', lv: 2, bonus: { mp: 6 }, desc: '최대 마나 +6' },
    { id: 'ma_mind', name: '명석함', lv: 2, bonus: { int: 1 }, desc: '지능 +1' },
    { id: 'ma_frost', name: '서리 결속', lv: 3, skill: 'frost', req: ['ma_mind'] },
    { id: 'ma_focus', name: '주문 집중', lv: 4, bonus: { spell: 2 }, req: ['ma_mind'], desc: '주문 피해 +2' },
    { id: 'ma_ward', name: '비전 방벽', lv: 5, skill: 'ward', req: ['ma_mana'] },
    { id: 'ma_flow', name: '마나 순환', lv: 6, bonus: { mpregen: 1 }, req: ['ma_mana'], desc: '전투 중 매 턴 마나 +1' },
    { id: 'ma_chain', name: '번개 사슬', lv: 7, skill: 'chain', req: ['ma_focus'] },
    { id: 'ma_arch', name: '대마법', lv: 9, bonus: { spell: 3, mp: 6 }, req: ['ma_chain'], desc: '주문 피해 +3, 최대 마나 +6' }
  ],
  bard: [
    { id: 'ba_voice', name: '울림 있는 목소리', lv: 2, bonus: { cha: 1 }, desc: '매력 +1' },
    { id: 'ba_luck', name: '여행자의 행운', lv: 2, bonus: { check: 1 }, desc: '모든 판정 +1' },
    { id: 'ba_inspire', name: '용기의 노래', lv: 3, skill: 'inspire', req: ['ba_voice'] },
    { id: 'ba_heal', name: '따스한 손', lv: 4, bonus: { heal: 3 }, req: ['ba_voice'], desc: '회복량 +3' },
    { id: 'ba_discord', name: '불협화음', lv: 5, skill: 'discord', req: ['ba_voice'] },
    { id: 'ba_flow', name: '끝나지 않는 노래', lv: 6, bonus: { mpregen: 1 }, req: ['ba_luck'], desc: '전투 중 매 턴 마나 +1' },
    { id: 'ba_requiem', name: '진혼가', lv: 7, skill: 'requiem', req: ['ba_discord'] },
    { id: 'ba_encore', name: '앙코르', lv: 9, bonus: { hp: 10, mp: 8 }, req: ['ba_heal'], desc: '최대 체력 +10, 최대 마나 +8' }
  ]
};

/* ─────────────── 전직 (레벨 6, 왕도 영웅의 전당) ─────────────── */
const JOBS = {
  paladin: { base: 'sword', name: '성기사', icon: '🛡️', st: { con: 1, cha: 2 }, bonus: { hp: 10, ac: 1, heal: 2 },
    blurb: '빛의 맹세로 버티고 치유한다. 망령에게 강하다.', skills: ['holylight', 'judgment'],
    tree: [
      { id: 'pa_aura', name: '수호의 오라', lv: 7, bonus: { ac: 1, hp: 8 }, desc: '방어도 +1, 최대 체력 +8' },
      { id: 'pa_faith', name: '굳은 신앙', lv: 9, bonus: { heal: 4, check: 1 }, req: ['pa_aura'], desc: '회복량 +4, 모든 판정 +1' },
      { id: 'pa_avatar', name: '빛의 화신', lv: 11, bonus: { dmg: 3, ac: 1, hp: 12 }, req: ['pa_faith'], desc: '무기 피해 +3, 방어도 +1, 최대 체력 +12' }
    ] },
  berserker: { base: 'sword', name: '광전사', icon: '🪓', st: { str: 2, con: 1 }, bonus: { dmg: 2, lifesteal: 8 },
    blurb: '상처가 깊을수록 강해진다. 흡혈로 버틴다.', skills: ['rage', 'bloodcleave'],
    tree: [
      { id: 'be_blood', name: '피의 갈증', lv: 7, bonus: { lifesteal: 7 }, desc: '흡혈 +7%' },
      { id: 'be_fury', name: '격노', lv: 9, bonus: { dmg: 3, crit: 1 }, req: ['be_blood'], desc: '무기 피해 +3, 치명타 범위 +1' },
      { id: 'be_undying', name: '불사의 몸', lv: 11, bonus: { hp: 25 }, req: ['be_fury'], desc: '최대 체력 +25' }
    ] },
  sniper: { base: 'ranger', name: '저격수', icon: '🎯', st: { dex: 2 }, bonus: { hit: 2, crit: 1 },
    blurb: '한 발에 끝낸다. 치명타와 관통.', skills: ['pierce', 'deadeye'],
    tree: [
      { id: 'sn_steady', name: '흔들림 없는 손', lv: 7, bonus: { hit: 2 }, desc: '명중 +2' },
      { id: 'sn_vital', name: '급소 사냥', lv: 9, bonus: { crit: 1, dmg: 2 }, req: ['sn_steady'], desc: '치명타 범위 +1, 무기 피해 +2' },
      { id: 'sn_legend', name: '전설의 사수', lv: 11, bonus: { dmg: 4, dex: 1 }, req: ['sn_vital'], desc: '무기 피해 +4, 민첩 +1' }
    ] },
  beastmaster: { base: 'ranger', name: '야수지기', icon: '🐺', st: { con: 1, cha: 1 }, bonus: { hp: 10, ac: 1 },
    blurb: '은빛 늑대와 함께 싸운다.', skills: ['wolfcall', 'feral'],
    tree: [
      { id: 'bm_pack', name: '무리의 유대', lv: 7, bonus: { hp: 8, check: 1 }, desc: '최대 체력 +8, 모든 판정 +1 (늑대 피해 증가)' },
      { id: 'bm_alpha', name: '우두머리 늑대', lv: 9, bonus: { ac: 1 }, req: ['bm_pack'], desc: '방어도 +1, 늑대 피해 증가' },
      { id: 'bm_moon', name: '달의 사냥', lv: 11, bonus: { dmg: 3, hit: 1 }, req: ['bm_alpha'], desc: '무기 피해 +3, 명중 +1' }
    ] },
  elementalist: { base: 'mage', name: '원소술사', icon: '🔥', st: { int: 2, con: 1 }, bonus: { spell: 3, mp: 8, hp: 12, ac: 1, mpregen: 1 },
    blurb: '불과 번개로 모든 것을 태운다.', skills: ['inferno', 'meteor'],
    tree: [
      { id: 'el_ember', name: '잉걸불 혈통', lv: 7, bonus: { spell: 2 }, desc: '주문 피해 +2' },
      { id: 'el_overflow', name: '넘치는 마력', lv: 9, bonus: { mp: 10, mpregen: 1 }, req: ['el_ember'], desc: '최대 마나 +10, 매 턴 마나 +1' },
      { id: 'el_sun', name: '태양의 심장', lv: 11, bonus: { spell: 4 }, req: ['el_overflow'], desc: '주문 피해 +4' }
    ] },
  chronomancer: { base: 'mage', name: '시간술사', icon: '⏳', st: { int: 1, dex: 1 }, bonus: { ac: 2, mpregen: 1 },
    blurb: '시간을 멈추고 되감는다. 오래 버틴다.', skills: ['timestop', 'rewind'],
    tree: [
      { id: 'ch_haste', name: '가속', lv: 7, bonus: { ac: 1, hit: 1 }, desc: '방어도 +1, 명중 +1' },
      { id: 'ch_loop', name: '순환하는 시간', lv: 9, bonus: { mpregen: 1, mp: 8 }, req: ['ch_haste'], desc: '매 턴 마나 +1, 최대 마나 +8' },
      { id: 'ch_eternal', name: '영원의 문', lv: 11, bonus: { spell: 3, hp: 15 }, req: ['ch_loop'], desc: '주문 피해 +3, 최대 체력 +15' }
    ] },
  bladedancer: { base: 'bard', name: '검무가', icon: '🗡️', st: { dex: 2 }, bonus: { hit: 1, dmg: 2 },
    blurb: '노래하듯 베는 연속 공격.', skills: ['bladedance', 'finale'],
    tree: [
      { id: 'bd_step', name: '바람의 스텝', lv: 7, bonus: { ac: 1, dex: 1 }, desc: '방어도 +1, 민첩 +1' },
      { id: 'bd_edge', name: '노래하는 칼날', lv: 9, bonus: { dmg: 3, crit: 1 }, req: ['bd_step'], desc: '무기 피해 +3, 치명타 범위 +1' },
      { id: 'bd_storm', name: '칼바람', lv: 11, bonus: { hit: 2, lifesteal: 8 }, req: ['bd_edge'], desc: '명중 +2, 흡혈 +8%' }
    ] },
  cantor: { base: 'bard', name: '성가대장', icon: '🕯️', st: { cha: 2 }, bonus: { heal: 4, mp: 6 },
    blurb: '축복과 찬가로 지키고, 성가로 망령을 태운다.', skills: ['hymn', 'blessing', 'sanctus'],
    tree: [
      { id: 'ca_choir', name: '천상의 합창', lv: 7, bonus: { heal: 3, mp: 6 }, desc: '회복량 +3, 최대 마나 +6' },
      { id: 'ca_grace', name: '은총', lv: 9, bonus: { ac: 2, hp: 10 }, req: ['ca_choir'], desc: '방어도 +2, 최대 체력 +10' },
      { id: 'ca_hallow', name: '거룩한 울림', lv: 11, bonus: { spell: 4, mpregen: 1 }, req: ['ca_grace'], desc: '주문 피해 +4, 매 턴 마나 +1' }
    ] }
};

/* ─────────────── 룬 ───────────────
   룬은 장비 칸(무기·방어구)의 각인에 새긴다. 장비를 바꿔도 룬은 칸에 남고, 지금 장비의 홈 수만큼만 켜진다. */
const RUNES = {
  rune_fire:   { name: '불꽃 룬', slot: 'weapon', bonus: { fire: 1 }, desc: '무기 명중 시 화염 1d6 추가' },
  rune_frost:  { name: '서리 룬', slot: 'weapon', bonus: { chillon: 15 }, desc: '무기 명중 시 15% 확률로 적 빙결' },
  rune_blood:  { name: '피의 룬', slot: 'weapon', bonus: { lifesteal: 10 }, desc: '무기 피해의 10% 흡혈' },
  rune_edge:   { name: '날의 룬', slot: 'weapon', bonus: { crit: 1 }, desc: '치명타 범위 +1' },
  rune_true:   { name: '정확의 룬', slot: 'weapon', bonus: { hit: 2 }, desc: '명중 +2' },
  rune_might:  { name: '힘의 룬', slot: 'weapon', bonus: { dmg: 2 }, desc: '무기 피해 +2' },
  rune_ward:   { name: '수호 룬', slot: 'armor', bonus: { ac: 1 }, desc: '방어도 +1' },
  rune_life:   { name: '생명 룬', slot: 'armor', bonus: { hp: 10 }, desc: '최대 체력 +10' },
  rune_thorn:  { name: '가시 룬', slot: 'armor', bonus: { thorns: 3 }, desc: '맞을 때마다 적에게 3 반사' },
  rune_wind:   { name: '바람 룬', slot: 'armor', bonus: { dex: 1 }, desc: '민첩 +1' },
  rune_wisdom: { name: '지혜 룬', slot: 'any', bonus: { mp: 6, spell: 1 }, desc: '최대 마나 +6, 주문 피해 +1' },
  rune_luck:   { name: '행운 룬', slot: 'any', bonus: { check: 1 }, desc: '모든 판정 +1' },
  rune_star:   { name: '별 룬', slot: 'any', bonus: { str: 1, dex: 1, int: 1, cha: 1, con: 1 }, desc: '모든 능력치 +1', rare: true },
  rune_void:   { name: '공허 룬', slot: 'weapon', bonus: { dmg: 5, hp: -10 }, desc: '무기 피해 +5, 최대 체력 -10', rare: true }
};
const RUNEWORDS = [
  { name: '용의 숨결', slot: 'weapon', need: ['rune_fire', 'rune_fire', 'rune_edge'], bonus: { fire: 1, dmg: 3 }, desc: '화염 +1d6, 무기 피해 +3' },
  { name: '흡혈귀의 입맞춤', slot: 'weapon', need: ['rune_blood', 'rune_blood', 'rune_void'], bonus: { lifesteal: 15 }, desc: '흡혈 +15%' },
  { name: '얼어붙은 별', slot: 'weapon', need: ['rune_frost', 'rune_true', 'rune_star'], bonus: { chillon: 15, hit: 2 }, desc: '빙결 +15%, 명중 +2' },
  { name: '성채', slot: 'armor', need: ['rune_ward', 'rune_life', 'rune_thorn'], bonus: { ac: 2, hp: 10 }, desc: '방어도 +2, 최대 체력 +10' },
  { name: '현자의 외투', slot: 'armor', need: ['rune_wisdom', 'rune_wisdom', 'rune_wind'], bonus: { mp: 10, spell: 2 }, desc: '최대 마나 +10, 주문 피해 +2' },
  { name: '나그네의 축복', slot: 'armor', need: ['rune_luck', 'rune_wind', 'rune_life'], bonus: { check: 1, hp: 8, dex: 1 }, desc: '모든 판정 +1, 체력 +8, 민첩 +1' }
];
for (const [id, r] of Object.entries(RUNES)) {
  ITEMS[id] = { name: r.name, type: 'rune', price: r.rare ? 260 : 70, rune: r, desc: `${r.desc} · ${{ weapon: '무기', armor: '방어구', any: '무기·방어구' }[r.slot]}에 새김`, grade: r.rare ? 3 : 2 };
}
const RUNE_DROPS = Object.keys(RUNES).filter(id => !RUNES[id].rare);

/* ─────────────── 새 장비 ─────────────── */
Object.assign(ITEMS, {
  // 투구
  leathercap: { name: '가죽 두건', type: 'helm', price: 15, ac: 1, desc: '방어도 +1' },
  ironhelm:   { name: '철투구', type: 'helm', price: 60, ac: 2, desc: '방어도 +2' },
  circlet:    { name: '현자의 관', type: 'helm', price: 90, ac: 0, bonus: { int: 1, mp: 5 }, desc: '지능 +1, 마나 +5' },
  featherhat: { name: '깃털 모자', type: 'helm', price: 80, ac: 1, bonus: { cha: 1 }, desc: '방어도 +1, 매력 +1' },
  hunterhood: { name: '사냥꾼 두건', type: 'helm', price: 85, ac: 1, bonus: { hit: 1 }, desc: '방어도 +1, 명중 +1' },
  jadecrown:  { name: '옥 머리장식', type: 'helm', price: 220, ac: 2, bonus: { mp: 8, check: 1 }, desc: '방어도 +2, 마나 +8, 모든 판정 +1' },
  frosthelm:  { name: '서리늑대 투구', type: 'helm', price: 280, ac: 3, bonus: { con: 1 }, desc: '방어도 +3, 체질 +1' },
  ashhelm:    { name: '잿빛 투구', type: 'helm', price: 380, ac: 3, bonus: { str: 1, hp: 8 }, desc: '방어도 +3, 힘 +1, 체력 +8' },
  pearlhood:  { name: '진주 베일', type: 'helm', price: 360, ac: 2, bonus: { cha: 1, mp: 10, heal: 2 }, desc: '방어도 +2, 매력 +1, 마나 +10, 회복량 +2' },
  starcrown:  { name: '별의 관', type: 'helm', price: 700, ac: 3, bonus: { str: 1, dex: 1, int: 1, cha: 1, con: 1 }, desc: '방어도 +3, 모든 능력치 +1', grade: 4 },
  knighthelm: { name: '은사자 투구', type: 'helm', price: 0, ac: 3, bonus: { hp: 10, check: 1 }, desc: '기사단의 증표. 방어도 +3, 체력 +10, 모든 판정 +1', grade: 3 },
  tidecrown:  { name: '심해왕의 관', type: 'helm', price: 0, ac: 3, bonus: { mp: 12, spell: 2, con: 1 }, desc: '방어도 +3, 마나 +12, 주문 피해 +2, 체질 +1', grade: 4 },
  // 무기
  warhammer:  { name: '전투 망치', type: 'weapon', price: 150, dmg: '2d6', stat: 'str', hit: 1, desc: '명중 +1' },
  twinblades: { name: '쌍단검', type: 'weapon', price: 150, dmg: '1d8', stat: 'dex', hit: 2, bonus: { crit: 1 }, desc: '명중 +2, 치명타 범위 +1' },
  coralspear: { name: '산호 삼지창', type: 'weapon', price: 380, dmg: '2d8', stat: 'str', hit: 3, bonus: { chillon: 10 }, desc: '명중 +3, 빙결 10%' },
  tidebow:    { name: '조류의 활', type: 'weapon', price: 380, dmg: '2d6', stat: 'dex', hit: 3, bonus: { dmg: 2 }, desc: '명중 +3, 피해 +2' },
  pearlstaff: { name: '진주 지팡이', type: 'weapon', price: 380, dmg: '1d10', stat: 'int', hit: 3, bonus: { mp: 10, spell: 2 }, desc: '명중 +3, 마나 +10, 주문 피해 +2' },
  sirenblade: { name: '세이렌 현검', type: 'weapon', price: 380, dmg: '1d10', stat: 'dex', hit: 3, bonus: { cha: 1, spell: 1 }, desc: '명중 +3, 매력 +1, 주문 피해 +1' },
  ashaxe:     { name: '잿불 도끼', type: 'weapon', price: 520, dmg: '2d10', stat: 'str', hit: 3, bonus: { fire: 1 }, desc: '명중 +3, 화염 1d6' },
  cinderbow:  { name: '잿불 장궁', type: 'weapon', price: 520, dmg: '2d8', stat: 'dex', hit: 3, bonus: { fire: 1 }, desc: '명중 +3, 화염 1d6' },
  emberrod:   { name: '잉걸 홀', type: 'weapon', price: 520, dmg: '1d12', stat: 'int', hit: 3, bonus: { mp: 12, spell: 3 }, desc: '명중 +3, 마나 +12, 주문 피해 +3' },
  ashrapier:  { name: '재의 세검', type: 'weapon', price: 520, dmg: '2d6', stat: 'dex', hit: 4, bonus: { cha: 1, crit: 1 }, desc: '명중 +4, 매력 +1, 치명타 범위 +1' },
  stargreat:  { name: '별의 대검', type: 'weapon', price: 900, dmg: '3d8', stat: 'str', hit: 4, bonus: { dmg: 2 }, desc: '명중 +4, 피해 +2', grade: 4 },
  starbow:    { name: '별의 장궁', type: 'weapon', price: 900, dmg: '3d6', stat: 'dex', hit: 5, bonus: { crit: 1 }, desc: '명중 +5, 치명타 범위 +1', grade: 4 },
  starrod:    { name: '별의 홀', type: 'weapon', price: 900, dmg: '2d8', stat: 'int', hit: 4, bonus: { mp: 15, spell: 5 }, desc: '명중 +4, 마나 +15, 주문 피해 +5', grade: 4 },
  starrapier: { name: '별의 세검', type: 'weapon', price: 900, dmg: '2d8', stat: 'dex', hit: 5, bonus: { cha: 2, heal: 3 }, desc: '명중 +5, 매력 +2, 회복량 +3', grade: 4 },
  dawnblade:  { name: '새벽검 아우로라', type: 'weapon', price: 0, dmg: '2d10', stat: 'str', hit: 3, bonus: { heal: 3, check: 1 }, desc: '아델린의 검. 명중 +3, 회복량 +3, 모든 판정 +1', grade: 4 },
  krakenfang: { name: '크라켄 이빨', type: 'weapon', price: 0, dmg: '2d8', stat: 'dex', hit: 4, bonus: { lifesteal: 10 }, desc: '명중 +4, 흡혈 10%', grade: 4 },
  // 방어구
  brigandine: { name: '브리간딘', type: 'armor', price: 140, ac: 5, desc: '방어도 +5' },
  coralmail:  { name: '산호 갑옷', type: 'armor', price: 420, ac: 7, bonus: { con: 1 }, desc: '방어도 +7, 체질 +1' },
  tiderobe:   { name: '조류의 법의', type: 'armor', price: 400, ac: 5, bonus: { int: 1, mp: 12 }, desc: '방어도 +5, 지능 +1, 마나 +12' },
  shadowcloak:{ name: '그림자 외투', type: 'armor', price: 460, ac: 6, bonus: { dex: 2 }, desc: '방어도 +6, 민첩 +2' },
  ashplate:   { name: '잿빛 판금', type: 'armor', price: 560, ac: 8, bonus: { hp: 10 }, desc: '방어도 +8, 체력 +10' },
  starmail:   { name: '별빛 갑옷', type: 'armor', price: 950, ac: 9, bonus: { hp: 15, mp: 10 }, desc: '방어도 +9, 체력 +15, 마나 +10', grade: 4 },
  // 장신구
  rubyring:   { name: '홍옥 반지', type: 'acc', price: 200, bonus: { dmg: 2 }, desc: '무기 피해 +2' },
  sapphire:   { name: '청옥 목걸이', type: 'acc', price: 220, bonus: { spell: 2, mp: 6 }, desc: '주문 피해 +2, 마나 +6' },
  healerbead: { name: '치유사의 염주', type: 'acc', price: 200, bonus: { heal: 3, mp: 4 }, desc: '회복량 +3, 마나 +4' },
  ashenheart: { name: '재의 심장', type: 'acc', price: 0, bonus: { str: 2, con: 2, hp: 15 }, desc: '재의 왕이 남긴 심장. 힘 +2, 체질 +2, 체력 +15', grade: 4 },
  voidshard:  { name: '공허의 파편', type: 'acc', price: 0, bonus: { spell: 3, dmg: 3, hp: -8 }, desc: '피해 +3, 주문 피해 +3, 최대 체력 -8', grade: 3 },
  // 소모품
  megapotion: { name: '최상급 치유 물약', type: 'use', price: 90, use: { heal: '8d4+20' }, desc: '체력 8d4+20 회복' },
  hiether:    { name: '상급 마나 물약', type: 'use', price: 50, use: { mp: 20 }, desc: '마나 20 회복' }
});

/* 등급과 홈 수 */
for (const [id, it] of Object.entries(ITEMS)) {
  if (!['weapon', 'armor', 'helm', 'acc'].includes(it.type)) continue;
  if (it.grade === undefined) it.grade = it.price === 0 ? 3 : it.price >= 600 ? 4 : it.price >= 300 ? 3 : it.price >= 100 ? 2 : it.price >= 40 ? 1 : 0;
  if (['weapon', 'armor'].includes(it.type) && it.sockets === undefined) it.sockets = it.grade >= 3 ? 3 : it.grade >= 2 ? 2 : it.grade >= 1 ? 1 : 0;
}
for (const id of ['longsword', 'huntbow', 'rapier', 'oakstaff', 'leather']) ITEMS[id].sockets = 1;

/* 기존 지역 상점에 새 물건 */
REGIONS.central.shop.push('leathercap', 'ironhelm', 'circlet', 'brigandine', 'rune_true', 'rune_ward');
REGIONS.west.shop.push('hunterhood', 'featherhat', 'healerbead', 'rune_life', 'rune_wind');
REGIONS.south.shop.push('warhammer', 'twinblades', 'rubyring', 'rune_fire', 'rune_thorn', 'megapotion');
REGIONS.east.shop.push('jadecrown', 'sapphire', 'rune_wisdom', 'rune_luck', 'rune_frost', 'hiether');
REGIONS.north.shop.push('frosthelm', 'rune_blood', 'rune_edge', 'rune_might', 'megapotion', 'hiether');
