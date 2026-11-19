'use strict';
/* ────────────────────────────────────────────────────────────
   세계: 지역 9곳(왼쪽 끝 ↔ 오른쪽 끝으로 이어짐), NPC, 적, 상점
   ──────────────────────────────────────────────────────────── */
const GROUND = 690;   // 땅 높이(화면 좌표)

/* 사람·적 공통 그림 정보. sc = 화면 배율 */
const NPCS = {
  sera:  { n: '세라', title: '캡슐 속 소녀', spr: 'sera_idle', face: 'sera_face', sc: 0.82, c: '#ff8ad8' },
  kage:  { n: '카게', title: '픽서', spr: 'kage', face: 'kage_face', sc: 0.82, c: '#c9d2e3' },
  toto:  { n: '빅 토토', title: '무기상', spr: 'toto', face: 'toto_face', sc: 0.86, c: '#d6ff3e', shop: 'toto' },
  nova:  { n: '시스터 노바', title: '리퍼닥', spr: 'nova', face: 'nova_face', sc: 0.8, c: '#e8e0ff', shop: 'nova' },
  momo:  { n: '모모', title: '넷러너', spr: 'momo', face: 'momo_face', sc: 0.8, c: '#ff6ab8' },
  lyla:  { n: '라일라', title: '블루 문 가수', spr: 'lyla', face: 'lyla_face', sc: 0.8, c: '#b07cff', shop: 'lyla' },
  raven: { n: '레이븐', title: '운반책', spr: 'raven', face: 'raven_face', sc: 0.84, c: '#8fa3ff', shop: 'raven' },
};
/* 대화창 화자 */
const SPEAKERS = {
  kai: { n: '카이', face: 'kai_face', c: '#3ee8ff' },
  sera: { n: '세라', face: 'sera_face', c: '#ff8ad8' },
  kage: { n: '카게', face: 'kage_face', c: '#c9d2e3' },
  toto: { n: '빅 토토', face: 'toto_face', c: '#d6ff3e' },
  nova: { n: '시스터 노바', face: 'nova_face', c: '#e8e0ff' },
  momo: { n: '모모', face: 'momo_face', c: '#ff6ab8' },
  lyla: { n: '라일라', face: 'lyla_face', c: '#b07cff' },
  raven: { n: '레이븐', face: 'raven_face', c: '#8fa3ff' },
  red: { n: '레드 조', face: 'red_face', c: '#ff3b5c' },
  halo: { n: '헤일로', face: 'halo_face', c: '#a07cff' },
  sion: { n: '시온', face: 'halo_face', c: '#c9b6ff' },
  ora: { n: '오라클', face: 'ora_face', c: '#ffd36a' },
  sys: { n: '', face: null, c: '#9fb0d0' },
};

/* 적. ai: melee(근접), ranged(사격), dasher(돌진), brute(도약 강타), drone(비행) */
const ENEMIES = {
  thug:   { n: '쏘우팽 깡패', idle: 'thug_idle', atk: 'thug_atk', sc: 0.78, ai: 'melee', hp: 70, dmg: 15, spd: 150, def: 2, reach: 125, wind: 0.45, exp: 1 },
  gun:    { n: '검은 코트 총잡이', idle: 'gun_idle', atk: 'gun_atk', sc: 0.84, ai: 'ranged', hp: 58, dmg: 12, spd: 130, def: 1, reach: 520, wind: 0.65, exp: 1.1 },
  sin:    { n: '그림자 암살자', idle: 'sin_idle', atk: 'sin_atk', sc: 0.84, ai: 'dasher', hp: 62, dmg: 18, spd: 240, def: 2, reach: 340, wind: 0.5, exp: 1.2 },
  sec:    { n: '헬리오스 보안대', idle: 'sec_idle', atk: 'sec_atk', sc: 0.82, ai: 'ranged', burst: 3, hp: 115, dmg: 11, spd: 115, def: 8, reach: 560, wind: 0.7, exp: 1.4 },
  psy:    { n: '사이버사이코', idle: 'psy_idle', atk: 'psy_idle', sc: 0.86, ai: 'brute', hp: 150, dmg: 24, spd: 125, def: 5, reach: 420, wind: 0.7, exp: 1.6 },
  drone1: { n: '정찰 드론', idle: 'drone1', atk: 'drone1', sc: 0.95, ai: 'drone', fly: true, hp: 40, dmg: 11, spd: 170, def: 0, reach: 480, wind: 0.6, exp: 0.8 },
  drone2: { n: '공격 드론', idle: 'drone2', atk: 'drone2', sc: 1.0, ai: 'drone', fly: true, hp: 58, dmg: 14, spd: 190, def: 2, reach: 480, wind: 0.5, exp: 1.0 },
};

