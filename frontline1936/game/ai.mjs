/* 전선과 공장 — 컴퓨터가 맡은 나라의 판단. 결정적이며(상태의 난수만 쓴다) 사람에게 주어진 것과 같은 행동만 쓴다. */
import { clamp, round, sum, index, mods, distance, yearOf, dayOf, atWar, enemiesOf, isAtWar, friendly, rand, pairKey } from './core.mjs';
import { armsCapacity, dockCapacity, lineFactories, econRegions } from './economy.mjs';
import { divisionStats, templateStats, orderMove, orderAttack, orderInvade, canInvade, passable, hostile, wingInRange, fleetStrength, orderFleet, seaShare, formArmy, freeLeaders, assignAdmiral, leaderAvailable } from './military.mjs';
import { focusReason, startFocus, techReason, startResearch, treeOf, setLaw, lawReason, declareWar, canDeclare } from './politics.mjs';
import { manpowerAvailable as mpAvail, computeSupply, supplyInfo, supplyToday } from './military.mjs';
import { linksAt, railReason, railLevel } from './transport.mjs';

/* ---------- 매달: 경제·연구·중점·법·모집 ---------- */
export function monthlyAI(s, d, cid, act) {
  const c = s.countries[cid], X = index(d), war = isAtWar(s, cid);
  // 국가 중점
  if (!c.focus.current) {
    const order = d.aiFocusOrder[cid] || treeOf(d, cid).map(f => f.id);
    for (const id of [...order, ...treeOf(d, cid).map(f => f.id)]) if (!focusReason(s, d, cid, id)) { startFocus(s, d, cid, id); break; }
  }
  // 연구
  const prio = war ? ['infantry', 'artillery', 'land_doctrine', 'air', 'industry', 'armor', 'naval', 'naval_doctrine', 'air_doctrine'] : ['industry', 'infantry', 'artillery', 'land_doctrine', 'air', 'naval', 'armor', 'naval_doctrine', 'air_doctrine'];
  const naval = ['japan', 'usa', 'uk'].includes(cid);
  for (let i = 0; i < c.research.slots.length; i++) {
    if (c.research.slots[i]) continue;
    const opts = d.techs.filter(t => !techReason(s, d, cid, t.id)).sort((a, b) => (a.year - b.year) * 3 + (prio.indexOf(a.cat) - prio.indexOf(b.cat)) * (naval && a.cat.startsWith('naval') ? .2 : 1) - ((naval && b.cat.startsWith('naval') ? .2 : 1) - 1));
    if (opts.length) startResearch(s, d, cid, i, opts[0].id);
  }
  // 법
  if (war) for (const [g, ids] of [['economy', ['partial_mobilization', 'war_economy', 'total_war']], ['conscription', ['extensive', 'service', 'total']]]) {
    const cur = d.laws[g].options.findIndex(o => o.id === c.laws[g]);
    for (const id of ids) { const i = d.laws[g].options.findIndex(o => o.id === id); if (i > cur && !lawReason(s, d, cid, g, id)) { setLaw(s, d, cid, g, id); break; } }
  } else if (yearOf(s.day) >= 1938 && c.laws.economy === 'civilian' && !lawReason(s, d, cid, 'economy', 'early_mobilization') && !mods(s, d, c).noWar) setLaw(s, d, cid, 'economy', 'early_mobilization');
  // 건설
  aiLogistics(s, d, cid, act);
  aiConstruction(s, d, cid, act);
  // 생산 라인
  aiProduction(s, d, cid);
  // 조선
  if (dockCapacity(s, d, cid) >= 1 && c.naval.length < 3) {
    const docks = Math.round(dockCapacity(s, d, cid));
    const want = war ? (naval ? ['destroyer', 'submarine', 'carrier', 'cruiser'] : ['submarine', 'destroyer']) : naval ? ['destroyer', 'cruiser', 'carrier', 'battleship'] : ['destroyer'];
    const ship = want[(c.naval.length + Math.floor(s.day / 30)) % want.length];
    act({ type: 'shipyard', country: cid, ship, docks: Math.max(1, Math.round(docks / 2)), count: 3 });
  }
  // 모집
  const divs = s.divisions.filter(x => x.owner === cid).length, training = c.training.length;
  const tpl = bestTemplate(s, d, cid);
  let target = Math.round(6 + armsCapacity(s, d, cid) * (war ? 2.2 : 1.4) + (war ? 6 : 0));
  // 공업이 약하고 사람이 많은 나라(국민정부·군벌 등)는 전쟁 중 재고 장비로 채울 수 있는 만큼 더 모은다(대중 동원)
  if (war && tpl && armsCapacity(s, d, cid) < 15) {
    const need = templateStats(s, d, tpl, cid).eq;
    const fromStock = Math.floor(Math.min(...Object.entries(need).map(([e, q]) => (c.stock[e] || 0) / Math.max(1, q))) * .6);
    target = Math.max(target + Math.min(24, fromStock), Math.round(frontRegions(s, d, cid).length * 2.5));
  }
  const mass = war && armsCapacity(s, d, cid) < 15;
  if (tpl && divs + training < target) {
    const st = templateStats(s, d, tpl, cid), avail = mpAvail(s, d, cid);
    const n = Math.min(mass ? 6 : 3, target - divs - training, Math.floor(avail / Math.max(1, st.manpower)));
    for (let i = 0; i < n; i++) act({ type: 'train', country: cid, tpl, at: c.mapCapital || c.capital });
  }
  aiAir(s, d, cid);
  aiNavy(s, d, cid);
  aiLeaders(s, d, cid);
}
export function bestTemplate(s, d, cid) {
  const own = d.templates.filter(t => t.country === cid).concat((s.templates || []).filter(t => t.owner === cid));
  const list = own.length ? own : d.templates.filter(t => t.country === '*');
  let best = null, bv = -1;
  for (const t of list) { const st = templateStats(s, d, t.id, cid); if (!st) continue; const v = (st.soft + st.def * .5 + st.hp) / Math.max(1, st.manpower / 1000); if (v > bv && !t.id.includes('garrison') && t.id !== 'kla') { bv = v; best = t.id; } }
  return best || list[0]?.id;
}
/** 전쟁 중 보급: 사단이 몰린 철도 위 지역에 보급 거점을, 보급이 모자란 곳으로 가는 노선의 등급을 올린다(한 달에 각각 하나). */
function aiLogistics(s, d, cid, act) {
  const c = s.countries[cid], X = index(d);
  if (!isAtWar(s, cid) || c.construction.filter(q => q.kind === 'rail' || q.id === 'hub').length >= 2) return;
  const count = new Map(); for (const dv of s.divisions) if (dv.owner === cid && X.regions.has(dv.at) && !X.regions.get(dv.at).offmap) count.set(dv.at, (count.get(dv.at) || 0) + 1);
  if (!count.size) return;
  const SUP = computeSupply(s, d);
  const spots = [...count].map(([rid, n]) => ({ rid, n, ...supplyInfo(s, d, cid, rid, SUP) })).filter(x => s.regions[x.rid].controller === cid).sort((a, b) => a.ratio - b.ratio || b.n - a.n || (a.rid < b.rid ? -1 : 1));
  const hub = spots.find(x => x.n >= 3 && !x.hub && x.ratio < .95 && !c.construction.some(q => q.id === 'hub' && q.region === x.rid) && linksAt(s, d, x.rid).some(L => L.kind === 'rail'));
  const front = r => { if (r && r.ok && c.construction.length > 1) c.construction.unshift(c.construction.pop()); }; // 보급 사업은 대기열 맨 앞으로
  if (hub) front(act({ type: 'build', country: cid, id: 'hub', kind: 'facility', region: hub.rid }));
  for (const x of spots.filter(x => x.ratio < .8)) {
    // 이 지역에서 보급이 가장 많은 이웃 쪽으로 철도를 놓거나 올린다
    const nb = X.regions.get(x.rid).adj.filter(n => s.regions[n].controller === cid && !railReason(s, d, cid, x.rid, n)).sort((a, b) => ((SUP[cid].get(b) || 0) - (SUP[cid].get(a) || 0)) || (a < b ? -1 : 1));
    const pick = nb.find(n => { const lv = railLevel(s, d, x.rid, n).lvl; return lv < 3 && (lv > 0 || linksAt(s, d, n).some(L => L.kind === 'rail')); });
    if (pick) { front(act({ type: 'buildRail', country: cid, from: x.rid, to: pick })); break; }
  }
}
function aiConstruction(s, d, cid, act) {
  const c = s.countries[cid], X = index(d), war = isAtWar(s, cid);
  if (c.construction.length >= Math.max(2, Math.round(c.rates.points * 30 / 25))) return;
  const regs = econRegions(s, d, cid).filter(r => s.regions[r.id].owner === cid);
  if (!regs.length) return;
  const short = g => c.econ.short[g] || 0, price = g => c.econ.prices[g] / X.goods.get(g).price;
  const opts = [];
  for (const r of regs) {
    const st = s.regions[r.id], lv = b => (st.b[b]?.level || 0) + c.construction.filter(q => q.region === r.id && q.id === b).length;
    for (const res of ['coal', 'iron', 'oil', 'rubber', 'rare']) if ((r.res[res] || 0) > lv(res)) opts.push({ id: res, region: r.id, v: 1.2 * price(res) + 2 * short(res) + (res === 'oil' ? .6 : 0) });
    const base = r.offmap ? 1.3 : 1;
    opts.push({ id: 'civ', region: r.id, v: base * (yearOf(s.day) < 1939 && !war ? 1.5 : .5) + st.infra * .05 });
    opts.push({ id: 'arms', region: r.id, v: base * (war ? 1.6 : yearOf(s.day) >= 1938 ? 1.1 : .5) + st.infra * .05 });
    if (price('steel') > 1.15 || short('steel') > 0) opts.push({ id: 'steel', region: r.id, v: price('steel') + short('steel') * 2 });
    if (price('tools') > 1.15 || short('tools') > 0) opts.push({ id: 'tools', region: r.id, v: price('tools') + short('tools') * 2 });
    if (price('fuel') > 1.2 || short('fuel') > 0) { if (lv('refinery') < (r.res.oil || 0) + 1) opts.push({ id: 'refinery', region: r.id, v: price('fuel') + short('fuel') * 2 }); if (mods(s, d, c).buildingsUnlocked.has('synthetic')) opts.push({ id: 'synthetic', region: r.id, v: price('fuel') + short('fuel') * 2 - .3 }); }
    if (price('consumer') > 1.3 || price('textiles') > 1.3) opts.push({ id: 'light', region: r.id, v: (price('consumer') + price('textiles')) / 2 });
    if (price('grain') > 1.3 && !r.offmap && lv('farm') < Math.max(2, r.pop / 20)) opts.push({ id: 'farm', region: r.id, v: price('grain') });
    if (!r.offmap && st.infra < 5 && r.vp >= 5) opts.push({ id: 'infra', kind: 'facility', region: r.id, v: .7 + r.vp / 50 });
  }
  opts.sort((a, b) => b.v - a.v || (a.region < b.region ? -1 : 1));
  for (const o of opts.slice(0, 2)) act({ type: 'build', country: cid, id: o.id, kind: o.kind || 'building', region: o.region });
}
function aiProduction(s, d, cid) {
  const c = s.countries[cid], X = index(d), cap = Math.floor(armsCapacity(s, d, cid));
  if (cap <= 0) return;
  // 필요한 장비: 사단 정원 대비 부족분 + 기본 비율
  const need = {};
  for (const dv of s.divisions) if (dv.owner === cid) { const st = divisionStats(s, d, dv); for (const [e, q] of Object.entries(st.eq)) need[e] = (need[e] || 0) + q * (1 - dv.str) + q * .3; }
  for (const t of c.training) { const st = templateStats(s, d, t.tpl, cid); for (const [e, q] of Object.entries(st.eq)) need[e] = (need[e] || 0) + q; }
  const M = mods(s, d, c);
  const weights = {};
  for (const [e, q] of Object.entries(need)) { const have = c.stock[e] || 0, eq = X.equipment.get(e); if (!eq || (eq.tech && !c.research.done.includes(eq.tech))) continue; weights[e] = Math.max(0, q - have) * eq.cost; }
  const air = ['fighter', 'cas', 'naval_bomber', 'bomber'].filter(e => M.equipment[e] || c.research.done.includes(X.equipment.get(e).levels?.[0]));
  const totalNeed = sum(Object.values(weights));
  const plan = {};
  const groundShare = air.length ? .7 : 1;
  for (const [e, w] of Object.entries(weights)) plan[e] = totalNeed > 0 ? cap * groundShare * w / totalNeed : 0;
  if (totalNeed <= 0) { plan.inf_eq = cap * groundShare * .5; plan.artillery = cap * groundShare * .3; plan.support_eq = cap * groundShare * .2; }
  const airW = { fighter: .5, cas: .2, naval_bomber: ['japan', 'usa', 'uk'].includes(cid) ? .2 : 0, bomber: .1 };
  const airSum = sum(air.map(e => airW[e]));
  for (const e of air) plan[e] = (plan[e] || 0) + cap * (1 - groundShare) * airW[e] / Math.max(.01, airSum);
  const lines = [];
  for (const [e, f] of Object.entries(plan)) { const n = Math.round(f); if (n <= 0) continue; const old = c.lines.find(l => l.equip === e); lines.push({ id: old ? old.id : `ln_${e}`, equip: e, factories: n, eff: old ? old.eff : d.economy.lineStart, carry: old ? old.carry : 0 }); }
  while (sum(lines.map(l => l.factories)) > cap) { const m = lines.reduce((a, b) => b.factories > a.factories ? b : a); m.factories -= 1; }
  c.lines = lines.filter(l => l.factories > 0);
}
/* ---------- 항공·해군 배치(매달) ---------- */
function aiAir(s, d, cid) {
  const X = index(d), war = isAtWar(s, cid), c = s.countries[cid];
  const fronts = frontRegions(s, d, cid);
  const frontZones = [...new Set(fronts.map(r => X.regions.get(r).airZone))];
  const homeZone = X.regions.get(c.mapCapital || c.capital)?.airZone;
  for (const w of s.air.filter(w => w.owner === cid)) {
    if (X.regions.get(w.base)?.offmap) { w.mission = 'idle'; continue; }
    if (!war) { w.mission = w.type === 'fighter' ? 'superiority' : 'idle'; w.zone = X.regions.get(w.base).airZone; continue; }
    if (w.type === 'naval_bomber') {
      const seas = (X.seaByCoast.get(w.base) || []); const target = d.seas.filter(z => s.fleets.some(f => f.at === z.id && atWar(s, cid, f.owner))).sort((a, b) => distance(d, w.base, a.id) - distance(d, w.base, b.id))[0];
      w.mission = 'naval_strike'; w.zone = target && distance(d, w.base, target.id) < d.aircraft.naval_bomber.range ? target.id : seas[0] || null; if (!w.zone) w.mission = 'idle'; continue;
    }
    const zones = frontZones.filter(z => wingInRange(s, d, { ...w, zone: z }));
    const zone = zones.sort((a, b) => sum(Object.values(s.battles || {}).filter(x => X.regions.get(x.region).airZone === b).map(() => 1)) - sum(Object.values(s.battles || {}).filter(x => X.regions.get(x.region).airZone === a).map(() => 1)))[0];
    if (zone) { w.zone = zone; w.mission = w.type === 'fighter' ? 'superiority' : w.type === 'cas' ? 'cas' : 'strategic'; }
    else {
      // 전선 근처의 비행장으로 옮긴다
      const base = fronts.map(r => r).concat(d.regions.filter(r => !r.offmap && s.regions[r.id].controller === cid && s.regions[r.id].air > 0).map(r => r.id)).find(r => s.regions[r] && s.regions[r].air > 0 && s.regions[r].controller === cid && frontZones.some(z => { const zz = X.airZones.get(z); return zz && Math.hypot(zz.center[0] - X.regions.get(r).label[0], zz.center[1] - X.regions.get(r).label[1]) < d.aircraft[w.type].range; }));
      if (base) w.base = base;
      w.zone = homeZone; w.mission = w.type === 'fighter' ? 'superiority' : 'idle';
    }
  }
}
function aiNavy(s, d, cid) {
  const X = index(d), war = isAtWar(s, cid), c = s.countries[cid];
  // 같은 곳에 멈춰 있는 우리 함대(잠수함대 제외)는 가장 큰 함대로 합친다
  const groups = new Map();
  for (const f of s.fleets) if (f.owner === cid && !(f.path && f.path.length) && !(f.mission === 'raid')) { const k = f.at; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => fleetStrength(s, d, b) - fleetStrength(s, d, a));
    const keep = list[0];
    for (const f of list.slice(1)) { for (const [k, n] of Object.entries(f.ships)) keep.ships[k] = (keep.ships[k] || 0) + n; for (const [k, v] of Object.entries(f.damage || {})) { keep.damage = keep.damage || {}; keep.damage[k] = (keep.damage[k] || 0) + v; } f.ships = {}; }
  }
  s.fleets = s.fleets.filter(f => sum(Object.values(f.ships)) > 0);
  const fleets = s.fleets.filter(f => f.owner === cid);
  if (!fleets.length) return;
  if (!war) { for (const f of fleets) if (f.mission !== 'port' && !(f.path && f.path.length)) f.mission = 'port'; return; }
  // 잠수함을 따로 떼어 적 항구 근처에서 통상 파괴
  for (const f of fleets) if ((f.ships.submarine || 0) >= 4 && sum(Object.entries(f.ships).filter(([k]) => k !== 'submarine' && k !== 'convoy').map(([, n]) => n)) > 0) {
    const n = f.ships.submarine; f.ships.submarine = 0;
    s.fleets.push({ id: `fl${(s.seq = (s.seq || 0) + 1)}`, owner: cid, name: `${f.name} 잠수함대`, at: f.at, ships: { submarine: n }, mission: 'port', path: [] });
  }
  const enemies = enemiesOf(s, cid);
  const enemyZones = new Set(); for (const r of d.regions) if (enemies.includes(s.regions[r.id].controller) && s.regions[r.id].port > 0) for (const z of r.coast) enemyZones.add(z);
  const homeZones = new Set(); for (const r of d.regions) if (s.regions[r.id].controller === cid && s.regions[r.id].port > 0) for (const z of r.coast) homeZones.add(z);
  const homeHeld = f => X.regions.get(f.at)?.offmap && (c.spirits.includes('european_war') || c.spirits.includes('great_patriotic_war') || (cid === 'usa' && s.day - (s.flags.us_at_war ?? s.day) < 150));
  // 우리 핵심 해안 앞바다에 적 함대가 있으면 가장 강한 함대가 막으러 간다
  const main = s.fleets.filter(f => f.owner === cid && f.mission !== 'raid' && !homeHeld(f)).sort((a, b) => fleetStrength(s, d, b) - fleetStrength(s, d, a))[0];
  const coreZones = new Set(); for (const r of d.regions) { const st = s.regions[r.id]; if (!r.offmap && st.owner === cid && st.controller === cid && r.vp >= 5) for (const z of r.coast) coreZones.add(z); }
  const mainStr = main ? fleetStrength(s, d, main) : 0;
  const threatZones = [...coreZones].filter(z => sum(s.fleets.filter(f => f.at === z && atWar(s, cid, f.owner) && f.mission !== 'raid').map(f => fleetStrength(s, d, f))) > mainStr * .3);
  if (main && threatZones.length) { const z = threatZones.sort((a, b) => distance(d, main.at, a) - distance(d, main.at, b))[0]; if (main.at !== z && !(main.path && main.path.at(-1) === z)) orderFleet(s, d, main, z); main.mission = 'patrol'; }
  for (const f of s.fleets.filter(f => f.owner === cid)) {
    if (f.path && f.path.length) continue;
    if (homeHeld(f) || f === main && threatZones.length) continue;
    if (c.aiPlan && c.aiPlan.fleet === f.id && !threatZones.length) continue;
    const subs = (f.ships.submarine || 0) > 0 && sum(Object.values(f.ships)) === f.ships.submarine;
    const hp = f.damage ? sum(Object.entries(f.damage).map(([k, v]) => v / (d.ships.find(x => x.id === k).hp * Math.max(1, f.ships[k] || 0)))) : 0;
    if (hp > .4) { const port = d.regions.find(r => s.regions[r.id].controller === cid && s.regions[r.id].port >= 3 && !r.offmap); if (port && f.at !== port.id) orderFleet(s, d, f, port.id); continue; }
    if (subs) { const target = [...enemyZones].sort((a, b) => distance(d, f.at, a) - distance(d, f.at, b))[0]; if (target) { if (f.at !== target) orderFleet(s, d, f, target); f.mission = 'raid'; } continue; }
    // 주력 함대: 전선·상륙 목표에 가까운 아군 해역을 순찰
    const fronts = frontRegions(s, d, cid).filter(r => X.regions.get(r).coast.length);
    const zone = fronts.flatMap(r => X.regions.get(r).coast).concat([...homeZones]).sort((a, b) => distance(d, f.at, a) - distance(d, f.at, b))[0];
    if (zone) { if (f.at !== zone) orderFleet(s, d, f, zone); f.mission = 'patrol'; }
  }
}

