/* 대한민국 1960: 선택의 연대기 — 화면 v2
 * 입력을 engine.dispatch로 보내고 돌려받은 상태만 그린다. 비용·결과를 화면에서 따로 계산해 상태를 바꾸지 않는다.
 * 예외: 화면 방문 기록(state.visited)만 UI가 갱신한다(기록 표식 '기록을 읽는 사람' 판정용). */
import * as E from './engine.mjs';

const data = globalThis.__DATA__ || await fetch('../data/game.json').then(r => { if (!r.ok) throw Error('콘텐츠를 읽지 못했습니다.'); return r.json(); });
const STORE_KEY = 'korea1960.game.v2', LEGACY_KEY = 'korea1960.reference.v1', BACKUP_KEY = 'korea1960.game.v2.unreadable';
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
const lowerBetter = id => metric(id) && metric(id).higherIsBetter === false;
const tone = (id, delta) => Math.abs(delta) < 1e-9 ? 'flat' : ((delta > 0) !== lowerBetter(id) ? 'good' : 'bad');
const arrow = delta => Math.abs(delta) < 1e-9 ? '–' : delta > 0 ? '▲' : '▼';

/* ---------- 설명 문구 (가상 모형의 규칙을 사람이 읽는 말로) ---------- */
const METRIC_HELP = {
  gdp: '매월 성장률 = 기본 성장률 + 산업×0.003% + 교육×0.0012% + 기반 시설×0.0018% − (물가−12)×0.015% − 실업률×0.004%, 월 −1%~+1.2%로 제한. 세입과 기본 지출도 생산 지수에 비례한다.',
  treasury: '매월 수입 − 기본 지출 − 이자 − 유지비만큼 변한다. 0보다 작아지면 부족분이 자동으로 부채가 된다.',
  debt: '국고 부족분이 자동으로 더해지고 상환하면 줄어든다. 매월 부채의 0.3%가 이자. 220을 넘으면 물가를 밀어 올리고, 700 이상이면 재정위기 엔딩.',
  reserves: '수출 금융·외교 다변화·항만 사업·경제협력 사건으로 오르고, 에너지 충격·기술 교류 비용으로 줄 수 있다.',
  inflation: '매월 8을 향해 1.2%씩 되돌아가고, 부채가 220을 넘으면 초과분×0.01%씩 오른다. 12를 넘으면 성장률을 깎는다.',
  unemployment: '매월 12를 향해 1.2%씩 되돌아가고 산업 역량×0.03%만큼 줄어든다. 높을수록 성장률을 깎는다.',
  legitimacy: '매월 (자유−50)×0.08% + (생활−45)×0.05%만큼 움직인다. 법안 표결·선거에 반영되고 3 이하이면 신뢰 붕괴 엔딩.',
  liberty: '정책·사건으로 변한다. 3 이하이면 권리 위기 엔딩. 성장과 별개의 평가축이다.',
  welfare: '예산 배분(생활)과 보건·주거 정책·사업으로 오른다. 정당성·사회 안정·분배 균형을 끌어올린다.',
  education: '예산 배분: 매월 (교육 배분율−12)×0.006. 교육 정책·사업·자문으로 더 오른다. 성장률에 반영된다.',
  infrastructure: '예산 배분: 매월 (기반 배분율−12)×0.006. 도로·철도·전력 사업으로 오른다. 성장률에 반영된다.',
  industry: '예산 배분: 매월 (산업 배분율−12)×0.006. 산업 정책·사업으로 오른다. 성장률을 높이고 실업을 줄이지만 환경을 깎는다.',
  agriculture: '예산 배분: 매월 (농업 배분율−12)×0.006. 농업 정책·관개·저장 시설로 오른다.',
  environment: '매월 산업 역량×0.035%씩 줄어든다. 수질 기준·하천 개선·에너지 절약으로 회복한다.',
  stability: '매월 정당성을 향해 0.8%씩 움직이고 (생활−45)×0.08%가 더해진다. 억압으로 얻는 단기 효과는 지속되지 않는다. 법안 표결에 반영.',
  admin: '행정 정책·자문·공개 검증을 고르는 사건으로 오른다.',
  equality: '매월 생활 수준을 향해 0.2%씩 움직인다. 지역 참여·협동조합·주거 정책으로 오른다.',
  security: '예산 배분: 매월 (안보 배분율−12)×0.006. 외교 대화로 오른다. 병력·작전은 다루지 않는다.'
};
const pct = v => `${+(v * 100).toFixed(2)}%`;
/** 데이터의 밸런스 규칙(balance)에서 지표별 설명을 만든다. 규칙이 없으면 1.1.0 설명. */
function metricHelp(id) {
  const b = data.balance, out = [METRIC_HELP[id] || ''];
  if (id === 'gdp') out.push(`기본 성장률은 월 ${pct(b && Number.isFinite(b.growthBase) ? b.growthBase : .0025)}.`);
  if (!b) { if (id === 'legitimacy') out.push('권력 집중 분기에서는 매월 −0.1.'); if (id === 'liberty') out.push('권력 집중 분기에서는 매월 −0.3.'); return out.join(' '); }
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
  prelude: { name: '관찰·준비', desc: '1960년의 당신은 대통령이 아닌 군인 박정희입니다. 국정 지표는 관찰 자료이며 국가 예산을 집행할 수 없습니다.', can: ['사건 결정', '사전 준비 (AP 1 → 준비 영향력 +3)'], cannot: '정책·법안·사업·예산·외교·내각' },
  civilian: { name: '민간 정치 준비', desc: '헌정 경로를 택했습니다. 1963년 가상 선거까지 국정을 집행하지 않고 민간 정치인으로 준비합니다.', can: ['사건 결정', '사전 준비 (AP 1 → 준비 영향력 +3)'], cannot: '정책·법안·사업·예산·외교·내각' },
  transition: { name: '과도 통치', desc: '군정 경로를 택했습니다. 정책·사업·예산·외교·내각을 집행할 수 있지만, 정규 의회 법안은 민정 취임 이후에 가능합니다.', can: ['행정 정책 시행', '사업 착수', '예산 배분', '외교', '자문 임명'], cannot: '의회 법안 발의' },
  elected: { name: '당선인 준비', desc: '1963년 가상 선거에서 당선했습니다. 12월 취임 사건 이후 전면 국정 집행이 열립니다.', can: ['사건 결정', '사전 준비'], cannot: '정책·법안·사업·예산·외교·내각' },
  governing: { name: '국정 운영', desc: '모든 정책·입법·사업·외교·내각 행동을 할 수 있습니다. 정기 선거와 의회 표결이 권한을 확인합니다.', can: ['정책 시행·법안 발의', '사업 착수', '예산 배분', '외교', '자문 임명·해임', '부채 상환'], cannot: '' }
};
const STATUS = { introduced: '발의', committee: '상임위', legal_review: '법제 검토', plenary: '본회의', passed: '가결', failed: '부결' };
const SPECIALTY = { services: '서비스', education: '교육', mining: '광업', forestry: '임업', agriculture: '농업', logistics: '물류', materials: '소재', food: '식품', manufacturing: '제조', port: '항만', shipbuilding: '조선', trade: '교역', tourism: '관광' };
const LOG_TYPES = { start: '시작', event: '사건', preparation: '준비', policy: '정책', bill: '법안', construction: '사업', budget: '예산', diplomacy: '외교', cabinet: '내각', finance: '재정', followup: '후속', election: '선거', ending: '엔딩' };
const LOG_FILTERS = [['all', '전체'], ['event', '사건'], ['law', '정책·법안'], ['construction', '사업'], ['money', '재정·예산'], ['foreign', '외교·내각'], ['election', '선거·엔딩']];
const LOG_GROUP = { event: 'event', followup: 'event', preparation: 'event', start: 'event', policy: 'law', bill: 'law', construction: 'construction', finance: 'money', budget: 'money', diplomacy: 'foreign', cabinet: 'foreign', election: 'election', ending: 'election' };
const BUDGET_LABEL = { industry: '산업', agriculture: '농업', education: '교육', welfare: '생활', infrastructure: '기반 시설', security: '안보' };
const BUDGET_PRESETS = [['기본 배분', { industry: 22, agriculture: 18, education: 16, welfare: 16, infrastructure: 16, security: 12 }], ['산업 우선', { industry: 32, agriculture: 12, education: 14, welfare: 12, infrastructure: 20, security: 10 }], ['생활 우선', { industry: 14, agriculture: 18, education: 18, welfare: 28, infrastructure: 12, security: 10 }], ['인재 우선', { industry: 16, agriculture: 14, education: 30, welfare: 16, infrastructure: 14, security: 10 }]];
const NAV = [['overview', '상황판'], ['policy', '정책'], ['assembly', '의회'], ['build', '사업·권역'], ['budget', '재정'], ['diplomacy', '외교'], ['cabinet', '내각 자문'], ['archive', '기록실']];

