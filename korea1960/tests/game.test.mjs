/* game/engine.mjs(v2) 검증. 원본 tests/engine.test.mjs의 28개 항목을 같은 내용으로 옮기고,
 * v2에서 추가·변경한 규칙, 버전 1 저장 변환, v1 참조 엔진과의 회귀 비교, 자동 캠페인 불변식을 더했다.
 * 실행: node --test tests/          (CAMPAIGN_SEEDS=100 처럼 환경 변수로 자동 캠페인 수를 늘릴 수 있다)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../game/engine.mjs';
import * as V1 from '../example/engine.mjs';
import { playCampaign, checkInvariants, STRATEGIES } from './helpers/campaign.mjs';
const { createState, dispatch, exportSave, importSave, evaluateEnding, finance, policyReason, projectReason, random, calendar, dateLabel } = E;
const d = JSON.parse(fs.readFileSync(new URL('../data/game.json', import.meta.url), 'utf8'));
/** balance 블록을 뺀 같은 데이터. 엔진 v2가 이것으로 1.1.0(v1)과 같은 계산을 하는지 회귀 비교에 쓴다. */
const noBalance = (() => { const x = JSON.parse(JSON.stringify(d)); delete x.balance; return x; })();
function exec(s, a) { const r = dispatch(s, d, a); assert.equal(r.ok, true, r.error); return r.state; }
function free(s) { while (s.queue.length && !s.ending) { const e = d.events.find(x => x.id === s.queue[0]); s = exec(s, { type: 'choose', choiceId: e.choices.find(c => (c.effects.treasury || 0) >= 0 && !c.ending)?.id || e.choices[0].id }); } return s; }
function governing() { let s = createState(d); s.queue = []; s.turn = 60; s.phase = 'governing'; s.stats.treasury = 500; s.flags.won1963 = true; return s; }
function advance(s, n) { for (let i = 0; i < n && !s.ending; i++) { s = free(s); if (s.ending) break; s = exec(s, { type: 'endMonth' }); } return s; }
const SEEDS = Number(process.env.CAMPAIGN_SEEDS || 12);

