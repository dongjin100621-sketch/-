'use strict';
/* ────────────────────────────────────────────────────────────
   아이템 데이터 — 무기 48, 의상 36, 사이버웨어 48, 소모품 24, 선물 12 = 168종
   등급: 0 초급, 1 중급, 2 고급, 3 기밀
   ──────────────────────────────────────────────────────────── */
const GRADES = [
  { n: '초급', c: '#c9d2e3', glow: '#7d8aa6', m: 1.0, lv: 1, price: 1 },
  { n: '중급', c: '#3ee8ff', glow: '#1a9fd0', m: 1.9, lv: 6, price: 3.2 },
  { n: '고급', c: '#c77dff', glow: '#8a3cff', m: 3.4, lv: 14, price: 9 },
  { n: '기밀', c: '#ffb02e', glow: '#ff6a00', m: 5.6, lv: 22, price: 26 },
];

/* 무기 종류. rate=공격 간격(초), range=근접 사거리 또는 탄 사거리, attr=피해가 늘어나는 능력치 */
const WTYPES = {
  blade:    { n: '검',        base: 22, rate: 0.34, melee: true, range: 175, attr: 'reflex' },
  blunt:    { n: '둔기',      base: 31, rate: 0.52, melee: true, range: 165, attr: 'body', knock: 1.6 },
  arm:      { n: '사이버 암', base: 26, rate: 0.42, melee: true, range: 155, attr: 'body', knock: 1.2 },
  wire:     { n: '와이어',    base: 20, rate: 0.46, melee: true, range: 290, attr: 'intel' },
  pistol:   { n: '권총',      base: 18, rate: 0.30, range: 900, speed: 1500, attr: 'cool' },
  revolver: { n: '리볼버',    base: 36, rate: 0.62, range: 1000, speed: 1700, attr: 'cool' },
  smg:      { n: 'SMG',       base: 8,  rate: 0.09, range: 750, speed: 1400, spread: 0.07, attr: 'reflex' },
  shotgun:  { n: '샷건',      base: 11, rate: 0.78, range: 460, speed: 1300, pellets: 5, spread: 0.2, attr: 'body' },
  rifle:    { n: '소총',      base: 13, rate: 0.15, range: 1000, speed: 1700, spread: 0.03, attr: 'cool' },
  sniper:   { n: '저격총',    base: 72, rate: 1.10, range: 1400, speed: 2600, pierce: true, attr: 'cool' },
  launcher: { n: '런처',      base: 56, rate: 1.00, range: 900, speed: 900, boom: 150, attr: 'tech' },
};

/* 장비 능력치 단위 → 등급별 실제 수치 */
const STATSCALE = {
  atk: [4, 9, 17, 28], def: [6, 14, 26, 42], hp: [30, 70, 140, 240],
  crit: [3, 5, 8, 12], cdmg: [10, 18, 30, 45], spd: [3, 5, 8, 12], aspd: [4, 7, 11, 16],
  ram: [10, 20, 35, 55], ramr: [10, 20, 35, 55], regen: [1, 3, 6, 10], cdr: [3, 6, 10, 15],
  ls: [1, 2, 3, 5], dodge: [2, 4, 7, 10], exp: [5, 10, 15, 25], gold: [5, 10, 20, 30],
  hack: [5, 10, 18, 30], heal: [10, 20, 30, 45], ranged: [4, 8, 14, 22], melee: [4, 8, 14, 22],
};
const STATNAME = {
  atk: '공격력', def: '방어력', hp: '최대 체력', crit: '치명타 확률', cdmg: '치명타 피해', spd: '이동 속도',
  aspd: '공격 속도', ram: '최대 RAM', ramr: 'RAM 회복', regen: '초당 체력 회복', cdr: '재사용 대기 감소',
  ls: '흡혈', dodge: '회피', exp: '경험치 획득', gold: '크레딧 획득', hack: '스킬 피해', heal: '회복 아이템 효과',
  ranged: '원거리 피해', melee: '근접 피해',
};
const PCT = new Set(['crit', 'cdmg', 'spd', 'aspd', 'ramr', 'cdr', 'ls', 'dodge', 'exp', 'gold', 'hack', 'heal', 'ranged', 'melee']);

/* 특수 효과 */
const FXNAME = {
  burn: (v) => `적중 시 ${v}% 확률로 화상`,
  shock: (v) => `적중 시 ${v}% 확률로 감전(기절)`,
  pierce: () => '탄환이 적을 관통',
  home: () => '탄환이 가까운 적을 추적',
  multi: (v) => `한 번에 ${v}발 발사`,
  kh: (v) => `처치 시 체력 ${v}% 회복`,
  ls: (v) => `준 피해의 ${v}%만큼 체력 흡수`,
  ramhit: (v) => `적중 시 RAM ${v} 회복`,
  ultc: (v) => `필살기 게이지 충전 +${v}%`,
  thorns: (v) => `받은 피해의 ${v}%를 되돌려줌`,
  revive: () => '쓰러질 때 한 번 체력 40%로 되살아남(지역마다)',
  djump: () => '공중에서 한 번 더 점프',
  wave: () => '베기마다 검기가 날아감',
  boom: (v) => `적중 시 폭발(반경 ${v})`,
  exec: (v) => `체력 25% 이하 적에게 피해 +${v}%`,
  chrono: () => '체력 30% 이하가 되면 3초 동안 시간이 느려짐(60초마다)',
};