/* ---------- 이틀마다: 전선과 공격 ---------- */
const JP_SIDE = new Set(['japan', 'manchukuo', 'mengjiang']);
const INTERIOR = new Set(['chongqing', 'chengdu', 'xikang', 'kunming', 'dali', 'guiyang', 'hanzhong', 'xian', 'lanzhou', 'xining', 'qinghai_w', 'hexi', 'yanan', 'urumqi', 'kashgar', 'hami', 'khotan', 'lhasa', 'chamdo', 'ngari']);
export function frontRegions(s, d, cid) {
  const X = index(d), out = [];
  const guerrilla = s.countries[cid].spirits.includes('guerrilla_base'); // 유격 근거지는 제 땅만 지킨다(우방의 진지전에 끼지 않는다)
  for (const r of d.regions) {
    if (r.offmap) continue;
    const st = s.regions[r.id];
    if (st.controller !== cid && (guerrilla || !friendly(s, cid, st.controller))) continue;
    // 우방(괴뢰국·공동 교전국)의 땅도 같은 적과 맞닿으면 우리 전선이다
    if (r.adj.some(n => hostile(s, cid, n) && (st.controller === cid || atWar(s, st.controller, s.regions[n].controller)))) out.push(r.id);
  }
  return out;
}
const power = (s, d, list) => sum(list.map(dv => { const st = divisionStats(s, d, dv); return (st.soft + st.hard * 2 + st.def * .3 + st.brk * .3) * dv.str * (.3 + .7 * dv.org); }));
export function militaryAI(s, d, cid) {
  const X = index(d), c = s.countries[cid], war = isAtWar(s, cid);
  const mine = s.divisions.filter(dv => dv.owner === cid && !X.seas.has(dv.at));
  if (!mine.length) return;
  // 일본의 태평양 개전(역사의 결정 시점 이후)
  if (cid === 'japan' && s.flags.pacific_decision && s.day >= dayOf('1941-12-07')) for (const t of ['usa', 'uk', 'netherlands']) if (!atWar(s, cid, t) && !canDeclare(s, d, cid, t)) declareWar(s, d, cid, t, s._log);
  if (!war) { if (s.day % 30 === 0) positionPeacetime(s, d, cid, mine); return; }
  const fronts = frontRegions(s, d, cid);
  const gplan = garrisonPlan(s, d, cid), reserved = new Set(), garrison = new Set();
  for (const [r, w] of gplan) for (const dv of mine.filter(x => x.at === r).slice(0, w)) { reserved.add(dv.id); garrison.add(dv.id); }
  // 상륙 계획에 쓸 사단(출발 항구에 있거나 그리로 가는 사단)도 전선에 보내지 않는다
  if (c.aiPlan) for (const dv of mine.filter(x => x.at === c.aiPlan.from || (x.order && x.order.dest === c.aiPlan.from)).slice(0, 8)) reserved.add(dv.id);
  if (s.day % 6 === 0) { deployFromHome(s, d, cid, mine); garrisonIslands(s, d, cid, mine, gplan, reserved); aiNavy(s, d, cid); }
  if (s.day % 6 === 0 && sum(s.fleets.filter(f => f.owner === cid).map(f => fleetStrength(s, d, f))) > 400) aiInvasion(s, d, cid, mine, garrison);
  if (!fronts.length) return;
  // 전선마다 위협(맞닿은 적 사단의 힘 + 승점)
  const threat = new Map(fronts.map(r => {
    const enemyAdj = X.regions.get(r).adj.filter(n => hostile(s, cid, n));
    const e = power(s, d, s.divisions.filter(dv => enemyAdj.includes(dv.at) && atWar(s, cid, dv.owner)));
    return [r, 1 + e + X.regions.get(r).vp * 3 + (r === c.mapCapital ? 40 : 0)];
  }));
  const total = sum([...threat.values()]);
  const free = mine.filter(dv => !dv.inBattle && !reserved.has(dv.id) && (!dv.order || dv.order.type === 'move'));
  const CAP = 10; // 한 지역에 몰아넣지 않는다(보급)
  // 보급이 감당하는 만큼만: 지역의 보급 용량 ÷ 우리 사단의 평균 사용량
  const SUP = supplyToday(s, d), avgUse = sum(mine.slice(0, 30).map(dv => divisionStats(s, d, dv).supply)) / Math.min(30, mine.length) || 1;
  const supCap = r => Math.max(2, Math.floor(((SUP[cid] && SUP[cid].get(r)) || 0) / avgUse * 1.15));
  const want = new Map([...threat].map(([r, t]) => [r, Math.min(CAP, supCap(r), Math.max(1, Math.round(free.length * t / total)))]));
  const have = new Map(fronts.map(r => [r, mine.filter(dv => dv.at === r || (dv.order && dv.order.dest === r)).length]));
  // 남는 사단을 부족한 전선으로
  // 전선 밖의 사단 + 정원보다 많이 몰린 전선의 사단
  const crowd = new Map(fronts.map(r => [r, mine.filter(dv => dv.at === r).length]));
  const extra = free.filter(dv => fronts.includes(dv.at) && !dv.order && crowd.get(dv.at) > CAP + 2 && (crowd.set(dv.at, crowd.get(dv.at) - 1), true));
  const spare = free.filter(dv => !fronts.includes(dv.at) && !(dv.order && fronts.includes(dv.order.dest)) && !(X.regions.get(dv.at)?.offmap && rand(s) < .5)).concat(extra);
  for (const dv of spare.slice(0, 16)) {
    const lacking = fronts.filter(r => (have.get(r) || 0) < (want.get(r) || 0)).sort((a, b) => ((have.get(a) || 0) - want.get(a)) - ((have.get(b) || 0) - want.get(b)) || distance(d, dv.at, a) - distance(d, dv.at, b));
    const target = lacking.slice(0, 3).sort((a, b) => distance(d, dv.at, a) - distance(d, dv.at, b))[0];
    if (target && orderMove(s, d, dv, target).ok) have.set(target, (have.get(target) || 0) + 1);
  }
  // 보급이 모자라는 지역의 남는 사단을 보급에 여유가 있는 이웃(우리 편) 지역으로 나눈다
  if (s.day % 4 === 0 && SUP[cid]) {
    const capOf = r => SUP[cid].get(r) || 0, useOf = new Map();
    for (const dv of mine) useOf.set(dv.at, (useOf.get(dv.at) || 0) + divisionStats(s, d, dv).supply);
    const at = new Map(); for (const dv of free) if (!dv.order && !X.regions.get(dv.at)?.offmap) { if (!at.has(dv.at)) at.set(dv.at, []); at.get(dv.at).push(dv); }
    for (const [rid, list] of [...at].sort((a, b) => b[1].length - a[1].length)) {
      let excess = (useOf.get(rid) || 0) - capOf(rid) * 1.05;
      if (excess <= 0 || list.length < 2) continue;
      // 세 걸음 안의 우리 편 지역 가운데 보급에 여유가 있는 곳(가까운 곳 먼저)
      const near = new Map([[rid, 0]]), q = [rid];
      while (q.length) { const id = q.shift(), k = near.get(id); if (k >= 3) continue; for (const n of X.regions.get(id).adj) if (!near.has(n) && passable(s, cid, n) && !s.battles[n]) { near.set(n, k + 1); q.push(n); } }
      const nbs = [...near].filter(([n, k]) => k > 0).map(([n, k]) => ({ n, k, spare: capOf(n) - (useOf.get(n) || 0) })).filter(x => x.spare > avgUse).sort((a, b) => a.k - b.k || b.spare - a.spare || (a.n < b.n ? -1 : 1));
      for (const dv of list.sort((a, b) => a.org * a.str - b.org * b.str)) {
        if (excess <= 0) break;
        const u = divisionStats(s, d, dv).supply, nb = nbs.find(x => x.spare >= u);
        if (!nb || !orderMove(s, d, dv, nb.n).ok) continue;
        nb.spare -= u; excess -= u; useOf.set(nb.n, (useOf.get(nb.n) || 0) + u);
      }
    }
  }
  // 공격: 적 지역마다 맞닿은 우리 전선 지역들의 사단을 모아(여러 방향에서) 이길 만한 곳부터 친다
  const cand = new Map();
  for (const r of fronts) {
    const here = mine.filter(dv => dv.at === r && !reserved.has(dv.id) && !dv.inBattle && !(dv.order && dv.order.type !== 'move') && dv.org > .6 && dv.str > .5);
    const keep = here.length > 2 && (threat.get(r) || 0) > 40 ? 1 : 0; // 위협이 큰 전선은 하나를 남긴다
    for (const n of X.regions.get(r).adj) if (hostile(s, cid, n)) { if (!cand.has(n)) cand.set(n, []); cand.get(n).push(...here.slice(keep)); }
  }
  // 역사적 작전 한계: 일본 쪽 AI는 중국 내륙 깊숙한 곳(쓰촨·윈난·구이저우·산시성 서부·간쑤·옌안·신장·티베트)을 치지 않는다(실제로도 닿지 못했다)
  if (JP_SIDE.has(cid)) for (const n of [...cand.keys()]) if (INTERIOR.has(n)) cand.delete(n);
  const targets = [...cand.keys()].map(n => {
    const def = s.divisions.filter(dv => dv.at === n && atWar(s, cid, dv.owner)), t = d.terrain[X.regions.get(n).terrain];
    return { n, def: power(s, d, def) * (1 + t.def + s.regions[n].fort * .06) / t.attack, empty: !def.length, vp: X.regions.get(n).vp };
  }).sort((a, b) => (b.vp * 4 + 6) / (b.def + 60) - (a.vp * 4 + 6) / (a.def + 60));
  const used = new Set();
  for (const t of targets) {
    const avail = [...new Set(cand.get(t.n))].filter(dv => !used.has(dv.id)).sort((a, b) => b.org * b.str - a.org * a.str);
    if (!avail.length) continue;
    if (t.empty) { const dv = avail[0]; orderAttack(s, d, dv, t.n); used.add(dv.id); continue; }
    const total = power(s, d, avail);
    if (total < t.def * 1.2) continue;
    let sum2 = 0;
    for (const dv of avail) { if (sum2 >= t.def * 1.8) break; if (orderAttack(s, d, dv, t.n).ok) { used.add(dv.id); sum2 += power(s, d, [dv]); } }
  }
}
function aiInvasion(s, d, cid, mine, reserved = new Set()) {
  const X = index(d), c = s.countries[cid];
  let plan = c.aiPlan;
  if (plan && (!hostile(s, cid, plan.target) || s.day - plan.day > 150 || s.regions[plan.from].controller !== cid)) plan = c.aiPlan = null;
  const delay = (d.countries.find(x => x.id === cid).ai || {}).invasionDelay || 0;
  if (!plan) {
    const ports = d.regions.filter(r => !r.offmap && s.regions[r.id].controller === cid && s.regions[r.id].port > 0);
    if (!ports.length) return;
    const fuelShort = 1 - clamp(c.rates.fuel, 0, 1);
    let best = null, bv = 0;
    for (const r of d.regions) {
      if (r.offmap || !r.coast.length || !hostile(s, cid, r.id)) continue;
      if (delay && s.day - (s.warStart[pairKey(cid, s.regions[r.id].controller)] ?? s.day) < delay) continue;
      // 태평양의 연합국은 1945년 봄 전에는 대륙과 일본 본토에 상륙하지 않고 섬을 징검다리로 삼는다
      if (['usa', 'uk', 'australia', 'nz', 'netherlands'].includes(cid) && s.day < dayOf('1945-03-01') && (r.landmass === 'eurasia' || r.landmass === 'japan_home')) continue;
      const from = ports.map(p => [p.id, distance(d, p.id, r.id)]).sort((a, b) => a[1] - b[1])[0];
      if (!from || from[1] > 650) continue;
      const def = power(s, d, s.divisions.filter(dv => dv.at === r.id && atWar(s, cid, dv.owner)));
      const value = (r.vp * 2 + sum(Object.values(r.res)) * 3 + ((r.res.oil || 0) + (r.res.rubber || 0)) * (4 + fuelShort * 20) + s.regions[r.id].port * 2 + 2) / (1 + def / 150) / (1 + from[1] / 500);
      if (value > bv) { bv = value; best = { target: r.id, from: from[0], day: s.day }; }
    }
    if (!best) return;
    plan = c.aiPlan = best;
  }
  const tr = X.regions.get(plan.target);
  const zone = [...tr.coast].sort((a, b) => distance(d, plan.from, a) - distance(d, plan.from, b))[0];
  const fleets = s.fleets.filter(f => f.owner === cid && f.mission !== 'raid' && !X.regions.get(f.at)?.offmap).sort((a, b) => fleetStrength(s, d, b) - fleetStrength(s, d, a));
  const fl = fleets.find(f => f.id === plan.fleet) || fleets[0];
  if (fl) { plan.fleet = fl.id; if (fl.at !== zone && !(fl.path && fl.path.length && fl.path.at(-1) === zone)) { orderFleet(s, d, fl, zone); } fl.mission = 'patrol'; }
  const def = power(s, d, s.divisions.filter(dv => dv.at === plan.target && atWar(s, cid, dv.owner)));
  const need = clamp(Math.ceil(def / 140) + 1, 1, 6);
  const ready = mine.filter(dv => dv.at === plan.from && !reserved.has(dv.id) && !dv.order && dv.org > .7 && dv.str > .7);
  if (ready.length >= need) {
    if (E_seaShare(s, cid, zone) >= .5) { let n = 0; for (const dv of ready.slice(0, need)) if (orderInvade(s, d, dv, plan.target).ok) n++; if (n) { plan.launched = s.day; c.aiPlan = null; } }
    return;
  }
  const fronts = new Set(frontRegions(s, d, cid));
  const idle = mine.filter(dv => !reserved.has(dv.id) && !dv.order && !dv.inBattle && dv.at !== plan.from && (!fronts.has(dv.at) || mine.filter(x => x.at === dv.at).length > 3) && dv.str > .6).sort((a, b) => distance(d, a.at, plan.from) - distance(d, b.at, plan.from));
  for (const dv of idle.slice(0, need - ready.length)) orderMove(s, d, dv, plan.from);
}
/** 지켜야 할 지역과 사단 수: 해군 강국과 싸울 때 핵심 해안 도시·항구 섬·지도 위 수도. */
export function garrisonPlan(s, d, cid) {
  const c = s.countries[cid], out = new Map();
  const navalFoe = enemiesOf(s, cid).some(e => sum(s.fleets.filter(f => f.owner === e).map(f => fleetStrength(s, d, f))) > 300);
  if (!navalFoe) return out;
  for (const r of d.regions) {
    if (r.offmap || !r.coast.length) continue;
    const st = s.regions[r.id];
    if (st.controller !== cid || st.owner !== cid) continue;
    const island = !r.adj.length;
    let want = 0;
    if (r.id === c.mapCapital) want = 4; else if (r.vp >= 20) want = 3; else if (r.vp >= 10) want = 2; else if (r.vp >= 5 || st.port >= 4 || (island && (st.port > 0 || r.vp >= 2))) want = 1;
    if (want) out.set(r.id, want);
  }
  return out;
}
/** 섬 기지 수비: 전쟁 중 해군 강국과 맞서는 나라는 항구가 있는 우리 섬에 사단을 하나씩 둔다. */
function garrisonIslands(s, d, cid, mine, plan, reserved) {
  const fronts = new Set(frontRegions(s, d, cid));
  const count = r => mine.filter(dv => dv.at === r || (dv.order && dv.order.dest === r)).length;
  const lacking = [...plan].filter(([r, w]) => count(r) < w).sort((a, b) => b[1] - a[1]);
  let moved = 0;
  for (const [r, w] of lacking) {
    let need = w - count(r);
    const pool = mine.filter(dv => !reserved.has(dv.id) && !dv.inBattle && (!dv.order || dv.order.type === 'move') && dv.str > .4 && !(dv.order && plan.has(dv.order.dest)))
      .sort((a, b) => (fronts.has(a.at) ? 1 : 0) - (fronts.has(b.at) ? 1 : 0) || distance(d, a.at, r) - distance(d, b.at, r));
    for (const dv of pool) { if (need <= 0 || moved > 8) break; if (fronts.has(dv.at) && mine.filter(x => x.at === dv.at).length <= 2) continue; if (orderMove(s, d, dv, r).ok) { reserved.add(dv.id); need--; moved++; } }
  }
}
/** 지도 밖 본국의 사단을 진입 항구로 보낸다(전쟁 중). */
function deployFromHome(s, d, cid, mine) {
  const X = index(d), home = d.regions.find(r => r.offmap && r.owner === cid);
  if (!home || s.countries[cid].homeLost) return;
  const port = home.link.port || (home.link.land || [])[0];
  if (!port || s.regions[port].controller !== cid) return;
  const atHome = mine.filter(dv => dv.at === home.id && !dv.order);
  for (const dv of atHome.slice(0, Math.max(0, atHome.length - 2))) orderMove(s, d, dv, port);
}
const E_seaShare = (s, cid, z) => seaShare(s, cid, z);
function positionPeacetime(s, d, cid, mine) {
  const X = index(d), c = s.countries[cid];
  // 전쟁 명분이 있거나 적대적인 이웃 국경으로, 없으면 승점이 큰 지역으로 흩어 둔다
  const rivals = new Set(c.wargoals);
  for (const o of Object.values(s.countries)) if (o.exists && o.wargoals.includes(cid)) rivals.add(o.id);
  const border = d.regions.filter(r => !r.offmap && s.regions[r.id].controller === cid && r.adj.some(n => rivals.has(s.regions[n].controller))).map(r => r.id);
  const spots = border.length ? border : d.regions.filter(r => !r.offmap && s.regions[r.id].controller === cid && r.vp >= 5).map(r => r.id);
  if (!spots.length) return;
  let i = 0;
  for (const dv of mine) { if (dv.order || X.regions.get(dv.at)?.offmap) continue; const t = spots[i++ % spots.length]; if (t !== dv.at && rand(s) < .3) orderMove(s, d, dv, t); }
}

