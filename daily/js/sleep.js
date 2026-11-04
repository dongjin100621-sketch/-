'use strict';
/* 잠: 침대 옆 시계 모드(화면 꺼짐 방지 + 알람), 잘 시간 계산기, 취침 알림, 수면 타이머, 호흡, 수면 기록, 아침 브리핑 */
(function () {
  const A = App;
  const { esc, icon } = A;

  const hm = ts => { const c = A.fmtClock(new Date(ts)); return `${c.ampm} ${c.hm}`; };
  function durText(ms) {
    const m = Math.round(ms / 60000), h = Math.floor(m / 60), r = m % 60;
    return h ? `${h}시간${r ? ` ${r}분` : ''}` : `${r}분`;
  }
  function forDay(day) {
    const xs = A.data.sleepLog.filter(s => A.ymd(new Date(s.wake)) === day);
    return xs.sort((a, b) => (b.wake - b.bed) - (a.wake - a.bed))[0] || null;
  }
  function addSleep(bed, wake) {
    A.data.sleepLog.push({ id: A.uid(), bed, wake });
    A.data.sleepLog.sort((a, b) => a.wake - b.wake);
    if (A.data.sleepLog.length > 500) A.data.sleepLog.splice(0, A.data.sleepLog.length - 500);
    A.save('sleepLog');
    A.emit('sleep:change');
  }
  A.sleepUtil = { forDay, durText, hm, addSleep };

  function addAlarm(time, label = '기상') {
    const ex = A.data.alarms.find(a => a.time === time && !a.days.length);
    if (ex) ex.enabled = true;
    else A.data.alarms.push({ id: A.uid(), time, label, days: [], sound: A.data.prefs.sound || 'chime', enabled: true });
    A.save('alarms');
    A.emit('alarms:change');
    A.toast(`${A.fmtHM(time)} 알람을 맞췄어요`);
  }
  const toHM = d => `${A.pad(d.getHours())}:${A.pad(d.getMinutes())}`;

  /* ---------- 수면 타이머: 정한 시간이 지나면 음악과 집중 사운드를 줄이며 끈다 ---------- */
  const SleepTimer = (function () {
    let end = 0;
    function fadeOut() {
      const M = A.music;
      if (!M) return;
      try { M.Amb.stopAll(); } catch (e) { /* noop */ }
      const a = M.audio;
      if (a && !a.paused) {
        const v0 = a.volume;
        let k = 0;
        const st = setInterval(() => {
          k++;
          try { a.volume = Math.max(0, v0 * (1 - k / 20)); } catch (e) { /* iOS는 음량을 바꿀 수 없음 */ }
          if (k >= 20) { clearInterval(st); M.pause(); try { a.volume = v0; } catch (e) { /* noop */ } }
        }, 400);
      }
    }
    A.on('tick', () => { if (end && Date.now() >= end) { end = 0; fadeOut(); A.emit('sleeptimer'); } });
    return {
      set(min) { end = Date.now() + min * 60000; A.emit('sleeptimer'); },
      cancel() { end = 0; A.emit('sleeptimer'); },
      left: () => (end ? Math.max(0, end - Date.now()) : 0)
    };
  })();
  A.sleepTimer = SleepTimer;

  /* ---------- 취침 알림 (잘 시간 30분 전) ---------- */
  let lastMin = -1;
  A.on('tick', now => {
    if (now.getMinutes() === lastMin) return;
    lastMin = now.getMinutes();
    const cfg = A.data.healthCfg;
    if (!cfg.bedRemind || !cfg.bedtime || A.data.sleepMode) return;
    const [h, m] = cfg.bedtime.split(':').map(Number);
    const at = new Date(now); at.setHours(h, m, 0, 0); at.setMinutes(at.getMinutes() - 30);
    const diff = (now - at) / 60000;
    const key = A.ymd(at);
    if (diff >= 0 && diff < 10 && A.data.ui.bedRem !== key) {
      A.data.ui.bedRem = key; A.save('ui');
      A.Sound.preview('bell');
      A.notify('30분 뒤 잘 시간이에요', '저녁 루틴을 시작해 볼까요?');
      A.toast('30분 뒤 잘 시간이에요', { action: '저녁 루틴', duration: 30000, onAction: () => A.go('routine') });
    }
  });

  /* ---------- 침대 옆 시계 모드 ---------- */
  const Night = (function () {
    let el = null, offs = [], hideT = null, lastShift = -1;
    function open() {
      if (el) return;
      if (!A.data.sleepMode) { A.data.sleepMode = { start: Date.now() }; A.save('sleepMode'); }
      A.Wake.hold('night');
      el = document.createElement('div');
      el.className = 'night';
      el.style.setProperty('--dim', A.data.ui.nightDim || 0.6);
      el.innerHTML = `
        <div class="night-face" id="nf">
          <p class="night-clock" id="nf-clock"></p>
          <p class="night-sub" id="nf-sub"></p>
          <p class="night-hint" id="nf-hint">화면을 누르면 메뉴가 나와요</p>
        </div>
        <div class="night-ctl" id="nf-ctl" hidden></div>`;
      document.body.appendChild(el);
      document.documentElement.classList.add('night-on');
      el.addEventListener('click', onClick);
      el.addEventListener('input', e => {
        if (e.target.id === 'nf-dim') { el.style.setProperty('--dim', e.target.value); A.data.ui.nightDim = Number(e.target.value); A.save('ui'); poke(); }
      });
      offs = [
        A.on('tick', tick),
        A.on('sleeptimer', drawCtl),
        A.on('music:change', drawCtl),
        A.on('wake:change', drawCtl),
        A.on('ringer:done', p => {
          const sm = A.data.sleepMode;
          if (p && p.snoozed) return;
          if (sm && Date.now() - sm.start > 2 * 3600e3) close();
        })
      ];
      tick(new Date());
      setTimeout(() => { const h = el && el.querySelector('#nf-hint'); if (h) h.hidden = true; }, 6000);
    }
    function close() {
      if (!el) return;
      const sm = A.data.sleepMode;
      A.data.sleepMode = null; A.save('sleepMode');
      A.Wake.release('night');
      offs.forEach(f => f()); offs = [];
      clearTimeout(hideT);
      el.remove(); el = null;
      document.documentElement.classList.remove('night-on');
      A.emit('night:change');
      if (!sm) return;
      const dur = Date.now() - sm.start;
      if (dur >= 60 * 60e3 && dur < 16 * 3600e3) { addSleep(sm.start, Date.now()); morning(dur); }
      else A.toast('잠 모드를 껐어요');
    }
    function tick(now) {
      if (!el) return;
      const c = A.fmtClock(now);
      el.querySelector('#nf-clock').innerHTML = `<small>${c.ampm}</small>${c.hm}`;
      const next = A.alarmUtil.nextAlarm();
      el.querySelector('#nf-sub').innerHTML = `${now.getMonth() + 1}월 ${now.getDate()}일 (${A.WD[now.getDay()]})` +
        (next ? ` · ${icon('alarm', 14)} ${A.fmtHM(next.alarm.time)} <span>${A.untilText(next.at - now)}</span>` : ' · 켜 둔 알람 없음');
      // 화면 자국을 막기 위해 1분마다 위치를 조금씩 옮긴다
      if (now.getMinutes() !== lastShift) {
        lastShift = now.getMinutes();
        el.querySelector('#nf').style.transform = `translate(${Math.round(Math.random() * 40 - 20)}px, ${Math.round(Math.random() * 40 - 20)}px)`;
      }
      const tl = el.querySelector('#nf-timer');
      if (tl) tl.textContent = SleepTimer.left() ? `${A.fmtDur(SleepTimer.left())} 뒤 소리 끔` : '';
    }
    function showCtl(on) { if (!el) return; el.querySelector('#nf-ctl').hidden = !on; el.classList.toggle('ctl', on); }
    function poke() { clearTimeout(hideT); hideT = setTimeout(() => showCtl(false), 12000); }
    function drawCtl() {
      if (!el) return;
      const box = el.querySelector('#nf-ctl');
      const Amb = A.music && A.music.Amb;
      const sm = A.data.sleepMode;
      box.innerHTML = `
        ${Amb ? `<div class="night-row"><span>소리</span><div class="chips">${Object.entries(Amb.SOUNDS).map(([k, s]) => `<button type="button" class="chip ${Amb.on(k) ? 'on' : ''}" data-amb="${k}">${icon(s.icon, 14)} ${s.label}</button>`).join('')}</div></div>` : ''}
        <div class="night-row"><span>수면 타이머</span><div class="chips">${[15, 30, 45, 60, 90].map(m => `<button type="button" class="chip" data-st="${m}">${m}분</button>`).join('')}${SleepTimer.left() ? '<button type="button" class="chip on" data-st="0">끄기</button>' : ''}</div></div>
        <p class="night-note" id="nf-timer"></p>
        <label class="night-row"><span>밝기</span><input type="range" id="nf-dim" min="0.15" max="1" step="0.05" value="${A.data.ui.nightDim || 0.6}" aria-label="시계 밝기"></label>
        <p class="night-note">${A.Wake.supported ? (A.Wake.active() ? '화면이 꺼지지 않게 해 뒀어요. 충전기에 꽂아 두세요.' : '화면을 한 번 누르면 꺼짐 방지가 켜져요.') : '이 브라우저는 화면 꺼짐 방지를 지원하지 않아요. 기기 설정에서 자동 잠금을 꺼 주세요.'}</p>
        ${sm ? `<p class="night-note">${hm(sm.start)}에 잠 모드를 켰어요</p>` : ''}
        <div class="night-row" style="justify-content:center;gap:10px">
          <button type="button" class="btn" data-n="hide">닫기</button>
          <button type="button" class="btn primary lg" data-n="exit">일어나기</button>
        </div>`;
      tick(new Date());
    }
    function onClick(e) {
      const ctl = el.querySelector('#nf-ctl');
      const amb = e.target.closest('[data-amb]');
      if (amb) { const Amb = A.music.Amb; Amb.on(amb.dataset.amb) ? Amb.stop(amb.dataset.amb) : Amb.start(amb.dataset.amb); poke(); return; }
      const st = e.target.closest('[data-st]');
      if (st) { const m = Number(st.dataset.st); if (m) { SleepTimer.set(m); A.toast(`${m}분 뒤 소리를 꺼요`); } else SleepTimer.cancel(); poke(); return; }
      const n = e.target.closest('[data-n]');
      if (n) { if (n.dataset.n === 'exit') close(); else showCtl(false); return; }
      if (e.target.closest('#nf-ctl')) { poke(); return; }
      showCtl(ctl.hidden);
      if (!ctl.hidden) { drawCtl(); poke(); }
    }
    return { open, close, active: () => !!el };
  })();
  A.night = Night;

  /* ---------- 아침 브리핑 ---------- */
  function morning(dur) {
    const t = A.today();
    const evs = A.calUtil.eventsOn(t);
    const firstList = A.data.todoLists[0].id;
    const todos = A.data.todos.filter(x => !x.done && (x.due ? x.due <= t : x.listId === firstList));
    const r = A.data.routines.find(x => x.when === 'morning');
    const dd = A.data.ddays.filter(d => d.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
    const name = A.data.prefs.name ? `, ${A.data.prefs.name}님` : '';
    const m = A.modal({
      title: `좋은 아침이에요${name}`,
      className: 'brief',
      body: `
        <ul class="brief-list">
          <li>${icon('bed', 18)}<span><b>${durText(dur)}</b> 잤어요</span></li>
          <li>${icon('sun', 18)}<span id="br-weather" class="muted">날씨를 불러오는 중…</span></li>
          <li>${icon('calendar', 18)}<span>${evs.length ? `오늘 일정 <b>${evs.length}개</b> · ${evs.slice(0, 3).map(e => `${e.time ? A.fmtHM(e.time) + ' ' : ''}${esc(e.title)}`).join(', ')}` : '오늘 잡힌 일정이 없어요'}</span></li>
          <li>${icon('todo', 18)}<span>${todos.length ? `할 일 <b>${todos.length}개</b> · ${todos.slice(0, 3).map(x => esc(x.text)).join(', ')}` : '오늘 할 일이 없어요'}</span></li>
          ${dd ? `<li>${icon('flag', 18)}<span>${esc(dd.title)}까지 <b>${A.diffDays(new Date(), A.parseYmd(dd.date)) ? `D-${A.diffDays(new Date(), A.parseYmd(dd.date))}` : 'D-Day'}</b></span></li>` : ''}
        </ul>`,
      actions: [
        { label: '홈으로', kind: 'ghost', onClick: () => A.go('home') },
        ...(r ? [{ label: `${r.name} 시작`, kind: 'primary', onClick: () => A.go('routine') }] : [])
      ]
    });
    if (A.weather && A.weather.load) {
      A.weather.load().then(d => { const s = m.el.querySelector('#br-weather'); if (s) { s.textContent = A.weather.brief(d); s.classList.remove('muted'); } })
        .catch(() => { const s = m.el.querySelector('#br-weather'); if (s) s.textContent = '날씨를 불러오지 못했어요'; });
    }
  }

  // 새로고침해도 잠 모드를 이어 간다 (너무 오래된 건 버린다)
  window.addEventListener('DOMContentLoaded', () => {
    const sm = A.data.sleepMode;
    if (!sm) return;
    if (Date.now() - sm.start > 16 * 3600e3) { A.data.sleepMode = null; A.save('sleepMode'); return; }
    Night.open();
  });

  /* ---------- 화면 ---------- */
  const BREATH = {
    '478': { label: '4-7-8 호흡', note: '잠들기 전에 좋아요', steps: [['들이마셔요', 4, 'in'], ['멈춰요', 7, 'hold'], ['내쉬어요', 8, 'out']] },
    box: { label: '박스 호흡', note: '긴장될 때 좋아요', steps: [['들이마셔요', 4, 'in'], ['멈춰요', 4, 'hold'], ['내쉬어요', 4, 'out'], ['멈춰요', 4, 'hold']] },
    calm: { label: '편안한 호흡', note: '언제든 가볍게', steps: [['들이마셔요', 4, 'in'], ['내쉬어요', 6, 'out']] }
  };

  A.register({
    id: 'sleep', label: '잠', icon: 'moon',
    render(el) {
      const ui = A.data.ui;
      let calcMode = ui.sleepCalc || 'wake';
      let br = { kind: ui.breath || '478', on: false, step: 0, left: 0, cycles: 0, t: null };
      el.innerHTML = `
        <div class="page">
          <div class="page-head"><div><h1>잠</h1><p class="sub">잘 준비부터 일어날 때까지. 잠 모드를 켜 두면 화면이 꺼지지 않아 알람이 제시간에 울려요.</p></div></div>
          <section class="panel sleep-hero" id="sl-hero"></section>
          <div class="sleep-grid">
            <section class="panel" id="sl-calc"></section>
            <section class="panel" id="sl-breath"></section>
            <section class="panel" id="sl-before"></section>
            <section class="panel" id="sl-log"></section>
          </div>
        </div>`;
      const $ = s => el.querySelector(s);

      function drawHero() {
        const next = A.alarmUtil.nextAlarm();
        $('#sl-hero').innerHTML = `
          <div class="sleep-hero-main">
            ${icon('moon', 36)}
            <div class="grow">
              <h2>잠 모드</h2>
              <p class="muted">어두운 시계 화면으로 바뀌고, 화면이 꺼지지 않게 해요. 빗소리·파도 소리를 틀어 두고 수면 타이머를 걸 수 있어요. 알람을 끄면 잔 시간이 기록되고 아침 브리핑이 떠요.</p>
            </div>
          </div>
          <div class="sleep-hero-row">
            <span class="grow">${icon('alarm', 18)} ${next ? `<b>${A.fmtHM(next.alarm.time)}</b> ${esc(next.alarm.label || '알람')} · <span class="faint">${A.untilText(next.at - Date.now())}</span>` : '<span class="muted">켜 둔 알람이 없어요</span>'}</span>
            <form class="inline-form two" data-form="quick-alarm"><input class="input" type="time" id="sl-alarm" value="${next ? next.alarm.time : '07:00'}" style="width:130px" aria-label="알람 시간"><button type="submit" class="btn">알람 맞추기</button></form>
          </div>
          <button type="button" class="btn primary lg sleep-go" data-act="night">${icon('moon', 18)} 잠 모드 켜기</button>
          ${A.Wake.supported ? '' : '<p class="notice">이 브라우저는 화면 꺼짐 방지를 지원하지 않아요. 밤새 켜 두려면 기기 설정에서 자동 잠금을 꺼 주세요. (아이폰: 설정 → 디스플레이 및 밝기 → 자동 잠금)</p>'}`;
      }
      function drawCalc() {
        const next = A.alarmUtil.nextAlarm();
        const wakeT = ui.sleepWake || (next ? next.alarm.time : '07:00');
        let rows = '';
        if (calcMode === 'wake') {
          const [h, m] = wakeT.split(':').map(Number);
          const w = new Date(); w.setHours(h, m, 0, 0);
          rows = [6, 5, 4].map(n => {
            const b = new Date(w.getTime() - (n * 90 + 15) * 60000);
            return `<li class="list-row"><b class="sc-time">${A.fmtHM(toHM(b))}</b><span class="grow faint">${n}번 주기 · ${durText(n * 90 * 60000)}</span>${n === 5 ? '<span class="tag blue">추천</span>' : ''}</li>`;
          }).join('');
        } else {
          const now = Date.now();
          rows = [6, 5, 4].map(n => {
            const w = new Date(now + (n * 90 + 15) * 60000);
            return `<li class="list-row"><b class="sc-time">${A.fmtHM(toHM(w))}</b><span class="grow faint">${n}번 주기 · ${durText(n * 90 * 60000)}</span><button type="button" class="btn sm" data-alarm="${toHM(w)}">알람</button></li>`;
          }).join('');
        }
        $('#sl-calc').innerHTML = `
          <div class="panel-head"><h2 class="hl-title">${icon('bed', 18)}<span>잘 시간 계산기</span></h2></div>
          <div class="seg" role="tablist"><button type="button" class="${calcMode === 'wake' ? 'on' : ''}" data-calc="wake">일어날 시간으로</button><button type="button" class="${calcMode === 'now' ? 'on' : ''}" data-calc="now">지금 자면</button></div>
          ${calcMode === 'wake' ? `<label class="form-row" style="margin-top:12px;align-items:center"><span class="muted">일어날 시간</span><input class="input" type="time" id="sc-wake" value="${wakeT}" style="width:130px"></label><p class="faint" style="font-size:13px;margin-top:8px">이 시간에 잠자리에 누우세요</p>` : '<p class="faint" style="font-size:13px;margin-top:12px">지금 누우면 이때 일어나면 개운해요</p>'}
          <ul>${rows}</ul>
          <p class="faint" style="font-size:12px;margin-top:6px">잠은 약 90분 주기로 깊어졌다 얕아져요. 잠드는 데 15분 걸린다고 보고 얕은 잠일 때 깨도록 계산했어요.</p>`;
      }
      function drawBefore() {
        const cfg = A.data.healthCfg, left = SleepTimer.left();
        $('#sl-before').innerHTML = `
          <div class="panel-head"><h2 class="hl-title">${icon('bell', 18)}<span>잠들기 전</span></h2></div>
          <div class="pref-row" style="padding-top:0">
            <div class="grow"><h3>취침 알림</h3><p>잘 시간 30분 전에 알려 드려요.</p></div>
            <div class="pref-ctl"><input class="input" type="time" id="bed-time" value="${cfg.bedtime}" style="width:120px" aria-label="잘 시간"><button type="button" class="switch" role="switch" aria-checked="${!!cfg.bedRemind}" data-act="bed-remind" aria-label="취침 알림"></button></div>
          </div>
          <div class="pref-row">
            <div class="grow"><h3>수면 타이머</h3><p id="st-left">${left ? `${A.fmtDur(left)} 뒤 음악과 소리를 줄이며 꺼요` : '음악이나 빗소리를 틀어 두고 잠들 때'}</p></div>
          </div>
          <div class="chips">${[15, 30, 45, 60, 90].map(m => `<button type="button" class="chip" data-st="${m}">${m}분</button>`).join('')}${left ? '<button type="button" class="chip on" data-st="0">타이머 끄기</button>' : ''}</div>
          <div class="chips" style="margin-top:10px">${A.music ? Object.entries(A.music.Amb.SOUNDS).map(([k, s]) => `<button type="button" class="chip ${A.music.Amb.on(k) ? 'on' : ''}" data-amb="${k}">${icon(s.icon, 14)} ${s.label}</button>`).join('') : ''}</div>`;
      }
      function drawBreath() {
        const B = BREATH[br.kind];
        const st = B.steps[br.step];
        $('#sl-breath').innerHTML = `
          <div class="panel-head"><h2 class="hl-title">${icon('breath', 18)}<span>호흡</span></h2><span class="faint num">${br.cycles ? `${br.cycles}회` : ''}</span></div>
          <div class="seg">${Object.entries(BREATH).map(([k, v]) => `<button type="button" class="${k === br.kind ? 'on' : ''}" data-br="${k}">${v.label}</button>`).join('')}</div>
          <div class="breath ${br.on ? st[2] : ''}" style="--d:${br.on ? st[1] : 1}s">
            <div class="breath-ring"><div class="breath-ball"></div></div>
            <p class="breath-txt">${br.on ? `${st[0]} <b class="num" id="br-left">${br.left}</b>` : esc(B.note)}</p>
          </div>
          <div style="display:flex;justify-content:center"><button type="button" class="btn ${br.on ? '' : 'primary'}" data-act="breath">${br.on ? '멈추기' : '시작'}</button></div>`;
      }
      function breathStep() {
        const B = BREATH[br.kind];
        br.left = B.steps[br.step][1];
        drawBreath();
        clearInterval(br.t);
        br.t = setInterval(() => {
          br.left--;
          if (br.left <= 0) {
            br.step = (br.step + 1) % B.steps.length;
            if (br.step === 0) br.cycles++;
            breathStep();
            return;
          }
          const n = el.querySelector('#br-left'); if (n) n.textContent = br.left;
        }, 1000);
      }
      function stopBreath() { clearInterval(br.t); br.on = false; br.step = 0; drawBreath(); }
      function drawLog() {
        const days = A.lastDays(7);
        const items = days.map(d => {
          const s = forDay(A.ymd(d)), v = s ? Math.round((s.wake - s.bed) / 60000) : 0;
          return { label: A.WD[d.getDay()], value: v, now: A.ymd(d) === A.today(), tip: `${d.getMonth() + 1}/${d.getDate()} · ${s ? durText(v * 60000) : '기록 없음'}` };
        });
        const got = items.filter(i => i.value);
        const avg = got.length ? got.reduce((t, i) => t + i.value, 0) / got.length : 0;
        const recent = A.data.sleepLog.slice(-7).reverse();
        $('#sl-log').innerHTML = `
          <div class="panel-head"><h2 class="hl-title">${icon('calendar', 18)}<span>수면 기록</span></h2><span class="faint">${got.length ? `평균 ${durText(avg * 60000)}` : ''}</span></div>
          ${A.miniBars(items, { goal: 420, max: Math.max(600, ...items.map(i => i.value)), label: '최근 7일 잔 시간(분)' })}
          <p class="faint" style="font-size:12px">점선은 권장 최소 7시간이에요.</p>
          ${recent.length ? `<ul style="margin-top:6px">${recent.map(s => `<li class="list-row"><span class="grow"><b>${durText(s.wake - s.bed)}</b> <span class="faint">${A.relDay(A.ymd(new Date(s.wake)))} · ${hm(s.bed)} → ${hm(s.wake)}</span></span><button type="button" class="icon-btn danger" data-del="${s.id}" aria-label="기록 지우기">${icon('x', 16)}</button></li>`).join('')}</ul>` : ''}
          <details class="sl-add"><summary>직접 기록하기</summary>
            <form class="form-grid" data-form="sleep" style="margin-top:10px">
              <div class="form-row">
                <label class="field"><span>일어난 날</span><input class="input" type="date" id="sa-day" value="${A.today()}" max="${A.today()}" required></label>
                <label class="field"><span>잠든 시각</span><input class="input" type="time" id="sa-bed" value="${A.data.healthCfg.bedtime}" required></label>
                <label class="field"><span>일어난 시각</span><input class="input" type="time" id="sa-wake" value="07:00" required></label>
              </div>
              <div><button type="submit" class="btn primary">기록</button></div>
            </form>
          </details>`;
      }
      function drawAll() { drawHero(); drawCalc(); drawBefore(); drawBreath(); drawLog(); }

      el.addEventListener('click', e => {
        const t = e.target;
        const calc = t.closest('[data-calc]');
        if (calc) { calcMode = ui.sleepCalc = calc.dataset.calc; A.save('ui'); drawCalc(); return; }
        const al = t.closest('[data-alarm]');
        if (al) { addAlarm(al.dataset.alarm); drawHero(); return; }
        const s = t.closest('[data-st]');
        if (s) { const m = Number(s.dataset.st); if (m) { SleepTimer.set(m); A.toast(`${m}분 뒤 소리를 줄이며 꺼요`); } else SleepTimer.cancel(); drawBefore(); return; }
        const amb = t.closest('[data-amb]');
        if (amb) { const Amb = A.music.Amb; Amb.on(amb.dataset.amb) ? Amb.stop(amb.dataset.amb) : Amb.start(amb.dataset.amb); drawBefore(); return; }
        const bk = t.closest('[data-br]');
        if (bk) { br.kind = ui.breath = bk.dataset.br; A.save('ui'); br.cycles = 0; if (br.on) { br.step = 0; breathStep(); } else drawBreath(); return; }
        const del = t.closest('[data-del]');
        if (del) {
          const i = A.data.sleepLog.findIndex(x => x.id === del.dataset.del);
          if (i >= 0) { const [g] = A.data.sleepLog.splice(i, 1); A.save('sleepLog'); drawLog(); A.toast('기록을 지웠어요', { action: '되돌리기', onAction: () => { A.data.sleepLog.splice(i, 0, g); A.save('sleepLog'); drawLog(); } }); }
          return;
        }
        const b = t.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'night') Night.open();
        else if (b.dataset.act === 'bed-remind') {
          A.data.healthCfg.bedRemind = !A.data.healthCfg.bedRemind; A.save('healthCfg'); drawBefore();
          A.toast(A.data.healthCfg.bedRemind ? `${A.fmtHM(A.data.healthCfg.bedtime)} 30분 전에 알려 드려요` : '취침 알림을 껐어요');
        } else if (b.dataset.act === 'breath') {
          if (br.on) stopBreath(); else { br.on = true; br.step = 0; br.cycles = 0; breathStep(); }
        }
      });
      el.addEventListener('change', e => {
        if (e.target.id === 'sc-wake') { ui.sleepWake = e.target.value; A.save('ui'); drawCalc(); }
        else if (e.target.id === 'bed-time' && e.target.value) { A.data.healthCfg.bedtime = e.target.value; A.save('healthCfg'); }
      });
      el.addEventListener('submit', e => {
        const f = e.target.closest('[data-form]');
        if (!f) return;
        e.preventDefault();
        if (f.dataset.form === 'quick-alarm') { const v = $('#sl-alarm').value; if (v) { addAlarm(v); drawHero(); drawCalc(); } }
        else if (f.dataset.form === 'sleep') {
          const d = $('#sa-day').value, b = $('#sa-bed').value, w = $('#sa-wake').value;
          if (!d || !b || !w) return;
          const wake = A.parseYmd(d); const [wh, wm] = w.split(':').map(Number); wake.setHours(wh, wm, 0, 0);
          const bed = A.parseYmd(d); const [bh, bm] = b.split(':').map(Number); bed.setHours(bh, bm, 0, 0);
          if (bed >= wake) bed.setDate(bed.getDate() - 1);
          if (wake - bed > 20 * 3600e3) { A.toast('시간을 다시 확인해 주세요'); return; }
          addSleep(bed.getTime(), wake.getTime()); drawLog(); A.toast(`${durText(wake - bed)} 기록했어요`);
        }
      });

      drawAll();
      let lastM = -1;
      const offs = [
        A.on('tick', now => {
          const l = el.querySelector('#st-left');
          if (l && SleepTimer.left()) l.textContent = `${A.fmtDur(SleepTimer.left())} 뒤 음악과 소리를 줄이며 꺼요`;
          if (now.getMinutes() !== lastM) { lastM = now.getMinutes(); if (!$('#sl-hero').contains(document.activeElement)) drawHero(); if (calcMode === 'now') drawCalc(); }
        }),
        A.on('sleeptimer', drawBefore),
        A.on('alarms:change', drawHero),
        A.on('sleep:change', drawLog),
        A.on('night:change', drawAll)
      ];
      return () => { offs.forEach(f => f()); clearInterval(br.t); };
    }
  });
})();
