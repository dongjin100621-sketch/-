/* 루미나리아: Eight Fates — 게임 엔진 */
(() => {
'use strict';
const $ = (s) => document.querySelector(s);
const SAVE_KEY = 'luminaria_save_v1';
const META_KEY = 'luminaria_meta_v1';
const WEEK = ['월', '화', '수', '목', '금', '토', '일'];
const EV_AT = [20, 45, 70];
const END_AT = 80;
const SPEEDS = { 느리게: 45, 보통: 24, 빠르게: 10, 즉시: 0 };

const img = (id, kind) => `img/${id}_${kind}.${kind === 'chibi' ? 'png' : 'jpg'}`;
const face = (id, ex) => img(id, 'e' + (CHARS[id].ex[ex] ?? 0));
const fmt = (t) => t.replaceAll('{P}', S ? S.name : '');
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return (c >= 0 && c % 28) ? a : b; };

/* ───── 저장 ───── */
let S = null;
let META = load(META_KEY) || { met: {}, endings: {}, speed: '보통' };
function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } }
const saveGame = () => S && store(SAVE_KEY, S);
const saveMeta = () => store(META_KEY, META);

function newState(name) {
  const o = (v) => Object.fromEntries(ORDER.map((k) => [k, v]));
  return {
    name, day: 1, slot: 0, bg: 'dorm',
    stats: { int: 5, str: 5, brave: 5, charm: 5 }, gold: 100, fat: 0,
    aff: o(0), met: o(false), intro: o(false), ev: o(0), talk: o(0), gifted: {}, inv: {}, presence: {},
  };
}

/* ───── 화면 ───── */
function screen(id) {
  for (const s of ['title', 'naming', 'hub', 'scene']) $('#' + s).classList.toggle('hidden', s !== id);
}
function setBg(name) { $('#bg').style.backgroundImage = `url(img/bg_${name}.jpg)`; }
function toast(msg) { const d = document.createElement('div'); d.textContent = msg; $('#toast').append(d); setTimeout(() => d.remove(), 2700); }
function pop(text, down) {
  const d = document.createElement('div'); d.className = 'heart-pop' + (down ? ' down' : ''); d.textContent = text;
  const r = $('#sBox').getBoundingClientRect(); d.style.left = (r.left + 30) + 'px'; d.style.top = (r.top - 40) + 'px';
  document.body.append(d); setTimeout(() => d.remove(), 1500);
}
function banner(big, small) {
  return new Promise((res) => {
    const d = document.createElement('div'); d.className = 'day-banner'; d.innerHTML = `<div>${big}<small>${small || ''}</small></div>`;
    document.body.append(d); setTimeout(() => { d.remove(); res(); }, 2000);
  });
}

/* ───── 대화 엔진 ───── */
let advance = null;
let typing = null;
const sceneEl = $('#scene');
sceneEl.addEventListener('click', (e) => { if (!e.target.closest('#sChoices')) step(); });
document.addEventListener('keydown', (e) => {
  if (sceneEl.classList.contains('hidden') || !$('#modal').classList.contains('hidden')) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); step(); }
});
function step() {
  if ($('#sChoices').childElementCount) return;
  if (typing) { typing(); return; }
  if (advance) { const a = advance; advance = null; a(); }
}

function charShow(id, cg) {
  const el = $('#sChar');
  el.src = img(id, 'key'); el.classList.add('on'); el.classList.toggle('cg', !!cg);
}
function charHide() { $('#sChar').classList.remove('on', 'cg'); }

function say(who, ex, text) {
  const box = $('#sBox'), t = $('#sText');
  let name = '';
  if (CHARS[who]) { name = CHARS[who].name; $('#sFace').src = face(who, ex); box.classList.remove('noface'); }
  else { box.classList.add('noface'); name = who === 'me' ? S.name : who; }
  $('#sName').textContent = name;
  t.classList.toggle('narr', !who);
  const full = fmt(text);
  const speed = SPEEDS[META.speed] ?? 24;
  return new Promise((res) => {
    let i = 0; t.textContent = '';
    const done = () => { clearInterval(iv); t.textContent = full; typing = null; advance = res; };
    if (!speed) { t.textContent = full; advance = res; return; }
    const iv = setInterval(() => { i++; t.textContent = full.slice(0, i); if (i >= full.length) done(); }, speed);
    typing = done;
  });
}
function choose(opts) {
  return new Promise((res) => {
    const box = $('#sChoices'); box.innerHTML = '';
    opts.forEach((o, i) => {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = fmt(o.t);
      if (o.disabled) b.disabled = true;
      b.onclick = (e) => { e.stopPropagation(); box.innerHTML = ''; res(i); };
      box.append(b);
    });
  });
}

