/* 대한민국 1960: 선택의 연대기 — 계산 엔진 v3 (게임 3.1.0, 데이터 2.1.0, 저장 형식 5)
 *
 * 의존성 없는 순수 모듈이다. DOM·localStorage·네트워크를 사용하지 않는다. 모든 수치는 게임 설계용 가상 값이다.
 *
 * v2에서 그대로인 것: 사건 큐와 난수(xorshift32), 하루 틱과 월 결산, 권한 단계, 정책·지역 시책·외교·자문·상환,
 *                    선거 주기, 엔딩 우선순위, 밸런스 규칙(체감·높아진 기대·권력 집중의 비용), dispatch/exportSave/importSave.
 * v3에서 바뀐 것(docs/SIMULATION_RULES.md "시장 경제"):
 *   1. 경제: 생산·고용·물가·세입이 시장(economy.mjs)에서 나온다. 상품 19종의 수급이 가격을 정한다.
 *   2. 건설: 사업(projects) 대신 단계형 건물과 건설 대기열. 건설점은 건설 부문이 만들고 정부와 민간이 나눠 쓴다.
 *   3. 법률: 분류마다 하나만 유효하다. 제정은 세 단계의 검사를 거치고, 집권 연합 안의 지지가 확률을 정한다.
 *   4. 이해집단: 노동자·농민·소시민·기업가·지주·군대. 세력은 인구와 법률에서, 지지도는 법률·요구·생활수준에서 나온다.
 *   5. 저장 형식 5. 이전 형식(1~4)은 경제 구조가 달라 불러올 수 없다.
 */
import * as EC from './economy.mjs';
export const econ = EC;
export const SAVE_VERSION = 5;
export const SAVE_FORMAT = 'KOREA1960_SAVE';
export const OLD_SAVE_MESSAGE = '이전 판(저장 형식 1~4)의 저장은 경제 구조가 달라 이 판에서 이어 할 수 없습니다.';
export const BUDGET_KEYS = ['industry', 'agriculture', 'education', 'welfare', 'infrastructure', 'security'];
export const PHASES = ['prelude', 'civilian', 'transition', 'elected', 'governing'];
export const EXECUTIVE_PHASES = ['transition', 'governing'];
export const PREPARE_PHASES = ['prelude', 'civilian', 'elected'];
export const TOTAL_TURNS = 240;
export const AP_PER_MONTH = 3;
export const MAX_ADVISERS = 2;
export const ADVISER_UPKEEP = 0.15;
export const PREPARE_INFLUENCE = 3;
export const FIRST_PERIODIC_ELECTION = 94; // 1967-11
export const ELECTION_INTERVAL = 48;
export const ELECTION_THRESHOLD = 45;
export const FISCAL_CRISIS_DEBT = 700;
export const CRISIS_ENDINGS = ['fiscal_crisis', 'legitimacy_crisis', 'rights_crisis'];
export const LAW_STAGES = ['committee', 'review', 'plenary'];
export const VIEWS = ['map', 'overview', 'market', 'build', 'laws', 'groups', 'policy', 'budget', 'diplomacy', 'cabinet', 'archive', 'economy'];
/** 이 데이터 판이 그대로 불러오는 이전 데이터 판. 상태 구조가 같고 화면·설명만 다르다(2.1.0은 국민 계정 환산만 더했다). */
export const COMPATIBLE_DATA = { '2.1.0': ['2.0.0'] };
/** 지역 시책 동시 개수 = EDICT_CAP_BASE + floor(행정 역량 / EDICT_CAP_ADMIN) + 법률 보정. */
export const EDICT_CAP_BASE = 2;
export const EDICT_CAP_ADMIN = 30;
export const DIPLOMACY_MODES = {
  talk: { label: '정례 대화', cost: 4, relation: 4, effects: { security: 1 } },
  technology: { label: '기술 교류', cost: 7, relation: 3, effects: { education: 2, reserves: -1 } },
  humanitarian: { label: '인도적 협력', cost: 5, relation: 5, effects: { legitimacy: 1, welfare: 1 } }
};
const FLAG_KEYS = ['route', 'won1963', 'constitutionalLimit', 'authoritarian'];
const HISTORY_KEYS = ['gdp', 'inflation', 'liberty', 'legitimacy', 'welfare', 'environment', 'unemployment'];
const MOD_LIMIT = 30;

const clone = x => JSON.parse(JSON.stringify(x));
const { clamp, finite, round } = EC;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function calendar(turn) { return { year: 1960 + Math.floor(turn / 12), month: turn % 12 + 1 }; }
export function dateLabel(turn) { const d = calendar(turn); return `${d.year}-${String(d.month).padStart(2, '0')}`; }
/** 그 달의 날 수(실제 달력, 1960·1964·1968·1972·1976년은 윤년). */
export function daysInMonth(turn) { const { year, month } = calendar(Math.min(turn, TOTAL_TURNS - 1)); return month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31; }
/** 'YYYY-MM-DD'. 상태의 날짜(turn, day)를 연대기 표기로. */
export function dayLabel(turn, day = 1) { return `${dateLabel(Math.min(turn, TOTAL_TURNS - 1))}-${String(day).padStart(2, '0')}`; }
/** 상태에 저장되는 32비트 xorshift. 엔진만 소비한다(UI는 소비하지 않는다). */
export function random(s) { let x = s.rng >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.rng = x >>> 0; return s.rng / 4294967296; }

function normalize(s, d) {
  for (const m of d.metrics) s.stats[m.id] = clamp(s.stats[m.id], m.min, m.max);
  for (const g of d.interestGroups) { s.support[g.id] = clamp(s.support[g.id], 0, 100); if (s.ig) s.ig[g.id].mod = clamp(s.ig[g.id].mod, -MOD_LIMIT, MOD_LIMIT); }
  for (const n of d.countries) s.relations[n.id] = clamp(s.relations[n.id], 0, 100);
  s.influence = clamp(s.influence, 0, 999);
  s.seats = clamp(s.seats, .05, .95);
}
function log(s, type, text, extra = {}) { s.log.push({ turn: s.turn, date: dayLabel(s.turn, s.day || 1), type, text, ...extra }); }
/* ---------- 밸런스 규칙(데이터의 balance 블록) ---------- */
/** 지표 id에 더해질 양(+) 효과의 배율. 음(-) 효과에는 쓰지 않는다.
 *  kind: 사건 선택의 효과일 때 사건 종류(가상 사건의 무비용 보너스 축소). 체감·사건 배율은 0~100 지수 지표(diminishing.metrics)에만 적용된다. */
export function gainScale(s, d, id, kind = null) {
  const b = d && d.balance; if (!b) return 1;
  let f = 1;
  const dim = b.diminishing, index = !!dim && dim.metrics.includes(id);
  if (index && kind && b.eventGain && finite(b.eventGain[kind])) f *= b.eventGain[kind];
  if (index && s.stats[id] > dim.from) f *= Math.max(dim.minFactor, (100 - s.stats[id]) / (100 - dim.from));
  const a = b.authoritarian;
  if (a && s.flags.authoritarian && a.gainFactor && Object.hasOwn(a.gainFactor, id)) f *= a.gainFactor[id];
  return f;
}
const scaled = (s, d, id, v, kind = null) => v > 0 && d && d.balance ? v * gainScale(s, d, id, kind) : v;
function apply(s, effects = {}, d = null, kind = null, factor = 1) {
  for (const [k, v] of Object.entries(effects)) {
    if (!Object.hasOwn(s.stats, k) || !finite(v)) throw new Error(`미등록 효과: ${k}`);
    s.stats[k] += scaled(s, d, k, v * factor, kind);
  }
}
/** 이해집단 지지 효과: 지지도를 바로 움직이고, 같은 크기의 보정이 남아 매월 조금씩 사라진다. */
function faction(s, e = {}) {
  for (const [k, v] of Object.entries(e)) {
    s.support[k] = clamp(s.support[k] + v, 0, 100);
    if (s.ig && s.ig[k]) s.ig[k].mod = clamp(s.ig[k].mod + v, -MOD_LIMIT, MOD_LIMIT);
  }
}
function setEnding(s, d, id) {
  if (s.ending) return;
  const e = d.endings.find(x => x.id === id);
  if (!e) throw new Error('엔딩 ID 오류');
  s.ending = { id: e.id, title: e.title, text: e.text, turn: s.turn };
  s.queue = [];
  log(s, 'ending', e.title);
}
export function matches(s, conditions = []) {
  return conditions.every(c => {
    if (c.phaseIn && !c.phaseIn.includes(s.phase)) return false;
    if (c.flag && s.flags[c.flag] !== c.eq) return false;
    if (c.yearGte && calendar(s.turn).year < c.yearGte) return false;
    if (c.yearLte && calendar(s.turn).year > c.yearLte) return false;
    if (c.metric) {
      const v = s.stats[c.metric];
      if (c.gte !== undefined && v < c.gte) return false;
      if (c.lte !== undefined && v > c.lte) return false;
    }
    return true;
  });
}
/** 현재 경로에 맞는 "이 캠페인에서는" 설명. 사건의 context 배열에서 조건이 맞는 첫 항목. */
export function eventContext(s, e) {
  const found = (e.context || []).find(x => matches(s, x.conditions));
  return found ? found.text : '';
}
function queueMonth(s, d) {
  const fixed = d.events.filter(e => e.date === dateLabel(s.turn) && matches(s, e.conditions));
  let events = fixed;
  if (!events.length) {
    let pool = d.events.filter(e => !e.date && matches(s, e.conditions) && (s.lastEvents[e.id] === undefined || s.turn - s.lastEvents[e.id] >= e.cooldown));
    if (!pool.length) pool = d.events.filter(e => !e.date && matches(s, e.conditions));
    events = pool.length ? [pool[Math.floor(random(s) * pool.length)]] : [];
  }
  s.queue = events.map(e => e.id);
  for (const e of events) s.lastEvents[e.id] = s.turn;
}

