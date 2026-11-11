/* 대한민국 1960: 선택의 연대기 — 시장 경제 모형(데이터 2.0.0)
 *
 * 의존성 없는 순수 모듈. DOM·저장소·네트워크·난수를 쓰지 않는다. 모든 수치는 게임 설계용 가상 값이다.
 *
 * 한 달의 흐름(compute):
 *   건물(단계·생산방식·충원율) → 투입 수요·산출 공급 → 고용과 임금 → 계층 소득 → 가계 수요
 *   → 건설점과 자재 수요 → 세계시장 교역 → 가격(구매 주문 B, 판매 주문 S의 수급) → 건물 손익·배당·투자기금
 *   → 세금·정부 지출 → 다음 달의 충원율·임금·가격.
 * compute()는 상태를 읽기만 하고, commit()이 결과를 상태에 적용한다(월 결산에서만 부른다).
 *
 * 구조는 잘 알려진 전략 게임의 규칙 틀(주문 수급으로 정해지는 가격, 생산방식이 있는 단계형 건물,
 * 건설점과 대기열, 민간 투자기금)을 따르되 상품·건물·수치는 이 게임의 것이다.
 */
export const STRATA = ['workers', 'farmers', 'petite', 'business', 'landowners', 'military'];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const finite = v => typeof v === 'number' && Number.isFinite(v);
/** 반올림. -0은 0으로 바꾼다(JSON 저장이 -0을 0으로 바꾸므로 저장 왕복이 같아야 한다). */
export const round = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n + 0;
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
const INDEX = new WeakMap();
/** 데이터의 ID 색인(데이터 객체마다 한 번 만든다). */
export function index(d) {
  let x = INDEX.get(d);
  if (!x) {
    const map = key => new Map((d[key] || []).map(v => [v.id, v]));
    x = { goods: map('goods'), buildings: map('buildings'), laws: map('laws'), lawGroups: map('lawGroups'), ig: map('interestGroups'), regions: map('regions'), edicts: map('edicts') };
    INDEX.set(d, x);
  }
  return x;
}
export const yearOf = turn => 1960 + Math.floor(Math.min(turn, 239) / 12);

/* ---------- 법률·이해집단 특성이 만드는 보정 ---------- */
const ADD = ['farmThroughput', 'mfgThroughput', 'constructionEff', 'taxEff', 'edictCap', 'subsistenceCap', 'investBonus', 'tradeCapBonus'];
const MUL = ['pollution', 'armsDemand', 'militaryWage'];
const SET = ['privateShare', 'investEff', 'stateDividend', 'subsidy', 'tariff', 'exportSubsidy', 'tradeCap', 'tax', 'farmShare', 'relief', 'workerDividend'];
const MAPMUL = ['wageMult', 'cloutMult'];
export const MODIFIER_KEYS = [...ADD, ...MUL, ...SET, ...MAPMUL];
function merge(m, mod, scale = 1) {
  for (const [key, v] of Object.entries(mod || {})) {
    if (ADD.includes(key)) m[key] += v * scale;
    else if (MUL.includes(key)) m[key] *= v;
    else if (SET.includes(key)) m[key] = typeof v === 'object' ? { ...v } : v;
    else if (MAPMUL.includes(key)) for (const [id, f] of Object.entries(v)) m[key][id] = (m[key][id] || 1) * f;
  }
}
/** 지지도(0~100)의 상태 이름. */
export function approvalState(v, d) {
  const t = d.economy.approval.thresholds;
  return v < t.angry ? 'angry' : v < t.unhappy ? 'unhappy' : v >= t.loyal ? 'loyal' : v >= t.happy ? 'happy' : 'neutral';
}
/** 세력 비중에 따른 특성 배율: 강력한 집단 1.5배, 소외된 집단 0. */
export function cloutScale(clout, d) { const a = d.economy.approval; return clout >= a.powerful ? 1.5 : clout < a.marginal ? 0 : 1; }
/** 지금 켜져 있는 이해집단 특성. [{ igId, key, name, scale, modifiers, monthly }] */
export function activeTraits(s, d) {
  const out = [];
  for (const g of d.interestGroups) {
    const st = approvalState(s.support[g.id], d), cs = cloutScale(s.ig[g.id].clout, d);
    if (!cs) continue;
    const push = (key, scale) => { const t = g.traits[key]; out.push({ igId: g.id, key, name: t.name, scale, modifiers: t.modifiers || {}, monthly: t.monthly || {} }); };
    if (st === 'angry') push('unhappy', 1.5 * cs); else if (st === 'unhappy') push('unhappy', cs);
    else if (st === 'happy') push('happy', cs); else if (st === 'loyal') { push('happy', cs); push('loyal', cs); }
  }
  return out;
}
/** 현행 법률과 이해집단 특성을 합친 보정값. */
export function modifiers(s, d) {
  const X = index(d);
  const m = { privateShare: .3, investEff: 1, stateDividend: .5, subsidy: true, tariff: 0, exportSubsidy: 0, tradeCap: 1, tax: { consumption: 0, wage: 0, profit: 0, land: 0 }, farmShare: { landowners: .5, farmers: .5 }, relief: 0, workerDividend: 0,
    farmThroughput: 0, mfgThroughput: 0, constructionEff: 0, taxEff: 0, edictCap: 0, subsistenceCap: 0, investBonus: 0, tradeCapBonus: 0, pollution: 1, armsDemand: 1, militaryWage: 1, wageMult: {}, cloutMult: {}, monthly: {} };
  for (const g of d.lawGroups) merge(m, X.laws.get(s.laws[g.id]).modifiers);
  for (const t of activeTraits(s, d)) {
    merge(m, t.modifiers, t.scale);
    for (const [id, v] of Object.entries(t.monthly)) m.monthly[id] = (m.monthly[id] || 0) + v * t.scale;
  }
  return m;
}

