/* 전선과 공장: 동아시아 1936 — 계산 엔진(게임 0.2.0, 데이터 0.2.0, 저장 형식 2: 장군·군·날씨).
 * 화면은 dispatch로 행동을 보내고 돌려받은 상태만 그린다. 하루 진행(advanceDay)은 결정적이다(씨앗이 같으면 결과가 같다). */
import { clamp, round, sum, index, mods, dateOf, isMonthStart, yearOf, fmtDate, atWar, isAtWar, friendly, END_DAY } from './core.mjs';
import * as econ from './economy.mjs';
import * as mil from './military.mjs';
import * as pol from './politics.mjs';
import * as ai from './ai.mjs';
import * as wx from './weather.mjs';

export const SAVE_FORMAT = 'FRONTLINE1936_SAVE';
export const SAVE_VERSION = 2;
export { econ, mil, pol, ai, wx };

export function createState(d, player = 'japan', seed = 1936) {
  const X = index(d);
  const s = { format: SAVE_FORMAT, version: SAVE_VERSION, dataVersion: d.meta.version, seed, rng: seed >>> 0, day: 0, player, countries: {}, regions: {}, divisions: [], fleets: [], air: [], templates: [],
    wars: [], warStart: {}, factions: {}, flags: {}, leaders: {}, armies: [], weather: {}, fired: {}, pending: [], log: [], notices: [], captured: [], battles: {}, airSup: {}, navSup: {}, history: [], seq: 0, ended: null };
  for (const f of d.factions) s.factions[f.id] = { id: f.id, leader: f.members.length ? f.leader : null };
  for (const c of d.countries) {
    const fac = d.factions.find(f => f.members.includes(c.id));
    const startTechs = [...new Set([...(d.startTechs['*'] || []), ...(d.startTechs[c.id] || [])])];
    s.countries[c.id] = {
      id: c.id, name: c.name, short: c.short, color: c.color, playable: !!c.playable, exists: !c.releasable, ideology: c.ideology, popularity: { ...c.popularity },
      pp: 50, ppBase: c.pp, stabBase: c.stability / 100, stability: c.stability / 100, wsBase: c.warSupport / 100, warSupport: c.warSupport / 100,
      spirits: [...c.spirits], laws: { ...c.laws }, capital: c.capital, mapCapital: c.mapCapital || (X.regions.get(c.capital).offmap ? null : c.capital),
      faction: fac ? fac.id : (c.faction || null), overlord: c.overlord || null, embargoedBy: [], wargoals: [], naps: [], access: [], justifying: [],
      focus: { current: null, progress: 0, done: [] }, research: { slots: Array(c.research).fill(null), done: startTechs, bonuses: [] },
      construction: [], lines: [], naval: [], training: [], stock: {}, manpower: { used: 0, training: 0, lost: 0, bonus: 0 }, casualties: 0, blockade: 0, homeLost: false, divCount: 0
    };
  }
  for (const l of d.leaders) s.leaders[l.id] = { id: l.id, country: l.country, name: l.name, kind: l.kind, skill: l.skill, atk: l.atk, def: l.def, plan: l.plan, log: l.log, traits: [...l.traits], xp: 0, army: null, fleet: null };
  wx.dailyWeather(s, d);
  for (const r of d.regions) {
    const b = {};
    for (const [k, n] of Object.entries(r.build)) b[k] = { level: n, pm: 0, staff: .9 };
    s.regions[r.id] = { owner: r.owner, controller: r.owner, infra: r.infra, port: r.port, air: r.air, fort: r.fort, b, damage: 0 };
  }
  const log = logger(s);
  for (const c of d.countries) {
    if (c.releasable) continue;
    for (const [tpl, n, at] of c.forces) for (let i = 0; i < n; i++) pol.spawnDivision(s, d, c.id, tpl, at, { exp: .15 });
    for (const f of c.fleets) s.fleets.push({ id: `fl${++s.seq}`, owner: c.id, name: f.name, at: f.at, ships: { ...f.ships }, mission: 'port', path: [] });
    for (const [type, n, at] of c.air) s.air.push({ id: `aw${++s.seq}`, owner: c.id, type, count: n, base: at, mission: 'idle', zone: X.regions.get(at).airZone || null, lost: 0 });
  }
  // 시작 장비 재고: 사단 정원의 일부와 항공기 예비
  for (const c of Object.values(s.countries)) {
    if (!c.exists) continue;
    const need = {};
    for (const dv of s.divisions) if (dv.owner === c.id) { const st = mil.divisionStats(s, d, dv); for (const [e, q] of Object.entries(st.eq)) need[e] = (need[e] || 0) + q; }
    for (const [e, q] of Object.entries(need)) c.stock[e] = Math.round(q * .25);
    c.stock.inf_eq = (c.stock.inf_eq || 0) + 500;
  }
  for (const c of Object.values(s.countries)) if (c.exists) econ.initEconomy(s, d, c.id);
  for (const c of Object.values(s.countries)) if (c.exists) ai.aiLeaders(s, d, c.id);
  for (const c of Object.values(s.countries)) if (c.exists && c.id !== player) ai.monthlyAI(s, d, c.id, a => dispatch(s, d, a, { silent: true }));
  // 플레이어도 처음에는 생산 라인과 연구를 기본값으로 채워 둔다(바꿀 수 있다).
  ai.monthlyAI(s, d, player, a => (a.type === 'build' || a.type === 'shipyard' || a.type === 'train') ? null : dispatch(s, d, a, { silent: true }));
  const pc = s.countries[player]; pc.focus.current = null; pc.focus.progress = 0;
  s.log = []; s.history = [];
  snapshot(s, d);
  return s;
}
export function logger(s) {
  const fn = (text, country = null, kind = 'info', extra = {}) => { s.log.push({ day: s.day, text, country, kind, ...extra }); if (s.log.length > 1200) s.log.splice(0, s.log.length - 1200); };
  s._log = fn; Object.defineProperty(s, '_log', { enumerable: false, writable: true, configurable: true, value: fn });
  return fn;
}

