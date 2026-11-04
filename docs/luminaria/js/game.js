/* 루미나리아: Eight Fates — 게임 엔진 */
(() => {
'use strict';
const $ = (s) => document.querySelector(s);
const SAVE_KEY = 'luminaria_save_v1';
const META_KEY = 'luminaria_meta_v1';
const slotKey = (i) => `luminaria_slot_${i}`;
const WEEK = ['월', '화', '수', '목', '금', '토', '일'];
const EV_AT = [20, 45, 70];
const END_AT = 80;
const TRUE_AT = 40;
const SPEEDS = { 느리게: 45, 보통: 24, 빠르게: 10, 즉시: 0 };
const AUTOS = { 느리게: 1.6, 보통: 1, 빠르게: .6 };
const EV_BGM = ['calm', 'sad', 'romance'];
const WEATHER = { 맑음: '☀', 흐림: '☁', 비: '🌧' };
const DAY_EVENTS = { 4: 'welcome', 8: 'exam', 16: 'field', 20: 'prep' };
const REL = [[80, '운명의 상대'], [65, '두근두근'], [45, '특별한 친구'], [25, '친구'], [10, '아는 사이'], [0, '낯선 사이']];

const img = (id, kind) => `img/${id}_${kind}.${kind === 'chibi' ? 'png' : 'jpg'}`;
const face = (id, ex) => img(id, 'e' + (CHARS[id].ex[ex] ?? 0));
const fmt = (t) => t.replaceAll('{P}', S ? S.name : '');
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return (c >= 0 && c % 28) ? a : b; };
const rel = (a) => REL.find(([v]) => a >= v)[1];
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dateStr = (d) => `4월 ${d}일 (${WEEK[(d - 1) % 7]})`;

/* ───── 저장 ───── */
let S = null;
let REPLAY = false;
function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
const META_DEF = () => ({ met: {}, endings: {}, seen: {}, heard: {}, speed: '보통', auto: '보통', bgm: .6, sfx: .7, playback: false, muted: false, name: '' });
let META = Object.assign(META_DEF(), load(META_KEY) || {});
const saveGame = () => { if (S && !REPLAY) { S.ts = Date.now(); store(SAVE_KEY, S); } };
const saveMeta = () => store(META_KEY, META);
const seen = (k) => { if (!META.seen[k]) { META.seen[k] = 1; saveMeta(); } };

function newState(name) {
  const o = (v) => Object.fromEntries(ORDER.map((k) => [k, v]));
  return {
    name, day: 1, slot: 0, bg: 'dorm', weather: '맑음',
    stats: { int: 5, str: 5, brave: 5, charm: 5 }, gold: 100, fat: 0,
    aff: o(0), met: o(false), intro: o(false), ev: o(0), talk: o(0), gifted: {}, dated: {}, inv: {}, presence: {},
  };
}
function fixState(s) { // 예전 저장 데이터 보정
  const o = (v) => Object.fromEntries(ORDER.map((k) => [k, v]));
  for (const k of ['aff', 'met', 'intro', 'ev', 'talk']) s[k] = Object.assign(o(k === 'met' || k === 'intro' ? false : 0), s[k] || {});
  s.dated = s.dated || {}; s.gifted = s.gifted || {}; s.inv = s.inv || {}; s.weather = s.weather || '맑음';
  return s;
}

/* ───── 오디오 ───── */
function applyVolume() {
  AUDIO.setVol('bgm', META.muted ? 0 : META.bgm);
  AUDIO.setVol('sfx', META.muted ? 0 : META.sfx);
  $('#mute').textContent = META.muted ? '🔇' : '♪';
  $('#mute').classList.toggle('off', META.muted);
}
AUDIO.onHeard((id) => { if (!META.heard[id]) { META.heard[id] = 1; saveMeta(); } });
AUDIO.setPlayback(META.playback);
applyVolume();
$('#mute').onclick = (e) => { e.stopPropagation(); META.muted = !META.muted; saveMeta(); applyVolume(); };
document.addEventListener('click', (e) => { if (e.target.closest('button.btn')) AUDIO.sfx('click'); }, true);

/* ───── 화면 ───── */
function screen(id) {
  for (const s of ['title', 'naming', 'hub', 'scene']) $('#' + s).classList.toggle('hidden', s !== id);
  document.body.dataset.screen = id;
}
let bgCur = null, bgLayer = 0;
function setBg(name) {
  if (!name || name === bgCur) return;
  bgCur = name;
  const ls = document.querySelectorAll('#bg .bgl');
  bgLayer = 1 - bgLayer;
  ls[bgLayer].style.backgroundImage = `url(img/bg_${name}.jpg)`;
  ls[bgLayer].classList.add('on'); ls[1 - bgLayer].classList.remove('on');
}
function setTint(t) { document.body.dataset.tint = t || ''; }
function toast(msg) { const d = document.createElement('div'); d.textContent = msg; $('#toast').append(d); setTimeout(() => d.remove(), 2700); }
function pop(text, down) {
  const d = document.createElement('div'); d.className = 'heart-pop' + (down ? ' down' : ''); d.textContent = text;
  const r = $('#sBox').getBoundingClientRect(); d.style.left = (r.left + 30) + 'px'; d.style.top = (r.top - 40) + 'px';
  document.body.append(d); setTimeout(() => d.remove(), 1500);
}
function banner(big, small, icon) {
  AUDIO.sfx('day');
  return new Promise((res) => {
    const d = document.createElement('div'); d.className = 'day-banner';
    d.innerHTML = `<div class="db-in"><div class="db-ic">${icon || '✦'}</div><div class="db-big">${big}</div><div class="db-line"></div><small>${small || ''}</small></div>`;
    document.body.append(d); setTimeout(() => { d.remove(); res(); }, 2300);
  });
}
async function screenFx(kind) {
  const f = $('#flash'), sc = $('#scene');
  if (kind === 'shake') { sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake'); return; }
  f.style.transition = 'none'; f.style.background = kind === 'black' ? '#000' : '#fff';
  if (kind === 'flash') { f.style.opacity = .85; void f.offsetWidth; f.style.transition = 'opacity .6s'; f.style.opacity = 0; await sleep(150); return; }
  f.style.opacity = 0; void f.offsetWidth; f.style.transition = 'opacity .5s'; f.style.opacity = 1;
  await sleep(650); f.style.opacity = 0; await sleep(450);
}
async function fadeBg(name) {
  const f = $('#flash');
  f.style.transition = 'opacity .4s'; f.style.background = '#000'; f.style.opacity = 1; await sleep(430);
  charHide(); setBg(name); await sleep(200); f.style.opacity = 0; await sleep(350);
}

/* ───── 대화 엔진 ───── */
let advance = null, typing = null, autoT = 0;
let autoOn = false, skipOn = false, boxHidden = false;
let spriteId = null, spriteCg = false;
const LOG = [];
const sceneEl = $('#scene');
sceneEl.addEventListener('click', (e) => { if (!e.target.closest('#sChoices, #sCtl')) step(); });
document.addEventListener('keydown', (e) => {
  if (!$('#modal').classList.contains('hidden')) { if (e.key === 'Escape') closeModal(); return; }
  if (sceneEl.classList.contains('hidden')) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); step(); }
  else if (e.key === 'a') toggleAuto();
  else if (e.key === 'h') toggleHide();
  else if (e.key === 'l') showLog();
  else if (e.key === 'Control') { skipOn = true; ctlUi(); step(); }
});
document.addEventListener('keyup', (e) => { if (e.key === 'Control') { skipOn = false; ctlUi(); } });
sceneEl.addEventListener('wheel', (e) => { if (e.deltaY < -20 && $('#modal').classList.contains('hidden')) showLog(); }, { passive: true });