/* ===== 원본 28개 항목 (v2 엔진 대상) ===== */
test('content has unique IDs and all 189 choices', () => { assert.equal(d.events.length, 63); assert.equal(d.events.flatMap(e => e.choices).length, 189); for (const k of ['events', 'policies', 'projects', 'endings']) assert.equal(new Set(d[k].map(x => x.id)).size, d[k].length); });
test('initial date, power restriction, queue and 3 AP', () => { const s = createState(d); assert.equal(dateLabel(s.turn), '1960-01'); assert.equal(s.phase, 'prelude'); assert.equal(s.ap, 3); assert.deepEqual(s.queue, ['opening']); assert.match(policyReason(s, d, 'farm_extension'), /사건/); });
test('pending event blocks end turn and ordinary actions', () => { const s = createState(d); for (const a of [{ type: 'endMonth' }, { type: 'prepare' }, { type: 'adviser', id: 'han' }]) assert.equal(dispatch(s, d, a).ok, false); });
test('choice invalid ID leaves original state untouched', () => { const s = createState(d), before = exportSave(s); assert.equal(dispatch(s, d, { type: 'choose', choiceId: 'not_registered' }).ok, false); assert.equal(exportSave(s), before); });
test('preparation consumes AP and changes no national metric', () => { let s = free(createState(d)); const stats = { ...s.stats }; for (let i = 0; i < 3; i++) s = exec(s, { type: 'prepare' }); assert.deepEqual(s.stats, stats); assert.equal(s.ap, 0); assert.equal(dispatch(s, d, { type: 'prepare' }).ok, false); assert.equal(dispatch(s, d, { type: 'policy', id: 'farm_extension' }).ok, false); });
test('monthly transition replenishes AP and changes date', () => { let s = free(createState(d)); s = exec(s, { type: 'prepare' }); s = exec(s, { type: 'endMonth' }); assert.equal(s.turn, 1); assert.equal(s.ap, 3); assert.equal(calendar(s.turn).month, 2); assert.equal(s.queue.length, 1); });
test('both 1961 branches set different rights and authority', () => { let a = createState(d); a.turn = 16; a.queue = ['may_1961']; const b = exec(a, { type: 'choose', choiceId: 'may_1961_2' }); a = exec(a, { type: 'choose', choiceId: 'may_1961_1' }); assert.equal(a.phase, 'civilian'); assert.equal(b.phase, 'transition'); assert.ok(a.stats.liberty > b.stats.liberty); assert.equal(a.flags.route, 'constitutional'); });
test('1963 election failure transfers power and blocks later actions', () => { const s = createState(d); s.turn = 45; s.queue = ['election_1963']; s.influence = 0; s.stats.legitimacy = 20; let failed; for (let seed = 1; seed < 100; seed++) { s.rng = seed * 100003; const r = exec(s, { type: 'choose', choiceId: 'election_1963_1' }); if (r.ending) { failed = r; break; } } assert.equal(failed?.ending.id, 'peaceful_transfer'); assert.equal(dispatch(failed, d, { type: 'endMonth' }).ok, false); });
test('policy spends resources once and cannot be duplicated', () => { let s = governing(); const p = d.policies.find(x => x.id === 'farm_extension'); s = exec(s, { type: 'policy', id: p.id }); assert.equal(s.stats.treasury, 500 - p.cost); assert.equal(s.ap, 2); assert.ok(s.policies.includes(p.id)); assert.equal(dispatch(s, d, { type: 'policy', id: p.id }).ok, false); });
test('locked year and insufficient treasury reject actions', () => { const s = governing(); s.turn = 36; s.stats.treasury = 0; assert.equal(dispatch(s, d, { type: 'policy', id: 'farm_extension' }).ok, false); assert.equal(dispatch(s, d, { type: 'project', id: 'steel_complex', regionId: 'capital' }).ok, false); });
test('legislation takes 5-7 months and activates at most once', () => { let s = governing(); s.seats = .95; s.stats.legitimacy = 95; s = exec(s, { type: 'policy', id: 'press_freedom' }); assert.ok(s.bills[0].total >= 5 && s.bills[0].total <= 7); assert.ok(!s.policies.includes('press_freedom')); assert.equal(dispatch(s, d, { type: 'policy', id: 'press_freedom' }).ok, false); s = advance(s, 8); assert.ok(['passed', 'failed'].includes(s.bills[0].status)); assert.ok(s.policies.filter(x => x === 'press_freedom').length <= 1); });
test('transition government cannot introduce regular parliamentary bill', () => { const s = governing(); s.phase = 'transition'; assert.equal(dispatch(s, d, { type: 'policy', id: 'press_freedom' }).ok, false); });
test('project completes only after its duration and remains unique', () => { let s = governing(); s = exec(s, { type: 'project', id: 'rural_clinic', regionId: 'capital' }); s = advance(s, 4); assert.equal(s.projects[0].status, 'building'); s = advance(s, 1); assert.equal(s.projects[0].status, 'complete'); assert.equal(s.projects[0].remaining, 0); s = free(s); assert.equal(dispatch(s, d, { type: 'project', id: 'rural_clinic', regionId: 'capital' }).ok, false); assert.equal(s.log.filter(x => x.type === 'construction' && x.text.includes('준공.')).length, 1); });
test('region has four slots including unfinished projects', () => { let s = governing(); for (const id of ['rural_clinic', 'primary_campus', 'local_road']) s = exec(s, { type: 'project', id, regionId: 'capital' }); s = advance(s, 1); s = free(s); s = exec(s, { type: 'project', id: 'irrigation', regionId: 'capital' }); assert.match(projectReason(s, d, 'technical_campus', 'capital'), /슬롯/); });
test('budget must be numeric, nonnegative and total exactly 100', () => { const s = governing(); for (const budget of [{ industry: 100 }, { industry: 22, agriculture: 18, education: 16, welfare: 16, infrastructure: 16, security: 11 }, { industry: -2, agriculture: 42, education: 16, welfare: 16, infrastructure: 16, security: 12 }, { industry: '22', agriculture: 18, education: 16, welfare: 16, infrastructure: 16, security: 12 }]) assert.equal(dispatch(s, d, { type: 'budget', budget }).ok, false); const r = dispatch(s, d, { type: 'budget', budget: { industry: 20, agriculture: 20, education: 20, welfare: 20, infrastructure: 10, security: 10 } }); assert.equal(r.ok, true); assert.equal(r.state.ap, 3); });
test('foreign action affects relationship, budget and AP', () => { let s = governing(); const rel = s.relations.japan; s = exec(s, { type: 'diplomacy', countryId: 'japan', mode: 'talk' }); assert.equal(s.stats.treasury, 496); assert.equal(s.relations.japan, rel + 4); assert.equal(s.ap, 2); });
test('two advisers maximum; dismissal consumes one AP', () => { let s = governing(); s = exec(s, { type: 'adviser', id: 'han' }); s = exec(s, { type: 'adviser', id: 'yun' }); assert.equal(dispatch(s, d, { type: 'adviser', id: 'min' }).ok, false); s = exec(s, { type: 'adviser', id: 'han' }); assert.deepEqual(s.advisers, ['yun']); assert.equal(s.ap, 0); });
test('debt repayment is finite, funded and limited to outstanding debt', () => { let s = governing(); for (const amount of [-1, NaN, Infinity, 1000, '10']) assert.equal(dispatch(s, d, { type: 'repay', amount }).ok, false); s = exec(s, { type: 'repay', amount: 10 }); assert.equal(s.stats.debt, 70); assert.equal(s.stats.treasury, 490); });
test('finance balances and negative cash borrows exactly the shortfall', () => { let s = governing(); s.stats.treasury = 0; s.stats.debt = 600; for (const p of d.policies) s.policies.push(p.id); const f = finance(s, d), oldDebt = s.stats.debt; assert.ok(f.balance < 0); s = exec(s, { type: 'endMonth' }); assert.ok(Math.abs(s.stats.debt - (oldDebt - f.balance)) < 1e-9); assert.equal(s.stats.treasury, 0); });
test('delayed effects apply once at the specified month boundary', () => { let s = governing(); s.queue = ['japan_1965']; s.turn = 65; s = exec(s, { type: 'choose', choiceId: 'japan_1965_1' }); assert.equal(s.delayed.length, 1); s = advance(s, 3); assert.equal(s.delayed.length, 1); s = advance(s, 1); assert.equal(s.delayed.length, 0); assert.equal(s.log.filter(l => l.type === 'followup').length, 1); s = advance(s, 2); assert.equal(s.log.filter(l => l.type === 'followup').length, 1); });
test('export/import keeps RNG, pending queue, projects and legislation', () => { let s = governing(); s = exec(s, { type: 'policy', id: 'press_freedom' }); s = exec(s, { type: 'project', id: 'rural_clinic', regionId: 'capital' }); s = advance(s, 2); const restored = importSave(exportSave(s), d); assert.deepEqual(restored, s); assert.deepEqual(advance(restored, 2), advance(s, 2)); });
test('malformed, huge, old-version and unknown IDs are rejected', () => { const s = createState(d); assert.throws(() => importSave('{', d)); assert.throws(() => importSave('x'.repeat(2000001), d)); for (const mutate of [p => p.version = 99, p => p.state.stats.gdp = 'oops', p => p.state.policies = ['missing'], p => p.state.projects = [{ projectId: 'no' }], p => p.state.queue = ['unknown'], p => p.state.turn = 241, p => p.state.advisers = ['han', 'han'], p => p.state.flags.badFlag = true, p => p.state.budget.industry = 99]) { const p = JSON.parse(exportSave(s)); mutate(p); assert.throws(() => importSave(JSON.stringify(p), d)); } });
test('identical seed and actions produce identical campaign state', () => { assert.deepEqual(advance(createState(d, 777), 30), advance(createState(d, 777), 30)); });
test('RNG produces finite range and calendar handles endpoints', () => { const s = createState(d); for (let i = 0; i < 500; i++) { const n = random(s); assert.ok(n >= 0 && n < 1); } assert.equal(dateLabel(239), '1979-12'); });
test('ending precedence keeps fiscal failure above other failures', () => { const s = governing(); s.stats.debt = 700; s.stats.liberty = 0; s.stats.legitimacy = 0; evaluateEnding(s, d); assert.equal(s.ending.id, 'fiscal_crisis'); });
test('all 12 ending selectors are reachable by explicit or metric fixture', () => { for (const e of d.endings) { let s = governing(); if (e.conditions.explicit) { const event = e.id === 'retired' ? 'election_1963' : 'buma_1979', c = e.id === 'retired' ? 'election_1963_3' : 'buma_1979_3'; s.queue = [event]; s = exec(s, { type: 'choose', choiceId: c }); } else { for (const m of d.metrics) s.stats[m.id] = m.initial; if (!E.CRISIS_ENDINGS.includes(e.id)) { s.stats.legitimacy = 50; s.stats.liberty = 50; } for (const [key, rule] of Object.entries(e.conditions)) { for (const [op, value] of Object.entries(rule)) s.stats[key] = op === 'lt' ? value - 1 : value; } evaluateEnding(s, d, true); } assert.equal(s.ending?.id, e.id, e.id); } });
test('full 240-month constitutional campaign completes with no NaN and replayable save', () => { let s = createState(d, 20261110); let guard = 0; while (!s.ending && guard++ < 1500) { if (s.queue.length) { const e = d.events.find(x => x.id === s.queue[0]); const c = e.choices.find(c => !c.ending && (c.effects.treasury || 0) >= 0 && !c.setFlags?.authoritarian && c.phase !== 'transition') || e.choices[0]; s = exec(s, { type: 'choose', choiceId: c.id }); } else { while (E.PREPARE_PHASES.includes(s.phase) && s.ap > 0) s = exec(s, { type: 'prepare' }); s = exec(s, { type: 'endMonth' }); } for (const v of Object.values(s.stats)) assert.ok(Number.isFinite(v)); } assert.equal(s.turn, 240); assert.ok(s.ending); assert.deepEqual(importSave(exportSave(s), d), s); });
test('seeded campaigns terminate safely in the turn limit', () => { const report = {}; for (let seed = 1; seed <= Math.max(SEEDS, 20); seed++) { let s = createState(d, seed * 1009); let guard = 0; while (!s.ending && guard++ < 1200) { if (s.queue.length) { const e = d.events.find(e => e.id === s.queue[0]); const options = e.choices.filter(c => !c.ending && (c.effects.treasury || 0) >= 0); const c = options[Math.floor(random(s) * options.length)] || e.choices[0]; s = exec(s, { type: 'choose', choiceId: c.id }); } else { if (E.PREPARE_PHASES.includes(s.phase)) while (s.ap > 0) s = exec(s, { type: 'prepare' }); s = exec(s, { type: 'endMonth' }); } for (const m of d.metrics) { assert.ok(Number.isFinite(s.stats[m.id])); assert.ok(s.stats[m.id] >= m.min && s.stats[m.id] <= m.max); } } assert.ok(s.ending); assert.ok(s.turn <= 240); report[s.ending.id] = (report[s.ending.id] || 0) + 1; } console.log('Seeded outcomes', JSON.stringify(report)); });