export function createState(d, seed = 196001) {
  const s = {
    version: SAVE_VERSION, gameId: d.meta.id, dataVersion: d.meta.version, turn: 0, day: 1,
    rng: (Number(seed) >>> 0) || 196001, phase: 'prelude', ap: AP_PER_MONTH, influence: 20, seats: .48,
    stats: Object.fromEntries(d.metrics.map(m => [m.id, m.initial])),
    support: {},
    relations: Object.fromEntries(d.countries.map(n => [n.id, n.initialRelation])),
    budget: { industry: 22, agriculture: 18, education: 16, welfare: 16, infrastructure: 16, security: 12 },
    policies: [], edicts: [], advisers: [], flags: {}, queue: [], lastEvents: {}, delayed: [],
    buildings: [], construction: [], laws: {}, enactment: null, government: [], ig: {}, econ: null,
    counters: { built: 0, privateBuilt: 0, resourceBuilt: 0, lawsEnacted: 0, lawsFailed: 0, regions: [] },
    history: [], log: [], ending: null, lastFinance: null, visited: [],
    report: null, monthActions: []
  };
  EC.createEconomy(s, d);
  const R = EC.compute(s, d), vote = EC.voteWeights(d, R);
  for (const g of d.interestGroups) s.ig[g.id].vote = round(vote[g.id], 4);
  log(s, 'start', '1960년 1월. 국정 지표를 관찰하며 공적 역할의 원칙을 준비한다.');
  queueMonth(s, d); snapshot(s);
  return s;
}
function snapshot(s) { s.history.push(Object.fromEntries([['turn', s.turn], ...HISTORY_KEYS.map(k => [k, s.stats[k]])])); }
/** 종합 지지도: 이해집단 지지도를 투표 비중(인구 비중)으로 평균한 값. 선거와 법률 제정에 쓴다. */
export function supportAverage(s, d) { return d.interestGroups.reduce((v, g) => v + s.support[g.id] * s.ig[g.id].vote, 0); }
export const isExecutive = s => EXECUTIVE_PHASES.includes(s.phase);

/* ---------- 권역: 지형·자원, 지역 시책 ---------- */
export function regionTags(d, regionId) { const r = d.regions.find(x => x.id === regionId); return r ? [...(r.terrain || []), ...(r.resources || [])] : []; }
/** requires(지형·자원 ID) 중 하나라도 권역에 있으면 true. 빈 목록이면 어느 권역이나. */
export function regionHas(d, regionId, requires) { if (!requires || !requires.length) return true; const tags = regionTags(d, regionId); return requires.some(t => tags.includes(t)); }
export const traitNames = (d, ids = []) => ids.map(id => ((d.traits || []).find(t => t.id === id) || { name: id }).name);
/** 받침에 따라 '이/가'. 사유 문장용. */
function iga(word) { const c = word.charCodeAt(word.length - 1) - 0xAC00; return word + (c >= 0 && c < 11172 && c % 28 ? '이' : '가'); }
export function edictCap(s, d) { return EDICT_CAP_BASE + Math.floor(clamp(s.stats.admin, 0, 100) / EDICT_CAP_ADMIN) + (d ? Math.round(EC.modifiers(s, d).edictCap) : 0); }
export function regionEdict(s, regionId) { return (s.edicts || []).find(x => x.regionId === regionId) || null; }
export const regionDevelopment = (s, d, id) => EC.regionDevelopment(s, d, id);

/* ---------- 행동 가능 여부. UI와 dispatch가 같은 함수를 쓴다. ---------- */
function baseReason(s, { ap = true, government = true } = {}) {
  if (s.ending) return '캠페인이 종료되었습니다.';
  if (s.queue.length) return '이번 달 사건을 먼저 결정하세요.';
  if (ap && s.ap < 1) return '행동점수가 부족합니다.';
  if (government && !isExecutive(s)) return '현재 단계에는 국정 집행 권한이 없습니다.';
  return '';
}
function fundsReason(s, cost) { return s.stats.treasury < cost ? '국고가 부족합니다.' : ''; }
export function governmentReason(s, cost = 0, ap = true) { return baseReason(s, { ap }) || fundsReason(s, cost); }
export function policyReason(s, d, id) {
  const p = d.policies.find(x => x.id === id); if (!p) return '알 수 없는 정책입니다.';
  return baseReason(s)
    || (calendar(s.turn).year < p.unlockYear ? `${p.unlockYear}년부터 검토할 수 있습니다.` : '')
    || (s.policies.includes(id) ? '이미 시행 중입니다.' : '')
    || fundsReason(s, p.cost);
}
/** 정부 건설: 건물 한 단계를 대기열에 올린다. 비용은 공사가 진행되는 달마다 자재값으로 나간다. */
export function buildReason(s, d, id, regionId) {
  const def = d.buildings.find(x => x.id === id), r = d.regions.find(x => x.id === regionId);
  if (!def || !r) return '알 수 없는 건물 또는 권역입니다.';
  return baseReason(s)
    || (calendar(s.turn).year < def.unlockYear ? `${def.unlockYear}년부터 지을 수 있습니다.` : '')
    || EC.siteReason(s, d, id, regionId)
    || (s.construction.filter(q => !q.private).length >= d.economy.queueMax ? `정부 건설 대기열은 ${d.economy.queueMax}건까지입니다.` : '')
    || ((EC.findBuilding(s, id, regionId)?.level || 0) >= d.economy.maxLevel ? '이 건물은 더 올릴 수 없습니다.' : '');
}
const queueItem = (s, index) => Number.isInteger(index) && index >= 0 && index < s.construction.length ? s.construction[index] : null;
export function cancelBuildReason(s, d, index) {
  const q = queueItem(s, index);
  return baseReason(s, { ap: false }) || (!q ? '대기열에 없는 공사입니다.' : '') || (q.private ? '민간 공사는 정부가 취소할 수 없습니다.' : '');
}
export function prioritizeReason(s, d, index) {
  const q = queueItem(s, index);
  return baseReason(s, { ap: false }) || (!q ? '대기열에 없는 공사입니다.' : '') || (q.private ? '민간 공사의 순서는 바꿀 수 없습니다.' : '')
    || (s.construction.findIndex(x => !x.private) === index ? '이미 정부 공사의 맨 앞입니다.' : '');
}
export function pmReason(s, d, id, regionId, pm) {
  const b = EC.findBuilding(s, id, regionId), def = d.buildings.find(x => x.id === id);
  if (!b || !def) return baseReason(s, { ap: false }) || '이 권역에 그 건물이 없습니다.';
  const target = def.pm[pm], u = target && target.unlock;
  return baseReason(s, { ap: false })
    || (!Number.isInteger(pm) || !target ? '알 수 없는 생산방식입니다.' : '')
    || (b.pm === pm ? '이미 쓰고 있는 생산방식입니다.' : '')
    || (u && u.year && calendar(s.turn).year < u.year ? `${u.year}년부터 쓸 수 있습니다.` : '')
    || (u && u.metric ? Object.entries(u.metric).filter(([m, v]) => s.stats[m] < v).map(([m, v]) => `${d.metrics.find(x => x.id === m).label} ${v} 이상이 필요합니다(현재 ${s.stats[m].toFixed(1)}).`)[0] || '' : '');
}
export function subsidyReason(s, d, id, regionId) {
  const b = EC.findBuilding(s, id, regionId), def = d.buildings.find(x => x.id === id);
  if (!b || !def) return baseReason(s, { ap: false }) || '이 권역에 그 건물이 없습니다.';
  return baseReason(s, { ap: false })
    || (def.gov || def.construction || b.state >= b.level ? '정부·국영 건물은 손실을 국고가 이미 메웁니다.' : '')
    || (!b.subsidy && !EC.modifiers(s, d).subsidy ? '현행 경제 체제에서는 보조금을 줄 수 없습니다.' : '');
}
export function privatizePrice(s, d, id, regionId) { const b = EC.findBuilding(s, id, regionId), def = d.buildings.find(x => x.id === id); return b && def ? round(b.state * def.cost * d.economy.privatizePrice, 2) : 0; }
export function privatizeReason(s, d, id, regionId) {
  const b = EC.findBuilding(s, id, regionId), def = d.buildings.find(x => x.id === id);
  if (!b || !def) return baseReason(s) || '이 권역에 그 건물이 없습니다.';
  return baseReason(s)
    || (def.private === false ? '민간에 넘길 수 없는 건물입니다.' : '')
    || (b.state < 1 ? '국영 단계가 없습니다.' : '')
    || (s.econ.pool < privatizePrice(s, d, id, regionId) ? '민간 투자기금이 매각 대금보다 적습니다.' : '');
}
/** 국영 단계 하나를 줄인다(행동점수 없음). 정부 건물의 인건비를 덜어 낼 때 쓴다. 지은 건설점은 돌아오지 않는다. */
export function downsizeReason(s, d, id, regionId) {
  const b = EC.findBuilding(s, id, regionId);
  return baseReason(s, { ap: false }) || (!b || b.level < 1 ? '이 권역에 그 건물이 없습니다.' : '') || (b.state < 1 ? '민간 소유 단계는 정부가 줄일 수 없습니다.' : '');
}
export function edictReason(s, d, id, regionId) {
  const e = (d.edicts || []).find(x => x.id === id), r = d.regions.find(x => x.id === regionId);
  if (!e || !r) return '알 수 없는 시책 또는 권역입니다.';
  const cur = regionEdict(s, regionId), cap = edictCap(s, d);
  return baseReason(s)
    || (calendar(s.turn).year < e.unlockYear ? `${e.unlockYear}년부터 시행할 수 있습니다.` : '')
    || (!regionHas(d, regionId, e.requires) ? `이 권역에는 ${iga(traitNames(d, e.requires).join('·'))} 없습니다.` : '')
    || (finite(e.maxDevelopment) && regionDevelopment(s, d, regionId) > e.maxDevelopment ? `개발도 ${e.maxDevelopment} 이하인 권역에만 시행할 수 있습니다.` : '')
    || (cur ? (cur.edictId === id ? '이 권역에서 이미 시행 중입니다.' : '이 권역에는 다른 시책이 있습니다. 먼저 거두세요.') : '')
    || (s.edicts.length >= cap ? `지역 시책은 동시에 ${cap}개까지입니다(행정 역량 ${EDICT_CAP_ADMIN}마다 1개 늘어남).` : '')
    || fundsReason(s, e.cost);
}
/** 시책 거두기: 행동점수를 쓰지 않는다. 이미 생긴 변화와 시행비는 돌아오지 않는다. */
export function revokeEdictReason(s, d, regionId) {
  return baseReason(s, { ap: false })
    || (!d.regions.some(x => x.id === regionId) ? '알 수 없는 권역입니다.' : '')
    || (!regionEdict(s, regionId) ? '이 권역에 시행 중인 시책이 없습니다.' : '');
}
export function choiceReason(s, d, choiceId) {
  const e = d.events.find(x => x.id === s.queue[0]), c = e?.choices.find(x => x.id === choiceId);
  if (s.ending) return '캠페인이 종료되었습니다.';
  if (!c) return '현재 사건의 선택지가 아닙니다.';
  return fundsReason(s, Math.max(0, -(c.effects?.treasury || 0)));
}
export function prepareReason(s) {
  return baseReason(s, { government: false }) || (!PREPARE_PHASES.includes(s.phase) ? '이 단계에서는 국정 행동을 선택하세요.' : '');
}
export function diplomacyReason(s, d, countryId, mode) {
  const country = d.countries.find(x => x.id === countryId), o = DIPLOMACY_MODES[mode];
  return baseReason(s)
    || (!country || !o || !Object.hasOwn(DIPLOMACY_MODES, mode) ? '외교 상대 또는 방식이 잘못되었습니다.' : '')
    || (s.monthActions.includes(`diplomacy:${countryId}`) ? '이번 달에 이미 이 상대와 외교 행동을 했습니다.' : '')
    || fundsReason(s, o.cost);
}
export function adviserReason(s, d, id) {
  const a = d.advisers.find(x => x.id === id);
  const r = baseReason(s); if (r) return r;
  if (!a) return '알 수 없는 자문위원입니다.';
  if (s.advisers.includes(a.id)) return '';
  if (s.advisers.length >= MAX_ADVISERS) return '자문위원은 동시에 두 명까지 임명할 수 있습니다.';
  return fundsReason(s, a.cost);
}
export function repayReason(s, amount) {
  return baseReason(s)
    || (!finite(amount) || amount <= 0 || amount > s.stats.debt ? '상환액이 부채보다 크거나 잘못되었습니다.' : '')
    || fundsReason(s, amount);
}
export function budgetReason(s, b) {
  const r = baseReason(s, { ap: false }); if (r) return r;
  if (b === undefined) return '';
  if (!object(b) || Object.keys(b).length !== 6 || BUDGET_KEYS.some(k => !finite(b[k]) || b[k] < 0 || b[k] > 100) || Math.abs(BUDGET_KEYS.reduce((a, k) => a + b[k], 0) - 100) > .001)
    return '예산은 여섯 분야의 0~100 숫자이며 합계 100이어야 합니다.';
  return '';
}
export function endMonthReason(s) { return baseReason(s, { ap: false, government: false }); }

