"""game/app.mjs를 엔진 v3(시장·건설·법률·이해집단)에 맞춘다. 한 번 쓰는 패치."""
from pathlib import Path
ROOT = Path('/home/user/-/korea1960')
p = ROOT / 'game/app.mjs'; s = p.read_text(encoding='utf-8')
views = (ROOT / 'tools/dev/ui_views.wip.js').read_text(encoding='utf-8')

def rep(a, b, n=1):
    global s
    assert s.count(a) >= 1, 'not found: ' + a[:90]
    s = s.replace(a, b, n) if n else s.replace(a, b)
def block(start, end, new):
    global s
    a = s.index(start); b = s.index(end, a + len(start)); s = s[:a] + new + s[b:]

rep("/* 대한민국 1960: 선택의 연대기 — 화면 v2\n", "/* 대한민국 1960: 선택의 연대기 — 화면 v3 (시장·건물·법률·이해집단 화면 추가)\n")
rep("const STORE_KEY = 'korea1960.game.v2', LEGACY_KEY = 'korea1960.reference.v1', BACKUP_KEY = 'korea1960.game.v2.unreadable';",
    "const STORE_KEY = 'korea1960.game.v3', OLD_KEYS = ['korea1960.game.v2', 'korea1960.reference.v1'], BACKUP_KEY = 'korea1960.game.v3.unreadable';")

block("const METRIC_HELP = {", "/** 데이터의 밸런스 규칙(balance)에서 지표별 설명을 만든다.", r'''const pct = v => `${+(v * 100).toFixed(2)}%`;
const EK = data.economy;
const METRIC_HELP = {
  gdp: '건물이 만든 부가가치(산출의 값 − 투입의 값)에 자급 농가의 산출과 정부 인건비를 더해 1960년 1월을 100으로 놓은 지수. 값이 오른 상품을 더 만들수록, 더 많은 사람이 일할수록 오른다.',
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
''')
block("function metricHelp(id) {", "const PHASE = {", r'''function metricHelp(id) {
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
''')
block("const PHASE = {", "/* ---------- 상태 ---------- */", r'''const PHASE = {
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
const NAV = [['map', '지도'], ['overview', '상황판'], ['laws', '법률'], ['groups', '이해집단'], ['policy', '정책'], ['market', '시장'], ['build', '건물·건설'], ['budget', '재정'], ['diplomacy', '외교'], ['cabinet', '내각 자문'], ['archive', '기록실']];
const NAV_GROUPS = [['국정', ['map', 'overview', 'laws', 'groups', 'policy']], ['경제·지역', ['market', 'build', 'budget']], ['대외·인사', ['diplomacy', 'cabinet']], ['기록', ['archive']]];
/** 새 화면은 기존 아이콘을 함께 쓴다(새 그림 파일을 만들지 않았다). */
const NAV_ICON = { market: 'growth', laws: 'assembly', groups: 'rights' };

''')
rep("policyCat: '전체', policyStatus: 'all', projectAll: false, logFilter: 'all',", "policyCat: '전체', policyStatus: 'all', buildAll: false, goodCat: 'all', good: null, lawGroup: null, logFilter: 'all',")
block("function loadAutosave() {", "function importSave(raw)", r'''function loadAutosave() {
  const raw = storage.get(STORE_KEY);
  if (raw) {
    try { return { state: importSave(raw) }; }
    catch (e) { storage.set(BACKUP_KEY, raw); storageNote = `자동 저장을 읽지 못했습니다(${e.message}). 원본은 브라우저에 별도로 보관했습니다.`; }
  } else if (OLD_KEYS.some(k => storage.get(k))) storageNote = `이 브라우저에 이전 판의 자동 저장이 남아 있습니다. ${E.OLD_SAVE_MESSAGE} 새 연대기를 시작하세요(이전 저장은 지우지 않았습니다).`;
  return null;
}
''')
rep("  if (rep.bills.length) notes.push(`법안 ${rep.bills.map(b => `${byId('policies', b.policyId).name} ${b.status === 'passed' ? '가결' : '부결'}`).join(', ')}`);\n  if (rep.completed.length) notes.push(`준공 ${rep.completed.map(x => byId('projects', x.projectId).name).join(', ')}`);",
    "  if (rep.laws.length) notes.push(`법률 ${rep.laws.map(x => `${byId('laws', x.lawId).name} ${LAW_RESULT[x.result]}`).join(', ')}`);\n  if (rep.completed.length) notes.push(`준공 ${rep.completed.map(x => byId('buildings', x.buildingId).name + (x.private ? '(민간)' : '')).join(', ')}`);")