const ITEMS = {};
const ITEM_LIST = [];
function addItem(it) {
  it.id = it.id || ('i' + ITEM_LIST.length);
  ITEMS[it.id] = it;
  ITEM_LIST.push(it);
  return it;
}

/* ── 무기 48 ── [id, 이름, 등급, 종류, 배율, 특수효과, 설명] */
[
  ['w_pipe', '골목 쇠파이프', 0, 'blunt', 1.0, null, '고가도로 밑에서 주운 녹슨 파이프. 의외로 손에 잘 붙는다.'],
  ['w_knife', '전술 단검', 0, 'blade', 0.85, null, '군용 잉여품. 가볍고 빠르다.'],
  ['w_katana0', '연습용 카타나', 0, 'blade', 1.0, null, '도장에서 쓰던 무딘 날. 그래도 잘 갈면 쓸 만하다.'],
  ['w_bat', '야구 배트 \'홈런왕\'', 0, 'blunt', 1.05, null, '누군가 사인을 해 둔 알루미늄 배트.'],
  ['w_pistol0', 'M-9 \'레인\' 권총', 0, 'pistol', 1.0, null, '네오 서울에서 가장 흔한 권총. 비 오는 밤에도 잘 걸리지 않는다.'],
  ['w_rev0', '6연발 \'버디\' 리볼버', 0, 'revolver', 1.0, null, '할아버지 세대의 리볼버. 한 발 한 발이 묵직하다.'],
  ['w_smg0', '스트리트 SMG \'모기\'', 0, 'smg', 1.0, null, '골목 갱들이 즐겨 쓰는 싸구려 기관단총. 앵앵거린다.'],
  ['w_sg0', '펌프 샷건 \'덜컹이\'', 0, 'shotgun', 1.0, null, '장전할 때마다 덜컹 소리가 난다. 가까이서는 확실하다.'],
  ['w_rifle0', '순찰대 소총 P-7', 0, 'rifle', 1.0, null, '퇴역한 순찰대 소총. 탄창 바닥에 일련번호가 긁혀 있다.'],
  ['w_knuckle', '관절 강화 너클', 0, 'arm', 1.0, null, '손가락 관절에 심는 값싼 강화 장치.'],
  ['w_rivet', '개조 리벳 건', 0, 'pistol', 1.1, null, '공사용 리벳 건을 개조했다. 반동이 손목을 때린다.'],
  ['w_sniper0', '사냥용 저격총 \'올빼미\'', 0, 'sniper', 1.0, null, '외곽 사냥꾼의 소총. 조준경에 금이 가 있다.'],

  ['w_akane', '열선 카타나 \'아카네\'', 1, 'blade', 1.0, { burn: 12 }, '날에 열선이 흐르는 카타나. 베인 자리가 붉게 달아오른다.'],
  ['w_spark', '전기 곤봉 \'스파크\'', 1, 'blunt', 1.0, { shock: 12 }, '진압용 전기 곤봉. 손잡이의 고무가 닳아 있다.'],
  ['w_armblade', '접이식 암 블레이드', 1, 'arm', 1.05, null, '팔뚝 안쪽에서 튀어나오는 칼날. 소매를 걷을 필요가 없다.'],
  ['w_lockon', '스마트 권총 \'록온\'', 1, 'pistol', 0.95, { home: 1 }, '탄환이 스스로 표적을 찾아간다. 조준은 칩이 한다.'],
  ['w_thunder', '레일 리볼버 \'천둥\'', 1, 'revolver', 1.0, { pierce: 1 }, '전자기로 가속한 탄이 벽 하나쯤은 뚫고 지나간다.'],
  ['w_twins', '쌍발 SMG \'쌍둥이\'', 1, 'smg', 0.85, { multi: 2 }, '두 정을 이어 붙였다. 탄은 두 배, 정확도는 반.'],
  ['w_whale', '전술 샷건 \'고래\'', 1, 'shotgun', 1.0, null, '항만 경비대 샷건. 고래도 잡는다는 농담이 붙었다.'],
  ['w_hound', '돌격소총 \'하운드\'', 1, 'rifle', 1.0, null, '사설 경비업체의 표준 소총. 믿을 만하다.'],
  ['w_power', '파워 너클 암', 1, 'arm', 1.1, null, '유압식 팔. 한 방이면 자판기도 찌그러진다.'],
  ['w_piercer', '테크 저격총 \'관통자\'', 1, 'sniper', 1.0, null, '충전식 탄환이 장갑을 꿰뚫는다.'],
  ['w_wire1', '모노 와이어', 1, 'wire', 1.0, null, '손목에서 뻗는 분자 와이어. 멀리 있는 적도 벤다.'],
  ['w_redline', '바이크 체인 \'레드라인\'', 1, 'blunt', 1.05, { burn: 8 }, '폭주족이 오토바이에서 뜯어 낸 체인. 끝이 달궈져 있다.'],

  ['w_shiranui', '고주파 카타나 \'시라누이\'', 2, 'blade', 1.0, { ls: 1 }, '진동하는 날이 소리 없이 벤다. 피를 머금으면 날이 푸르게 빛난다.'],
  ['w_cutter', '플라즈마 커터', 2, 'blade', 0.95, { burn: 25 }, '공장용 절단기를 칼처럼 다듬었다.'],
  ['w_vertical', '열광학 암 블레이드 \'버티컬\'', 2, 'arm', 1.05, { exec: 30 }, '보이지 않는 칼날. 눈치챘을 땐 이미 늦었다.'],
  ['w_atlas', '중력 해머 \'아틀라스\'', 2, 'blunt', 1.05, { shock: 20 }, '내려치는 순간 중력장이 땅을 누른다.'],
  ['w_legion', '스마트 SMG \'군단\'', 2, 'smg', 1.0, { home: 1 }, '탄 하나하나에 작은 두뇌가 들어 있다.'],
  ['w_witness', '리볼버 \'최후의 증인\'', 2, 'revolver', 1.05, { exec: 40 }, '여섯 발. 증인은 언제나 마지막에 말한다.'],
  ['w_storm', '기관 샷건 \'폭풍\'', 2, 'shotgun', 1.0, null, '연사가 되는 샷건. 탄창이 무겁다.'],
  ['w_vx12', '레일 소총 \'VX-12\'', 2, 'rifle', 1.0, { pierce: 1 }, '헬리오스 보안대의 차세대 소총. 어떻게 여기까지 흘러왔을까.'],
  ['w_goose', '전자기 저격총 \'기러기\'', 2, 'sniper', 1.0, { shock: 30 }, '멀리서 날아와 정확히 꽂힌다.'],
  ['w_launcher', '팔뚝 미사일 런처', 2, 'launcher', 1.0, null, '팔 속에 접어 둔 소형 미사일. 터지면 골목이 밝아진다.'],
  ['w_web', '나노 와이어 \'거미줄\'', 2, 'wire', 1.0, { shock: 18 }, '전류가 흐르는 와이어. 붙잡힌 적이 경련한다.'],
  ['w_twinmoon', '듀얼 단검 \'쌍월\'', 2, 'blade', 0.9, { ls: 2 }, '두 개의 초승달. 춤추듯 휘두른다.'],

  ['w_nameless', '기밀 카타나 \'무명(無名)\'', 3, 'blade', 1.05, { ls: 3, wave: 1 }, '어느 장인이 이름을 남기지 않고 만든 칼. 휘두르면 검기가 날아간다.'],
  ['w_redjaw', '레드 조의 이빨', 3, 'blunt', 1.1, { burn: 30, ls: 2 }, '레드 조가 쓰던 회전 톱날. 아직 미나의 이름이 새겨져 있다.'],
  ['w_halo', '헤일로의 처형검', 3, 'blade', 1.1, { wave: 1, pierce: 1 }, '보라색 빛의 날. 시온은 이 칼로 동생을 지키겠다고 맹세했었다.'],
  ['w_needle', '에덴의 바늘', 3, 'sniper', 1.15, { pierce: 1, exec: 50 }, '오라클의 시계 바늘을 깎아 만든 탄. 시간을 꿰뚫는다.'],
  ['w_cannon', '핸드캐넌 \'폭주의 노래\'', 3, 'revolver', 1.1, { boom: 110 }, '한 발 쏠 때마다 노래 한 소절만큼 시끄럽다.'],
  ['w_echo', '프로토타입 레일건 \'에코\'', 3, 'sniper', 1.05, { pierce: 1, shock: 25 }, '쏘고 나면 메아리가 두 번 들린다.'],
  ['w_orpheus', '스마트 소총 \'오르페우스\'', 3, 'rifle', 1.0, { home: 1, multi: 2 }, '뒤돌아보지 않는 탄환. 반드시 닿는다.'],
  ['w_firefly', '양자 SMG \'반딧불\'', 3, 'smg', 1.05, { ramhit: 1, home: 1 }, '탄이 반딧불처럼 흩어졌다 모인다.'],
  ['w_sun', '플라즈마 샷건 \'태양\'', 3, 'shotgun', 1.05, { burn: 35 }, '가까이서 쏘면 작은 해가 뜬다.'],
  ['w_titan', '타이탄 암', 3, 'arm', 1.1, { shock: 25, thorns: 10 }, '전투용 외골격 팔. 맞받아친다.'],
  ['w_threadcut', '모노와이어 \'실 끊는 자\'', 3, 'wire', 1.05, { ls: 3, exec: 30 }, '운명의 실도 끊는다는 와이어.'],
  ['w_dawn', '약속의 칼날 \'새벽\'', 3, 'blade', 1.2, { ls: 4, wave: 1, ultc: 30 }, '세라가 고른 칼. 손잡이에 작은 리본이 묶여 있다. "돌아와요, 꼭."'],
].forEach(([id, n, g, wt, mod, fx, d]) => {
  const T = WTYPES[wt];
  addItem({ id, n, g, t: 'weapon', slot: 'weapon', wt, atk: Math.round(T.base * GRADES[g].m * mod), fx: fx || null, d,
    price: Math.round(90 * GRADES[g].price * mod), lv: GRADES[g].lv });
});