function step() {
  if (boxHidden) { toggleHide(); return; }
  if ($('#sChoices').childElementCount) return;
  if (typing) { typing(); return; }
  if (advance) { clearTimeout(autoT); const a = advance; advance = null; a(); }
}
function ctlUi() {
  $('#sCtl [data-c=auto]').classList.toggle('on', autoOn);
  $('#sCtl [data-c=skip]').classList.toggle('on', skipOn);
}
function toggleAuto() { autoOn = !autoOn; ctlUi(); if (autoOn && advance && !typing) scheduleAuto(20); else clearTimeout(autoT); }
function toggleSkip() { skipOn = !skipOn; ctlUi(); if (skipOn) step(); }
function toggleHide() { boxHidden = !boxHidden; $('#sBox').classList.toggle('gone', boxHidden); }
function scheduleAuto(n) {
  clearTimeout(autoT);
  if (autoOn) autoT = setTimeout(() => { if (advance && !typing && !boxHidden && $('#modal').classList.contains('hidden')) step(); else if (autoOn) scheduleAuto(n); }, (900 + n * 55) * (AUTOS[META.auto] || 1));
}
$('#sCtl').addEventListener('click', (e) => {
  e.stopPropagation();
  const c = e.target.closest('[data-c]')?.dataset.c;
  if (c === 'auto') toggleAuto();
  else if (c === 'skip') toggleSkip();
  else if (c === 'hide') toggleHide();
  else if (c === 'log') showLog();
  else if (c === 'menu') settings();
});

function charShow(id, cg) {
  const el = $('#sChar');
  if (spriteId !== id) { el.classList.remove('on'); void el.offsetWidth; el.src = img(id, 'key'); }
  spriteId = id; spriteCg = !!cg;
  el.style.setProperty('--c', CHARS[id].color);
  el.classList.toggle('cg', !!cg); el.classList.remove('dim');
  requestAnimationFrame(() => el.classList.add('on'));
}
function charHide() { $('#sChar').classList.remove('on', 'cg', 'dim'); spriteId = null; spriteCg = false; }
function emote(ex) {
  const el = $('#sChar'), k = ['angry', 'surprise', 'provoke'].includes(ex) ? 'shake' : ['smile', 'tease', 'fluster', 'shy'].includes(ex) ? 'hop' : '';
  el.classList.remove('hop', 'shake');
  if (k) { void el.offsetWidth; el.classList.add(k); }
}

function say(who, ex, text) {
  const box = $('#sBox'), t = $('#sText');
  let name = '', color = '#d9b56c';
  if (CHARS[who]) {
    name = CHARS[who].name; color = CHARS[who].color;
    $('#sFace').src = face(who, ex); box.classList.remove('noface');
    if (!spriteCg && spriteId !== who) charShow(who);
    if (spriteId === who) { $('#sChar').classList.remove('dim'); emote(ex); }
  } else {
    box.classList.add('noface');
    name = who === 'me' ? S.name : who;
    if (who === 'me') color = '#9fd0c8';
    if (spriteId && !spriteCg) $('#sChar').classList.add('dim');
  }
  $('#sName').textContent = name;
  box.style.setProperty('--nc', color);
  t.classList.toggle('narr', !who);
  const full = fmt(text);
  LOG.push({ n: name, c: color, t: full }); if (LOG.length > 300) LOG.shift();
  const speed = SPEEDS[META.speed] ?? 24;
  return new Promise((res) => {
    clearTimeout(autoT);
    if (skipOn) { t.textContent = full; typing = null; advance = null; setTimeout(res, 50); return; }
    let i = 0; t.textContent = '';
    const done = () => { clearInterval(iv); t.textContent = full; typing = null; advance = res; scheduleAuto(full.length); };
    if (!speed) { t.textContent = full; advance = res; scheduleAuto(full.length); return; }
    const iv = setInterval(() => { i++; t.textContent = full.slice(0, i); if (i >= full.length) done(); }, speed);
    typing = done;
  });
}
function choose(opts) {
  skipOn = false; ctlUi(); clearTimeout(autoT);
  if (boxHidden) toggleHide();
  return new Promise((res) => {
    const box = $('#sChoices'); box.innerHTML = '';
    opts.forEach((o, i) => {
      const b = document.createElement('button'); b.className = 'btn choice'; b.textContent = fmt(o.t);
      b.style.animationDelay = (i * 60) + 'ms';
      if (o.disabled) b.disabled = true;
      b.onclick = (e) => { e.stopPropagation(); AUDIO.sfx('select'); box.innerHTML = ''; LOG.push({ n: '▸', c: '#e0809a', t: fmt(o.t) }); res(i); };
      box.append(b);
    });
  });
}

/* 장면 연출 도우미 — 시나리오의 {run} 에서 쓸 수 있다 */
const G = {
  get S() { return S; }, say, choose, play, addAff, addStats, charShow, charHide, setBg, toast, josa, sleep,
  get replay() { return REPLAY; },
};