rep("<span>${esc(byId('factions', id).name)} 지지</span>", "<span>${esc(byId('interestGroups', id).name)} 지지</span>")
rep("  const passed = state.bills.filter(b => b.status === 'passed').length, failed = state.bills.filter(b => b.status === 'failed').length;\n  out.push(`시행 정책 ${state.policies.length}개`, `법안 가결 ${passed} · 부결 ${failed}`, `준공 사업 ${state.projects.filter(p => p.status === 'complete').length}개`);",
    "  out.push(`시행 정책 ${state.policies.length}개`, `제정한 법률 ${state.counters.lawsEnacted}개 · 폐기 ${state.counters.lawsFailed}`, `정부 건설 ${state.counters.built}단계 · 민간 투자 ${state.counters.privateBuilt}단계`);")
rep("exec ? '정책·사업·외교·자문에 행동점수를 쓴다'", "exec ? '건설·법률·정책·외교에 행동점수를 쓴다'")
rep("exec ? '정책과 사업을 검토하고 남은 행동점수를 사용하세요.", "exec ? '시장에서 모자란 상품을 보고 건물을 올리거나, 법률과 정책을 검토하며 남은 행동점수를 사용하세요.")
rep("${exec ? btn('정책 검토', 'nav', { attrs: 'data-view=\"policy\"' }) + btn('사업 검토', 'nav', { attrs: 'data-view=\"build\"' }) : ''}", "${exec ? btn('시장', 'nav', { attrs: 'data-view=\"market\"' }) + btn('건물·건설', 'nav', { attrs: 'data-view=\"build\"' }) + btn('법률', 'nav', { attrs: 'data-view=\"laws\"' }) : ''}")

