/* 전선과 공장 — 군사: 사단 능력치, 이동(땅·바다), 전투, 점령, 보급, 보충, 항공, 해군.
 * 하루 한 번 진행한다. 수치와 공식은 이 게임의 설계값이다(docs/SIMULATION_RULES.md). */
import { clamp, round, sum, index, mods, distance, atWar, friendly, rand } from './core.mjs';
import { registerDivisionStats } from './economy.mjs';
import { weatherOf } from './weather.mjs';

/* ---------- 편제와 능력치 ---------- */
export const templateOf = (s, d, id) => index(d).templates.get(id) || (s.templates || []).find(t => t.id === id) || null;
const STATS_CACHE = new Map();
/** 편제 + 나라의 기술·정신으로 사단 능력치. */
export function templateStats(s, d, tplId, cid) {
  const c = s.countries[cid], M = mods(s, d, c), key = `${tplId}|${cid}|${c._modsKey}`;
  let v = STATS_CACHE.get(key); if (v) return v;
  const X = index(d), t = templateOf(s, d, tplId);
  if (!t) return null;
  const eqLv = e => Math.max(1, M.equipment[e] || 1);
  const parts = [...Object.entries(t.bat).map(([b, n]) => [b, n]), ...t.sup.map(b => [b, 1])];
  const st = { hp: 0, orgW: 0, orgN: 0, soft: 0, hard: 0, def: 0, brk: 0, armor: 0, pierce: 0, hardW: 0, width: 0, speed: Infinity, supply: 0, fuel: 0, manpower: 0, eq: {}, aa: 0, amphibious: t.amphibiousBonus || 0, terrain: {}, recon: 0, entrench: 0, lineN: 0 };
  for (const [bid, n] of parts) {
    const b = X.battalions.get(bid); if (!b) continue;
    const sm = M.stat[bid] || {};
    const lv = b.eq.armor ? eqLv('armor') : b.eq.artillery ? (eqLv('artillery') + eqLv('inf_eq')) / 2 : eqLv('inf_eq');
    st.hp += b.hp * n; st.width += b.width * n; st.supply += b.supply * n; st.fuel += (b.fuel || 0) * n; st.manpower += b.manpower * n;
    st.soft += b.soft * n * lv * (1 + (sm.soft || 0)); st.hard += b.hard * n * lv * (1 + (sm.hard || 0)); st.def += b.def * n * (b.line ? lv ** .5 : 1) * (1 + (sm.def || 0));
    st.brk += b.brk * n * lv * (1 + (sm.brk || 0)); st.aa += (b.aa || 0) * n;
    if (b.line) { st.orgW += (b.org + (sm.org || 0)) * n; st.orgN += n; st.lineN += n; st.speed = Math.min(st.speed, b.speed); st.hardW += b.hardness * n; st.armor = Math.max(st.armor, b.armor * (b.eq.armor ? eqLv('armor') : 1)); }
    st.pierce = Math.max(st.pierce, b.pierce * (b.eq.armor ? eqLv('armor') : b.eq.at_gun ? 1.2 : 1));
    for (const [e, q] of Object.entries(b.eq)) st.eq[e] = (st.eq[e] || 0) + q * n;
    for (const [tt, x] of Object.entries(b.terrain || {})) st.terrain[tt] = Math.max(st.terrain[tt] || 0, x);
    if (b.amphibious) st.amphibious = Math.max(st.amphibious, b.amphibious);
    if (b.initiative) st.recon += b.initiative; if (b.entrench) st.entrench += b.entrench;
  }
  st.org = st.orgN ? st.orgW / st.orgN * (1 + M.org) : 20;
  st.hardness = st.lineN ? st.hardW / st.lineN : 0;
  st.supply *= Math.max(.3, 1 + M.supplyUse);
  st.manpower = Math.round(st.manpower * Math.max(.5, 1 + M.manpowerUse));
  st.def *= 1 + M.defense;
  if (!Number.isFinite(st.speed)) st.speed = 18;
  for (const [tt, x] of Object.entries(M.terrain)) st.terrain[tt] = (st.terrain[tt] || 0) + x;
  STATS_CACHE.set(key, st);
  if (STATS_CACHE.size > 4000) STATS_CACHE.clear();
  return st;
}
export const divisionStats = (s, d, dv) => templateStats(s, d, dv.tpl, dv.owner);
registerDivisionStats(divisionStats);

