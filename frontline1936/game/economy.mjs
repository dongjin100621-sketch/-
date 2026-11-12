/* 전선과 공장 — 나라별 시장 경제(《대한민국 1960》의 시장 엔진을 여러 나라로 넓힌 것).
 *
 * 한 달의 흐름(compute, 나라마다):
 *   건물(단계·생산방식·충원율) → 투입 수요·산출 공급 → 고용과 임금 → 계층 소득과 가계 수요(경제법이 소비를 줄인다)
 *   → 군수 공장의 생산 라인과 조선소가 사는 물자 → 건설점과 자재 → 세계시장 교역(공급국의 금수·전쟁·봉쇄)
 *   → 가격(구매 주문 B, 판매 주문 S) → 건물 손익·배당·투자기금 → 세금·정부 지출·부채 → 다음 달 충원율·임금·가격.
 * compute()는 상태를 읽기만 하고, commit()이 결과를 상태에 적용한다(매달 1일). 하루 단위의 건설·생산은 rates로 나눠 쓴다.
 * 점령한 지역의 건물은 정해진 비율(occupiedOutput)로만 돌고 그 땅의 사람은 점령국의 노동·가계에 넣지 않는다. */
import { clamp, round, sum, index, mods, law, atWar, yearOf } from './core.mjs';

export const STRATA = ['workers', 'farmers', 'business', 'landowners', 'military'];
const zero = d => Object.fromEntries(d.goods.map(g => [g.id, 0]));

export function priceRatio(S, B, p) {
  if (B <= 1e-9 && S <= 1e-9) return 0;
  if (S <= 1e-9) return p.ceiling;
  if (B <= 1e-9) return p.floor;
  return clamp(p.swing * (B - S) / Math.min(B, S), p.floor, p.ceiling);
}
const supplyFor = (B, t, p) => t >= 0 ? B / (1 + t / p.swing) : B * (1 - t / p.swing);
const demandFor = (S, t, p) => t >= 0 ? S * (1 + t / p.swing) : S / (1 - t / p.swing);

/** 나라 cid가 경제에 쓰는 지역: 지금 통제하는 지도 위 지역 + 잃지 않은 지도 밖 본국. */
export function econRegions(s, d, cid) {
  const c = s.countries[cid], out = [];
  for (const r of d.regions) {
    const st = s.regions[r.id];
    if (st.controller !== cid) continue;
    if (r.offmap && c.homeLost) continue;
    out.push(r);
  }
  return out;
}
export const isColony = (s, r) => !!r.colony && s.regions[r.id].owner === 'japan';

/** 생산 라인에 실제로 배치되는 군수 공장 수(가진 공장보다 많이 배치했으면 비례해 줄인다). */
export function armsCapacity(s, d, cid) {
  let n = 0;
  for (const r of econRegions(s, d, cid)) { const b = s.regions[r.id].b.arms; if (b && b.level) n += b.level * (s.regions[r.id].owner === cid ? b.staff : d.economy.occupiedOutput); }
  return n;
}
export function dockCapacity(s, d, cid) {
  let n = 0;
  for (const r of econRegions(s, d, cid)) { const b = s.regions[r.id].b.dock; if (b && b.level) n += b.level * (s.regions[r.id].owner === cid ? b.staff : d.economy.occupiedOutput); }
  return n;
}
/** 장비 라인에 배치한 공장의 합. */
export const lineFactories = c => sum(c.lines.map(l => l.factories));

/** 세계시장에서 이 상품을 살 수 있는 공급국 몫(금수·전쟁 상대·잃은 본국을 뺀다). */
export function supplierShare(s, d, cid, g) {
  const c = s.countries[cid];
  let share = 0;
  for (const [sup, f] of Object.entries(g.world.suppliers)) {
    if (sup === cid) continue;
    if (sup !== 'other') {
      const S = s.countries[sup];
      if (!S || !S.exists) continue;
      if (atWar(s, cid, sup)) continue;
      if ((c.embargoedBy || []).includes(sup)) continue;
      if (S.homeLost && ['france', 'netherlands'].includes(sup) && !['rubber', 'oil', 'rare'].includes(g.id)) continue;
    }
    share += f;
  }
  // 전쟁 중인 나라는 '기타' 공급국과의 거래도 줄어든다.
  return share;
}