/* ---------- 건물과 권역 ---------- */
export const findBuilding = (s, id, regionId) => s.buildings.find(b => b.id === id && b.regionId === regionId) || null;
export const levelsOf = (s, ids) => s.buildings.reduce((a, b) => a + (ids.includes(b.id) ? b.level : 0), 0);
export function pmUnlocked(s, def, i) {
  const u = def.pm[i] && def.pm[i].unlock; if (!def.pm[i]) return false; if (!u) return true;
  if (u.year && yearOf(s.turn) < u.year) return false;
  return Object.entries(u.metric || {}).every(([id, v]) => s.stats[id] >= v);
}
/** 권역의 기반 시설 용량·사용량·시장 접근성. */
export function regionInfra(s, d) {
  const X = index(d), E = d.economy, out = {};
  for (const r of d.regions) out[r.id] = { supply: E.infraBase + r.initialDevelopment * E.infraPerDev + s.stats.infrastructure * E.infraPerIndex, usage: 0, access: 1 };
  for (const b of s.buildings) { const def = X.buildings.get(b.id), o = out[b.regionId]; o.supply += (def.infraSupply || 0) * b.level * b.staff; o.usage += (def.infraUse || 0) * b.level; }
  for (const o of Object.values(out)) o.access = o.usage > o.supply ? Math.max(E.accessFloor, o.supply / o.usage) : 1;
  return out;
}
/** 이 권역에 이 건물을 한 단계 더 지을 수 없는 이유(지형·자원, 경지, 권역 한도). 대기열에 있는 것도 센다. */
export function siteReason(s, d, buildingId, regionId) {
  const X = index(d), def = X.buildings.get(buildingId), r = X.regions.get(regionId);
  if (!def || !r) return '알 수 없는 건물 또는 권역입니다.';
  const tags = [...(r.terrain || []), ...(r.resources || [])];
  if (def.requires && !def.requires.some(t => tags.includes(t))) return `이 권역에는 ${def.requires.map(t => ((d.traits || []).find(x => x.id === t) || { name: t }).name).join('·')} 조건이 없습니다.`;
  const b = findBuilding(s, buildingId, regionId), have = (b ? b.level : 0) + s.construction.filter(q => q.id === buildingId && q.regionId === regionId).length;
  if (def.cap === 'arable' && have >= r.arable) return `이 권역의 경지 한도(${r.arable}단계)에 닿았습니다.`;
  if (def.maxPerRegion && have >= def.maxPerRegion) return `이 건물은 권역마다 ${def.maxPerRegion}단계까지입니다.`;
  return '';
}
export function regionDevelopment(s, d, regionId) {
  const X = index(d), r = X.regions.get(regionId), start = r.start || {};
  let v = r.initialDevelopment;
  for (const b of s.buildings) if (b.regionId === regionId) v += Math.max(0, b.level - (start[b.id] || 0)) * (X.buildings.get(b.id).development || 1);
  return clamp(v, 0, 100);
}

/* ---------- 가격 ---------- */
/** 구매 주문 B와 판매 주문 S로 정해지는 가격 변동률(기준가격 대비). */
export function priceRatio(S, B, E) {
  const p = E.price;
  if (B <= 1e-9 && S <= 1e-9) return 0;
  if (S <= 1e-9) return p.ceiling;
  if (B <= 1e-9) return p.floor;
  return clamp(p.swing * (B - S) / Math.min(B, S), p.floor, p.ceiling);
}
const supplyFor = (B, t, E) => t >= 0 ? B / (1 + t / E.price.swing) : B * (1 - t / E.price.swing);
const demandFor = (S, t, E) => t >= 0 ? S * (1 + t / E.price.swing) : S / (1 - t / E.price.swing);
export function worldPrice(g, turn) {
  if (!g.world) return null;
  let f = g.world.price;
  for (const [t, v] of g.world.schedule || []) if (turn >= t) f = g.world.price * v;
  return g.price * f;
}

