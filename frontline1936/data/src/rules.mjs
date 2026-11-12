/* 규칙 데이터: 지형, 상품, 건물, 장비, 대대, 사단 편제, 함선, 항공기, 기술, 법, 국가 정신, 경제 상수.
 * 모든 수치는 이 게임을 위해 정한 설계값이다. */

export const TERRAIN = {
  p: { name: '평야', attack: 1, width: 90, move: 1, def: 0 },
  h: { name: '구릉', attack: .8, width: 80, move: 1.3, def: .1 },
  m: { name: '산악', attack: .6, width: 70, move: 1.8, def: .25 },
  f: { name: '삼림', attack: .8, width: 80, move: 1.4, def: .1 },
  j: { name: '밀림', attack: .7, width: 70, move: 1.7, def: .15 },
  d: { name: '사막', attack: .95, width: 90, move: 1.2, def: 0 },
  s: { name: '습지', attack: .7, width: 70, move: 1.6, def: .1 },
  u: { name: '도시', attack: .7, width: 96, move: 1.1, def: .3 }
};

/* 시장 상품. price: 기준가격(재화 단위), world: 세계시장(price 배율, 공급국 몫), need: 가계 수요(소득 탄력성 e). */
export const GOODS = [
  { id: 'grain', name: '곡물', price: 10, world: { price: 1, suppliers: { usa: .25, australia: .2, siam: .15, france: .15, other: .25 } }, need: { e: .4 } },
  { id: 'coal', name: '석탄', price: 12, world: { price: 1, suppliers: { usa: .2, uk: .2, australia: .15, ussr: .1, other: .35 } } },
  { id: 'iron', name: '철광석', price: 12, world: { price: 1, suppliers: { usa: .25, uk: .2, australia: .15, china: .1, other: .3 } } },
  { id: 'oil', name: '석유', price: 20, world: { price: 1, suppliers: { usa: .6, netherlands: .15, ussr: .1, uk: .05, other: .1 } } },
  { id: 'rubber', name: '고무', price: 25, world: { price: 1, suppliers: { uk: .45, netherlands: .35, france: .1, siam: .05, other: .05 } } },
  { id: 'rare', name: '희소 금속', price: 40, world: { price: 1, suppliers: { china: .35, uk: .25, netherlands: .15, usa: .1, other: .15 } } },
  { id: 'steel', name: '강철', price: 30, world: { price: 1.05, suppliers: { usa: .45, uk: .2, france: .1, other: .25 } } },
  { id: 'fuel', name: '연료', price: 30, world: { price: 1.05, suppliers: { usa: .6, netherlands: .15, uk: .1, other: .15 } }, need: { e: 1.1 } },
  { id: 'textiles', name: '직물·의복', price: 20, world: { price: 1, suppliers: { uk: .3, japan: .3, usa: .15, other: .25 } }, need: { e: .8 } },
  { id: 'consumer', name: '생활용품', price: 30, world: { price: 1.05, suppliers: { usa: .4, uk: .25, japan: .1, other: .25 } }, need: { e: 1.3 } },
  { id: 'tools', name: '공구·기계', price: 40, world: { price: 1.1, suppliers: { usa: .5, uk: .25, other: .25 } } },
  { id: 'explosives', name: '화약·화학', price: 30, world: { price: 1.1, suppliers: { usa: .5, uk: .2, other: .3 } } }
];

/* 건물. jobs: 단계당 일자리(1만 명 단위)와 계층. pm: 생산방식(투입·산출은 단계당 한 달). kind: market(시장에 판다)·gov(정부가 운영)·construction(건설점).
 * cost: 건설점. res: 채굴 건물이 필요로 하는 지역 자원. */