/* ---------- 통행과 경로 ---------- */
/** 이 나라의 사단이 들어가 머물 수 있는 지역인가(자기·우방이 통제). */
export function passable(s, cid, rid) {
  const st = s.regions[rid]; if (!st) return false;
  return friendly(s, cid, st.controller);
}
export const hostile = (s, cid, rid) => atWar(s, cid, s.regions[rid].controller);
/** 이 해역이 적에게 막혀 있는가(적의 해상 우세 0.5 초과). */
export function seaBlocked(s, cid, sea) {
  const m = s.navSup[sea]; if (!m) return false;
  let mine = 0, enemy = 0;
  for (const [k, v] of Object.entries(m)) { if (atWar(s, cid, k)) enemy += v; else if (friendly(s, cid, k)) mine += v; }
  return enemy > .5 && enemy > mine;
}
/** 이 해역에서 우리 편(자기·우방)의 해상 우세 몫. 함대가 아무도 없으면 0. */
export function seaShare(s, cid, sea) {
  const m = s.navSup[sea]; if (!m) return 0;
  let mine = 0; for (const [k, v] of Object.entries(m)) if (k === cid || friendly(s, cid, k)) mine += v;
  return mine;
}
/** 경로 찾기(다익스트라). 노드: 지역과 해역. 끝 지역이 적의 땅이면 마지막 걸음은 공격이다. */
export function findPath(s, d, dv, dest, { allowAttack = true } = {}) {
  const X = index(d), cid = dv.owner, st = divisionStats(s, d, dv), c = s.countries[cid], M = mods(s, d, c);
  const speed = Math.max(4, st.speed * (st.fuel > 0 ? clamp(c.rates.fuel, .3, 1) : 1));
  const start = dv.at;
  const dist = new Map([[start, 0]]), prev = new Map(), done = new Set();
  const isSea = id => X.seas.has(id);
  const landCost = (a, b) => { const r = X.regions.get(b), t = d.terrain[r.terrain]; const infra = s.regions[b].infra; return Math.max(.5, distance(d, a, b) / speed * t.move / clamp(.7 + infra * .06, .7, 1.3) / weatherOf(s, d, b).move); };
  const neighbors = id => {
    const out = [];
    if (isSea(id)) {
      const sea = X.seas.get(id);
      for (const n of sea.adj) if (!seaBlocked(s, cid, n)) out.push([n, distance(d, id, n) / 45 + .3]);
      for (const r of sea.coast) if (passable(s, cid, r)) out.push([r, 1.5]); // 적의 해안에는 상륙 작전으로만 내린다
      for (const h of d.regions) if (h.offmap && h.link && h.link.sea === id && s.regions[h.id].controller === cid && !c.homeLost) out.push([h.id, h.link.days * (1 + M.deployTime) * .5]);
      return out;
    }
    const r = X.regions.get(id);
    if (r.offmap) {
      if (M.homeLocked || c.homeLost) return out;
      const l = r.link, days = l.days * (1 + M.deployTime);
      if (l.sea && !seaBlocked(s, cid, l.sea)) out.push([l.sea, days * .5]);
      for (const x of l.land || []) if (passable(s, cid, x)) out.push([x, days]);
      return out;
    }
    for (const n of r.adj) {
      if (passable(s, cid, n)) out.push([n, landCost(id, n)]);
      else if (allowAttack && n === dest && hostile(s, cid, n)) out.push([n, landCost(id, n)]);
    }
    if (s.regions[id].port > 0 && passable(s, cid, id)) for (const sea of X.seaByCoast.get(id) || []) if (!seaBlocked(s, cid, sea)) out.push([sea, 2]);
    for (const h of d.regions) if (h.offmap && h.link && (h.link.land || []).includes(id) && s.regions[h.id].controller === cid && !M.homeLocked && !c.homeLost) out.push([h.id, h.link.days * (1 + M.deployTime)]);
    return out;
  };
  while (true) {
    let cur = null, best = Infinity;
    for (const [k, v] of dist) if (!done.has(k) && v < best) { best = v; cur = k; }
    if (cur === null) return null;
    if (cur === dest) break;
    done.add(cur);
    if (cur !== start && !isSea(cur) && hostile(s, cid, cur)) continue; // 적의 땅을 지나가지 않는다
    for (const [n, w] of neighbors(cur)) {
      const nd = best + w;
      if (nd < (dist.get(n) ?? Infinity)) { dist.set(n, nd); prev.set(n, cur); }
    }
    if (done.size > 600) return null;
  }
  const path = []; let k = dest;
  while (k !== start) { path.unshift({ node: k, days: round(dist.get(k) - dist.get(prev.get(k)), 3) }); k = prev.get(k); }
  return { path, days: round(dist.get(dest), 2) };
}

/* ---------- 주문 ---------- */
export function orderMove(s, d, dv, dest) {
  if (dv.at === dest) { dv.order = null; return { ok: true }; }
  const p = findPath(s, d, dv, dest);
  if (!p) return { ok: false, reason: '갈 수 있는 길이 없습니다(적의 땅·막힌 바다·통행권 없는 나라).' };
  dv.order = { type: 'move', path: p.path, progress: 0, dest };
  return { ok: true, days: p.days };
}
/** 상륙 작전: 아군 항구에서 바다를 건너 적의 해안 지역을 친다. 준비 기간과 해상 우세가 필요하다. */
export function canInvade(s, d, dv, target) {
  const X = index(d), r = X.regions.get(target), from = X.regions.get(dv.at);
  if (!r || r.offmap || !from || from.offmap) return '상륙할 수 없는 곳입니다.';
  if (!hostile(s, dv.owner, target)) return '전쟁 중인 적의 지역이 아닙니다.';
  if (!(s.regions[dv.at].port > 0)) return '출발 지역에 항구가 없습니다.';
  if (!r.coast.length) return '바다에 닿지 않은 지역입니다.';
  if (distance(d, dv.at, target) > 700) return '출발지에서 너무 멉니다(지도 거리 700 이내).';
  if (weatherOf(s, d, target).noLanding || r.coast.every(z => weatherOf(s, d, z).noLanding)) return `날씨(${weatherOf(s, d, target).name})가 나빠 상륙할 수 없습니다. 날이 갤 때까지 기다리세요.`;
  const zones = r.coast.filter(z => seaShare(s, dv.owner, z) >= .5);
  if (!zones.length) return '상륙 지점 앞바다에서 해상 우세(50% 이상)를 차지해야 합니다. 함대를 그 해역에 순찰시키세요.';
  return '';
}
export function orderInvade(s, d, dv, target) {
  const why = canInvade(s, d, dv, target); if (why) return { ok: false, reason: why };
  dv.order = { type: 'invade', target, prep: 15 + Math.round(distance(d, dv.at, target) / 25) };
  return { ok: true, days: dv.order.prep };
}
export function orderAttack(s, d, dv, target) {
  const X = index(d), r = X.regions.get(dv.at);
  if (!r || !r.adj.includes(target)) return { ok: false, reason: '맞닿은 지역만 공격할 수 있습니다.' };
  if (!hostile(s, dv.owner, target)) return { ok: false, reason: '전쟁 중인 적의 지역이 아닙니다.' };
  dv.order = { type: 'attack', target };
  return { ok: true };
}