/* ── 의상 36 ── [id, 이름, 등급, 부위, {능력치 단위}, 특수효과, 설명] */
[
  ['h_beanie', '니트 비니', 0, 'head', { def: 0.6, hp: 0.5 }, null, '빗물이 스며들지 않는 합성 니트.'],
  ['h_goggle', '방풍 고글', 0, 'head', { def: 0.4, crit: 0.6 }, null, '오토바이 탈 때 쓰던 고글.'],
  ['h_cap', '야구 모자', 0, 'head', { def: 0.5, spd: 0.6 }, null, '챙에 네온 테이프를 둘렀다.'],
  ['b_jacket', '합성 가죽 재킷', 0, 'body', { def: 1.2, hp: 0.6 }, null, '하층에서 가장 흔한 재킷. 그래도 멋은 난다.'],
  ['b_hoodie', '방수 후드티', 0, 'body', { def: 1.0, hp: 1.0 }, null, '산성비도 한 시간은 버틴다.'],
  ['b_vest', '경비원 조끼', 0, 'body', { def: 1.5 }, null, '야간 경비원이 버리고 간 방탄 조끼.'],
  ['l_cargo', '카고 바지', 0, 'legs', { def: 0.8, hp: 0.4 }, null, '주머니가 열두 개.'],
  ['l_denim', '데님 바지와 운동화', 0, 'legs', { def: 0.6, spd: 0.6 }, null, '편한 게 최고다.'],
  ['l_boots', '작업화', 0, 'legs', { def: 1.0 }, null, '강철 앞코가 든 공장 작업화.'],

  ['h_visor', '네온 바이저', 1, 'head', { def: 0.6, crit: 0.8 }, null, '시야에 표적 정보를 띄운다.'],
  ['h_bcap', '방탄 캡', 1, 'head', { def: 1.0, hp: 0.6 }, null, '평범한 모자처럼 보이는 방탄모.'],
  ['h_headset', '넷러너 헤드셋', 1, 'head', { def: 0.4, ram: 0.8, hack: 0.6 }, null, '모모가 쓰던 것과 같은 모델.'],
  ['b_trench', '방탄 트렌치코트', 1, 'body', { def: 1.3, hp: 0.8 }, null, '비에 젖은 코트 자락이 펄럭인다.'],
  ['b_rider', '라이딩 재킷', 1, 'body', { def: 1.0, spd: 0.8 }, null, '등에 번개 무늬 자수.'],
  ['b_tac', '전술 조끼', 1, 'body', { def: 1.5, ranged: 0.6 }, null, '탄창 주머니가 가득하다.'],
  ['l_cargo2', '강화 카고 바지', 1, 'legs', { def: 1.0, hp: 0.6 }, null, '무릎에 충격 흡수 패드.'],
  ['l_spring', '스프링 부츠', 1, 'legs', { def: 0.5, spd: 1.0 }, null, '발걸음이 가볍다.'],
  ['l_kevlar', '방탄 레깅스', 1, 'legs', { def: 1.2, dodge: 0.5 }, null, '얇지만 질기다.'],

  ['h_owl', '전술 헬멧 \'올빼미눈\'', 2, 'head', { def: 1.0, crit: 0.8 }, null, '어둠 속에서도 표적이 보인다.'],
  ['h_holo', '홀로 마스크', 2, 'head', { def: 0.6, dodge: 1.0 }, null, '얼굴을 홀로그램으로 가린다. 적이 헷갈린다.'],
  ['h_samurai', '사무라이 반가면', 2, 'head', { def: 0.8, melee: 0.8, cdmg: 0.5 }, null, '입을 가리는 금속 가면. 옛 록밴드의 상징이었다.'],
  ['b_nano', '나노섬유 코트', 2, 'body', { def: 1.3, hp: 1.0 }, null, '총알이 닿는 순간 섬유가 굳는다.'],
  ['b_corp', '기업 보안 슈트', 2, 'body', { def: 1.7, ranged: 0.5 }, null, '헬리오스 로고를 뜯어냈다.'],
  ['b_optic', '광섬유 롱코트', 2, 'body', { def: 1.1, spd: 0.6, crit: 0.5 }, null, '움직일 때마다 빛이 흐른다.'],
  ['l_mag', '자기 부츠', 2, 'legs', { def: 1.0, spd: 0.8 }, null, '자석처럼 땅을 붙잡고 밀어낸다.'],
  ['l_combat', '케블라 전투복 하의', 2, 'legs', { def: 1.4, hp: 0.6 }, null, '군용 규격.'],
  ['l_silent', '소음 부츠', 2, 'legs', { def: 0.6, crit: 0.8, spd: 0.4 }, null, '발소리가 나지 않는다. 암살자들이 좋아한다.'],

  ['h_obsidian', '\'흑요석\' 나노 후드', 3, 'head', { def: 1.0, hp: 0.8, cdmg: 0.6 }, null, '빛을 삼키는 검은 후드.'],
  ['h_crown', '오라클의 관', 3, 'head', { def: 0.8, hack: 1.0, cdr: 0.8 }, null, '시간을 재던 금빛 고리. 이제는 그저 장식일 뿐.'],
  ['h_ghost', '사이버 고스트 마스크', 3, 'head', { def: 0.6, dodge: 1.0, crit: 0.6 }, null, '유령처럼 사라지는 마스크.'],
  ['b_blackwave', '블랙 웨이브 롱코트', 3, 'body', { def: 1.4, hp: 1.0, spd: 0.4 }, null, '파란 안감이 비치는 검은 코트. 카이에게 잘 어울린다.'],
  ['b_exo', '헬리오스 시제품 외골격', 3, 'body', { def: 2.0, melee: 0.6 }, { thorns: 15 }, '군사용 외골격. 맞는 쪽이 아프다.'],
  ['b_mended', '세라가 수선한 재킷', 3, 'body', { def: 1.3, hp: 1.2, regen: 0.6 }, null, '찢어진 곳마다 서툰 바느질. 따뜻하다.'],
  ['l_gravity', '그래비티 부츠', 3, 'legs', { def: 0.8, spd: 0.8 }, { djump: 1 }, '공중을 한 번 더 밟는다.'],
  ['l_phase', '위상 하의', 3, 'legs', { def: 1.0, dodge: 1.2 }, null, '맞는 순간 몸이 잠깐 어긋난다.'],
  ['l_shadow', '섀도우 스텝 부츠', 3, 'legs', { def: 0.8, spd: 1.0, crit: 0.6 }, null, '그림자에서 그림자로.'],
].forEach(([id, n, g, slot, u, fx, d]) => addItem({ id, n, g, t: 'gear', slot, u, fx, d, price: Math.round(70 * GRADES[g].price), lv: GRADES[g].lv }));

