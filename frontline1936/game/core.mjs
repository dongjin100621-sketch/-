/* 전선과 공장: 동아시아 1936 — 공용 도구와 색인, 나라별 보정값.
 * 의존성 없는 순수 모듈. DOM·저장소·네트워크를 쓰지 않는다. 난수는 상태 안의 씨앗으로만 만든다. */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const round = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n + 0;
export const sum = arr => arr.reduce((a, b) => a + b, 0);
export const finite = v => typeof v === 'number' && Number.isFinite(v);

/* 날짜: 0일 = 1936년 1월 1일. */
const EPOCH = Date.UTC(1936, 0, 1);
export const dateOf = day => { const t = new Date(EPOCH + day * 864e5); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), w: t.getUTCDay() }; };
export const dayOf = iso => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - EPOCH) / 864e5);
export const yearOf = day => dateOf(day).y;
export const isMonthStart = day => dateOf(day).d === 1;
export const fmtDate = day => { const t = dateOf(day); return `${t.y}년 ${t.m}월 ${t.d}일`; };
export const END_DAY = dayOf('1945-12-31');

/* 결정적 난수(mulberry32). 상태의 rng 값을 바꾸며 0~1 수를 낸다. */
export function rand(s) {
  let t = (s.rng = (s.rng + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const INDEX = new WeakMap();
/** 데이터 색인. 데이터 객체마다 한 번 만든다. */
export function index(d) {
  let x = INDEX.get(d);
  if (x) return x;
  const map = list => new Map(list.map(v => [v.id, v]));
  x = {
    goods: map(d.goods), buildings: map(d.buildings), facilities: map(d.facilities), equipment: map(d.equipment), battalions: map(d.battalions),
    templates: map(d.templates), ships: map(d.ships), techs: map(d.techs), countries: map(d.countries), regions: map(d.regions), seas: map(d.seas),
    airZones: map(d.airZones), events: map(d.events), factions: map(d.factions),
    focus: new Map(Object.values(d.focusTrees).flat().map(f => [f.id, f])),
    lawOption: new Map(Object.values(d.laws).flatMap(g => g.options.map(o => [o.id, o]))),
    seaByCoast: new Map(), dist: new Map()
  };
  for (const s of d.seas) for (const r of s.coast) { if (!x.seaByCoast.has(r)) x.seaByCoast.set(r, []); x.seaByCoast.get(r).push(s.id); }
  INDEX.set(d, x);
  return x;
}
/** 두 지역(또는 해역)의 지도상 거리. 지도 밖 본국은 연결된 진입점의 거리로 대신한다. */
export function distance(d, a, b) {
  const X = index(d), key = a < b ? `${a}|${b}` : `${b}|${a}`;
  let v = X.dist.get(key);
  if (v !== undefined) return v;
  const pt = id => { const r = X.regions.get(id) || X.seas.get(id); if (!r) return null; if (r.label) return r.label; const l = r.link; return l ? pt(l.port || l.land[0]) : null; };
  const p = pt(a), q = pt(b);
  v = p && q ? Math.hypot(p[0] - q[0], p[1] - q[1]) : 0;
  X.dist.set(key, v);
  return v;
}

/* ---------- 나라별 보정값: 국가 정신·법·기술 ---------- */
const BASE_MODS = () => ({
  pp: 0, research: 0, construction: 0, stability: 0, warSupport: 0, warSupportCap: 100, factory: 0, tax: 0, arms: 0, armsBuild: 0, consumption: 0, manpower: 0, labor: 0,
  tradeCap: 0, org: 0, defense: 0, supplyUse: 0, deployTime: 0, colonyOutput: 0, enemySupply: 0, resource: 0, recovery: 0, manpowerUse: 0, efficiencyCap: 0,
  noWar: false, homeLocked: false, fortBonus: {}, stat: {}, terrain: {}, equipment: {}, ship: {}, naval: { gun: 0, torp: 0, air: 0, aa: 0, raid: 0, detect: 0 }, air: { air: 0, ground: 0, naval: 0, strat: 0, defense: 0 },
  unlock: new Set(), pms: new Set(), buildingsUnlocked: new Set()
});
function addFx(m, fx) {
  for (const [k, v] of Object.entries(fx || {})) {
    if (k === 'warSupportCap') m.warSupportCap = Math.min(m.warSupportCap, v);
    else if (k === 'noWar' || k === 'homeLocked') m[k] = m[k] || v;
    else if (k === 'fortBonus') for (const [r, b] of Object.entries(v)) m.fortBonus[r] = (m.fortBonus[r] || 0) + b;
    else if (k === 'stat') for (const [b, o] of Object.entries(v)) { m.stat[b] = m.stat[b] || {}; for (const [s, x] of Object.entries(o)) m.stat[b][s] = (m.stat[b][s] || 0) + x; }
    else if (k === 'terrain') for (const [t, x] of Object.entries(v)) m.terrain[t] = (m.terrain[t] || 0) + x;
    else if (k === 'equipment') for (const [e, x] of Object.entries(v)) m.equipment[e] = Math.max(m.equipment[e] || 0, x);
    else if (k === 'ship') for (const [e, x] of Object.entries(v)) m.ship[e] = Math.max(m.ship[e] || 0, x);
    else if (k === 'naval' || k === 'air') for (const [e, x] of Object.entries(v)) m[k][e] = (m[k][e] || 0) + x;
    else if (k === 'unlock') m.unlock.add(v);
    else if (k === 'pm') m.pms.add(v);
    else if (k === 'building') m.buildingsUnlocked.add(v);
    else if (typeof v === 'number') m[k] = (m[k] || 0) + v;
  }
}
/** 나라 c의 보정값(정신 + 현행 법 + 연구한 기술). 하루 안에서는 같으므로 캐시한다. */
export function mods(s, d, c) {
  const key = `${s.day}|${c.spirits.join(',')}|${Object.values(c.laws).join(',')}|${c.research.done.length}`;
  if (c._modsKey === key && c._mods) return c._mods;
  const X = index(d), m = BASE_MODS();
  for (const id of c.spirits) addFx(m, d.spirits[id]?.fx);
  // 법의 효과는 쓰는 곳(경제·인력·안정도)에서 직접 읽는다. 여기서 더하면 두 번 셈한다.
  for (const id of c.research.done) addFx(m, X.techs.get(id)?.fx);
  Object.defineProperty(c, '_mods', { value: m, enumerable: false, writable: true, configurable: true });
  Object.defineProperty(c, '_modsKey', { value: key, enumerable: false, writable: true, configurable: true });
  return m;
}
export const law = (d, c, group) => index(d).lawOption.get(c.laws[group]);

/* ---------- 관계 ---------- */
export const pairKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
export const atWar = (s, a, b) => a !== b && s.wars.some(w => (w[0] === a && w[1] === b) || (w[0] === b && w[1] === a));
export const enemiesOf = (s, a) => s.wars.filter(w => w[0] === a || w[1] === a).map(w => (w[0] === a ? w[1] : w[0]));
export const isAtWar = (s, a) => s.wars.some(w => w[0] === a || w[1] === a);
/** 같은 편인가(같은 나라, 같은 진영, 종주국·괴뢰국, 군사 통행권). 전쟁 중이면 같은 편이 아니다. */
export function friendly(s, a, b) {
  if (a === b) return true;
  if (atWar(s, a, b)) return false;
  const A = s.countries[a], B = s.countries[b];
  if (!A || !B) return false;
  if (A.overlord === b || B.overlord === a || (A.overlord && A.overlord === B.overlord)) return true;
  if (A.faction && A.faction === B.faction) return true;
  if ((A.access || []).includes(b) || (B.access || []).includes(a)) return true;
  // 같은 적과 싸우는 공동 교전국
  const ea = enemiesOf(s, a), eb = enemiesOf(s, b);
  return ea.some(x => eb.includes(x));
}
