/* 대한민국 1960: 선택의 연대기 — 계산 엔진 v2
 *
 * example/engine.mjs(v1 참조 구현)를 발전시킨 의존성 없는 순수 모듈이다.
 * DOM·localStorage·네트워크를 사용하지 않는다. 모든 수치는 게임 설계용 가상 값이다.
 *
 * v1과 같은 것: 월 재정·생산·사회 지표 수식, 사건 큐 구성, 난수(xorshift32), 정책·사업·외교·자문·상환 규칙,
 *               선거 주기, 엔딩 우선순위, dispatch/exportSave/importSave 인터페이스.
 * v2에서 바뀐 것(docs/SIMULATION_RULES.md "v2 변경" 참고):
 *   1. 법안 통과 확률에 종합 지지도 항을 더했다.
 *   2. 외교 행동은 상대마다 한 달에 한 번.
 *   3. 1979년 12월까지 끝낼 수 없는 사업·법안은 시작할 수 없다.
 *   4. 월 결산 보고서(report)와 지표별 변화 원인(ledger)을 상태에 남긴다.
 *   5. 행동이 남긴 연대기 항목에 지표 변화(changes)를 기록한다.
 *   6. 저장 버전 2. 버전 1 저장은 migrateSave()로 변환해 읽는다.
 * 데이터 1.3.0(저장 버전 4): 권역 지형·자원(traits), 자원을 쓰는 고유 사업(projects[].requires),
 *   지역 시책(edicts, 권역마다 하나, 동시 개수는 행정 역량에 따라). docs/SIMULATION_RULES.md "권역 지형·자원과 지역 시책".
 */
export const SAVE_VERSION = 4; // 3: 날짜(day), 4: 지역 시책(edicts). 1·2·3은 불러올 때 변환한다.
export const SAVE_FORMAT = 'KOREA1960_SAVE';
export const LEGACY_DATA_VERSIONS = { 1: '1.0.0' };
/** 같은 저장 형식(2)에서 그대로 이어 받을 수 있는 이전 데이터 버전. ID·상태 구조가 같고 수치 규칙만 다르다. */
export const COMPATIBLE_DATA_VERSIONS = ['1.1.0', '1.2.0'];
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
export const BILL_STAGES = ['introduced', 'committee', 'legal_review', 'plenary', 'passed', 'failed'];
export const VIEWS = ['map', 'overview', 'policy', 'assembly', 'build', 'budget', 'diplomacy', 'cabinet', 'archive'];
/** 지역 시책 동시 개수 = EDICT_CAP_BASE + floor(행정 역량 / EDICT_CAP_ADMIN). 행정 역량 40이면 3개. */
export const EDICT_CAP_BASE = 2;
export const EDICT_CAP_ADMIN = 30;
/** 사업 준공 1건이 권역 개발도에 더하는 기본값(데이터의 development가 없을 때). */
export const DEFAULT_DEVELOPMENT = 9;
export const DIPLOMACY_MODES = {
  talk: { label: '정례 대화', cost: 4, relation: 4, effects: { security: 1 } },
  technology: { label: '기술 교류', cost: 7, relation: 3, effects: { education: 2, reserves: -1 } },
  humanitarian: { label: '인도적 협력', cost: 5, relation: 5, effects: { legitimacy: 1, welfare: 1 } }
};
const FLAG_KEYS = ['route', 'won1963', 'constitutionalLimit', 'authoritarian'];
const HISTORY_KEYS = ['gdp', 'inflation', 'liberty', 'legitimacy', 'welfare', 'environment'];