export const BUILDINGS = [
  { id: 'farm', name: '농장', kind: 'market', category: 'agri', cost: 30, cap: 'arable', owner: 'land', jobs: { farmers: 20 }, pm: [{ name: '전통 농법', in: {}, out: { grain: 30 } }, { name: '비료 농법', unlock: 'fertilizer', in: { explosives: 1 }, out: { grain: 40 } }] },
  { id: 'coal', name: '탄광', kind: 'market', category: 'resource', cost: 40, res: 'coal', owner: 'business', jobs: { workers: 10 }, pm: [{ name: '수작업 채탄', in: { tools: .3 }, out: { coal: 12 } }] },
  { id: 'iron', name: '철광산', kind: 'market', category: 'resource', cost: 40, res: 'iron', owner: 'business', jobs: { workers: 10 }, pm: [{ name: '노천 채광', in: { tools: .3 }, out: { iron: 12 } }] },
  { id: 'oil', name: '유전', kind: 'market', category: 'resource', cost: 50, res: 'oil', owner: 'business', jobs: { workers: 6 }, pm: [{ name: '시추', in: { tools: .5 }, out: { oil: 14 } }] },
  { id: 'rubber', name: '고무 농장', kind: 'market', category: 'resource', cost: 35, res: 'rubber', owner: 'business', jobs: { farmers: 14 }, pm: [{ name: '라텍스 채취', in: {}, out: { rubber: 9 } }] },
  { id: 'rare', name: '희소 금속 광산', kind: 'market', category: 'resource', cost: 45, res: 'rare', owner: 'business', jobs: { workers: 8 }, pm: [{ name: '선광', in: { tools: .3 }, out: { rare: 4 } }] },
  { id: 'steel', name: '제철소', kind: 'market', category: 'heavy', cost: 60, owner: 'business', jobs: { workers: 8 }, pm: [{ name: '평로', in: { iron: 10, coal: 8 }, out: { steel: 10 } }, { name: '전로·압연', unlock: 'steel_process', in: { iron: 10, coal: 8, tools: .5 }, out: { steel: 13 } }] },
  { id: 'refinery', name: '정유소', kind: 'market', category: 'heavy', cost: 50, owner: 'business', jobs: { workers: 4 }, pm: [{ name: '상압 증류', in: { oil: 12 }, out: { fuel: 11 } }] },
  { id: 'synthetic', name: '인조 석유 공장', kind: 'market', category: 'heavy', cost: 70, owner: 'business', tech: 'synthetic_fuel', jobs: { workers: 8 }, pm: [{ name: '석탄 액화', in: { coal: 18, tools: .5 }, out: { fuel: 7 } }] },
  { id: 'light', name: '경공업', kind: 'market', category: 'light', cost: 40, owner: 'business', jobs: { workers: 12 }, pm: [{ name: '방직·잡화', in: { coal: 2 }, out: { textiles: 8, consumer: 4 } }, { name: '기계화 공장', unlock: 'mass_production', in: { coal: 2, tools: .5 }, out: { textiles: 10, consumer: 6 } }] },
  { id: 'tools', name: '기계 공장', kind: 'market', category: 'heavy', cost: 60, owner: 'business', jobs: { workers: 8 }, pm: [{ name: '범용 공작기계', in: { steel: 6, coal: 3 }, out: { tools: 6 } }, { name: '정밀 가공', unlock: 'machine_tools', in: { steel: 6, coal: 3 }, out: { tools: 8 } }] },
  { id: 'chem', name: '화학 공장', kind: 'market', category: 'heavy', cost: 55, owner: 'business', jobs: { workers: 6 }, pm: [{ name: '석탄 화학', in: { coal: 8 }, out: { explosives: 6 } }] },
  { id: 'civ', name: '민간 공장', kind: 'construction', category: 'construction', cost: 90, owner: 'business', jobs: { workers: 10 }, pm: [{ name: '건설 작업', points: 5, materials: { steel: .35, tools: .15 } }] },
  { id: 'arms', name: '군수 공장', kind: 'gov', category: 'military', cost: 75, owner: 'state', jobs: { workers: 10 }, pm: [{ name: '생산 라인' }] },
  { id: 'dock', name: '조선소', kind: 'gov', category: 'military', cost: 70, owner: 'state', jobs: { workers: 10 }, pm: [{ name: '선박 건조', in: { steel: 3, tools: .8 } }] }
];
/* 지역 시설(건설점으로 짓는다). */
export const FACILITIES = [
  { id: 'infra', name: '기반 시설', cost: 25, max: 10 },
  { id: 'air', name: '비행장', cost: 15, max: 10 },
  { id: 'port', name: '해군 기지', cost: 30, max: 10, coastal: true },
  { id: 'fort', name: '요새', cost: 20, max: 10 }
];

/* 군 장비. cost: 생산점(군수 공장 1곳이 하루에 1점, 효율이 곱해진다). recipe: 이 장비 라인에 배치된 공장 1곳이 한 달에 사는 물자. */
export const EQUIPMENT = [
  { id: 'inf_eq', name: '소화기', cost: .5, recipe: { steel: 2 }, levels: ['inf_eq1', 'inf_eq2', 'inf_eq3'] },
  { id: 'support_eq', name: '지원 장비', cost: 4, recipe: { steel: 1, tools: 1 } },
  { id: 'artillery', name: '화포', cost: 3.5, recipe: { steel: 2, rare: .5 }, levels: ['art1', 'art2', 'art3'] },
  { id: 'at_gun', name: '대전차포', cost: 4, recipe: { steel: 2, rare: 1 }, tech: 'at1' },
  { id: 'aa_gun', name: '대공포', cost: 4, recipe: { steel: 2, rare: .5 }, tech: 'aa1' },
  { id: 'motor', name: '차량', cost: 2.5, recipe: { steel: 1, rubber: 2 } },
  { id: 'armor', name: '전차', cost: 9, recipe: { steel: 3, rare: 1, rubber: .5 }, levels: ['tank1', 'tank2', 'tank3'] },
  { id: 'fighter', name: '전투기', cost: 22, recipe: { tools: 2, rubber: 1 }, levels: ['fighter1', 'fighter2', 'fighter3'], air: true },
  { id: 'cas', name: '근접 지원기', cost: 24, recipe: { tools: 2, rubber: 1, explosives: .5 }, levels: ['cas1', 'cas2'], air: true },
  { id: 'bomber', name: '폭격기', cost: 40, recipe: { tools: 3, rubber: 1, explosives: .5 }, levels: ['bomber1', 'bomber2'], air: true },
  { id: 'naval_bomber', name: '뇌격기', cost: 30, recipe: { tools: 2, rubber: 1, explosives: .5 }, levels: ['nav1', 'nav2'], air: true }
];

