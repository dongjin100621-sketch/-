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
  <div class="kpis">${['gdp', 'unemployment', 'inflation', 'reserves'].map(id => kpi(id)).join('')}
  <div class="kpi plain"><span>무역 역량 <small>물량 기준</small></span><strong>${num(used * 100, 0)}%</strong><small class="delta ${used > .9 ? 'bad' : 'flat'}">${num(t.used, 1)} / ${num(t.capacity, 1)}${used > .9 ? ' · 항만이 모자람' : ''}</small></div>
  <div class="kpi plain"><span>교역 <small>재정점/월</small></span><strong>${signed(t.exports - t.imports, 1)}</strong><small class="delta flat">수출 ${num(t.exports, 1)} · 수입 ${num(t.imports, 1)}</small></div></div>
  <div class="market-grid"><article class="panel market-table"><div class="row"><h2>상품 ${list.length}종</h2><div class="filters" role="group" aria-label="상품 분류" style="margin:0">${GOOD_CATS.map(([id, n]) => `<button type="button" class="btn small" data-action="goodCat" data-id="${id}" aria-pressed="${ui.goodCat === id}">${n}</button>`).join('')}</div></div>
  <div data-scroll-x><table class="goods"><thead><tr><th scope="col">상품</th><th scope="col" class="n">판매 주문</th><th scope="col" class="n">구매 주문</th><th scope="col">수지</th><th scope="col">시장 가격 <small>기준 대비</small></th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>
  <small class="muted">이번 달 결산에 들어갈 주문입니다. 가격은 지난 결산 값이고 ▲▼는 다음 결산의 방향입니다. 가격은 기준가격의 ${pctS(X.floor)}~${pctS(X.ceiling)} 안에서 움직입니다. 행을 누르면 누가 팔고 누가 사는지 봅니다.</small></article>
  ${goodDetail(ui.good || 'grain', R)}</div>`;
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
  return `<article class="panel good-detail" aria-live="polite"><div class="row"><h2>${gmark(id)} ${esc(g.name)}</h2><span class="tag">${esc(GOOD_CATS.find(c => c[0] === g.category)[1])}</span></div><p style="font-size:13.5px">${esc(g.description)}</p>
  <div class="kv"><span>시장 가격</span><b>${num(x.price, 1)} <small class="pct ${r > .1 ? 'hi' : r < -.1 ? 'lo' : ''}">${pctS(r)}</small></b></div><div class="kv"><span>기준가격 · 다음 결산 예상</span><b>${num(g.price, 0)} · ${num(x.next, 1)}</b></div>
  ${g.world ? `<div class="kv"><span>세계 가격${tariff ? ` · 관세 ${Math.round(tariff * 100)}%` : g.world.noTariff ? ' · 무관세' : ''}</span><b>${num(x.world, 1)}</b></div><div class="kv"><span>이 값보다 비싸면 수입 · 싸면 수출</span><b>${num(x.world * (1 + tariff + E0.tradeCost), 1)} · ${g.world.export > 0 ? num(x.exportParity, 1) : '수출 없음'}</b></div>` : '<div class="kv"><span>세계 시장</span><b>교역하지 않는 상품</b></div>'}
  ${h.length > 1 ? `<svg class="spark" viewBox="0 0 300 52" role="img" aria-label="${esc(g.name)} 가격의 지난 ${h.length}개월 추이: 기준 대비 ${pctS(h[0])}에서 ${pctS(h.at(-1))}"><line class="axis-base" x1="10" y1="${py(0)}" x2="290" y2="${py(0)}" stroke-dasharray="3 4"/><polyline fill="none" points="${h.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')}"/></svg><small class="muted">지난 ${h.length}개월 · 점선이 기준가격</small>` : ''}
  <h3>판매 주문 ${qty(x.supply)}</h3>${line('건물 산출', x.sup.buildings, names(makers))}${line('자급 농가', x.sup.subsistence)}${line('수입', x.sup.imports)}${x.supply < .05 ? '<p class="muted">파는 곳이 없습니다.</p>' : ''}
  <h3>구매 주문 ${qty(x.demand)}</h3>${line('가계 소비', x.dem.pops)}${line('건물 투입', x.dem.industry, names(users.filter(([b]) => !bdef(b).gov)))}${line('정부·군', x.dem.government)}${line('건설 자재', x.dem.construction)}${line('수출', x.dem.exports, g.world && g.world.export > 0 ? `한도 ${qty(x.exportCap)}` : '')}${x.demand < .05 ? '<p class="muted">사는 곳이 없습니다.</p>' : ''}
  ${x.shortage > 0 ? `<p class="reason" role="note">공급 부족: 이 상품을 투입재로 쓰는 건물의 생산이 최대 ${Math.round(x.shortage * 100)}%까지 깎입니다. 만드는 건물을 늘리거나 수입 여건(무역 역량·관세·외환)을 고치세요.</p>` : ''}
  <h3>이 상품을 만드는 건물</h3>${buildable.length ? `<div class="row" style="justify-content:flex-start;flex-wrap:wrap;gap:6px">${buildable.map(b => btn(`${esc(b.name)} <small>전국 ${E.econ.levelsOf(state, [b.id])}단계</small>`, 'nav', { attrs: `data-view="build" data-focus="${b.id}"`, cls: 'small' })).join('')}</div>` : '<p class="muted">나라 안에서 만들 수 없어 전량 수입합니다.</p>'}</article>`;
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
  return `<li class="brow" id="b-${b.id}"><div class="b-head"><strong>${esc(def.name)}</strong> <span class="tag">${BCAT[def.category]}</span> <span class="lv">${b.level}단계</span>${b.state > 0 && def.private !== false ? ` <small>국영 ${b.state}</small>` : ''}${rec && rec.access < 1 ? ` <span class="flag short" title="권역 기반 시설 용량이 모자라 생산이 깎인다">접근성 ${Math.round(rec.access * 100)}%</span>` : ''}${rec && rec.short < 1 ? ` <span class="flag short" title="투입재 공급 부족">투입 부족 −${Math.round((1 - rec.short) * 100)}%</span>` : ''}</div>
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
  <article class="panel"><h2>권역 선택</h2><div class="region-board" role="group" aria-label="권역">${data.regions.map(x => `<button type="button" class="region" data-action="region" data-id="${x.id}" aria-pressed="${ui.region === x.id}" style="grid-column:${x.mapCol + 1};grid-row:${x.mapRow + 1}" aria-label="${esc(x.name)}, 개발도 ${num(E.regionDevelopment(state, data, x.id), 0)}, 건물 ${lv(x.id)}단계, 시장 접근성 ${Math.round(R.infra[x.id].access * 100)}%"><strong>${esc(x.name)}${E.regionEdict(state, x.id) ? ' <span class="edict-dot">시책</span>' : ''}</strong><small>건물 ${lv(x.id)} · 개발 ${num(E.regionDevelopment(state, data, x.id), 0)}</small>${R.infra[x.id].access < 1 ? `<small class="pct hi">접근성 ${Math.round(R.infra[x.id].access * 100)}%</small>` : ''}${state.construction.some(q => q.regionId === x.id) ? '<small>공사 중</small>' : ''}</button>`).join('')}</div>
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
  const wish = data.lawGroups.map(lg => { const cur = lawOf(state.laws[lg.id]), best = data.laws.filter(l => l.group === lg.id).sort((a, b) => (b.stances[g.id] || 0) - (a.stances[g.id] || 0))[0]; return (best.stances[g.id] || 0) > (cur.stances[g.id] || 0) ? `<li><button type="button" class="linkish" data-action="nav" data-view="laws" data-group="${lg.id}">${esc(lg.name)}: ${esc(best.name)}</button> <small>현행 ${esc(cur.name)} · ${stanceText(cur.stances[g.id] || 0)}</small></li>` : ''; }).join('');
  const traitText = t => [...Object.entries(t.modifiers).map(([k, val]) => `${MOD_NAME[k] || k} ${pctS(val * t.scale)}`), ...Object.entries(t.monthly).map(([k, val]) => `${mlabel(k)} 매월 ${signed(val * t.scale, 2)}`)].join(' · ');
  return `<article class="panel card group ${st}"><div class="head"><span class="initial" aria-hidden="true">${esc(g.mark)}</span><div><h2>${esc(g.name)}</h2><span class="tag ${st === 'angry' || st === 'unhappy' ? 'warn' : st === 'happy' || st === 'loyal' ? 'ok' : ''}">${STATE_NAME[st]}</span>${inGov ? ' <span class="tag history">집권 연합</span>' : ''}${scale > 1 ? ' <span class="tag">강력</span>' : scale === 0 ? ' <span class="tag">소외</span>' : ''}</div></div>
  <p style="font-size:13.5px">${esc(g.description)}</p>
  <div class="kv"><span>지지도</span><b>${num(v, 0)} <small class="delta ${dv > 0 ? 'good' : dv < 0 ? 'bad' : 'flat'}" style="display:inline">${arrow(dv)}${signed(dv, 1)}</small></b></div>
  <div class="approval" role="img" aria-label="지지도 ${num(v, 0)}. ${th.angry} 미만 분노, ${th.unhappy} 미만 불만, ${th.happy} 이상 만족, ${th.loyal} 이상 충성"><i class="zone bad" style="width:${th.unhappy}%"></i><i class="zone good" style="left:${th.happy}%;width:${100 - th.happy}%"></i><i class="mark" style="left:${v}%"></i><i class="goal" style="left:${p.target}%" title="목표 ${num(p.target, 0)}"></i></div>
  <div class="kv"><span>세력 <small>법률 제정에 쓰인다</small></span><b>${num(x.clout * 100, 1)}%</b></div><div class="kv"><span>투표 비중 <small>선거에 쓰인다</small> · 인구</span><b>${num(x.vote * 100, 1)}% · ${qty(pop.pop)}</b></div>
  <div class="kv"><span>생활수준 <small>기대 ${num(p.expect, 1)}</small></span><b>${num(pop.sol, 1)}</b></div>
  <span class="fx-title">지지도가 향하는 값 ${num(p.target, 0)} = 50 +</span><ul class="fx">${part('현행 법률', p.law)}${part('요구', p.demands)}${part('생활수준', p.living)}${part(inGov ? '집권 연합' : '연합 밖', p.gov)}${part('사건·개혁의 여파', p.mod)}</ul>
  <span class="fx-title">요구하는 건물</span><ul class="demands">${demands.map(dm => `<li class="${dm.met ? 'met' : 'unmet'}"><span>${dm.met ? '✓' : '✗'} ${esc(dm.text)}</span><b>${dm.have} / ${dm.need}단계</b><small>${dm.met ? '+' : '−'}${dm.weight}</small></li>`).join('')}</ul>
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