/* ---------- 상태 ---------- */
const ui = { screen: 'title', view: 'overview', region: 'capital', policyCat: '전체', policyStatus: 'all', projectAll: false, logFilter: 'all', modal: null, toast: null, budgetDraft: null };
let state = null, savedInfo = null, storageNote = '';
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* 저장소 없음 */ } }
};
function loadAutosave() {
  for (const key of [STORE_KEY, LEGACY_KEY]) {
    const raw = storage.get(key); if (!raw) continue;
    try { const s = importSave(raw); return { state: s, key, migrated: key === LEGACY_KEY }; }
    catch (e) { storage.set(BACKUP_KEY, raw); storageNote = `이전 자동 저장을 읽지 못했습니다(${e.message}). 원본은 브라우저에 별도로 보관했습니다.`; }
  }
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
  if (state.ending && !prev.ending) { ui.view = 'overview'; if (action.type !== 'endMonth') ui.modal = null; }
  render(); return r;
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
  return wrap(inline, items.map(([id, v]) => [v >= 0 ? 'good' : 'bad', `<span>${esc(byId('factions', id).name)} 지지</span><b>${arrow(v)} ${signed(v, 0)}</b>`]));
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
function chart(key, color) {
  const series = state.history.map(h => h[key]);
  const min = Math.min(...series), max = Math.max(...series), range = Math.max(1, max - min), n = series.length;
  const x = i => (n <= 1 ? 0 : i / (n - 1) * 480 + 10), y = v => 100 - (v - min) / range * 80;
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const years = [...new Set(state.history.map(h => E.calendar(Math.min(h.turn, 239)).year))];
  const first = series[0], last = series.at(-1);
  return `<article class="panel chart"><div class="row"><h3>${esc(mlabel(key))}</h3><strong>${num(last, digits(key))}</strong></div>
  <svg viewBox="0 0 500 112" role="img" aria-label="${esc(mlabel(key))} 추이: 1960년 1월 ${num(first, digits(key))}에서 현재 ${num(last, digits(key))}. 최저 ${num(min, digits(key))}, 최고 ${num(max, digits(key))}.">
  <line x1="10" y1="100" x2="490" y2="100" stroke="#334a4d"/><line x1="10" y1="20" x2="490" y2="20" stroke="#26403f" stroke-dasharray="3 4"/>
  <polyline fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" points="${pts}"/><circle cx="${x(n - 1)}" cy="${y(last)}" r="3.4" fill="${color}"/></svg>
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
  const steps = [['이번 달 사건을 결정한다', true], [prep ? '사전 준비로 영향력을 쌓는다 (AP 1 → +3)' : exec ? '정책·사업·외교·자문에 행동점수를 쓴다' : '준비할 수 있는 일을 확인한다', state.ap === 0], ['다음 달로 진행하고 결산을 읽는다', false]];
  return `<section class="paper decision calm"><div class="body"><span class="eyebrow">이번 달의 업무 · ${esc(ym(state.turn))}</span><h2>결정할 사건이 없습니다</h2>
  <p>${prep ? '아직 국정 권한이 없습니다. 사전 준비는 1963년 가상 선거의 준비 영향력이 됩니다.' : exec ? '정책과 사업을 검토하고 남은 행동점수를 사용하세요. 모든 점수를 쓰지 않아도 다음 달로 갈 수 있습니다.' : '이번 달에는 집행할 권한이 없습니다.'}</p>
  <ol class="steps">${steps.map(([t, done]) => `<li class="${done ? 'done' : ''}">${esc(t)}</li>`).join('')}</ol>
  <div class="row" style="justify-content:flex-start;flex-wrap:wrap;margin-top:12px">${prep ? btn('사전 준비 · AP 1 / 영향력 +3', 'prepare', { cls: 'primary', reason: E.prepareReason(state) }) : ''}${exec ? btn('정책 검토', 'nav', { attrs: 'data-view="policy"' }) + btn('사업 검토', 'nav', { attrs: 'data-view="build"' }) : ''}${btn('다음 달로 →', 'endMonth', { reason: E.endMonthReason(state) })}</div>
  ${prep ? reasonLine(E.prepareReason(state)) : ''}</div></section>`;
}
function endingCard() {
  const e = state.ending, h0 = state.history[0], h = state.history.at(-1);
  const axis = (title, id, text) => { const a = id === 'gdp' ? h0.gdp : state.history[0][id] ?? metric(id).initial, b = state.stats[id]; return `<div class="axis"><h3>${esc(title)}</h3><strong>${num(b, digits(id))}</strong><p>${esc(mlabel(id))} ${num(a, digits(id))} → ${num(b, digits(id))} (${signed(b - a, digits(id))})</p><p>${esc(text)}</p></div>`; };
  const s = chronicleSummary();
  return `<section class="paper decision" aria-labelledby="end-title"><div class="art" style="background-image:url('${art('cover')}')" role="img" aria-label="${esc(artCaption('cover'))}"><span class="tag">연대기 종료 · ${esc(ym(Math.min(e.turn, 239)))}</span></div>
  <div class="body"><span class="eyebrow">엔딩 평가</span><h2 id="end-title">${esc(e.title)}</h2><p>${esc(e.text)}</p>
  <p class="muted" style="font-size:13px">아래 네 축은 서로를 상쇄하지 않는 별개의 평가입니다. 경제 성과가 권리 침해의 비용을 지우지 않습니다. 모든 값은 가상 모형 값입니다.</p>
  <div class="axes">${axis('성장', 'gdp', `산업 역량 ${num(state.stats.industry)} · 부채 ${num(state.stats.debt, 0)}`)}${axis('권리', 'liberty', `정당성 ${num(state.stats.legitimacy)}${state.flags.authoritarian ? ' · 권력 집중 분기를 택함' : ''}`)}${axis('생활', 'welfare', `분배 균형 ${num(state.stats.equality)} · 교육 ${num(state.stats.education)}`)}${axis('환경', 'environment', `산업화의 환경 부담을 포함`)}</div>
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
  const passed = state.bills.filter(b => b.status === 'passed').length, failed = state.bills.filter(b => b.status === 'failed').length;
  out.push(`시행 정책 ${state.policies.length}개`, `법안 가결 ${passed} · 부결 ${failed}`, `준공 사업 ${state.projects.filter(p => p.status === 'complete').length}개`);
  const elections = state.log.filter(l => l.type === 'election' && !l.text.startsWith('1963')).length;
  if (elections) out.push(`정기 선거 ${elections}회`);
  out.push(`업무 ${Math.min(state.turn, 240)}개월`);
  return out;
}

/* ---------- 화면: 상황판 ---------- */
function overview() {
  const p = state.ending ? { name: '연대기 종료', desc: `${ym(Math.min(state.ending.turn, 239))}에 연대기가 끝났습니다. 더 이상 행동할 수 없으며, 기록과 지표를 읽거나 저장 파일을 내보낼 수 있습니다.`, can: ['연대기·출처 읽기', '저장 내보내기', '새 연대기 시작'], cannot: '' } : PHASE[state.phase];
  return `<div class="page-head"><div><span class="eyebrow">NATIONAL BRIEF · 국가 브리핑</span><h1>${esc(ym(state.turn))}, 선택은 기록으로 남는다</h1></div><span class="tag fiction">모든 지표는 가상 모형 값</span></div>
  <div class="ov"><div class="kpis ov-kpis">${['gdp', 'inflation', 'legitimacy', 'liberty', 'welfare', 'treasury'].map(id => kpi(id)).join('')}</div>
  <div class="overview-grid ov-main"><div>${decisionCard()}</div><div class="grid">
  <article class="panel mandate"><span class="eyebrow">YOUR MANDATE · 현재 권한</span><h2 class="phase">${esc(p.name)}</h2><p style="font-size:14px">${esc(p.desc)}</p>
  <ul>${p.can.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${p.cannot ? `<small>아직 할 수 없음: ${esc(p.cannot)}</small>` : ''}
  <div style="margin-top:12px"><div class="kv"><span>행동점수</span><b>${apDots(state.ap)} ${state.ap} / 3</b></div><div class="kv"><span>준비 영향력</span><b>${num(state.influence, 0)}</b></div><div class="kv"><span>종합 지지도</span><b>${num(E.supportAverage(state, data))}</b></div><div class="kv"><span>가상 의석 점유</span><b>${num(state.seats * 100)}%</b></div></div>
  ${state.report ? btn('지난달 결산 보기', 'report', { cls: 'block quiet' }) : ''}</article>
  <article class="panel"><h2>다가오는 일정</h2><ul class="milestones">${milestones().map(([t, text]) => `<li><time>${esc(t)}</time><span>${text}</span></li>`).join('')}</ul></article>
  </div></div></div>
  <div class="charts">${chart('gdp', '#c5a66b')}${chart('liberty', '#83b39c')}${chart('welfare', '#bca6cd')}${chart('environment', '#79a7b3')}</div>
  <article class="panel"><div class="row"><h2>사회 각계의 반응</h2><small>각 집단은 중시하는 지표 세 개의 평균을 향해 매월 2.5%씩 움직인다</small></div><div class="factions">${data.factions.map(f => { const dv = state.report?.support?.[f.id] || 0; return `<div><div class="row"><span>${esc(f.name)} <small style="display:inline">비중 ${Math.round(f.weight * 100)}%</small></span><strong>${num(state.support[f.id], 0)} <small class="delta ${dv > 0 ? 'good' : dv < 0 ? 'bad' : 'flat'}" style="display:inline">${arrow(dv)}${signed(dv, 1)}</small></strong></div><div class="bar"><i style="width:${state.support[f.id]}%"></i></div><small>중시: ${f.priorities.map(mlabel).map(esc).join(' · ')}</small></div>`; }).join('')}</div></article>
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
  for (const p of state.projects.filter(p => p.status === 'building').sort((a, b) => a.remaining - b.remaining).slice(0, 2)) list.push([E.dateLabel(t + p.remaining - 1), `${esc(byId('regions', p.regionId).name)} ${esc(byId('projects', p.projectId).name)} 준공`]);
  for (const b of state.bills.filter(b => !['passed', 'failed'].includes(b.status)).slice(0, 2)) list.push([E.dateLabel(t + b.remaining - 1), `${esc(byId('policies', b.policyId).name)} 표결`]);
  list.push(['1979-12', `연대기 종료 · ${240 - t}개월 남음`]);
  return list.sort((a, b) => a[0].localeCompare(b[0]));
}

/* ---------- 화면: 정책 ---------- */
function policyStatus(p) {
  const bill = [...state.bills].reverse().find(b => b.policyId === p.id);
  if (state.policies.includes(p.id)) return ['on', '시행 중'];
  if (bill && !['passed', 'failed'].includes(bill.status)) return ['bill', `심의 중 · ${STATUS[bill.status]} (${bill.remaining}개월 남음)`];
  if (E.calendar(state.turn).year < p.unlockYear) return ['locked', `${p.unlockYear}년부터`];
  if (bill?.status === 'failed') return ['open', '지난 표결 부결 · 다시 발의 가능'];
  return ['open', ''];
}
function policy() {
  const cats = ['전체', ...new Set(data.policies.map(p => p.category))];
  const statusFilters = [['all', '전체'], ['open', '시행 가능'], ['active', '시행·심의 중'], ['locked', '잠김']];
  const list = data.policies.filter(p => ui.policyCat === '전체' || p.category === ui.policyCat).filter(p => {
    const [st] = policyStatus(p), r = E.policyReason(state, data, p.id);
    return ui.policyStatus === 'all' || (ui.policyStatus === 'open' && !r) || (ui.policyStatus === 'active' && ['on', 'bill'].includes(st)) || (ui.policyStatus === 'locked' && st === 'locked');
  });
  const f = E.finance(state, data);
  return `<div class="page-head"><div><span class="eyebrow">POLICY PAPERS · 정책</span><h1>정책의 비용과 시간</h1><p>시행비는 한 번, 유지비는 매월 듭니다. 지속 효과는 집행 권한이 있는 동안 매월 더해집니다. '의회 법안'은 발의 후 5~7개월 심의와 표결을 거쳐야 효과가 생기고, 부결돼도 시행비는 돌려받지 않습니다.</p></div><span class="tag">다음 달 월 수지 ${signed(f.balance, 2)}</span></div>
  ${!E.isExecutive(state) ? `<div class="notice">${esc(PHASE[state.phase].name)} 단계에서는 정책을 집행할 수 없습니다. 미리 내용을 검토할 수 있습니다.</div>` : ''}
  <div class="filters" role="group" aria-label="분야">${cats.map(c => `<button type="button" class="btn" data-action="policyCat" data-id="${esc(c)}" aria-pressed="${ui.policyCat === c}">${esc(c)}</button>`).join('')}</div>
  <div class="filters" role="group" aria-label="상태">${statusFilters.map(([id, t]) => `<button type="button" class="btn" data-action="policyStatus" data-id="${id}" aria-pressed="${ui.policyStatus === id}">${t}</button>`).join('')}</div>
  <div class="cards">${list.map(policyCard).join('') || `<p class="muted">조건에 맞는 정책이 없습니다.${ui.policyStatus === 'open' && E.governmentReason(state, 0) ? ` 지금은 어떤 정책도 시행할 수 없습니다: ${esc(E.governmentReason(state, 0))}` : ''}</p>`}</div>`;
}
function policyCard(p) {
  const r = E.policyReason(state, data, p.id), [st, stText] = policyStatus(p);
  const yearly = Object.fromEntries(Object.entries(p.monthlyEffects).map(([k, v]) => [k, v * 12]));
  return `<article class="panel card"><div class="row"><span class="tag">${esc(p.category)}</span><small>${p.requiresBill ? '의회 법안' : '행정 정책'} · ${p.unlockYear}년~</small></div>
  <h2>${esc(p.name)}</h2><p>${esc(p.description)}</p>
  <div class="cost"><span>시행비 <b>${p.cost}</b></span><span>월 유지 <b>${num(p.monthlyCost, 2)}</b></span><span>AP <b>1</b></span>${p.requiresBill ? `<span>심의 <b>5~7개월</b></span><span>현재 가결 확률 <b>${num(E.billChance(state, data) * 100, 0)}%</b></span>` : ''}</div>
  <span class="fx-title">${p.requiresBill ? '가결 시 즉시 효과' : '즉시 효과'}</span>${fxProjected(p.effects)}
  <span class="fx-title">지속 효과 (12개월 누적${data.balance && data.balance.diminishing ? ', 기본값' : ''})</span>${fxPlain(yearly)}${factionList(p.factionEffects)}
  ${stText ? `<p class="status-line">${esc(stText)}</p>` : ''}
  <div class="actions">${btn(state.policies.includes(p.id) ? '시행 중' : p.requiresBill ? '법안 발의 검토 · AP 1' : '정책 시행 검토 · AP 1', 'askPolicy', { attrs: `data-id="${p.id}"`, reason: r, cls: st === 'on' ? 'quiet' : '' })}${reasonLine(st === 'on' ? '' : r)}</div></article>`;
}

/* ---------- 화면: 의회 ---------- */
function assembly() {
  const open = state.bills.filter(b => !['passed', 'failed'].includes(b.status)), done = state.bills.filter(b => ['passed', 'failed'].includes(b.status)).reverse();
  const parts = E.billChanceParts(state, data), chance = E.billChance(state, data);
  const billPolicies = data.policies.filter(p => p.requiresBill);
  return `<div class="page-head"><div><span class="eyebrow">NATIONAL ASSEMBLY · 의회</span><h1>의회의 시간</h1><p>정규 의회는 민정 취임 이후 열립니다. 심의는 발의→상임위→법제 검토→본회의→표결 순서로 5~7개월이 걸립니다. 실제 국회의 법안·의석·득표가 아닌 게임 규칙입니다.</p></div><span class="tag">가상 의석 점유 ${num(state.seats * 100)}%</span></div>
  ${state.phase !== 'governing' ? `<div class="notice">현재 단계(${esc(PHASE[state.phase].name)})에서는 법안을 발의할 수 없습니다. ${state.phase === 'transition' ? '과도 통치 중에는 행정 정책만 시행할 수 있습니다.' : ''}</div>` : ''}
  <div class="two"><article class="panel"><h2>의석과 표결 확률</h2><div class="seat-bar" role="img" aria-label="가상 의석 점유 ${num(state.seats * 100)}%"><i style="width:${state.seats * 100}%"></i><span></span></div><small>황동색: 정부와 협력하는 가상 의석. 정기 선거 결과로 다시 정해진다.</small>
  <table class="parts" style="margin-top:12px"><thead><tr><th>지금 표결한다면</th><th>확률 기여</th></tr></thead><tbody>${parts.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${signed(v * 100, 1)}%p</td></tr>`).join('')}<tr><th>가결 확률 (15~95%로 제한)</th><th>${num(chance * 100, 1)}%</th></tr></tbody></table></article>
  <article class="panel"><h2>심의 중 ${open.length}건</h2>${open.length ? open.map(billCard).join('') : '<p class="muted">심의 중인 법안이 없습니다. 아래에서 발의할 법안을 고르세요.</p>'}</article></div>
  <article class="panel"><h2>발의할 수 있는 법안</h2><div class="cards">${billPolicies.map(p => { const r = E.policyReason(state, data, p.id), [, st] = policyStatus(p); return `<div class="card"><h3>${esc(p.name)} <small>${esc(p.category)}</small></h3>${fxPlain(p.effects)}<div class="cost"><span>시행비 <b>${p.cost}</b></span><span>월 유지 <b>${num(p.monthlyCost, 2)}</b></span></div>${st ? `<small class="status-line">${esc(st)}</small>` : ''}${btn('발의 검토 · AP 1', 'askPolicy', { attrs: `data-id="${p.id}"`, reason: r, cls: 'small' })}${reasonLine(state.policies.includes(p.id) ? '' : r)}</div>`; }).join('')}</div></article>
  <article class="panel"><h2>표결 기록</h2>${done.length ? `<ul class="timeline">${done.map(b => `<li><time>${E.dateLabel(b.resolvedTurn ?? b.startedTurn + b.total - 1)}</time><p><strong>${esc(byId('policies', b.policyId).name)}</strong> · ${b.status === 'passed' ? '<span class="tag ok">가결</span>' : '<span class="tag warn">부결</span>'} <small>가결 확률 ${num((b.probability || 0) * 100, 1)}% · 심의 ${b.total}개월</small></p></li>`).join('')}</ul>` : '<p class="muted">아직 표결된 법안이 없습니다.</p>'}</article>`;
}
function billCard(b) {
  const p = byId('policies', b.policyId), progress = b.total - b.remaining;
  const order = ['introduced', 'committee', 'legal_review', 'plenary'];
  const nowIdx = order.indexOf(b.status);
  return `<div style="padding:10px 0;border-bottom:1px solid #26403f"><div class="row"><strong>${esc(p.name)}</strong><span class="tag">${STATUS[b.status]}</span></div>
  <div class="stages" aria-label="심의 단계">${[...order, 'vote'].map((x, i) => `<span class="${i < nowIdx ? 'done' : i === nowIdx ? 'now' : ''}">${x === 'vote' ? '표결' : STATUS[x]}</span>`).join('')}</div>
  <small>${progress}/${b.total}개월 경과 · ${E.dateLabel(state.turn + b.remaining - 1)} 말 표결 예정 · 지금 기준 가결 확률 ${num(E.billChance(state, data) * 100, 0)}%</small></div>`;
}

/* ---------- 화면: 사업·권역 ---------- */
function build() {
  const r = byId('regions', ui.region), mine = state.projects.filter(p => p.regionId === r.id);
  const list = data.projects.filter(p => ui.projectAll || !E.projectReason(state, data, p.id, r.id) || mine.some(m => m.projectId === p.id));
  return `<div class="page-head"><div><span class="eyebrow">PUBLIC WORKS · 사업·권역</span><h1>지역에 남는 투자</h1><p>착수비와 AP 1을 쓰고, 정해진 개월이 지나면 준공 효과가 한 번 발동합니다. 준공 다음 달부터 시설 수입과 유지비가 재정에 붙습니다. 권역마다 진행 중·준공 사업을 합쳐 4개까지, 같은 사업은 한 권역에 한 번만 지을 수 있습니다.</p></div></div>
  ${!E.isExecutive(state) ? `<div class="notice">${esc(PHASE[state.phase].name)} 단계에서는 사업을 착수할 수 없습니다.</div>` : ''}
  <div class="build-grid"><article class="panel"><h2>권역 선택</h2><div class="region-board" role="group" aria-label="권역">${data.regions.map(x => { const ps = state.projects.filter(p => p.regionId === x.id); return `<button type="button" class="region" data-action="region" data-id="${x.id}" aria-pressed="${ui.region === x.id}" style="grid-column:${x.mapCol + 1};grid-row:${x.mapRow + 1}" aria-label="${esc(x.name)}, 개발도 ${num(E.regionDevelopment(state, data, x.id), 0)}, 슬롯 ${ps.length}/4"><strong>${esc(x.name)}</strong><span class="slots" aria-hidden="true">${[0, 1, 2, 3].map(i => `<i class="${ps[i] ? ps[i].status === 'complete' ? 'done' : 'building' : ''}"></i>`).join('')}</span><small>개발 ${num(E.regionDevelopment(state, data, x.id), 0)}</small></button>`; }).join('')}</div>
  <p class="board-note">■ 준공 ▨ 공사 중 □ 빈 슬롯 · 지리적 축척과 당시 행정 경계를 재현하지 않은 도식</p></article>
  <article class="panel"><span class="eyebrow">SELECTED REGION</span><h2>${esc(r.name)}</h2><div class="kv"><span>개발도</span><b>${num(E.regionDevelopment(state, data, r.id), 0)} / 100</b></div><div class="bar" style="margin:4px 0 10px"><i style="width:${E.regionDevelopment(state, data, r.id)}%"></i></div>
  <small>특성: ${r.specialties.map(x => SPECIALTY[x] || x).join(' · ')}. 이 판에서는 권역 특성이 효과 배율로 쓰이지 않고 사업 효과는 전국 지표에 더해진다. 준공 1건마다 개발도 +9.</small>
  <h3 style="margin-top:14px">사업 슬롯 ${mine.length} / 4</h3><ul class="slot-list">${mine.map(p => { const def = byId('projects', p.projectId); return `<li><div class="row"><strong>${esc(def.name)}</strong><small>${p.status === 'complete' ? `준공 ${E.dateLabel(p.completedTurn)}` : `${p.remaining}개월 남음 · ${E.dateLabel(state.turn + p.remaining - 1)} 말 준공`}</small></div><div class="bar ${p.status === 'complete' ? 'green' : ''}" style="margin-top:5px"><i style="width:${p.status === 'complete' ? 100 : (1 - p.remaining / def.months) * 100}%"></i></div></li>`; }).join('')}${Array.from({ length: 4 - mine.length }, () => '<li class="muted">빈 슬롯</li>').join('')}</ul></article></div>
  <div class="row" style="margin-bottom:12px"><h2 style="font-size:18px">${esc(r.name)}에 지을 수 있는 사업</h2><div class="filters" style="margin:0"><button type="button" class="btn" data-action="projectAll" aria-pressed="${ui.projectAll}">${ui.projectAll ? '전체 사업 표시 중' : '착수 가능만 표시 중'}</button></div></div>
  <div class="cards">${list.map(p => projectCard(p, r)).join('') || `<p class="muted">지금 이 권역에서 착수할 수 있는 사업이 없습니다.${E.governmentReason(state, 0) ? ` 사유: ${esc(E.governmentReason(state, 0))}` : ''} '전체 사업'으로 바꾸면 사업마다 이유를 볼 수 있습니다.</p>`}</div>`;
}
function projectCard(p, r) {
  const reason = E.projectReason(state, data, p.id, r.id), net = p.income - p.maintenance, here = state.projects.find(x => x.regionId === r.id && x.projectId === p.id);
  return `<article class="panel card"><div class="row"><span class="tag">${p.unlockYear}년~ · 공기 ${p.months}개월</span>${here ? `<span class="tag ${here.status === 'complete' ? 'ok' : ''}">${here.status === 'complete' ? '준공' : '공사 중'}</span>` : ''}</div>
  <h2>${esc(p.name)}</h2><div class="cost"><span>착수비 <b>${p.cost}</b></span><span>AP <b>1</b></span><span>준공 후 월 수입 <b>${num(p.income, 2)}</b></span><span>월 유지 <b>${num(p.maintenance, 2)}</b></span><span>순 <b>${signed(net, 2)}</b></span></div>
  <span class="fx-title">준공 효과 · 지금 착수하면 ${E.dateLabel(state.turn + p.months - 1)} 말</span>${fxPlain(p.effects)}
  <small>게임용 가상 사업. 수치와 공기는 실제 통계가 아니다.</small>
  <div class="actions">${btn(`${esc(r.name)}에 착수 검토 · AP 1`, 'askProject', { attrs: `data-id="${p.id}"`, reason })}${reasonLine(reason)}</div></article>`;
}

/* ---------- 화면: 재정 ---------- */
function budget() {
  const f = E.finance(state, data), fd = E.financeDetail(state, data), canBudget = !E.budgetReason(state);
  const draft = ui.budgetDraft || { ...state.budget }, sum = E.BUDGET_KEYS.reduce((a, k) => a + Number(draft[k] || 0), 0);
  const debt = state.stats.debt;
  return `<div class="page-head"><div><span class="eyebrow">TREASURY · 재정</span><h1>약속에는 재원이 필요하다</h1><p>돈의 단위는 '재정점'입니다. 실제 원화나 세수 추계가 아닙니다. 국고가 0보다 작아지면 부족분이 자동으로 부채가 됩니다.</p></div></div>
  <div class="kpis">${['treasury', 'debt', 'reserves', 'inflation', 'gdp', 'unemployment'].map(id => kpi(id)).join('')}</div>
  <div class="two"><article class="panel"><h2>다음 달 재정 전망</h2>
  <div class="kv"><span>기본 세입 11 + 생산 비례 ${num(fd.taxGrowth, 2)}</span><b>${num(fd.taxBase + fd.taxGrowth, 2)}</b></div>
  <div class="kv"><span>준공 시설 수입 (${fd.facilityIncome.length}곳)</span><b>${num(fd.facilityIncome.reduce((a, x) => a + x.income, 0), 2)}</b></div>
  <div class="kv"><span>기본 지출 10 + 생산 비례 ${num(fd.baseGrowth, 2)}</span><b>${minus(f.base)}</b></div>
  <div class="kv"><span>이자 (부채의 0.3%)</span><b>${minus(f.interest)}</b></div>
  <div class="kv"><span>정책 유지비 (${fd.policyUpkeep.length}개)</span><b>${minus(fd.policyUpkeep.reduce((a, x) => a + x.cost, 0))}</b></div>
  <div class="kv"><span>시설 유지비</span><b>${minus(fd.facilityIncome.reduce((a, x) => a + x.maintenance, 0))}</b></div>
  <div class="kv"><span>자문위원 유지비 (${state.advisers.length}명 × 0.15)</span><b>${minus(fd.adviserUpkeep)}</b></div>
  <div class="kv"><strong>월 수지</strong><b class="delta ${f.balance >= 0 ? 'good' : 'bad'}">${arrow(f.balance)} ${signed(f.balance, 2)}</b></div>
  ${state.lastFinance ? `<small>지난달(${E.dateLabel(state.lastFinance.turn)}) 실제 수지 ${signed(state.lastFinance.balance, 2)}${state.report?.borrowed ? ` · 부족분 ${num(state.report.borrowed, 1)} 차입` : ''}</small>` : ''}
  <h3 style="margin-top:16px">부채 위험</h3><div class="gauge" role="img" aria-label="부채 ${num(debt, 0)}. 220을 넘으면 물가 압력, 700 이상이면 재정위기 엔딩"><i style="left:${Math.min(100, debt / 800 * 100)}%"></i></div><div class="gauge-labels" aria-hidden="true"><small style="left:0">0</small><small style="left:27.5%">220 물가 압력</small><small style="left:87.5%">700 위기</small></div>
  <p style="margin-top:10px;font-size:14px">현재 부채 <b>${num(debt, 1)}</b> · 월 이자 ${num(f.interest, 2)}</p>
  <div class="row" style="justify-content:flex-start;flex-wrap:wrap">${[10, 25, 50].map(a => btn(`${a} 상환 · AP 1`, 'askRepay', { attrs: `data-id="${a}"`, reason: E.repayReason(state, a), cls: 'small' })).join('')}</div>${reasonLine(E.repayReason(state, 10))}
  </article>
  <article class="panel"><h2>예산 배분 (합계 100)</h2><p class="muted" style="font-size:13.5px">배분은 지출 총액을 새로 만들지 않고 여섯 역량의 성장 방향을 정합니다. 매월 역량 변화 = (배분율 − 12) × 0.006. 배분 수정은 행동점수를 쓰지 않습니다.</p>
  ${canBudget ? '' : `<div class="notice">${esc(E.budgetReason(state))} 지금은 관찰용 국가 기본값이 적용됩니다.</div>`}
  <form id="budget-form" novalidate>${E.BUDGET_KEYS.map(k => { const v = Number(draft[k] || 0); return `<div class="budget-row"><label for="b-${k}">${BUDGET_LABEL[k]}</label><input type="range" min="0" max="60" step="1" id="r-${k}" name="${k}" value="${v}" aria-label="${BUDGET_LABEL[k]} 배분" ${canBudget ? '' : 'disabled'}><input type="number" inputmode="numeric" min="0" max="100" step="1" id="b-${k}" name="${k}" value="${v}" ${canBudget ? '' : 'disabled'}><small>월 ${esc(mlabel(k))} ${signed((v - 12) * .006, 3)} (현재 ${num(state.stats[k])})</small></div>`; }).join('')}
  <p class="sum ${Math.abs(sum - 100) < .001 ? 'good' : 'bad'}" id="budget-sum" aria-live="polite">합계 ${num(sum, 0)} / 100 ${Math.abs(sum - 100) < .001 ? '✓' : `· ${sum > 100 ? `${num(sum - 100, 0)} 초과` : `${num(100 - sum, 0)} 부족`}`}</p>
  <div class="filters" role="group" aria-label="배분 예시">${BUDGET_PRESETS.map(([name], i) => `<button type="button" class="btn small" data-action="preset" data-id="${i}" ${canBudget ? '' : 'disabled'}>${name}</button>`).join('')}</div>
  <div class="row" style="justify-content:flex-start;flex-wrap:wrap">${btn('배분 적용 (무료)', 'applyBudget', { cls: 'primary', reason: E.budgetReason(state) || (Math.abs(sum - 100) > .001 ? '합계가 100이어야 합니다.' : '') })}${btn('되돌리기', 'resetBudget', { cls: 'quiet', reason: canBudget ? '' : '권한이 없습니다.' })}</div>
  ${reasonLine(E.budgetReason(state) || (Math.abs(sum - 100) > .001 ? '합계가 100이어야 적용할 수 있습니다.' : ''))}</form></article></div>
  ${fd.policyUpkeep.length || fd.facilityIncome.length ? `<article class="panel"><h2>유지비 내역</h2><div class="two"><div>${fd.policyUpkeep.map(x => `<div class="kv"><span>${esc(byId('policies', x.policyId).name)}</span><b>${minus(x.cost)}</b></div>`).join('') || '<p class="muted">시행 중인 정책 없음</p>'}</div><div>${fd.facilityIncome.map(x => `<div class="kv"><span>${esc(byId('regions', x.regionId).name)} ${esc(byId('projects', x.projectId).name)}</span><b>${signed(x.income - x.maintenance, 2)}</b></div>`).join('') || '<p class="muted">준공 시설 없음</p>'}</div></div></article>` : ''}`;
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
  <article class="panel"><h2>저장</h2><p style="font-size:14px">${savedInfo ? `자동 저장: ${esc(ym(savedInfo.turn))} 상태가 이 브라우저에 보관되어 있습니다.` : '자동 저장 기록이 없습니다.'} 다른 기기로 옮기거나 보관하려면 저장 파일(JSON)을 내보내세요. 불러온 파일은 버전·ID·수치 범위를 검사하고, 손상된 파일은 일부만 반영하지 않고 거부합니다.</p>
  <div class="row" style="justify-content:flex-start;flex-wrap:wrap">${btn(`${icon('save')} ${EMBEDDED ? '저장 텍스트 복사' : '저장 파일 내보내기'}`, 'export', { cls: 'primary' })}<label class="btn file-btn">저장 파일 불러오기<input type="file" accept="application/json,.json" data-input="import" aria-label="저장 파일 불러오기"></label>${EMBEDDED ? '' : btn('저장 텍스트 복사', 'exportText')}${btn('저장 텍스트 붙여넣기', 'pasteImport')}${btn('새 연대기', 'newgame', { cls: 'quiet' })}</div><small class="muted" style="display:block;margin-top:6px">${EMBEDDED ? '이 보기 화면은 파일 다운로드를 막습니다. 저장 텍스트를 복사해 두었다가 붙여넣기로 이어 하세요. 진행은 이 브라우저에 자동 저장됩니다.' : '파일을 받을 수 없는 환경에서는 저장 텍스트를 복사해 두었다가 붙여넣기로 이어 할 수 있습니다.'}</small>${storageNote ? `<p class="reason">${esc(storageNote)}</p>` : ''}</article>
  <article class="panel"><h2>기록 표식 ${unlocked.length} / ${data.achievements.length}</h2><div class="badges">${data.achievements.map(a => { const on = unlocked.some(x => x.id === a.id); return `<span class="badge-item ${on ? 'on' : ''}">${on ? '✓ ' : ''}${esc(a.name)} <small>${esc(a.description)}</small></span>`; }).join('')}</div></article>
  <article class="panel"><div class="row" style="flex-wrap:wrap"><h2>선택의 연대기 · ${state.log.length}건</h2></div><div class="filters" role="group" aria-label="기록 종류">${LOG_FILTERS.map(([id, t]) => `<button type="button" class="btn" data-action="logFilter" data-id="${id}" aria-pressed="${ui.logFilter === id}">${t}</button>`).join('')}</div>
  <ul class="timeline">${entries.slice(0, 400).map(l => `<li><time>${esc(l.date)}</time><p><span class="tag ${l.kind === 'historical_anchor' ? 'history' : l.kind ? 'fiction' : ''}">${esc(LOG_TYPES[l.type] || l.type)}${l.kind ? ` · ${l.kind === 'historical_anchor' ? '역사 앵커, 반응은 가상' : '가상 상황'}` : ''}</span> ${esc(l.text)}</p>${l.changes ? `<span></span>${fxPlain(l.changes)}` : ''}</li>`).join('') || '<li><span></span><p class="muted">이 종류의 기록이 아직 없습니다.</p></li>'}</ul>${entries.length > 400 ? `<small>최근 400건만 표시합니다. 전체 기록은 저장 파일에 있습니다.</small>` : ''}</article>
  <details class="panel"><summary>역사 확인 자료 ${data.sources.length}건 · 확인일 ${esc(data.meta.sourceChecked)}</summary><p class="muted" style="font-size:13.5px">출처는 날짜와 사건 맥락을 확인하는 데에만 썼습니다. 선택지, 수치 효과, 선거·의석, 자문위원, 삽화는 모두 창작입니다.</p><ul class="timeline">${data.sources.map(s => `<li><time>${esc(s.id)}</time><p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a><br><small>${esc(s.institution)} · ${esc(s.scope)}</small></p></li>`).join('')}</ul></details>
  <details class="panel"><summary>가상 지표의 정의와 계산 규칙</summary><p style="font-size:13.5px">${esc(data.meta.disclaimer)}</p>${data.metrics.map(m => `<div class="kv" style="display:block"><strong>${esc(m.label)}</strong> <small>${esc(m.unit)} · ${m.min}~${m.max}${m.higherIsBetter ? '' : ' · 낮을수록 좋음'}</small><p style="font-size:13.5px;margin:2px 0 0">${esc(m.description)} ${esc(metricHelp(m.id))}</p></div>`).join('')}</details>
  <details class="panel"><summary>엔딩 12종과 판정 순서</summary><p style="font-size:13.5px">재정·신뢰·권리 위기는 매달 먼저 검사합니다. 퇴임·이양은 명시적인 선택이나 선거로만 기록됩니다. 1979년 12월이 끝나면 조건을 만족하는 엔딩 가운데 우선순위가 가장 높은 것을 고릅니다.</p>${[...data.endings].sort((a, b) => b.priority - a.priority).map(e => `<div class="kv"><span>${esc(e.title)} <small>${esc(endingRule(e))}</small></span><b>${e.priority}</b></div>`).join('')}</details>
  <details class="panel"><summary>제작·권리 표기</summary><p style="font-size:13.5px">독자 제작 게임입니다. 참조 게임의 코드·화면·대사·수치·이미지를 쓰지 않았습니다. 삽화 4점은 이 게임을 위해 생성한 그림이며 역사 사진이 아닙니다. 표지 인물은 실존 인물로 식별할 수 없는 뒷모습입니다. 한국어 글꼴 Chronicle KR은 Noto Sans KR(SIL Open Font License 1.1)의 서브셋입니다. 자문위원은 모두 가상 인물입니다. 군사정변·정치 폭력은 헌정적 결과와 제도적 비용으로만 추상화했습니다.</p><p style="font-size:13px" class="muted">데이터 ${esc(data.meta.version)} · 저장 형식 ${E.SAVE_VERSION} · 시드 상태 ${state.rng}</p></details>`;
}
function endingRule(e) {
  if (e.conditions.explicit) return '명시적 선택·선거 결과';
  const ops = { gte: '≥', lte: '≤', lt: '<' };
  const parts = Object.entries(e.conditions).flatMap(([k, r]) => Object.entries(r).map(([op, v]) => `${mlabel(k)} ${ops[op]} ${v}`));
  return parts.length ? parts.join(', ') : '그 밖의 모든 경우';
}

/* ---------- 오른쪽 브리핑 ---------- */
function brief() {
  const building = state.projects.filter(p => p.status === 'building'), bills = state.bills.filter(b => !['passed', 'failed'].includes(b.status));
  return `<section><h2>${esc(ym(state.turn))} 브리핑</h2>
  <div class="kv"><span>권한</span><b>${esc(PHASE[state.phase].name)}</b></div><div class="kv"><span>행동점수</span><b>${apDots(state.ap)} ${state.ap}</b></div>
  <div class="kv"><span>국고</span><b>${num(state.stats.treasury, 1)}</b></div><div class="kv"><span>부채</span><b>${num(state.stats.debt, 1)}</b></div><div class="kv"><span>다음 달 수지</span><b class="delta ${E.finance(state, data).balance >= 0 ? 'good' : 'bad'}">${signed(E.finance(state, data).balance, 2)}</b></div>
  ${state.queue.length ? `<div class="notice" style="margin:10px 0 0">결정할 사건 ${state.queue.length}건 ${btn('사건 보기', 'nav', { attrs: 'data-view="overview"', cls: 'small' })}</div>` : ''}</section>
  <section><h2>진행 중 · 법안 ${bills.length} · 사업 ${building.length}</h2><ul class="progress">${bills.map(b => `<li>${esc(byId('policies', b.policyId).name)} <small>${STATUS[b.status]} · ${b.remaining}개월 남음</small><div class="bar"><i style="width:${(b.total - b.remaining) / b.total * 100}%"></i></div></li>`).join('')}${building.map(p => { const def = byId('projects', p.projectId); return `<li>${esc(byId('regions', p.regionId).name)} ${esc(def.name)} <small>${p.remaining}개월 남음</small><div class="bar green"><i style="width:${(1 - p.remaining / def.months) * 100}%"></i></div></li>`; }).join('') || (bills.length ? '' : '<li class="muted">진행 중인 법안·사업이 없습니다.</li>')}</ul></section>
  <section><h2>최근 기록</h2><ul class="log">${state.log.slice(-6).reverse().map(l => `<li><time>${esc(l.date)} · ${esc(LOG_TYPES[l.type] || l.type)}</time>${esc(l.text)}${l.changes ? fxPlain(l.changes) : ''}</li>`).join('')}</ul>${btn('연대기 전체', 'nav', { attrs: 'data-view="archive"', cls: 'small quiet' })}</section>`;
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
  const a = m.action, f = E.finance(state, data);
  let title = '', body = '', go = '확정';
  const costLine = (cost, ap = 1) => `<table><tbody><tr><td>국고</td><td class="n">${num(state.stats.treasury, 1)} → ${num(state.stats.treasury - cost, 1)} (−${num(cost, 0)})</td></tr><tr><td>행동점수</td><td class="n">${state.ap} → ${state.ap - ap}</td></tr></tbody></table>`;
  if (a.type === 'policy') {
    const p = byId('policies', a.id); title = `${p.requiresBill ? '법안 발의' : '정책 시행'}: ${esc(p.name)}`; go = p.requiresBill ? '발의한다' : '시행한다';
    body = `<p>${esc(p.description)}</p>${costLine(p.cost)}
    ${p.requiresBill ? `<h3>심의 일정</h3><p style="font-size:14px">5~7개월(시드 난수로 결정) 뒤 ${E.dateLabel(state.turn + 4)}~${E.dateLabel(state.turn + 6)} 말 표결. 지금 기준 가결 확률 <b>${num(E.billChance(state, data) * 100, 1)}%</b>(표결 시점의 의석·정당성·안정·지지도로 다시 계산). 부결돼도 시행비는 돌려받지 않고 다시 발의할 수 있습니다.${state.turn + 7 > 240 ? ' <b>심의가 7개월이면 1979년 12월 안에 표결하지 못할 수 있습니다.</b>' : ''}</p><h3>가결되면 즉시</h3>` : '<h3>즉시 효과</h3>'}${fxProjected(p.effects)}${factionList(p.factionEffects)}
    <h3>${p.requiresBill ? '가결 이후' : '다음 달부터'} 매월</h3>${fxPlain(p.monthlyEffects)}${dimNote()}<p style="font-size:14px">유지비 ${num(p.monthlyCost, 2)} → 월 수지 ${signed(f.balance, 2)} → ${p.requiresBill ? '가결 후 ' : ''}${signed(f.balance - p.monthlyCost, 2)}${f.balance - p.monthlyCost < 0 && f.balance >= 0 ? ' <b>(적자로 바뀝니다)</b>' : ''}</p>`;
  } else if (a.type === 'project') {
    const p = byId('projects', a.id), r = byId('regions', a.regionId); title = `사업 착수: ${esc(r.name)} · ${esc(p.name)}`; go = '착수한다';
    body = `${costLine(p.cost)}<h3>공기와 준공</h3><p style="font-size:14px">${p.months}개월 · ${E.dateLabel(state.turn + p.months - 1)} 말 준공, ${E.dateLabel(state.turn + p.months)}부터 시설 수입 ${num(p.income, 2)}·유지비 ${num(p.maintenance, 2)} 반영. 권역 슬롯 ${state.projects.filter(x => x.regionId === r.id).length} → ${state.projects.filter(x => x.regionId === r.id).length + 1} / 4, 준공 시 개발도 +9.</p><h3>준공 시 한 번</h3>${fxPlain(p.effects)}<p style="font-size:13px" class="muted">공사 중에는 효과가 없고, 착수비는 돌려받을 수 없습니다.</p>`;
  } else if (a.type === 'diplomacy') {
    const n = byId('countries', a.countryId), o = E.DIPLOMACY_MODES[a.mode]; title = `외교: ${esc(n.name)} · ${esc(o.label)}`; go = '진행한다';
    body = `${costLine(o.cost)}<h3>즉시 효과</h3>${relationList({ [n.id]: o.relation })}${fxProjected(o.effects)}<p style="font-size:13px" class="muted">같은 상대와는 이번 달에 더 이상 외교 행동을 할 수 없게 됩니다.</p>`;
  } else if (a.type === 'adviser') {
    const ad = byId('advisers', a.id), on = state.advisers.includes(ad.id); title = `${on ? '해임' : '임명'}: ${esc(ad.name)} (가상 인물 · ${esc(ad.role)})`; go = on ? '해임한다' : '임명한다';
    body = on ? `<p>해임하면 다음 달부터 아래 지속 효과와 유지비 0.15가 사라집니다. 이미 생긴 변화는 되돌아가지 않습니다.</p><table><tbody><tr><td>행동점수</td><td class="n">${state.ap} → ${state.ap - 1}</td></tr></tbody></table>${fxPlain(ad.monthlyEffects)}`
      : `${costLine(ad.cost)}<h3>매월 지속 효과</h3>${fxPlain(ad.monthlyEffects)}${dimNote()}<p style="font-size:14px">유지비 0.15 → 월 수지 ${signed(f.balance, 2)} → ${signed(f.balance - .15, 2)}</p>`;
  } else if (a.type === 'repay') {
    title = `부채 ${a.amount} 상환`; go = '상환한다';
    body = `${costLine(a.amount)}<table><tbody><tr><td>부채</td><td class="n">${num(state.stats.debt, 1)} → ${num(state.stats.debt - a.amount, 1)}</td></tr><tr><td>월 이자</td><td class="n">${num(f.interest, 2)} → ${num((state.stats.debt - a.amount) * .003, 2)}</td></tr></tbody></table>`;
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
  const fin = r.finance;
  const changes = Object.entries(r.changes).filter(([k]) => metric(k)).sort((a, b) => Math.abs(b[1]) / (metric(b[0]).max > 1000 ? 100 : 1) - Math.abs(a[1]) / (metric(a[0]).max > 1000 ? 100 : 1));
  const events = [];
  for (const x of r.completed) events.push(`준공 · ${esc(byId('regions', x.regionId).name)} ${esc(byId('projects', x.projectId).name)} ${fxPlain(byId('projects', x.projectId).effects)}`);
  for (const x of r.bills) events.push(`표결 · ${esc(byId('policies', x.policyId).name)}: <b>${x.status === 'passed' ? '가결' : '부결'}</b> (가결 확률 ${num(x.probability * 100, 1)}%)${x.status === 'passed' ? fxPlain(byId('policies', x.policyId).effects) : ''}`);
  for (const x of r.followups) events.push(`지연 효과 · ${esc(x.text)} ${fxPlain(x.effects)}`);
  if (r.election) events.push(`가상 정기 선거 · 득표 지표 <b>${num(r.election.share, 1)}</b> (45 미만이면 이양) → ${r.election.transfer ? '권한 이양' : `의석 점유 ${num(r.election.seats * 100, 0)}%`}. 실제 득표율이 아님.`);
  if (r.borrowed) events.push(`재정 · 국고 부족분 <b>${num(r.borrowed, 1)}</b>을 부채로 조달`);
  const support = Object.entries(r.support).filter(([, v]) => Math.abs(v) >= .05);
  const next = r.events.map(id => byId('events', id)?.title).filter(Boolean);
  const body = `<p class="muted" style="font-size:13px">${esc(ym(r.turn))}의 월말 처리: 수입·지출·이자 → 지표 추세 → 정책·자문 지속 효과 → 사업 진척 → 법안 진척 → 지연 효과 → 지지도 갱신 → 선거·엔딩 판정.</p>
  <h3>재정</h3><table><tbody><tr><td>수입</td><td class="n">${num(fin.income, 2)}</td></tr><tr><td>기본 지출</td><td class="n">${minus(fin.base)}</td></tr><tr><td>이자</td><td class="n">${minus(fin.interest)}</td></tr><tr><td>정책·시설·자문 유지비</td><td class="n">${minus(fin.upkeep)}</td></tr><tr><th>월 수지</th><th class="n"><span class="delta ${fin.balance >= 0 ? 'good' : 'bad'}">${arrow(fin.balance)} ${signed(fin.balance, 2)}</span></th></tr></tbody></table>
  ${events.length ? `<h3>이번 달에 일어난 일</h3><ul class="stack" style="font-size:14px">${events.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
  <h3>지표 변화와 원인 <small>(항목을 누르면 원인별 기여)</small></h3>${changes.map(([k, v]) => `<details><summary><span>${esc(mlabel(k))}</span><span class="delta ${tone(k, v)}">${arrow(v)} ${signed(v, Math.abs(v) < .1 ? 3 : 2)}</span><small>${num(state.stats[k], digits(k))}</small></summary><ul>${(r.ledger[k] || []).map(([src, dv]) => `<li><span>${esc(src)}</span><span>${signed(dv, 3)}</span></li>`).join('')}</ul></details>`).join('') || '<p>변화 없음</p>'}
  ${support.length ? `<h3>사회 각계의 지지 변화</h3><ul class="fx">${support.map(([id, v]) => `<li class="${v >= 0 ? 'good' : 'bad'}"><span>${esc(byId('factions', id).name)}</span><b>${arrow(v)} ${signed(v, 1)}</b><small>${num(state.support[id], 0)}</small></li>`).join('')}</ul>` : ''}
  <h3>${state.ending ? '연대기 종료' : `${esc(ym(state.turn))} 시작`}</h3><p style="font-size:14px">${state.ending ? `<b>${esc(state.ending.title)}</b> — 상황판에서 엔딩 평가를 확인하세요.` : next.length ? `결정할 사건: <b>${next.map(esc).join(', ')}</b>` : '이번 달에는 정해진 사건이 없습니다.'} 행동점수 3을 회복했습니다.</p>`;
  return { title: `${esc(ym(r.turn))} 결산`, body, actions: `<button type="button" class="btn primary" data-action="closeModal" data-autofocus>${state.ending ? '엔딩 평가 보기' : `${esc(ym(state.turn))} 업무 시작`}</button>` };
}
function metricContent(id) {
  const m = metric(id), rows = state.report?.ledger?.[id] || [], change = state.report?.changes?.[id] || 0;
  return { title: `${esc(m.label)} <small>${esc(m.unit)}</small>`, body: `<p style="font-size:28px;font-family:var(--display)">${num(state.stats[id], digits(id))}</p><p>${esc(m.description)}</p><h3>무엇이 움직이나</h3><p style="font-size:14px">${esc(metricHelp(id))}</p><p style="font-size:13px" class="muted">범위 ${m.min}~${m.max} · ${m.higherIsBetter ? '높을수록 좋음' : '낮을수록 좋음'}</p>
  ${state.report ? `<h3>지난달(${esc(state.report.date)}) 변화 ${signed(change, 3)}</h3><table><tbody>${rows.map(([src, v]) => `<tr><td>${esc(src)}</td><td class="n">${signed(v, 3)}</td></tr>`).join('') || '<tr><td>변화 없음</td><td></td></tr>'}</tbody></table>` : '<p class="muted">첫 결산 뒤부터 월별 변화 원인을 보여 줍니다.</p>'}`, actions: closeBtn() };
}
function helpContent() {
  return { title: '게임 방법', body: `<p>1960년 1월부터 1979년 12월까지 한 달이 한 턴입니다(240턴). 플레이어는 박정희라는 역사적 출발점에 있지만, 1960년에는 대통령 권한이 없습니다.</p>
  <h3>매달 하는 일</h3><ol class="steps"><li>상황판의 사건 문서에서 선택지 하나를 고릅니다. 선택은 행동점수를 쓰지 않고, 표시된 국고 비용만 지불합니다.</li><li>행동점수 3을 정책·법안·사업·외교·자문·상환·사전 준비에 씁니다. 예산 배분 수정은 무료입니다.</li><li>'다음 달'을 누르면 결산이 열립니다. 무엇이 얼마나, 왜 바뀌었는지 확인하세요.</li></ol>
  <h3>권한의 단계</h3><p style="font-size:14px">관찰·준비(1960~61) → 1961년 5월 경로 분기(헌정: 민간 정치 준비 / 군정: 과도 통치, 대신 자유·정당성 비용) → 1963년 10월 가상 선거(준비 영향력·정당성·지지도로 당선 확률) → 12월 취임 → 국정 운영. 1967년 11월부터 48개월마다 가상 정기 선거가 있고, 득표 지표가 45 미만이면 권한을 평화롭게 넘깁니다. 장기 집권 분기를 고르면 선거가 중단되는 대신 매월 자유와 정당성을 잃고, 자유·정당성이 오르는 효과가 줄며, 학생·야당의 지지와 국제기구 관계가 꾸준히 떨어집니다. 과도 군정 기간에도 정당성 비용이 있습니다.</p>
  ${data.balance ? `<h3>높은 지표를 지키는 법</h3><p style="font-size:14px">지표가 ${data.balance.diminishing ? data.balance.diminishing.from : 60}을 넘으면 같은 효과도 덜 오르고(체감), 정당성·생활·자유·분배·안정·행정은 매월 기대 수준만큼 조금씩 내려갑니다(높아진 기대). 가상 사건의 보너스는 작게 잡혀 있어, 높은 지표는 정책·사업·예산으로 꾸준히 유지해야 합니다. 미리보기의 ‘기본’은 데이터에 적힌 값, 큰 숫자는 지금 실제로 더해질 값입니다.</p>` : ''}
  <h3>시간이 걸리는 결정</h3><p style="font-size:14px">의회 법안은 5~7개월 심의 뒤 표결합니다. 사업은 공기가 지나야 준공 효과가 납니다. 일부 사건 선택은 몇 달 뒤에 지연 효과를 남깁니다. 1979년 12월까지 끝낼 수 없는 사업·법안은 시작할 수 없습니다.</p>
  <h3>끝나는 방식</h3><p style="font-size:14px">부채 700 이상, 정당성 3 이하, 자유 3 이하는 즉시 위기 엔딩입니다. 그 밖에는 1979년 12월에 지표로 평가합니다. 엔딩 화면은 성장·권리·생활·환경을 따로 보여 줍니다.</p>
  <h3>역사와 가상</h3><p style="font-size:14px">'실제 역사' 상자는 출처가 있는 사실 요약입니다. '이 캠페인에서는' 상자와 모든 선택 결과·수치·선거·자문위원은 가상입니다. 경로가 달라지면 역사적 사건을 그대로 강제하지 않습니다.</p>`, actions: closeBtn('알겠습니다') };
}
function exportTextContent(m) {
  return { title: '저장 텍스트', body: `<p>아래 텍스트가 지금 진행(${esc(ym(state.turn))})의 저장 내용입니다. 복사해 메모나 .json 파일로 보관했다가 기록실의 ‘저장 텍스트 붙여넣기’나 ‘저장 파일 불러오기’로 이어 할 수 있습니다.</p>
  <label for="save-text" class="sr-only">저장 텍스트</label><textarea id="save-text" class="save-text" readonly spellcheck="false">${esc(E.exportSave(state))}</textarea>
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
  return { title: '저장 파일 불러오기', body: `<p><strong>${esc(m.name)}</strong></p><table><tbody><tr><td>시점</td><td class="n">${esc(ym(s.turn))}${s.ending ? ' · 종료됨' : ''}</td></tr><tr><td>권한</td><td class="n">${esc(PHASE[s.phase].name)}</td></tr><tr><td>시행 정책 · 진행 사업</td><td class="n">${s.policies.length} · ${s.projects.length}</td></tr><tr><td>저장 형식</td><td class="n">${m.migrated ? '버전 1 → 2로 변환' : '버전 2'}${m.fromData && m.fromData !== data.meta.version ? ` · 데이터 ${esc(m.fromData)} → ${esc(data.meta.version)}` : ''}</td></tr></tbody></table><p style="margin-top:10px">현재 진행을 이 파일의 상태로 바꿀까요?</p>`, actions: closeBtn('취소') + `<button type="button" class="btn primary" data-action="acceptImport" data-autofocus>불러오기</button>` };
}

/* ---------- 타이틀 ---------- */
function title() {
  const auto = state;
  return `<main class="title-screen" style="--cover:url('${art('cover')}')"><div class="title-card"><span class="kicker">THE REPUBLIC · 1960–1979</span><h1>대한민국<br>1960</h1><p class="sub">선택의 연대기</p>
  <p>한 달에 한 번, 사건을 결정하고 행동점수 셋을 씁니다. 권력에 이르는 길과 그 비용, 성장과 권리, 생활과 환경이 서로 다른 장부에 기록됩니다.</p>
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
  const pages = { overview, policy, assembly, build, budget, diplomacy, cabinet, archive };
  const endReason = E.endMonthReason(state);
  const pending = state.queue.length;
  $('#app').innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><span class="kicker">THE REPUBLIC</span><strong>1960</strong><small>선택의 연대기</small></div>
  <nav class="nav-list" aria-label="주 메뉴">${NAV.map(([id, t]) => `<button type="button" class="nav" data-action="nav" data-view="${id}" ${ui.view === id ? 'aria-current="page"' : ''}>${icon(id)}<span>${t}</span>${id === 'overview' && pending ? `<span class="badge" aria-label="결정할 사건 ${pending}건">${pending}</span>` : ''}</button>`).join('')}</nav>
  <div class="sidebar-note"><p>역사적 출발점에서 서로 다른 미래로.</p><small>가상 모형 · 오프라인 실행 · 데이터 ${esc(data.meta.version)}</small><div style="margin-top:10px">${btn('게임 방법', 'help', { cls: 'small quiet' })}</div></div></aside>
  <header class="topbar"><div class="when"><strong>${esc(ym(state.turn))}${state.ending ? ' · 종료' : ''}</strong><small>${esc(PHASE[state.phase].name)} · ${Math.min(state.turn, 240)} / 240개월</small></div>
  <div class="top-actions"><span class="pill" title="매월 행동점수 3">${apDots(state.ap)} <span>AP</span> <b>${state.ap}</b></span><span class="pill">국고 <b>${num(state.stats.treasury, 0)}</b></span><span class="pill desk-only">부채 <b>${num(state.stats.debt, 0)}</b></span>
  <span class="desk-only">${btn(`${icon('save')} 저장`, 'export', { cls: 'quiet', title: '저장 파일(JSON) 내보내기. 진행은 자동 저장도 됩니다.' })}</span><span class="desk-only">${primaryAction()}</span></div></header>
  <main class="main" id="main">${storageNote ? `<div class="notice bad">${esc(storageNote)}</div>` : ''}${ui.view !== 'overview' && pending ? `<div class="notice"><span>결정할 사건 ${pending}건이 남아 있습니다. 사건을 결정해야 다른 행동을 할 수 있습니다.</span>${btn('사건으로 이동', 'nav', { attrs: 'data-view="overview"', cls: 'small primary' })}</div>` : ''}
  ${pages[ui.view]()}<footer class="foot">실제 역사와 가상 반응을 구분한 독자 제작 게임 · 생성 삽화 · 모든 경제 수치는 가상 모형 값 · ${endReason && !state.ending ? `다음 달로 갈 수 없음: ${esc(endReason)}` : ''}</footer></main>
  <aside class="brief" aria-label="월별 브리핑">${brief()}</aside>
  <nav class="bottombar" aria-label="이번 달 행동">${apDots(state.ap)}${btn(`${icon('save')}<span>저장</span>`, 'export', { title: '저장 파일 내보내기' })}${primaryAction()}</nav></div>${modal()}${toastHtml()}`;
  afterRender(focusKey);
  if (scroller && !ui._scrollTop) scroller.scrollTop = y;
  ui._scrollTop = false;
  bindForms();
}
/** 상단·하단의 주 행동: 사건이 남았으면 사건으로, 끝났으면 엔딩으로, 아니면 다음 달로. */
function primaryAction() {
  if (state.ending) return btn('엔딩 평가 보기', 'nav', { cls: 'primary', attrs: 'data-view="overview"' });
  if (state.queue.length) return btn(`사건 ${state.queue.length}건 결정하기`, 'gotoEvent', { cls: 'primary', title: '이번 달 사건을 먼저 결정해야 다음 달로 갈 수 있습니다.' });
  return btn(`다음 달 → <small style="color:inherit">${esc(ym(state.turn + 1 > 239 ? 239 : state.turn + 1))}</small>`, 'endMonth', { cls: 'primary', reason: E.endMonthReason(state) });
}
function focusSignature(el) {
  if (!el || el === document.body || !el.dataset) return null;
  return ['action', 'id', 'view', 'mode', 'input'].map(k => el.dataset[k] || '').join('|') + '|' + (el.id || '');
}
function afterRender(focusKey) {
  const dialog = document.querySelector('[role="dialog"]');
  if (dialog) { (dialog.querySelector('[data-autofocus]') || dialog).focus(); return; }
  if (ui.focusMain) { ui.focusMain = false; const h = document.querySelector('#main h1, .title-card h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } return; }
  if (!focusKey) return;
  const match = [...document.querySelectorAll('[data-action],[data-input],input[id]')].find(el => focusSignature(el) === focusKey);
  if (match && !match.disabled) match.focus({ preventScroll: true });
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
  let migrated = false, fromData = ''; try { const p = JSON.parse(raw); migrated = p.version === 1; fromData = String(p.state.dataVersion); } catch { /* importSave가 이미 검사 */ }
  return { type: 'import', loaded, name, migrated, fromData };
}
function startNew() {
  const raw = ($('#seed-input')?.value || '').trim();
  let seed = raw ? Number(raw) : (Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0;
  if (raw && (!/^\d{1,10}$/.test(raw) || seed < 1 || seed > 4294967295)) { toast('시드는 1~4294967295의 정수여야 합니다.', { bad: true }); render(); return; }
  state = E.createState(data, seed); ui.screen = 'game'; ui.view = 'overview'; ui.modal = null; ui.budgetDraft = null; ui.focusMain = true; save();
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
    case 'nav': ui.view = el.dataset.view; ui.toast = null; ui._scrollTop = true; if (state && !state.visited.includes(ui.view)) { state = { ...state, visited: [...state.visited, ui.view] }; save(); } render(); window.scrollTo({ top: 0 }); ui.focusMain = true; afterRender(null); return;
    case 'policyCat': ui.policyCat = id; return render();
    case 'policyStatus': ui.policyStatus = id; return render();
    case 'projectAll': ui.projectAll = !ui.projectAll; return render();
    case 'logFilter': ui.logFilter = id; return render();
    case 'region': ui.region = id; return render();
    case 'metric': ui.modal = { type: 'metric', id }; return render();
    case 'report': ui.modal = { type: 'report' }; return render();
    case 'help': ui.modal = { type: 'help' }; return render();
    case 'closeModal': ui.modal = null; return render();
    case 'dismissToast': ui.toast = null; return render();
    case 'continue': ui.screen = 'game'; ui.focusMain = true; return render();
    case 'newgame': ui.modal = { type: 'newgame' }; return render();
    case 'startNew': return startNew();
    case 'acceptImport': state = ui.modal.loaded; ui.modal = null; ui.screen = 'game'; ui.view = 'overview'; ui.budgetDraft = null; save(); toast(`저장 파일을 불러왔습니다 (${ym(state.turn)}).`); return render();
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
    case 'gotoEvent': { ui.view = 'overview'; ui._scrollTop = true; render(); const first = document.querySelector('.choice:not([aria-disabled="true"])'); if (first) { first.scrollIntoView({ block: 'center' }); first.focus({ preventScroll: true }); } return; }
    case 'endMonth': if (ui.modal) return; run({ type: 'endMonth' }); return;
    case 'askPolicy': return openConfirm({ type: 'policy', id });
    case 'askProject': return openConfirm({ type: 'project', id, regionId: ui.region });
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
});

/* ---------- 시작 ---------- */
const loaded = loadAutosave();
if (loaded) { state = loaded.state; savedInfo = { turn: state.turn }; if (loaded.migrated) { save(); storage.remove(LEGACY_KEY); toast('이전 버전(1)의 자동 저장을 새 형식으로 옮겼습니다.'); } }
render();
/* 검토용 디버그 훅: 상태 복사본과 dispatch. 배포판에서는 지워도 된다. */
globalThis.__GAME_DEBUG__ = { getState: () => state && JSON.parse(JSON.stringify(state)), data, engine: E, dispatch: a => run(a), ui };