/* ---------- 한 달 계산 ---------- */
export function compute(s, d) {
  const X = index(d), E = d.economy, k = s.stats, ec = s.econ, P = ec.prices, m = modifiers(s, d), u = E.unit;
  const years = Math.min(s.turn, 239) / 12;
  const zero = () => Object.fromEntries(d.goods.map(g => [g.id, 0]));
  const sup = { buildings: zero(), subsistence: zero(), imports: zero() }, dem = { pops: zero(), industry: zero(), government: zero(), construction: zero(), exports: zero() };
  const infra = regionInfra(s, d);
  const wageOf = i => ec.wage * X.ig.get(i).wage * (m.wageMult[i] || 1) * (i === 'military' ? m.militaryWage : 1);
  const staffed = Object.fromEntries(STRATA.map(i => [i, 0]));
  const recs = [], sector = [];
  let ownersBusiness = 0, farmLevels = 0, pollution = 0, tradeUnits = E.tradeBase;
  const publicJobs = Object.fromEntries(STRATA.map(i => [i, 0]));

  for (const b of s.buildings) {
    if (b.level <= 0) continue;
    const def = X.buildings.get(b.id), pm = def.pm[b.pm] || def.pm[0], L = b.level, access = infra[b.regionId].access;
    const scale = 1 + Math.min(L - 1, E.scaleCap) * E.scalePerLevel;
    const tech = def.tech ? Math.max(.5, 1 + (k[def.tech] - E.techBase[def.tech]) * E.techPerPoint) : 1;
    const skill = def.skill ? clamp(.6 + .4 * k.education / def.skill, .6, 1) : 1;
    const cat = def.category === 'agri' ? 1 + m.farmThroughput : def.category === 'manufacturing' || def.category === 'resource' ? 1 + m.mfgThroughput : 1;
    let short = 1; for (const g of Object.keys(pm.in)) short = Math.min(short, 1 - (ec.short[g] || 0));
    const base = b.staff * scale * tech * skill * access * Math.max(.5, cat), thr = base * short;
    const jobs = sum(pm.jobs) * L;
    const rec = { b, def, pm, L, jobs, base, thr, access, short, in: {}, out: {}, wages: 0 };
    for (const [g, q] of Object.entries(pm.in)) { const want = L * q * base * (g === 'arms' ? m.armsDemand : 1); (def.gov ? dem.government : dem.industry)[g] += want; rec.in[g] = want * short; }
    for (const [g, q] of Object.entries(pm.out)) { rec.out[g] = L * q * thr; sup.buildings[g] += rec.out[g]; }
    const pay = def.gov || def.construction ? E.publicPay : 1; // 정부·건설 부문 일자리는 공공 보수 기준
    for (const [i, n] of Object.entries(pm.jobs)) { staffed[i] += n * L * b.staff; rec.wages += n * L * b.staff * wageOf(i) * pay; publicJobs[i] += pay < 1 ? n * L * b.staff : 0; }
    pollution += L * (pm.pollution ?? def.pollution ?? 0) * thr * m.pollution;
    if (def.trade) tradeUnits += def.trade * L * b.staff;
    if (def.construction) sector.push({ points: L * pm.points * b.staff * access, materials: pm.materials });
    const priv = L - b.state;
    if (def.owner === 'business') ownersBusiness += priv * E.ownersPerLevel; else if (def.owner === 'land') farmLevels += priv;
    recs.push(rec);
  }

  /* 노동: 건물에 고용되지 않은 사람은 자급 농업이 받고, 그 한도를 넘으면 실업이다. */
  const employed = sum(staffed), W = ec.workforce, free = Math.max(0, W - employed);
  const subsCap = E.subsistenceCap * Math.max(.3, 1 + m.subsistenceCap) * Math.max(.7, 1 + (k.agriculture - E.techBase.agriculture) * E.subsistencePerAgri), subsistence = Math.min(free, subsCap), unemployed = free - subsistence;
  let subsValue = 0;
  for (const [g, q] of Object.entries(E.subsistence)) { sup.subsistence[g] += subsistence * q; subsValue += subsistence * q * P[g]; }

  /* 계층: 인구·소득·가계 수요 */
  const collect = clamp(E.collectBase + k.admin * E.collectPerAdmin + m.taxEff, .3, 1);
  const pop = { workers: staffed.workers + unemployed, farmers: staffed.farmers + subsistence, petite: staffed.petite, military: staffed.military, business: E.basePop.business + ownersBusiness, landowners: E.basePop.landowners + farmLevels * E.ownersPerLevel };
  const relief = unemployed * ec.wage * m.relief;
  const wageBill = Object.fromEntries(STRATA.map(i => [i, (staffed[i] - publicJobs[i] * (1 - E.publicPay)) * (X.ig.get(i).wage ? wageOf(i) : 0)]));
  const gross = Object.fromEntries(STRATA.map(i => [i, wageBill[i] + (ec.dividends[i] || 0)]));
  gross.workers += unemployed * ec.wage * E.dependentShare + relief; gross.farmers += subsValue;
  let cpiNum = 0, cpiDen = 0; for (const g of d.goods) { cpiNum += ec.needBase[g.id] * P[g.id]; cpiDen += ec.needBase[g.id] * g.price; }
  const cpi = cpiDen > 0 ? cpiNum / cpiDen : 1;
  const pops = {}; let wageTax = 0, consumptionTax = 0;
  for (const i of STRATA) {
    // 가계는 저축을 뺀 소득을 모두 쓴다. 상품별 몫은 기준 수요와 소득 탄력성이 정하고, 가격이 오르면 같은 돈으로 덜 산다.
    const wt = wageBill[i] * m.tax.wage * collect, net = gross[i] - wt, n = Math.max(1e-6, pop[i]);
    const budget = Math.max(0, net * (1 - E.saving[i]) / (1 + m.tax.consumption));
    const y = clamp(net / n / cpi / E.wage, .15, 60);
    const q = {}; let want = 0;
    for (const g of d.goods) { const nb = ec.needBase[g.id]; if (!nb) continue; q[g.id] = pop[i] * nb * y ** g.need.e; want += q[g.id] * P[g.id]; }
    const fit = want > 0 ? budget / want : 0;
    for (const id of Object.keys(q)) dem.pops[id] += q[id] * fit;
    wageTax += wt; consumptionTax += budget * m.tax.consumption * collect;
    pops[i] = { pop: pop[i], income: net, perCapita: net / n, y, fit, spend: budget, wage: X.ig.get(i).wage ? wageOf(i) : 0, sol: 10 * Math.sqrt(clamp(budget / n / cpi / E.wage, .04, 80)) };
  }

  /* 정부의 예산 배분이 만드는 물자 수요(지출액은 기본 지출에 들어 있다). */
  const baseExpense = E.baseExpense + k.gdp * E.baseExpenseGdp, baseValue = baseExpense / u;
  for (const [key, list] of Object.entries(E.budgetDemand)) for (const [g, f] of Object.entries(list)) dem.government[g] += baseValue * (s.budget[key] / 100) * f / X.goods.get(g).price;

  /* 건설: 건설점 → 대기열 진행 → 자재 수요 */
  const sectorPts = sector.reduce((a, x) => a + x.points, 0), rawPts = E.constructionBase + sectorPts;
  const mat = {}; const firstMat = X.buildings.get('construction').pm[0].materials;
  for (const [g, q] of Object.entries(firstMat)) mat[g] = (mat[g] || 0) + q * E.constructionBase / rawPts;
  for (const x of sector) for (const [g, q] of Object.entries(x.materials)) mat[g] = (mat[g] || 0) + q * x.points / rawPts;
  let matShort = 1; for (const g of Object.keys(mat)) matShort = Math.min(matShort, 1 - (ec.short[g] || 0));
  const points = rawPts * Math.max(.3, 1 + m.constructionEff) * matShort;
  const costPerPoint = Object.entries(mat).reduce((a, [g, q]) => a + q * P[g], 0);
  const govQ = [], privQ = []; s.construction.forEach((q, i) => (q.private ? privQ : govQ).push(i));
  const poolPts = costPerPoint > 0 ? Math.max(0, ec.pool) / u / costPerPoint : 0;
  let privPts = privQ.length ? Math.min(govQ.length ? points * m.privateShare : points, poolPts) : 0, govPts = govQ.length ? points - privPts : 0;
  const gains = new Array(s.construction.length).fill(0);
  const advance = (list, budget) => {
    let usedPts = 0;
    for (const i of list) {
      if (budget - usedPts <= 1e-9) break;
      const q = s.construction[i], def = X.buildings.get(q.id), a = (s.edicts || []).find(x => x.regionId === q.regionId), bonus = a ? (X.edicts.get(a.edictId).constructionBonus || 0) : 0;
      const need = (def.cost - q.progress) / (1 + bonus), give = Math.min(E.maxPerProject, budget - usedPts, need);
      gains[i] = give * (1 + bonus); usedPts += give;
    }
    return usedPts;
  };
  const usedPriv = advance(privQ, privPts), usedGov = advance(govQ, govPts), used = usedPriv + usedGov;
  const pending = zero(); // 공사 중인 건물이 준공되면 늘어날 산출(투자 판단용)
  for (const q of s.construction) { const def = X.buildings.get(q.id), b0 = findBuilding(s, q.id, q.regionId); for (const [g, v] of Object.entries(def.pm[b0 ? b0.pm : 0].out)) pending[g] += v; }
  for (const [g, q] of Object.entries(mat)) dem.construction[g] += used * q;

  /* 세계시장: 국내 가격이 수입 평가보다 높으면 들여오고, 수출 평가보다 낮으면 내보낸다. */
  const rel = ['usa', 'japan', 'europe', 'nonaligned'].reduce((a, id) => a + (s.relations[id] ?? 45), 0) / 4, relFactor = 1 + (rel - 45) / 200;
  const tradeCap = tradeUnits * m.tradeCap * Math.max(.5, 1 + m.tradeCapBonus) * relFactor * Math.max(.7, 1 + (k.infrastructure - E.techBase.infrastructure) * E.tradePerInfra);
  const importScale = k.reserves < E.forexFloor ? Math.max(.25, k.reserves / E.forexFloor) : 1;
  const tot = {}; const want = []; const exportCap = {};
  for (const g of d.goods) {
    const S = sup.buildings[g.id] + sup.subsistence[g.id], B = dem.pops[g.id] + dem.industry[g.id] + dem.government[g.id] + dem.construction[g.id];
    tot[g.id] = { S, B };
    if (!g.world) continue;
    const pw = worldPrice(g, s.turn), r0 = priceRatio(S, B, E), tariff = g.world.noTariff ? 0 : m.tariff;
    exportCap[g.id] = g.world.export * (1 + E.exportGrowth * years) * relFactor;
    const tImp = pw * (1 + tariff + E.tradeCost) / g.price - 1, tExp = pw * (1 - E.tradeCost + m.exportSubsidy) / g.price - 1;
    if (g.world.import && B > 1e-9 && r0 > tImp && tImp < E.price.ceiling) want.push({ g, pw, tariff, M: Math.max(0, supplyFor(B, Math.max(tImp, E.price.floor), E) - S) * importScale, X: 0 });
    else if (g.world.export > 0 && S > 1e-9 && r0 < tExp) {
      // 한도까지는 수출 평가 가격으로 나가고, 그래도 남으면 값이 내려가는 만큼 한도의 최대 두 배까지 더 팔린다.
      const need = Math.max(0, demandFor(S, Math.min(tExp, E.price.ceiling), E) - B), cap = exportCap[g.id], x1 = Math.min(cap, need);
      const extra = need > cap ? cap * Math.min(1, (tExp - priceRatio(S, B + x1, E)) / E.exportSlope) : 0;
      want.push({ g, pw, tariff, M: 0, X: x1 + extra });
    }
  }
  // 무역 역량은 물량(기준가격으로 잰 값) 기준이다. 세계 가격이 올라도 같은 물량은 같은 역량을 쓴다.
  const tradeValue = want.reduce((a, x) => a + (x.M + x.X) * x.g.price, 0), tf = tradeValue > tradeCap ? tradeCap / tradeValue : 1;
  let importValue = 0, exportValue = 0, tariffs = 0, exportSubsidy = 0;
  for (const x of want) {
    const M = x.M * tf, Xq = x.X * tf;
    sup.imports[x.g.id] = M; dem.exports[x.g.id] = Xq; x.g2 = Xq;
    importValue += M * x.pw; exportValue += Xq * x.pw; tariffs += M * x.pw * x.tariff; exportSubsidy += Xq * x.pw * m.exportSubsidy;
  }

  /* 가격과 공급 부족 */
  const goods = {}, nextPrices = {}, nextShort = {};
  for (const g of d.goods) {
    const S = tot[g.id].S + sup.imports[g.id], B = tot[g.id].B + dem.exports[g.id], ratio = priceRatio(S, B, E), target = g.price * (1 + ratio);
    const np = P[g.id] + (target - P[g.id]) * E.price.speed;
    const pen = B > 1e-9 && B > S * E.shortageAt ? (S <= 1e-9 ? E.shortageMax : clamp((B / S - E.shortageAt) * .5, 0, E.shortageMax)) : 0;
    const ns = (ec.short[g.id] || 0) + (pen - (ec.short[g.id] || 0)) * .5;
    nextPrices[g.id] = round(np, 4); nextShort[g.id] = ns < .005 ? 0 : round(ns, 4);
    goods[g.id] = { id: g.id, base: g.price, price: P[g.id], next: nextPrices[g.id], target, ratio, supply: S, demand: B, world: g.world ? worldPrice(g, s.turn) : null, shortage: pen,
      pending: pending[g.id], exportCap: exportCap[g.id] || 0, exportRoom: tf < 1 ? 0 : Math.max(0, (exportCap[g.id] || 0) - dem.exports[g.id]), exportParity: g.world ? worldPrice(g, s.turn) * (1 - E.tradeCost + m.exportSubsidy) : 0,
      sup: { buildings: sup.buildings[g.id], subsistence: sup.subsistence[g.id], imports: sup.imports[g.id] }, dem: { pops: dem.pops[g.id], industry: dem.industry[g.id], government: dem.government[g.id], construction: dem.construction[g.id], exports: dem.exports[g.id] } };
  }
  const NP = nextPrices;

  /* 건물 손익, 배당, 투자기금 */
  const div = Object.fromEntries(STRATA.map(i => [i, 0]));
  let govWages = 0, govGoods = 0, stateDividend = 0, stateLoss = 0, subsidies = 0, profitTax = 0, landBase = 0, va = subsValue, privateProfit = 0, marketRevenue = 0, marketProfit = 0;
  for (const rec of recs) {
    const { b, def, L } = rec;
    let rev = 0, cost = 0;
    for (const [g, q] of Object.entries(rec.out)) rev += q * NP[g];
    for (const [g, q] of Object.entries(rec.in)) cost += q * NP[g];
    rec.revenue = rev; rec.inputCost = cost;
    if (def.gov || def.construction) { govWages += rec.wages; govGoods += cost; va += rec.wages; rec.profit = null; rec.ok = true; continue; }
    const profit = rev - cost - rec.wages, ss = b.state / L, ps = 1 - ss;
    rec.profit = profit; rec.margin = profit / Math.max(1, rev); va += rev - cost; marketRevenue += rev; marketProfit += profit;
    if (def.category === 'agri') landBase += rev;
    if (profit >= 0) {
      stateDividend += profit * ss * m.stateDividend;
      const priv = profit * ps, tax = priv * m.tax.profit * collect, net = priv - tax; profitTax += tax; privateProfit += priv;
      const shares = def.owner === 'land' ? m.farmShare : def.owner === 'petite' ? { petite: 1 } : { business: 1 - m.workerDividend, workers: m.workerDividend };
      for (const [i, f] of Object.entries(shares)) div[i] += net * f;
    } else {
      stateLoss += -profit * ss;
      if (b.subsidy && m.subsidy) subsidies += -profit * ps;
    }
    rec.ok = profit >= 0 || ss >= 1 || (b.subsidy && m.subsidy);
  }
  let poolIn = 0; const nextDividends = {};
  for (const i of STRATA) { const rate = X.ig.get(i).invest || 0, give = div[i] * rate; poolIn += give * m.investEff * Math.max(0, 1 + m.investBonus); nextDividends[i] = round(div[i] - give, 4); }
  const overflow = Math.max(0, ec.pool + poolIn * u - usedPriv * costPerPoint * u - E.poolCap); // 투자기금이 한도를 넘으면 넘친 몫은 배당으로 돌아간다
  if (overflow > 0) { poolIn -= overflow / u; nextDividends.business = round(nextDividends.business + overflow / u, 4); }
  const landTax = (landBase + subsValue) * m.tax.land * collect;
  const construction = { gov: usedGov * costPerPoint, private: usedPriv * costPerPoint };

  /* 다음 달 충원율: 이익이 나거나 정부·국영·보조 건물이면 채우고, 손실이면 줄인다. 사람은 실업자와 자급 농가에서 온다. */
  const laborPool = unemployed + subsistence * E.subsistenceMobility;
  const delta = recs.map(rec => clamp((rec.ok ? 1 : Math.max(E.minStaff, rec.b.staff - E.fireRate)) - rec.b.staff, -E.fireRate, E.hireRate));
  const hireJobs = recs.reduce((a, rec, i) => a + Math.max(0, delta[i]) * rec.jobs, 0), hf = hireJobs > laborPool ? laborPool / hireJobs : 1;
  const nextStaff = new Map(recs.map((rec, i) => [rec.b, round(clamp(rec.b.staff + (delta[i] > 0 ? delta[i] * hf : delta[i]), 0, 1), 4)]));
  // 임금: 실업이 적으면 오르고 많으면 내린다. 건물들의 이익률이 낮으면 올릴 여력이 없어 오르지 못하고, 손실이면 더 내린다.
  const rate = unemployed / W, margin = marketRevenue > 0 ? marketProfit / marketRevenue : 0;
  let push = clamp((E.fullEmployment - rate) * E.wageFlex, -E.wageDown, E.wageUp);
  if (margin < E.wageMargin) push = Math.min(push, 0); if (margin < 0) push -= E.wageDown * .5;
  const nextWage = round(Math.max(E.wage * .85, ec.wage * (1 + push)), 4);

  /* 재정(재정점) */
  const upkeepList = { policies: s.policies.reduce((a, id) => a + d.policies.find(p => p.id === id).monthlyCost, 0), laws: d.lawGroups.reduce((a, g) => a + X.laws.get(s.laws[g.id]).monthlyCost, 0), edicts: (s.edicts || []).reduce((a, x) => a + X.edicts.get(x.edictId).monthlyCost, 0), advisers: s.advisers.length * .15 };
  const detail = {
    taxes: { consumption: consumptionTax * u, wage: wageTax * u, profit: profitTax * u, land: landTax * u }, tariffs: tariffs * u, stateDividend: stateDividend * u, poolTransfer: construction.private * u,
    govWages: govWages * u, govGoods: govGoods * u, construction: (construction.gov + construction.private) * u, subsidies: subsidies * u, stateLoss: stateLoss * u, relief: relief * u, exportSubsidy: exportSubsidy * u, upkeep: upkeepList, collect
  };
  const income = sum(detail.taxes) + detail.tariffs + detail.stateDividend + detail.poolTransfer;
  const interest = k.debt * E.interest;
  const upkeep = detail.govWages + detail.govGoods + detail.construction + detail.subsidies + detail.stateLoss + detail.relief + detail.exportSubsidy + sum(upkeepList);
  const finance = { income, base: baseExpense, interest, upkeep, expense: baseExpense + interest + upkeep, balance: income - baseExpense - interest - upkeep };

  return {
    goods, buildings: recs, infra, mods: m, cpi, wage: ec.wage, pops,
    labor: { workforce: W, employed, subsistence, unemployed, rate, pool: laborPool, margin },
    construction: { points, rawPoints: rawPts, sectorPoints: sectorPts, used, usedGov, usedPriv, gains, costPerPoint: costPerPoint * u, materials: mat, privateShare: m.privateShare, matShort },
    trade: { capacity: tradeCap * u, used: Math.min(tradeValue, tradeCap) * u, exports: exportValue * u, imports: importValue * u, tariffs: tariffs * u, subsidy: exportSubsidy * u, importScale },
    finance, detail, value: va, gdp: ec.gdpUnit > 0 ? va / ec.gdpUnit : 100, pollution, privateProfit: privateProfit * u,
    pool: { now: ec.pool, in: poolIn * u, out: construction.private * u },
    next: { prices: nextPrices, short: nextShort, staff: nextStaff, wage: nextWage, dividends: nextDividends }
  };
}