/* ===== v2 추가 규칙 ===== */
test('v2: bill pass probability includes overall support', () => {
  const s = governing(); s.seats = .5;
  for (const f of d.factions) s.support[f.id] = 30; const low = E.billChance(s, d);
  for (const f of d.factions) s.support[f.id] = 70; const high = E.billChance(s, d);
  assert.ok(Math.abs(high - low - .08) < 1e-9, `${high} - ${low}`);
  assert.ok(Math.abs(E.billChanceParts(s, d).reduce((a, x) => a + x[1], 0) - high) < 1e-9);
  for (const f of d.factions) s.support[f.id] = 100; s.seats = .95; s.stats.legitimacy = 100; s.stats.stability = 100; assert.equal(E.billChance(s, d), .95);
});
test('v2: bill vote records the probability used and activates the policy once', () => {
  let s = governing(); s.seats = .95; s.stats.legitimacy = 100; for (const f of d.factions) s.support[f.id] = 100;
  s = exec(s, { type: 'policy', id: 'association' }); s = advance(s, 7);
  const b = s.bills[0]; assert.ok(['passed', 'failed'].includes(b.status)); assert.ok(b.probability > .9); assert.equal(b.resolvedTurn, b.startedTurn + b.total - 1);
  assert.equal(s.policies.filter(x => x === 'association').length, b.status === 'passed' ? 1 : 0);
});
test('v2: diplomacy is limited to one action per country per month and resets next month', () => {
  let s = governing();
  s = exec(s, { type: 'diplomacy', countryId: 'usa', mode: 'talk' });
  const r = dispatch(s, d, { type: 'diplomacy', countryId: 'usa', mode: 'humanitarian' }); assert.equal(r.ok, false); assert.match(r.error, /이번 달/); assert.equal(r.state, s);
  s = exec(s, { type: 'diplomacy', countryId: 'japan', mode: 'talk' }); assert.deepEqual(s.monthActions, ['diplomacy:usa', 'diplomacy:japan']);
  s = advance(s, 1); s = free(s); assert.deepEqual(s.monthActions, []);
  s = exec(s, { type: 'diplomacy', countryId: 'usa', mode: 'talk' });
});
test('v2: prototype keys and missing payloads are rejected without corrupting state', () => {
  const s = governing(), before = exportSave(s);
  for (const a of [{ type: 'diplomacy', countryId: 'usa', mode: 'constructor' }, { type: 'diplomacy', countryId: 'usa', mode: 'toString' }, { type: 'budget' }, { type: 'policy', id: '__proto__' }, { type: 'project', id: 'constructor', regionId: 'capital' }, { type: 'adviser', id: 'toString' }, { type: 'repay' }, null, 'endMonth']) {
    const r = dispatch(s, d, a); assert.equal(r.ok, false, JSON.stringify(a)); assert.equal(r.state, s);
  }
  assert.equal(exportSave(s), before);
});
test('v2: projects and bills that cannot finish by 1979-12 are refused', () => {
  const s = governing(); s.turn = 235;
  assert.equal(projectReason(s, d, 'rural_clinic', 'capital'), '');
  assert.equal(policyReason(s, d, 'press_freedom'), '');
  s.turn = 236;
  assert.match(projectReason(s, d, 'rural_clinic', 'capital'), /1979년 12월/);
  assert.match(policyReason(s, d, 'press_freedom'), /1979년 12월/);
  assert.equal(policyReason(s, d, 'farm_extension'), '');
  s.turn = 225; assert.match(projectReason(s, d, 'steel_complex', 'capital'), /1979년 12월/); s.turn = 224; assert.equal(projectReason(s, d, 'steel_complex', 'capital'), '');
});
test('v2: a project started in the last allowed month is completed before the campaign ends', () => {
  let s = governing(); s.turn = 235; s.stats.debt = 0; s.stats.legitimacy = 90; for (const f of d.factions) s.support[f.id] = 90; // 1979-11 가상 선거에서 이양되지 않게
  s = exec(s, { type: 'project', id: 'rural_clinic', regionId: 'jeju' });
  s = advance(s, 10); assert.equal(s.turn, 240); assert.ok(s.ending); assert.equal(s.projects[0].status, 'complete'); assert.equal(s.projects[0].completedTurn, 239);
});
test('v2: monthly report explains finance and every metric change', () => {
  let s = governing(); s = exec(s, { type: 'policy', id: 'export_credit' }); s = exec(s, { type: 'adviser', id: 'han' });
  const f = finance(s, d), before = { ...s.stats };
  s = exec(s, { type: 'endMonth' });
  const r = s.report; assert.equal(r.turn, 60); assert.equal(r.date, '1965-01');
  for (const k of ['income', 'base', 'interest', 'upkeep', 'balance']) assert.ok(Math.abs(r.finance[k] - f[k]) < 1e-12);
  for (const m of d.metrics) { const change = s.stats[m.id] - before[m.id]; assert.ok(Math.abs((r.changes[m.id] || 0) - change) < 1e-5, m.id); const sum = (r.ledger[m.id] || []).reduce((a, x) => a + x[1], 0); assert.ok(Math.abs(sum - change) < 1e-5, `ledger ${m.id}`); }
  assert.ok(r.ledger.industry.some(x => x[0] === '정책 지속 효과'));
  assert.ok(r.ledger.admin.some(x => x[0] === '자문 지속 효과'));
  assert.deepEqual(r.events, s.queue);
  assert.deepEqual(importSave(exportSave(s), d), s);
});
test('v2: report records borrowing, completions, bill votes, follow-ups and periodic election', () => {
  let s = governing(); s.stats.treasury = 0; s.stats.debt = 300; for (const p of d.policies.filter(p => !p.requiresBill)) s.policies.push(p.id);
  s = exec(s, { type: 'endMonth' }); assert.ok(s.report.borrowed > 0); assert.ok(s.report.ledger.debt.some(x => x[0] === '부족분 차입'));
  let t = governing(); t = exec(t, { type: 'project', id: 'rural_clinic', regionId: 'busan' }); t = exec(t, { type: 'policy', id: 'association' });
  const months = t.bills[0].total; t = advance(t, Math.max(5, months));
  const reports = []; let u = governing(); u = exec(u, { type: 'project', id: 'rural_clinic', regionId: 'busan' }); u = exec(u, { type: 'policy', id: 'association' });
  for (let i = 0; i < 8; i++) { u = free(u); u = exec(u, { type: 'endMonth' }); reports.push(u.report); }
  assert.equal(reports.filter(r => r.completed.length).length, 1);
  assert.equal(reports.filter(r => r.bills.length).length, 1);
  let v = governing(); v.turn = 93; v = exec(v, { type: 'endMonth' }); assert.ok(v.report.election); assert.equal(v.report.election.transfer, v.ending?.id === 'peaceful_transfer');
  let w = governing(); w.queue = ['labor_1970']; w.turn = 130; w = exec(w, { type: 'choose', choiceId: 'labor_1970_3' }); w = advance(w, 3); assert.ok(w.log.some(l => l.type === 'followup' && l.changes?.welfare === 3));
});
test('v2: actions record what changed in the chronicle', () => {
  let s = governing(); const p = d.policies.find(x => x.id === 'export_credit');
  s = exec(s, { type: 'policy', id: p.id });
  const entry = s.log.at(-1); assert.equal(entry.type, 'policy'); assert.equal(entry.changes.treasury, -p.cost); assert.equal(entry.changes.industry, p.effects.industry);
  s = exec(s, { type: 'diplomacy', countryId: 'europe', mode: 'technology' }); assert.deepEqual(s.log.at(-1).changes, { treasury: -7, reserves: -1, education: 2 });
  s = exec(s, { type: 'budget', budget: { industry: 20, agriculture: 20, education: 20, welfare: 20, infrastructure: 10, security: 10 } }); assert.equal(s.log.at(-1).changes, undefined);
});
test('v2: choice preview matches dispatch and does not consume RNG', () => {
  let s = createState(d); s.turn = 45; s.queue = ['election_1963']; s.phase = 'civilian';
  const before = exportSave(s), p = E.choicePreview(s, d, 'election_1963_2');
  assert.equal(exportSave(s), before);
  assert.equal(p.influence, 3); assert.ok(p.electionChance >= 25 && p.electionChance <= 90);
  const after = exec(s, { type: 'choose', choiceId: 'election_1963_2' });
  const logged = after.log.find(l => l.type === 'election'); assert.ok(Math.abs(logged.probability - p.electionChance) < 1e-9);
  let t = governing(); t.queue = ['japan_1965']; t.turn = 65; const q = E.choicePreview(t, d, 'japan_1965_1');
  assert.equal(q.delay.arrival, 69); assert.deepEqual(q.relations, [{ id: 'japan', delta: 4, before: 25, after: 29 }]);
  t = exec(t, { type: 'choose', choiceId: 'japan_1965_1' }); for (const x of q.stats) assert.equal(t.stats[x.id], x.after);
  assert.equal(E.choicePreview(t, d, 'japan_1965_1'), null);
});
test('v2: projectEffects clamps to metric ranges', () => {
  const s = governing(); s.stats.liberty = 98; s.stats.debt = 99990;
  assert.deepEqual(E.projectEffects(s, noBalance, { liberty: 7 }), [{ id: 'liberty', delta: 7, before: 98, after: 100 }]);
  assert.deepEqual(E.projectEffects(s, d, { debt: 50 }), [{ id: 'debt', delta: 50, before: 99990, after: 99999 }]);
});
test('v2: event context follows the campaign path, not the real timeline', () => {
  const buma = d.events.find(e => e.id === 'buma_1979'), yushin = d.events.find(e => e.id === 'yushin_1972');
  const s = governing(); s.flags.authoritarian = true; assert.match(E.eventContext(s, buma), /권력 집중/);
  delete s.flags.authoritarian; s.stats.liberty = 70; assert.match(E.eventContext(s, buma), /언론과 결사/);
  s.stats.liberty = 40; assert.match(E.eventContext(s, buma), /충분히 회복되지/);
  s.flags.route = 'military'; assert.match(E.eventContext(s, yushin), /군정/); s.flags.route = 'constitutional'; assert.match(E.eventContext(s, yushin), /헌정 경로/);
  for (const e of d.events.filter(e => e.kind === 'historical_anchor')) assert.ok(e.context?.length, e.id);
  assert.equal(E.eventContext(s, d.events.find(e => e.id === 'sys_grain')), '');
});
test('v2: inauguration only appears after winning the 1963 election', () => {
  let s = createState(d); s.turn = 46; s.phase = 'elected'; s.queue = []; s.flags.won1963 = true; s = exec(s, { type: 'endMonth' }); assert.deepEqual(s.queue, ['inauguration_1963']);
  let t = createState(d); t.turn = 46; t.phase = 'civilian'; t.queue = []; t = exec(t, { type: 'endMonth' }); assert.ok(!t.queue.includes('inauguration_1963'));
});
test('v2: election timing helpers', () => {
  const s = governing(); s.turn = 60; assert.equal(E.nextElectionTurn(s), 94); s.turn = 94; assert.equal(E.nextElectionTurn(s), 142); s.turn = 230; assert.equal(E.nextElectionTurn(s), 238); s.turn = 238; assert.equal(E.nextElectionTurn(s), null);
  s.turn = 60; s.flags.authoritarian = true; assert.equal(E.nextElectionTurn(s), null);
  const t = createState(d); assert.equal(E.nextElectionTurn(t), null);
  assert.ok(Math.abs(E.electionExpectation(s, d) - (E.supportAverage(s, d) * .65 + s.stats.legitimacy * .35)) < 1e-12);
});
test('v2: after an ending no action changes state', () => {
  let s = governing(); s.queue = ['buma_1979']; s = exec(s, { type: 'choose', choiceId: 'buma_1979_3' }); assert.equal(s.ending.id, 'peaceful_transfer');
  const raw = exportSave(s);
  for (const a of [{ type: 'endMonth' }, { type: 'prepare' }, { type: 'policy', id: 'farm_extension' }, { type: 'project', id: 'rural_clinic', regionId: 'capital' }, { type: 'budget', budget: s.budget }, { type: 'diplomacy', countryId: 'usa', mode: 'talk' }, { type: 'adviser', id: 'han' }, { type: 'repay', amount: 10 }, { type: 'choose', choiceId: 'buma_1979_1' }]) assert.equal(dispatch(s, d, a).ok, false);
  assert.equal(exportSave(s), raw);
});