/* ---------- 보급 ---------- */
/** 나라마다 지역별 보급 용량. 원천: 지도 위 수도, 항구(바다가 막히지 않았을 때), 본국과 이어진 땅. 아군 땅을 따라 줄어들며 퍼진다. */
export function computeSupply(s, d) {
  const X = index(d), out = {};
  const users = new Set(s.divisions.map(dv => dv.owner));
  for (const cid of users) {
    const c = s.countries[cid]; if (!c || !c.exists) continue;
    const M = mods(s, d, c);
    const cap = new Map(), q = [];
    const push = (rid, v) => { if (v > (cap.get(rid) || 0)) { cap.set(rid, v); q.push(rid); } };
    const mc = c.mapCapital;
    if (mc && passable(s, cid, mc)) push(mc, (14 + s.regions[mc].infra * 1.5) * weatherOf(s, d, mc).supply);
    for (const r of d.regions) {
      const st = s.regions[r.id];
      if (r.offmap) { if (st.controller === cid && !c.homeLost && r.link.land) for (const x of r.link.land) if (passable(s, cid, x)) push(x, 14); continue; }
      if (st.port > 0 && friendly(s, cid, st.controller) && (st.controller === cid || s.countries[st.controller].faction === c.faction || s.countries[st.controller].overlord === cid || c.overlord === st.controller)) {
        const open = r.coast.filter(z => !seaBlocked(s, cid, z)).length / Math.max(1, r.coast.length);
        if (open > 0) push(r.id, (4 + st.port * 1.3) * open * (1 - (c.blockade || 0) * .5) * weatherOf(s, d, r.id).supply);
      }
    }
    // 적의 보급을 깎는 정신(초토화·유격 근거지 등)
    let enemyCut = 0; for (const e of s.wars.filter(w => w[0] === cid || w[1] === cid).map(w => w[0] === cid ? w[1] : w[0])) enemyCut = Math.min(enemyCut, mods(s, d, s.countries[e]).enemySupply || 0);
    while (q.length) {
      const id = q.shift(), v = cap.get(id), r = X.regions.get(id);
      for (const n of r.adj) {
        if (!passable(s, cid, n)) continue;
        const f = clamp(.7 + s.regions[n].infra * .025, .7, .95) * weatherOf(s, d, n).supply * (s.regions[n].owner !== cid && atWar(s, cid, s.regions[n].owner) ? 1 + enemyCut : 1);
        push(n, v * f);
      }
    }
    out[cid] = cap;
  }
  return out;
}
/** 지역 r에서 나라 cid의 보급 비율(용량 ÷ 그곳 사단들의 사용량). */
export function supplyRatio(s, d, cid, rid, SUP) {
  const cap = (SUP[cid] && SUP[cid].get(rid)) || 0;
  let use = 0; for (const dv of s.divisions) if (dv.owner === cid && dv.at === rid) use += divisionStats(s, d, dv).supply * leaderMods(s, d, dv).supply;
  return use <= 1e-9 ? 1 : clamp(cap / use, 0, 1);
}

/* ---------- 하루 진행 ---------- */
export function dailyMilitary(s, d, log) {
  const X = index(d);
  const SUP = computeSupply(s, d);
  const sup = new Map();
  for (const dv of s.divisions) { const k = `${dv.owner}|${dv.at}`; if (!sup.has(k)) sup.set(k, X.seas.has(dv.at) ? .5 : X.regions.get(dv.at)?.offmap ? 1 : supplyRatio(s, d, dv.owner, dv.at, SUP)); dv.sup = round(sup.get(k), 3); }
  s.supplyCache = null;
  // 이동
  for (const dv of s.divisions) {
    const o = dv.order; if (!o) continue;
    if (o.type === 'move') {
      const step = o.path[0]; if (!step) { dv.order = null; continue; }
      const nextHostile = !X.seas.has(step.node) && !X.regions.get(step.node).offmap && hostile(s, dv.owner, step.node);
      if (nextHostile && s.divisions.some(e => e.at === step.node && atWar(s, dv.owner, e.owner))) { dv.order = { type: 'attack', target: step.node, then: o.dest }; continue; }
      if (!X.seas.has(step.node) && !X.regions.get(step.node).offmap && !nextHostile && !passable(s, dv.owner, step.node)) { dv.order = null; continue; }
      o.progress = round(o.progress + 1 / Math.max(.3, step.days) * (dv.sup < .5 ? .7 : 1) * weatherOf(s, d, step.node).move, 4);
      if (o.progress >= 1) {
        dv.at = step.node; o.path.shift(); o.progress = 0;
        if (nextHostile) capture(s, d, step.node, dv.owner, log);
        if (!o.path.length) dv.order = null;
      }
    } else if (o.type === 'invade') {
      o.prep -= 1;
      if (o.prep <= 0 && o.prep > -20 && weatherOf(s, d, o.target).noLanding) continue; // 날이 갤 때까지(최대 20일) 기다린다
      if (o.prep <= 0) {
        const why = canInvade(s, d, dv, o.target);
        if (why) { dv.order = null; log(`${dv.name}: 상륙 취소 — ${why}`, dv.owner, 'military'); continue; }
        dv.order = { type: 'attack', target: o.target, amphibious: true };
      }
    }
  }
  // 바다 위의 사단은 적의 해상 우세에서 손실을 입는다
  for (const dv of s.divisions) if (X.seas.has(dv.at) && seaBlocked(s, dv.owner, dv.at)) dv.str = round(Math.max(.05, dv.str - .05), 4);
  // 전투
  const targets = new Map();
  for (const dv of s.divisions) if (dv.order && dv.order.type === 'attack') { if (!targets.has(dv.order.target)) targets.set(dv.order.target, []); targets.get(dv.order.target).push(dv); }
  s.battles = {};
  for (const [rid, attackers] of targets) battle(s, d, rid, attackers, log);
  // 회복·보충·소모
  for (const dv of s.divisions) {
    const st = divisionStats(s, d, dv), inBattle = dv.inBattle;
    if (!inBattle) dv.org = round(clamp(dv.org + .05 * (dv.sup ?? 1) * (1 + mods(s, d, s.countries[dv.owner]).recovery + leaderMods(s, d, dv).recovery), 0, 1), 4);
    if ((dv.sup ?? 1) < .5) dv.str = round(Math.max(.05, dv.str - .004 * (1 - dv.sup)), 4);
    // 날씨 소모는 야전(전투·이동·공격 중이거나 우리 땅이 아닌 곳)에서만. 막사에 있는 평시 수비대는 닳지 않는다.
    { const w = weatherOf(s, d, dv.at), lm = leaderMods(s, d, dv), r = X.regions.get(dv.at);
      const field = inBattle || dv.order || (r && s.regions[dv.at]?.controller !== dv.owner);
      if (w.attrition && field && r && !r.offmap) dv.str = round(Math.max(.05, dv.str - w.attrition * (lm.cold ? .5 : 1)), 4); }
    if (!inBattle && dv.str < 1) reinforce(s, d, dv, st, .02 * (dv.sup ?? 1));
    dv.inBattle = false;
  }
  for (const b of Object.values(s.battles)) for (const id of [...b.attackers, ...b.defenders]) { const dv = s.divisions.find(x => x.id === id); if (dv) dv.inBattle = true; }
  s.divisions = s.divisions.filter(dv => dv.str > .02);
}

