/* 루미나리아: Eight Fates — 게임 엔진 */
(() => {
'use strict';
const $ = (s) => document.querySelector(s);
const SAVE_KEY = 'luminaria_save_v1';
const META_KEY = 'luminaria_meta_v1';
const slotKey = (i) => `luminaria_slot_${i}`;
const WEEK = ['월', '화', '수', '목', '금', '토', '일'];
const AP_MAX = 4; // 한 턴 = 일주일. 한 주에 행동치 4 (행동 하나에 1씩)
const EV_AT = [20, 45, 70];
const END_AT = 80;
const TRUE_AT = 35;
const SPEEDS = { 느리게: 45, 보통: 24, 빠르게: 10, 즉시: 0 };
const AUTOS = { 느리게: 1.6, 보통: 1, 빠르게: .6 };
const EV_BGM = ['calm', 'sad', 'romance'];
const WEATHER = { 맑음: '☀', 흐림: '☁', 비: '🌧', 눈: '❄' };
const EVENT_RATE = .18; // 장소 돌발 사건이 일어날 확률 (별의 탑은 .6)
const AFF_CAP = 3; // 호감도는 한 번에 최대 ±3
const REL = [[80, '운명의 상대'], [65, '두근두근'], [45, '특별한 친구'], [25, '친구'], [10, '아는 사이'], [0, '낯선 사이']];

const EXT = { chibi: 'webp', stand: 'webp' }; // 투명 배경 그림은 WebP
const img = (id, kind) => `img/${id}_${kind}.${EXT[kind] || 'jpg'}`;
const face = (id, ex) => img(id, 'e' + (CHARS[id].ex[ex] ?? 0));
const sideReady = (id) => SIDE_STORIES.find((x) => x.ready(S, id));
const softFace = (id) => img(id, 'e' + (CHARS[id].ex.soft ?? CHARS[id].ex.smile ?? 0));
const fmt = (t) => t.replaceAll('{P}', S ? S.name : '');
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return (c >= 0 && c % 28) ? a : b; };
const rel = (a) => REL.find(([v]) => a >= v)[1];
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = (d) => { const [m, dd] = mdOf(d); return `${m}월 ${dd}일`; };
const wdOf = (d) => (d - 1) % 7;
const dateStr = (d) => `${md(d)} (${WEEK[wdOf(d)]})`;
const gradeDate = (d) => `${gradeOf(d)}학년 · ${dateStr(d)}`;
/* 주 단위 턴: 행동치를 하나 쓸 때마다 주 안의 시간이 흐른다 (행동 k번째 = 그 주의 SLOT_OFF[k]일째, 4회면 월·화·목·토) */
const weekStart = (d) => d - wdOf(d);
const SLOT_OFF = Array.from({ length: AP_MAX }, (_, k) => Math.floor((k * 7) / AP_MAX));
const weekDays = (d) => { const w = weekStart(d), out = []; for (let x = w; x < Math.min(w + 7, LAST_DAY); x++) out.push(x); return out; };
const weekMid = (d) => weekStart(d) + 3; // 그 주가 어느 달·학년에 속하는지는 목요일로 정한다
const weekLabel = (d) => { const [m, dd] = mdOf(weekMid(d)); return `${m}월 ${Math.floor((dd - 1) / 7) + 1}주차`; };
const gradeWeek = (d) => `${gradeOf(weekMid(d))}학년 · ${weekLabel(d)}`;
const apFix = (d) => Math.max(1, SLOT_OFF.filter((o) => o > wdOf(d)).length + 1); // 주 중간에 저장된 예전 데이터
/* 다음 축제: 1학년 입춘 별빛 축제 → 2학년 칠석 백 년의 별빛 축제 → 이듬해 입춘 마지막 별빛 축제(엔딩) */
const festTo = (d) => (d <= SPRING_FEST ? ['별빛 축제', SPRING_FEST - d] : d <= TANABATA ? ['백 년의 별빛 축제', TANABATA - d] : ['마지막 별빛 축제', LAST_DAY - d]);
const total = (st) => Object.values(st).reduce((a, b) => a + b, 0);
const rankOf = (t) => RANKS.reduce((r, [v], i) => (t >= v ? i : r), 0);

/* ───── 저장 ───── */
let S = null;
let REPLAY = false;
function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
const META_DEF = () => ({ met: {}, endings: {}, seen: {}, heard: {}, found: {}, speed: '보통', auto: '보통', bgm: .6, sfx: .7, playback: false, muted: false, name: '' });
let META = Object.assign(META_DEF(), load(META_KEY) || {});
const saveGame = () => { if (S && !REPLAY) { S.ts = Date.now(); store(SAVE_KEY, S); } };
const saveMeta = () => store(META_KEY, META);
const seen = (k) => { if (!META.seen[k]) { META.seen[k] = 1; saveMeta(); } };

function newState(name) {
  const o = (v) => Object.fromEntries(ALL.map((k) => [k, v]));
  return {
    name, day: 1, bg: 'dorm', weather: '맑음',
    stats: { int: 5, str: 5, brave: 5, charm: 5 }, gold: 100,
    aff: o(0), met: o(false), intro: o(false), ev: o(0), talk: o(0), gifted: {}, dated: {}, letters: {}, inv: {},
    growth: 0, skills: {}, club: null, creed: null, rank: 0, rev: {}, flags: {}, tower: 0,
    lover: null, love: null, confess: {}, foe: null, ap: AP_MAX,
  };
}
function fixState(s) { // 예전 저장 데이터 보정
  const o = (v) => Object.fromEntries(ALL.map((k) => [k, v]));
  for (const k of ['aff', 'met', 'intro', 'ev', 'talk']) s[k] = Object.assign(o(k === 'met' || k === 'intro' ? false : 0), s[k] || {});
  s.dated = s.dated || {}; s.gifted = s.gifted || {}; s.inv = s.inv || {}; s.weather = s.weather || '맑음';
  s.growth = s.growth || 0; s.skills = s.skills || {}; s.rev = s.rev || {}; s.flags = s.flags || {};
  s.club = s.club || null; s.creed = s.creed || null; s.rank = s.rank ?? rankOf(total(s.stats));
  for (const [k, v] of Object.entries(s.dated)) if (v === true) s.dated[k] = 1; // 예전엔 데이트 여부만 저장했다
  s.letters = s.letters || {};
  for (const [k, v] of Object.entries(s.gifted)) if (typeof v !== 'number') delete s.gifted[k];
  if (s.tower == null) s.tower = Object.keys(s.skills).filter((k) => SKILLS[k] && SKILLS[k].ch).length;
  delete s.slot; delete s.fat; delete s.presence;
  s.lover = s.lover || null; s.love = s.lover ? s.love : null; s.confess = s.confess || {}; s.foe = s.foe || null;
  if (!(s.ap > 0)) s.ap = apFix(s.day); // 하루 턴 시절 저장 데이터: 그 주에 남은 행동치
  s.ap = Math.min(AP_MAX, s.ap);
  return s;
}

/* ───── 오디오 ───── */
function applyVolume() {
  AUDIO.setVol('bgm', META.muted ? 0 : META.bgm);
  AUDIO.setVol('sfx', META.muted ? 0 : META.sfx);
  $('#mute').innerHTML = icon(META.muted ? 'volume-x' : 'music');
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
function toast(msg) { const d = document.createElement('div'); d.innerHTML = iconize(esc(msg)); $('#toast').append(d); setTimeout(() => d.remove(), 2700); }
function pop(text, down) {
  const d = document.createElement('div'); d.className = 'heart-pop' + (down ? ' down' : ''); d.textContent = text;
  const r = $('#sBox').getBoundingClientRect(); d.style.left = (r.left + 30) + 'px'; d.style.top = (r.top - 40) + 'px';
  document.body.append(d); setTimeout(() => d.remove(), 1500);
}
function banner(big, small, icon) {
  AUDIO.sfx('day');
  return new Promise((res) => {
    const d = document.createElement('div'); d.className = 'day-banner';
    d.innerHTML = `<div class="db-in"><div class="db-ic">${iconize(icon || '✦')}</div><div class="db-big">${big}</div><div class="db-line"></div><small>${small || ''}</small></div>`;
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
  const el = $('#sChar'), src = img(id, cg ? 'key' : 'stand');
  if (spriteId !== id || el.dataset.src !== src) { el.classList.remove('on'); void el.offsetWidth; el.src = src; el.dataset.src = src; }
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
    else if (NPCS[who]) color = NPCS[who];
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
    const box = $('#sChoices'); box.innerHTML = ''; box.classList.toggle('many', opts.length > 6); box.scrollTop = 0;
    opts.forEach((o, i) => {
      const b = document.createElement('button'); b.className = 'btn choice'; b.innerHTML = iconize(esc(fmt(o.t)));
      if (o.need) { const n = document.createElement('span'); n.className = 'need ' + (passes(o.need) ? 'ok' : 'no'); n.textContent = `〔${needLabel(o.need)}〕`; b.prepend(n); }
      b.style.animationDelay = (i * 60) + 'ms';
      if (o.disabled) b.disabled = true;
      b.onclick = (e) => { e.stopPropagation(); AUDIO.sfx('select'); box.innerHTML = ''; LOG.push({ n: '▸', c: '#e0809a', t: (o.need ? `〔${needLabel(o.need)}〕 ` : '') + fmt(o.t) }); res(i); };
      box.append(b);
    });
  });
}

/* 장면 연출 도우미 — 시나리오의 {run} 에서 쓸 수 있다 */
const G = {
  get S() { return S; }, say, choose, play, addAff, addStats, charShow, charHide, setBg, toast, josa, sleep, learn, passes, total, giveItem,
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
    if (s.learn) learn(s.learn);
    if (s.item) giveItem(s.item);
    if (s.flag && !REPLAY) S.flags[s.flag] = true;
    if (s.aff) for (const [k, v] of Object.entries(s.aff)) addAff(k, v);
    if (s.stats) addStats(s.stats, true);
    if (s.wait) await sleep(s.wait);
    if (s.choice) {
      const opts = s.choice.filter((o) => !o.when || o.when(S));
      const o = opts[await choose(opts)];
      if (o.need && !passes(o.need)) { AUDIO.sfx('down'); await play(o.fail || []); continue; }
      if (o.need) AUDIO.sfx('event');
      if (o.set && !REPLAY) Object.assign(S, o.set);
      if (o.aff) for (const [k, v] of Object.entries(o.aff)) addAff(k, v);
      if (o.stats) addStats(o.stats, true);
      if (o.item) giveItem(o.item);
      if (o.go) await play(o.go);
    }
  }
}

/* 능력치 판정: 「색 읽기」를 익히면 +5 보정 */
const judgeBonus = () => (S && S.skills.insight ? 5 : 0) + (S && S.skills.oath ? 5 : 0);
function passes(need) { return Object.entries(need).every(([k, v]) => (k === 'total' ? total(S.stats) : S.stats[k]) + judgeBonus() >= v); }
function needLabel(need) {
  return Object.entries(need).map(([k, v]) => `${k === 'total' ? '총 능력치' : STATS[k]} ${v}`).join(' · ') + (passes(need) ? ' ✓' : '');
}
function learn(k) {
  if (REPLAY || S.skills[k]) return;
  S.skills[k] = 1;
  AUDIO.sfx('event'); FX.burst(innerWidth / 2, innerHeight * .4, 'sparkle', '#e8d9a8');
  if (SKILLS[k].ch) { // 무색 마법을 각성할 때마다 별의 탑 수련 1회
    S.tower = (S.tower || 0) + 1;
    toast(`${SKILLS[k].icon} 무색 마법 「${SKILLS[k].name}」 각성! 🕯️ 별의 탑 수련 +1회`);
  } else toast(`${SKILLS[k].icon} 특기 「${SKILLS[k].name}」을(를) 익혔다!`);
}
function giveItem(k) {
  if (REPLAY) return;
  S.inv[k] = (S.inv[k] || 0) + 1; AUDIO.sfx('coin'); toast(`${ITEMS[k].icon} ${ITEMS[k].name}을(를) 얻었다`);
}
/* 등급·능력치 특기 확인 (메인 화면으로 돌아올 때) */
function checkGrowth() {
  if (!S || REPLAY) return;
  const r = rankOf(total(S.stats));
  if (r > S.rank) {
    const g = r * 20; S.rank = r; S.gold += g; AUDIO.sfx('coin');
    toast(`🎖 학원 평가가 ${RANKS[r][1]} 등급으로 올랐다! 장학금 +${g} G`);
  }
  for (const [k, sk] of Object.entries(SKILLS)) if (sk.stat && !S.skills[k] && S.stats[sk.stat[0]] >= sk.stat[1]) learn(k);
}

function meet(id) { if (REPLAY) return; S.met[id] = true; META.met[id] = true; saveMeta(); }
function addAff(id, n) {
  if (!n || REPLAY) return;
  n = Math.max(-AFF_CAP, Math.min(AFF_CAP, n));
  S.aff[id] = Math.max(0, Math.min(100, S.aff[id] + n));
  pop(n > 0 ? `♥ +${n}` : `♡ ${n}`, n < 0);
  AUDIO.sfx(n > 0 ? 'heart' : 'down');
  if (n > 0) { const r = $('#sBox').getBoundingClientRect(); FX.burst(r.left + 60, r.top - 10, 'heart', CHARS[id].color); }
}
/* 보상: 능력치는 한 번에 하나만 +1~2 (적힌 값 중 가장 큰 능력치), 골드는 적힌 그대로 */
const statGain = () => rand(1, 2);
function addStats(g, show) {
  if (REPLAY) return;
  const parts = [];
  if (g.gold) { S.gold = Math.max(0, S.gold + g.gold); parts.push(`골드 ${g.gold > 0 ? '+' : ''}${g.gold}`); }
  const k = Object.keys(STATS).filter((x) => g[x] > 0).sort((a, b) => g[b] - g[a])[0];
  if (k) { const n = statGain(); S.stats[k] += n; parts.push(`${STATS[k]} +${n}`); }
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
const isVac = () => !!termOf(S.day).vac;
function rollWeather() {
  const r = Math.random(), [m] = mdOf(S.day);
  const wet = m === 6 || m === 7 ? .32 : .18; // 장마철엔 비가 잦다
  S.weather = S.day >= LAST_DAY - 1 || S.day === SPRING_FEST || S.day === TANABATA ? '맑음' : r < 1 - wet - .18 ? '맑음' : r < 1 - wet ? '흐림' : (m === 12 || m <= 2 ? '눈' : '비');
}
/* 이번 주에 그 장소에 갈 수 있는지: { ok, why } — 한 턴이 일주일이라, 그 주에 하루라도 열리면 갈 수 있다 */
const locked = (l) => LOCS[l].lock && !S.skills[LOCS[l].lock];
function openOn(L, d) { const t = termOf(d), ds = t.vac ? L.vdays : L.days; return (!L.only || t.key === L.only) && !!ds && ds.includes(wdOf(d)); }
function locState(l) {
  const L = LOCS[l], t = termOf(S.day), days = weekDays(S.day);
  if (locked(l)) return { hide: true };
  if (L.only && !days.some((d) => termOf(d).key === L.only)) return { hide: true };
  if (L.club && !S.club) return { hide: true };
  if (L.ticket) return S.tower > 0 ? { ok: true } : { ok: false, why: '다음 마법을 각성하면' };
  return days.some((d) => openOn(L, d)) ? { ok: true } : { ok: false, why: t.vac ? `${t.name} 중 휴강` : '이번 주는 쉰다' };
}
const locStat = (l) => (LOCS[l].club ? (S.club ? CLUBS[S.club].stat : null) : LOCS[l].stat);
const locName = (l) => (LOCS[l].club && S.club ? `${CLUBS[S.club].name}` : isVac() && LOCS[l].vname ? LOCS[l].vname : LOCS[l].name);
/* 그 장소에서 마주칠 수 있는 히로인과 확률(%) */
function encounterOdds(locId) {
  const out = [];
  const rain = S.weather === '비' || S.weather === '눈', L = LOCS[locId];
  for (const id of ALL) {
    const hid = CHARS[id].hidden;
    if (hid && !S.met[id]) continue; // 히든 히로인은 만난 뒤에만 나타난다
    let p = HAUNTS[id][locId] || 0;
    if (L.club && S.club && CLUBS[S.club].members.includes(id)) p = 30;
    if (!p) continue;
    if (rain && L.outdoor) p /= 2; else if (rain && locId === 'library') p += 5;
    if (S.skills.breath) p += 5;
    if (S.skills.trace) p += 5;
    out.push([id, Math.max(10, Math.min((hid ? HIDDEN_CAP : 30) + (S.skills.trace ? 5 : 0), Math.round(p)))]);
  }
  return out;
}
function rollEncounter(locId) {
  const here = encounterOdds(locId).filter(([, p]) => Math.random() * 100 < p).map(([id]) => id);
  for (let i = here.length - 1; i > 0; i--) { const j = rand(0, i); [here[i], here[j]] = [here[j], here[i]]; }
  return here.slice(0, 2);
}
function pendingEvent(id) {
  const k = S.ev[id];
  if (!S.intro[id] || k >= 3 || S.aff[id] < EV_AT[k]) return -1;
  if (S.day < EV_DAY[k]) return -3;
  if (k === 2) { const r = CHARS[id].req; if (S.stats[r.stat] < r.v) return -2; }
  return k;
}
const dayTint = () => (S.weather === '맑음' ? 'am' : 'pm');
const ambient = (outdoor) => (!outdoor ? null : S.weather === '비' ? 'rain' : S.weather === '눈' ? 'snow' : null);

async function visit(locId) {
  const L = LOCS[locId], club = L.club ? CLUBS[S.club] : null;
  const bg = club ? club.bg : L.bg;
  S.bg = bg;
  AUDIO.bgm(L.bgm || 'daily');
  const parts = [];
  if (L.ticket) {
    for (const k of Object.keys(STATS)) S.stats[k] += 2;
    S.tower--; parts.push('모든 능력치 +2');
  } else {
    const k = locStat(locId);
    if (k) { const n = statGain(); S.stats[k] += n; parts.push(`${STATS[k]} +${n}`); }
  }
  if (L.gold) {
    let g = rand(...L.gold);
    if (S.skills.scout && locId === 'outskirts') g = Math.round(g * 1.5);
    if (S.skills.iron && (locId === 'outskirts' || locId === 'sea')) g += 10;
    if (isVac() && locId === 'market') g += 10; // 방학 성수기
    S.gold += g; parts.push(`골드 +${g}`);
  }
  const pool = club ? CLUB_LINES[S.club] : VISIT_LINES[locId] || [L.desc];
  const [m] = mdOf(S.day);
  const lines = [{ pt: ambient(L.outdoor) || L.pt || null }, ['', `${locName(locId)}. ${pool[rand(0, pool.length - 1)]}${L.outdoor || locId === 'dorm' ? ` ${SEASON_LINES[m]}` : ''}`]];
  setTint(dayTint());
  if (parts.length) toast(parts.join(' · '));
  await runScene(lines, bg, { keepTint: true });
  const rev = Math.random() < (L.ticket ? .6 : EVENT_RATE) && pickEvent(locId);
  if (rev) {
    S.rev[rev.id] = 1; META.found[rev.id] = 1; saveMeta();
    await runScene([{ sfx: 'page' }, ['', `── ✧ ${rev.title} ✧ ──`], ...rev.steps], null, { keepTint: true });
    setBg(bg);
  }
  if (locId === 'dorm') await dormMenu();
  if (L.shop) await shop();

  const here = rollEncounter(locId);
  if (here.length) {
    const opts = here.map((id) => {
      const c = CHARS[id];
      const ev = pendingEvent(id);
      return { t: S.met[id] ? `${c.name}에게 말을 건다  ${'♥'.repeat(Math.ceil(S.aff[id] / 20))}${ev >= 0 ? '  💌' : sideReady(id) ? `  ${sideReady(id).icon}` : ''}` : `낯선 학생에게 말을 건다 (${c.name})` };
    });
    opts.push({ t: '오늘은 혼자 보낸다' });
    await say('', null, here.length > 1 ? '마침 아는 얼굴이 여럿 보인다. 누구와 이야기할까?' : `마침 ${S.met[here[0]] ? CHARS[here[0]].name + josa(CHARS[here[0]].name, '이', '가') : '누군가'} 이곳에 와 있다.`);
    const i = await choose(opts);
    if (i < here.length) await talkTo(here[i]);
  }
  charHide();
  await endAction();
}

function pickEvent(locId) {
  const c = RANDOM_EVENTS.filter((e) => e.loc === locId && !S.rev[e.id] && (!e.when || e.when(S)) && S.day >= eventMinDay(e));
  return c.length ? c[rand(0, c.length - 1)] : null;
}
/* 판정 조건이 높은 사건은 늦게 나온다: 조건 25 → 75일째, 30 → 100일째 */
function eventMinDay(e) {
  if (e.minDay == null) {
    let mx = 0;
    const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.need) mx = Math.max(mx, ...Object.values(x.need)); ['go', 'fail', 'else', 'choice'].forEach((k) => x[k] && walk(x[k])); } };
    walk(e.steps);
    e.minDay = Math.max(0, (mx - 10) * 5);
  }
  return e.minDay;
}