export function compute(s, d, cid) {
  const X = index(d), E = d.economy, c = s.countries[cid], ec = c.econ, P = ec.prices, M = mods(s, d, c);
  const lawE = law(d, c, 'economy').fx, lawT = law(d, c, 'trade').fx;
  const stab = clamp(c.stability, 0, 1), stabF = clamp(.75 + stab * .5, .75, 1.15);
  const sup = { buildings: zero(d), subsistence: zero(d), imports: zero(d) }, dem = { pops: zero(d), industry: zero(d), government: zero(d), construction: zero(d), exports: zero(d) };
  const regs = econRegions(s, d, cid);
  const staffed = Object.fromEntries(STRATA.map(i => [i, 0]));
  const recs = []; let pop = 0, ports = 0, owners = { business: 0, landowners: 0 };
  const pts = []; let armsLevels = 0, dockLevels = 0, armsStaffed = 0, dockStaffed = 0;

  for (const r of regs) {
    const st = s.regions[r.id], occ = st.owner !== cid;
    if (!occ) pop += r.pop;
    ports += st.port;
    const access = clamp(.65 + st.infra * .05, .65, 1.15) * (1 - (st.damage || 0));
    for (const [bid, b] of Object.entries(st.b)) {
      if (!b.level) continue;
      const def = X.buildings.get(bid), L = b.level, pm = def.pm[b.pm] || def.pm[0];
      const staff = occ ? E.occupiedOutput : b.staff;
      const scale = 1 + Math.min(L - 1, E.scaleCap) * E.scalePerLevel;
      let f = staff * scale * access;
      if (def.category === 'resource') f *= 1 + M.resource;
      if (isColony(s, r)) f *= 1 + M.colonyOutput;
      const rec = { region: r.id, bid, def, pm, L, occ, staff, f, in: {}, out: {}, jobs: occ ? 0 : sum(Object.values(def.jobs)) * L, wages: 0 };
      if (!occ) for (const [i, n] of Object.entries(def.jobs)) { staffed[i] += n * L * b.staff; rec.wages += n * L * b.staff * (E.wage[i] || 0) * ec.wage; }
      if (def.kind === 'market') {
        let short = 1; for (const g of Object.keys(pm.in)) short = Math.min(short, 1 - (ec.short[g] || 0));
        rec.short = short;
        for (const [g, q] of Object.entries(pm.in)) { const want = L * q * f; dem.industry[g] += want; rec.in[g] = want * short; }
        for (const [g, q] of Object.entries(pm.out)) { rec.out[g] = L * q * f * short; sup.buildings[g] += rec.out[g]; }
        if (def.owner === 'land') owners.landowners += L * .5; else owners.business += L * .3;
      } else if (def.kind === 'construction') {
        pts.push({ points: L * pm.points * f, materials: pm.materials });
      } else if (bid === 'arms') { armsLevels += L; armsStaffed += L * staff; }
      else if (bid === 'dock') { dockLevels += L; dockStaffed += L * staff; for (const [g, q] of Object.entries(pm.in || {})) { const want = L * q * staff; dem.government[g] += want; rec.in[g] = want; } }
      recs.push(rec);
    }
  }

  /* 군수 공장: 생산 라인의 원료 */
  const lineIn = {}; const assigned = lineFactories(c), capF = armsStaffed, lf = assigned > capF && assigned > 0 ? capF / assigned : 1;
  for (const l of c.lines) { const eq = X.equipment.get(l.equip); for (const [g, q] of Object.entries(eq.recipe)) { const v = l.factories * lf * q; dem.government[g] += v; lineIn[g] = (lineIn[g] || 0) + v; } }
  let lineShort = 1; for (const g of Object.keys(lineIn)) lineShort = Math.min(lineShort, 1 - (ec.short[g] || 0));
  /* 연료: 군의 기계화 부대·함선·항공기가 한 달에 쓰는 연료 */
  const fuelUse = militaryFuel(s, d, cid);
  dem.government.fuel += fuelUse;

  /* 노동: 군에 간 사람만큼 노동 인구가 줄고, 건물에 고용되지 않은 사람은 자급 농업으로 간다. */
  const soldiers = (c.manpower.used + c.manpower.training) / 1e4;
  const lawC = law(d, c, 'conscription').fx;
  const W = Math.max(10, pop * 10 * E.laborShare * (1 + M.labor + (lawC.labor || 0) + (lawT.labor || 0)) - soldiers);
  const employed = sum(Object.values(staffed)), free = Math.max(0, W - employed);
  const subsistence = Math.min(free, W * E.subsistenceCap), unemployed = free - subsistence;
  let subsValue = 0;
  for (const [g, q] of Object.entries(E.subsistence)) { sup.subsistence[g] += subsistence * q; subsValue += subsistence * q * P[g]; }

  /* 계층 소득과 가계 수요 */
  const popOf = { workers: staffed.workers + unemployed, farmers: staffed.farmers + subsistence, business: 2 + owners.business + pop * .05, landowners: 2 + owners.landowners + pop * .05, military: Math.max(.5, soldiers) };
  const wageOf = i => (E.wage[i] || 0) * ec.wage;
  const gross = { workers: staffed.workers * wageOf('workers') + unemployed * wageOf('workers') * .15, farmers: staffed.farmers * wageOf('farmers') + subsValue, business: ec.dividends.business || 0, landowners: ec.dividends.landowners || 0, military: soldiers * wageOf('military') };
  let cpiNum = 0, cpiDen = 0; for (const g of d.goods) { cpiNum += (ec.needBase[g.id] || 0) * P[g.id]; cpiDen += (ec.needBase[g.id] || 0) * g.price; }
  const cpi = cpiDen > 0 ? cpiNum / cpiDen : 1;
  const taxRate = Math.max(0, lawE.tax * (1 + M.tax)), consumption = Math.max(.4, lawE.consumption * (1 + M.consumption));
  const pops = {}; let taxes = 0, bonds = 0;
  for (const i of STRATA) {
    const n = Math.max(1e-6, popOf[i]), tax = gross[i] * taxRate * (i === 'business' || i === 'landowners' ? 1.5 : 1);
    const net = gross[i] - tax, spend0 = Math.max(0, net * (1 - E.saving[i])), spend = spend0 * consumption;
    bonds += spend0 - spend; taxes += tax;
    const y = clamp(net / n / cpi / 8, .15, 40);
    const q = {}; let want = 0;
    for (const g of d.goods) { const nb = ec.needBase[g.id]; if (!nb) continue; q[g.id] = popOf[i] * nb * y ** g.need.e; want += q[g.id] * P[g.id]; }
    const fit = want > 0 ? spend / want : 0;
    for (const id of Object.keys(q)) dem.pops[id] += q[id] * fit;
    pops[i] = { pop: popOf[i], income: net, perCapita: net / n, y, fit, spend, sol: 10 * Math.sqrt(clamp(spend / n / cpi / 8, .04, 60)) };
  }

  /* 건설: 민간 공장의 건설점과 자재 */
  const rawPts = E.constructionBase + sum(pts.map(x => x.points));
  const mat = {}; for (const x of pts) for (const [g, q] of Object.entries(x.materials)) mat[g] = (mat[g] || 0) + q * x.points / Math.max(1, rawPts);
  let matShort = 1; for (const g of Object.keys(mat)) matShort = Math.min(matShort, 1 - (ec.short[g] || 0));
  const points = rawPts * Math.max(.3, 1 + M.construction + (lawT.construction || 0)) * matShort * stabF;
  const costPerPoint = Object.entries(mat).reduce((a, [g, q]) => a + q * P[g], 0);
  const usedPts = c.construction.length ? points : 0;
  for (const [g, q] of Object.entries(mat)) dem.construction[g] += usedPts * q;

  /* 세계시장 */
  const tradeCap = (E.tradeBase + ports * E.tradePerPort) * (lawT.tradeCap || 1) * Math.max(.2, 1 + M.tradeCap) * (1 - (c.blockade || 0)) * (isAtAnyWar(s, cid) ? .8 : 1);
  const want = [];
  for (const g of d.goods) {
    const S = sup.buildings[g.id] + sup.subsistence[g.id], B = dem.pops[g.id] + dem.industry[g.id] + dem.government[g.id] + dem.construction[g.id];
    const pw = g.price * g.world.price, r0 = priceRatio(S, B, E.price);
    const tImp = pw * (1 + E.tradeCost) / g.price - 1, tExp = pw * (1 - E.tradeCost) / g.price - 1;
    const avail = supplierShare(s, d, cid, g);
    if (B > 1e-9 && r0 > tImp && avail > 0) want.push({ g, pw, M: Math.max(0, supplyFor(B, Math.max(tImp, E.price.floor), E.price) - S) * Math.min(1, avail * 1.6), X: 0, avail });
    else if (S > 1e-9 && r0 < tExp) want.push({ g, pw, M: 0, X: Math.min(S * .5, Math.max(0, demandFor(S, Math.min(tExp, E.price.ceiling), E.price) - B)) });
  }
  const tradeValue = sum(want.map(x => (x.M + x.X) * x.g.price)), tf = tradeValue > tradeCap ? tradeCap / tradeValue : 1;
  let importValue = 0, exportValue = 0;
  for (const x of want) { sup.imports[x.g.id] = x.M * tf; dem.exports[x.g.id] = x.X * tf; importValue += x.M * tf * x.pw; exportValue += x.X * tf * x.pw; }

  /* 가격과 공급 부족 */
  const goods = {}, nextPrices = {}, nextShort = {};
  for (const g of d.goods) {
    const S = sup.buildings[g.id] + sup.subsistence[g.id] + sup.imports[g.id], B = dem.pops[g.id] + dem.industry[g.id] + dem.government[g.id] + dem.construction[g.id] + dem.exports[g.id];
    const ratio = priceRatio(S, B, E.price), target = g.price * (1 + ratio), np = P[g.id] + (target - P[g.id]) * E.price.speed;
    const pen = B > 1e-9 && B > S * E.shortageAt ? (S <= 1e-9 ? E.shortageMax : clamp((B / S - E.shortageAt) * .5, 0, E.shortageMax)) : 0;
    const ns = (ec.short[g.id] || 0) + (pen - (ec.short[g.id] || 0)) * .5;
    nextPrices[g.id] = round(np, 4); nextShort[g.id] = ns < .005 ? 0 : round(ns, 4);
    goods[g.id] = { id: g.id, base: g.price, price: P[g.id], next: nextPrices[g.id], ratio, supply: S, demand: B, shortage: pen,
      sup: { buildings: sup.buildings[g.id], subsistence: sup.subsistence[g.id], imports: sup.imports[g.id] }, dem: { pops: dem.pops[g.id], industry: dem.industry[g.id], government: dem.government[g.id], construction: dem.construction[g.id], exports: dem.exports[g.id] } };
  }
  const NP = nextPrices;

  /* 손익·배당·투자기금 */
  const div = { business: 0, landowners: 0 };
  let va = subsValue, govWages = 0, govGoods = 0, profitTax = 0, marketRev = 0, marketProfit = 0;
  for (const rec of recs) {
    let rev = 0, cost = 0;
    for (const [g, q] of Object.entries(rec.out)) rev += q * NP[g];
    for (const [g, q] of Object.entries(rec.in)) cost += q * NP[g];
    rec.revenue = rev; rec.cost = cost;
    if (rec.def.kind !== 'market') { govWages += rec.wages; govGoods += cost; va += rec.wages; rec.profit = null; rec.ok = true; continue; }
    const profit = rev - cost - rec.wages; rec.profit = profit; rec.margin = profit / Math.max(1, rev); va += rev - cost; marketRev += rev; marketProfit += profit;
    if (profit > 0) { const tax = profit * E.tax.profit; profitTax += tax; div[rec.def.owner === 'land' ? 'landowners' : 'business'] += profit - tax; }
    rec.ok = profit >= 0 || rec.occ;
  }
  for (const [g, q] of Object.entries(lineIn)) govGoods += q * lineShort * NP[g];
  govGoods += fuelUse * NP.fuel;
  const poolIn = div.business * E.investShare.business + div.landowners * E.investShare.landowners;
  const nextDividends = { business: round(div.business * (1 - E.investShare.business), 4), landowners: round(div.landowners * (1 - E.investShare.landowners), 4) };

  /* 다음 달 충원율 */
  const laborPool = unemployed + subsistence * .3;
  const own = recs.filter(r => !r.occ);
  const delta = own.map(rec => { const b = s.regions[rec.region].b[rec.bid]; return clamp((rec.ok ? 1 : Math.max(E.minStaff, b.staff - E.fireRate)) - b.staff, -E.fireRate, E.hireRate); });
  const hireJobs = own.reduce((a, rec, i) => a + Math.max(0, delta[i]) * rec.jobs, 0), hf = hireJobs > laborPool ? laborPool / hireJobs : 1;
  const nextStaff = own.map((rec, i) => ({ region: rec.region, bid: rec.bid, staff: round(clamp(s.regions[rec.region].b[rec.bid].staff + (delta[i] > 0 ? delta[i] * hf : delta[i]), 0, 1), 4) }));
  const rate = unemployed / W, margin = marketRev > 0 ? marketProfit / marketRev : 0;
  let push = clamp((.04 - rate) * .6, -.02, .02); if (margin < .05) push = Math.min(push, 0); if (margin < 0) push -= .01;
  const nextWage = round(clamp(ec.wage * (1 + push), .6, 3), 4);

  /* 재정 */
  const constructionCost = usedPts * costPerPoint * .5; // 자재값의 절반은 민간 자금(기업·은행)이 낸다고 본다
  const militaryPay = soldiers * wageOf('military');
  const admin = pop * E.baseExpensePerPop * 10;
  const income = taxes + profitTax + bonds;
  const interest = c.econ.debt * E.interest;
  const expense = govWages + govGoods + constructionCost + militaryPay + admin + interest;
  const finance = { income, taxes: taxes + profitTax, bonds, expense, govWages, govGoods, construction: constructionCost, military: militaryPay, admin, interest, balance: income - expense };

  /* 하루 단위로 나눠 쓸 비율 */
  const armsMult = Math.max(.2, 1 + M.arms + (lawE.arms || 0) + M.factory) * stabF;
  return {
    cid, goods, buildings: recs, pops, cpi, wage: ec.wage,
    labor: { workforce: W, employed, subsistence, unemployed, rate, soldiers },
    construction: { points, rawPoints: rawPts, costPerPoint, materials: mat, matShort },
    arms: { levels: armsLevels, staffed: armsStaffed, assigned, lineScale: lf, lineShort, mult: armsMult },
    docks: { levels: dockLevels, staffed: dockStaffed },
    trade: { capacity: tradeCap, used: Math.min(tradeValue, tradeCap), exports: exportValue, imports: importValue, blockade: c.blockade || 0 },
    fuel: { use: fuelUse, short: ec.short.fuel || 0 },
    finance, gdp: va, pool: poolIn, pop,
    next: { prices: nextPrices, short: nextShort, staff: nextStaff, wage: nextWage, dividends: nextDividends }
  };
}
const isAtAnyWar = (s, cid) => s.wars.some(w => w[0] === cid || w[1] === cid);

