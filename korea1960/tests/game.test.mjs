/* game/engine.mjs·game/economy.mjs(v3, 데이터 2.0.0, 저장 형식 5) 검증.
 * 사건·권한·시계·저장 규칙(v2에서 이어진 것)과 시장·건설·법률·이해집단(v3에서 새로 든 것), 자동 캠페인 불변식.
 * 실행: node --test tests/          (CAMPAIGN_SEEDS=40 처럼 환경 변수로 자동 캠페인 수를 늘릴 수 있다)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../game/engine.mjs';
import { playCampaign, checkInvariants, checkMarket, STRATEGIES } from './helpers/campaign.mjs';
const { createState, dispatch, exportSave, importSave, evaluateEnding, finance, policyReason, random, calendar, dateLabel } = E;
const EC = E.econ;
const d = JSON.parse(fs.readFileSync(new URL('../data/game.json', import.meta.url), 'utf8'));
const X = d.economy;
const clone = x => JSON.parse(JSON.stringify(x));
function exec(s, a) { const r = dispatch(s, d, a); assert.equal(r.ok, true, r.error); return r.state; }
const refuse = (s, a, pattern) => { const r = dispatch(s, d, a); assert.equal(r.ok, false, `${a.type}이 받아들여짐`); if (pattern) assert.match(r.error, pattern); assert.equal(r.state, s); };
function free(s) { while (s.queue.length && !s.ending) { const e = d.events.find(x => x.id === s.queue[0]); s = exec(s, { type: 'choose', choiceId: e.choices.find(c => (c.effects.treasury || 0) >= 0 && !c.ending)?.id || e.choices[0].id }); } return s; }
/** 국정 운영 단계의 시험용 상태(1965년 1월, 국고 500). 경제 상태는 새 게임의 것 그대로다. */
function governing(seed) { const s = createState(d, seed); s.queue = []; s.turn = 60; s.phase = 'governing'; s.stats.treasury = 500; s.flags.won1963 = true; return s; }
function advance(s, n) { for (let i = 0; i < n && !s.ending; i++) { s = free(s); if (s.ending) break; s = exec(s, { type: 'endMonth' }); } return s; }
/** 사건을 받지 않고 달만 넘긴다(시험용: 사건 큐를 비우며 진행). */
function months(s, n) { for (let i = 0; i < n && !s.ending; i++) { s = clone(s); s.queue = []; s = exec(s, { type: 'endMonth' }); } s = clone(s); s.queue = []; return s; }
const bld = (s, id, regionId) => s.buildings.find(b => b.id === id && b.regionId === regionId);
const SEEDS = Number(process.env.CAMPAIGN_SEEDS || 6);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
/** 연대기에서 법률이 제정된 기록(발의·통과 기록과 구분). */
const enacted = s => s.log.find(l => l.type === 'law' && / 제정 \(/.test(l.text));

/* ===== 콘텐츠와 시작 상태 ===== */
test('content: unique IDs, 189 choices, and every cross-reference resolves', () => {
  assert.equal(d.events.length, 63); assert.equal(d.events.flatMap(e => e.choices).length, 189);
  for (const k of ['events', 'policies', 'buildings', 'goods', 'laws', 'lawGroups', 'interestGroups', 'endings', 'edicts', 'regions']) assert.equal(new Set(d[k].map(x => x.id)).size, d[k].length, k);
  const goods = new Set(d.goods.map(g => g.id)), igs = new Set(d.interestGroups.map(g => g.id)), metrics = new Set(d.metrics.map(m => m.id)), buildings = new Set(d.buildings.map(b => b.id));
  for (const b of d.buildings) for (const pm of b.pm) {
    for (const g of [...Object.keys(pm.in), ...Object.keys(pm.out), ...Object.keys(pm.materials || {})]) assert.ok(goods.has(g), `${b.id} ${g}`);
    for (const i of Object.keys(pm.jobs)) assert.ok(igs.has(i), `${b.id} ${i}`);
    for (const m of Object.keys(pm.unlock?.metric || {})) assert.ok(metrics.has(m));
  }
  for (const g of d.lawGroups) assert.equal(d.laws.filter(l => l.group === g.id && l.initial).length, 1, g.id);
  for (const l of d.laws) { assert.ok(d.lawGroups.some(g => g.id === l.group)); for (const i of Object.keys(l.stances)) assert.ok(igs.has(i)); for (const key of Object.keys(l.modifiers)) assert.ok(EC.MODIFIER_KEYS.includes(key), `${l.id} ${key}`); }
  for (const g of d.interestGroups) for (const x of g.demands) for (const id of x.buildings) assert.ok(buildings.has(id), `${g.id} ${id}`);
  for (const e of d.events) for (const c of e.choices) for (const id of Object.keys(c.factionEffects || {})) assert.ok(igs.has(id), `${e.id} ${id}`);
  for (const r of d.regions) for (const id of Object.keys(r.start)) assert.ok(buildings.has(id) && !EC.siteReason({ buildings: [], construction: [] }, d, id, r.id), `${r.id} ${id}`);
});
test('initial state: date, authority, market in balance, starting laws and coalition', () => {
  const s = createState(d);
  assert.equal(dateLabel(s.turn), '1960-01'); assert.equal(s.phase, 'prelude'); assert.equal(s.ap, 3); assert.deepEqual(s.queue, ['opening']); assert.match(policyReason(s, d, 'farm_extension'), /사건/);
  assert.equal(s.stats.gdp, 100); assert.ok(s.stats.unemployment > 8 && s.stats.unemployment < 16);
  for (const g of d.lawGroups) assert.equal(d.laws.find(l => l.id === s.laws[g.id]).initial, true);
  assert.deepEqual(s.government, X.government.start);
  assert.equal(EC.levelsOf(s, ['farm']), 40);
  for (const g of d.goods) assert.ok(Math.abs(s.econ.prices[g.id] / g.price - 1) <= X.price.ceiling + 1e-9, g.id);
  const R = EC.compute(s, d); near(R.gdp, 100, .01); assert.ok(R.finance.balance > 0 && R.finance.balance < 8, `시작 월 수지 ${R.finance.balance}`);
  for (const g of d.interestGroups) assert.ok(s.support[g.id] > 20 && s.support[g.id] < 95);
});
test('pending event blocks end turn and ordinary actions', () => { const s = createState(d); for (const a of [{ type: 'endMonth' }, { type: 'tick' }, { type: 'prepare' }, { type: 'adviser', id: 'han' }, { type: 'build', id: 'school', regionId: 'capital' }]) refuse(s, a); });
test('choice invalid ID leaves original state untouched', () => { const s = createState(d), before = exportSave(s); assert.equal(dispatch(s, d, { type: 'choose', choiceId: 'not_registered' }).ok, false); assert.equal(exportSave(s), before); });
test('preparation consumes AP and changes no national metric', () => { let s = free(createState(d)); const stats = { ...s.stats }; for (let i = 0; i < 3; i++) s = exec(s, { type: 'prepare' }); assert.deepEqual(s.stats, stats); assert.equal(s.ap, 0); refuse(s, { type: 'prepare' }); refuse(s, { type: 'policy', id: 'farm_extension' }); });
test('monthly transition replenishes AP and changes date', () => { let s = free(createState(d)); s = exec(s, { type: 'prepare' }); s = exec(s, { type: 'endMonth' }); assert.equal(s.turn, 1); assert.equal(s.ap, 3); assert.equal(calendar(s.turn).month, 2); assert.equal(s.queue.length, 1); });
test('both 1961 branches set different rights and authority; the transition brings the military into the coalition', () => {
  let a = createState(d); a.turn = 16; a.queue = ['may_1961'];
  const b = exec(a, { type: 'choose', choiceId: 'may_1961_2' }); a = exec(a, { type: 'choose', choiceId: 'may_1961_1' });
  assert.equal(a.phase, 'civilian'); assert.equal(b.phase, 'transition'); assert.ok(a.stats.liberty > b.stats.liberty); assert.equal(a.flags.route, 'constitutional');
  assert.ok(b.government.includes('military') && !a.government.includes('military')); assert.ok(b.government.length <= X.government.max);
  refuse(b, { type: 'coalition', id: 'military' }, /과도 통치/);
});
test('1963 election failure transfers power and blocks later actions', () => { const s = createState(d); s.turn = 45; s.queue = ['election_1963']; s.influence = 0; s.stats.legitimacy = 20; let failed; for (let seed = 1; seed < 100; seed++) { s.rng = seed * 100003; const r = exec(s, { type: 'choose', choiceId: 'election_1963_1' }); if (r.ending) { failed = r; break; } } assert.equal(failed?.ending.id, 'peaceful_transfer'); refuse(failed, { type: 'endMonth' }); });
test('policy spends resources once and cannot be duplicated; locked year and empty treasury refuse', () => {
  let s = governing(); const p = d.policies.find(x => x.id === 'farm_extension'), before = s.stats.agriculture;
  s = exec(s, { type: 'policy', id: p.id }); assert.equal(s.stats.treasury, 500 - p.cost); assert.equal(s.ap, 2); near(s.stats.agriculture, before + p.effects.agriculture); refuse(s, { type: 'policy', id: p.id }, /이미/);
  const t = governing(); t.turn = 36; t.stats.treasury = 0; refuse(t, { type: 'policy', id: 'research_fund' }, /1966/); refuse(t, { type: 'policy', id: 'farm_extension' }, /국고/);
  assert.ok(d.policies.every(x => !('requiresBill' in x)));
});
test('budget must be numeric, nonnegative and total exactly 100', () => { const s = governing(); for (const budget of [{ industry: 100 }, { industry: 20, agriculture: 20, education: 20, welfare: 20, infrastructure: 20, security: 20 }, { industry: -1, agriculture: 21, education: 20, welfare: 20, infrastructure: 20, security: 20 }, null]) refuse(s, { type: 'budget', budget }); const ok = exec(s, { type: 'budget', budget: { industry: 30, agriculture: 10, education: 20, welfare: 20, infrastructure: 10, security: 10 } }); assert.equal(ok.ap, 3); assert.equal(ok.budget.industry, 30); });
test('foreign action affects relationship, treasury and AP, once per country per month', () => { let s = governing(); const rel = s.relations.japan; s = exec(s, { type: 'diplomacy', countryId: 'japan', mode: 'talk' }); assert.equal(s.stats.treasury, 496); assert.equal(s.relations.japan, rel + 4); assert.equal(s.ap, 2); refuse(s, { type: 'diplomacy', countryId: 'japan', mode: 'humanitarian' }, /이번 달/); s = months(s, 1); assert.equal(dispatch(s, d, { type: 'diplomacy', countryId: 'japan', mode: 'talk' }).ok, true); });
test('two advisers maximum; dismissal consumes one AP', () => { let s = governing(); s = exec(s, { type: 'adviser', id: 'han' }); s = exec(s, { type: 'adviser', id: 'yun' }); refuse(s, { type: 'adviser', id: 'min' }); s = exec(s, { type: 'adviser', id: 'han' }); assert.deepEqual(s.advisers, ['yun']); assert.equal(s.ap, 0); });
test('debt repayment is finite, funded and limited to outstanding debt', () => { let s = governing(); for (const amount of [-1, NaN, Infinity, 1000, '10']) refuse(s, { type: 'repay', amount }); s = exec(s, { type: 'repay', amount: 10 }); assert.equal(s.stats.debt, 70); assert.equal(s.stats.treasury, 490); });
test('finance: income minus expense is the balance, and negative cash borrows exactly the shortfall', () => {
  let s = governing(); s.stats.treasury = 0; s.stats.debt = 600; for (const p of d.policies) s.policies.push(p.id);
  const f = finance(s, d), oldDebt = s.stats.debt; near(f.income - f.expense, f.balance); near(f.base + f.interest + f.upkeep, f.expense); assert.ok(f.balance < 0);
  s = exec(s, { type: 'endMonth' }); near(s.stats.debt, oldDebt - f.balance, 1e-9); assert.equal(s.stats.treasury, 0); near(s.report.borrowed, -f.balance, 1e-9);
});
test('delayed effects apply once at the specified month boundary', () => { let s = governing(); s.queue = ['japan_1965']; s.turn = 65; s = exec(s, { type: 'choose', choiceId: 'japan_1965_1' }); assert.equal(s.delayed.length, 1); s = advance(s, 3); assert.equal(s.delayed.length, 1); s = advance(s, 1); assert.equal(s.delayed.length, 0); assert.equal(s.log.filter(l => l.type === 'followup').length, 1); s = advance(s, 2); assert.equal(s.log.filter(l => l.type === 'followup').length, 1); });
test('identical seed and actions produce identical campaign state', () => { assert.deepEqual(advance(createState(d, 777), 30), advance(createState(d, 777), 30)); assert.notDeepEqual(advance(createState(d, 777), 30).log, advance(createState(d, 778), 30).log); });
test('RNG produces finite range and calendar handles endpoints', () => { const s = createState(d); for (let i = 0; i < 500; i++) { const n = random(s); assert.ok(n >= 0 && n < 1); } assert.equal(dateLabel(239), '1979-12'); });
test('ending precedence keeps fiscal failure above other failures', () => { const s = governing(); s.stats.debt = 700; s.stats.liberty = 0; s.stats.legitimacy = 0; evaluateEnding(s, d); assert.equal(s.ending.id, 'fiscal_crisis'); });
test('all 12 ending selectors are reachable by explicit or metric fixture', () => {
  for (const e of d.endings) {
    let s = governing();
    if (e.conditions.explicit) { const event = e.id === 'retired' ? 'election_1963' : 'buma_1979', c = e.id === 'retired' ? 'election_1963_3' : 'buma_1979_3'; s.queue = [event]; s = exec(s, { type: 'choose', choiceId: c }); }
    else { for (const m of d.metrics) s.stats[m.id] = m.initial; if (!E.CRISIS_ENDINGS.includes(e.id)) { s.stats.legitimacy = 50; s.stats.liberty = 50; } for (const [key, rule] of Object.entries(e.conditions)) for (const [op, value] of Object.entries(rule)) s.stats[key] = op === 'lt' ? value - 1 : value; evaluateEnding(s, d, true); }
    assert.equal(s.ending.id, e.id);
  }
});
test('after an ending no action changes state', () => { const s = governing(); s.stats.debt = 700; const t = exec(s, { type: 'prepare' }.type === 'x' ? {} : { type: 'budget', budget: s.budget }); assert.equal(t.ending.id, 'fiscal_crisis'); for (const a of [{ type: 'endMonth' }, { type: 'tick' }, { type: 'build', id: 'school', regionId: 'capital' }, { type: 'enact', id: 'press_freedom' }, { type: 'coalition', id: 'workers' }, { type: 'policy', id: 'farm_extension' }]) refuse(t, a, /종료/); });
test('prototype keys and missing payloads are rejected without corrupting state', () => {
  const s = governing(), before = exportSave(s);
  for (const a of [null, 5, {}, { type: 'toString' }, { type: 'build', id: '__proto__', regionId: 'capital' }, { type: 'build', id: 'school', regionId: 'constructor' }, { type: 'enact', id: 'hasOwnProperty' }, { type: 'coalition', id: '__proto__' }, { type: 'pm', id: 'farm', regionId: 'capital', pm: 'constructor' }, { type: 'diplomacy', countryId: 'usa', mode: 'toString' }, { type: 'cancelBuild', index: 'length' }, { type: 'edict', id: 'grain_drive' }]) assert.equal(dispatch(s, d, a).ok, false, JSON.stringify(a));
  assert.equal(exportSave(s), before);
});

/* ===== 시계 ===== */
test('clock: real month lengths and day labels', () => { assert.equal(E.daysInMonth(0), 31); assert.equal(E.daysInMonth(1), 29); assert.equal(E.daysInMonth(13), 28); assert.equal(E.daysInMonth(3), 30); assert.equal(E.dayLabel(16, 16), '1961-05-16'); });
test('clock: a day tick only moves the date, never mutates the input and is blocked by a pending event', () => { const s = createState(d); refuse(s, { type: 'tick' }); const f = free(s), t = exec(f, { type: 'tick' }); assert.equal(f.day, 1); assert.equal(t.day, 2); assert.equal(t.turn, 0); assert.equal(t.stats, f.stats); });
test('clock: ticking through a month gives exactly the same state as the month-end action', () => { const s = free(createState(d, 42)); let t = s; for (let i = 0; i < 31; i++) t = exec(t, { type: 'tick' }); assert.deepEqual(t, exec(s, { type: 'endMonth' })); assert.equal(t.turn, 1); assert.equal(t.day, 1); });
test('clock: month-end settlement is dated the last day; actions are dated the day they happen', () => { let s = governing(); for (let i = 0; i < 9; i++) s = exec(s, { type: 'tick' }); s = exec(s, { type: 'policy', id: 'farm_extension' }); assert.equal(s.log.at(-1).date, '1965-01-10'); s.stats.treasury = 0; for (const p of d.policies) if (!s.policies.includes(p.id)) s.policies.push(p.id); s.stats.debt = 0; s = exec(s, { type: 'endMonth' }); assert.equal(s.log.find(l => l.type === 'finance').date, '1965-01-31'); });

/* ===== 시장: 주문과 가격 ===== */
test('market: the price follows buy and sell orders inside its band', () => {
  const r = (S, B) => EC.priceRatio(S, B, X);
  assert.equal(r(100, 100), 0); near(r(100, 120), X.price.swing * .2); near(r(120, 100), -X.price.swing * .2); assert.equal(r(100, 1000), X.price.ceiling); assert.equal(r(1000, 100), X.price.floor); assert.equal(r(0, 10), X.price.ceiling); assert.equal(r(10, 0), X.price.floor); assert.equal(r(0, 0), 0);
});
test('market: every good lists where its supply comes from and where its demand goes', () => {
  const s = createState(d), R = checkMarket(s, d);
  for (const g of d.goods) { const x = R.goods[g.id]; near(Object.values(x.sup).reduce((a, b) => a + b, 0), x.supply, 1e-6); near(Object.values(x.dem).reduce((a, b) => a + b, 0), x.demand, 1e-6); near(x.next, x.price + (x.target - x.price) * X.price.speed, 1e-3); }
  assert.ok(R.goods.grain.dem.pops > 2000 && R.goods.grain.sup.subsistence > 500); assert.equal(R.goods.services.sup.imports, 0); assert.equal(R.goods.electricity.dem.exports, 0);
  assert.ok(R.goods.steel.sup.imports > 0 && R.goods.steel.sup.buildings === 0, '강철은 처음에 전부 수입');
});
test('market: more supply lowers the price, more demand raises it', () => {
  const s = createState(d), R = EC.compute(s, d);
  const t = clone(s); bld(t, 'commerce', 'capital').level += 12; const R2 = EC.compute(t, d);
  assert.ok(R2.goods.services.supply > R.goods.services.supply * 1.2 && R2.goods.services.ratio < R.goods.services.ratio - .05);
  const u = clone(s); bld(u, 'barracks', 'capital').level += 10; const R3 = EC.compute(u, d);
  assert.ok(R3.goods.arms.dem.government > R.goods.arms.dem.government * 2);
  assert.ok(R2.goods.transport.dem.industry > R.goods.transport.dem.industry, '상가가 늘면 운송 수요도 는다');
});
test('market: an input shortage cuts the output of the buildings that use it', () => {
  const s = createState(d), R = EC.compute(s, d), t = clone(s); t.econ.short.fabric = .4;
  const a = R.buildings.find(x => x.def.id === 'garment'), b = EC.compute(t, d).buildings.find(x => x.def.id === 'garment' && x.b.regionId === a.b.regionId);
  near(b.out.clothes, a.out.clothes * .6, 1e-6);
  const dry = clone(s); for (const x of dry.buildings) if (x.id === 'coal_mine') x.level = 0; const R2 = EC.compute(dry, d);
  assert.ok(R2.goods.coal.ratio > R.goods.coal.ratio, '탄광이 없으면 석탄이 오른다'); assert.ok(R2.goods.coal.sup.imports > R.goods.coal.sup.imports);
});
test('trade: imports arrive above the import price, exports leave below the export price, inside the trade capacity', () => {
  const s = createState(d), R = EC.compute(s, d);
  assert.ok(R.trade.used <= R.trade.capacity + 1e-9 && R.trade.imports > 0 && R.trade.exports > 0);
  const open = clone(s); open.laws.trade = 'open_trade'; const R2 = EC.compute(open, d);
  assert.ok(R2.goods.steel.target < R.goods.steel.target, '관세가 낮으면 수입품 가격이 낮다'); assert.ok(R2.detail.tariffs < R.detail.tariffs && R2.trade.capacity > R.trade.capacity);
  const noPort = clone(s); noPort.buildings = noPort.buildings.filter(b => b.id !== 'port'); assert.ok(EC.compute(noPort, d).trade.capacity < R.trade.capacity);
  const poor = clone(s); poor.stats.reserves = X.forexFloor / 4; assert.ok(EC.compute(poor, d).goods.steel.sup.imports < R.goods.steel.sup.imports, '외환이 모자라면 수입이 준다');
  const glut = clone(s); bld(glut, 'garment', 'capital').level += 6; const R3 = EC.compute(glut, d); assert.ok(R3.goods.clothes.dem.exports > R.goods.clothes.dem.exports, '남는 의복은 수출된다');
  const drive = clone(s); drive.laws.trade = 'export_drive'; assert.ok(EC.compute(drive, d).detail.exportSubsidy > 0);
});
test('trade: the world oil price steps up at the two shocks', () => { const oil = d.goods.find(g => g.id === 'oil'); assert.equal(EC.worldPrice(oil, 164), oil.price); near(EC.worldPrice(oil, 165), oil.price * 2.2); near(EC.worldPrice(oil, 228), oil.price * 3.1); assert.equal(EC.worldPrice(d.goods.find(g => g.id === 'services'), 0), null); });
test('labor: everyone is employed, on a subsistence farm or unemployed; the metric follows the market', () => {
  let s = governing(); const R = EC.compute(s, d);
  near(R.labor.employed + R.labor.subsistence + R.labor.unemployed, R.labor.workforce, 1e-6);
  const t = clone(s); for (const b of t.buildings) if (b.id === 'farm') b.level = 1; const R2 = EC.compute(t, d); assert.ok(R2.labor.unemployed > R.labor.unemployed + 300);
  t.stats.unemployment = 10; const next = months(t, 1); assert.ok(next.stats.unemployment > 10); assert.ok(next.report.ledger.unemployment.some(r => r[0].startsWith('고용')));
});
test('wages and taxes follow the laws in force', () => {
  const s = governing(), R = EC.compute(s, d);
  const lab = clone(s); lab.laws.labor = 'worker_protection'; near(EC.compute(lab, d).pops.workers.wage, R.pops.workers.wage * 1.14, 1e-6);
  assert.equal(R.detail.taxes.wage, 0); const tax = clone(s); tax.laws.taxation = 'income_tax'; const R2 = EC.compute(tax, d); assert.ok(R2.detail.taxes.wage > 0 && R2.detail.taxes.consumption < R.detail.taxes.consumption);
  const admin = clone(s); admin.stats.admin = 80; assert.ok(EC.compute(admin, d).detail.collect > R.detail.collect, '행정 역량이 높으면 세금이 덜 샌다');
  const relief = clone(s); relief.laws.welfare_system = 'public_relief'; assert.ok(EC.compute(relief, d).detail.relief > 0);
  const land = clone(s); land.laws.land = 'owner_farmer'; const R3 = EC.compute(land, d); assert.ok(R3.next.dividends.farmers > R.next.dividends.farmers && R3.next.dividends.landowners < R.next.dividends.landowners, '농장 이익이 농민에게 간다');
});
test('production: capability indexes, education and regional infrastructure change throughput', () => {
  const s = governing(), R = EC.compute(s, d), mill = r => r.buildings.find(x => x.def.id === 'textile_mill' && x.b.regionId === 'capital');
  const ind = clone(s); ind.stats.industry += 20; near(mill(EC.compute(ind, d)).thr / mill(R).thr, (1 + (ind.stats.industry - X.techBase.industry) * X.techPerPoint) / (1 + (s.stats.industry - X.techBase.industry) * X.techPerPoint), 1e-6);
  const crowded = clone(s); bld(crowded, 'textile_mill', 'capital').level += 30; const R2 = EC.compute(crowded, d); assert.ok(R2.infra.capital.access < 1 && R2.infra.capital.access >= X.accessFloor && R2.infra.busan.access === 1);
  const rail = clone(crowded); bld(rail, 'railway', 'capital').level += 4; assert.ok(EC.compute(rail, d).infra.capital.access > R2.infra.capital.access);
  const def = d.buildings.find(b => b.id === 'electronics'); const low = clone(s); low.stats.education = 20; const high = clone(s); high.stats.education = 60;
  assert.ok(EC.prospect(high, d, EC.compute(high, d), def, 'capital').revenue > EC.prospect(low, d, EC.compute(low, d), def, 'capital').revenue, '교육이 낮으면 전자 공장의 효율이 떨어진다');
});

/* ===== 건설과 건물 운영 ===== */
test('build: queues one level for AP only, pays materials month by month and completes when the points are in', () => {
  let s = governing(); const before = bld(s, 'school', 'jeju')?.level || 0, def = d.buildings.find(b => b.id === 'school');
  const idle = EC.compute(s, d); assert.equal(idle.detail.construction, 0); assert.equal(idle.goods.wood.dem.construction, 0);
  s = exec(s, { type: 'build', id: 'school', regionId: 'jeju' });
  assert.equal(s.ap, 2); assert.equal(s.stats.treasury, 500); assert.deepEqual(s.construction.at(-1), { id: 'school', regionId: 'jeju', progress: 0, private: false });
  const R = EC.compute(s, d); assert.ok(R.detail.construction > 0 && R.goods.wood.dem.construction > 0 && R.finance.balance < idle.finance.balance);
  const i = s.construction.findIndex(q => !q.private); assert.ok(R.construction.gains[i] > 0 && R.construction.gains[i] <= X.maxPerProject + 1e-9);
  let n = 0; while (s.construction.some(q => q.id === 'school' && q.regionId === 'jeju') && n++ < 40) s = months(s, 1);
  assert.ok(n >= Math.ceil(def.cost / X.maxPerProject) && n < 40, `공기 ${n}개월`);
  const b = bld(s, 'school', 'jeju'); assert.equal(b.level, before + 1); assert.equal(b.state, b.level); assert.equal(s.counters.built, 1); assert.deepEqual(s.counters.regions, ['jeju']);
  assert.ok(s.report.completed.some(c => c.buildingId === 'school' && c.regionId === 'jeju' && !c.private)); assert.ok(s.log.some(l => l.type === 'construction' && l.text.includes('준공') && l.buildingId === 'school'));
  assert.ok(E.regionDevelopment(s, d, 'jeju') > E.regionDevelopment(governing(), d, 'jeju'));
});
test('build: needs the region terrain or resource, room, the unlock year, and executive authority', () => {
  const s = governing();
  refuse(s, { type: 'build', id: 'coal_mine', regionId: 'jeju' }, /석탄/); refuse(s, { type: 'build', id: 'shipyard', regionId: 'capital' }, /1968/); refuse(s, { type: 'build', id: 'nope', regionId: 'capital' }, /알 수 없는/);
  const full = clone(s); bld(full, 'farm', 'jeonnam').level = d.regions.find(r => r.id === 'jeonnam').arable; refuse(full, { type: 'build', id: 'farm', regionId: 'jeonnam' }, /경지/);
  const dam = clone(s); dam.buildings.push({ id: 'hydro_dam', regionId: 'gangwon', level: 2, pm: 0, staff: 1, state: 2, subsidy: false }); refuse(dam, { type: 'build', id: 'hydro_dam', regionId: 'gangwon' }, /2단계/);
  let q = clone(s); q.ap = 99; for (let i = 0; i < X.queueMax; i++) { q.ap = 3; q = exec(q, { type: 'build', id: 'school', regionId: 'capital' }); } q.ap = 3; refuse(q, { type: 'build', id: 'school', regionId: 'capital' }, /대기열/);
  const early = createState(d); early.queue = []; refuse(early, { type: 'build', id: 'school', regionId: 'capital' }, /권한/);
  const noAp = clone(s); noAp.ap = 0; refuse(noAp, { type: 'build', id: 'school', regionId: 'capital' }, /행동점수/);
});
test('queue: cancel drops a government project, prioritise moves it first, private projects are untouchable', () => {
  let s = governing(); s.construction = [{ id: 'garment', regionId: 'busan', progress: 5, private: true }];
  s = exec(s, { type: 'build', id: 'school', regionId: 'capital' }); s = exec(s, { type: 'build', id: 'clinic', regionId: 'jeju' });
  refuse(s, { type: 'cancelBuild', index: 0 }, /민간/); refuse(s, { type: 'prioritize', index: 0 }, /민간/); refuse(s, { type: 'prioritize', index: 1 }, /맨 앞/); refuse(s, { type: 'cancelBuild', index: 9 }, /대기열/);
  const p = exec(s, { type: 'prioritize', index: 2 }); assert.deepEqual(p.construction.map(q => q.id), ['garment', 'clinic', 'school']); assert.equal(p.ap, s.ap);
  const c = exec(s, { type: 'cancelBuild', index: 1 }); assert.deepEqual(c.construction.map(q => q.id), ['garment', 'clinic']); assert.equal(c.ap, s.ap);
});
test('construction points come from the construction sector and are shared with private projects by the economic law', () => {
  const s = governing(), R = EC.compute(s, d), sector = EC.levelsOf(s, ['construction']);
  near(R.construction.rawPoints, X.constructionBase + sector * d.buildings.find(b => b.id === 'construction').pm[0].points, 1e-6);
  const more = clone(s); bld(more, 'construction', 'capital').level += 2; assert.ok(EC.compute(more, d).construction.points > R.construction.points && EC.compute(more, d).detail.govWages > R.detail.govWages);
  const both = clone(s); both.econ.pool = 40; both.construction = [{ id: 'garment', regionId: 'busan', progress: 0, private: true }, { id: 'steel_mill', regionId: 'busan', progress: 0, private: false }, { id: 'steel_mill', regionId: 'capital', progress: 0, private: false }];
  const R2 = EC.compute(both, d); assert.ok(R2.construction.usedPriv > 0 && R2.construction.usedPriv <= R2.construction.points * R2.mods.privateShare + 1e-6 && R2.construction.usedGov > 0); near(R2.detail.poolTransfer, R2.pool.out, 1e-9);
  const market = clone(both); market.laws.economic_system = 'market_led'; assert.equal(EC.compute(market, d).mods.privateShare, .7);
  const planned = clone(s); planned.laws.economic_system = 'planned_development'; near(EC.compute(planned, d).construction.points, R.construction.points * 1.1, 1e-6);
});
test('edict: a construction bonus speeds projects in that region only', () => {
  const s = governing(); s.construction = [{ id: 'school', regionId: 'busan', progress: 0, private: false }, { id: 'school', regionId: 'jeju', progress: 0, private: false }];
  const base = EC.compute(s, d).construction.gains; assert.ok(base[0] > 0 && base[1] > 0);
  const t = clone(s); t.edicts = [{ edictId: 'export_priority', regionId: 'busan', startedTurn: 50 }]; const g = EC.compute(t, d).construction.gains;
  near(g[0], base[0] * 1.15, 1e-6); near(g[1], base[1], 1e-6);
});
test('private investment: the investment pool starts profitable buildings by itself and they stay private', () => {
  let s = createState(d, 9); s.queue = []; const before = s.buildings.reduce((a, b) => a + b.level, 0);
  let started = null; for (let i = 0; i < 12 && !started; i++) { s = months(s, 1); started = s.report.started; }
  assert.ok(started, '첫 해 안에 민간 착공'); const def = d.buildings.find(b => b.id === started.buildingId); assert.ok(def.private !== false && !def.gov);
  for (let i = 0; i < 30 && !s.counters.privateBuilt; i++) s = months(s, 1);
  assert.ok(s.counters.privateBuilt >= 1 && s.counters.built === 0); assert.ok(s.buildings.reduce((a, b) => a + b.level, 0) > before);
  const done = s.log.find(l => l.type === 'construction' && l.text.includes('민간 투자')); const b = bld(s, done.buildingId, done.regionId); assert.ok(b.state < b.level);
  assert.ok(s.econ.pool >= 0 && s.econ.pool <= X.poolCap);
});
test('production method: unlocked by index or year, free of AP, retools the building and changes inputs and outputs', () => {
  let s = governing(); const def = d.buildings.find(b => b.id === 'farm');
  refuse(s, { type: 'pm', id: 'farm', regionId: 'jeonnam', pm: 1 }, /농업/); refuse(s, { type: 'pm', id: 'farm', regionId: 'jeonnam', pm: 0 }, /이미/); refuse(s, { type: 'pm', id: 'farm', regionId: 'jeonnam', pm: 7 }, /알 수 없는/); refuse(s, { type: 'pm', id: 'farm', regionId: 'busan', pm: 1 }, /없습니다/);
  s.stats.agriculture = 45; refuse(s, { type: 'pm', id: 'farm', regionId: 'jeonnam', pm: 2 }, /1968/);
  const R = EC.compute(s, d), t = exec(s, { type: 'pm', id: 'farm', regionId: 'jeonnam', pm: 1 });
  assert.equal(t.ap, s.ap); assert.equal(bld(t, 'farm', 'jeonnam').pm, 1); near(bld(t, 'farm', 'jeonnam').staff, bld(s, 'farm', 'jeonnam').staff * X.retool, 1e-4);
  const u = clone(t); bld(u, 'farm', 'jeonnam').staff = bld(s, 'farm', 'jeonnam').staff; const R2 = EC.compute(u, d), rec = r => r.buildings.find(x => x.def.id === 'farm' && x.b.regionId === 'jeonnam');
  near(rec(R2).out.grain / rec(R).out.grain, def.pm[1].out.grain / def.pm[0].out.grain, 1e-6); assert.ok(R2.goods.fertilizer.dem.industry > R.goods.fertilizer.dem.industry);
  assert.equal(EC.pmUnlocked(s, d.buildings.find(b => b.id === 'railway'), 1), false); const later = clone(s); later.turn = 90; assert.equal(EC.pmUnlocked(later, d.buildings.find(b => b.id === 'railway'), 1), true);
});
test('subsidy: keeps a losing private building staffed at the treasury cost, where the economic law allows', () => {
  let s = governing(); bld(s, 'garment', 'capital').level = 30; // 봉제 공장을 크게 늘려 손실을 만든다
  s = months(s, 2); const R = EC.compute(s, d), rec = R.buildings.find(x => x.def.id === 'garment' && x.b.regionId === 'capital');
  assert.ok(rec.profit < 0 && !rec.ok && R.detail.subsidies === 0);
  refuse(s, { type: 'subsidy', id: 'school', regionId: 'capital' }, /국고가 이미/); refuse(s, { type: 'subsidy', id: 'garment', regionId: 'jeju' }, /없습니다/);
  const on = exec(s, { type: 'subsidy', id: 'garment', regionId: 'capital' }); assert.equal(on.ap, s.ap); const R2 = EC.compute(on, d);
  assert.ok(R2.detail.subsidies > 0 && R2.buildings.find(x => x.def.id === 'garment' && x.b.regionId === 'capital').ok); assert.ok(months(on, 1).buildings.find(b => b.id === 'garment' && b.regionId === 'capital').staff >= bld(months(s, 1), 'garment', 'capital').staff);
  const market = clone(s); market.laws.economic_system = 'market_led'; refuse(market, { type: 'subsidy', id: 'garment', regionId: 'capital' }, /경제 체제/);
  const off = clone(on); off.laws.economic_system = 'market_led'; assert.equal(EC.compute(off, d).detail.subsidies, 0); assert.equal(exec(off, { type: 'subsidy', id: 'garment', regionId: 'capital' }).buildings.find(b => b.id === 'garment' && b.regionId === 'capital').subsidy, false);
});
test('ownership: state levels pay a dividend, can be sold to the investment pool or downsized', () => {
  let s = governing(); const b = bld(s, 'textile_mill', 'capital'); b.state = b.level; s.econ.pool = 50;
  const R = EC.compute(s, d), priv = clone(s); bld(priv, 'textile_mill', 'capital').state = 0; assert.ok(R.detail.stateDividend > EC.compute(priv, d).detail.stateDividend);
  const price = E.privatizePrice(s, d, 'textile_mill', 'capital'); assert.ok(price > 0);
  const sold = exec(s, { type: 'privatize', id: 'textile_mill', regionId: 'capital' }); near(sold.stats.treasury, 500 + price); near(sold.econ.pool, 50 - price, 1e-3); assert.equal(bld(sold, 'textile_mill', 'capital').state, 0); assert.equal(sold.ap, 2);
  refuse(sold, { type: 'privatize', id: 'textile_mill', regionId: 'capital' }, /국영 단계/); refuse(s, { type: 'privatize', id: 'school', regionId: 'capital' }, /넘길 수 없는/);
  const poor = clone(s); poor.econ.pool = 0; refuse(poor, { type: 'privatize', id: 'textile_mill', regionId: 'capital' }, /투자기금/);
  const less = exec(s, { type: 'downsize', id: 'school', regionId: 'capital' }); assert.equal(bld(less, 'school', 'capital').level, bld(s, 'school', 'capital').level - 1); assert.equal(less.ap, s.ap); assert.ok(EC.compute(less, d).detail.govWages < R.detail.govWages);
  refuse(sold, { type: 'downsize', id: 'textile_mill', regionId: 'capital' }, /민간 소유/);
  let gone = clone(s); bld(gone, 'clinic', 'capital').level = 1; bld(gone, 'clinic', 'capital').state = 1; gone = exec(gone, { type: 'downsize', id: 'clinic', regionId: 'capital' }); assert.equal(bld(gone, 'clinic', 'capital'), undefined);
});
test('government buildings raise their index every month and cost wages and goods', () => {
  let s = governing(); const R = EC.compute(s, d); assert.ok(R.detail.govWages > 0 && R.detail.govGoods > 0);
  const t = clone(s); bld(t, 'school', 'capital').level += 8; const a = months(s, 1), b = months(t, 1);
  assert.ok(b.stats.education > a.stats.education + .2); assert.ok(b.report.ledger.education.some(r => r[0] === '정부·기반 건물'));
  assert.ok(EC.compute(t, d).detail.govWages > R.detail.govWages && EC.compute(t, d).goods.services.dem.government > R.goods.services.dem.government);
});

/* ===== 법률 ===== */
test('law: a bill needs support inside the coalition, its unlock year, funds and a free slot', () => {
  const s = governing();
  refuse(s, { type: 'enact', id: 'nope' }, /알 수 없는/); refuse(s, { type: 'enact', id: 'press_control' }, /이미 시행/); refuse(s, { type: 'enact', id: 'pollution_control' }, /1971/);
  const parts = E.lawChanceParts(s, d, 'association'); assert.equal(parts.support, 0); assert.ok(parts.outSupport > 0 && parts.outSupport < X.enactment.massDemand); refuse(s, { type: 'enact', id: 'association' }, /집권 연합/);
  const friendly = clone(s); friendly.government = ['workers', 'petite']; const p2 = E.lawChanceParts(friendly, d, 'association'); assert.ok(p2.support > 0 && p2.chance > parts.chance);
  near(p2.chance, Math.max(X.enactment.min, Math.min(X.enactment.max, p2.parts.reduce((a, x) => a + x[1], 0))), 1e-9);
  const broke = clone(friendly); broke.stats.treasury = 0; refuse(broke, { type: 'enact', id: 'association' }, /국고/);
  const t = exec(friendly, { type: 'enact', id: 'association' }); assert.equal(t.ap, 2); assert.equal(t.stats.treasury, 500 - d.laws.find(l => l.id === 'association').cost);
  assert.deepEqual(t.enactment, { lawId: 'association', stage: 0, wait: 2, setbacks: 0, bonus: 0, startedTurn: 60 }); refuse(t, { type: 'enact', id: 'press_freedom' }, /한 번에 하나/);
  const late = clone(friendly); late.turn = 236; refuse(late, { type: 'enact', id: 'association' }, /1979/);
  const mass = clone(s); mass.government = ['military']; for (const g of d.interestGroups) mass.ig[g.id].clout = g.id === 'workers' ? .5 : .1; assert.equal(E.enactReason(mass, d, 'association'), '', '연합 밖 여론이 세력의 40%를 넘으면 발의할 수 있다');
});
test('law: three checks, one every interval, then the new law replaces the old one in its group', () => {
  let s = governing(3); s.government = ['workers', 'petite', 'farmers']; s.seats = .95; s.stats.legitimacy = 95; for (const g of d.interestGroups) s.ig[g.id].clout = ['workers', 'petite', 'farmers'].includes(g.id) ? .3 : .03;
  assert.ok(E.lawChance(s, d, 'association') >= X.enactment.max - 1e-9);
  const law = d.laws.find(l => l.id === 'association'), liberty = s.stats.liberty, workers = s.support.workers;
  s = exec(s, { type: 'enact', id: 'association' }); let n = 0, results = [];
  while (s.enactment && n++ < 40) { s.seats = .95; s.stats.legitimacy = 95; s = months(s, 1); results.push(...s.report.laws.map(x => x.result)); }
  assert.equal(s.laws.association, 'association'); assert.equal(s.counters.lawsEnacted, 1); assert.equal(results.at(-1), 'enacted'); assert.equal(results.filter(r => r === 'advance').length, 2);
  assert.ok(n >= 6 && n % 2 === 0, `제정까지 ${n}개월`);
  assert.ok(enacted(s).lawId === 'association' && enacted(s).changes.liberty > 0);
  assert.ok(s.ig.workers.mod > 0 && s.ig.business.mod < 0, '찬성 집단은 오르고 반대 집단은 내린다');
  const R = EC.compute(s, d); assert.ok(R.detail.upkeep.laws >= law.monthlyCost - 1e-9); near(R.mods.cloutMult.workers, 1.25, 1e-9);
  assert.ok(s.stats.liberty > liberty && s.support.workers > workers);
});
test('law: replacing a law takes back the one-time effect of the law it replaces', () => {
  const run = id => { let s = governing(5); s.government = ['workers', 'petite', 'farmers']; for (const g of d.interestGroups) s.ig[g.id].clout = ['workers', 'petite', 'farmers'].includes(g.id) ? .3 : .03; s.turn = 110; s.laws.labor = 'labor_inspection'; s.stats.welfare = 40; s.stats.equality = 40; s.stats.liberty = 40; s = exec(s, { type: 'enact', id }); let n = 0; while (s.enactment && n++ < 60) { s.seats = .95; s.stats.legitimacy = 95; s = months(s, 1); } return s; };
  const s = run('worker_protection'); assert.equal(s.laws.labor, 'worker_protection');
  const entry = enacted(s), a = d.laws.find(l => l.id === 'labor_inspection'), b = d.laws.find(l => l.id === 'worker_protection');
  near(entry.changes.welfare, b.effects.welfare - a.effects.welfare, 1e-3); near(entry.changes.liberty, (b.effects.liberty || 0) - a.effects.liberty, 1e-3);
});
test('law: failed checks either win a concession or stall, and the third stall kills the bill', () => {
  const seen = new Set(); let failed = null, bonus = 0;
  for (let seed = 1; seed <= 40 && !(failed && bonus); seed++) {
    let s = governing(seed * 31); s.government = ['petite', 'business', 'landowners']; s.seats = .2; s.stats.legitimacy = 20;
    assert.ok(E.lawChance(s, d, 'merit_service') < .45);
    s = exec(s, { type: 'enact', id: 'merit_service' }); let n = 0;
    while (s.enactment && n++ < 80) { s.seats = .2; s.stats.legitimacy = 20; const prev = s.enactment; s = months(s, 1); for (const x of s.report.laws) { seen.add(x.result); if (x.result === 'debate') { bonus = s.enactment.bonus; near(bonus, prev.bonus + X.enactment.debate, 1e-9); } if (x.result === 'stall') assert.equal(s.enactment.setbacks, prev.setbacks + 1); } }
    if (s.counters.lawsFailed) { failed = s; assert.equal(s.laws.civil_service, 'patronage'); assert.equal(s.enactment, null); }
  }
  assert.ok(failed && bonus > 0); for (const r of ['debate', 'stall', 'failed']) assert.ok(seen.has(r), r);
  assert.equal(E.enactReason(failed, d, 'merit_service'), '', '폐기된 법은 다시 발의할 수 있다');
});
test('law: withdrawing costs no AP and returns nothing; a decree during the transition costs rights and trust', () => {
  let s = governing(); s.government = ['workers', 'petite']; s = exec(s, { type: 'enact', id: 'association' }); const t = exec(s, { type: 'cancelEnact' });
  assert.equal(t.enactment, null); assert.equal(t.ap, s.ap); assert.equal(t.stats.treasury, s.stats.treasury); refuse(t, { type: 'cancelEnact' }, /없습니다/);
  const run = phase => { let x = governing(11); x.phase = phase; x.turn = 24; x.government = ['military', 'business']; for (const g of d.interestGroups) x.ig[g.id].clout = ['military', 'business'].includes(g.id) ? .45 : .025; x.stats.legitimacy = 95; x.seats = .95; x.stats.liberty = 50; x = exec(x, { type: 'enact', id: 'planned_development' }); let n = 0; while (x.enactment && n++ < 60) { x.stats.legitimacy = 95; x.stats.liberty = 50; x = months(x, 1); } return enacted(x); };
  const decree = run('transition'), normal = run('governing'); assert.ok(decree && normal);
  near((decree.changes.liberty || 0) - (normal.changes.liberty || 0), X.enactment.decreeCost.liberty, 1e-3);
  assert.equal(E.lawChanceParts(Object.assign(governing(), { phase: 'transition' }), d, 'planned_development').parts.at(-1)[0], '과도 통치의 의결');
});

/* ===== 이해집단 ===== */
test('interest groups: clout and vote shares add up, and overall support is the vote-weighted approval', () => {
  let s = months(governing(), 1); const sum = key => d.interestGroups.reduce((a, g) => a + s.ig[g.id][key], 0);
  near(sum('clout'), 1, .001); near(sum('vote'), 1, .001); near(E.supportAverage(s, d), d.interestGroups.reduce((a, g) => a + s.support[g.id] * s.ig[g.id].vote, 0), 1e-9);
  assert.ok(s.ig.farmers.vote > s.ig.business.vote * 10 && s.ig.business.clout > s.ig.business.vote * 5, '기업가는 수는 적어도 세력이 크다');
  const R = EC.compute(s, d), base = EC.cloutOf(d, R), t = clone(s); t.laws.association = 'association'; assert.ok(EC.cloutOf(d, EC.compute(t, d)).workers > base.workers);
  const more = clone(s); bld(more, 'garment', 'capital').level += 10; assert.ok(EC.cloutOf(d, EC.compute(more, d)).business > base.business, '공장이 늘면 기업가의 세력이 커진다');
});
test('interest groups: approval is built from laws, demands, living standards and a seat in the coalition', () => {
  const s = governing(), R = EC.compute(s, d), A = X.approval, ig = id => d.interestGroups.find(g => g.id === id);
  const p = EC.approvalParts(s, d, R, ig('workers')); near(p.target, Math.max(0, Math.min(100, 50 + p.law + p.demands + p.living + p.gov + p.mod)), 1e-9); assert.equal(p.gov, A.outGov); assert.ok(p.law < 0);
  const law = clone(s); law.laws.labor = 'worker_protection'; near(EC.approvalParts(law, d, EC.compute(law, d), ig('workers')).law - p.law, 4 * A.lawWeight, 1e-9);
  const gov = clone(s); gov.government = ['workers']; assert.equal(EC.approvalParts(gov, d, R, ig('workers')).gov, A.inGov);
  const rich = clone(s); rich.econ.wage *= 1.5; assert.ok(EC.approvalParts(rich, d, EC.compute(rich, d), ig('workers')).living > p.living);
  const mod = clone(s); mod.ig.workers.mod = 7; near(EC.approvalParts(mod, d, R, ig('workers')).mod, 7);
  const m = clone(s); m.laws.labor = 'worker_protection'; const plain = months(s, 1).support.workers, moved = months(m, 1).support.workers; assert.ok(moved > plain && moved < plain + 4 * A.lawWeight, '지지도는 목표를 향해 조금씩 움직인다');
});
test('interest groups: demands for buildings rise from 1964 and flip approval when met', () => {
  const s = governing(), farmers = d.interestGroups.find(g => g.id === 'farmers'), water = () => EC.demandStatus(s, d, farmers).find(x => x.id === 'water');
  s.turn = 108; const need = water().need; assert.ok(need >= 1 && !water().met); const early = clone(s); early.turn = 40; assert.equal(EC.demandStatus(early, d, farmers).find(x => x.id === 'water').need, 0);
  const R = EC.compute(s, d), before = EC.approvalParts(s, d, R, farmers).demands;
  s.buildings.push({ id: 'irrigation', regionId: 'jeonbuk', level: need, pm: 0, staff: 1, state: need, subsidy: false });
  assert.ok(water().met); near(EC.approvalParts(s, d, R, farmers).demands - before, 2 * water().weight);
  const shared = d.interestGroups.filter(g => g.demands.some(x => x.buildings.includes('steel_mill'))).map(g => g.id); assert.deepEqual(shared.sort(), ['business', 'military', 'workers'], '제철소는 여러 집단의 요구에 걸쳐 있다');
});
test('interest groups: unhappy and happy groups switch on traits that change the economy, scaled by clout', () => {
  const s = governing(); for (const g of d.interestGroups) { s.support[g.id] = 50; s.ig[g.id].clout = .15; }
  assert.deepEqual(EC.activeTraits(s, d), []); const base = EC.modifiers(s, d);
  const sad = clone(s); sad.support.farmers = 30; const t = EC.activeTraits(sad, d); assert.equal(t.length, 1); assert.equal(t[0].key, 'unhappy'); near(EC.modifiers(sad, d).farmThroughput, base.farmThroughput - .08);
  assert.ok(EC.compute(sad, d).goods.grain.sup.buildings < EC.compute(s, d).goods.grain.sup.buildings);
  const angry = clone(sad); angry.support.farmers = 10; near(EC.modifiers(angry, d).farmThroughput, base.farmThroughput - .12);
  const strong = clone(sad); strong.ig.farmers.clout = .3; near(EC.modifiers(strong, d).farmThroughput, base.farmThroughput - .12); const weak = clone(sad); weak.ig.farmers.clout = .03; assert.equal(EC.modifiers(weak, d).farmThroughput, base.farmThroughput);
  const loyal = clone(s); loyal.support.farmers = 80; assert.deepEqual(EC.activeTraits(loyal, d).map(x => x.key), ['happy', 'loyal']); near(EC.modifiers(loyal, d).monthly.stability, .03);
  const army = clone(s); army.support.military = 30; const a = months(s, 1), b = months(army, 1); assert.ok(b.stats.stability < a.stats.stability); assert.ok(b.report.ledger.stability.some(r => r[0] === '이해집단 특성'));
  assert.equal(EC.approvalState(24.9, d), 'angry'); assert.equal(EC.approvalState(40, d), 'neutral'); assert.equal(EC.approvalState(75, d), 'loyal');
});
test('coalition: one to three groups, a change costs AP, dismissal angers the group, and its clout moves legitimacy', () => {
  let s = governing(); assert.deepEqual(s.government, ['landowners', 'business']);
  s = exec(s, { type: 'coalition', id: 'petite' }); assert.equal(s.ap, 2); assert.deepEqual(s.government, ['landowners', 'business', 'petite']); refuse(s, { type: 'coalition', id: 'workers' }, /3개 집단/);
  const before = s.support.landowners; s = exec(s, { type: 'coalition', id: 'landowners' }); near(s.support.landowners, before - X.approval.dismissed); near(s.ig.landowners.mod, -X.approval.dismissed); assert.ok(s.log.at(-1).type === 'government' && s.log.at(-1).igId === 'landowners');
  let one = clone(s); one.government = ['petite']; refuse(one, { type: 'coalition', id: 'petite' }, /적어도 한 집단/); refuse(one, { type: 'coalition', id: 'nobody' }, /알 수 없는/);
  const big = clone(s); big.government = ['business', 'landowners', 'farmers']; const small = clone(s); small.government = ['military'];
  assert.ok(E.coalitionLegitimacy(big, d) > 0 && E.coalitionLegitimacy(small, d) < 0); assert.ok(Math.abs(E.coalitionLegitimacy(small, d)) <= X.government.legitimacyCap + 1e-9);
  assert.ok(months(big, 1).report.ledger.legitimacy.some(r => r[0] === '집권 연합의 기반'));
});
test('events and policies move group approval; the leftover fades month by month', () => {
  const e = d.events.find(x => x.choices.some(c => Object.keys(c.factionEffects || {}).length)), c = e.choices.find(x => Object.keys(x.factionEffects || {}).length);
  let s = governing(); s.queue = [e.id]; const [id, v] = Object.entries(c.factionEffects)[0], before = s.support[id];
  if (!E.choiceReason(s, d, c.id)) { const p = E.choicePreview(s, d, c.id), t = exec(s, { type: 'choose', choiceId: c.id }); near(t.support[id], Math.max(0, Math.min(100, before + v))); near(t.ig[id].mod, v); near(p.support.find(x => x.id === id).after, t.support[id]); const m = months(t, 1); near(m.ig[id].mod, v * (1 - X.approval.modDecay), 1e-3); }
  const pol = d.policies.find(p => Object.keys(p.factionEffects).length), [pid, pv] = Object.entries(pol.factionEffects)[0]; s = governing(); s.turn = 100; const t = exec(s, { type: 'policy', id: pol.id }); near(t.ig[pid].mod, pv);
});

/* ===== 월 결산 보고 ===== */
test('monthly report explains finance, the market and every metric change', () => {
  let s = governing(); s = exec(s, { type: 'policy', id: 'farm_extension' }); s = exec(s, { type: 'build', id: 'school', regionId: 'capital' }); const f = finance(s, d), before = { ...s.stats };
  s = months(s, 1); const r = s.report;
  assert.equal(r.turn, 60); assert.equal(r.date, '1965-01'); near(r.finance.balance, f.balance, 1e-9); assert.deepEqual(Object.keys(r.market).sort(), ['cpi', 'exports', 'gdp', 'imports', 'points', 'pool', 'unemployment', 'used']);
  for (const [m, v] of Object.entries(r.changes)) { near(s.stats[m] - before[m], v, 1e-5); near(r.ledger[m].reduce((a, row) => a + row[1], 0), v, 1e-4); }
  for (const src of ['월 재정 수지', '시장의 생산', '예산 배분', '정책 지속 효과']) assert.ok(Object.values(r.ledger).some(rows => rows.some(x => x[0] === src)), src);
  assert.ok(r.ledger.gdp.some(x => x[0] === '시장의 생산')); assert.ok(r.ledger.environment.some(x => x[0] === '건물의 환경 부담')); near(s.stats.gdp, r.market.gdp, 1e-3);
});
test('choice preview matches dispatch and does not consume RNG', () => {
  for (const e of d.events) {
    const s = governing(); s.queue = [e.id]; s.turn = e.date ? (Number(e.date.slice(0, 4)) - 1960) * 12 + Number(e.date.slice(5)) - 1 : 100;
    for (const c of e.choices) { if (E.choiceReason(s, d, c.id) || c.special || c.ending) continue; const rng = s.rng, p = E.choicePreview(s, d, c.id); assert.equal(s.rng, rng); const t = exec(s, { type: 'choose', choiceId: c.id }); for (const x of p.stats) near(t.stats[x.id], x.after, 1e-9); for (const x of p.support) near(t.support[x.id], x.after, 1e-9); for (const x of p.relations) near(t.relations[x.id], x.after, 1e-9); }
  }
});
test('event context follows the campaign path; inauguration only after winning in 1963', () => {
  const e = d.events.find(x => (x.context || []).length >= 2), a = governing(); a.flags.route = 'constitutional'; const b = governing(); b.flags.route = 'military'; b.flags.authoritarian = true;
  assert.equal(typeof E.eventContext(a, e), 'string');
  const lost = createState(d); lost.turn = 47; lost.phase = 'civilian'; assert.equal(E.matches(lost, d.events.find(x => x.id === 'inauguration_1963').conditions), false);
});
test('periodic election uses the vote-weighted support; below 45 hands power over', () => {
  const run = v => { let s = governing(8); s.turn = E.FIRST_PERIODIC_ELECTION - 1; s.stats.legitimacy = v; for (const g of d.interestGroups) { s.support[g.id] = v; s.ig[g.id].mod = v - 50; } return months(s, 1); };
  const lost = run(15); assert.equal(lost.ending.id, 'peaceful_transfer'); assert.equal(lost.report.election.transfer, true);
  const won = run(90); assert.equal(won.ending, null); assert.ok(won.report.election.share > 60 && won.seats > .6);
  const s = governing(); assert.equal(E.nextElectionTurn(s), 94); s.flags.authoritarian = true; assert.equal(E.nextElectionTurn(s), null); near(E.electionExpectation(governing(), d), E.supportAverage(governing(), d) * .65 + governing().stats.legitimacy * .35);
});

/* ===== 밸런스 규칙(1.2.0에서 이어짐)과 새 감가 ===== */
test('balance: gains shrink above 60, never reach 100, and losses are never reduced', () => { const s = governing(); s.stats.welfare = 80; near(E.gainScale(s, d, 'welfare'), .5); s.stats.welfare = 100; assert.equal(E.gainScale(s, d, 'welfare'), 0); const [x] = E.projectEffects(s, d, { liberty: -5 }); assert.equal(x.delta, -5); assert.equal(E.gainScale(s, d, 'gdp'), 1); });
test('balance: the monthly report names rising expectations, capability decay and the costs of military rule and concentrated power', () => {
  let s = governing(); s.stats.legitimacy = 80; s.stats.education = 70; s = months(s, 1); assert.ok(s.report.ledger.legitimacy.some(r => r[0] === '높아진 기대' && r[1] < 0)); const dep = s.report.ledger.education.find(r => r[0] === '역량의 감가'); near(dep[1], -(70 - X.depreciation.education.floor) * X.depreciation.education.rate, 1e-3);
  let m = governing(); m.phase = 'transition'; m.government = ['military']; m = months(m, 1); assert.ok(m.report.ledger.legitimacy.some(r => r[0] === '군정의 비용'));
  let a = governing(); a.flags.authoritarian = true; const sup = a.support.petite; a = months(a, 1); assert.ok(a.report.ledger.liberty.some(r => r[0] === '권력 집중의 비용')); assert.ok(a.ig.petite.mod < 0 && sup > 0);
});
test('living standards feed welfare and equality; pollution from buildings lowers the environment', () => {
  const s = governing(), a = months(s, 1); assert.ok(a.report.ledger.environment.some(r => r[0] === '건물의 환경 부담' && r[1] < 0));
  const rich = clone(s); rich.econ.wage *= 1.6; const b = months(rich, 1); assert.ok(b.stats.welfare > a.stats.welfare); assert.ok(b.report.ledger.welfare.some(r => r[0] === '생활수준' && r[1] > 0));
  const clean = clone(s); clean.laws.environment_rules = 'pollution_control'; near(EC.compute(clean, d).pollution, EC.compute(s, d).pollution * .6, 1e-3);
});

/* ===== 저장 ===== */
test('export/import keeps the RNG, queue, market, buildings, construction, law in progress and coalition', () => {
  let s = governing(21); s.government = ['workers', 'petite']; s = exec(s, { type: 'enact', id: 'press_freedom' }); s = exec(s, { type: 'build', id: 'school', regionId: 'jeju' }); s = months(s, 3); s = exec(s, { type: 'coalition', id: 'farmers' }); s.queue = ['sys_coal'];
  s.history = Array.from({ length: s.turn + 1 }, (_, i) => ({ ...s.history[0], turn: i }));
  const loaded = importSave(exportSave(s), d); assert.deepEqual(loaded, s); assert.deepEqual(exec(loaded, { type: 'choose', choiceId: 'sys_coal_1' }), exec(s, { type: 'choose', choiceId: 'sys_coal_1' }));
  assert.equal(JSON.parse(exportSave(s)).version, 5);
});
test('malformed, huge and unknown saves are rejected; saves from earlier formats get a clear reason', () => {
  const s = createState(d);
  assert.throws(() => importSave('{', d), /JSON/); assert.throws(() => importSave('x'.repeat(3000001), d)); assert.throws(() => importSave(JSON.stringify({ format: 'OTHER', version: 5, state: s }), d), /지원하지 않는/); assert.throws(() => importSave(JSON.stringify({ format: E.SAVE_FORMAT, version: 99, state: s }), d), /지원하지 않는/);
  for (const name of ['v1_1964_governing.json', 'v2_data110_1964_bills_and_projects.json', 'v3_data120_1964_bills_and_projects.json', 'v4_data130_1966_regional_edicts.json']) assert.throws(() => importSave(fs.readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8'), d), { message: E.OLD_SAVE_MESSAGE }, name);
  assert.throws(() => E.migrateSave({ format: E.SAVE_FORMAT, version: 4, state: {} }), /경제 구조/); assert.equal(E.migrateSave({ format: E.SAVE_FORMAT, version: 5, state: s }).state, s);
});
test('tampered saves are rejected as a whole', () => {
  let base = governing(4); base.government = ['workers', 'petite']; base = exec(base, { type: 'enact', id: 'press_freedom' }); base = exec(base, { type: 'build', id: 'school', regionId: 'jeju' }); base = months(base, 2);
  base.history = Array.from({ length: base.turn + 1 }, (_, i) => ({ ...base.history[0], turn: i }));
  assert.doesNotThrow(() => importSave(exportSave(base), d));
  const bad = [
    s => { s.buildings[0].level = 999; }, s => { s.buildings[0].pm = 9; }, s => { s.buildings[0].state = s.buildings[0].level + 1; }, s => { s.buildings[0].staff = 1.5; }, s => { s.buildings[0].extra = 1; },
    s => { s.buildings.push({ ...s.buildings[0] }); }, s => { s.buildings.push({ id: 'coal_mine', regionId: 'jeju', level: 1, pm: 0, staff: 1, state: 0, subsidy: false }); }, s => { s.buildings.find(b => b.id === 'school').state = 0; },
    s => { s.construction[0].progress = 1e9; }, s => { s.construction.push({ id: 'port', regionId: 'chungbuk', progress: 0, private: false }); }, s => { s.construction.push({ id: 'school', regionId: 'capital', progress: 0, private: true }); },
    s => { s.laws.labor = 'press_freedom'; }, s => { delete s.laws.trade; }, s => { s.laws.extra = 'x'; }, s => { s.enactment.lawId = s.laws.speech; }, s => { s.enactment.stage = 3; }, s => { s.enactment.wait = 0; }, s => { s.enactment.bonus = -1; },
    s => { s.government = []; }, s => { s.government = ['workers', 'workers']; }, s => { s.government = ['nobody']; }, s => { s.ig.workers.clout = 2; }, s => { delete s.ig.workers.vote; }, s => { s.ig.stranger = { mod: 0, clout: 0, vote: 0 }; }, s => { s.support.workers = 101; },
    s => { s.econ.prices.grain = 999; }, s => { s.econ.prices.grain = 0; }, s => { delete s.econ.prices.oil; }, s => { s.econ.wage = -1; }, s => { s.econ.pool = 1e9; }, s => { s.econ.short.grain = 5; }, s => { s.econ.needBase.grain = -1; }, s => { s.econ.gdpUnit = 0; }, s => { s.econ.hist.grain = new Array(99).fill(0); }, s => { s.econ.extra = 1; },
    s => { s.counters.built = -1; }, s => { s.counters.regions = ['nowhere']; }, s => { s.report.completed = [{ buildingId: 'x', regionId: 'capital', private: false }]; }, s => { s.report.laws = [{ lawId: 'press_freedom', result: 'maybe', chance: .5 }]; }, s => { s.report.market.gdp = 'NaN'; }, s => { s.report.turn = s.turn; },
    s => { s.log.push({ turn: 1, date: '1960-02-01', type: 'law', text: 'x', lawId: 'ghost' }); }, s => { s.log.push({ turn: 1, date: '1960-02-01', type: 'construction', text: 'x', buildingId: 'ghost' }); }, s => { s.visited = ['assembly']; }, s => { s.stats.gdp = NaN; }, s => { s.dataVersion = '1.3.0'; }, s => { s.version = 4; }, s => { s.turn = 240; }, s => { s.day = 40; }, s => { s.monthActions = ['diplomacy:mars']; }
  ];
  bad.forEach((mutate, i) => { const s = clone(base); mutate(s); assert.throws(() => importSave(JSON.stringify({ format: E.SAVE_FORMAT, version: 5, state: s }), d), /올바르지 않습니다|지원하지 않는/, `변조 ${i}: ${mutate}`); });
});
test('all views are valid visited screens in saves', () => { const s = governing(); s.visited = [...E.VIEWS]; s.history = Array.from({ length: s.turn + 1 }, (_, i) => ({ ...s.history[0], turn: i })); assert.deepEqual(importSave(exportSave(s), d).visited, E.VIEWS); assert.ok(['market', 'laws', 'groups'].every(v => E.VIEWS.includes(v))); });

/* ===== 기록 표식 ===== */
test('achievements read the counters, the market and the groups', () => {
  const s = governing(), has = (x, id) => E.achievements(x, d).some(a => a.id === id);
  assert.ok(!has(s, 'first_project') && !has(s, 'first_bill') && !has(s, 'local_strength'));
  s.counters.built = 1; s.counters.lawsEnacted = 1; s.counters.resourceBuilt = 3; s.counters.regions = ['capital', 'busan', 'jeju', 'gangwon', 'jeonnam']; assert.ok(has(s, 'first_project') && has(s, 'first_bill') && has(s, 'local_strength') && has(s, 'balanced_region'));
  s.econ.trade = { exports: 5, imports: 4 }; assert.ok(has(s, 'export_day')); s.econ.trade = { exports: 3, imports: 4 }; assert.ok(!has(s, 'export_day'));
  for (const g of d.interestGroups.slice(0, 4)) s.support[g.id] = 61; assert.ok(has(s, 'six_groups'));
  for (const g of d.goods) s.econ.prices[g.id] = g.price; assert.ok(has(s, 'full_market')); s.econ.prices.steel = d.goods.find(g => g.id === 'steel').price * 1.4; assert.ok(!has(s, 'full_market'));
  assert.equal(E.edictCap(s, d), 2 + Math.floor(s.stats.admin / 30)); const auto = clone(s); auto.laws.local_gov = 'local_autonomy'; assert.equal(E.edictCap(auto, d), E.edictCap(s, d) + 1);
});

/* ===== 지역 시책(1.3.0에서 이어짐) ===== */
test('edict: one per region, needs its terrain or resource, costs AP and treasury, and stops when revoked', () => {
  let s = governing(); refuse(s, { type: 'edict', id: 'mine_safety', regionId: 'jeju' }, /없습니다/);
  s = exec(s, { type: 'edict', id: 'grain_drive', regionId: 'jeonnam' }); const e = d.edicts.find(x => x.id === 'grain_drive'); assert.equal(s.ap, 2); assert.equal(s.stats.treasury, 500 - e.cost); refuse(s, { type: 'edict', id: 'local_admin', regionId: 'jeonnam' }, /다른 시책/);
  near(EC.compute(s, d).detail.upkeep.edicts, e.monthlyCost); const m = months(s, 1); assert.ok(m.report.ledger.agriculture.some(r => r[0] === '지역 시책'));
  const r = exec(s, { type: 'revokeEdict', regionId: 'jeonnam' }); assert.equal(r.ap, s.ap); assert.equal(r.edicts.length, 0); refuse(r, { type: 'revokeEdict', regionId: 'jeonnam' }, /없습니다/);
  let cap = governing(); cap.stats.admin = 10; cap = exec(cap, { type: 'edict', id: 'local_admin', regionId: 'capital' }); cap = exec(cap, { type: 'edict', id: 'local_admin', regionId: 'busan' }); refuse(cap, { type: 'edict', id: 'local_admin', regionId: 'jeju' }, /2개까지/);
});

/* ===== 긴 진행과 자동 캠페인 ===== */
test('full 240-month constitutional campaign completes with no NaN and a replayable save', () => {
  let s = createState(d, 20261110), guard = 0, mid = null;
  while (!s.ending && guard++ < 1500) {
    if (s.queue.length) { const e = d.events.find(x => x.id === s.queue[0]); const c = e.choices.find(c => !c.ending && (c.effects.treasury || 0) >= 0 && !c.setFlags?.authoritarian && c.phase !== 'transition' && !E.choiceReason(s, d, c.id)) || e.choices.find(c => !E.choiceReason(s, d, c.id)); s = exec(s, { type: 'choose', choiceId: c.id }); }
    else { while (E.PREPARE_PHASES.includes(s.phase) && s.ap > 0) s = exec(s, { type: 'prepare' }); if (s.turn === 120) mid = exportSave(s); s = exec(s, { type: 'endMonth' }); }
    for (const v of Object.values(s.stats)) assert.ok(Number.isFinite(v));
  }
  assert.ok(s.ending); if (mid) { const a = importSave(mid, d); assert.equal(a.turn, 120); assert.deepEqual(exec(a, { type: 'endMonth' }), exec(importSave(mid, d), { type: 'endMonth' })); }
  assert.deepEqual(importSave(exportSave(s), d), s);
});
test(`campaign sweep: ${SEEDS} seeds x ${Object.keys(STRATEGIES).length} strategies keep every invariant`, () => {
  const endings = new Set(), events = new Set(); let builds = 0, laws = 0, privates = 0;
  for (const strategy of Object.keys(STRATEGIES)) for (let seed = 1; seed <= SEEDS; seed++) {
    const { state, seen } = playCampaign(d, { seed: seed * 104729 + strategy.length, strategy, onStep: s => checkInvariants(s, d), onMonth: s => { if (s.turn % 6 === 0) checkMarket(s, d); } });
    endings.add(state.ending.id); for (const id of seen.events) events.add(id); builds += state.counters.built; laws += state.counters.lawsEnacted; privates += state.counters.privateBuilt;
    assert.deepEqual(importSave(exportSave(state), d), state, `${strategy} ${seed} 저장 왕복`);
  }
  assert.ok(endings.size >= 6, `엔딩 ${[...endings]}`); assert.ok(events.size >= 60, `사건 ${events.size}`); assert.ok(builds > 0 && laws > 0 && privates > 0);
});
