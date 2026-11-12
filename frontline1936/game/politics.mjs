/* 전선과 공장 — 정치·외교: 정치력, 안정도·전쟁 지지도, 국가 중점, 연구, 법, 사건, 전쟁과 강화, 진영, 항복, 수도 이전, 해방. */
import { clamp, round, sum, index, mods, dayOf, yearOf, atWar, enemiesOf, isAtWar, friendly, END_DAY } from './core.mjs';
import { templateStats } from './military.mjs';

/* ---------- 효과 ---------- */
export const capitalOf = (s, cid) => { const c = s.countries[cid]; return c.mapCapital || c.capital; };
function placeAt(s, d, cid, at) {
  const c = s.countries[cid];
  if (at === 'capital') return c.capital;
  return at;
}
let nextId = s => (s.seq = (s.seq || 0) + 1);
export function spawnDivision(s, d, cid, tpl, at, opts = {}) {
  const c = s.countries[cid], t = index(d).templates.get(tpl) || (s.templates || []).find(x => x.id === tpl);
  c.divCount = (c.divCount || 0) + 1;
  const dv = { id: `dv${nextId(s)}`, owner: cid, tpl, name: `${opts.prefix || ''}제${c.divCount}${t.name.includes('여단') ? '여단' : t.name.includes('대') && !t.name.includes('사단') ? '대' : '사단'}`, tplName: t.name, at, str: opts.str ?? 1, org: opts.org ?? 1, exp: opts.exp ?? .1, order: null, sup: 1 };
  s.divisions.push(dv);
  const st = templateStats(s, d, tpl, cid);
  if (st && opts.countManpower !== false) c.manpower.used += Math.round(st.manpower * dv.str);
  return dv;
}
export function addShips(s, d, cid, ships, name = '새 함선') {
  const c = s.countries[cid], X = index(d);
  const port = [c.mapCapital, c.capital, ...d.regions.filter(r => s.regions[r.id].controller === cid && s.regions[r.id].port > 0).sort((a, b) => s.regions[b.id].port - s.regions[a.id].port).map(r => r.id)].find(r => r && s.regions[r].controller === cid && (s.regions[r].port > 0 || X.regions.get(r).offmap));
  if (!port) return;
  let f = s.fleets.find(x => x.owner === cid && x.at === port && x.mission === 'port' && x.name === name);
  if (!f) { f = { id: `fl${nextId(s)}`, owner: cid, name, at: port, ships: {}, mission: 'port', path: [] }; s.fleets.push(f); }
  for (const [k, n] of Object.entries(ships)) f.ships[k] = (f.ships[k] || 0) + n;
}
export function applyFx(s, d, cid, fx, log, src = '') {
  const c = s.countries[cid], X = index(d);
  if (!c) return;
  for (const [k, v] of Object.entries(fx || {})) {
    switch (k) {
      case 'pp': c.pp = round(clamp(c.pp + v, 0, 2000), 2); break;
      case 'stability': c.stabBase = round(c.stabBase + v, 4); c.stability = round(clamp(c.stability + v, 0, 1), 4); break;
      case 'warSupport': c.wsBase = round(c.wsBase + v, 4); c.warSupport = round(clamp(c.warSupport + v, 0, 1), 4); break;
      case 'spirit': if (!c.spirits.includes(v)) c.spirits.push(v); break;
      case 'removeSpirit': c.spirits = c.spirits.filter(x => x !== v); break;
      case 'research': c.research.bonuses.push({ ...v }); break;
      case 'build': for (const [b, n, at] of v) { const r = placeAt(s, d, cid, at), st = s.regions[r]; if (!st || !friendly(s, cid, st.controller)) continue; const x = st.b[b] || (st.b[b] = { level: 0, pm: 0, staff: .6 }); x.level += n; } break;
      case 'facility': for (const [f, n, at] of v) { const r = placeAt(s, d, cid, at), st = s.regions[r]; if (!st || !n) continue; const def = X.facilities.get(f); if (def.coastal && !(X.regions.get(r).coast || []).length) continue; st[f] = Math.min(def.max, st[f] + n); } break;
      case 'divisions': for (const [t, n, at] of v) { const r = placeAt(s, d, cid, at); if (!s.regions[r] || !friendly(s, cid, s.regions[r].controller)) continue; for (let i = 0; i < n; i++) spawnDivision(s, d, cid, t, r); } break;
      case 'equipment': for (const [e, n] of Object.entries(v)) c.stock[e] = (c.stock[e] || 0) + n; break;
      case 'manpower': c.manpower.bonus = (c.manpower.bonus || 0) + v * 1000; break;
      case 'popularity': for (const [id, x] of Object.entries(v)) c.popularity[id] = Math.max(0, c.popularity[id] + x * 100); { const t = sum(Object.values(c.popularity)); for (const id of Object.keys(c.popularity)) c.popularity[id] = round(c.popularity[id] * 100 / t, 2); } break;
      case 'faction': { const [mode, fid] = v.split(':'); setFaction(s, d, cid, fid, mode === 'create', log); break; }
      case 'join': setFaction(s, d, cid, v, false, log); break;
      case 'leaveFaction': c.faction = null; break;
      case 'wargoal': for (const t of v) if (!c.wargoals.includes(t)) c.wargoals.push(t); break;
      case 'war': declareWar(s, d, v[0], v[1], log, { forced: true }); break;
      case 'peace': makePeace(s, d, v[0], v[1], log); break;
      case 'nap': { const [a, b] = v; for (const [x, y] of [[a, b], [b, a]]) if (!s.countries[x].naps.includes(y)) s.countries[x].naps.push(y); break; }
      case 'embargo': for (const b of v.by) if (!s.countries[v.on].embargoedBy.includes(b)) s.countries[v.on].embargoedBy.push(b); break;
      case 'liftEmbargo': s.countries[v].embargoedBy = []; break;
      case 'access': { const [g, to] = v; if (!s.countries[g].access.includes(to)) s.countries[g].access.push(to); break; }
      case 'puppet': { const [p, o] = v; s.countries[p].overlord = o; break; }
      case 'annex': for (const x of v) annex(s, d, cid, x, log); break;
      case 'homelandLost': homelandLost(s, d, v, log); break;
      case 'ideology': c.ideology = v; break;
      case 'rename': c.name = v; c.short = v.replace(/ .*/, '') || c.short; break;
      case 'removeDivisions': { let n = v.n; for (const dv of [...s.divisions]) { if (n <= 0) break; if (dv.owner === cid && v.from.includes(dv.at)) { s.divisions = s.divisions.filter(x => x !== dv); c.manpower.used = Math.max(0, c.manpower.used - Math.round((templateStats(s, d, dv.tpl, cid)?.manpower || 0) * dv.str)); n--; } } break; }
      case 'flag': s.flags[v] = s.day; break;
      case 'event': fireEvent(s, d, v, null, log); break;
      case 'tech': for (const t of v) if (!c.research.done.includes(t)) c.research.done.push(t); break;
      case 'ships': addShips(s, d, cid, v, '증강 함대'); break;
      case 'joinWarsOf': for (const e of enemiesOf(s, v)) declareWar(s, d, cid, e, log, { forced: true, quiet: true }); break;
      case 'others': for (const [o, sub] of Object.entries(v)) if (s.countries[o] && s.countries[o].exists) applyFx(s, d, o, sub, log, src); break;
      case 'endGame': s.ended = { reason: v, day: s.day }; break;
      default: break;
    }
  }
}
function setFaction(s, d, cid, fid, create, log) {
  const c = s.countries[cid];
  c.faction = fid;
  const f = s.factions[fid];
  if (f && (create || !f.leader || !s.countries[f.leader].exists || s.countries[f.leader].faction !== fid)) f.leader = cid;
  log(`${c.short}이(가) ${d.factions.find(x => x.id === fid).name} 진영에 들어갔습니다.`, cid, 'diplomacy');
}

