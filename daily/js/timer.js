'use strict';
/* 타이머 · 스톱워치 · 뽀모도로. 상태는 저장되어 새로고침하거나 다른 화면으로 가도 이어진다. */
(function () {
  const A = App;
  const { esc, icon } = A;
  const C = 2 * Math.PI * 54;

  /* ---------- 상태 ---------- */
  if (!A.data.timer) A.data.timer = { totalMs: 180000, remainingMs: 180000, endAt: null, running: false, label: '' };
  if (!A.data.stopwatch) A.data.stopwatch = { startAt: null, accMs: 0, running: false, laps: [] };
  if (!A.data.pomo) A.data.pomo = { phase: 'focus', round: 0, remainingMs: 25 * 60000, endAt: null, running: false, focusMin: 25, shortMin: 5, longMin: 15 };
  const T = () => A.data.timer, S = () => A.data.stopwatch, P = () => A.data.pomo;

  const tRemain = () => (T().running ? Math.max(0, T().endAt - Date.now()) : T().remainingMs);
  const sElapsed = () => S().accMs + (S().running ? Date.now() - S().startAt : 0);
  const pRemain = () => (P().running ? Math.max(0, P().endAt - Date.now()) : P().remainingMs);
  const PHASE = { focus: '집중 시간', short: '짧은 휴식', long: '긴 휴식' };
  const pDur = (ph = P().phase) => (ph === 'focus' ? P().focusMin : ph === 'short' ? P().shortMin : P().longMin) * 60000;
  function minText(ms) {
    const s = Math.round(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return [h ? `${h}시간` : '', m ? `${m}분` : '', r ? `${r}초` : ''].filter(Boolean).join(' ') || '0초';
  }

  function timerStart(ms, label) {
    const t = T();
    if (ms != null) { t.totalMs = ms; t.remainingMs = ms; t.label = label || ''; }
    t.endAt = Date.now() + t.remainingMs;
    t.running = true;
    A.save('timer');
    A.emit('timer:change');
  }
  function timerPause() {
    const t = T();
    t.remainingMs = tRemain(); t.running = false; t.endAt = null;
    A.save('timer'); A.emit('timer:change');
  }
  function timerReset() {
    const t = T();
    t.running = false; t.endAt = null; t.remainingMs = t.totalMs;
    A.save('timer'); A.emit('timer:change');
  }
  function pomoAdvance(completed) {
    const p = P();
    if (p.phase === 'focus') {
      if (completed) {
        p.round = (p.round || 0) + 1;
        const t = A.today();
        A.data.pomoLog[t] = (A.data.pomoLog[t] || 0) + 1;
        A.save('pomoLog');
      }
      p.phase = completed && p.round >= 4 ? 'long' : 'short';
    } else {
      if (p.phase === 'long') p.round = 0;
      p.phase = 'focus';
    }
    p.remainingMs = pDur(p.phase);
    p.running = false;
    p.endAt = null;
    A.save('pomo');
  }

  /* 화면과 상관없이 끝났는지 확인 */
  A.on('tick', () => {
    const now = Date.now();
    const t = T();
    if (t.running && now >= t.endAt) {
      const late = now - t.endAt;
      t.running = false; t.endAt = null; t.remainingMs = t.totalMs;
      A.save('timer');
      if (late < 10 * 60 * 1000) A.Ringer.start({ title: t.label ? `${t.label} 끝` : '타이머 끝', sub: `${minText(t.totalMs)}이 지났어요` });
      A.emit('timer:change');
    }
    const p = P();
    if (p.running && now >= p.endAt) {
      const late = now - p.endAt;
      const was = p.phase;
      pomoAdvance(true);
      if (late < 10 * 60 * 1000) {
        A.Ringer.start(was === 'focus'
          ? { title: '집중 시간 끝', sub: `${PHASE[P().phase]} ${P().phase === 'long' ? P().longMin : P().shortMin}분을 시작해 보세요` }
          : { title: '휴식 끝', sub: '다시 집중할 시간이에요' });
      }
      A.emit('timer:change');
    }
  });

  function summary() {
    if (T().running) return `타이머 ${A.fmtDur(tRemain())} 남음${T().label ? ' · ' + T().label : ''}`;
    if (P().running) return `뽀모도로 ${PHASE[P().phase]} ${A.fmtDur(pRemain())} 남음`;
    if (S().running) return `스톱워치 ${A.fmtDur(sElapsed())} 진행 중`;
    return '';
  }
  function badge() {
    if (T().running) return A.fmtDur(tRemain());
    if (P().running) return A.fmtDur(pRemain());
    if (S().running) return '●';
    return '';
  }
  A.timerUtil = { summary, badge };

  /* ---------- 화면 ---------- */
  const PRESETS = [[60, '1분', ''], [180, '3분 · 라면', '라면'], [300, '5분', ''], [420, '7분 · 반숙 달걀', '반숙 달걀'], [600, '10분', ''], [900, '15분', ''], [1800, '30분', ''], [3600, '1시간', '']];

  function ringSVG(progress, cls = '') {
    const off = C * (1 - A.clamp(progress, 0, 1));
    return `<svg viewBox="0 0 120 120" aria-hidden="true" class="${cls}"><circle class="ring-track" cx="60" cy="60" r="54" fill="none" stroke-width="6"/><circle class="ring-fill" cx="60" cy="60" r="54" fill="none" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/></svg>`;
  }

  A.register({
    id: 'timer', label: '타이머', icon: 'timer',
    render(el) {
      let tab = A.data.ui.timerTab || 'timer';
      el.innerHTML = `
        <div class="page">
          <div class="page-head">
            <div><h1>타이머</h1><p class="sub">다른 화면으로 가도 계속 흘러가요.</p></div>
            <div class="seg" id="tm-tabs" role="tablist" aria-label="종류">
              <button type="button" role="tab" data-tab="timer">타이머</button>
              <button type="button" role="tab" data-tab="stopwatch">스톱워치</button>
              <button type="button" role="tab" data-tab="pomo">뽀모도로</button>
            </div>
          </div>
          <section class="panel timer-stage" id="tm-stage"></section>
        </div>`;
      const $ = s => el.querySelector(s);
      const stage = $('#tm-stage');
      let raf = 0;

      /* 타이머 */
      function drawTimer() {
        const t = T();
        const paused = !t.running && t.remainingMs > 0 && t.remainingMs < t.totalMs;
        if (!t.running && !paused) {
          const tot = Math.round(t.totalMs / 1000);
          stage.innerHTML = `
            <form class="hms" id="tm-form" aria-label="시간 정하기">
              <label>시간<input class="input" type="number" id="tm-h" min="0" max="23" value="${Math.floor(tot / 3600)}" inputmode="numeric"></label>
              <span class="colon">:</span>
              <label>분<input class="input" type="number" id="tm-m" min="0" max="59" value="${Math.floor((tot % 3600) / 60)}" inputmode="numeric"></label>
              <span class="colon">:</span>
              <label>초<input class="input" type="number" id="tm-s" min="0" max="59" value="${tot % 60}" inputmode="numeric"></label>
            </form>
            <div class="presets">${PRESETS.map(([s, l, label]) => `<button type="button" class="chip" data-preset="${s}" data-label="${esc(label)}">${l}</button>`).join('')}</div>
            <div class="timer-controls"><button type="button" class="btn primary lg" data-act="t-start">${icon('play', 18)} 시작</button></div>`;
          return;
        }
        stage.innerHTML = `
          <div class="ring">${ringSVG(tRemain() / t.totalMs)}<div class="ring-center"><span class="ring-time" id="tm-time">${A.fmtDur(tRemain())}</span><span class="ring-label">${esc(t.label || minText(t.totalMs) + ' 타이머')}</span><span class="faint" id="tm-end" style="font-size:13px"></span></div></div>
          <div class="timer-controls">
            ${t.running
              ? `<button type="button" class="btn lg" data-act="t-pause">${icon('pause', 18)} 일시정지</button>`
              : `<button type="button" class="btn primary lg" data-act="t-resume">${icon('play', 18)} 계속</button>`}
            <button type="button" class="btn lg" data-act="t-add">+1분</button>
            <button type="button" class="btn lg ghost" data-act="t-reset">취소</button>
          </div>`;
        updateTimer();
      }
      function updateTimer() {
        const t = T();
        const time = $('#tm-time');
        if (!time) return;
        time.textContent = A.fmtDur(tRemain());
        const fill = stage.querySelector('.ring-fill');
        if (fill) fill.setAttribute('stroke-dashoffset', (C * (1 - A.clamp(tRemain() / t.totalMs, 0, 1))).toFixed(2));
        const end = $('#tm-end');
        if (end) {
          if (t.running) { const c = A.fmtClock(new Date(t.endAt)); end.textContent = `${c.ampm} ${c.hm}에 끝나요`; }
          else end.textContent = '일시정지됨';
        }
      }

      /* 스톱워치 */
      function drawStopwatch() {
        const s = S();
        const laps = s.laps;
        let best = -1, worst = -1;
        if (laps.length >= 3) {
          const ms = laps.map(l => l.lap);
          best = ms.indexOf(Math.min(...ms));
          worst = ms.indexOf(Math.max(...ms));
        }
        stage.innerHTML = `
          <div class="sw-time" id="sw-time">${A.fmtDur(sElapsed(), { cs: true })}</div>
          <div class="timer-controls">
            ${s.running
              ? `<button type="button" class="btn lg" data-act="s-lap">랩</button><button type="button" class="btn primary lg" data-act="s-stop">${icon('pause', 18)} 정지</button>`
              : s.accMs > 0
                ? `<button type="button" class="btn lg ghost" data-act="s-reset">초기화</button><button type="button" class="btn primary lg" data-act="s-start">${icon('play', 18)} 계속</button>`
                : `<button type="button" class="btn primary lg" data-act="s-start">${icon('play', 18)} 시작</button>`}
          </div>
          ${laps.length ? `<div class="laps">${laps.map((l, i) => ({ l, i })).reverse().map(({ l, i }) => `
            <div class="list-row ${i === best ? 'best' : i === worst ? 'worst' : ''}"><span style="width:56px">랩 ${i + 1}</span><span class="grow">${A.fmtDur(l.lap, { cs: true })}</span><span class="faint">${A.fmtDur(l.total, { cs: true })}</span></div>`).join('')}</div>` : ''}`;
        loopStopwatch();
      }
      function loopStopwatch() {
        cancelAnimationFrame(raf);
        const step = () => {
          const t = $('#sw-time');
          if (!t || tab !== 'stopwatch') return;
          t.textContent = A.fmtDur(sElapsed(), { cs: true });
          if (S().running) raf = requestAnimationFrame(step);
        };
        if (S().running) raf = requestAnimationFrame(step);
      }

      /* 뽀모도로 */
      function drawPomo() {
        const p = P();
        const full = pDur();
        const fresh = !p.running && p.remainingMs === full;
        const todayN = A.data.pomoLog[A.today()] || 0;
        stage.innerHTML = `
          <div class="ring ${p.phase === 'focus' ? '' : 'break'}">${ringSVG(pRemain() / full)}<div class="ring-center"><span class="ring-label">${PHASE[p.phase]}</span><span class="ring-time" id="pm-time">${A.fmtDur(pRemain())}</span><span class="pomo-dots" aria-label="이번 사이클 ${p.round}회 완료">${[0, 1, 2, 3].map(i => `<i class="${i < p.round ? 'on' : ''}"></i>`).join('')}</span></div></div>
          <div class="timer-controls">
            ${p.running
              ? `<button type="button" class="btn lg" data-act="p-pause">${icon('pause', 18)} 일시정지</button>`
              : `<button type="button" class="btn primary lg" data-act="p-start">${icon('play', 18)} ${fresh ? '시작' : '계속'}</button>`}
            <button type="button" class="btn lg" data-act="p-skip">건너뛰기</button>
            ${!fresh || p.round ? '<button type="button" class="btn lg ghost" data-act="p-reset">처음부터</button>' : ''}
          </div>
          <p class="muted">오늘 집중 <strong class="mono">${todayN}</strong>회 · ${todayN * p.focusMin}분</p>
          <form class="pomo-set" id="pm-set" aria-label="뽀모도로 시간 설정">
            <label class="field"><span>집중 (분)</span><input class="input" type="number" min="1" max="120" id="pm-focus" value="${p.focusMin}" inputmode="numeric"></label>
            <label class="field"><span>짧은 휴식</span><input class="input" type="number" min="1" max="60" id="pm-short" value="${p.shortMin}" inputmode="numeric"></label>
            <label class="field"><span>긴 휴식</span><input class="input" type="number" min="1" max="60" id="pm-long" value="${p.longMin}" inputmode="numeric"></label>
          </form>
          <p class="faint" style="font-size:13px;text-align:center">집중 4번마다 긴 휴식이 와요.</p>`;
      }
      function updatePomo() {
        const t = $('#pm-time');
        if (!t) return;
        t.textContent = A.fmtDur(pRemain());
        const fill = stage.querySelector('.ring-fill');
        if (fill) fill.setAttribute('stroke-dashoffset', (C * (1 - A.clamp(pRemain() / pDur(), 0, 1))).toFixed(2));
      }

      function draw() {
        el.querySelectorAll('#tm-tabs button').forEach(b => {
          const on = b.dataset.tab === tab;
          b.classList.toggle('on', on);
          b.setAttribute('aria-selected', on);
        });
        cancelAnimationFrame(raf);
        if (tab === 'timer') drawTimer();
        else if (tab === 'stopwatch') drawStopwatch();
        else drawPomo();
      }

      el.addEventListener('click', e => {
        const tb = e.target.closest('[data-tab]');
        if (tb) { tab = tb.dataset.tab; A.data.ui.timerTab = tab; A.save('ui'); draw(); return; }
        const pre = e.target.closest('[data-preset]');
        if (pre) { A.Sound.get(); timerStart(Number(pre.dataset.preset) * 1000, pre.dataset.label); return; }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        A.Sound.get();
        const act = b.dataset.act;
        const t = T(), s = S(), p = P();
        switch (act) {
          case 't-start': {
            const h = Number($('#tm-h').value) || 0, m = Number($('#tm-m').value) || 0, sec = Number($('#tm-s').value) || 0;
            const ms = ((h * 3600) + (m * 60) + sec) * 1000;
            if (ms <= 0) { A.toast('시간을 1초 이상으로 정해 주세요'); return; }
            timerStart(ms, '');
            break;
          }
          case 't-pause': timerPause(); break;
          case 't-resume': timerStart(); break;
          case 't-reset': timerReset(); break;
          case 't-add':
            if (t.running) t.endAt += 60000; else t.remainingMs += 60000;
            t.totalMs += 60000;
            A.save('timer'); A.emit('timer:change');
            break;
          case 's-start': s.startAt = Date.now(); s.running = true; A.save('stopwatch'); draw(); break;
          case 's-stop': s.accMs = sElapsed(); s.running = false; s.startAt = null; A.save('stopwatch'); draw(); break;
          case 's-reset': s.accMs = 0; s.laps = []; A.save('stopwatch'); draw(); break;
          case 's-lap': {
            const total = sElapsed();
            const prev = s.laps.length ? s.laps[s.laps.length - 1].total : 0;
            s.laps.push({ lap: total - prev, total });
            A.save('stopwatch'); draw();
            break;
          }
          case 'p-start': p.endAt = Date.now() + p.remainingMs; p.running = true; A.save('pomo'); A.emit('timer:change'); break;
          case 'p-pause': p.remainingMs = pRemain(); p.running = false; p.endAt = null; A.save('pomo'); A.emit('timer:change'); break;
          case 'p-skip': pomoAdvance(false); A.emit('timer:change'); break;
          case 'p-reset': p.phase = 'focus'; p.round = 0; p.running = false; p.endAt = null; p.remainingMs = pDur('focus'); A.save('pomo'); A.emit('timer:change'); break;
        }
      });
      el.addEventListener('change', e => {
        if (!e.target.closest('#pm-set')) return;
        const p = P();
        const v = (id, lo, hi, d) => A.clamp(Math.round(Number($(id).value) || d), lo, hi);
        const wasFresh = !p.running && p.remainingMs === pDur();
        p.focusMin = v('#pm-focus', 1, 120, 25);
        p.shortMin = v('#pm-short', 1, 60, 5);
        p.longMin = v('#pm-long', 1, 60, 15);
        if (wasFresh) p.remainingMs = pDur();
        A.save('pomo');
        draw();
      });
      el.addEventListener('submit', e => { e.preventDefault(); if (e.target.id === 'tm-form') b('t-start'); });
      const b = act => { const btn = el.querySelector(`[data-act="${act}"]`); btn && btn.click(); };

      draw();
      const offTick = A.on('tick', () => { if (tab === 'timer') updateTimer(); else if (tab === 'pomo') updatePomo(); });
      const offChange = A.on('timer:change', draw);
      return () => { offTick(); offChange(); cancelAnimationFrame(raf); };
    }
  });
})();
