// 전선과 공장 — 엔진 테스트. node --test tests/game.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as E from '../game/engine.mjs';
import { index, dayOf, atWar, friendly, finite } from '../game/core.mjs';

const d = JSON.parse(fs.readFileSync(new URL('../data/game.json', import.meta.url), 'utf8'));
const X = index(d);
const days = (s, n) => { for (let i = 0; i < n && !s.ended; i++) { E.advanceDay(s, d); while (s.pending.length) E.dispatch(s, d, { type: 'event', event: s.pending[0].event, option: 0 }); } return s; };
function invariants(s) {
  for (const r of d.regions) { const st = s.regions[r.id]; assert.ok(s.countries[st.controller], `${r.id} 통제국`); assert.ok(s.countries[st.owner], `${r.id} 소유국`); for (const k of ['infra', 'port', 'air', 'fort']) assert.ok(st[k] >= 0 && st[k] <= 10, `${r.id}.${k}`); for (const b of Object.values(st.b)) { assert.ok(b.level >= 0 && Number.isInteger(b.level)); assert.ok(b.staff >= 0 && b.staff <= 1); } }
  for (const dv of s.divisions) { assert.ok(X.regions.has(dv.at) || X.seas.has(dv.at), `사단 위치 ${dv.at}`); assert.ok(dv.str > 0 && dv.str <= 1.0001 && dv.org >= 0 && dv.org <= 1.0001, `사단 ${dv.id} ${dv.str} ${dv.org}`); assert.ok(s.countries[dv.owner].exists, `없어진 나라의 사단 ${dv.owner}`); }
  for (const c of Object.values(s.countries)) {
    if (!c.exists || !c.econ) continue;
    for (const [g, p] of Object.entries(c.econ.prices)) { const base = X.goods.get(g).price; assert.ok(finite(p) && p >= base * .39 && p <= base * 1.91, `${c.id} ${g} 가격 ${p}`); }
    for (const [e, n] of Object.entries(c.stock)) assert.ok(finite(n) && n >= 0, `${c.id} 재고 ${e} ${n}`);
    for (const k of ['pp', 'stability', 'warSupport']) assert.ok(finite(c[k]), `${c.id}.${k}`);
    assert.ok(c.stability >= 0 && c.stability <= 1 && c.warSupport >= 0 && c.warSupport <= 1);
    assert.ok(finite(c.econ.debt) && c.econ.debt >= 0);
    assert.ok(c.manpower.used >= 0 && c.manpower.training >= 0 && c.manpower.lost >= 0);
  }
  for (const f of s.fleets) { assert.ok(X.seas.has(f.at) || X.regions.has(f.at)); for (const n of Object.values(f.ships)) assert.ok(n >= 0 && Number.isInteger(n)); }
  for (const [a, b] of s.wars) { assert.notEqual(a, b); assert.ok(s.countries[a].exists && s.countries[b].exists, `없는 나라의 전쟁 ${a}-${b}`); }
}

