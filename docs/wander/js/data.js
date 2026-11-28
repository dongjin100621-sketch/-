'use strict';
/* 은빛 유랑기 — 규칙 데이터: 능력치, 직업, 기술, 아이템, 적 */

const STATS = {
  str: { name: '힘', short: '힘', desc: '무거운 것을 들고, 부수고, 버티는 힘' },
  dex: { name: '민첩', short: '민첩', desc: '은신, 함정 해제, 곡예, 활과 세검' },
  int: { name: '지능', short: '지능', desc: '고대 문자, 마법, 추리, 지식' },
  cha: { name: '매력', short: '매력', desc: '설득, 흥정, 노래, 첫인상' },
  con: { name: '체질', short: '체질', desc: '추위·더위·독을 견디는 몸, 최대 체력' }
};
const STAT_KEYS = ['str', 'dex', 'int', 'cha', 'con'];

const CLASSES = {
  sword: {
    name: '검사', icon: '⚔️', hitDie: 10, baseMp: 4, mpPer: 2,
    st: { str: 15, dex: 12, int: 9, cha: 10, con: 14 },
    gear: { weapon: 'longsword', armor: 'chain' }, items: { potion: 2, ration: 4 },
    skills: ['smite', 'guard'], learn: { 3: 'secondwind', 5: 'whirl', 7: 'titan' },
    trait: '단련된 몸: 최대 체력 +4, 힘 판정 +1',
    blurb: '장검과 사슬갑옷. 정면에서 버티고 베어 넘긴다.'
  },
  ranger: {
    name: '순찰자', icon: '🏹', hitDie: 8, baseMp: 6, mpPer: 2,
    st: { str: 11, dex: 15, int: 10, cha: 10, con: 13 },
    gear: { weapon: 'huntbow', armor: 'leather' }, items: { potion: 2, ration: 6 },
    skills: ['aimed', 'mark'], learn: { 3: 'volley', 5: 'secondwind', 7: 'starfall' },
    trait: '길잡이: 여행할 때 식량을 절반만 쓰고, 길 위 위험을 먼저 알아챈다',
    blurb: '활과 가죽옷. 길을 읽고 먼 곳에서 끝낸다.'
  },
  mage: {
    name: '마법사', icon: '🔮', hitDie: 6, baseMp: 12, mpPer: 4,
    st: { str: 8, dex: 12, int: 16, cha: 11, con: 11 },
    gear: { weapon: 'oakstaff', armor: 'robe' }, items: { potion: 2, ether: 2, ration: 4 },
    skills: ['bolt', 'fireball'], learn: { 3: 'frost', 5: 'ward', 7: 'chain' },
    trait: '박식: 지능 판정 +2, 고대 문자를 읽는다',
    blurb: '지팡이와 로브. 몸은 약하지만 주문 하나로 판을 뒤집는다.'
  },
  bard: {
    name: '음유시인', icon: '🎻', hitDie: 8, baseMp: 9, mpPer: 3,
    st: { str: 9, dex: 13, int: 11, cha: 16, con: 11 },
    gear: { weapon: 'rapier', armor: 'leather' }, items: { potion: 3, ration: 4 },
    skills: ['sting', 'healsong', 'charm'], learn: { 3: 'inspire', 5: 'discord', 7: 'requiem' },
    trait: '말솜씨: 매력 판정 +2, 상점에서 10% 싸게 산다',
    blurb: '세검과 류트. 노래로 사람을 움직이고 상처를 아물게 한다.'
  }
};