/* ── 사이버웨어 48 ── 슬롯: os(운영체제), nerve(신경계), frame(골격·순환계), eye(안구) */
[
  ['c_deck0', '중고 넷덱 \'깡통\'', 0, 'os', { ram: 1, hack: 0.6 }, null, '전 주인이 스티커를 덕지덕지 붙였다.'],
  ['c_react0', '반응 보조 OS', 0, 'os', { aspd: 1 }, null, '손이 생각보다 먼저 움직인다.'],
  ['c_combat0', '전투 보조 칩', 0, 'os', { atk: 1 }, null, '싸구려지만 없는 것보다 낫다.'],
  ['c_deck1', '넷덱 \'모모 커스텀\'', 1, 'os', { ram: 1, ramr: 1, hack: 0.6 }, null, '모모가 직접 손본 넷덱. 토끼 스티커가 붙어 있다.'],
  ['c_rage1', '레이지 코어 Mk.1', 1, 'os', { atk: 1, melee: 0.6 }, null, '분노를 출력으로 바꾸는 운영체제.'],
  ['c_chrono1', '크로노 엔진 Mk.1', 1, 'os', { aspd: 0.8, cdr: 0.6 }, { ultc: 10 }, '세상이 아주 조금 느리게 보인다.'],
  ['c_deck2', '넷덱 \'스펙터\'', 2, 'os', { ram: 1, hack: 1 }, { ramhit: 1 }, '유령처럼 남의 시스템에 스며든다.'],
  ['c_rage2', '레이지 코어 Mk.3', 2, 'os', { atk: 1, melee: 0.8 }, { ls: 1 }, '피를 볼수록 강해진다.'],
  ['c_chrono2', '크로노 엔진 Mk.3', 2, 'os', { aspd: 0.8, cdr: 0.8 }, { ultc: 20 }, '빗방울 하나하나가 멈춰 보인다.'],
  ['c_akashic', '넷덱 \'아카식\'', 3, 'os', { ram: 1.2, hack: 1.2, ramr: 0.8 }, { ramhit: 2 }, '모든 기록에 닿는 넷덱. 헬리오스가 숨기던 물건.'],
  ['c_asura', '레이지 코어 \'아수라\'', 3, 'os', { atk: 1.2, melee: 0.8, aspd: 0.6 }, { ls: 2 }, '팔이 여섯 개가 된 기분이다.'],
  ['c_eternal', '크로노 엔진 \'영원\'', 3, 'os', { aspd: 1, cdr: 1 }, { chrono: 1, ultc: 30 }, '위험이 닥치면 시간이 멈춘다.'],

  ['n_kz1', '반사 촉진기 v1', 0, 'nerve', { crit: 1 }, null, '척수에 심는 반사 신경 촉진기.'],
  ['n_calm', '신경 안정 패치', 0, 'nerve', { def: 0.6, hp: 0.6 }, null, '손떨림이 멎는다.'],
  ['n_syn0', '시냅스 증폭기', 0, 'nerve', { aspd: 0.6, hack: 0.6 }, null, '생각이 조금 빨라진다.'],
  ['n_kz2', '반사 촉진기 v2', 1, 'nerve', { crit: 1, aspd: 0.5 }, null, '총알이 날아오는 게 보인다.'],
  ['n_pain', '통증 차단기', 1, 'nerve', { def: 1, hp: 0.6 }, null, '아프지 않다. 그래서 위험하다.'],
  ['n_accel', '신경 가속기', 1, 'nerve', { spd: 1, aspd: 0.4 }, null, '발이 먼저 나간다.'],
  ['n_kz3', '반사 촉진기 v3', 2, 'nerve', { crit: 1, dodge: 0.8 }, null, '몸이 알아서 피한다.'],
  ['n_oc', '시냅스 오버클럭', 2, 'nerve', { cdr: 1, hack: 0.6 }, null, '머리가 뜨겁다. 그래도 빠르다.'],
  ['n_adren', '아드레날린 펌프', 2, 'nerve', { atk: 0.6, aspd: 0.6 }, { kh: 3 }, '적을 쓰러뜨릴 때마다 몸이 회복된다.'],
  ['n_zero', '\'제로 레이턴시\'', 3, 'nerve', { crit: 1.2, aspd: 0.8, dodge: 0.6 }, null, '생각과 행동 사이의 간격이 0이 된다.'],
  ['n_light', '\'광속 신경\'', 3, 'nerve', { spd: 1.2, crit: 0.8, cdr: 0.6 }, null, '빛보다 빠르다는 건 과장이지만, 거의 그렇다.'],
  ['n_angel', '\'천사의 신경망\'', 3, 'nerve', { hack: 1, cdr: 1, ram: 0.6 }, { ramhit: 1 }, '머릿속에서 누군가 노래한다.'],

  ['f_sub1', '피하 장갑 1형', 0, 'frame', { def: 1.2 }, null, '피부 아래 얇은 장갑판.'],
  ['f_tendon', '강화 힘줄', 0, 'frame', { spd: 0.6, hp: 0.6 }, null, '점프가 조금 높아진다.'],
  ['f_bio', '바이오 모니터', 0, 'frame', { regen: 1, heal: 0.6 }, null, '몸 상태를 늘 확인해 준다.'],
  ['f_sub2', '피하 장갑 2형', 1, 'frame', { def: 1.2, hp: 0.5 }, null, '총알을 튕겨 낸다. 가끔은.'],
  ['f_titan', '티타늄 골격', 1, 'frame', { hp: 1.2, melee: 0.5 }, null, '뼈가 부러지지 않는다.'],
  ['f_pump', '혈액 펌프', 1, 'frame', { heal: 1, regen: 0.6 }, null, '회복약이 더 빨리 돈다.'],
  ['f_sub3', '피하 장갑 3형', 2, 'frame', { def: 1.3, hp: 0.6 }, null, '군용 규격 장갑판.'],
  ['f_heart', '보조 심장', 2, 'frame', { hp: 0.8 }, { revive: 1 }, '첫 번째 심장이 멈추면, 두 번째가 뛴다.'],
  ['f_nano', '나노 수복기', 2, 'frame', { regen: 1.2, heal: 0.6 }, null, '상처가 저절로 메워진다.'],
  ['f_immortal', '\'불사의 심장\'', 3, 'frame', { hp: 1.2, regen: 0.8 }, { revive: 1 }, '몇 번이고 다시 뛴다.'],
  ['f_adamant', '\'아다만트 골격\'', 3, 'frame', { def: 1.4, hp: 1.0 }, { thorns: 10 }, '세상에서 가장 단단한 뼈.'],
  ['f_gravity', '\'그래비티 힘줄\'', 3, 'frame', { spd: 1.0, def: 0.8 }, { djump: 1 }, '중력을 거스르는 다리.'],

  ['e_cheap', '저가형 광학 렌즈', 0, 'eye', { crit: 1 }, null, '시장 노점에서 산 렌즈. 가끔 화면이 깜빡인다.'],
  ['e_night', '야간 투시 렌즈', 0, 'eye', { crit: 0.6, dodge: 0.6 }, null, '어두운 골목도 낮처럼.'],
  ['e_range', '거리 측정 렌즈', 0, 'eye', { ranged: 1 }, null, '표적까지 거리를 알려 준다.'],
  ['e_ballistic', '탄도 보조 광학', 1, 'eye', { ranged: 1, crit: 0.5 }, null, '탄도를 미리 그려 준다.'],
  ['e_threat', '위협 분석 렌즈', 1, 'eye', { cdmg: 1, crit: 0.5 }, null, '적의 약점이 붉게 빛난다.'],
  ['e_scanner', '스캐너 아이', 1, 'eye', { exp: 1, crit: 0.5 }, null, '모든 것을 기록하고 배운다.'],
  ['e_holo', '홀로 조준 광학', 2, 'eye', { ranged: 1, crit: 0.8 }, null, '홀로그램 조준선이 떠오른다.'],
  ['e_weak', '약점 분석 아이', 2, 'eye', { cdmg: 1.2, crit: 0.6 }, null, '어디를 찔러야 할지 보인다.'],
  ['e_market', '시장 분석 렌즈', 2, 'eye', { gold: 1, exp: 0.6 }, null, '값나가는 것만 눈에 들어온다.'],
  ['e_god', '\'신의 눈\'', 3, 'eye', { crit: 1.2, cdmg: 1 }, null, '모든 것이 보인다. 너무 많이.'],
  ['e_deadeye', '\'데드아이 렌즈\'', 3, 'eye', { ranged: 1.2, crit: 1 }, { exec: 30 }, '조준하는 순간 결과가 정해진다.'],
  ['e_omega', '\'오메가 광학\'', 3, 'eye', { crit: 1, exp: 1, gold: 1 }, null, '마지막 렌즈. 세상의 값어치가 숫자로 보인다.'],
].forEach(([id, n, g, slot, u, fx, d]) => addItem({ id, n, g, t: 'cyber', slot, u, fx, d, price: Math.round(85 * GRADES[g].price), lv: GRADES[g].lv }));