/* 보스 */
const BOSSES = {
  red:    { n: '레드 조', title: '쏘우팽 두목', idle: 'red_idle', atk: 'red_atk', sc: 1.08, lv: 12, hp: 5200, dmg: 45, def: 10, face: 'red_face', c: '#ff3b5c',
            drops: ['w_redjaw'] },
  halo:   { n: '헤일로', title: '헬리오스의 처형인', idle: 'halo_idle', atk: 'halo_atk', sc: 1.08, lv: 24, hp: 16000, dmg: 85, def: 22, face: 'halo_face', c: '#a07cff',
            drops: ['w_halo'] },
  oracle: { n: '오라클', title: '에덴의 시간', idle: 'ora_idle', atk: 'ora_atk', sc: 1.0, lv: 30, hp: 36000, dmg: 115, def: 30, face: 'ora_face', c: '#ffd36a',
            drops: ['h_crown', 'w_needle'] },
};

/* 지역. 왼쪽부터 오른쪽으로 이어진다.
   plat: [x, y, 너비] 위에서만 밟히는 발판
   pop: 일반 적 구성 / lv: 적 레벨 범위
   npcs: [{id, x, when(상태)}] / objs: 조사할 수 있는 물건 */
const MAPS = [
  { id: 'roof', n: '별빛 옥상', sub: '은신처 건물 꼭대기', w: 1700, theme: 'roof', safe: true, lv: [1, 1], plat: [[520, 560, 220], [1060, 540, 260]],
    npcs: [{ id: 'sera', x: 980, when: (S) => G.seraAt() === 'roof' }],
    objs: [] },
  { id: 'home', n: '카이의 은신처', sub: '하층 3구역 골목', w: 2000, theme: 'home', safe: true, lv: [1, 1], plat: [[300, 530, 240], [1300, 500, 300]],
    npcs: [{ id: 'sera', x: 1050, when: (S) => G.seraAt() === 'home' }],
    objs: [{ id: 'terminal', x: 640, n: '은신처 단말기', icon: '⌂', dlg: 'terminal' }] },
  { id: 'street', n: '네온 거리', sub: '하층 상업 지구', w: 2800, theme: 'street', safe: true, lv: [1, 1], plat: [[900, 520, 260], [1900, 500, 260]],
    npcs: [{ id: 'kage', x: 620 }, { id: 'toto', x: 1420 }, { id: 'nova', x: 2250 }],
    objs: [] },
  { id: 'market', n: '야시장', sub: '고가도로 입구의 노점 골목', w: 2800, theme: 'market', safe: true, lv: [3, 6], plat: [[700, 540, 220], [2100, 520, 240]],
    npcs: [{ id: 'lyla', x: 760 }, { id: 'momo', x: 1500 }, { id: 'raven', x: 2380, when: (S) => G.qState('m6') >= 0 || G.qDone('m5') }],
    objs: [] },
  { id: 'under', n: '고가도로 아래', sub: '쏘우팽 구역', w: 3800, theme: 'under', lv: [1, 6], pop: { types: ['thug', 'thug', 'drone1', 'gun'], n: 11 },
    plat: [[700, 520, 260], [1500, 470, 220], [2300, 520, 280], [3000, 480, 240]],
    objs: [{ id: 'capsule', x: 3560, n: '수상한 캡슐', icon: '◈', when: () => G.qStep('m1') === 2 },
           { id: 'shard1', x: 1900, n: '빛나는 조각', icon: '✧', dlg: 'shard1', flag: 'shard1', when: () => G.qActive('s7') && !G.flag('shard1') }] },
  { id: 'factory', n: '폐공장 지구', sub: '쏘우팽 소굴', w: 4200, theme: 'factory', lv: [6, 12], pop: { types: ['thug', 'gun', 'psy', 'drone1', 'drone2', 'thug'], n: 13 },
    plat: [[600, 500, 260], [1400, 450, 240], [2200, 500, 300], [2900, 440, 220]],
    boss: { id: 'red', x: 3950, when: () => G.qStep('m4') === 2 },
    objs: [{ id: 'shard2', x: 2500, n: '빛나는 조각', icon: '✧', dlg: 'shard2', flag: 'shard2', when: () => G.qActive('s7') && !G.flag('shard2') }] },
  { id: 'bridge', n: '스카이브릿지', sub: '상층으로 이어지는 유리 다리', w: 4200, theme: 'bridge', lv: [12, 20], pop: { types: ['sec', 'sin', 'drone2', 'sec', 'gun'], n: 14 },
    plat: [[800, 500, 260], [1700, 460, 260], [2600, 500, 260], [3400, 470, 240]],
    objs: [{ id: 'shard3', x: 2000, n: '빛나는 조각', icon: '✧', dlg: 'shard3', flag: 'shard3', when: () => G.qActive('s7') && !G.flag('shard3') }] },
  { id: 'tower', n: '헬리오스 타워', sub: '기업 본사 상층부', w: 4400, theme: 'tower', lv: [18, 26], pop: { types: ['sec', 'sec', 'sin', 'drone2', 'psy'], n: 15 },
    plat: [[700, 480, 280], [1600, 440, 260], [2500, 480, 280], [3200, 430, 240]],
    boss: { id: 'halo', x: 4150, when: () => G.qStep('m7') === 2 },
    objs: [] },
  { id: 'sanctum', n: '에덴 서버 성소', sub: '타워 꼭대기, 시간이 멈춘 곳', w: 2600, theme: 'sanctum', lv: [26, 30], pop: { types: ['sec', 'drone2', 'sin'], n: 5 },
    plat: [[700, 500, 240], [1420, 470, 260], [1880, 450, 260]],
    boss: { id: 'oracle', x: 2380, when: () => G.qStep('m8') === 1 },
    objs: [] },
];
const MAP = Object.fromEntries(MAPS.map((m, i) => [m.id, Object.assign(m, { idx: i })]));