/* ---------- 행동 ---------- */
export function dispatch(s, d, a, { silent = false } = {}) {
  const cid = a.country || s.player, c = s.countries[cid], X = index(d), log = logger(s);
  const fail = reason => ({ ok: false, reason });
  if (s.ended && !['event'].includes(a.type)) return fail('게임이 끝났습니다.');
  if (!c || !c.exists) return fail('없는 나라입니다.');
  const divs = ids => s.divisions.filter(dv => ids.includes(dv.id) && dv.owner === cid);
  switch (a.type) {
    case 'focus': { const why = pol.startFocus(s, d, cid, a.id); return why ? fail(why) : { ok: true }; }
    case 'cancelFocus': c.focus.current = null; c.focus.progress = 0; return { ok: true };
    case 'research': { const why = pol.startResearch(s, d, cid, a.slot, a.tech); return why ? fail(why) : { ok: true }; }
    case 'cancelResearch': c.research.slots[a.slot] = null; return { ok: true };
    case 'law': { const why = pol.setLaw(s, d, cid, a.group, a.option); if (why) return fail(why); if (!silent) log(`${d.laws[a.group].name}: ${X.lawOption.get(a.option).name}`, cid, 'law'); return { ok: true }; }
    case 'justify': { const why = pol.justify(s, d, cid, a.target); return why ? fail(why) : { ok: true }; }
    case 'declare': { const why = pol.canDeclare(s, d, cid, a.target); if (why) return fail(why); pol.declareWar(s, d, cid, a.target, log); return { ok: true }; }
    case 'joinFaction': { const why = pol.joinReason(s, d, cid); if (why) return fail(why); pol.applyFx(s, d, cid, { join: pol.factionFor(c) }, log); return { ok: true }; }
    case 'build': {
      const why = buildReason(s, d, cid, a); if (why) return fail(why);
      c.construction.push({ id: a.id, kind: a.kind || 'building', region: a.region, progress: 0 });
      return { ok: true };
    }
    case 'cancelBuild': { if (!c.construction[a.index]) return fail('없는 사업입니다.'); c.construction.splice(a.index, 1); return { ok: true }; }
    case 'prioritize': { const q = c.construction.splice(a.index, 1)[0]; if (!q) return fail('없는 사업입니다.'); c.construction.unshift(q); return { ok: true }; }
    case 'setLine': {
      const eq = X.equipment.get(a.equip); if (!eq) return fail('없는 장비입니다.');
      if (eq.tech && !c.research.done.includes(eq.tech)) return fail('먼저 연구해야 합니다.');
      if (eq.air && !(mods(s, d, c).equipment[a.equip])) return fail('이 항공기를 먼저 연구해야 합니다.');
      const n = Math.max(0, Math.round(a.factories)), others = sum(c.lines.filter(l => l.equip !== a.equip).map(l => l.factories));
      if (others + n > Math.floor(econ.armsCapacity(s, d, cid)) + 1e-9) return fail(`군수 공장이 모자랍니다(가용 ${Math.floor(econ.armsCapacity(s, d, cid)) - others}).`);
      const l = c.lines.find(x => x.equip === a.equip);
      if (!n) c.lines = c.lines.filter(x => x.equip !== a.equip);
      else if (l) l.factories = n; else c.lines.push({ id: `ln_${a.equip}`, equip: a.equip, factories: n, eff: d.economy.lineStart, carry: 0 });
      return { ok: true };
    }
    case 'shipyard': {
      const sh = X.ships.get(a.ship); if (!sh) return fail('없는 함선입니다.');
      if (!(mods(s, d, c).ship[a.ship] || a.ship === 'convoy')) return fail('설계를 먼저 연구해야 합니다.');
      if (econ.dockCapacity(s, d, cid) < 1) return fail('조선소가 없습니다.');
      c.naval.push({ ship: a.ship, docks: clamp(Math.round(a.docks || 1), 1, 15), count: clamp(Math.round(a.count || 1), 1, 20), progress: 0 });
      return { ok: true };
    }
    case 'cancelShip': c.naval.splice(a.index, 1); return { ok: true };
    case 'train': {
      const t = mil.templateOf(s, d, a.tpl); if (!t) return fail('없는 편제입니다.');
      if (t.country && t.country !== '*' && t.country !== cid && t.owner !== cid) return fail('이 나라의 편제가 아닙니다.');
      const st = mil.templateStats(s, d, a.tpl, cid);
      for (const [bid] of Object.entries(t.bat)) { const b = X.battalions.get(bid); if (b.tech && !mods(s, d, c).unlock.has(bid) && !c.research.done.includes(b.tech)) return fail(`${b.name} 대대를 먼저 연구해야 합니다.`); }
      if (mil.manpowerAvailable(s, d, cid) < st.manpower) return fail(`인력이 모자랍니다(필요 ${st.manpower.toLocaleString()}명).`);
      const at = a.at && s.regions[a.at] && s.regions[a.at].controller === cid ? a.at : (c.mapCapital || c.capital);
      c.manpower.training += st.manpower;
      c.training.push({ tpl: a.tpl, at, days: 0, total: 60, manpower: st.manpower });
      return { ok: true };
    }
    case 'cancelTrain': { const t = c.training.splice(a.index, 1)[0]; if (t) c.manpower.training -= t.manpower; return { ok: true }; }
    case 'template': {
      const bat = Object.fromEntries(Object.entries(a.bat || {}).filter(([, n]) => n > 0));
      if (!Object.keys(bat).length) return fail('전선 대대가 하나 이상 있어야 합니다.');
      if (sum(Object.values(bat)) > 12) return fail('전선 대대는 12개까지입니다.');
      if ((a.sup || []).length > 4) return fail('지원 중대는 4개까지입니다.');
      for (const b of [...Object.keys(bat), ...(a.sup || [])]) { const def = X.battalions.get(b); if (!def) return fail('없는 대대입니다.'); if (def.tech && !c.research.done.includes(def.tech)) return fail(`${def.name}을(를) 먼저 연구해야 합니다.`); }
      const id = a.id && s.templates.some(t => t.id === a.id && t.owner === cid) ? a.id : `tp${++s.seq}`;
      s.templates = s.templates.filter(t => t.id !== id);
      s.templates.push({ id, owner: cid, country: cid, name: String(a.name || '새 편제').slice(0, 20), bat, sup: [...new Set(a.sup || [])] });
      return { ok: true, id };
    }
    case 'move': case 'attack': case 'invade': {
      const list = divs(a.divisions || []); if (!list.length) return fail('사단을 고르세요.');
      const fn = a.type === 'move' ? mil.orderMove : a.type === 'attack' ? mil.orderAttack : mil.orderInvade;
      let ok = 0, reason = '';
      for (const dv of list) { if (dv.inBattle && a.type === 'move' && s.battles[dv.at]) { reason = '전투 중인 사단은 지역을 지켜야 합니다.'; continue; } const r = fn(s, d, dv, a.type === 'move' ? a.dest : a.target); if (r.ok) ok++; else reason = r.reason; }
      return ok ? { ok: true, count: ok, reason } : fail(reason);
    }
    case 'stop': for (const dv of divs(a.divisions || [])) dv.order = null; return { ok: true };
    case 'formArmy': return mil.formArmy(s, d, cid, a.divisions || [], a.name, a.leader);
    case 'assignLeader': return mil.assignLeader(s, d, cid, a.army, a.leader ?? null);
    case 'assignAdmiral': return mil.assignAdmiral(s, d, cid, a.fleet, a.leader ?? null);
    case 'disbandArmy': { const ar = s.armies.find(x => x.id === a.army && x.owner === cid); if (!ar) return fail('없는 군입니다.'); if (ar.leader) s.leaders[ar.leader].army = null; for (const dv of s.divisions) if (dv.army === ar.id) dv.army = null; s.armies = s.armies.filter(x => x !== ar); return { ok: true }; }
    case 'fleetMove': { const f = s.fleets.find(x => x.id === a.fleet && x.owner === cid); if (!f) return fail('없는 함대입니다.'); return mil.orderFleet(s, d, f, a.dest); }
    case 'fleetMission': { const f = s.fleets.find(x => x.id === a.fleet && x.owner === cid); if (!f) return fail('없는 함대입니다.'); if (!['patrol', 'raid', 'escort', 'port'].includes(a.mission)) return fail('없는 임무입니다.'); if (a.mission !== 'port' && !X.seas.has(f.at)) return fail('먼저 바다로 내보내세요.'); f.mission = a.mission; return { ok: true }; }
    case 'air': {
      const w = s.air.find(x => x.id === a.wing && x.owner === cid); if (!w) return fail('없는 비행단입니다.');
      if (a.base) { const st = s.regions[a.base]; if (!st || !(st.air > 0) || !friendly(s, cid, st.controller)) return fail('아군 비행장이 아닙니다.'); w.base = a.base; }
      if (a.mission) { if (!d.airMissions[a.mission]) return fail('없는 임무입니다.'); if (a.mission !== 'idle' && !d.airMissions[a.mission].types.includes(w.type)) return fail('이 기종이 할 수 없는 임무입니다.'); w.mission = a.mission; }
      if (a.zone !== undefined) w.zone = a.zone;
      if (w.mission !== 'idle' && !mil.wingInRange(s, d, w)) return { ok: true, warn: '작전 반경 밖이라 임무를 하지 않습니다.' };
      return { ok: true };
    }
    case 'airAssign': {
      if (!a.wing) return fail('없는 비행단입니다.');
      const w = s.air.find(x => x.id === a.wing && x.owner === cid); if (!w) return fail('없는 비행단입니다.');
      if (!c.stock[w.type] || a.n <= 0) return fail('재고가 없습니다.');
      const n = Math.min(c.stock[w.type], Math.round(a.n)); c.stock[w.type] -= n; w.count += n; return { ok: true, n };
    }
    case 'event': {
      const p = s.pending.find(x => x.event === a.event);
      if (!p) return fail('기다리는 사건이 아닙니다.');
      s.pending = s.pending.filter(x => x !== p);
      pol.resolveEvent(s, d, p.event, p.country, clamp(a.option | 0, 0, X.events.get(p.event).options.length - 1), log);
      return { ok: true };
    }
    default: return fail('알 수 없는 행동입니다.');
  }
}
export function buildReason(s, d, cid, a) {
  const X = index(d), r = X.regions.get(a.region), st = s.regions[a.region], c = s.countries[cid];
  if (!r || !st) return '없는 지역입니다.';
  if (st.controller !== cid) return '통제하는 지역에만 지을 수 있습니다.';
  if (st.owner !== cid) return '점령지에는 지을 수 없습니다.';
  if (r.offmap && c.homeLost) return '본국을 잃었습니다.';
  const queued = c.construction.filter(q => q.region === a.region && q.id === a.id).length;
  if ((a.kind || 'building') === 'facility') {
    const f = X.facilities.get(a.id); if (!f) return '없는 시설입니다.';
    if (r.offmap) return '지도 밖 본국에는 시설을 짓지 않습니다.';
    if (f.coastal && !r.coast.length) return '바다에 닿은 지역에만 지을 수 있습니다.';
    if (st[a.id] + queued >= f.max) return `최대 ${f.max}단계입니다.`;
    return '';
  }
  const b = X.buildings.get(a.id); if (!b) return '없는 건물입니다.';
  if (b.tech && !mods(s, d, c).buildingsUnlocked.has(a.id)) return '먼저 연구해야 합니다.';
  const have = (st.b[a.id]?.level || 0) + queued;
  if (b.res && have >= (r.res[b.res] || 0)) return r.res[b.res] ? `이 지역의 ${X.goods.get(b.res).name} 매장량 한도(${r.res[b.res]}단계)입니다.` : `이 지역에는 ${X.goods.get(b.res).name} 자원이 없습니다.`;
  if (b.cap === 'arable' && have >= Math.max(1, Math.round(r.pop / 18))) return '이 지역의 경지 한도입니다.';
  const slots = r.offmap ? 400 : Math.max(4, Math.round(4 + st.infra * 2 + r.pop / 40));
  const used = sum(Object.entries(st.b).filter(([k]) => ['civ', 'arms', 'dock', 'steel', 'tools', 'chem', 'light', 'refinery', 'synthetic'].includes(k)).map(([, v]) => v.level)) + c.construction.filter(q => q.region === a.region && q.kind !== 'facility' && !X.buildings.get(q.id).res && q.id !== 'farm').length;
  if (!b.res && b.id !== 'farm' && used >= slots) return `이 지역의 공장 터(${slots})가 다 찼습니다. 기반 시설을 늘리면 터가 생깁니다.`;
  if (b.id === 'dock' && !(st.port > 0) && !r.offmap) return '항구가 있어야 조선소를 지을 수 있습니다.';
  return '';
}