async function play(steps) {
  for (const s of steps) {
    if (Array.isArray(s)) {
      if (s.length === 2) await say(s[0], null, s[1]);
      else await say(s[0], s[1], s[2]);
      continue;
    }
    if (s.if) { await play(s.if(S) ? (s.go || []) : (s.else || [])); continue; }
    if (s.run) { await s.run(G); continue; }
    if ('bgm' in s) AUDIO.bgm(s.bgm);
    if ('tint' in s) setTint(s.tint);
    if (s.bg) { if (s.fade) await fadeBg(s.bg); else setBg(s.bg); }
    if ('pt' in s) FX.set(s.pt);
    if (s.fx) await screenFx(s.fx);
    if (s.sfx) AUDIO.sfx(s.sfx);
    if (s.show) charShow(s.show);
    if (s.cg) { charShow(s.cg, true); FX.burst(innerWidth / 2, innerHeight * .35, 'sparkle'); }
    if (s.hide) charHide();
    if (s.met) meet(s.met);
    if (s.aff) for (const [k, v] of Object.entries(s.aff)) addAff(k, v);
    if (s.stats) addStats(s.stats, true);
    if (s.wait) await sleep(s.wait);
    if (s.choice) {
      const opts = s.choice.filter((o) => !o.when || o.when(S));
      const o = opts[await choose(opts)];
      if (o.aff) for (const [k, v] of Object.entries(o.aff)) addAff(k, v);
      if (o.stats) addStats(o.stats, true);
      if (o.go) await play(o.go);
    }
  }
}

function meet(id) { if (REPLAY) return; S.met[id] = true; META.met[id] = true; saveMeta(); }
function addAff(id, n) {
  if (!n || REPLAY) return;
  S.aff[id] = Math.max(0, Math.min(100, S.aff[id] + n));
  pop(n > 0 ? `♥ +${n}` : `♡ ${n}`, n < 0);
  AUDIO.sfx(n > 0 ? 'heart' : 'down');
  if (n > 0) { const r = $('#sBox').getBoundingClientRect(); FX.burst(r.left + 60, r.top - 10, 'heart', CHARS[id].color); }
}
function addStats(g, show) {
  if (REPLAY) return;
  const parts = [];
  for (const [k, v] of Object.entries(g)) {
    if (k === 'gold') { S.gold += v; parts.push(`골드 ${v > 0 ? '+' : ''}${v}`); }
    else if (k === 'fat') S.fat = Math.max(0, Math.min(100, S.fat + v));
    else { S.stats[k] += v; parts.push(`${STATS[k]} +${v}`); }
  }
  if (show && parts.length) toast(parts.join(' · '));
}

async function runScene(steps, bg, opt = {}) {
  screen('scene');
  $('#sChoices').innerHTML = ''; charHide();
  if (boxHidden) toggleHide();
  if (!opt.keepTint) setTint(null);
  if (bg) setBg(bg);
  await play(steps);
  charHide(); skipOn = false; ctlUi();
}

/* ───── 하루 진행 ───── */
const isWeekend = () => (S.day - 1) % 7 >= 5;
function rollWeather() {
  const r = Math.random();
  S.weather = S.day >= LAST_DAY - 1 ? '맑음' : r < .64 ? '맑음' : r < .82 ? '흐림' : '비';
}
function rollPresence() {
  const p = {};
  for (const k of Object.keys(LOCS)) p[k] = [];
  const rain = S.weather === '비';
  for (const id of ORDER) {
    if (Math.random() > 0.8) continue;
    const h = Object.entries(HAUNTS[id]).filter(([l]) => !(LOCS[l].weekday && isWeekend()))
      .map(([l, w]) => [l, rain && LOCS[l].outdoor ? w * .3 : rain && l === 'library' ? w * 1.6 : w]);
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
const slotTint = () => (S.slot === 0 ? 'am' : 'pm');
const ambient = (outdoor) => (S.weather === '비' && outdoor ? 'rain' : null);

async function visit(locId) {
  const L = LOCS[locId];
  S.bg = L.bg;
  AUDIO.bgm(L.bgm || 'daily');
  const tired = S.fat >= 90 && L.fat > 0;
  const mult = S.fat >= 70 ? 0.5 : 1;
  const parts = [];
  if (!tired) {
    for (const [k, v] of Object.entries(L.gain)) { const n = Math.max(1, Math.round(v * mult)); S.stats[k] += n; parts.push(`${STATS[k]} +${n}`); }
    if (L.gold) { const g = rand(...L.gold); S.gold += g; parts.push(`골드 +${g}`); }
  }
  S.fat = Math.max(0, Math.min(100, S.fat + L.fat));
  parts.push(`피로 ${L.fat > 0 ? '+' : ''}${L.fat}`);
  const flavor = (VISIT_LINES[locId] || [])[rand(0, (VISIT_LINES[locId] || ['']).length - 1)];
  const lines = [{ pt: ambient(L.outdoor) || L.pt || null }, ['', `${L.place}. ${flavor || L.desc}`]];
  if (tired) lines.push(['', '…너무 지쳐서 아무것도 손에 잡히지 않았다. 오늘은 쉬는 편이 좋겠다.']);
  else if (mult < 1) lines.push(['', '피곤해서 집중이 잘 되지 않는다…']);
  lines.push(['', `【 ${parts.join(' · ')} 】`]);
  setTint(slotTint());
  await runScene(lines, L.bg, { keepTint: true });
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
      await play([{ bgm: EV_BGM[k] }, ...st.ev[k]]); S.ev[id]++; addAff(id, k === 2 ? 10 : 5);
      seen(`${id}_ev${k}`);
      AUDIO.sfx('event');
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
      await play(reply.map((r) => (r.length === 3 ? r : [id, ...r])));
      if (k === -2) {
        const r = c.req;
        await say('', null, `(${c.name}${josa(c.name, '은', '는')} 무언가 털어놓고 싶은 눈치다. …${STATS[r.stat]}${josa(STATS[r.stat], '이', '가')} ${r.v} 이상이라면 마음을 열어줄지도 모른다.)`);
      }
    }
  }
  await afterTalk(id);
  charHide();
}

