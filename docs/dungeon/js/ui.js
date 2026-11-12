'use strict';
/* 화면 흐름과 조작: 타이틀, HUD, 입력(키보드·십자 버튼·화면 탭), 자동 탐험·휴식, 창(가방·상점·지도·메뉴), 저장. */

const UI = (() => {
  const $ = (s) => document.querySelector(s);
  const KEY = { save: 'ember-save-v1', check: 'ember-check-v1', rec: 'ember-records-v1', snd: 'ember-sound-v1' };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* 저장소 없음 */ } }
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let screen = 'title';
  let dirty = true;
  let auto = null;           // 자동 행동 {mode, ...}
  let held = null, heldSince = 0, heldKey = null;
  let buffered = null;
  let modal = null;
  let lastSavedTurn = 0, lastFrame = 0;
  let selected = null;       // 가방에서 고른 칸
  let shopTab = 'buy';
  const logTimes = [];

  /* ── 시작 ── */
  function boot() {
    try { Object.assign(Sound.settings, JSON.parse(store.get(KEY.snd) || '{}')); } catch { /* 기본값 */ }
    Sound.setVolume('music', Sound.settings.music);
    Render.init($('#cv'));
    Game.on(onGameEvent);
    buildControls();
    bindInput();
    showTitle();
    requestAnimationFrame(loop);
    window.addEventListener('resize', () => { Render.resize(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { saveNow(); Sound.suspend(); } else Sound.resume();
    });
    window.addEventListener('pagehide', saveNow);
    setInterval(fadeLog, 1000);
  }

  function setScreen(s) {
    screen = s;
    document.body.dataset.screen = s;
    if (s === 'game') requestAnimationFrame(() => Render.resize());
  }

  /* ── 타이틀 ── */
  function showTitle() {
    closeModal();
    setScreen('title');
    Sound.play('title');
    const raw = store.get(KEY.save);
    const btn = $('#btnContinue');
    btn.hidden = !raw;
    if (raw) {
      try {
        const d = JSON.parse(raw);
        btn.textContent = `이어하기 · B${d.depth} LV ${d.player.lv}` + (d.over ? ' (다시 도전)' : '');
      } catch { btn.hidden = true; }
    }
    const rec = records();
    $('#records').textContent = rec.clears
      ? `클리어 ${rec.clears}회 · 최단 ${rec.bestTurns}턴 · 최소 쓰러짐 ${rec.bestDeaths}회`
      : rec.best ? `최고 기록: 지하 ${rec.best}층` : '';
  }
  function records() { try { return JSON.parse(store.get(KEY.rec) || '{}'); } catch { return {}; } }
  function saveRecords(r) { store.set(KEY.rec, JSON.stringify(r)); }

  function newGame() {
    Game.newGame();
    lastSavedTurn = 0;
    store.set(KEY.check, Game.serialize());
    saveNow();
    setScreen('game');
    auto = null;
    openModal('intro', `
      <h2>심연의 불씨</h2>
      ${STORY.intro.map(t => `<p>${esc(t)}</p>`).join('')}
      <p class="muted" style="margin-top:14px">지하 10층 심연의 옥좌에서 첫 불씨를 되찾으면 승리합니다. 5층과 10층에는 층의 주인이 기다립니다.</p>
      <div class="row"><button class="btn gold" data-close>던전으로</button><button class="btn" id="mHelp">조작법</button></div>`,
    () => { $('#mHelp').onclick = () => openHelp(); });
    showCard();
    music();
  }

  function continueGame() {
    const raw = store.get(KEY.save);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.over) { retry(); return; }
      Game.load(raw);
    } catch (e) {
      console.error(e);
      openModal('err', `<h2>불러오기 실패</h2><p>저장된 기록을 읽지 못했습니다.</p><div class="row"><button class="btn" data-close>닫기</button></div>`);
      return;
    }
    lastSavedTurn = Game.S.turn;
    setScreen('game');
    auto = null;
    dirty = true;
    showCard();
    music();
  }

  function saveNow() {
    if (screen !== 'game' || !Game.S || Game.S.won) return;
    if (Game.S.over) return;
    store.set(KEY.save, Game.serialize());
    lastSavedTurn = Game.S.turn;
  }

  /* 쓰러진 뒤: 이 층에 처음 내려온 순간으로 */
  function retry() {
    const raw = store.get(KEY.check);
    if (!raw) { showTitle(); return; }
    let deaths = 0, playMs = 0;
    try { const s = JSON.parse(store.get(KEY.save) || raw); deaths = s.stats.deaths; playMs = s.stats.playMs; } catch { /* 처음 */ }
    Game.load(raw);
    Game.S.stats.deaths = Math.max(deaths, Game.S.stats.deaths);
    Game.S.stats.playMs = Math.max(playMs, Game.S.stats.playMs);
    store.set(KEY.check, Game.serialize());
    closeModal();
    setScreen('game');
    auto = null;
    saveNow();
    dirty = true;
    showCard();
    music();
    Game.msg('이 층에 처음 내려온 순간으로 돌아왔다. 다시 도전!', 'info');
  }

  /* ── 음악 ── */
  function music() {
    if (screen !== 'game') return;
    const S = Game.S, f = S.floor;
    if (S.over) return;
    if (f.boss && f.bossAwake && !f.bossDead) Sound.play('boss');
    else Sound.play(THEMES[f.theme].bgm);
  }

  /* ── 게임 사건 → 소리·HUD·창 ── */
  function onGameEvent(type, d) {
    dirty = true;
    const S = Game.S;
    const dl = { delay: d.delay || 0 };
    switch (type) {
      case 'msg': pushLog(d.text, d.cls); break;
      case 'attack': if (d.who.uid === 'p') Sound.sfx('swing', dl); break;
      case 'hit':
        if (d.target.uid === 'p') { if (d.kind !== 'poison') Sound.sfx('hurt', dl); stopAuto(); }
        else Sound.sfx(d.crit ? 'crit' : MONSTERS[d.target.id]?.sfx || 'hit', dl);
        break;
      case 'miss': Sound.sfx('miss', dl); break;
      case 'die': Sound.sfx('kill', dl); break;
      case 'proj': Sound.sfx(d.spr === 'arrow' ? 'arrow' : 'fire', dl); break;
      case 'door': if (!d.quiet) Sound.sfx('door', dl); break;
      case 'chest': Sound.sfx('chest'); break;
      case 'pickup': Sound.sfx('pickup'); break;
      case 'gold': Sound.sfx('gold', dl); break;
      case 'heal': Sound.sfx('heal', dl); break;
      case 'mana': Sound.sfx('drink'); break;
      case 'levelup': Sound.sfx('levelup', { delay: (d.delay || 0) + 150 }); if (d.skill) setTimeout(() => toastLevel(d), 300); break;
      case 'trap': Sound.sfx('trap'); stopAuto(); break;
      case 'trapFound': Sound.sfx('wake'); stopAuto(); break;
      case 'teleport': Sound.sfx('teleport'); stopAuto(); break;
      case 'whirl': Sound.sfx('whirl'); break;
      case 'bolt': Sound.sfx('bolt', dl); break;
      case 'firestorm': case 'nova': Sound.sfx('boom'); break;
      case 'summon': Sound.sfx('summon'); break;
      case 'wake': if (Game.isVisible(d.m.x, d.m.y)) Sound.sfx('wake'); break;
      case 'reveal': Sound.sfx('roar'); stopAuto(); break;
      case 'enrage': Sound.sfx('roar'); break;
      case 'boss': Sound.sfx('roar'); stopAuto(); Sound.play('boss'); break;
      case 'bossdead': Sound.sfx('boom', dl); Sound.play('victory', THEMES[S.floor.theme].bgm); break;
      case 'death': Sound.sfx('death'); Sound.play('death'); stopAuto(); setTimeout(onDeath, 1100); break;
      case 'win': stopAuto(); Sound.play('victory', 'title'); setTimeout(onWin, 1600); break;
      case 'descend': Sound.sfx('stairs'); break;
      case 'floor':
        setTimeout(() => {
          if (screen !== 'game') return;
          store.set(KEY.check, Game.serialize());
          saveNow();
          showCard();
          music();
          const r = records();
          if (!r.best || Game.S.depth > r.best) { r.best = Game.S.depth; saveRecords(r); }
        }, 0);
        stopAuto();
        break;
      case 'shop': stopAuto(); openShop(); break;
      case 'equip': Sound.sfx('equip'); break;
      case 'buy': Sound.sfx('buy'); break;
      case 'enchant': case 'buff': Sound.sfx('enchant'); break;
      case 'fail': Sound.sfx('error'); break;
      case 'skill': if (d.id === 'heal') Sound.sfx('heal'); break;
      case 'stairs': if (auto && auto.mode !== 'explore') stopAuto(); break;
    }
  }

  /* ── 메시지 기록 ── */
  function pushLog(text, cls) {
    const box = $('#log');
    const p = document.createElement('p');
    p.textContent = text;
    if (cls) p.className = 'c-' + cls;
    box.appendChild(p);
    logTimes.push([p, performance.now()]);
    while (box.children.length > 5) { box.removeChild(box.firstChild); logTimes.shift(); }
    [...box.children].forEach((el, i, all) => el.classList.toggle('old', i < all.length - 2));
  }
  function fadeLog() {
    const now = performance.now();
    for (const [p, t] of logTimes) p.classList.toggle('gone', now - t > 9000);
  }

  function showCard() {
    const S = Game.S, c = $('#card');
    c.innerHTML = `<small>지하 ${S.depth}층</small>${esc(THEMES[S.floor.theme].name)}`;
    c.classList.remove('show');
    void c.offsetWidth;
    c.classList.add('show');
    $('#log').innerHTML = '';
    logTimes.length = 0;
    for (const l of S.log.slice(-3)) pushLog(l.text, l.cls);
  }

  function toastLevel(d) {
    const c = $('#card');
    c.innerHTML = `<small>새 기술 · ${SKILLS.indexOf(d.skill) + 1}번</small>「${esc(d.skill.name)}」<br><span style="font-size:11px;color:var(--dim);font-weight:400">${esc(d.skill.desc)}</span>`;
    c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  }

  /* ── HUD ── */
  function updateHud() {
    const S = Game.S;
    if (!S) return;
    const p = S.player, st = Game.stats(), f = S.floor;
    $('#hudFloor').textContent = `B${S.depth} ${THEMES[f.theme].name}`;
    $('#hudLv').textContent = `LV ${p.lv}`;
    $('#hudAtk').textContent = `공 ${st.atk}`;
    $('#hudDef').textContent = `방 ${st.def}`;
    $('#hudGold').textContent = p.gold;
    const hp = $('#barHp');
    hp.querySelector('i').style.width = (100 * p.hp / st.mhp) + '%';
    hp.querySelector('b').style.width = (100 * p.hp / st.mhp) + '%';
    hp.querySelector('span').textContent = `${p.hp} / ${st.mhp}`;
    hp.classList.toggle('low', p.hp < st.mhp * 0.3);
    hp.classList.toggle('poison', p.poison > 0);
    const mp = $('#barMp');
    mp.querySelector('i').style.width = (100 * p.mp / st.mmp) + '%';
    mp.querySelector('span').textContent = `${p.mp} / ${st.mmp}`;
    $('#barXp i').style.width = (100 * p.exp / Game.expToNext(p.lv)) + '%';
    $('#hudStatus').innerHTML = (p.poison ? `<i class="poison">독 ${p.poison}</i>` : '') + (p.power ? `<i class="power">힘 ${p.power}</i>` : '');
    SKILLS.forEach((sk, i) => {
      const b = document.querySelector(`.skill[data-i="${i}"]`);
      b.classList.toggle('locked', p.lv < sk.lv);
      b.classList.toggle('nomp', p.lv >= sk.lv && p.mp < sk.mp);
      b.querySelector('.cost').textContent = p.lv < sk.lv ? `LV${sk.lv}` : sk.mp;
    });
    $('#btnStairs').hidden = !(Game.tileAt(p.x, p.y) === T.STAIRS && !S.over);
    const boss = f.boss && f.bossAwake && !f.bossDead ? f.monsters.find(m => m.boss) : null;
    $('#bossBar').hidden = !boss;
    if (boss) {
      $('#bossName').textContent = MONSTERS[boss.id].name + (boss.phase2 ? ' · 분노' : '');
      $('#bossBar i').style.width = (100 * boss.hp / boss.mhp) + '%';
    }
    $('#btnExplore').classList.toggle('on', auto?.mode === 'explore');
    $('#btnRest').classList.toggle('on', auto?.mode === 'rest');
  }

  /* ── 조작판 ── */
  function buildControls() {
    $('#skills').innerHTML = SKILLS.map((sk, i) =>
      `<button class="skill" data-i="${i}" data-name="${esc(sk.name)} · 마나 ${sk.mp}" aria-label="${esc(sk.name)}"><span class="key">${i + 1}</span><img src="${Render.icon(sk.icon, 32)}" alt=""><span class="cost"></span></button>`).join('');
    const icons = { btnBag: 'chest', btnExplore: 'scroll', btnRest: 'potion', btnMap: 'scroll_blue' };
    for (const [id, spr] of Object.entries(icons)) $('#' + id + ' img').src = Render.icon(spr, 32);
  }

  function bindInput() {
    $('#btnNew').onclick = () => {
      Sound.unlock();
      if (store.get(KEY.save)) {
        openModal('confirm', `<h2>새 모험</h2><p>이어하던 기록이 지워집니다. 새로 시작할까요?</p>
          <div class="row"><button class="btn red" id="mYes">새로 시작</button><button class="btn" data-close>그만두기</button></div>`,
        () => { $('#mYes').onclick = () => { closeModal(); newGame(); }; });
      } else newGame();
    };
    $('#btnContinue').onclick = () => { Sound.unlock(); continueGame(); };
    $('#btnHelpT').onclick = () => { Sound.unlock(); openHelp(); };
    $('#btnSoundT').onclick = () => { Sound.unlock(); openSound(); };
    $('#btnMenu').onclick = () => openMenu();
    $('#btnBag').onclick = () => { stopAuto(); openBag(); };
    $('#btnMap').onclick = () => { stopAuto(); openMap(); };
    $('#btnExplore').onclick = () => toggleAuto('explore');
    $('#btnRest').onclick = () => toggleAuto('rest');
    $('#btnStairs').onclick = () => queueAction({ type: 'descend' });
    $('#log').onclick = () => openLog();
    $('#skills').addEventListener('click', (e) => {
      const b = e.target.closest('.skill');
      if (b) queueAction({ type: 'skill', id: SKILLS[+b.dataset.i].id });
    });
    // 첫 터치에 소리 켜기
    const unlock = () => { Sound.unlock(); $('#tapHint').hidden = true; if (screen === 'title') Sound.play('title'); };
    // iOS 사파리는 터치를 뗄 때(pointerup·touchend)만 소리를 허락한다
    for (const ev of ['pointerdown', 'pointerup', 'touchend']) window.addEventListener(ev, unlock, { passive: true });
    window.addEventListener('keydown', unlock, { once: true });

    // 십자 버튼: 누르고 있으면 계속 걷는다
    for (const b of document.querySelectorAll('#dpad button')) {
      const dir = b.dataset.dir === 'wait' ? 'wait' : b.dataset.dir.split(',').map(Number);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { b.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
        b.classList.add('on');
        stopAuto();
        held = dir; heldSince = performance.now(); heldKey = 'pad';
        buffered = dir === 'wait' ? { type: 'wait' } : { type: 'move', dx: dir[0], dy: dir[1] };
      });
      const up = () => { b.classList.remove('on'); if (heldKey === 'pad') held = null; };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // 화면 탭: 그 칸으로 걷기 / 옆 칸 공격
    const cv = $('#cv');
    let down = null;
    cv.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    cv.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 12) return;
      down = null;
      const r = cv.getBoundingClientRect();
      tapTile(...Render.screenToTile(e.clientX - r.left, e.clientY - r.top));
    });

    const DIR = { ArrowUp: [0, -1], w: [0, -1], k: [0, -1], ArrowDown: [0, 1], s: [0, 1], j: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], h: [-1, 0], ArrowRight: [1, 0], d: [1, 0], l: [1, 0] };
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (modal) {
        if (k === 'Escape' || (k === 'i' && modal === 'bag') || (k === 'm' && modal === 'map')) { e.preventDefault(); closeModal(); }
        else if (k === 'Enter' && document.querySelector('#panel .btn.gold')) { e.preventDefault(); document.querySelector('#panel .btn.gold').click(); }
        return;
      }
      if (screen === 'title') {
        if (k === 'Enter') { e.preventDefault(); ($('#btnContinue').hidden ? $('#btnNew') : $('#btnContinue')).click(); }
        return;
      }
      if (screen === 'ending') { if (k === 'Enter' || k === 'Escape') { const b = document.querySelector('#endBox .btn'); if (b) b.click(); } return; }
      if (screen !== 'game') return;
      if (DIR[k]) {
        e.preventDefault();
        if (e.repeat) return;
        stopAuto();
        held = DIR[k]; heldSince = performance.now(); heldKey = k;
        buffered = { type: 'move', dx: DIR[k][0], dy: DIR[k][1] };
        return;
      }
      if (e.repeat && !(k === ' ' || k === '.')) return;
      switch (k) {
        case ' ': case '.': e.preventDefault(); stopAuto(); buffered = { type: 'wait' }; break;
        case '1': case '2': case '3': case '4': queueAction({ type: 'skill', id: SKILLS[+k - 1].id }); break;
        case 'i': stopAuto(); openBag(); break;
        case 'm': case 'Tab': e.preventDefault(); stopAuto(); openMap(); break;
        case 'x': toggleAuto('explore'); break;
        case 'r': toggleAuto('rest'); break;
        case 'Enter': case '>': e.preventDefault(); queueAction({ type: 'descend' }); break;
        case 'Escape': openMenu(); break;
        case '?': openHelp(); break;
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === heldKey) held = null;
    });
    window.addEventListener('blur', () => { held = null; });
    $('#modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal' && modal !== 'dead' && modal !== 'intro') closeModal();
      if (e.target.closest('[data-close]')) closeModal();
    });
  }

  function queueAction(a) { stopAuto(); buffered = a; }

  function tapTile(tx, ty) {
    if (modal || screen !== 'game') return;
    const S = Game.S, p = S.player, f = S.floor;
    if (S.over || S.won) return;
    stopAuto();
    if (tx === p.x && ty === p.y) {
      if (Game.tileAt(p.x, p.y) === T.STAIRS) buffered = { type: 'descend' };
      return;
    }
    if (tx < 0 || ty < 0 || tx >= f.w || ty >= f.h || !f.seen[ty * f.w + tx]) return;
    const d = Math.abs(tx - p.x) + Math.abs(ty - p.y);
    if (d === 1) { buffered = { type: 'move', dx: tx - p.x, dy: ty - p.y }; return; }
    const m = Game.monsterAt(tx, ty);
    if (m && Game.isVisible(tx, ty) && !m.disguised) { auto = { mode: 'chase', uid: m.uid }; return; }
    const path = Game.pathTo(tx, ty);
    if (!path || !path.length) { Game.msg('그곳으로 가는 길을 모른다.', 'info'); return; }
    auto = { mode: 'travel', path, tx, ty, seen: visibleUids() };
    Render.setMarks([[tx, ty]]);
  }

  /* ── 자동 행동 ── */
  const visibleUids = () => new Set(Game.S.floor.monsters.filter(m => !m.disguised && Game.isVisible(m.x, m.y)).map(m => m.uid));
  function toggleAuto(mode) {
    if (modal || screen !== 'game' || Game.S.over) return;
    if (auto && auto.mode === mode) { stopAuto(); return; }
    stopAuto();
    if (Game.hostilesInView().length) { Game.msg('가까이에 적이 있다!', 'bad'); Sound.sfx('error'); return; }
    if (mode === 'rest') {
      const st = Game.stats(), p = Game.S.player;
      if (p.hp >= st.mhp && p.mp >= st.mmp && !p.poison) { Game.msg('쉴 필요가 없다.', 'info'); return; }
      Game.msg('잠시 숨을 고른다…', 'info');
    }
    auto = { mode, seen: visibleUids(), n: 0 };
    dirty = true;
  }
  function stopAuto() {
    if (auto) { auto = null; Render.setMarks([]); dirty = true; }
  }

  function autoStep() {
    const S = Game.S, p = S.player;
    const a = auto;
    // 새로 보이는 적이 있으면 멈춘다
    if (a.mode !== 'chase') {
      const fresh = S.floor.monsters.find(m => !m.disguised && Game.isVisible(m.x, m.y) && !a.seen.has(m.uid));
      if (fresh) { stopAuto(); Game.msg(`${josa(Game.monName(fresh), '이가')} 보인다.`, 'bad'); return; }
      if (a.mode !== 'travel' && Game.hostilesInView().length) { stopAuto(); return; }
    }
    a.n = (a.n || 0) + 1;
    if (a.mode === 'rest') {
      const st = Game.stats();
      if ((p.hp >= st.mhp && p.mp >= st.mmp && !p.poison) || a.n > 400) { stopAuto(); Game.msg('충분히 쉬었다.', 'info'); return; }
      doAction({ type: 'wait' }, true);
      return;
    }
    if (a.mode === 'chase') {
      const m = S.floor.monsters.find(x => x.uid === a.uid);
      if (!m || !Game.isVisible(m.x, m.y)) { stopAuto(); return; }
      if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1) { stopAuto(); return; }
      const path = Game.pathTo(m.x, m.y);
      if (!path || path.length < 2 || a.n > 30) { stopAuto(); return; }
      stepTo(path[0]);
      return;
    }
    if (a.mode === 'travel') {
      if (p.x === a.tx && p.y === a.ty) { stopAuto(); return; }
      const path = Game.pathTo(a.tx, a.ty);
      if (!path || !path.length || a.n > 300) { stopAuto(); return; }
      if (path.length === 1 && Game.monsterAt(path[0][0], path[0][1])) { stopAuto(); return; }
      stepTo(path[0]);
      if (auto && p.x === a.tx && p.y === a.ty) stopAuto();
      return;
    }
    if (a.mode === 'explore') {
      if (a.n > 2000) { stopAuto(); return; }
      if (a.toStairs) {
        const st = S.floor.stairs;
        if (p.x === st.x && p.y === st.y) { stopAuto(); Game.msg('계단 앞에 섰다. 내려가려면 ▼ 버튼.', 'info'); return; }
        const path = Game.pathTo(st.x, st.y);
        if (!path || !path.length) { stopAuto(); return; }
        stepTo(path[0]);
        return;
      }
      const path = Game.explorePath();
      if (!path) {
        const st = S.floor.stairs;
        if (st && S.floor.seen[st.y * S.floor.w + st.x]) {
          Game.msg('이 층을 모두 둘러봤다. 계단으로 향한다.', 'info');
          a.toStairs = true;
          return;
        }
        stopAuto();
        Game.msg(S.floor.boss && !S.floor.bossDead ? '더 둘러볼 곳이 없다. 이 층의 주인을 찾아야 한다.' : '더 둘러볼 곳이 없다.', 'info');
        return;
      }
      stepTo(path[0]);
    }
  }
  function stepTo([x, y]) {
    const p = Game.S.player;
    const ok = doAction({ type: 'move', dx: x - p.x, dy: y - p.y }, true);
    if (!ok) stopAuto();
  }

  function doAction(a, fromAuto = false) {
    if (!fromAuto) stopAuto();
    const used = Game.act(a);
    dirty = true;
    if (used && Game.S && !Game.S.over && Game.S.turn - lastSavedTurn >= 12) saveNow();
    return used;
  }

  /* ── 매 프레임 ── */
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = now - lastFrame;
    lastFrame = now;
    if (screen === 'title') drawScene($('#titleArt'), now, false);
    else if (screen === 'ending') drawScene($('#endArt'), now, true);
    else if (screen === 'game' && Game.S) {
      if (!document.hidden && !modal && !Game.S.over && !Game.S.won) Game.addPlayTime(Math.min(dt, 500));
      tick(now);
      Render.frame(now);
      if (dirty) { dirty = false; updateHud(); }
    }
  }
  function tick(now) {
    if (modal || Render.busy()) return;
    const S = Game.S;
    if (S.over || S.won) { buffered = null; return; }
    if (buffered) { const a = buffered; buffered = null; doAction(a); return; }
    if (held && now - heldSince > 180) {
      doAction(held === 'wait' ? { type: 'wait' } : { type: 'move', dx: held[0], dy: held[1] });
      return;
    }
    if (auto) autoStep();
  }

  /* ── 창 ── */
  function openModal(name, html, mount) {
    modal = name;
    held = null;
    $('#panel').innerHTML = html;
    $('#modal').hidden = false;
    if (mount) mount();
    Sound.sfx('menu');
  }
  function closeModal() {
    if (!modal) return;
    const was = modal;
    modal = null;
    $('#modal').hidden = true;
    $('#panel').innerHTML = '';
    selected = null;
    dirty = true;
    if (was === 'help' && screen === 'game' && !Game.S) showTitle();
  }

  function itemStats(it) {
    const d = ITEMS[it.id];
    const plus = it.plus || 0;
    const parts = [];
    if (d.kind === 'weapon') parts.push(`공격력 +${d.atk + plus}`);
    if (d.kind === 'armor') parts.push(`방어력 +${d.def + plus}`);
    if (d.kind === 'acc') {
      if (d.atk) parts.push(`공격력 +${d.atk}`);
      if (d.def) parts.push(`방어력 +${d.def}`);
      if (d.hp) parts.push(`최대 체력 +${d.hp}`);
      if (d.mp && !d.desc) parts.push(`최대 마나 +${d.mp}`);
    }
    return parts.join(' · ');
  }
  const KIND = { potion: '물약', scroll: '주문서', weapon: '무기', armor: '갑옷', acc: '장신구', quest: '보물' };

  function slotHtml(it, i, extra = '') {
    if (!it) return `<button class="slot empty" data-i="${i}">${extra}</button>`;
    const d = ITEMS[it.id];
    return `<button class="slot${selected === i ? ' sel' : ''}" data-i="${i}">${extra}<img src="${Render.icon(d.spr, 48)}" alt="${esc(d.name)}">${it.n > 1 ? `<span class="n">${it.n}</span>` : ''}${it.plus ? `<span class="plus">+${it.plus}</span>` : ''}</button>`;
  }

  function compareHtml(it) {
    const d = ITEMS[it.id], p = Game.S.player;
    if (!['weapon', 'armor', 'acc'].includes(d.kind)) return '';
    const cur = Game.stats();
    const saved = p.equip[d.kind];
    p.equip[d.kind] = it;
    const nxt = Game.stats();
    p.equip[d.kind] = saved;
    const rows = [['공격', 'atk'], ['방어', 'def'], ['체력', 'mhp'], ['마나', 'mmp']]
      .filter(([, k]) => cur[k] !== nxt[k])
      .map(([n, k]) => `${n} ${cur[k]} → <span class="${nxt[k] > cur[k] ? 'better' : 'worse'}">${nxt[k]}</span>`);
    return rows.length ? `<div class="cmp">${rows.join(' · ')}</div>` : '';
  }

  function openBag() {
    if (screen !== 'game' || Game.S.over) return;
    const S = Game.S, p = S.player;
    const slots = ['weapon', 'armor', 'acc'];
    const label = { weapon: '무기', armor: '갑옷', acc: '장신구' };
    let html = `<h2>가방 <small>${p.inv.length} / ${INV_SIZE} · 금화 ${p.gold}</small></h2>
      <div class="equip">${slots.map(s => slotHtml(p.equip[s], 'eq:' + s, `<span class="lbl">${label[s]}</span>`)).join('')}</div>
      <div class="slots">${Array.from({ length: INV_SIZE }, (_, i) => slotHtml(p.inv[i], i)).join('')}</div>
      <div class="detail" id="detail"></div>
      <div class="row"><button class="btn small" data-close>닫기</button></div>`;
    openModal('bag', html, () => {
      for (const b of document.querySelectorAll('#panel .slot')) {
        b.onclick = () => {
          const i = b.dataset.i;
          const key = i.startsWith('eq:') ? i : +i;
          selected = key;
          for (const x of document.querySelectorAll('#panel .slot')) x.classList.toggle('sel', x === b);
          renderDetail(key);
          Sound.sfx('menu');
        };
      }
      const first = p.inv.length ? 0 : null;
      if (first !== null) { selected = 0; document.querySelector('#panel .slot[data-i="0"]').classList.add('sel'); renderDetail(0); }
      else $('#detail').innerHTML = '<p class="muted">가방이 비어 있다.</p>';
    });
  }

  function renderDetail(key) {
    const p = Game.S.player;
    const box = $('#detail');
    const eqSlot = typeof key === 'string' ? key.slice(3) : null;
    const it = eqSlot ? p.equip[eqSlot] : p.inv[key];
    if (!it) { box.innerHTML = '<p class="muted">비어 있다.</p>'; return; }
    const d = ITEMS[it.id];
    const st = itemStats(it);
    let btns = '';
    if (eqSlot) btns = `<button class="btn small" data-act="unequip">벗기</button>`;
    else if (['weapon', 'armor', 'acc'].includes(d.kind)) btns = `<button class="btn small gold" data-act="equip">장착</button><button class="btn small" data-act="drop">버리기</button>`;
    else if (it.id === 'scroll_enchant') btns = `<button class="btn small gold" data-act="ench-weapon" ${p.equip.weapon ? '' : 'disabled'}>무기 강화</button><button class="btn small gold" data-act="ench-armor" ${p.equip.armor ? '' : 'disabled'}>갑옷 강화</button><button class="btn small" data-act="drop">버리기</button>`;
    else if (d.kind !== 'quest') btns = `<button class="btn small gold" data-act="use">사용</button><button class="btn small" data-act="drop">버리기</button>`;
    box.innerHTML = `<div class="name">${esc(Game.itemName(it))}<span class="kind">${KIND[d.kind] || ''}</span></div>
      ${st ? `<div>${st}</div>` : ''}
      ${d.desc ? `<div class="desc">${esc(d.desc)}</div>` : ''}
      ${eqSlot ? '<div class="muted" style="font-size:11px">장착 중</div>' : compareHtml(it)}
      <div class="row">${btns}</div>`;
    for (const b of box.querySelectorAll('[data-act]')) b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'unequip') { closeModal(); buffered = { type: 'unequip', slot: eqSlot }; }
      else if (act === 'equip') { closeModal(); buffered = { type: 'equip', index: key }; }
      else if (act === 'use') { closeModal(); if (it.id.startsWith('potion')) Sound.sfx('drink'); buffered = { type: 'use', index: key }; }
      else if (act === 'ench-weapon' || act === 'ench-armor') { closeModal(); buffered = { type: 'use', index: key, target: act.slice(5) }; }
      else if (act === 'drop') { Game.dropFromInv(key); openBag(); }
    };
  }

  function openShop() {
    const S = Game.S, p = S.player, stock = S.floor.shop || [];
    const row = (img, name, sub, price, btn) => `<div class="shop-item"><img src="${img}" alt=""><div class="info"><b>${name}</b><small>${sub}</small></div><span class="price">${price}</span>${btn}</div>`;
    let list;
    if (shopTab === 'buy') {
      list = stock.map((s, k) => {
        const d = ITEMS[s.item.id];
        const sub = [itemStats(s.item), d.desc].filter(Boolean).join(' · ') || KIND[d.kind];
        return row(Render.icon(d.spr, 48), esc(Game.itemName(s.item)) + (s.n > 1 ? ` <span class="muted">(${s.n}개 남음)</span>` : ''), esc(sub), `${s.price}G`,
          `<button class="btn small gold" data-buy="${k}" ${s.n <= 0 || p.gold < s.price ? 'disabled' : ''}>${s.n <= 0 ? '품절' : '사기'}</button>`);
      }).join('');
    } else {
      list = p.inv.map((it, i) => {
        const d = ITEMS[it.id];
        if (d.kind === 'quest') return '';
        return row(Render.icon(d.spr, 48), esc(Game.itemName(it)), esc(itemStats(it) || KIND[d.kind]), `${Game.sellPrice(it)}G`, `<button class="btn small" data-sell="${i}">팔기</button>`);
      }).join('') || '<p class="muted">팔 물건이 없다.</p>';
    }
    openModal('shop', `<h2>떠돌이 상인 <small>금화 ${p.gold}</small></h2>
      <p class="muted">「어서 와, 이런 깊은 데까지 오다니 배짱이 좋군. 천천히 골라 봐.」</p>
      <div class="tabs"><button class="btn small ${shopTab === 'buy' ? 'on' : ''}" data-tab="buy">사기</button><button class="btn small ${shopTab === 'sell' ? 'on' : ''}" data-tab="sell">팔기</button></div>
      <div class="shop-list">${list}</div>
      <div class="row"><button class="btn small" data-close>나가기</button></div>`, () => {
      for (const b of document.querySelectorAll('#panel [data-tab]')) b.onclick = () => { shopTab = b.dataset.tab; openShop(); };
      for (const b of document.querySelectorAll('#panel [data-buy]')) b.onclick = () => { Game.buy(+b.dataset.buy); openShop(); };
      for (const b of document.querySelectorAll('#panel [data-sell]')) b.onclick = () => { Game.sell(+b.dataset.sell); openShop(); };
    });
  }

  function openMap() {
    if (screen !== 'game') return;
    const S = Game.S;
    openModal('map', `<h2>지도 <small>지하 ${S.depth}층 · ${esc(THEMES[S.floor.theme].name)}</small></h2>
      <div class="map-wrap"><canvas id="mapCv"></canvas></div>
      <div class="legend"><span><i style="background:#4796dc"></i>나</span><span><i style="background:#ffd447"></i>계단·금화</span><span><i style="background:#9cd6f0"></i>물건</span><span><i style="background:#f39236"></i>상자</span><span><i style="background:#9c66dc"></i>상인</span><span><i style="background:#e0503f"></i>적·함정</span></div>
      <div class="row"><button class="btn small" data-close>닫기</button></div>`,
    () => requestAnimationFrame(() => Render.drawMap($('#mapCv'))));
  }

  function openLog() {
    const S = Game.S;
    openModal('log', `<h2>지난 이야기</h2><div class="loglist">${S.log.slice().reverse().map(l => `<p class="c-${l.cls || 'info'}">${esc(l.text)}</p>`).join('')}</div>
      <div class="row"><button class="btn small" data-close>닫기</button></div>`);
  }

  function openMenu() {
    if (screen !== 'game') return;
    stopAuto();
    const S = Game.S, p = S.player, st = Game.stats();
    const learned = SKILLS.filter(s => p.lv >= s.lv);
    openModal('menu', `<h2>메뉴 <small>${fmtTime(S.stats.playMs)}</small></h2>
      <dl class="stats">
        <dt>레벨</dt><dd>${p.lv} (다음까지 ${Game.expToNext(p.lv) - p.exp})</dd>
        <dt>공격 · 방어</dt><dd>${st.atk} · ${st.def} (치명타 ${Math.round(st.crit * 100)}%)</dd>
        <dt>기술</dt><dd>${learned.map(s => esc(s.name)).join(', ') || '-'}</dd>
        <dt>쓰러뜨린 적</dt><dd>${S.stats.kills}</dd>
        <dt>턴</dt><dd>${S.turn}</dd>
      </dl>
      <div class="row">
        <button class="btn gold" data-close>계속하기</button>
        <button class="btn" id="mHelp">조작법</button>
        <button class="btn" id="mSound">소리</button>
        <button class="btn" id="mLog">지난 이야기</button>
        <button class="btn" id="mTitle">저장하고 타이틀로</button>
      </div>`, () => {
      $('#mHelp').onclick = openHelp;
      $('#mSound').onclick = openSound;
      $('#mLog').onclick = openLog;
      $('#mTitle').onclick = () => { saveNow(); showTitle(); };
    });
  }

  function openHelp() {
    openModal('help', `<h2>조작법</h2>
      <h3>움직이기·싸우기</h3>
      <p>방향키 · <span class="kbd">WASD</span> · 화면의 십자 버튼으로 한 칸씩 움직입니다. 적에게 부딪히면 공격하고, 누르고 있으면 계속 걷습니다.</p>
      <p>화면의 칸을 누르면 그곳까지 걸어가고, 멀리 있는 적을 누르면 그 앞까지 다가갑니다.</p>
      <p>내가 한 번 움직이면 적도 한 번 움직이는 턴제입니다. 박쥐처럼 빠른 적은 두 번, 골렘처럼 느린 적은 두 턴에 한 번 움직입니다.</p>
      <h3>단축키</h3>
      <p><span class="kbd">1</span>~<span class="kbd">4</span> 기술 · <span class="kbd">I</span> 가방 · <span class="kbd">M</span> 지도 · <span class="kbd">X</span> 자동 탐험 · <span class="kbd">R</span> 휴식 · <span class="kbd">Space</span> 제자리 대기 · <span class="kbd">Enter</span> 계단 내려가기 · <span class="kbd">Esc</span> 메뉴</p>
      <h3>요령</h3>
      <p>· <b>탐험</b>은 새 적이 보이면 멈추고, 층을 다 돌면 계단으로 갑니다. <b>휴식</b>은 체력과 마나가 찰 때까지 쉽니다.</p>
      <p>· 잠든 적(Z)을 먼저 치면 <b>기습</b>으로 1.5배 피해를 줍니다.</p>
      <p>· 숨은 함정은 바로 옆을 지날 때 가끔 알아챕니다. 지도 주문서를 읽으면 모두 드러납니다.</p>
      <p>· 기술은 레벨 1·3·5·8에 하나씩 익힙니다. 화염구는 가장 가까운 적을 노리고 방어를 무시합니다.</p>
      <p>· 지하 3·6·9층에는 상인이 있습니다. 부딪히면 물건을 사고팔 수 있습니다.</p>
      <p>· 깊은 층의 상자 가운데에는 <b>미믹</b>이 숨어 있습니다.</p>
      <p>· 쓰러지면 그 층에 처음 내려온 순간으로 돌아가 다시 도전할 수 있습니다. 진행은 자동으로 저장됩니다.</p>
      <div class="row"><button class="btn small" data-close>닫기</button></div>`);
  }

  function openSound() {
    const s = Sound.settings;
    openModal('sound', `<h2>소리</h2>
      <div class="setting"><label for="vMusic">음악</label><input type="range" id="vMusic" min="0" max="1" step="0.05" value="${s.music}"></div>
      <div class="setting"><label for="vSfx">효과음</label><input type="range" id="vSfx" min="0" max="1" step="0.05" value="${s.sfx}"></div>
      <p class="muted">음악과 효과음은 모두 브라우저에서 그 자리에서 합성한 칩튠입니다.</p>
      <div class="row"><button class="btn small" data-close>닫기</button></div>`, () => {
      const save = () => store.set(KEY.snd, JSON.stringify(Sound.settings));
      $('#vMusic').oninput = (e) => { Sound.unlock(); Sound.setVolume('music', +e.target.value); save(); };
      $('#vSfx').oninput = (e) => { Sound.unlock(); Sound.setVolume('sfx', +e.target.value); Sound.sfx('pickup'); save(); };
    });
  }

  /* ── 쓰러짐·승리 ── */
  function onDeath() {
    const S = Game.S;
    S.stats.deaths++;
    // 이어하기는 이 층 처음부터
    try {
      const chk = JSON.parse(store.get(KEY.check));
      chk.stats.deaths = S.stats.deaths;
      chk.stats.playMs = S.stats.playMs;
      chk.over = true;
      store.set(KEY.save, JSON.stringify(chk));
    } catch { /* 체크포인트 없음 */ }
    openModal('dead', `<h2 style="color:#ff9a8a">쓰러졌다</h2>
      <p>${esc(S.stats.killedBy === '독' ? '독이 온몸에 퍼졌다.' : S.stats.killedBy === '가시 함정' ? '가시 함정에 찔렸다.' : S.stats.killedBy + '에게 당했다.')}</p>
      <dl class="stats"><dt>깊이</dt><dd>지하 ${S.depth}층</dd><dt>레벨</dt><dd>${S.player.lv}</dd><dt>쓰러뜨린 적</dt><dd>${S.stats.kills}</dd><dt>쓰러진 횟수</dt><dd>${S.stats.deaths}</dd></dl>
      <p class="muted">불씨는 아직 꺼지지 않았다. 이 층에 처음 내려온 순간으로 돌아가 다시 도전할 수 있다.</p>
      <div class="row"><button class="btn gold" id="mRetry">다시 도전</button><button class="btn" id="mTitle">타이틀로</button></div>`, () => {
      $('#mRetry').onclick = retry;
      $('#mTitle').onclick = showTitle;
    });
  }

  function fmtTime(ms) {
    const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
    return h ? `${h}시간 ${m % 60}분` : `${m}분 ${Math.floor(ms / 1000) % 60}초`;
  }

  function onWin() {
    const S = Game.S;
    const r = records();
    r.clears = (r.clears || 0) + 1;
    r.best = LAST_FLOOR;
    r.bestTurns = Math.min(r.bestTurns || Infinity, S.turn);
    r.bestDeaths = Math.min(r.bestDeaths ?? Infinity, S.stats.deaths);
    r.bestTime = Math.min(r.bestTime || Infinity, S.stats.playMs);
    saveRecords(r);
    store.del(KEY.save);
    store.del(KEY.check);
    closeModal();
    setScreen('ending');
    const box = $('#endBox');
    box.innerHTML = `<h2>첫 불씨를 되찾았다</h2>` +
      STORY.ending.map((t, i) => `<p style="animation-delay:${0.8 + i * 1.6}s">${esc(t)}</p>`).join('') +
      `<dl class="stats" style="animation-delay:${0.8 + STORY.ending.length * 1.6}s">
        <dt>레벨</dt><dd>${S.player.lv}</dd><dt>턴</dt><dd>${S.turn}</dd><dt>플레이 시간</dt><dd>${fmtTime(S.stats.playMs)}</dd>
        <dt>쓰러뜨린 적</dt><dd>${S.stats.kills}</dd><dt>쓰러진 횟수</dt><dd>${S.stats.deaths}</dd><dt>모은 금화</dt><dd>${S.stats.goldEarned}</dd>
      </dl><button class="btn gold" style="opacity:0;animation:rise 1s steps(10) ${1.4 + STORY.ending.length * 1.6}s forwards">타이틀로</button>`;
    box.querySelector('.btn').onclick = showTitle;
  }

  /* ── 타이틀·엔딩 배경 ── */
  const embers = [];
  function drawScene(cv, now, ending) {
    const dpr = window.devicePixelRatio || 1;
    const cw = cv.clientWidth, ch = cv.clientHeight;
    const sc = Math.max(2, Math.round(Math.min(cw, ch) * dpr / 190));
    const W = Math.ceil(cw * dpr / sc), H = Math.ceil(ch * dpr / sc);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const tiles = Render.themeTiles(ending ? 'abyss' : 'cave');
    const S = Render.sprite;
    g.fillStyle = '#07060c'; g.fillRect(0, 0, W, H);
    const cx = Math.floor(W / 2), floorY = Math.floor(H * (ending ? (W > H ? 0.8 : 0.86) : W > H ? 0.6 : 0.5));
    // 벽
    for (let y = floorY - 16 * Math.ceil(floorY / 16); y < floorY; y += 16) for (let x = cx - 8 - 16 * Math.ceil(W / 32 + 1); x < W; x += 16) {
      const k = ((x * 7 + y * 13) >>> 0) % 7;
      g.drawImage(tiles.front[k < 4 ? 0 : k < 6 ? 1 : 2], x, y);
    }
    // 바닥
    for (let y = floorY; y < H; y += 16) for (let x = cx - 8 - 16 * Math.ceil(W / 32 + 1); x < W; x += 16) g.drawImage(tiles.floor[((x * 3 + y * 5) >>> 0) % 4], x, y);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, floorY, W, 3);
    // 입구와 계단
    g.fillStyle = '#07060c'; g.fillRect(cx - 16, floorY - 40, 32, 40);
    g.fillRect(cx - 12, floorY - 44, 24, 4);
    g.drawImage(S('stairs'), cx - 8, floorY - 16);
    g.drawImage(S('stairs'), cx - 24, floorY - 16); g.drawImage(S('stairs'), cx + 8, floorY - 16);
    // 횃불
    const tf = Math.floor(now / 300);
    for (const tx of [cx - 48, cx + 32]) g.drawImage(S(tf % 2 ? 'torch1' : 'torch2'), tx, floorY - 40);
    // 주인공 (+ 엔딩이면 불씨)
    const bob = Math.floor(now / 500) % 2;
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(cx - 6, floorY + 22, 12, 2);
    g.drawImage(S('hero'), cx - 8, floorY + 8 - bob);
    if (ending) {
      g.drawImage(S('ember'), cx - 2, floorY - 6 - Math.round(Math.sin(now / 300) * 2));
    } else {
      g.drawImage(S('slime'), cx - 70, floorY + 18 - (Math.floor(now / 400) % 2));
      g.drawImage(S(Math.floor(now / 160) % 2 ? 'bat1' : 'bat2'), cx + 52, floorY - 70 + Math.round(Math.sin(now / 500) * 4));
      g.drawImage(S('chest'), cx + 46, floorY + 20);
    }
    // 빛과 어둠
    const grd = g.createRadialGradient(cx, floorY, 10, cx, floorY, Math.max(W, H) * 0.55);
    grd.addColorStop(0, ending ? 'rgba(255,200,90,0.10)' : 'rgba(255,170,80,0.05)');
    grd.addColorStop(0.5, 'rgba(7,6,12,0.35)');
    grd.addColorStop(1, 'rgba(7,6,12,0.92)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    // 불티
    if (embers.length < (ending ? 70 : 40) && Math.random() < 0.5) embers.push({ x: cx + (Math.random() - 0.5) * W * 0.8, y: H + 2, vy: 0.2 + Math.random() * 0.4, ph: Math.random() * 6, c: Math.random() < 0.5 ? '#f39236' : '#ffd447' });
    for (const e of embers) {
      e.y -= e.vy; e.ph += 0.03;
      g.fillStyle = e.c;
      g.globalAlpha = Math.max(0, Math.min(1, e.y / H + 0.2));
      g.fillRect(Math.round(e.x + Math.sin(e.ph) * 3), Math.round(e.y), 1, 1);
    }
    g.globalAlpha = 1;
    for (let i = embers.length - 1; i >= 0; i--) if (embers[i].y < -4) embers.splice(i, 1);
  }

  return { boot };
})();

UI.boot();
