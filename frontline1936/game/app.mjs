/* 전선과 공장: 동아시아 1936 — 화면 0.1
 * 입력을 engine.dispatch로 보내고 돌려받은 상태만 그린다. 지도는 SVG 하나를 만들어 두고 색·부대 층만 고친다. */
import * as E from './engine.mjs';
import { index, mods, fmtDate, dateOf, atWar, friendly, isAtWar, enemiesOf, clamp, sum, distance, yearOf } from './core.mjs';

const data = globalThis.__DATA__ || await (await fetch('../data/game.json')).json();
const MAP = globalThis.__MAP__ || await (await fetch('../data/map.json')).json();
const X = index(data);
const ARTIFACT = globalThis.__EMBED__ === 'artifact';
const SAVE_KEY = 'frontline1936.save.v1';
const $ = sel => document.querySelector(sel);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, n = 0) => Number(v || 0).toLocaleString('ko-KR', { maximumFractionDigits: n, minimumFractionDigits: n });
const pct = (v, n = 0) => `${num(v * 100, n)}%`;
const people = v => v >= 1e4 ? `${num(v / 1e4, v >= 1e5 ? 0 : 1)}만` : num(v);
const bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${clamp(v, 0, 1) * 100}%"></i></div>`;
const live = t => { const el = $('#live'); if (el) el.textContent = t; };

let state = null;
const ui = { screen: 'start', view: null, pick: 'japan', sel: { region: null, divisions: [], fleet: null, wing: null, pickZone: false }, mapMode: 'political', speed: 0, running: false, vb: null, toast: '', modal: null, techCat: 'industry', design: null, lastSide: '' };
const me = () => state.countries[state.player];
const C = id => state.countries[id];
const R = id => X.regions.get(id);
const act = a => {
  const r = E.dispatch(state, data, { ...a, country: state.player });
  if (!r.ok) toast(r.reason || '할 수 없습니다.'); else if (r.warn) toast(r.warn);
  renderAll();
  return r;
};
function toast(t) { ui.toast = t; live(t); const el = $('#toast'); if (el) { el.textContent = t; el.hidden = !t; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; ui.toast = ''; }, 3500); } }

/* ---------- 시작 ---------- */
function loadAutosave() { try { const t = localStorage.getItem(SAVE_KEY); if (!t) return null; const r = E.importSave(t, data); return r.ok ? r.state : null; } catch { return null; } }
function save() { if (!state) return; try { localStorage.setItem(SAVE_KEY, E.exportSave(state)); } catch { /* 저장소를 쓸 수 없는 환경 */ } }
function startNew() { state = E.createState(data, ui.pick, (Date.now() % 1e6) | 0); ui.screen = 'game'; ui.view = 'focus'; ui.sel = { region: me().mapCapital || null, divisions: [], fleet: null, wing: null }; fitMap(); renderAll(true); save(); }
function startView() {
  const saved = loadAutosave();
  const cards = data.countries.filter(c => c.playable).map(c => `<button class="${ui.pick === c.id ? 'on' : ''}" data-action="pick" data-id="${c.id}"><b><span class="sw" style="background:${c.color}"></span>${esc(c.name)}</b><small>${esc(c.leader)} · ${esc(data.ideologies[c.ideology].name)}</small><span>${esc(c.summary)}</span></button>`).join('');
  return `<div class="start"><div class="start-in">
  <div class="sub">1936년 1월 1일 ~ 1945년 12월 31일 · 하루 단위 대전략</div>
  <h1>전선과 공장: 동아시아 1936</h1>
  <p class="lead">동아시아와 태평양의 208개 지역과 48개 해역. 국가 중점으로 나라의 길을 고르고, 시장 경제가 돌리는 공장에서 장비를 만들고, 사단을 설계해 전선을 지킨다. 실제 역사는 사건의 해설에 따로 적었고, 수치와 선택의 결과는 게임을 위한 창작이다.</p>
  <h2 style="margin-top:22px">나라를 고르세요</h2>
  <div class="pick">${cards}</div>
  <div class="start-actions"><button class="primary" data-action="new">새 게임 — ${esc(data.countries.find(c => c.id === ui.pick).name)}</button>${saved ? `<button data-action="continue">이어 하기 (${fmtDate(saved.day)}, ${esc(saved.countries[saved.player].name)})</button>` : ''}<button data-action="openLoad">저장 불러오기</button><button data-action="help">게임 방법</button></div>
  <div class="notice">이 게임은 잘 알려진 대전략 게임의 장르 구조(국가 중점·연구·사단 설계·전선·생산 라인)를 참고해 새로 만들었습니다. 이름·지도·화면·문구·수치는 이 게임의 것이며 원작의 자료를 쓰지 않았습니다. 전쟁 범죄와 정치 폭력은 재현하지 않고, 역사 사건은 결과와 제도적 비용으로만 다룹니다. 지도: Natural Earth(퍼블릭 도메인)에서 만든 근사 경계.</div>
  </div></div>`;
}

