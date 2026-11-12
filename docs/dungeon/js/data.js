'use strict';
/* 게임 자료: 층·테마, 몬스터, 아이템, 기술, 성장 곡선. */

const TITLE = '심연의 불씨';
const LAST_FLOOR = 10;

/* 테마: 타일 색(makeTiles 가 씀), 장식, 음악 */
const THEMES = {
  cave: {
    name: '이끼 동굴', bgm: 'cave',
    floor: ['#3a3328', '#433a2d', '#4c4232', '#2e2820'], wallTop: '#211c17', wallLine: '#5a4c39',
    brick: ['#5a4b39', '#6b5a44', '#4a3d2f'], mortar: '#2b241c', moss: '#3f6a34',
    deco: [['grass', 4], ['mushroom', 2], ['bones', 1]], liquid: 'water', light: [255, 214, 150]
  },
  crypt: {
    name: '잊힌 지하묘지', bgm: 'crypt',
    floor: ['#33323f', '#3b3a49', '#444354', '#2a2935'], wallTop: '#17161f', wallLine: '#4d4b60',
    brick: ['#4a4860', '#58566e', '#3d3b50'], mortar: '#1f1e2a', moss: '#3d4f5e',
    deco: [['bones', 3], ['skull', 2]], liquid: null, light: [190, 200, 255]
  },
  lava: {
    name: '불꽃 심층', bgm: 'lava',
    floor: ['#3b2622', '#452d27', '#4f332b', '#311f1c'], wallTop: '#1a0f0e', wallLine: '#6b3a2c',
    brick: ['#5e3328', '#703d2f', '#4c2a22'], mortar: '#241312', moss: '#8a3a1e',
    deco: [['crystal', 2], ['bones', 2]], liquid: 'lava', light: [255, 170, 110]
  },
  abyss: {
    name: '심연의 옥좌', bgm: 'crypt',
    floor: ['#2b2236', '#322840', '#3a2f4a', '#231c2d'], wallTop: '#110c18', wallLine: '#4e3a68',
    brick: ['#3f3056', '#4b3a66', '#33274a'], mortar: '#170f20', moss: '#5e36a0',
    deco: [['crystal', 3], ['skull', 1]], liquid: 'lava', light: [210, 170, 255]
  }
};

/* 층 설정. mon 은 [몬스터, 무게]. shop 은 상인이 있는 층, boss 는 보스 층. */
const FLOORS = {
  1: { theme: 'cave', mon: [['slime', 4], ['rat', 3], ['bat', 2]], count: 7 },
  2: { theme: 'cave', mon: [['slime', 3], ['rat', 2], ['bat', 3], ['goblin', 3], ['spider', 2]], count: 9 },
  3: { theme: 'cave', mon: [['bat', 2], ['goblin', 4], ['spider', 3], ['slime', 1]], count: 10, shop: true },
  4: { theme: 'crypt', mon: [['skeleton', 4], ['archer', 2], ['ghost', 2], ['slime_red', 3], ['goblin', 1]], count: 11 },
  5: { theme: 'crypt', mon: [['skeleton', 3], ['archer', 2], ['ghost', 2], ['slime_red', 2]], count: 7, boss: 'boneking' },
  6: { theme: 'crypt', mon: [['skeleton', 3], ['archer', 3], ['ghost', 3], ['ghoul', 3]], count: 12, shop: true, mimic: 0.35 },
  7: { theme: 'lava', mon: [['imp', 3], ['bat_fire', 3], ['golem', 2], ['ghoul', 2]], count: 12, mimic: 0.35 },
  8: { theme: 'lava', mon: [['imp', 3], ['bat_fire', 2], ['golem', 3], ['knight', 2]], count: 13, mimic: 0.4 },
  9: { theme: 'lava', mon: [['imp', 3], ['golem', 3], ['knight', 3], ['bat_fire', 2]], count: 13, shop: true, mimic: 0.4 },
  10: { theme: 'abyss', mon: [['knight', 2], ['imp', 2]], count: 4, boss: 'abyss' }
};