/* 기숙사: 편지 쓰기 (한 사람에게 일주일에 한 번, 호감도 +1) */
async function dormMenu() {
  const week = Math.floor((S.day - 1) / 7);
  const ids = ALL.filter((id) => S.intro[id] && S.letters[id] !== week);
  if (!ids.length) return;
  await say('', null, '책상 위에 편지지가 놓여 있다. 누군가에게 편지를 써 볼까?');
  const i = await choose([...ids.map((id) => ({ t: `📮 ${CHARS[id].name}에게 편지를 쓴다` })), { t: '오늘은 그냥 쉰다' }]);
  if (i >= ids.length) return;
  const id = ids[i];
  S.letters[id] = week;
  await say('', null, `${CHARS[id].name}에게 짧은 편지를 썼다. 요즘 있었던 일, 그리고 고마웠던 일을 적었다.`);
  addAff(id, 1);
}

async function talkTo(id) {
  const st = STORY[id], c = CHARS[id];
  charShow(id);
  if (!S.intro[id]) {
    meet(id); S.intro[id] = true; await play(st.meet); addAff(id, 2);
  } else {
    const k = pendingEvent(id);
    if (k >= 0) {
      await play([{ bgm: EV_BGM[k] }, ...st.ev[k]]); S.ev[id]++; addAff(id, 3);
      seen(`${id}_ev${k}`);
      AUDIO.sfx('event');
      toast(`💌 ${c.name}의 이야기 ${S.ev[id]}/3 을(를) 보았다`);
      charShow(id);
    } else if (sideReady(id)) {
      // 2학년 곁이야기: 봄(🌸) · 가을(🍂) (year2.js · year2b.js)
      const x = sideReady(id);
      await play([{ bgm: 'romance' }, ...x.story[id]]); S.flags[`${x.key}_${id}`] = 1; addAff(id, 3);
      seen(`${id}_${x.key}`);
      AUDIO.sfx('event');
      toast(`${x.icon} ${c.name}의 ${x.title}을(를) 보았다`);
      charShow(id);
    } else {
      S.talk[id] = S.talk[id] || 0;
      const t = st.talks[S.talk[id] % st.talks.length];
      const repeat = S.talk[id] >= st.talks.length;
      S.talk[id]++;
      await play(t.q);
      const i = await choose(t.c.map((x) => ({ t: x[0] })));
      const [, d, reply] = t.c[i];
      addAff(id, talkGain(d, repeat));
      await play(reply.map((r) => (r.length === 3 ? r : [id, ...r])));
      if (k === -2) {
        const r = c.req;
        await say('', null, `(${c.name}${josa(c.name, '은', '는')} 무언가 털어놓고 싶은 눈치다. …${STATS[r.stat]}${josa(STATS[r.stat], '이', '가')} ${r.v} 이상이라면 마음을 열어줄지도 모른다.)`);
      } else if (k === -3) {
        await say('', null, `(${c.name}${josa(c.name, '과', '와')} 한층 가까워진 것 같다. …${md(EV_DAY[S.ev[id]])} 무렵이면, 더 깊은 이야기를 들을 수 있을지도.)`);
      }
    }
  }
  await afterTalk(id);
  charHide();
}
/* 대화 선택지의 호감 변화: 마음을 울린 답 +3 · 좋은 답 +2 · 보통 +1 · 무심한 답 -1 · 무례한 답 -3
 * 한 번 들은 이야기를 다시 할 땐 좋은 답도 +1 */