/* ---------- 전쟁과 강화 ---------- */
export function sideOf(s, d, cid, against) {
  const out = new Set([cid]);
  const c = s.countries[cid];
  for (const o of Object.values(s.countries)) if (o.exists && o.overlord === cid) out.add(o.id);
  if (c.overlord && s.countries[c.overlord].exists) { out.add(c.overlord); for (const o of Object.values(s.countries)) if (o.exists && o.overlord === c.overlord) out.add(o.id); }
  if (c.faction) for (const o of Object.values(s.countries)) if (o.exists && o.faction === c.faction) out.add(o.id);
  // 국공 합작·군벌 협약: 일본에 맞설 때만 함께 싸운다
  if (against === 'japan' || against === 'manchukuo') {
    if (['china', 'ccp'].includes(cid) && s.flags.united_front) { out.add('china'); out.add('ccp'); }
    if (cid === 'china' && s.flags.warlord_pact) for (const w of ['shanxi', 'guangxi', 'yunnan', 'ma']) if (s.countries[w].exists) out.add(w);
  }
  return [...out].filter(id => s.countries[id].exists);
}
export function canDeclare(s, d, a, b) {
  const A = s.countries[a], B = s.countries[b], M = mods(s, d, A);
  if (!B || !B.exists || a === b) return '대상이 없습니다.';
  if (atWar(s, a, b)) return '이미 전쟁 중입니다.';
  if (M.noWar) return '고립주의 여론 때문에 먼저 전쟁을 선포할 수 없습니다.';
  if (A.overlord) return '괴뢰국은 스스로 전쟁을 선포할 수 없습니다.';
  if (friendly(s, a, b) && (A.faction && A.faction === B.faction)) return '같은 진영입니다.';
  if (A.naps.includes(b)) return '불가침 조약이 있습니다.';
  if (!A.wargoals.includes(b)) return '이 나라에 대한 전쟁 명분이 없습니다(외교 창에서 정당화).';
  return '';
}
export function declareWar(s, d, a, b, log, { forced = false, quiet = false } = {}) {
  if (!forced && canDeclare(s, d, a, b)) return false;
  const A = sideOf(s, d, a, b), B = sideOf(s, d, b, a);
  const added = [];
  for (const x of A) for (const y of B) {
    if (x === y || atWar(s, x, y)) continue;
    if (A.includes(y) || B.includes(x)) continue;
    s.wars.push([x, y]); added.push([x, y]);
  }
  for (const c of [a, ...A, b, ...B]) { const C = s.countries[c]; if (C.naps.includes(a) || C.naps.includes(b)) C.naps = C.naps.filter(z => z !== a && z !== b); }
  if (!added.length) return false;
  s.countries[b].wsBase = round(s.countries[b].wsBase + .1, 4);
  if (!quiet) log(`${s.countries[a].short}이(가) ${s.countries[b].short}에 전쟁을 선포했습니다.`, a, 'war', { target: b });
  if (b === 'usa' && a === 'japan') fireEvent(s, d, 'ev_pearl_harbor', null, log);
  if (B.includes('usa') && !s.flags.us_at_war) { s.flags.us_at_war = s.day; const U = s.countries.usa; U.spirits = U.spirits.filter(x => x !== 'isolationism'); }
  return true;
}
export function makePeace(s, d, a, b, log) {
  const before = s.wars.length;
  s.wars = s.wars.filter(w => !((w[0] === a && w[1] === b) || (w[0] === b && w[1] === a)));
  if (s.wars.length < before) log(`${s.countries[a].short}과(와) ${s.countries[b].short}이(가) 전쟁을 멈췄습니다.`, a, 'diplomacy');
}
function annex(s, d, by, who, log) {
  const W = s.countries[who]; if (!W || !W.exists) return;
  for (const r of d.regions) { const st = s.regions[r.id]; if (st.owner === who) st.owner = by; if (st.controller === who) st.controller = by; }
  for (const dv of s.divisions) if (dv.owner === who) dv.owner = by;
  for (const f of s.fleets) if (f.owner === who) f.owner = by;
  for (const w of s.air) if (w.owner === who) w.owner = by;
  W.exists = false;
  s.wars = s.wars.filter(w => w[0] !== who && w[1] !== who);
  log(`${W.short}이(가) ${s.countries[by].short}에 합쳐졌습니다.`, by, 'diplomacy');
}
function homelandLost(s, d, cid, log) {
  const c = s.countries[cid];
  c.homeLost = true;
  const home = d.regions.find(r => r.offmap && r.owner === cid);
  if (home) { s.divisions = s.divisions.filter(dv => dv.at !== home.id); s.fleets = s.fleets.filter(f => f.at !== home.id); s.air = s.air.filter(w => w.base !== home.id); }
  if (home && c.capital === home.id) c.capital = c.mapCapital;
  log(`${c.short}의 본국이 유럽에서 점령되었습니다.`, cid, 'diplomacy');
}