async function play(steps) {
  for (const s of steps) {
    if (Array.isArray(s)) {
      if (s.length === 2) await say(s[0], null, s[1]);
      else await say(s[0], s[1], s[2]);
      continue;
    }
    if (s.bg) setBg(s.bg);
    if (s.show) charShow(s.show);
    if (s.cg) charShow(s.cg, true);
    if (s.hide) charHide();
    if (s.met) meet(s.met);
    if (s.aff) for (const [k, v] of Object.entries(s.aff)) addAff(k, v);
    if (s.stats) addStats(s.stats);
    if (s.choice) {
      const i = await choose(s.choice);
      const o = s.choice[i];
      if (o.aff) for (const [k, v] of Object.entries(o.aff)) addAff(k, v);
      if (o.go) await play(o.go);
    }
  }
}

function meet(id) { S.met[id] = true; META.met[id] = true; saveMeta(); }
function addAff(id, n) {
  if (!n) return;
  S.aff[id] = Math.max(0, Math.min(100, S.aff[id] + n));
  pop(n > 0 ? `♥ +${n}` : `♡ ${n}`, n < 0);
}
function addStats(g) {
  for (const [k, v] of Object.entries(g)) {
    if (k === 'gold') S.gold += v;
    else if (k === 'fat') S.fat = Math.max(0, Math.min(100, S.fat + v));
    else S.stats[k] += v;
  }
}

async function runScene(steps, bg) {
  screen('scene');
  $('#sChoices').innerHTML = ''; charHide();
  if (bg) setBg(bg);
  await play(steps);
  charHide();
}

/* ───── 하루 진행 ───── */
const isWeekend = () => (S.day - 1) % 7 >= 5;
function rollPresence() {
  const p = {};
  for (const k of Object.keys(LOCS)) p[k] = [];
  for (const id of ORDER) {
    if (Math.random() > 0.8) continue;
    const h = Object.entries(HAUNTS[id]).filter(([l]) => !(LOCS[l].weekday && isWeekend()));
    let r = Math.random() * h.reduce((a, [, w]) => a + w, 0);
    for (const [l, w] of h) { r -= w; if (r <= 0) { p[l].push(id); break; } }
  }
  S.presence = p;
}
function pendingEvent(id) {
  const k = S.ev[id];
  if (!S.intro[id] || k >= 3 || S.aff[id] < EV_AT[k]) return -1;
  if (k === 2) { const r = CHARS[id].req; if (S.stats[r.stat] < r.v) return -2; }
  return k;
}

