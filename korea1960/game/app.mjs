/* 대한민국 1960: 선택의 연대기 — 화면 v3.1 (시장·건물·법률·이해집단 화면, 경제 지표(국민 계정) 화면)
 * 입력을 engine.dispatch로 보내고 돌려받은 상태만 그린다. 비용·결과를 화면에서 따로 계산해 상태를 바꾸지 않는다.
 * 예외: 화면 방문 기록(state.visited)만 UI가 갱신한다(기록 표식 '기록을 읽는 사람' 판정용). */
import * as E from './engine.mjs';

const data = globalThis.__DATA__ || await fetch('../data/game.json').then(r => { if (!r.ok) throw Error('콘텐츠를 읽지 못했습니다.'); return r.json(); });
/** 권역 지도(assets/map/korea_map.json, Natural Earth 퍼블릭 도메인을 tools/make_map.py로 단순화). 없으면 지도 대신 안내를 보인다. */
const MAP = globalThis.__MAP__ || await fetch('../assets/map/korea_map.json').then(r => r.ok ? r.json() : null).catch(() => null);
const STORE_KEY = 'korea1960.game.v3', OLD_KEYS = ['korea1960.game.v2', 'korea1960.reference.v1'], BACKUP_KEY = 'korea1960.game.v3.unreadable';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const art = id => globalThis.__ASSETS__?.[id] || `../assets/art/${id}.webp`;
const icon = id => `<img class="icon" alt="" aria-hidden="true" src="${globalThis.__ICONS__?.[id] || `../assets/ui/${id}.svg`}">`;
const byId = (key, id) => data[key].find(x => x.id === id);
const metric = id => byId('metrics', id);
const mlabel = id => metric(id)?.label || id;
const num = (v, n = 1) => Number(v).toLocaleString('ko-KR', { maximumFractionDigits: n, minimumFractionDigits: n });
const minus = (v, n = 2) => Math.abs(v) < .5 * 10 ** -n ? num(0, n) : `−${num(Math.abs(v), n)}`;
const signed = (v, n = 1) => (v > 0 ? '+' : v < 0 ? '−' : '±') + num(Math.abs(v), n);
const digits = id => id === 'gdp' ? 0 : 1;
const ym = turn => { const c = E.calendar(Math.min(turn, 239)); return `${c.year}년 ${c.month}월`; };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** 숫자 뒤 '로/으로'(일·이·사·오·칠·팔·구 → 로, 삼·육·영·십 → 으로). */
const roParticle = n => ['으로', '로', '로', '으로', '로', '로', '으로', '로', '로', '로'][Math.abs(Math.trunc(n)) % 10];
/** '1961년 5월 16일 (화)'. 요일은 실제 달력. */
const fullDate = (turn, day) => { const c = E.calendar(Math.min(turn, 239)); return `${c.year}년 ${c.month}월 ${day}일 (${WEEK[new Date(Date.UTC(c.year, c.month - 1, day)).getUTCDay()]})`; };
/** 오늘부터 앞으로 n번째 달 말일까지 남은 날 수(오늘 포함). n=1이면 이번 달 말일까지. */
const daysUntilMonthEnd = (n = 1) => { let total = E.daysInMonth(state.turn) - state.day + 1; for (let k = 1; k < n; k++) total += E.daysInMonth(state.turn + k); return total; };
const SHORT = { liberty: '자유', legitimacy: '정당성', gdp: '생산', industry: '산업', welfare: '생활수준', equality: '분배', environment: '환경지수', treasury: '국고', debt: '부채' };
/** 상단 지표 막대: 엔딩 평가의 네 축(성장·권리·생활·환경)과 재정. 서로 상쇄하지 않는 축이라 따로 묶는다. */
const STAT_GROUPS = [['권리', ['liberty', 'legitimacy']], ['성장', ['gdp', 'industry']], ['생활', ['welfare', 'equality']], ['환경', ['environment']], ['재정', ['treasury', 'debt']]];
const lowerBetter = id => metric(id) && metric(id).higherIsBetter === false;
const tone = (id, delta) => Math.abs(delta) < 1e-9 ? 'flat' : ((delta > 0) !== lowerBetter(id) ? 'good' : 'bad');
const arrow = delta => Math.abs(delta) < 1e-9 ? '–' : delta > 0 ? '▲' : '▼';

/* ---------- 설명 문구 (가상 모형의 규칙을 사람이 읽는 말로) ---------- */
const pct = v => `${+(v * 100).toFixed(2)}%`;
const EK = data.economy;
const METRIC_HELP = {
  gdp: '건물이 만든 부가가치(산출의 값 − 투입의 값)에 자급 농가의 산출과 정부 인건비를 더해 1960년 1월을 100으로 놓은 지수. 값이 오른 상품을 더 만들수록, 더 많은 사람이 일할수록 오른다. 경제 지표 화면은 이 지수를 1960년 1월 1인당 국민소득 79달러에 맞춘 금액(GDP·GNP·PPP·1인당 금액)으로 바꿔 보인다.',
  treasury: '매월 세입(소비세·임금세·이익세·토지세·관세·국영 배당) − 기본 지출 − 이자 − 정부 인건비·물자 − 건설 자재값 − 보조금·유지비만큼 변한다. 0보다 작아지면 부족분이 자동으로 부채가 된다.',
  debt: `국고 부족분이 자동으로 더해지고 상환하면 줄어든다. 매월 부채의 ${pct(EK.interest)}가 이자. ${EK.inflation.debtFrom}을 넘으면 물가를 밀어 올리고, 700 이상이면 재정위기 엔딩.`,
  reserves: `매월 (수출 − 수입) × ${EK.forexScale}과 원조(1970년까지 줄어든다)만큼 움직인다. ${EK.forexFloor} 아래로 내려가면 수입이 줄어든다. 정책·사건으로도 변한다.`,
  inflation: `시장 가격으로 잰 물가 지수를 따른다: 매월 (${EK.inflation.base} + ${EK.inflation.perCpi} × (물가 지수 − 1) + 부채 ${EK.inflation.debtFrom} 초과분 × ${EK.inflation.debtRate})을 향해 ${pct(EK.inflation.speed)}씩 움직인다.`,
  unemployment: `건물 일자리에도 자급 농가에도 들지 못한 사람의 비율. 노동 인구는 매월 ${pct(EK.workforceGrowth)}씩 늘어난다. 매월 실제 비율을 향해 ${pct(EK.unemploymentSpeed)}씩 움직이고, 18을 넘으면 사회 안정을 깎는다.`,
  legitimacy: `매월 (자유−50)×0.08% + (생활−45)×0.05%만큼 움직이고, 집권 연합의 세력이 ${Math.round(EK.government.center * 100)}%보다 크면 오르고 작으면 내린다. 법률 제정·선거에 반영되고 3 이하이면 신뢰 붕괴 엔딩.`,
  liberty: '법률·정책·사건으로 변한다. 3 이하이면 권리 위기 엔딩. 성장과 별개의 평가축이다.',
  welfare: '보건소·주택 같은 정부 건물, 복지·노동 법률, 예산 배분(생활)으로 오른다. 노동자·농민의 생활수준이 1960년보다 높으면 오르고 낮으면 내린다.',
  education: '예산 배분: 매월 (교육 배분율−12)×0.006. 학교·연구소 단계와 교육 정책으로 오른다. 낮으면 제철·기계·전자 공장의 효율이 떨어진다.',
  infrastructure: '예산 배분: 매월 (기반 배분율−12)×0.006. 철도·항만 단계로 오른다. 권역의 기반 시설 용량과 무역 역량, 상가·철도의 처리율에 반영된다.',
  industry: `산업 기술 지수. 예산 배분: 매월 (산업 배분율−12)×0.006. 산업 정책·연구소로 오른다. 1점마다 제조·자원 건물의 처리율 +${pct(EK.techPerPoint)}, 새 생산방식의 조건이다.`,
  agriculture: `농업 기술 지수. 예산 배분: 매월 (농업 배분율−12)×0.006. 농업 정책·관개 시설로 오른다. 1점마다 농장·어항의 처리율 +${pct(EK.techPerPoint)}, 농장 생산방식의 조건이다.`,
  environment: '건물의 환경 부담(단계 × 가동률)만큼 매월 줄어든다. 환경 규제 법률이 부담을 줄이고, 녹화 사업·보건소·에너지 절약으로 회복한다.',
  stability: '매월 정당성을 향해 0.8%씩 움직이고 (생활−45)×0.08%가 더해진다. 실업률이 18을 넘으면 깎이고, 군대·농민·노동자의 특성이 영향을 준다. 억압으로 얻는 단기 효과는 지속되지 않는다.',
  admin: '행정청 단계와 행정 정책·자문으로 오른다. 높을수록 세금이 덜 새고(징수율) 지역 시책을 더 걸 수 있다.',
  equality: '매월 생활 수준을 향해 0.2%씩 움직인다. 노동자·농민의 생활수준이 기업가·지주에 비해 낮을수록 내려간다. 토지·조세·복지 법률로 오른다.',
  security: '예산 배분: 매월 (안보 배분율−12)×0.006. 군 기지 단계와 외교 대화로 오른다. 병력·작전은 다루지 않는다.'
};
/** 데이터의 밸런스 규칙(balance)에서 지표별 설명을 만든다. 규칙이 없으면 1.1.0 설명. */
function metricHelp(id) {
  const b = data.balance, out = [METRIC_HELP[id] || ''];
  const dep = EK.depreciation[id]; if (dep) out.push(`감가: 매월 ${dep.floor}을 넘는 만큼의 ${pct(dep.rate)}가 줄어든다.`);
  if (!b) return out.filter(Boolean).join(' ');
  const x = b.expectations && b.expectations[id];
  if (x && typeof x === 'object') out.push(`높아진 기대: 매월 ${x.target}을 넘는 만큼의 ${pct(x.rate)}가 줄어든다.`);
  if (b.diminishing && b.diminishing.metrics.includes(id)) out.push(`체감: ${b.diminishing.from}을 넘으면 오르는 효과에 (100−현재값)÷${100 - b.diminishing.from}을 곱한다. 100에 가까울수록 같은 정책의 효과가 작아진다(내려가는 효과는 그대로).`);
  const m = b.militaryRule && b.militaryRule.monthly && b.militaryRule.monthly[id];
  if (m) out.push(`과도 군정 동안 매월 ${signed(m, 2)}.`);
  const a = b.authoritarian;
  if (a && (a.monthly[id] || (a.gainFactor && a.gainFactor[id] !== undefined))) out.push(`권력 집중 이후${a.monthly[id] ? ` 매월 ${signed(a.monthly[id], 2)}` : ''}${a.gainFactor && a.gainFactor[id] !== undefined ? `, 오르는 효과 ×${a.gainFactor[id]}(신뢰 할인)` : ''}.`);
  return out.filter(Boolean).join(' ');
}
const PHASE = {
  prelude: { name: '관찰·준비', desc: '1960년의 당신은 대통령이 아닌 군인 박정희입니다. 국정 지표와 시장은 관찰 자료이며 국가 예산을 집행할 수 없습니다. 그동안에도 민간 투자는 건물을 짓습니다.', can: ['사건 결정', '사전 준비 (AP 1 → 준비 영향력 +3)'], cannot: '정책·법률·건설·예산·외교·내각' },
  civilian: { name: '민간 정치 준비', desc: '헌정 경로를 택했습니다. 1963년 가상 선거까지 국정을 집행하지 않고 민간 정치인으로 준비합니다.', can: ['사건 결정', '사전 준비 (AP 1 → 준비 영향력 +3)'], cannot: '정책·법률·건설·예산·외교·내각' },
  transition: { name: '과도 통치', desc: '군정 경로를 택했습니다. 정책·건설·법률·예산·외교·내각을 집행할 수 있습니다. 의회가 없어 법률은 의결로 제정하며 그때마다 자유와 정당성의 비용이 붙습니다. 군대는 집권 연합에서 빠질 수 없습니다.', can: ['행정 정책 시행', '건물 착공·생산방식 변경', '법률 의결 (비용 있음)', '집권 연합 구성', '예산 배분·외교·자문'], cannot: '' },
  elected: { name: '당선인 준비', desc: '1963년 가상 선거에서 당선했습니다. 12월 취임 사건 이후 전면 국정 집행이 열립니다.', can: ['사건 결정', '사전 준비'], cannot: '정책·법률·건설·예산·외교·내각' },
  governing: { name: '국정 운영', desc: '모든 정책·법률·건설·외교·내각 행동을 할 수 있습니다. 정기 선거와 법률 제정의 검사가 권한을 확인합니다.', can: ['정책 시행·법률 발의', '건물 착공·생산방식 변경', '집권 연합 구성', '예산 배분·외교', '자문 임명·해임·부채 상환'], cannot: '' }
};
const LAW_RESULT = { advance: '단계 통과', enacted: '제정', debate: '논쟁', stall: '지체', failed: '폐기' };
const LOG_TYPES = { start: '시작', event: '사건', preparation: '준비', policy: '정책', law: '법률', government: '연합', construction: '건설', edict: '시책', budget: '예산', diplomacy: '외교', cabinet: '내각', finance: '재정', followup: '후속', election: '선거', ending: '엔딩' };
const LOG_FILTERS = [['all', '전체'], ['event', '사건'], ['law', '정책·법률'], ['construction', '건설·시책'], ['money', '재정·예산'], ['foreign', '외교·내각'], ['election', '선거·엔딩']];
const LOG_GROUP = { event: 'event', followup: 'event', preparation: 'event', start: 'event', policy: 'law', law: 'law', government: 'law', construction: 'construction', edict: 'construction', finance: 'money', budget: 'money', diplomacy: 'foreign', cabinet: 'foreign', election: 'election', ending: 'election' };
const BUDGET_LABEL = { industry: '산업', agriculture: '농업', education: '교육', welfare: '생활', infrastructure: '기반 시설', security: '안보' };
const BUDGET_PRESETS = [['기본 배분', { industry: 22, agriculture: 18, education: 16, welfare: 16, infrastructure: 16, security: 12 }], ['산업 우선', { industry: 32, agriculture: 12, education: 14, welfare: 12, infrastructure: 20, security: 10 }], ['생활 우선', { industry: 14, agriculture: 18, education: 18, welfare: 28, infrastructure: 12, security: 10 }], ['인재 우선', { industry: 16, agriculture: 14, education: 30, welfare: 16, infrastructure: 14, security: 10 }]];
const NAV = [['map', '지도'], ['overview', '상황판'], ['laws', '법률'], ['groups', '이해집단'], ['policy', '정책'], ['economy', '경제 지표'], ['market', '시장'], ['build', '건물·건설'], ['budget', '재정'], ['diplomacy', '외교'], ['cabinet', '내각 자문'], ['archive', '기록실']];
const NAV_GROUPS = [['국정', ['map', 'overview', 'laws', 'groups', 'policy']], ['경제·지역', ['economy', 'market', 'build', 'budget']], ['대외·인사', ['diplomacy', 'cabinet']], ['기록', ['archive']]];
/** 새 화면은 기존 아이콘을 함께 쓴다(새 그림 파일을 만들지 않았다). */
const NAV_ICON = { market: 'growth', laws: 'assembly', groups: 'rights', economy: 'economy' };

/* ---------- 상태 ---------- */
const ui = { screen: 'title', view: 'map', mapRegion: null, mapLayer: 'dev', mapBox: null, eventFolded: false, region: 'capital', policyCat: '전체', policyStatus: 'all', buildAll: false, goodCat: 'all', good: null, lawGroup: null, logFilter: 'all', modal: null, toast: null, budgetDraft: null };
let state = null, savedInfo = null, storageNote = '';
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* 저장소 없음 */ } }
};
function loadAutosave() {
  const raw = storage.get(STORE_KEY);
  if (raw) {
    try { return { state: importSave(raw) }; }
    catch (e) { storage.set(BACKUP_KEY, raw); storageNote = `자동 저장을 읽지 못했습니다(${e.message}). 원본은 브라우저에 별도로 보관했습니다.`; }
  } else if (OLD_KEYS.some(k => storage.get(k))) storageNote = `이 브라우저에 이전 판의 자동 저장이 남아 있습니다. ${E.OLD_SAVE_MESSAGE} 새 연대기를 시작하세요(이전 저장은 지우지 않았습니다).`;
  return null;
}
function importSave(raw) { return E.importSave(raw, data); }
/** 파일 다운로드가 막힌 보기 화면(빌드 도구 --artifact로 만든 판). 내보내기를 텍스트 복사로 바꾼다. */
const EMBEDDED = globalThis.__EMBED__ === 'artifact';
function save() {
  if (!state) return;
  if (storage.set(STORE_KEY, E.exportSave(state))) { storageNote = ''; savedInfo = { turn: state.turn }; }
  else storageNote = EMBEDDED ? '이 화면에서는 자동 저장을 쓸 수 없습니다. 기록실의 ‘저장 텍스트 복사’로 진행을 보관하세요.' : '이 브라우저에서는 자동 저장을 쓸 수 없습니다. 기록실에서 저장 파일을 내보내 진행을 보관하세요.';
}
function announce(text) { const live = $('#live'); if (live) { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); } }
function toast(text, opts = {}) {
  const id = Date.now() + Math.random(); ui.toast = { text, ...opts, id }; announce(text);
  setTimeout(() => { if (ui.toast?.id === id) { ui.toast = null; document.querySelector('.toast')?.remove(); } }, opts.bad ? 9000 : 7000);
}

/** 행동을 엔진에 보내고 결과를 기록한다. 성공하면 새 연대기 항목과 지표 변화를 알린다. */
function run(action, { quiet = false } = {}) {
  const prev = state, r = E.dispatch(state, data, action);
  if (!r.ok) { toast(r.error, { bad: true }); render(); return r; }
  state = r.state; ui.modal = null; ui.budgetDraft = action.type === 'budget' ? null : ui.budgetDraft; save();
  if (action.type === 'endMonth') {
    ui.modal = { type: 'report' };
    announce(`${ym(prev.turn)} 결산. ${state.ending ? '연대기 종료: ' + state.ending.title : ym(state.turn) + ' 시작.'}`);
  } else if (!quiet) {
    const added = state.log.slice(prev.log.length);
    const changes = added[0]?.changes || {};
    toast(added.map(l => l.text).join(' / ') || '처리했습니다.', { changes });
  }
  if (state.ending && !prev.ending) { ui.view = 'overview'; if (action.type !== 'endMonth') ui.modal = null; stopClock(); }
  else if (action.type === 'choose' && clock.waiting && !state.queue.length) { clock.waiting = false; clock.running = true; schedule(); } // 결정하면 다시 흐른다
  else if (action.type === 'endMonth') { stopClock(); } // 건너뛰기는 시계를 멈춘 채 결산 창을 연다(결정 뒤 저절로 흐르지 않는다)
  render(); return r;
}

/* ---------- 시계: 한 틱 = 하루 ----------
 * 엔진의 tick 행동이 하루를 넘기고, 말일 다음 틱에서 월 결산을 한다. 결정할 사건이 생기면 엔진이 tick을 거부하므로
 * 시계가 스스로 멈추고(결정 대기), 사건을 결정하면 다시 흐른다. 창(모달)이 열려 있거나 탭이 숨으면 기다린다.
 * 하루가 지날 때는 날짜·진행 막대만 고치고, 달이 바뀔 때만 화면 전체를 다시 그린다. */
const SPEEDS = { 1: 700, 2: 350, 4: 160, 8: 70 }; // 배속 → 하루당 밀리초
const CLOCK_KEY = 'korea1960.clock.speed';
const clock = { running: false, waiting: false, speed: SPEEDS[Number(storage.get(CLOCK_KEY))] ? Number(storage.get(CLOCK_KEY)) : 1, timer: null };
function clockReason() {
  if (!state || ui.screen !== 'game') return '진행 중인 연대기가 없습니다.';
  if (state.ending) return '연대기가 끝났습니다.';
  if (state.queue.length) return '결정할 사건이 있습니다. 결정하면 시간이 다시 흐릅니다.';
  return '';
}
function schedule() { clearTimeout(clock.timer); clock.timer = clock.running ? setTimeout(stepDay, SPEEDS[clock.speed]) : null; }
function startClock() {
  const reason = clockReason();
  if (reason) { if (state && state.queue.length && !state.ending) clock.waiting = true; toast(reason, { bad: !state?.queue.length }); render(); return; }
  clock.running = true; clock.waiting = false; schedule(); render();
}
function stopClock({ waiting = false } = {}) { const was = clock.running; clock.running = false; clock.waiting = waiting; schedule(); if (was && state) save(); }
function stepDay() {
  clock.timer = null;
  if (!clock.running || !state) return;
  if (ui.modal || document.hidden || ui.screen !== 'game') { schedule(); return; }
  const prev = state, r = E.dispatch(state, data, { type: 'tick' });
  if (!r.ok) { stopClock({ waiting: !!state.queue.length && !state.ending }); render(); return; }
  state = r.state;
  if (state.turn === prev.turn) { syncClock(); schedule(); return; }
  // 월 결산이 일어났다.
  save();
  const rep = state.report, f = rep.finance;
  const notes = [`${ym(prev.turn)} 결산: 월 수지 ${signed(f.balance, 2)}`];
  if (rep.borrowed > 0) notes.push(`부족분 ${num(rep.borrowed, 1)} 차입`);
  if (rep.laws.length) notes.push(`법률 ${rep.laws.map(x => `${byId('laws', x.lawId).name} ${LAW_RESULT[x.result]}`).join(', ')}`);
  if (rep.completed.length) notes.push(`준공 ${rep.completed.map(x => byId('buildings', x.buildingId).name + (x.private ? '(민간)' : '')).join(', ')}`);
  if (rep.election) notes.push(`가상 정기 선거 득표 지표 ${num(rep.election.share, 1)}`);
  if (state.ending) { stopClock(); ui.view = 'overview'; ui.modal = { type: 'report' }; announce(`연대기 종료: ${state.ending.title}`); render(); return; }
  if (state.queue.length) { stopClock({ waiting: true }); notes.push('새 사건이 도착해 시간을 멈췄습니다'); }
  toast(notes.join(' · '));
  render(); schedule();
}
/** 하루가 지날 때 바뀌는 부분만 고친다(초점·스크롤·열린 항목을 건드리지 않는다). */
function syncClock() {
  const dim = E.daysInMonth(state.turn), left = dim - state.day + 1;
  document.querySelectorAll('.js-date').forEach(el => { el.textContent = fullDate(state.turn, state.day); });
  document.querySelectorAll('.js-date-short').forEach(el => { el.textContent = `${E.calendar(state.turn).month}월 ${state.day}일`; });
  document.querySelectorAll('.js-left').forEach(el => { el.textContent = `월 결산까지 ${left}일`; });
  document.querySelectorAll('.js-days').forEach(el => { el.textContent = String(left); });
  document.querySelectorAll('.js-bar').forEach(el => { el.style.width = `${(state.day - 1) / dim * 100}%`; });
  const prog = $('#agenda-progress'); if (prog) prog.innerHTML = progressList();
  document.querySelectorAll('.js-countdown').forEach(el => { el.textContent = String(daysUntilMonthEnd(Number(el.dataset.months))); });
}
function setSpeed(n) { if (!SPEEDS[n]) return; clock.speed = n; storage.set(CLOCK_KEY, String(n)); schedule(); render(); }
const PLAY_SVG = '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
const PAUSE_SVG = '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" fill="currentColor"/><rect x="9.5" y="2.5" width="3" height="11" fill="currentColor"/></svg>';
const SKIP_SVG = '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3v10l6-5zM8 3v10l6-5z" fill="currentColor"/></svg>';
function clockButtons({ compact = false } = {}) {
  const reason = clockReason();
  const play = clock.running
    ? `<button type="button" class="btn clock-play on" data-action="clockToggle" aria-pressed="true" title="일시정지 (스페이스)">${PAUSE_SVG}${compact ? '<span class="sr-only">일시정지</span>' : '<span>일시정지</span>'}</button>`
    : `<button type="button" class="btn clock-play ${reason ? '' : 'primary'}" data-action="clockToggle" aria-pressed="false" ${reason && !state.queue.length ? `aria-disabled="true" disabled title="${esc(reason)}"` : `title="${esc(reason || '시간 진행 (스페이스)')}"`}>${PLAY_SVG}${compact ? '<span class="sr-only">시간 진행</span>' : '<span>진행</span>'}</button>`;
  const speeds = compact
    ? `<button type="button" class="btn speed" data-action="speedCycle" title="배속 바꾸기" aria-label="배속 ×${clock.speed}, 누르면 바꾸기">×${clock.speed}</button>`
    : `<span class="speeds" role="group" aria-label="배속">${Object.keys(SPEEDS).map(n => `<button type="button" class="btn speed" data-action="speed" data-id="${n}" aria-pressed="${clock.speed === Number(n)}" title="하루 ${SPEEDS[n] / 1000}초">×${n}</button>`).join('')}</span>`;
  return play + speeds;
}
function clockPanel() {
  const dim = E.daysInMonth(state.turn), left = dim - state.day + 1;
  const status = state.ending ? '종료' : state.queue.length ? '결정 대기' : clock.running ? '진행 중' : '멈춤';
  return `<div class="clock" role="group" aria-label="날짜와 시간">
  <div class="clock-date"><strong class="js-date">${esc(state.ending ? `${ym(Math.min(state.ending.turn, 239))} · 종료` : fullDate(state.turn, state.day))}</strong>
  <small><span class="chip ${state.queue.length && !state.ending ? 'warn' : clock.running ? 'run' : ''}">${status}</span> <span class="js-left">${state.ending ? '' : `월 결산까지 ${left}일`}</span></small>
  <span class="month-bar" aria-hidden="true"><i class="js-bar" style="width:${(state.day - 1) / dim * 100}%"></i></span></div>
  <div class="clock-ctl">${clockButtons()}${btn(`${SKIP_SVG}<span class="sr-only">이번 달 남은 날 건너뛰기</span>`, 'endMonth', { cls: 'skip', reason: E.endMonthReason(state), title: `남은 ${left}일을 건너뛰고 월 결산` })}</div></div>`;
}