/* 대대·중대. 수치는 한 대대(지원 중대는 한 중대). width: 전투 폭, speed: 하루에 갈 수 있는 거리(지도 단위), fuel: 하루 연료(1,000 단위). */
export const BATTALIONS = [
  { id: 'infantry', name: '보병', line: true, hp: 25, org: 60, soft: 6, hard: 1, def: 22, brk: 3, armor: 0, pierce: 4, hardness: 0, width: 2, speed: 22, supply: .06, manpower: 1000, eq: { inf_eq: 100 } },
  { id: 'artillery', name: '포병', line: true, hp: 1, org: 0, soft: 24, hard: 2, def: 10, brk: 6, armor: 0, pierce: 5, hardness: 0, width: 3, speed: 22, supply: .2, manpower: 500, eq: { artillery: 12, inf_eq: 20 } },
  { id: 'cavalry', name: '기병', line: true, hp: 25, org: 70, soft: 5, hard: 1, def: 20, brk: 5, armor: 0, pierce: 4, hardness: 0, width: 2, speed: 32, supply: .07, manpower: 1000, eq: { inf_eq: 120 } },
  { id: 'mountain', name: '산악 보병', line: true, hp: 20, org: 70, soft: 6, hard: 1, def: 24, brk: 3, armor: 0, pierce: 4, hardness: 0, width: 2, speed: 22, supply: .07, manpower: 1000, eq: { inf_eq: 120, support_eq: 10 }, terrain: { m: .25, h: .15 }, tech: 'mountaineers' },
  { id: 'marine', name: '해병', line: true, hp: 20, org: 70, soft: 6, hard: 1, def: 23, brk: 3, armor: 0, pierce: 4, hardness: 0, width: 2, speed: 22, supply: .07, manpower: 1000, eq: { inf_eq: 120, support_eq: 10 }, amphibious: .5, terrain: { j: .1 }, tech: 'marines' },
  { id: 'motorized', name: '차량화 보병', line: true, hp: 25, org: 60, soft: 6, hard: 1, def: 23, brk: 4, armor: 0, pierce: 4, hardness: .1, width: 2, speed: 55, supply: .1, fuel: .3, manpower: 1200, eq: { inf_eq: 100, motor: 35 }, tech: 'motorized' },
  { id: 'armor', name: '전차', line: true, hp: 2, org: 10, soft: 16, hard: 7, def: 4, brk: 30, armor: 20, pierce: 22, hardness: .8, width: 2, speed: 40, supply: .25, fuel: .8, manpower: 500, eq: { armor: 50, motor: 10 }, tech: 'tank1' },
  { id: 'engineer', name: '공병 중대', support: true, hp: 2, org: 20, soft: 2, hard: 0, def: 8, brk: 2, armor: 0, pierce: 2, hardness: 0, width: 0, speed: 22, supply: .03, manpower: 300, eq: { support_eq: 10, inf_eq: 10 }, entrench: .1 },
  { id: 'recon', name: '정찰 중대', support: true, hp: 2, org: 20, soft: 2, hard: 0, def: 4, brk: 2, armor: 0, pierce: 2, hardness: 0, width: 0, speed: 32, supply: .03, manpower: 200, eq: { inf_eq: 30, support_eq: 5 }, initiative: .1 },
  { id: 'support_art', name: '지원 포병 중대', support: true, hp: .5, org: 0, soft: 12, hard: 1, def: 6, brk: 2, armor: 0, pierce: 5, hardness: 0, width: 0, speed: 22, supply: .1, manpower: 300, eq: { artillery: 6 } },
  { id: 'anti_tank', name: '대전차 중대', support: true, hp: .5, org: 0, soft: 2, hard: 8, def: 4, brk: 1, armor: 0, pierce: 40, hardness: 0, width: 0, speed: 22, supply: .05, manpower: 300, eq: { at_gun: 10 }, tech: 'at1' },
  { id: 'anti_air', name: '대공 중대', support: true, hp: .5, org: 0, soft: 2, hard: 2, def: 4, brk: 1, armor: 0, pierce: 10, hardness: 0, width: 0, speed: 22, supply: .05, manpower: 300, eq: { aa_gun: 10 }, aa: 15, tech: 'aa1' }
];

/* 시작 편제(나라별). bat: 전선 대대, sup: 지원 중대. 플레이어는 사단 설계 창에서 새 편제를 만든다. */
export const TEMPLATES = [
  { id: 'jp_inf', country: 'japan', name: '보병 사단', bat: { infantry: 8, artillery: 2 }, sup: ['engineer', 'recon'] },
  { id: 'jp_cav', country: 'japan', name: '기병 여단', bat: { cavalry: 4 }, sup: [] },
  { id: 'jp_garrison', country: 'japan', name: '수비대', bat: { infantry: 4 }, sup: [] },
  { id: 'jp_marine', country: 'japan', name: '해군 특별 육전대', bat: { infantry: 4 }, sup: ['engineer'], amphibiousBonus: .3 },
  { id: 'cn_central', country: 'china', name: '중앙군 사단', bat: { infantry: 6, artillery: 1 }, sup: ['engineer'] },
  { id: 'cn_regional', country: 'china', name: '지방군 사단', bat: { infantry: 6 }, sup: [] },
  { id: 'ccp_guerrilla', country: 'ccp', name: '홍군 유격대', bat: { infantry: 3, cavalry: 1 }, sup: ['recon'] },
  { id: 'su_rifle', country: 'ussr', name: '소총 사단', bat: { infantry: 7, artillery: 2 }, sup: ['engineer'] },
  { id: 'su_cav', country: 'ussr', name: '기병 사단', bat: { cavalry: 4 }, sup: [] },
  { id: 'su_tank', country: 'ussr', name: '기계화 여단', bat: { armor: 3, motorized: 2 }, sup: ['recon'] },
  { id: 'us_inf', country: 'usa', name: '보병 사단', bat: { infantry: 6, artillery: 2 }, sup: ['engineer', 'recon'] },
  { id: 'us_marine', country: 'usa', name: '해병 여단', bat: { infantry: 4 }, sup: ['engineer'], amphibiousBonus: .3 },
  { id: 'ph_army', country: 'usa', name: '필리핀 연방군 사단', bat: { infantry: 6 }, sup: [] },
  { id: 'uk_inf', country: 'uk', name: '보병 여단', bat: { infantry: 4, artillery: 1 }, sup: ['engineer'] },
  { id: 'in_div', country: 'uk', name: '인도 사단', bat: { infantry: 6, artillery: 1 }, sup: ['engineer'] },
  { id: 'mk_inf', country: 'manchukuo', name: '만주국군 혼성 여단', bat: { infantry: 4 }, sup: [] },
  { id: 'mk_cav', country: 'mengjiang', name: '몽강 기병', bat: { cavalry: 3 }, sup: [] },
  { id: 'wl_div', country: '*', name: '군벌 사단', bat: { infantry: 5 }, sup: [] },
  { id: 'wl_cav', country: '*', name: '군벌 기병', bat: { cavalry: 3 }, sup: [] },
  { id: 'mn_cav', country: 'mongolia', name: '몽골 기병 사단', bat: { cavalry: 4 }, sup: [] },
  { id: 'th_inf', country: 'siam', name: '시암 보병 사단', bat: { infantry: 5, artillery: 1 }, sup: [] },
  { id: 'fr_colonial', country: 'france', name: '식민지 보병 사단', bat: { infantry: 5, artillery: 1 }, sup: [] },
  { id: 'fr_inf', country: 'france', name: '보병 사단', bat: { infantry: 6, artillery: 2 }, sup: ['engineer'] },
  { id: 'knil', country: 'netherlands', name: '동인도 육군 사단', bat: { infantry: 5 }, sup: [] },
  { id: 'nl_inf', country: 'netherlands', name: '보병 사단', bat: { infantry: 6, artillery: 1 }, sup: [] },
  { id: 'au_inf', country: '*', name: '민병 사단', bat: { infantry: 6, artillery: 1 }, sup: [] },
  { id: 'garrison_generic', country: '*', name: '수비대', bat: { infantry: 2 }, sup: [] },
  { id: 'kla', country: 'china', name: '한국광복군', bat: { infantry: 3 }, sup: ['recon'] },
  { id: 'kr_inf', country: 'korea', name: '보병 사단', bat: { infantry: 6, artillery: 1 }, sup: [] }
];