/** 보충: 인력과 장비 재고에서 정원을 채운다. */
export function reinforce(s, d, dv, st, rate) {
  const c = s.countries[dv.owner];
  let gain = Math.min(rate, 1 - dv.str);
  const mpNeed = st.manpower * gain, avail = manpowerAvailable(s, d, dv.owner);
  if (mpNeed > avail) gain *= Math.max(0, avail / mpNeed);
  for (const [e, q] of Object.entries(st.eq)) { const need = q * gain; if (need > (c.stock[e] || 0)) gain = Math.min(gain, (c.stock[e] || 0) / q); }
  if (gain <= 1e-4) return;
  for (const [e, q] of Object.entries(st.eq)) c.stock[e] = Math.max(0, round((c.stock[e] || 0) - q * gain, 3));
  c.manpower.used += Math.round(st.manpower * gain);
  dv.str = round(dv.str + gain, 4);
}
/** 쓸 수 있는 인력(명): 인구 × 징병법 비율 − 군에 있는 사람 − 훈련 중 − 잃은 사람. */
export function manpowerAvailable(s, d, cid) {
  const c = s.countries[cid], M = mods(s, d, c), X = index(d);
  const rate = (X.lawOption.get(c.laws.conscription).fx.manpower || .01) * Math.max(.2, 1 + M.manpower);
  let pop = 0; for (const r of d.regions) { const st = s.regions[r.id]; if (st.owner === cid && st.controller === cid && !(r.offmap && c.homeLost)) pop += r.pop * (r.offmap ? .25 : 1); }
  return Math.max(0, Math.round(pop * 1e5 * rate + (c.manpower.bonus || 0) - c.manpower.used - c.manpower.training - c.manpower.lost));
}

/* ---------- 전투 ---------- */
function battle(s, d, rid, attackersAll, log) {
  const X = index(d), r = X.regions.get(rid), t = d.terrain[r.terrain], st = s.regions[rid];
  const attackers = attackersAll.filter(a => hostile(s, a.owner, rid) && a.org > .05);
  for (const a of attackersAll) if (!attackers.includes(a)) a.order = null;
  if (!attackers.length) return;
  const side = attackers[0].owner;
  const defenders = s.divisions.filter(dv => dv.at === rid && attackers.some(a => atWar(s, a.owner, dv.owner)));
  if (!defenders.length) {
    // 지키는 사단이 없으면 걸어 들어가야 한다(도착하면 점령). 상륙은 바로 내린다.
    for (const a of attackers) {
      if (a.order.amphibious) { capture(s, d, rid, a.owner, log); a.at = rid; a.order = null; a.org = round(a.org * .8, 4); continue; }
      const st2 = divisionStats(s, d, a), days = Math.max(1, distance(d, a.at, rid) / Math.max(4, st2.speed) * t.move / clamp(.7 + st.infra * .06, .7, 1.3));
      a.order = { type: 'move', path: [{ node: rid, days: round(days, 3) }], progress: 0, dest: a.order.then || rid };
    }
    return;
  }
  const W = t.width;
  const front = (list) => { const sorted = [...list].sort((a, b) => b.org - a.org); const out = []; let w = 0; for (const dv of sorted) { const sw = divisionStats(s, d, dv).width; if (out.length && w + sw > W) continue; out.push(dv); w += sw; } return out; };
  const A = front(attackers), D = front(defenders);
  const air = airSupport(s, d, r.airZone);
  const stats = list => list.map(dv => ({ dv, st: divisionStats(s, d, dv) }));
  const As = stats(A), Ds = stats(D);
  const hardOf = L => { const w = sum(L.map(x => x.st.width)) || 1; return sum(L.map(x => x.st.hardness * x.st.width)) / w; };
  const armorOf = L => { const w = sum(L.map(x => x.st.width)) || 1; return sum(L.map(x => x.st.armor * x.st.width)) / w; };
  const pierceOf = L => { const w = sum(L.map(x => x.st.width)) || 1; return sum(L.map(x => x.st.pierce * x.st.width)) / w; };
  const fuelF = x => x.st.fuel > 0 ? .5 + .5 * clamp(s.countries[x.dv.owner].rates.fuel, 0, 1) : 1;
  const hD = hardOf(Ds), hA = hardOf(As), W8 = weatherOf(s, d, rid);
  const fort = st.fort * .06 + ((mods(s, d, s.countries[st.controller]).fortBonus || {})[rid] || 0);
  let attA = 0, brkA = 0, attD = 0, defD = 0;
  for (const x of As) {
    const lm = leaderMods(s, d, x.dv, r.terrain);
    const amph = x.dv.order.amphibious ? (.5 + .5 * x.st.amphibious) + (lm.amphibious ? (.5 - .5 * x.st.amphibious) * .5 : 0) : 1;
    const wf = 1 + W8.attack * (lm.cold && (W8.code === 'snow' || W8.code === 'blizzard') ? .5 : 1);
    const m = (t.attack + (x.st.terrain[r.terrain] || 0)) * (.5 + .5 * (x.dv.sup ?? 1)) * amph * fuelF(x) * x.dv.str * (.85 + rand(s) * .3) * (1 + (x.dv.exp || 0) * .3) * wf * lm.atk;
    attA += (x.st.soft * (1 - hD) + x.st.hard * hD) * m; brkA += x.st.brk * x.dv.str * (1 + (x.st.terrain[r.terrain] || 0)) * lm.atk * (x.st.armor > 0 || x.st.fuel > 0 ? lm.brk : 1);
  }
  for (const x of Ds) {
    const lm = leaderMods(s, d, x.dv, r.terrain);
    const m = (1 + (x.st.terrain[r.terrain] || 0)) * (.5 + .5 * (x.dv.sup ?? 1)) * fuelF(x) * x.dv.str * (.85 + rand(s) * .3) * (1 + (x.dv.exp || 0) * .3) * (1 + W8.attack / 2) * lm.atk;
    attD += (x.st.soft * (1 - hA) + x.st.hard * hA) * m; defD += x.st.def * x.dv.str * (1 + t.def + fort * lm.fort + x.st.entrench) * lm.def;
  }
  attA += air.bonus(side) * .6; attD += air.bonus(D[0].owner) * .6;
  const hits = (att, def) => att <= def ? att * .1 : def * .1 + (att - def) * .4;
  let hitD = hits(attA, defD), hitA = hits(attD, brkA);
  if (armorOf(As) > pierceOf(Ds)) hitA *= .6;
  if (armorOf(Ds) > pierceOf(As)) hitD *= .6;
  const apply = (L, h, ownerList) => {
    const w = sum(L.map(x => x.st.width)) || 1;
    for (const x of L) {
      const share = x.st.width / w, orgDmg = h * share * .35 / Math.max(10, x.st.org), hpDmg = h * share * .12 / Math.max(5, x.st.hp);
      x.dv.org = round(Math.max(0, x.dv.org - orgDmg), 4);
      const before = x.dv.str; x.dv.str = round(Math.max(0, x.dv.str - hpDmg), 4);
      const lost = Math.round((before - x.dv.str) * x.st.manpower);
      s.countries[x.dv.owner].manpower.used = Math.max(0, s.countries[x.dv.owner].manpower.used - lost);
      s.countries[x.dv.owner].manpower.lost += lost;
      s.countries[x.dv.owner].casualties = (s.countries[x.dv.owner].casualties || 0) + lost;
      x.dv.exp = round(Math.min(1, (x.dv.exp || 0) + .002), 4);
    }
  };
  apply(Ds, hitD); apply(As, hitA);
  s.battles[rid] = { region: rid, attackers: A.map(x => x.id), defenders: D.map(x => x.id), side, defSide: D[0].owner, attack: round(attA, 1), defense: round(defD, 1), hitsOnDef: round(hitD, 1), hitsOnAtt: round(hitA, 1),
    progress: round(sum(D.map(x => 1 - x.org)) / D.length, 3), air: round(air.sup(side), 2) };
  // 조직력을 잃은 방어 사단은 물러난다(물러날 곳이 없으면 포위되어 무너진다)
  for (const x of Ds) {
    if (x.dv.org > .02) continue;
    const back = r.adj.filter(n => passable(s, x.dv.owner, n) && !s.battles[n]).sort((a, b) => (s.regions[b].infra - s.regions[a].infra));
    if (back.length) { x.dv.at = back[0]; x.dv.order = null; }
    else { x.dv.str = 0; log(`${x.dv.name}이(가) ${r.name}에서 포위되어 무너졌습니다.`, x.dv.owner, 'military'); }
  }
  for (const x of As) if (x.dv.org <= .02) x.dv.order = null;
  const left = s.divisions.filter(dv => dv.at === rid && dv.str > .02 && attackers.some(a => atWar(s, a.owner, dv.owner)));
  if (!left.length) {
    const winners = attackers.filter(a => a.org > .05);
    if (winners.length) {
      capture(s, d, rid, winners[0].owner, log);
      for (const a of winners) { a.at = rid; const then = a.order && a.order.then; a.order = null; if (then && then !== rid) orderMove(s, d, a, then); }
    }
  }
}