/* ===== 저장 호환 ===== */
test('save v1 files from the original kit migrate and keep playing', () => {
  for (const name of ['1964_governing.json', '1973_policy_choices.json']) {
    const raw = fs.readFileSync(new URL(`fixtures/v1_${name}`, import.meta.url), 'utf8');
    assert.equal(JSON.parse(raw).version, 1);
    const s = importSave(raw, d);
    assert.equal(s.version, E.SAVE_VERSION); assert.equal(s.day, 1); assert.equal(s.dataVersion, d.meta.version); assert.equal(s.report, null); assert.deepEqual(s.monthActions, []);
    const old = JSON.parse(raw).state; for (const k of ['turn', 'rng', 'stats', 'support', 'policies', 'bills', 'projects', 'queue', 'delayed', 'flags']) assert.deepEqual(s[k], old[k], k);
    const next = advance(s, 3); checkInvariants(next, d); assert.ok(next.report);
    assert.deepEqual(importSave(exportSave(next), d), next);
  }
});
test('format 2 saves from data 1.1.0 continue under the 1.2.0 rules', () => {
  const raw = fs.readFileSync(new URL('fixtures/v2_data110_1964_bills_and_projects.json', import.meta.url), 'utf8'), old = JSON.parse(raw).state;
  assert.equal(old.dataVersion, '1.1.0');
  const s = importSave(raw, d); assert.equal(s.dataVersion, d.meta.version); assert.equal(s.version, E.SAVE_VERSION); assert.equal(s.day, 1);
  for (const k of ['turn', 'rng', 'ap', 'stats', 'support', 'relations', 'policies', 'bills', 'projects', 'queue', 'delayed', 'flags', 'report', 'monthActions', 'log']) assert.deepEqual(s[k], old[k], k);
  const next = advance(s, 3); checkInvariants(next, d); assert.deepEqual(importSave(exportSave(next), d), next);
  for (const v of ['1.0.0', '1.1.1', '9.9.9', 1.1]) { const p = JSON.parse(raw); p.state.dataVersion = v; assert.throws(() => importSave(JSON.stringify(p), d), String(v)); }
});
test('migrateSave rejects mismatched legacy data and unknown versions', () => {
  const raw = fs.readFileSync(new URL('fixtures/v1_1964_governing.json', import.meta.url), 'utf8');
  for (const mutate of [p => p.state.dataVersion = '0.9.0', p => p.state.version = 2, p => p.state.gameId = 'other', p => p.version = 3, p => p.format = 'OTHER', p => p.state.stats.gdp = NaN]) { const p = JSON.parse(raw); mutate(p); assert.throws(() => importSave(JSON.stringify(p), d)); }
  assert.throws(() => E.migrateSave({ format: 'KOREA1960_SAVE', version: 0, state: {} }, d));
});
test('v2 save rejects tampered report, monthActions and log metadata', () => {
  let s = governing(); s = exec(s, { type: 'policy', id: 'export_credit' }); s = exec(s, { type: 'diplomacy', countryId: 'usa', mode: 'talk' });
  const base = JSON.parse(exportSave(s)); let t = exec(s, { type: 'endMonth' }); const withReport = JSON.parse(exportSave(t));
  const cases = [
    [base, p => p.state.monthActions = ['diplomacy:mars']], [base, p => p.state.monthActions = ['spend:usa']], [base, p => p.state.monthActions = ['diplomacy:usa', 'diplomacy:usa']],
    [base, p => p.state.log.at(-2).changes = { treasury: 'x' }], [base, p => p.state.log.at(-2).changes = { cheat: 5 }], [base, p => p.state.log[0].eventId = 'nope'], [base, p => p.state.log.at(-1).countryId = 'mars'],
    [base, p => delete p.state.report], [base, p => delete p.state.monthActions],
    [withReport, p => p.state.report.turn = 999], [withReport, p => p.state.report.finance.balance = 'lots'], [withReport, p => p.state.report.completed = [{ projectId: 'x', regionId: 'capital' }]],
    [withReport, p => p.state.report.ledger.gdp = [['source', 'NaN']]], [withReport, p => p.state.report.extra = '<script>'], [withReport, p => p.state.report.events = ['ghost']], [withReport, p => p.state.report.election = { share: 500, transfer: false, seats: .5 }],
    [withReport, p => p.state.bills = [{ policyId: 'association', total: 6, remaining: 0, status: 'passed', startedTurn: 0, probability: 7, roll: .2 }]]
  ];
  for (const [src, mutate] of cases) { const p = JSON.parse(JSON.stringify(src)); mutate(p); assert.throws(() => importSave(JSON.stringify(p), d), String(mutate)); }
  assert.deepEqual(importSave(JSON.stringify(withReport), d), t);
});