/* ---------- 법률 제정과 집권 연합 ---------- */
export const lawOf = (d, id) => d.laws.find(x => x.id === id) || null;
export const activeLaw = (s, d, groupId) => lawOf(d, s.laws[groupId]);
/** 이해집단이 새 법을 현행 법보다 얼마나 선호하는지(-4~+4). */
export function lawPreference(s, d, lawId, igId) { const law = lawOf(d, lawId), cur = activeLaw(s, d, law.group); return (law.stances[igId] || 0) - (cur.stances[igId] || 0); }
/** 제정 검사 한 번의 성공 확률과 그 구성. 표시용이며 난수를 소비하지 않는다. */
export function lawChanceParts(s, d, lawId) {
  const E = d.economy.enactment;
  let support = 0, oppose = 0, outSupport = 0, outOppose = 0;
  for (const g of d.interestGroups) {
    const pref = lawPreference(s, d, lawId, g.id), w = s.ig[g.id].clout * Math.min(1, Math.abs(pref) / 2), inGov = s.government.includes(g.id);
    if (pref > 0) { if (inGov) support += w; else outSupport += w; } else if (pref < 0) { if (inGov) oppose += w; else outOppose += w; }
  }
  const governing = s.phase === 'governing', bonus = s.enactment && s.enactment.lawId === lawId ? s.enactment.bonus : 0;
  const parts = [['기본', E.base], ['집권 연합 안의 지지', support * E.support], ['집권 연합 안의 반대', -oppose * E.support], ['연합 밖의 여론', (outSupport - outOppose) * E.outside], ['정당성', (s.stats.legitimacy - 50) * E.legitimacy],
    governing ? ['가상 의석', (s.seats - .5) * E.seats] : ['과도 통치의 의결', E.decree]];
  if (bonus) parts.push(['논쟁에서 얻은 양보', bonus]);
  return { parts, support, oppose, outSupport, outOppose, chance: clamp(parts.reduce((a, x) => a + x[1], 0), E.min, E.max) };
}
export function lawChance(s, d, lawId) { return lawChanceParts(s, d, lawId).chance; }
export function enactReason(s, d, lawId) {
  const law = lawOf(d, lawId); if (!law) return '알 수 없는 법률입니다.';
  const E = d.economy.enactment, g = d.lawGroups.find(x => x.id === law.group), c = lawChanceParts(s, d, lawId);
  return baseReason(s)
    || (calendar(s.turn).year < law.unlockYear ? `${law.unlockYear}년부터 발의할 수 있습니다.` : '')
    || (s.laws[law.group] === lawId ? '이미 시행 중인 법률입니다.' : '')
    || (s.enactment ? '이미 제정 중인 법률이 있습니다. 한 번에 하나만 다룹니다.' : '')
    || (c.support <= 0 && c.outSupport < E.massDemand ? '집권 연합 안에 이 법을 현행 법보다 바라는 집단이 없습니다. 연합을 바꾸거나 연합 밖 여론이 세력의 40%를 넘어야 합니다.' : '')
    || (s.turn + g.interval * E.stages > TOTAL_TURNS ? '1979년 12월까지 제정을 마칠 수 없습니다.' : '')
    || fundsReason(s, law.cost);
}
export function cancelEnactReason(s) { return baseReason(s, { ap: false }) || (!s.enactment ? '제정 중인 법률이 없습니다.' : ''); }
/** 집권 연합에 넣거나 빼기. */
export function coalitionReason(s, d, igId) {
  const g = d.interestGroups.find(x => x.id === igId), G = d.economy.government, inGov = s.government.includes(igId);
  return baseReason(s)
    || (!g ? '알 수 없는 이해집단입니다.' : '')
    || (inGov && s.phase === 'transition' && igId === 'military' ? '과도 통치 중에는 군대가 집권 연합에서 빠질 수 없습니다.' : '')
    || (inGov && s.government.length <= 1 ? '집권 연합에는 적어도 한 집단이 있어야 합니다.' : '')
    || (!inGov && s.government.length >= G.max ? `집권 연합은 ${G.max}개 집단까지입니다.` : '');
}
export function governmentClout(s) { return s.government.reduce((a, id) => a + s.ig[id].clout, 0); }
/** 집권 연합의 세력이 매월 정당성에 주는 영향. */
export function coalitionLegitimacy(s, d) { const G = d.economy.government; return clamp((governmentClout(s) - G.center) * G.legitimacy, -G.legitimacyCap, G.legitimacyCap); }
function enactLaw(s, d, law) {
  const prev = activeLaw(s, d, law.group), A = d.economy.approval;
  const stances = Object.fromEntries(d.interestGroups.map(g => [g.id, (law.stances[g.id] || 0) - (prev.stances[g.id] || 0)]));
  const before = { ...s.stats };
  apply(s, Object.fromEntries(Object.entries(prev.effects).map(([k, v]) => [k, -v])), d);
  apply(s, law.effects, d);
  if (s.phase === 'transition') apply(s, d.economy.enactment.decreeCost, d);
  s.laws[law.group] = law.id; s.counters.lawsEnacted++;
  faction(s, Object.fromEntries(Object.entries(stances).filter(([, v]) => v !== 0).map(([id, v]) => [id, Math.sign(v) * A.reform * Math.min(2, Math.abs(v)) / 2])));
  return diff(before, s.stats);
}