/* 지역 사이 통행 조건. 오른쪽으로 넘어갈 때 막히면 이유를 돌려준다 */
function gateRight(mapId) {
  if (mapId === 'market' && G.qState('m1') < 1) return '아직 고가도로 아래로 갈 일이 없다. 먼저 네온 거리의 카게를 만나자.';
  if (mapId === 'under' && G.qState('m4') < 0) return '이 너머는 쏘우팽의 소굴, 폐공장 지구다. 지금은 갈 이유가 없다. (메인 퀘스트를 진행하세요)';
  if (mapId === 'factory' && !G.has('q_pass')) return '스카이브릿지 보안 게이트. 출입증이 필요하다.';
  if (mapId === 'bridge' && G.qState('m7') < 0) return '헬리오스 타워 입구. 지금 들어가기엔 준비가 부족하다.';
  if (mapId === 'tower' && !G.has('q_key')) return '봉인된 승강기. 접근 키가 필요하다.';
  return null;
}

/* 상점 */
function shopStock(id) {
  const it = (f) => ITEM_LIST.filter(f).map((x) => x.id);
  const prog = G.qDone('m4') ? 2 : 1;
  if (id === 'toto') return it((x) => (x.t === 'weapon' || x.t === 'gear') && x.g <= prog && !['w_dawn'].includes(x.id));
  if (id === 'nova') return ['u_bandage', 'u_medpen', 'u_medpen2', 'u_ram', 'u_ramxl', ...(prog >= 2 ? ['u_nanokit'] : [])].concat(it((x) => x.t === 'cyber' && x.g <= prog));
  if (id === 'lyla') return it((x) => (x.t === 'use' && x.g <= prog && !['u_bandage', 'u_medpen', 'u_medpen2', 'u_nanokit', 'u_ampoule', 'u_overdrive', 'u_singular'].includes(x.id)) || (x.t === 'gift' && x.g <= 2));
  if (id === 'raven') {
    if (!G.qDone('s6')) return [];
    const special = ['w_redjaw', 'w_halo', 'w_needle', 'w_dawn', 'h_crown', 'b_mended'];
    return it((x) => x.g === 3 && x.t !== 'quest' && !special.includes(x.id));
  }
  return [];
}
const SHOP_NAME = { toto: '토토의 총포상', nova: '노바의 진료소', lyla: '블루 문 바', raven: '레이븐의 기밀 창고' };