/** 점령: 통제국이 바뀐다. 승점·수도·항복은 정치 모듈이 확인한다. */
export function capture(s, d, rid, cid, log) {
  const st = s.regions[rid], X = index(d), r = X.regions.get(rid);
  if (st.controller === cid) return;
  const prev = st.controller;
  // 해방: 원래 주인이 같은 편이면 원래 주인에게 돌려준다
  const to = st.owner !== prev && friendly(s, cid, st.owner) && s.countries[st.owner].exists ? st.owner : cid;
  st.controller = to;
  // 남아 있던 다른 나라 사단(이동 중이던 적)은 물러난다
  for (const dv of s.divisions) if (dv.at === rid && atWar(s, dv.owner, to)) { const back = r.adj.find(n => passable(s, dv.owner, n)); if (back) dv.at = back; else dv.str = 0; }
  s.captured.push({ region: rid, from: prev, to, day: s.day });
  if (r.vp >= 5 || s.countries[to].playable || s.countries[prev].playable) log(`${s.countries[to].short}이(가) ${r.name}을(를) 점령했습니다.`, to, 'capture', { region: rid, from: prev });
}

/* ---------- 항공 ---------- */
/** 항공 구역(또는 해역)에서 나라별 제공권(0~1)과 근접 지원 위력. */
export function airSupport(s, d, zone) {
  const m = (s.airSup || {})[zone] || {};
  return {
    sup: cid => { let mine = 0, enemy = 0; for (const [k, v] of Object.entries(m)) { if (k === cid || friendly(s, cid, k)) mine += v.fighter; else if (atWar(s, cid, k)) enemy += v.fighter; } return mine + enemy > 0 ? mine / (mine + enemy) : .5; },
    bonus: cid => { let v = 0, enemyF = 0, mineF = 0; for (const [k, x] of Object.entries(m)) { if (k === cid || friendly(s, cid, k)) { v += x.ground; mineF += x.fighter; } else if (atWar(s, cid, k)) enemyF += x.fighter; } const sup = mineF + enemyF > 0 ? mineF / (mineF + enemyF) : .5; return v * sup; }
  };
}
export function wingInRange(s, d, w) {
  const X = index(d), base = X.regions.get(w.base); if (!base || base.offmap || !w.zone) return false;
  const z = X.airZones.get(w.zone) || X.seas.get(w.zone); if (!z) return false;
  const c = z.center || z.label;
  return Math.hypot(c[0] - base.label[0], c[1] - base.label[1]) <= d.aircraft[w.type].range;
}
export function dailyAir(s, d, log) {
  const X = index(d);
  s.airSup = {};
  const byZone = new Map();
  for (const w of s.air) {
    if (w.count <= 0 || w.mission === 'idle' || !w.zone) continue;
    if (!passable(s, w.owner, w.base) || !wingInRange(s, d, w)) continue;
    if (!byZone.has(w.zone)) byZone.set(w.zone, []);
    byZone.get(w.zone).push(w);
  }
  for (const [zone, wings] of byZone) {
    const m = (s.airSup[zone] = {});
    for (const w of wings) {
      const c = s.countries[w.owner], M = mods(s, d, c), A = d.aircraft[w.type], lv = Math.max(1, M.equipment[w.type] || 1), fuel = clamp(c.rates.fuel, .2, 1);
      const o = m[w.owner] || (m[w.owner] = { fighter: 0, ground: 0, strat: 0, naval: 0 });
      const n = w.count * lv * fuel * weatherOf(s, d, zone).air;
      if (w.mission === 'superiority' && w.type === 'fighter') o.fighter += n * A.air * (1 + M.air.air);
      else if (w.mission === 'cas') { o.ground += n * A.ground * (1 + M.air.ground); if (w.type === 'fighter') o.fighter += n * A.air * .5; }
      else if (w.mission === 'strategic') o.strat += n * A.strat * (1 + M.air.strat);
      else if (w.mission === 'naval_strike') o.naval += n * A.naval * (1 + M.air.naval);
    }
    // 공중전 손실
    for (const w of wings) {
      let enemyF = 0, mineF = 0;
      for (const [k, v] of Object.entries(m)) { if (atWar(s, w.owner, k)) enemyF += v.fighter; else if (friendly(s, w.owner, k)) mineF += v.fighter; }
      if (enemyF <= 0) continue;
      const M = mods(s, d, s.countries[w.owner]), def = d.aircraft[w.type].defense * (1 + M.air.defense);
      const lossRate = clamp(.012 * enemyF / Math.max(50, mineF + def * w.count * .3), 0, .08);
      const lost = Math.min(w.count, Math.max(0, Math.round(w.count * lossRate + rand(s) * .5)));
      if (lost) { w.count -= lost; w.lost = (w.lost || 0) + lost; }
    }
    // 전략 폭격: 적이 통제하는 건물이 망가진다(공장·기반 시설의 산출이 줄어든다)
    const z = X.airZones.get(zone);
    if (z) for (const [cid, v] of Object.entries(m)) {
      if (!v.strat) continue;
      const sup = airSupport(s, d, zone).sup(cid);
      for (const rid of z.regions) { const st = s.regions[rid]; if (atWar(s, cid, st.controller)) st.damage = round(clamp((st.damage || 0) + v.strat * sup * 3e-5, 0, .6), 4); }
    }
    // 함대 공격
    if (X.seas.has(zone)) for (const [cid, v] of Object.entries(m)) {
      if (!v.naval) continue;
      const sup = airSupport(s, d, zone).sup(cid);
      for (const f of s.fleets) if (f.at === zone && atWar(s, cid, f.owner)) damageFleet(s, d, f, v.naval * sup * .04 / Math.max(1, aaOf(s, d, f) / 20), log);
    }
  }
  // 폭격당하지 않은 곳은 천천히 복구된다
  for (const st of Object.values(s.regions)) if (st.damage) st.damage = round(Math.max(0, st.damage - .004), 4);
}