async function visit(locId) {
  const L = LOCS[locId];
  S.bg = L.bg;
  const tired = S.fat >= 90 && L.fat > 0;
  const mult = S.fat >= 70 ? 0.5 : 1;
  const parts = [];
  if (!tired) {
    for (const [k, v] of Object.entries(L.gain)) { const n = Math.max(1, Math.round(v * mult)); S.stats[k] += n; parts.push(`${STATS[k]} +${n}`); }
    if (L.gold) { const g = rand(...L.gold); S.gold += g; parts.push(`골드 +${g}`); }
  }
  S.fat = Math.max(0, Math.min(100, S.fat + L.fat));
  parts.push(`피로 ${L.fat > 0 ? '+' : ''}${L.fat}`);
  const lines = [['', `${L.place}. ${L.desc}`]];
  if (tired) lines.push(['', '…너무 지쳐서 아무것도 손에 잡히지 않았다. 오늘은 쉬는 편이 좋겠다.']);
  else if (mult < 1) lines.push(['', '피곤해서 집중이 잘 되지 않는다…']);
  lines.push(['', `【 ${parts.join(' · ')} 】`]);
  await runScene(lines, L.bg);
  if (L.shop) await shop();

  const here = S.presence[locId] || [];
  if (here.length) {
    const opts = here.map((id) => {
      const c = CHARS[id];
      const ev = pendingEvent(id);
      return { t: S.met[id] ? `${c.name}에게 말을 건다  ${'♥'.repeat(Math.ceil(S.aff[id] / 20))}${ev >= 0 ? '  💌' : ''}` : `낯선 학생에게 말을 건다 (${c.name})` };
    });
    opts.push({ t: '오늘은 혼자 보낸다' });
    await say('', null, here.length > 1 ? '이곳에 아는 얼굴이 여럿 보인다. 누구와 이야기할까?' : `${S.met[here[0]] ? CHARS[here[0]].name + josa(CHARS[here[0]].name, '이', '가') : '누군가'} 이곳에 있다.`);
    const i = await choose(opts);
    if (i < here.length) await talkTo(here[i]);
  }
  charHide();
  await endSlot();
}

async function talkTo(id) {
  const st = STORY[id], c = CHARS[id];
  charShow(id);
  if (!S.intro[id]) {
    meet(id); S.intro[id] = true; await play(st.meet); addAff(id, 5);
  } else {
    const k = pendingEvent(id);
    if (k >= 0) {
      await play(st.ev[k]); S.ev[id]++; addAff(id, k === 2 ? 10 : 5);
      toast(`💌 ${c.name}의 이야기 ${S.ev[id]}/3 을(를) 보았다`);
      charShow(id);
    } else {
      S.talk[id] = S.talk[id] || 0;
      const t = st.talks[S.talk[id] % st.talks.length];
      const repeat = S.talk[id] >= st.talks.length;
      S.talk[id]++;
      await play(t.q);
      const i = await choose(t.c.map((x) => ({ t: x[0] })));
      const [, d, reply] = t.c[i];
      addAff(id, (repeat ? 2 : 4) + d);
      await play(reply.map(([e, txt]) => [id, e, txt]));
      if (k === -2) {
        const r = c.req;
        await say('', null, `(${c.name}${josa(c.name, '은', '는')} 무언가 털어놓고 싶은 눈치다. …${STATS[r.stat]}${josa(STATS[r.stat], '이', '가')} ${r.v} 이상이라면 마음을 열어줄지도 모른다.)`);
      }
    }
  }
  await giftMenu(id);
  charHide();
}

async function giftMenu(id) {
  const items = Object.entries(S.inv).filter(([, n]) => n > 0);
  if (!items.length || S.gifted[id]) return;
  const i = await choose([...items.map(([k, n]) => ({ t: `${ITEMS[k].icon} ${ITEMS[k].name} 을(를) 선물한다 (×${n})` })), { t: '선물은 다음에' }]);
  if (i >= items.length) return;
  const key = items[i][0], c = CHARS[id];
  S.inv[key]--; S.gifted[id] = true;
  let line, gain;
  if (c.likes.includes(key)) { line = GIFT_LINES.like[id]; gain = 9; }
  else if (c.dislikes.includes(key)) { line = GIFT_LINES.dislike; gain = 0; }
  else { line = GIFT_LINES.normal; gain = 3; }
  await say(id, line[0], line[1]);
  addAff(id, gain);
}

async function endSlot() {
  S.slot++;
  if (S.slot >= 2) {
    S.fat = Math.max(0, S.fat - 10);
    S.day++; S.slot = 0; S.gifted = {};
    if (S.day === 12) await runScene(COMMON.flicker);
    if (S.day >= LAST_DAY) { await festival(); return; }
    screen('hub'); setBg('dorm'); S.bg = 'dorm';
    await banner(`4월 ${S.day}일 (${WEEK[(S.day - 1) % 7]})`, `별빛 축제까지 ${LAST_DAY - S.day}일`);
  }
  rollPresence(); saveGame(); hub();
}