block("function overview() {", "/* ---------- 화면: 지도 ----------", r'''function overview() {
  const p = state.ending ? { name: '연대기 종료', desc: `${ym(Math.min(state.ending.turn, 239))}에 연대기가 끝났습니다. 더 이상 행동할 수 없으며, 기록과 지표를 읽거나 저장 파일을 내보낼 수 있습니다.`, can: ['연대기·출처 읽기', '저장 내보내기', '새 연대기 시작'], cannot: '' } : PHASE[state.phase];
  const R = eco(), ranked = [...data.goods].filter(g => R.goods[g.id].demand > 1).sort((a, b) => R.goods[b.id].ratio - R.goods[a.id].ratio);
  const chipFor = g => { const x = R.goods[g.id], r = x.price / g.price - 1; return `<button type="button" class="gbtn" data-action="nav" data-view="market" data-good="${g.id}">${gmark(g.id)}${esc(g.name)} <b class="pct ${r > .1 ? 'hi' : r < -.1 ? 'lo' : ''}">${pctS(r)}</b></button>`; };
  return `<div class="page-head"><div><span class="eyebrow">NATIONAL BRIEF · 국가 브리핑</span><h1>${esc(ym(state.turn))}, 선택은 기록으로 남는다</h1></div><span class="tag fiction">모든 지표는 가상 모형 값</span></div>
  <div class="ov"><div class="kpis ov-kpis">${['gdp', 'unemployment', 'legitimacy', 'liberty', 'welfare', 'treasury'].map(id => kpi(id)).join('')}</div>
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

''')
rep(" * 화면 한가운데의 권역 지도. 권역을 개발도·농업 잠재력·사업 슬롯 중 하나로 칠하고, 사업은 권역 이름표 아래 표식으로 보인다.", " * 화면 한가운데의 권역 지도. 권역을 개발도·지형과 자원·경지 사용·시장 접근성 중 하나로 칠하고, 공사 중인 건물은 권역 이름표 아래 표식으로 보인다.")
block("const MAP_LAYERS = {", "/* ---------- 권역: 지형·자원, 지역 시책, 고유 사업(데이터 1.3.0) ---------- */", "const regionLevels = id => state.buildings.reduce((a, b) => a + (b.regionId === id ? b.level : 0), 0);\nconst MAP_LAYERS = { dev: ['개발도', id => E.regionDevelopment(state, data, id)], res: ['지형·자원', id => E.regionTags(data, id).length], farm: ['경지 사용', id => (E.econ.findBuilding(state, 'farm', id)?.level || 0) / byId('regions', id).arable * 100], access: ['시장 접근성', id => eco().infra[id].access * 100] };\n")
rep("/* ---------- 권역: 지형·자원, 지역 시책, 고유 사업(데이터 1.3.0) ---------- */", "/* ---------- 권역: 지형·자원, 지역 시책 ---------- */")
rep("const r = byId('regions', regionId), cur = E.regionEdict(state, regionId), cap = E.edictCap(state);", "const r = byId('regions', regionId), cur = E.regionEdict(state, regionId), cap = E.edictCap(state, data);")
rep("${e.buildDiscount ? ` · 이 권역 사업 착수비 ${Math.round(e.buildDiscount * 100)}% 감면` : ''}</small><span class=\"fx-title\">매월</span>", "${e.constructionBonus ? ` · 이 권역 공사 ${Math.round(e.constructionBonus * 100)}% 빠름` : ''}</small><span class=\"fx-title\">매월</span>")
rep("${e.buildDiscount ? ` · 착수비 ${Math.round(e.buildDiscount * 100)}% 감면` : ''}${e.maxDevelopment", "${e.constructionBonus ? ` · 공사 ${Math.round(e.constructionBonus * 100)}% 빠름` : ''}${e.maxDevelopment")
block("/** 권역의 지형·자원을 쓰는 고유 사업 목록(지도 권역 카드용). */", "/** 지도 위 권역 표식: 지형·자원 글자 배지", "")
block("function projectMarks(id) {", "function mapSvg() {", r'''/** 지도 위 공사 표식: 권역에서 진행 중인 공사마다 원 하나, 테두리가 공정. */
function buildMarks(id) {
  const [ax, ay] = MAP.anchors[id], list = state.construction.filter(q => q.regionId === id).slice(0, 4), C = 2 * Math.PI * 7.5;
  return list.map((q, i) => {
    const def = bdef(q.id), x = ax + (i - (list.length - 1) / 2) * 21, y = ay + 31, prog = Math.min(1, q.progress / def.cost);
    return `<g class="pmark building ${q.private ? 'private' : ''}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><title>${esc(def.name)} 공사 중 ${Math.round(prog * 100)}%${q.private ? ' (민간 투자)' : ''}</title><circle r="9.5" class="pm-bg"/><circle r="7.5" class="pm-arc" stroke-dasharray="${(prog * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90)"/></g>`;
  }).join('');
}
''')
rep("const v = layerValue(r.id), sel = ui.mapRegion === r.id, used = state.projects.filter(p => p.regionId === r.id).length, cur = E.regionEdict(state, r.id);", "const v = layerValue(r.id), sel = ui.mapRegion === r.id, used = regionLevels(r.id), cur = E.regionEdict(state, r.id);")
rep(" · 사업 ${used}/${r.slots}${cur ?", " · 건물 ${used}단계${cur ?")
rep("${data.regions.map(r => res ? regionBadges(r.id) : projectMarks(r.id)).join('')}", "${data.regions.map(r => res ? regionBadges(r.id) : buildMarks(r.id)).join('')}")
block("function regionCard(id) {", "function mapView() {", r'''function regionCard(id) {
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
''')
rep("<small>● 자원 · ■ 지형 · 권역을 누르면 고유 사업과 지역 시책을 볼 수 있습니다 · 게임용 단순화</small>", "<small>● 자원 · ■ 지형 · 자원이 있는 권역에만 지을 수 있는 건물이 있습니다 · 권역을 누르면 건물과 지역 시책을 봅니다 · 게임용 단순화</small>")
rep("<small>${esc(layerName)} · ◇ 운영 중 사업 · ◯ 공사 중(테두리=공정) · '시책' 표시는 지역 시책 시행 중 · 권역 경계는 게임용이며 당시 행정구역이 아님</small>", "<small>${esc(layerName)} · ◯ 공사 중인 건물(테두리=공정) · '시책' 표시는 지역 시책 시행 중 · 권역 경계는 게임용이며 당시 행정구역이 아님</small>")
rep("지도 자료(assets/map/korea_map.json)를 읽지 못했습니다. 상황판과 사업·권역 화면은 그대로 쓸 수 있습니다.", "지도 자료(assets/map/korea_map.json)를 읽지 못했습니다. 상황판과 건물·건설 화면은 그대로 쓸 수 있습니다.")