/* ---------- 해군 ---------- */
const shipPower = (d, M, k, n, fuel) => { const sh = d.ships.find(x => x.id === k), lv = Math.max(1, M.ship[k] || 1); return n * lv * fuel * (sh.gun * (1 + M.naval.gun) + sh.torp * (1 + M.naval.torp) + sh.air * (1 + M.naval.air) + sh.hp / 20); };
export function fleetStrength(s, d, f) {
  const c = s.countries[f.owner], M = mods(s, d, c), fuel = clamp(c.rates.fuel, .2, 1);
  let v = 0; for (const [k, n] of Object.entries(f.ships)) if (k !== 'convoy' && k !== 'submarine') v += shipPower(d, M, k, n, fuel);
  if (f.mission === 'raid') v += (f.ships.submarine || 0) * 4; else v += shipPower(d, M, 'submarine', f.ships.submarine || 0, fuel) * .5;
  return v;
}
const aaOf = (s, d, f) => sum(Object.entries(f.ships).map(([k, n]) => d.ships.find(x => x.id === k).aa * n)) * (1 + mods(s, d, s.countries[f.owner]).naval.aa);
export function damageFleet(s, d, f, dmg, log) {
  if (dmg <= 0) return;
  const types = Object.entries(f.ships).filter(([, n]) => n > 0);
  const total = sum(types.map(([k, n]) => d.ships.find(x => x.id === k).hp * n)) || 1;
  f.damage = f.damage || {};
  for (const [k, n] of types) {
    const hp = d.ships.find(x => x.id === k).hp;
    f.damage[k] = round((f.damage[k] || 0) + dmg * hp * n / total, 3);
    while (f.damage[k] >= hp && f.ships[k] > 0) {
      f.damage[k] = round(f.damage[k] - hp, 3); f.ships[k] -= 1; f.sunk = f.sunk || {}; f.sunk[k] = (f.sunk[k] || 0) + 1;
      if (k !== 'convoy') { const c = s.countries[f.owner]; c.shipsLost = (c.shipsLost || 0) + 1; if (['battleship', 'carrier'].includes(k)) log(`${c.short}의 ${d.ships.find(x => x.id === k).name} 한 척이 ${f.name}에서 침몰했습니다.`, f.owner, 'naval'); }
    }
  }
}
export function dailyNaval(s, d, log) {
  const X = index(d);
  // 이동
  for (const f of s.fleets) {
    if (!f.path || !f.path.length) continue;
    const next = f.path[0], days = Math.max(.5, distance(d, f.at, next) / 55) / (weatherOf(s, d, next).naval < .5 ? .6 : 1);
    f.progress = round((f.progress || 0) + 1 / days, 4);
    if (f.progress >= 1) { f.at = next; f.path.shift(); f.progress = 0; if (X.regions.has(next)) { f.mission = 'port'; f.path = []; } }
  }
  // 해상 우세
  s.navSup = {};
  for (const f of s.fleets) {
    if (!X.seas.has(f.at) || f.mission === 'port') continue;
    const m = s.navSup[f.at] || (s.navSup[f.at] = {});
    m[f.owner] = (m[f.owner] || 0) + fleetStrength(s, d, f);
  }
  for (const m of Object.values(s.navSup)) { const t = sum(Object.values(m)) || 1; for (const k of Object.keys(m)) m[k] = round(m[k] / t, 4); }
  // 태풍: 바다 위 함대가 손상된다
  for (const f of s.fleets) { if (!X.seas.has(f.at) || f.mission === 'port') continue; const w = weatherOf(s, d, f.at); if (w.fleetDamage) { const hp = sum(Object.entries(f.ships).map(([k, n]) => d.ships.find(x => x.id === k).hp * n)); damageFleet(s, d, f, hp * w.fleetDamage * (.5 + rand(s)), log); } }
  // 해전: 같은 해역의 적대 함대
  const bySea = new Map();
  for (const f of s.fleets) if (X.seas.has(f.at) && f.mission !== 'port') { if (!bySea.has(f.at)) bySea.set(f.at, []); bySea.get(f.at).push(f); }
  s.navalBattles = [];
  for (const [sea, list] of bySea) {
    for (const f of list) {
      const foes = list.filter(g => atWar(s, f.owner, g.owner));
      if (!foes.length) continue;
      const M = mods(s, d, s.countries[f.owner]), fuel = clamp(s.countries[f.owner].rates.fuel, .2, 1);
      let fire = 0; for (const [k, n] of Object.entries(f.ships)) { const sh = d.ships.find(x => x.id === k), lv = Math.max(1, M.ship[k] || 1); fire += n * lv * fuel * (sh.gun * (1 + M.naval.gun) + sh.torp * (1 + M.naval.torp) + sh.air * (1 + M.naval.air)); }
      if (f.mission === 'raid') fire *= .4;
      fire *= weatherOf(s, d, sea).naval * admiralMods(s, d, f).fire;
      const foeHp = sum(foes.map(g => fleetStrength(s, d, g))) || 1;
      for (const g of foes) {
        const share = fleetStrength(s, d, g) / foeHp, detect = g.mission === 'raid' ? clamp(.25 + sum(Object.entries(f.ships).map(([k, n]) => (d.ships.find(x => x.id === k).asw) * n)) / 200, .1, .9) : 1;
        damageFleet(s, d, g, fire * share * .05 * detect * (.8 + rand(s) * .4), log);
      }
      s.navalBattles.push({ sea, fleet: f.id, owner: f.owner });
    }
  }
  // 항구의 함대는 수리된다
  for (const f of s.fleets) if (f.mission === 'port' && f.damage) for (const k of Object.keys(f.damage)) f.damage[k] = round(Math.max(0, f.damage[k] - d.ships.find(x => x.id === k).hp * .02), 3);
  s.fleets = s.fleets.filter(f => sum(Object.values(f.ships)) > 0);
  // 봉쇄: 내 항구에 닿은 해역에서 적 잠수함·순찰의 위력 대 내 호위
  for (const c of Object.values(s.countries)) {
    if (!c.exists) continue;
    const zones = new Set();
    for (const r of d.regions) { const st = s.regions[r.id]; if (st.controller === c.id && st.port > 0) for (const z of r.coast) zones.add(z); if (r.offmap && st.controller === c.id && r.link.sea) zones.add(r.link.sea); }
    let raid = 0, escort = 0;
    for (const f of s.fleets) {
      if (!zones.has(f.at)) continue;
      if (atWar(s, c.id, f.owner)) raid += (f.ships.submarine || 0) * 6 * (1 + mods(s, d, s.countries[f.owner]).naval.raid) * admiralMods(s, d, f).raid * (f.mission === 'raid' ? 1 : .3) + (f.mission === 'patrol' ? fleetStrength(s, d, f) * .05 : 0);
      else if (f.owner === c.id || friendly(s, c.id, f.owner)) escort += (f.ships.destroyer || 0) * 4 * (f.mission === 'escort' ? 1.5 : .5);
    }
    const target = zones.size ? clamp(raid / (raid + escort + 60), 0, .75) : 0;
    c.blockade = round((c.blockade || 0) + (target - (c.blockade || 0)) * .1, 4);
  }
}
export function orderFleet(s, d, f, dest) {
  const X = index(d), start = X.seas.has(f.at) ? f.at : (X.seaByCoast.get(f.at) || [])[0] || (X.regions.get(f.at)?.link?.sea);
  if (!start) return { ok: false, reason: '바다로 나갈 수 없습니다.' };
  const goal = X.seas.has(dest) ? dest : null, port = X.regions.has(dest) ? dest : null;
  if (port && !(s.regions[port].port > 0 && friendly(s, f.owner, s.regions[port].controller))) return { ok: false, reason: '아군 항구가 아닙니다.' };
  const targets = goal ? [goal] : X.regions.get(port).offmap ? [X.regions.get(port).link.sea] : X.seaByCoast.get(port) || [];
  const prev = new Map([[start, null]]), q = [start];
  let hit = null;
  while (q.length) { const z = q.shift(); if (targets.includes(z)) { hit = z; break; } for (const n of X.seas.get(z).adj) if (!prev.has(n)) { prev.set(n, z); q.push(n); } }
  if (!hit) return { ok: false, reason: '가는 바닷길이 없습니다.' };
  const path = []; for (let z = hit; z && z !== start; z = prev.get(z)) path.unshift(z);
  if (X.regions.has(f.at)) path.unshift(start);
  if (port) path.push(port);
  f.path = path; f.progress = 0; if (f.mission === 'port') f.mission = 'patrol';
  return { ok: true, days: Math.round(path.length * 1.5) };
}