async function festival() {
  await runScene(COMMON.festivalOpen);
  const cand = ORDER.filter((id) => S.ev[id] >= 3 && S.aff[id] >= END_AT).sort((a, b) => S.aff[b] - S.aff[a]);
  let who = cand[0];
  if (cand.length > 1) {
    await say('', null, '별등 앞에서 기다리고 있을 사람이 떠오른다. 누구에게 갈까?');
    who = cand[await choose(cand.map((id) => ({ t: `${CHARS[id].name}에게 간다` })))];
  }
  if (who) { await play(STORY[who].end); META.endings[who] = true; }
  else await play(COMMON.normalEnd);
  charHide();
  saveMeta();
  try { localStorage.removeItem(SAVE_KEY); } catch { /* 무시 */ }
  S = null;
  credits(who);
}

function credits(who) {
  const cleared = Object.keys(META.endings).length;
  modal(`<div class="credits">
    <div class="logo">LUMINARIA<small>Eight Fates</small></div>
    <p class="quote">${who ? `「${CHARS[who].quote}」` : '「…다음 축제에는, 조금 더 용기를 내볼까.」'}</p>
    <p>엔딩 수집 ${cleared} / 8</p>
    <p style="color:var(--dim);font-size:13px">플레이해주셔서 감사합니다.</p>
    <button class="btn gold" data-close>타이틀로</button></div>`, false, () => title());
}

/* ───── 메인 화면 ───── */
function hub() {
  screen('hub'); setBg(S.bg || 'dorm');
  const wd = WEEK[(S.day - 1) % 7];
  $('#hDate').textContent = `4월 ${S.day}일 (${wd})`;
  $('#hSlot').textContent = S.slot === 0 ? '☀ 오전' : '🌤 오후';

  const news = [`🌟 별빛 축제까지 D-${LAST_DAY - S.day}`];
  if (isWeekend()) news.push('📅 주말이라 수업이 없다');
  if (S.fat >= 70) news.push('😵 피로가 쌓였다. 휴식이 필요하다');
  for (const id of ORDER) {
    const k = pendingEvent(id);
    if (k >= 0) news.push(`💌 ${CHARS[id].name}${josa(CHARS[id].name, '과', '와')}의 이야기가 기다리고 있다`);
  }
  if (S.day === 11) news.push('🔔 학원에 이상한 기운이 감돈다…');
  $('#hNews').innerHTML = news.map((n) => `<li>${n}</li>`).join('');

  const st = Object.entries(STATS).map(([k, n]) => `<div class="stat"><span>${n}</span><div class="bar"><i style="width:${Math.min(100, S.stats[k] / 60 * 100)}%"></i></div><b>${S.stats[k]}</b></div>`).join('');
  $('#hStats').innerHTML = st + `<div class="stat"><span>피로</span><div class="bar fat"><i style="width:${S.fat}%"></i></div><b>${S.fat}</b></div><div class="gold-line">💰 ${S.gold} G</div>`;

  $('#hLocs').innerHTML = Object.entries(LOCS).map(([k, L]) => {
    const closed = L.weekday && isWeekend();
    const who = (S.presence[k] || []).map((id) => `<img src="${img(id, 'chibi')}" class="${S.met[id] ? '' : 'new'}" title="${S.met[id] ? CHARS[id].name : '???'}">`).join('');
    return `<button class="btn loc" data-loc="${k}" ${closed ? 'disabled' : ''}><span class="ic">${L.icon}</span><span class="nm"><b>${L.name}</b><small>${closed ? '주말 휴강' : L.place}</small></span><span class="who">${who}</span></button>`;
  }).join('');

  const present = Object.entries(S.presence).flatMap(([l, ids]) => ids.map((id) => [id, l]));
  if (present.length) {
    const [id, l] = present[Math.floor(Math.random() * present.length)];
    const nm = S.met[id] ? CHARS[id].name : '낯선 학생';
    $('#hIdle').innerHTML = `<div class="idle"><div class="bubble">${nm}${josa(nm, '은', '는')} 지금 <b>${LOCS[l].place}</b>에 있는 것 같다.</div><img src="${img(id, 'chibi')}" alt=""></div>`;
  } else $('#hIdle').innerHTML = '<div class="idle"><div class="bubble">오늘은 어떤 일을 해볼까…?</div></div>';

  $('#hGirls').innerHTML = ORDER.map((id) => {
    const met = S.met[id];
    const ev = pendingEvent(id) >= 0 ? '<span class="badge">💌</span>' : '';
    return `<button class="btn girl ${met ? '' : 'locked'}" data-girl="${id}">${ev}<img src="${img(id, 'e0')}" alt=""><div class="gn">${met ? CHARS[id].name : '???'}</div><div class="hb"><i style="width:${S.aff[id]}%"></i></div></button>`;
  }).join('');
}
let busy = false;
$('#hLocs').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-loc]');
  if (!b || b.disabled || busy) return;
  busy = true;
  try { await visit(b.dataset.loc); } finally { busy = false; }
});
$('#hGirls').addEventListener('click', (e) => { const b = e.target.closest('[data-girl]'); if (b && S.met[b.dataset.girl]) profile(b.dataset.girl); });