block("/* ---------- 화면: 정책 ---------- */", "/* ---------- 화면: 의회 ---------- */", r'''/* ---------- 화면: 정책 ---------- */
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

''')
block("/* ---------- 화면: 의회 ---------- */", "/* ---------- 화면: 재정 ---------- */", views)
block("function budget() {", "/* ---------- 화면: 외교 ---------- */", r'''function budget() {
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

''')
rep("손상된 파일은 일부만 반영하지 않고 거부합니다.</p>", "손상된 파일은 일부만 반영하지 않고 거부합니다. 이전 판(저장 형식 1~4)의 저장은 경제 구조가 달라 불러올 수 없습니다.</p>")
rep("<p style=\"font-size:13.5px\">독자 제작 게임입니다. 참조 게임의 코드·화면·대사·수치·이미지를 쓰지 않았습니다.", "<p style=\"font-size:13.5px\">독자 제작 게임입니다. 시장·건설·법률·이해집단의 규칙 틀은 잘 알려진 전략 게임의 구조를 따르되, 상품·건물·법률·수치와 화면은 이 게임을 위해 새로 만들었고 참조 게임의 코드·화면·대사·수치·이미지를 쓰지 않았습니다.")

block("function agenda() {", "/** 하단 연대기 막대: 최근 기록 세 건. */", r'''function agenda() {
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
''')