/* ---------- 장군·제독 ---------- */
const NO_LEADER = { atk: 1, def: 1, brk: 1, recovery: 0, supply: 1, fort: 1, cold: false, amphibious: false };
/** 사단이 속한 군의 장군이 주는 보정. terrain을 주면 지형 특성도 더한다. */
let ARMY_CACHE = { ref: null, len: -1, map: new Map() };
export function leaderMods(s, d, dv, terrain) {
  if (!dv.army) return NO_LEADER;
  if (ARMY_CACHE.ref !== s.armies || ARMY_CACHE.len !== s.armies.length) ARMY_CACHE = { ref: s.armies, len: s.armies.length, map: new Map(s.armies.map(x => [x.id, x])) };
  const a = ARMY_CACHE.map.get(dv.army);
  const L = a && a.leader && s.leaders[a.leader];
  if (!L) return NO_LEADER;
  const has = k => L.traits.includes(k);
  let atk = 1 + L.atk * .04, def = 1 + L.def * .04;
  if (has('offensive')) { atk += .1; def -= .05; }
  if (has('defensive')) def += .1;
  if (terrain && has('jungle') && (terrain === 'j' || terrain === 's')) { atk += .15; def += .15; }
  if (terrain && has('mountain') && (terrain === 'm' || terrain === 'h')) { atk += .15; def += .15; }
  if (terrain && has('guerrilla') && ['m', 'f', 'j'].includes(terrain)) { atk += .1; def += .1; }
  return { atk, def, brk: has('armor') ? 1.15 : 1, recovery: L.plan * .05, supply: 1 - L.log * .03 - (has('logistics') ? .15 : 0) - (has('guerrilla') ? .2 : 0), fort: has('defensive') ? 1.5 : 1, cold: has('cold'), amphibious: has('amphibious') };
}
export function admiralMods(s, d, f) {
  const L = f.leader && s.leaders[f.leader];
  if (!L) return { fire: 1, raid: 1 };
  const has = k => L.traits.includes(k);
  let fire = 1 + L.atk * .04;
  if (has('surface')) fire += .15; if (has('carrier') && (f.ships.carrier || 0) > 0) fire += .2;
  return { fire, raid: has('submarine') ? 1.3 : 1 };
}
/** 지금 쓸 수 있는 장군인가(기간·표식·나라). */
export function leaderAvailable(s, d, id) {
  const L = s.leaders[id], def = index(d).leaders.get(id);
  if (!L || !def) return false;
  const c = s.countries[L.country]; if (!c || !c.exists) return false;
  if (def.from && s.day < dayOfISO(def.from)) return false;
  if (def.until && s.day >= dayOfISO(def.until)) return false;
  if (def.flag && !s.flags[def.flag]) return false;
  return true;
}
const dayOfISO = iso => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1936, 0, 1)) / 864e5);
/** 매일: 군과 장군을 정리하고 전투한 군의 장군이 경험을 얻는다. */
export function dailyLeaders(s, d, log) {
  const alive = new Set(s.divisions.map(dv => dv.id));
  for (const a of s.armies) a.divisions = a.divisions.filter(id => alive.has(id));
  for (const a of s.armies) {
    if (a.leader && !leaderAvailable(s, d, a.leader)) { if (a.owner === s.player) log(`${s.leaders[a.leader].name}이(가) 지휘에서 물러났습니다.`, a.owner, 'military'); s.leaders[a.leader].army = null; a.leader = null; }
  }
  for (const f of s.fleets) if (f.leader && (!leaderAvailable(s, d, f.leader) || s.leaders[f.leader].country !== f.owner)) { s.leaders[f.leader].fleet = null; f.leader = null; }
  for (const L of Object.values(s.leaders)) if (L.fleet && !s.fleets.some(f => f.id === L.fleet)) L.fleet = null;
  const gone = s.armies.filter(a => !a.divisions.length);
  for (const a of gone) { if (a.leader) s.leaders[a.leader].army = null; }
  s.armies = s.armies.filter(a => a.divisions.length);
  const inBattle = new Set(); for (const b of Object.values(s.battles || {})) for (const id of [...b.attackers, ...b.defenders]) inBattle.add(id);
  for (const a of s.armies) {
    if (!a.leader || !a.divisions.some(id => inBattle.has(id))) continue;
    const L = s.leaders[a.leader]; L.xp = round((L.xp || 0) + .005, 4);
    if (L.xp >= 1 + L.skill * .4 && L.skill < 6) {
      L.xp = 0; L.skill += 1; const k = ['atk', 'def', 'plan', 'log'][Math.floor(rand(s) * 4)]; L[k] = Math.min(7, L[k] + 1);
      if (a.owner === s.player) log(`${L.name}의 지휘 능력이 올랐습니다(${L.skill}단계).`, a.owner, 'military');
    }
  }
  for (const f of s.fleets) { if (!f.leader) continue; if ((s.navalBattles || []).some(b => b.fleet === f.id)) { const L = s.leaders[f.leader]; L.xp = round((L.xp || 0) + .01, 4); if (L.xp >= 1 + L.skill * .4 && L.skill < 6) { L.xp = 0; L.skill += 1; L.atk = Math.min(7, L.atk + 1); } } }
}
/** 사단들로 군을 만든다(이전 군에서 빼 온다). 쓸 수 있는 장군이 있으면 가장 능력이 높은 장군을 붙인다. */
export function formArmy(s, d, cid, ids, name, leaderId) {
  const list = s.divisions.filter(dv => ids.includes(dv.id) && dv.owner === cid);
  if (!list.length) return { ok: false, reason: '사단을 고르세요.' };
  if (list.length > 24) return { ok: false, reason: '한 군에는 24개 사단까지입니다.' };
  for (const a of s.armies) a.divisions = a.divisions.filter(id => !ids.includes(id));
  const a = { id: `ar${(s.seq = (s.seq || 0) + 1)}`, owner: cid, name: name || `제${s.armies.filter(x => x.owner === cid).length + 1}군`, leader: null, divisions: list.map(dv => dv.id) };
  s.armies.push(a);
  for (const dv of list) dv.army = a.id;
  const lead = leaderId || freeLeaders(s, d, cid, 'army')[0]?.id;
  if (lead) assignLeader(s, d, cid, a.id, lead);
  return { ok: true, id: a.id };
}
export const freeLeaders = (s, d, cid, kind) => Object.values(s.leaders).filter(L => L.country === cid && L.kind === kind && !L.army && !L.fleet && leaderAvailable(s, d, L.id)).sort((a, b) => b.skill - a.skill || (b.atk + b.def) - (a.atk + a.def));
export function assignLeader(s, d, cid, armyId, leaderId) {
  const a = s.armies.find(x => x.id === armyId && x.owner === cid); if (!a) return { ok: false, reason: '없는 군입니다.' };
  if (leaderId === null) { if (a.leader) s.leaders[a.leader].army = null; a.leader = null; return { ok: true }; }
  const L = s.leaders[leaderId];
  if (!L || L.country !== cid || L.kind !== 'army') return { ok: false, reason: '이 나라의 장군이 아닙니다.' };
  if (!leaderAvailable(s, d, leaderId)) return { ok: false, reason: '지금은 지휘할 수 없는 장군입니다.' };
  if (L.army) { const old = s.armies.find(x => x.id === L.army); if (old) old.leader = null; }
  if (a.leader) s.leaders[a.leader].army = null;
  a.leader = leaderId; L.army = a.id;
  return { ok: true };
}
export function assignAdmiral(s, d, cid, fleetId, leaderId) {
  const f = s.fleets.find(x => x.id === fleetId && x.owner === cid); if (!f) return { ok: false, reason: '없는 함대입니다.' };
  if (leaderId === null) { if (f.leader) s.leaders[f.leader].fleet = null; f.leader = null; return { ok: true }; }
  const L = s.leaders[leaderId];
  if (!L || L.country !== cid || L.kind !== 'navy') return { ok: false, reason: '이 나라의 제독이 아닙니다.' };
  if (!leaderAvailable(s, d, leaderId)) return { ok: false, reason: '지금은 지휘할 수 없는 제독입니다.' };
  if (L.fleet) { const old = s.fleets.find(x => x.id === L.fleet); if (old) old.leader = null; }
  if (f.leader) s.leaders[f.leader].fleet = null;
  f.leader = leaderId; L.fleet = f.id;
  return { ok: true };
}