function talkGain(d, repeat) {
  let g = d >= 5 ? 3 : d >= 3 ? 2 : d >= 1 ? 1 : d === 0 ? -1 : -3;
  if (g > 0 && repeat) g = 1;
  if (g > 0 && S.skills.echo) g += 1;
  return Math.min(AFF_CAP, g);
}

const DATE_GAP = 21; // 같은 사람과의 데이트는 3주에 한 번
const GIFT_GAP = 7; // 같은 사람에게 선물은 일주일에 한 번
const canGiftNow = (id) => typeof S.gifted[id] !== 'number' || S.day - S.gifted[id] >= GIFT_GAP;
const canDateNow = (id) => S.ev[id] >= 1 && DATES[id] && (!S.dated[id] || S.day - S.dated[id] >= DATE_GAP);
async function afterTalk(id) {
  for (;;) {
    const items = Object.entries(S.inv).filter(([, n]) => n > 0);
    const canGift = items.length && canGiftNow(id);
    const canDate = canDateNow(id);
    if (!canGift && !canDate) return;
    const opts = [];
    if (canDate) opts.push({ t: `💕 ${CHARS[id].name}에게 주말 데이트를 신청한다${S.lover && S.lover !== id ? `  (${CHARS[S.lover].name}${josa(CHARS[S.lover].name, '이', '가')} 알면 서운해할 텐데…)` : ''}`, k: 'date' });
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
  S.inv[key]--; S.gifted[id] = S.day;
  let line, gain;
  if (c.likes.includes(key)) { line = GIFT_LINES.like[id]; gain = 3; }
  else if (c.dislikes.includes(key)) { line = GIFT_LINES.dislike; gain = -2; }
  else { line = GIFT_LINES.normal; gain = S.skills.grace ? 2 : 1; }
  await say(id, line[0], line[1]);
  addAff(id, gain);
}
async function dateScene(id) {
  const back = $('#sChar').classList.contains('on');
  const first = !S.dated[id];
  await play([{ bgm: 'romance' }, ...(first ? DATES[id] : shortDate(id, S.day))]);
  if (first) addAff(id, 3);
  S.dated[id] = S.day;
  if (first) seen(`${id}_date`);
  toast(`💕 ${CHARS[id].name}${josa(CHARS[id].name, '과', '와')} 데이트를 했다`);
  if (S.lover && S.lover !== id && !REPLAY) { // 연인이 있는데 다른 사람과 데이트
    const lv = CHARS[S.lover];
    addAff(S.lover, -3);
    toast(`💔 소문이 ${lv.name}의 귀에 들어간 것 같다… (${lv.name} 호감도 -3)`);
  }
  if (back) charShow(id);
}

/* ───── 고백과 연애 ───── */
const canConfess = (id) => !S.lover && S.intro[id] && S.aff[id] >= CONFESS_AT && S.ev[id] >= CONFESS_EV && S.day >= (S.confess[id] || 0);
const confessCands = () => ALL.filter(canConfess);
/* 학기 중엔 방과 후(school)와 주말(free) 데이트 모두, 방학엔 주말·방학 데이트(free)만 */
const loveActs = () => Object.entries(LOVE_ACTS).filter(([, a]) => !isVac() || a.when === 'free');
function loveCard() {
  if (S.lover) {
    const c = CHARS[S.lover];
    return `<button class="btn loc love" data-love style="--c:${c.color}"><span class="ic">${icon('heart')}</span><span class="nm"><b>${c.name}${josa(c.name, '과', '와')} 연애</b><small>연인 ${S.day - S.love.since + 1}일째 · 행동치 1 · 호감도 최대 +3</small></span><span class="who"><img src="${img(S.lover, 'chibi')}" alt=""></span></button>`;
  }
  const cs = confessCands();
  if (!cs.length) return '';
  return `<button class="btn loc love" data-love><span class="ic">${icon('message-circle-heart')}</span><span class="nm"><b>고백하기</b><small>${cs.length > 3 ? `${cs.slice(0, 2).map((id) => CHARS[id].name).join('·')} 외 ${cs.length - 2}명` : cs.map((id) => CHARS[id].name).join('·')}에게 마음을 전한다</small></span><span class="who">${cs.slice(0, 3).map((id) => `<img src="${img(id, 'chibi')}" alt="">`).join('')}${cs.length > 3 ? `<span class="more" title="${cs.slice(3).map((id) => CHARS[id].name).join(', ')}">+${cs.length - 3}</span>` : ''}</span></button>`;
}
/* 연애/고백 메뉴: 고르면 행동치 1을 쓴다. 닫으면 아무 일도 없다. */
function loveMenu() {
  return new Promise((res) => {
    let pick = null;
    if (S.lover) {
      const id = S.lover, c = CHARS[id], nx = LOVE_MILES.find((n) => n > S.love.n);
      modal(`<h2>${icon('heart')} ${c.name}${josa(c.name, '과', '와')}의 연애</h2>
        <div class="love-head" style="--c:${c.color}"><img src="${img(id, 'e1')}" alt=""><div><b>${c.name} · 연인 ${S.day - S.love.since + 1}일째</b>
          <small>${md(S.love.since)}부터 · 연애 ${S.love.n}회 · 호감도 ${S.aff[id]}</small>
          <small>${nx ? `다음 특별한 순간 「${LOVE_MILE_TITLES[LOVE_MILES.indexOf(nx)]}」까지 ${nx - S.love.n}회` : '세 가지 특별한 순간을 모두 함께했다'}</small></div></div>
        <p class="sub">이번 주에 ${isVac() ? '(방학) 함께 보낼 하루를 고른다' : '방과 후, 또는 주말에 함께할 일을 고른다'}. 행동치 1을 씁니다 (남은 행동치 ${S.ap}/${AP_MAX}).</p>
        <div class="love-acts">${loveActs().map(([k, a]) => `<button class="btn" data-act="${k}">${icon(a.icon)}<b>${a.name}</b><small>${a.when === 'free' ? '주말 · ' : '방과 후 · '}${STATS[a.stat]} +1~2 · 호감도 최대 +3</small></button>`).join('')}</div>
        <p class="sub">연애를 2주 넘게 쉬거나 다른 사람과 데이트하면 호감도가 깎이고, ${BREAK_AT} 아래로 떨어지면 헤어집니다.</p>`, true, () => res(pick));
    } else {
      const cs = confessCands();
      modal(`<h2>${icon('message-circle-heart')} 고백하기</h2>
        <p class="sub">마음을 전할 사람을 고르세요. 그녀를 불러내 고백하는 데 행동치 1을 씁니다. 어떤 말로 전하느냐에 따라 대답이 달라져요.</p>
        <div class="love-acts">${cs.map((id) => `<button class="btn" data-who="${id}" style="--c:${CHARS[id].color}"><img src="${softFace(id)}" alt=""><b>${CHARS[id].name}</b><small>호감도 ${S.aff[id]} · ${rel(S.aff[id])}</small></button>`).join('')}</div>`, true, () => res(pick));
    }
    $('#modalInner').onclick = (e) => {
      const b = e.target.closest('[data-act],[data-who]'); if (!b) return;
      pick = b.dataset.act ? ['act', b.dataset.act] : ['who', b.dataset.who];
      closeModal();
    };
  }).then(async (pick) => {
    if (!pick) return;
    if (pick[0] === 'who') await confessTo(pick[1]); else await loverDay(pick[1]);
    charHide();
    await endAction();
  });
}
async function confessTo(id) {
  const c = CHARS[id], C = CONFESS[id];
  let res = 'yes';
  S.bg = C.spot[0];
  await runScene([{ bgm: 'romance' }, { tint: 'pm' }, { pt: null }, { show: id },
    ['', `${C.spot[1]}. ${c.name}${josa(c.name, '을', '를')} 이곳으로 불러냈다.`],
    [id, ...C.call],
    ['me', '…할 말이 있어. 끝까지 들어 줄래?'],
    { choice: [
      { t: `${C.best}  — 진심을 그대로 전한다`, go: [{ run: () => { res = 'yes'; } }] },
      { t: `${CONFESS_SOFT}  — 돌려서 말한다`, go: [{ run: () => { res = S.aff[id] >= CONFESS_SURE ? 'yes' : 'wait'; } }] },
      { t: `${CONFESS_PUSH}  — 자신만만하게 밀어붙인다`, go: [{ run: () => { res = 'no'; } }] },
    ] },
    { run: async (g) => {
      if (res === 'yes') {
        await g.play([{ fx: 'flash' }, ...C.yes]);
        addAff(id, 3);
        S.lover = id; S.love = { since: S.day, n: 0, last: S.day, warn: 0 };
        FX.burst(innerWidth / 2, innerHeight * .4, 'heart', c.color);
        seen(`${id}_confess`);
      } else if (res === 'wait') {
        await g.say(id, C.wait[0], C.wait[1]);
        S.confess[id] = S.day + 7;
      } else {
        await g.say(id, C.no[0], C.no[1]);
        addAff(id, -3);
        S.confess[id] = S.day + 14;
      }
    } },
  ], C.spot[0], { keepTint: true });
  if (res === 'yes') toast(`💞 ${c.name}${josa(c.name, '과', '와')} 연인이 되었다!`);
  else if (res === 'wait') toast(`${c.name}${josa(c.name, '은', '는')} 대답을 미뤘다… ${md(S.confess[id])}부터 다시 고백할 수 있다`);
  else toast(`💔 고백이 거절당했다… ${md(S.confess[id])}부터 다시 고백할 수 있다`);
}
async function loverDay(k) {
  const id = S.lover, c = CHARS[id], A = LOVE_ACTS[k], [m] = mdOf(S.day), R = LOVE_REPLY[id];
  const spot = k === 'season' ? LOVE_SEASON(m) : [A.bg, ''];
  const N = c.name + josa(c.name, '과', '와');
  let got = 'mid';
  S.bg = spot[0];
  await runScene([{ bgm: 'romance' }, { tint: A.tint || dayTint() }, { pt: A.pt || ambient(A.outdoor) || null }, { show: id },
    ['', A.intro.replace('{N}', N).replace('{S}', spot[1])],
    [id, ...LOVE_LINES[id][k]],
    { choice: [
      { t: A.good, aff: { [id]: 3 }, go: [[id, ...R.good], { run: () => { got = 'good'; } }] },
      { t: A.mid, aff: { [id]: 1 }, go: [[id, ...R.mid]] },
      { t: A.bad, aff: { [id]: -3 }, go: [[id, ...R.bad], { run: () => { got = 'bad'; } }] },
    ] },
  ], spot[0], { keepTint: true });
  const sg = statGain();
  S.stats[A.stat] += sg;
  S.love.last = S.day;
  if (got !== 'bad') S.love.n++;
  toast(`💕 ${A.name} · ${STATS[A.stat]} +${sg}`);
  const mi = LOVE_MILES.indexOf(S.love.n);
  if (got !== 'bad' && mi >= 0) {
    await banner(LOVE_MILE_TITLES[mi], `${c.name}${josa(c.name, '과', '와')}의 특별한 순간`, '💕');
    await runScene([{ bgm: 'romance' }, { show: id }, ...LOVE_MILE[id][mi]], null, { keepTint: true });
    seen(`${id}_love${mi}`);
  }
}
/* 날이 밝을 때마다 (행동 사이에 흐르는 날 포함): 연인을 오래 내버려 두면 서운해하고, 호감도가 너무 낮으면 헤어진다 */
async function loveCheck() {
  if (!S.lover) return;
  const id = S.lover, c = CHARS[id];
  if (S.aff[id] < BREAK_AT) {
    await runScene([{ bgm: 'sad' }, { tint: 'pm' }, { show: id }, ['', `${c.name}${josa(c.name, '이', '가')} 굳은 얼굴로 찾아왔다.`], [id, ...BREAKUP[id]], { hide: 1 }, ['', '…연인 관계가 끝났다.']], S.bg);
    S.lover = null; S.love = null; S.confess[id] = S.day + 30;
    toast(`💔 ${c.name}${josa(c.name, '과', '와')} 헤어졌다`);
    return;
  }
  if (S.day - Math.max(S.love.last, S.love.warn || 0) >= NEGLECT_GAP) {
    S.love.warn = S.day;
    S.aff[id] = Math.max(0, S.aff[id] - 2);
    toast(`💔 ${c.name}: “${LOVE_NEGLECT[id]}” (호감도 -2)`);
  }
}

/* ───── 히든 히로인: 조건을 채우면 찾아온다 ───── */
function hiddenRumors() {
  const r = [];
  if (!S.met.sia && S.stats.str >= HIDDEN_RULE.sia - 12) r.push('⚔️ 성 밖에 유랑 무인단이 들어왔다는 소문. 강한 상대를 찾고 있다나…');
  if (!S.met.elise && S.growth >= 4) r.push('🔭 북쪽 왕국 노르하임에서 교환 연구원이 온다는 소문…');
  if (!S.flags.bm && S.gold >= HIDDEN_RULE.gold - 200) r.push('🎭 길드 거리 지하에 밤에만 열리는 시장이 있다는 소문…');
  return r;
}
function meetHidden(id) {
  if (REPLAY) return;
  meet(id); S.intro[id] = true; S.aff[id] = Math.max(S.aff[id], HIDDEN_START[id]);
  AUDIO.sfx('event');
  toast(`✦ 히든 히로인 ${CHARS[id].name}${josa(CHARS[id].name, '을', '를')} 만났다!`);
}
async function hiddenMorning() {
  const id = !S.met.elise && S.skills.bind && S.stats.int >= HIDDEN_RULE.elise ? 'elise'
    : !S.met.sia && S.stats.str >= HIDDEN_RULE.sia ? 'sia' : null;
  if (!id) return;
  await banner('운명 밖의 빛', '누군가 찾아왔다', '✦');
  await runScene(ARRIVE[id]);
  meetHidden(id); seen(`${id}_arrive`);
}
/* 골드가 넉넉한 날 밤: 암시장 사건. 엘린(진실)과 레나(질서) 중 한 사람 편에 선다 */
async function blackMarket() {
  await banner('운명 밖의 빛', '검은 초대장', '🎭');
  await runScene(BLACK_MARKET);
  const who = S.flags.bm === 'rena' ? 'rena' : 'elin';
  S.flags.bm = who; S.foe = who === 'elin' ? 'rena' : 'elin';
  meetHidden(who); seen('blackmarket');
}

/* 행동 하나를 마친다: 행동치 -1 → 다음 행동이 있는 날까지 하루씩 시간이 흐른다.
 * 그 사이 지나가는 날의 밤 이벤트 · 아침 이벤트 · 하루 종일 이벤트가 차례로 열린다 (이벤트는 행동치를 쓰지 않는다).
 * 행동치를 다 쓰면 다음 주 월요일로 넘어가 행동치가 다시 AP_MAX 가 된다. */
async function endAction() {
  const ws = weekStart(S.day);
  S.ap = Math.max(0, (S.ap || 1) - 1);
  let to = S.ap > 0 ? Math.max(S.day + 1, ws + SLOT_OFF[AP_MAX - S.ap]) : ws + 7;
  if (to >= ws + 7) { to = ws + 7; S.ap = 0; }
  while (S.day < to) {
    await nightOf();
    S.day++;
    if (S.day >= LAST_DAY) { await festival(); return; }
    const kind = S.day < to ? 'pass' : S.ap ? 'slot' : 'week';
    if (kind === 'week') S.ap = AP_MAX;
    rollWeather();
    await morningOf(kind);
  }
  saveGame(); hub();
}
/* 그날 밤: 밤 이벤트, 또는 (골드가 넉넉하면) 암시장 */
async function nightOf() {
  const nightEv = CALENDAR[S.day];
  if (nightEv && NIGHT_EVENTS.has(nightEv)) { await runScene(COMMON[nightEv]); seen(nightEv); }
  else if (!S.flags.bm && S.gold >= HIDDEN_RULE.gold && S.day < LAST_DAY - 1) await blackMarket();
}
/* 날이 밝는다. kind: 'week' 새 주의 첫 행동 / 'slot' 이번 주 다음 행동 / 'pass' 행동 없이 지나가는 날 */
async function morningOf(kind) {
  const t = termOf(S.day), ev = CALENDAR[S.day];
  const morning = ev && !NIGHT_EVENTS.has(ev) ? ev : null;
  const termStart = t.from === S.day;
  if (kind === 'pass' && !morning && !termStart) { await dawn(); return; }
  screen('hub'); setBg('dorm'); S.bg = 'dorm'; setTint(dayTint()); FX.set(null);
  hub();
  const [fn, fd] = festTo(S.day), sub = `${WEATHER[S.weather]} ${S.weather} · ${fn}까지 D-${fd}`;
  if (kind === 'week') {
    const range = S.day + 6 >= LAST_DAY ? `${md(LAST_DAY)} 마지막 별빛 축제` : `${md(S.day)}~${md(S.day + 6)}`;
    await banner(gradeWeek(S.day), `${termStart ? `${t.name} 시작 · ` : ''}${range} · 행동치 ${AP_MAX} · ${sub}`, termStart ? '✦' : '📅');
    if (morning) await banner(dateStr(S.day), EVENT_TITLES[morning], '📜');
  } else if (termStart) await banner(gradeDate(S.day), `${t.name} 시작 · ${sub}`, '✦');
  else if (morning) await banner(dateStr(S.day), `${EVENT_TITLES[morning]} · ${sub}`, '📜');
  else await flip(dateStr(S.day), `${WEATHER[S.weather]} ${S.weather} · 행동치 ${S.ap}/${AP_MAX}`);
  if (morning) { await runScene(COMMON[morning]); seen(morning); }
  await dawn();
}
/* 매일 아침의 성장·히든·연애 확인 */
async function dawn() {
  const g = GROWTH[S.growth];
  if (g && S.day >= g.day && total(S.stats) >= g.need) {
    screen('hub'); hub();
    await banner(`무색의 빛 · ${S.growth + 1}장`, g.title, '✦');
    await runScene(g.steps);
    S.growth++; seen(g.key);
  } else await hiddenMorning();
  await loveCheck();
}
function flip(big, small) {
  AUDIO.sfx('page');
  return new Promise((res) => {
    const d = document.createElement('div'); d.className = 'day-flip';
    d.innerHTML = `<b>${big}</b><small>${iconize(small)}</small>`;
    document.body.append(d); setTimeout(() => { d.remove(); res(); }, 800);
  });
}

async function festival() {
  const best = S.lover || ALL.filter((id) => S.intro[id]).sort((a, b) => S.aff[b] - S.aff[a])[0];
  if (best && S.aff[best] >= 30 && EVE[best]) { await runScene([{ bgm: 'calm' }, ...EVE[best]]); seen(`${best}_eve`); }
  else await runScene([{ bgm: 'calm' }, ...COMMON.eveAlone]);
  S.weather = '맑음';
  await banner(dateStr(LAST_DAY), '별빛 축제의 밤', '✦');
  await runScene([{ bgm: 'festival' }, ...COMMON.festivalOpen]);
  const cand = ALL.filter((id) => S.ev[id] >= 3 && S.aff[id] >= END_AT).sort((a, b) => (b === S.lover) - (a === S.lover) || S.aff[b] - S.aff[a]);
  const trueOK = S.growth >= GROWTH.length && ORDER.every((id) => S.intro[id] && S.aff[id] >= TRUE_AT);
  const opts = cand.map((id) => ({ t: `${id === S.lover ? '💕 ' : ''}${CHARS[id].name}에게 간다${id === S.lover ? ' (연인)' : ''}`, k: id }));
  if (trueOK) opts.push({ t: '✦ 여덟 사람 모두와 함께 별등 앞에 선다', k: 'true' });
  if (S.growth >= GROWTH.length) opts.push({ t: '🕯️ 혼자 탑 꼭대기, 별등 곁으로 간다', k: 'solo' });
  let who = opts[0]?.k;
  if (opts.length > 1) {
    await say('', null, '별등 앞에서 기다리고 있을 사람이 떠오른다. 누구에게 갈까?');
    who = opts[await choose(opts)].k;
  }
  let key;
  if (who === 'true') { await play([{ bgm: 'ending' }, ...COMMON.trueEnd]); key = 'true'; }
  else if (who === 'solo') { await play([{ bgm: 'ending' }, ...COMMON.soloEnd]); key = 'solo'; }
  else if (who) {
    const lov = who === S.lover ? [['', `${md(S.love.since)}, 연인이 된 그날로부터 ${S.day - S.love.since}일. 둘이 함께 맞는 마지막 별빛 축제의 밤이다.`]] : [];
    await play([{ bgm: 'romance' }, ...lov, ...STORY[who].end]); key = who;
  }
  else {
    const fr = ALL.filter((id) => S.intro[id] && S.aff[id] >= 35).sort((a, b) => S.aff[b] - S.aff[a])[0];
    const ne = [...COMMON.normalEnd];
    if (fr) ne.splice(ne.length - 1, 0, { show: fr }, [fr, Object.keys(CHARS[fr].ex)[1], FRIEND_LINES[fr]], { hide: 1 });
    await play([{ bgm: 'calm' }, ...ne]); key = 'normal';
  }
  charHide();
  META.endings[key] = true; seen(CHARS[key] ? `${key}_end` : key);
  saveMeta();
  try { localStorage.removeItem(SAVE_KEY); } catch { /* 무시 */ }
  const result = { key, name: S.name, aff: { ...S.aff }, stats: { ...S.stats }, rank: rankOf(total(S.stats)), growth: S.growth, skills: Object.keys(S.skills).length };
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
      <h4>CAST</h4>${ALL.filter((id) => !CHARS[id].hidden || META.met[id]).map((id) => `<p><b style="color:${CHARS[id].color}">${CHARS[id].name}</b> <small>${CHARS[id].en}</small><br><small>${CHARS[id].title}</small></p>`).join('')}
      <h4>MUSIC</h4>${Object.values(AUDIO.tracks).map((t) => `<p>${esc(t.name)} <small>${esc(t.ko)}</small></p>`).join('')}<p><small>Web Audio로 실시간 합성</small></p>
      <h4>BACKGROUND ART</h4>${bg}
      <h4>CHARACTER ART</h4><p>LUMINARIA: Eight Fates 캐릭터 시트</p><p><small>고해상도화 Real-ESRGAN · 배경 분리 isnet-anime</small></p>
      <h4>ICONS</h4><p>Lucide <small>(ISC License)</small></p>
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
  const cleared = ORDER.filter((id) => META.endings[id]).length, hidCleared = HIDDEN.filter((id) => META.endings[id]).length;
  const top = ALL.filter((id) => r.aff[id] != null).sort((a, b) => r.aff[b] - r.aff[a]).slice(0, 3);
  modal(`<div class="credits">
    <div class="logo">LUMINARIA<small>Eight Fates</small></div>
    <div class="end-name">${esc(END_TITLES[r.key] || '')}</div>
    <p class="quote">${CHARS[r.key] ? `「${CHARS[r.key].quote}」` : r.key === 'true' ? '「여덟 개의 빛, 그리고 색이 없는 단 하나의 빛.」' : r.key === 'solo' ? '「색이 없다는 건, 무엇이든 이을 수 있다는 뜻이었다.」' : '「…다음 축제에는, 조금 더 용기를 내볼까.」'}</p>
    <div class="res-grid">${top.map((id) => `<div><img src="${img(id, 'e1')}" alt=""><b>${CHARS[id].name}</b><span>♥ ${r.aff[id]}</span></div>`).join('')}</div>
    <p>${Object.entries(STATS).map(([k, n]) => `${n} ${r.stats[k]}`).join(' · ')}</p>
    <p>학원 평가 <b>${RANKS[r.rank][1]}</b> · 무색의 빛 ${r.growth}/${GROWTH.length}장 · 무색 마법 ${r.skills}/${Object.keys(SKILLS).length}</p>
    <p>히로인 엔딩 ${cleared} / 8${hidCleared ? ` · 히든 ${hidCleared} / 4` : ''}${META.endings.solo ? ' · 🕯️ 성장 엔딩' : ''}${META.endings.true ? ' · ✦ 트루 엔딩' : ''}</p>
    <p style="color:var(--dim);font-size:13px">플레이해주셔서 감사합니다.</p>
    <button class="btn gold" data-close>타이틀로</button></div>`, false, () => title());
}

/* ───── 메인 화면 ───── */
function hub() {
  checkGrowth();
  screen('hub'); setBg(S.bg || 'dorm'); setTint(dayTint());
  const wet = S.weather === '비' || S.weather === '눈', [m] = mdOf(S.day);
  AUDIO.bgm(wet ? 'calm' : 'daily');
  FX.set(S.weather === '비' ? 'rain' : S.weather === '눈' ? 'snow' : m === 4 ? 'petals' : null);
  const t = termOf(S.day), ds = weekDays(S.day);
  $('#hDate').textContent = gradeWeek(S.day);
  $('#hSlot').innerHTML = iconize(`${t.name}${t.vac ? '' : ` ${Math.floor((S.day - t.from) / 7) + 1}주차`} · ${dateStr(S.day)} · ${WEATHER[S.weather]} ${S.weather}`);
  // 이번 주 달력: 지난 날은 흐리게, 오늘은 강조, 행사가 있는 날엔 점
  const ws = weekStart(S.day), nextAct = S.ap > 1 ? ws + SLOT_OFF[AP_MAX - S.ap + 1] : ws + 7;
  $('#hWeek').innerHTML = `<div class="wk">${Array.from({ length: 7 }, (_, i) => ws + i).map((d) => {
    const e = d === LAST_DAY ? 'fest' : CALENDAR[d], title = d === LAST_DAY ? '마지막 별빛 축제' : e ? EVENT_TITLES[e] : '';
    return `<span class="${d > LAST_DAY ? 'off' : d < S.day ? 'past' : d === S.day ? 'now' : ''} ${e ? (e === 'fest' || NIGHT_EVENTS.has(e) ? 'ev night' : 'ev') : ''} ${wdOf(d) >= 5 ? 'we' : ''}" title="${esc(title)}">${WEEK[wdOf(d)]}<b>${mdOf(d)[1]}</b></span>`;
  }).join('')}</div>
    <div class="ap"><em>행동치</em>${Array.from({ length: AP_MAX }, (_, i) => `<i class="${i < S.ap ? 'on' : ''}"></i>`).join('')}${nextAct >= LAST_DAY ? '<small>축제 전 마지막 행동</small>' : S.ap === 1 ? '<small>이번 주 마지막 행동</small>' : ''}<b>${S.ap}/${AP_MAX}</b></div>`;

  const news = [`🌟 ${festTo(S.day)[0]}까지 D-${festTo(S.day)[1]}`];
  const evs = ds.filter((d) => CALENDAR[d] && (d > S.day || (d === S.day && NIGHT_EVENTS.has(CALENDAR[d])))); // 오늘 아침 행사는 이미 지나갔다
  for (const d of evs) news.push(`${NIGHT_EVENTS.has(CALENDAR[d]) ? '🌙' : '📜'} ${d === S.day ? '오늘' : `${WEEK[wdOf(d)]}요일`}${NIGHT_EVENTS.has(CALENDAR[d]) ? ' 밤' : ''} — ${DAY_NEWS[CALENDAR[d]] || `「${EVENT_TITLES[CALENDAR[d]]}」`}`);
  const nextD = Object.keys(CALENDAR).map(Number).sort((a, b) => a - b).find((d) => d > ds[ds.length - 1]);
  if (!evs.length && nextD && nextD - S.day <= 14) news.push(`📜 다음 주 ${md(nextD)} — ${DAY_NEWS[CALENDAR[nextD]]} (D-${nextD - S.day})`);
  if (t.vac) news.push(`🏖 ${t.name}! 수업이 없다. 탐험·상점가가 매일 열린다`);
  if (S.weather === '비' || S.weather === '눈') news.push(`${WEATHER[S.weather]} ${S.weather}${josa(S.weather, '이', '가')} 온다. 밖에서 사람을 만나기는 어려울 것 같다`);
  if (S.tower > 0 && !locked('tower')) news.push(`🕯️ 별의 탑에서 수련할 수 있다 (${S.tower}회 · 모든 능력치 +2)`);
  for (const id of ALL) {
    const k = pendingEvent(id);
    if (k >= 0) news.push(`💌 ${CHARS[id].name}${josa(CHARS[id].name, '과', '와')}의 이야기가 기다리고 있다. 만나러 가 보자`);
  }
  if (S.lover) {
    const c = CHARS[S.lover], nx = LOVE_MILES.find((n) => n > S.love.n);
    news.push(`💕 ${c.name}${josa(c.name, '과', '와')} 연인 ${S.day - S.love.since + 1}일째 · 연애 ${S.love.n}회${nx ? ` · 「${LOVE_MILE_TITLES[LOVE_MILES.indexOf(nx)]}」까지 ${nx - S.love.n}회` : ''}`);
  } else {
    const cs = confessCands();
    if (cs.length) news.push(`💗 ${cs.map((id) => CHARS[id].name).join('·')}에게 마음을 전할 수 있을 것 같다 (고백하기)`);
  }
  news.push(...hiddenRumors());
  const g = GROWTH[S.growth];
  if (g) {
    const tt = total(S.stats);
    news.push(tt >= g.need && S.day + 1 >= g.day ? `✦ 곧, 무색의 빛에 변화가 찾아올 것 같다` : `✦ 무색의 빛 ${S.growth + 1}장 「${g.title}」: ${S.day < g.day ? `${md(g.day)}부터 · ` : ''}총 능력치 ${g.need} (지금 ${tt})`);
  }
  $('#hNews').innerHTML = news.map((n) => `<li>${iconize(n)}</li>`).join('');

  const st = Object.entries(STATS).map(([k, n]) => `<div class="stat"><span>${n}</span><div class="bar"><i style="width:${Math.min(100, S.stats[k])}%"></i></div><b>${S.stats[k]}</b></div>`).join('');
  const tt = total(S.stats), nx = RANKS[S.rank + 1];
  $('#hStats').innerHTML = `<div class="rank-line"><span class="rank r${S.rank}">${RANKS[S.rank][1]}</span><span>학원 평가<small>${nx ? `총 ${tt} · 다음 등급 ${nx[0]}` : `총 ${tt} · 최고 등급`}</small></span></div>` + st + `<div class="gold-line">${iconize('💰')} ${S.gold} G</div>`;

  $('#hLocs').innerHTML = loveCard() + Object.keys(LOCS).map((k) => [k, locState(k)]).filter(([, s]) => !s.hide).map(([k, s]) => {
    const L = LOCS[k], stat = locStat(k);
    const ws = encounterOdds(k).filter(([id]) => S.met[id]); // 얼굴은 세 명까지, 나머지는 +n
    const who = ws.slice(0, 3).map(([id]) => `<img src="${img(id, 'e0')}" title="${CHARS[id].name} (자주 온다)" alt="">`).join('') + (ws.length > 3 ? `<span class="more" title="${ws.slice(3).map(([id]) => CHARS[id].name).join(', ')}">+${ws.length - 3}</span>` : '');
    const gain = [L.ticket ? `모든 능력치 +2 · ${S.tower}회` : stat ? `${STATS[stat]} +1~2` : L.club ? '' : '편지 · 휴식', L.gold ? '골드' : ''].filter(Boolean).join(' · ');
    return `<button class="btn loc ${s.ok ? '' : 'shut'}" data-loc="${k}" ${s.ok ? '' : 'disabled'}><span class="ic">${iconize(L.club && S.club ? CLUBS[S.club].icon : L.icon)}</span><span class="nm"><b>${locName(k)}</b><small>${s.ok ? gain : iconize(`🔒 ${s.why}`)}</small></span><span class="who">${s.ok ? who : ''}</span></button>`;
  }).join('');

  const known = ALL.filter((id) => S.met[id]);
  if (known.length) {
    const id = known[rand(0, known.length - 1)], c = CHARS[id];
    const haunt = Object.entries(HAUNTS[id]).filter(([l]) => !locState(l).hide).sort((a, b) => b[1] - a[1])[0];
    const where = haunt ? `요즘 ${LOCS[haunt[0]].place}에서 자주 보인다${locState(haunt[0]).ok ? ' · 오늘 열려 있다' : ''}` : '';
    $('#hIdle').innerHTML = `<div class="idle"><div class="bubble"><b style="color:${c.color}">${c.name}</b> “${IDLE_LINES[id][rand(0, IDLE_LINES[id].length - 1)]}”<br><small>— ${where}</small></div><img src="${img(id, 'chibi')}" alt=""></div>`;
  } else $('#hIdle').innerHTML = `<div class="idle"><div class="bubble">${S.weather === '비' ? '빗소리가 들린다. 오늘은 어떤 하루를 보낼까…' : '오늘은 어떤 일을 해볼까…?'}</div></div>`;

  const card = (id) => {
    const met = S.met[id], c = CHARS[id];
    if (c.hidden && !met) { // 히든: 만나기 전엔 실루엣과 ???
      const foe = S.foe === id;
      return `<button class="btn girl secret ${foe ? 'foe' : ''}" disabled style="--c:${c.color}"><img src="${img(id, 'chibi')}" alt=""><div class="gn">${foe ? c.name : '???'}</div><div class="rl">${foe ? '등을 돌렸다' : HIDDEN_HINT[id]}</div><div class="hb"></div></button>`;
    }
    const ev = S.lover === id ? `<span class="badge love">${icon('heart')}</span>` : pendingEvent(id) >= 0 ? `<span class="badge">${icon('mail')}</span>` : '';
    return `<button class="btn girl ${met ? '' : 'locked'} ${S.lover === id ? 'lover' : ''} ${c.hidden ? 'hid' : ''}" data-girl="${id}" style="--c:${c.color}">${ev}<img src="${img(id, 'e0')}" alt=""><div class="gn">${met ? c.name : '???'}</div><div class="rl">${!met ? '' : S.lover === id ? '연인' : rel(S.aff[id])}</div><div class="hb"><i style="width:${S.aff[id]}%"></i></div></button>`;
  };
  const hidMet = HIDDEN.filter((id) => S.met[id]).length;
  $('#hGirls').innerHTML = `<div class="girls-row">${ORDER.map(card).join('')}<button class="btn girls-more" data-more>${icon('sparkles')}<span>히든<b>${hidMet}/4</b></span></button></div>
    <div class="girls-row girls-hidden"><div class="girls-tag">${icon('sparkles')}<span>HIDDEN</span></div>${HIDDEN.map(card).join('')}</div>`;
}
let busy = false;
$('#hLocs').addEventListener('click', async (e) => {
  if (e.target.closest('[data-love]') && !busy) {
    busy = true;
    try { await loveMenu(); } finally { busy = false; }
    return;
  }
  const b = e.target.closest('[data-loc]');
  if (!b || b.disabled || busy) return;
  busy = true;
  try { await visit(b.dataset.loc); } finally { busy = false; }
});
$('#hGirls').addEventListener('click', (e) => {
  if (e.target.closest('[data-more]')) { const h = $('#hGirls .girls-hidden'); $('#hGirls').scrollTo({ top: h.offsetTop - 10, behavior: 'smooth' }); return; }
  const b = e.target.closest('[data-girl]'); if (b && S.met[b.dataset.girl]) profile(b.dataset.girl);
});

/* ───── 모달 ───── */
let onModalClose = null;
function modal(html, closable = true, onClose = null) {
  $('#modalInner').innerHTML = (closable ? '<button class="btn modal-close" data-close>✕</button>' : '') + iconize(html);
  $('#modalInner').onclick = null;
  const was = $('#modal').classList.contains('hidden');
  $('#modal').classList.remove('hidden');
  if (was) AUDIO.sfx('page');
  onModalClose = onClose;
}
function closeModal() { $('#modal').classList.add('hidden'); const f = onModalClose; onModalClose = null; if (f) f(); }
$('#modal').addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target.id === 'modal') closeModal(); });