/* ---------- 작은 조각 ---------- */
function btn(label, action, { attrs = '', reason = '', cls = '', title = '' } = {}) {
  return `<button type="button" class="btn ${cls}" data-action="${esc(action)}" ${attrs} ${reason ? `aria-disabled="true" disabled title="${esc(reason)}"` : title ? `title="${esc(title)}"` : ''}>${label}</button>`;
}
const reasonLine = r => r ? `<small class="reason" role="note">사유: ${esc(r)}</small>` : '';
/** 지표 효과 목록. 전/후 값을 함께 보여 준다. */
const wrap = (inline, items) => inline ? `<span class="fx">${items.map(([cls, html]) => `<span class="li ${cls}">${html}</span>`).join('')}</span>` : `<ul class="fx">${items.map(([cls, html]) => `<li class="${cls}">${html}</li>`).join('')}</ul>`;
function fxList(items, { before = true, inline = false } = {}) {
  if (!items.length) return '';
  return wrap(inline, items.map(x => [tone(x.id, x.delta), `<span>${esc(mlabel(x.id))}</span><b>${arrow(x.delta)} ${signed(x.delta, Math.abs(x.delta) < 1 && x.delta !== 0 ? 2 : 1)}</b>${before && x.before !== undefined ? `<small>${num(x.before, digits(x.id))}→${num(x.after, digits(x.id))}${x.base !== undefined ? ` · 기본 ${signed(x.base, 1)}` : ''}</small>` : ''}`]));
}
/** 기본값으로 적힌 지속 효과 아래의 안내. 밸런스 규칙이 없으면 빈 문자열. */
const dimNote = () => data.balance && data.balance.diminishing ? `<p class="muted" style="font-size:13px;margin:4px 0">데이터에 적힌 기본값입니다. 지표가 ${data.balance.diminishing.from}을 넘으면 실제로는 덜 오릅니다(체감).</p>` : '';
function fxPlain(effects = {}, opts) { return fxList(Object.entries(effects).map(([id, delta]) => ({ id, delta })), { before: false, ...opts }); }
function fxProjected(effects = {}) { return fxList(E.projectEffects(state, data, effects)); }
function factionList(effects = {}, inline = false) {
  const items = Object.entries(effects); if (!items.length) return '';
  return wrap(inline, items.map(([id, v]) => [v >= 0 ? 'good' : 'bad', `<span>${esc(byId('interestGroups', id).name)} 지지</span><b>${arrow(v)} ${signed(v, 0)}</b>`]));
}
function relationList(effects = {}, inline = false) {
  const items = Object.entries(effects); if (!items.length) return '';
  return wrap(inline, items.map(([id, v]) => [v >= 0 ? 'good' : 'bad', `<span>${esc(byId('countries', id).name)} 관계</span><b>${arrow(v)} ${signed(v, 0)}</b><small>${num(state.relations[id], 0)}→${num(Math.max(0, Math.min(100, state.relations[id] + v)), 0)}</small>`]));
}
function apDots(ap) { return `<span class="ap-dots" role="img" aria-label="행동점수 ${ap} / 3">${[0, 1, 2].map(i => `<i class="${i < ap ? 'on' : ''}"></i>`).join('')}</span>`; }
function kpi(id, { compact = false } = {}) {
  const m = metric(id), v = state.stats[id], prev = state.history.length > 1 ? state.history.at(-2) : null;
  const change = state.report?.changes?.[id];
  const delta = change !== undefined ? change : prev && prev[id] !== undefined ? v - prev[id] : 0;
  return `<button type="button" class="kpi" data-action="metric" data-id="${id}" aria-label="${esc(m.label)} ${num(v, digits(id))} ${esc(m.unit)}, 지난달 대비 ${signed(delta, 2)}. 설명 보기"><span>${esc(m.label)} <small>${esc(m.unit)}</small></span><strong>${num(v, digits(id))}</strong>${compact ? '' : `<small class="delta ${tone(id, delta)}">${arrow(delta)} ${signed(delta, 2)} 지난달</small>`}</button>`;
}
function stat(id) {
  const m = metric(id), v = state.stats[id], change = state.report?.changes?.[id] ?? 0;
  return `<button type="button" class="stat" data-action="metric" data-id="${id}" aria-label="${esc(m.label)} ${num(v, digits(id))}, 지난 결산 ${signed(change, 2)}. 설명 보기"><span>${esc(SHORT[id] || m.label)}</span><b>${num(v, digits(id))}</b><i class="delta ${tone(id, change)}">${arrow(change)}${num(Math.abs(change), Math.abs(change) < 10 ? 1 : 0)}</i></button>`;
}
function chart(key, color) {
  const series = state.history.map(h => h[key]);
  const min = Math.min(...series), max = Math.max(...series), range = Math.max(1, max - min), n = series.length;
  const x = i => (n <= 1 ? 0 : i / (n - 1) * 480 + 10), y = v => 100 - (v - min) / range * 80;
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const years = [...new Set(state.history.map(h => E.calendar(Math.min(h.turn, 239)).year))];
  const first = series[0], last = series.at(-1);
  return `<article class="panel chart"><div class="row"><h3>${esc(mlabel(key))}</h3><strong>${num(last, digits(key))}</strong></div>
  <svg viewBox="0 0 500 112" role="img" aria-label="${esc(mlabel(key))} 추이: 1960년 1월 ${num(first, digits(key))}에서 현재 ${num(last, digits(key))}. 최저 ${num(min, digits(key))}, 최고 ${num(max, digits(key))}.">
  <line class="axis-base" x1="10" y1="100" x2="490" y2="100"/><line class="axis-top" x1="10" y1="20" x2="490" y2="20" stroke-dasharray="3 4"/>
  <polyline fill="none" style="stroke:${color}" stroke-width="2.4" stroke-linejoin="round" points="${pts}"/><circle cx="${x(n - 1)}" cy="${y(last)}" r="3.4" style="fill:${color}"/></svg>
  <div class="scale"><span>${years[0]}년</span><span>최저 ${num(min, digits(key))} · 최고 ${num(max, digits(key))}</span><span>${years.at(-1)}년</span></div></article>`;
}

/* ---------- 사건 문서 ---------- */
function decisionCard() {
  if (state.ending) return endingCard();
  const e = byId('events', state.queue[0]);
  if (!e) return calmCard();
  const context = E.eventContext(state, e), anchor = e.kind === 'historical_anchor';
  const srcs = e.sourceIds.map(id => byId('sources', id));
  return `<section class="paper decision" aria-labelledby="event-title">
  <div class="art" style="background-image:url('${art(e.art)}')" role="img" aria-label="${esc(artCaption(e.art))}"><span class="tag ${anchor ? 'history' : 'fiction'}">${anchor ? '역사적 사건 · 선택과 결과는 가상' : '가상 정책 상황'}</span><span class="credit">생성 삽화 · 사진 아님</span></div>
  <div class="body"><span class="eyebrow">이번 달의 결정 ${state.queue.length > 1 ? `· 남은 사건 ${state.queue.length}건` : ''}</span>
  <h2 id="event-title">${esc(e.title)}</h2>
  ${anchor ? `<div class="record"><h3>실제 역사 · 출처 확인</h3><p>${esc(e.body.replace(/^실제 역사:\s*/, ''))}</p></div>` : `<p>${esc(e.body)}</p>`}
  ${context ? `<div class="record campaign"><h3>이 캠페인에서는 · 가상</h3><p>${esc(context)}</p></div>` : ''}
  ${srcs.length ? `<p class="sources">사실 확인: ${srcs.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.institution)} · ${esc(s.title)} (${esc(s.id)})</a>`).join(' · ')}</p>` : ''}
  <div class="choices" role="group" aria-label="선택지">${e.choices.map((c, i) => choiceButton(c, i)).join('')}</div>
  <p class="muted" style="font-size:12.5px;margin-top:12px">선택은 행동점수를 쓰지 않습니다. 표시된 국고 비용만 지불합니다. 화살표 옆 숫자는 결정 전→후 값입니다.</p></div></section>`;
}
function artCaption(id) { return { cover: '1960년대 도시를 내다보는 책상 풍경 (생성 삽화)', cabinet: '정책 회의 장면 (생성 삽화)', industry: '항만과 산업 지구 (생성 삽화)', civic: '건물 계단의 시민 모임 (생성 삽화)' }[id] || '생성 삽화'; }
function choiceButton(c, i) {
  const reason = E.choiceReason(state, data, c.id), p = E.choicePreview(state, data, c.id);
  const notes = [];
  if (p.influence) notes.push(['note', `준비 영향력 ${signed(p.influence, 0)} <small>${num(state.influence, 0)}→${num(state.influence + p.influence, 0)}</small>`]);
  if (p.phase) notes.push(['note', `권한 단계 → ${esc(PHASE[p.phase].name)}`]);
  if (p.flags.authoritarian) notes.push(['bad', '<span>권력 집중 분기</span><b>매월 자유 −0.3 · 정당성 −0.1, 정기 선거 중단</b>']);
  if (p.flags.constitutionalLimit) notes.push(['note', '임기·헌정 한계 유지']);
  if (p.electionChance !== null) notes.push(['note', `가상 당선 확률 약 ${num(p.electionChance, 0)}% (선택 후 판정)`]);
  if (p.ending) notes.push(['note', `연대기 종료: ${esc(byId('endings', p.ending).title)}`]);
  if (p.delay) notes.push(['note', `${p.delay.months}개월 뒤(${esc(ym(p.delay.arrival))}부터) · ${esc(p.delay.text)} ${Object.entries(p.delay.effects).map(([k, v]) => `${esc(mlabel(k))} ${signed(v, 0)}`).join(' · ')}`]);
  const noEffect = !p.stats.length && !p.support.length && !p.relations.length && !notes.length;
  const summary = [p.cost ? `국고 ${num(p.cost, 0)} 지출` : '국고 비용 없음', ...p.stats.map(x => `${mlabel(x.id)} ${signed(x.delta, 1)}`), p.delay ? `${p.delay.months}개월 뒤 후속 효과` : '', p.ending ? '연대기 종료' : ''].filter(Boolean).join(', ');
  return `<button type="button" class="choice" data-action="choose" data-id="${esc(c.id)}" ${reason ? 'aria-disabled="true"' : ''} aria-label="선택 ${i + 1}: ${esc(c.label)}. ${esc(summary)}${reason ? `. 선택할 수 없음: ${esc(reason)}` : ''}">
  <span class="num" aria-hidden="true">${i + 1}</span>
  <span><strong>${esc(c.label)}</strong>
  ${p.cost ? `<span class="meta">국고 비용 ${num(p.cost, 0)} 재정점 (보유 ${num(state.stats.treasury, 0)})</span>` : '<span class="meta">국고 비용 없음</span>'}
  ${fxList(p.stats, { inline: true })}${p.support.length ? factionList(Object.fromEntries(p.support.map(x => [x.id, x.delta])), true) : ''}${p.relations.length ? relationList(Object.fromEntries(p.relations.map(x => [x.id, x.delta])), true) : ''}
  ${notes.length ? wrap(true, notes) : ''}${noEffect ? '<span class="meta">즉시 수치 변화 없음 · 기록에만 남는다</span>' : ''}
  ${reason ? `<small class="reason">사유: ${esc(reason)}</small>` : ''}</span></button>`;
}
function calmCard() {
  const prep = E.PREPARE_PHASES.includes(state.phase), exec = E.isExecutive(state);
  const steps = [['이번 달 사건을 결정한다', true], [prep ? '사전 준비로 영향력을 쌓는다 (AP 1 → +3)' : exec ? '건설·법률·정책·외교에 행동점수를 쓴다' : '준비할 수 있는 일을 확인한다', state.ap === 0], [`시간을 흐르게 한다 · 월 결산까지 <span class="js-days">${E.daysInMonth(state.turn) - state.day + 1}</span>일`, clock.running]];
  return `<section class="paper decision calm"><div class="body"><span class="eyebrow">이번 달의 업무 · ${esc(ym(state.turn))}</span><h2>결정할 사건이 없습니다</h2>
  <p>${prep ? '아직 국정 권한이 없습니다. 사전 준비는 1963년 가상 선거의 준비 영향력이 됩니다.' : exec ? '시장에서 모자란 상품을 보고 건물을 올리거나, 법률과 정책을 검토하며 남은 행동점수를 사용하세요. 시간이 흐르는 동안에도 언제든 행동할 수 있고, 행동점수는 매달 1일에 다시 채워집니다.' : '이번 달에는 집행할 권한이 없습니다.'}</p>
  <ol class="steps">${steps.map(([t, done], i) => `<li class="${done ? 'done' : ''}"><span>${i === 2 ? t : esc(t)}</span></li>`).join('')}</ol>
  <div class="row" style="justify-content:flex-start;flex-wrap:wrap;margin-top:12px">${prep ? btn('사전 준비 · AP 1 / 영향력 +3', 'prepare', { cls: 'primary', reason: E.prepareReason(state) }) : ''}${exec ? btn('시장', 'nav', { attrs: 'data-view="market"' }) + btn('건물·건설', 'nav', { attrs: 'data-view="build"' }) + btn('법률', 'nav', { attrs: 'data-view="laws"' }) : ''}${clock.running ? '' : btn(`${PLAY_SVG} 시간 진행`, 'clockToggle', { cls: 'primary', reason: clockReason() })}${btn('남은 날 건너뛰고 결산', 'endMonth', { reason: E.endMonthReason(state) })}</div>
  ${prep ? reasonLine(E.prepareReason(state)) : ''}</div></section>`;
}
function endingCard() {
  const e = state.ending, h0 = state.history[0], h = state.history.at(-1);
  const axis = (title, id, text) => { const a = id === 'gdp' ? h0.gdp : state.history[0][id] ?? metric(id).initial, b = state.stats[id]; return `<div class="axis"><h3>${esc(title)}</h3><strong>${num(b, digits(id))}</strong><p>${esc(mlabel(id))} ${num(a, digits(id))} → ${num(b, digits(id))} (${signed(b - a, digits(id))})</p><p>${esc(text)}</p></div>`; };
  const s = chronicleSummary();
  return `<section class="paper decision" aria-labelledby="end-title"><div class="art" style="background-image:url('${art('cover')}')" role="img" aria-label="${esc(artCaption('cover'))}"><span class="tag">연대기 종료 · ${esc(ym(Math.min(e.turn, 239)))}</span></div>
  <div class="body"><span class="eyebrow">엔딩 평가</span><h2 id="end-title">${esc(e.title)}</h2><p>${esc(e.text)}</p>
  <p class="muted" style="font-size:13px">아래 네 축은 서로를 상쇄하지 않는 별개의 평가입니다. 경제 성과가 권리 침해의 비용을 지우지 않습니다. 모든 값은 가상 모형 값입니다.</p>
  <div class="axes">${axis('성장', 'gdp', `1인당 GNP ${num(startAcc().gnp.perCapita, 0)}달러 → ${num(acc().gnp.perCapita, 0)}달러 · 산업 역량 ${num(state.stats.industry)} · 부채 ${num(state.stats.debt, 0)}`)}${axis('권리', 'liberty', `정당성 ${num(state.stats.legitimacy)}${state.flags.authoritarian ? ' · 권력 집중 분기를 택함' : ''}`)}${axis('생활', 'welfare', `분배 균형 ${num(state.stats.equality)} · 교육 ${num(state.stats.education)}`)}${axis('환경', 'environment', `산업화의 환경 부담을 포함`)}</div>
  <h3 style="font-size:15px;margin:12px 0 6px">연대기 요약</h3><ul class="fx">${s.map(x => `<li class="note">${esc(x)}</li>`).join('')}</ul>
  <div class="row" style="justify-content:flex-start;flex-wrap:wrap;margin-top:14px">${btn('연대기 읽기', 'nav', { attrs: 'data-view="archive"', cls: 'primary' })}${btn('저장 내보내기', 'export')}${btn('새 연대기', 'newgame')}</div></div></section>`;
}
function chronicleSummary() {
  const out = [];
  const route = state.flags.route === 'military' ? '1961년 군정 경로' : state.flags.route === 'constitutional' ? '1961년 헌정 경로' : '1961년 이전 종료';
  out.push(route);
  const e1963 = state.log.find(l => l.type === 'election' && l.text.startsWith('1963'));
  if (e1963) out.push(e1963.text.replace('1963년 가상 선거: ', '1963 선거 '));
  if (state.flags.authoritarian) out.push('1972 장기 집권 전환'); else if (state.flags.constitutionalLimit) out.push('1972 헌정 한계 유지');
  out.push(`시행 정책 ${state.policies.length}개`, `제정한 법률 ${state.counters.lawsEnacted}개 · 폐기 ${state.counters.lawsFailed}`, `정부 건설 ${state.counters.built}단계 · 민간 투자 ${state.counters.privateBuilt}단계`);
  const elections = state.log.filter(l => l.type === 'election' && !l.text.startsWith('1963')).length;
  if (elections) out.push(`정기 선거 ${elections}회`);
  out.push(`업무 ${Math.min(state.turn, 240)}개월`);
  return out;
}

/* ---------- 화면: 상황판 ---------- */
function overview() {
  const p = state.ending ? { name: '연대기 종료', desc: `${ym(Math.min(state.ending.turn, 239))}에 연대기가 끝났습니다. 더 이상 행동할 수 없으며, 기록과 지표를 읽거나 저장 파일을 내보낼 수 있습니다.`, can: ['연대기·출처 읽기', '저장 내보내기', '새 연대기 시작'], cannot: '' } : PHASE[state.phase];
  const R = eco(), ranked = [...data.goods].filter(g => R.goods[g.id].demand > 1).sort((a, b) => R.goods[b.id].ratio - R.goods[a.id].ratio);
  const chipFor = g => { const x = R.goods[g.id], r = x.price / g.price - 1; return `<button type="button" class="gbtn" data-action="nav" data-view="market" data-good="${g.id}">${gmark(g.id)}${esc(g.name)} <b class="pct ${r > .1 ? 'hi' : r < -.1 ? 'lo' : ''}">${pctS(r)}</b></button>`; };
  return `<div class="page-head"><div><span class="eyebrow">NATIONAL BRIEF · 국가 브리핑</span><h1>${esc(ym(state.turn))}, 선택은 기록으로 남는다</h1></div><span class="tag fiction">모든 지표는 가상 모형 값</span></div>
  <div class="ov"><div class="kpis ov-kpis">${accKpi('gnp')}${['unemployment', 'legitimacy', 'liberty', 'welfare', 'treasury'].map(id => kpi(id)).join('')}</div>
  <div class="overview-grid ov-main"><div>${decisionCard()}</div><div class="grid">
  <article class="panel mandate"><span class="eyebrow">YOUR MANDATE · 현재 권한</span><h2 class="phase">${esc(p.name)}</h2><p style="font-size:14px">${esc(p.desc)}</p>
  <ul>${p.can.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${p.cannot ? `<small>아직 할 수 없음: ${esc(p.cannot)}</small>` : ''}
  <div style="margin-top:12px"><div class="kv"><span>행동점수</span><b>${apDots(state.ap)} ${state.ap} / 3</b></div><div class="kv"><span>준비 영향력</span><b>${num(state.influence, 0)}</b></div><div class="kv"><span>종합 지지도 <small>투표 비중 가중</small></span><b>${num(E.supportAverage(state, data))}</b></div><div class="kv"><span>집권 연합 세력${state.phase === 'governing' ? ' · 가상 의석' : ''}</span><b>${num(E.governmentClout(state) * 100, 0)}%${state.phase === 'governing' ? ` · ${num(state.seats * 100, 0)}%` : ''}</b></div></div>
  ${state.report ? btn('지난달 결산 보기', 'report', { cls: 'block quiet' }) : ''}</article>
  <article class="panel"><h2>다가오는 일정</h2><ul class="milestones">${milestones().map(([t, text]) => `<li><time>${esc(t)}</time><span>${text}</span></li>`).join('')}</ul></article>
  </div></div></div>
  <div class="charts">${chart('gdp', '#6e4f16')}${chart('unemployment', '#7a2a22')}${chart('liberty', '#2c6a43')}${chart('welfare', '#5d4380')}${chart('environment', '#245a76')}</div>
  <article class="panel"><div class="row"><h2>시장에서 눈에 띄는 상품</h2>${btn('시장 보기', 'nav', { attrs: 'data-view="market"', cls: 'small' })}</div><div class="two"><div><span class="fx-title">값이 높은 상품 · 더 만들거나 들여올 여지</span><div class="gbtns">${ranked.slice(0, 4).map(chipFor).join('')}</div></div><div><span class="fx-title">값이 낮은 상품 · 남아도는 설비</span><div class="gbtns">${ranked.slice(-4).reverse().map(chipFor).join('')}</div></div></div></article>
  <article class="panel"><div class="row"><h2>이해집단</h2>${btn('요구와 특성 보기', 'nav', { attrs: 'data-view="groups"', cls: 'small' })}</div><div class="factions">${data.interestGroups.map(g => { const dv = state.report?.support?.[g.id] || 0, st = E.econ.approvalState(state.support[g.id], data); return `<div><div class="row"><span>${esc(g.name)} <small style="display:inline">세력 ${num(state.ig[g.id].clout * 100, 0)}% · 투표 ${num(state.ig[g.id].vote * 100, 0)}%${state.government.includes(g.id) ? ' · 연합' : ''}</small></span><strong>${num(state.support[g.id], 0)} <small class="delta ${dv > 0 ? 'good' : dv < 0 ? 'bad' : 'flat'}" style="display:inline">${arrow(dv)}${signed(dv, 1)}</small></strong></div><div class="bar ${st === 'happy' || st === 'loyal' ? 'green' : ''}"><i style="width:${state.support[g.id]}%"></i></div><small>${STATE_NAME[st]} · 요구 ${E.econ.demandStatus(state, data, g).filter(x => x.met).length}/${g.demands.length} 충족</small></div>`; }).join('')}</div></article>
  <article class="panel"><h2>국가 역량 전체</h2><p class="muted" style="font-size:13px">타일을 누르면 계산 규칙과 지난달 변화 원인을 볼 수 있습니다.</p><div class="metric-grid">${data.metrics.map(m => kpi(m.id, { compact: true })).join('')}</div></article>`;
}
function milestones() {
  const list = [], t = state.turn;
  if (state.ending) return [[E.dateLabel(Math.min(state.ending.turn, 239)), `연대기 종료 · ${esc(state.ending.title)}`]];
  if (t < 16) list.push(['1961-05', '통치 경로 분기 (헌정·군정·퇴역)']);
  if (t <= 45 && !state.flags.won1963) list.push(['1963-10', `가상 선거 · 현재 당선 확률 약 ${num(E.firstElectionChance(state, data), 0)}%`]);
  if (state.phase === 'elected') list.push(['1963-12', '취임 사건 → 국정 운영']);
  const next = E.nextElectionTurn(state);
  if (next !== null) { const exp = E.electionExpectation(state, data); list.push([E.dateLabel(next), `가상 정기 선거 · 예상 득표 지표 ${num(exp, 0)}±6 (45 미만이면 이양)`]); }
  else if (state.phase === 'governing' && state.flags.authoritarian) list.push(['—', '정기 선거 중단 (권력 집중 분기)']);
  const anchor = data.events.filter(e => e.date && e.kind === 'historical_anchor' && e.date > E.dateLabel(t) && e.id !== 'inauguration_1963').sort((a, b) => a.date.localeCompare(b.date))[0];
  if (anchor) list.push([anchor.date, `역사 앵커 · ${esc(anchor.title)}`]);
  const R = eco(); let shown = 0;
  state.construction.forEach((q, i) => { const left = monthsLeft(q, R.construction.gains[i]); if (!left || shown >= 2) return; shown++; list.push([E.dateLabel(Math.min(239, t + left - 1)), `${esc(byId('regions', q.regionId).name)} ${esc(bdef(q.id).name)} 준공 예상${q.private ? ' (민간)' : ''}`]); });
  if (state.enactment) list.push([E.dateLabel(Math.min(239, t + state.enactment.wait - 1)), `${esc(lawOf(state.enactment.lawId).name)} 제정 검사 · 통과 확률 ${num(E.lawChance(state, data, state.enactment.lawId) * 100, 0)}%`]);
  list.push(['1979-12', `연대기 종료 · ${240 - t}개월 남음`]);
  return list.sort((a, b) => a[0].localeCompare(b[0]));
}

/* ---------- 화면: 지도 ----------
 * 화면 한가운데의 권역 지도. 권역을 개발도·지형과 자원·경지 사용·시장 접근성 중 하나로 칠하고, 공사 중인 건물은 권역 이름표 아래 표식으로 보인다.
 * 권역을 누르면 권역 정보가 열린다. 마우스 끌기·휠·버튼으로 확대·이동한다(viewBox만 바꾸고 다시 그리지 않는다). */
const regionLevels = id => state.buildings.reduce((a, b) => a + (b.regionId === id ? b.level : 0), 0);
const MAP_LAYERS = { dev: ['개발도', id => E.regionDevelopment(state, data, id)], res: ['지형·자원', id => E.regionTags(data, id).length], farm: ['경지 사용', id => (E.econ.findBuilding(state, 'farm', id)?.level || 0) / byId('regions', id).arable * 100], access: ['시장 접근성', id => eco().infra[id].access * 100] };
/* ---------- 권역: 지형·자원, 지역 시책 ---------- */
const trait = id => byId('traits', id);
const needs = list => (list || []).map(id => trait(id).name).join('·');
/** 지도 글자 배율. 휴대폰 폭에서는 지도 전체가 작게 보이므로 표식을 키운다. */
const mapScale = () => (typeof matchMedia === 'function' && matchMedia('(max-width:760px)').matches ? 1.9 : 1);
function traitChips(r) {
  return `<ul class="traits" aria-label="지형과 자원">${[...r.terrain, ...r.resources].map(id => { const x = trait(id); return `<li class="trait ${x.kind}" title="${esc(x.description)}"><i aria-hidden="true">${esc(x.mark)}</i>${esc(x.name)}</li>`; }).join('')}</ul>`;
}
/** 권역의 지역 시책: 시행 중이면 내용과 거두기, 아니면 걸 수 있는 시책 목록. */
function edictPanel(regionId) {
  const r = byId('regions', regionId), cur = E.regionEdict(state, regionId), cap = E.edictCap(state, data);
  const head = `<div class="row"><h3>지역 시책</h3><small>전국 ${state.edicts.length} / ${cap}개</small></div>`;
  if (cur) {
    const e = byId('edicts', cur.edictId), reason = E.revokeEdictReason(state, data, regionId);
    return `<div class="edict-box on">${head}<strong>${esc(e.name)}</strong><small class="sub">${esc(E.dateLabel(cur.startedTurn))}부터 · 매월 유지비 ${num(e.monthlyCost, 2)}${e.constructionBonus ? ` · 이 권역 공사 ${Math.round(e.constructionBonus * 100)}% 빠름` : ''}</small><span class="fx-title">매월</span>${fxPlain(e.monthlyEffects)}
    <div class="actions">${btn('시책 거두기 · AP 없음', 'askRevoke', { attrs: `data-region="${regionId}" aria-label="${esc(r.name)}의 ${esc(e.name)} 거두기 검토"`, cls: 'small quiet', reason })}${reasonLine(reason)}</div></div>`;
  }
  const general = E.governmentReason(state, 0), list = data.edicts.filter(e => E.regionHas(data, regionId, e.requires));
  return `<div class="edict-box">${head}<p class="hint">권역마다 하나. 시행비와 AP 1을 쓰고 다음 결산부터 매월 효과와 유지비가 붙습니다. 동시 개수는 행정 역량 ${E.EDICT_CAP_ADMIN}마다 1개씩 늘어납니다.</p>${general ? reasonLine(general) : ''}
  <ul class="edict-list">${list.map(e => { const reason = E.edictReason(state, data, e.id, regionId); return `<li><div><strong>${esc(e.name)}</strong><small>${e.requires.length ? `${esc(needs(e.requires))} · ` : ''}시행비 ${e.cost} · 월 ${num(e.monthlyCost, 2)}${e.constructionBonus ? ` · 공사 ${Math.round(e.constructionBonus * 100)}% 빠름` : ''}${e.maxDevelopment ? ` · 개발도 ${e.maxDevelopment} 이하` : ''}</small>${fxPlain(e.monthlyEffects, { inline: true })}${reason && !general ? `<small class="reason">${esc(reason)}</small>` : ''}</div>${btn('검토', 'askEdict', { attrs: `data-id="${e.id}" data-region="${regionId}" aria-label="${esc(r.name)}에 ${esc(e.name)} 시행 검토"`, cls: 'small', reason })}</li>`; }).join('')}</ul></div>`;
}
/** 지도 위 권역 표식: 지형·자원 글자 배지(자원 레이어). 자원(●) 먼저, 지형(■) 다음, 한 줄에 4개씩.
 *  휴대폰 폭에서는 지도가 작아 자원만 크게 3개씩 보여 준다(지형은 권역 카드와 범례에서 본다). */
function regionBadges(id) {
  const [ax, ay] = MAP.anchors[id], k = mapScale(), small = k > 1, r = byId('regions', id);
  const tags = small ? r.resources : [...r.resources, ...r.terrain], per = small ? 3 : 4, w = 19 * k;
  return `<g class="rbadges" transform="translate(${ax} ${(ay + 22 * k).toFixed(1)})">${tags.map((tid, i) => {
    const x = trait(tid), row = Math.floor(i / per), inRow = Math.min(per, tags.length - row * per), cx = ((i % per - (inRow - 1) / 2) * w).toFixed(1), cy = (row * w).toFixed(1);
    return x.kind === 'resource'
      ? `<g class="rb res" transform="translate(${cx} ${cy})"><circle r="${9 * k}"/><text y="${4 * k}" font-size="${11 * k}">${esc(x.mark)}</text></g>`
      : `<g class="rb ter" transform="translate(${cx} ${cy})"><rect x="${-8.5 * k}" y="${-8.5 * k}" width="${17 * k}" height="${17 * k}" rx="${2 * k}"/><text y="${4 * k}" font-size="${11 * k}">${esc(x.mark)}</text></g>`; }).join('')}</g>`;
}
function edictPill(id) {
  if (!E.regionEdict(state, id)) return '';
  const [ax, ay] = MAP.anchors[id], k = mapScale();
  return `<g class="epill" transform="translate(${ax} ${(ay - 25 * k).toFixed(1)})"><title>${esc(byId('edicts', E.regionEdict(state, id).edictId).name)} 시행 중</title><rect x="${-18 * k}" y="${-9 * k}" width="${36 * k}" height="${17 * k}" rx="${3 * k}"/><text y="${4 * k}" font-size="${11 * k}">시책</text></g>`;
}
const RAMP = [[0, [31, 43, 64]], [30, [43, 64, 100]], [50, [59, 89, 139]], [70, [98, 132, 178]], [100, [184, 200, 218]]]; // 짙은 남색 → 옅은 강철빛 파랑
function rampColor(v) {
  const x = Math.max(0, Math.min(100, v)); let i = 0; while (i < RAMP.length - 2 && x > RAMP[i + 1][0]) i++;
  const [a, ca] = RAMP[i], [b, cb] = RAMP[i + 1], t = (x - a) / (b - a);
  return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * t)).join(',')})`;
}
/** 지도 위 공사 표식: 권역에서 진행 중인 공사마다 원 하나, 테두리가 공정. */
function buildMarks(id) {
  const [ax, ay] = MAP.anchors[id], list = state.construction.filter(q => q.regionId === id).slice(0, 4), C = 2 * Math.PI * 7.5;
  return list.map((q, i) => {
    const def = bdef(q.id), x = ax + (i - (list.length - 1) / 2) * 21, y = ay + 31, prog = Math.min(1, q.progress / def.cost);
    return `<g class="pmark building ${q.private ? 'private' : ''}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><title>${esc(def.name)} 공사 중 ${Math.round(prog * 100)}%${q.private ? ' (민간 투자)' : ''}</title><circle r="9.5" class="pm-bg"/><circle r="7.5" class="pm-arc" stroke-dasharray="${(prog * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90)"/></g>`;
  }).join('');
}
function mapSvg() {
  const [, , W, H] = MAP.viewBox, [layerName, layerValue] = MAP_LAYERS[ui.mapLayer], res = ui.mapLayer === 'res';
  const regions = data.regions.map(r => {
    const v = layerValue(r.id), sel = ui.mapRegion === r.id, used = regionLevels(r.id), cur = E.regionEdict(state, r.id);
    const what = res ? `지형·자원 ${needs(E.regionTags(data, r.id))}` : `${layerName} ${num(v, 0)}`;
    return `<path class="mregion ${sel ? 'sel' : ''} ${res ? 'res' : ''}" d="${MAP.regions[r.id]}" fill="${res ? '#4d5b6e' : rampColor(v)}" fill-rule="evenodd" data-action="mapRegion" data-id="${r.id}" role="button" tabindex="0" aria-pressed="${sel}" aria-label="${esc(r.name)} · ${esc(what)} · 건물 ${used}단계${cur ? ` · 시책 ${esc(byId('edicts', cur.edictId).name)}` : ''}. 권역 정보 보기"><title>${esc(r.name)} · ${esc(what)}</title></path>`;
  }).join('');
  const labels = data.regions.map(r => { const [x, y] = MAP.anchors[r.id]; return `<text class="rname" x="${x}" y="${y}">${esc(r.name)}</text>${res ? '' : `<text class="rval" x="${x}" y="${y + 15}">${num(layerValue(r.id), 0)}</text>`}`; }).join('');
  return `<svg class="kmap" viewBox="${(ui.mapBox || MAP.viewBox).join(' ')}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="권역 지도 · ${layerName}">
  <rect class="sea" x="-500" y="-500" width="${W + 1000}" height="${H + 1000}"/>
  <path class="grat" d="${MAP.graticule}"/>
  ${Object.entries(MAP.neighbors).map(([k, d]) => `<path class="land-x ${k}" d="${d}"/>`).join('')}
  <g aria-hidden="false">${regions}</g>
  <path class="mdl" d="${MAP.mdl}"/>
  <g aria-hidden="true">
  ${MAP.labels.map(l => l.kind === 'dokdo' ? `<circle class="isle" cx="${l.x}" cy="${l.y}" r="3"/><text class="lbl island" x="${l.x - 6}" y="${l.y - 6}" text-anchor="end">${esc(l.name)}</text>` : `<text class="lbl ${l.kind}" x="${l.x}" y="${l.y}">${esc(l.name)}</text>`).join('')}
  ${MAP.cities.map(c => `<g class="city ${c.kind}"><circle cx="${c.x}" cy="${c.y}" r="${c.kind === 'capital' ? 4.5 : 2.6}"/><text x="${c.x + 6}" y="${c.y - 5}">${esc(c.name)}</text></g>`).join('')}
  <text class="lbl mdl-l" x="${MAP.anchors.gangwon[0] - 40}" y="${MAP.anchors.gangwon[1] - 118}">군사분계선</text>
  ${labels}
  ${data.regions.map(r => res ? regionBadges(r.id) : buildMarks(r.id)).join('')}
  ${data.regions.map(r => edictPill(r.id)).join('')}
  </g></svg>`;
}
function regionCard(id) {
  const r = byId('regions', id), dev = E.regionDevelopment(state, data, id), R = eco(), infra = R.infra[id];
  const bs = state.buildings.filter(b => b.regionId === id && b.level > 0).sort((a, b) => b.level - a.level), queue = state.construction.map((q, i) => [q, i]).filter(([q]) => q.regionId === id);
  return `<section class="paper map-card" aria-label="${esc(r.name)} 권역 정보"><div class="row"><span class="eyebrow">권역 · 가상 모형 값</span>${btn('닫기', 'closeRegion', { cls: 'small quiet' })}</div>
  <h2>${esc(r.name)}</h2>${traitChips(r)}
  <div class="kv"><span>개발도</span><b>${num(dev, 0)}</b></div><div class="bar"><i style="width:${dev}%"></i></div>
  <div class="kv"><span>기반 시설 <small>사용 / 용량</small></span><b>${num(infra.usage, 1)} / ${num(infra.supply, 1)}</b></div><div class="kv"><span>시장 접근성</span><b>${Math.round(infra.access * 100)}%</b></div><div class="kv"><span>경지 <small>농장 / 한도</small></span><b>${E.econ.findBuilding(state, 'farm', id)?.level || 0} / ${r.arable}</b></div>
  <h3 class="card-h">건물 ${bs.length}종 · ${regionLevels(id)}단계</h3>
  <ul class="map-projects">${bs.slice(0, 7).map(b => `<li><span>${esc(bdef(b.id).name)}</span><small>${b.level}단계 · 충원 ${Math.round(b.staff * 100)}%</small></li>`).join('') || '<li class="muted">아직 건물이 없습니다.</li>'}${bs.length > 7 ? `<li class="muted"><span>그 밖에 ${bs.length - 7}종</span></li>` : ''}</ul>
  ${queue.length ? `<h3 class="card-h">공사 중</h3><ul class="map-projects">${queue.map(([q, i]) => { const left = monthsLeft(q, R.construction.gains[i]); return `<li><span>${esc(bdef(q.id).name)}${q.private ? ' <small>민간</small>' : ''}</span><small>${Math.round(q.progress / bdef(q.id).cost * 100)}%${left ? ` · 약 ${left}개월` : ''}</small></li>`; }).join('')}</ul>` : ''}
  ${edictPanel(id)}
  ${btn('이 권역의 건물·건설 보기', 'nav', { attrs: `data-view="build" data-region="${id}"`, cls: 'small primary' })}
  <p class="muted" style="font-size:11.5px;margin:8px 0 0">${esc(r.disclaimer)}</p></section>`;
}
function mapView() {
  if (!MAP) return `<div class="notice bad">지도 자료(assets/map/korea_map.json)를 읽지 못했습니다. 상황판과 건물·건설 화면은 그대로 쓸 수 있습니다.</div>${overview()}`;
  const e = state.queue.length && !state.ending ? byId('events', state.queue[0]) : null, [layerName] = MAP_LAYERS[ui.mapLayer];
  const eventBox = state.ending
    ? `<section class="paper map-note"><span class="eyebrow">연대기 종료</span><h2>${esc(state.ending.title)}</h2>${btn('엔딩 평가 보기', 'nav', { attrs: 'data-view="overview"', cls: 'small primary' })}</section>`
    : e ? (ui.eventFolded
      ? `<section class="paper map-note"><span class="eyebrow">결정할 사건 · ${esc(ym(state.turn))}</span><h2>${esc(e.title)}</h2><div class="row" style="justify-content:flex-start;gap:8px">${btn('사건 문서 펼치기', 'eventFold', { cls: 'small primary' })}</div></section>`
      : `<div class="map-doc">${decisionCard()}<div class="fold">${btn('지도 보기 · 문서 접기', 'eventFold', { cls: 'small quiet' })}</div></div>`)
    : '';
  return `<h1 class="sr-only">${esc(ym(state.turn))} 권역 지도</h1><div class="map-wrap" data-clip-x>
  <div class="map-stage">${mapSvg()}
  <div class="map-tools" role="group" aria-label="지도 확대">${btn('+', 'mapZoom', { attrs: 'data-id="in" aria-label="확대"', cls: 'small' })}${btn('−', 'mapZoom', { attrs: 'data-id="out" aria-label="축소"', cls: 'small' })}${btn('전체', 'mapZoom', { attrs: 'data-id="reset" aria-label="전체 보기"', cls: 'small' })}</div></div>
  <div class="map-legend"><div class="filters" role="group" aria-label="지도 색">${Object.entries(MAP_LAYERS).map(([k, [n]]) => `<button type="button" class="btn small ${ui.mapLayer === k ? 'primary' : 'quiet'}" data-action="mapLayer" data-id="${k}" aria-pressed="${ui.mapLayer === k}">${n}</button>`).join('')}</div>
  ${ui.mapLayer === 'res' ? `<ul class="mark-key" aria-label="지형·자원 표식">${data.traits.map(x => `<li class="${x.kind}"><i aria-hidden="true">${esc(x.mark)}</i>${esc(x.name)}</li>`).join('')}</ul><small>● 자원 · ■ 지형 · 자원이 있는 권역에만 지을 수 있는 건물이 있습니다 · 권역을 누르면 건물과 지역 시책을 봅니다 · 게임용 단순화</small>`
    : `<div class="ramp"><span>0</span><i></i><span>100</span></div><small>${esc(layerName)} · ◯ 공사 중인 건물(테두리=공정) · '시책' 표시는 지역 시책 시행 중 · 권역 경계는 게임용이며 당시 행정구역이 아님</small>`}</div>
  ${eventBox}${ui.mapRegion ? regionCard(ui.mapRegion) : ''}</div>`;
}

