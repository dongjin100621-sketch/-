'use strict';
/* 본체: 화면 전환, 대본 실행, 저장·불러오기, 입력, 매 프레임 그리기 */

const App = (() => {
  const SAVE_KEY = 'dawn-save-', SET_KEY = 'dawn-settings';
  const MUSIC = { village: 'town', forest: 'field', sandport: 'town2', tomb: 'tomb', frostvale: 'town3', icecave: 'cave', mistcastle: 'town4', magetower: 'tower', dusktower: 'dusk' };
  let G = null, screen = 'title', scriptDepth = 0, transitioning = false, lastFrame = performance.now();
  const settings = { battleSpeed: 'normal', textSpeed: 'normal', music: 0.55, sfx: 0.8 };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };

  function loadSettings() {
    try { Object.assign(settings, JSON.parse(store.get(SET_KEY) || '{}')); } catch (e) { /* 기본값 */ }
    Sound.setVolume('music', settings.music); Sound.setVolume('sfx', settings.sfx);
  }
  function saveSettings() { settings.music = Sound.settings.music; settings.sfx = Sound.settings.sfx; store.set(SET_KEY, JSON.stringify(settings)); }

  /* ── 화면 ── */
  function setScreen(s) {
    screen = s;
    document.body.dataset.screen = s;
    if (s === 'field') { $('hudPlace').textContent = Field.map ? Field.map.name : ''; }
  }
  function fade(on) {
    return new Promise(res => {
      const f = $('fade');
      f.classList.toggle('on', on);
      setTimeout(res, on ? 320 : 280);
    });
  }
  const busy = () => scriptDepth > 0 || Modal.open || Dialog.active || transitioning;

  /* ── 새 게임 ── */
  function fresh() {
    return {
      v: 1, heroes: { rian: Party.create('rian', 1) }, front: ['rian', null, null, null], back: [null, null, null, null],
      items: { herb: 4, antidote: 1 }, gear: {}, gold: 150, flags: {}, unlocked: { village: true }, map: 'village', x: 13, y: 6, dir: 'down',
      inWorld: false, node: 'village', opened: {}, dex: {}, seen: {}, chapter: 0,
      stats: { battles: 0, wins: 0, breaks: 0, steps: 0, playMs: 0, maxDmg: 0 }
    };
  }
  async function newGame() {
    G = fresh();
    await fade(true);
    World.at = 'village';
    Field.load('village', G.x, G.y, G.dir);
    setScreen('field');
    await fade(false);
    await runScript('intro');
    Sound.play(MUSIC.village);
  }

  /* ── 조건 ('a&b', '!a') ── */
  function cond(expr) {
    if (!expr) return true;
    if (!G) return false;
    return expr.split('&').every(t => t.startsWith('!') ? !G.flags[t.slice(1)] : !!G.flags[t]);
  }

  /* ── 일행 합류 ── */
  function join(id) {
    if (G.heroes[id]) return;
    const h = Party.create(id);
    const ids = Object.keys(G.heroes);
    const avg = Math.round(ids.reduce((a, k) => a + G.heroes[k].lv, 0) / ids.length);
    Party.setLevel(h, Math.max(HEROES[id].joinLv, avg));
    h.latent = 0;
    G.heroes[id] = h;
    let i = G.front.indexOf(null);
    if (i >= 0) G.front[i] = id; else { i = G.back.indexOf(null); if (i >= 0) G.back[i] = id; }
    G.flags['j_' + id] = true;
    Sound.sfx('levelup');
    Field.refreshNpcs();
  }
  function healAll() {
    for (const h of Object.values(G.heroes)) Party.healFull(h);
  }

  /* ── 대본 실행 ── */
  async function runScript(idOrSteps) {
    const steps = typeof idOrSteps === 'string' ? SCRIPTS[idOrSteps] : idOrSteps;
    if (!steps) return;
    scriptDepth++;
    Field.setHeld(null);
    try { await runSteps(steps); }
    finally {
      scriptDepth--;
      Field.refreshNpcs();
      if (scriptDepth === 0 && screen === 'field') autosave();
    }
  }
  async function runSteps(steps) {
    for (const s of steps) {
      const [op, a, b, c] = s;
      switch (op) {
        case 'say': await Dialog.say(a, b); break;
        case 'narr': await Dialog.say(null, a); break;
        case 'join': join(a); break;
        case 'flag': G.flags[a] = b === undefined ? true : b; break;
        case 'if': if (await runSteps(cond(a) ? b : (c || [])) === 'abort') return 'abort'; break;
        case 'battle': { const ok = await battle(a, b || {}); if (!ok) return 'abort'; break; }
        case 'ring': await ringBell(a); break;
        case 'unlock': G.unlocked[a] = true; break;
        case 'chapter': G.chapter = a; await chapter(b, c); break;
        case 'heal': healAll(); Sound.sfx('heal'); break;
        case 'gold': G.gold += a; Sound.sfx('buy'); break;
        case 'item': G.items[a] = (G.items[a] || 0) + (b || 1); break;
        case 'tip': await tip(a); break;
        case 'push': Field.pushBack(); break;
        case 'shake': document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); Sound.sfx('roar'); await wait(500); break;
        case 'music': Sound.play(a || null); break;
        case 'ending': await ending(); return 'abort';
      }
    }
  }
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  /* ── 전투 ── */
  async function battle(formation, o = {}) {
    const snapshot = JSON.stringify(G);
    const ret = screen;
    for (;;) {
      transitioning = true;
      Sound.sfx('encounter');
      document.body.classList.add('swirl');
      await wait(420);
      document.body.classList.remove('swirl');
      const ids = FORMATIONS[formation];
      for (const id of ids) G.seen[id] = true;
      const engine = Battle.create(G, ids, { noEscape: !!(o.boss || o.tutorial) });
      setScreen('battle');
      transitioning = false;
      Sound.play(o.final ? 'final' : o.boss ? 'boss' : 'battle');
      const region = REGION_OF_MAP[Field.mapId];
      const map = Field.map || {};
      const result = await BattleView.start(engine, { bg: map.bg || 'plains', dawn: region < 5 && !!G.flags['bell' + region], tutorial: !!o.tutorial, boss: !!o.boss });
      engine.sync();
      G.stats.battles++;
      G.stats.maxDmg = Math.max(G.stats.maxDmg || 0, engine.log.maxDmg);
      if (result === 'retry') { G = JSON.parse(snapshot); continue; }
      if (result === 'load') { loadLatest(); return false; }
      if (result === 'title') { toTitle(); return false; }
      if (result === 'win') G.stats.wins++;
      await fade(true);
      setScreen(ret === 'battle' ? 'field' : ret);
      Sound.play(MUSIC[Field.mapId] || 'town');
      await fade(false);
      if (result === 'win' && scriptDepth === 0) autosave();
      return true;
    }
  }
  async function encounter(formation) {
    if (busy()) return;
    scriptDepth++;
    try { await battle(formation, {}); } finally { scriptDepth--; }
  }

  /* ── 종 울리기 ── */
  async function ringBell(n) {
    G.flags['bell' + n] = true;
    const names = { 1: '숲의 종', 2: '모래의 종', 3: '서리의 종', 4: '안개의 종' };
    Sound.play(null);
    Sound.sfx('bell');
    const r = $('ring');
    r.innerHTML = `<div><img src="${Gfx.icon('bell', 96)}" alt=""><b>${names[n]}이 울렸다!</b><small>멈췄던 시간이 조금씩 흐르기 시작한다…</small></div>`;
    r.hidden = false; r.classList.remove('show'); void r.offsetWidth; r.classList.add('show');
    await wait(3600);
    r.hidden = true;
    Field.buildLayers();
    Sound.play(MUSIC[Field.mapId] || 'town');
  }

  /* ── 장 제목 ── */
  function chapter(title, sub) {
    return new Promise(res => {
      const c = $('chapter');
      c.innerHTML = `<div><small>${title}</small><b>${sub}</b></div>`;
      c.hidden = false; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
      Sound.sfx('smallbell');
      let done = false;
      const end = () => { if (done) return; done = true; c.hidden = true; c.removeEventListener('click', end); res(); };
      c.addEventListener('click', end);
      setTimeout(end, 2800);
    });
  }

  /* ── 안내 (한 번만) ── */
  function tip(key, inBattle = false) {
    if (!TIPS[key] || (G && G.flags['tip:' + key])) return Promise.resolve();
    if (G) G.flags['tip:' + key] = true;
    return new Promise(res => {
      const [title, text] = TIPS[key];
      const t = $('tip');
      t.innerHTML = `<div class="tipbox"><b>${title}</b><p>${text}</p><button class="btn small gold">알겠어요</button></div>`;
      t.hidden = false;
      const btn = t.querySelector('button');
      const close = () => { t.hidden = true; document.removeEventListener('keydown', onKey, true); Sound.sfx('ok'); res(); };
      const onKey = (e) => { if (['Enter', ' ', 'z', 'Z', 'Escape', 'x', 'X'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); close(); } };
      btn.addEventListener('click', close);
      document.addEventListener('keydown', onKey, true);
    });
  }

  /* ── 필드에서 일어나는 일 ── */
  async function say(who, text) { scriptDepth++; try { await Dialog.say(who, text); } finally { scriptDepth--; } }
  async function door(d) {
    Sound.sfx('door');
    if (d.kind === 'inn') return inn(d.price);
    if (d.kind === 'shop') { Shop.open(d.shop, d.label); return; }
    if (d.kind === 'house') return say(null, d.text);
    if (d.kind === 'event') return runScript(d.script);
  }
  async function inn(price) {
    scriptDepth++;
    try {
      const r = await Dialog.choice(null, `어서 오세요! 하룻밤 묵으면 모두 기운을 되찾아요. 한 사람도 빠짐없이 ${price} G입니다.`, [`묵는다 (${price} G)`, '그만둔다']);
      if (r !== 0) return;
      if (G.gold < price) { await Dialog.say(null, '돈이 모자란다…'); return; }
      G.gold -= price;
      await fade(true);
      Sound.sfx('inn');
      healAll();
      await wait(1300);
      await fade(false);
      await Dialog.say(null, '푹 쉬었다. HP와 SP가 모두 회복되었다!');
      autosave();
    } finally { scriptDepth--; }
  }
  async function openChest(c) {
    G.opened[c.id] = true;
    Sound.sfx('chest');
    let text;
    if (c.item) { G.items[c.item] = (G.items[c.item] || 0) + (c.n || 1); text = `${ITEMS[c.item].name}${c.n > 1 ? ' ×' + c.n : ''}${josa(ITEMS[c.item].name, '을', '를')} 얻었다!`; }
    else if (c.gear) { G.gear[c.gear] = (G.gear[c.gear] || 0) + 1; text = `${EQUIP[c.gear].name}${josa(EQUIP[c.gear].name, '을', '를')} 얻었다! (메뉴 → 장비)`; }
    else { G.gold += c.gold; text = `${c.gold} G를 얻었다!`; }
    await say(null, text);
  }
  async function crystal() {
    scriptDepth++;
    try {
      healAll();
      Sound.sfx('revive');
      await Dialog.say(null, '수정의 빛이 일행을 감쌌다. HP와 SP가 모두 회복되었다.');
      const r = await Dialog.choice(null, '여기서 저장할까요?', ['저장한다', '그만둔다']);
      if (r === 0) Menu.open('save');
    } finally { scriptDepth--; }
  }
  async function leaveMap(ex) {
    if (ex.to === 'world') return toWorld();
  }
  async function toWorld() {
    transitioning = true;
    await fade(true);
    G.inWorld = true;
    const node = Object.keys(WORLD).find(k => WORLD[k].map === Field.mapId) || 'village';
    G.node = node;
    World.open(node);
    setScreen('world');
    Sound.play('world');
    await fade(false);
    transitioning = false;
    autosave();
  }
  async function enterNode(id) {
    const w = WORLD[id];
    const m = MAPS[w.map];
    transitioning = true;
    await fade(true);
    G.inWorld = false; G.node = id;
    Field.load(w.map, m.entry.x, m.entry.y, m.entry.dir);
    setScreen('field');
    Sound.play(MUSIC[w.map]);
    await fade(false);
    transitioning = false;
    autosave();
    // 들어서자마자 밟는 사건(장 제목 등)
    const ev = m.events.find(e => !e.check && e.x === m.entry.x && e.y === m.entry.y && e.once && !G.flags['done:' + e.script] && (!e.unless || !cond(e.unless)));
    if (ev) { G.flags['done:' + ev.script] = true; runScript(ev.script); }
  }

  /* ── 저장 ── */
  function capture() {
    if (screen === 'field' || G.inWorld === false) {
      const p = Field.pos;
      if (Field.mapId) { G.map = Field.mapId; G.x = p.x; G.y = p.y; G.dir = p.dir; }
    }
    return G;
  }
  const canSave = () => G && (screen === 'field' || screen === 'world') && scriptDepth === 0;
  function save(slot) {
    if (!G) return false;
    capture();
    const lv = Math.max(...Object.values(G.heroes).map(h => h.lv));
    const place = G.inWorld ? '세계 지도' : (MAPS[G.map] ? MAPS[G.map].name : '');
    const ch = ['서장', '제1장', '제2장', '제3장', '제4장', '최종장'][G.chapter] || '서장';
    const meta = { chapter: ch, place, lv, time: playTime(), when: new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) };
    return store.set(SAVE_KEY + slot, JSON.stringify({ meta, G }));
  }
  function autosave() { if (G && (screen === 'field' || screen === 'world')) save('auto'); }
  function slotInfo(slot) {
    try { const d = JSON.parse(store.get(SAVE_KEY + slot) || 'null'); return d && d.meta; } catch (e) { return null; }
  }
  function playTime() {
    const s = Math.floor((G.stats.playMs || 0) / 1000);
    return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
  }
  async function load(slot) {
    let d;
    try { d = JSON.parse(store.get(SAVE_KEY + slot) || 'null'); } catch (e) { d = null; }
    if (!d || !d.G) return false;
    G = d.G;
    G.seen = G.seen || {}; G.dex = G.dex || {}; G.opened = G.opened || {};
    Modal.hide();
    await fade(true);
    if (G.inWorld) {
      World.open(G.node || 'village');
      Field.load(G.map, G.x, G.y, G.dir);
      setScreen('world'); Sound.play('world');
    } else {
      World.at = G.node || 'village';
      Field.load(G.map, G.x, G.y, G.dir);
      setScreen('field'); Sound.play(MUSIC[G.map]);
    }
    await fade(false);
    return true;
  }
  function latestSlot() {
    let best = null, bt = -1;
    for (const s of ['auto', 1, 2, 3]) {
      try {
        const raw = store.get(SAVE_KEY + s);
        if (!raw) continue;
        const d = JSON.parse(raw);
        const t = d.G.stats.playMs || 0;
        if (t > bt) { bt = t; best = s; }
      } catch (e) { /* 깨진 기록은 건너뜀 */ }
    }
    return best;
  }
  function loadLatest() { const s = latestSlot(); if (s) load(s); else toTitle(); }

  /* ── 타이틀 ── */
  function toTitle() {
    Modal.hide();
    G = null;
    setScreen('title');
    Sound.play('title');
    refreshTitle();
  }
  function refreshTitle() {
    $('btnContinue').hidden = !latestSlot();
    const cleared = store.get('dawn-cleared');
    $('records').textContent = cleared ? `엔딩을 본 기록: ${cleared}` : '';
  }

  /* ── 엔딩 ── */
  async function ending() {
    store.set('dawn-cleared', new Date().toLocaleDateString('ko-KR'));
    await fade(true);
    setScreen('ending');
    endT = 0;
    await fade(false);
    await runSteps(SCRIPTS.ending);
    const box = $('endBox');
    const s = G.stats;
    const t = Math.floor((s.playMs || 0) / 1000);
    box.innerHTML = `<div class="credits">
      <h2>여명의 종</h2><p class="sub">BELLS OF DAWN</p>
      ${EPILOGUE.map(([id, text]) => `<div class="ep"><img src="${Gfx.icon(HEROES[id] ? HEROES[id].spr : 'nocte', 40, 'f')}" alt=""><div><b>${HEROES[id] ? HEROES[id].name : '노크테'}</b><p>${text}</p></div></div>`).join('')}
      <div class="stat"><span>플레이 시간 ${Math.floor(t / 3600)}시간 ${Math.floor(t / 60) % 60}분</span><span>전투 ${s.battles}회 · 브레이크 ${s.breaks}회</span><span>최대 피해 ${(s.maxDmg || 0).toLocaleString()}</span></div>
      <p class="fin">— 끝 —</p><p class="thanks">플레이해 주셔서 고맙습니다.</p>
      <button class="btn gold" id="endTitle">타이틀로</button></div>`;
    box.hidden = false;
    box.scrollTop = 0;
    $('endTitle').addEventListener('click', () => { box.hidden = true; save('auto'); toTitle(); });
  }

  /* ── 입력 ── */
  const KEYDIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  let keyHeld = null;
  function onKeyDown(e) {
    Sound.unlock();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!$('tip').hidden) return;
    let used = false;
    if (Dialog.active) used = Dialog.key(e);
    else if (Modal.open) used = Menu.key(e);
    else if (screen === 'battle') used = BattleView.key(e);
    else if (screen === 'field') {
      if (KEYDIR[e.key]) { keyHeld = KEYDIR[e.key]; if (!busy()) Field.setHeld(keyHeld); used = true; }
      else if (['z', 'Z', 'Enter', ' '].includes(e.key)) { if (!busy() && !e.repeat) Field.interact(); used = true; }
      else if (['x', 'X', 'Escape', 'm', 'M'].includes(e.key)) { if (!busy()) openMenu(); used = true; }
    } else if (screen === 'world') {
      if (['x', 'X', 'Escape', 'm', 'M'].includes(e.key)) { if (!busy()) openMenu(); used = true; }
      else if (!busy()) used = World.key(e);
    } else if (screen === 'title') {
      if (['Enter', ' ', 'z', 'Z'].includes(e.key)) { ($('btnContinue').hidden ? $('btnNew') : $('btnContinue')).click(); used = true; }
    }
    if (used) e.preventDefault();
  }
  function onKeyUp(e) {
    if (KEYDIR[e.key] && KEYDIR[e.key] === keyHeld) { keyHeld = null; Field.setHeld(null); }
  }
  function openMenu() { Sound.sfx('ok'); Field.setHeld(null); Menu.open(); }
  function onMenuClosed() { Field.setHeld(null); }

  /* 터치 십자 버튼 */
  function bindPad() {
    let padDir = null;
    const pad = $('dpad');
    const set = (d) => { padDir = d; Field.setHeld(busy() ? null : d); };
    pad.querySelectorAll('[data-dir]').forEach(b => {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); Sound.unlock(); b.setPointerCapture && b.setPointerCapture(e.pointerId); set(b.dataset.dir); });
      const up = () => { if (padDir === b.dataset.dir) set(null); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    });
    $('btnAct').addEventListener('click', () => { Sound.unlock(); if (!busy()) Field.interact(); });
    $('btnMenu').addEventListener('click', () => { Sound.unlock(); if (!busy()) openMenu(); });
    $('btnWMenu').addEventListener('click', () => { Sound.unlock(); if (!busy()) openMenu(); });
    $('fcv').addEventListener('click', (e) => { Sound.unlock(); if (!busy()) Field.tap(e.clientX, e.clientY); });
  }

  /* ── 타이틀 그림 ── */
  let titleT = 0, endT = 0;
  function drawTitle(cvId, dt, dawn) {
    const cv = $(cvId);
    const f = Gfx.fit(cv);
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const W = 192, H = 108;
    if (!drawTitle.buf) { drawTitle.buf = document.createElement('canvas'); drawTitle.buf.width = W; drawTitle.buf.height = H; }
    const b = drawTitle.buf.getContext('2d');
    const t = (dawn ? endT : titleT);
    const sky = b.createLinearGradient(0, 0, 0, H * 0.75);
    if (dawn) { sky.addColorStop(0, '#5fa8e0'); sky.addColorStop(0.6, '#f8d8a8'); sky.addColorStop(1, '#ffe8b8'); }
    else { sky.addColorStop(0, '#1d1438'); sky.addColorStop(0.55, '#7a3a6a'); sky.addColorStop(1, '#f28a4e'); }
    b.fillStyle = sky; b.fillRect(0, 0, W, H);
    // 별
    if (!dawn) for (let i = 0; i < 40; i++) { const x = (i * 53) % W, y = (i * 29) % 46; if ((Math.floor(t / 500) + i) % 7) { b.fillStyle = i % 3 ? '#fff4b0' : '#c7c2d8'; b.fillRect(x, y, 1, 1); } }
    // 해
    const sy = dawn ? 60 - Math.min(18, t / 400) : 78;
    for (let r = 22; r > 0; r -= 3) { b.fillStyle = `rgba(255,${dawn ? 230 : 170},${dawn ? 160 : 90},${0.08})`; b.beginPath(); b.arc(140, sy, r + 6, 0, 7); b.fill(); }
    b.fillStyle = dawn ? '#fff4c8' : '#ffb060'; b.beginPath(); b.arc(140, sy, 11, 0, 7); b.fill();
    // 산
    b.fillStyle = dawn ? '#6a8aa8' : '#3a2448';
    b.beginPath(); b.moveTo(0, 80);
    for (let x = 0; x <= W; x += 6) b.lineTo(x, 74 - 8 * Math.abs(Math.sin(x / 23)) - 4 * Math.sin(x / 7));
    b.lineTo(W, H); b.lineTo(0, H); b.fill();
    b.fillStyle = dawn ? '#4f7a4a' : '#24182e'; b.fillRect(0, 84, W, H - 84);
    // 종탑
    b.fillStyle = dawn ? '#3a4a5a' : '#120c1c';
    b.fillRect(40, 30, 22, 56); b.fillRect(36, 26, 30, 6);
    b.beginPath(); b.moveTo(34, 26); b.lineTo(51, 10); b.lineTo(68, 26); b.fill();
    b.fillStyle = dawn ? '#7a8a9a' : '#2a1e38'; b.fillRect(45, 34, 12, 14);
    const sw = Math.sin(t / (dawn ? 300 : 900)) * (dawn ? 2 : 0.6);
    const bell = Gfx.sprite('bell');
    b.save(); b.translate(51, 36); b.rotate(sw * 0.08); b.drawImage(bell, -6, -2, 12, 12); b.restore();
    // 집들
    for (const [x, w, h] of [[8, 16, 12], [74, 18, 14], [100, 14, 10], [160, 20, 13], [180, 14, 9]]) {
      b.fillStyle = dawn ? '#5a4a3a' : '#1a1226'; b.fillRect(x, 86 - h, w, h);
      b.beginPath(); b.moveTo(x - 2, 86 - h); b.lineTo(x + w / 2, 80 - h); b.lineTo(x + w + 2, 86 - h); b.fill();
      b.fillStyle = dawn ? '#f8e0a0' : '#ffd060'; if (!dawn || (x % 3)) b.fillRect(x + 4, 89 - h, 2, 2);
    }
    // 불티
    for (let i = 0; i < 18; i++) {
      const x = (i * 37 + t / 40) % W, y = H - ((i * 23 + t / 25) % H);
      b.fillStyle = dawn ? 'rgba(255,255,255,.7)' : 'rgba(255,200,120,.8)';
      b.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
    const k = Math.max(f.W / W, f.H / H);
    g.fillStyle = '#07060c'; g.fillRect(0, 0, f.W, f.H);
    g.drawImage(drawTitle.buf, (f.W - W * k) / 2, (f.H - H * k) / 2, W * k, H * k);
  }

  /* ── 매 프레임 ── */
  function frame(now) {
    const dt = Math.min(50, now - lastFrame); lastFrame = now;
    if (G && screen !== 'title' && !document.hidden) G.stats.playMs = (G.stats.playMs || 0) + dt;
    if (screen === 'field') { Field.update(dt, busy()); Field.render(); }
    else if (screen === 'world') World.render();
    else if (screen === 'title') { titleT += dt; drawTitle('titleArt', dt, false); }
    else if (screen === 'ending') { endT += dt; drawTitle('endArt', dt, true); }
    requestAnimationFrame(frame);
  }

  function boot() {
    loadSettings();
    Field.init($('fcv'));
    World.init($('wcv'));
    bindPad();
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => { keyHeld = null; Field.setHeld(null); });
    document.addEventListener('pointerdown', () => Sound.unlock(), { capture: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) Sound.suspend(); else Sound.resume(); });
    $('btnNew').addEventListener('click', async () => {
      Sound.unlock();
      if (latestSlot()) {
        const r = await Dialog.choice(null, '새로 시작할까요? 저장된 기록은 그대로 남습니다.', ['새로 시작', '그만둔다']);
        if (r !== 0) return;
      }
      newGame();
    });
    $('btnContinue').addEventListener('click', () => { Sound.unlock(); loadLatest(); });
    $('btnLoadT').addEventListener('click', () => { Sound.unlock(); G = G || fresh(); Menu.open('save'); });
    $('btnHelpT').addEventListener('click', () => {
      Sound.unlock();
      Modal.show(`<div class="mhead"><b>전투 방법</b><button class="icon-btn close" id="hClose" aria-label="닫기">✕</button></div><div class="mbody help">
        ${['battle1', 'battle2', 'battle3', 'battle4', 'formation', 'move', 'crystal'].map(k => `<h4>${TIPS[k][0]}</h4><p>${TIPS[k][1]}</p>`).join('')}</div>`, 'menu');
      $('hClose').addEventListener('click', () => Modal.hide());
    });
    setScreen('title');
    refreshTitle();
    Sound.play('title');
    requestAnimationFrame(frame);
  }

  return {
    get G() { return G; }, set G(v) { G = v; },
    settings, saveSettings, cond, busy, runScript, encounter, say, door, openChest, crystal, leaveMap, enterNode,
    save, load, slotInfo, canSave, toTitle, tip, onMenuClosed, boot, setScreen,
    currentMusic: () => MUSIC[Field.mapId] || 'town'
  };
})();

document.addEventListener('DOMContentLoaded', App.boot);