async function afterTalk(id) {
  for (;;) {
    const items = Object.entries(S.inv).filter(([, n]) => n > 0);
    const canGift = items.length && !S.gifted[id];
    const canDate = isWeekend() && S.ev[id] >= 1 && !S.dated[id] && DATES[id];
    if (!canGift && !canDate) return;
    const opts = [];
    if (canDate) opts.push({ t: `💕 ${CHARS[id].name}에게 주말 데이트를 신청한다`, k: 'date' });
    if (canGift) opts.push({ t: '🎁 선물을 건넨다', k: 'gift' });
    opts.push({ t: '이야기를 마친다', k: 'end' });
    const k = opts[await choose(opts)].k;
    if (k === 'end') return;
    if (k === 'gift') await giftMenu(id);
    if (k === 'date') { await dateScene(id); return; }
  }
}
async function giftMenu(id) {
  const items = Object.entries(S.inv).filter(([, n]) => n > 0);
  const c = CHARS[id];
  const known = S.ev[id] >= 1;
  const i = await choose([...items.map(([k, n]) => ({ t: `${ITEMS[k].icon} ${ITEMS[k].name} (×${n})${known && c.likes.includes(k) ? '  ★' : ''}` })), { t: '역시 그만둔다' }]);
  if (i >= items.length) return;
  const key = items[i][0];
  S.inv[key]--; S.gifted[id] = true;
  let line, gain;
  if (c.likes.includes(key)) { line = GIFT_LINES.like[id]; gain = 9; }
  else if (c.dislikes.includes(key)) { line = GIFT_LINES.dislike; gain = 0; }
  else { line = GIFT_LINES.normal; gain = 3; }
  await say(id, line[0], line[1]);
  addAff(id, gain);
}
async function dateScene(id) {
  const back = $('#sChar').classList.contains('on');
  await play([{ bgm: 'romance' }, ...DATES[id]]);
  S.dated[id] = true; addAff(id, 8); S.fat = Math.max(0, S.fat - 5);
  seen(`${id}_date`);
  toast(`💕 ${CHARS[id].name}${josa(CHARS[id].name, '과', '와')} 데이트를 했다`);
  if (back) charShow(id);
}

async function endSlot() {
  S.slot++;
  if (S.slot >= 2) {
    S.fat = Math.max(0, S.fat - 10);
    S.day++; S.slot = 0; S.gifted = {};
    if (S.day === 12) { await runScene([{ bgm: 'mystery' }, ...COMMON.flicker]); seen('flicker'); }
    if (S.day >= LAST_DAY) { await festival(); return; }
    rollWeather();
    screen('hub'); setBg('dorm'); S.bg = 'dorm'; setTint('am'); FX.set(null);
    await banner(dateStr(S.day), `${WEATHER[S.weather]} ${S.weather} · 별빛 축제까지 D-${LAST_DAY - S.day}`, WEATHER[S.weather]);
    const ev = DAY_EVENTS[S.day];
    if (ev) { await runScene(COMMON[ev]); seen(ev); }
  }
  rollPresence(); saveGame(); hub();
}

async function festival() {
  const best = ORDER.filter((id) => S.intro[id]).sort((a, b) => S.aff[b] - S.aff[a])[0];
  if (best && S.aff[best] >= 30 && EVE[best]) { await runScene([{ bgm: 'calm' }, ...EVE[best]]); seen(`${best}_eve`); }
  else await runScene([{ bgm: 'calm' }, ...COMMON.eveAlone]);
  S.weather = '맑음';
  await banner(dateStr(LAST_DAY), '별빛 축제의 밤', '✦');
  await runScene([{ bgm: 'festival' }, ...COMMON.festivalOpen]);
  const cand = ORDER.filter((id) => S.ev[id] >= 3 && S.aff[id] >= END_AT).sort((a, b) => S.aff[b] - S.aff[a]);
  const trueOK = ORDER.every((id) => S.intro[id] && S.aff[id] >= TRUE_AT);
  const opts = cand.map((id) => ({ t: `${CHARS[id].name}에게 간다`, k: id }));
  if (trueOK) opts.push({ t: '✦ 여덟 사람 모두와 함께 별등 앞에 선다', k: 'true' });
  let who = opts[0]?.k;
  if (opts.length > 1) {
    await say('', null, '별등 앞에서 기다리고 있을 사람이 떠오른다. 누구에게 갈까?');
    who = opts[await choose(opts)].k;
  }
  let key;
  if (who === 'true') { await play([{ bgm: 'ending' }, ...COMMON.trueEnd]); key = 'true'; }
  else if (who) { await play([{ bgm: 'romance' }, ...STORY[who].end]); key = who; }
  else {
    const fr = ORDER.filter((id) => S.intro[id] && S.aff[id] >= 35).sort((a, b) => S.aff[b] - S.aff[a])[0];
    const ne = [...COMMON.normalEnd];
    if (fr) ne.splice(ne.length - 1, 0, { show: fr }, [fr, Object.keys(CHARS[fr].ex)[1], FRIEND_LINES[fr]], { hide: 1 });
    await play([{ bgm: 'calm' }, ...ne]); key = 'normal';
  }
  charHide();
  META.endings[key] = true; seen(key === 'normal' ? 'normal' : key === 'true' ? 'true' : `${key}_end`);
  saveMeta();
  try { localStorage.removeItem(SAVE_KEY); } catch { /* 무시 */ }
  const result = { key, name: S.name, aff: { ...S.aff }, stats: { ...S.stats } };
  S = null;
  await rollCredits(key);
  results(result);
}