/* ---------- 예측. 표시용이며 난수를 소비하지 않는다. ---------- */
export function firstElectionChance(s, d) {
  return clamp(35 + s.influence * .18 + (s.stats.legitimacy - 45) * .25 + (supportAverage(s, d) - 45) * .15, 25, 90);
}
/** 다음 가상 정기 선거가 반영되는 달(turn). 권위주의 분기·비통치 단계에서는 null. */
export function nextElectionTurn(s) {
  if (s.phase !== 'governing' || s.flags.authoritarian || s.ending) return null;
  for (let t = Math.max(FIRST_PERIODIC_ELECTION, s.turn + 1); t < TOTAL_TURNS; t++) if ((t - FIRST_PERIODIC_ELECTION) % ELECTION_INTERVAL === 0) return t;
  return null;
}
/** 정기 선거 득표 지표의 예상 중심값(실제 결과는 ±6 균등 난수가 더해진다). */
export function electionExpectation(s, d) { return supportAverage(s, d) * .65 + s.stats.legitimacy * .35; }

/* ---------- 엔딩 ---------- */
function genericEndingCondition(s, conditions) {
  return Object.entries(conditions).every(([key, rule]) => {
    if (key === 'explicit') return false;
    const v = s.stats[key];
    return Object.entries(rule).every(([op, n]) => op === 'gte' ? v >= n : op === 'lte' ? v <= n : op === 'lt' ? v < n : false);
  });
}
export function evaluateEnding(s, d, final = false) {
  if (s.ending) return s.ending;
  const all = [...d.endings].sort((a, b) => b.priority - a.priority);
  const options = final ? all : all.filter(e => CRISIS_ENDINGS.includes(e.id));
  const found = options.find(e => genericEndingCondition(s, e.conditions));
  if (found) setEnding(s, d, found.id);
  return s.ending;
}
/** 엔딩 조건을 사람이 읽을 수 있는 형태로. 엔딩 화면·기록실에서 쓴다. */
export function endingConditionMet(s, d, id) { const e = d.endings.find(x => x.id === id); return !!e && genericEndingCondition(s, e.conditions); }

/* ---------- 재정 ---------- */
/** 다음 결산의 재정 전망. 시장 계산(EC.compute)의 재정 부분이다. */
export function finance(s, d) { return EC.compute(s, d).finance; }
/** 원조: 1960년대 초의 외환 유입. endTurn까지 직선으로 줄어든다. */
export function aidInflow(s, d) { const a = d.economy.aid; return s.turn >= a.endTurn ? 0 : a.start * (1 - s.turn / a.endTurn); }