/* ── 소모품 24 ── use: heal(HP 비율 또는 고정), ram, buff{스탯:값, 초}, grenade{피해배율, 효과}, warp */
[
  ['u_bandage', '응급 붕대', 0, { healFlat: 80 }, 25, '피만 멎으면 된다.'],
  ['u_medpen', '메드펜', 0, { heal: 0.3 }, 45, '목에 꽂는 1회용 회복 주사.'],
  ['u_medpen2', '메드펜 플러스', 1, { heal: 0.5 }, 140, '고농도 회복 주사. 따끔하다.'],
  ['u_nanokit', '나노 메디킷', 2, { heal: 0.75, regenBuff: 8 }, 380, '나노 기계가 상처를 꿰맨다.'],
  ['u_ampoule', '기밀 재생 앰플', 3, { heal: 1, regenBuff: 15 }, 1200, '헬리오스 연구소의 시제품. 죽음 직전에서도 돌아온다.'],
  ['u_ram', '램 부스터', 0, { ram: 30 }, 40, '머리가 맑아지는 주사.'],
  ['u_ramxl', '램 부스터 XL', 1, { ram: 999 }, 160, 'RAM을 가득 채운다.'],
  ['u_ramen', '합성 라면', 0, { heal: 0.15, regenBuff: 4 }, 20, '하층의 영혼 음식. 국물까지 다 마셔야 한다.'],
  ['u_skewer', '길거리 꼬치', 0, { heal: 0.2 }, 30, '무슨 고기인지는 묻지 않는 게 좋다.'],
  ['u_bubble', '네온 버블티', 1, { heal: 0.1, buff: { spd: 20 }, dur: 30 }, 90, '펄이 빛난다. 마시면 발이 가벼워진다.'],
  ['u_volt', '에너지 드링크 \'볼트\'', 0, { buff: { aspd: 15 }, dur: 30 }, 60, '심장이 두 배로 뛴다.'],
  ['u_burger', '진짜 소고기 버거', 2, { heal: 0.5, buff: { atk: 15 }, dur: 60 }, 420, '진짜 소고기라니. 상층 사람들만 먹는 줄 알았다.'],
  ['u_cocktail', '블루 문 칵테일', 1, { buff: { crit: 15 }, dur: 45 }, 120, '라일라가 만들어 주는 파란 칵테일.'],
  ['u_stim', '전투 자극제', 1, { buff: { atk: 20 }, dur: 30 }, 150, '분노를 병에 담았다.'],
  ['u_guard', '방어 자극제', 1, { buff: { def: 30 }, dur: 30 }, 150, '피부가 단단해지는 느낌.'],
  ['u_reflex', '반사 촉진 앰플', 2, { buff: { crit: 25, aspd: 15 }, dur: 30 }, 360, '세상이 느려진다.'],
  ['u_bounce', '바운스 인젝터', 2, { heal: 0.35, buff: { def: 40 }, dur: 20 }, 300, '쓰러져도 튀어 오른다.'],
  ['u_overdrive', '기밀 \'오버드라이브\'', 3, { heal: 0.5, buff: { atk: 35, crit: 20, aspd: 20, spd: 20 }, dur: 30 }, 1500, '모든 한계를 30초 동안 지운다.'],
  ['u_frag', '프래그 수류탄', 0, { grenade: 2.2 }, 60, '던지고, 숨는다.'],
  ['u_emp', 'EMP 수류탄', 1, { grenade: 1.2, stun: 2.5 }, 160, '전자 장비를 멈춘다. 드론에게 특히 효과적.'],
  ['u_fire', '화염 수류탄', 1, { grenade: 1.6, burn: 1 }, 160, '골목이 잠깐 대낮이 된다.'],
  ['u_toxic', '생체독 수류탄', 2, { grenade: 2.0, burn: 1, stun: 1 }, 380, '초록 연기. 숨 쉬지 마라.'],
  ['u_singular', '기밀 \'특이점 수류탄\'', 3, { grenade: 5, pull: 1, stun: 1.5 }, 1400, '작은 블랙홀. 주변의 모든 것을 끌어당긴다.'],
  ['u_warp', 'SOS 귀환 칩', 1, { warp: 1 }, 120, '은신처로 즉시 돌아간다.'],
].forEach(([id, n, g, use, price, d]) => addItem({ id, n, g, t: 'use', use, price, d, stack: true }));