block("function confirmContent(m) {", "function metricContent(id) {", r'''function confirmContent(m) {
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
  ${mk ? `<h3>시장</h3><table><tbody><tr><td>생산 지수 · 실업률</td><td class="n">${num(mk.gdp, 1)} · ${num(mk.unemployment, 1)}%</td></tr><tr><td>물가 지수 <small>1960년 가계 소비 기준 100</small></td><td class="n">${num(mk.cpi * 100, 0)}</td></tr><tr><td>수출 · 수입</td><td class="n">${num(mk.exports, 1)} · ${num(mk.imports, 1)}</td></tr><tr><td>건설점 쓰임 / 만든 양</td><td class="n">${num(mk.used, 1)} / ${num(mk.points, 1)}</td></tr><tr><td>민간 투자기금</td><td class="n">${num(mk.pool, 1)}</td></tr></tbody></table>` : ''}
  ${events.length ? `<h3>이번 달에 일어난 일</h3><ul class="stack" style="font-size:14px">${events.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
  <h3>지표 변화와 원인 <small>(항목을 누르면 원인별 기여)</small></h3>${changes.map(([k, v]) => `<details><summary><span>${esc(mlabel(k))}</span><span class="delta ${tone(k, v)}">${arrow(v)} ${signed(v, Math.abs(v) < .1 ? 3 : 2)}</span><small>${num(state.stats[k], digits(k))}</small></summary><ul>${(r.ledger[k] || []).map(([src, dv]) => `<li><span>${esc(src)}</span><span>${signed(dv, 3)}</span></li>`).join('')}</ul></details>`).join('') || '<p>변화 없음</p>'}
  ${support.length ? `<h3>이해집단의 지지 변화</h3><ul class="fx">${support.map(([id, v]) => `<li class="${v >= 0 ? 'good' : 'bad'}"><span>${esc(byId('interestGroups', id).name)}</span><b>${arrow(v)} ${signed(v, 1)}</b><small>${num(state.support[id], 0)}</small></li>`).join('')}</ul>` : ''}
  <h3>${state.ending ? '연대기 종료' : `${esc(ym(state.turn))} 시작`}</h3><p style="font-size:14px">${state.ending ? `<b>${esc(state.ending.title)}</b> — 상황판에서 엔딩 평가를 확인하세요.` : next.length ? `결정할 사건: <b>${next.map(esc).join(', ')}</b>` : '이번 달에는 정해진 사건이 없습니다.'} 행동점수 3을 회복했습니다.</p>`;
  return { title: `${esc(ym(r.turn))} 결산`, body, actions: `<button type="button" class="btn primary" data-action="closeModal" data-autofocus>${state.ending ? '엔딩 평가 보기' : `${esc(ym(state.turn))} 업무 시작`}</button>` };
}
''')
block("function helpContent() {", "function exportTextContent(m) {", r'''function helpContent() {
  const X = data.economy, A = X.approval, th = A.thresholds;
  return { title: '게임 방법', body: `<p>1960년 1월 1일부터 1979년 12월 31일까지 시간이 하루씩 흐릅니다(한 틱 = 하루). 나라의 경제와 지표는 매달 말일에 한 번 결산합니다(240번). 플레이어는 박정희라는 역사적 출발점에 있지만, 1960년에는 대통령 권한이 없습니다.</p>
  <h3>시간</h3><p style="font-size:14px">위쪽 시계의 <b>진행</b>(스페이스)으로 시간을 흐르게 하고 다시 누르면 멈춥니다. 배속은 ×1(하루 0.7초)·×2·×4·×8이며 숫자 키 1~4로도 바꿉니다. 매달 1일에 사건이 오면 시계가 스스로 멈추고, 결정하면 다시 흐릅니다. <b>건너뛰기</b>는 이번 달 남은 날을 넘겨 바로 결산하고 결산 창을 엽니다.</p>
  <h3>한 달에 하는 일</h3><ol class="steps"><li><span>1일에 온 사건 문서에서 선택지 하나를 고릅니다. 선택은 행동점수를 쓰지 않습니다.</span></li><li><span>행동점수 3을 건물 착공·법률 발의·집권 연합·정책·외교·자문·상환에 씁니다. 생산방식 변경, 보조금, 대기열 순서, 예산 배분은 행동점수를 쓰지 않습니다.</span></li><li><span>말일이 지나면 결산합니다. '이번 달 업무'의 <b>결산 보기</b>로 무엇이 얼마나, 왜 바뀌었는지 확인하세요.</span></li></ol>
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
''')
rep("<tr><td>시행 정책 · 진행 사업</td><td class=\"n\">${s.policies.length} · ${s.projects.length}</td></tr><tr><td>저장 형식</td><td class=\"n\">${m.migrated ? `버전 ${m.migrated} → ${E.SAVE_VERSION}${roParticle(E.SAVE_VERSION)} 변환` : `버전 ${E.SAVE_VERSION}`}${m.fromData && m.fromData !== data.meta.version ? ` · 데이터 ${esc(m.fromData)} → ${esc(data.meta.version)}` : ''}</td></tr>",
    "<tr><td>시행 정책 · 건물 단계 · 제정한 법률</td><td class=\"n\">${s.policies.length} · ${s.buildings.reduce((a, b) => a + b.level, 0)} · ${s.counters.lawsEnacted}</td></tr><tr><td>저장 형식</td><td class=\"n\">버전 ${E.SAVE_VERSION} · 데이터 ${esc(s.dataVersion)}</td></tr>")