/* ---------- 월 처리 ---------- */
function month(s, d) {
  const before = { ...s.stats }, supportBefore = { ...s.support }, relationsBefore = { ...s.relations };
  const ledger = {};
  const track = (source, fn) => {
    const b = { ...s.stats }; fn();
    for (const m of Object.keys(s.stats)) { const dv = s.stats[m] - b[m]; if (dv !== 0) { (ledger[m] ||= []); const row = ledger[m].find(x => x[0] === source); if (row) row[1] += dv; else ledger[m].push([source, dv]); } }
  };
  const report = { turn: s.turn, date: dateLabel(s.turn), finance: null, borrowed: 0, completed: [], started: null, laws: [], followups: [], election: null, events: [], ending: null, market: null };
  const E = d.economy, R = EC.compute(s, d), f = R.finance;
  track('월 재정 수지', () => { s.stats.treasury += f.balance; });
  s.lastFinance = { ...f, turn: s.turn }; report.finance = { ...f };
  if (s.stats.treasury < 0) {
    const borrowing = -s.stats.treasury;
    track('부족분 차입', () => { s.stats.debt += borrowing; s.stats.treasury = 0; });
    report.borrowed = borrowing;
    log(s, 'finance', `부족분 ${borrowing.toFixed(1)} 재정점을 부채로 조달했다.`);
  }
  const k = s.stats, b = s.budget, executive = isExecutive(s), bal = d.balance || null;
  const add = (id, v) => { k[id] += scaled(s, d, id, v); };
  // 생산·고용·물가는 시장 계산에서 나온다.
  track('시장의 생산', () => { k.gdp = R.gdp; });
  track('고용(건물 일자리와 노동 인구)', () => { k.unemployment += (R.labor.rate * 100 - k.unemployment) * E.unemploymentSpeed; });
  track('시장 가격·부채 압력', () => { const I = E.inflation; k.inflation += (I.base + I.perCpi * (R.cpi - 1) + Math.max(0, k.debt - I.debtFrom) * I.debtRate - k.inflation) * I.speed; });
  track('교역 수지·원조', () => { add('reserves', (R.trade.exports - R.trade.imports) * E.forexScale + aidInflow(s, d)); });
  // 초반 배분은 플레이어가 조작하는 지출이 아니라 관찰용 국가 기본값이다.
  track('예산 배분', () => { for (const key of BUDGET_KEYS) add(key, (b[key] - 12) * .006); });
  track('건물의 환경 부담', () => { k.environment -= R.pollution; });
  track('정부·기반 건물', () => { for (const rec of R.buildings) if (rec.def.monthlyEffects) apply(s, rec.def.monthlyEffects, d, null, rec.L * rec.b.staff * rec.short); });
  track('역량의 감가', () => { for (const [id, x] of Object.entries(E.depreciation)) if (k[id] > x.floor) k[id] -= (k[id] - x.floor) * x.rate; });
  track('생활수준', () => {
    const L = E.living, mass = (R.pops.workers.sol * R.pops.workers.pop + R.pops.farmers.sol * R.pops.farmers.pop) / (R.pops.workers.pop + R.pops.farmers.pop);
    const top = (R.pops.business.sol * R.pops.business.pop + R.pops.landowners.sol * R.pops.landowners.pop) / (R.pops.business.pop + R.pops.landowners.pop);
    add('welfare', (mass - L.massBase) * L.welfare); add('equality', (mass / top - L.gapBase) * L.equality);
  });
  track('사회 추세', () => {
    add('stability', (k.legitimacy - k.stability) * .008 + (k.welfare - 45) * .0008 - Math.max(0, k.unemployment - 18) * .01);
    add('legitimacy', ((k.liberty - 50) * .0008 + (k.welfare - 45) * .0005));
    add('equality', (k.welfare - k.equality) * .002);
  });
  if (bal && bal.expectations) track('높아진 기대', () => {
    for (const [id, x] of Object.entries(bal.expectations)) if (object(x) && Object.hasOwn(k, id) && k[id] > x.target) k[id] -= (k[id] - x.target) * x.rate;
  });
  if (bal && bal.militaryRule && s.phase === 'transition') track('군정의 비용', () => { for (const [id, v] of Object.entries(bal.militaryRule.monthly)) k[id] += v; });
  if (s.flags.authoritarian) track('권력 집중의 비용', () => {
    if (!bal || !bal.authoritarian) { k.liberty -= .3; k.legitimacy -= .10; return; }
    const a = bal.authoritarian;
    for (const [id, v] of Object.entries(a.monthly)) k[id] += v;
    faction(s, a.support || {});
    for (const [id, v] of Object.entries(a.relations || {})) s.relations[id] += v;
  });
  track('이해집단 특성', () => { apply(s, R.mods.monthly, d); });
  if (executive) {
    track('집권 연합의 기반', () => { add('legitimacy', coalitionLegitimacy(s, d)); });
    track('정책 지속 효과', () => { for (const id of s.policies) apply(s, d.policies.find(x => x.id === id).monthlyEffects, d); });
    track('법률 지속 효과', () => { for (const g of d.lawGroups) apply(s, activeLaw(s, d, g.id).monthlyEffects, d); });
    track('자문 지속 효과', () => { for (const id of s.advisers) apply(s, d.advisers.find(x => x.id === id).monthlyEffects, d); });
    if ((s.edicts || []).length) track('지역 시책', () => { for (const a of s.edicts) apply(s, d.edicts.find(x => x.id === a.edictId).monthlyEffects, d); });
  }
  // 시장 결과를 상태에 적용: 충원·가격·투자기금·건설 진행·준공·민간 착공.
  const done = EC.commit(s, d, R);
  for (const c of done.completed) {
    const def = d.buildings.find(x => x.id === c.buildingId), r = d.regions.find(x => x.id === c.regionId), level = EC.findBuilding(s, c.buildingId, c.regionId).level;
    if (c.private) s.counters.privateBuilt++; else { s.counters.built++; if (!s.counters.regions.includes(c.regionId)) s.counters.regions.push(c.regionId); if (def.requires) s.counters.resourceBuilt++; }
    report.completed.push(c);
    log(s, 'construction', `${r.name} · ${def.name} ${level}단계 준공${c.private ? ' (민간 투자)' : ''}.`, { buildingId: def.id, regionId: r.id });
  }
  report.started = done.started;
  track('법률 제정', () => {
    const en = s.enactment; if (!en) return;
    en.wait--;
    if (en.wait > 0) return;
    const law = lawOf(d, en.lawId), g = d.lawGroups.find(x => x.id === law.group), X = E.enactment, chance = lawChance(s, d, law.id), roll = random(s);
    let result;
    if (roll < chance) {
      en.stage++;
      if (en.stage >= X.stages) { const changes = enactLaw(s, d, law); s.enactment = null; result = 'enacted'; log(s, 'law', `${law.name} 제정 (${g.name}). 검사 성공 확률 ${(chance * 100).toFixed(0)}%.`, { lawId: law.id, changes: roundEffects(changes) }); }
      else { result = 'advance'; log(s, 'law', `${law.name}: ${en.stage}단계 통과 (성공 확률 ${(chance * 100).toFixed(0)}%).`, { lawId: law.id }); }
    } else if (random(s) < .5) {
      result = 'debate'; en.bonus = round(en.bonus + X.debate, 4);
      log(s, 'law', `${law.name}: 논쟁으로 제자리. 양보를 얻어 다음 검사 확률 +${Math.round(X.debate * 100)}%p.`, { lawId: law.id });
    } else {
      en.setbacks++;
      if (en.setbacks >= X.setbacks) { s.enactment = null; s.counters.lawsFailed++; result = 'failed'; log(s, 'law', `${law.name}: 세 번째 지체로 폐기. 시행비는 돌려받지 않는다.`, { lawId: law.id }); }
      else { result = 'stall'; log(s, 'law', `${law.name}: 지체 ${en.setbacks}회 (세 번이면 폐기).`, { lawId: law.id }); }
    }
    if (s.enactment) en.wait = g.interval;
    report.laws.push({ lawId: law.id, result, chance });
  });
  track('지연 효과', () => {
    for (const x of s.delayed.filter(x => x.due <= s.turn + 1)) {
      apply(s, x.effects, d); report.followups.push({ text: x.text, effects: clone(x.effects) });
      log(s, 'followup', x.text, { changes: roundEffects(x.effects) });
    }
    s.delayed = s.delayed.filter(x => x.due > s.turn + 1);
  });
  track('범위 제한', () => normalize(s, d));
  // 이해집단: 세력과 투표 비중을 다시 재고, 지지도는 목표값을 향해 움직인다. 사건·개혁이 남긴 보정은 매월 줄어든다.
  const A = E.approval, clout = EC.cloutOf(d, R), vote = EC.voteWeights(d, R);
  for (const g of d.interestGroups) {
    const x = s.ig[g.id]; x.clout = round(clout[g.id], 4); x.vote = round(vote[g.id], 4);
    s.support[g.id] += (EC.approvalParts(s, d, R, g).target - s.support[g.id]) * A.speed;
    x.mod = round(x.mod * (1 - A.modDecay), 4);
  }
  track('범위 제한', () => normalize(s, d));
  report.market = { gdp: round(R.gdp, 3), unemployment: round(R.labor.rate * 100, 2), cpi: round(R.cpi, 4), exports: round(R.trade.exports, 3), imports: round(R.trade.imports, 3), points: round(R.construction.points, 2), used: round(R.construction.used, 2), pool: s.econ.pool };
  snapshot(s); s.turn++; s.day = 1; s.ap = AP_PER_MONTH; s.monthActions = [];
  const finish = () => {
    report.changes = diff(before, s.stats); report.support = diff(supportBefore, s.support); report.relations = diff(relationsBefore, s.relations);
    report.ledger = Object.fromEntries(Object.entries(ledger).map(([m, rows]) => [m, rows.filter(r => Math.abs(r[1]) > 1e-9).map(r => [r[0], round(r[1], 6)])]).filter(([, rows]) => rows.length));
    report.ending = s.ending ? s.ending.id : null; report.events = [...s.queue];
    s.report = report;
  };
  if (s.turn >= TOTAL_TURNS) { evaluateEnding(s, d, true); finish(); return; }
  if (s.phase === 'governing' && !s.flags.authoritarian && s.turn >= FIRST_PERIODIC_ELECTION && (s.turn - FIRST_PERIODIC_ELECTION) % ELECTION_INTERVAL === 0) {
    const share = clamp(supportAverage(s, d) * .65 + k.legitimacy * .35 + (random(s) - .5) * 12, 0, 100);
    s.seats = clamp(share / 100, .15, .85);
    log(s, 'election', `가상 정기 선거 득표 지표 ${share.toFixed(1)}. 실제 역사 득표율이 아님.`, { share });
    report.election = { share, transfer: share < ELECTION_THRESHOLD, seats: s.seats };
    if (share < ELECTION_THRESHOLD) setEnding(s, d, 'peaceful_transfer');
  }
  evaluateEnding(s, d);
  if (!s.ending) queueMonth(s, d);
  finish();
}
function diff(a, b) { const out = {}; for (const key of Object.keys(b)) { const v = b[key] - a[key]; if (Math.abs(v) > 1e-9) out[key] = round(v, 6); } return out; }
function roundEffects(e) { return Object.fromEntries(Object.entries(e || {}).map(([k, v]) => [k, round(v, 4)])); }
function activate(s, d, p) { s.policies.push(p.id); apply(s, p.effects, d); faction(s, p.factionEffects); }
function firstElection(s, d) {
  const probability = firstElectionChance(s, d);
  const roll = random(s) * 100;
  log(s, 'election', `1963년 가상 선거: 당선 확률 ${probability.toFixed(1)}%, ${roll < probability ? '당선' : '낙선'}.`, { probability, roll });
  if (roll < probability) { s.flags.won1963 = true; s.phase = 'elected'; s.seats = clamp(.42 + supportAverage(s, d) * .003, .35, .8); }
  else setEnding(s, d, 'peaceful_transfer');
}
/** 사건 선택의 직접 효과(특수 판정·엔딩·난수 제외). dispatch와 미리보기가 같은 코드를 쓴다. */
function applyChoice(s, c, d, kind) {
  apply(s, c.effects, d, kind); faction(s, c.factionEffects);
  for (const [id, v] of Object.entries(c.relations || {})) s.relations[id] += v;
  Object.assign(s.flags, c.setFlags || {}); if (c.phase) s.phase = c.phase; s.influence += c.influence || 0;
  // 과도 통치가 시작되면 군대가 집권 연합에 들어온다(제도적 사실만 다룬다).
  if (c.phase === 'transition' && s.government && !s.government.includes('military')) { s.government = [...s.government.slice(0, d.economy.government.max - 1), 'military']; }
}

/* ---------- 미리보기: 결정 직전에 보여 줄 값. 상태를 바꾸지 않고 난수를 소비하지 않는다. ---------- */
/** 효과를 현재 값에 더한 뒤 지표 범위로 제한한 전/후 목록. delta는 실제로 더해질 양(체감·신뢰 할인 반영),
 *  base는 데이터에 적힌 기본값이며 둘이 다를 때만 넣는다. */
export function projectEffects(s, d, effects = {}, kind = null) {
  return Object.entries(effects).map(([id, value]) => {
    const m = d.metrics.find(x => x.id === id), before = s.stats[id], delta = scaled(s, d, id, value, kind);
    const after = m ? clamp(before + delta, m.min, m.max) : before + delta;
    return Math.abs(delta - value) > 1e-9 ? { id, delta, base: value, before, after } : { id, delta, before, after };
  });
}
export function choicePreview(s, d, choiceId) {
  const e = d.events.find(x => x.id === s.queue[0]), c = e?.choices.find(x => x.id === choiceId);
  if (!c) return null;
  // 선택이 건드리는 부분만 복사한다(연대기 전체를 복제하지 않는다).
  const t = { stats: { ...s.stats }, support: { ...s.support }, ig: clone(s.ig), government: [...s.government], relations: { ...s.relations }, flags: { ...s.flags }, phase: s.phase, influence: s.influence, seats: s.seats };
  applyChoice(t, c, d, e.kind); normalize(t, d);
  return {
    stats: projectEffects(s, d, c.effects, e.kind),
    support: Object.entries(c.factionEffects || {}).map(([id, v]) => ({ id, delta: v, before: s.support[id], after: t.support[id] })),
    relations: Object.entries(c.relations || {}).map(([id, v]) => ({ id, delta: v, before: s.relations[id], after: t.relations[id] })),
    influence: c.influence || 0,
    phase: c.phase || null,
    flags: c.setFlags || {},
    delay: c.delay ? { ...clone(c.delay), arrival: s.turn + c.delay.months } : null,
    electionChance: c.special === 'firstElection' ? firstElectionChance(t, d) : null,
    ending: c.ending || null,
    cost: Math.max(0, -(c.effects?.treasury || 0))
  };
}