function rollCredits(key) {
  return new Promise((res) => {
    screen('roll'); AUDIO.bgm('ending'); FX.set('stars');
    const bg = (CREDITS_BG || []).map((c) => `<p><b>${esc(c.artist)}</b><br><i>${esc(c.title.replace(/\.(jpg|png)$/i, '').replace(/ - Google Art Project/, ''))}</i><br><small>${esc(c.license)} · Wikimedia Commons</small></p>`).join('');
    const d = document.createElement('div'); d.id = 'roll';
    d.innerHTML = `<div class="roll-inner">
      <div class="logo"><span class="star">✦</span>LUMINARIA<small>Eight Fates</small></div>
      <h3>${esc(END_TITLES[key] || '')}</h3>
      <h4>CAST</h4>${ORDER.map((id) => `<p><b style="color:${CHARS[id].color}">${CHARS[id].name}</b> <small>${CHARS[id].en}</small><br><small>${CHARS[id].title}</small></p>`).join('')}
      <h4>MUSIC</h4>${Object.values(AUDIO.tracks).map((t) => `<p>${esc(t.name)} <small>${esc(t.ko)}</small></p>`).join('')}<p><small>Web Audio로 실시간 합성</small></p>
      <h4>BACKGROUND ART</h4>${bg}
      <h4>CHARACTER ART</h4><p>LUMINARIA: Eight Fates 캐릭터 시트</p>
      <h4>STORY · PROGRAM</h4><p>Claude</p>
      <div class="roll-end">Thank you for playing.</div></div>
      <button class="btn roll-skip">건너뛰기 ▸▸</button>`;
    document.body.append(d);
    const done = () => { d.remove(); FX.set(null); res(); };
    d.querySelector('.roll-inner').addEventListener('animationend', done);
    d.querySelector('.roll-skip').onclick = (e) => { e.stopPropagation(); done(); };
  });
}
function results(r) {
  const cleared = ORDER.filter((id) => META.endings[id]).length;
  const top = ORDER.slice().sort((a, b) => r.aff[b] - r.aff[a]).slice(0, 3);
  modal(`<div class="credits">
    <div class="logo">LUMINARIA<small>Eight Fates</small></div>
    <div class="end-name">${esc(END_TITLES[r.key] || '')}</div>
    <p class="quote">${CHARS[r.key] ? `「${CHARS[r.key].quote}」` : r.key === 'true' ? '「여덟 개의 빛, 그리고 색이 없는 단 하나의 빛.」' : '「…다음 축제에는, 조금 더 용기를 내볼까.」'}</p>
    <div class="res-grid">${top.map((id) => `<div><img src="${img(id, 'e1')}" alt=""><b>${CHARS[id].name}</b><span>♥ ${r.aff[id]}</span></div>`).join('')}</div>
    <p>${Object.entries(STATS).map(([k, n]) => `${n} ${r.stats[k]}`).join(' · ')}</p>
    <p>히로인 엔딩 ${cleared} / 8${META.endings.true ? ' · ✦ 트루 엔딩' : ''}</p>
    <p style="color:var(--dim);font-size:13px">플레이해주셔서 감사합니다.</p>
    <button class="btn gold" data-close>타이틀로</button></div>`, false, () => title());
}

/* ───── 메인 화면 ───── */
function hub() {
  screen('hub'); setBg(S.bg || 'dorm'); setTint(slotTint());
  AUDIO.bgm(S.weather === '비' ? 'calm' : 'daily');
  FX.set(S.weather === '비' ? 'rain' : null);
  const wd = WEEK[(S.day - 1) % 7];
  $('#hDate').textContent = `4월 ${S.day}일 (${wd})`;
  $('#hSlot').textContent = `${S.slot === 0 ? '☀ 오전' : '🌇 오후'} · ${WEATHER[S.weather]} ${S.weather}`;

  const news = [`🌟 별빛 축제까지 D-${LAST_DAY - S.day}`];
  if (isWeekend()) news.push('📅 주말이라 수업이 없다. 데이트 신청의 기회!');
  if (S.weather === '비') news.push('🌧 비가 온다. 다들 실내에 모여 있을 것 같다');
  if (S.fat >= 70) news.push('😵 피로가 쌓였다. 휴식이 필요하다');
  const next = Object.keys(DAY_EVENTS).map(Number).find((d) => d > S.day);
  if (next && next - S.day <= 2) news.push(`📜 ${DAY_NEWS[DAY_EVENTS[next]]} (D-${next - S.day})`);
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
    const who = (S.presence[k] || []).map((id) => `<img src="${img(id, 'chibi')}" class="${S.met[id] ? '' : 'new'}" title="${S.met[id] ? CHARS[id].name : '???'}" alt="">`).join('');
    const gain = [...Object.entries(L.gain).map(([s, v]) => `${STATS[s]}+${v}`), L.gold ? '골드' : '', `피로${L.fat > 0 ? '+' : ''}${L.fat}`].filter(Boolean).join(' ');
    return `<button class="btn loc" data-loc="${k}" ${closed ? 'disabled' : ''}><span class="ic">${L.icon}</span><span class="nm"><b>${L.name}</b><small>${closed ? '주말 휴강' : gain}</small></span><span class="who">${who}</span></button>`;
  }).join('');

  const present = Object.entries(S.presence).flatMap(([l, ids]) => ids.map((id) => [id, l]));
  if (present.length) {
    const [id, l] = present[Math.floor(Math.random() * present.length)];
    const nm = S.met[id] ? CHARS[id].name : '낯선 학생';
    const tip = S.met[id] && Math.random() < .5 ? IDLE_LINES[id][rand(0, IDLE_LINES[id].length - 1)] : null;
    $('#hIdle').innerHTML = `<div class="idle"><div class="bubble">${tip ? `<b style="color:${CHARS[id].color}">${nm}</b> “${tip}”<br><small>— 지금 ${LOCS[l].place}에 있다</small>` : `${nm}${josa(nm, '은', '는')} 지금 <b>${LOCS[l].place}</b>에 있는 것 같다.`}</div><img src="${img(id, 'chibi')}" alt=""></div>`;
  } else $('#hIdle').innerHTML = `<div class="idle"><div class="bubble">${S.weather === '비' ? '빗소리가 들린다. 오늘은 어떤 하루를 보낼까…' : '오늘은 어떤 일을 해볼까…?'}</div></div>`;

  $('#hGirls').innerHTML = ORDER.map((id) => {
    const met = S.met[id];
    const ev = pendingEvent(id) >= 0 ? '<span class="badge">💌</span>' : '';
    return `<button class="btn girl ${met ? '' : 'locked'}" data-girl="${id}" style="--c:${CHARS[id].color}">${ev}<img src="${img(id, 'e0')}" alt=""><div class="gn">${met ? CHARS[id].name : '???'}</div><div class="rl">${met ? rel(S.aff[id]) : ''}</div><div class="hb"><i style="width:${S.aff[id]}%"></i></div></button>`;
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
  $('#modalInner').onclick = null;
  const was = $('#modal').classList.contains('hidden');
  $('#modal').classList.remove('hidden');
  if (was) AUDIO.sfx('page');
  onModalClose = onClose;
}
function closeModal() { $('#modal').classList.add('hidden'); const f = onModalClose; onModalClose = null; if (f) f(); }
$('#modal').addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target.id === 'modal') closeModal(); });