/* ---------- 승점·항복·수도 ---------- */
export function vpOf(s, d, cid) {
  let own = 0, held = 0;
  for (const r of d.regions) { if (r.offmap) continue; const st = s.regions[r.id]; if (st.owner !== cid) continue; own += r.vp; if (friendly(s, cid, st.controller)) held += r.vp; }
  return { own, held };
}
export function controlledVP(s, d, cid) { let v = 0; for (const r of d.regions) if (!r.offmap && s.regions[r.id].controller === cid) v += r.vp; return v; }
function checkCapitals(s, d, log) {
  for (const c of Object.values(s.countries)) {
    if (!c.exists) continue;
    const mc = c.mapCapital || c.capital;
    if (index(d).regions.get(mc).offmap) continue;
    if (friendly(s, c.id, s.regions[mc].controller)) continue;
    const cand = d.regions.filter(r => !r.offmap && s.regions[r.id].owner === c.id && s.regions[r.id].controller === c.id).sort((a, b) => (b.id === 'chongqing' && s.flags.chongqing_ready ? 100 : 0) - (a.id === 'chongqing' && s.flags.chongqing_ready ? 100 : 0) || b.vp - a.vp || b.pop - a.pop);
    if (!cand.length) continue;
    const to = cand[0].id;
    if (c.mapCapital) c.mapCapital = to; if (!index(d).regions.get(c.capital).offmap) c.capital = to;
    c.stabBase = round(c.stabBase - .03, 4);
    log(`${c.short}의 정부가 ${cand[0].name}(으)로 옮겨 갔습니다.`, c.id, 'capital');
  }
}
function checkCapitulation(s, d, log) {
  for (const c of Object.values(s.countries)) {
    if (!c.exists || !isAtWar(s, c.id)) continue;
    const hasHome = d.regions.some(r => r.offmap && r.owner === c.id) && !c.homeLost;
    const { own, held } = vpOf(s, d, c.id);
    const anyLand = d.regions.some(r => s.regions[r.id].controller === c.id && !(r.offmap && c.homeLost));
    if (hasHome && anyLand) continue;
    if (own > 0 && held / own > .28 && anyLand) continue;
    capitulate(s, d, c.id, log);
  }
}
export function capitulate(s, d, cid, log) {
  const c = s.countries[cid], foes = enemiesOf(s, cid);
  c.capitulated = s.day;
  for (const r of d.regions) { const st = s.regions[r.id]; if (st.owner === cid && st.controller !== cid && foes.includes(st.controller)) st.owner = st.controller; }
  s.divisions = s.divisions.filter(dv => !(dv.owner === cid && !friendly(s, cid, s.regions[dv.at]?.controller ?? cid)));
  s.wars = s.wars.filter(w => w[0] !== cid && w[1] !== cid);
  for (const o of Object.values(s.countries)) if (o.overlord === cid && o.exists) { s.wars = s.wars.filter(w => w[0] !== o.id && w[1] !== o.id); }
  const still = d.regions.some(r => s.regions[r.id].controller === cid || s.regions[r.id].owner === cid);
  if (!still) { c.exists = false; s.divisions = s.divisions.filter(dv => dv.owner !== cid); s.fleets = s.fleets.filter(f => f.owner !== cid); s.air = s.air.filter(w => w.owner !== cid); }
  log(`${c.short}이(가) 항복했습니다.`, cid, 'capitulation');
  if (cid === 'japan') { s.flags.japan_surrender = s.day; liberateKorea(s, d, log, true); }
  if (cid === s.player) s.ended = { reason: 'player_capitulated', day: s.day };
}
function liberateKorea(s, d, log, all) {
  const K = s.countries.korea; if (!K || K.exists) return;
  const def = d.countries.find(c => c.id === 'korea');
  const regs = def.cores.filter(r => all || atWar(s, 'japan', s.regions[r].controller) || s.regions[r].owner !== 'japan');
  if (!regs.length) return;
  K.exists = true;
  for (const r of regs) { s.regions[r].owner = 'korea'; s.regions[r].controller = 'korea'; }
  for (const dv of s.divisions) if (regs.includes(dv.at) && dv.owner === 'japan') dv.str = 0;
  K.capital = regs.includes('gyeongseong') ? 'gyeongseong' : regs[0]; K.mapCapital = K.capital;
  s.flags.korea_liberated = s.day;
  log('조선이 일본의 식민 통치에서 해방되었습니다.', 'korea', 'liberation');
  notify(s, 'korea_liberation');
}
const notify = (s, id) => { s.notices.push({ id, day: s.day }); };