/* ---------- 행동 처리 ---------- */
/** 행동이 거부되는 이유. 빈 문자열이면 실행할 수 있다. 상태를 읽기만 한다. */
export function actionReason(s, d, action) {
  if (!object(action) || typeof action.type !== 'string') return '잘못된 행동입니다.';
  if (s.ending) return '캠페인이 종료되었습니다.';
  switch (action.type) {
    case 'choose': return choiceReason(s, d, action.choiceId);
    case 'prepare': return prepareReason(s);
    case 'policy': return policyReason(s, d, action.id);
    case 'build': return buildReason(s, d, action.id, action.regionId);
    case 'cancelBuild': return cancelBuildReason(s, d, action.index);
    case 'prioritize': return prioritizeReason(s, d, action.index);
    case 'pm': return pmReason(s, d, action.id, action.regionId, action.pm);
    case 'subsidy': return subsidyReason(s, d, action.id, action.regionId);
    case 'privatize': return privatizeReason(s, d, action.id, action.regionId);
    case 'downsize': return downsizeReason(s, d, action.id, action.regionId);
    case 'enact': return enactReason(s, d, action.id);
    case 'cancelEnact': return cancelEnactReason(s);
    case 'coalition': return coalitionReason(s, d, action.id);
    case 'edict': return edictReason(s, d, action.id, action.regionId);
    case 'revokeEdict': return revokeEdictReason(s, d, action.regionId);
    case 'budget': return budgetReason(s, action.budget === undefined ? null : action.budget);
    case 'diplomacy': return diplomacyReason(s, d, action.countryId, action.mode);
    case 'adviser': return adviserReason(s, d, action.id);
    case 'repay': return repayReason(s, action.amount);
    case 'endMonth': return endMonthReason(s);
    case 'tick': return endMonthReason(s);
    default: return '지원하지 않는 행동입니다.';
  }
}
/** 원본을 바꾸지 않는다. 거부되면 원본 상태를 그대로 돌려준다(복제 전에 검사하므로 실패한 시도는 비용이 작다). */
export function dispatch(current, d, action) {
  const reason = actionReason(current, d, action);
  if (reason) return { ok: false, state: current, error: reason };
  // 하루가 지나는 틱: 달 안에서는 날짜만 바뀐다(얕은 복사, 원본 불변). 그 달의 마지막 날 다음 틱은 월 결산이다.
  if (action.type === 'tick' && current.day < daysInMonth(current.turn)) return { ok: true, state: { ...current, day: current.day + 1 } };
  const s = clone(current); const logStart = s.log.length;
  const rname = id => d.regions.find(x => x.id === id).name, bname = id => d.buildings.find(x => x.id === id).name;
  switch (action.type) {
    case 'choose': {
      const e = d.events.find(x => x.id === s.queue[0]), c = e.choices.find(x => x.id === action.choiceId);
      applyChoice(s, c, d, e.kind);
      if (c.delay) s.delayed.push({ due: s.turn + c.delay.months, ...clone(c.delay) });
      log(s, 'event', `${e.title} — ${c.label}`, { eventId: e.id, choiceId: c.id, kind: e.kind, sourceIds: e.sourceIds });
      s.queue.shift();
      if (c.special === 'firstElection') firstElection(s, d);
      if (c.ending) setEnding(s, d, c.ending);
      break;
    }
    case 'prepare': {
      s.ap--; s.influence += PREPARE_INFLUENCE;
      log(s, 'preparation', `공개 자료를 검토하고 정책·연합 준비를 진전시켰다. 영향력 +${PREPARE_INFLUENCE}.`);
      break;
    }
    case 'policy': {
      const p = d.policies.find(x => x.id === action.id); s.ap--; s.stats.treasury -= p.cost;
      activate(s, d, p);
      log(s, 'policy', `${p.name} 시행. ${p.cost} 재정점 지출, 매월 유지비 ${p.monthlyCost}.`, { policyId: p.id });
      break;
    }
    case 'build': {
      const def = d.buildings.find(x => x.id === action.id), level = (EC.findBuilding(s, def.id, action.regionId)?.level || 0) + s.construction.filter(q => q.id === def.id && q.regionId === action.regionId).length + 1;
      s.ap--; s.construction.push({ id: def.id, regionId: action.regionId, progress: 0, private: false });
      log(s, 'construction', `${rname(action.regionId)} · ${def.name} ${level}단계 착공 (건설점 ${def.cost}). 자재값은 공사가 진행되는 달마다 나간다.`, { buildingId: def.id, regionId: action.regionId });
      break;
    }
    case 'cancelBuild': {
      const [q] = s.construction.splice(action.index, 1);
      log(s, 'construction', `${rname(q.regionId)} · ${bname(q.id)} 공사를 취소했다 (진행 ${q.progress.toFixed(0)}점은 사라진다).`, { buildingId: q.id, regionId: q.regionId });
      break;
    }
    case 'prioritize': {
      const [q] = s.construction.splice(action.index, 1), first = s.construction.findIndex(x => !x.private);
      s.construction.splice(first < 0 ? 0 : first, 0, q);
      log(s, 'construction', `${rname(q.regionId)} · ${bname(q.id)} 공사를 정부 대기열의 맨 앞으로 옮겼다.`, { buildingId: q.id, regionId: q.regionId });
      break;
    }
    case 'pm': {
      const b = EC.findBuilding(s, action.id, action.regionId), def = d.buildings.find(x => x.id === action.id);
      b.pm = action.pm; b.staff = round(b.staff * d.economy.retool, 4); // 설비를 바꾸는 동안 가동률이 떨어졌다가 다시 채워진다
      log(s, 'construction', `${rname(b.regionId)} · ${def.name}의 생산방식을 '${def.pm[b.pm].name}'으로 바꿨다. 설비를 바꾸는 동안 가동률이 ${Math.round(d.economy.retool * 100)}%로 떨어졌다가 달마다 다시 오른다.`, { buildingId: def.id, regionId: b.regionId });
      break;
    }
    case 'subsidy': {
      const b = EC.findBuilding(s, action.id, action.regionId); b.subsidy = !b.subsidy;
      log(s, 'construction', `${rname(b.regionId)} · ${bname(b.id)} 보조금 ${b.subsidy ? '지급 시작: 손실이 나면 국고가 메우고 고용을 유지한다' : '중단'}.`, { buildingId: b.id, regionId: b.regionId });
      break;
    }
    case 'privatize': {
      const b = EC.findBuilding(s, action.id, action.regionId), price = privatizePrice(s, d, b.id, b.regionId), levels = b.state;
      s.ap--; s.stats.treasury += price; s.econ.pool = round(s.econ.pool - price, 4); b.state = 0; faction(s, { business: 2, workers: -1 });
      log(s, 'construction', `${rname(b.regionId)} · ${bname(b.id)} 국영 ${levels}단계를 민간에 넘겼다 (매각 대금 ${price}, 투자기금에서).`, { buildingId: b.id, regionId: b.regionId });
      break;
    }
    case 'downsize': {
      const b = EC.findBuilding(s, action.id, action.regionId);
      b.level--; b.state--; if (b.level < 1) s.buildings = s.buildings.filter(x => x !== b);
      log(s, 'construction', `${rname(action.regionId)} · ${bname(action.id)} 국영 한 단계를 줄였다 (${b.level}단계 남음). 일하던 사람은 다른 일자리를 찾아야 한다.`, { buildingId: action.id, regionId: action.regionId });
      break;
    }
    case 'enact': {
      const law = lawOf(d, action.id), g = d.lawGroups.find(x => x.id === law.group);
      s.ap--; s.stats.treasury -= law.cost;
      s.enactment = { lawId: law.id, stage: 0, wait: g.interval, setbacks: 0, bonus: 0, startedTurn: s.turn };
      log(s, 'law', `${law.name} 발의 (${g.name}). ${g.interval}개월마다 검사하며 세 번 통과해야 제정된다. 시행비 ${law.cost} 재정점은 돌려받지 않는다.`, { lawId: law.id });
      break;
    }
    case 'cancelEnact': {
      const law = lawOf(d, s.enactment.lawId); s.enactment = null;
      log(s, 'law', `${law.name} 제정을 거두었다.`, { lawId: law.id });
      break;
    }
    case 'coalition': {
      const g = d.interestGroups.find(x => x.id === action.id); s.ap--;
      if (s.government.includes(g.id)) { s.government = s.government.filter(x => x !== g.id); faction(s, { [g.id]: -d.economy.approval.dismissed }); log(s, 'government', `${g.name}을(를) 집권 연합에서 뺐다.`, { igId: g.id }); }
      else { s.government.push(g.id); log(s, 'government', `${g.name}을(를) 집권 연합에 넣었다.`, { igId: g.id }); }
      break;
    }
    case 'edict': {
      const e = d.edicts.find(x => x.id === action.id), r = d.regions.find(x => x.id === action.regionId);
      s.ap--; s.stats.treasury -= e.cost; s.edicts.push({ edictId: e.id, regionId: r.id, startedTurn: s.turn }); faction(s, e.factionEffects);
      log(s, 'edict', `${r.name} · ${e.name} 시행 (${e.cost} 재정점, 매월 유지비 ${e.monthlyCost}).`, { edictId: e.id, regionId: r.id });
      break;
    }
    case 'revokeEdict': {
      const a = regionEdict(s, action.regionId), e = d.edicts.find(x => x.id === a.edictId), r = d.regions.find(x => x.id === a.regionId);
      s.edicts = s.edicts.filter(x => x !== a);
      log(s, 'edict', `${r.name} · ${e.name} 시책을 거두었다 (${s.turn - a.startedTurn}개월 시행).`, { edictId: e.id, regionId: r.id });
      break;
    }
    case 'budget': {
      s.budget = clone(action.budget);
      log(s, 'budget', `다음 월의 예산 배분을 수정했다 (${BUDGET_KEYS.map(k => s.budget[k]).join('·')}).`);
      break;
    }
    case 'diplomacy': {
      const country = d.countries.find(x => x.id === action.countryId), o = DIPLOMACY_MODES[action.mode];
      s.ap--; s.stats.treasury -= o.cost; s.relations[country.id] += o.relation; apply(s, o.effects, d);
      s.monthActions.push(`diplomacy:${country.id}`);
      log(s, 'diplomacy', `${country.name} · ${o.label} (${o.cost} 재정점, 관계 +${o.relation}).`, { countryId: country.id });
      break;
    }
    case 'adviser': {
      const a = d.advisers.find(x => x.id === action.id);
      if (s.advisers.includes(a.id)) { s.advisers = s.advisers.filter(x => x !== a.id); s.ap--; log(s, 'cabinet', `${a.name} 자문위원 해임 (가상 인물).`); break; }
      s.ap--; s.stats.treasury -= a.cost; s.advisers.push(a.id);
      log(s, 'cabinet', `${a.name} 자문위원 임명 (가상 인물, 임명비 ${a.cost}).`);
      break;
    }
    case 'repay': {
      s.ap--; s.stats.treasury -= action.amount; s.stats.debt -= action.amount;
      log(s, 'finance', `부채 ${action.amount.toFixed(1)} 재정점 상환. 다음 달 이자 ${(action.amount * d.economy.interest).toFixed(2)} 감소.`);
      break;
    }
    case 'endMonth': s.day = daysInMonth(s.turn); month(s, d); break; // 남은 날을 건너뛰고 말일에 결산
    case 'tick': month(s, d); break; // 말일 다음 날 = 다음 달 1일, 월 결산
  }
  normalize(s, d); if (!s.ending) evaluateEnding(s, d);
  if (action.type !== 'endMonth' && action.type !== 'tick' && s.log.length > logStart) {
    const changes = diff(current.stats, s.stats);
    if (Object.keys(changes).length) s.log[logStart].changes = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, round(v, 4)]));
  }
  return { ok: true, state: s };
}