/** 군의 한 달 연료 사용(1,000 단위). 기계화 부대, 함선, 항공기. */
export function militaryFuel(s, d, cid) {
  const X = index(d); let f = 0;
  for (const dv of s.divisions) if (dv.owner === cid) { const st = divisionStatsCache(s, d, dv); f += (st.fuel || 0) * 30 * dv.str; }
  for (const fl of s.fleets) if (fl.owner === cid && fl.mission !== 'port') for (const [k, n] of Object.entries(fl.ships)) f += (X.ships.get(k).fuel || 0) * n * 30;
  for (const w of s.air) if (w.owner === cid && w.mission !== 'idle') f += w.count * .02 * 30;
  return f / 10;
}
// 군사 모듈이 등록하는 사단 능력치 계산(순환 참조를 피한다)
let divisionStatsCache = () => ({ fuel: 0 });
export const registerDivisionStats = fn => { divisionStatsCache = fn; };

/** 월 결산: 가격·부족·충원율·임금·배당·투자기금·부채를 적용하고 하루 단위 비율을 저장한다. */
export function commit(s, d, cid, R) {
  const c = s.countries[cid], ec = c.econ;
  ec.prices = R.next.prices; ec.short = R.next.short; ec.wage = R.next.wage; ec.dividends = R.next.dividends;
  for (const x of R.next.staff) { const b = s.regions[x.region].b[x.bid]; if (b) b.staff = x.staff; }
  ec.pool = round(clamp(ec.pool + R.pool, 0, d.economy.poolCap), 2);
  ec.debt = round(Math.max(0, ec.debt - R.finance.balance), 2);
  if (!ec.gdpBase) ec.gdpBase = R.gdp;
  ec.last = { gdp: round(R.gdp, 2), income: round(R.finance.income, 2), expense: round(R.finance.expense, 2), balance: round(R.finance.balance, 2), unemployment: round(R.labor.rate, 4), cpi: round(R.cpi, 4),
    trade: round(R.trade.used, 2), tradeCap: round(R.trade.capacity, 2), points: round(R.construction.points, 3), fuelShort: R.fuel.short, workforce: round(R.labor.workforce, 1), imports: round(R.trade.imports, 2), exports: round(R.trade.exports, 2) };
  c.rates = { points: round(R.construction.points / 30, 4), arms: round(R.arms.staffed * R.arms.mult * R.arms.lineShort * R.arms.lineScale, 4), docks: round(R.docks.staffed, 4), fuel: round(1 - (R.fuel.short || 0), 4) };
}