/* ---------- 사건 ---------- */
export function condOk(s, d, cid, cond) {
  if (!cond) return true;
  const c = s.countries[cid];
  if (!c || !c.exists) return false;
  if (cond.year && yearOf(s.day) < cond.year) return false;
  if (cond.atWar && !isAtWar(s, cid)) return false;
  if (cond.war) { const [a, b] = Array.isArray(cond.war) ? cond.war : [cid, cond.war]; if (!atWar(s, a, b)) return false; }
  if (cond.notWar && atWar(s, cid, cond.notWar)) return false;
  if (cond.flag && !s.flags[cond.flag]) return false;
  if (cond.notFlag && s.flags[cond.notFlag]) return false;
  if (cond.controls && !cond.controls.every(r => s.regions[r].controller === cid)) return false;
  return true;
}
export function fireEvent(s, d, id, to, log) {
  const ev = index(d).events.get(id); if (!ev) return;
  const cid = to || ev.to, c = s.countries[cid];
  if (s.fired[id] !== undefined && !ev.repeat) return;
  if (!c || !c.exists) { s.fired[id] = s.day; return; }
  s.fired[id] = s.day;
  if (cid === s.player && !s.autoPlayer) { s.pending.push({ event: id, country: cid, day: s.day }); return; }
  const best = ev.options.reduce((a, o, i) => (o.ai ?? 1) > (ev.options[a].ai ?? 1) ? i : a, 0);
  resolveEvent(s, d, id, cid, best, log);
}
export function resolveEvent(s, d, id, cid, opt, log) {
  const ev = index(d).events.get(id), o = ev.options[opt];
  applyFx(s, d, cid, o.fx, log, id);
  log(`${ev.title}: ${o.name}`, cid, 'event', { event: id });
}
function checkEvents(s, d, log) {
  for (const ev of d.events) {
    if (!ev.date || s.fired[ev.id] !== undefined) continue;
    if (s.day < dayOf(ev.date)) continue;
    if (!condOk(s, d, ev.to, ev.cond)) { if (s.day > dayOf(ev.date) + 400) s.fired[ev.id] = -1; continue; }
    fireEvent(s, d, ev.id, null, log);
  }
}