/* ===== 하루 단위 시계 (저장 형식 3) ===== */
test('clock: real month lengths and day labels', () => {
  assert.deepEqual([0, 1, 3, 13, 49, 145, 239].map(E.daysInMonth), [31, 29, 30, 28, 29, 29, 31]);
  assert.equal(E.dayLabel(16, 16), '1961-05-16'); assert.equal(E.dayLabel(240, 1), '1979-12-01');
});
test('clock: a day tick only moves the date, never mutates the input and is blocked by a pending event', () => {
  let s = free(createState(d)); const before = exportSave(s);
  const r = dispatch(s, d, { type: 'tick' }); assert.equal(r.ok, true); assert.equal(exportSave(s), before);
  assert.equal(r.state.day, 2); assert.equal(r.state.turn, 0); assert.deepEqual({ ...r.state, day: 1 }, s);
  const pending = createState(d); assert.match(dispatch(pending, d, { type: 'tick' }).error, /사건/);
});
test('clock: ticking through a month gives exactly the same state as the month-end action', () => {
  for (const seed of [3, 777]) {
    let a = free(createState(d, seed)), b = a, ticks = 0;
    for (let m = 0; m < 30; m++) {
      a = exec(a, { type: 'endMonth' }); a = free(a);
      const turn = b.turn; while (b.turn === turn) { b = exec(b, { type: 'tick' }); ticks++; } b = free(b);
      const strip = x => ({ ...x, log: x.log.map(({ date, ...l }) => l) });
      assert.deepEqual(strip(b), strip(a), `seed ${seed} month ${m}`);
    }
    assert.equal(ticks, Array.from({ length: 30 }, (_, t) => E.daysInMonth(t)).reduce((x, y) => x + y, 0));
  }
});
test('clock: month-end settlement is dated the last day; actions are dated the day they happen', () => {
  let s = governing(); s.day = 10; s = exec(s, { type: 'policy', id: 'farm_extension' });
  assert.equal(s.log.at(-1).date, '1965-01-10');
  s = exec(s, { type: 'endMonth' }); assert.equal(s.day, 1); assert.equal(s.turn, 61);
  assert.ok(s.log.filter(l => l.turn === 60 && l.type !== 'policy').every(l => l.date === '1965-01-31'));
});
test('clock: format 3 keeps the day; bad days and format 2 files with a day are rejected', () => {
  let s = free(createState(d)); for (let i = 0; i < 20; i++) s = exec(s, { type: 'tick' });
  assert.equal(s.day, 21); assert.deepEqual(importSave(exportSave(s), d), s);
  for (const day of [0, 32, '5', 1.5, null]) { const p = JSON.parse(exportSave(s)); p.state.day = day; assert.throws(() => importSave(JSON.stringify(p), d), String(day)); }
  const feb = JSON.parse(exportSave(s)); feb.state.turn = 13; feb.state.day = 29; assert.throws(() => importSave(JSON.stringify(feb), d)); // 1961년 2월은 28일
  const v2 = JSON.parse(exportSave(s)); v2.version = 2; v2.state.version = 2; assert.throws(() => importSave(JSON.stringify(v2), d)); // 형식 2에는 day가 없어야 한다
  delete v2.state.day; const back = importSave(JSON.stringify(v2), d); assert.equal(back.day, 1); assert.equal(back.version, E.SAVE_VERSION);
});