/** 새 게임: 가계의 기준 수요를 처음 공급에 맞추고(국내 생산 − 산업·정부 수요), 몇 달을 미리 돌려 가격을 균형 근처로 맞춘다. */
export function initEconomy(s, d, cid) {
  const c = s.countries[cid];
  c.econ = { prices: Object.fromEntries(d.goods.map(g => [g.id, g.price])), short: {}, wage: 1, needBase: {}, dividends: { business: 0, landowners: 0 }, pool: 0, debt: 0, gdpBase: 0, last: null };
  c.rates = { points: 0, arms: 0, docks: 0, fuel: 1 };
  const R0 = compute(s, d, cid);
  let w = 0; for (const i of STRATA) w += R0.pops[i].pop * Math.max(.3, R0.pops[i].y) ** .6;
  for (const g of d.goods) {
    if (!g.need) continue;
    const x = R0.goods[g.id], nonHH = x.dem.industry + x.dem.government + x.dem.construction;
    const avail = Math.max(x.supply * .3, x.supply - nonHH) + (g.id === 'consumer' || g.id === 'textiles' ? 2 : 0);
    c.econ.needBase[g.id] = round(avail / Math.max(1, w), 6);
  }
  for (let i = 0; i < 4; i++) { const R = compute(s, d, cid); commit(s, d, cid, R); }
  c.econ.gdpBase = 0; c.econ.debt = 0; c.econ.pool = 0;
  const R = compute(s, d, cid); commit(s, d, cid, R);
}