/* ---------- 저장 ---------- */
export function exportSave(s) { return JSON.stringify({ format: SAVE_FORMAT, version: SAVE_VERSION, state: s }, null, 2); }
/** 저장 형식 5만 받는다. 이전 형식(1~4)은 사업·법안·사회 집단 구조가 달라 변환하지 않고, 이유를 알려 준다. */
export function migrateSave(parsed) {
  if (!object(parsed) || parsed.format !== SAVE_FORMAT) throw new Error('지원하지 않는 저장 형식 또는 버전입니다.');
  if ([1, 2, 3, 4].includes(parsed.version)) throw new Error(OLD_SAVE_MESSAGE);
  if (parsed.version !== SAVE_VERSION) throw new Error('지원하지 않는 저장 형식 또는 버전입니다.');
  return parsed;
}
export function importSave(raw, d) {
  if (typeof raw !== 'string' || raw.length > 3000000) throw new Error('저장 파일 크기 또는 형식이 잘못되었습니다.');
  let parsed; try { parsed = JSON.parse(raw); } catch { throw new Error('읽을 수 없는 JSON입니다.'); }
  parsed = migrateSave(parsed);
  if (object(parsed.state) && (COMPATIBLE_DATA[d.meta.version] || []).includes(parsed.state.dataVersion)) parsed.state.dataVersion = d.meta.version;
  const fail = () => { throw new Error('저장 데이터의 구조·ID·값이 올바르지 않습니다.'); };
  const s = parsed.state, E = d.economy;
  if (!object(s) || s.version !== SAVE_VERSION || s.gameId !== d.meta.id || s.dataVersion !== d.meta.version) fail();
  if (!Number.isInteger(s.turn) || s.turn < 0 || s.turn > TOTAL_TURNS || !Number.isInteger(s.rng) || s.rng < 0 || s.rng > 4294967295 || !Number.isInteger(s.ap) || s.ap < 0 || s.ap > AP_PER_MONTH || !finite(s.influence) || s.influence < 0 || s.influence > 999 || !finite(s.seats) || s.seats < .05 || s.seats > .95) fail();
  if (!PHASES.includes(s.phase)) fail();
  if (!Number.isInteger(s.day) || s.day < 1 || s.day > daysInMonth(s.turn) || (s.turn === TOTAL_TURNS && s.day !== 1)) fail();
  const ids = key => d[key].map(x => x.id), exactKeys = (o, keys) => object(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
  if (!exactKeys(s.stats, ids('metrics')) || d.metrics.some(m => !finite(s.stats[m.id]) || s.stats[m.id] < m.min || s.stats[m.id] > m.max)) fail();
  if (!exactKeys(s.support, ids('interestGroups')) || d.interestGroups.some(g => !finite(s.support[g.id]) || s.support[g.id] < 0 || s.support[g.id] > 100)) fail();
  if (!exactKeys(s.relations, ids('countries')) || d.countries.some(n => !finite(s.relations[n.id]) || s.relations[n.id] < 0 || s.relations[n.id] > 100)) fail();
  if (!object(s.budget) || Object.keys(s.budget).length !== 6 || BUDGET_KEYS.some(k => !finite(s.budget[k]) || s.budget[k] < 0 || s.budget[k] > 100) || Math.abs(BUDGET_KEYS.reduce((a, k) => a + s.budget[k], 0) - 100) > .001) fail();
  const validId = (key, id) => typeof id === 'string' && (d[key] || []).some(x => x.id === id), unique = arr => new Set(arr).size === arr.length;
  for (const [key, max] of [['policies', d.policies.length], ['advisers', MAX_ADVISERS], ['queue', 10], ['buildings', d.buildings.length * d.regions.length], ['construction', E.queueMax + E.privateQueueMax + 1], ['government', E.government.max], ['edicts', d.regions.length], ['delayed', 1000], ['history', TOTAL_TURNS + 1], ['log', 12000], ['visited', VIEWS.length], ['monthActions', d.countries.length]]) if (!Array.isArray(s[key]) || s[key].length > max) fail();
  if (!unique(s.policies) || s.policies.some(id => !validId('policies', id)) || !unique(s.advisers) || s.advisers.some(id => !validId('advisers', id)) || s.queue.some(id => !validId('events', id))) fail();
  // 건물·건설 대기열
  const bdef = id => d.buildings.find(x => x.id === id);
  if (s.buildings.some(b => !exactKeys(b, ['id', 'regionId', 'level', 'pm', 'staff', 'state', 'subsidy']) || !validId('buildings', b.id) || !validId('regions', b.regionId) || !Number.isInteger(b.level) || b.level < 0 || b.level > E.maxLevel
    || !Number.isInteger(b.pm) || b.pm < 0 || b.pm >= bdef(b.id).pm.length || !finite(b.staff) || b.staff < 0 || b.staff > 1 || !Number.isInteger(b.state) || b.state < 0 || b.state > b.level || typeof b.subsidy !== 'boolean'
    || !regionHas(d, b.regionId, bdef(b.id).requires) || (bdef(b.id).private === false && b.state !== b.level))) fail();
  if (!unique(s.buildings.map(b => b.regionId + ':' + b.id))) fail();
  if (s.construction.some(q => !exactKeys(q, ['id', 'regionId', 'progress', 'private']) || !validId('buildings', q.id) || !validId('regions', q.regionId) || !finite(q.progress) || q.progress < 0 || q.progress > bdef(q.id).cost || typeof q.private !== 'boolean' || !regionHas(d, q.regionId, bdef(q.id).requires) || (q.private && bdef(q.id).private === false))) fail();
  if (s.construction.filter(q => !q.private).length > E.queueMax || s.construction.filter(q => q.private).length > E.privateQueueMax) fail();
  // 법률·집권 연합·이해집단
  if (!exactKeys(s.laws, ids('lawGroups')) || d.lawGroups.some(g => !validId('laws', s.laws[g.id]) || lawOf(d, s.laws[g.id]).group !== g.id)) fail();
  if (s.enactment !== null) {
    const en = s.enactment;
    if (!exactKeys(en, ['lawId', 'stage', 'wait', 'setbacks', 'bonus', 'startedTurn']) || !validId('laws', en.lawId) || s.laws[lawOf(d, en.lawId).group] === en.lawId) fail();
    const g = d.lawGroups.find(x => x.id === lawOf(d, en.lawId).group);
    if (!Number.isInteger(en.stage) || en.stage < 0 || en.stage >= E.enactment.stages || !Number.isInteger(en.wait) || en.wait < 1 || en.wait > g.interval || !Number.isInteger(en.setbacks) || en.setbacks < 0 || en.setbacks >= E.enactment.setbacks || !finite(en.bonus) || en.bonus < 0 || en.bonus > 1 || !Number.isInteger(en.startedTurn) || en.startedTurn < 0 || en.startedTurn > s.turn) fail();
  }
  if (!s.government.length || !unique(s.government) || s.government.some(id => !validId('interestGroups', id))) fail();
  if (!exactKeys(s.ig, ids('interestGroups')) || d.interestGroups.some(g => { const x = s.ig[g.id]; return !exactKeys(x, ['mod', 'clout', 'vote']) || !finite(x.mod) || Math.abs(x.mod) > MOD_LIMIT || !finite(x.clout) || x.clout < 0 || x.clout > 1 || !finite(x.vote) || x.vote < 0 || x.vote > 1; })) fail();
  // 시장 상태
  const ec = s.econ, goodIds = ids('goods'), num = (v, lo, hi) => finite(v) && v >= lo && v <= hi;
  if (!exactKeys(ec, ['prices', 'short', 'wage', 'workforce', 'pool', 'dividends', 'sol', 'sol0', 'needBase', 'gdpUnit', 'cpi', 'hist', 'trade'])) fail();
  if (!exactKeys(ec.prices, goodIds) || d.goods.some(g => !num(ec.prices[g.id], g.price * (1 + E.price.floor) - .01, g.price * (1 + E.price.ceiling) + .01))) fail();
  if (!object(ec.short) || Object.entries(ec.short).some(([id, v]) => !goodIds.includes(id) || !num(v, 0, E.shortageMax))) fail();
  if (!num(ec.wage, E.wage * .5, E.wage * 50) || !num(ec.workforce, E.workforce * .9, E.workforce * 3) || !num(ec.pool, 0, E.poolCap) || !num(ec.gdpUnit, 1, 1e7) || !num(ec.cpi, .2, 5)) fail();
  for (const key of ['dividends', 'sol', 'sol0']) if (!exactKeys(ec[key], EC.STRATA) || EC.STRATA.some(i => !num(ec[key][i], 0, 1e7))) fail();
  if (!exactKeys(ec.needBase, goodIds) || goodIds.some(id => !num(ec.needBase[id], 0, 1000))) fail();
  if (!object(ec.hist) || Object.entries(ec.hist).some(([id, h]) => !goodIds.includes(id) || !Array.isArray(h) || h.length > 36 || h.some(v => !num(v, -1, 2)))) fail();
  if (!exactKeys(ec.trade, ['exports', 'imports']) || !num(ec.trade.exports, 0, 1e6) || !num(ec.trade.imports, 0, 1e6)) fail();
  const c = s.counters;
  if (!exactKeys(c, ['built', 'privateBuilt', 'resourceBuilt', 'lawsEnacted', 'lawsFailed', 'regions']) || ['built', 'privateBuilt', 'resourceBuilt', 'lawsEnacted', 'lawsFailed'].some(k => !Number.isInteger(c[k]) || c[k] < 0 || c[k] > 100000) || !Array.isArray(c.regions) || !unique(c.regions) || c.regions.some(id => !validId('regions', id))) fail();
  if (s.edicts.some(x => !object(x) || Object.keys(x).length !== 3 || !validId('edicts', x.edictId) || !validId('regions', x.regionId) || !Number.isInteger(x.startedTurn) || x.startedTurn < 0 || x.startedTurn > s.turn || !regionHas(d, x.regionId, d.edicts.find(e => e.id === x.edictId).requires)) || !unique(s.edicts.map(x => x.regionId))) fail();
  if (!object(s.flags) || Object.entries(s.flags).some(([k, v]) => !FLAG_KEYS.includes(k) || !['string', 'boolean'].includes(typeof v))) fail();
  if (!object(s.lastEvents) || Object.entries(s.lastEvents).some(([k, v]) => !validId('events', k) || !Number.isInteger(v) || v < 0 || v > s.turn)) fail();
  const validEffects = (e, list = d.metrics) => object(e) && Object.entries(e).every(([k, v]) => list.some(m => m.id === k) && finite(v) && Math.abs(v) < 100000);
  if (s.delayed.some(x => !object(x) || !Number.isInteger(x.due) || x.due < 0 || x.due > 300 || !validEffects(x.effects) || typeof x.text !== 'string' || x.text.length > 1000)) fail();
  if (s.history.some(h => !object(h) || !Number.isInteger(h.turn) || h.turn < 0 || h.turn > TOTAL_TURNS || HISTORY_KEYS.some(k => !finite(h[k])))) fail();
  if (s.log.some(l => !object(l) || !Number.isInteger(l.turn) || l.turn < 0 || l.turn > TOTAL_TURNS || typeof l.date !== 'string' || l.date.length > 20 || typeof l.type !== 'string' || l.type.length > 40 || typeof l.text !== 'string' || l.text.length > 2000
    || (l.changes !== undefined && !validEffects(l.changes))
    || (l.eventId !== undefined && !validId('events', l.eventId))
    || (l.kind !== undefined && !['historical_anchor', 'fictional_system'].includes(l.kind))
    || (l.sourceIds !== undefined && (!Array.isArray(l.sourceIds) || l.sourceIds.some(id => !validId('sources', id))))
    || (l.policyId !== undefined && !validId('policies', l.policyId))
    || (l.buildingId !== undefined && !validId('buildings', l.buildingId))
    || (l.lawId !== undefined && !validId('laws', l.lawId))
    || (l.igId !== undefined && !validId('interestGroups', l.igId))
    || (l.regionId !== undefined && !validId('regions', l.regionId))
    || (l.edictId !== undefined && !validId('edicts', l.edictId))
    || (l.countryId !== undefined && !validId('countries', l.countryId)))) fail();
  if (s.visited.some(x => typeof x !== 'string' || !VIEWS.includes(x))) fail();
  if (!unique(s.monthActions) || s.monthActions.some(x => typeof x !== 'string' || !x.startsWith('diplomacy:') || !validId('countries', x.slice(10)))) fail();
  if (s.lastFinance !== null && (!object(s.lastFinance) || ['income', 'base', 'interest', 'upkeep', 'expense', 'balance', 'turn'].some(k => !finite(s.lastFinance[k])))) fail();
  if (s.report !== null) {
    const r = s.report;
    const keys = ['turn', 'date', 'finance', 'borrowed', 'completed', 'started', 'laws', 'followups', 'election', 'events', 'ending', 'market', 'changes', 'support', 'relations', 'ledger'];
    if (!object(r) || Object.keys(r).some(k => !keys.includes(k)) || !Number.isInteger(r.turn) || r.turn < 0 || r.turn >= TOTAL_TURNS || r.turn >= s.turn || typeof r.date !== 'string' || r.date.length > 20) fail();
    if (!object(r.finance) || ['income', 'base', 'interest', 'upkeep', 'expense', 'balance'].some(k => !finite(r.finance[k])) || !finite(r.borrowed) || r.borrowed < 0) fail();
    const site = x => object(x) && validId('buildings', x.buildingId) && validId('regions', x.regionId);
    if (!Array.isArray(r.completed) || r.completed.length > 40 || r.completed.some(x => !site(x) || typeof x.private !== 'boolean')) fail();
    if (r.started !== null && !site(r.started)) fail();
    if (!Array.isArray(r.laws) || r.laws.length > 2 || r.laws.some(x => !object(x) || !validId('laws', x.lawId) || !['advance', 'enacted', 'debate', 'stall', 'failed'].includes(x.result) || !num(x.chance, 0, 1))) fail();
    if (!Array.isArray(r.followups) || r.followups.length > 50 || r.followups.some(x => !object(x) || typeof x.text !== 'string' || x.text.length > 1000 || !validEffects(x.effects))) fail();
    if (r.election !== null && (!object(r.election) || !finite(r.election.share) || r.election.share < 0 || r.election.share > 100 || typeof r.election.transfer !== 'boolean' || !finite(r.election.seats))) fail();
    if (!Array.isArray(r.events) || r.events.length > 10 || r.events.some(id => !validId('events', id))) fail();
    if (r.ending !== null && !validId('endings', r.ending)) fail();
    if (!exactKeys(r.market, ['gdp', 'unemployment', 'cpi', 'exports', 'imports', 'points', 'used', 'pool']) || Object.values(r.market).some(v => !finite(v))) fail();
    if (!validEffects(r.changes) || !validEffects(r.support, d.interestGroups) || !validEffects(r.relations, d.countries)) fail();
    if (!object(r.ledger) || Object.entries(r.ledger).some(([m, rows]) => !d.metrics.some(x => x.id === m) || !Array.isArray(rows) || rows.length > 40 || rows.some(row => !Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string' || row[0].length > 60 || !finite(row[1])))) fail();
  }
  if (s.ending !== null) {
    if (!object(s.ending) || !validId('endings', s.ending.id) || !Number.isInteger(s.ending.turn) || s.ending.turn < 0 || s.ending.turn > TOTAL_TURNS) fail();
    const e = d.endings.find(x => x.id === s.ending.id); s.ending = { id: e.id, title: e.title, text: e.text, turn: s.ending.turn };
  }
  if (s.turn === TOTAL_TURNS && !s.ending) fail();
  return clone(s);
}

/* ---------- 파생 값 ---------- */
export function achievements(s, d) {
  const happy = d.economy.approval.thresholds.happy;
  return d.achievements.filter(a => Object.entries(a.condition).every(([k, v]) =>
    k === 'policies' ? s.policies.length >= v
      : k === 'lawsEnacted' ? s.counters.lawsEnacted >= v
        : k === 'built' ? s.counters.built >= v
          : k === 'regionsBuilt' ? s.counters.regions.length >= v
            : k === 'resourceBuilt' ? s.counters.resourceBuilt >= v
              : k === 'edicts' ? (s.edicts || []).length >= v
                : k === 'tradeSurplus' ? s.econ.trade.exports > 0 && s.econ.trade.exports > s.econ.trade.imports
                  : k === 'happyGroups' ? d.interestGroups.filter(g => s.support[g.id] >= happy).length >= v
                    : k === 'noShortage' ? s.phase === 'governing' && d.goods.every(g => s.econ.prices[g.id] <= g.price * 1.25)
                      : k === 'turn' ? s.turn >= v
                        : k === 'ending' ? !!s.ending
                          : k === 'view' ? s.visited.includes(v)
                            : s.stats[k] >= v));
}