/* ---------- 이해집단: 세력·요구·지지도 ---------- */
export function demandStatus(s, d, ig) {
  const years = Math.min(s.turn, 239) / 12;
  return ig.demands.map(x => { const need = Math.floor(x.base + x.perYear * Math.max(0, years - x.from)), have = levelsOf(s, x.buildings); return { ...x, need, have, met: have >= need }; });
}
export function cloutOf(d, R) {
  const raw = {}; let total = 0;
  for (const g of d.interestGroups) { raw[g.id] = R.pops[g.id].pop * g.cloutWeight * (R.mods.cloutMult[g.id] || 1); total += raw[g.id]; }
  return Object.fromEntries(d.interestGroups.map(g => [g.id, total > 0 ? raw[g.id] / total : 0]));
}
/** 지지도 목표값과 그 구성. 실제 지지도는 매월 목표를 향해 움직인다. */
export function approvalParts(s, d, R, ig) {
  const X = index(d), A = d.economy.approval, years = Math.min(s.turn, 239) / 12;
  const law = d.lawGroups.reduce((a, g) => a + (X.laws.get(s.laws[g.id]).stances[ig.id] || 0), 0) * A.lawWeight;
  const demands = demandStatus(s, d, ig).reduce((a, x) => a + (x.met ? x.weight : -x.weight), 0);
  const expect = (s.econ.sol0[ig.id] || 10) * (1 + A.expectGrowth * years);
  const living = clamp((R.pops[ig.id].sol - expect) * A.living, -A.livingCap, A.livingCap);
  const gov = s.government.includes(ig.id) ? A.inGov : A.outGov, mod = s.ig[ig.id].mod;
  return { law, demands, living, gov, mod, expect, target: clamp(50 + law + demands + living + gov + mod, 0, 100) };
}
/** 투표 비중(인구 비중)으로 본 종합 지지도. */
export function voteWeights(d, R) { const total = STRATA.reduce((a, i) => a + R.pops[i].pop, 0); return Object.fromEntries(STRATA.map(i => [i, R.pops[i].pop / total])); }

