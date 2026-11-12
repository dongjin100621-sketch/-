/* 전선과 공장 — 교통: 철도·도로·강의 배길, 강 건너기, 철도의 손상과 복구, 철도 건설.
 * 노선의 원본은 data/game.json의 transport(1936~1945년의 실제 노선을 지역 단위로 묶은 것)이고,
 * 게임 중에 놓거나 늘린 노선과 손상은 상태의 s.rail[노선 ID] = { lvl, dmg }에 둔다. */
import { index, pairKey, distance, rand, round, clamp, dayOf } from './core.mjs';

const OPEN = new WeakMap();
const openDay = (d, L) => { let m = OPEN.get(d); if (!m) { m = new Map(); OPEN.set(d, m); } if (!m.has(L.id)) m.set(L.id, L.open ? dayOf(L.open) : -Infinity); return m.get(L.id); };
let CACHE = { s: null, d: null, day: -1, ver: -1, v: null };

/** 오늘 쓸 수 있는 노선(개통했고 등급이 1 이상). { list, byPair: Map(쌍 → [노선]), byRegion: Map(지역 → [노선]) } */
export function transportLinks(s, d) {
  const ver = s.railVer || 0;
  if (CACHE.s === s && CACHE.d === d && CACHE.day === s.day && CACHE.ver === ver) return CACHE.v;
  const R = d.transportRules, rail = s.rail || {}, list = [], seen = new Set();
  const add = (base, st) => {
    const lvl = Math.max(st?.lvl || 0, base && s.day >= openDay(d, base) ? base.lvl : 0);
    seen.add(base ? base.id : st.id);
    if (lvl <= 0) return;
    const b = base || st;
    list.push({ id: b.id, a: b.a, b: b.b, kind: b.kind, lvl, dmg: st?.dmg || 0, name: base ? base.name : (R[b.kind].name + '(새 노선)'), built: !base });
  };
  for (const L of d.transport || []) add(L, rail[L.id]);
  for (const [id, st] of Object.entries(rail)) if (!seen.has(id) && st.a) add(null, { ...st, id });
  const byPair = new Map(), byRegion = new Map();
  for (const L of list) {
    const k = pairKey(L.a, L.b); if (!byPair.has(k)) byPair.set(k, []); byPair.get(k).push(L);
    for (const r of [L.a, L.b]) { if (!byRegion.has(r)) byRegion.set(r, []); byRegion.get(r).push(L); }
  }
  const v = { list, byPair, byRegion };
  CACHE = { s, d, day: s.day, ver, v };
  return v;
}
export const linksBetween = (s, d, a, b) => transportLinks(s, d).byPair.get(pairKey(a, b)) || [];
export const linksAt = (s, d, r) => transportLinks(s, d).byRegion.get(r) || [];
export const hasRail = (s, d, r) => linksAt(s, d, r).some(L => L.kind === 'rail');
/** 노선 하나가 하루에 실어 나르는 보급(손상·날씨 반영 전). */
export const linkCap = (d, L) => d.transportRules[L.kind].cap[Math.min(L.lvl, d.transportRules[L.kind].cap.length - 1)];
/** 두 지역 사이의 강: 'large' | 'small' | null. */
export const crossingOf = (d, a, b) => (d.crossings || {})[pairKey(a, b)] || null;
export const CROSSING_NAME = { large: '큰 강', small: '강' };

/** 노선의 상태(없으면 만든다). */
function railState(s, L) {
  s.rail = s.rail || {};
  return s.rail[L.id] || (s.rail[L.id] = { lvl: 0, dmg: 0 });
}
/** 점령: 그 지역에 닿는 노선이 끊긴다(물러나는 쪽이 다리와 선로를 끊는다고 본다). */
export function damageLinksAt(s, d, rid, amount = d.transportRules.captureDamage) {
  for (const L of linksAt(s, d, rid)) { if (L.kind === 'river') continue; const st = railState(s, L); st.dmg = round(Math.max(st.dmg || 0, amount), 3); }
  s.railVer = (s.railVer || 0) + 1;
}
/** 하루: 같은 편이 양 끝을 쥔 노선은 복구된다. 유격 활동이 있는 점령지의 노선은 가끔 끊긴다.
 * same(a, b): 두 지역의 통제국이 같은 편인가. guerrilla(rid): 그 지역에서 유격 활동의 세기(0~1). */
export function dailyRail(s, d, same, guerrilla) {
  const R = d.transportRules; let changed = false;
  for (const L of transportLinks(s, d).list) {
    if (L.kind === 'river') continue;
    const g = Math.max(guerrilla(L.a), guerrilla(L.b));
    if (g > 0 && rand(s) < R.sabotage * g) { const st = railState(s, L); st.dmg = round(Math.min(1, (st.dmg || 0) + R.sabotageDamage), 3); changed = true; continue; }
    if (L.dmg > 0 && same(L.a, L.b)) { const st = railState(s, L); st.dmg = round(Math.max(0, st.dmg - R.repairPerDay), 3); changed = true; }
  }
  if (changed) s.railVer = (s.railVer || 0) + 1;
}
/** 지금 등급(없으면 0)과 노선 ID. */
export function railLevel(s, d, a, b) {
  const L = linksBetween(s, d, a, b).find(x => x.kind === 'rail');
  return { lvl: L ? L.lvl : 0, id: `${pairKey(a, b)}:rail`, dmg: L ? L.dmg : 0 };
}
/** 철도 한 등급을 놓는 데 드는 건설점. 거리·지형이 클수록 비싸다. */
export function railCost(s, d, a, b) {
  const X = index(d), ta = d.terrain[X.regions.get(a).terrain], tb = d.terrain[X.regions.get(b).terrain];
  const next = railLevel(s, d, a, b).lvl + 1;
  return Math.round(d.transportRules.rail.cost * clamp(distance(d, a, b) / 90, .6, 2.2) * (ta.move + tb.move) / 2 * (next === 1 ? 1.4 : 1));
}
/** 철도를 놓을 수 없는 까닭(없으면 ''). */
export function railReason(s, d, cid, a, b) {
  const X = index(d), ra = X.regions.get(a), rb = X.regions.get(b);
  if (!ra || !rb || ra.offmap || rb.offmap) return '지도 위의 지역만 잇습니다.';
  if (!ra.adj.includes(b)) return '맞닿은 지역끼리만 잇습니다.';
  if (s.regions[a].controller !== cid || s.regions[b].controller !== cid) return '두 지역을 모두 통제해야 합니다.';
  const lv = railLevel(s, d, a, b).lvl, q = s.countries[cid].construction.filter(x => x.kind === 'rail' && pairKey(x.region, x.to) === pairKey(a, b)).length;
  if (lv + q >= d.transportRules.rail.max) return `철도는 ${d.transportRules.rail.max}등급까지입니다.`;
  return '';
}
/** 건설이 끝난 철도 한 등급을 올린다. */
export function finishRail(s, d, a, b) {
  const { lvl, id } = railLevel(s, d, a, b);
  s.rail = s.rail || {};
  const st = s.rail[id] || (s.rail[id] = { lvl: 0, dmg: 0 });
  st.lvl = Math.max(st.lvl || 0, lvl) + 1; st.dmg = 0;
  if (!(d.transport || []).some(L => L.id === id)) { st.a = a < b ? a : b; st.b = a < b ? b : a; st.kind = 'rail'; }
  s.railVer = (s.railVer || 0) + 1;
}