/* ---------- 틀 ---------- */
const NAV = [['politics', '정치', '⚖'], ['focus', '국가 중점', '◆'], ['research', '연구', '⚗'], ['diplomacy', '외교', '⚑'], ['build', '건설', '⌂'], ['production', '생산', '⚙'], ['market', '시장', '¤'], ['design', '사단 설계', '▦'], ['army', '육군', '⚔'], ['navy', '해군', '⚓'], ['airforce', '공군', '✈'], ['log', '기록', '☰'], ['help', '도움말', '?']];
function shell() {
  return `<div class="shell"><header class="topbar" id="top"></header>
  <nav class="nav" aria-label="창">${NAV.map(([id, name, g]) => `<button data-action="nav" data-view="${id}" class="${ui.view === id ? 'on' : ''}" title="${name}"><span class="g" aria-hidden="true">${g}</span>${name}</button>`).join('')}</nav>
  <main class="stage" id="stage"><div class="map" id="map"></div>
    <div class="mapmodes" role="group" aria-label="지도 모드">${[['political', '정치'], ['faction', '진영'], ['terrain', '지형'], ['resources', '자원'], ['industry', '공업'], ['supply', '보급'], ['infra', '기반 시설']].map(([id, n]) => `<button data-action="mapMode" data-mode="${id}" class="${ui.mapMode === id ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="zoom"><button data-action="zoom" data-z="0.75" aria-label="확대">+</button><button data-action="zoom" data-z="1.33" aria-label="축소">−</button><button data-action="fit" aria-label="전체 보기">⤢</button></div>
    <div class="legend" id="legend"></div><div class="hint" id="toast" hidden></div><div id="screen"></div></main>
  <aside class="side" id="side"></aside>
  <footer class="ticker" id="ticker"></footer></div>`;
}
function topbar() {
  const c = me(), sm = E.summary(state, data, state.player), M = mods(state, data, c);
  const r = (k, v, title, view) => `<button class="r" data-action="nav" data-view="${view}" title="${esc(title)}"><small>${k}</small><b>${v}</b></button>`;
  const speeds = ['Ⅱ', '1', '2', '3', '4', '5'];
  const res = `${r('정치력', num(sm.pp), '하루에 쌓인다. 법·전쟁 명분에 쓴다.', 'politics')}${r('안정도', pct(sm.stability), '낮으면 공장 산출이 줄어든다.', 'politics')}${r('전쟁 지지도', pct(sm.warSupport), '동원 법의 조건.', 'politics')}${r('인력', people(sm.manpower), '모집할 수 있는 사람.', 'army')}
  ${r('민간 공장', num(sm.civ), '건설점을 만든다.', 'build')}${r('군수 공장', num(sm.arms, 1), '생산 라인에 배치한다.', 'production')}${r('조선소', num(sm.docks, 1), '함선을 만든다.', 'production')}${r('연료', pct(sm.fuel), '부족하면 기계화 부대·함대·항공기가 약해진다.', 'market')}${r('사단', num(sm.divisions), '육군', 'army')}${sm.blockade > .02 ? r('봉쇄', pct(sm.blockade), '적 잠수함이 무역을 줄인다.', 'navy') : ''}${isAtWar(state, c.id) ? r('전쟁', enemiesOf(state, c.id).length + '개국', '교전국', 'diplomacy') : ''}`;
  const top = $('#top');
  if (top.dataset.who !== c.id) {
    top.dataset.who = c.id;
    top.innerHTML = `<div class="who"><span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b></div><div class="res"></div>
  <div class="clock"><span class="date"></span>${speeds.map((t, i) => `<button data-action="speed" data-s="${i}" aria-label="${i ? `속도 ${i}` : '멈춤'}">${t}</button>`).join('')}<button data-action="menu" aria-label="메뉴">☰</button></div>`;
  }
  const rs = top.querySelector('.res'); if (rs.dataset.h !== res) { rs.innerHTML = res; rs.dataset.h = res; }
  top.querySelector('.date').textContent = fmtDate(state.day);
  top.querySelectorAll('.clock [data-action="speed"]').forEach(btn => { const i = +btn.dataset.s; btn.classList.toggle('on', ui.running ? ui.speed === i : i === 0); });
}
function tickerHtml() {
  const items = state.log.filter(l => ['war', 'capture', 'capitulation', 'event', 'capital', 'liberation', 'focus', 'research', 'naval', 'build', 'diplomacy', 'military'].includes(l.kind)).slice(-6).reverse();
  return items.map(l => `<span class="item"><b>${fmtDate(l.day).replace(/^\d+년 /, '')}</b> ${esc(l.text)}</span>`).join(' · ') || '<span class="muted">시간을 진행하면 소식이 여기에 나옵니다. 스페이스: 진행/멈춤, 1~5: 속도</span>';
}

/* ---------- 지도 ---------- */
const [, , MW, MH] = MAP.viewBox;
function fitMap() {
  const c = state && (me().mapCapital ? R(me().mapCapital) : null);
  const narrow = typeof innerWidth === 'number' && innerWidth < 700, w = narrow ? 520 : 1040, h = narrow ? 760 : 760;
  if (c) ui.vb = { x: c.label[0] - w / 2, y: c.label[1] - h / 2, w, h };
  else ui.vb = { x: 0, y: 0, w: MW, h: MH };
}
function buildMap() {
  const el = $('#map'); if (!el) return;
  const seas = Object.entries(MAP.seas).map(([id, s]) => `<path class="sea" data-sea="${id}" d="${s.d}"/>`).join('');
  const regs = Object.entries(MAP.regions).map(([id, r]) => `<path class="rg" data-r="${id}" id="rg_${id}" d="${r.d}"/>`).join('');
  const isles = Object.entries(MAP.regions).filter(([, r]) => r.area < 25).map(([id, r]) => `<circle class="isle" cx="${r.label[0]}" cy="${r.label[1]}" r="9"/><circle data-r="${id}" cx="${r.label[0]}" cy="${r.label[1]}" r="10" fill="transparent" class="isle-hit"/>`).join('');
  const slbl = data.seas.map(s => `<text class="slbl" x="${s.label[0]}" y="${s.label[1]}">${esc(s.name)}</text>`).join('');
  const lbl = data.regions.filter(r => !r.offmap).map(r => `<text class="lbl ${r.area < 300 ? 'sm' : ''}" x="${r.label[0]}" y="${r.label[1] + (r.vp >= 10 ? 13 : 4)}">${esc(r.name.replace(/\(.*\)/, ''))}</text>${r.vp >= 10 ? `<path class="vp" d="M${r.label[0]},${r.label[1] - 7}l2.2,4.5 5,.7-3.6,3.5.9,5-4.5-2.4-4.5,2.4.9-5-3.6-3.5 5-.7z"/>` : ''}`).join('');
  el.innerHTML = `<svg id="svg" viewBox="0 0 ${MW} ${MH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="동아시아·태평양 지도"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#ffe08a"/></marker><g id="pats"></g></defs>
  <g id="g-seas">${seas}</g><g id="g-regions">${regs}</g><g id="g-borders"></g><g id="g-front"></g><g id="g-isles">${isles}</g><g id="g-slbl">${slbl}</g><g id="g-lbl">${lbl}</g><g id="g-over"></g></svg>`;
  bindMap(el);
  applyViewBox();
}
function applyViewBox() { const svg = $('#svg'); if (!svg || !ui.vb) return; const v = ui.vb; svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); const z = MW / v.w; $('#g-lbl')?.setAttribute('style', `display:${z > 1.6 ? 'inline' : 'none'}`); $('#g-slbl')?.setAttribute('style', `display:${z > 1.2 ? 'inline' : 'none'}`); }
function zoomAt(f, cx, cy) {
  const v = ui.vb, nw = clamp(v.w * f, 240, MW * 1.05), nh = nw * v.h / v.w;
  const px = cx ?? v.x + v.w / 2, py = cy ?? v.y + v.h / 2;
  ui.vb = { x: px - (px - v.x) * nw / v.w, y: py - (py - v.y) * nh / v.h, w: nw, h: nh };
  applyViewBox();
}
function svgPoint(evt) { const svg = $('#svg'), r = svg.getBoundingClientRect(), v = ui.vb; const s = Math.min(r.width / v.w, r.height / v.h); const ox = (r.width - v.w * s) / 2, oy = (r.height - v.h * s) / 2; return [v.x + (evt.clientX - r.left - ox) / s, v.y + (evt.clientY - r.top - oy) / s]; }
function bindMap(el) {
  let drag = null; const pts = new Map();
  el.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = svgPoint(e); zoomAt(e.deltaY > 0 ? 1.15 : .87, x, y); }, { passive: false });
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY, vb: { ...ui.vb }, moved: 0, target: e.target, pinch: pts.size === 2 ? dist2() : null }; });
  const dist2 = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  el.addEventListener('pointermove', e => {
    if (!drag || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    const r = el.getBoundingClientRect(), s = Math.min(r.width / drag.vb.w, r.height / drag.vb.h);
    if (pts.size === 2) { const d2 = dist2(); if (drag.pinch) { const f = drag.pinch / d2; ui.vb = { ...drag.vb }; zoomAt(f); drag.moved = 99; } return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
    if (drag.moved > 4) { el.classList.add('drag'); ui.vb = { ...drag.vb, x: drag.vb.x - dx / s, y: drag.vb.y - dy / s }; applyViewBox(); }
  });
  const end = e => {
    pts.delete(e.pointerId); el.classList.remove('drag');
    if (drag && drag.moved <= 4 && pts.size === 0) mapClick(drag.target);
    if (pts.size === 0) drag = null;
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', e => { pts.delete(e.pointerId); drag = null; el.classList.remove('drag'); });
}
function mapClick(t) {
  const unit = t.closest && t.closest('[data-unit]'), fleet = t.closest && t.closest('[data-fleet]');
  if (fleet) { const f = state.fleets.find(x => x.id === fleet.dataset.fleet); if (f && f.owner === state.player) { ui.sel = { region: null, divisions: [], fleet: f.id, wing: null }; renderAll(); return; } }
  if (unit) { const rid = unit.dataset.unit; const own = state.divisions.filter(dv => dv.owner === state.player && dv.at === rid).map(dv => dv.id); if (own.length && unit.classList.contains('mine')) { ui.sel = { region: rid, divisions: own, fleet: null, wing: null }; renderAll(); return; } }
  const rid = t.dataset && (t.dataset.r || null), sea = t.dataset && (t.dataset.sea || null);
  const target = rid || sea;
  if (!target) return;
  // 선택한 것에 명령
  if (ui.sel.wing && ui.sel.pickZone) { const z = rid ? R(rid).airZone : sea; act({ type: 'air', wing: ui.sel.wing, zone: z }); ui.sel.pickZone = false; return; }
  if (ui.sel.fleet) { act({ type: 'fleetMove', fleet: ui.sel.fleet, dest: target }); return; }
  if (ui.sel.divisions.length && rid) { orderTo(rid); return; }
  if (ui.sel.divisions.length && sea) { toast('사단은 땅에만 보낼 수 있습니다. 바다를 건너는 길은 자동으로 찾습니다.'); return; }
  ui.sel = { region: rid, sea, divisions: [], fleet: null, wing: null };
  renderAll();
}
function orderTo(rid) {
  const list = state.divisions.filter(dv => ui.sel.divisions.includes(dv.id));
  if (!list.length) { ui.sel.divisions = []; return; }
  const hostile = atWar(state, state.player, state.regions[rid].controller);
  const adj = list.every(dv => R(dv.at)?.adj?.includes(rid));
  let r;
  if (hostile && adj) r = E.dispatch(state, data, { type: 'attack', divisions: ui.sel.divisions, target: rid, country: state.player });
  else { r = E.dispatch(state, data, { type: 'move', divisions: ui.sel.divisions, dest: rid, country: state.player }); if (!r.ok && hostile) r = E.dispatch(state, data, { type: 'invade', divisions: ui.sel.divisions, target: rid, country: state.player }); }
  toast(r.ok ? (hostile ? `${R(rid).name}에 대한 ${list.some(d => d.order?.type === 'invade') ? '상륙 준비' : '공격'} 명령` : `${R(rid).name}(으)로 이동${r.days ? ` — 약 ${Math.ceil(r.days)}일` : ''}`) : r.reason);
  renderAll();
}
const TERRAIN_COL = { p: '#8a9a62', h: '#9b8b5f', m: '#7b6f63', f: '#4f7350', j: '#3f6b45', d: '#b8a57a', s: '#5c7d6f', u: '#8d8d8d' };
const patterns = new Set();
function stripe(owner, ctrl) {
  const id = `st_${owner}_${ctrl}`;
  if (!patterns.has(id)) { patterns.add(id); const g = $('#pats'); if (g) g.insertAdjacentHTML('beforeend', `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="${C(ctrl).color}"/><rect width="5" height="14" fill="${C(owner).color}"/></pattern>`); }
  return `url(#${id})`;
}
let supplyMap = null, supplyDay = -1;
function regionFill(r) {
  const st = state.regions[r.id], mode = ui.mapMode;
  if (mode === 'political') return st.owner === st.controller ? C(st.controller).color : stripe(st.owner, st.controller);
  if (mode === 'faction') { const c = C(st.controller), f = c.faction || (c.overlord && C(c.overlord).faction); return f ? data.factions.find(x => x.id === f).color : atWar(state, state.player, st.controller) ? '#7a3b33' : '#5d6266'; }
  if (mode === 'terrain') return TERRAIN_COL[r.terrain];
  if (mode === 'resources') { const v = sum(Object.values(r.res)); return v ? `hsl(${r.res.oil ? 280 : r.res.rubber ? 140 : r.res.rare ? 200 : 35},45%,${62 - Math.min(v, 8) * 4}%)` : '#555b5e'; }
  if (mode === 'industry') { const n = sum(['civ', 'arms', 'dock', 'steel', 'tools', 'chem', 'light'].map(b => st.b[b]?.level || 0)); return n ? `hsl(30,${30 + Math.min(n, 15) * 4}%,${30 + Math.min(n, 15) * 3}%)` : '#3c4245'; }
  if (mode === 'infra') return `hsl(205,35%,${18 + st.infra * 6}%)`;
  if (mode === 'supply') {
    if (supplyDay !== state.day) { supplyMap = E.mil.computeSupply({ ...state, divisions: [...state.divisions, { owner: state.player, at: me().mapCapital || 'kanto', tpl: 'garrison_generic' }] }, data)[state.player]; supplyDay = state.day; }
    const v = supplyMap?.get(r.id) || 0; return v ? `hsl(${Math.min(120, v * 9)},45%,38%)` : friendly(state, state.player, st.controller) ? '#5a2e2a' : '#3b4043';
  }
  return '#555';
}
function legendHtml() {
  const m = ui.mapMode;
  if (m === 'political') return '<b>정치</b><br>통제하는 나라의 색. 줄무늬는 점령지(옅은 줄 = 원래 주인). 별은 승점 10 이상의 도시.';
  if (m === 'faction') return `<b>진영</b><br>${data.factions.map(f => `<span class="sw" style="background:${f.color}"></span>${f.name}`).join(' ')}<br><span class="sw" style="background:#7a3b33"></span>나와 전쟁 중 <span class="sw" style="background:#5d6266"></span>무소속`;
  if (m === 'terrain') return `<b>지형</b><br>${Object.entries(data.terrain).map(([k, t]) => `<span class="sw" style="background:${TERRAIN_COL[k]}"></span>${t.name}`).join(' ')}`;
  if (m === 'resources') return '<b>자원</b> 보라: 석유, 초록: 고무, 파랑: 희소 금속, 갈색: 석탄·철. 진할수록 많다.';
  if (m === 'industry') return '<b>공업</b> 공장 단계가 많을수록 밝다.';
  if (m === 'supply') return '<b>보급</b> 초록일수록 보급 용량이 크다. 붉은 곳은 우리 땅이지만 보급이 닿지 않는다.';
  return '<b>기반 시설</b> 밝을수록 도로·철도가 좋다(이동·보급·공장 터).';
}
function updateMap() {
  const svg = $('#svg'); if (!svg) return;
  for (const r of data.regions) { if (r.offmap) continue; const el = document.getElementById(`rg_${r.id}`); if (!el) continue; const f = regionFill(r); if (el.getAttribute('fill') !== f) el.setAttribute('fill', f); el.classList.toggle('sel', ui.sel.region === r.id); }
  for (const el of svg.querySelectorAll('.sea')) el.classList.toggle('sel', ui.sel.sea === el.dataset.sea);
  // 나라 경계와 전선
  let bd = '', fr = '';
  for (const [k, dpath] of Object.entries(MAP.borders)) {
    const [a, b] = k.split('|'), ca = state.regions[a].controller, cb = state.regions[b].controller;
    if (ca === cb) continue;
    bd += dpath;
    if ((ca === state.player || friendly(state, state.player, ca)) && atWar(state, state.player, cb) || (cb === state.player || friendly(state, state.player, cb)) && atWar(state, state.player, ca)) fr += dpath;
  }
  $('#g-borders').innerHTML = `<path class="bd" d="${bd}"/>`;
  $('#g-front').innerHTML = fr ? `<path class="front" d="${fr}"/>` : '';
  // 부대·전투·함대
  const out = [];
  const byRegion = new Map();
  for (const dv of state.divisions) { if (!byRegion.has(dv.at)) byRegion.set(dv.at, []); byRegion.get(dv.at).push(dv); }
  for (const [rid, list] of byRegion) {
    const r = R(rid), sea = X.seas.get(rid); const p = r ? r.label : sea ? sea.label : null; if (!p || r?.offmap) continue;
    const groups = new Map(); for (const dv of list) { const k = dv.owner; groups.set(k, (groups.get(k) || []).concat(dv)); }
    let i = 0;
    for (const [owner, l] of groups) {
      const mine = owner === state.player, enemy = atWar(state, state.player, owner);
      const x = p[0] - 14 + i * 30, y = p[1] - 22; i++;
      const sel = mine && l.some(dv => ui.sel.divisions.includes(dv.id));
      const str = sum(l.map(dv => dv.str)) / l.length, org = sum(l.map(dv => dv.org)) / l.length;
      out.push(`<g class="unit ${mine ? 'mine' : ''} ${sel ? 'sel' : ''}" data-unit="${rid}"><rect x="${x - 12}" y="${y - 9}" width="26" height="17" rx="2" fill="${C(owner).color}"/><text x="${x + 1}" y="${y + 3}">${l.length}</text><rect x="${x - 12}" y="${y + 9}" width="${26 * org}" height="3" fill="${enemy ? '#ff7a5c' : '#9fe08a'}" stroke="none"/></g>`);
    }
  }
  for (const b of Object.values(state.battles || {})) { const r = R(b.region); if (!r) continue; out.push(`<g class="battle"><circle cx="${r.label[0] + 18}" cy="${r.label[1] + 6}" r="8"/><text x="${r.label[0] + 18}" y="${r.label[1] + 9.5}">⚔</text></g>`); }
  const seaGroups = new Map();
  for (const f of state.fleets) { const sea = X.seas.get(f.at), r = R(f.at); const p = sea ? sea.label : r && !r.offmap ? r.label : null; if (!p) continue; const k = `${f.at}`; seaGroups.set(k, (seaGroups.get(k) || []).concat(f)); }
  for (const [at, list] of seaGroups) {
    const sea = X.seas.get(at), p = sea ? sea.label : R(at).label;
    list.forEach((f, i) => { const n = sum(Object.entries(f.ships).filter(([k]) => k !== 'convoy').map(([, v]) => v)); if (!n && !f.ships.convoy) return; const x = p[0] + (sea ? -16 : 16) + (i % 3) * 30, y = p[1] + (sea ? 14 : -4) + Math.floor(i / 3) * 18; const sel = ui.sel.fleet === f.id; out.push(`<g class="fleet" data-fleet="${f.id}"><rect x="${x - 13}" y="${y - 7}" width="26" height="14" rx="7" fill="${C(f.owner).color}" stroke="${sel ? '#fff' : f.owner === state.player ? '#f0d48a' : '#0b0e10'}" stroke-width="${sel ? 2.4 : 1}"/><text x="${x}" y="${y + 3}">⚓${n}</text></g>`); });
  }
  // 고른 사단의 명령 화살표
  for (const dv of state.divisions) {
    if (!ui.sel.divisions.includes(dv.id) || !dv.order) continue;
    const from = (R(dv.at) || X.seas.get(dv.at))?.label; if (!from) continue;
    if (dv.order.type === 'move') { let pts = [from]; for (const step of dv.order.path) { const p = (R(step.node) || X.seas.get(step.node))?.label; if (p) pts.push(p); } if (pts.length > 1) out.push(`<path class="arrow" d="M${pts.map(p => p.join(',')).join('L')}"/>`); }
    else { const to = R(dv.order.target)?.label; if (to) out.push(`<path class="arrow atk" d="M${from.join(',')}L${to.join(',')}"/>`); }
  }
  $('#g-over').innerHTML = out.join('');
  const lg = $('#legend'); if (lg) lg.innerHTML = legendHtml();
}

/* ---------- 옆 패널 ---------- */
function sideHtml() {
  if (ui.sel.divisions.length) return divisionPanel();
  if (ui.sel.fleet) return fleetPanel();
  if (ui.sel.wing) return wingPanel();
  if (ui.sel.region) return regionPanel(ui.sel.region);
  if (ui.sel.sea) return seaPanel(ui.sel.sea);
  return '';
}
const close = '<button class="small" data-action="clearSel" style="float:right">닫기</button>';
function divRow(dv) {
  const st = E.mil.divisionStats(state, data, dv), o = dv.order;
  const ord = !o ? '대기' : o.type === 'move' ? `이동 → ${esc(R(o.dest)?.name || X.seas.get(o.dest)?.name || '')}` : o.type === 'attack' ? `공격 → ${esc(R(o.target).name)}` : `상륙 준비 → ${esc(R(o.target).name)} (${o.prep}일)`;
  return `<button class="div ${ui.sel.divisions.includes(dv.id) ? 'sel' : ''}" data-action="toggleDiv" data-id="${dv.id}"><b>${esc(dv.name)} <span class="mini">${esc(dv.tplName)}</span></b><span class="mini">${ord}</span><div class="bars">${bar(dv.str, 'good')}${bar(dv.org, 'cool')}</div><span class="mini">병력 ${pct(dv.str)} · 조직력 ${pct(dv.org)} · 보급 ${pct(dv.sup ?? 1)}</span><span class="mini">공격 ${num(st.soft)} · 방어 ${num(st.def)}</span></button>`;
}
function divisionPanel() {
  const list = state.divisions.filter(dv => ui.sel.divisions.includes(dv.id));
  if (!list.length) { ui.sel.divisions = []; return ''; }
  const here = R(list[0].at) || X.seas.get(list[0].at);
  return `${close}<h2>사단 ${list.length}개</h2><p class="muted">${esc(here?.name || '')}에 있음. <b>지도에서 지역을 누르면</b> 이동합니다. 맞닿은 적 지역은 공격, 바다 건너 적 해안은 상륙(아군 항구에서 출발, 해상 우세 필요)입니다.</p>
  <div class="btns"><button class="small" data-action="stopDivs">멈춤</button><button class="small" data-action="selectRegionDivs">이 지역 전체</button><button class="small" data-action="clearSel">선택 해제</button></div>
  <div style="margin-top:10px">${list.map(divRow).join('')}</div>`;
}
function regionPanel(rid) {
  const r = R(rid), st = state.regions[rid], owner = C(st.owner), ctrl = C(st.controller);
  const t = data.terrain[r.terrain];
  const divs = state.divisions.filter(dv => dv.at === rid);
  const mine = divs.filter(dv => dv.owner === state.player);
  const others = divs.filter(dv => dv.owner !== state.player);
  const blds = Object.entries(st.b).filter(([, b]) => b.level).map(([id, b]) => `<span class="tag">${esc(X.buildings.get(id).name)} ${b.level}${b.staff < .95 && st.owner === st.controller ? ` (${pct(b.staff)})` : ''}</span>`).join('') || '<span class="muted">없음</span>';
  const res = Object.entries(r.res).map(([k, v]) => `<span class="tag">${esc(X.goods.get(k).name)} ${v}</span>`).join('') || '<span class="muted">없음</span>';
  const b = state.battles[rid];
  const canBuild = st.controller === state.player && st.owner === state.player;
  const quick = canBuild ? ['civ', 'arms', 'dock', 'infra', 'air', 'port', 'fort', ...Object.keys(r.res)].map(id => { const kind = X.facilities.has(id) ? 'facility' : 'building'; const why = E.buildReason(state, data, state.player, { id, kind, region: rid }); const name = kind === 'facility' ? X.facilities.get(id).name : X.buildings.get(id).name; return `<button class="small" data-action="build" data-id="${id}" data-kind="${kind}" data-region="${rid}" ${why ? `disabled title="${esc(why)}"` : ''}>+${esc(name)}</button>`; }).join('') : '';
  return `${close}<h2>${esc(r.name)}</h2>
  <div class="kv"><span>소유</span><b><span class="tag" style="border-color:${owner.color}">${esc(owner.short)}</span>${st.owner !== st.controller ? ` 점령: <span class="tag war" style="border-color:${ctrl.color}">${esc(ctrl.short)}</span>` : ''}</b>
  <span>지형</span><b>${t.name} (공격 ×${t.attack}, 방어 +${pct(t.def)}, 전투 폭 ${t.width})</b>
  <span>승점</span><b>${r.vp}</b><span>인구</span><b>${num(r.pop * 10, 0)}만 명</b>
  <span>시설</span><b>기반 ${st.infra} · 항구 ${st.port} · 비행장 ${st.air} · 요새 ${st.fort}${st.damage ? ` · <span class="bad">폭격 손상 ${pct(st.damage)}</span>` : ''}</b>
  <span>항공 구역</span><b>${esc(X.airZones.get(r.airZone)?.name || '')}</b>${r.coast.length ? `<span>바다</span><b>${r.coast.map(z => esc(X.seas.get(z).name)).join(', ')}</b>` : ''}</div>
  <h3 style="margin-top:10px">자원</h3><div>${res}</div><h3 style="margin-top:8px">건물</h3><div>${blds}</div>
  ${quick ? `<h3 style="margin-top:8px">짓기</h3><div class="btns">${quick}</div>` : ''}
  ${b ? `<h3 style="margin-top:10px" class="bad">전투 중</h3><p class="mini">공격 ${num(b.attack)} 대 방어 ${num(b.defense)} · 방어 쪽 피해 ${num(b.hitsOnDef, 1)}/일, 공격 쪽 ${num(b.hitsOnAtt, 1)}/일 · 제공권 ${pct(b.air)}</p>${bar(b.progress, 'bad')}` : ''}
  ${mine.length ? `<h3 style="margin-top:10px">우리 사단 ${mine.length}</h3><button class="small" data-action="selectRegionDivs" data-region="${rid}">모두 고르기</button><div style="margin-top:6px">${mine.slice(0, 12).map(divRow).join('')}</div>` : ''}
  ${others.length ? `<h3 style="margin-top:10px">다른 나라 사단</h3>${[...new Set(others.map(x => x.owner))].map(o => `<p><span class="tag ${atWar(state, state.player, o) ? 'war' : 'ally'}">${esc(C(o).short)}</span> ${others.filter(x => x.owner === o).length}개 · 병력 ${pct(sum(others.filter(x => x.owner === o).map(x => x.str)) / others.filter(x => x.owner === o).length)}</p>`).join('')}` : ''}`;
}
function seaPanel(sid) {
  const s = X.seas.get(sid), sup = state.navSup[sid] || {};
  const fl = state.fleets.filter(f => f.at === sid);
  return `${close}<h2>${esc(s.name)}</h2><p class="muted">해상 우세: ${Object.entries(sup).map(([k, v]) => `${esc(C(k).short)} ${pct(v)}`).join(', ') || '순찰하는 함대 없음'}</p>
  ${fl.map(f => `<p><span class="tag ${atWar(state, state.player, f.owner) ? 'war' : f.owner === state.player ? 'ok' : 'ally'}">${esc(C(f.owner).short)}</span> ${esc(f.name)} — ${shipList(f)} (${esc(missionName(f.mission))})</p>`).join('')}
  <p class="mini">맞닿은 해안: ${s.coast.map(r => esc(R(r).name)).join(', ') || '없음'}</p>`;
}
const shipList = f => Object.entries(f.ships).filter(([, n]) => n > 0).map(([k, n]) => `${esc(X.ships.get(k).name)} ${n}`).join(', ');
const missionName = m => ({ patrol: '순찰', raid: '통상 파괴', escort: '호위', port: '정박' }[m] || m);
function fleetPanel() {
  const f = state.fleets.find(x => x.id === ui.sel.fleet); if (!f) { ui.sel.fleet = null; return ''; }
  const where = X.seas.get(f.at)?.name || R(f.at)?.name;
  const dmg = f.damage ? sum(Object.entries(f.damage).map(([k, v]) => v)) / Math.max(1, sum(Object.entries(f.ships).map(([k, n]) => X.ships.get(k).hp * n))) : 0;
  return `${close}<h2>${esc(f.name)}</h2><p>${shipList(f)}</p><div class="kv"><span>위치</span><b>${esc(where)}${f.path?.length ? ` → ${esc(X.seas.get(f.path.at(-1))?.name || R(f.path.at(-1))?.name)}` : ''}</b><span>임무</span><b>${missionName(f.mission)}</b><span>손상</span><b>${pct(dmg)}</b><span>전력</span><b>${num(E.mil.fleetStrength(state, data, f))}</b></div>
  <p class="muted" style="margin-top:8px"><b>지도에서 해역이나 아군 항구를 누르면</b> 그곳으로 갑니다.</p>
  <div class="btns">${['patrol', 'raid', 'escort', 'port'].map(m => `<button class="small ${f.mission === m ? 'primary' : ''}" data-action="fleetMission" data-id="${f.id}" data-m="${m}">${missionName(m)}</button>`).join('')}</div>
  <p class="mini" style="margin-top:8px">순찰: 해상 우세를 잡고 적 함대와 싸운다(상륙의 조건). 통상 파괴: 잠수함이 적 무역과 보급을 끊는다. 호위: 우리 수송을 지킨다. 정박: 항구에서 수리한다.</p>`;
}
function wingPanel() {
  const w = state.air.find(x => x.id === ui.sel.wing); if (!w) { ui.sel.wing = null; return ''; }
  const ok = E.mil.wingInRange(state, data, w);
  return `${close}<h2>${esc(data.aircraft[w.type].name)} ${num(w.count)}대</h2><div class="kv"><span>기지</span><b>${esc(R(w.base).name)}</b><span>임무</span><b>${esc(data.airMissions[w.mission].name)}</b><span>구역</span><b>${esc(X.airZones.get(w.zone)?.name || X.seas.get(w.zone)?.name || '없음')} ${w.mission !== 'idle' && !ok ? '<span class="bad">(반경 밖)</span>' : ''}</b><span>잃은 수</span><b>${num(w.lost || 0)}</b></div>
  <div class="btns">${Object.entries(data.airMissions).filter(([id, m]) => id === 'idle' || m.types.includes(w.type)).map(([id, m]) => `<button class="small ${w.mission === id ? 'primary' : ''}" data-action="airMission" data-id="${w.id}" data-m="${id}">${m.name}</button>`).join('')}</div>
  <div class="btns"><button class="small" data-action="pickZone">작전 구역 고르기(지도)</button><button class="small" data-action="airFill" data-id="${w.id}">재고로 채우기 (${num(me().stock[w.type] || 0)}대)</button></div>`;
}

/* ---------- 창 ---------- */
function screenHtml() {
  const v = ui.view; if (!v) return '';
  const head = (t, extra = '') => `<div class="screen-head"><h1>${t}</h1>${extra}<button data-action="closeView">지도로 (Esc)</button></div>`;
  const body = { politics, focus: focusView, research, diplomacy, build: buildView, production, market, design, army, navy, airforce, log: logView, help: helpView }[v];
  return `<section class="screen" aria-label="${esc(NAV.find(n => n[0] === v)?.[1] || '')}">${head(NAV.find(n => n[0] === v)[1])}${body()}</section>`;
}
function politics() {
  const c = me(), M = mods(state, data, c);
  const laws = Object.entries(data.laws).map(([g, def]) => `<div class="card"><h3>${def.name}</h3>${def.options.map(o => { const cur = c.laws[g] === o.id, why = cur ? '' : E.pol.lawReason(state, data, c.id, g, o.id); return `<div class="row"><b>${esc(o.name)} ${cur ? '<span class="tag ok">시행 중</span>' : ''}</b><span>${fxText(o.fx)}</span></div>${cur ? '' : `<button class="small" data-action="law" data-g="${g}" data-o="${o.id}" ${why ? `disabled title="${esc(why)}"` : ''}>정치력 ${o.pp}${why ? ` — ${esc(why)}` : ''}</button>`}`; }).join('')}</div>`).join('');
  const pop = Object.entries(c.popularity).map(([k, v]) => `<div class="row"><b>${data.ideologies[k].name}</b><span>${num(v, 1)}%</span></div>${bar(v / 100)}`).join('');
  const spirits = c.spirits.map(id => `<div class="card"><h3>${esc(data.spirits[id].name)}</h3><p class="mini">${esc(data.spirits[id].desc)}</p></div>`).join('') || '<p class="muted">없음</p>';
  return `<div class="cards"><div class="card"><h3>${esc(c.name)}</h3><div class="kv"><span>지도자</span><b>${esc(data.countries.find(x => x.id === c.id).leader)}</b><span>정부</span><b>${data.ideologies[c.ideology].name}</b><span>진영</span><b>${c.faction ? data.factions.find(f => f.id === c.faction).name : '없음'}</b><span>정치력</span><b>${num(c.pp)} (하루 +${num(Math.max(.1, c.ppBase + M.pp), 2)})</b><span>안정도</span><b>${pct(c.stability)}</b><span>전쟁 지지도</span><b>${pct(c.warSupport)} (상한 ${M.warSupportCap}%)</b></div></div><div class="card"><h3>이념 지지율</h3>${pop}</div></div>
  <h2 style="margin-top:16px">법</h2><div class="cards">${laws}</div><h2 style="margin-top:16px">국가 정신</h2><div class="cards">${spirits}</div>`;
}
function fxText(fx) {
  const L = { manpower: '인력', labor: '노동', stability: '안정도', consumption: '소비', arms: '군수 산출', tax: '세율', armsBuild: '군수 공장 건설', tradeCap: '무역 역량', research: '연구', construction: '건설' };
  return Object.entries(fx || {}).map(([k, v]) => `${L[k] || k} ${k === 'tradeCap' || k === 'consumption' ? `×${v}` : `${v > 0 ? '+' : ''}${pct(v, v < .1 && v > -.1 ? 0 : 0)}`}`).join(', ');
}
function focusView() {
  const c = me(), tree = E.pol.treeOf(data, c.id);
  const W = 170, H = 100, maxX = Math.max(...tree.map(f => f.x)), maxY = Math.max(...tree.map(f => f.y));
  const links = [];
  for (const f of tree) for (const q of f.req.split(/[,|]/).filter(Boolean)) { const p = tree.find(x => x.id === q); if (p) links.push(`<path d="M${p.x * W + 75},${p.y * H + 74} C${p.x * W + 75},${p.y * H + 90} ${f.x * W + 75},${f.y * H - 16} ${f.x * W + 75},${f.y * H}"/>`); }
  for (const f of tree) for (const q of f.excl.split(',').filter(Boolean)) { const p = tree.find(x => x.id === q); if (p && p.x > f.x) links.push(`<path class="excl" d="M${f.x * W + 150},${f.y * H + 37} L${p.x * W},${p.y * H + 37}"/>`); }
  const nodes = tree.map(f => {
    const done = c.focus.done.includes(f.id), cur = c.focus.current === f.id, why = done || cur ? '' : E.pol.focusReason(state, data, c.id, f.id);
    const cls = done ? 'done' : cur ? 'cur' : !why ? 'avail' : 'locked';
    return `<button class="fnode ${cls}" style="left:${f.x * W}px;top:${f.y * H}px" data-action="focusInfo" data-id="${f.id}" title="${esc(f.desc)}"><b>${esc(f.name)}</b><span class="mini">${f.days}일${done ? ' · 완료' : cur ? ` · ${c.focus.progress}/${f.days}` : ''}</span>${cur ? bar(c.focus.progress / f.days) : ''}</button>`;
  }).join('');
  const info = ui.focusInfo && tree.find(f => f.id === ui.focusInfo);
  const why = info ? E.pol.focusReason(state, data, c.id, info.id) : '';
  return `<p class="muted">국가 중점은 한 번에 하나씩 진행합니다. 마치면 효과가 바로 생깁니다. 붉은 점선으로 이어진 둘은 하나만 고를 수 있습니다.${c.focus.current ? ` 진행 중: <b>${esc(X.focus.get(c.focus.current).name)}</b> <button class="small" data-action="cancelFocus">그만두기</button>` : ''}</p>
  ${info ? `<div class="card" style="margin:8px 0;max-width:640px"><h3>${esc(info.name)} <span class="mini">${info.days}일</span></h3><p>${esc(info.desc)}</p><p class="mini">효과: ${esc(focusFxText(info.fx))}</p>${E.pol.needText(info.need) ? `<p class="mini">${esc(E.pol.needText(info.need))}</p>` : ''}<button class="primary" data-action="focus" data-id="${info.id}" ${why ? 'disabled' : ''}>이 중점 시작</button>${why ? `<div class="why">${esc(why)}</div>` : ''}</div>` : ''}
  <div class="scroll-x"><div class="tree" style="width:${(maxX + 1) * W}px;height:${(maxY + 1) * H}px"><svg class="links" width="${(maxX + 1) * W}" height="${(maxY + 1) * H}">${links.join('')}</svg>${nodes}</div></div>`;
}
function focusFxText(fx) {
  const out = [];
  for (const [k, v] of Object.entries(fx)) {
    if (k === 'pp') out.push(`정치력 ${v > 0 ? '+' : ''}${v}`); else if (k === 'stability') out.push(`안정도 ${v > 0 ? '+' : ''}${pct(v)}`); else if (k === 'warSupport') out.push(`전쟁 지지도 +${pct(v)}`);
    else if (k === 'spirit') out.push(`국가 정신: ${data.spirits[v].name}`); else if (k === 'removeSpirit') out.push(`없앰: ${data.spirits[v].name}`);
    else if (k === 'build') out.push(v.map(([b, n, at]) => `${X.buildings.get(b).name} +${n}(${at === 'capital' ? '수도' : R(at).name})`).join(', '));
    else if (k === 'facility') out.push(v.filter(x => x[1]).map(([b, n, at]) => `${X.facilities.get(b).name} +${n}(${at === 'capital' ? '수도' : R(at).name})`).join(', '));
    else if (k === 'divisions') out.push(v.map(([t, n]) => `${X.templates.get(t).name} ${n}개`).join(', '));
    else if (k === 'research') out.push(`${data.techCategories.find(c => c.id === v.cat).name} 연구 +${pct(v.bonus)} (${v.uses}회)`);
    else if (k === 'equipment') out.push(Object.entries(v).map(([e, n]) => `${X.equipment.get(e).name} ${num(n)}`).join(', '));
    else if (k === 'wargoal') out.push(`전쟁 명분: ${v.map(x => C(x).short).join('·')}`);
    else if (k === 'tech') out.push(`기술: ${v.map(t => X.techs.get(t).name).join(', ')}`);
    else if (k === 'event') out.push(`사건: ${X.events.get(v).title}`);
    else if (k === 'faction') out.push('진영 결성·가입');
    else if (k === 'ships') out.push(Object.entries(v).map(([s, n]) => `${X.ships.get(s).name} ${n}척`).join(', '));
    else if (k === 'manpower') out.push(`인력 +${num(v)}천 명`); else if (k === 'popularity') out.push('이념 지지율 변화'); else if (k === 'flag') out.push('뒤의 선택지를 연다');
  }
  return out.join(' · ');
}
function research() {
  const c = me();
  const slots = c.research.slots.map((sl, i) => sl ? `<div class="slot busy"><b>${esc(X.techs.get(sl.tech).name)}</b>${bar(sl.progress / sl.cost, 'cool')}<span class="mini">${Math.ceil(sl.cost - sl.progress)}일 남음</span> <button class="small" data-action="cancelResearch" data-slot="${i}">취소</button></div>` : `<div class="slot"><b class="muted">빈 연구 칸 ${i + 1}</b><p class="mini">아래에서 기술을 누르면 여기서 연구합니다.</p></div>`).join('');
  const cats = data.techCategories.map(t => `<button class="small ${ui.techCat === t.id ? 'primary' : ''}" data-action="techCat" data-id="${t.id}">${t.name}</button>`).join('');
  const free = c.research.slots.findIndex(x => !x);
  const techs = data.techs.filter(t => t.cat === ui.techCat).map(t => {
    const done = c.research.done.includes(t.id), prog = c.research.slots.some(x => x && x.tech === t.id), why = done || prog ? '' : E.pol.techReason(state, data, c.id, t.id);
    const cost = E.pol.techCost(state, data, c.id, t);
    return `<button class="tech ${done ? 'done' : prog ? 'prog' : ''}" data-action="research" data-id="${t.id}" ${done || prog || why || free < 0 ? 'disabled' : ''} title="${esc(why)}"><b>${esc(t.name)}</b><span class="mini">${t.year}년 기준 · ${done ? '완료' : prog ? '연구 중' : `약 ${Math.ceil(cost)}일`}</span><span class="mini">${esc(techFx(t.fx))}</span>${why && !done ? `<span class="why">${esc(why)}</span>` : ''}</button>`;
  }).join('');
  return `<div class="slots">${slots}</div><div class="btns" style="margin-bottom:10px">${cats}</div><p class="mini">기준 연도보다 먼저 연구하면 해마다 50%씩 오래 걸립니다. 국가 중점의 연구 보너스는 해당 분류에 쓰입니다.</p><div class="techs">${techs}</div>`;
}
function techFx(fx) {
  const out = [];
  if (fx.equipment) out.push(Object.entries(fx.equipment).map(([e, v]) => `${X.equipment.get(e).name} 성능 ×${v}`).join(', '));
  if (fx.ship) out.push(Object.entries(fx.ship).map(([e, v]) => `${X.ships.get(e).name} 설계 ×${v}`).join(', '));
  if (fx.unlock) out.push(`${X.battalions.get(fx.unlock).name} 편성`);
  if (fx.construction) out.push(`건설 +${pct(fx.construction)}`);
  if (fx.efficiencyCap) out.push(`생산 효율 상한 +${pct(fx.efficiencyCap)}`);
  if (fx.pm) out.push('새 생산방식'); if (fx.building) out.push(`${X.buildings.get(fx.building).name} 건설 가능`);
  if (fx.stat) out.push('대대 능력치 향상'); if (fx.terrain) out.push('지형 보너스'); if (fx.naval) out.push('해전 보너스'); if (fx.air) out.push('항공 보너스');
  return out.join(' · ');
}
function diplomacy() {
  const c = me();
  const rows = Object.values(state.countries).filter(o => o.exists && o.id !== c.id).sort((a, b) => (atWar(state, c.id, b.id) - atWar(state, c.id, a.id)) || (b.playable - a.playable)).map(o => {
    const war = atWar(state, c.id, o.id), goal = c.wargoals.includes(o.id), jst = c.justifying.find(j => j.target === o.id);
    const jwhy = E.pol.justifyReason(state, data, c.id, o.id), dwhy = E.pol.canDeclare(state, data, c.id, o.id);
    return `<tr><td><span class="tag" style="border-color:${o.color}">${esc(o.short)}</span> ${esc(o.name)}</td><td>${data.ideologies[o.ideology].name}</td><td>${o.faction ? data.factions.find(f => f.id === o.faction).name : o.overlord ? `${esc(C(o.overlord).short)}의 괴뢰국` : '—'}</td>
    <td>${war ? '<span class="tag war">전쟁</span>' : friendly(state, c.id, o.id) ? '<span class="tag ally">우방</span>' : c.naps.includes(o.id) ? '<span class="tag">불가침</span>' : '<span class="tag">평화</span>'}${goal ? '<span class="tag war">명분</span>' : ''}${jst ? `<span class="tag">정당화 ${jst.days}일</span>` : ''}</td>
    <td>${!war && !goal && !jst ? `<button class="small" data-action="justify" data-id="${o.id}" ${jwhy ? `disabled title="${esc(jwhy)}"` : ''}>명분 정당화(50)</button>` : ''}${goal && !war ? `<button class="small danger" data-action="declare" data-id="${o.id}" ${dwhy ? `disabled title="${esc(dwhy)}"` : ''}>선전 포고</button>` : ''}</td></tr>`;
  }).join('');
  const jwhy = E.pol.joinReason(state, data, c.id), fid = E.pol.factionFor(c);
  const facs = data.factions.map(f => `<div class="card"><h3><span class="tag" style="border-color:${f.color}">${f.name}</span></h3><p class="mini">${Object.values(state.countries).filter(o => o.exists && o.faction === f.id).map(o => esc(o.short)).join(', ') || '아직 없음'}</p></div>`).join('');
  return `<div class="cards">${facs}<div class="card"><h3>우리 진영</h3><p>${c.faction ? data.factions.find(f => f.id === c.faction).name : '없음'}</p>${!c.faction && fid ? `<button data-action="joinFaction" ${jwhy ? `disabled title="${esc(jwhy)}"` : ''}>${esc(data.factions.find(f => f.id === fid).name)}에 들어가기</button>${jwhy ? `<div class="why">${esc(jwhy)}</div>` : ''}` : ''}</div></div>
  <h2 style="margin-top:16px">나라</h2><p class="mini">선전 포고에는 전쟁 명분이 필요합니다(정치력 50, 45일). 진영과 괴뢰국은 함께 전쟁에 들어갑니다. 금수: ${c.embargoedBy.length ? c.embargoedBy.map(x => esc(C(x).short)).join(', ') : '없음'}.</p>
  <div class="scroll-x"><table><thead><tr><th>나라</th><th>정부</th><th>진영</th><th>관계</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function buildView() {
  const c = me();
  const q = c.construction.map((x, i) => { const cost = E.econ.constructionCost(data, x); return `<tr><td>${esc(R(x.region).name)}</td><td>${esc(x.kind === 'facility' ? X.facilities.get(x.id).name : X.buildings.get(x.id).name)}</td><td style="min-width:120px">${bar(x.progress / cost)}</td><td>${num(x.progress)}/${cost}</td><td>${i ? `<button class="small" data-action="prioritize" data-i="${i}">맨 앞으로</button>` : ''}<button class="small" data-action="cancelBuild" data-i="${i}">취소</button></td></tr>`; }).join('');
  const regs = data.regions.filter(r => state.regions[r.id].controller === c.id && state.regions[r.id].owner === c.id && !(r.offmap && c.homeLost));
  const rid = ui.buildRegion && regs.some(r => r.id === ui.buildRegion) ? ui.buildRegion : (c.mapCapital && regs.some(r => r.id === c.mapCapital) ? c.mapCapital : regs[0]?.id);
  const opts = [...data.buildings.map(b => ({ id: b.id, kind: 'building', name: b.name, cost: b.cost })), ...data.facilities.map(f => ({ id: f.id, kind: 'facility', name: f.name, cost: f.cost }))].map(o => { const why = rid ? E.buildReason(state, data, c.id, { ...o, region: rid }) : '지역 없음'; return `<button class="small" data-action="build" data-id="${o.id}" data-kind="${o.kind}" data-region="${rid}" ${why ? `disabled title="${esc(why)}"` : ''}>${esc(o.name)} (${o.cost})</button>`; }).join('');
  return `<div class="cards"><div class="card"><h3>건설 역량</h3><div class="kv"><span>민간 공장</span><b>${num(E.levels(state, data, c.id, 'civ'))}</b><span>건설점</span><b>${num(c.rates.points * 30, 1)}/달 (사업마다 최대 ${data.economy.maxPerProject}/달)</b><span>자재</span><b>강철·공구를 시장에서 산다(부족하면 느려진다)</b></div></div></div>
  <h2 style="margin-top:14px">대기열</h2>${q ? `<div class="scroll-x"><table><tbody>${q}</tbody></table></div>` : '<p class="muted">비어 있습니다.</p>'}
  <h2 style="margin-top:14px">새로 짓기</h2><label>지역 <select data-action="buildRegion">${regs.map(r => `<option value="${r.id}" ${r.id === rid ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label><div class="btns">${opts}</div>
  <p class="mini">공장 터는 기반 시설과 인구에 따라 정해집니다. 채굴 건물은 지역의 매장량까지. 지도에서 지역을 눌러도 바로 지을 수 있습니다.</p>`;
}
function production() {
  const c = me(), cap = E.econ.armsCapacity(state, data, c.id), used = sum(c.lines.map(l => l.factories));
  const M = mods(state, data, c);
  const lines = data.equipment.map(eq => {
    const l = c.lines.find(x => x.equip === eq.id), locked = (eq.tech && !c.research.done.includes(eq.tech)) || (eq.air && !M.equipment[eq.id]);
    return `<tr><td>${esc(eq.name)} ${M.equipment[eq.id] > 1 ? `<span class="tag">×${M.equipment[eq.id]}</span>` : ''}</td><td>${num(c.stock[eq.id] || 0)}</td><td>${l ? `${l.factories}` : 0}</td><td>${l ? pct(l.eff) : '—'}</td><td>${l ? num(l.lastPerDay || 0, 2) : '—'}</td><td>${locked ? '<span class="muted">연구 필요</span>' : `<button class="small icon" data-action="line" data-e="${eq.id}" data-d="-1" ${!l ? 'disabled' : ''}>−</button><button class="small icon" data-action="line" data-e="${eq.id}" data-d="1" ${used + 1 > Math.floor(cap) ? 'disabled' : ''}>+</button>`}</td></tr>`;
  }).join('');
  const docks = E.econ.dockCapacity(state, data, c.id);
  const ships = c.naval.map((n, i) => `<tr><td>${esc(X.ships.get(n.ship).name)}</td><td>${n.count}척</td><td>${n.docks}</td><td style="min-width:110px">${bar(n.progress / X.ships.get(n.ship).cost)}</td><td><button class="small" data-action="cancelShip" data-i="${i}">취소</button></td></tr>`).join('');
  const shipBtns = data.ships.map(sh => `<button class="small" data-action="ship" data-id="${sh.id}" ${!(M.ship[sh.id] || sh.id === 'convoy') || docks < 1 ? 'disabled' : ''}>${esc(sh.name)} (${num(sh.cost)})</button>`).join('');
  return `<div class="cards"><div class="card"><h3>군수 공장</h3><div class="kv"><span>가동</span><b>${num(cap, 1)}</b><span>배치</span><b>${used}</b><span>산출 배율</span><b>${pct(c.rates.arms / Math.max(1, cap))}(원료·안정도·법)</b><span>원료</span><b>강철·희소 금속·고무·공구를 시장에서 산다</b></div></div></div>
  <h2 style="margin-top:14px">생산 라인</h2><p class="mini">라인의 효율은 처음 ${pct(data.economy.lineStart)}에서 날마다 올라 상한(${pct(data.economy.lineCapBase + M.efficiencyCap)})까지 갑니다. 공장을 빼면 그 장비의 생산이 멈춥니다.</p>
  <div class="scroll-x"><table><thead><tr><th>장비</th><th>재고</th><th>공장</th><th>효율</th><th>하루 생산</th><th></th></tr></thead><tbody>${lines}</tbody></table></div>
  <h2 style="margin-top:14px">조선 (조선소 ${num(docks, 1)})</h2>${ships ? `<div class="scroll-x"><table><thead><tr><th>함선</th><th>남은 수</th><th>조선소</th><th>진행</th><th></th></tr></thead><tbody>${ships}</tbody></table></div>` : '<p class="muted">건조 중인 배가 없습니다.</p>'}<div class="btns">${shipBtns}</div><p class="mini">새 배는 수도(또는 큰 항구)에 '새 함선' 함대로 나옵니다. 한 번에 조선소 절반을 써서 3척씩 짓습니다.</p>`;
}
function market() {
  const c = me(), Rr = E.econ.compute(state, data, c.id), last = c.econ.last || {};
  const rows = data.goods.map(g => { const x = Rr.goods[g.id], r = x.price / g.price; return `<tr><td>${esc(g.name)}</td><td class="${r > 1.15 ? 'bad' : r < .85 ? 'good' : ''}">${pct(r)}</td><td>${num(x.supply, 1)}</td><td>${num(x.demand, 1)}</td><td>${num(x.sup.imports, 1)}</td><td>${num(x.dem.exports, 1)}</td><td>${num(x.dem.government, 1)}</td><td>${x.shortage ? `<span class="bad">부족 ${pct(x.shortage)}</span>` : ''}</td></tr>`; }).join('');
  const f = Rr.finance;
  return `<div class="cards"><div class="card"><h3>경제</h3><div class="kv"><span>생산(부가가치)</span><b>${num(Rr.gdp)} /달 (1936년 1월 대비 ${pct(Rr.gdp / Math.max(1, c.econ.gdpBase))})</b><span>노동 인구</span><b>${num(Rr.labor.workforce * 1e4 / 1e4)}만 명</b><span>공장·농장 고용</span><b>${num(Rr.labor.employed)}만 명</b><span>자급 농업</span><b>${num(Rr.labor.subsistence)}만 명</b><span>군인·훈련병</span><b>${num(Rr.labor.soldiers)}만 명</b><span>임금 수준</span><b>${pct(Rr.wage)}</b><span>물가</span><b>${pct(Rr.cpi)}</b></div></div>
  <div class="card"><h3>재정</h3><div class="kv"><span>세입</span><b>${num(f.income)}</b><span>세출</span><b>${num(f.expense)}</b><span>· 군수·조선 인건비</span><b>${num(f.govWages)}</b><span>· 군수 원료·연료</span><b>${num(f.govGoods)}</b><span>· 건설 자재(정부 몫)</span><b>${num(f.construction)}</b><span>· 군 급여</span><b>${num(f.military)}</b><span>수지</span><b class="${f.balance < 0 ? 'bad' : 'good'}">${num(f.balance)}</b><span>부채</span><b>${num(c.econ.debt)}</b></div></div>
  <div class="card"><h3>무역</h3><div class="kv"><span>역량</span><b>${num(Rr.trade.capacity)} (항구·무역법·봉쇄)</b><span>사용</span><b>${num(Rr.trade.used)}</b><span>수입</span><b>${num(Rr.trade.imports)}</b><span>수출</span><b>${num(Rr.trade.exports)}</b><span>봉쇄</span><b>${pct(Rr.trade.blockade)}</b><span>금수</span><b>${c.embargoedBy.length ? c.embargoedBy.map(x => esc(C(x).short)).join(', ') : '없음'}</b></div></div></div>
  <h2 style="margin-top:14px">시장(이번 달)</h2><p class="mini">가격 = 구매 주문과 판매 주문의 차이로 정해집니다(《대한민국 1960》의 시장 엔진). 공급 부족이면 그 상품을 쓰는 공장·생산 라인·건설이 느려집니다. 수입은 세계시장의 공급국 몫(금수·전쟁 상대 제외)과 무역 역량 안에서만 들어옵니다.</p>
  <div class="scroll-x"><table><thead><tr><th>상품</th><th>가격</th><th>판매</th><th>구매</th><th>수입</th><th>수출</th><th>정부·군</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function design() {
  const c = me(), M = mods(state, data, c);
  const own = data.templates.filter(t => t.country === c.id || t.country === '*').concat(state.templates.filter(t => t.owner === c.id));
  const d0 = ui.design || { name: '새 사단', bat: { infantry: 6, artillery: 1 }, sup: ['engineer'] };
  ui.design = d0;
  const tmp = { id: '__preview', country: c.id, owner: c.id, name: d0.name, bat: d0.bat, sup: d0.sup };
  state.templates.push(tmp); const st = E.mil.templateStats(state, data, '__preview', c.id); state.templates.pop();
  const lineB = data.battalions.filter(b => b.line), supB = data.battalions.filter(b => b.support);
  const can = b => !b.tech || c.research.done.includes(b.tech);
  const tplRow = t => { const s2 = E.mil.templateStats(state, data, t.id, c.id); return `<tr><td>${esc(t.name)}${t.owner ? ' <span class="tag ok">설계</span>' : ''}</td><td>${Object.entries(t.bat).map(([b, n]) => `${X.battalions.get(b).name}×${n}`).join(' ')}${t.sup.length ? ' · ' + t.sup.map(b => X.battalions.get(b).name).join(', ') : ''}</td><td>${num(s2.soft)}</td><td>${num(s2.def)}</td><td>${num(s2.brk)}</td><td>${num(s2.width)}</td><td>${people(s2.manpower)}</td><td><button class="small" data-action="train" data-id="${t.id}">모집</button><button class="small" data-action="editTpl" data-id="${t.id}">고쳐 만들기</button></td></tr>`; };
  return `<div class="cards"><div class="card"><h3>설계 <input type="text" data-action="tplName" value="${esc(d0.name)}" maxlength="20" style="width:150px"></h3>
  ${lineB.map(b => `<div class="row"><b>${esc(b.name)}${can(b) ? '' : ' <span class="muted">(연구 필요)</span>'}</b><span><button class="small icon" data-action="bat" data-id="${b.id}" data-d="-1">−</button> ${d0.bat[b.id] || 0} <button class="small icon" data-action="bat" data-id="${b.id}" data-d="1" ${can(b) ? '' : 'disabled'}>+</button></span></div>`).join('')}
  <h3 style="margin-top:8px">지원 중대 (4개까지)</h3><div class="btns">${supB.map(b => `<button class="small ${d0.sup.includes(b.id) ? 'primary' : ''}" data-action="sup" data-id="${b.id}" ${can(b) ? '' : 'disabled'}>${esc(b.name)}</button>`).join('')}</div>
  <div class="btns"><button class="primary" data-action="saveTpl">편제 저장</button></div></div>
  <div class="card"><h3>능력치(지금 기술 기준)</h3><div class="kv"><span>보병 공격(연)</span><b>${num(st.soft)}</b><span>기갑 공격(경)</span><b>${num(st.hard)}</b><span>방어</span><b>${num(st.def)}</b><span>돌파</span><b>${num(st.brk)}</b><span>장갑·관통</span><b>${num(st.armor)} / ${num(st.pierce)}</b><span>조직력</span><b>${num(st.org)}</b><span>체력</span><b>${num(st.hp)}</b><span>전투 폭</span><b>${num(st.width)}</b><span>속도</span><b>${num(st.speed)}/일</b><span>보급 사용</span><b>${num(st.supply, 2)}</b><span>인력</span><b>${people(st.manpower)}명</b><span>장비</span><b>${Object.entries(st.eq).map(([e, n]) => `${X.equipment.get(e).name} ${num(n)}`).join(', ')}</b></div>
  <p class="mini">공격이 상대 방어(공격 쪽은 돌파)보다 크면 피해가 크게 늘어납니다. 상대 관통보다 장갑이 두꺼우면 받는 피해가 줄어듭니다. 지형의 전투 폭 안에서만 싸웁니다.</p></div></div>
  <h2 style="margin-top:14px">편제와 모집</h2><p class="mini">모집하면 60일 훈련 뒤 수도에 나옵니다. 장비가 모자라면 그만큼 병력이 적은 채로 나옵니다. 인력 ${people(E.mil.manpowerAvailable(state, data, c.id))}명.</p>
  <div class="scroll-x"><table><thead><tr><th>편제</th><th>구성</th><th>공격</th><th>방어</th><th>돌파</th><th>폭</th><th>인력</th><th></th></tr></thead><tbody>${own.map(tplRow).join('')}</tbody></table></div>`;
}
function army() {
  const c = me(), list = state.divisions.filter(dv => dv.owner === c.id);
  const by = new Map(); for (const dv of list) by.set(dv.at, (by.get(dv.at) || []).concat(dv));
  const groups = [...by].sort((a, b) => b[1].length - a[1].length).map(([rid, l]) => `<div class="card"><h3>${esc(R(rid)?.name || X.seas.get(rid)?.name || rid)} <span class="mini">${l.length}개</span> <button class="small" data-action="selectRegionDivs" data-region="${rid}">지도에서 고르기</button></h3>${bar(sum(l.map(x => x.str)) / l.length, 'good')}<p class="mini">${l.map(dv => `${esc(dv.name)}(${pct(dv.str)})`).join(', ')}</p></div>`).join('');
  const tr = c.training.map((t, i) => `<tr><td>${esc(E.mil.templateOf(state, data, t.tpl).name)}</td><td>${esc(R(t.at)?.name || '')}</td><td style="min-width:120px">${bar(t.days / t.total)}</td><td>${t.total - t.days}일</td><td><button class="small" data-action="cancelTrain" data-i="${i}">취소</button></td></tr>`).join('');
  return `<div class="cards"><div class="card"><h3>인력</h3><div class="kv"><span>모집 가능</span><b>${people(E.mil.manpowerAvailable(state, data, c.id))}명</b><span>복무 중</span><b>${people(c.manpower.used)}명</b><span>훈련 중</span><b>${people(c.manpower.training)}명</b><span>사상자</span><b>${people(c.manpower.lost)}명</b><span>징병법</span><b>${esc(X.lawOption.get(c.laws.conscription).name)}</b></div></div></div>
  <h2 style="margin-top:14px">훈련</h2>${tr ? `<div class="scroll-x"><table><tbody>${tr}</tbody></table></div>` : '<p class="muted">사단 설계 창에서 모집합니다.</p>'}
  <h2 style="margin-top:14px">배치 (${list.length}개 사단)</h2><div class="cards">${groups || '<p class="muted">사단이 없습니다.</p>'}</div>`;
}
function navy() {
  const list = state.fleets.filter(f => f.owner === state.player);
  return `<p class="mini">함대를 고른 뒤 지도에서 해역이나 아군 항구를 누르면 이동합니다. 상륙하려면 목표 앞바다를 순찰해 해상 우세(50% 이상)를 잡아야 합니다. 잠수함은 통상 파괴로 적의 무역과 보급을 끊습니다.</p>
  <div class="cards">${list.map(f => `<div class="card"><h3>${esc(f.name)}</h3><p>${shipList(f)}</p><div class="kv"><span>위치</span><b>${esc(X.seas.get(f.at)?.name || R(f.at)?.name)}</b><span>임무</span><b>${missionName(f.mission)}</b><span>전력</span><b>${num(E.mil.fleetStrength(state, data, f))}</b></div><div class="btns"><button class="small" data-action="selFleet" data-id="${f.id}">고르기</button>${['patrol', 'raid', 'escort', 'port'].map(m => `<button class="small ${f.mission === m ? 'primary' : ''}" data-action="fleetMission" data-id="${f.id}" data-m="${m}">${missionName(m)}</button>`).join('')}</div></div>`).join('') || '<p class="muted">함대가 없습니다.</p>'}</div>`;
}
function airforce() {
  const c = me(), list = state.air.filter(w => w.owner === state.player);
  const stock = ['fighter', 'cas', 'bomber', 'naval_bomber'].map(t => `${data.aircraft[t].name} ${num(c.stock[t] || 0)}`).join(', ');
  return `<p class="mini">비행단은 기지(비행장)에서 작전 반경 안의 항공 구역 또는 해역에 임무를 나갑니다. 제공권은 전투의 공격력과 근접 지원에 영향을 줍니다. 재고: ${stock}.</p>
  <div class="scroll-x"><table><thead><tr><th>기종</th><th>대수</th><th>기지</th><th>임무</th><th>구역</th><th></th></tr></thead><tbody>${list.map(w => `<tr><td>${esc(data.aircraft[w.type].name)}</td><td>${num(w.count)}</td><td>${esc(R(w.base)?.name)}</td><td>${esc(data.airMissions[w.mission].name)}</td><td>${esc(X.airZones.get(w.zone)?.name || X.seas.get(w.zone)?.name || '—')}${w.mission !== 'idle' && !E.mil.wingInRange(state, data, w) ? ' <span class="bad">반경 밖</span>' : ''}</td><td><button class="small" data-action="selWing" data-id="${w.id}">고르기</button></td></tr>`).join('')}</tbody></table></div>`;
}
function logView() {
  const items = state.log.slice().reverse().map(l => `<tr><td>${fmtDate(l.day)}</td><td style="white-space:normal;text-align:left">${esc(l.text)}</td></tr>`).join('');
  const fired = Object.entries(state.fired).filter(([, v]) => v >= 0).map(([id, day]) => { const ev = X.events.get(id); return ev ? `<div class="card"><h3>${esc(ev.title)} <span class="mini">${fmtDate(day)}</span></h3><p class="mini">${esc(ev.history)}</p></div>` : ''; }).join('');
  return `<div class="btns"><button data-action="exportSave">저장 텍스트 보기·복사</button>${ARTIFACT ? '' : '<button data-action="downloadSave">저장 파일 내려받기</button>'}<button data-action="openLoad">저장 불러오기</button><button class="danger" data-action="quit">처음 화면</button></div>
  <h2 style="margin-top:14px">일어난 역사 사건</h2><div class="cards">${fired || '<p class="muted">아직 없습니다.</p>'}</div><h2 style="margin-top:14px">연대기</h2><div class="scroll-x"><table><tbody>${items}</tbody></table></div>`;
}
function helpView() {
  return `<div class="cards"><div class="card"><h3>시간</h3><p>하루씩 흐릅니다. 위의 Ⅱ는 멈춤, 1~5는 속도입니다(키보드: 스페이스, 1~5). 결정할 사건이 오면 멈춥니다. 시장·재정은 매달 1일에 결산합니다.</p></div>
  <div class="card"><h3>지도</h3><p>끌어서 움직이고 휠·두 손가락으로 확대합니다. 지역을 누르면 정보와 건설, 우리 사단 표를 누르면 사단을 고릅니다. 사단을 고른 채 지역을 누르면 이동·공격·상륙 명령입니다. 붉은 점선은 전선입니다.</p></div>
  <div class="card"><h3>경제와 공장</h3><p>민간 공장은 건설점을, 군수 공장은 생산 라인의 장비를, 조선소는 배를 만듭니다. 모든 공장은 나라마다 따로 도는 시장에서 원료(강철·고무·희소 금속·석유·공구)를 삽니다. 원료가 부족하면 느려지고, 금수와 봉쇄는 수입을 막습니다.</p></div>
  <div class="card"><h3>국가 중점·연구·법</h3><p>국가 중점은 하나씩 진행해 공장·사단·명분·국가 정신을 얻습니다. 연구는 칸마다 하나씩. 법은 정치력으로 바꾸며 동원 법에는 전쟁 지지도가 필요합니다.</p></div>
  <div class="card"><h3>전투</h3><p>공격 쪽의 공격이 방어 쪽의 방어보다 크면 피해가 크게 늘어납니다. 조직력이 바닥난 방어 사단은 물러나고, 물러날 곳이 없으면 포위되어 무너집니다. 보급이 모자라면 약해지고 소모됩니다. 지형·요새·제공권·연료가 결과를 바꿉니다.</p></div>
  <div class="card"><h3>항복과 승리</h3><p>본토의 승점 대부분을 잃으면 항복합니다(지도 밖 본국이 있는 미국·영국·소련은 본국이 남아 있는 한 항복하지 않습니다). 1945년 12월 31일 또는 일본의 항복으로 끝납니다.</p></div>
  <div class="card"><h3>역사와 창작</h3><p>사건의 '(역사)' 선택지는 실제로 일어난 쪽, '(가상)'은 이 게임의 가정입니다. 사건마다 실제 역사를 따로 적었습니다. 전쟁 범죄와 민간인 피해는 게임의 보상으로 쓰지 않습니다.</p></div></div>`;
}

/* ---------- 사건·끝 ---------- */
function modalHtml() {
  if (ui.modal === 'save') return `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true"><h2>저장 텍스트</h2><p class="mini">아래 텍스트를 복사해 두었다가 '저장 불러오기'에 붙여 넣으면 이어 할 수 있습니다.</p><textarea id="saveText" readonly style="width:100%;height:180px">${esc(E.exportSave(state))}</textarea><div class="btns"><button data-action="copySave">복사</button><button data-action="closeModal">닫기</button></div></div></div>`;
  if (ui.modal === 'load') return `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true"><h2>저장 불러오기</h2><textarea id="loadText" style="width:100%;height:160px" placeholder="저장 텍스트를 붙여 넣으세요"></textarea>${ARTIFACT ? '' : '<p><input type="file" id="loadFile" accept=".json,application/json"></p>'}<div class="btns"><button class="primary" data-action="doLoad">불러오기</button><button data-action="closeModal">닫기</button></div></div></div>`;
  if (!state) return '';
  const p = state.pending[0];
  if (p) {
    const ev = X.events.get(p.event);
    return `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="evt"><h2 id="evt">${esc(ev.title)}</h2><p class="mini">${fmtDate(state.day)}</p><p>${esc(ev.desc)}</p><div class="hist"><b>실제 역사</b> ${esc(ev.history)}</div><div class="opts">${ev.options.map((o, i) => `<button data-action="eventOpt" data-id="${ev.id}" data-o="${i}">${esc(o.name)}<small>${esc(eventFxText(o.fx))}</small></button>`).join('')}</div></div></div>`;
  }
  if (state.ended && ui.modal !== 'hideEnd') return endHtml();
  return '';
}
function eventFxText(fx) {
  const out = [focusFxText(fx)];
  if (fx.war) out.push(`전쟁: ${C(fx.war[0]).short} → ${C(fx.war[1]).short}`); if (fx.peace) out.push('강화'); if (fx.nap) out.push('불가침 조약'); if (fx.embargo) out.push('금수');
  if (fx.annex) out.push(`합병: ${fx.annex.map(x => C(x).short).join(', ')}`); if (fx.access) out.push('군사 통행권'); if (fx.homelandLost) out.push('본국 상실'); if (fx.others) out.push('다른 나라에도 효과');
  return out.filter(Boolean).join(' · ');
}
function endHtml() {
  const c = me(), reason = { time: '1945년 12월 31일이 되었습니다.', japan_surrender: '일본이 항복했습니다.', player_capitulated: `${c.short}이(가) 항복했습니다.` }[state.ended.reason] || '';
  const vpNow = E.pol.controlledVP(state, data, c.id), vp0 = data.regions.filter(r => r.owner === c.id && !r.offmap).reduce((a, r) => a + r.vp, 0);
  const rows = Object.values(state.countries).filter(o => o.playable).map(o => `<tr><td>${esc(o.short)}</td><td>${o.exists ? (o.capitulated ? '항복' : '존속') : '소멸'}</td><td>${E.pol.controlledVP(state, data, o.id)}</td><td>${people(o.casualties || 0)}</td><td>${num(o.shipsLost || 0)}</td></tr>`).join('');
  return `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true"><h2>전쟁의 끝</h2><p>${reason} ${fmtDate(state.day)}</p><div class="kv"><span>통제한 승점</span><b>${vpNow} (처음 ${vp0})</b><span>사상자</span><b>${people(c.casualties || 0)}명</b><span>잃은 함선</span><b>${num(c.shipsLost || 0)}척</b><span>마친 국가 중점</span><b>${c.focus.done.length}</b></div>
  <div class="scroll-x"><table><thead><tr><th>나라</th><th>결과</th><th>승점</th><th>사상자</th><th>함선 손실</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="hist">실제 역사에서 일본은 1945년 8월 15일 항복을 발표하고 9월 2일 항복 문서에 서명했다. 이 게임의 결과는 플레이와 모형이 만든 가상의 결과다.</div><div class="btns"><button data-action="hideEnd">지도 보기</button><button class="primary" data-action="quit">처음 화면</button></div></div></div>`;
}

/* ---------- 그리기 ---------- */
let lastScreen = '';
let lastScreenT = 0;
function renderAll(full = false, tick = false) {
  const app = $('#app');
  if (ui.screen === 'start' || !state) { app.innerHTML = startView() + `<div id="modal">${modalHtml()}</div>`; return; }
  if (full || !$('#map')) { app.innerHTML = shell() + '<div id="modal"></div>'; buildMap(); }
  topbar();
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.view === ui.view));
  document.querySelectorAll('.mapmodes button').forEach(b => b.classList.toggle('on', b.dataset.mode === ui.mapMode));
  updateMap();
  if (tick && ui.pdown) return;
  const side = $('#side'), sh = sideHtml(); if (sh !== ui.lastSide) { const st = side.scrollTop; side.innerHTML = sh; side.scrollTop = st; ui.lastSide = sh; }
  const now = performance.now(), scr = $('#screen'), html = tick && now - lastScreenT < 900 ? lastScreen : screenHtml();
  if (html !== lastScreen) { lastScreenT = now; const box = scr.firstElementChild, st = box ? box.scrollTop : 0; scr.innerHTML = html; if (scr.firstElementChild) scr.firstElementChild.scrollTop = st; lastScreen = html; }
  $('#ticker').innerHTML = tickerHtml();
  const m = $('#modal'), mh = modalHtml(); if (m.dataset.h !== mh) { m.innerHTML = mh; m.dataset.h = mh; const b = m.querySelector('.modal button'); if (b) b.focus(); }
  if (ui.toast) { const el = $('#toast'); el.textContent = ui.toast; el.hidden = false; }
}

/* ---------- 시계 ---------- */
const SPEED_MS = [0, 900, 420, 180, 70, 20];
let lastT = 0, acc = 0, lastDraw = 0;
function loop(t) {
  requestAnimationFrame(loop);
  if (!state || ui.screen !== 'game') return;
  if (!ui.running || state.pending.length || state.ended) { if (ui.running && (state.pending.length || state.ended)) { ui.running = false; renderAll(); } lastT = t; return; }
  acc += Math.min(500, t - (lastT || t)); lastT = t;
  const ms = SPEED_MS[ui.speed]; let n = 0;
  while (acc >= ms && n < 6) { acc -= ms; E.advanceDay(state, data); n++; if (state.pending.length || state.ended) break; if (dateOf(state.day).d === 1) save(); }
  if (n && t - lastDraw > 120) { lastDraw = t; renderAll(false, true); }
}
requestAnimationFrame(loop);
function setSpeed(i) { if (!state) return; if (i === 0) { ui.running = false; } else { ui.speed = i; ui.running = true; lastT = 0; acc = 0; } renderAll(); }

/* ---------- 입력 ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action, id = b.dataset.id;
  switch (a) {
    case 'pick': ui.pick = id; renderAll(); break;
    case 'new': startNew(); break;
    case 'continue': { const s = loadAutosave(); if (s) { state = s; ui.screen = 'game'; ui.view = null; ui.sel = { region: null, divisions: [], fleet: null, wing: null }; fitMap(); renderAll(true); } break; }
    case 'help': if (state) { ui.view = 'help'; renderAll(); } else { ui.helpOnly = true; $('#app').innerHTML = `<div class="start"><div class="start-in"><h1>게임 방법</h1>${helpView()}<div class="btns"><button data-action="back">돌아가기</button></div></div></div>`; } break;
    case 'back': renderAll(); break;
    case 'nav': ui.view = ui.view === b.dataset.view ? null : b.dataset.view; renderAll(); break;
    case 'closeView': ui.view = null; renderAll(); break;
    case 'speed': setSpeed(+b.dataset.s); break;
    case 'menu': ui.view = 'log'; renderAll(); break;
    case 'mapMode': ui.mapMode = b.dataset.mode; renderAll(); break;
    case 'zoom': zoomAt(+b.dataset.z); break;
    case 'fit': ui.vb = { x: 0, y: 0, w: MW, h: MH }; applyViewBox(); break;
    case 'clearSel': ui.sel = { region: null, divisions: [], fleet: null, wing: null }; renderAll(); break;
    case 'toggleDiv': { const s = new Set(ui.sel.divisions); s.has(id) ? s.delete(id) : s.add(id); if (!ui.sel.divisions.length) ui.sel = { region: ui.sel.region, divisions: [id], fleet: null, wing: null }; else ui.sel.divisions = [...s]; renderAll(); break; }
    case 'selectRegionDivs': { const rid = b.dataset.region || (state.divisions.find(dv => dv.id === ui.sel.divisions[0]) || {}).at; ui.sel = { region: rid, divisions: state.divisions.filter(dv => dv.owner === state.player && dv.at === rid).map(dv => dv.id), fleet: null, wing: null }; ui.view = null; if (R(rid)?.label) { ui.vb = { ...ui.vb, x: R(rid).label[0] - ui.vb.w / 2, y: R(rid).label[1] - ui.vb.h / 2 }; applyViewBox(); } renderAll(); break; }
    case 'stopDivs': act({ type: 'stop', divisions: ui.sel.divisions }); break;
    case 'focusInfo': ui.focusInfo = id; renderAll(); break;
    case 'focus': act({ type: 'focus', id }); break;
    case 'cancelFocus': act({ type: 'cancelFocus' }); break;
    case 'techCat': ui.techCat = id; renderAll(); break;
    case 'research': { const slot = me().research.slots.findIndex(x => !x); act({ type: 'research', slot, tech: id }); break; }
    case 'cancelResearch': act({ type: 'cancelResearch', slot: +b.dataset.slot }); break;
    case 'law': act({ type: 'law', group: b.dataset.g, option: b.dataset.o }); break;
    case 'justify': act({ type: 'justify', target: id }); break;
    case 'declare': if (confirm(`${C(id).name}에 전쟁을 선포할까요? 진영과 괴뢰국도 함께 전쟁에 들어갑니다.`)) act({ type: 'declare', target: id }); break;
    case 'joinFaction': act({ type: 'joinFaction' }); break;
    case 'build': act({ type: 'build', id, kind: b.dataset.kind, region: b.dataset.region }); break;
    case 'cancelBuild': act({ type: 'cancelBuild', index: +b.dataset.i }); break;
    case 'prioritize': act({ type: 'prioritize', index: +b.dataset.i }); break;
    case 'line': { const l = me().lines.find(x => x.equip === b.dataset.e); act({ type: 'setLine', equip: b.dataset.e, factories: (l ? l.factories : 0) + +b.dataset.d }); break; }
    case 'ship': act({ type: 'shipyard', ship: id, docks: Math.max(1, Math.round(E.econ.dockCapacity(state, data, state.player) / 2)), count: 3 }); break;
    case 'cancelShip': act({ type: 'cancelShip', index: +b.dataset.i }); break;
    case 'train': act({ type: 'train', tpl: id }); break;
    case 'cancelTrain': act({ type: 'cancelTrain', index: +b.dataset.i }); break;
    case 'bat': { const d0 = ui.design; d0.bat = { ...d0.bat, [id]: clamp((d0.bat[id] || 0) + +b.dataset.d, 0, 12) }; renderAll(); break; }
    case 'sup': { const d0 = ui.design; d0.sup = d0.sup.includes(id) ? d0.sup.filter(x => x !== id) : d0.sup.length < 4 ? [...d0.sup, id] : d0.sup; renderAll(); break; }
    case 'saveTpl': { const r = act({ type: 'template', name: ui.design.name, bat: ui.design.bat, sup: ui.design.sup }); if (r.ok) toast('편제를 저장했습니다.'); break; }
    case 'editTpl': { const t = E.mil.templateOf(state, data, id); ui.design = { name: t.name + ' 개량', bat: { ...t.bat }, sup: [...t.sup] }; renderAll(); break; }
    case 'selFleet': ui.sel = { region: null, divisions: [], fleet: id, wing: null }; ui.view = null; renderAll(); break;
    case 'fleetMission': act({ type: 'fleetMission', fleet: id, mission: b.dataset.m }); break;
    case 'selWing': ui.sel = { region: null, divisions: [], fleet: null, wing: id }; ui.view = null; renderAll(); break;
    case 'airMission': act({ type: 'air', wing: id, mission: b.dataset.m }); break;
    case 'pickZone': ui.sel.pickZone = true; toast('지도에서 작전할 지역이나 해역을 누르세요.'); break;
    case 'airFill': act({ type: 'airAssign', wing: id, n: me().stock[state.air.find(w => w.id === id).type] || 0 }); break;
    case 'eventOpt': E.dispatch(state, data, { type: 'event', event: id, option: +b.dataset.o, country: state.player }); renderAll(); save(); break;
    case 'hideEnd': ui.modal = 'hideEnd'; renderAll(); break;
    case 'quit': save(); state = null; ui.screen = 'start'; ui.view = null; ui.modal = null; renderAll(); break;
    case 'exportSave': ui.modal = 'save'; renderAll(); break;
    case 'downloadSave': { const blob = new Blob([E.exportSave(state)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = `frontline1936_${state.day}.json`; l.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); break; }
    case 'copySave': { const t = $('#saveText'); t.select(); try { navigator.clipboard.writeText(t.value).then(() => toast('복사했습니다.'), () => toast('자동 복사가 막혀 텍스트를 선택했습니다. Ctrl+C로 복사하세요.')); } catch { toast('텍스트를 선택했습니다. Ctrl+C로 복사하세요.'); } break; }
    case 'openLoad': ui.modal = 'load'; renderAll(); break;
    case 'closeModal': ui.modal = null; renderAll(); break;
    case 'doLoad': { const text = $('#loadText').value.trim(); const f = $('#loadFile')?.files?.[0]; const go = t => { const r = E.importSave(t, data); if (!r.ok) { toast(r.reason); return; } state = r.state; ui.modal = null; ui.screen = 'game'; ui.view = null; ui.sel = { region: null, divisions: [], fleet: null, wing: null }; fitMap(); renderAll(true); save(); }; if (f) f.text().then(go); else go(text); break; }
    default: break;
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.action === 'buildRegion') { ui.buildRegion = t.value; renderAll(); }
});
document.addEventListener('input', e => { if (e.target.dataset.action === 'tplName') ui.design.name = e.target.value; });
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select')) return;
  if (e.key === 'Escape') { if (ui.view) ui.view = null; else ui.sel = { region: null, divisions: [], fleet: null, wing: null }; renderAll(); return; }
  if (!state || ui.screen !== 'game' || state.pending.length) return;
  if (e.key === ' ') { e.preventDefault(); setSpeed(ui.running ? 0 : ui.speed || 2); }
  else if (/^[1-5]$/.test(e.key)) setSpeed(+e.key);
});
document.addEventListener('pointerdown', () => { ui.pdown = true; }, true);
for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => { ui.pdown = false; }, true);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);
renderAll();
globalThis.__GAME__ = { get state() { return state; }, data, E, ui, renderAll };