/* ---------- 민간 투자 ---------- */
/** 건물 한 단계를 더 지었을 때의 예상 월 이익(재정점)과 건설점당 이익. 지금 가격에 늘어날 공급을 반영한다. */
export function prospect(s, d, R, def, regionId) {
  const X = index(d), E = d.economy, k = s.stats, b = findBuilding(s, def.id, regionId), pm = def.pm[b ? b.pm : 0];
  const tech = def.tech ? Math.max(.5, 1 + (k[def.tech] - E.techBase[def.tech]) * E.techPerPoint) : 1, skill = def.skill ? clamp(.6 + .4 * k.education / def.skill, .6, 1) : 1;
  const cat = def.category === 'agri' ? 1 + R.mods.farmThroughput : def.category === 'manufacturing' || def.category === 'resource' ? 1 + R.mods.mfgThroughput : 1;
  const thr = tech * skill * R.infra[regionId].access * Math.max(.5, cat);
  let rev = 0, cost = 0, wages = 0;
  // 산출이 늘면 가격이 내려간다. 수출 한도에 여유가 있으면 수출 평가가 바닥이 된다.
  for (const [g, q] of Object.entries(pm.out)) { const x = R.goods[g], gd = X.goods.get(g), add = q * thr + x.pending; rev += q * thr * Math.max(gd.price * (1 + priceRatio(x.supply + add, x.demand, E)), x.exportRoom >= add ? x.exportParity : 0); }
  for (const [g, q] of Object.entries(pm.in)) cost += q * thr * R.goods[g].next;
  for (const [i, n] of Object.entries(pm.jobs)) wages += n * R.pops[i].wage;
  const profit = (rev - cost - wages) * E.unit;
  return { profit, perPoint: profit / def.cost, jobs: sum(pm.jobs), revenue: rev * E.unit, cost: (cost + wages) * E.unit };
}
function privateChoice(s, d, R) {
  const E = d.economy; let best = null;
  if (s.construction.filter(q => q.private).length >= E.privateQueueMax || s.construction.length >= E.queueMax + E.privateQueueMax) return null;
  for (const def of d.buildings) {
    if (def.private === false || def.gov || yearOf(s.turn) < def.unlockYear) continue;
    if (s.buildings.some(b => b.id === def.id && b.level > 0 && b.staff < .85)) continue; // 같은 업종에 놀고 있는 설비가 있으면 새로 짓지 않는다
    for (const r of d.regions) {
      if (siteReason(s, d, def.id, r.id)) continue;
      const p = prospect(s, d, R, def, r.id);
      if (p.perPoint < E.investThreshold || p.jobs > R.labor.unemployed + R.labor.subsistence * .3) continue;
      if (s.econ.pool < def.cost * R.construction.costPerPoint * .3) continue;
      if (!best || p.perPoint > best.score + 1e-12) best = { id: def.id, regionId: r.id, score: p.perPoint };
    }
  }
  return best;
}