function showLog() {
  modal(`<h2>대사 기록</h2><div class="log">${LOG.slice(-120).map((l) => `<div class="ll">${l.n ? `<b style="color:${l.c}">${esc(l.n)}</b>` : ''}<p class="${l.n ? '' : 'narr'}">${esc(l.t)}</p></div>`).join('') || '<p style="color:var(--dim)">아직 기록이 없습니다.</p>'}</div>`);
  const lg = $('#modalInner .log'); if (lg) lg.scrollTop = lg.scrollHeight;
}

function shop() {
  return new Promise((res) => {
    const draw = () => {
      $('#modalInner').innerHTML = `<button class="btn modal-close" data-close>✕</button>
        <div class="shop-head"><img src="${img('beatrix', 'e2')}" alt=""><div><h2>상인 길드 상점</h2><p style="color:var(--dim);margin:0">「좋은 물건엔 좋은 값을. 선물이라면 상대 취향을 잘 생각해 봐.」 — 베아트릭스</p></div></div>
        <div class="purse">💰 ${S.gold} G</div>
        <div class="grid-items">${Object.entries(ITEMS).map(([k, it]) => `<button class="btn item" data-buy="${k}" ${S.gold < it.price ? 'disabled' : ''}><span class="ic">${it.icon}</span><span>${it.name}<small>${it.price} G · 보유 ${S.inv[k] || 0}</small><em>${it.desc || ''}</em></span></button>`).join('')}</div>
        <div class="row"><button class="btn gold" data-close>나가기</button></div>`;
    };
    modal('', true, res); draw();
    $('#modalInner').onclick = (e) => {
      const b = e.target.closest('[data-buy]'); if (!b) return;
      const it = ITEMS[b.dataset.buy]; if (S.gold < it.price) return;
      S.gold -= it.price; S.inv[b.dataset.buy] = (S.inv[b.dataset.buy] || 0) + 1; AUDIO.sfx('coin'); toast(`${it.icon} ${it.name} 구입`); draw();
    };
  });
}
function inventory() {
  const items = Object.entries(S.inv).filter(([, n]) => n > 0);
  modal(`<h2>소지품</h2><div class="purse">💰 ${S.gold} G</div>
    ${items.length ? `<div class="grid-items">${items.map(([k, n]) => `<div class="btn item"><span class="ic">${ITEMS[k].icon}</span><span>${ITEMS[k].name}<small>× ${n}</small><em>${ITEMS[k].desc || ''}</em></span></div>`).join('')}</div>` : '<p style="color:var(--dim)">아직 아무것도 없다. 상점가에서 선물을 살 수 있다.</p>'}
    <p style="color:var(--dim);font-size:13px">선물은 히로인과 대화한 뒤에 건넬 수 있습니다. 하루에 한 사람당 한 번. 이야기를 하나 본 히로인은 좋아하는 선물에 ★가 표시됩니다.</p>`);
}

function profile(id, fromAlbum) {
  const c = CHARS[id];
  const inGame = S && !fromAlbum && !REPLAY;
  const aff = inGame ? S.aff[id] : null;
  const ev = inGame ? S.ev[id] : 0;
  const likes = inGame && ev >= 1 ? c.likes.map((k) => ITEMS[k].icon + ' ' + ITEMS[k].name).join(', ') : '???';
  modal(`<div class="profile" style="--c:${c.color}">
    <div><img class="kart" src="${img(id, 'key')}" alt=""><div class="faces">${[0, 1, 2, 3, 4, 5].map((i) => `<img src="${img(id, 'e' + i)}" alt="">`).join('')}</div></div>
    <div>
      <div class="pname">${c.name}<small>${c.en}</small></div>
      <div class="ptitle">${c.title}</div>
      <table class="info">${c.info.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('')}
        ${inGame ? `<tr><th>관계</th><td>${rel(aff)}</td></tr><tr><th>호감도</th><td><span class="hearts">${'♥'.repeat(Math.floor(aff / 20))}${'♡'.repeat(5 - Math.floor(aff / 20))}</span> ${aff}</td></tr>
        <tr><th>이야기</th><td>${'●'.repeat(ev)}${'○'.repeat(3 - ev)} ${ev < 3 ? `(다음: 호감도 ${EV_AT[ev]}${ev === 2 ? ` · ${STATS[c.req.stat]} ${c.req.v}` : ''})` : '완료'}</td></tr>
        <tr><th>좋아하는 선물</th><td>${likes}</td></tr>
        <tr><th>데이트</th><td>${S.dated[id] ? '함께했다 💕' : ev >= 1 ? '주말에 신청할 수 있다' : '이야기 1 이후'}</td></tr>` : ''}
        ${META.endings[id] ? '<tr><th>엔딩</th><td>✦ 달성</td></tr>' : ''}
      </table>
      <p class="quote">“${c.quote}”</p>
      <button class="btn" id="btnSheet">설정 자료 보기</button>
    </div></div>`);
  $('#btnSheet').onclick = () => modal(`<h2>${c.name} 설정 자료</h2><img class="sheet-img" src="${img(id, 'sheet')}" alt="${c.name} 캐릭터 시트">`, true, () => profile(id, fromAlbum));
}