/* 함선. cost: 조선소 생산점(조선소 1곳이 하루에 1점). gun: 포격, torp: 어뢰, air: 함재기 공격, aa: 대공, asw: 대잠. */
export const SHIPS = [
  { id: 'destroyer', name: '구축함', cost: 380, hp: 30, gun: 4, torp: 6, air: 0, aa: 2, asw: 8, speed: 36, fuel: .05, levels: ['dd1', 'dd2'] },
  { id: 'cruiser', name: '순양함', cost: 1300, hp: 80, gun: 16, torp: 4, air: 0, aa: 6, asw: 2, speed: 33, fuel: .12, levels: ['cl1', 'cl2'] },
  { id: 'battleship', name: '전함', cost: 5200, hp: 260, gun: 60, torp: 0, air: 0, aa: 8, asw: 0, speed: 26, fuel: .4, levels: ['bb1', 'bb2'] },
  { id: 'carrier', name: '항공모함', cost: 4600, hp: 130, gun: 0, torp: 0, air: 55, aa: 8, asw: 2, speed: 32, fuel: .35, levels: ['cv1', 'cv2'] },
  { id: 'submarine', name: '잠수함', cost: 320, hp: 22, gun: 0, torp: 16, air: 0, aa: 0, asw: 0, speed: 18, fuel: .03, raid: 6, levels: ['ss1', 'ss2'] },
  { id: 'convoy', name: '수송선', cost: 40, hp: 10, gun: 0, torp: 0, air: 0, aa: 0, asw: 0, speed: 16, fuel: .02 }
];
/* 항공기 종류(장비 이름과 같다). range: 작전 반경(지도 단위), attack: 임무별 위력. */
export const AIRCRAFT = {
  fighter: { name: '전투기', range: 180, air: 10, ground: 1, naval: .5, strat: 0, defense: 10 },
  cas: { name: '근접 지원기', range: 150, air: 2, ground: 6, naval: 1.5, strat: 0, defense: 4 },
  bomber: { name: '폭격기', range: 320, air: 1, ground: 2, naval: 1, strat: 5, defense: 6 },
  naval_bomber: { name: '뇌격기', range: 260, air: 1, ground: 1, naval: 7, strat: 0, defense: 4 }
};
export const AIR_MISSIONS = {
  superiority: { name: '제공권 장악', types: ['fighter'] },
  cas: { name: '근접 항공 지원', types: ['cas', 'fighter', 'bomber'] },
  strategic: { name: '전략 폭격', types: ['bomber'] },
  naval_strike: { name: '함대 공격', types: ['naval_bomber', 'cas', 'bomber'] },
  idle: { name: '대기', types: [] }
};