/* ---------- 국가 중점 ---------- */
export const treeOf = (d, cid) => d.focusTrees[cid] || d.focusTrees.generic;
export function focusReason(s, d, cid, id) {
  const c = s.countries[cid], f = index(d).focus.get(id), tree = treeOf(d, cid);
  if (!f || !tree.includes(f)) return '이 나라의 국가 중점이 아닙니다.';
  if (c.focus.done.includes(id)) return '이미 마쳤습니다.';
  if (c.focus.current) return '다른 중점을 진행 중입니다.';
  if (f.req) { const any = f.req.includes('|'), list = f.req.split(/[,|]/); const ok = any ? list.some(x => c.focus.done.includes(x)) : list.every(x => c.focus.done.includes(x)); if (!ok) return '앞선 중점을 먼저 마쳐야 합니다.'; }
  for (const x of f.excl.split(',').filter(Boolean)) if (c.focus.done.includes(x) || c.focus.current === x) return '함께 고를 수 없는 중점을 이미 골랐습니다.';
  for (const g of tree) if (g.excl.split(',').includes(id) && (c.focus.done.includes(g.id))) return '함께 고를 수 없는 중점을 이미 골랐습니다.';
  if (!condOk(s, d, cid, f.need)) return needText(f.need);
  return '';
}
export function needText(n) {
  const out = [];
  if (n.year) out.push(`${n.year}년 이후`); if (n.atWar) out.push('전쟁 중'); if (n.war) out.push('특정 나라와 전쟁 중'); if (n.flag) out.push('앞선 사건이 일어난 뒤'); if (n.controls) out.push('필요한 지역을 통제할 때');
  return out.length ? `조건: ${out.join(', ')}` : '';
}
export function startFocus(s, d, cid, id) {
  const why = focusReason(s, d, cid, id); if (why) return why;
  const c = s.countries[cid]; c.focus.current = id; c.focus.progress = 0; return '';
}