/* ---------- 하루 진행 ---------- */
export function advanceDay(s, d) {
  if (s.ended) return s;
  const log = logger(s), X = index(d);
  const live = Object.values(s.countries).filter(c => c.exists);
  if (isMonthStart(s.day)) {
    for (const c of live) { if (!c.econ) { econ.initEconomy(s, d, c.id); continue; } const R = econ.compute(s, d, c.id); econ.commit(s, d, c.id, R); }
    for (const c of live) if (c.id !== s.player || s.autoPlayer) ai.monthlyAI(s, d, c.id, a => dispatch(s, d, a, { silent: true }));
    snapshot(s, d);
  }
  wx.dailyWeather(s, d);
  pol.dailyPolitics(s, d, log);
  for (const c of Object.values(s.countries)) {
    if (!c.exists) continue;
    if (!c.econ) { econ.initEconomy(s, d, c.id); log(`${c.short}의 경제가 출범했습니다.`, c.id, 'info'); }
    const done = []; econ.dailyConstruction(s, d, c.id, done);
    if (c.id === s.player) for (const q of done) log(`준공: ${X.regions.get(q.region).name} ${q.kind === 'facility' ? X.facilities.get(q.id).name : X.buildings.get(q.id).name}`, c.id, 'build');
    econ.dailyProduction(s, d, c.id);
    const built = econ.dailyShipyard(s, d, c.id);
    if (built.length) { const m = {}; for (const k of built) m[k] = (m[k] || 0) + 1; pol.addShips(s, d, c.id, m); if (c.id === s.player) log(`진수: ${Object.entries(m).map(([k, n]) => `${X.ships.get(k).name} ${n}척`).join(', ')}`, c.id, 'naval'); }
    // 훈련
    for (const t of c.training) t.days += 1;
    for (const t of c.training.filter(t => t.days >= t.total)) {
      c.manpower.training -= t.manpower;
      const st = mil.templateStats(s, d, t.tpl, c.id);
      let fill = 1; for (const [e, q] of Object.entries(st.eq)) fill = Math.min(fill, (c.stock[e] || 0) / q);
      fill = clamp(fill, .3, 1);
      for (const [e, q] of Object.entries(st.eq)) c.stock[e] = Math.max(0, round((c.stock[e] || 0) - q * fill, 3));
      const at = s.regions[t.at] && s.regions[t.at].controller === c.id ? t.at : (c.mapCapital || c.capital);
      if (!s.regions[at] || !friendly(s, c.id, s.regions[at].controller)) continue;
      pol.spawnDivision(s, d, c.id, t.tpl, at, { str: fill, org: .5, exp: 0 });
      if (c.id === s.player) log(`훈련 완료: ${mil.templateOf(s, d, t.tpl).name}(${Math.round(fill * 100)}% 장비)`, c.id, 'military');
    }
    c.training = c.training.filter(t => t.days < t.total);
  }
  mil.dailyAir(s, d, log);
  mil.dailyNaval(s, d, log);
  if (s.day % 2 === 0) for (const c of live) if (c.exists && (c.id !== s.player || s.autoPlayer)) ai.militaryAI(s, d, c.id);
  mil.dailyMilitary(s, d, log);
  mil.dailyLeaders(s, d, log);
  s.day += 1;
  return s;
}
function snapshot(s, d) {
  const row = { day: s.day, c: {} };
  for (const c of Object.values(s.countries)) if (c.exists && c.econ && (c.playable || c.id === s.player)) row.c[c.id] = { gdp: round(c.econ.last?.gdp || 0, 1), arms: round(econ.armsCapacity(s, d, c.id), 1), divs: s.divisions.filter(x => x.owner === c.id).length, vp: pol.controlledVP(s, d, c.id) };
  s.history.push(row);
  if (s.history.length > 130) s.history.shift();
}