/* 기술. cat: 분류, year: 기준 연도(앞서 연구하면 느리다), days: 기준 일수, req: 선행 기술, fx: 효과. */
export const TECH_CATEGORIES = [
  { id: 'infantry', name: '보병' }, { id: 'artillery', name: '포병' }, { id: 'armor', name: '기갑' }, { id: 'air', name: '항공' },
  { id: 'naval', name: '해군' }, { id: 'industry', name: '산업' }, { id: 'land_doctrine', name: '지상 교리' }, { id: 'naval_doctrine', name: '해군 교리' }, { id: 'air_doctrine', name: '항공 교리' }
];
export const TECHS = [
  { id: 'inf_eq1', cat: 'infantry', name: '1차 소화기', year: 1934, days: 60, fx: { equipment: { inf_eq: 1 } } },
  { id: 'inf_eq2', cat: 'infantry', name: '개량 소화기', year: 1939, days: 110, req: ['inf_eq1'], fx: { equipment: { inf_eq: 1.2 } } },
  { id: 'inf_eq3', cat: 'infantry', name: '반자동 소화기', year: 1942, days: 130, req: ['inf_eq2'], fx: { equipment: { inf_eq: 1.45 } } },
  { id: 'support_weapons', cat: 'infantry', name: '보병 지원 화기', year: 1936, days: 90, req: ['inf_eq1'], fx: { stat: { infantry: { soft: .1 } } } },
  { id: 'mountaineers', cat: 'infantry', name: '산악 부대', year: 1936, days: 90, req: ['inf_eq1'], fx: { unlock: 'mountain' } },
  { id: 'marines', cat: 'infantry', name: '상륙 부대', year: 1936, days: 90, req: ['inf_eq1'], fx: { unlock: 'marine' } },
  { id: 'motorized', cat: 'infantry', name: '차량화', year: 1936, days: 100, req: ['inf_eq1'], fx: { unlock: 'motorized' } },
  { id: 'jungle_warfare', cat: 'infantry', name: '밀림 전투', year: 1940, days: 110, req: ['support_weapons'], fx: { terrain: { j: .15 } } },
  { id: 'art1', cat: 'artillery', name: '야포', year: 1934, days: 60, fx: { equipment: { artillery: 1 } } },
  { id: 'art2', cat: 'artillery', name: '개량 야포', year: 1939, days: 110, req: ['art1'], fx: { equipment: { artillery: 1.25 } } },
  { id: 'art3', cat: 'artillery', name: '중포', year: 1942, days: 130, req: ['art2'], fx: { equipment: { artillery: 1.5 } } },
  { id: 'at1', cat: 'artillery', name: '대전차포', year: 1936, days: 90, req: ['art1'], fx: { unlock: 'anti_tank' } },
  { id: 'aa1', cat: 'artillery', name: '대공포', year: 1936, days: 90, req: ['art1'], fx: { unlock: 'anti_air' } },
  { id: 'tank1', cat: 'armor', name: '경전차', year: 1934, days: 80, fx: { equipment: { armor: 1 }, unlock: 'armor' } },
  { id: 'tank2', cat: 'armor', name: '중형 전차', year: 1939, days: 130, req: ['tank1'], fx: { equipment: { armor: 1.6 } } },
  { id: 'tank3', cat: 'armor', name: '개량 중형 전차', year: 1942, days: 150, req: ['tank2'], fx: { equipment: { armor: 2.2 } } },
  { id: 'fighter1', cat: 'air', name: '단엽 전투기', year: 1936, days: 90, fx: { equipment: { fighter: 1 } } },
  { id: 'fighter2', cat: 'air', name: '고속 전투기', year: 1940, days: 130, req: ['fighter1'], fx: { equipment: { fighter: 1.35 } } },
  { id: 'fighter3', cat: 'air', name: '고고도 전투기', year: 1943, days: 150, req: ['fighter2'], fx: { equipment: { fighter: 1.7 } } },
  { id: 'cas1', cat: 'air', name: '급강하 폭격기', year: 1936, days: 90, fx: { equipment: { cas: 1 } } },
  { id: 'cas2', cat: 'air', name: '개량 지상 공격기', year: 1940, days: 130, req: ['cas1'], fx: { equipment: { cas: 1.35 } } },
  { id: 'bomber1', cat: 'air', name: '쌍발 폭격기', year: 1936, days: 100, fx: { equipment: { bomber: 1 } } },
  { id: 'bomber2', cat: 'air', name: '4발 중폭격기', year: 1940, days: 150, req: ['bomber1'], fx: { equipment: { bomber: 1.5 } } },
  { id: 'nav1', cat: 'air', name: '함상 뇌격기', year: 1936, days: 90, fx: { equipment: { naval_bomber: 1 } } },
  { id: 'nav2', cat: 'air', name: '개량 뇌격기', year: 1940, days: 130, req: ['nav1'], fx: { equipment: { naval_bomber: 1.35 } } },
  { id: 'dd1', cat: 'naval', name: '구축함 설계', year: 1934, days: 70, fx: { ship: { destroyer: 1 } } },
  { id: 'dd2', cat: 'naval', name: '대잠 구축함', year: 1940, days: 120, req: ['dd1'], fx: { ship: { destroyer: 1.3 } } },
  { id: 'cl1', cat: 'naval', name: '순양함 설계', year: 1934, days: 80, fx: { ship: { cruiser: 1 } } },
  { id: 'cl2', cat: 'naval', name: '중순양함 개량', year: 1940, days: 130, req: ['cl1'], fx: { ship: { cruiser: 1.25 } } },
  { id: 'bb1', cat: 'naval', name: '전함 설계', year: 1934, days: 90, fx: { ship: { battleship: 1 } } },
  { id: 'bb2', cat: 'naval', name: '고속 전함', year: 1940, days: 160, req: ['bb1'], fx: { ship: { battleship: 1.25 } } },
  { id: 'cv1', cat: 'naval', name: '항공모함 설계', year: 1934, days: 90, fx: { ship: { carrier: 1 } } },
  { id: 'cv2', cat: 'naval', name: '장갑 비행갑판', year: 1940, days: 160, req: ['cv1'], fx: { ship: { carrier: 1.35 } } },
  { id: 'ss1', cat: 'naval', name: '잠수함 설계', year: 1934, days: 70, fx: { ship: { submarine: 1 } } },
  { id: 'ss2', cat: 'naval', name: '장거리 잠수함', year: 1940, days: 120, req: ['ss1'], fx: { ship: { submarine: 1.4 } } },
  { id: 'radar', cat: 'naval', name: '레이더', year: 1940, days: 140, req: ['dd1'], fx: { naval: { detect: .2 }, air: { defense: .15 } } },
  { id: 'construction1', cat: 'industry', name: '건설 기술 I', year: 1936, days: 90, fx: { construction: .1 } },
  { id: 'construction2', cat: 'industry', name: '건설 기술 II', year: 1938, days: 110, req: ['construction1'], fx: { construction: .1 } },
  { id: 'construction3', cat: 'industry', name: '건설 기술 III', year: 1941, days: 130, req: ['construction2'], fx: { construction: .1 } },
  { id: 'efficiency1', cat: 'industry', name: '조립 라인', year: 1936, days: 100, fx: { efficiencyCap: .1 } },
  { id: 'efficiency2', cat: 'industry', name: '생산 관리', year: 1939, days: 120, req: ['efficiency1'], fx: { efficiencyCap: .1 } },
  { id: 'efficiency3', cat: 'industry', name: '대량 생산 체계', year: 1942, days: 140, req: ['efficiency2'], fx: { efficiencyCap: .1 } },
  { id: 'mass_production', cat: 'industry', name: '경공업 기계화', year: 1937, days: 100, fx: { pm: 'mass_production' } },
  { id: 'machine_tools', cat: 'industry', name: '정밀 공작기계', year: 1938, days: 110, req: ['efficiency1'], fx: { pm: 'machine_tools' } },
  { id: 'steel_process', cat: 'industry', name: '제강 공정 개량', year: 1938, days: 110, fx: { pm: 'steel_process' } },
  { id: 'synthetic_fuel', cat: 'industry', name: '석탄 액화', year: 1938, days: 130, fx: { building: 'synthetic' } },
  { id: 'fertilizer', cat: 'industry', name: '화학 비료', year: 1937, days: 90, fx: { pm: 'fertilizer' } },
  { id: 'mobile1', cat: 'land_doctrine', name: '기동전 I', year: 1936, days: 100, excl: 'land', fx: { stat: { armor: { brk: .15 }, motorized: { org: 5 } } } },
  { id: 'mobile2', cat: 'land_doctrine', name: '기동전 II', year: 1939, days: 130, req: ['mobile1'], fx: { stat: { armor: { soft: .15 }, motorized: { brk: .2 } } } },
  { id: 'fire1', cat: 'land_doctrine', name: '화력 우위 I', year: 1936, days: 100, excl: 'land', fx: { stat: { artillery: { soft: .15 }, support_art: { soft: .15 } } } },
  { id: 'fire2', cat: 'land_doctrine', name: '화력 우위 II', year: 1939, days: 130, req: ['fire1'], fx: { stat: { infantry: { def: .1 }, artillery: { soft: .15 } } } },
  { id: 'mass1', cat: 'land_doctrine', name: '종심 방어 I', year: 1936, days: 100, excl: 'land', fx: { stat: { infantry: { org: 8, def: .1 } }, recovery: .1 } },
  { id: 'mass2', cat: 'land_doctrine', name: '종심 방어 II', year: 1939, days: 130, req: ['mass1'], fx: { stat: { infantry: { org: 6, brk: .15 } }, manpowerUse: -.1 } },
  { id: 'guerrilla1', cat: 'land_doctrine', name: '유격전 I', year: 1936, days: 100, excl: 'land', fx: { stat: { infantry: { org: 10 }, cavalry: { org: 10 } }, supplyUse: -.15 } },
  { id: 'guerrilla2', cat: 'land_doctrine', name: '유격전 II', year: 1939, days: 130, req: ['guerrilla1'], fx: { terrain: { m: .15, h: .1, f: .1, j: .1 } } },
  { id: 'battlefleet1', cat: 'naval_doctrine', name: '함대 결전', year: 1936, days: 100, excl: 'navy', fx: { naval: { gun: .15 } } },
  { id: 'battlefleet2', cat: 'naval_doctrine', name: '야간 어뢰전', year: 1939, days: 130, req: ['battlefleet1'], fx: { naval: { torp: .2 } } },
  { id: 'carrier1', cat: 'naval_doctrine', name: '항모 기동 부대', year: 1936, days: 100, excl: 'navy', fx: { naval: { air: .2 } } },
  { id: 'carrier2', cat: 'naval_doctrine', name: '함대 방공', year: 1939, days: 130, req: ['carrier1'], fx: { naval: { aa: .3 } } },
  { id: 'raider1', cat: 'naval_doctrine', name: '통상 파괴', year: 1936, days: 100, excl: 'navy', fx: { naval: { raid: .3 } } },
  { id: 'raider2', cat: 'naval_doctrine', name: '이리 떼 전술', year: 1939, days: 130, req: ['raider1'], fx: { naval: { torp: .2, raid: .2 } } },
  { id: 'air_sup1', cat: 'air_doctrine', name: '제공권 우선', year: 1936, days: 100, excl: 'air', fx: { air: { air: .15 } } },
  { id: 'air_sup2', cat: 'air_doctrine', name: '요격 체계', year: 1939, days: 130, req: ['air_sup1'], fx: { air: { defense: .2 } } },
  { id: 'air_ground1', cat: 'air_doctrine', name: '지상 협동', year: 1936, days: 100, excl: 'air', fx: { air: { ground: .2 } } },
  { id: 'air_ground2', cat: 'air_doctrine', name: '전장 차단', year: 1939, days: 130, req: ['air_ground1'], fx: { air: { ground: .15, naval: .15 } } },
  { id: 'air_strat1', cat: 'air_doctrine', name: '전략 폭격', year: 1936, days: 100, excl: 'air', fx: { air: { strat: .25 } } },
  { id: 'air_strat2', cat: 'air_doctrine', name: '편대 방어', year: 1939, days: 130, req: ['air_strat1'], fx: { air: { strat: .2, defense: .1 } } }
];
/* 1936년 1월에 이미 가진 기술. 나라마다 다르다. */
export const START_TECHS = {
  '*': ['inf_eq1', 'art1', 'dd1', 'cl1', 'ss1'],
  japan: ['tank1', 'fighter1', 'cas1', 'bomber1', 'nav1', 'bb1', 'cv1', 'marines', 'support_weapons', 'construction1'],
  usa: ['tank1', 'fighter1', 'bomber1', 'nav1', 'bb1', 'cv1', 'marines', 'construction1', 'efficiency1', 'motorized'],
  uk: ['tank1', 'fighter1', 'bomber1', 'nav1', 'bb1', 'cv1', 'construction1', 'motorized'],
  ussr: ['tank1', 'fighter1', 'bomber1', 'cas1', 'construction1', 'motorized', 'mass1'],
  china: [], ccp: ['guerrilla1'], france: ['tank1', 'fighter1', 'bomber1', 'bb1', 'motorized'], netherlands: ['fighter1'], australia: ['fighter1'], siam: [], manchukuo: []
};