/* 몬스터
   spd: 100 이 보통(주인공과 같음), 200 은 두 번, 50 은 두 턴에 한 번 움직임
   eva: 회피율, erratic: 제멋대로 움직일 확률, ranged: 원거리 공격, phase: 벽을 통과
   poison: [확률, 턴, 턴당 피해] */
const MONSTERS = {
  slime:     { name: '초록 슬라임', spr: 'slime', hp: 9, atk: 3, def: 0, exp: 3, gold: [0, 3], sfx: 'squish' },
  rat:       { name: '동굴 쥐', spr: 'rat', hp: 6, atk: 3, def: 0, exp: 2, gold: [0, 2] },
  bat:       { name: '박쥐', spr: 'bat1', anim: ['bat1', 'bat2'], hp: 7, atk: 3, def: 0, spd: 200, eva: 0.2, erratic: 0.45, exp: 4, fly: true },
  goblin:    { name: '고블린', spr: 'goblin', hp: 15, atk: 5, def: 1, exp: 6, gold: [3, 10] },
  spider:    { name: '독거미', spr: 'spider', hp: 12, atk: 4, def: 1, exp: 7, poison: [0.35, 5, 1] },
  slime_red: { name: '붉은 슬라임', spr: 'slime_red', hp: 26, atk: 9, def: 2, exp: 10, gold: [2, 8], sfx: 'squish' },
  skeleton:  { name: '해골 병사', spr: 'skeleton', hp: 25, atk: 9, def: 3, exp: 11, gold: [3, 10], sfx: 'bone' },
  archer:    { name: '해골 궁수', spr: 'archer', hp: 18, atk: 8, def: 2, exp: 12, gold: [3, 10], ranged: { range: 5, proj: 'arrow' }, keepAway: true, sfx: 'bone' },
  ghost:     { name: '원혼', spr: 'ghost', hp: 19, atk: 9, def: 1, eva: 0.3, exp: 13, phase: true, fly: true },
  ghoul:     { name: '구울', spr: 'ghoul', hp: 36, atk: 11, def: 2, exp: 15, gold: [4, 12], poison: [0.25, 4, 2] },
  imp:       { name: '불꽃 임프', spr: 'imp', hp: 30, atk: 13, def: 3, exp: 18, gold: [5, 14], ranged: { range: 5, proj: 'fireball', magic: true }, keepAway: true },
  bat_fire:  { name: '화염 박쥐', spr: 'bat_fire1', anim: ['bat_fire1', 'bat_fire2'], hp: 24, atk: 12, def: 2, spd: 200, eva: 0.2, erratic: 0.35, exp: 15, fly: true },
  golem:     { name: '바위 골렘', spr: 'golem', hp: 76, atk: 21, def: 8, spd: 50, exp: 32, gold: [8, 20], sfx: 'rock' },
  knight:    { name: '암흑 기사', spr: 'knight', hp: 54, atk: 18, def: 7, exp: 30, gold: [10, 25] },
  mimic:     { name: '미믹', spr: 'mimic', hp: 46, atk: 16, def: 5, exp: 35, gold: [20, 40], disguise: true },
  boneking:  { name: '뼈의 기사왕', spr: 'boneking', big: true, boss: true, hp: 160, atk: 14, def: 5, exp: 120, gold: [80, 80], sfx: 'bone' },
  abyss:     { name: '심연의 군주', spr: 'abyss', big: true, boss: true, hp: 380, atk: 22, def: 9, exp: 0, gold: [0, 0], ranged: { range: 6, proj: 'shadowball', magic: true } }
};

/* 아이템
   kind: potion · scroll · weapon · armor · acc
   tier: 장비가 나오기 시작하는 깊이의 기준 (0~5) */