/* ---------- 연구 ---------- */
export function techCost(s, d, cid, t) {
  const c = s.countries[cid], y = yearOf(s.day), ahead = Math.max(0, t.year - y);
  const bonus = Math.max(0, ...c.research.bonuses.filter(b => b.cat === t.cat && b.uses > 0).map(b => b.bonus), 0);
  const M = mods(s, d, c);
  return round(t.days * (1 + .5 * ahead) / (1 + bonus) / Math.max(.5, 1 + M.research + (index(d).lawOption.get(c.laws.trade).fx.research || 0)), 2);
}
export function techReason(s, d, cid, id) {
  const c = s.countries[cid], t = index(d).techs.get(id);
  if (!t) return '없는 기술입니다.';
  if (c.research.done.includes(id)) return '이미 연구했습니다.';
  if (c.research.slots.some(x => x && x.tech === id)) return '이미 연구 중입니다.';
  if ((t.req || []).some(q => !c.research.done.includes(q))) return '선행 기술이 필요합니다.';
  if (t.excl) { const other = d.techs.find(x => x.excl === t.excl && x.id !== id && (c.research.done.includes(x.id) || c.research.slots.some(z => z && z.tech === x.id))); if (other) return `같은 계열에서 이미 ${other.name}을(를) 골랐습니다.`; }
  return '';
}
export function startResearch(s, d, cid, slot, id) {
  const why = techReason(s, d, cid, id); if (why) return why;
  const c = s.countries[cid]; if (slot < 0 || slot >= c.research.slots.length) return '없는 연구 칸입니다.';
  c.research.slots[slot] = { tech: id, progress: 0, cost: techCost(s, d, cid, index(d).techs.get(id)) };
  return '';
}

/* ---------- 법·정당화·진영 ---------- */
export function lawReason(s, d, cid, group, id) {
  const c = s.countries[cid], g = d.laws[group], o = g && g.options.find(x => x.id === id);
  if (!o) return '없는 법입니다.';
  if (c.laws[group] === id) return '이미 시행 중입니다.';
  if (c.pp < o.pp) return `정치력이 ${o.pp} 필요합니다.`;
  if (o.need?.warSupport && c.warSupport * 100 < o.need.warSupport) return `전쟁 지지도 ${o.need.warSupport}% 이상이어야 합니다.`;
  if (o.need?.atWar && !isAtWar(s, cid)) return '전쟁 중이어야 합니다.';
  return '';
}
export function setLaw(s, d, cid, group, id) { const why = lawReason(s, d, cid, group, id); if (why) return why; const c = s.countries[cid]; c.pp = round(c.pp - d.laws[group].options.find(x => x.id === id).pp, 2); c.laws[group] = id; return ''; }
export function justifyReason(s, d, cid, target) {
  const c = s.countries[cid], T = s.countries[target], M = mods(s, d, c);
  if (!T || !T.exists || target === cid) return '대상이 없습니다.';
  if (M.noWar) return '고립주의 여론 때문에 전쟁 명분을 만들 수 없습니다.';
  if (c.overlord) return '괴뢰국은 할 수 없습니다.';
  if (c.wargoals.includes(target)) return '이미 명분이 있습니다.';
  if (c.justifying.some(j => j.target === target)) return '이미 정당화 중입니다.';
  if (c.naps.includes(target)) return '불가침 조약이 있습니다.';
  if (c.faction && c.faction === T.faction) return '같은 진영입니다.';
  if (c.pp < 50) return '정치력이 50 필요합니다.';
  return '';
}
export function justify(s, d, cid, target) { const why = justifyReason(s, d, cid, target); if (why) return why; const c = s.countries[cid]; c.pp -= 50; c.justifying.push({ target, days: 45 }); return ''; }
export function factionFor(c) { return c.ideology === 'democracy' ? 'allies' : c.ideology === 'communism' ? 'comintern' : c.ideology === 'authoritarian' ? 'axis' : null; }
export function joinReason(s, d, cid) {
  const c = s.countries[cid], fid = factionFor(c);
  if (!fid) return '비동맹 정부는 진영에 들어가지 않습니다.';
  if (c.faction) return '이미 진영에 있습니다.';
  if (c.overlord) return '괴뢰국은 종주국을 따릅니다.';
  const f = s.factions[fid];
  if (!Object.values(s.countries).some(o => o.exists && o.faction === fid)) return '';
  if (Object.values(s.countries).some(o => o.exists && o.faction === fid && atWar(s, cid, o.id))) return '진영의 나라와 전쟁 중입니다.';
  if (c.warSupport < .3) return '전쟁 지지도 30% 이상이어야 합니다.';
  return '';
}