/* ---------- 저장 ---------- */
export function exportSave(s) { return JSON.stringify({ format: SAVE_FORMAT, version: SAVE_VERSION, savedAt: s.day, state: s }); }
export function importSave(text, d) {
  let o; try { o = JSON.parse(text); } catch { return { ok: false, reason: 'JSON이 아닙니다.' }; }
  if (!o || o.format !== SAVE_FORMAT) return { ok: false, reason: '이 게임의 저장 파일이 아닙니다.' };
  if (o.version !== SAVE_VERSION) return { ok: false, reason: `저장 형식 ${o.version}은(는) 지원하지 않습니다(현재 ${SAVE_VERSION}).` };
  const s = o.state;
  if (!s || typeof s.day !== 'number' || !s.countries || !s.regions || !Array.isArray(s.divisions)) return { ok: false, reason: '저장 내용이 손상되었습니다.' };
  for (const r of d.regions) if (!s.regions[r.id]) return { ok: false, reason: `지역 ${r.id}가 없습니다.` };
  for (const c of d.countries) if (!s.countries[c.id]) return { ok: false, reason: `나라 ${c.id}가 없습니다.` };
  if (!s.countries[s.player]) return { ok: false, reason: '플레이어 나라가 없습니다.' };
  return { ok: true, state: s };
}
export function summary(s, d, cid) {
  const c = s.countries[cid];
  return { date: fmtDate(s.day), pp: Math.floor(c.pp), stability: c.stability, warSupport: c.warSupport, manpower: mil.manpowerAvailable(s, d, cid), civ: levels(s, d, cid, 'civ'), arms: econ.armsCapacity(s, d, cid), docks: econ.dockCapacity(s, d, cid), fuel: c.rates.fuel, blockade: c.blockade, divisions: s.divisions.filter(x => x.owner === cid).length };
}
export function levels(s, d, cid, bid) { let n = 0; for (const r of econ.econRegions(s, d, cid)) n += s.regions[r.id].b[bid]?.level || 0; return n; }