const ITEMS = {
  potion_heal:   { name: '회복 물약', kind: 'potion', spr: 'potion', price: 30, w: 8, desc: '체력을 최대치의 절반(최소 20) 회복하고 독을 없앤다.' },
  potion_mana:   { name: '마나 물약', kind: 'potion', spr: 'potion_blue', price: 30, w: 6, desc: '마나를 20 회복한다.' },
  potion_power:  { name: '힘의 물약', kind: 'potion', spr: 'potion_gold', price: 45, w: 3, desc: '30턴 동안 공격력이 6 오른다.' },
  potion_life:   { name: '생명의 물약', kind: 'potion', spr: 'potion_green', price: 160, w: 1, minDepth: 3, desc: '최대 체력이 영구히 8 오르고 체력을 모두 회복한다.' },
  scroll_teleport: { name: '순간이동 주문서', kind: 'scroll', spr: 'scroll_blue', price: 35, w: 4, desc: '이 층의 무작위 장소로 순간이동한다.' },
  scroll_map:    { name: '지도 주문서', kind: 'scroll', spr: 'scroll', price: 40, w: 3, desc: '이 층의 지도와 계단, 숨은 함정을 모두 밝힌다.' },
  scroll_fire:   { name: '화염 주문서', kind: 'scroll', spr: 'scroll_red', price: 55, w: 3, desc: '보이는 모든 적에게 불길을 쏟는다.' },
  scroll_enchant: { name: '강화 주문서', kind: 'scroll', spr: 'scroll_gold', price: 90, w: 2, desc: '장착한 무기나 갑옷을 +1 강화한다.' },
  scroll_sleep:  { name: '잠재우기 주문서', kind: 'scroll', spr: 'scroll_green', price: 40, w: 2, desc: '보이는 모든 적을 잠재운다. 보스에게는 듣지 않는다.' },

  dagger:        { name: '낡은 단검', kind: 'weapon', spr: 'dagger', atk: 2, tier: 0, price: 20 },
  sword:         { name: '철검', kind: 'weapon', spr: 'sword', atk: 4, tier: 1, price: 70 },
  axe:           { name: '전투 도끼', kind: 'weapon', spr: 'axe', atk: 6, tier: 2, price: 120 },
  dagger_blood:  { name: '흡혈 단검', kind: 'weapon', spr: 'dagger_blood', atk: 5, tier: 2, steal: 0.25, price: 160, desc: '준 피해의 25%만큼 체력을 빨아들인다.' },
  sword_knight:  { name: '기사의 장검', kind: 'weapon', spr: 'sword_knight', atk: 8, tier: 3, price: 200 },
  axe_war:       { name: '처형인의 도끼', kind: 'weapon', spr: 'axe_war', atk: 11, tier: 4, crit: 0.08, price: 300, desc: '치명타 확률 +8%.' },
  sword_rune:    { name: '룬 블레이드', kind: 'weapon', spr: 'sword_rune', atk: 11, tier: 4, mp: 10, price: 320, desc: '최대 마나 +10. 기술의 위력이 20% 오른다.', spell: 0.2 },
  sword_dragon:  { name: '용살자의 검', kind: 'weapon', spr: 'sword_dragon', atk: 15, tier: 5, price: 520 },

  armor_cloth:   { name: '천 옷', kind: 'armor', spr: 'armor_cloth', def: 1, tier: 0, price: 15 },
  armor_leather: { name: '가죽 갑옷', kind: 'armor', spr: 'armor_leather', def: 2, tier: 1, price: 60 },
  armor:         { name: '사슬 갑옷', kind: 'armor', spr: 'armor', def: 4, tier: 2, price: 120 },
  armor_plate:   { name: '판금 갑옷', kind: 'armor', spr: 'armor_plate', def: 6, tier: 3, price: 210 },
  armor_mithril: { name: '미스릴 갑옷', kind: 'armor', spr: 'armor_mithril', def: 8, tier: 4, eva: 0.05, price: 320, desc: '회피율 +5%.' },
  armor_dragon:  { name: '용린 갑옷', kind: 'armor', spr: 'armor_dragon', def: 10, tier: 5, fireRes: 0.5, price: 520, desc: '불·마법 피해를 절반으로 줄인다.' },

  ring_red:      { name: '힘의 반지', kind: 'acc', spr: 'ring_red', atk: 3, tier: 1, price: 140 },
  ring:          { name: '수호의 반지', kind: 'acc', spr: 'ring', def: 3, tier: 1, price: 140 },
  ring_green:    { name: '재생의 반지', kind: 'acc', spr: 'ring_green', regen: 2, tier: 2, price: 160, desc: '체력이 두 배 빨리 회복된다.' },
  ring_purple:   { name: '행운의 반지', kind: 'acc', spr: 'ring_purple', crit: 0.12, goldMul: 1.5, tier: 2, price: 170, desc: '치명타 확률 +12%, 얻는 금화 1.5배.' },
  amulet:        { name: '생명의 부적', kind: 'acc', spr: 'amulet', hp: 30, tier: 3, price: 220 },
  amulet_blue:   { name: '마나의 부적', kind: 'acc', spr: 'amulet_blue', mp: 15, mpRegen: 2, tier: 3, price: 220, desc: '최대 마나 +15, 마나가 두 배 빨리 찬다.' },

  ember:         { name: '첫 불씨', kind: 'quest', spr: 'ember', price: 0, desc: '마을을 지키던 첫 불씨. 아직 따스하다.' }
};