test('데이터 검사 도구가 통과한다(상호 참조·자원·조건)', () => {
  const out = execFileSync('node', ['tools/build_data.mjs', '--check'], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' });
  assert.match(out, /데이터 OK/);
});

test('지도: 지역 208, 해역 48, 모든 지역이 땅이나 바다로 이어진다', () => {
  const onMap = d.regions.filter(r => !r.offmap);
  assert.equal(onMap.length, 208); assert.equal(d.seas.length, 48);
  for (const r of onMap) { assert.ok(r.adj.length || r.coast.length, r.id); assert.ok(r.airZone, r.id); for (const n of r.adj) assert.ok(X.regions.get(n).adj.includes(r.id), `인접 대칭 ${r.id}-${n}`); }
  for (const s of d.seas) for (const n of s.adj) assert.ok(X.seas.get(n).adj.includes(s.id));
});

test('여섯 주요국 모두 새 게임을 만들 수 있고 처음 상태가 불변식을 지킨다', () => {
  for (const id of ['japan', 'china', 'ccp', 'ussr', 'usa', 'uk']) {
    const s = E.createState(d, id, 3);
    invariants(s);
    assert.equal(s.player, id); assert.equal(s.wars.length, 0);
    assert.ok(Object.keys(s.weather).length === d.airZones.length + d.seas.length);
    assert.ok(s.divisions.some(dv => dv.owner === id));
    assert.ok(s.countries[id].lines.length > 0, `${id} 생산 라인`);
    const R = E.econ.compute(s, d, id);
    assert.ok(finite(R.gdp) && R.gdp > 0 && finite(R.finance.balance));
  }
});

test('시장: 가격 공식의 방향과 한계', () => {
  const p = d.economy.price;
  assert.equal(E.econ.priceRatio(10, 10, p), 0);
  assert.ok(E.econ.priceRatio(10, 20, p) > 0 && E.econ.priceRatio(20, 10, p) < 0);
  assert.equal(E.econ.priceRatio(0, 5, p), p.ceiling); assert.equal(E.econ.priceRatio(5, 0, p), p.floor);
  assert.ok(E.econ.priceRatio(1, 1000, p) <= p.ceiling && E.econ.priceRatio(1000, 1, p) >= p.floor);
});

test('금수는 그 공급국의 몫만큼 수입 가능량을 줄인다', () => {
  const s = E.createState(d, 'japan', 3), oil = X.goods.get('oil');
  const before = E.econ.supplierShare(s, d, 'japan', oil);
  s.countries.japan.embargoedBy = ['usa', 'uk', 'netherlands'];
  const after = E.econ.supplierShare(s, d, 'japan', oil);
  assert.ok(Math.abs(before - after - (.6 + .15 + .05)) < 1e-9, `${before} → ${after}`);
});

test('행동: 국가 중점·연구·법·건설·생산 라인·편제·모집의 허용과 거부 사유', () => {
  const s = E.createState(d, 'japan', 3), c = s.countries.japan;
  assert.equal(E.dispatch(s, d, { type: 'focus', id: 'jp_navy_first' }).ok, false);
  assert.ok(E.dispatch(s, d, { type: 'focus', id: 'jp_cabinet' }).ok);
  assert.match(E.dispatch(s, d, { type: 'focus', id: 'jp_heavy_industry' }).reason, /진행 중/);
  days(s, 36);
  assert.ok(c.focus.done.includes('jp_cabinet'));
  assert.ok(E.dispatch(s, d, { type: 'focus', id: 'jp_army_first' }).ok);
  days(s, 71);
  assert.ok(!c.spirits.includes('army_navy_rivalry'), '육해군의 대립이 사라진다');
  assert.equal(E.pol.focusReason(s, d, 'japan', 'jp_navy_first'), '함께 고를 수 없는 중점을 이미 골랐습니다.');
  c.research.slots[0] = null;
  assert.match(E.dispatch(s, d, { type: 'research', slot: 0, tech: 'inf_eq3' }).reason, /선행/);
  assert.ok(E.dispatch(s, d, { type: 'research', slot: 0, tech: 'efficiency1' }).ok || c.research.done.includes('efficiency1'));
  c.pp = 0; assert.match(E.dispatch(s, d, { type: 'law', group: 'economy', option: 'war_economy' }).reason, /정치력/);
  assert.match(E.dispatch(s, d, { type: 'build', id: 'oil', region: 'kanto' }).reason, /석유/);
  assert.match(E.dispatch(s, d, { type: 'build', id: 'civ', region: 'nanjing' }).reason, /통제/);
  const n0 = c.construction.length; assert.ok(E.dispatch(s, d, { type: 'build', id: 'civ', region: 'kansai' }).ok); assert.equal(c.construction.length, n0 + 1);
  const cap = Math.floor(E.econ.armsCapacity(s, d, 'japan'));
  assert.match(E.dispatch(s, d, { type: 'setLine', equip: 'inf_eq', factories: cap + 5 }).reason, /공장/);
  assert.ok(E.dispatch(s, d, { type: 'setLine', equip: 'inf_eq', factories: 1 }).ok);
  assert.match(E.dispatch(s, d, { type: 'template', name: 'x', bat: { infantry: 13 } }).reason, /12/);
  const t = E.dispatch(s, d, { type: 'template', name: '시험 사단', bat: { infantry: 6, artillery: 2 }, sup: ['engineer'] });
  assert.ok(t.ok && s.templates.some(x => x.id === t.id));
  const tr = c.manpower.training; assert.ok(E.dispatch(s, d, { type: 'train', tpl: t.id }).ok); assert.ok(c.manpower.training > tr);
  invariants(s);
});

test('국가 중점의 건설 효과와 하루 단위 건설이 건물 단계를 늘린다', () => {
  const s = E.createState(d, 'japan', 3), lv = () => s.regions.kanto.b.civ.level;
  const before = lv(); E.pol.applyFx(s, d, 'japan', { build: [['civ', 2, 'kanto']] }, () => {});
  assert.equal(lv(), before + 2);
  s.countries.japan.construction = [{ id: 'infra', kind: 'facility', region: 'kyushu', progress: 24.99 }];
  const infra = s.regions.kyushu.infra; days(s, 3);
  assert.equal(s.regions.kyushu.infra, infra + 1);
});

test('생산 라인: 효율이 오르고 장비가 재고에 쌓인다', () => {
  const s = E.createState(d, 'ussr', 3), c = s.countries.ussr;
  c.lines = [{ id: 'ln_inf_eq', equip: 'inf_eq', factories: 10, eff: .1, carry: 0 }];
  const stock = c.stock.inf_eq || 0; days(s, 31);
  assert.ok(c.lines[0].eff > .25, `효율 ${c.lines[0].eff}`);
  assert.ok((c.stock.inf_eq || 0) > stock, '소화기가 늘어난다');
});

test('전투: 셋이 하나를 치면 방어 쪽 조직력이 떨어지고, 지키는 사단이 없으면 걸어 들어가 점령한다', () => {
  const s = E.createState(d, 'japan', 3);
  s.divisions = s.divisions.filter(dv => !['peiping', 'tianjin', 'hebei', 'kalgan', 'jehol'].includes(dv.at));
  E.pol.declareWar(s, d, 'japan', 'china', () => {}, { forced: true });
  const def = E.pol.spawnDivision(s, d, 'china', 'cn_regional', 'peiping');
  const atk = [1, 2, 3].map(() => E.pol.spawnDivision(s, d, 'japan', 'jp_inf', 'jehol'));
  for (const a of atk) assert.ok(E.mil.orderAttack(s, d, a, 'peiping').ok);
  days(s, 1);
  assert.ok(s.battles.peiping, '전투가 열린다');
  assert.ok(def.org < 1, '방어 쪽 조직력이 준다');
  days(s, 25);
  assert.equal(s.regions.peiping.controller, 'japan', '베이핑을 점령한다');
  // 빈 지역은 이동 시간이 걸린다
  const t = E.pol.spawnDivision(s, d, 'japan', 'jp_inf', 'peiping');
  assert.ok(E.mil.orderAttack(s, d, t, 'tianjin').ok || s.regions.tianjin.controller === 'japan');
  days(s, 1); assert.notEqual(s.regions.tianjin.controller === 'japan' && t.at === 'tianjin' && s.day < 3, true);
  invariants(s);
});

test('상륙은 목표 앞바다의 해상 우세가 있어야 한다', () => {
  const s = E.createState(d, 'japan', 3);
  E.pol.declareWar(s, d, 'japan', 'usa', () => {}, { forced: true });
  const dv = E.pol.spawnDivision(s, d, 'japan', 'jp_inf', 'taiwan');
  assert.match(E.mil.canInvade(s, d, dv, 'luzon_n'), /해상 우세/);
  s.navSup = { [X.regions.get('luzon_n').coast[0]]: { japan: 1 } };
  assert.equal(E.mil.canInvade(s, d, dv, 'luzon_n'), '');
  assert.match(E.mil.canInvade(s, d, dv, 'hawaii'), /너무 멉니다/);
});

test('선전 포고: 명분이 없으면 거부, 고립주의는 막고, 진영과 괴뢰국이 함께 들어간다', () => {
  const s = E.createState(d, 'japan', 3);
  assert.match(E.pol.canDeclare(s, d, 'japan', 'china'), /명분/);
  assert.match(E.pol.canDeclare(s, d, 'usa', 'japan'), /고립주의/);
  s.countries.japan.wargoals.push('china');
  assert.ok(E.dispatch(s, d, { type: 'declare', target: 'china' }).ok);
  assert.ok(atWar(s, 'manchukuo', 'china'), '괴뢰국 만주국이 함께 싸운다');
  E.pol.declareWar(s, d, 'japan', 'uk', () => {}, { forced: true });
  assert.ok(atWar(s, 'japan', 'australia'), '연합국의 오스트레일리아가 들어온다');
  assert.ok(!friendly(s, 'japan', 'uk'));
});

test('저장 왕복과 손상된 저장 거부', () => {
  const s = days(E.createState(d, 'china', 5), 40);
  const text = E.exportSave(s), r = E.importSave(text, d);
  assert.ok(r.ok); assert.equal(JSON.stringify(r.state), JSON.stringify(JSON.parse(text).state));
  assert.equal(E.importSave('{', d).ok, false);
  assert.equal(E.importSave(JSON.stringify({ format: 'X' }), d).ok, false);
  assert.match(E.importSave(JSON.stringify({ format: E.SAVE_FORMAT, version: 99, state: {} }), d).reason, /형식/);
  const o = JSON.parse(text); delete o.state.regions.kanto; assert.equal(E.importSave(JSON.stringify(o), d).ok, false);
});

test('같은 씨앗이면 같은 결과(결정성)', () => {
  const a = days(E.createState(d, 'usa', 9), 220), b = days(E.createState(d, 'usa', 9), 220);
  assert.equal(JSON.stringify(a.regions), JSON.stringify(b.regions));
  assert.equal(JSON.stringify(a.divisions.map(x => [x.id, x.at, x.str])), JSON.stringify(b.divisions.map(x => [x.id, x.at, x.str])));
});


test('날씨: 모든 항공 구역·해역에 날씨가 있고, 같은 씨앗이면 같으며, 계절을 따른다', () => {
  const s = E.createState(d, 'japan', 11);
  for (const z of [...d.airZones, ...d.seas]) assert.ok(d.weather[s.weather[z.id]], z.id);
  const a = E.createState(d, 'japan', 11); days(a, 30); const b = E.createState(d, 'japan', 11); days(b, 30);
  assert.equal(JSON.stringify(a.weather), JSON.stringify(b.weather));
  // 하얼빈의 1월과 7월: 겨울에는 눈, 여름에는 비가 잦다(같은 난수로 여러 해)
  const zone = X.regions.get('harbin').airZone, tally = { w: {}, s: {} };
  const t = { day: 0, rng: 7, weather: {} };
  for (let y = 0; y < 6; y++) for (const [m, k] of [['01', 'w'], ['07', 's']]) { t.day = dayOf(`${1936 + y}-${m}-01`); for (let i = 0; i < 28; i++) { E.wx.dailyWeather(t, d); const c = t.weather[zone]; tally[k][c] = (tally[k][c] || 0) + 1; t.day++; } }
  assert.ok((tally.w.snow || 0) + (tally.w.blizzard || 0) > 10, JSON.stringify(tally.w));
  assert.ok(!tally.s.snow && !tally.s.blizzard, '여름에는 눈이 없다');
  assert.ok((tally.s.rain || 0) + (tally.s.storm || 0) > 10, JSON.stringify(tally.s));
});

test('날씨 효과: 눈보라는 이동을 늦추고, 태풍·폭우는 상륙을 막는다', () => {
  const s = E.createState(d, 'japan', 3);
  const dv = E.pol.spawnDivision(s, d, 'japan', 'jp_inf', 'harbin');
  for (const z of Object.keys(s.weather)) s.weather[z] = 'clear';
  const clear = E.mil.findPath(s, d, dv, 'qiqihar').days;
  s.weather[X.regions.get('qiqihar').airZone] = 'blizzard';
  assert.ok(E.mil.findPath(s, d, dv, 'qiqihar').days > clear * 1.8, '눈보라 속 이동은 두 배쯤 걸린다');
  E.pol.declareWar(s, d, 'japan', 'usa', () => {}, { forced: true });
  const inv = E.pol.spawnDivision(s, d, 'japan', 'jp_inf', 'taiwan');
  s.navSup = { [X.regions.get('luzon_n').coast[0]]: { japan: 1 } };
  assert.equal(E.mil.canInvade(s, d, inv, 'luzon_n'), '');
  s.weather[X.regions.get('luzon_n').airZone] = 'typhoon';
  assert.match(E.mil.canInvade(s, d, inv, 'luzon_n'), /날씨/);
});

test('장군: 군을 편성하면 가장 능력 있는 장군이 붙고 공격·방어가 오른다, 시기 밖의 장군은 못 붙는다', () => {
  const s = E.createState(d, 'ussr', 3);
  s.armies = s.armies.filter(a => a.owner !== 'ussr'); for (const L of Object.values(s.leaders)) if (L.country === 'ussr') L.army = null; for (const dv of s.divisions) if (dv.owner === 'ussr') dv.army = null;
  const ids = s.divisions.filter(dv => dv.owner === 'ussr' && dv.at === 'khabarovsk').map(dv => dv.id);
  const r = E.dispatch(s, d, { type: 'formArmy', divisions: ids });
  assert.ok(r.ok);
  const a = s.armies.find(x => x.id === r.id);
  assert.equal(a.leader, 'blyukher', '1936년 극동의 장군');
  const dv = s.divisions.find(x => x.id === ids[0]);
  const lm = E.mil.leaderMods(s, d, dv, 'f');
  assert.ok(lm.atk > 1 && lm.def > 1 && lm.cold);
  assert.match(E.dispatch(s, d, { type: 'assignLeader', army: a.id, leader: 'zhukov' }).reason, /지금은/);
  assert.match(E.dispatch(s, d, { type: 'assignLeader', army: a.id, leader: 'yamamoto' }).reason, /이 나라/);
  // 숙청된 블류헤르는 1938년 10월 22일에 물러난다
  s.day = dayOf('1938-10-22'); E.mil.dailyLeaders(s, d, () => {});
  assert.equal(a.leader, null);
});

test('장군의 경험과 AI 배치', () => {
  const s = E.createState(d, 'ccp', 7); s.autoPlayer = true;
  assert.ok(s.armies.some(a => a.owner === 'japan' && a.leader), '일본 AI는 장군을 붙인다');
  assert.ok(s.fleets.some(f => f.owner === 'japan' && f.leader === 'yamamoto'), '연합함대 사령장관');
  days(s, 700);
  assert.ok(Object.values(s.leaders).some(L => L.xp > 0 || L.skill > X.leaders.get(L.id).skill), '전투를 치른 장군이 경험을 얻는다');
});

test('10년 자동 진행: 불변식, 역사 사건, 끝', { timeout: 240000 }, () => {
  const s = E.createState(d, 'ccp', 7); s.autoPlayer = true;
  let i = 0;
  while (!s.ended && i < 3700) { E.advanceDay(s, d); if (++i % 365 === 0) invariants(s); }
  invariants(s);
  assert.ok(s.ended, '1945년 말 또는 항복으로 끝난다');
  for (const id of ['ev_226', 'ev_xian', 'ev_marco_polo', 'ev_europe_war', 'ev_tripartite', 'ev_oil_embargo', 'ev_hull_note', 'ev_pearl_harbor']) assert.ok(s.fired[id] >= 0, `사건 ${id}`);
  assert.ok(s.fired.ev_marco_polo === dayOf('1937-07-07'), '루거우차오 사건은 1937년 7월 7일');
  assert.ok(Object.keys(s.warStart).some(k => k.includes('japan') && k.includes('usa')), '태평양 전쟁이 일어난다');
  assert.ok(s.countries.china.exists, '국민정부는 버틴다');
});