/* ---------- 하루 진행 ---------- */
export function dailyPolitics(s, d, log) {
  for (const c of Object.values(s.countries)) {
    if (!c.exists) continue;
    const M = mods(s, d, c), war = isAtWar(s, c.id);
    c.pp = round(clamp(c.pp + Math.max(.1, c.ppBase + M.pp), 0, 2000), 3);
    // 안정도·전쟁 지지도: 목표를 향해 천천히
    const losses = (c.casualties || 0) / Math.max(1, popOf(s, d, c.id) * 1e5);
    const lawStab = sum(Object.values(c.laws).map(id => index(d).lawOption.get(id)?.fx.stability || 0));
    const sTarget = clamp(c.stabBase + M.stability + lawStab - (war ? clamp(losses * 20, 0, .2) : 0) - (c.econ?.debt > (c.econ?.last?.gdp || 1) * 24 ? .1 : 0), 0, 1);
    const wTarget = clamp(Math.min(c.wsBase + M.warSupport + (war ? .05 : 0), M.warSupportCap / 100), 0, 1);
    c.stability = round(c.stability + clamp(sTarget - c.stability, -.003, .003), 4);
    c.warSupport = round(c.warSupport + clamp(wTarget - c.warSupport, -.003, .003), 4);
    // 국가 중점
    if (c.focus.current) {
      c.focus.progress += 1;
      const f = index(d).focus.get(c.focus.current);
      if (c.focus.progress >= f.days) {
        c.focus.done.push(f.id); c.focus.current = null; c.focus.progress = 0;
        applyFx(s, d, c.id, f.fx, log, f.id);
        if (c.id === s.player || c.playable) log(`국가 중점 완료: ${f.name}`, c.id, 'focus', { focus: f.id });
      }
    }
    // 연구
    for (let i = 0; i < c.research.slots.length; i++) {
      const sl = c.research.slots[i]; if (!sl) continue;
      sl.progress += 1;
      if (sl.progress >= sl.cost) {
        const t = index(d).techs.get(sl.tech);
        c.research.done.push(t.id); c.research.slots[i] = null;
        const b = c.research.bonuses.find(x => x.cat === t.cat && x.uses > 0); if (b) b.uses -= 1;
        c.research.bonuses = c.research.bonuses.filter(x => x.uses > 0);
        if (c.id === s.player) log(`연구 완료: ${t.name}`, c.id, 'research', { tech: t.id });
      }
    }
    // 전쟁 명분 정당화
    for (const j of c.justifying) j.days -= 1;
    for (const j of c.justifying.filter(j => j.days <= 0)) { c.wargoals.push(j.target); if (c.id === s.player || c.playable) log(`${s.countries[j.target].short}에 대한 전쟁 명분을 얻었습니다.`, c.id, 'diplomacy'); }
    c.justifying = c.justifying.filter(j => j.days > 0);
  }
  checkEvents(s, d, log);
  checkCapitals(s, d, log);
  if (s.day % 3 === 0) checkCapitulation(s, d, log);
  // 한국 해방(카이로 선언 뒤 조선의 지역을 일본의 적이 차지했을 때)
  if (s.flags.cairo && !s.flags.korea_liberated && s.countries.korea && d.countries.find(c => c.id === 'korea').cores.some(r => s.regions[r].owner === 'japan' && atWar(s, 'japan', s.regions[r].controller))) liberateKorea(s, d, log, false);
  if (s.day >= END_DAY && !s.ended) s.ended = { reason: 'time', day: s.day };
  if (s.flags.japan_surrender && !s.ended) s.ended = { reason: 'japan_surrender', day: s.day };
}
export function popOf(s, d, cid) { let p = 0; for (const r of d.regions) if (s.regions[r.id].owner === cid) p += r.pop; return p; }