/* ---------- 상태에 적용 ---------- */
function addLevel(s, d, id, regionId, isPrivate) {
  const def = index(d).buildings.get(id); let b = findBuilding(s, id, regionId);
  if (!b) { b = { id, regionId, level: 0, pm: 0, staff: 0, state: 0, subsidy: false }; s.buildings.push(b); }
  b.staff = round(b.staff * b.level / (b.level + 1), 4); b.level++;
  if (!isPrivate || def.private === false) b.state++;
}
/** compute()의 결과를 상태에 적용한다. 준공 목록과 새 민간 착공을 돌려준다. settle=true이면 가격·충원만 맞춘다(초기 균형용). */
export function commit(s, d, R, { settle = false } = {}) {
  const E = d.economy, ec = s.econ;
  for (const b of s.buildings) if (R.next.staff.has(b)) b.staff = R.next.staff.get(b);
  ec.prices = R.next.prices; ec.short = R.next.short; ec.dividends = R.next.dividends; ec.cpi = round(R.cpi, 4); if (!settle) ec.wage = R.next.wage;
  for (const i of STRATA) ec.sol[i] = round(R.pops[i].sol, 3);
  if (settle) return { completed: [], started: null };
  ec.pool = round(clamp(ec.pool + R.pool.in - R.pool.out, 0, E.poolCap), 4);
  ec.workforce = round(ec.workforce * (1 + E.workforceGrowth), 3);
  ec.trade = { exports: round(R.trade.exports, 3), imports: round(R.trade.imports, 3) };
  for (const g of d.goods) { const h = (ec.hist[g.id] ||= []); h.push(round(R.next.prices[g.id] / g.price - 1, 3)); if (h.length > 36) h.shift(); }
  const completed = [];
  s.construction.forEach((q, i) => { q.progress = round(q.progress + R.construction.gains[i], 3); });
  s.construction = s.construction.filter(q => {
    if (q.progress < index(d).buildings.get(q.id).cost - 1e-6) return true;
    addLevel(s, d, q.id, q.regionId, q.private); completed.push({ buildingId: q.id, regionId: q.regionId, private: !!q.private }); return false;
  });
  const pick = privateChoice(s, d, R); let started = null;
  if (pick) { s.construction.push({ id: pick.id, regionId: pick.regionId, progress: 0, private: true }); started = { buildingId: pick.id, regionId: pick.regionId }; }
  return { completed, started };
}