/* ---------- 화면: 정책 ---------- */
function policyStatus(p) {
  if (state.policies.includes(p.id)) return ['on', '시행 중'];
  if (E.calendar(state.turn).year < p.unlockYear) return ['locked', `${p.unlockYear}년부터`];
  return ['open', ''];
}
function policy() {
  const cats = ['전체', ...new Set(data.policies.map(p => p.category))];
  const statusFilters = [['all', '전체'], ['open', '시행 가능'], ['active', '시행 중'], ['locked', '잠김']];
  const list = data.policies.filter(p => ui.policyCat === '전체' || p.category === ui.policyCat).filter(p => {
    const [st] = policyStatus(p), r = E.policyReason(state, data, p.id);
    return ui.policyStatus === 'all' || (ui.policyStatus === 'open' && !r) || (ui.policyStatus === 'active' && st === 'on') || (ui.policyStatus === 'locked' && st === 'locked');
  });
  const f = eco().finance;
  return `<div class="page-head"><div><span class="eyebrow">POLICY PAPERS · 정책</span><h1>정책의 비용과 시간</h1><p>정책은 산업 기술·농업 기술·교육·행정 같은 역량 지수를 올리는 행정 프로그램입니다. 시행비는 한 번, 유지비는 매월 듭니다. 지속 효과는 집행 권한이 있는 동안 매월 더해집니다. 제도를 바꾸는 일은 법률 화면에서 합니다.</p></div><span class="tag">다음 달 월 수지 ${signed(f.balance, 2)}</span></div>
  ${!E.isExecutive(state) ? `<div class="notice">${esc(PHASE[state.phase].name)} 단계에서는 정책을 집행할 수 없습니다. 미리 내용을 검토할 수 있습니다.</div>` : ''}
  <div class="filters" role="group" aria-label="분야">${cats.map(c => `<button type="button" class="btn" data-action="policyCat" data-id="${esc(c)}" aria-pressed="${ui.policyCat === c}">${esc(c)}</button>`).join('')}</div>
  <div class="filters" role="group" aria-label="상태">${statusFilters.map(([id, t]) => `<button type="button" class="btn" data-action="policyStatus" data-id="${id}" aria-pressed="${ui.policyStatus === id}">${t}</button>`).join('')}</div>
  <div class="cards">${list.map(policyCard).join('') || `<p class="muted">조건에 맞는 정책이 없습니다.${ui.policyStatus === 'open' && E.governmentReason(state, 0) ? ` 지금은 어떤 정책도 시행할 수 없습니다: ${esc(E.governmentReason(state, 0))}` : ''}</p>`}</div>`;
}
function policyCard(p) {
  const r = E.policyReason(state, data, p.id), [st, stText] = policyStatus(p);
  const yearly = Object.fromEntries(Object.entries(p.monthlyEffects).map(([k, v]) => [k, v * 12]));
  return `<article class="panel card"><div class="row"><span class="tag">${esc(p.category)}</span><small>행정 정책 · ${p.unlockYear}년~</small></div>
  <h2>${esc(p.name)}</h2><p>${esc(p.description)}</p>
  <div class="cost"><span>시행비 <b>${p.cost}</b></span><span>월 유지 <b>${num(p.monthlyCost, 2)}</b></span><span>AP <b>1</b></span></div>
  <span class="fx-title">즉시 효과</span>${fxProjected(p.effects)}
  <span class="fx-title">지속 효과 (12개월 누적${data.balance && data.balance.diminishing ? ', 기본값' : ''})</span>${fxPlain(yearly)}${factionList(p.factionEffects)}
  ${stText ? `<p class="status-line">${esc(stText)}</p>` : ''}
  <div class="actions">${btn(st === 'on' ? '시행 중' : '정책 시행 검토 · AP 1', 'askPolicy', { attrs: `data-id="${p.id}"`, reason: r, cls: st === 'on' ? 'quiet' : '' })}${reasonLine(st === 'on' ? '' : r)}</div></article>`;
}

/* ---------- 시장 경제 화면의 공통 조각(데이터 2.0.0) ---------- */
/** 이번 달 시장 계산. 상태가 바뀔 때만 다시 계산한다(화면은 읽기만 한다). */
const ECO = { state: null, R: null };
const eco = () => { if (ECO.state !== state) { ECO.state = state; ECO.R = E.econ.compute(state, data); } return ECO.R; };
const good = id => byId('goods', id), bdef = id => byId('buildings', id), igOf = id => byId('interestGroups', id), lawOf = id => byId('laws', id);
const qty = v => Math.abs(v) >= 10000 ? `${num(v / 1000, 1)}K` : num(v, Math.abs(v) < 10 && v % 1 ? 1 : 0);
const pctS = (v, n = 0) => (v > 5e-4 ? '+' : v < -5e-4 ? '−' : '±') + num(Math.abs(v * 100), n) + '%';
const STATE_NAME = { angry: '분노', unhappy: '불만', neutral: '중립', happy: '만족', loyal: '충성' };
const GOOD_CATS = [['all', '전체'], ['staple', '생활필수'], ['industrial', '산업재'], ['luxury', '고급·수출'], ['military', '군수']];
const BCAT = { agri: '농업', resource: '자원', manufacturing: '제조', infrastructure: '기반 시설', service: '서비스', government: '정부', military: '군' };
const COLUMN = { power: '권력 구조', economy: '경제', rights: '사회·권리' };
const OWNER = { business: '기업가 소유', land: '지주·농민 소유', petite: '소시민 소유', state: '국영' };
const STAGE_NAME = { governing: ['상임위 심사', '법제 검토', '본회의 표결'], transition: ['최고회의 상정', '심의', '의결'] };
const gmark = id => `<i class="gmark c-${good(id).category}" aria-hidden="true">${esc(good(id).mark)}</i>`;
const goodList = o => Object.entries(o || {}).map(([id, q]) => `<span class="gchip">${gmark(id)}${esc(good(id).name)} <b>${num(q, q % 1 ? 1 : 0)}</b></span>`).join('') || '<span class="muted">없음</span>';
const jobsText = jobs => Object.entries(jobs).map(([i, n]) => `${igOf(i).name} ${n}`).join(' · ');
const igChip = (id, cls = '') => `<span class="igchip ${cls}"><i aria-hidden="true">${esc(igOf(id).mark)}</i>${esc(igOf(id).name)}</span>`;
const stanceText = v => v >= 2 ? '강한 지지' : v === 1 ? '지지' : v === -1 ? '반대' : v <= -2 ? '강한 반대' : '중립';
const monthsLeft = (q, gain) => gain > 1e-9 ? Math.ceil((bdef(q.id).cost - q.progress) / gain) : null;
/** 이 건물을 요구 목록에 둔 이해집단과 지금 충족 여부. */
function wantedBy(buildingId) {
  return data.interestGroups.flatMap(g => E.econ.demandStatus(state, data, g).filter(x => x.buildings.includes(buildingId)).map(x => ({ ig: g, ...x })));
}