/* kind: atk(무기 공격 강화) multi(여러 번 공격) spell(자동 명중 피해) heal buff mark stun */
const SKILLS = {
  smite:      { name: '강타', mp: 2, kind: 'atk', hit: 2, extra: '1d8', desc: '명중 +2, 피해 +1d8' },
  guard:      { name: '방패 태세', mp: 2, kind: 'buff', buff: { ac: 4, turns: 3 }, desc: '3턴 동안 방어도 +4' },
  secondwind: { name: '재기', mp: 3, kind: 'heal', heal: '1d10+3', stat: 'con', desc: '체력 1d10+3+체질 회복' },
  whirl:      { name: '회오리 베기', mp: 4, kind: 'multi', n: 2, extra: '1d4', desc: '두 번 공격, 각각 피해 +1d4' },
  titan:      { name: '거인 베기', mp: 6, kind: 'atk', hit: 3, extra: '4d8', desc: '명중 +3, 피해 +4d8' },
  aimed:      { name: '조준 사격', mp: 2, kind: 'atk', hit: 5, extra: '1d6', desc: '명중 +5, 피해 +1d6' },
  mark:       { name: '사냥꾼의 표식', mp: 2, kind: 'mark', desc: '이번 전투 동안 적 방어도 -2' },
  volley:     { name: '연사', mp: 3, kind: 'multi', n: 2, extra: '0', desc: '두 번 쏜다' },
  starfall:   { name: '별비 화살', mp: 6, kind: 'spell', dmg: '5d6', stat: 'dex', desc: '하늘에서 화살비: 5d6+민첩 (자동 명중)' },
  bolt:       { name: '마력탄', mp: 1, kind: 'spell', dmg: '2d4', stat: 'int', desc: '자동 명중 2d4+지능' },
  fireball:   { name: '화염구', mp: 3, kind: 'spell', dmg: '3d6', stat: 'int', fire: true, desc: '자동 명중 3d6+지능, 식물·얼음에게 강함' },
  frost:      { name: '서리 결속', mp: 3, kind: 'spell', dmg: '2d6', stat: 'int', stun: 0.5, desc: '2d6+지능, 50% 확률로 적이 한 턴 얼어붙음' },
  ward:       { name: '비전 방벽', mp: 3, kind: 'buff', buff: { ac: 5, turns: 3 }, desc: '3턴 동안 방어도 +5' },
  chain:      { name: '번개 사슬', mp: 6, kind: 'spell', dmg: '6d6', stat: 'int', desc: '자동 명중 6d6+지능' },
  sting:      { name: '날 선 선율', mp: 2, kind: 'spell', dmg: '2d6', stat: 'cha', desc: '자동 명중 2d6+매력' },
  healsong:   { name: '치유의 선율', mp: 3, kind: 'heal', heal: '2d6+2', stat: 'cha', desc: '체력 2d6+2+매력 회복' },
  charm:      { name: '매혹의 노래', mp: 3, kind: 'stun', stat: 'cha', desc: '매력 판정에 성공하면 적이 2턴 멍해진다' },
  inspire:    { name: '용기의 노래', mp: 3, kind: 'buff', buff: { hit: 3, dmg: 2, turns: 4 }, desc: '4턴 동안 명중 +3, 피해 +2' },
  discord:    { name: '불협화음', mp: 4, kind: 'spell', dmg: '3d8', stat: 'cha', desc: '자동 명중 3d8+매력' },
  requiem:    { name: '진혼가', mp: 6, kind: 'spell', dmg: '5d8', stat: 'cha', desc: '자동 명중 5d8+매력, 망령에게 두 배' }
};