/** 새 게임의 경제 상태: 1960년 건물, 현행 법률, 기준 수요와 생산 지수 보정. */
export function createEconomy(s, d) {
  const E = d.economy;
  s.buildings = [];
  for (const r of d.regions) for (const [id, level] of Object.entries(r.start || {})) { const def = index(d).buildings.get(id); s.buildings.push({ id, regionId: r.id, level, pm: 0, staff: 1, state: def.private === false ? level : 0, subsidy: false }); }
  s.construction = [];
  s.laws = Object.fromEntries(d.lawGroups.map(g => [g.id, d.laws.find(l => l.group === g.id && l.initial).id]));
  s.government = [...E.government.start];
  s.ig = Object.fromEntries(d.interestGroups.map(g => [g.id, { mod: 0, clout: 1 / d.interestGroups.length }]));
  s.support = Object.fromEntries(d.interestGroups.map(g => [g.id, 50]));
  s.econ = { prices: Object.fromEntries(d.goods.map(g => [g.id, g.price])), short: {}, wage: E.wage, workforce: E.workforce, pool: E.poolStart, dividends: Object.fromEntries(STRATA.map(i => [i, 0])), sol: Object.fromEntries(STRATA.map(i => [i, 10])), sol0: {},
    needBase: Object.fromEntries(d.goods.map(g => [g.id, 0])), gdpUnit: 0, cpi: 1, hist: {}, trade: { exports: 0, imports: 0 } };
  // 기준 수요 보정: 1960년 1월의 가계 소비 구성이 데이터의 q0 비율이 되도록 상품별 기준값을 맞춘다.
  const calibrate = () => {
    const R = compute(s, d), first = !d.goods.some(g => s.econ.needBase[g.id] > 0);
    for (const g of d.goods) {
      if (!(g.need.q0 > 0)) { s.econ.needBase[g.id] = 0; continue; }
      if (first) { const den = STRATA.reduce((a, i) => a + R.pops[i].pop * R.pops[i].y ** g.need.e, 0); s.econ.needBase[g.id] = g.need.q0 / den; }
      else s.econ.needBase[g.id] *= g.need.q0 / Math.max(1e-9, R.goods[g.id].dem.pops);
    }
  };
  const settle = n => { for (let i = 0; i < n; i++) { const R = compute(s, d), c = cloutOf(d, R); commit(s, d, R, { settle: true }); for (const g of d.interestGroups) s.ig[g.id].clout = c[g.id]; } };
  calibrate();
  for (let pass = 0; pass < 5; pass++) {
    settle(6); calibrate();
    const R = compute(s, d), c = cloutOf(d, R);
    for (const i of STRATA) { s.econ.sol[i] = round(R.pops[i].sol, 3); s.econ.sol0[i] = s.econ.sol[i]; }
    for (const g of d.interestGroups) { s.ig[g.id].clout = round(c[g.id], 4); s.support[g.id] = round(approvalParts(s, d, R, g).target, 2); }
  }
  const R = compute(s, d);
  s.econ.gdpUnit = round(R.value / 100, 4);
  for (const g of d.goods) s.econ.needBase[g.id] = round(s.econ.needBase[g.id], 8);
  for (const g of d.goods) s.econ.hist[g.id] = [round(s.econ.prices[g.id] / g.price - 1, 3)];
  s.stats.gdp = 100; s.stats.unemployment = round(R.labor.rate * 100, 2);
  return s;
}