/** 장군·제독 배치: 사단이 가장 많이 모인 지역부터 군을 만들어 능력이 높은 장군을 붙이고, 큰 함대부터 제독을 붙인다. */
export function aiLeaders(s, d, cid) {
  // 컴퓨터 나라의 군은 매달 다시 짠다
  for (const a of s.armies.filter(a => a.owner === cid)) { if (a.leader) s.leaders[a.leader].army = null; }
  for (const dv of s.divisions) if (dv.owner === cid) dv.army = null;
  s.armies = s.armies.filter(a => a.owner !== cid);
  const leaders = freeLeaders(s, d, cid, 'army');
  if (leaders.length) {
    const by = new Map(); for (const dv of s.divisions) if (dv.owner === cid && !index(d).regions.get(dv.at)?.offmap && !index(d).seas.has(dv.at)) by.set(dv.at, (by.get(dv.at) || []).concat(dv.id));
    const groups = [...by.values()].filter(l => l.length >= 2).sort((a, b) => b.length - a.length);
    for (let i = 0; i < Math.min(leaders.length, groups.length); i++) formArmy(s, d, cid, groups[i].slice(0, 24), null, leaders[i].id);
  }
  const admirals = Object.values(s.leaders).filter(L => L.country === cid && L.kind === 'navy' && leaderAvailable(s, d, L.id)).sort((a, b) => b.skill - a.skill);
  const fleets = s.fleets.filter(f => f.owner === cid).sort((a, b) => fleetStrength(s, d, b) - fleetStrength(s, d, a));
  for (let i = 0; i < Math.min(admirals.length, fleets.length); i++) if (fleets[i].leader !== admirals[i].id) assignAdmiral(s, d, cid, fleets[i].id, admirals[i].id);
}