/* ── 선물 12 ── 세라에게 주면 호감도가 오른다. like: 1 좋아함, 2 아주 좋아함, 0 그럭저럭 */
[
  ['g_candy', '네온 솜사탕', 0, 1, 40, '야시장의 명물. 입에 넣으면 혀가 빛난다.'],
  ['g_cat', '길고양이 인형', 0, 1, 60, '골목에서 자주 보던 삼색 고양이를 닮았다.'],
  ['g_camera', '고장난 필름 카메라', 0, 0, 50, '셔터가 눌리지 않는다. 그래도 예쁘다.'],
  ['g_holo', '홀로 꽃다발', 1, 1, 180, '시들지 않는 꽃. 하지만 향기도 없다.'],
  ['g_lp', '빈티지 LP \'서울 1999\'', 1, 1, 220, '아무도 모르는 밴드의 마지막 음반.'],
  ['g_perfume', '체리 블라썸 향수', 1, 0, 200, '봄이 없는 도시에서 봄 냄새.'],
  ['g_scarf', '따뜻한 목도리', 1, 2, 240, '손으로 뜬 목도리. 이 도시에서 손으로 뜬 건 귀하다.'],
  ['g_projector', '별자리 프로젝터', 2, 2, 520, '천장에 진짜 밤하늘을 띄운다. 네오 서울에선 별이 보이지 않으니까.'],
  ['g_musicbox', '오르골 \'달빛\'', 2, 1, 480, '태엽을 감으면 오래된 자장가가 흐른다.'],
  ['g_flower', '진짜 생화 한 송이', 2, 2, 600, '흙에서 자란 진짜 꽃. 상층 온실에서 몰래 가져왔다고 한다.'],
  ['g_photo', '즉석 사진 인화 키트', 2, 1, 450, '함께 찍은 사진을 손에 쥘 수 있다.'],
  ['g_ring', '은반지 \'약속\'', 3, 2, 2400, '안쪽에 작은 글씨로 새겨져 있다. "어느 세상에서도."'],
].forEach(([id, n, g, like, price, d]) => addItem({ id, n, g, t: 'gift', like, price, d, stack: true }));