/* 법. pp: 바꾸는 데 드는 정치력, need: 조건. fx: 효과. */
export const LAWS = {
  conscription: { name: '징병법', options: [
    { id: 'volunteer', name: '지원병제', pp: 0, fx: { manpower: .01 } },
    { id: 'limited', name: '제한 징병', pp: 75, fx: { manpower: .02 } },
    { id: 'extensive', name: '확대 징병', pp: 100, need: { warSupport: 40 }, fx: { manpower: .04, labor: -.02 } },
    { id: 'service', name: '의무 복무', pp: 125, need: { warSupport: 60 }, fx: { manpower: .08, labor: -.05 } },
    { id: 'total', name: '총동원', pp: 150, need: { warSupport: 80, atWar: true }, fx: { manpower: .14, labor: -.1, stability: -.1 } }
  ] },
  economy: { name: '경제법', options: [
    { id: 'civilian', name: '민간 경제', pp: 0, fx: { consumption: 1, arms: -.3, tax: .12, armsBuild: -.3 } },
    { id: 'early_mobilization', name: '초기 동원', pp: 100, fx: { consumption: .95, arms: -.1, tax: .14, armsBuild: -.1 } },
    { id: 'partial_mobilization', name: '부분 동원', pp: 120, need: { warSupport: 25 }, fx: { consumption: .9, arms: 0, tax: .16, armsBuild: 0 } },
    { id: 'war_economy', name: '전시 경제', pp: 150, need: { warSupport: 50 }, fx: { consumption: .8, arms: .1, tax: .2, armsBuild: .1, stability: -.05 } },
    { id: 'total_war', name: '총력전 경제', pp: 180, need: { warSupport: 80, atWar: true }, fx: { consumption: .65, arms: .2, tax: .24, armsBuild: .2, stability: -.15 } }
  ] },
  trade: { name: '무역법', options: [
    { id: 'free_trade', name: '자유 무역', pp: 100, fx: { tradeCap: 1.4, research: .05, construction: .05 } },
    { id: 'export_focus', name: '수출 중점', pp: 75, fx: { tradeCap: 1.15, research: .02, construction: .03 } },
    { id: 'limited_exports', name: '수출 제한', pp: 75, fx: { tradeCap: .9 } },
    { id: 'closed', name: '폐쇄 경제', pp: 100, fx: { tradeCap: .6, labor: .02 } }
  ] }
};
export const IDEOLOGIES = {
  democracy: { name: '민주주의', color: '#4a74a8' }, authoritarian: { name: '권위주의', color: '#6b6b6b' },
  communism: { name: '공산주의', color: '#a33a32' }, nonaligned: { name: '비동맹', color: '#8a7a55' }
};
/* 국가 정신. fx: 계수(stability·warSupport는 0~1 비율에 더함, pp는 하루 정치력에 더함, factory는 공장 산출 배율에 더함 등). */
export const SPIRITS = {
  army_navy_rivalry: { name: '육해군의 대립', desc: '육군과 해군이 예산과 전략을 두고 다툰다. 정치력과 연구가 줄어든다.', fx: { pp: -.25, research: -.05 } },
  zaibatsu: { name: '재벌', desc: '거대 기업 집단이 공업을 이끈다. 건설이 빠르지만 정부의 통제가 약하다.', fx: { construction: .1, stability: -.03 } },
  colonial_rule: { name: '식민 통치', desc: '조선·타이완의 저항과 감시 비용. 식민지의 생산이 줄고 치안이 불안하다.', fx: { colonyOutput: -.15 } },
  warlord_fragmentation: { name: '군벌 할거', desc: '나라가 여러 세력으로 나뉘어 있다. 안정도와 정치력이 낮다.', fx: { stability: -.1, pp: -.2 } },
  corruption: { name: '부패', desc: '물자와 예산이 새어 나간다. 공장 산출과 세금이 줄어든다.', fx: { factory: -.1, tax: -.15 } },
  german_advisors: { name: '독일 군사 고문단', desc: '중앙군 일부가 독일식 훈련을 받는다. 사단의 조직력이 오른다.', fx: { org: .05 } },
  guerrilla_base: { name: '유격 근거지', desc: '험한 산악과 농촌에서 싸운다. 보급 사용이 적고 방어에 유리하다.', fx: { supplyUse: -.3, defense: .1 } },
  peasant_support: { name: '농민의 지지', desc: '토지 개혁 약속이 병력을 모은다. 인력이 늘어난다.', fx: { manpower: .5 } },
  five_year_plans: { name: '5개년 계획', desc: '중공업 우선의 계획 경제. 건설이 빠르고 소비재가 부족하다.', fx: { construction: .1, consumption: -.1 } },
  european_front_watch: { name: '유럽을 향한 경계', desc: '주력은 유럽에 있다. 본토 병력을 극동으로 보내는 데 오래 걸린다.', fx: { deployTime: .5 } },
  isolationism: { name: '고립주의', desc: '국민은 해외 전쟁에 끼고 싶어 하지 않는다. 전쟁 지지도가 오르지 않고 먼저 전쟁을 선포할 수 없다.', fx: { warSupportCap: 30, noWar: true } },
  depression_recovery: { name: '대공황의 후유증', desc: '실업과 투자 부진. 공장 산출과 안정도가 낮다.', fx: { factory: -.1, stability: -.05 } },
  imperial_overstretch: { name: '제국 방어의 부담', desc: '세계 곳곳의 영토를 지켜야 한다. 본국 병력의 파견이 느리다.', fx: { deployTime: .3 } },
  indian_army: { name: '인도군', desc: '인도에서 많은 병력을 모을 수 있다.', fx: { manpower: .3 } },
  singapore_strategy: { name: '싱가포르 전략', desc: '유사시 본국 함대가 싱가포르로 온다는 계획. 싱가포르의 요새가 강하다.', fx: { fortBonus: { singapore: .3 } } },
  puppet_state: { name: '괴뢰국', desc: '종주국의 통제를 받는다. 정치력이 낮다.', fx: { pp: -.3 } },
  warlord_state: { name: '군벌 정권', desc: '사병 조직에 의존하는 지방 정권.', fx: { stability: -.05 } },
  european_entanglement: { name: '유럽의 그늘', desc: '본국이 유럽의 위기에 매여 있다.', fx: { deployTime: .4 } },
  neutrality: { name: '중립 정책', desc: '어느 편에도 서지 않는다. 전쟁 지지도가 낮다.', fx: { warSupportCap: 40 } },
  // 중점·사건이 주는 정신
  total_war_mobilization: { name: '국가 총동원', desc: '국가 총동원법. 군수 생산과 인력이 늘고 소비가 줄어든다.', fx: { arms: .1, manpower: .2, consumption: -.1 } },
  united_front: { name: '제2차 국공 합작', desc: '국민당과 공산당이 일본에 맞서 함께 싸운다.', fx: { warSupport: .1, stability: .05 } },
  scorched_earth: { name: '초토화와 후퇴', desc: '땅을 내주고 시간을 번다. 적의 보급을 어렵게 한다.', fx: { enemySupply: -.2 } },
  new_deal: { name: '뉴딜', desc: '공공사업과 고용. 안정도와 건설이 오른다.', fx: { construction: .1, stability: .05 } },
  arsenal_of_democracy: { name: '민주주의의 병기창', desc: '공장이 연합국을 위해 돌아간다.', fx: { arms: .15, construction: .1 } },
  great_purge: { name: '대숙청', desc: '장교단이 숙청되어 지휘가 흔들린다. 사단의 조직력이 낮다.', fx: { org: -.1, pp: .2 } },
  hundred_regiments: { name: '백단 대전', desc: '적 후방의 철도와 거점을 공격한다.', fx: { enemySupply: -.15 } },
  far_east_reserve: { name: '극동 예비대', desc: '시베리아 사단이 잘 훈련되어 있다.', fx: { org: .05, defense: .05 } },
  oil_embargo: { name: '석유 금수', desc: '주요 공급국이 석유를 팔지 않는다.', fx: {} },
  burma_road: { name: '버마 루트', desc: '버마를 거쳐 물자가 들어온다.', fx: { tradeCap: .2 } },
  hump_airlift: { name: '험프 공수', desc: '히말라야를 넘는 공수로 물자가 들어온다.', fx: { tradeCap: .15 } },
  resource_mobilization: { name: '자원 동원', desc: '채굴과 원료 생산을 늘린다.', fx: { resource: .15 } },
  european_war: { name: '유럽의 전쟁', desc: '본국이 유럽에서 싸우고 있다. 본국 병력과 함대를 이 전역으로 보내기 어렵다.', fx: { deployTime: 1, homeLocked: true } },
  government_in_exile: { name: '망명 정부', desc: '본국을 잃었다. 식민지의 자원과 병력으로 싸운다.', fx: { stability: -.05 } },
  great_patriotic_war: { name: '대조국 전쟁', desc: '서부에서 독일과 싸우고 있다. 본토의 병력과 물자를 극동으로 보내기 어렵다.', fx: { deployTime: 1, homeLocked: true, warSupport: .1 } }
};

/* 경제 상수(나라마다 같은 값). 수치의 의미는 docs/SIMULATION_RULES.md. */
export const ECONOMY = {
  laborShare: .4, wage: { workers: 8, farmers: 5, petite: 10, business: 0, landowners: 0, military: 7 },
  saving: { workers: .05, farmers: .05, petite: .1, business: .35, landowners: .25, military: .05 },
  subsistence: { grain: 1.1 }, subsistenceCap: .9,
  price: { swing: .75, floor: -.6, ceiling: .9, speed: .5 }, shortageAt: 1.6, shortageMax: .6,
  hireRate: .15, fireRate: .1, minStaff: .2, scalePerLevel: .01, scaleCap: 20,
  tradeBase: 40, tradePerPort: 12, tradeCost: .08, importFloor: .3,
  investShare: { business: .4, landowners: .2 }, poolCap: 4000,
  tax: { consumption: .5, wage: .3, profit: .2 }, interest: .004, baseExpensePerPop: .02,
  armsOutputPerDay: 1, dockOutputPerDay: 1, lineGrowth: .006, lineStart: .1, lineCapBase: .5,
  occupiedOutput: .4, constructionBase: 2, maxPerProject: 15
};