/* 앨범: 히로인 · 회상 · 엔딩 · 음악 */
function replayList() {
  const L = [{ g: '공통', items: [['welcome', '입학 환영회', COMMON.welcome], ['exam', '중간 시험', COMMON.exam], ['flicker', '흔들리는 별등', [{ bgm: 'mystery' }, ...COMMON.flicker]], ['field', '유적 합동 실습', COMMON.field], ['prep', '축제 준비 위원회', COMMON.prep], ['true', '아홉 번째 빛', [{ bg: 'festival' }, { bgm: 'ending' }, ...COMMON.trueEnd]]] }];
  for (const id of ORDER) {
    const st = STORY[id];
    L.push({ g: CHARS[id].name, c: CHARS[id].color, items: [
      ...st.ev.map((e, k) => [`${id}_ev${k}`, `이야기 ${k + 1}`, [{ bgm: EV_BGM[k] }, ...e]]),
      [`${id}_date`, '주말 데이트', [{ bgm: 'romance' }, ...DATES[id]]],
      [`${id}_eve`, '축제 전야', [{ bgm: 'calm' }, ...EVE[id]]],
      [`${id}_end`, '엔딩', [{ bg: 'festival' }, { bgm: 'romance' }, ...st.end]],
    ] });
  }
  return L;
}
let albumBgm = null;
function album(tab = 'girls') {
  if (albumBgm === null) albumBgm = AUDIO.current;
  const tabs = { girls: '히로인', scenes: '회상', endings: '엔딩', music: '음악' };
  let body = '';
  if (tab === 'girls') {
    body = `<p class="sub">만난 히로인 ${ORDER.filter((id) => META.met[id]).length}/8</p><div class="album">${ORDER.map((id) => META.met[id]
      ? `<button class="btn" data-al="${id}" style="--c:${CHARS[id].color}"><img src="${img(id, 'key')}" alt=""><span>${CHARS[id].name}${META.endings[id] ? ' ✦' : ''}</span></button>`
      : '<button class="btn locked" disabled><img src="img/bg_dorm.jpg" alt=""><span>???</span></button>').join('')}</div>`;
  } else if (tab === 'scenes') {
    const L = replayList();
    const total = L.reduce((a, g) => a + g.items.length, 0), got = L.reduce((a, g) => a + g.items.filter(([k]) => META.seen[k]).length, 0);
    body = `<p class="sub">본 장면 ${got}/${total} · 장면을 누르면 다시 볼 수 있어요</p>` + L.map((g, gi) => `<div class="rp-g"><h3 style="${g.c ? `color:${g.c}` : ''}">${g.g}</h3><div class="rp">${g.items.map(([k, label], ii) => META.seen[k]
      ? `<button class="btn" data-rp="${gi}:${ii}">▶ ${label}</button>` : '<button class="btn" disabled>？？？</button>').join('')}</div></div>`).join('');
  } else if (tab === 'endings') {
    body = `<div class="ends">${['normal', ...ORDER, 'true'].map((k) => `<div class="end ${META.endings[k] ? 'got' : ''}" style="${CHARS[k] ? `--c:${CHARS[k].color}` : ''}">${CHARS[k] ? `<img src="${img(k, META.endings[k] ? 'e1' : 'e0')}" alt="">` : `<span class="ei">${k === 'true' ? '✦' : '☆'}</span>`}<div><b>${CHARS[k] ? CHARS[k].name : k === 'true' ? 'TRUE END' : 'NORMAL END'}</b><small>${META.endings[k] ? END_TITLES[k] : '아직 보지 못한 결말'}</small>${!META.endings[k] && END_HINTS[k] ? `<em>힌트: ${END_HINTS[k]}</em>` : ''}</div></div>`).join('')}</div>`;
  } else {
    body = `<p class="sub">게임에서 들은 곡을 다시 들을 수 있어요. 모든 곡은 Web Audio로 실시간 합성됩니다.</p><div class="music">${Object.entries(AUDIO.tracks).map(([k, t]) => META.heard[k]
      ? `<button class="btn ${AUDIO.current === k ? 'on' : ''}" data-mu="${k}"><span>${AUDIO.current === k ? '❚❚' : '▶'}</span><b>${t.name}</b><small>${t.ko}</small></button>`
      : '<button class="btn" disabled><span>♪</span><b>？？？</b><small>아직 듣지 못한 곡</small></button>').join('')}</div>`;
  }
  modal(`<h2>앨범</h2><div class="tabs">${Object.entries(tabs).map(([k, n]) => `<button class="btn ${k === tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>${body}`, true, () => { AUDIO.bgm(albumBgm); albumBgm = null; });
  $('#modalInner').onclick = (e) => {
    const t = e.target.closest('[data-tab]'); if (t) { album(t.dataset.tab); return; }
    const b = e.target.closest('[data-al]'); if (b) { const cb = onModalClose; profile(b.dataset.al, true); onModalClose = cb; return; }
    const m = e.target.closest('[data-mu]'); if (m) { AUDIO.bgm(AUDIO.current === m.dataset.mu ? null : m.dataset.mu); album('music'); return; }
    const r = e.target.closest('[data-rp]');
    if (r) { const [gi, ii] = r.dataset.rp.split(':').map(Number); const it = replayList()[gi].items[ii]; replay(it[2]); }
  };
}
async function replay(steps) {
  onModalClose = null; $('#modal').classList.add('hidden'); albumBgm = null;
  const saved = S, ret = document.body.dataset.screen;
  S = newState(META.name || '유안'); REPLAY = true;
  try { await runScene(steps, 'library'); } finally { REPLAY = false; S = saved; }
  FX.set(null);
  if (S && ret === 'hub') hub(); else title();
  album('scenes');
}

/* 저장 슬롯 */
function summary(s) {
  if (!s) return '<span class="empty">비어 있음</span>';
  const best = ORDER.filter((id) => s.intro && s.intro[id]).sort((a, b) => s.aff[b] - s.aff[a])[0];
  const when = s.ts ? new Date(s.ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return `<b>${dateStr(s.day)} ${s.slot ? '오후' : '오전'}</b> · ${esc(s.name)}${best ? ` · <span style="color:${CHARS[best].color}">${CHARS[best].name} ♥${s.aff[best]}</span>` : ''}<small>${when}</small>`;
}
function saveMenu(mode) {
  const rows = [];
  if (mode === 'load') rows.push(['auto', '자동 저장', load(SAVE_KEY)]);
  for (let i = 1; i <= 3; i++) rows.push([i, `슬롯 ${i}`, load(slotKey(i))]);
  modal(`<h2>${mode === 'save' ? '저장하기' : '불러오기'}</h2><div class="slots">${rows.map(([k, n, s]) => `<div class="slotrow ${s ? '' : 'none'}">${s ? `<img src="img/bg_${s.bg || 'dorm'}.jpg" alt="">` : '<div class="noimg">✦</div>'}<div class="si"><em>${n}</em>${summary(s)}</div>${mode === 'save'
    ? `<button class="btn gold" data-sv="${k}">저장</button>` : `<button class="btn gold" data-ld="${k}" ${s ? '' : 'disabled'}>불러오기</button>`}</div>`).join('')}</div>
    ${mode === 'save' ? '<p class="sub">하루가 끝날 때마다 자동 저장도 됩니다.</p>' : ''}`);
  $('#modalInner').onclick = (e) => {
    const sv = e.target.closest('[data-sv]');
    if (sv) { S.ts = Date.now(); if (store(slotKey(sv.dataset.sv), S)) { AUDIO.sfx('save'); toast(`💾 슬롯 ${sv.dataset.sv}에 저장했습니다`); saveMenu('save'); } else toast('저장 공간이 부족합니다'); return; }
    const ld = e.target.closest('[data-ld]');
    if (ld) { const s = load(ld.dataset.ld === 'auto' ? SAVE_KEY : slotKey(ld.dataset.ld)); if (s) { S = fixState(s); onModalClose = null; closeModal(); AUDIO.sfx('save'); hub(); } }
  };
}

function settings() {
  const seg = (key, obj) => `<div class="seg">${Object.keys(obj).map((k) => `<button class="btn ${META[key] === k ? 'on' : ''}" data-${key}="${k}">${k}</button>`).join('')}</div>`;
  modal(`<h2>설정</h2>
    <div class="set-grid">
      <h3>배경음악</h3><div class="vol"><input type="range" min="0" max="100" value="${Math.round(META.bgm * 100)}" id="vBgm"><span>${Math.round(META.bgm * 100)}</span></div>
      <h3>효과음</h3><div class="vol"><input type="range" min="0" max="100" value="${Math.round(META.sfx * 100)}" id="vSfx"><span>${Math.round(META.sfx * 100)}</span></div>
      <h3>글자 속도</h3>${seg('speed', SPEEDS)}
      <h3>자동 진행</h3>${seg('auto', AUTOS)}
      <h3>아이폰 무음 모드</h3><div class="seg"><button class="btn ${META.playback ? 'on' : ''}" id="btnPb">${META.playback ? '무음 모드에서도 소리 재생' : '무음 스위치를 따름'}</button></div>
    </div>
    <p class="sub">대화 중 단축키: Space/Enter 넘기기 · A 자동 · Ctrl 누르는 동안 스킵 · H 대사창 숨기기 · L 기록</p>
    <div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn" id="btnCredit">크레딧</button><button class="btn" id="btnWipe">모든 기록 지우기</button></div>`);
  const vol = (id, key) => {
    const el = $(id);
    el.oninput = () => { META[key] = el.value / 100; el.nextElementSibling.textContent = el.value; if (META.muted) META.muted = false; applyVolume(); };
    el.onchange = () => { saveMeta(); if (key === 'sfx') AUDIO.sfx('heart'); };
  };
  vol('#vBgm', 'bgm'); vol('#vSfx', 'sfx');
  $('#modalInner').onclick = (e) => {
    const b = e.target.closest('[data-speed],[data-auto]');
    if (b) { if (b.dataset.speed) META.speed = b.dataset.speed; else META.auto = b.dataset.auto; saveMeta(); settings(); return; }
    if (e.target.id === 'btnPb') { META.playback = !META.playback; AUDIO.setPlayback(META.playback); saveMeta(); settings(); return; }
    if (e.target.id === 'btnCredit') { creditsInfo(); return; }
    if (e.target.id === 'btnWipe' && confirm('저장 데이터와 앨범 기록을 모두 지울까요?')) {
      try { [SAVE_KEY, META_KEY, slotKey(1), slotKey(2), slotKey(3)].forEach((k) => localStorage.removeItem(k)); } catch { /* 무시 */ }
      META = META_DEF(); applyVolume(); S = null; closeModal(); title();
    }
  };
}
function creditsInfo() {
  modal(`<h2>크레딧</h2>
    <h3>배경 그림</h3><p class="sub">Wikimedia Commons의 퍼블릭 도메인·CC BY 작품을 잘라 쓰고 색을 보정했습니다.</p>
    <ul class="cred">${(CREDITS_BG || []).map((c) => `<li><a href="${esc(c.source)}" target="_blank" rel="noopener">${esc(c.artist)} — ${esc(c.title.replace(/\.(jpg|png)$/i, ''))}</a> <small>(${esc(c.license)})</small></li>`).join('')}</ul>
    <h3>음악 · 효과음</h3><p class="sub">외부 음원 없이 Web Audio API로 실시간 합성한 자작곡 ${Object.keys(AUDIO.tracks).length}곡.</p>
    <h3>캐릭터</h3><p class="sub">LUMINARIA: Eight Fates 캐릭터 시트</p>`, true, () => settings());
}

$('#btnInv').onclick = inventory;
$('#btnSave').onclick = () => saveMenu('save');
$('#btnAlbum').onclick = () => album();
$('#btnSettings').onclick = settings;
$('#btnToTitle').onclick = () => { saveGame(); title(); };

/* ───── 타이틀 ───── */
function title() {
  screen('title'); setBg('tower'); setTint(null);
  AUDIO.bgm('title'); FX.set('stars');
  $('#titleArt').innerHTML = ORDER.map((id) => `<img src="${img(id, 'key')}" alt="">`).join('');
  const any = load(SAVE_KEY) || [1, 2, 3].some((i) => load(slotKey(i)));
  $('#btnLoad').disabled = !any;
}
function audioHint() { $('#tapHint').classList.toggle('hidden', AUDIO.running || META.muted); }
setInterval(audioHint, 800);
$('#btnNew').onclick = () => { screen('naming'); $('#nameInput').value = META.name || '유안'; setTimeout(() => $('#nameInput').select(), 50); };
$('#btnLoad').onclick = () => saveMenu('load');
$('#btnAlbumT').onclick = () => album();
$('#btnSettingsT').onclick = settings;
$('#nameBack').onclick = title;
$('#nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#nameOk').click(); });
$('#nameOk').onclick = async () => {
  const name = $('#nameInput').value.trim() || '유안';
  META.name = name; saveMeta();
  S = newState(name);
  FX.set(null);
  LOG.length = 0;
  await runScene([{ bgm: 'title' }, ...COMMON.prologue, ...COMMON.tutorial]);
  rollPresence(); saveGame(); hub();
};

title();
})();