/* ───── 모달 ───── */
let onModalClose = null;
function modal(html, closable = true, onClose = null) {
  $('#modalInner').innerHTML = (closable ? '<button class="btn modal-close" data-close>✕</button>' : '') + html;
  $('#modal').classList.remove('hidden');
  onModalClose = onClose;
}
function closeModal() { $('#modal').classList.add('hidden'); const f = onModalClose; onModalClose = null; if (f) f(); }
$('#modal').addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target.id === 'modal') closeModal(); });

function shop() {
  return new Promise((res) => {
    const draw = () => {
      $('#modalInner').innerHTML = `<button class="btn modal-close" data-close>✕</button>
        <h2>상인 길드 상점</h2><p style="color:var(--dim)">「좋은 물건엔 좋은 값을. 선물이라면 상대 취향을 잘 생각해 봐.」 — 베아트릭스</p>
        <div>💰 ${S.gold} G</div>
        <div class="grid-items">${Object.entries(ITEMS).map(([k, it]) => `<button class="btn item" data-buy="${k}" ${S.gold < it.price ? 'disabled' : ''}><span class="ic">${it.icon}</span><span>${it.name}<small>${it.price} G · 보유 ${S.inv[k] || 0}</small></span></button>`).join('')}</div>
        <div class="row"><button class="btn gold" data-close>나가기</button></div>`;
    };
    modal('', true, res); draw();
    $('#modalInner').onclick = (e) => {
      const b = e.target.closest('[data-buy]'); if (!b) return;
      const it = ITEMS[b.dataset.buy]; if (S.gold < it.price) return;
      S.gold -= it.price; S.inv[b.dataset.buy] = (S.inv[b.dataset.buy] || 0) + 1; toast(`${it.icon} ${it.name} 구입`); draw();
    };
  });
}
function inventory() {
  const items = Object.entries(S.inv).filter(([, n]) => n > 0);
  modal(`<h2>소지품</h2><div>💰 ${S.gold} G</div>
    ${items.length ? `<div class="grid-items">${items.map(([k, n]) => `<div class="btn item"><span class="ic">${ITEMS[k].icon}</span><span>${ITEMS[k].name}<small>× ${n}</small></span></div>`).join('')}</div>` : '<p style="color:var(--dim)">아직 아무것도 없다. 상점가에서 선물을 살 수 있다.</p>'}
    <p style="color:var(--dim);font-size:13px">선물은 히로인과 대화한 뒤에 건넬 수 있습니다. 하루에 한 사람당 한 번.</p>`);
}