test('map view is a valid visited screen in saves', () => {
  const s = free(createState(d)); s.visited = ['map', 'overview']; assert.deepEqual(importSave(exportSave(s), d).visited, ['map', 'overview']);
  const p = JSON.parse(exportSave(s)); p.state.visited = ['atlas']; assert.throws(() => importSave(JSON.stringify(p), d));
});

/* ===== 데이터 1.2.0 밸런스 규칙 ===== */
test('balance: gains shrink above 60, never reach 100, and losses are never reduced', () => {
  const s = governing();
  for (const [v, f] of [[30, 1], [60, 1], [70, .75], [80, .5], [90, .25], [99, .025]]) { s.stats.liberty = v; assert.ok(Math.abs(E.gainScale(s, d, 'liberty') - f) < 1e-12, `liberty ${v}`); }
  s.stats.liberty = 50; assert.ok(Math.abs(E.gainScale(s, d, 'liberty', 'fictional_system') - .35) < 1e-12); assert.equal(E.gainScale(s, d, 'liberty', 'historical_anchor'), 1);
  for (const id of ['gdp', 'treasury', 'debt', 'inflation', 'unemployment']) assert.equal(E.gainScale(s, d, id, 'fictional_system'), 1, id);
  assert.equal(E.gainScale(s, noBalance, 'liberty', 'fictional_system'), 1);
  s.stats.liberty = 99.9; const [x] = E.projectEffects(s, d, { liberty: 9 }); assert.ok(x.after < 100 && x.base === 9);
  const [y] = E.projectEffects(s, d, { liberty: -9 }); assert.equal(y.delta, -9); assert.equal(y.base, undefined);
});
test('balance: fictional event bonuses are reduced, historical anchors and costs are not, and the preview matches', () => {
  let s = governing(); s.queue = ['sys_journal']; s.stats.liberty = 42; s.stats.legitimacy = 45;
  const p = E.choicePreview(s, d, 'sys_journal_1');
  assert.deepEqual(p.stats.map(x => [x.id, +x.delta.toFixed(6), x.base]), [['liberty', .7, 2], ['legitimacy', .7, 2]]);
  const t = exec(s, { type: 'choose', choiceId: 'sys_journal_1' }); for (const x of p.stats) assert.equal(t.stats[x.id], x.after);
  s = governing(); s.queue = ['sys_grain']; const q = E.choicePreview(s, d, 'sys_grain_1'); assert.equal(q.cost, 5);
  assert.equal(q.stats.find(x => x.id === 'treasury').delta, -5); assert.ok(Math.abs(q.stats.find(x => x.id === 'welfare').delta - 1.05) < 1e-12);
  let a = createState(d); a.turn = 16; a.queue = ['may_1961'];
  const civ = E.choicePreview(a, d, 'may_1961_1'), mil = E.choicePreview(a, d, 'may_1961_2');
  assert.equal(civ.stats.find(x => x.id === 'liberty').delta, 5); assert.equal(mil.stats.find(x => x.id === 'liberty').delta, -12);
});
test('balance: the monthly report names rising expectations, military-rule and authoritarian costs', () => {
  let s = governing(); s.stats.legitimacy = 80; s.stats.admin = 50;
  let r = exec(s, { type: 'endMonth' }).report;
  const exp = r.ledger.legitimacy.find(x => x[0] === '높아진 기대'); assert.ok(exp && Math.abs(exp[1] + (80 - 55) * .015) < .002, String(exp)); // 사회 추세가 먼저 조금 움직인 값 기준
  assert.ok(!r.ledger.admin?.some(x => x[0] === '높아진 기대'));
  s = governing(); s.phase = 'transition'; s.flags.route = 'military';
  r = exec(s, { type: 'endMonth' }).report; assert.deepEqual(r.ledger.legitimacy.find(x => x[0] === '군정의 비용'), ['군정의 비용', -.08]);
  const plain = governing(), auth = governing(); auth.flags.authoritarian = true;
  const p1 = exec(plain, { type: 'endMonth' }), p2 = exec(auth, { type: 'endMonth' });
  const cost = Object.fromEntries(p2.report.ledger.liberty.concat(p2.report.ledger.legitimacy).filter(x => x[0] === '권력 집중의 비용').map((x, i) => [i ? 'legitimacy' : 'liberty', x[1]]));
  assert.deepEqual(cost, { liberty: -.22, legitimacy: -.3 });
  assert.ok(p2.support.students < p1.support.students && p2.support.opposition < p1.support.opposition && p2.relations.international < p1.relations.international);
  s = governing(); s.flags.authoritarian = true; s.stats.liberty = 30; assert.equal(E.gainScale(s, d, 'liberty'), .7); assert.equal(E.gainScale(s, d, 'legitimacy'), .5);
});
test('balance: an authoritarian legacy outranks industrial success when liberty stays below 40', () => {
  const s = governing(); for (const m of d.metrics) s.stats[m.id] = m.initial;
  Object.assign(s.stats, { industry: 85, gdp: 300, liberty: 30, legitimacy: 50 }); evaluateEnding(s, d, true); assert.equal(s.ending.id, 'authoritarian');
  const t = governing(); for (const m of d.metrics) t.stats[m.id] = m.initial;
  Object.assign(t.stats, { industry: 85, gdp: 300, liberty: 45, legitimacy: 50 }); evaluateEnding(t, d, true); assert.equal(t.ending.id, 'industrial');
});
test('balance: production growth leans more on investment than in 1.1.0', () => {
  const s = governing();
  const trend = data => dispatch(s, data, { type: 'endMonth' }).state.report.ledger.gdp.find(x => x[0] === '생산 추세')[1];
  assert.ok(Math.abs(trend(noBalance) - trend(d) - s.stats.gdp * (.0025 - d.balance.growthBase)) < 1e-9);
});