/* ---------- 화면: 경제 지표(국민 계정, 데이터 2.1.0) ---------- */
/** 이번 달 국민 계정. 시장 계산(eco)이 바뀔 때만 다시 계산한다. */
const ACC = { R: null, a: null };
const acc = () => { const R = eco(); if (ACC.R !== R) { ACC.R = R; ACC.a = E.econ.accounts(state, data, R); } return ACC.a; };
/** 1960년 1월의 국민 계정(산업 구조·1인당 소득 비교용). 새 상태를 한 번만 만든다. */
let START_ACC = null;
const startAcc = () => (START_ACC ||= E.econ.accounts(E.createState(data), data));
/** 금액 표기: 억·만 단위. 달러는 1억 이상이면 '억 달러', 원은 1조 이상이면 '조 억 원'. */
const usdParts = (v, cur = '달러') => { const a = Math.abs(v), sg = v < 0 ? '−' : ''; return a >= 1e8 ? [sg + num(a / 1e8, a >= 1e10 ? 0 : 1), `억 ${cur}`] : a >= 1e4 ? [sg + num(a / 1e4, 0), `만 ${cur}`] : [sg + num(a, 0), cur]; };
const usd = (v, cur) => usdParts(v, cur).join('');
const usdSigned = v => (v > 5e5 ? '+' : '') + usd(v);
const won = v => { const a = Math.abs(v), sg = v < 0 ? '−' : ''; if (a >= 1e12) { const jo = Math.floor(a / 1e12), eok = Math.round(a % 1e12 / 1e8); return `${sg}${num(jo, 0)}조${eok ? ` ${num(eok, 0)}억` : ''} 원`; } if (a >= 1e8) return `${sg}${num(a / 1e8, 0)}억 원`; const step = a >= 1e4 ? 100 : 10, r = Math.round(a / step) * step, man = Math.floor(r / 1e4), rest = r % 1e4; return man ? `${sg}${num(man, 0)}만${rest ? ` ${num(rest, 0)}원` : ' 원'}` : `${sg}${num(r, 0)}원`; };
const people = v => `${num(v / 1e4, 0)}만 명`;
const share = (v, n = 1) => `${num(v * 100, n)}%`;
const shareS = (v, n = 1) => Math.abs(v * 100) < 0.5 * 10 ** -n ? `${num(0, n)}%` : (v > 0 ? '+' : '−') + share(Math.abs(v), n);
/** 시장·상황판의 금액 카드. 누르면 경제 지표 화면으로 간다. */
function accKpi(kind) {
  const a = acc(), s0 = startAcc(), card = (label, parts, sub, aria, tone = 'flat') => `<button type="button" class="kpi" data-action="nav" data-view="economy" aria-label="${esc(aria)}. 경제 지표 보기"><span>${label}</span><strong>${parts[0]}<small class="unit">${parts[1]}</small></strong><small class="delta ${tone}">${sub}</small></button>`;
  if (kind === 'gdp') return card('명목 GDP', usdParts(a.gdp.usd), `1인당 GNP ${num(a.gnp.perCapita, 0)}달러${a.growth === null ? '' : ` · 성장 ${pctS(a.growth, 1)}`}`, `명목 GDP 연율 ${usd(a.gdp.usd)}, 1인당 GNP ${num(a.gnp.perCapita, 0)}달러`, a.growth === null ? 'flat' : a.growth >= 0 ? 'good' : 'bad');
  if (kind === 'gnp') return card('1인당 GNP', [num(a.gnp.perCapita, 0), '달러'], `GDP ${usd(a.gdp.usd)}${a.growth === null ? ` · 1960년 1월 ${num(s0.gnp.perCapita, 0)}달러` : ` · 성장 ${pctS(a.growth, 1)}`}`, `1인당 GNP ${num(a.gnp.perCapita, 0)}달러, GDP ${usd(a.gdp.usd)}`, a.growth === null ? 'flat' : a.growth >= 0 ? 'good' : 'bad');
  if (kind === 'reserves') return card('외환보유액', usdParts(a.reserves.usd), `외환 여력 지수 ${num(a.reserves.index, 0)}${a.reserves.months !== null ? ` · 수입 ${num(Math.min(a.reserves.months, 999), 0)}개월분` : ''}`, `외환보유액 ${usd(a.reserves.usd)}, 외환 여력 지수 ${num(a.reserves.index, 0)}`);
  if (kind === 'trade') return card('무역수지', usdParts(a.trade.balance).map((x, i) => i ? x : (a.trade.balance > 5e5 ? '+' : '') + x), `수출 ${usd(a.trade.exports)} · 수입 ${usd(a.trade.imports)}`, `무역수지 ${usdSigned(a.trade.balance)}, 수출 ${usd(a.trade.exports)}, 수입 ${usd(a.trade.imports)}`, a.trade.balance >= 0 ? 'flat' : 'bad');
  return '';
}
/** 연도별 선 그래프(한 계열). 0에서 시작하는 세로축, 해마다 점, 점마다 설명(마우스·터치). */
function yearLine(series, key, label, fmt) {
  const list = series.filter(e => Number.isFinite(e[key]));
  if (list.length < 2) return `<p class="muted chart-empty">결산 기록이 두 해 이상 쌓이면 그립니다.</p>`;
  const top = Math.max(...list.map(e => e[key])), max = top * 1.12, n = list.length, x = i => 46 + i / (n - 1) * 440, y = v => 112 - v / max * 96;
  const pts = list.map((e, i) => `${x(i).toFixed(1)},${y(e[key]).toFixed(1)}`).join(' ');
  const tip = e => `${e.year}년${e.months < 12 ? `(${e.months}개월)` : ''} ${fmt(e[key])}`;
  return `<svg class="ychart" viewBox="0 0 500 128" role="img" aria-label="${esc(label)}: ${esc(tip(list[0]))}에서 ${esc(tip(list.at(-1)))}">
  <line class="axis-base" x1="46" y1="112" x2="490" y2="112"/><line class="axis-top" x1="46" y1="${y(top).toFixed(1)}" x2="490" y2="${y(top).toFixed(1)}" stroke-dasharray="3 4"/>
  <text x="40" y="${(y(top) + 4).toFixed(1)}" text-anchor="end">${esc(fmt(top))}</text><text x="40" y="116" text-anchor="end">0</text>
  <polyline class="line" points="${pts}"/>${list.map((e, i) => `<g class="pt"><circle class="hit" cx="${x(i).toFixed(1)}" cy="${y(e[key]).toFixed(1)}" r="11"/><circle cx="${x(i).toFixed(1)}" cy="${y(e[key]).toFixed(1)}" r="${i === n - 1 ? 4 : 2.6}"/><title>${esc(tip(e))}</title></g>`).join('')}
  <text class="end" x="${Math.min(486, x(n - 1)).toFixed(1)}" y="${(y(list.at(-1)[key]) - 9).toFixed(1)}" text-anchor="end">${esc(fmt(list.at(-1)[key]))}</text></svg>
  <div class="scale"><span>${list[0].year}년</span><span>점을 누르거나 가리키면 값</span><span>${list.at(-1).year}년</span></div>`;
}
/** 연도별 실질 성장률 막대. 0을 기준으로 위는 성장(찬 색), 아래는 감소(따뜻한 색). */
function growthBars(series) {
  const list = series.filter(e => e.growth !== null);
  if (!list.length) return `<p class="muted chart-empty">두 번째 해부터 앞 해와 비교해 그립니다.</p>`;
  const lim = Math.max(.05, ...list.map(e => Math.abs(e.growth))) * 1.1, n = list.length, w = 440 / Math.max(n, 8), y0 = 64, h = v => v / lim * 52;
  const bars = list.map((e, i) => { const v = e.growth, hh = Math.max(1, Math.abs(h(v))), bx = 46 + i * w + 1.5; return `<g class="pt"><rect class="hit" x="${(46 + i * w).toFixed(1)}" y="8" width="${w.toFixed(1)}" height="112"/><rect class="${v >= 0 ? 'pos' : 'neg'}" x="${bx.toFixed(1)}" y="${(v >= 0 ? y0 - hh : y0).toFixed(1)}" width="${Math.max(2, w - 3).toFixed(1)}" height="${hh.toFixed(1)}" rx="2"/><title>${e.year}년${e.months < 12 ? `(${e.months}개월)` : ''} ${pctS(v, 1)}</title></g>`; }).join('');
  return `<svg class="ychart" viewBox="0 0 500 128" role="img" aria-label="연도별 실질 성장률: ${list.map(e => `${e.year}년 ${pctS(e.growth, 1)}`).join(', ')}">
  <line class="axis-top" x1="46" y1="12" x2="490" y2="12" stroke-dasharray="3 4"/><line class="axis-top" x1="46" y1="116" x2="490" y2="116" stroke-dasharray="3 4"/>
  <text x="40" y="16" text-anchor="end">${pctS(lim, 0)}</text><text x="40" y="68" text-anchor="end">0%</text><text x="40" y="120" text-anchor="end">${pctS(-lim, 0)}</text>
  ${bars}<line class="axis-base" x1="46" y1="${y0}" x2="490" y2="${y0}"/></svg>
  <div class="scale"><span>${list[0].year}년</span><span>막대를 누르거나 가리키면 값</span><span>${list.at(-1).year}년</span></div>`;
}
function economy() {
  const a = acc(), s0 = startAcc(), A = data.accounts, series = E.econ.accountsSeries(state, data);
  const kv = (label, value) => `<div class="kv"><span>${label}</span><b>${value}</b></div>`;
  const plain = (label, parts, sub, tone = 'flat') => `<div class="kpi plain"><span>${label}</span><strong>${parts[0]}<small class="unit">${parts[1]}</small></strong><small class="delta ${tone}">${sub}</small></div>`;
  const g = a.growth, gTone = g === null ? 'flat' : g >= 0 ? 'good' : 'bad', L = a.labor, F = a.finance;
  const srcs = A.sourceIds.map(id => byId('sources', id));
  return `<div class="page-head"><div><span class="eyebrow">ECONOMY · 경제 지표</span><h1>국민 계정으로 본 ${esc(ym(state.turn))}</h1><p>시장에서 만든 부가가치, 물가, 교역, 재정, 고용을 원·달러 금액과 인원으로 바꿔 보여 줍니다. 1960년 1월 값만 실제 규모(1인당 국민소득 ${A.gnpPerCapita}달러, 환율 650환 = ${A.exchangeRate}원, 인구총조사, 외환보유액)에 맞췄고, 그 뒤의 값은 이 연대기의 선택이 만든 결과입니다. 금액은 이번 달 값을 한 해로 늘린 연율입니다.</p></div><span class="tag fiction">모형 추계 · 실제 통계 아님</span></div>
  <div class="kpis">${plain('명목 GDP', usdParts(a.gdp.usd), `연율 · ${won(a.gdp.won)}`)}
  ${plain('1인당 GNP', [num(a.gnp.perCapita, 0), '달러'], `국민소득 · 1960년 1월 ${num(s0.gnp.perCapita, 0)}달러`)}
  ${plain('실질 성장률', g === null ? ['—', ''] : [pctS(g, 1), ''], g === null ? '1961년 1월부터 계산' : `열두 달 전 대비 · 지수 ${num(a.gdp.index, 1)}`, gTone)}
  ${plain('1인당 PPP', [num(a.gdp.pppPerCapita, 0), '국제달러'], `구매력 평가 · 물가 수준 미국의 ${num(a.priceLevel * 100, 0)}%`)}
  ${plain('물가상승률', [num(a.inflation, 1), '%'], `연율 · 소비자물가지수 ${num(a.cpi, 0)}`)}
  ${plain('환율', [num(a.fx, 1), '원'], `달러당 · 1960년 1월 ${num(s0.fx, 0)}원`)}</div>
  <div class="cards acc-cards">
  <article class="panel"><h2>생산과 소득</h2>
  ${kv('명목 GDP <small>국내총생산</small>', `${usd(a.gdp.usd)} · ${won(a.gdp.won)}`)}
  ${kv('실질 GDP <small>1960년 1월 가격</small>', `${won(a.gdp.real)} · 지수 ${num(a.gdp.index, 1)}`)}
  ${kv('해외 순수취 요소소득 <small>대외 차관 이자</small>', usdSigned(a.gnp.factorIncome))}
  ${kv('GNP <small>국민총생산</small>', `${usd(a.gnp.usd)} · ${won(a.gnp.won)}`)}
  ${kv('1인당 GDP · 1인당 GNP', `${num(a.gdp.perCapita, 0)} · ${num(a.gnp.perCapita, 0)}달러`)}
  ${kv('PPP GDP <small>구매력 평가</small>', usd(a.gdp.ppp, '국제달러'))}
  ${kv('1인당 PPP GDP', `${num(a.gdp.pppPerCapita, 0)}국제달러`)}
  ${kv('물가 수준 <small>미국 = 100</small>', num(a.priceLevel * 100, 0))}</article>
  <article class="panel"><h2>물가·환율·인구</h2>
  ${kv('소비자물가지수 <small>1960년 1월 = 100</small>', num(a.cpi, 1))}
  ${kv('물가상승률 <small>연율</small>', `${num(a.inflation, 1)}%`)}
  ${kv('미국 물가지수 <small>1960년 1월 = 100</small>', num(a.worldCpi, 1))}
  ${kv('환율 <small>시장 · 원/달러</small>', `${num(a.fx, 1)}원`)}
  ${kv('PPP 환산율 <small>원/국제달러</small>', `${num(a.fx * a.priceLevel, 1)}원`)}
  ${kv('인구 <small>추계</small>', people(a.population))}</article>
  <article class="panel"><h2>고용</h2>
  ${kv('경제활동인구', people(L.force))}
  ${kv('취업자 <small>건물 일자리 · 자급 농가</small>', `${people(L.employed)} <small>(${people(L.wageEarners)} · ${people(L.farmers)})</small>`)}
  ${kv('실업자 · 실업률', `${people(L.unemployed)} · ${share(L.rate)}`)}
  ${kv('노동자 월평균 임금', `${won(L.wageWon)} <small>(${num(L.wageUsd, 1)}달러)</small>`)}</article>
  <article class="panel"><h2>대외 거래 <small>연율</small></h2>
  ${kv('수출', usd(a.trade.exports))}
  ${kv('수입', usd(a.trade.imports))}
  ${kv('무역수지', usdSigned(a.trade.balance))}
  ${kv('무역 의존도 <small>수출입 ÷ GDP</small>', share(a.trade.openness, 0))}
  ${kv('외환보유액', `${usd(a.reserves.usd)}${a.reserves.months !== null ? ` <small>(수입 ${num(Math.min(a.reserves.months, 999), 0)}개월분)</small>` : ''}`)}</article>
  <article class="panel"><h2>정부 재정 <small>GDP 대비</small></h2>
  ${kv('세입', share(F.revenue))}
  ${kv('세출', share(F.expense))}
  ${kv('재정수지', shareS(F.balance))}
  ${kv('국가채무', `${won(F.debtWon)} <small>(GDP의 ${share(F.debt)})</small>`)}
  ${kv('국고 잔액', won(F.treasuryWon))}</article>
  <article class="panel"><h2>산업 구조 <small>부가가치 비중</small></h2><ul class="sectors">${a.sectors.map((x, i) => { const b = s0.sectors[i].share; return `<li><div class="row"><span>${esc(x.name)}</span><b>${share(x.share, 0)}</b></div><div class="sbar" role="img" aria-label="${esc(x.name)} ${share(x.share, 0)}, 1960년 1월 ${share(b, 0)}"><i style="width:${(x.share * 100).toFixed(1)}%"></i><em style="left:${(b * 100).toFixed(1)}%"></em></div><small>${usd(x.usd)} · 1960년 1월 ${share(b, 0)}</small></li>`; }).join('')}</ul><small class="muted">세로 눈금이 1960년 1월 비중입니다.</small></article>
  </div>
  <div class="charts"><article class="panel chart"><div class="row"><h3>1인당 GDP <small>달러, 연평균</small></h3><strong>${series.length ? `${num(series.at(-1).perCapita, 0)}달러` : '—'}</strong></div>${yearLine(series, 'perCapita', '연도별 1인당 GDP', v => `${num(v, 0)}달러`)}</article>
  <article class="panel chart"><div class="row"><h3>실질 성장률 <small>연평균 생산 지수, 앞 해 대비</small></h3><strong>${series.length && series.at(-1).growth !== null ? pctS(series.at(-1).growth, 1) : '—'}</strong></div>${growthBars(series)}</article></div>
  <article class="panel"><details class="year-table"><summary><h2>연도별 표</h2><small>결산을 마친 달의 연평균</small></summary>
  ${series.length ? `<div data-scroll-x><table class="goods"><thead><tr><th scope="col">연도</th><th scope="col" class="n">GDP</th><th scope="col" class="n">1인당 GDP</th><th scope="col" class="n">1인당 PPP</th><th scope="col" class="n">실질 성장률</th><th scope="col" class="n">물가상승률</th></tr></thead><tbody>${series.map(e => `<tr><th scope="row">${e.year}년${e.months < 12 ? ` <small>${e.months}개월</small>` : ''}</th><td class="n">${usd(e.gdpUsd)}</td><td class="n">${num(e.perCapita, 0)}달러</td><td class="n">${num(e.pppPerCapita, 0)}국제달러</td><td class="n">${e.growth === null ? '—' : pctS(e.growth, 1)}</td><td class="n">${num(e.inflation, 1)}%</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">첫 결산 뒤부터 쌓입니다.</p>'}</details></article>
  <article class="panel"><details class="year-table"><summary><h2>계산 방법</h2><small>모형 가정과 출처</small></summary><ul class="method">
  <li>GDP = 건물의 부가가치(산출의 값 − 투입의 값) + 자급 농가의 산출 + 공공 인건비. 1960년 1월을 1인당 GNP ${A.gnpPerCapita}달러(GDP ${usd(s0.gdp.usd)})에 맞추고, 생산 지수만큼 늘거나 준다.</li>
  <li>명목 원화 금액 = 실질 금액 × 소비자물가지수. 소비자물가지수는 매달의 물가상승률을 쌓은 값이다.</li>
  <li>환율 = ${A.exchangeRate}원 × 국내 물가 ÷ 미국 물가 ÷ (1인당 실질 소득 배율)<sup>${A.penn}</sup>. 미국 물가는 실제 소비자물가 상승률(1960~1979년)을 따른다.</li>
  <li>GNP = GDP − 대외 차관 이자. 정부 부채의 ${Math.round(A.externalDebtShare * 100)}%를 대외 차관으로 본다. 해외 근로·투자 소득은 다루지 않는다.</li>
  <li>PPP = 달러 GDP ÷ 물가 수준. 1960년 한국 물가 수준을 미국의 ${Math.round(A.priceLevel * 100)}%로 가정하고, 1인당 실질 소득 배율의 ${A.penn}제곱만큼 오른다고 가정한다.</li>
  <li>외환보유액 = GDP × 외환 여력 지수 × ${num(A.reservesPerPoint * 100, 2)}%. 수출입은 시장의 수출입 값을 같은 환율로 바꾼 것이다.</li>
  <li>인구는 정해진 길(연 ${num(A.population.growthStart * 100, 2)}%에서 ${num(A.population.growthEnd * 100, 2)}%로 줄어드는 증가율)을 따르고, 경제활동인구는 1960년 1월 총인구의 ${Math.round(A.laborShare * 100)}%에서 모형의 노동 인구만큼 늘어난다.</li>
  </ul><h3 style="font-size:14px;margin:10px 0 4px">1960년 기준값의 출처</h3><ul class="sources">${srcs.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a> <small>${esc(x.institution)} · ${esc(x.scope)}</small></li>`).join('')}</ul></details></article>`;
}

/* ---------- 화면: 시장 ---------- */
function market() {
  const R = eco(), X = data.economy.price, list = data.goods.filter(g => ui.goodCat === 'all' || g.category === ui.goodCat);
  const row = g => {
    const x = R.goods[g.id], bal = x.supply - x.demand, big = Math.max(x.supply, x.demand, 1e-9), r = x.price / g.price - 1, trend = x.next - x.price;
    const pos = (Math.max(X.floor, Math.min(X.ceiling, r)) - X.floor) / (X.ceiling - X.floor) * 100, zero = -X.floor / (X.ceiling - X.floor) * 100;
    const flags = `${x.sup.imports > .5 ? `<span class="flag in" title="수입 ${qty(x.sup.imports)}">수입</span>` : ''}${x.dem.exports > .5 ? `<span class="flag out" title="수출 ${qty(x.dem.exports)}">수출</span>` : ''}${x.shortage > 0 ? '<span class="flag short" title="구매 주문이 판매 주문을 크게 넘어 이 상품을 쓰는 건물의 생산이 깎인다">부족</span>' : ''}`;
    return `<tr class="grow ${ui.good === g.id ? 'sel' : ''}" data-action="good" data-id="${g.id}" tabindex="0" role="button" aria-pressed="${ui.good === g.id}" aria-label="${esc(g.name)}: 판매 ${qty(x.supply)}, 구매 ${qty(x.demand)}, 가격 ${num(x.price, 1)} (기준 대비 ${pctS(r)}). 자세히 보기">
    <th scope="row">${gmark(g.id)}<span>${esc(g.name)}</span>${flags}</th>
    <td class="n">${qty(x.supply)}</td><td class="n">${qty(x.demand)}</td>
    <td class="bal"><span class="n ${bal >= 0 ? 'pos' : 'neg'}">${bal >= 0 ? '+' : '−'}${qty(Math.abs(bal))}</span><span class="balbar" aria-hidden="true"><i class="${bal >= 0 ? 'pos' : 'neg'}" style="${bal >= 0 ? 'left:50%' : `right:50%`};width:${Math.min(50, Math.abs(bal) / big * 50)}%"></i></span></td>
    <td class="price"><b>${num(x.price, 1)}</b><span class="pbar" aria-hidden="true"><i class="zero" style="left:${zero}%"></i><i class="dot ${r > .1 ? 'hi' : r < -.1 ? 'lo' : ''}" style="left:${pos}%"></i></span><span class="pct ${r > .1 ? 'hi' : r < -.1 ? 'lo' : ''}">${pctS(r)}</span><span class="trend" title="다음 결산 예상 가격 ${num(x.next, 1)}">${Math.abs(trend) < .05 ? '–' : trend > 0 ? '▲' : '▼'}</span></td></tr>`;
  };
  const t = R.trade, used = t.capacity > 0 ? t.used / t.capacity : 0;
  return `<div class="page-head"><div><span class="eyebrow">MARKET · 시장</span><h1>주문이 가격을 정한다</h1><p>판매 주문은 건물의 산출·자급 농가·수입, 구매 주문은 가계·건물의 투입·정부·건설·수출입니다. 구매가 판매보다 많으면 가격이 오르고 적으면 내립니다. 값이 오른 상품을 만드는 건물은 이익이 커져 사람을 더 쓰고, 값이 내린 상품을 만드는 건물은 사람을 줄입니다. 모든 수량과 가격은 가상 모형 값입니다.</p></div><span class="tag">물가 지수 ${num(R.cpi * 100, 0)} · 1960년 가계 소비 기준 100</span></div>
  <div class="kpis">${accKpi('gdp')}${kpi('unemployment')}${kpi('inflation')}${accKpi('reserves')}
  <div class="kpi plain"><span>무역 역량 <small>물량 기준</small></span><strong>${num(used * 100, 0)}%</strong><small class="delta ${used > .9 ? 'bad' : 'flat'}">${num(t.used, 1)} / ${num(t.capacity, 1)}${used > .9 ? ' · 항만이 모자람' : ''}</small></div>
  ${accKpi('trade')}</div>
  <article class="panel market-table"><div class="row" style="flex-wrap:wrap"><h2>상품 ${list.length}종</h2><div class="filters" role="group" aria-label="상품 분류" style="margin:0">${GOOD_CATS.map(([id, n]) => `<button type="button" class="btn small" data-action="goodCat" data-id="${id}" aria-pressed="${ui.goodCat === id}">${n}</button>`).join('')}</div></div>
  <div data-scroll-x><table class="goods"><thead><tr><th scope="col">상품</th><th scope="col" class="n">판매 주문</th><th scope="col" class="n">구매 주문</th><th scope="col">수지</th><th scope="col">시장 가격 <small>기준 대비</small></th></tr></thead><tbody>${list.map(g => row(g) + (ui.good === g.id ? `<tr class="gdetail"><td colspan="5">${goodDetail(g.id, R)}</td></tr>` : '')).join('')}</tbody></table></div>
  <small class="muted">이번 달 결산에 들어갈 주문입니다. 가격은 지난 결산 값이고 ▲▼는 다음 결산의 방향입니다. 가격은 기준가격의 ${pctS(X.floor)}~${pctS(X.ceiling)} 안에서 움직입니다. 행을 누르면 그 아래에 누가 팔고 누가 사는지 펼쳐집니다.</small></article>`;
}
function goodDetail(id, R) {
  const g = good(id), x = R.goods[id], E0 = data.economy, mods = R.mods;
  const agg = key => { const m = new Map(); for (const rec of R.buildings) if (rec[key][id] > 1e-9) m.set(rec.def.id, (m.get(rec.def.id) || 0) + rec[key][id]); return [...m].sort((a, b) => b[1] - a[1]); };
  const makers = agg('out'), users = agg('in');
  const line = (label, v, sub = '') => v > .05 ? `<div class="kv"><span>${label}${sub ? ` <small>${sub}</small>` : ''}</span><b>${qty(v)}</b></div>` : '';
  const names = list => list.slice(0, 4).map(([b, v]) => `${esc(bdef(b).name)} ${qty(v)}`).join(' · ');
  const h = state.econ.hist[id] || [], lo = Math.min(-.1, ...h), hi = Math.max(.1, ...h), px = i => (h.length <= 1 ? 0 : i / (h.length - 1) * 280 + 10), py = v => 46 - (v - lo) / (hi - lo) * 40;
  const tariff = g.world && !g.world.noTariff ? mods.tariff : 0;
  const buildable = data.buildings.filter(b => b.pm.some(pm => pm.out[id]));
  const r = x.price / g.price - 1;
  return `<div class="good-detail" aria-live="polite"><div class="gd-head"><h3>${gmark(id)} ${esc(g.name)} <span class="tag">${esc(GOOD_CATS.find(c => c[0] === g.category)[1])}</span></h3><p>${esc(g.description)}</p></div>
  <div><div class="kv"><span>시장 가격</span><b>${num(x.price, 1)} <small class="pct ${r > .1 ? 'hi' : r < -.1 ? 'lo' : ''}">${pctS(r)}</small></b></div><div class="kv"><span>기준가격 · 다음 결산 예상</span><b>${num(g.price, 0)} · ${num(x.next, 1)}</b></div>
  ${g.world ? `<div class="kv"><span>세계 가격${tariff ? ` · 관세 ${Math.round(tariff * 100)}%` : g.world.noTariff ? ' · 무관세' : ''}</span><b>${num(x.world, 1)}</b></div><div class="kv"><span>이 값보다 비싸면 수입 · 싸면 수출</span><b>${num(x.world * (1 + tariff + E0.tradeCost), 1)} · ${g.world.export > 0 ? num(x.exportParity, 1) : '수출 없음'}</b></div>` : '<div class="kv"><span>세계 시장</span><b>교역하지 않는 상품</b></div>'}
  ${h.length > 1 ? `<svg class="spark" viewBox="0 0 300 52" role="img" aria-label="${esc(g.name)} 가격의 지난 ${h.length}개월 추이: 기준 대비 ${pctS(h[0])}에서 ${pctS(h.at(-1))}"><line class="axis-base" x1="10" y1="${py(0)}" x2="290" y2="${py(0)}" stroke-dasharray="3 4"/><polyline fill="none" points="${h.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')}"/></svg><small class="muted">지난 ${h.length}개월 · 점선이 기준가격</small>` : ''}
  ${x.shortage > 0 ? `<p class="reason" role="note">공급 부족: 이 상품을 투입재로 쓰는 건물의 생산이 최대 ${Math.round(x.shortage * 100)}%까지 깎입니다. 만드는 건물을 늘리거나 수입 여건(무역 역량·관세·외환)을 고치세요.</p>` : ''}</div>
  <div><h4>판매 주문 ${qty(x.supply)}</h4>${line('건물 산출', x.sup.buildings, names(makers))}${line('자급 농가', x.sup.subsistence)}${line('수입', x.sup.imports)}${x.supply < .05 ? '<p class="muted">파는 곳이 없습니다.</p>' : ''}
  <h4>구매 주문 ${qty(x.demand)}</h4>${line('가계 소비', x.dem.pops)}${line('건물 투입', x.dem.industry, names(users.filter(([b]) => !bdef(b).gov)))}${line('정부·군', x.dem.government)}${line('건설 자재', x.dem.construction)}${line('수출', x.dem.exports, g.world && g.world.export > 0 ? `한도 ${qty(x.exportCap)}` : '')}${x.demand < .05 ? '<p class="muted">사는 곳이 없습니다.</p>' : ''}</div>
  <div class="gd-foot"><h4>이 상품을 만드는 건물</h4>${buildable.length ? `<div class="row" style="justify-content:flex-start;flex-wrap:wrap;gap:6px">${buildable.map(b => btn(`${esc(b.name)} <small>전국 ${E.econ.levelsOf(state, [b.id])}단계</small>`, 'nav', { attrs: `data-view="build" data-focus="${b.id}"`, cls: 'small' })).join('')}</div>` : '<p class="muted">나라 안에서 만들 수 없어 전량 수입합니다.</p>'}</div></div>`;
}

/* ---------- 화면: 건물·건설 ---------- */
function queuePanel(R) {
  const C = R.construction, X = data.economy, exec = E.isExecutive(state);
  const items = state.construction.map((q, i) => {
    const def = bdef(q.id), gain = C.gains[i], left = monthsLeft(q, gain);
    return `<li class="${q.private ? 'private' : ''}"><div class="row"><strong>${esc(byId('regions', q.regionId).name)} · ${esc(def.name)}</strong><small>${q.private ? '<span class="tag">민간 투자</span>' : '<span class="tag ok">정부</span>'}</small></div>
    <div class="bar ${q.private ? '' : 'green'}"><i style="width:${Math.min(100, q.progress / def.cost * 100)}%"></i></div>
    <div class="row"><small>${num(q.progress, 0)} / ${def.cost}점 · 이번 달 +${num(gain, 1)}${left ? ` · 약 ${left}개월` : gain <= 1e-9 ? ' · 이번 달은 배분 없음' : ''}</small>${q.private ? '' : `<span class="acts">${btn('맨 앞으로', 'prioritize', { attrs: `data-id="${i}"`, cls: 'small quiet', reason: E.prioritizeReason(state, data, i) })}${btn('취소', 'cancelBuild', { attrs: `data-id="${i}" aria-label="${esc(def.name)} 공사 취소"`, cls: 'small quiet', reason: E.cancelBuildReason(state, data, i) })}</span>`}</div></li>`;
  }).join('');
  return `<article class="panel"><div class="row"><h2>건설</h2><span class="tag">이번 달 건설점 ${num(C.points, 1)}</span></div>
  <div class="kv"><span>기본 ${X.constructionBase} + 건설 부문 ${num(C.sectorPoints, 1)}${C.matShort < 1 ? ` · 자재 부족으로 ×${num(C.matShort, 2)}` : ''}</span><b>${num(C.points, 1)}점</b></div>
  <div class="kv"><span>쓰이는 점 <small>정부 ${num(C.usedGov, 1)} · 민간 ${num(C.usedPriv, 1)}</small></span><b>${num(C.used, 1)}점</b></div>
  <div class="kv"><span>자재값 <small>${Object.entries(C.materials).map(([g, q]) => `${good(g).name} ${num(q, 1)}`).join(' · ')} / 점</small></span><b>${num(C.costPerPoint, 3)} / 점</b></div>
  <div class="kv"><span>민간 몫 <small>현행 경제 체제</small> · 투자기금</span><b>${Math.round(C.privateShare * 100)}% · ${num(state.econ.pool, 1)}</b></div>
  <h3 style="margin-top:12px">대기열 ${state.construction.length}건 <small>정부 ${state.construction.filter(q => !q.private).length} / ${X.queueMax}</small></h3>
  <ul class="queue">${items || `<li class="muted">${exec ? '대기열이 비어 있습니다. 아래에서 건물을 골라 올리세요.' : '대기열이 비어 있습니다. 국정 권한이 없는 동안에는 민간 투자만 건물을 짓습니다.'}</li>`}</ul>
  <small class="muted">공사 한 건은 한 달에 ${X.maxPerProject}점까지 진행합니다. 착공에는 돈이 들지 않고, 진행한 점수만큼 자재값이 그 달 재정에서 나갑니다. 민간 공사의 자재값은 투자기금이 냅니다.</small></article>`;
}
function buildingRow(b, R) {
  const def = bdef(b.id), rec = R.buildings.find(x => x.b === b), u = data.economy.unit, market = !def.gov && !def.construction;
  const pms = def.pm.length > 1 ? `<div class="pms" role="group" aria-label="${esc(def.name)} 생산방식">${def.pm.map((pm, i) => { const reason = i === b.pm ? '' : E.pmReason(state, data, b.id, b.regionId, i); return `<button type="button" class="btn small ${i === b.pm ? 'primary' : ''}" data-action="pm" data-id="${b.id}" data-region="${b.regionId}" data-pm="${i}" aria-pressed="${i === b.pm}" ${reason ? `aria-disabled="true" disabled title="${esc(reason)}"` : `title="투입 ${esc(Object.entries(pm.in).map(([g, q]) => `${good(g).name} ${q}`).join(', ') || '없음')} → 산출 ${esc(Object.entries(pm.out).map(([g, q]) => `${good(g).name} ${q}`).join(', ') || (pm.points ? `건설점 ${pm.points}` : '없음'))}"`}>${esc(pm.name)}</button>`; }).join('')}</div>` : `<small class="muted">${esc(def.pm[0].name)}</small>`;
  const money = rec ? (market ? `<b class="delta ${rec.profit >= 0 ? 'good' : 'bad'}">${signed(rec.profit * u, 2)}</b><small>이익/월</small>` : `<b>${minus((rec.wages + rec.inputCost) * u)}</b><small>운영비/월</small>`) : '';
  const acts = [btn('한 단계 더 · AP 1', 'askBuild', { attrs: `data-id="${b.id}" data-region="${b.regionId}"`, cls: 'small', reason: E.buildReason(state, data, b.id, b.regionId) })];
  if (market && b.state < b.level) acts.push(btn(b.subsidy ? '보조금 중단' : '보조금', 'subsidy', { attrs: `data-id="${b.id}" data-region="${b.regionId}" aria-pressed="${b.subsidy}"`, cls: `small ${b.subsidy ? 'primary' : 'quiet'}`, reason: E.subsidyReason(state, data, b.id, b.regionId), title: '손실이 나면 국고가 메워 고용을 유지한다' }));
  if (b.state > 0 && def.private !== false) acts.push(btn('민영화 · AP 1', 'askPrivatize', { attrs: `data-id="${b.id}" data-region="${b.regionId}"`, cls: 'small quiet', reason: E.privatizeReason(state, data, b.id, b.regionId) }));
  if (b.state > 0) acts.push(btn('한 단계 줄이기', 'askDownsize', { attrs: `data-id="${b.id}" data-region="${b.regionId}"`, cls: 'small quiet', reason: E.downsizeReason(state, data, b.id, b.regionId) }));
  return `<li class="brow" id="b-${b.id}"><div class="b-head"><strong>${esc(def.name)}</strong> <span class="tag">${BCAT[def.category]}</span> <span class="lv">${b.level}단계</span>${b.state > 0 && def.private !== false ? ` <small>국영 ${b.state}</small>` : ''}${rec && rec.access < .95 ? ` <span class="flag short" title="권역 기반 시설 용량이 모자라 생산이 깎인다">접근성 ${Math.round(rec.access * 100)}%</span>` : ''}${rec && rec.short < 1 ? ` <span class="flag short" title="투입재 공급 부족">투입 부족 −${Math.round((1 - rec.short) * 100)}%</span>` : ''}</div>
  <div class="b-io"><span>${goodList(rec ? Object.fromEntries(Object.entries(rec.in).map(([g, q]) => [g, Math.round(q)])) : {})}</span><span aria-hidden="true">→</span><span>${def.pm[b.pm].points ? `<span class="gchip">건설점 <b>${num(def.pm[b.pm].points * b.level * b.staff, 1)}</b></span>` : def.monthlyEffects ? fxPlain(Object.fromEntries(Object.entries(def.monthlyEffects).map(([k, v]) => [k, v * b.level * b.staff])), { inline: true }) : goodList(rec ? Object.fromEntries(Object.entries(rec.out).map(([g, q]) => [g, Math.round(q)])) : {})}</span></div>
  <div class="b-stat"><span class="staff" title="일자리 ${rec ? num(rec.jobs, 0) : 0}개 가운데 채운 비율"><span class="bar ${b.staff < .7 ? '' : 'green'}"><i style="width:${b.staff * 100}%"></i></span><small>충원 ${Math.round(b.staff * 100)}% · ${rec ? num(rec.jobs * b.staff, 0) : 0}명</small></span><span class="money">${money}</span></div>
  ${pms}<div class="acts">${acts.join('')}</div></li>`;
}
function buildCard(def, r, R) {
  const reason = E.buildReason(state, data, def.id, r.id), site = E.econ.siteReason(state, data, def.id, r.id), locked = E.calendar(state.turn).year < def.unlockYear;
  const market = !def.gov && !def.construction, p = market && !site ? E.econ.prospect(state, data, R, def, r.id) : null, pm = def.pm[E.econ.findBuilding(state, def.id, r.id)?.pm || 0];
  const wants = wantedBy(def.id), months = Math.ceil(def.cost / data.economy.maxPerProject);
  const shortOut = Object.keys(pm.out).filter(g => R.goods[g].ratio > .1), glutOut = Object.keys(pm.out).filter(g => R.goods[g].ratio < -.1);
  return `<article class="panel card bcard ${site || locked ? 'off' : ''}" id="c-${def.id}"><div class="row"><span class="tag">${BCAT[def.category]} · ${OWNER[def.owner]}</span><small>건설점 ${def.cost} · 빨라야 ${months}개월${def.unlockYear > 1960 ? ` · ${def.unlockYear}년~` : ''}</small></div>
  <h2>${esc(def.name)}${def.requires ? ` <small class="tag unique">${esc(needs(def.requires))}</small>` : ''}</h2><p>${esc(def.description)}</p>
  <div class="b-io"><span>${goodList(pm.in)}</span><span aria-hidden="true">→</span><span>${pm.points ? `<span class="gchip">건설점 <b>${pm.points}</b></span>` : def.monthlyEffects && !Object.keys(pm.out).length ? fxPlain(def.monthlyEffects, { inline: true }) : goodList(pm.out)}</span></div>
  <small class="muted">한 단계·한 달 기준(${esc(pm.name)}) · 일자리 ${esc(jobsText(pm.jobs))}${def.infraUse ? ` · 기반 시설 ${def.infraUse} 사용` : ''}${def.infraSupply ? ` · 권역 기반 시설 +${def.infraSupply}` : ''}${def.trade ? ` · 무역 역량 +${num(def.trade * data.economy.unit, 1)}` : ''}${def.skill ? ` · 교육 ${def.skill} 미만이면 효율 감소` : ''}</small>
  ${p ? `<div class="cost"><span>예상 월 이익 <b class="delta ${p.profit >= 0 ? 'good' : 'bad'}">${signed(p.profit, 2)}</b></span><span>매출 <b>${num(p.revenue, 2)}</b></span><span>비용 <b>${num(p.cost, 2)}</b></span></div><small class="muted">지금 가격에 늘어날 공급을 반영한 추정${shortOut.length ? ` · <b class="pct hi">${shortOut.map(g => esc(good(g).name)).join('·')} 값이 높음</b>` : ''}${glutOut.length ? ` · <b class="pct lo">${glutOut.map(g => esc(good(g).name)).join('·')}이(가) 남아돎</b>` : ''}</small>` : ''}
  ${def.monthlyEffects && Object.keys(pm.out).length ? `<span class="fx-title">매월(단계마다)</span>${fxPlain(def.monthlyEffects)}` : ''}
  ${wants.length ? `<div class="wants">${wants.map(w => `<span class="igchip ${w.met ? 'met' : 'unmet'}" title="${esc(w.text)} ${w.have}/${w.need}단계">${esc(w.ig.mark)} ${esc(w.ig.name)} ${w.met ? '✓' : `${w.have}/${w.need}`}</span>`).join('')}</div>` : ''}
  <div class="actions">${btn(`${esc(r.name)}에 착공 검토 · AP 1`, 'askBuild', { attrs: `data-id="${def.id}" data-region="${r.id}"`, reason })}${reasonLine(reason)}</div></article>`;
}
function build() {
  const R = eco(), r = byId('regions', ui.region), infra = R.infra[r.id], dev = E.regionDevelopment(state, data, r.id);
  const mine = state.buildings.filter(b => b.regionId === r.id && b.level > 0).sort((a, b) => data.buildings.indexOf(bdef(a.id)) - data.buildings.indexOf(bdef(b.id)));
  const score = def => { if (E.econ.siteReason(state, data, def.id, r.id) || E.calendar(state.turn).year < def.unlockYear) return -9; if (def.gov || def.construction) return -1; return E.econ.prospect(state, data, R, def, r.id).perPoint; };
  const cards = data.buildings.map(def => [def, score(def)]).filter(([, v]) => ui.buildAll || v > -9).sort((a, b) => b[1] - a[1]);
  const lv = id => state.buildings.filter(b => b.regionId === id).reduce((a, b) => a + b.level, 0);
  return `<div class="page-head"><div><span class="eyebrow">BUILDINGS · 건물·건설</span><h1>수요가 있는 곳에 짓는다</h1><p>건물은 단계마다 사람을 쓰고 투입재를 사서 상품을 냅니다. 이익이 나면 사람을 채우고 손실이면 줄입니다. 정부는 건설 대기열에 건물을 올리고, 민간은 투자기금으로 이익이 날 건물을 스스로 짓습니다. 생산방식을 올리면 같은 사람으로 더 만들지만 새 투입재가 듭니다.</p></div></div>
  ${!E.isExecutive(state) ? `<div class="notice">${esc(PHASE[state.phase].name)} 단계에서는 정부가 건물을 짓거나 생산방식을 바꿀 수 없습니다. 민간 투자는 계속됩니다.</div>` : ''}
  <div class="build-grid">${queuePanel(R)}
  <article class="panel"><h2>권역 선택</h2><div class="region-board" role="group" aria-label="권역">${data.regions.map(x => `<button type="button" class="region" data-action="region" data-id="${x.id}" aria-pressed="${ui.region === x.id}" style="grid-column:${x.mapCol + 1};grid-row:${x.mapRow + 1}" aria-label="${esc(x.name)}, 개발도 ${num(E.regionDevelopment(state, data, x.id), 0)}, 건물 ${lv(x.id)}단계, 시장 접근성 ${Math.round(R.infra[x.id].access * 100)}%"><strong>${esc(x.name)}${E.regionEdict(state, x.id) ? ' <span class="edict-dot">시책</span>' : ''}</strong><small>건물 ${lv(x.id)} · 개발 ${num(E.regionDevelopment(state, data, x.id), 0)}</small>${R.infra[x.id].access < .95 ? `<small class="pct hi">접근성 ${Math.round(R.infra[x.id].access * 100)}%</small>` : ''}${state.construction.some(q => q.regionId === x.id) ? '<small>공사 중</small>' : ''}</button>`).join('')}</div>
  <p class="board-note">지리적 축척과 당시 행정 경계를 재현하지 않은 도식</p></article></div>
  <article class="panel"><div class="row"><div><span class="eyebrow">SELECTED REGION</span><h2>${esc(r.name)}</h2></div><div class="kv" style="min-width:210px"><span>개발도</span><b>${num(dev, 0)} / 100</b></div></div>
  ${traitChips(r)}
  <div class="two" style="margin-top:8px"><div><div class="kv"><span>기반 시설 <small>사용 / 용량</small></span><b>${num(infra.usage, 1)} / ${num(infra.supply, 1)}</b></div><div class="kv"><span>시장 접근성</span><b class="delta ${infra.access < 1 ? 'bad' : 'good'}">${Math.round(infra.access * 100)}%</b></div><div class="kv"><span>경지 <small>농장 단계 / 한도</small></span><b>${E.econ.findBuilding(state, 'farm', r.id)?.level || 0} / ${r.arable}</b></div>
  <small class="muted">건물이 쓰는 기반 시설이 용량을 넘으면 이 권역 건물의 생산이 깎입니다. 철도·항만을 짓거나 기반 시설 지수를 올리면 용량이 늘어납니다.</small></div><div>${edictPanel(r.id)}</div></div>
  <h3 style="margin-top:14px">이 권역의 건물 ${mine.length}종 · ${lv(r.id)}단계</h3><ul class="blist">${mine.map(b => buildingRow(b, R)).join('') || '<li class="muted">아직 건물이 없습니다.</li>'}</ul></article>
  <div class="row" style="margin:16px 0 12px"><h2 style="font-size:18px">${esc(r.name)}에 지을 수 있는 건물 <small class="muted">예상 이익이 큰 순서</small></h2><div class="filters" style="margin:0"><button type="button" class="btn" data-action="buildAll" aria-pressed="${ui.buildAll}">${ui.buildAll ? '전체 건물 표시 중' : '이 권역에서 가능한 건물만'}</button></div></div>
  <div class="cards">${cards.map(([def]) => buildCard(def, r, R)).join('') || '<p class="muted">조건에 맞는 건물이 없습니다.</p>'}</div>`;
}

/* ---------- 화면: 법률 ---------- */
function enactmentPanel() {
  const en = state.enactment; if (!en) return '';
  const law = lawOf(en.lawId), g = byId('lawGroups', law.group), c = E.lawChanceParts(state, data, law.id), X = data.economy.enactment, stages = STAGE_NAME[state.phase] || STAGE_NAME.governing;
  return `<article class="panel enact"><div class="row"><div><span class="eyebrow">제정 중 · ${esc(g.name)}</span><h2>${esc(law.name)}</h2></div><span class="tag">다음 검사까지 ${en.wait}개월</span></div>
  <div class="stages" aria-label="제정 단계">${stages.map((n, i) => `<span class="${i < en.stage ? 'done' : i === en.stage ? 'now' : ''}">${i + 1}. ${n}</span>`).join('')}<span>발효</span></div>
  <div class="two"><div><table class="parts"><thead><tr><th>지금 검사한다면</th><th>확률 기여</th></tr></thead><tbody>${c.parts.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${signed(v * 100, 1)}%p</td></tr>`).join('')}<tr><th>통과 확률 (${Math.round(X.min * 100)}~${Math.round(X.max * 100)}%)</th><th>${num(c.chance * 100, 0)}%</th></tr></tbody></table></div>
  <div><div class="kv"><span>통과한 단계</span><b>${en.stage} / ${X.stages}</b></div><div class="kv"><span>지체</span><b>${en.setbacks} / ${X.setbacks} <small>세 번이면 폐기</small></b></div><div class="kv"><span>발의</span><b>${esc(E.dateLabel(en.startedTurn))}</b></div>
  <p class="muted" style="font-size:13px">검사마다 통과하면 다음 단계로 갑니다. 통과하지 못하면 절반은 논쟁(다음 확률 +${Math.round(X.debate * 100)}%p), 절반은 지체입니다. 집권 연합을 바꾸면 확률이 달라집니다.</p>
  ${btn('제정 거두기 · AP 없음', 'askCancelEnact', { cls: 'small quiet', reason: E.cancelEnactReason(state) })}</div></div></article>`;
}
function lawOption(law, cur) {
  const active = cur.id === law.id, reason = active ? '' : E.enactReason(state, data, law.id), c = active ? null : E.lawChanceParts(state, data, law.id);
  const stances = data.interestGroups.map(g => { const v = law.stances[g.id] || 0, pref = v - (cur.stances[g.id] || 0), inGov = state.government.includes(g.id); return `<li class="${v > 0 ? 'good' : v < 0 ? 'bad' : 'flat'}"><span>${esc(g.mark)} ${esc(g.name)}${inGov ? ' <small>연합</small>' : ''}</span><b>${stanceText(v)}</b><small>세력 ${num(state.ig[g.id].clout * 100, 0)}%${active || !pref ? '' : ` · 현행보다 ${pref > 0 ? '선호' : '꺼림'}`}</small></li>`; }).join('');
  const yearly = Object.fromEntries(Object.entries(law.monthlyEffects).map(([k, v]) => [k, v * 12]));
  return `<article class="panel card law ${active ? 'active' : ''}"><div class="row"><h3>${esc(law.name)}</h3>${active ? '<span class="tag ok">현행 법</span>' : `<small>${law.unlockYear}년~</small>`}</div><p>${esc(law.description)}</p>
  ${Object.keys(law.effects).length ? `<span class="fx-title">${active ? '제정 때 한 번(이미 반영)' : '제정되면 한 번'}</span>${active ? fxPlain(law.effects) : fxProjected(law.effects)}` : ''}${Object.keys(yearly).length ? `<span class="fx-title">시행하는 동안 (12개월 누적, 기본값)</span>${fxPlain(yearly)}` : ''}
  <span class="fx-title">이해집단의 태도</span><ul class="fx stances">${stances}</ul>
  ${active ? `<div class="cost"><span>월 유지 <b>${num(law.monthlyCost, 2)}</b></span></div>` : `<div class="cost"><span>시행비 <b>${law.cost}</b></span><span>월 유지 <b>${num(law.monthlyCost, 2)}</b></span><span>AP <b>1</b></span><span>검사 통과 확률 <b>${num(c.chance * 100, 0)}%</b></span></div>
  <div class="actions">${btn('발의 검토 · AP 1', 'askEnact', { attrs: `data-id="${law.id}"`, reason })}${reasonLine(reason)}</div>`}</article>`;
}
function laws() {
  const gid = ui.lawGroup || data.lawGroups[0].id, g = byId('lawGroups', gid), cur = lawOf(state.laws[gid]), gc = E.governmentClout(state);
  const col = key => `<section class="law-col" aria-label="${COLUMN[key]}"><h2>${COLUMN[key]}</h2>${data.lawGroups.filter(x => x.column === key).map(x => { const law = lawOf(state.laws[x.id]), busy = state.enactment && lawOf(state.enactment.lawId).group === x.id, n = data.laws.filter(l => l.group === x.id && l.id !== law.id && !E.enactReason(state, data, l.id)).length;
    return `<button type="button" class="law-row ${gid === x.id ? 'sel' : ''}" data-action="lawGroup" data-id="${x.id}" aria-pressed="${gid === x.id}"><small>${esc(x.name)}</small><strong>${esc(law.name)}</strong>${busy ? '<span class="tag warn">제정 중</span>' : n ? `<span class="tag ok" title="지금 발의할 수 있는 법">발의 가능 ${n}</span>` : ''}</button>`; }).join('')}</section>`;
  return `<div class="page-head"><div><span class="eyebrow">LAWS · 법률</span><h1>법은 누가 원하는가에 달려 있다</h1><p>분류마다 한 법만 유효합니다. 새 법은 집권 연합 안에 그 법을 현행 법보다 바라는 집단이 있어야 발의할 수 있고, 정해진 달마다 검사를 받아 세 번 통과해야 제정됩니다. 한 번에 한 법만 다룹니다. 실제 국회의 법안·의석·표결이 아닌 게임 규칙입니다.</p></div><span class="tag">집권 연합 세력 ${num(gc * 100, 0)}%${state.phase === 'governing' ? ` · 가상 의석 ${num(state.seats * 100, 0)}%` : ''}</span></div>
  ${!E.isExecutive(state) ? `<div class="notice">${esc(PHASE[state.phase].name)} 단계에서는 법률을 발의할 수 없습니다. 현행 법과 이해집단의 태도를 미리 볼 수 있습니다.</div>` : state.phase === 'transition' ? `<div class="notice">과도 통치 중에는 의회 없이 의결합니다. 제정될 때마다 자유 ${data.economy.enactment.decreeCost.liberty}, 정당성 ${data.economy.enactment.decreeCost.legitimacy}의 비용이 붙습니다.</div>` : ''}
  ${enactmentPanel()}
  <div class="law-cols">${['power', 'economy', 'rights'].map(col).join('')}</div>
  <div class="row" style="margin:18px 0 10px"><h2 style="font-size:18px">${esc(g.name)} <small class="muted">${esc(g.description)} 검사 간격 ${g.interval}개월</small></h2></div>
  <div class="cards">${data.laws.filter(l => l.group === gid).sort((a, b) => (b.id === cur.id) - (a.id === cur.id)).map(l => lawOption(l, cur)).join('')}</div>`;
}

/* ---------- 화면: 이해집단 ---------- */
function groupCard(g, R) {
  const x = state.ig[g.id], v = state.support[g.id], st = E.econ.approvalState(v, data), p = E.econ.approvalParts(state, data, R, g), pop = R.pops[g.id], A = data.economy.approval, th = A.thresholds;
  const inGov = state.government.includes(g.id), reason = E.coalitionReason(state, data, g.id), scale = E.econ.cloutScale(x.clout, data);
  const demands = E.econ.demandStatus(state, data, g), traits = E.econ.activeTraits(state, data).filter(t => t.igId === g.id), dv = state.report?.support?.[g.id] || 0;
  const part = (label, val) => `<li class="${val > .05 ? 'good' : val < -.05 ? 'bad' : 'flat'}"><span>${label}</span><b>${signed(val, 1)}</b></li>`;
  const wish = data.lawGroups.map(lg => { const cur = lawOf(state.laws[lg.id]), best = data.laws.filter(l => l.group === lg.id).sort((a, b) => (b.stances[g.id] || 0) - (a.stances[g.id] || 0))[0]; return { lg, cur, best, gap: (best.stances[g.id] || 0) - (cur.stances[g.id] || 0) }; })
    .filter(w => w.gap >= 2).sort((a, b) => b.gap - a.gap).slice(0, 5)
    .map(w => `<li><button type="button" class="linkish" data-action="nav" data-view="laws" data-group="${w.lg.id}">${esc(w.lg.name)}: ${esc(w.best.name)}</button> <small>현행 ${esc(w.cur.name)} · ${stanceText(w.cur.stances[g.id] || 0)}</small></li>`).join('');
  const traitText = t => [...Object.entries(t.modifiers).map(([k, val]) => `${MOD_NAME[k] || k} ${pctS(val * t.scale)}`), ...Object.entries(t.monthly).map(([k, val]) => `${mlabel(k)} 매월 ${signed(val * t.scale, 2)}`)].join(' · ');
  return `<article class="panel card group ${st}"><div class="head"><span class="initial" aria-hidden="true">${esc(g.mark)}</span><div><h2>${esc(g.name)}</h2><span class="tag ${st === 'angry' || st === 'unhappy' ? 'warn' : st === 'happy' || st === 'loyal' ? 'ok' : ''}">${STATE_NAME[st]}</span>${inGov ? ' <span class="tag history">집권 연합</span>' : ''}${scale > 1 ? ' <span class="tag">강력</span>' : scale === 0 ? ' <span class="tag">소외</span>' : ''}</div></div>
  <p style="font-size:13.5px">${esc(g.description)}</p>
  <div class="kv"><span>지지도</span><b>${num(v, 0)} <small class="delta ${dv > 0 ? 'good' : dv < 0 ? 'bad' : 'flat'}" style="display:inline">${arrow(dv)}${signed(dv, 1)}</small></b></div>
  <div class="approval" role="img" aria-label="지지도 ${num(v, 0)}. ${th.angry} 미만 분노, ${th.unhappy} 미만 불만, ${th.happy} 이상 만족, ${th.loyal} 이상 충성"><i class="zone bad" style="width:${th.unhappy}%"></i><i class="zone good" style="left:${th.happy}%;width:${100 - th.happy}%"></i><i class="mark" style="left:${v}%"></i><i class="goal" style="left:${p.target}%" title="목표 ${num(p.target, 0)}"></i></div>
  <div class="kv"><span>세력 <small>법률 제정에 쓰인다</small></span><b>${num(x.clout * 100, 1)}%</b></div><div class="kv"><span>투표 비중 <small>선거에 쓰인다</small> · 인구</span><b>${num(x.vote * 100, 1)}% · ${qty(pop.pop)}</b></div>
  <div class="kv"><span>생활수준 <small>기대 ${num(p.expect, 1)}</small></span><b>${num(pop.sol, 1)}</b></div>
  <span class="fx-title">지지도가 향하는 값 ${num(p.target, 0)} = 50 +</span><ul class="fx">${part('현행 법률', p.law)}${part('요구', p.demands)}${part('생활수준', p.living)}${part(inGov ? '집권 연합' : '연합 밖', p.gov)}${part('사건·개혁의 여파', p.mod)}</ul>
  <span class="fx-title">요구하는 건물</span><ul class="demands">${demands.map(dm => `<li class="${dm.met ? 'met' : 'unmet'}"><span>${dm.met ? '✓' : '×'} ${esc(dm.text)}</span><b>${dm.have} / ${dm.need}단계</b><small>${dm.met ? '+' : '−'}${dm.weight}</small></li>`).join('')}</ul>
  ${wish ? `<span class="fx-title">바라는 법</span><ul class="wish">${wish}</ul>` : '<span class="fx-title">바라는 법</span><p class="muted" style="font-size:13px">모든 분류에서 가장 바라는 법이 시행 중입니다.</p>'}
  <span class="fx-title">특성</span>${traits.length ? `<ul class="fx">${traits.map(t => `<li class="${t.key === 'unhappy' ? 'bad' : 'good'}"><span>${esc(t.name)}${t.scale !== 1 ? ` ×${t.scale}` : ''}</span><b>${esc(traitText(t))}</b></li>`).join('')}</ul>` : `<p class="muted" style="font-size:13px">${scale === 0 ? '세력이 너무 작아 특성이 켜지지 않습니다.' : `켜진 특성 없음. 불만이면 '${esc(g.traits.unhappy.name)}', 만족이면 '${esc(g.traits.happy.name)}', 충성이면 '${esc(g.traits.loyal.name)}'.`}</p>`}
  <div class="actions">${btn(inGov ? '연합에서 빼기 · AP 1' : '연합에 넣기 · AP 1', 'askCoalition', { attrs: `data-id="${g.id}"`, reason, cls: inGov ? 'danger' : '' })}${reasonLine(reason)}</div></article>`;
}
const MOD_NAME = { farmThroughput: '농장 처리율', mfgThroughput: '제조·자원 처리율', constructionEff: '건설 효율', taxEff: '징수율', investBonus: '투자기금 기여', tradeCapBonus: '무역 역량' };
function groups() {
  const R = eco(), gc = E.governmentClout(state), leg = E.coalitionLegitimacy(state, data), next = E.nextElectionTurn(state), G = data.economy.government;
  return `<div class="page-head"><div><span class="eyebrow">INTEREST GROUPS · 이해집단</span><h1>여섯 집단, 서로 다른 요구</h1><p>집단마다 바라는 법과 건물이 다릅니다. 들어주면 지지도가 오르고 특성이 경제에 보탬이 되며, 외면하면 지지도가 떨어져 부담이 됩니다. 세력은 인구와 법률에서 나와 법률 제정의 확률을 정하고, 투표 비중은 인구에서 나와 선거를 정합니다.</p></div><span class="tag">종합 지지도 ${num(E.supportAverage(state, data), 0)}</span></div>
  <article class="panel"><div class="row"><h2>집권 연합</h2><span class="tag">${state.government.length} / ${G.max} 집단</span></div>
  <div class="row" style="justify-content:flex-start;flex-wrap:wrap;gap:8px">${state.government.map(id => igChip(id, 'gov')).join('')}</div>
  <div class="seat-bar" role="img" aria-label="집권 연합 세력 ${num(gc * 100, 0)}%" style="margin-top:10px"><i style="width:${gc * 100}%"></i><span style="left:${G.center * 100}%"></span></div>
  <div class="kv"><span>연합의 세력 <small>${Math.round(G.center * 100)}%보다 크면 정당성이 오른다</small></span><b>${num(gc * 100, 0)}% → 정당성 매월 <span class="delta ${leg >= 0 ? 'good' : 'bad'}" style="display:inline">${signed(leg, 3)}</span></b></div>
  ${next !== null ? `<div class="kv"><span>다음 가상 정기 선거 ${esc(E.dateLabel(next))}</span><b>예상 득표 지표 ${num(E.electionExpectation(state, data), 0)}±6 <small>45 미만이면 이양</small></b></div>` : ''}
  <small class="muted">연합에 든 집단은 지지도 +${data.economy.approval.inGov}, 밖의 집단은 ${data.economy.approval.outGov}. 빼면 그 집단의 지지도가 ${data.economy.approval.dismissed} 내려갑니다. ${state.phase === 'transition' ? '과도 통치 중에는 군대가 연합에서 빠질 수 없습니다.' : ''}${!E.isExecutive(state) ? `${esc(PHASE[state.phase].name)} 단계에서는 연합을 바꿀 수 없습니다.` : ''}</small></article>
  <div class="cards groups">${data.interestGroups.map(g => groupCard(g, R)).join('')}</div>`;
}

/* ---------- 화면: 재정 ---------- */
function budget() {
  const R = eco(), f = R.finance, dt = R.detail, tax = R.mods.tax, canBudget = !E.budgetReason(state);
  const draft = ui.budgetDraft || { ...state.budget }, sum = E.BUDGET_KEYS.reduce((a, k) => a + Number(draft[k] || 0), 0);
  const debt = state.stats.debt, rate = v => v ? `${Math.round(v * 100)}%` : '없음';
  const row = (label, v, neg = false) => `<div class="kv"><span>${label}</span><b>${neg ? minus(v) : num(v, 2)}</b></div>`;
  const opt = (label, v, neg = true) => Math.abs(v) > .004 ? row(label, v, neg) : '';
  return `<div class="page-head"><div><span class="eyebrow">TREASURY · 재정</span><h1>약속에는 재원이 필요하다</h1><p>돈의 단위는 '재정점'입니다. 실제 원화나 세수 추계가 아닙니다. 세입은 가계의 소비와 임금, 건물의 이익, 농지, 수입품에서 걷고, 세율은 조세·무역 법률이 정합니다. 국고가 0보다 작아지면 부족분이 자동으로 부채가 됩니다.</p></div></div>
  <div class="kpis">${['treasury', 'debt', 'reserves', 'inflation', 'gdp', 'unemployment'].map(id => kpi(id)).join('')}</div>
  <div class="two"><article class="panel"><h2>다음 달 재정 전망</h2>
  <h3>세입 <small>${num(f.income, 2)}</small></h3>
  ${row(`소비세 <small>${rate(tax.consumption)}</small>`, dt.taxes.consumption)}${opt(`임금세 <small>${rate(tax.wage)}</small>`, dt.taxes.wage, false)}${row(`이익세 <small>${rate(tax.profit)}</small>`, dt.taxes.profit)}${row(`토지세 <small>${rate(tax.land)}</small>`, dt.taxes.land)}${row(`관세 <small>${rate(R.mods.tariff)}</small>`, dt.tariffs)}${opt('국영 건물 배당', dt.stateDividend, false)}${opt('민간 공사 자재값 <small>투자기금이 냄</small>', dt.poolTransfer, false)}
  <div class="kv"><span>징수율 <small>행정 역량 ${num(state.stats.admin, 0)}과 법률·소시민의 태도</small></span><b>${Math.round(dt.collect * 100)}%</b></div>
  <h3 style="margin-top:12px">세출 <small>${num(f.expense, 2)}</small></h3>
  ${row('기본 지출 <small>예산 배분의 재원</small>', f.base, true)}${row(`이자 <small>부채의 ${pct(EK.interest)}</small>`, f.interest, true)}${row('정부·건설 부문 인건비', dt.govWages, true)}${row('정부 건물이 쓰는 물자', dt.govGoods, true)}${opt('건설 자재값', dt.construction)}${opt('보조금', dt.subsidies)}${opt('국영 건물 손실', dt.stateLoss)}${opt('실업 부조', dt.relief)}${opt('수출 지원금', dt.exportSubsidy)}${opt(`정책 유지비 (${state.policies.length}개)`, dt.upkeep.policies)}${opt('법률 유지비', dt.upkeep.laws)}${opt(`지역 시책 유지비 (${state.edicts.length}개)`, dt.upkeep.edicts)}${opt(`자문위원 유지비 (${state.advisers.length}명 × 0.15)`, dt.upkeep.advisers)}
  <div class="kv"><strong>월 수지</strong><b class="delta ${f.balance >= 0 ? 'good' : 'bad'}">${arrow(f.balance)} ${signed(f.balance, 2)}</b></div>
  ${state.lastFinance ? `<small>지난달(${E.dateLabel(state.lastFinance.turn)}) 실제 수지 ${signed(state.lastFinance.balance, 2)}${state.report?.borrowed ? ` · 부족분 ${num(state.report.borrowed, 1)} 차입` : ''}</small>` : ''}
  <h3 style="margin-top:16px">부채 위험</h3><div class="gauge" role="img" aria-label="부채 ${num(debt, 0)}. ${EK.inflation.debtFrom}을 넘으면 물가 압력, 700 이상이면 재정위기 엔딩"><i style="left:${Math.min(100, debt / 800 * 100)}%"></i></div><div class="gauge-labels" aria-hidden="true"><small style="left:0">0</small><small style="left:27.5%">${EK.inflation.debtFrom} 물가 압력</small><small style="left:87.5%">700 위기</small></div>
  <p style="margin-top:10px;font-size:14px">현재 부채 <b>${num(debt, 1)}</b> · 월 이자 ${num(f.interest, 2)}</p>
  <div class="row" style="justify-content:flex-start;flex-wrap:wrap">${[10, 25, 50].map(a => btn(`${a} 상환 · AP 1`, 'askRepay', { attrs: `data-id="${a}"`, reason: E.repayReason(state, a), cls: 'small' })).join('')}</div>${reasonLine(E.repayReason(state, 10))}
  <p class="muted" style="font-size:13px;margin-top:10px">적자가 굳어지면: 건설 대기열을 줄이면 자재값이, 정부 건물의 단계를 줄이면 인건비가 줄어듭니다. 조세 법률을 바꾸면 세입의 구성이 달라지고, 행정 역량을 올리면 징수율이 오릅니다.</p>
  </article>
  <article class="panel"><h2>예산 배분 (합계 100)</h2><p class="muted" style="font-size:13.5px">배분은 지출 총액을 새로 만들지 않고 여섯 역량의 성장 방향과 정부가 사들이는 물자를 정합니다. 매월 역량 변화 = (배분율 − 12) × 0.006. 배분 수정은 행동점수를 쓰지 않습니다.</p>
  ${canBudget ? '' : `<div class="notice">${esc(E.budgetReason(state))} 지금은 관찰용 국가 기본값이 적용됩니다.</div>`}
  <form id="budget-form" novalidate>${E.BUDGET_KEYS.map(k => { const v = Number(draft[k] || 0); return `<div class="budget-row"><label for="b-${k}">${BUDGET_LABEL[k]}</label><input type="range" min="0" max="60" step="1" id="r-${k}" name="${k}" value="${v}" aria-label="${BUDGET_LABEL[k]} 배분" ${canBudget ? '' : 'disabled'}><input type="number" inputmode="numeric" min="0" max="100" step="1" id="b-${k}" name="${k}" value="${v}" ${canBudget ? '' : 'disabled'}><small>월 ${esc(mlabel(k))} ${signed((v - 12) * .006, 3)} (현재 ${num(state.stats[k])})</small></div>`; }).join('')}
  <p class="sum ${Math.abs(sum - 100) < .001 ? 'good' : 'bad'}" id="budget-sum" aria-live="polite">합계 ${num(sum, 0)} / 100 ${Math.abs(sum - 100) < .001 ? '✓' : `· ${sum > 100 ? `${num(sum - 100, 0)} 초과` : `${num(100 - sum, 0)} 부족`}`}</p>
  <div class="filters" role="group" aria-label="배분 예시">${BUDGET_PRESETS.map(([name], i) => `<button type="button" class="btn small" data-action="preset" data-id="${i}" ${canBudget ? '' : 'disabled'}>${name}</button>`).join('')}</div>
  <div class="row" style="justify-content:flex-start;flex-wrap:wrap">${btn('배분 적용 (무료)', 'applyBudget', { cls: 'primary', reason: E.budgetReason(state) || (Math.abs(sum - 100) > .001 ? '합계가 100이어야 합니다.' : '') })}${btn('되돌리기', 'resetBudget', { cls: 'quiet', reason: canBudget ? '' : '권한이 없습니다.' })}</div>
  ${reasonLine(E.budgetReason(state) || (Math.abs(sum - 100) > .001 ? '합계가 100이어야 적용할 수 있습니다.' : ''))}</form>
  <h3 style="margin-top:16px">계층의 살림 <small>이번 달</small></h3><table class="parts"><thead><tr><th>계층</th><th>인구</th><th>1인당 소득</th><th>생활수준</th></tr></thead><tbody>${data.interestGroups.map(g => { const x = R.pops[g.id]; return `<tr><td>${esc(g.name)}</td><td>${qty(x.pop)}</td><td>${num(x.perCapita, 1)}</td><td>${num(x.sol, 1)}</td></tr>`; }).join('')}</tbody></table>
  <small class="muted">평균 임금 ${num(R.wage, 1)} · 노동 인구 ${qty(R.labor.workforce)} = 건물 고용 ${qty(R.labor.employed)} + 자급 농가 ${qty(R.labor.subsistence)} + 실업 ${qty(R.labor.unemployed)} · 건물 평균 이익률 ${pctS(R.labor.margin)}. 실업이 ${Math.round(EK.fullEmployment * 100)}%보다 적고 이익률이 ${Math.round(EK.wageMargin * 100)}%를 넘으면 임금이 오릅니다.</small></article></div>`;
}

/* ---------- 화면: 외교 ---------- */
function diplomacy() {
  return `<div class="page-head"><div><span class="eyebrow">FOREIGN RELATIONS · 외교</span><h1>관계는 시간이 쌓은 자산</h1><p>관계는 0~100 가상 지수입니다. 서유럽·비동맹권·국제기구는 실제 단일 국가가 아닌 묶음입니다. 행동마다 AP 1을 쓰고, 같은 상대와는 한 달에 한 번만 행동할 수 있습니다. 전쟁 전술이나 정권 전복 절차는 다루지 않습니다.</p></div></div>
  ${!E.isExecutive(state) ? `<div class="notice">${esc(PHASE[state.phase].name)} 단계에서는 외교 행동을 할 수 없습니다.</div>` : ''}
  <div class="cards">${data.countries.map(n => { const used = state.monthActions.includes(`diplomacy:${n.id}`); return `<article class="panel card"><div class="row"><h2>${esc(n.name)}</h2><span class="tag">관계 ${num(state.relations[n.id], 0)}</span></div><p>${esc(n.description)}</p><div class="bar green"><i style="width:${state.relations[n.id]}%"></i></div>
  ${used ? '<p class="status-line">이번 달 외교 행동 완료</p>' : ''}
  <div class="stack" style="margin-top:8px">${Object.entries(E.DIPLOMACY_MODES).map(([mode, o]) => { const r = E.diplomacyReason(state, data, n.id, mode); return `<div>${btn(`${o.label} · ${o.cost} 재정점 · AP 1`, 'askDiplomacy', { attrs: `data-id="${n.id}" data-mode="${mode}"`, reason: r, cls: 'block' })}<ul class="fx"><li class="good"><span>관계</span><b>▲ +${o.relation}</b></li>${Object.entries(o.effects).map(([k, v]) => `<li class="${tone(k, v)}"><span>${esc(mlabel(k))}</span><b>${arrow(v)} ${signed(v, 0)}</b></li>`).join('')}</ul></div>`; }).join('')}</div>
  ${reasonLine(E.diplomacyReason(state, data, n.id, 'talk'))}</article>`; }).join('')}</div>`;
}

/* ---------- 화면: 내각 ---------- */
function cabinet() {
  return `<div class="page-head"><div><span class="eyebrow">ADVISORY DESK · 내각 자문</span><h1>서로 다른 관점의 조언</h1></div><span class="tag">${state.advisers.length} / 2 임명</span></div>
  <div class="banner" style="background-image:url('${art('cabinet')}')" role="img" aria-label="${esc(artCaption('cabinet'))}"><div class="text"><strong>이 화면의 자문위원 여섯 명은 모두 창작 인물입니다.</strong><p style="margin:4px 0 0;font-size:14px">실제 장관·관료의 발언이나 경력을 재현하지 않습니다. 동시에 두 명까지 임명하며, 임명·해임에 AP 1을 씁니다. 지속 효과는 집행 권한이 있는 동안 매월 더해집니다.</p></div></div>
  ${!E.isExecutive(state) ? `<div class="notice">${esc(PHASE[state.phase].name)} 단계에서는 자문위원을 임명할 수 없습니다.</div>` : ''}
  <div class="cards">${data.advisers.map(a => { const on = state.advisers.includes(a.id), r = E.adviserReason(state, data, a.id); const yearly = Object.fromEntries(Object.entries(a.monthlyEffects).map(([k, v]) => [k, v * 12])); return `<article class="panel card adviser"><div class="head"><span class="initial" aria-hidden="true">${esc(a.initials)}</span><div><span class="tag fiction">가상 인물 · ${esc(a.role)}</span><h2>${esc(a.name)}</h2></div></div>
  <blockquote>${esc(a.quote)}</blockquote><span class="fx-title">지속 효과 (12개월 누적${data.balance && data.balance.diminishing ? ', 기본값' : ''})</span>${fxPlain(yearly)}
  <div class="cost"><span>임명비 <b>${a.cost}</b></span><span>월 유지 <b>0.15</b></span><span>AP <b>1</b></span></div>${on ? '<p class="status-line">임명 중</p>' : ''}
  <div class="actions">${btn(on ? '해임 검토 · AP 1' : '임명 검토 · AP 1', 'askAdviser', { attrs: `data-id="${a.id}"`, reason: r, cls: on ? 'danger' : '' })}${reasonLine(r)}</div></article>`; }).join('')}</div>`;
}

/* ---------- 화면: 기록실 ---------- */
function archive() {
  const unlocked = E.achievements(state, data);
  const entries = state.log.slice().reverse().filter(l => ui.logFilter === 'all' || LOG_GROUP[l.type] === ui.logFilter);
  return `<div class="page-head"><div><span class="eyebrow">PUBLIC RECORD · 기록실</span><h1>기록은 선택을 지우지 않는다</h1><p>저장·불러오기, 연대기, 역사 출처, 가상 수치의 정의를 한곳에 모았습니다.</p></div></div>
  ${state.ending ? `<div style="margin-bottom:16px">${endingCard()}</div>` : ''}
  <article class="panel"><h2>저장</h2><p style="font-size:14px">${savedInfo ? `자동 저장: ${esc(ym(savedInfo.turn))} 상태가 이 브라우저에 보관되어 있습니다.` : '자동 저장 기록이 없습니다.'} 다른 기기로 옮기거나 보관하려면 저장 파일(JSON)을 내보내세요. 불러온 파일은 버전·ID·수치 범위를 검사하고, 손상된 파일은 일부만 반영하지 않고 거부합니다. 이전 판(저장 형식 1~4)의 저장은 경제 구조가 달라 불러올 수 없습니다.</p>
  <div class="row" style="justify-content:flex-start;flex-wrap:wrap">${btn(`${icon('save')} ${EMBEDDED ? '저장 텍스트 복사' : '저장 파일 내보내기'}`, 'export', { cls: 'primary' })}<label class="btn file-btn">저장 파일 불러오기<input type="file" accept="application/json,.json" data-input="import" aria-label="저장 파일 불러오기"></label>${EMBEDDED ? '' : btn('저장 텍스트 복사', 'exportText')}${btn('저장 텍스트 붙여넣기', 'pasteImport')}${btn('새 연대기', 'newgame', { cls: 'quiet' })}</div><small class="muted" style="display:block;margin-top:6px">${EMBEDDED ? '이 보기 화면은 파일 다운로드를 막습니다. 저장 텍스트를 복사해 두었다가 붙여넣기로 이어 하세요. 진행은 이 브라우저에 자동 저장됩니다.' : '파일을 받을 수 없는 환경에서는 저장 텍스트를 복사해 두었다가 붙여넣기로 이어 할 수 있습니다.'}</small>${storageNote ? `<p class="reason">${esc(storageNote)}</p>` : ''}</article>
  <article class="panel"><h2>기록 표식 ${unlocked.length} / ${data.achievements.length}</h2><div class="badges">${data.achievements.map(a => { const on = unlocked.some(x => x.id === a.id); return `<span class="badge-item ${on ? 'on' : ''}">${on ? '✓ ' : ''}${esc(a.name)} <small>${esc(a.description)}</small></span>`; }).join('')}</div></article>
  <article class="panel"><div class="row" style="flex-wrap:wrap"><h2>선택의 연대기 · ${state.log.length}건</h2></div><div class="filters" role="group" aria-label="기록 종류">${LOG_FILTERS.map(([id, t]) => `<button type="button" class="btn" data-action="logFilter" data-id="${id}" aria-pressed="${ui.logFilter === id}">${t}</button>`).join('')}</div>
  <ul class="timeline">${entries.slice(0, 400).map(l => `<li><time>${esc(l.date)}</time><p><span class="tag ${l.kind === 'historical_anchor' ? 'history' : l.kind ? 'fiction' : ''}">${esc(LOG_TYPES[l.type] || l.type)}${l.kind ? ` · ${l.kind === 'historical_anchor' ? '역사 앵커, 반응은 가상' : '가상 상황'}` : ''}</span> ${esc(l.text)}</p>${l.changes ? `<span></span>${fxPlain(l.changes)}` : ''}</li>`).join('') || '<li><span></span><p class="muted">이 종류의 기록이 아직 없습니다.</p></li>'}</ul>${entries.length > 400 ? `<small>최근 400건만 표시합니다. 전체 기록은 저장 파일에 있습니다.</small>` : ''}</article>
  <details class="panel"><summary>역사 확인 자료 ${data.sources.length}건 · 확인일 ${esc(data.meta.sourceChecked)}</summary><p class="muted" style="font-size:13.5px">출처는 날짜와 사건 맥락을 확인하는 데에만 썼습니다. 선택지, 수치 효과, 선거·의석, 자문위원, 삽화는 모두 창작입니다.</p><ul class="timeline">${data.sources.map(s => `<li><time>${esc(s.id)}</time><p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a><br><small>${esc(s.institution)} · ${esc(s.scope)}</small></p></li>`).join('')}</ul></details>
  <details class="panel"><summary>가상 지표의 정의와 계산 규칙</summary><p style="font-size:13.5px">${esc(data.meta.disclaimer)}</p>${data.metrics.map(m => `<div class="kv" style="display:block"><strong>${esc(m.label)}</strong> <small>${esc(m.unit)} · ${m.min}~${m.max}${m.higherIsBetter ? '' : ' · 낮을수록 좋음'}</small><p style="font-size:13.5px;margin:2px 0 0">${esc(m.description)} ${esc(metricHelp(m.id))}</p></div>`).join('')}</details>
  <details class="panel"><summary>엔딩 12종과 판정 순서</summary><p style="font-size:13.5px">재정·신뢰·권리 위기는 매달 먼저 검사합니다. 퇴임·이양은 명시적인 선택이나 선거로만 기록됩니다. 1979년 12월이 끝나면 조건을 만족하는 엔딩 가운데 우선순위가 가장 높은 것을 고릅니다.</p>${[...data.endings].sort((a, b) => b.priority - a.priority).map(e => `<div class="kv"><span>${esc(e.title)} <small>${esc(endingRule(e))}</small></span><b>${e.priority}</b></div>`).join('')}</details>
  <details class="panel"><summary>제작·권리 표기</summary><p style="font-size:13.5px">독자 제작 게임입니다. 시장·건설·법률·이해집단의 규칙 틀은 잘 알려진 전략 게임의 구조를 따르되, 상품·건물·법률·수치와 화면은 이 게임을 위해 새로 만들었고 참조 게임의 코드·화면·대사·수치·이미지를 쓰지 않았습니다. 삽화 4점은 이 게임을 위해 생성한 그림이며 역사 사진이 아닙니다. 표지 인물은 실존 인물로 식별할 수 없는 뒷모습입니다. 한국어 글꼴 Chronicle KR은 Noto Sans KR(SIL Open Font License 1.1)의 서브셋입니다. 자문위원은 모두 가상 인물입니다. 군사정변·정치 폭력은 헌정적 결과와 제도적 비용으로만 추상화했습니다.</p><p style="font-size:13px" class="muted">데이터 ${esc(data.meta.version)} · 저장 형식 ${E.SAVE_VERSION} · 시드 상태 ${state.rng}</p></details>`;
}
function endingRule(e) {
  if (e.conditions.explicit) return '명시적 선택·선거 결과';
  const ops = { gte: '≥', lte: '≤', lt: '<' };
  const parts = Object.entries(e.conditions).flatMap(([k, r]) => Object.entries(r).map(([op, v]) => `${mlabel(k)} ${ops[op]} ${v}`));
  return parts.length ? parts.join(', ') : '그 밖의 모든 경우';
}

/* ---------- 오른쪽 브리핑 ---------- */
/** 오른쪽 '이번 달 업무': 지금 해야 하거나 곧 일어날 일. */
function agenda() {
  const t = state.turn, items = [], R = eco(), exec = E.isExecutive(state);
  const item = (kind, title, text, action = '') => items.push(`<li class="task ${kind}"><div><strong>${title}</strong>${text ? `<small>${text}</small>` : ''}</div>${action}</li>`);
  if (state.ending) item('done', '연대기 종료', esc(state.ending.title), btn('엔딩 평가', 'nav', { attrs: 'data-view="overview"', cls: 'small' }));
  if (state.queue.length && !state.ending) item('must', `사건 ${state.queue.length}건 결정`, '결정하기 전에는 시간이 흐르지 않습니다.', btn('결정하기', 'gotoEvent', { cls: 'small primary' }));
  if (!state.ending && state.ap > 0) {
    if (E.PREPARE_PHASES.includes(state.phase)) item('open', `행동점수 ${state.ap} 남음`, '사전 준비는 1963년 가상 선거의 준비 영향력이 됩니다.', btn('사전 준비', 'prepare', { cls: 'small', reason: E.prepareReason(state) }));
    else if (exec) item('open', `행동점수 ${state.ap} 남음`, '다음 달 1일에 3으로 다시 채워집니다(이월 없음).', btn('건설', 'nav', { attrs: 'data-view="build"', cls: 'small' }) + btn('법률', 'nav', { attrs: 'data-view="laws"', cls: 'small' }));
  }
  if (!state.ending) {
    const left = `<span class="js-days">${daysUntilMonthEnd(1)}</span>`;
    if (state.enactment && state.enactment.wait === 1) item('soon', `${esc(lawOf(state.enactment.lawId).name)} 제정 검사`, `${left}일 뒤 월 결산 때 · 통과 확률 ${num(E.lawChance(state, data, state.enactment.lawId) * 100, 0)}%`);
    state.construction.forEach((q, i) => { const g = R.construction.gains[i]; if (g > 0 && bdef(q.id).cost - q.progress <= g + 1e-6) item('soon', `${esc(byId('regions', q.regionId).name)} ${esc(bdef(q.id).name)} 준공`, `${left}일 뒤 월 결산 때${q.private ? ' · 민간 투자' : ''}`); });
    const short = data.goods.filter(g => R.goods[g.id].shortage > 0);
    if (short.length) item('open', `공급 부족 ${short.length}종`, short.map(g => esc(g.name)).join(' · '), btn('시장', 'nav', { attrs: 'data-view="market"', cls: 'small' }));
    if (exec && !state.construction.some(q => !q.private)) item('open', '정부 건설 대기열이 비어 있음', `건설점 ${num(R.construction.points, 0)} 가운데 ${num(R.construction.used, 0)}점만 쓰입니다.`, btn('건설', 'nav', { attrs: 'data-view="build"', cls: 'small' }));
    if (E.nextElectionTurn(state) === t + 1) item('soon', '가상 정기 선거', `${left}일 뒤 · 예상 득표 지표 ${num(E.electionExpectation(state, data), 0)}±6, 45 미만이면 권한 이양`);
    if (t >= 40 && t < 45 && !state.flags.won1963) item('soon', '1963년 10월 가상 선거', `당선 확률 약 ${num(E.firstElectionChance(state, data), 0)}%`);
  }
  if (state.report) item('info', `${esc(ym(state.report.turn))} 결산`, `월 수지 ${signed(state.report.finance.balance, 2)}${state.report.borrowed ? ` · 차입 ${num(state.report.borrowed, 1)}` : ''}`, btn('결산 보기', 'report', { cls: 'small' }));
  return `<section><h2>이번 달 업무 <small>${esc(ym(state.turn))}</small></h2><ul class="tasks">${items.join('') || '<li class="task"><div><small>지금 할 일이 없습니다. 시간을 흐르게 하세요.</small></div></li>'}</ul></section>
  <section><h2>진행 중</h2><ul class="progress" id="agenda-progress">${progressList()}</ul></section>
  <section><h2>권한과 자원</h2><div class="kv"><span>권한</span><b>${esc(PHASE[state.phase].name)}</b></div><div class="kv"><span>행동점수</span><b>${apDots(state.ap)} ${state.ap}</b></div><div class="kv"><span>다음 결산 월 수지</span><b class="delta ${R.finance.balance >= 0 ? 'good' : 'bad'}">${signed(R.finance.balance, 2)}</b></div><div class="kv"><span>건설점 <small>쓰임 / 이번 달</small></span><b>${num(R.construction.used, 0)} / ${num(R.construction.points, 0)}</b></div><div class="kv"><span>종합 지지도</span><b>${num(E.supportAverage(state, data))}</b></div><div class="kv"><span>지역 시책</span><b>${state.edicts.length} / ${E.edictCap(state, data)}</b></div></section>
  <section><h2>최근 기록</h2><ul class="log">${state.log.slice(-4).reverse().map(l => `<li><time>${esc(l.date)} · ${esc(LOG_TYPES[l.type] || l.type)}</time>${esc(l.text)}${l.changes ? fxPlain(l.changes) : ''}</li>`).join('')}</ul>${btn('연대기 전체', 'nav', { attrs: 'data-view="archive"', cls: 'small quiet' })}</section>`;
}
/** 진행 중인 법률 제정과 공사. 하루가 지날 때마다 막대와 남은 날이 바뀐다. */
function progressList() {
  if (state.ending) return '<li class="muted">연대기가 끝났습니다.</li>';
  const frac = (state.day - 1) / E.daysInMonth(state.turn), R = eco(), en = state.enactment;
  let out = '';
  if (en) { const law = lawOf(en.lawId), g = byId('lawGroups', law.group), X = data.economy.enactment; out += `<li>${esc(law.name)} <small>${en.stage + 1}번째 검사까지 ${daysUntilMonthEnd(en.wait)}일 · 지체 ${en.setbacks}/${X.setbacks}</small><div class="bar"><i style="width:${Math.min(100, (en.stage + (g.interval - en.wait + frac) / g.interval) / X.stages * 100)}%"></i></div></li>`; }
  out += state.construction.map((q, i) => { const def = bdef(q.id), gain = R.construction.gains[i], left = monthsLeft(q, gain); return `<li>${esc(byId('regions', q.regionId).name)} ${esc(def.name)}${q.private ? ' <small>민간</small>' : ''} <small>${num(q.progress, 0)}/${def.cost}점${left ? ` · 약 ${left}개월` : ' · 대기'}</small><div class="bar green"><i style="width:${Math.min(100, (q.progress + gain * frac) / def.cost * 100)}%"></i></div></li>`; }).join('');
  return out || '<li class="muted">진행 중인 법률·공사가 없습니다.</li>';
}
/** 하단 연대기 막대: 최근 기록 세 건. */
function ticker() {
  return `<div class="ticker" aria-label="최근 연대기"><span class="ticker-label">연대기</span><p data-clip-x>${state.log.slice(-3).reverse().map(l => `<span><time>${esc(l.date)}</time> ${esc(l.text)}</span>`).join('')}</p>${btn('전체', 'nav', { attrs: 'data-view="archive"', cls: 'small quiet' })}</div>`;
}

/* ---------- 모달 ---------- */
function modal() {
  const m = ui.modal; if (!m) return '';
  let title = '', body = '', actions = '', wide = false;
  if (m.type === 'confirm') ({ title, body, actions } = confirmContent(m));
  else if (m.type === 'report') ({ title, body, actions } = reportContent()), wide = true;
  else if (m.type === 'metric') ({ title, body, actions } = metricContent(m.id));
  else if (m.type === 'help') ({ title, body, actions } = helpContent()), wide = true;
  else if (m.type === 'newgame') ({ title, body, actions } = newGameContent());
  else if (m.type === 'import') ({ title, body, actions } = importContent(m));
  else if (m.type === 'exportText') ({ title, body, actions } = exportTextContent(m));
  else if (m.type === 'pasteImport') ({ title, body, actions } = pasteImportContent(m));
  return `<div class="modal-back" data-action="modalBack"><section class="paper modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><h2 id="modal-title">${title}</h2>${body}<div class="actions">${actions}</div></section></div>`;
}
const closeBtn = (label = '닫기') => `<button type="button" class="btn quiet" data-action="closeModal" style="color:var(--paper-ink);border-color:var(--paper-line)">${label}</button>`;
function confirmContent(m) {
  const a = m.action, R = eco(), f = R.finance, X = data.economy;
  let title = '', body = '', go = '확정';
  const costLine = (cost, ap = 1) => `<table><tbody>${cost ? `<tr><td>국고</td><td class="n">${num(state.stats.treasury, 1)} → ${num(state.stats.treasury - cost, 1)} (−${num(cost, 0)})</td></tr>` : ''}${ap ? `<tr><td>행동점수</td><td class="n">${state.ap} → ${state.ap - ap}</td></tr>` : '<tr><td>행동점수</td><td class="n">쓰지 않음</td></tr>'}</tbody></table>`;
  const site = () => { const def = bdef(a.id), r = byId('regions', a.regionId), b = E.econ.findBuilding(state, a.id, a.regionId); return { def, r, b }; };
  if (a.type === 'policy') {
    const p = byId('policies', a.id); title = `정책 시행: ${esc(p.name)}`; go = '시행한다';
    body = `<p>${esc(p.description)}</p>${costLine(p.cost)}<h3>즉시 효과</h3>${fxProjected(p.effects)}${factionList(p.factionEffects)}
    <h3>다음 달부터 매월</h3>${fxPlain(p.monthlyEffects)}${dimNote()}<p style="font-size:14px">유지비 ${num(p.monthlyCost, 2)} → 월 수지 ${signed(f.balance, 2)} → ${signed(f.balance - p.monthlyCost, 2)}${f.balance - p.monthlyCost < 0 && f.balance >= 0 ? ' <b>(적자로 바뀝니다)</b>' : ''}</p>`;
  } else if (a.type === 'build') {
    const { def, r, b } = site(), C = R.construction, pm = def.pm[b?.pm || 0], market = !def.gov && !def.construction, p = market ? E.econ.prospect(state, data, R, def, r.id) : null, mine = state.construction.filter(q => !q.private).length, wants = wantedBy(def.id);
    title = `착공: ${esc(r.name)} · ${esc(def.name)}`; go = '대기열에 올린다';
    body = `<p>${esc(def.description)}</p>${costLine(0)}
    <h3>공사</h3><p style="font-size:14px">건설점 <b>${def.cost}</b>. 한 건은 한 달에 ${X.maxPerProject}점까지 진행하므로 빨라야 ${Math.ceil(def.cost / X.maxPerProject)}개월이고, 앞선 공사가 있거나 건설점이 모자라면 더 걸립니다(이번 달 건설점 ${num(C.points, 1)}, 정부 대기열 ${mine}건 → ${mine + 1}건). 착공에는 돈이 들지 않고 진행한 점수만큼 자재값(지금 ${num(C.costPerPoint, 3)}/점)이 달마다 나갑니다. 끝까지 약 <b>${num(def.cost * C.costPerPoint, 1)}</b> 재정점.</p>
    <h3>준공되면 (한 단계·한 달 · ${esc(pm.name)})</h3><div class="b-io"><span>${goodList(pm.in)}</span><span aria-hidden="true">→</span><span>${pm.points ? `<span class="gchip">건설점 <b>${pm.points}</b></span>` : goodList(pm.out)}</span></div>
    <p style="font-size:14px">일자리 ${esc(jobsText(pm.jobs))} · ${OWNER[def.owner]}${p ? ` · 예상 월 이익 <b>${signed(p.profit, 2)}</b>(지금 가격에 늘어날 공급을 반영)` : def.gov ? ' · 인건비와 물자는 매월 국고에서 나갑니다' : ''}. 준공하면 ${esc(r.name)}의 개발도 +${def.development || 1}.</p>
    ${def.monthlyEffects ? `<h3>매월(단계마다)</h3>${fxPlain(def.monthlyEffects)}${dimNote()}` : ''}
    ${wants.length ? `<h3>이 건물을 바라는 이해집단</h3><div class="wants">${wants.map(w => `<span class="igchip ${w.met ? 'met' : 'unmet'}">${esc(w.ig.mark)} ${esc(w.ig.name)} · ${esc(w.text)} ${w.have}/${w.need}</span>`).join('')}</div>` : ''}`;
  } else if (a.type === 'cancelBuild') {
    const q = state.construction[a.index]; title = `공사 취소: ${esc(byId('regions', q.regionId).name)} · ${esc(bdef(q.id).name)}`; go = '취소한다';
    body = `<p>행동점수를 쓰지 않습니다. 이미 진행한 ${num(q.progress, 0)}점과 그 자재값은 돌아오지 않습니다.</p>`;
  } else if (a.type === 'privatize') {
    const { def, r, b } = site(), price = E.privatizePrice(state, data, a.id, a.regionId); title = `민영화: ${esc(r.name)} · ${esc(def.name)}`; go = '넘긴다';
    body = `<p>국영 ${b.state}단계를 민간에 넘깁니다. 매각 대금은 민간 투자기금에서 나옵니다. 그 뒤의 이익은 배당과 이익세로, 손실은 소유자의 몫이 됩니다.</p><table><tbody><tr><td>국고</td><td class="n">${num(state.stats.treasury, 1)} → ${num(state.stats.treasury + price, 1)} (+${num(price, 1)})</td></tr><tr><td>투자기금</td><td class="n">${num(state.econ.pool, 1)} → ${num(state.econ.pool - price, 1)}</td></tr><tr><td>행동점수</td><td class="n">${state.ap} → ${state.ap - 1}</td></tr></tbody></table>${factionList({ business: 2, workers: -1 })}`;
  } else if (a.type === 'downsize') {
    const { def, r, b } = site(); title = `축소: ${esc(r.name)} · ${esc(def.name)}`; go = '한 단계 줄인다';
    body = `<p>국영 한 단계를 줄입니다(${b.level}단계 → ${b.level - 1}단계). 행동점수를 쓰지 않습니다. 이 단계의 인건비와 물자 비용이 다음 결산부터 사라지고, 일하던 사람은 다른 일자리를 찾아야 합니다. 지은 건설점은 돌아오지 않습니다.</p>${def.monthlyEffects ? `<h3>사라지는 매월 효과</h3>${fxPlain(def.monthlyEffects)}` : ''}`;
  } else if (a.type === 'enact') {
    const law = lawOf(a.id), g = byId('lawGroups', law.group), cur = lawOf(state.laws[g.id]), c = E.lawChanceParts(state, data, law.id), N = X.enactment;
    const net = {}; for (const [k, v] of Object.entries(law.effects)) net[k] = v; for (const [k, v] of Object.entries(cur.effects)) net[k] = (net[k] || 0) - v;
    const moves = Object.fromEntries(data.interestGroups.map(ig => [ig.id, E.lawPreference(state, data, law.id, ig.id)]).filter(([, v]) => v !== 0).map(([id, v]) => [id, Math.sign(v) * X.approval.reform * Math.min(2, Math.abs(v)) / 2]));
    title = `법률 발의: ${esc(law.name)}`; go = '발의한다';
    body = `<p>${esc(law.description)}</p><p style="font-size:14px">${esc(g.name)} 분류의 현행 법 <b>${esc(cur.name)}</b>을(를) 대신합니다.</p>${costLine(law.cost)}
    <h3>제정 절차</h3><p style="font-size:14px">${g.interval}개월마다 검사하고 세 번 통과해야 제정됩니다(빨라야 ${g.interval * N.stages}개월, ${E.dateLabel(Math.min(239, state.turn + g.interval * N.stages - 1))} 말). 통과하지 못하면 절반은 논쟁(다음 확률 +${Math.round(N.debate * 100)}%p), 절반은 지체이고 지체 세 번이면 폐기됩니다. 시행비는 돌려받지 않습니다.${state.phase === 'transition' ? ` 과도 통치의 의결이라 제정될 때 자유 ${N.decreeCost.liberty}, 정당성 ${N.decreeCost.legitimacy}.` : ''}</p>
    <table class="parts"><thead><tr><th>지금 검사한다면</th><th>확률 기여</th></tr></thead><tbody>${c.parts.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${signed(v * 100, 1)}%p</td></tr>`).join('')}<tr><th>통과 확률</th><th>${num(c.chance * 100, 0)}%</th></tr></tbody></table>
    ${Object.values(net).some(v => v) ? `<h3>제정되면 한 번 <small>현행 법의 효과를 거두고 새 법의 효과를 더한 값</small></h3>${fxProjected(Object.fromEntries(Object.entries(net).filter(([, v]) => v)))}` : ''}
    ${Object.keys(law.monthlyEffects).length ? `<h3>시행하는 동안 매월</h3>${fxPlain(law.monthlyEffects)}${dimNote()}` : ''}<p style="font-size:14px">월 유지비 ${num(cur.monthlyCost, 2)} → ${num(law.monthlyCost, 2)}</p>
    ${Object.keys(moves).length ? `<h3>제정되면 이해집단 지지도</h3>${factionList(moves)}<p class="muted" style="font-size:13px">이 변화는 매월 조금씩 사라지고, 그 뒤에는 새 법에 대한 태도가 지지도에 계속 반영됩니다.</p>` : ''}`;
  } else if (a.type === 'cancelEnact') {
    const law = lawOf(state.enactment.lawId); title = `제정 거두기: ${esc(law.name)}`; go = '거둔다';
    body = `<p>행동점수를 쓰지 않습니다. 통과한 단계 ${state.enactment.stage}개와 시행비 ${law.cost} 재정점은 돌아오지 않습니다. 거둔 뒤에는 다른 법을 발의할 수 있습니다.</p>`;
  } else if (a.type === 'coalition') {
    const g = igOf(a.id), inGov = state.government.includes(g.id), A = X.approval, G = X.government, after = E.governmentClout(state) + (inGov ? -1 : 1) * state.ig[g.id].clout;
    title = `집권 연합: ${esc(g.name)} ${inGov ? '빼기' : '넣기'}`; go = inGov ? '뺀다' : '넣는다';
    body = `<p>${esc(g.description)}</p>${costLine(0)}<table><tbody><tr><td>연합의 세력</td><td class="n">${num(E.governmentClout(state) * 100, 0)}% → ${num(after * 100, 0)}%</td></tr><tr><td>정당성 매월</td><td class="n">${signed(E.coalitionLegitimacy(state, data), 3)} → ${signed(Math.max(-G.legitimacyCap, Math.min(G.legitimacyCap, (after - G.center) * G.legitimacy)), 3)}</td></tr></tbody></table>
    <p style="font-size:14px">${inGov ? `빼면 ${esc(g.name)}의 지지도가 바로 ${A.dismissed} 내려가고, 연합 밖 집단의 보정(${A.outGov})을 받습니다. 이 집단이 바라던 법은 연합 안의 지지를 잃습니다.` : `넣으면 ${esc(g.name)}의 지지도가 향하는 값이 ${A.inGov - A.outGov}만큼 오르고, 이 집단이 바라는 법을 발의할 수 있게 됩니다. 이 집단이 꺼리는 법은 통과하기 어려워집니다.`}</p>`;
  } else if (a.type === 'edict') {
    const e = byId('edicts', a.id), r = byId('regions', a.regionId); title = `지역 시책: ${esc(r.name)} · ${esc(e.name)}`; go = '시행한다';
    body = `<p>${esc(e.description)}</p>${costLine(e.cost)}${e.factionEffects ? `<h3>즉시</h3>${factionList(e.factionEffects)}` : ''}<h3>다음 결산부터 매월</h3>${fxPlain(e.monthlyEffects)}${dimNote()}<p style="font-size:14px">유지비 ${num(e.monthlyCost, 2)} → 월 수지 ${signed(f.balance, 2)} → ${signed(f.balance - e.monthlyCost, 2)}${e.constructionBonus ? `<br>시행하는 동안 ${esc(r.name)}의 공사가 ${Math.round(e.constructionBonus * 100)}% 빨리 진행됩니다.` : ''}</p><p style="font-size:13px" class="muted">권역마다 시책은 하나입니다(지금 전국 ${state.edicts.length} / ${E.edictCap(state, data)}개). 거두면 다음 결산부터 효과와 유지비가 멈추고, 시행비는 돌려받지 않습니다. 국정 집행 권한이 없는 단계에서는 매월 효과가 멈추고 유지비만 나갑니다.</p>`;
  } else if (a.type === 'revokeEdict') {
    const cur = E.regionEdict(state, a.regionId), e = cur ? byId('edicts', cur.edictId) : null, r = byId('regions', a.regionId), mc = e ? e.monthlyCost : 0;
    title = `시책 거두기: ${esc(r.name)}${e ? ` · ${esc(e.name)}` : ''}`; go = '거둔다';
    body = `<p>행동점수를 쓰지 않습니다. 다음 결산부터 아래 매월 효과와 유지비 ${num(mc, 2)}가 사라집니다. 이미 생긴 변화와 시행비는 돌아오지 않습니다.</p>${e ? fxPlain(e.monthlyEffects) : ''}<p style="font-size:14px">월 수지 ${signed(f.balance, 2)} → ${signed(f.balance + mc, 2)}${e && e.constructionBonus ? ` · ${esc(r.name)}의 공사 가속 종료` : ''}</p>`;
  } else if (a.type === 'diplomacy') {
    const n = byId('countries', a.countryId), o = E.DIPLOMACY_MODES[a.mode]; title = `외교: ${esc(n.name)} · ${esc(o.label)}`; go = '진행한다';
    body = `${costLine(o.cost)}<h3>즉시 효과</h3>${relationList({ [n.id]: o.relation })}${fxProjected(o.effects)}<p style="font-size:13px" class="muted">같은 상대와는 이번 달에 더 이상 외교 행동을 할 수 없게 됩니다. 미국·일본·서유럽·비동맹권과의 관계 평균이 높을수록 무역 역량과 수출 한도가 조금 커집니다.</p>`;
  } else if (a.type === 'adviser') {
    const ad = byId('advisers', a.id), on = state.advisers.includes(ad.id); title = `${on ? '해임' : '임명'}: ${esc(ad.name)} (가상 인물 · ${esc(ad.role)})`; go = on ? '해임한다' : '임명한다';
    body = on ? `<p>해임하면 다음 달부터 아래 지속 효과와 유지비 0.15가 사라집니다. 이미 생긴 변화는 되돌아가지 않습니다.</p><table><tbody><tr><td>행동점수</td><td class="n">${state.ap} → ${state.ap - 1}</td></tr></tbody></table>${fxPlain(ad.monthlyEffects)}`
      : `${costLine(ad.cost)}<h3>매월 지속 효과</h3>${fxPlain(ad.monthlyEffects)}${dimNote()}<p style="font-size:14px">유지비 0.15 → 월 수지 ${signed(f.balance, 2)} → ${signed(f.balance - .15, 2)}</p>`;
  } else if (a.type === 'repay') {
    title = `부채 ${a.amount} 상환`; go = '상환한다';
    body = `${costLine(a.amount)}<table><tbody><tr><td>부채</td><td class="n">${num(state.stats.debt, 1)} → ${num(state.stats.debt - a.amount, 1)}</td></tr><tr><td>월 이자</td><td class="n">${num(f.interest, 2)} → ${num((state.stats.debt - a.amount) * X.interest, 2)}</td></tr></tbody></table>`;
  } else if (a.type === 'choose') {
    const e = byId('events', state.queue[0]), c = e.choices.find(x => x.id === a.choiceId);
    title = `연대기를 마칩니다: ${esc(byId('endings', c.ending).title)}`; go = '이 선택으로 마친다';
    body = `<p><strong>${esc(c.label)}</strong></p><p>이 선택을 하면 캠페인이 끝나고 더 이상 행동할 수 없습니다. 저장 파일을 먼저 내보내면 이 시점부터 다시 할 수 있습니다.</p>`;
  }
  const reason = E.actionReason(state, data, a);
  return { title, body: body + reasonLine(reason), actions: closeBtn('취소') + `<button type="button" class="btn primary" data-action="confirm" data-autofocus ${reason ? 'disabled' : ''}>${go}</button>` };
}
function reportContent() {
  const r = state.report; if (!r) return { title: '결산 없음', body: '<p>아직 지난 월의 결산이 없습니다.</p>', actions: closeBtn() };
  const fin = r.finance, mk = r.market;
  const changes = Object.entries(r.changes).filter(([k]) => metric(k)).sort((a, b) => Math.abs(b[1]) / (metric(b[0]).max > 1000 ? 100 : 1) - Math.abs(a[1]) / (metric(a[0]).max > 1000 ? 100 : 1));
  const events = [], where = x => `${esc(byId('regions', x.regionId).name)} ${esc(byId('buildings', x.buildingId).name)}`;
  for (const x of r.completed) events.push(`준공 · ${where(x)}${x.private ? ' <small>(민간 투자)</small>' : ''}`);
  if (r.started) events.push(`민간 착공 · ${where(r.started)} <small>(투자기금)</small>`);
  for (const x of r.laws) events.push(`법률 · ${esc(byId('laws', x.lawId).name)}: <b>${LAW_RESULT[x.result]}</b> (검사 통과 확률 ${num(x.chance * 100, 0)}%)${x.result === 'enacted' ? fxPlain(byId('laws', x.lawId).effects) : ''}`);
  for (const x of r.followups) events.push(`지연 효과 · ${esc(x.text)} ${fxPlain(x.effects)}`);
  if (r.election) events.push(`가상 정기 선거 · 득표 지표 <b>${num(r.election.share, 1)}</b> (45 미만이면 이양) → ${r.election.transfer ? '권한 이양' : `의석 점유 ${num(r.election.seats * 100, 0)}%`}. 실제 득표율이 아님.`);
  if (r.borrowed) events.push(`재정 · 국고 부족분 <b>${num(r.borrowed, 1)}</b>을 부채로 조달`);
  const support = Object.entries(r.support).filter(([, v]) => Math.abs(v) >= .05);
  const next = r.events.map(id => byId('events', id)?.title).filter(Boolean);
  const body = `<p class="muted" style="font-size:13px">${esc(ym(r.turn))}의 월말 처리: 시장(주문·가격·교역) → 세입·지출·이자 → 지표 추세 → 정책·법률·자문 지속 효과 → 충원·건설 진행·준공 → 법률 제정 검사 → 지연 효과 → 이해집단 지지도 → 선거·엔딩 판정.</p>
  <h3>재정</h3><table><tbody><tr><td>세입</td><td class="n">${num(fin.income, 2)}</td></tr><tr><td>기본 지출</td><td class="n">${minus(fin.base)}</td></tr><tr><td>이자</td><td class="n">${minus(fin.interest)}</td></tr><tr><td>인건비·물자·건설 자재·보조·유지비</td><td class="n">${minus(fin.upkeep)}</td></tr><tr><th>월 수지</th><th class="n"><span class="delta ${fin.balance >= 0 ? 'good' : 'bad'}">${arrow(fin.balance)} ${signed(fin.balance, 2)}</span></th></tr></tbody></table>
  ${mk ? `<h3>시장</h3><table><tbody><tr><td>GDP <small>연율, 이번 달 기준</small> · 1인당 GNP</td><td class="n">${usd(acc().gdp.usd)} · ${num(acc().gnp.perCapita, 0)}달러</td></tr><tr><td>생산 지수 · 실업률</td><td class="n">${num(mk.gdp, 1)} · ${num(mk.unemployment, 1)}%</td></tr><tr><td>물가 지수 <small>1960년 가계 소비 기준 100</small></td><td class="n">${num(mk.cpi * 100, 0)}</td></tr><tr><td>수출 · 수입</td><td class="n">${num(mk.exports, 1)} · ${num(mk.imports, 1)}</td></tr><tr><td>건설점 쓰임 / 만든 양</td><td class="n">${num(mk.used, 1)} / ${num(mk.points, 1)}</td></tr><tr><td>민간 투자기금</td><td class="n">${num(mk.pool, 1)}</td></tr></tbody></table>` : ''}
  ${events.length ? `<h3>이번 달에 일어난 일</h3><ul class="stack" style="font-size:14px">${events.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
  <h3>지표 변화와 원인 <small>(항목을 누르면 원인별 기여)</small></h3>${changes.map(([k, v]) => `<details><summary><span>${esc(mlabel(k))}</span><span class="delta ${tone(k, v)}">${arrow(v)} ${signed(v, Math.abs(v) < .1 ? 3 : 2)}</span><small>${num(state.stats[k], digits(k))}</small></summary><ul>${(r.ledger[k] || []).map(([src, dv]) => `<li><span>${esc(src)}</span><span>${signed(dv, 3)}</span></li>`).join('')}</ul></details>`).join('') || '<p>변화 없음</p>'}
  ${support.length ? `<h3>이해집단의 지지 변화</h3><ul class="fx">${support.map(([id, v]) => `<li class="${v >= 0 ? 'good' : 'bad'}"><span>${esc(byId('interestGroups', id).name)}</span><b>${arrow(v)} ${signed(v, 1)}</b><small>${num(state.support[id], 0)}</small></li>`).join('')}</ul>` : ''}
  <h3>${state.ending ? '연대기 종료' : `${esc(ym(state.turn))} 시작`}</h3><p style="font-size:14px">${state.ending ? `<b>${esc(state.ending.title)}</b> — 상황판에서 엔딩 평가를 확인하세요.` : next.length ? `결정할 사건: <b>${next.map(esc).join(', ')}</b>` : '이번 달에는 정해진 사건이 없습니다.'} 행동점수 3을 회복했습니다.</p>`;
  return { title: `${esc(ym(r.turn))} 결산`, body, actions: `<button type="button" class="btn primary" data-action="closeModal" data-autofocus>${state.ending ? '엔딩 평가 보기' : `${esc(ym(state.turn))} 업무 시작`}</button>` };
}
function metricContent(id) {
  const m = metric(id), rows = state.report?.ledger?.[id] || [], change = state.report?.changes?.[id] || 0;
  return { title: `${esc(m.label)} <small>${esc(m.unit)}</small>`, body: `<p style="font-size:28px;font-family:var(--display)">${num(state.stats[id], digits(id))}</p><p>${esc(m.description)}</p><h3>무엇이 움직이나</h3><p style="font-size:14px">${esc(metricHelp(id))}</p><p style="font-size:13px" class="muted">범위 ${m.min}~${m.max} · ${m.higherIsBetter ? '높을수록 좋음' : '낮을수록 좋음'}</p>
  ${state.report ? `<h3>지난달(${esc(state.report.date)}) 변화 ${signed(change, 3)}</h3><table><tbody>${rows.map(([src, v]) => `<tr><td>${esc(src)}</td><td class="n">${signed(v, 3)}</td></tr>`).join('') || '<tr><td>변화 없음</td><td></td></tr>'}</tbody></table>` : '<p class="muted">첫 결산 뒤부터 월별 변화 원인을 보여 줍니다.</p>'}`, actions: closeBtn() };
}
function helpContent() {
  const X = data.economy, A = X.approval, th = A.thresholds;
  return { title: '게임 방법', body: `<p>1960년 1월 1일부터 1979년 12월 31일까지 시간이 하루씩 흐릅니다(한 틱 = 하루). 나라의 경제와 지표는 매달 말일에 한 번 결산합니다(240번). 플레이어는 박정희라는 역사적 출발점에 있지만, 1960년에는 대통령 권한이 없습니다.</p>
  <h3>시간</h3><p style="font-size:14px">위쪽 시계의 <b>진행</b>(스페이스)으로 시간을 흐르게 하고 다시 누르면 멈춥니다. 배속은 ×1(하루 0.7초)·×2·×4·×8이며 숫자 키 1~4로도 바꿉니다. 매달 1일에 사건이 오면 시계가 스스로 멈추고, 결정하면 다시 흐릅니다. <b>건너뛰기</b>는 이번 달 남은 날을 넘겨 바로 결산하고 결산 창을 엽니다.</p>
  <h3>한 달에 하는 일</h3><ol class="steps"><li><span>1일에 온 사건 문서에서 선택지 하나를 고릅니다. 선택은 행동점수를 쓰지 않습니다.</span></li><li><span>행동점수 3을 건물 착공·법률 발의·집권 연합·정책·외교·자문·상환에 씁니다. 생산방식 변경, 보조금, 대기열 순서, 예산 배분은 행동점수를 쓰지 않습니다.</span></li><li><span>말일이 지나면 결산합니다. '이번 달 업무'의 <b>결산 보기</b>로 무엇이 얼마나, 왜 바뀌었는지 확인하세요.</span></li></ol>
  <h3>경제 지표</h3><p style="font-size:14px">GDP·GNP·PPP·1인당 국민소득·실질 성장률·물가·환율·수출입·외환보유액·재정 비율·산업 구조·노동 인원을 원·달러 금액과 인원으로 보여 줍니다. 1960년 1월 값만 실제 규모(1인당 국민소득 ${data.accounts.gnpPerCapita}달러, 환율 ${data.accounts.exchangeRate}원, 인구총조사)에 맞췄고, 그 뒤는 이 게임의 결과입니다. 실제 통계와 비교하는 값이 아닙니다.</p>
  <h3>시장</h3><p style="font-size:14px">상품 ${data.goods.length}종마다 <b>판매 주문</b>(건물의 산출·자급 농가·수입)과 <b>구매 주문</b>(가계·건물의 투입·정부·건설·수출)이 있습니다. 구매가 판매보다 많으면 가격이 오르고 적으면 내립니다(기준가격의 ${pctS(X.price.floor)}~${pctS(X.price.ceiling)}). 국내 가격이 세계 가격에 관세를 더한 값보다 비싸면 수입이 들어오고, 세계 가격보다 싸면 수출이 나갑니다. 교역은 무역 역량(항만) 안에서만 이루어지고, 외환 보유가 바닥나면 수입이 줄어듭니다. 구매가 판매의 ${X.shortageAt}배를 넘으면 <b>공급 부족</b>이 되어 그 상품을 쓰는 건물의 생산이 깎입니다.</p>
  <h3>건물과 건설</h3><p style="font-size:14px">건물은 단계마다 사람을 쓰고 투입재를 사서 상품을 냅니다. 이익이 나면 사람을 채우고 손실이면 줄입니다. <b>생산방식</b>을 올리면 같은 사람으로 더 만들지만 새 투입재가 들고, 산업·농업 기술 지수나 연도 조건이 있습니다. 건설은 <b>건설점</b>으로 합니다: 건설 부문이 달마다 건설점을 만들고, 대기열의 공사가 그 점수를 나눠 씁니다(한 건에 한 달 ${X.maxPerProject}점까지). 착공에는 돈이 들지 않고 진행한 만큼 자재값이 나갑니다. 건설점의 일부는 <b>민간 투자</b> 몫이라, 기업가·지주의 배당에서 쌓인 투자기금이 이익이 날 건물을 스스로 짓습니다. 지형·자원이 있어야 짓는 건물(탄광·항만·댐 등)이 있고, 권역의 기반 시설 용량을 넘겨 지으면 그 권역의 생산이 깎입니다.</p>
  <h3>법률</h3><p style="font-size:14px">분류 ${data.lawGroups.length}개마다 한 법만 유효합니다. 새 법은 <b>집권 연합</b> 안에 그 법을 현행 법보다 바라는 집단이 있어야 발의할 수 있습니다(연합 밖 여론이 세력의 ${Math.round(X.enactment.massDemand * 100)}%를 넘어도 됩니다). 정해진 달마다 검사를 받아 세 번 통과하면 제정되고, 통과하지 못하면 논쟁이나 지체가 되며 지체 세 번이면 폐기됩니다. 확률은 연합 안의 지지·반대 세력, 연합 밖 여론, 정당성, 가상 의석이 정합니다. 한 번에 한 법만 다룹니다.</p>
  <h3>이해집단</h3><p style="font-size:14px">노동자·농민·소시민·기업가·지주·군대는 바라는 법과 건물이 다릅니다. <b>지지도</b>는 현행 법률에 대한 태도, 요구한 건물이 지어졌는지, 생활수준, 집권 연합에 들었는지로 정해집니다. ${th.unhappy} 아래면 불만, ${th.angry} 아래면 분노로 경제에 부담이 되는 특성이 켜지고, ${th.happy} 이상이면 만족, ${th.loyal} 이상이면 충성으로 보탬이 되는 특성이 켜집니다. <b>세력</b>(인구 × 집단별 무게 × 법률)은 법률 제정에, <b>투표 비중</b>(인구)은 선거에 쓰입니다. 요구 수준은 1964년부터 해마다 오릅니다.</p>
  <h3>권한의 단계</h3><p style="font-size:14px">관찰·준비(1960~61) → 1961년 5월 경로 분기(헌정: 민간 정치 준비 / 군정: 과도 통치, 대신 자유·정당성 비용) → 1963년 10월 가상 선거 → 12월 취임 → 국정 운영. 1967년 11월부터 48개월마다 가상 정기 선거가 있고, 득표 지표(종합 지지도 65% + 정당성 35%)가 45 미만이면 권한을 평화롭게 넘깁니다. 장기 집권 분기를 고르면 선거가 중단되는 대신 매월 자유와 정당성을 잃고 소시민·노동자의 지지와 국제기구 관계가 꾸준히 떨어집니다.</p>
  ${data.balance ? `<h3>높은 지표를 지키는 법</h3><p style="font-size:14px">지표가 ${data.balance.diminishing ? data.balance.diminishing.from : 60}을 넘으면 같은 효과도 덜 오르고(체감), 정당성·생활·자유·분배·안정·행정은 매월 기대 수준만큼 조금씩 내려갑니다. 교육·기반 시설·산업·농업·안보 지수는 매월 조금씩 닳아(감가) 건물과 정책으로 유지해야 합니다.</p>` : ''}
  <h3>권역과 지역 시책</h3><p style="font-size:14px">권역마다 지형과 자원이 다르고, 지도의 <b>지형·자원</b> 색 기준에서 볼 수 있습니다. <b>지역 시책</b>은 권역마다 하나씩 거는 지속 명령으로, 시행비와 AP 1을 쓰고 매월 효과와 유지비가 붙습니다. 일부 시책은 그 권역의 공사를 빠르게 합니다.</p>
  <h3>끝나는 방식</h3><p style="font-size:14px">부채 700 이상, 정당성 3 이하, 자유 3 이하는 즉시 위기 엔딩입니다. 그 밖에는 1979년 12월에 지표로 평가합니다. 엔딩 화면은 성장·권리·생활·환경을 따로 보여 줍니다.</p>
  <h3>역사와 가상</h3><p style="font-size:14px">'실제 역사' 상자는 출처가 있는 사실 요약입니다. '이 캠페인에서는' 상자와 모든 선택 결과·수치·시장·선거·자문위원은 가상입니다. 군사정변과 정치 폭력은 헌정적 결과와 제도적 비용으로만 다루고, 군대는 제도적 요구를 가진 이해집단으로만 다룹니다.</p>`, actions: closeBtn('알겠습니다') };
}
function exportTextContent(m) {
  return { title: '저장 텍스트', body: `<p>아래 텍스트가 지금 진행(${esc(ym(state.turn))})의 저장 내용입니다. 복사해 메모나 .json 파일로 보관했다가 기록실의 ‘저장 텍스트 붙여넣기’나 ‘저장 파일 불러오기’로 이어 할 수 있습니다.</p>
  <label for="save-text" class="sr-only">저장 텍스트</label><textarea id="save-text" class="save-text" readonly spellcheck="false">${esc(JSON.stringify(JSON.parse(E.exportSave(state))))}</textarea>
  ${m.copied === true ? '<p class="note-ok" role="status">복사했습니다.</p>' : m.copied === false ? '<p class="reason" role="status">자동 복사가 막혀 텍스트 전체를 선택했습니다. Ctrl+C(⌘C)로 복사하세요.</p>' : ''}`,
    actions: closeBtn() + `<button type="button" class="btn primary" data-action="copySave" data-autofocus>복사</button>` };
}
function pasteImportContent(m) {
  return { title: '저장 텍스트 붙여넣기', body: `<p>‘저장 텍스트 복사’로 받아 둔 텍스트(또는 저장 파일의 내용)를 붙여 넣으세요. 확인한 뒤에만 현재 진행을 바꿉니다.</p>
  <label for="paste-text" class="sr-only">붙여 넣을 저장 텍스트</label><textarea id="paste-text" class="save-text" spellcheck="false" placeholder='{"format": "KOREA1960_SAVE", ...}' data-autofocus>${esc(m.text || '')}</textarea>${m.error ? `<p class="reason" role="alert">불러오지 못했습니다: ${esc(m.error)}</p>` : ''}`,
    actions: closeBtn('취소') + `<button type="button" class="btn primary" data-action="importText">확인</button>` };
}
function newGameContent() {
  return { title: '새 연대기 시작', body: `<p>${state && !state.ending ? '진행 중인 연대기가 있습니다. 새로 시작하면 자동 저장이 새 게임으로 바뀝니다. 필요하면 먼저 저장 파일을 내보내세요.' : '1960년 1월부터 시작합니다.'}</p>
  <label for="seed-input"><h3>시드 (선택)</h3></label><input type="text" id="seed-input" inputmode="numeric" placeholder="비워 두면 무작위" maxlength="10" pattern="[0-9]*"><p style="font-size:13px" class="muted">같은 시드와 같은 선택은 같은 사건·선거·표결 결과를 만듭니다. 1~4294967295.</p>`,
    actions: closeBtn('취소') + (state && !state.ending ? btn('먼저 저장 내보내기', 'export') : '') + `<button type="button" class="btn primary" data-action="startNew" data-autofocus>1960년 1월 시작</button>` };
}
function importContent(m) {
  const s = m.loaded;
  return { title: '저장 파일 불러오기', body: `<p><strong>${esc(m.name)}</strong></p><table><tbody><tr><td>시점</td><td class="n">${esc(ym(s.turn))}${s.ending ? ' · 종료됨' : ''}</td></tr><tr><td>권한</td><td class="n">${esc(PHASE[s.phase].name)}</td></tr><tr><td>시행 정책 · 건물 단계 · 제정한 법률</td><td class="n">${s.policies.length} · ${s.buildings.reduce((a, b) => a + b.level, 0)} · ${s.counters.lawsEnacted}</td></tr><tr><td>저장 형식</td><td class="n">버전 ${E.SAVE_VERSION} · 데이터 ${esc(s.dataVersion)}</td></tr></tbody></table><p style="margin-top:10px">현재 진행을 이 파일의 상태로 바꿀까요?</p>`, actions: closeBtn('취소') + `<button type="button" class="btn primary" data-action="acceptImport" data-autofocus>불러오기</button>` };
}

/* ---------- 타이틀 ---------- */
function title() {
  const auto = state;
  return `<main class="title-screen" style="--cover:url('${art('cover')}')"><div class="title-card"><span class="kicker">THE REPUBLIC · 1960–1979</span><h1>대한민국<br>1960</h1><p class="sub">선택의 연대기</p>
  <p>시간은 하루씩 흐르고, 매달 1일에 사건이 옵니다. 결정하고 행동점수 셋을 쓰는 동안 법안과 공사가 날마다 진행됩니다. 권력에 이르는 길과 그 비용, 성장과 권리, 생활과 환경이 서로 다른 장부에 기록됩니다.</p>
  <div class="title-actions">${auto ? `<button type="button" class="btn primary" data-action="continue" data-autofocus>이어하기 <small>${esc(ym(auto.turn))} · ${esc(auto.ending ? '종료됨' : PHASE[auto.phase].name)}</small></button>` : ''}
  <button type="button" class="btn ${auto ? '' : 'primary'}" data-action="newgame" ${auto ? '' : 'data-autofocus'}>새 연대기 시작</button>
  <label class="btn file-btn">저장 파일 불러오기<input type="file" accept="application/json,.json" data-input="import" aria-label="저장 파일 불러오기"></label>
  <button type="button" class="btn quiet" data-action="help">게임 방법</button></div>
  ${storageNote ? `<p class="reason">${esc(storageNote)}</p>` : ''}
  <p class="disclaimer">독자 제작 역사 시뮬레이션. 실제 역사는 출처와 함께 구분해 표시하며, 모든 수치·선택 결과·가상 선거·자문위원은 창작입니다. 삽화는 생성 그림이며 사진이 아닙니다. 오프라인으로 실행되고 진행은 이 브라우저에만 저장됩니다.</p></div></main>${modal()}${toastHtml()}`;
}
function toastHtml() {
  const t = ui.toast; if (!t || (ui.modal && !t.bad)) return '';
  return `<div class="toast ${t.bad ? 'bad' : ''}" role="status"><button type="button" class="btn small quiet" data-action="dismissToast" aria-label="알림 닫기">닫기</button>${esc(t.text)}${t.changes && Object.keys(t.changes).length ? fxPlain(t.changes) : ''}</div>`;
}

/* ---------- 그리기 ---------- */
// innerHTML 교체가 초점 요소의 blur/change를 일으켜 render가 다시 불릴 수 있다. 중첩 호출은 한 번으로 미룬다.
let rendering = false, renderAgain = false;
function render() {
  if (rendering) { renderAgain = true; return; }
  rendering = true;
  try { draw(); } finally { rendering = false; }
  if (renderAgain) { renderAgain = false; render(); }
}
function draw() {
  const focusKey = focusSignature(document.activeElement);
  const scroller = document.scrollingElement, y = scroller ? scroller.scrollTop : 0;
  if (ui.screen === 'title' || !state) { $('#app').innerHTML = title(); afterRender(focusKey); return; }
  const pages = { map: mapView, overview, economy, market, build, laws, groups, policy, budget, diplomacy, cabinet, archive };
  const endReason = E.endMonthReason(state);
  const pending = state.queue.length;
  const navBtn = id => { const t = NAV.find(x => x[0] === id)[1]; return `<button type="button" class="nav" data-action="nav" data-view="${id}" ${ui.view === id ? 'aria-current="page"' : ''}>${icon(NAV_ICON[id] || id)}<span>${t}</span>${id === 'overview' && pending ? `<span class="badge" aria-label="결정할 사건 ${pending}건">${pending}</span>` : ''}</button>`; };
  $('#app').innerHTML = `<div class="shell"><header class="statusbar">
  <div class="identity"><strong>대한민국 1960</strong><small>${esc(state.ending ? '연대기 종료' : PHASE[state.phase].name)} · ${Math.min(state.turn, 240)}/240개월</small></div>
  <div class="stats" data-scroll-x role="group" aria-label="평가 축별 지표">${STAT_GROUPS.map(([name, ids]) => `<div class="stat-group"><span class="stat-axis">${name}</span><div class="stat-row">${ids.map(stat).join('')}</div></div>`).join('')}</div>
  ${clockPanel()}</header>
  <aside class="sidebar"><div class="brand"><span class="kicker">THE REPUBLIC</span><strong>1960</strong><small>선택의 연대기</small></div>
  <nav class="nav-list" aria-label="주 메뉴">${NAV_GROUPS.map(([g, ids]) => `<span class="nav-group">${g}</span>${ids.map(navBtn).join('')}`).join('')}</nav>
  <div class="sidebar-note"><div class="kv"><span>행동점수</span><b>${apDots(state.ap)} ${state.ap}</b></div><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${btn(`${icon('save')} 저장`, 'export', { cls: 'small quiet', title: EMBEDDED ? '저장 텍스트 복사' : '저장 파일(JSON) 내보내기. 진행은 자동 저장도 됩니다.' })}${btn('게임 방법', 'help', { cls: 'small quiet' })}</div><small style="display:block;margin-top:10px">가상 모형 · 오프라인 실행 · 데이터 ${esc(data.meta.version)}</small></div></aside>
  <main class="main ${ui.view === 'map' ? 'map-mode' : ''}" id="main">${storageNote ? `<div class="notice bad">${esc(storageNote)}</div>` : ''}${!['overview', 'map'].includes(ui.view) && pending ? `<div class="notice"><span>결정할 사건 ${pending}건이 남아 있습니다. 결정해야 다른 행동을 하고 시간이 흐릅니다.</span>${btn('사건으로 이동', 'nav', { attrs: 'data-view="overview"', cls: 'small primary' })}</div>` : ''}
  ${pages[ui.view]()}<footer class="foot">실제 역사와 가상 반응을 구분한 독자 제작 게임 · 생성 삽화 · 모든 경제 수치는 가상 모형 값 · 한 틱은 하루, 국정 결산은 매달 말일${endReason && !state.ending ? ` · 지금은 시간이 흐를 수 없음: ${esc(endReason)}` : ''}</footer></main>
  <aside class="brief agenda" aria-label="이번 달 업무">${agenda()}</aside>
  ${ticker()}
  <nav class="bottombar" aria-label="시간과 이번 달 행동">${clockButtons({ compact: true })}<span class="today"><b class="js-date-short">${state.ending ? '종료' : `${E.calendar(Math.min(state.turn, 239)).month}월 ${state.day}일`}</b>${apDots(state.ap)}</span>${primaryAction()}</nav></div>${modal()}${toastHtml()}`;
  const bar = document.querySelector('.statusbar'); if (bar) document.documentElement.style.setProperty('--status-h', `${bar.offsetHeight}px`);
  const tick = document.querySelector('.ticker'); document.documentElement.style.setProperty('--ticker-h', `${tick && tick.offsetParent ? tick.offsetHeight : 0}px`);
  bindMap();
  afterRender(focusKey);
  if (scroller && !ui._scrollTop) scroller.scrollTop = y;
  ui._scrollTop = false;
  bindForms();
}
/** 상단·하단의 주 행동: 사건이 남았으면 사건으로, 끝났으면 엔딩으로, 아니면 다음 달로. */
function primaryAction() {
  if (state.ending) return btn('엔딩 평가 보기', 'nav', { cls: 'primary', attrs: 'data-view="overview"' });
  if (state.queue.length) return btn(`사건 ${state.queue.length}건 결정하기`, 'gotoEvent', { cls: 'primary', title: '이번 달 사건을 결정해야 시간이 흐릅니다.' });
  return btn(`결산까지 건너뛰기 <small style="color:inherit"><span class="js-days">${E.daysInMonth(state.turn) - state.day + 1}</span>일</small>`, 'endMonth', { cls: clock.running ? '' : 'primary', reason: E.endMonthReason(state), title: '이번 달 남은 날을 건너뛰고 월 결산' });
}
function focusSignature(el) {
  if (!el || el === document.body || !el.dataset) return null;
  return ['action', 'id', 'view', 'mode', 'input', 'region', 'pm'].map(k => el.dataset[k] || '').join('|') + '|' + (el.id || '');
}
function afterRender(focusKey) {
  const dialog = document.querySelector('[role="dialog"]');
  if (dialog) { (dialog.querySelector('[data-autofocus]') || dialog).focus(); return; }
  if (ui.focusMain) { ui.focusMain = false; const h = document.querySelector('#main h1, .title-card h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } return; }
  if (!focusKey) return;
  const match = [...document.querySelectorAll('[data-action],[data-input],input[id]')].find(el => focusSignature(el) === focusKey);
  if (match && !match.disabled) match.focus({ preventScroll: true });
}
/* 지도 확대·이동: viewBox만 바꾼다. 원래 범위의 1/4까지 확대, 범위 밖으로 너무 나가지 않게 제한. */
function clampBox([x, y, w, h]) {
  const [, , W, H] = MAP.viewBox; w = Math.min(W, Math.max(W / 4, w)); h = w * H / W;
  return [Math.min(W - w * .5, Math.max(-w * .5 + 0, x)), Math.min(H - h * .5, Math.max(-h * .5, y)), w, h].map(v => Math.round(v * 10) / 10);
}
function zoomMap(factor, cx, cy) {
  if (!MAP) return;
  if (!factor) { ui.mapBox = null; } else {
    const [x, y, w, h] = ui.mapBox || MAP.viewBox, px = cx ?? x + w / 2, py = cy ?? y + h / 2;
    ui.mapBox = clampBox([px - (px - x) * factor, py - (py - y) * factor, w * factor, h * factor]);
    if (ui.mapBox[2] >= MAP.viewBox[2]) ui.mapBox = null;
  }
  const svg = $('.kmap'); if (svg) svg.setAttribute('viewBox', (ui.mapBox || MAP.viewBox).join(' '));
}
function bindMap() {
  const svg = $('.kmap'); if (!svg || svg.dataset.bound) return; svg.dataset.bound = '1';
  const toMap = (e, box) => { const r = svg.getBoundingClientRect(), s = Math.max(box[2] / r.width, box[3] / r.height); return [box[0] + (e.clientX - r.left - (r.width - box[2] / s) / 2) * s, box[1] + (e.clientY - r.top - (r.height - box[3] / s) / 2) * s, s]; };
  let drag = null;
  svg.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, box: [...(ui.mapBox || MAP.viewBox)], moved: false }; });
  svg.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return; drag.moved = true; svg.classList.add('dragging');
    const [, , s] = toMap(e, drag.box); ui.mapBox = clampBox([drag.box[0] - dx * s, drag.box[1] - dy * s, drag.box[2], drag.box[3]]); svg.setAttribute('viewBox', ui.mapBox.join(' '));
  });
  const end = () => { if (drag?.moved) { ui.mapDragged = true; setTimeout(() => { ui.mapDragged = false; }, 0); } drag = null; svg.classList.remove('dragging'); };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointerleave', end);
  svg.addEventListener('wheel', e => { e.preventDefault(); const box = ui.mapBox || MAP.viewBox, [mx, my] = toMap(e, box); zoomMap(e.deltaY < 0 ? 1 / 1.2 : 1.2, mx, my); }, { passive: false });
}
function bindForms() {
  const form = $('#budget-form'); if (!form) return;
  form.addEventListener('input', e => {
    const t = e.target; if (!t.name) return;
    const v = Math.max(0, Math.min(100, Math.round(Number(t.value) || 0)));
    ui.budgetDraft = { ...(ui.budgetDraft || state.budget), [t.name]: v };
    const twin = form.querySelector(`${t.type === 'range' ? '#b-' : '#r-'}${t.name}`); if (twin) twin.value = v;
    const sum = E.BUDGET_KEYS.reduce((a, k) => a + Number(ui.budgetDraft[k] || 0), 0), out = $('#budget-sum');
    out.textContent = `합계 ${sum} / 100 ${sum === 100 ? '✓' : `· ${sum > 100 ? `${sum - 100} 초과` : `${100 - sum} 부족`}`}`; out.className = `sum ${sum === 100 ? 'good' : 'bad'}`;
    const small = t.closest('.budget-row')?.querySelector('small'); if (small) small.textContent = `월 ${mlabel(t.name)} ${signed((v - 12) * .006, 3)} (현재 ${num(state.stats[t.name])})`;
    const apply = form.querySelector('[data-action="applyBudget"]'); const r = E.budgetReason(state) || (sum !== 100 ? '합계가 100이어야 합니다.' : '');
    if (apply) { apply.disabled = !!r; if (r) apply.setAttribute('aria-disabled', 'true'); else apply.removeAttribute('aria-disabled'); }
  });
  form.addEventListener('change', () => { if (form.isConnected) render(); });
  form.addEventListener('submit', e => e.preventDefault());
}