/* ---------- 하루 진행: 건설·생산 라인·조선 ---------- */
export function constructionCost(d, item) {
  const X = index(d);
  return item.kind === 'facility' ? X.facilities.get(item.id).cost : X.buildings.get(item.id).cost;
}
/** 하루치 건설점으로 대기열 앞에서부터 짓는다(한 사업에 하루 최대 maxPerProject/30). */
export function dailyConstruction(s, d, cid, done) {
  const c = s.countries[cid], X = index(d), M = mods(s, d, c), E = d.economy, lawE = law(d, c, 'economy').fx;
  let budget = c.rates.points;
  for (const q of c.construction) {
    if (budget <= 1e-9) break;
    const cost = constructionCost(d, q), st = s.regions[q.region];
    if (st.controller !== cid) continue;
    const boost = q.kind === 'building' && q.id === 'arms' ? 1 + (lawE.armsBuild || 0) : 1;
    const give = Math.min(budget, E.maxPerProject / 30, (cost - q.progress) / boost);
    q.progress = round(q.progress + give * boost, 4); budget -= give;
    if (q.progress >= cost - 1e-6) { q.done = true; done.push(q); }
  }
  for (const q of c.construction.filter(q => q.done)) {
    const st = s.regions[q.region];
    if (q.kind === 'facility') st[q.id] = Math.min(X.facilities.get(q.id).max, st[q.id] + 1);
    else { const b = st.b[q.id] || (st.b[q.id] = { level: 0, pm: 0, staff: .5 }); b.level += 1; }
  }
  c.construction = c.construction.filter(q => !q.done);
}
/** 생산 라인의 하루 산출. 효율이 오르고, 공장·원료·안정도·법이 곱해진다. */
export function dailyProduction(s, d, cid) {
  const c = s.countries[cid], X = index(d), E = d.economy, M = mods(s, d, c);
  const cap = E.lineCapBase + M.efficiencyCap;
  const total = lineFactories(c), scale = total > 0 ? Math.min(1, c.rates.arms / total) : 0;
  const out = {};
  for (const l of c.lines) {
    l.eff = round(Math.min(cap, l.eff + E.lineGrowth), 4);
    const eq = X.equipment.get(l.equip), pts = l.factories * scale * l.eff * E.armsOutputPerDay;
    const n = pts / eq.cost;
    l.carry = round((l.carry || 0) + n, 4);
    const whole = Math.floor(l.carry);
    if (whole > 0) { c.stock[l.equip] = (c.stock[l.equip] || 0) + whole; l.carry = round(l.carry - whole, 4); out[l.equip] = (out[l.equip] || 0) + whole; }
    l.lastPerDay = round(n, 4);
  }
  return out;
}
/** 조선소의 하루 진행. 끝난 배는 반환한다. */
export function dailyShipyard(s, d, cid) {
  const c = s.countries[cid], X = index(d), E = d.economy;
  const total = sum(c.naval.map(n => n.docks)), scale = total > 0 ? Math.min(1, c.rates.docks / total) : 0;
  const built = [];
  for (const n of c.naval) {
    n.progress = round(n.progress + n.docks * scale * E.dockOutputPerDay, 3);
    const cost = X.ships.get(n.ship).cost;
    while (n.progress >= cost && n.count > 0) { n.progress = round(n.progress - cost, 3); n.count -= 1; built.push(n.ship); }
  }
  c.naval = c.naval.filter(n => n.count > 0);
  return built;
}