/* ===== v1 참조 엔진과의 회귀 비교 =====
 * v2는 v1의 수식을 그대로 쓰고 법안 확률·외교 횟수·종료 직전 착수 제한만 바꿨다. 데이터 1.2.0의 밸런스 규칙은
 * balance 블록에만 있으므로, 블록을 뺀 같은 데이터(noBalance)로 돌리면 두 엔진의 상태가 매달 같아야 한다. */
test('regression: v2 without the balance block reproduces the v1 reference engine where rules are unchanged', () => {
  const d = noBalance;
  const shared = ['turn', 'rng', 'phase', 'ap', 'influence', 'seats', 'stats', 'support', 'relations', 'budget', 'policies', 'projects', 'advisers', 'flags', 'queue', 'lastEvents', 'delayed', 'history', 'ending', 'lastFinance'];
  const pick = s => Object.fromEntries(shared.map(k => [k, s[k]]));
  for (const [seed, route] of [[11, 'may_1961_1'], [2024, 'may_1961_2'], [777, 'may_1961_3']]) {
    let a = V1.createState(d, seed), b = E.createState(d, seed), months = 0;
    const both = action => { const ra = V1.dispatch(a, d, action), rb = E.dispatch(b, d, action); assert.equal(ra.ok, rb.ok, `${JSON.stringify(action)} ${ra.error} / ${rb.error}`); a = ra.state; b = rb.state; return ra.ok; };
    while (!a.ending) {
      if (a.queue.length) {
        const e = d.events.find(x => x.id === a.queue[0]);
        const c = e.id === 'may_1961' ? route : e.id === 'yushin_1972' ? 'yushin_1972_2' : (e.choices.find(c => !c.ending && (c.effects.treasury || 0) >= 0) || e.choices[0]).id;
        both({ type: 'choose', choiceId: c }); continue;
      }
      if (E.PREPARE_PHASES.includes(a.phase)) while (a.ap > 0) both({ type: 'prepare' });
      else if (E.isExecutive(a)) {
        const free = d.policies.filter(p => !p.requiresBill && !a.policies.includes(p.id));
        if (free.length && a.stats.treasury > 30) both({ type: 'policy', id: free[months % free.length].id });
        const proj = d.projects[months % d.projects.length], reg = d.regions[months % d.regions.length];
        if (a.ap > 0 && a.turn + proj.months <= 240) both({ type: 'project', id: proj.id, regionId: reg.id });
        if (a.ap > 0 && months % 3 === 0) both({ type: 'diplomacy', countryId: d.countries[months % 6].id, mode: ['talk', 'technology', 'humanitarian'][months % 3] });
        if (a.ap > 0 && a.advisers.length < 2) both({ type: 'adviser', id: d.advisers[months % 6].id });
        if (months % 24 === 5) both({ type: 'budget', budget: { industry: 30, agriculture: 10, education: 20, welfare: 15, infrastructure: 15, security: 10 } });
      }
      both({ type: 'endMonth' }); months++;
      assert.deepEqual(pick(b), pick(a), `seed ${seed} month ${months}`);
    }
    assert.equal(b.ending.id, a.ending.id);
  }
});