/* type: weapon armor acc use key */
const ITEMS = {
  // 소모품
  potion:   { name: '치유 물약', type: 'use', price: 15, use: { heal: '2d4+4' }, desc: '체력 2d4+4 회복' },
  hipotion: { name: '상급 치유 물약', type: 'use', price: 45, use: { heal: '4d4+10' }, desc: '체력 4d4+10 회복' },
  ether:    { name: '마나 물약', type: 'use', price: 20, use: { mp: 8 }, desc: '마나 8 회복' },
  antidote: { name: '해독제', type: 'use', price: 10, use: { cure: true, heal: '1d4' }, desc: '독을 씻어 낸다' },
  ration:   { name: '여행 식량', type: 'use', price: 3, use: { heal: '1d4', food: true }, desc: '하루치 식량. 여행과 야영에 필요하다' },
  elixir:   { name: '청령 영약', type: 'use', price: 120, use: { heal: '99', mp: 99, cure: true }, desc: '체력과 마나를 모두 회복' },
  bomb:     { name: '연금 화염병', type: 'use', price: 25, use: { bomb: '3d6' }, combatOnly: true, desc: '전투 중 적에게 3d6 화염 피해' },
  // 무기
  dagger:    { name: '단검', type: 'weapon', price: 8, dmg: '1d4', stat: 'dex', desc: '가볍고 어디에나 숨긴다' },
  longsword: { name: '장검', type: 'weapon', price: 25, dmg: '1d8', stat: 'str', desc: '기사단 표준 장검' },
  huntbow:   { name: '사냥활', type: 'weapon', price: 25, dmg: '1d8', stat: 'dex', desc: '물푸레나무 사냥활' },
  oakstaff:  { name: '참나무 지팡이', type: 'weapon', price: 15, dmg: '1d6', stat: 'int', bonus: { mp: 2 }, desc: '마나 +2' },
  rapier:    { name: '세검', type: 'weapon', price: 20, dmg: '1d6', stat: 'dex', hit: 1, desc: '명중 +1' },
  greatsword:{ name: '왕도 대검', type: 'weapon', price: 90, dmg: '2d6', stat: 'str', desc: '양손으로 휘두르는 대검' },
  starstaff: { name: '별빛 지팡이', type: 'weapon', price: 140, dmg: '1d8', stat: 'int', hit: 1, bonus: { mp: 6 }, desc: '명중 +1, 마나 +6' },
  elmbow:    { name: '엘름우드 장궁', type: 'weapon', price: 120, dmg: '1d10', stat: 'dex', hit: 1, desc: '숲의 장인이 깎은 장궁. 명중 +1' },
  scimitar:  { name: '사막 곡도', type: 'weapon', price: 110, dmg: '1d10', stat: 'dex', hit: 1, desc: '모래바람처럼 휘는 칼. 명중 +1' },
  lute_blade:{ name: '노래하는 세검', type: 'weapon', price: 150, dmg: '1d8', stat: 'dex', hit: 2, bonus: { cha: 1 }, desc: '명중 +2, 매력 +1' },
  jade_sword:{ name: '청옥검', type: 'weapon', price: 220, dmg: '2d6', stat: 'str', hit: 2, desc: '연화성 장인의 검. 명중 +2' },
  jade_staff:{ name: '연화 지팡이', type: 'weapon', price: 220, dmg: '1d10', stat: 'int', hit: 2, bonus: { mp: 8 }, desc: '명중 +2, 마나 +8' },
  frostbrand:{ name: '서리강철 대검', type: 'weapon', price: 320, dmg: '2d8', stat: 'str', hit: 2, desc: '북부 대장장이의 걸작. 명중 +2' },
  frostbow:  { name: '서리뿔 활', type: 'weapon', price: 300, dmg: '2d6', stat: 'dex', hit: 2, desc: '설인 뿔로 만든 활. 명중 +2' },
  // 보스 전리품
  ashfang:   { name: '재의 송곳니', type: 'weapon', price: 0, dmg: '1d10', stat: 'dex', hit: 2, desc: '볼크의 단도. 명중 +2' },
  rootheart: { name: '뿌리심장 지팡이', type: 'weapon', price: 0, dmg: '1d10', stat: 'int', hit: 2, bonus: { mp: 10 }, desc: '되살아난 고목의 심재. 명중 +2, 마나 +10' },
  sunspear:  { name: '태양창', type: 'weapon', price: 0, dmg: '2d8', stat: 'str', hit: 2, desc: '모래 여왕의 무덤에서 나온 창. 명중 +2' },
  // 방어구
  robe:      { name: '여행자 로브', type: 'armor', price: 10, ac: 1, desc: '방어도 +1' },
  leather:   { name: '가죽 갑옷', type: 'armor', price: 20, ac: 2, desc: '방어도 +2' },
  chain:     { name: '사슬 갑옷', type: 'armor', price: 60, ac: 4, desc: '방어도 +4' },
  elfsilk:   { name: '안개비단 외투', type: 'armor', price: 130, ac: 4, bonus: { dex: 1 }, desc: '방어도 +4, 민첩 +1' },
  desertmail:{ name: '사막 비늘갑옷', type: 'armor', price: 160, ac: 5, bonus: { con: 1 }, desc: '방어도 +5, 체질 +1' },
  plate:     { name: '판금 갑옷', type: 'armor', price: 260, ac: 6, desc: '방어도 +6' },
  lotusrobe: { name: '연화 법의', type: 'armor', price: 240, ac: 4, bonus: { mp: 8, int: 1 }, desc: '방어도 +4, 지능 +1, 마나 +8' },
  wolfcloak: { name: '서리늑대 망토', type: 'armor', price: 330, ac: 6, bonus: { con: 2 }, desc: '방어도 +6, 체질 +2' },
  // 장신구
  luckcoin:  { name: '행운의 동전', type: 'acc', price: 60, bonus: { check: 1 }, desc: '모든 판정 +1' },
  bellcharm: { name: '청령화 부적', type: 'acc', price: 80, bonus: { mp: 5 }, desc: '마나 +5' },
  ironring:  { name: '강철 반지', type: 'acc', price: 90, bonus: { ac: 1, hp: 6 }, desc: '방어도 +1, 최대 체력 +6' },
  dawnsigil: { name: '새벽의 휘장', type: 'acc', price: 0, bonus: { check: 1, hp: 8 }, desc: '기사단의 감사 표시. 모든 판정 +1, 최대 체력 +8' },
  dragonpearl:{ name: '용맥 구슬', type: 'acc', price: 0, bonus: { mp: 10, check: 1, ac: 1 }, desc: '모든 판정 +1, 방어도 +1, 마나 +10' },
  // 열쇠·이야기
  petal_central: { name: '금빛 꽃잎', type: 'key', desc: '중앙의 바람이 머문 청령화 꽃잎' },
  petal_west:    { name: '초록 꽃잎', type: 'key', desc: '서부의 바람이 머문 청령화 꽃잎' },
  petal_south:   { name: '주홍 꽃잎', type: 'key', desc: '남부의 바람이 머문 청령화 꽃잎' },
  petal_east:    { name: '연분홍 꽃잎', type: 'key', desc: '동부의 바람이 머문 청령화 꽃잎' },
  petal_north:   { name: '서리 꽃잎', type: 'key', desc: '북부의 바람이 머문 청령화 꽃잎' },
  oldmap:        { name: '낡은 사막 지도', type: 'key', desc: '태양의 무덤으로 가는 길이 그려져 있다' }
};