/* ---------- 입력 ---------- */
function openConfirm(action) {
  const reason = E.actionReason(state, data, action);
  if (reason) { toast(reason, { bad: true }); render(); return; }
  ui.modal = { type: 'confirm', action }; render();
}
function exportFile() {
  try {
    const blob = new Blob([E.exportSave(state)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `korea1960_${E.dateLabel(Math.min(state.turn, 239))}.json`; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500); toast('저장 파일을 내보냈습니다. 기록실의 \'저장 파일 불러오기\'로 다시 열 수 있습니다.');
  } catch (e) { toast(`저장 파일을 만들지 못했습니다: ${e.message}`, { bad: true }); }
}
async function importFile(input) {
  const file = input.files?.[0]; input.value = '';
  if (!file) return;
  if (file.size > 2000000) { toast('저장 파일은 2MB 이하여야 합니다.', { bad: true }); render(); return; }
  try {
    const raw = await file.text(); ui.modal = importOffer(raw, file.name);
  } catch (e) { toast(`불러오지 못했습니다: ${e.message}`, { bad: true }); }
  render();
}
/** 검증된 저장을 확인 창 상태로 만든다. 잘못된 입력은 예외. */
function importOffer(raw, name) {
  const loaded = importSave(raw);
  let migrated = 0, fromData = ''; try { const p = JSON.parse(raw); migrated = p.version < E.SAVE_VERSION ? p.version : 0; fromData = String(p.state.dataVersion); } catch { /* importSave가 이미 검사 */ }
  return { type: 'import', loaded, name, migrated, fromData };
}
function startNew() {
  const raw = ($('#seed-input')?.value || '').trim();
  let seed = raw ? Number(raw) : (Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0;
  if (raw && (!/^\d{1,10}$/.test(raw) || seed < 1 || seed > 4294967295)) { toast('시드는 1~4294967295의 정수여야 합니다.', { bad: true }); render(); return; }
  stopClock(); state = E.createState(data, seed); ui.screen = 'game'; ui.view = 'map'; ui.mapRegion = null; ui.mapBox = null; ui.modal = null; ui.budgetDraft = null; ui.focusMain = true; save();
  toast(`새 연대기를 시작했습니다. 시드 ${seed >>> 0}.`); render();
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
    if (el.dataset.action === 'choose') { toast(E.choiceReason(state, data, el.dataset.id), { bad: true }); render(); }
    return;
  }
  const a = el.dataset.action, id = el.dataset.id;
  if (a === 'modalBack') { if (e.target === el && ui.modal?.type !== 'report') { ui.modal = null; render(); } return; }
  switch (a) {
    case 'nav': {
      if (el.dataset.region) { ui.region = el.dataset.region; ui.mapRegion = el.dataset.region; }
      if (el.dataset.group) ui.lawGroup = el.dataset.group; if (el.dataset.good) ui.good = el.dataset.good; if (el.dataset.focus) ui.buildAll = true;
      ui.view = el.dataset.view; ui.toast = null; ui._scrollTop = true; if (state && !state.visited.includes(ui.view)) { state = { ...state, visited: [...state.visited, ui.view] }; save(); }
      render(); window.scrollTo({ top: 0 }); ui.focusMain = true; afterRender(null);
      const target = el.dataset.focus && (document.getElementById('c-' + el.dataset.focus) || document.getElementById('b-' + el.dataset.focus)); if (target) target.scrollIntoView({ block: 'center' });
      return;
    }
    case 'policyCat': ui.policyCat = id; return render();
    case 'policyStatus': ui.policyStatus = id; return render();
    case 'buildAll': ui.buildAll = !ui.buildAll; return render();
    case 'goodCat': ui.goodCat = id; return render();
    case 'good': ui.good = ui.good === id ? null : id; return render();
    case 'lawGroup': ui.lawGroup = id; return render();
    case 'logFilter': ui.logFilter = id; return render();
    case 'region': ui.region = id; return render();
    case 'metric': ui.modal = { type: 'metric', id }; return render();
    case 'report': ui.modal = { type: 'report' }; return render();
    case 'help': ui.modal = { type: 'help' }; return render();
    case 'closeModal': ui.modal = null; return render();
    case 'dismissToast': ui.toast = null; return render();
    case 'continue': ui.screen = 'game'; ui.focusMain = true; stopClock(); return render();
    case 'newgame': ui.modal = { type: 'newgame' }; return render();
    case 'startNew': return startNew();
    case 'acceptImport': stopClock(); state = ui.modal.loaded; ui.modal = null; ui.screen = 'game'; ui.view = 'map'; ui.mapRegion = null; ui.budgetDraft = null; save(); toast(`저장 파일을 불러왔습니다 (${ym(state.turn)}).`); return render();
    case 'mapRegion': if (ui.mapDragged) { ui.mapDragged = false; return; } ui.mapRegion = ui.mapRegion === id ? null : id; if (ui.mapRegion) ui.region = id; return render();
    case 'closeRegion': ui.mapRegion = null; return render();
    case 'mapLayer': ui.mapLayer = MAP_LAYERS[id] ? id : 'dev'; return render();
    case 'eventFold': ui.eventFolded = !ui.eventFolded; return render();
    case 'mapZoom': return zoomMap(id === 'in' ? 1 / 1.4 : id === 'out' ? 1.4 : 0);
    case 'clockToggle': if (clock.running) { stopClock(); render(); } else startClock(); return;
    case 'speed': return setSpeed(Number(id));
    case 'speedCycle': { const list = Object.keys(SPEEDS).map(Number); return setSpeed(list[(list.indexOf(clock.speed) + 1) % list.length]); }
    case 'export': if (!state) return; if (EMBEDDED) { ui.modal = { type: 'exportText' }; return render(); } exportFile(); return render();
    case 'exportText': if (!state) return; ui.modal = { type: 'exportText' }; return render();
    case 'copySave': {
      const area = $('#save-text'); if (!area) return;
      const done = ok => { if (ui.modal?.type !== 'exportText') return; ui.modal = { type: 'exportText', copied: ok }; render(); if (!ok) { const a = $('#save-text'); a?.focus(); a?.select(); } };
      try { navigator.clipboard.writeText(area.value).then(() => done(true), () => done(false)); } catch { done(false); }
      return;
    }
    case 'pasteImport': ui.modal = { type: 'pasteImport' }; return render();
    case 'importText': {
      const text = $('#paste-text')?.value || '';
      if (!text.trim()) { ui.modal = { type: 'pasteImport', text, error: '붙여 넣은 텍스트가 없습니다.' }; return render(); }
      if (text.length > 2000000) { ui.modal = { type: 'pasteImport', text: '', error: '저장 텍스트는 2MB 이하여야 합니다.' }; return render(); }
      try { ui.modal = importOffer(text, '붙여 넣은 저장 텍스트'); } catch (err) { ui.modal = { type: 'pasteImport', text, error: err.message }; }
      return render();
    }
    case 'choose': { const ev = byId('events', state.queue[0]), c = ev?.choices.find(x => x.id === id); if (c?.ending) return openConfirm({ type: 'choose', choiceId: id }); run({ type: 'choose', choiceId: id }); return; }
    case 'prepare': run({ type: 'prepare' }); return;
    case 'gotoEvent': { if (ui.view === 'map') { ui.eventFolded = false; render(); const c = document.querySelector('.map-event .choice:not([aria-disabled="true"])'); if (c) c.focus(); return; } ui.view = 'overview'; ui._scrollTop = true; render(); const first = document.querySelector('.choice:not([aria-disabled="true"])'); if (first) { first.scrollIntoView({ block: 'center' }); first.focus({ preventScroll: true }); } return; }
    case 'endMonth': if (ui.modal) return; run({ type: 'endMonth' }); return;
    case 'askPolicy': return openConfirm({ type: 'policy', id });
    case 'askBuild': return openConfirm({ type: 'build', id, regionId: el.dataset.region || ui.region });
    case 'cancelBuild': return openConfirm({ type: 'cancelBuild', index: Number(id) });
    case 'prioritize': run({ type: 'prioritize', index: Number(id) }); return;
    case 'pm': run({ type: 'pm', id, regionId: el.dataset.region, pm: Number(el.dataset.pm) }); return;
    case 'subsidy': run({ type: 'subsidy', id, regionId: el.dataset.region }); return;
    case 'askPrivatize': return openConfirm({ type: 'privatize', id, regionId: el.dataset.region });
    case 'askDownsize': return openConfirm({ type: 'downsize', id, regionId: el.dataset.region });
    case 'askEnact': return openConfirm({ type: 'enact', id });
    case 'askCancelEnact': return openConfirm({ type: 'cancelEnact' });
    case 'askCoalition': return openConfirm({ type: 'coalition', id });
    case 'askEdict': return openConfirm({ type: 'edict', id, regionId: el.dataset.region });
    case 'askRevoke': return openConfirm({ type: 'revokeEdict', regionId: el.dataset.region });
    case 'askDiplomacy': return openConfirm({ type: 'diplomacy', countryId: id, mode: el.dataset.mode });
    case 'askAdviser': return openConfirm({ type: 'adviser', id });
    case 'askRepay': return openConfirm({ type: 'repay', amount: Number(id) });
    case 'confirm': { const action = ui.modal?.action; if (action) run(action); return; }
    case 'preset': ui.budgetDraft = { ...BUDGET_PRESETS[Number(id)][1] }; return render();
    case 'resetBudget': ui.budgetDraft = null; return render();
    case 'applyBudget': { const b = ui.budgetDraft || state.budget; run({ type: 'budget', budget: Object.fromEntries(E.BUDGET_KEYS.map(k => [k, Number(b[k])])) }); return; }
  }
});
document.addEventListener('change', e => { const t = e.target; if (t.matches?.('[data-input="import"]')) importFile(t); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.modal) { ui.modal = null; render(); return; }
  if (e.key === 'Tab' && ui.modal) {
    const dialog = document.querySelector('[role="dialog"]'); if (!dialog) return;
    const items = [...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea,summary')];
    if (!items.length) return;
    if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0].focus(); }
  }
  if (e.key === 'Enter' && e.target?.id === 'seed-input') { e.preventDefault(); startNew(); }
  // 스페이스: 시간 진행/멈춤, 1~4: 배속. 입력 칸·버튼·링크에 초점이 있거나 창이 열려 있으면 쓰지 않는다.
  if ((e.key === 'Enter' || e.key === ' ') && e.target?.getAttribute?.('role') === 'button' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
  const typing = e.target?.closest?.('input,textarea,select,button,a,summary,[contenteditable],[role="button"]');
  if (!ui.modal && !typing && state && ui.screen === 'game' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === ' ') { e.preventDefault(); if (clock.running) { stopClock(); render(); } else startClock(); }
    else if (['1', '2', '3', '4'].includes(e.key)) setSpeed([1, 2, 4, 8][Number(e.key) - 1]);
  }
});

document.addEventListener('visibilitychange', () => { if (document.hidden && state) save(); });
window.addEventListener('pagehide', () => { if (state) save(); });

/* ---------- 시작 ---------- */
const loaded = loadAutosave();
if (loaded) { state = loaded.state; savedInfo = { turn: state.turn }; }
render();
/* 검토용 디버그 훅: 상태 복사본과 dispatch. 배포판에서는 지워도 된다. */
globalThis.__GAME_DEBUG__ = { getState: () => state && JSON.parse(JSON.stringify(state)), data, engine: E, dispatch: a => run(a), ui, clock };