const clone = x => JSON.parse(JSON.stringify(x));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = v => typeof v === 'number' && Number.isFinite(v);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const round = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n;

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
  for (const f of d.factions) s.support[f.id] = clamp(s.support[f.id], 0, 100);
  for (const n of d.countries) s.relations[n.id] = clamp(s.relations[n.id], 0, 100);
  s.influence = clamp(s.influence, 0, 999);
  s.seats = clamp(s.seats, .05, .95);
}
function log(s, type, text, extra = {}) { s.log.push({ turn: s.turn, date: dayLabel(s.turn, s.day || 1), type, text, ...extra }); }
/* ---------- 밸런스 규칙(데이터 1.2.0의 balance 블록) ----------
 * balance가 없으면 모든 배율이 1이고 새 월 항목이 없어 v1과 같은 계산이 된다(회귀 비교에 쓴다). */
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
function apply(s, effects = {}, d = null, kind = null) {
  for (const [k, v] of Object.entries(effects)) {
    if (!Object.hasOwn(s.stats, k) || !finite(v)) throw new Error(`미등록 효과: ${k}`);
    s.stats[k] += scaled(s, d, k, v, kind);
  }
}
function faction(s, e = {}) { for (const [k, v] of Object.entries(e)) s.support[k] = clamp(s.support[k] + v, 0, 100); }
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
    support: Object.fromEntries(d.factions.map(f => [f.id, f.initialSupport])),
    relations: Object.fromEntries(d.countries.map(n => [n.id, n.initialRelation])),
    budget: { industry: 22, agriculture: 18, education: 16, welfare: 16, infrastructure: 16, security: 12 },
    policies: [], bills: [], projects: [], edicts: [], advisers: [], flags: {}, queue: [], lastEvents: {}, delayed: [],
    history: [], log: [], ending: null, lastFinance: null, visited: [],
    report: null, monthActions: []
  };
  log(s, 'start', '1960년 1월. 국정 지표를 관찰하며 공적 역할의 원칙을 준비한다.');
  queueMonth(s, d); snapshot(s);
  return s;
}
function snapshot(s) { s.history.push({ turn: s.turn, gdp: s.stats.gdp, inflation: s.stats.inflation, liberty: s.stats.liberty, legitimacy: s.stats.legitimacy, welfare: s.stats.welfare, environment: s.stats.environment }); }
export function supportAverage(s, d) { return d.factions.reduce((v, f) => v + s.support[f.id] * f.weight, 0); }
export const isExecutive = s => EXECUTIVE_PHASES.includes(s.phase);

/* ---------- 권역: 지형·자원, 고유 사업, 지역 시책(데이터 1.3.0) ---------- */
/** 권역의 지형·자원 ID 목록. */
export function regionTags(d, regionId) { const r = d.regions.find(x => x.id === regionId); return r ? [...(r.terrain || []), ...(r.resources || [])] : []; }
/** requires(지형·자원 ID) 중 하나라도 권역에 있으면 true. 빈 목록이면 어느 권역이나. */
export function regionHas(d, regionId, requires) { if (!requires || !requires.length) return true; const tags = regionTags(d, regionId); return requires.some(t => tags.includes(t)); }
export const traitNames = (d, ids = []) => ids.map(id => ((d.traits || []).find(t => t.id === id) || { name: id }).name);
/** 받침에 따라 '이/가'. 사유 문장용. */
function iga(word) { const c = word.charCodeAt(word.length - 1) - 0xAC00; return word + (c >= 0 && c < 11172 && c % 28 ? '이' : '가'); }
export function edictCap(s) { return EDICT_CAP_BASE + Math.floor(clamp(s.stats.admin, 0, 100) / EDICT_CAP_ADMIN); }
export function regionEdict(s, regionId) { return (s.edicts || []).find(x => x.regionId === regionId) || null; }
/** 권역 시책의 사업 착수비 감면 비율(0~0.5). */
export function buildDiscount(s, d, regionId) { const a = regionEdict(s, regionId), e = a && (d.edicts || []).find(x => x.id === a.edictId); return e && finite(e.buildDiscount) ? e.buildDiscount : 0; }
/** 이 권역에서 사업을 착수할 때 실제로 드는 비용(시책 감면 반영). */
export function projectCost(s, d, id, regionId) { const p = d.projects.find(x => x.id === id); return p ? round(p.cost * (1 - buildDiscount(s, d, regionId)), 2) : 0; }