function profile(id, fromAlbum) {
  const c = CHARS[id];
  const inGame = S && !fromAlbum;
  const aff = inGame ? S.aff[id] : null;
  const ev = inGame ? S.ev[id] : 0;
  const likes = inGame && ev >= 1 ? c.likes.map((k) => ITEMS[k].icon + ' ' + ITEMS[k].name).join(', ') : '???';
  modal(`<div class="profile">
    <div><img class="kart" src="${img(id, 'key')}" alt=""><div class="faces">${[0, 1, 2, 3, 4, 5].map((i) => `<img src="${img(id, 'e' + i)}" alt="">`).join('')}</div></div>
    <div>
      <div class="pname">${c.name}<small>${c.en}</small></div>
      <div class="ptitle">${c.title}</div>
      <table class="info">${c.info.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('')}
        ${inGame ? `<tr><th>호감도</th><td><span class="hearts">${'♥'.repeat(Math.floor(aff / 20))}${'♡'.repeat(5 - Math.floor(aff / 20))}</span> ${aff}</td></tr>
        <tr><th>이야기</th><td>${'●'.repeat(ev)}${'○'.repeat(3 - ev)} ${ev < 3 ? `(다음: 호감도 ${EV_AT[ev]}${ev === 2 ? ` · ${STATS[c.req.stat]} ${c.req.v}` : ''})` : '완료'}</td></tr>
        <tr><th>좋아하는 선물</th><td>${likes}</td></tr>` : ''}
        ${META.endings[id] ? '<tr><th>엔딩</th><td>✦ 달성</td></tr>' : ''}
      </table>
      <p class="quote">“${c.quote}”</p>
      <button class="btn" id="btnSheet">설정 자료 보기</button>
    </div></div>`);
  $('#btnSheet').onclick = () => modal(`<h2>${c.name} 설정 자료</h2><img class="sheet-img" src="${img(id, 'sheet')}" alt="${c.name} 캐릭터 시트">`, true, () => profile(id, fromAlbum));
}
function album() {
  modal(`<h2>앨범</h2><p style="color:var(--dim)">만난 히로인 ${ORDER.filter((id) => META.met[id]).length}/8 · 엔딩 ${Object.keys(META.endings).length}/8</p>
    <div class="album">${ORDER.map((id) => META.met[id]
      ? `<button class="btn" data-al="${id}"><img src="${img(id, 'key')}" alt=""><span>${CHARS[id].name}${META.endings[id] ? ' ✦' : ''}</span></button>`
      : '<button class="btn locked" disabled><img src="img/bg_dorm.jpg" alt=""><span>???</span></button>').join('')}</div>`);
  $('#modalInner').onclick = (e) => { const b = e.target.closest('[data-al]'); if (b) profile(b.dataset.al, true); };
}
function settings() {
  modal(`<h2>설정</h2><h3>글자 속도</h3><div class="seg">${Object.keys(SPEEDS).map((k) => `<button class="btn ${META.speed === k ? 'on' : ''}" data-sp="${k}">${k}</button>`).join('')}</div>
    <h3>기록</h3><button class="btn" id="btnWipe">모든 기록 지우기</button>`);
  $('#modalInner').onclick = (e) => {
    const b = e.target.closest('[data-sp]');
    if (b) { META.speed = b.dataset.sp; saveMeta(); settings(); }
    if (e.target.id === 'btnWipe' && confirm('저장 데이터와 앨범 기록을 모두 지울까요?')) {
      try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(META_KEY); } catch { /* 무시 */ }
      META = { met: {}, endings: {}, speed: '보통' }; S = null; closeModal(); title();
    }
  };
}

$('#btnInv').onclick = inventory;
$('#btnAlbum').onclick = album;
$('#btnSettings').onclick = settings;
$('#btnToTitle').onclick = () => { saveGame(); title(); };

/* ───── 타이틀 ───── */
function title() {
  screen('title'); setBg('dorm');
  $('#titleArt').innerHTML = ['serena', 'camilla', 'aria', 'luna', 'noelle'].map((id) => `<img src="${img(id, 'key')}" alt="">`).join('');
  $('#btnLoad').disabled = !load(SAVE_KEY);
}
$('#btnNew').onclick = () => { screen('naming'); setTimeout(() => $('#nameInput').select(), 50); };
$('#btnLoad').onclick = () => { S = load(SAVE_KEY); if (S) hub(); };
$('#btnAlbumT').onclick = album;
$('#btnSettingsT').onclick = settings;
$('#nameBack').onclick = title;
$('#nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#nameOk').click(); });
$('#nameOk').onclick = async () => {
  const name = $('#nameInput').value.trim() || '유안';
  S = newState(name);
  await runScene([...COMMON.prologue, ...COMMON.tutorial]);
  rollPresence(); saveGame(); hub();
};

title();
})();
