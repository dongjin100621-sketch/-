'use strict';
/* 뽀모도로: 집중 → 짧은 휴식을 반복하고 4번째마다 긴 휴식. 상태는 저장되어 새로고침해도 이어진다. */
(function () {
  const A = App;
  const { esc, icon } = A;
  const C = 2 * Math.PI * 54;
  const PHASE = { focus: '집중 시간', short: '짧은 휴식', long: '긴 휴식' };
  const DEF = { phase: 'focus', round: 0, remainingMs: 25 * 60000, endAt: null, running: false, focusMin: 25, shortMin: 5, longMin: 15, auto: false, task: '' };

  if (!A.data.pomo) A.data.pomo = {};
  A.data.pomo = Object.assign({}, DEF, A.data.pomo);
  const P = () => A.data.pomo;
  const remain = () => (P().running ? Math.max(0, P().endAt - Date.now()) : P().remainingMs);
  const dur = (ph = P().phase) => (ph === 'focus' ? P().focusMin : ph === 'short' ? P().shortMin : P().longMin) * 60000;

  /* 집중이 끝난 기록: pomoLog[ymd] = 횟수 */
  function logFocus() {
    const t = A.today();
    A.data.pomoLog[t] = (A.data.pomoLog[t] || 0) + 1;
    A.save('pomoLog');
  }
  function advance(completed) {
    const p = P();
    if (p.phase === 'focus') {
      if (completed) { p.round = (p.round || 0) + 1; logFocus(); }
      p.phase = completed && p.round >= 4 ? 'long' : 'short';
    } else {
      if (p.phase === 'long') p.round = 0;
      p.phase = 'focus';
    }
    p.remainingMs = dur(p.phase);
    p.running = false; p.endAt = null;
    A.save('pomo');
  }
  function start() {
    const p = P();
    p.endAt = Date.now() + p.remainingMs; p.running = true;
    A.save('pomo'); sync();
  }
  function pause() {
    const p = P();
    p.remainingMs = remain(); p.running = false; p.endAt = null;
    A.save('pomo'); sync();
  }
  function sync() {
    if (P().running) A.Wake.hold('pomo'); else A.Wake.release('pomo');
    A.emit('pomo:change');
  }

  /* 화면과 상관없이 끝났는지 확인 */
  A.on('tick', () => {
    const p = P();
    if (!(p.running && Date.now() >= p.endAt)) return;
    const late = Date.now() - p.endAt;
    const was = p.phase;
    advance(true);
    const q = P();
    const next = `${PHASE[q.phase]} ${q.phase === 'focus' ? q.focusMin : q.phase === 'long' ? q.longMin : q.shortMin}분`;
    if (q.auto && late < 60000) {
      start();
      A.Sound.preview(A.data.prefs.sound);
      A.toast(was === 'focus' ? `집중 끝 · ${next} 시작` : `휴식 끝 · ${next} 시작`);
      A.notify(was === 'focus' ? '집중 시간 끝' : '휴식 끝', `${next}을 시작했어요`);
    } else {
      sync();
      if (late < 10 * 60 * 1000) {
        A.Ringer.start(was === 'focus'
          ? { title: '집중 시간 끝', sub: `${next}을 시작해 보세요` }
          : { title: '휴식 끝', sub: '다시 집중할 시간이에요' });
      }
    }
  });
  if (P().running) A.Wake.hold('pomo');

  /* 탭 제목에 남은 시간 */
  A.on('tick', () => {
    if (A.Ringer.active()) return;
    if (P().running) document.title = `${A.fmtDur(remain())} · ${PHASE[P().phase]}`;
    else if (/^\d/.test(document.title)) document.title = '집중실';
  });

  function ring(progress) {
    const off = C * (1 - A.clamp(progress, 0, 1));
    return `<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-track" cx="60" cy="60" r="54" fill="none" stroke-width="6"/><circle class="ring-fill" cx="60" cy="60" r="54" fill="none" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/></svg>`;
  }
  function streak() {
    let n = 0, d = new Date();
    if (!A.data.pomoLog[A.ymd(d)]) d = A.addDays(d, -1);
    while (A.data.pomoLog[A.ymd(d)]) { n++; d = A.addDays(d, -1); }
    return n;
  }

  A.register({
    id: 'pomodoro', label: '뽀모도로', icon: 'timer',
    render(el) {
      el.innerHTML = `
        <div class="page">
          <div class="page-head"><div><h1>뽀모도로</h1><p class="sub">집중 ${P().focusMin}분, 휴식 ${P().shortMin}분. 4번 하면 긴 휴식이에요.</p></div></div>
          <div class="player">
            <section class="panel timer-stage" id="pm-stage"></section>
            <div style="display:grid;gap:16px;align-content:start">
              <section class="panel" id="pm-sound"></section>
              <section class="panel" id="pm-stats"></section>
            </div>
          </div>
        </div>`;
      const $ = s => el.querySelector(s);
      const stage = $('#pm-stage');

      function drawStage() {
        const p = P(), full = dur();
        const fresh = !p.running && p.remainingMs === full;
        const todayN = A.data.pomoLog[A.today()] || 0;
        stage.innerHTML = `
          <div class="ring ${p.phase === 'focus' ? '' : 'break'}">${ring(remain() / full)}<div class="ring-center"><span class="ring-label">${PHASE[p.phase]}</span><span class="ring-time" id="pm-time">${A.fmtDur(remain())}</span><span class="pomo-dots" aria-label="이번 사이클 ${p.round}회 완료">${[0, 1, 2, 3].map(i => `<i class="${i < p.round ? 'on' : ''}"></i>`).join('')}</span></div></div>
          <input class="input" id="pm-task" maxlength="60" placeholder="지금 집중할 일 (선택)" value="${esc(p.task)}" aria-label="지금 집중할 일" style="max-width:360px;text-align:center">
          <div class="timer-controls">
            ${p.running
              ? `<button type="button" class="btn lg" data-act="pause">${icon('pause', 18)} 일시정지</button>`
              : `<button type="button" class="btn primary lg" data-act="start">${icon('play', 18)} ${fresh ? '시작' : '계속'}</button>`}
            <button type="button" class="btn lg" data-act="skip">건너뛰기</button>
            ${!fresh || p.round ? '<button type="button" class="btn lg ghost" data-act="reset">처음부터</button>' : ''}
          </div>
          <p class="muted">오늘 집중 <strong class="mono">${todayN}</strong>회 · ${todayN * p.focusMin}분</p>
          <form class="pomo-set" id="pm-set" aria-label="뽀모도로 시간 설정">
            <label class="field"><span>집중 (분)</span><input class="input" type="number" min="1" max="120" id="pm-focus" value="${p.focusMin}" inputmode="numeric"></label>
            <label class="field"><span>짧은 휴식</span><input class="input" type="number" min="1" max="60" id="pm-short" value="${p.shortMin}" inputmode="numeric"></label>
            <label class="field"><span>긴 휴식</span><input class="input" type="number" min="1" max="60" id="pm-long" value="${p.longMin}" inputmode="numeric"></label>
          </form>
          <div class="eq-prow" style="width:100%;max-width:360px"><div class="grow"><b>자동으로 이어서 시작</b><p class="faint" style="font-size:13px;margin:2px 0 0">끝나면 알람 대신 짧은 소리만 내고 다음 단계를 바로 시작해요.</p></div><button type="button" class="switch" role="switch" id="pm-auto" aria-checked="${p.auto}" aria-label="자동으로 이어서 시작"></button></div>`;
      }
      function drawSound() {
        const Amb = A.music.Amb;
        $('#pm-sound').innerHTML = `
          <div class="panel-head"><h2 class="panel-title">집중 사운드</h2><a class="btn sm ghost" href="#music">음악 열기</a></div>
          <div class="presets">${Object.keys(Amb.SOUNDS).map(id => `<button type="button" class="chip ${Amb.on(id) ? 'on' : ''}" data-amb="${id}" aria-pressed="${Amb.on(id)}">${icon(Amb.SOUNDS[id].icon, 15)} ${Amb.SOUNDS[id].label}</button>`).join('')}</div>
          <p class="faint" style="font-size:13px">${A.music.audio.paused ? '내 음악은 음악 탭에서 골라 틀 수 있어요. 틀어 두면 다른 화면에서도 아래 미니 플레이어로 조절해요.' : '음악이 재생 중이에요. 아래 미니 플레이어에서 조절해요.'}</p>`;
      }
      function drawStats() {
        const days = A.lastDays(7);
        const log = A.data.pomoLog;
        const items = days.map(d => { const n = log[A.ymd(d)] || 0; return { label: A.WD[d.getDay()], value: n, now: A.ymd(d) === A.today(), tip: `${d.getMonth() + 1}월 ${d.getDate()}일 · ${n}회 · ${n * P().focusMin}분` }; });
        const week = items.reduce((s, i) => s + i.value, 0);
        const total = Object.values(log).reduce((s, n) => s + n, 0);
        $('#pm-stats').innerHTML = `
          <div class="panel-head"><h2 class="panel-title">집중 기록</h2><span class="faint">최근 7일 ${week}회</span></div>
          ${A.miniBars(items, { label: '최근 7일 집중 횟수' })}
          <p class="muted" style="margin:10px 0 0">연속 <strong class="mono">${streak()}</strong>일 · 지금까지 <strong class="mono">${total}</strong>회</p>`;
      }
      function update() {
        const t = $('#pm-time'); if (!t) return;
        t.textContent = A.fmtDur(remain());
        const fill = stage.querySelector('.ring-fill');
        if (fill) fill.setAttribute('stroke-dashoffset', (C * (1 - A.clamp(remain() / dur(), 0, 1))).toFixed(2));
      }
      function draw() {
        const keep = document.activeElement && document.activeElement.id === 'pm-task';
        if (!keep) drawStage();
        drawSound(); drawStats();
      }

      el.addEventListener('click', e => {
        const amb = e.target.closest('[data-amb]');
        if (amb) { const a = A.music.Amb, id = amb.dataset.amb; if (a.on(id)) a.stop(id); else a.start(id); return; }
        const sw = e.target.closest('#pm-auto');
        if (sw) { P().auto = !P().auto; A.save('pomo'); sw.setAttribute('aria-checked', P().auto); return; }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        A.Sound.get();
        const p = P();
        switch (b.dataset.act) {
          case 'start': start(); break;
          case 'pause': pause(); break;
          case 'skip': advance(false); sync(); break;
          case 'reset': p.phase = 'focus'; p.round = 0; p.running = false; p.endAt = null; p.remainingMs = dur('focus'); A.save('pomo'); sync(); break;
        }
      });
      el.addEventListener('input', e => { if (e.target.id === 'pm-task') { P().task = e.target.value; A.save('pomo'); } });
      el.addEventListener('change', e => {
        if (!e.target.closest('#pm-set')) return;
        const p = P();
        const v = (id, lo, hi, d) => A.clamp(Math.round(Number($(id).value) || d), lo, hi);
        const wasFresh = !p.running && p.remainingMs === dur();
        p.focusMin = v('#pm-focus', 1, 120, 25); p.shortMin = v('#pm-short', 1, 60, 5); p.longMin = v('#pm-long', 1, 60, 15);
        if (wasFresh) p.remainingMs = dur();
        A.save('pomo'); draw();
      });
      el.addEventListener('submit', e => e.preventDefault());

      draw();
      const offs = [A.on('tick', update), A.on('pomo:change', draw), A.on('music:change', drawSound)];
      return () => offs.forEach(f => f());
    }
  });
})();