/* ===== 자동 캠페인: 교착·NaN·무한 반복·빈 사건·미완공 사업·깨진 엔딩 검사 ===== */
test(`campaign sweep: ${SEEDS} seeds x ${Object.keys(STRATEGIES).length} strategies keep every invariant`, () => {
  const events = new Set(), endings = {}, finals = {}, index = d.balance.diminishing.metrics;
  const noCeiling = x => { for (const id of index) if (x.stats[id] >= 100) throw new Error(`${id}가 100에 도달 (t${x.turn})`); };
  for (const strategy of Object.keys(STRATEGIES)) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { state: s, seen } = playCampaign(d, { seed: seed * 104729 + strategy.length, strategy, onStep: x => { checkInvariants(x, d); noCeiling(x); } });
      for (const id of seen.events) events.add(id);
      endings[s.ending.id] = (endings[s.ending.id] || 0) + 1; (finals[strategy] ||= {})[s.ending.id] = (finals[strategy][s.ending.id] || 0) + 1;
      assert.ok(d.endings.some(e => e.id === s.ending.id)); assert.ok(s.turn <= 240);
      for (const p of s.projects) if (p.startedTurn + d.projects.find(x => x.id === p.projectId).months <= s.turn) assert.equal(p.status, 'complete', `${p.projectId} 미완공`);
      if (s.turn === 240) assert.equal(s.projects.filter(p => p.status === 'building').length, 0, '종료 시 미완공 사업');
      assert.deepEqual(importSave(exportSave(s), d), s);
      const after = dispatch(s, d, { type: 'endMonth' }); assert.equal(after.ok, false); assert.equal(after.state, s);
    }
  }
  console.log('Sweep endings by strategy', JSON.stringify(finals));
  // 밸런스 1.2.0: 플레이 방식마다 의도한 엔딩이 실제로 나온다(한 엔딩이 모든 방식을 덮지 않는다).
  const intended = { constitutional: ['balanced', 'constitutional'], military: ['authoritarian'], welfare: ['welfare'], green: ['green'], hardline: ['rights_crisis'], growth: ['industrial'], passive: ['unfinished'] };
  for (const [strategy, ids] of Object.entries(intended)) assert.ok(ids.some(id => finals[strategy][id]), `${strategy}: ${JSON.stringify(finals[strategy])}`);
  assert.ok(!finals.passive.balanced || finals.passive.balanced * 4 <= SEEDS, `소극 플레이가 균형 엔딩을 자주 받음 ${JSON.stringify(finals.passive)}`);
  console.log(`Events seen ${events.size}/${d.events.length}`, d.events.filter(e => !events.has(e.id)).map(e => e.id).join(','));
  assert.ok(events.size >= d.events.length - 2, `사건 도달 ${events.size}`);
});