/* sp: poison drain heavy regen multi chill undead plant ice */
const ENEMIES = {
  dogs:     { name: '굶주린 들개 떼', hp: 10, ac: 11, hit: 3, dmg: '1d6', xp: 25, gold: [0, 2], desc: '갈비뼈가 드러난 들개들이 이빨을 드러낸다.' },
  bandit:   { name: '노상강도', hp: 13, ac: 12, hit: 3, dmg: '1d8', xp: 35, gold: [6, 14], desc: '녹슨 칼을 든 사내가 길을 막는다.' },
  sewerrat: { name: '수로 쥐왕', hp: 16, ac: 12, hit: 4, dmg: '1d6+1', xp: 40, gold: [2, 8], sp: ['poison'], desc: '고양이만 한 쥐가 꼬리로 물을 친다.' },
  shade:    { name: '그림자 도적', hp: 18, ac: 13, hit: 4, dmg: '1d8+1', xp: 50, gold: [10, 20], desc: '얼굴을 검은 천으로 감싼 도적.' },
  volk:     { name: '재의 손 볼크', hp: 38, ac: 13, hit: 4, dmg: '1d8+1', xp: 160, gold: [60, 60], boss: true, sp: ['multi'], desc: '타다 남은 장갑을 낀 도적 길드의 우두머리.' },

  thornwolf:{ name: '가시덩굴 늑대', hp: 20, ac: 12, hit: 4, dmg: '1d8+1', xp: 55, gold: [0, 4], sp: ['plant'], desc: '털 대신 가시덩굴이 자란 늑대.' },
  wisp:     { name: '안개 망령', hp: 18, ac: 14, hit: 5, dmg: '1d8+1', xp: 60, gold: [0, 0], sp: ['drain', 'undead'], desc: '형체 없는 안개 속에서 차가운 손이 뻗어 온다.' },
  mossgolem:{ name: '이끼 골렘', hp: 30, ac: 13, hit: 4, dmg: '1d10+2', xp: 70, gold: [5, 12], sp: ['plant', 'heavy'], desc: '바위와 이끼가 엉겨 붙은 거인.' },
  morg:     { name: '썩은 뿌리 모르그', hp: 56, ac: 14, hit: 5, dmg: '2d6', xp: 300, gold: [90, 90], boss: true, sp: ['plant', 'regen', 'poison'], desc: '고목과 하나가 된 타락한 드루이드.' },

  scorpion: { name: '모래 전갈', hp: 24, ac: 13, hit: 5, dmg: '1d8+2', xp: 70, gold: [0, 6], sp: ['poison'], desc: '수레바퀴만 한 전갈이 꼬리를 치켜든다.' },
  raider:   { name: '사막 약탈자', hp: 26, ac: 13, hit: 5, dmg: '1d10+2', xp: 75, gold: [15, 30], desc: '낙타 가죽을 두른 약탈자.' },
  mummy:    { name: '무덤 파수꾼', hp: 34, ac: 14, hit: 5, dmg: '1d10+3', xp: 90, gold: [10, 25], sp: ['undead', 'heavy'], desc: '붕대 사이로 금빛 눈이 빛난다.' },
  sirak:    { name: '모래 여왕 시라크', hp: 78, ac: 15, hit: 6, dmg: '2d6+3', xp: 450, gold: [140, 140], boss: true, sp: ['poison', 'heavy'], desc: '사구 아래에서 솟아오른 거대한 모래벌레의 여왕.' },

  ronin:    { name: '산적 무사', hp: 32, ac: 15, hit: 6, dmg: '1d10+3', xp: 95, gold: [20, 35], desc: '부러진 칼집을 찬 떠돌이 무사.' },
  foxwisp:  { name: '안개 여우령', hp: 30, ac: 15, hit: 6, dmg: '2d6+2', xp: 100, gold: [0, 10], sp: ['drain', 'undead'], desc: '꼬리 끝마다 푸른 불을 단 여우의 혼.' },
  guardian: { name: '석상 수호자', hp: 44, ac: 16, hit: 6, dmg: '2d8+2', xp: 120, gold: [0, 0], sp: ['heavy'], desc: '천 개 계단을 지키는 돌 사자.' },
  cheongun: { name: '석룡의 망령 청운', hp: 140, ac: 15, hit: 8, dmg: '2d6+3', xp: 600, gold: [180, 180], boss: true, sp: ['undead', 'heavy', 'multi'], desc: '끊어진 용맥에 묶인 산의 수호룡.' },

  frostwolf:{ name: '서리 늑대', hp: 36, ac: 15, hit: 7, dmg: '2d6+3', xp: 120, gold: [0, 6], sp: ['chill', 'ice'], desc: '입김마다 얼음 가루가 흩날린다.' },
  icedead:  { name: '얼음 망자', hp: 42, ac: 15, hit: 7, dmg: '2d8+2', xp: 135, gold: [10, 30], sp: ['undead', 'ice', 'chill'], desc: '얼음 속에 갇혀 죽은 병사가 일어선다.' },
  yeti:     { name: '설인', hp: 58, ac: 15, hit: 8, dmg: '2d8+4', xp: 170, gold: [10, 25], sp: ['ice', 'heavy'], desc: '눈보라처럼 하얀 털의 거구.' },
  hrimdal:  { name: '서리 거인 흐림달', hp: 185, ac: 16, hit: 9, dmg: '2d10+4', xp: 800, gold: [220, 220], boss: true, sp: ['ice', 'heavy', 'chill'], desc: '저주받은 왕관을 쓴 서리 거인.' },

  voidling: { name: '공허의 그림자', hp: 50, ac: 16, hit: 8, dmg: '2d8+3', xp: 200, gold: [20, 40], sp: ['drain'], desc: '빛을 먹는 검은 형체.' },
  nameless: { name: '공허의 사도 무명', hp: 250, ac: 18, hit: 11, dmg: '2d10+5', xp: 1200, gold: [500, 500], boss: true, sp: ['drain', 'heavy', 'multi'], desc: '다섯 지역의 재앙을 엮어 온, 이름을 버린 마법사.' }
};