function showLog() {
  modal(`<h2>대사 기록</h2><div class="log">${LOG.slice(-120).map((l) => `<div class="ll">${l.n ? `<b style="color:${l.c}">${esc(l.n)}</b>` : ''}<p class="${l.n ? '' : 'narr'}">${iconize(esc(l.t))}</p></div>`).join('') || '<p style="color:var(--dim)">아직 기록이 없습니다.</p>'}</div>`);
  const lg = $('#modalInner .log'); if (lg) lg.scrollTop = lg.scrollHeight;
}

function shop() {
  return new Promise((res) => {
    const draw = () => {
      $('#modalInner').innerHTML = `<button class="btn modal-close" data-close>✕</button>
        <div class="shop-head"><img src="${img('beatrix', 'e2')}" alt=""><div><h2>상인 길드 상점</h2><p style="color:var(--dim);margin:0">「좋은 물건엔 좋은 값을. 선물이라면 상대 취향을 잘 생각해 봐.」 — 베아트릭스</p></div></div>
        <div class="purse">${iconize('💰')} ${S.gold} G</div>
        <div class="grid-items">${Object.entries(ITEMS).map(([k, it]) => `<button class="btn item" data-buy="${k}" ${S.gold < it.price ? 'disabled' : ''}><span class="ic">${iconize(it.icon)}</span><span>${it.name}<small>${it.price} G · 보유 ${S.inv[k] || 0}</small><em>${it.desc || ''}</em></span></button>`).join('')}</div>
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
    <p style="color:var(--dim);font-size:13px">선물은 히로인과 대화한 뒤에 건넬 수 있습니다. 한 사람에게 일주일에 한 번. 좋아하는 선물 +3, 싫어하는 선물은 -2. 이야기를 하나 본 히로인은 좋아하는 선물에 ★가 표시됩니다.</p>`);
}

function growthMenu() {
  const t = total(S.stats), nx = RANKS[S.rank + 1];
  const chap = GROWTH.map((g, i) => {
    const done = i < S.growth, next = i === S.growth;
    return `<li class="${done ? 'done' : next ? 'next' : ''}"><b>${i + 1}장 ${done || next ? g.title : '？？？'}</b><small>${done ? '완료' : next ? `${md(g.day)} 이후 · 총 능력치 ${g.need}${t >= g.need ? ' ✓' : ` (지금 ${t})`}` : '앞 장을 마치면 열린다'}</small></li>`;
  }).join('');
  const sk = Object.entries(SKILLS).map(([k, x]) => {
    const has = S.skills[k];
    const how = x.stat ? `${STATS[x.stat[0]]} ${x.stat[1]} 달성 (지금 ${S.stats[x.stat[0]]})` : `무색의 빛 ${x.ch}장`;
    return `<div class="skill ${has ? 'on' : ''}"><span class="ic">${has ? x.icon : '🔒'}</span><div><b>${x.ch ? '' : '[특기] '}${x.name}</b><small>${x.desc}</small>${has ? '' : `<em>${how}</em>`}</div></div>`;
  }).join('');
  const found = Object.keys(META.found).length;
  const tt = Object.entries(LOCS).filter(([, L]) => !L.ticket).map(([k, L]) => {
    const who = ALL.filter((id) => S.met[id] && (HAUNTS[id][k] || (L.club && S.club && CLUBS[S.club].members.includes(id)))).map((id) => CHARS[id].name).join('·');
    return `<tr><th>${L.icon} ${L.club ? '동아리 활동' : L.name}</th><td>${L.club ? (S.club ? '매주' : '박람회 후 · 매주') : L.days ? '매주' : '—'}</td><td>${L.only ? '여름방학 · 매주' : (L.vname ? `${L.vname} ` : '') + (L.club ? '—' : L.vdays ? '매주' : '휴강')}</td><td>${L.club ? (S.club ? STATS[CLUBS[S.club].stat] : '부 능력치') : L.stat ? STATS[L.stat] : '편지·휴식'}${L.gold ? ' · 골드' : ''}</td><td>${who || '<span class="dim">—</span>'}</td></tr>`;
  }).join('');
  const nextEv = Object.keys(CALENDAR).map(Number).sort((a, b) => a - b).filter((d) => d >= S.day).slice(0, 4).map((d) => `<li><b>${md(d)}</b> ${EVENT_TITLES[CALENDAR[d]]}</li>`).join('');
  modal(`<h2>성장 기록</h2>
    <div class="grow-head"><span class="rank big r${S.rank}">${RANKS[S.rank][1]}</span><div><b>학원 평가 ${RANKS[S.rank][1]} 등급</b><small>총 능력치 ${t}${nx ? ` · 다음 ${nx[1]} 등급까지 ${nx[0] - t}` : ' · 최고 등급'}</small>
      <small>${S.club ? `${CLUBS[S.club].icon} ${CLUBS[S.club].name} — ${CLUBS[S.club].desc}` : '동아리: 아직 없음 (4월 6일 박람회)'}</small>
      ${S.creed ? `<small>신념: ${CREEDS[S.creed]}</small>` : ''}</div></div>
    <h3>📅 시간표 <small>(지금: ${termOf(S.day).name} · 한 주에 행동치 ${AP_MAX})</small></h3>
    <div class="tt-wrap"><table class="tt"><tr><th>행동</th><td>학기 중</td><td>방학</td><td>오르는 것</td><td>자주 오는 사람</td></tr>${tt}</table></div>
    <p class="sub">🕯️ 별의 탑: 무색 마법을 각성할 때마다 한 번 (모든 능력치 +2) · 남은 수련 ${S.tower}회 · 히로인은 자주 오는 곳에서도 10~30% 확률로만 만난다</p>
    ${nextEv ? `<h3>다가오는 학원 행사</h3><ul class="chap">${nextEv}</ul>` : ''}
    <h3>무색의 빛 — 주인공 이야기</h3><ul class="chap">${chap}</ul>
    <h3>무색 마법 · 특기 ${Object.keys(S.skills).length}/${Object.keys(SKILLS).length}</h3><div class="skills">${sk}</div>
    <p class="sub">학원 곳곳의 돌발 사건 ${found}/${RANDOM_EVENTS.length}개 발견 · 능력치 판정 선택지 〔 〕는 조건을 넘으면 ✓가 붙어요${S.skills.insight ? ' (「색 읽기」 보정 +10 적용 중)' : ''}</p>`);
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
        <tr><th>이야기</th><td>${'●'.repeat(ev)}${'○'.repeat(3 - ev)} ${ev < 3 ? `(다음: 호감도 ${EV_AT[ev]}${EV_DAY[ev] > 1 ? ` · ${md(EV_DAY[ev])} 이후` : ''}${ev === 2 ? ` · ${STATS[c.req.stat]} ${c.req.v}` : ''})` : '완료'}</td></tr>
        <tr><th>2학년</th><td>${SIDE_STORIES.map((x) => (S.flags[`${x.key}_${id}`] ? `${x.icon} ${x.title} 완료` : `${x.icon} ${x.title} (${x.hint})`)).join('<br>')}</td></tr>
        <tr><th>자주 가는 곳</th><td>${Object.entries(HAUNTS[id]).map(([l, p]) => `${LOCS[l].place} ${p}%`).join(', ')}</td></tr>
        <tr><th>좋아하는 선물</th><td>${likes}</td></tr>
        <tr><th>연애</th><td>${S.lover === id ? `${icon('heart')} 연인 (${md(S.love.since)}부터 · 연애 ${S.love.n}회)` : S.lover ? `${CHARS[S.lover].name}${josa(CHARS[S.lover].name, '과', '와')} 사귀는 중` : canConfess(id) ? '지금 고백할 수 있다 (고백하기)' : `호감도 ${CONFESS_AT} · 이야기 ${CONFESS_EV}편 이후 고백${(S.confess[id] || 0) > S.day ? ` · ${md(S.confess[id])}부터 다시` : ''}`}</td></tr>
        <tr><th>데이트</th><td>${ev < 1 ? '이야기 1 이후' : canDateNow(id) ? '오늘 신청할 수 있다 (주말)' : S.dated[id] && S.day - S.dated[id] < DATE_GAP ? `${md(S.dated[id] + DATE_GAP)} 이후 주말` : '주말에 만나면 신청할 수 있다'}</td></tr>` : ''}
        ${META.endings[id] ? '<tr><th>엔딩</th><td>✦ 달성</td></tr>' : ''}
      </table>
      <p class="quote">“${c.quote}”</p>
      <button class="btn" id="btnSheet">설정 자료 보기</button>
    </div></div>`);
  $('#btnSheet').onclick = () => modal(`<h2>${c.name} 설정 자료</h2><img class="sheet-img" src="${img(id, 'sheet')}" alt="${c.name} 캐릭터 시트">`, true, () => profile(id, fromAlbum));
}

/* 앨범: 히로인 · 회상 · 엔딩 · 음악 */
function replayList() {
  const ev = (k) => [k, EVENT_TITLES[k], k === 'flicker' ? COMMON.flicker : COMMON[k]];
  const L = [
    { g: '1학기', items: ['welcome', 'club', 'ghost', 'exam', 'field', 'flicker', 'finals', 'term1End'].map(ev) },
    { g: '여름방학', items: ['camp', 'summerFest'].map(ev) },
    { g: '2학기', items: ['term2Start', 'contest', 'exam2', 'schoolFest', 'finals2', 'term2End'].map(ev) },
    { g: '겨울방학', items: ['xmas', 'newYear', 'prep', 'springFest', 'assembly'].map(ev) },
    { g: '학년말 · 봄방학', items: ['candy', 'graduation', 'promo', 'whiteDay', 'term3End'].map(ev) },
    { g: '2학년 1학기', items: ['promotion', 'blossom', 'recruit', 'trip1', 'trip2', 'exam3', 'sports', 'rainy', 'finals3', 'prep2'].map(ev) },
    { g: '2학년 여름방학', items: ['tanabata', 'afterglow', 'term1End2', 'farewell', 'delve', 'lantern', 'dare'].map(ev) },
    { g: '2학년 2학기', items: ['term2Start2', 'career', 'contest2', 'exam4', 'schoolFest2', 'firstSnow', 'finals4', 'term2End2'].map(ev) },
    { g: '2학년 겨울방학 · 마지막 축제', items: [...['xmas2', 'newYear2', 'raid', 'prep3'].map(ev), ['solo', '나만의 색', [{ bgm: 'ending' }, ...COMMON.soloEnd]], ['true', '아홉 번째 빛', [{ bg: 'festival' }, { bgm: 'ending' }, ...COMMON.trueEnd]]] },
    { g: '무색의 빛', c: '#e8d9a8', items: GROWTH.map((g, i) => [g.key, `${i + 1}장 ${g.title}`, g.steps]) }];
  for (const id of ALL) {
    const st = STORY[id], hid = CHARS[id].hidden;
    L.push({ g: hid && !META.met[id] ? '???' : CHARS[id].name, c: CHARS[id].color, items: [
      ...(!hid ? [] : ARRIVE[id] ? [[`${id}_arrive`, '만남', ARRIVE[id]]] : [['blackmarket', '암시장의 밤', BLACK_MARKET]]),
      ...st.ev.map((e, k) => [`${id}_ev${k}`, `이야기 ${k + 1}`, [{ bgm: EV_BGM[k] }, ...e]]),
      ...SIDE_STORIES.map((x) => [`${id}_${x.key}`, x.title, [{ bgm: 'romance' }, ...x.story[id]]]),
      [`${id}_date`, '주말 데이트', [{ bgm: 'romance' }, ...DATES[id]]],
      [`${id}_confess`, '고백', confessReplay(id)],
      ...LOVE_MILE_TITLES.map((t, k) => [`${id}_love${k}`, `연인 · ${t}`, mileReplay(id, k)]),
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
    body = `<p class="sub">만난 히로인 ${ORDER.filter((id) => META.met[id]).length}/8 · 히든 ${HIDDEN.filter((id) => META.met[id]).length}/4</p><div class="album">${ALL.map((id) => META.met[id]
      ? `<button class="btn" data-al="${id}" style="--c:${CHARS[id].color}"><img src="${img(id, 'key')}" alt=""><span>${CHARS[id].name}${META.endings[id] ? ' ✦' : ''}</span></button>`
      : CHARS[id].hidden ? `<button class="btn locked secret" disabled><img src="${img(id, 'chibi')}" alt=""><span>??? · 히든</span></button>`
      : '<button class="btn locked" disabled><img src="img/bg_dorm.jpg" alt=""><span>???</span></button>').join('')}</div>`;
  } else if (tab === 'scenes') {
    const L = replayList();
    const total = L.reduce((a, g) => a + g.items.length, 0), got = L.reduce((a, g) => a + g.items.filter(([k]) => META.seen[k]).length, 0);
    body = `<p class="sub">본 장면 ${got}/${total} · 장면을 누르면 다시 볼 수 있어요</p>` + L.map((g, gi) => `<div class="rp-g"><h3 style="${g.c ? `color:${g.c}` : ''}">${g.g}</h3><div class="rp">${g.items.map(([k, label], ii) => META.seen[k]
      ? `<button class="btn" data-rp="${gi}:${ii}">▶ ${label}</button>` : '<button class="btn" disabled>？？？</button>').join('')}</div></div>`).join('');
  } else if (tab === 'endings') {
    const sec = (k) => CHARS[k] && CHARS[k].hidden && !META.met[k];
    body = `<div class="ends">${['normal', ...ORDER, 'solo', 'true', ...HIDDEN].map((k) => `<div class="end ${META.endings[k] ? 'got' : ''} ${sec(k) ? 'secret' : ''}" style="${CHARS[k] ? `--c:${CHARS[k].color}` : ''}">${sec(k) ? `<img src="${img(k, 'chibi')}" alt="">` : CHARS[k] ? `<img src="${img(k, META.endings[k] ? 'e1' : 'e0')}" alt="">` : `<span class="ei">${k === 'true' ? '✦' : k === 'solo' ? '🕯️' : '☆'}</span>`}<div><b>${sec(k) ? '??? · HIDDEN' : CHARS[k] ? CHARS[k].name : k === 'true' ? 'TRUE END' : k === 'solo' ? 'GROWTH END' : 'NORMAL END'}</b><small>${META.endings[k] ? END_TITLES[k] : '아직 보지 못한 결말'}</small>${!META.endings[k] && END_HINTS[k] ? `<em>힌트: ${END_HINTS[k]}</em>` : ''}</div></div>`).join('')}</div>`;
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
  const best = ALL.filter((id) => s.intro && s.intro[id]).sort((a, b) => s.aff[b] - s.aff[a])[0];
  const when = s.ts ? new Date(s.ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return `<b>${gradeWeek(s.day)}</b> · ${esc(s.name)}${best ? ` · <span style="color:${CHARS[best].color}">${CHARS[best].name} ♥${s.aff[best]}</span>` : ''}<small>${when}</small>`;
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
    <h3>캐릭터</h3><p class="sub">LUMINARIA: Eight Fates 캐릭터 시트. Real-ESRGAN(BSD-3-Clause)으로 고해상도화하고 isnet-anime로 배경을 분리했습니다.</p>
    <h3>아이콘</h3><p class="sub"><a href="https://lucide.dev" target="_blank" rel="noopener">Lucide</a> 선 아이콘 (ISC License)</p>`, true, () => settings());
}

$('#btnInv').onclick = inventory;
$('#btnGrow').onclick = growthMenu;
$('#btnSave').onclick = () => saveMenu('save');
$('#btnAlbum').onclick = () => album();
$('#btnSettings').onclick = settings;
$('#btnToTitle').onclick = () => { saveGame(); title(); };

/* ───── 타이틀 ───── */
let titleT = 0;
function title() {
  screen('title'); setBg('tower'); setTint(null);
  AUDIO.bgm('title'); FX.set('stars');
  // 히로인 스탠딩이 차례로 바뀐다 (보일 때 불러온다)
  const cast = ALL.filter((id) => !CHARS[id].hidden || META.met[id]); // 히든 히로인은 한 번 만나면 타이틀에도 나온다
  $('#titleArt').innerHTML = cast.map((id) => `<img data-src="${img(id, 'stand')}" alt="">`).join('') + '<div class="title-name"></div>';
  let i = rand(0, cast.length - 1);
  const show = () => {
    const ims = document.querySelectorAll('#titleArt img'), nm = $('#titleArt .title-name');
    if (!ims.length || document.body.dataset.screen !== 'title') return;
    for (const k of [i, (i + 1) % ims.length]) if (!ims[k].src) ims[k].src = ims[k].dataset.src;
    ims.forEach((m, j) => m.classList.toggle('on', j === i));
    if (nm) nm.textContent = CHARS[cast[i]].en;
    i = (i + 1) % ims.length;
  };
  clearInterval(titleT); show(); titleT = setInterval(show, 6000);
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
  saveGame(); hub();
};

// 정적 버튼의 이모지도 선 아이콘으로
for (const el of document.querySelectorAll('.sys-list .btn, #sCtl [data-c=menu]')) el.innerHTML = iconize(el.innerHTML);
title();
})();