/* ---------- 행동 가능 여부. UI와 dispatch가 같은 함수를 쓴다. ---------- */
function baseReason(s, { ap = true, government = true, parliament = false } = {}) {
  if (s.ending) return '캠페인이 종료되었습니다.';
  if (s.queue.length) return '이번 달 사건을 먼저 결정하세요.';
  if (ap && s.ap < 1) return '행동점수가 부족합니다.';
  if (government && !isExecutive(s)) return '현재 단계에는 국정 집행 권한이 없습니다.';
  if (parliament && s.phase !== 'governing') return '민정 취임 이후 정규 의회에서 발의할 수 있습니다.';
  return '';
}
function fundsReason(s, cost) { return s.stats.treasury < cost ? '국고가 부족합니다.' : ''; }
export function governmentReason(s, cost = 0, ap = true) { return baseReason(s, { ap }) || fundsReason(s, cost); }
export function policyReason(s, d, id) {
  const p = d.policies.find(x => x.id === id); if (!p) return '알 수 없는 정책입니다.';
  return baseReason(s, { parliament: p.requiresBill })
    || (calendar(s.turn).year < p.unlockYear ? `${p.unlockYear}년부터 검토할 수 있습니다.` : '')
    || (s.policies.includes(id) ? '이미 시행 중입니다.' : '')
    || (s.bills.some(b => b.policyId === id && !['passed', 'failed'].includes(b.status)) ? '이미 심의 중입니다.' : '')
    || (p.requiresBill && s.turn + 5 > TOTAL_TURNS ? '1979년 12월까지 심의를 마칠 수 없습니다.' : '')
    || fundsReason(s, p.cost);
}
export function projectReason(s, d, id, regionId) {
  const p = d.projects.find(x => x.id === id), r = d.regions.find(x => x.id === regionId);
  if (!p || !r) return '알 수 없는 사업 또는 권역입니다.';
  return baseReason(s)
    || (calendar(s.turn).year < p.unlockYear ? `${p.unlockYear}년부터 착수할 수 있습니다.` : '')
    || (!regionHas(d, regionId, p.requires) ? `이 권역에는 ${iga(traitNames(d, p.requires).join('·'))} 없습니다.` : '')
    || (s.projects.filter(x => x.regionId === regionId).length >= r.slots ? '이 권역의 사업 슬롯이 모두 찼습니다.' : '')
    || (s.projects.some(x => x.regionId === regionId && x.projectId === id) ? '이 권역에 같은 사업이 있습니다.' : '')
    || (s.turn + p.months > TOTAL_TURNS ? '1979년 12월까지 준공할 수 없습니다.' : '')
    || fundsReason(s, projectCost(s, d, id, regionId));
}
export function edictReason(s, d, id, regionId) {
  const e = (d.edicts || []).find(x => x.id === id), r = d.regions.find(x => x.id === regionId);
  if (!e || !r) return '알 수 없는 시책 또는 권역입니다.';
  const cur = regionEdict(s, regionId), cap = edictCap(s);
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

/* ---------- 확률·예측. 표시용이며 난수를 소비하지 않는다. ---------- */
/** 법안 가결 확률(0.15~0.95). v2: 종합 지지도 항 추가. */
export function billChance(s, d) {
  const k = s.stats;
  return clamp(.15 + s.seats * .75 + (k.legitimacy - 50) * .002 + (k.stability - 50) * .001 + (supportAverage(s, d) - 50) * .002, .15, .95);
}
export function billChanceParts(s, d) {
  const k = s.stats;
  return [['기본', .15], ['가상 의석', s.seats * .75], ['정당성', (k.legitimacy - 50) * .002], ['사회 안정', (k.stability - 50) * .001], ['종합 지지도', (supportAverage(s, d) - 50) * .002]];
}
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
export function finance(s, d) {
  const active = s.policies.map(id => d.policies.find(p => p.id === id));
  const completed = s.projects.filter(x => x.status === 'complete').map(x => d.projects.find(p => p.id === x.projectId));
  const income = 11 + s.stats.gdp * .035 + completed.reduce((a, p) => a + p.income, 0);
  const base = 10 + s.stats.gdp * .014;
  const interest = s.stats.debt * .003;
  const edicts = (s.edicts || []).reduce((a, x) => a + d.edicts.find(e => e.id === x.edictId).monthlyCost, 0);
  const upkeep = active.reduce((a, p) => a + p.monthlyCost, 0) + completed.reduce((a, p) => a + p.maintenance, 0) + edicts + s.advisers.length * ADVISER_UPKEEP;
  return { income, base, interest, upkeep, expense: base + interest + upkeep, balance: income - base - interest - upkeep };
}
/** 재정 화면의 항목별 내역. finance()와 같은 수식을 항목으로 나눈다. */
export function financeDetail(s, d) {
  const completed = s.projects.filter(x => x.status === 'complete');
  return {
    taxBase: 11, taxGrowth: s.stats.gdp * .035,
    facilityIncome: completed.map(x => { const p = d.projects.find(q => q.id === x.projectId); return { projectId: p.id, regionId: x.regionId, income: p.income, maintenance: p.maintenance }; }),
    policyUpkeep: s.policies.map(id => { const p = d.policies.find(q => q.id === id); return { policyId: id, cost: p.monthlyCost }; }),
    edictUpkeep: (s.edicts || []).map(x => ({ edictId: x.edictId, regionId: x.regionId, cost: d.edicts.find(e => e.id === x.edictId).monthlyCost })),
    adviserUpkeep: s.advisers.length * ADVISER_UPKEEP,
    baseFixed: 10, baseGrowth: s.stats.gdp * .014
  };
}

/* ---------- 월 처리 ---------- */
function month(s, d) {
  const before = { ...s.stats }, supportBefore = { ...s.support }, relationsBefore = { ...s.relations };
  const ledger = {};
  const track = (source, fn) => {
    const b = { ...s.stats }; fn();
    for (const m of Object.keys(s.stats)) { const dv = s.stats[m] - b[m]; if (dv !== 0) { (ledger[m] ||= []); const row = ledger[m].find(x => x[0] === source); if (row) row[1] += dv; else ledger[m].push([source, dv]); } }
  };
  const report = { turn: s.turn, date: dateLabel(s.turn), finance: null, borrowed: 0, completed: [], bills: [], followups: [], election: null, events: [], ending: null };
  const f = finance(s, d);
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
  // 초반 배분은 플레이어가 조작하는 지출이 아니라 관찰용 국가 기본값이다.
  const rate = clamp((bal && finite(bal.growthBase) ? bal.growthBase : .0025) + k.industry * .00003 + k.education * .000012 + k.infrastructure * .000018 - Math.max(0, k.inflation - 12) * .00015 - k.unemployment * .00004, -.01, .012);
  track('생산 추세', () => { k.gdp *= 1 + rate; });
  track('예산 배분', () => { for (const key of BUDGET_KEYS) add(key, (b[key] - 12) * .006); });
  track('물가 추세·부채 압력', () => { k.inflation += (8 - k.inflation) * .012 + Math.max(0, k.debt - 220) * .0001; });
  track('고용 추세', () => { k.unemployment += (12 - k.unemployment) * .012 - k.industry * .0003; });
  track('산업화의 환경 부담', () => { k.environment -= k.industry * .00035; });
  track('사회 추세', () => {
    add('stability', (k.legitimacy - k.stability) * .008 + (k.welfare - 45) * .0008);
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
  if (executive) {
    track('정책 지속 효과', () => { for (const id of s.policies) apply(s, d.policies.find(x => x.id === id).monthlyEffects, d); });
    track('자문 지속 효과', () => { for (const id of s.advisers) apply(s, d.advisers.find(x => x.id === id).monthlyEffects, d); });
    if ((s.edicts || []).length) track('지역 시책', () => { for (const a of s.edicts) apply(s, d.edicts.find(x => x.id === a.edictId).monthlyEffects, d); });
  }
  track('사업 준공', () => {
    for (const p of s.projects) {
      if (p.status === 'complete') continue;
      p.remaining--;
      if (p.remaining <= 0) {
        p.remaining = 0; p.status = 'complete'; p.completedTurn = s.turn;
        const def = d.projects.find(x => x.id === p.projectId); apply(s, def.effects, d);
        report.completed.push({ projectId: p.projectId, regionId: p.regionId });
        log(s, 'construction', `${d.regions.find(x => x.id === p.regionId).name} · ${def.name} 준공.`, { projectId: p.projectId, regionId: p.regionId, changes: roundEffects(def.effects) });
      }
    }
  });
  track('법안 가결', () => {
    for (const bill of s.bills) {
      if (['passed', 'failed'].includes(bill.status)) continue;
      bill.remaining--;
      const progress = bill.total - bill.remaining;
      bill.status = progress <= 1 ? 'introduced' : progress <= 3 ? 'committee' : bill.remaining > 0 ? 'legal_review' : 'plenary';
      if (bill.remaining <= 0) {
        bill.remaining = 0; const p = d.policies.find(x => x.id === bill.policyId);
        const chance = billChance(s, d);
        bill.probability = chance; bill.roll = random(s); bill.status = bill.roll < chance ? 'passed' : 'failed'; bill.resolvedTurn = s.turn;
        if (bill.status === 'passed' && !s.policies.includes(p.id)) activate(s, d, p);
        report.bills.push({ policyId: p.id, status: bill.status, probability: chance });
        log(s, 'bill', `${p.name}: ${bill.status === 'passed' ? '가결' : '부결'} (가상 통과 확률 ${(chance * 100).toFixed(1)}%).`, { policyId: p.id, ...(bill.status === 'passed' ? { changes: roundEffects(p.effects) } : {}) });
      }
    }
  });
  track('지연 효과', () => {
    for (const x of s.delayed.filter(x => x.due <= s.turn + 1)) {
      apply(s, x.effects, d); report.followups.push({ text: x.text, effects: clone(x.effects) });
      log(s, 'followup', x.text, { changes: roundEffects(x.effects) });
    }
    s.delayed = s.delayed.filter(x => x.due > s.turn + 1);
  });
  track('범위 제한', () => normalize(s, d));
  for (const fct of d.factions) { const desired = fct.priorities.reduce((a, id) => a + k[id], 0) / fct.priorities.length; s.support[fct.id] += (desired - s.support[fct.id]) * .025; }
  track('범위 제한', () => normalize(s, d));
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
  const t = { stats: { ...s.stats }, support: { ...s.support }, relations: { ...s.relations }, flags: { ...s.flags }, phase: s.phase, influence: s.influence, seats: s.seats };
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
    case 'project': return projectReason(s, d, action.id, action.regionId);
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
      if (p.requiresBill) {
        const total = 5 + Math.floor(random(s) * 3);
        s.bills.push({ policyId: p.id, total, remaining: total, status: 'introduced', startedTurn: s.turn });
        log(s, 'bill', `${p.name} 발의. 예상 심의 ${total}개월. 시행비 ${p.cost} 재정점은 부결되어도 돌려받지 않는다.`, { policyId: p.id });
      } else {
        activate(s, d, p);
        log(s, 'policy', `${p.name} 시행. ${p.cost} 재정점 지출, 매월 유지비 ${p.monthlyCost}.`, { policyId: p.id });
      }
      break;
    }
    case 'project': {
      const p = d.projects.find(x => x.id === action.id), cost = projectCost(s, d, p.id, action.regionId); s.ap--; s.stats.treasury -= cost;
      s.projects.push({ projectId: p.id, regionId: action.regionId, remaining: p.months, status: 'building', startedTurn: s.turn });
      log(s, 'construction', `${d.regions.find(x => x.id === action.regionId).name} · ${p.name} 착수 (${p.months}개월, ${dateLabel(s.turn + p.months - 1)} 말 준공 예정${cost < p.cost ? `, 시책 감면으로 착수비 ${cost}` : ''}).`, { projectId: p.id, regionId: action.regionId });
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
      log(s, 'finance', `부채 ${action.amount.toFixed(1)} 재정점 상환. 다음 달 이자 ${(action.amount * .003).toFixed(2)} 감소.`);
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
/** 이전 버전 저장을 현재 구조로 바꾸는 순수 함수. 알 수 없는 버전은 거부한다. 검증은 importSave가 한다. */
export function migrateSave(parsed, d) {
  if (!object(parsed) || parsed.format !== SAVE_FORMAT) throw new Error('지원하지 않는 저장 형식 또는 버전입니다.');
  const sameData = s => object(s) && s.gameId === d.meta.id && (s.dataVersion === d.meta.version || COMPATIBLE_DATA_VERSIONS.includes(s.dataVersion));
  if (parsed.version === SAVE_VERSION) {
    const s = parsed.state;
    if (sameData(s) && s.dataVersion !== d.meta.version) {
      const next = clone(s); next.dataVersion = d.meta.version;
      return { ...parsed, state: next, migratedFromData: s.dataVersion };
    }
    return parsed;
  }
  if (parsed.version === 3) {
    // 3 → 4: 지역 시책이 없던 저장. 시책 없이 이어 간다. 나머지 구조는 같다.
    const s = parsed.state;
    if (!sameData(s) || s.version !== 3 || Object.hasOwn(s, 'edicts')) throw new Error('버전 3 저장의 구조가 올바르지 않습니다.');
    const next = clone(s); next.version = SAVE_VERSION; next.dataVersion = d.meta.version; next.edicts = [];
    return { format: SAVE_FORMAT, version: SAVE_VERSION, state: next, migratedFrom: 3, ...(s.dataVersion !== d.meta.version ? { migratedFromData: s.dataVersion } : {}) };
  }
  if (parsed.version === 2) {
    // 2 → 4: 날짜가 없던 월 단위 저장. 그 달 1일, 시책 없이 이어 간다. 나머지 구조는 같다.
    const s = parsed.state;
    if (!sameData(s) || s.version !== 2 || Object.hasOwn(s, 'day') || Object.hasOwn(s, 'edicts')) throw new Error('버전 2 저장의 구조가 올바르지 않습니다.');
    const next = clone(s); next.version = SAVE_VERSION; next.dataVersion = d.meta.version; next.day = 1; next.edicts = [];
    return { format: SAVE_FORMAT, version: SAVE_VERSION, state: next, migratedFrom: 2, ...(s.dataVersion !== d.meta.version ? { migratedFromData: s.dataVersion } : {}) };
  }
  if (parsed.version === 1) {
    const s = parsed.state;
    if (!object(s) || s.version !== 1 || s.dataVersion !== LEGACY_DATA_VERSIONS[1] || s.gameId !== d.meta.id) throw new Error('버전 1 저장의 구조가 올바르지 않습니다.');
    const next = clone(s);
    next.version = SAVE_VERSION; next.dataVersion = d.meta.version; next.report = null; next.monthActions = []; next.day = 1; next.edicts = [];
    return { format: SAVE_FORMAT, version: SAVE_VERSION, state: next, migratedFrom: 1 };
  }
  throw new Error('지원하지 않는 저장 형식 또는 버전입니다.');
}
export function importSave(raw, d) {
  if (typeof raw !== 'string' || raw.length > 2000000) throw new Error('저장 파일 크기 또는 형식이 잘못되었습니다.');
  let parsed; try { parsed = JSON.parse(raw); } catch { throw new Error('읽을 수 없는 JSON입니다.'); }
  if (!object(parsed) || parsed.format !== SAVE_FORMAT || ![1, 2, 3, SAVE_VERSION].includes(parsed.version)) throw new Error('지원하지 않는 저장 형식 또는 버전입니다.');
  const fail = () => { throw new Error('저장 데이터의 구조·ID·값이 올바르지 않습니다.'); };
  try { parsed = migrateSave(parsed, d); } catch { fail(); }
  const s = parsed.state;
  if (!object(s) || s.version !== SAVE_VERSION || s.gameId !== d.meta.id || s.dataVersion !== d.meta.version) fail();
  if (!Number.isInteger(s.turn) || s.turn < 0 || s.turn > TOTAL_TURNS || !Number.isInteger(s.rng) || s.rng < 0 || s.rng > 4294967295 || !Number.isInteger(s.ap) || s.ap < 0 || s.ap > AP_PER_MONTH || !finite(s.influence) || s.influence < 0 || s.influence > 999 || !finite(s.seats) || s.seats < .05 || s.seats > .95) fail();
  if (!PHASES.includes(s.phase)) fail();
  if (!Number.isInteger(s.day) || s.day < 1 || s.day > daysInMonth(s.turn) || (s.turn === TOTAL_TURNS && s.day !== 1)) fail();
  if (!object(s.stats) || Object.keys(s.stats).length !== d.metrics.length || d.metrics.some(m => !finite(s.stats[m.id]) || s.stats[m.id] < m.min || s.stats[m.id] > m.max)) fail();
  if (!object(s.support) || Object.keys(s.support).length !== d.factions.length || d.factions.some(f => !finite(s.support[f.id]) || s.support[f.id] < 0 || s.support[f.id] > 100)) fail();
  if (!object(s.relations) || Object.keys(s.relations).length !== d.countries.length || d.countries.some(n => !finite(s.relations[n.id]) || s.relations[n.id] < 0 || s.relations[n.id] > 100)) fail();
  if (!object(s.budget) || Object.keys(s.budget).length !== 6 || BUDGET_KEYS.some(k => !finite(s.budget[k]) || s.budget[k] < 0 || s.budget[k] > 100) || Math.abs(BUDGET_KEYS.reduce((a, k) => a + s.budget[k], 0) - 100) > .001) fail();
  const validId = (key, id) => typeof id === 'string' && (d[key] || []).some(x => x.id === id), unique = arr => new Set(arr).size === arr.length;
  for (const [key, max] of [['policies', d.policies.length], ['advisers', MAX_ADVISERS], ['queue', 10], ['bills', 1000], ['projects', d.regions.length * 4], ['edicts', d.regions.length], ['delayed', 1000], ['history', TOTAL_TURNS + 1], ['log', 10000], ['visited', VIEWS.length], ['monthActions', d.countries.length]]) if (!Array.isArray(s[key]) || s[key].length > max) fail();
  if (!unique(s.policies) || s.policies.some(id => !validId('policies', id)) || !unique(s.advisers) || s.advisers.some(id => !validId('advisers', id)) || s.queue.some(id => !validId('events', id))) fail();
  if (s.bills.some(b => !object(b) || !validId('policies', b.policyId) || !d.policies.find(p => p.id === b.policyId).requiresBill || !Number.isInteger(b.total) || b.total < 5 || b.total > 7 || !Number.isInteger(b.remaining) || b.remaining < 0 || b.remaining > b.total || !BILL_STAGES.includes(b.status) || !Number.isInteger(b.startedTurn) || b.startedTurn < 0 || b.startedTurn > s.turn || (b.probability !== undefined && (!finite(b.probability) || b.probability < 0 || b.probability > 1)) || (b.roll !== undefined && (!finite(b.roll) || b.roll < 0 || b.roll >= 1)))) fail();
  if (!unique(s.bills.filter(b => !['passed', 'failed'].includes(b.status)).map(b => b.policyId))) fail();
  if (s.projects.some(p => !object(p) || !validId('projects', p.projectId) || !validId('regions', p.regionId) || !Number.isInteger(p.remaining) || p.remaining < 0 || p.remaining > d.projects.find(x => x.id === p.projectId).months || !['building', 'complete'].includes(p.status) || !Number.isInteger(p.startedTurn) || p.startedTurn < 0 || p.startedTurn > s.turn || (p.status === 'complete' && p.remaining !== 0))) fail();
  if (!unique(s.projects.map(p => p.regionId + ':' + p.projectId)) || d.regions.some(r => s.projects.filter(p => p.regionId === r.id).length > r.slots)) fail();
  if (s.edicts.some(x => !object(x) || Object.keys(x).length !== 3 || !validId('edicts', x.edictId) || !validId('regions', x.regionId) || !Number.isInteger(x.startedTurn) || x.startedTurn < 0 || x.startedTurn > s.turn || !regionHas(d, x.regionId, d.edicts.find(e => e.id === x.edictId).requires)) || !unique(s.edicts.map(x => x.regionId))) fail();
  if (!object(s.flags) || Object.entries(s.flags).some(([k, v]) => !FLAG_KEYS.includes(k) || !['string', 'boolean'].includes(typeof v))) fail();
  if (!object(s.lastEvents) || Object.entries(s.lastEvents).some(([k, v]) => !validId('events', k) || !Number.isInteger(v) || v < 0 || v > s.turn)) fail();
  const validEffects = (e, ids = d.metrics) => object(e) && Object.entries(e).every(([k, v]) => ids.some(m => m.id === k) && finite(v) && Math.abs(v) < 100000);
  if (s.delayed.some(x => !object(x) || !Number.isInteger(x.due) || x.due < 0 || x.due > 300 || !validEffects(x.effects) || typeof x.text !== 'string' || x.text.length > 1000)) fail();
  if (s.history.some(h => !object(h) || !Number.isInteger(h.turn) || h.turn < 0 || h.turn > TOTAL_TURNS || HISTORY_KEYS.some(k => !finite(h[k])))) fail();
  if (s.log.some(l => !object(l) || !Number.isInteger(l.turn) || l.turn < 0 || l.turn > TOTAL_TURNS || typeof l.date !== 'string' || l.date.length > 20 || typeof l.type !== 'string' || l.type.length > 40 || typeof l.text !== 'string' || l.text.length > 2000
    || (l.changes !== undefined && !validEffects(l.changes))
    || (l.eventId !== undefined && !validId('events', l.eventId))
    || (l.kind !== undefined && !['historical_anchor', 'fictional_system'].includes(l.kind))
    || (l.sourceIds !== undefined && (!Array.isArray(l.sourceIds) || l.sourceIds.some(id => !validId('sources', id))))
    || (l.policyId !== undefined && !validId('policies', l.policyId))
    || (l.projectId !== undefined && !validId('projects', l.projectId))
    || (l.regionId !== undefined && !validId('regions', l.regionId))
    || (l.edictId !== undefined && !validId('edicts', l.edictId))
    || (l.countryId !== undefined && !validId('countries', l.countryId)))) fail();
  if (s.visited.some(x => typeof x !== 'string' || !VIEWS.includes(x))) fail();
  if (!unique(s.monthActions) || s.monthActions.some(x => typeof x !== 'string' || !x.startsWith('diplomacy:') || !validId('countries', x.slice(10)))) fail();
  if (s.lastFinance !== null && (!object(s.lastFinance) || ['income', 'base', 'interest', 'upkeep', 'expense', 'balance', 'turn'].some(k => !finite(s.lastFinance[k])))) fail();
  if (s.report !== null) {
    const r = s.report;
    const keys = ['turn', 'date', 'finance', 'borrowed', 'completed', 'bills', 'followups', 'election', 'events', 'ending', 'changes', 'support', 'relations', 'ledger'];
    if (!object(r) || Object.keys(r).some(k => !keys.includes(k)) || !Number.isInteger(r.turn) || r.turn < 0 || r.turn >= TOTAL_TURNS || r.turn >= s.turn || typeof r.date !== 'string' || r.date.length > 20) fail();
    if (!object(r.finance) || ['income', 'base', 'interest', 'upkeep', 'expense', 'balance'].some(k => !finite(r.finance[k])) || !finite(r.borrowed) || r.borrowed < 0) fail();
    if (!Array.isArray(r.completed) || r.completed.length > 40 || r.completed.some(x => !object(x) || !validId('projects', x.projectId) || !validId('regions', x.regionId))) fail();
    if (!Array.isArray(r.bills) || r.bills.length > d.policies.length || r.bills.some(x => !object(x) || !validId('policies', x.policyId) || !['passed', 'failed'].includes(x.status) || !finite(x.probability) || x.probability < 0 || x.probability > 1)) fail();
    if (!Array.isArray(r.followups) || r.followups.length > 50 || r.followups.some(x => !object(x) || typeof x.text !== 'string' || x.text.length > 1000 || !validEffects(x.effects))) fail();
    if (r.election !== null && (!object(r.election) || !finite(r.election.share) || r.election.share < 0 || r.election.share > 100 || typeof r.election.transfer !== 'boolean' || !finite(r.election.seats))) fail();
    if (!Array.isArray(r.events) || r.events.length > 10 || r.events.some(id => !validId('events', id))) fail();
    if (r.ending !== null && !validId('endings', r.ending)) fail();
    if (!validEffects(r.changes) || !validEffects(r.support, d.factions) || !validEffects(r.relations, d.countries)) fail();
    if (!object(r.ledger) || Object.entries(r.ledger).some(([m, rows]) => !d.metrics.some(x => x.id === m) || !Array.isArray(rows) || rows.length > 30 || rows.some(row => !Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string' || row[0].length > 60 || !finite(row[1])))) fail();
  }
  if (s.ending !== null) {
    if (!object(s.ending) || !validId('endings', s.ending.id) || !Number.isInteger(s.ending.turn) || s.ending.turn < 0 || s.ending.turn > TOTAL_TURNS) fail();
    const e = d.endings.find(x => x.id === s.ending.id); s.ending = { id: e.id, title: e.title, text: e.text, turn: s.ending.turn };
  }
  if (s.turn === TOTAL_TURNS && !s.ending) fail();
  return clone(s);
}

/* ---------- 파생 값 ---------- */
/** 권역 개발도 = 초기값 + 준공 사업마다 development(없으면 9). 고유 사업은 12~14. */
export function regionDevelopment(s, d, id) {
  const r = d.regions.find(x => x.id === id);
  return clamp(r.initialDevelopment + s.projects.filter(p => p.regionId === id && p.status === 'complete').reduce((a, p) => { const def = d.projects.find(x => x.id === p.projectId); return a + (finite(def.development) ? def.development : DEFAULT_DEVELOPMENT); }, 0), 0, 100);
}
export function achievements(s, d) {
  return d.achievements.filter(a => Object.entries(a.condition).every(([k, v]) =>
    k === 'policies' ? s.policies.length >= v
      : k === 'passedBills' ? s.bills.filter(x => x.status === 'passed').length >= v
        : k === 'completedProjects' ? s.projects.filter(x => x.status === 'complete').length >= v
          : k === 'regionsBuilt' ? new Set(s.projects.filter(x => x.status === 'complete').map(x => x.regionId)).size >= v
            : k === 'uniqueProjects' ? s.projects.filter(x => x.status === 'complete' && d.projects.find(p => p.id === x.projectId).requires).length >= v
              : k === 'edicts' ? (s.edicts || []).length >= v
            : k === 'turn' ? s.turn >= v
              : k === 'ending' ? !!s.ending
                : k === 'view' ? s.visited.includes(v)
                  : s.stats[k] >= v));
}