/* ── 퀘스트 물건 (판매 불가, 개수에 넣지 않음) ── */
[
  ['q_capsule', '의문의 캡슐 키', '쏘우팽이 지키던 캡슐의 열쇠. 헬리오스 로고가 찍혀 있다.'],
  ['q_bolt', '볼트의 부품', '빅 토토의 로봇 볼트에서 떨어져 나온 부품.'],
  ['q_med', '의약품 상자', '시스터 노바의 진료소로 가던 의약품.'],
  ['q_case', '레이븐의 가방', '단단히 잠긴 은색 가방. 열어 보지 않는 게 좋다.'],
  ['q_shard', '기억의 조각', '세라의 기억이 담긴 작은 데이터 결정.'],
  ['q_pass', '위조 출입증', '스카이브릿지 보안 게이트를 통과할 수 있는 출입증.'],
  ['q_part', '드론 코어', '드론의 심장부. 모모가 깡총이 업그레이드에 쓴다.'],
  ['q_key', '성소 접근 키', '시온이 남긴 열쇠. 에덴 서버 성소로 가는 문을 연다.'],
].forEach(([id, n, d]) => { ITEMS[id] = { id, n, g: 1, t: 'quest', d, stack: true, price: 0 }; });

const SLOTS = [
  { k: 'weapon', n: '무기' }, { k: 'head', n: '머리' }, { k: 'body', n: '상의' }, { k: 'legs', n: '하의' },
  { k: 'os', n: '운영체제' }, { k: 'nerve', n: '신경계' }, { k: 'frame', n: '골격' }, { k: 'eye', n: '안구' },
];
const TYPE_TAB = [
  { k: 'all', n: '전체' }, { k: 'weapon', n: '무기' }, { k: 'gear', n: '의상' }, { k: 'cyber', n: '사이버웨어' },
  { k: 'use', n: '소모품' }, { k: 'gift', n: '선물' }, { k: 'quest', n: '퀘스트' },
];

