/* 조국과 민족을 위하여 — 게임 진행 엔진 */
'use strict';

(() => {
  const $ = (s) => document.querySelector(s);
  const STAT_KEYS = ['eco', 'sup', 'pow', 'lib'];
  const STAT_NAMES = { eco: '경제', sup: '민심', pow: '권력', lib: '자유' };
  const SAVE_KEY = 'joguk.save.v1', META_KEY = 'joguk.meta.v1';
  const SPEEDS = { slow: 48, normal: 28, fast: 12, instant: 0 };
  const native = window.native || null;

  /* ── 저장소 ── */
  function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }

  const DEFAULT_SETTINGS = { music: 0.55, sfx: 0.8, speed: 'normal', autoMg: false };
  const meta = Object.assign({ endings: {}, notes: {}, ach: {} }, load(META_KEY, {}));
  meta.settings = Object.assign({}, DEFAULT_SETTINGS, meta.settings || {});
  const saveMeta = () => store(META_KEY, meta);

  let S = null;                 // 진행 중인 게임 상태
  let mode = 'splash';          // splash | title | game | ending
  let typing = null, autoMode = false, skipMode = false, skipHold = false;
  let choiceCtx = null, noteCtx = null, panelOpen = false, busy = false;

  /* ── 화면 맞춤 ── */
  function fit() {
    const k = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    $('#stage').style.transform = `scale(${k})`;
  }
  window.addEventListener('resize', fit);

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function fadeOut() { $('#fader').classList.add('on'); await wait(650); }
  async function fadeIn() { $('#fader').classList.remove('on'); await wait(300); }

  /* ── HUD ── */
  function buildMeters() {
    const m = $('#meters'); m.innerHTML = '';
    for (const k of STAT_KEYS) {
      const d = document.createElement('div');
      d.className = 'meter'; d.dataset.k = k;
      d.innerHTML = `<div class="lab"><b>${STAT_NAMES[k]}</b><span class="v">0</span></div><div class="bar"><div class="fill"></div></div><div class="delta"></div>`;
      m.appendChild(d);
    }
  }
  function renderMeters(deltas) {
    const m = $('#meters');
    if (!S || !S.stats) { m.classList.add('hidden'); return; }
    m.classList.remove('hidden');
    for (const k of STAT_KEYS) {
      const el = m.querySelector(`[data-k="${k}"]`), v = S.stats[k];
      el.querySelector('.v').textContent = v;
      el.querySelector('.fill').style.width = `calc(${v}% - ${v ? 4 * v / 100 : 0}px)`;
      el.classList.toggle('low', k !== 'lib' && v <= 15);
      if (deltas && deltas[k]) {
        const de = el.querySelector('.delta');
        de.textContent = (deltas[k] > 0 ? '+' : '') + deltas[k];
        de.style.color = deltas[k] > 0 ? '#9fe08a' : '#ff8a7a';
        de.classList.remove('show'); void de.offsetWidth; de.classList.add('show');
        el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
        setTimeout(() => de.classList.remove('show'), 1600);
      }
    }
  }
  function setHud(ev) {
    $('#hud').classList.remove('hidden');
    const ch = CHAPTERS[ev.ch];
    $('#hud-date').textContent = `${ev.date} · 만 ${ev.age}세`;
    $('#hud-chapter').textContent = `${ch.no} ${ch.title}`;
    renderMeters();
  }

  /* ── 지표 변화 ── */
  function applyFx(fx) {
    if (!fx) return;
    const deltas = {};
    let net = 0;
    for (const [k, d] of Object.entries(fx)) {
      if (k === 'amb' || k === 'con') { S[k] = (S[k] || 0) + d; continue; }
      if (!S.stats || !d) continue;
      const before = S.stats[k];
      S.stats[k] = Math.max(0, Math.min(100, before + d));
      deltas[k] = S.stats[k] - before;
      net += Math.sign(d);
    }
    if (Object.values(deltas).some(Boolean)) {
      renderMeters(deltas);
      Sound.sfx(net >= 0 ? 'up' : 'down');
    }
  }
  function initStats() {
    S.stats = {
      eco: 25,
      sup: 55,
      pow: Math.min(70, 42 + (S.amb || 0) * 3),
      lib: Math.min(70, 42 + (S.con || 0) * 4),
    };
    renderMeters();
  }
  function collapse() {
    if (!S.stats) return null;
    if (S.stats.sup <= 0) return 'uprising';
    if (S.stats.pow <= 0) return 'coup';
    if (S.stats.eco <= 0) return 'crisis';
    return null;
  }

  /* ── 대화 ── */
  const dlg = $('#dialog'), nameEl = $('#name'), textEl = $('#text'), nextEl = $('#next');
  function say(line) {
    const [who, txt, opt] = line;
    S && S.log && (S.log.push([who, txt]), S.log.length > 120 && S.log.shift());
    dlg.classList.remove('hidden');
    if (who === 'n' || who === 'sys') {
      nameEl.classList.add('hidden');
      textEl.className = who === 'n' ? 'narr' : 'sys';
      if (who === 'sys') { nameEl.classList.remove('hidden'); nameEl.textContent = '안내'; nameEl.style.background = '#5a4a1e'; nameEl.style.color = '#efe6d2'; }
    } else {
      nameEl.classList.remove('hidden');
      nameEl.textContent = who;
      nameEl.style.color = SPEAKER_COLORS[who] ? '#0e0c0a' : '';
      nameEl.style.background = SPEAKER_COLORS[who] || '';
      textEl.className = '';
    }
    if (opt && opt.sfx) {
      Sound.sfx(opt.sfx);
      if (opt.sfx === 'gun') { Scenes.flash(0.9); Scenes.shake(1); }
    }
    return new Promise((resolve) => {
      const cur = { full: txt, i: 0, done: false, resolve, timer: null, autoT: null };
      typing = cur;
      nextEl.classList.add('wait');
      textEl.textContent = '';
      const sp = skipMode || skipHold ? 0 : SPEEDS[meta.settings.speed];
      if (!sp) finishType(cur);
      else {
        cur.timer = setInterval(() => {
          cur.i += 1;
          textEl.textContent = cur.full.slice(0, cur.i);
          if (cur.i % 3 === 0 && cur.full[cur.i] !== ' ') Sound.sfx('blip');
          if (cur.i >= cur.full.length) finishType(cur);
        }, sp);
      }
    });
  }
  function finishType(cur) {
    clearInterval(cur.timer);
    cur.done = true;
    textEl.textContent = cur.full;
    nextEl.classList.remove('wait');
    scheduleAuto(cur);
  }
  function scheduleAuto(cur) {
    clearTimeout(cur.autoT);
    if (skipMode || skipHold) cur.autoT = setTimeout(advance, 80);
    else if (autoMode) cur.autoT = setTimeout(advance, 1100 + cur.full.length * 45);
  }
  function advance() {
    const cur = typing;
    if (!cur) return;
    if (!cur.done) { finishType(cur); return; }
    clearTimeout(cur.autoT);
    typing = null;
    cur.resolve();
  }
  dlg.addEventListener('click', (e) => { if (!e.target.closest('#dlg-btns')) advance(); });
  $('#dlg-btns').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'log') openLog();
    if (act === 'auto') { autoMode = !autoMode; skipMode = false; }
    if (act === 'skip') { skipMode = !skipMode; autoMode = false; }
    syncDlgBtns();
    if (typing && typing.done) scheduleAuto(typing);
  });
  function syncDlgBtns() {
    document.querySelector('[data-act="auto"]').classList.toggle('on', autoMode);
    document.querySelector('[data-act="skip"]').classList.toggle('on', skipMode);
  }

  /* ── 선택지 ── */
  function dotSize(d) { const a = Math.abs(d); return a <= 4 ? 8 : a <= 9 ? 12 : 16; }
  function choose(ask, choices) {
    skipMode = false; syncDlgBtns();
    const box = $('#choices'); box.innerHTML = '';
    if (ask) { const a = document.createElement('div'); a.className = 'ask'; a.textContent = ask; box.appendChild(a); }
    return new Promise((resolve) => {
      const btns = choices.map((c, i) => {
        const b = document.createElement('button');
        b.className = 'choice';
        let dots = '';
        if (S.stats && c.fx) for (const k of STAT_KEYS) if (c.fx[k]) dots += `<i class="dot ${k}" title="${STAT_NAMES[k]}" style="width:${dotSize(c.fx[k])}px;height:${dotSize(c.fx[k])}px"></i>`;
        if (c.mg) dots += '<span class="end-mark">결과는 플레이에 따라</span>';
        else if (c.end || c.check) dots += '<span class="end-mark">⚑ 갈림길</span>';
        b.innerHTML = `<span class="num">${i + 1}</span>${esc(c.t)}${c.tag ? `<span class="tag">${c.tag}</span>` : ''}<span class="dots">${dots}</span>`;
        b.addEventListener('click', () => pick(i));
        b.addEventListener('mouseenter', () => { Sound.sfx('hover'); focusAt(i); });
        box.appendChild(b);
        return b;
      });
      let sel = -1;
      function focusAt(i) { sel = i; btns.forEach((b, k) => b.classList.toggle('sel', k === i)); }
      function pick(i) {
        if (!choiceCtx) return;
        choiceCtx = null;
        Sound.sfx('select');
        box.classList.add('hidden');
        resolve(i);
      }
      choiceCtx = { n: choices.length, pick, move: (d) => focusAt(sel < 0 ? (d > 0 ? 0 : choices.length - 1) : (sel + d + choices.length) % choices.length), get sel() { return sel; } };
      box.classList.remove('hidden');
    });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* ── 역사 기록 카드 ── */
  function showNote(ev, chosen) {
    meta.notes[ev.id] = true; saveMeta();
    checkArchive();
    $('#note-date').textContent = `${ev.date} · ${ev.kind === 'drama' ? '각색이 포함된 장면' : '역사 기록'}`;
    $('#note-title').textContent = ev.title;
    $('#note-body').textContent = ev.note;
    const badge = $('#note-badge'), real = $('#note-real');
    const histChoices = (ev.choices || []).filter((c) => c.hist);
    real.textContent = '';
    if (!ev.choices) { badge.className = 'none'; badge.textContent = '기록'; }
    else if (!histChoices.length) { badge.className = 'none'; badge.textContent = ev.kind === 'drama' ? '각색' : '판단 유보'; }
    else if (chosen && chosen.hist) { badge.className = 'same'; badge.textContent = '역사와 같은 선택'; }
    else {
      badge.className = 'diff'; badge.textContent = '역사와 다른 선택';
      real.textContent = `실제 역사의 선택: ${histChoices.map((c) => c.t).join(' / ')}`;
    }
    Sound.sfx('page');
    $('#note').classList.remove('hidden');
    $('#note-ok').focus({ preventScroll: true });
    return new Promise((resolve) => { noteCtx = { close: () => { noteCtx = null; $('#note').classList.add('hidden'); resolve(); } }; });
  }
  $('#note-ok').addEventListener('click', () => noteCtx && noteCtx.close());

  /* ── 장 카드 ── */
  async function chapterCard(chNo) {
    const ch = CHAPTERS[chNo], card = $('#card');
    $('#card-no').textContent = ch.no; $('#card-title').textContent = ch.title; $('#card-span').textContent = ch.span;
    const flow = [];
    let fx = null;
    if (S.stats && chNo >= 5) {
      fx = {};
      const g = Math.max(-3, Math.min(5, Math.round((S.stats.eco - 40) / 12)));
      if (g) { fx.sup = g; flow.push(`경제 ${g > 0 ? '성장' : '침체'}의 체감 → <b style="color:${g > 0 ? '#9fe08a' : '#ff8a7a'}">민심 ${g > 0 ? '+' : ''}${g}</b>`); }
      if (S.stats.lib < 20) { fx.sup = (fx.sup || 0) - 2; flow.push('억압에 대한 피로 → <b style="color:#ff8a7a">민심 -2</b>'); }
      if (S.stats.lib >= 45) { fx.pow = -3; flow.push('군부 강경파의 동요 → <b style="color:#ff8a7a">권력 -3</b>'); }
      if (S.stats.pow < 40) { fx.pow = (fx.pow || 0) - 6; flow.push('흔들리는 권력, 등을 돌리는 측근들 → <b style="color:#ff8a7a">권력 -6</b>'); }
      if (S.stats.pow > 80) { fx.lib = -2; flow.push('권력의 집중 → <b style="color:#ff8a7a">자유 -2</b>'); }
    }
    $('#card-flow').innerHTML = flow.length ? `시대의 흐름<br>${flow.join('<br>')}` : '';
    card.classList.remove('hidden', 'in');
    void card.offsetWidth;
    card.classList.add('in');
    Sound.sfx('stamp');
    $('#dialog').classList.add('hidden');
    await waitInput(flow.length ? 3200 : 2200);
    card.classList.remove('in');
    await wait(500);
    card.classList.add('hidden');
    if (fx) applyFx(fx);
  }
  function waitInput(min) {
    return new Promise((resolve) => {
      let ok = false;
      const done = () => { if (!ok) { ok = true; window.removeEventListener('keydown', kd, true); $('#card').removeEventListener('click', done); resolve(); } };
      const kd = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); done(); } };
      setTimeout(() => { window.addEventListener('keydown', kd, true); $('#card').addEventListener('click', done); }, 600);
      setTimeout(done, min + (skipMode ? -1500 : 1800));
    });
  }

  /* ── 사건 진행 ── */
  async function runEvent(ev) {
    if (ev.ch !== S.ch) { await chapterCard(ev.ch); S.ch = ev.ch; const c = collapse(); if (c) return { end: c }; }
    Scenes.set(ev.scene); Sound.play(ev.music);
    if (ev.init) initStats();
    setHud(ev);
    if (ev.pre) {
      await say(['sys', `${ev.preText} — 나라 사정이 나빠졌다.`]);
      applyFx(ev.pre);
      await wait(400);
    }
    for (const line of ev.lines) await say(line);
    let chosen = null;
    if (ev.choices) {
      const i = await choose(ev.ask, ev.choices);
      chosen = ev.choices[i];
      S.hist[ev.id] = i;
      if (chosen.shot) { Sound.sfx('gun'); Scenes.flash(1); Scenes.shake(1.2); await wait(900); }
      applyFx(chosen.fx);
      if (chosen.mg) {
        $('#dialog').classList.add('hidden');
        const r = await Minigames.run(chosen.mg, { auto: meta.settings.autoMg });
        Scenes.set(ev.scene);
        applyFx(r.fx);
        (r.ach || []).forEach(unlock);
        for (const line of r.lines) await say(line);
      }
      for (const line of chosen.res || []) await say(line);
      if (chosen.end) { await showNote(ev, chosen); return { end: chosen.end }; }
      if (chosen.check) { const e = chosen.check(S.stats); if (e) { await showNote(ev, chosen); return { end: e }; } }
    }
    for (const line of ev.after || []) await say(line);
    if (ev.note) await showNote(ev, chosen);
    const c = collapse();
    if (c) return { end: c };
    return null;
  }

  async function play() {
    mode = 'game';
    $('#title').classList.add('hidden');
    $('#ending').classList.add('hidden');
    await fadeIn();
    while (S.idx < STORY.length) {
      store(SAVE_KEY, S);
      const res = await runEvent(STORY[S.idx]);
      if (res && res.end) { await showEnding(res.end); return; }
      S.idx++;
    }
    await showEnding('1026');
  }

  function histScore() {
    let same = 0, total = 0;
    for (const ev of STORY) {
      if (!(ev.id in S.hist) || !(ev.choices || []).some((c) => c.hist)) continue;
      total++;
      if (ev.choices[S.hist[ev.id]].hist) same++;
    }
    return { same, total };
  }

  async function showEnding(id) {
    const E = ENDINGS[id];
    drop(SAVE_KEY);
    if (id !== '1026') { await fadeOut(); }
    Scenes.set(E.scene); Sound.play(E.music);
    $('#hud').classList.add('hidden');
    if (id !== '1026') await fadeIn();
    for (const line of E.lines) await say(line);
    $('#dialog').classList.add('hidden');
    mode = 'ending';
    meta.endings[id] = true; saveMeta();
    unlock('ACH_FIRST_END');
    if (id === '1026') unlock('ACH_HISTORY');
    const alts = Object.keys(meta.endings).filter((k) => ENDINGS[k] && ENDINGS[k].alt).length;
    if (alts >= 5) unlock('ACH_IFS');
    if (Object.keys(ENDINGS).every((k) => meta.endings[k])) unlock('ACH_ALL_END');
    $('#end-no').textContent = `ENDING ${String(E.no).padStart(2, '0')} / ${Object.keys(ENDINGS).length}`;
    $('#end-title').textContent = E.title;
    const badge = $('#end-badge');
    badge.className = E.alt ? 'alt' : 'hist';
    badge.textContent = E.alt ? '역사와 다른 결말' : '역사의 결말';
    $('#end-epi').textContent = E.epi;
    const st = $('#end-stats'); st.innerHTML = '';
    const { same, total } = histScore();
    const cells = [];
    if (S.stats) for (const k of STAT_KEYS) cells.push([STAT_NAMES[k], S.stats[k]]);
    if (total) cells.push(['역사와 같은 선택', `${same} / ${total}`]);
    cells.forEach(([a, b]) => { const d = document.createElement('div'); d.className = 'st'; d.innerHTML = `${esc(a)}<b>${esc(b)}</b>`; st.appendChild(d); });
    $('#ending').classList.remove('hidden');
    Sound.sfx('stamp');
  }

  /* ── 업적 ── */
  const toastQ = [];
  let toasting = false;
  function unlock(id) {
    if (meta.ach[id]) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    meta.ach[id] = Date.now(); saveMeta();
    try { native && native.achievement && native.achievement(id); } catch (e) { /* 스팀 미연결 */ }
    toastQ.push(a); pumpToast();
  }
  async function pumpToast() {
    if (toasting) return;
    toasting = true;
    while (toastQ.length) {
      const a = toastQ.shift(), t = $('#toast');
      t.innerHTML = `업적 달성<b>${esc(a.name)}</b>${esc(a.desc)}`;
      Sound.sfx('chime');
      t.classList.add('show'); await wait(2800); t.classList.remove('show'); await wait(400);
    }
    toasting = false;
  }
  function checkArchive() {
    if (STORY.filter((e) => e.note).every((e) => meta.notes[e.id])) unlock('ACH_ARCHIVE');
  }

  /* ── 패널 ── */
  function openPanel(title, html, onMount) {
    $('#panel-title').textContent = title;
    $('#panel-body').innerHTML = html;
    $('#panel-body').scrollTop = 0;
    $('#panel').classList.remove('hidden');
    panelOpen = true;
    onMount && onMount($('#panel-body'));
    Sound.sfx('page');
  }
  function closePanel() { $('#panel').classList.add('hidden'); panelOpen = false; if (mode === 'title') $('#title-menu button').focus({ preventScroll: true }); }
  $('#panel-close').addEventListener('click', closePanel);

  function openArchive() {
    const evs = STORY.filter((e) => e.note), got = evs.filter((e) => meta.notes[e.id]).length;
    const html = `<p class="item meta" style="border:0;background:none;padding:0 0 8px">열람한 기록 ${got} / ${evs.length} · 이야기를 진행하면 기록이 열립니다.</p><div class="list">` +
      evs.map((e) => meta.notes[e.id]
        ? `<div class="item"><details><summary><div class="meta">${esc(e.date)} · ${esc(CHAPTERS[e.ch].no)}</div><h3>${esc(e.title)}</h3></summary><p>${esc(e.note)}</p></details></div>`
        : `<div class="item locked"><div class="meta">${esc(e.date)}</div><h3>???</h3></div>`).join('') + '</div>';
    openPanel('기록 보관소', html);
  }
  function openEndings() {
    const list = Object.entries(ENDINGS).sort((a, b) => a[1].no - b[1].no);
    const got = list.filter(([k]) => meta.endings[k]).length;
    const html = `<p class="item meta" style="border:0;background:none;padding:0 0 8px">본 엔딩 ${got} / ${list.length}</p><div class="grid2">` +
      list.map(([k, e]) => meta.endings[k]
        ? `<div class="item got"><div class="meta">ENDING ${String(e.no).padStart(2, '0')} · ${e.alt ? '역사와 다른 결말' : '역사의 결말'}</div><h3>${esc(e.title)}</h3><p>${esc(e.epi)}</p></div>`
        : `<div class="item locked"><div class="meta">ENDING ${String(e.no).padStart(2, '0')}</div><h3>???</h3></div>`).join('') + '</div>';
    openPanel('엔딩 목록', html);
  }
  function openAchievements() {
    const got = ACHIEVEMENTS.filter((a) => meta.ach[a.id]).length;
    const html = `<p class="item meta" style="border:0;background:none;padding:0 0 8px">달성 ${got} / ${ACHIEVEMENTS.length}</p><div class="list">` +
      ACHIEVEMENTS.map((a) => `<div class="item ${meta.ach[a.id] ? 'got' : 'locked'}"><h3>${esc(a.name)}</h3><div class="meta">${esc(a.desc)}</div></div>`).join('') + '</div>';
    openPanel('업적', html);
  }
  function openLog() {
    const lines = (S && S.log) || [];
    const html = lines.length ? lines.slice(-80).map(([w, t]) => w === 'n' || w === 'sys'
      ? `<div class="log-line n">${esc(t)}</div>`
      : `<div class="log-line"><b style="color:${SPEAKER_COLORS[w] || '#c8b8a0'}">${esc(w)}</b>${esc(t)}</div>`).join('') : '<p>아직 기록이 없습니다.</p>';
    openPanel('지난 대사', html, (b) => { b.scrollTop = b.scrollHeight; });
  }
  function openSettings() {
    const s = meta.settings;
    const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const html = `
      <div class="setting"><label>배경 음악</label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-vol="music"></div>
      <div class="setting"><label>효과음</label><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-vol="sfx"></div>
      <div class="setting"><label>글자 속도</label>${seg('speed', [['slow', '느리게'], ['normal', '보통'], ['fast', '빠르게'], ['instant', '즉시']])}</div>
      <div class="setting"><label>미니게임 자동 진행<span class="hint">켜면 미니게임을 건너뛰고 실제 역사의 결과로 진행합니다.</span></label>${seg('autoMg', [['false', '끄기'], ['true', '켜기']])}</div>
      <div class="setting"><label>전체 화면<span class="hint">F11 키로도 전환할 수 있습니다.</span></label><button class="btn" id="fs-btn" style="font-size:15px;padding:6px 16px">전환</button></div>
      <div class="setting"><label>모든 기록 지우기<span class="hint">엔딩·업적·기록 보관소·저장된 진행이 모두 사라집니다.</span></label><button class="danger" id="wipe">지우기</button></div>`;
    openPanel('설정', html, (b) => {
      b.querySelectorAll('[data-vol]').forEach((r) => r.addEventListener('input', () => {
        s[r.dataset.vol] = parseFloat(r.value); Sound.setVolume(r.dataset.vol, s[r.dataset.vol]); saveMeta();
      }));
      b.querySelectorAll('.seg').forEach((sg) => sg.addEventListener('click', (e) => {
        const bt = e.target.closest('button'); if (!bt) return;
        const key = sg.dataset.key; let v = bt.dataset.v;
        if (v === 'true' || v === 'false') v = v === 'true';
        s[key] = v; saveMeta();
        sg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === bt));
        Sound.sfx('select');
      }));
      $('#fs-btn').addEventListener('click', toggleFullscreen);
      $('#wipe').addEventListener('click', async () => {
        if (!(await confirmBox('정말 모든 기록을 지울까요? 되돌릴 수 없습니다.'))) { openSettings(); return; }
        meta.endings = {}; meta.notes = {}; meta.ach = {}; saveMeta(); drop(SAVE_KEY);
        closePanel(); refreshTitle();
      });
    });
  }
  function openCredits() {
    const html = `<div class="list">
      <div class="item"><h3>조국과 민족을 위하여 — 박정희 일대기</h3><p>기획 · 각본 · 프로그래밍 · 픽셀 아트 · 음악: 조국과 민족을 위하여 제작팀<br>모든 그림은 코드로 그렸고, 모든 음악과 효과음은 Web Audio로 실시간 합성합니다.</p></div>
      <div class="item"><h3>글꼴</h3><p>갈무리(Galmuri) © 이민서 — SIL Open Font License 1.1</p></div>
      <div class="item"><h3>더 읽을거리</h3><p>국사편찬위원회 「우리역사넷」, 한국학중앙연구원 「한국민족문화대백과사전」, 국가정보원 과거사건 진실규명을 통한 발전위원회 보고서(2007), 진실·화해를위한과거사정리위원회 조사 보고서, 각 사건의 재심 판결문.</p></div>
      <div class="item"><h3>일러두기</h3><p>이 게임은 실존 인물과 사건을 다루는 교육용 역사 시뮬레이션입니다. ‘역사와 다른 선택’과 ‘(가정)’은 상상이며, 일부 대사는 기록과 증언을 바탕으로 각색했습니다. 수치와 날짜는 공개된 자료를 따랐지만, 자료마다 차이가 있을 수 있습니다.</p></div>
    </div>`;
    openPanel('만든 사람들', html);
  }
  function openPause() {
    const html = `<div class="pause-menu">
      <button class="btn" data-p="resume">계속하기</button>
      <button class="btn" data-p="log">지난 대사</button>
      <button class="btn" data-p="archive">기록 보관소</button>
      <button class="btn" data-p="settings">설정</button>
      <button class="btn" data-p="title">타이틀로 (사건 시작 시점까지 저장됨)</button></div>`;
    openPanel('일시 정지', html, (b) => {
      b.querySelector('.btn').focus({ preventScroll: true });
      b.addEventListener('click', (e) => {
        const p = e.target.closest('[data-p]'); if (!p) return;
        const a = p.dataset.p;
        if (a === 'resume') closePanel();
        if (a === 'log') openLog();
        if (a === 'archive') openArchive();
        if (a === 'settings') openSettings();
        if (a === 'title') { closePanel(); location.reload(); }
      });
    });
  }
  function confirmBox(msg) {
    return new Promise((resolve) => {
      openPanel('확인', `<p style="margin-top:40px;text-align:center">${esc(msg)}</p><div class="end-btns" style="margin-top:40px"><button class="btn" data-c="yes">예</button><button class="btn" data-c="no">아니요</button></div>`, (b) => {
        b.querySelector('[data-c="no"]').focus({ preventScroll: true });
        b.addEventListener('click', (e) => {
          const c = e.target.closest('[data-c]'); if (!c) return;
          closePanel(); resolve(c.dataset.c === 'yes');
        });
      });
    });
  }
  function toggleFullscreen() {
    if (native && native.toggleFullscreen) { native.toggleFullscreen(); return; }
    try {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    } catch (e) { /* 지원하지 않는 환경 */ }
  }

  /* ── 타이틀 ── */
  function refreshTitle() {
    $('[data-act="continue"]').disabled = !load(SAVE_KEY, null);
  }
  function showTitle() {
    mode = 'title';
    Scenes.set('title'); Sound.play('title');
    $('#hud').classList.add('hidden'); $('#dialog').classList.add('hidden'); $('#choices').classList.add('hidden');
    $('#ending').classList.add('hidden');
    $('#title').classList.remove('hidden');
    $('#title-menu').classList.remove('hidden');
    $('.press') && $('.press').remove();
    refreshTitle();
    $('#title-menu button:not(:disabled)').focus({ preventScroll: true });
  }
  async function newGame() {
    if (load(SAVE_KEY, null) && !(await confirmBox('저장된 진행이 있습니다. 처음부터 다시 시작할까요?'))) return;
    S = { idx: 0, ch: 0, amb: 0, con: 0, stats: null, hist: {}, log: [] };
    await fadeOut();
    play();
  }
  async function continueGame() {
    const sv = load(SAVE_KEY, null);
    if (!sv) return;
    S = sv; S.log = S.log || [];
    await fadeOut();
    play();
  }
  $('#title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled || busy) return;
    Sound.sfx('select');
    const a = b.dataset.act;
    if (a === 'new') newGame();
    if (a === 'continue') continueGame();
    if (a === 'archive') openArchive();
    if (a === 'endings') openEndings();
    if (a === 'achievements') openAchievements();
    if (a === 'settings') openSettings();
    if (a === 'credits') openCredits();
    if (a === 'quit' && native) native.quit();
  });
  $('#title-menu').addEventListener('mouseover', (e) => { const b = e.target.closest('button'); if (b && !b.disabled) { b.focus({ preventScroll: true }); } });
  $('#ending').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'title') { S = null; showTitle(); }
    if (b.dataset.act === 'endings') openEndings();
  });
  $('#hud-menu').addEventListener('click', () => { if (mode === 'game' && !panelOpen) openPause(); });

  /* ── 입력 ── */
  window.addEventListener('keydown', (e) => {
    if (Minigames.isActive()) return;
    if (e.code === 'F11' && native) { e.preventDefault(); toggleFullscreen(); return; }
    if (mode === 'splash') { e.preventDefault(); startFromSplash(); return; }
    if (panelOpen) { if (e.key === 'Escape') closePanel(); return; }
    if (noteCtx) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); noteCtx.close(); } return; }
    if (mode === 'title') {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const bs = [...document.querySelectorAll('#title-menu button')].filter((b) => !b.disabled && b.offsetParent);
        const i = bs.indexOf(document.activeElement);
        bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus({ preventScroll: true });
        Sound.sfx('hover');
      }
      return;
    }
    if (mode === 'ending') return;
    if (choiceCtx) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= choiceCtx.n) { e.preventDefault(); choiceCtx.pick(n - 1); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); choiceCtx.move(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); choiceCtx.move(-1); return; }
      if ((e.code === 'Enter' || e.code === 'Space') && choiceCtx.sel >= 0) { e.preventDefault(); choiceCtx.pick(choiceCtx.sel); return; }
    }
    if (e.key === 'Escape' && mode === 'game') { openPause(); return; }
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advance(); return; }
    if (e.key === 'Control') { skipHold = true; if (typing) (typing.done ? scheduleAuto(typing) : finishType(typing)); }
    if (e.key === 'a' || e.key === 'A') { autoMode = !autoMode; skipMode = false; syncDlgBtns(); if (typing && typing.done) scheduleAuto(typing); }
    if (e.key === 'l' || e.key === 'L') openLog();
  });
  window.addEventListener('keyup', (e) => { if (e.key === 'Control') skipHold = false; });
  window.addEventListener('blur', () => { skipHold = false; });

  /* ── 시작 ── */
  function startFromSplash() {
    if (mode !== 'splash') return;
    Sound.unlock();
    Sound.setVolume('music', meta.settings.music);
    Sound.setVolume('sfx', meta.settings.sfx);
    showTitle();
  }

  async function boot() {
    fit();
    if (native) document.body.classList.add('native');
    buildMeters();
    Scenes.init($('#bg'));
    Minigames.init($('#mg'));
    try {
      await Promise.race([
        Promise.all(['24px Galmuri11', '24px Galmuri11Bold', '30px Galmuri14', '12px Galmuri11'].map((f) => document.fonts.load(f, '가'))),
        wait(2500),
      ]);
    } catch (e) { /* 글꼴 로드 실패 시 기본 글꼴 */ }
    Scenes.set('title');
    $('#title').classList.remove('hidden');
    $('#title-menu').classList.add('hidden');
    const press = document.createElement('div');
    press.className = 'press';
    press.style.cssText = 'margin-top:60px;font-size:24px;color:#efe6d2;animation:blink 1.2s steps(2) infinite;text-shadow:0 3px 0 rgba(0,0,0,.6)';
    press.textContent = '클릭하거나 아무 키나 누르세요';
    $('#title').insertBefore(press, $('#title-menu'));
    $('#stage').addEventListener('pointerdown', startFromSplash, { once: true });
    // 디버그·테스트용 훅
    window.__joguk = { meta, get state() { return S; }, unlock, Scenes, jump: (id) => { const i = STORY.findIndex((e) => e.id === id); if (i >= 0) S.idx = i; } };
  }
  boot();
})();