rep("  const pages = { map: mapView, overview, policy, assembly, build, budget, diplomacy, cabinet, archive };", "  const pages = { map: mapView, overview, market, build, laws, groups, policy, budget, diplomacy, cabinet, archive };")
rep("${ui.view === id ? 'aria-current=\"page\"' : ''}>${icon(id)}<span>${t}</span>", "${ui.view === id ? 'aria-current=\"page\"' : ''}>${icon(NAV_ICON[id] || id)}<span>${t}</span>")
rep("return ['action', 'id', 'view', 'mode', 'input'].map(k => el.dataset[k] || '').join('|') + '|' + (el.id || '');", "return ['action', 'id', 'view', 'mode', 'input', 'region', 'pm'].map(k => el.dataset[k] || '').join('|') + '|' + (el.id || '');")
rep("    case 'nav': if (el.dataset.region) { ui.region = el.dataset.region; ui.mapRegion = el.dataset.region; } ui.view = el.dataset.view; ui.toast = null; ui._scrollTop = true; if (state && !state.visited.includes(ui.view)) { state = { ...state, visited: [...state.visited, ui.view] }; save(); } render(); window.scrollTo({ top: 0 }); ui.focusMain = true; afterRender(null); return;",
    "    case 'nav': {\n      if (el.dataset.region) { ui.region = el.dataset.region; ui.mapRegion = el.dataset.region; }\n      if (el.dataset.group) ui.lawGroup = el.dataset.group; if (el.dataset.good) ui.good = el.dataset.good; if (el.dataset.focus) ui.buildAll = true;\n      ui.view = el.dataset.view; ui.toast = null; ui._scrollTop = true; if (state && !state.visited.includes(ui.view)) { state = { ...state, visited: [...state.visited, ui.view] }; save(); }\n      render(); window.scrollTo({ top: 0 }); ui.focusMain = true; afterRender(null);\n      const target = el.dataset.focus && (document.getElementById('c-' + el.dataset.focus) || document.getElementById('b-' + el.dataset.focus)); if (target) target.scrollIntoView({ block: 'center' });\n      return;\n    }")
rep("    case 'projectAll': ui.projectAll = !ui.projectAll; return render();", "    case 'buildAll': ui.buildAll = !ui.buildAll; return render();\n    case 'goodCat': ui.goodCat = id; return render();\n    case 'good': ui.good = id; return render();\n    case 'lawGroup': ui.lawGroup = id; return render();")
rep("    case 'askProject': return openConfirm({ type: 'project', id, regionId: el.dataset.region || ui.region });",
    "    case 'askBuild': return openConfirm({ type: 'build', id, regionId: el.dataset.region || ui.region });\n    case 'cancelBuild': return openConfirm({ type: 'cancelBuild', index: Number(id) });\n    case 'prioritize': run({ type: 'prioritize', index: Number(id) }); return;\n    case 'pm': run({ type: 'pm', id, regionId: el.dataset.region, pm: Number(el.dataset.pm) }); return;\n    case 'subsidy': run({ type: 'subsidy', id, regionId: el.dataset.region }); return;\n    case 'askPrivatize': return openConfirm({ type: 'privatize', id, regionId: el.dataset.region });\n    case 'askDownsize': return openConfirm({ type: 'downsize', id, regionId: el.dataset.region });\n    case 'askEnact': return openConfirm({ type: 'enact', id });\n    case 'askCancelEnact': return openConfirm({ type: 'cancelEnact' });\n    case 'askCoalition': return openConfirm({ type: 'coalition', id });")
rep("if (loaded) { state = loaded.state; savedInfo = { turn: state.turn }; if (loaded.migrated) { save(); storage.remove(LEGACY_KEY); toast('이전 버전(1)의 자동 저장을 새 형식으로 옮겼습니다.'); } }", "if (loaded) { state = loaded.state; savedInfo = { turn: state.turn }; }")
p.write_text(s, encoding='utf-8')
print('patched', len(s))