/* 아이템 하나의 실제 장비 능력치 */
function itemStats(it) {
  const s = {};
  if (it.u) for (const k in it.u) s[k] = Math.round(STATSCALE[k][it.g] * it.u[k] * 10) / 10;
  return s;
}
function itemDesc(it) {
  const lines = [];
  if (it.t === 'weapon') {
    const T = WTYPES[it.wt];
    lines.push(`${T.n} · 공격력 ${it.atk}` + (T.pellets ? ` ×${T.pellets}` : '') + ` · 초당 ${(1 / T.rate).toFixed(1)}회`);
  }
  const st = itemStats(it);
  for (const k in st) lines.push(`${STATNAME[k]} +${st[k]}${PCT.has(k) ? '%' : ''}`);
  if (it.fx) for (const k in it.fx) lines.push('✦ ' + FXNAME[k](it.fx[k]));
  if (it.t === 'use') {
    const u = it.use;
    if (u.heal) lines.push(`체력 ${Math.round(u.heal * 100)}% 회복`);
    if (u.healFlat) lines.push(`체력 ${u.healFlat} 회복`);
    if (u.regenBuff) lines.push(`10초 동안 초당 체력 ${u.regenBuff} 회복`);
    if (u.ram) lines.push(u.ram >= 999 ? 'RAM 가득 회복' : `RAM ${u.ram} 회복`);
    if (u.buff) lines.push(Object.entries(u.buff).map(([k, v]) => `${STATNAME[k]} +${v}%`).join(', ') + ` (${u.dur}초)`);
    if (u.grenade) lines.push(`던지면 폭발 (공격력의 ${Math.round(u.grenade * 100)}%)` + (u.stun ? ` · 기절 ${u.stun}초` : '') + (u.burn ? ' · 화상' : '') + (u.pull ? ' · 끌어당김' : ''));
    if (u.warp) lines.push('은신처로 귀환');
  }
  if (it.t === 'gift') lines.push(['세라가 그럭저럭 좋아할 선물', '세라가 좋아할 선물', '세라가 아주 좋아할 선물'][it.like]);
  return lines;
}