/* 기술: 레벨이 lv 에 닿으면 익힌다 */
const SKILLS = [
  { id: 'fire',  name: '화염구', lv: 1, mp: 4, icon: 'fireball', desc: '가장 가까운 적에게 불덩이를 던진다. 방어를 무시한다.' },
  { id: 'whirl', name: '회전 베기', lv: 3, mp: 5, icon: 'sword', desc: '주위 여덟 칸의 모든 적을 반드시 벤다.' },
  { id: 'heal',  name: '치유의 빛', lv: 5, mp: 7, icon: 'potion_green', desc: '체력을 40% 회복하고 독을 없앤다.' },
  { id: 'chain', name: '연쇄 번개', lv: 8, mp: 10, icon: 'bolt', desc: '보이는 적 최대 다섯에게 번개를 떨어뜨린다.' }
];

const START = { hp: 32, mp: 10, atk: 4, def: 1, crit: 0.06 };
const LEVEL_UP = { hp: 7, mp: 2, atk: 1 };   // 방어는 짝수 레벨마다 +1
const INV_SIZE = 16;
const expToNext = (lv) => Math.round(6 * Math.pow(lv, 1.6) + 4);

const STORY = {
  intro: [
    '백 년 동안 잿빛 마을을 지켜 온 「첫 불씨」가 하룻밤 사이에 사라졌다.',
    '불씨를 앗아 간 것은 땅 밑 열 층 아래, 심연의 옥좌에 앉은 군주.',
    '불이 꺼져 가는 마을에 남은 마지막 기사, 당신은 낡은 단검 하나를 들고 던전으로 내려간다.'
  ],
  floorIn: {
    1: '축축한 이끼 냄새. 어딘가에서 물방울이 떨어진다.',
    4: '공기가 차갑게 가라앉는다. 오래된 무덤의 층이다.',
    5: '뼈가 부딪는 소리가 멀리서 울린다. 이 층의 주인이 기다리고 있다.',
    7: '발밑이 뜨겁다. 갈라진 바위 틈으로 붉은 빛이 새어 나온다.',
    10: '모든 빛을 삼키는 어둠. 그 한가운데, 작은 불씨 하나가 깜빡인다.'
  },
  ending: [
    '군주가 쓰러지자 심연을 덮던 어둠이 물러갔다.',
    '당신의 손바닥 위에서 첫 불씨가 다시 환하게 타오른다.',
    '열 층의 계단을 거슬러 오르는 길, 불씨는 지나는 곳마다 꺼진 횃불에 불을 옮겨 붙였다.',
    '그날 밤, 잿빛 마을에 백 년 만에 따뜻한 불빛이 돌아왔다.'
  ]
};
