'use strict';
/* 알람: 요일 반복, 소리 선택, 다시 알림(스누즈). 탭이 열려 있는 동안 1초마다 확인한다. */
(function () {
  const A = App;
  const { esc, icon } = A;
  const ORDER = [1, 2, 3, 4, 5, 6, 0];

  function repeatText(days) {
    if (!days || !days.length) return '한 번만';
    const s = [...days].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    if (s.length === 7) return '매일';
    if (s.length === 5 && [1, 2, 3, 4, 5].every(d => s.includes(d))) return '주중';
    if (s.length === 2 && s.includes(0) && s.includes(6)) return '주말';
    return s.map(d => A.WD[d]).join(' ');
  }
  function nextOccurrence(a, from) {
    const [h, m] = a.time.split(':').map(Number);
    for (let i = 0; i <= 7; i++) {
      const d = A.addDays(from, i);
      d.setHours(h, m, 0, 0);
      if (d.getTime() > from.getTime() && (!a.days.length || a.days.includes(d.getDay()))) return d;
    }
    return null;
  }
  function nextAlarm() {
    const now = new Date();
    let best = null;
    A.data.alarms.forEach(a => {
      if (!a.enabled) return;
      const at = nextOccurrence(a, now);
      if (at && (!best || at < best.at)) best = { alarm: a, at };
    });
    A.data.snoozes.forEach(s => {
      const at = new Date(s.at);
      if (at > now && (!best || at < best.at)) best = { alarm: { time: `${A.pad(at.getHours())}:${A.pad(at.getMinutes())}`, label: `${s.label} (다시 알림)` }, at };
    });
    return best;
  }
  const soundLabel = k => (A.Sound.PATTERNS[k] || A.Sound.PATTERNS.chime).label;
  A.alarmUtil = { nextAlarm, repeatText, nextOccurrence };

  /* ---------- 울림 확인 ---------- */
  function addSnooze(label, sound) {
    A.data.snoozes.push({ id: A.uid(), at: Date.now() + 5 * 60 * 1000, label, sound });
    A.save('snoozes');
    A.emit('alarms:change');
  }
  function fire(a) {
    const label = a.label || '알람';
    A.Ringer.start({
      title: label,
      sub: `${A.fmtHM(a.time)} · ${repeatText(a.days)}`,
      sound: a.sound,
      snooze: () => addSnooze(label, a.sound)
    });
  }
  let lastCheck = Date.now();
  A.on('tick', () => {
    const now = Date.now();
    const from = new Date(lastCheck);
    let changed = false;
    A.data.alarms.forEach(a => {
      if (!a.enabled) return;
      const occ = nextOccurrence(a, from);
      if (occ && occ.getTime() <= now) {
        if (now - occ.getTime() < 10 * 60 * 1000) fire(a);
        if (!a.days.length) { a.enabled = false; changed = true; }
      }
    });
    const due = A.data.snoozes.filter(s => s.at <= now);
    if (due.length) {
      A.data.snoozes = A.data.snoozes.filter(s => s.at > now);
      A.save('snoozes');
      due.forEach(s => {
        if (now - s.at < 10 * 60 * 1000) {
          A.Ringer.start({ title: s.label, sub: '다시 알림', sound: s.sound, snooze: () => addSnooze(s.label, s.sound) });
        }
      });
      changed = true;
    }
    if (changed) { A.save('alarms'); A.emit('alarms:change'); }
    lastCheck = now;
  });

  /* ---------- 편집 창 ---------- */
  function openEditor(existing, onSaved) {
    const a = existing ? A.clone(existing) : { time: defaultTime(), label: '', days: [], sound: A.data.prefs.sound || 'chime' };
    const m = A.modal({
      title: existing ? '알람 고치기' : '새 알람',
      body: `
        <form id="al-form" class="form-grid">
          <input class="input time-input" type="time" id="al-time" value="${a.time}" required aria-label="시각">
          <label class="field"><span>이름</span><input class="input" id="al-label" value="${esc(a.label)}" placeholder="예: 기상, 약 먹기, 회의" autocomplete="off"></label>
          <div class="field">
            <span>반복</span>
            <div class="day-pick" id="al-days" role="group" aria-label="반복 요일">
              ${[0, 1, 2, 3, 4, 5, 6].map(d => `<button type="button" data-day="${d}" class="${d === 0 ? 'sun' : d === 6 ? 'sat' : ''} ${a.days.includes(d) ? 'on' : ''}" aria-pressed="${a.days.includes(d)}">${A.WD[d]}</button>`).join('')}
            </div>
            <div class="chips" style="margin-top:4px">
              <button type="button" class="chip" data-preset="1,2,3,4,5">주중</button>
              <button type="button" class="chip" data-preset="0,6">주말</button>
              <button type="button" class="chip" data-preset="0,1,2,3,4,5,6">매일</button>
              <button type="button" class="chip" data-preset="">반복 안 함</button>
            </div>
          </div>
          <div class="field">
            <span>소리</span>
            <div class="form-row">
              <select class="input grow" id="al-sound" aria-label="알람 소리">
                ${Object.entries(A.Sound.PATTERNS).map(([k, p]) => `<option value="${k}" ${k === a.sound ? 'selected' : ''}>${p.label}</option>`).join('')}
              </select>
              <button type="button" class="btn" data-preview>미리 듣기</button>
            </div>
          </div>
          <p class="faint" id="al-when" style="font-size:13px"></p>
        </form>`,
      actions: [
        { label: '취소', kind: 'ghost' },
        { label: '저장', kind: 'primary', onClick: () => save() }
      ],
      onMount(box) {
        const days = new Set(a.days);
        const when = () => {
          const t = box.querySelector('#al-time').value;
          if (!t) { box.querySelector('#al-when').textContent = ''; return; }
          const at = nextOccurrence({ time: t, days: [...days] }, new Date());
          box.querySelector('#al-when').textContent = at ? `${A.untilText(at - Date.now())}에 울려요` : '';
        };
        const syncDays = () => {
          box.querySelectorAll('[data-day]').forEach(b => {
            const on = days.has(Number(b.dataset.day));
            b.classList.toggle('on', on);
            b.setAttribute('aria-pressed', on);
          });
          a.days = [...days];
          when();
        };
        box.addEventListener('click', e => {
          const d = e.target.closest('[data-day]');
          if (d) { const n = Number(d.dataset.day); days.has(n) ? days.delete(n) : days.add(n); syncDays(); return; }
          const p = e.target.closest('[data-preset]');
          if (p) { days.clear(); p.dataset.preset.split(',').filter(Boolean).forEach(x => days.add(Number(x))); syncDays(); return; }
          if (e.target.closest('[data-preview]')) A.Sound.preview(box.querySelector('#al-sound').value);
        });
        box.querySelector('#al-time').addEventListener('input', when);
        box.querySelector('#al-form').addEventListener('submit', e => { e.preventDefault(); if (save() !== false) m.close(); });
        when();
      }
    });
    function save() {
      const box = m.el;
      const time = box.querySelector('#al-time').value;
      if (!time) { A.toast('시각을 정해 주세요'); return false; }
      a.time = time;
      a.label = box.querySelector('#al-label').value.trim();
      a.sound = box.querySelector('#al-sound').value;
      a.enabled = true;
      if (existing) Object.assign(existing, a);
      else A.data.alarms.push(Object.assign({ id: A.uid() }, a));
      A.save('alarms');
      const at = nextOccurrence(a, new Date());
      A.toast(`알람을 맞췄어요 · ${A.untilText(at - Date.now())}에 울려요`);
      A.emit('alarms:change');
      onSaved && onSaved();
    }
  }
  function defaultTime() {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return `${A.pad(d.getHours())}:00`;
  }

  /* ---------- 화면 ---------- */
  A.register({
    id: 'alarm', label: '알람', icon: 'alarm',
    render(el) {
      el.innerHTML = `
        <div class="page">
          <div class="page-head">
            <div><h1>알람</h1><p class="sub">이 페이지가 열려 있는 동안 울려요. 휴대폰이 잠기면 울리지 않을 수 있어요.</p></div>
            <div class="head-actions"><button type="button" class="btn primary" data-act="add">${icon('plus', 18)} 알람 추가</button></div>
          </div>
          <div id="al-notice"></div>
          <section class="panel alarm-next" id="al-next"></section>
          <section class="panel" id="al-list"></section>
        </div>`;
      const $ = s => el.querySelector(s);

      function drawNotice() {
        const parts = [];
        if (A.Sound.state() !== 'running') {
          parts.push(`<div class="notice">${icon('volume', 18)}<span class="grow">브라우저가 아직 소리를 막고 있어요. 이 화면을 한 번 누르면 알람 소리가 나요.</span><button type="button" class="btn sm" data-act="unlock">소리 허용</button></div>`);
        }
        if ('Notification' in window && Notification.permission === 'default') {
          parts.push(`<div class="notice blue">${icon('bell', 18)}<span class="grow">다른 탭을 보고 있을 때도 알 수 있게 브라우저 알림을 켜 두세요.</span><button type="button" class="btn sm" data-act="notify">알림 켜기</button></div>`);
        }
        $('#al-notice').innerHTML = parts.join('');
        $('#al-notice').style.display = parts.length ? 'grid' : 'none';
        $('#al-notice').style.gap = '8px';
      }
      function drawNext() {
        const n = nextAlarm();
        $('#al-next').innerHTML = n ? `
          ${icon('alarm', 28)}
          <div style="flex:1;min-width:0">
            <p class="panel-title">다음 알람</p>
            <p class="big-number">${A.untilText(n.at - Date.now())}</p>
          </div>
          <div style="text-align:right"><strong>${A.fmtHM(n.alarm.time)}</strong><br><span class="faint">${A.ymd(n.at) !== A.today() ? `${A.relDay(A.ymd(n.at))} · ` : ''}${esc(n.alarm.label || '알람')}</span></div>`
          : `${icon('alarm', 28)}<div><p class="panel-title">다음 알람</p><p class="muted">켜 둔 알람이 없어요.</p></div>`;
      }
      function drawList() {
        const list = [...A.data.alarms].sort((a, b) => a.time.localeCompare(b.time));
        const snoozes = A.data.snoozes;
        $('#al-list').innerHTML = (snoozes.length ? `
          <div style="margin-bottom:8px">${snoozes.map(s => {
            const c = A.fmtClock(new Date(s.at));
            return `<div class="list-row"><span class="tag yellow">다시 알림</span><span class="grow">${c.ampm} ${c.hm} · ${esc(s.label)}</span><button type="button" class="btn sm ghost" data-act="cancel-snooze" data-id="${s.id}">취소</button></div>`;
          }).join('')}</div>` : '') +
          (list.length ? list.map(a => {
            const c = A.fmtHM(a.time).split(' ');
            return `
              <div class="alarm-item ${a.enabled ? '' : 'off'}" data-id="${a.id}">
                <div class="alarm-time"><small>${c[0]}</small>${c[1]}</div>
                <div class="alarm-info"><strong>${esc(a.label || '알람')}</strong><span class="faint">${repeatText(a.days)} · ${soundLabel(a.sound)}</span></div>
                <div class="alarm-actions">
                  <button type="button" class="switch" role="switch" aria-checked="${a.enabled}" data-act="toggle" aria-label="${esc(a.label || '알람')} 켜기"></button>
                  <button type="button" class="icon-btn" data-act="edit" aria-label="고치기" title="고치기">${icon('edit', 18)}</button>
                  <button type="button" class="icon-btn danger" data-act="del" aria-label="지우기" title="지우기">${icon('trash', 18)}</button>
                </div>
              </div>`;
          }).join('') : `<div class="empty">${icon('alarm', 32)}<p>맞춰 둔 알람이 없어요.</p><button type="button" class="btn primary" data-act="add">첫 알람 맞추기</button></div>`);
      }
      const draw = () => { drawNotice(); drawNext(); drawList(); };

      el.addEventListener('click', async e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        const row = b.closest('.alarm-item');
        const a = row ? A.data.alarms.find(x => x.id === row.dataset.id) : null;
        if (act === 'add') openEditor(null, draw);
        else if (act === 'edit' && a) openEditor(a, draw);
        else if (act === 'toggle' && a) {
          a.enabled = !a.enabled;
          A.save('alarms');
          draw();
          if (a.enabled) A.toast(`${A.untilText(nextOccurrence(a, new Date()) - Date.now())}에 울려요`);
        } else if (act === 'del' && a) {
          const i = A.data.alarms.indexOf(a);
          A.data.alarms.splice(i, 1); A.save('alarms'); draw();
          A.toast('알람을 지웠어요', { action: '되돌리기', onAction: () => { A.data.alarms.splice(i, 0, a); A.save('alarms'); draw(); } });
        } else if (act === 'cancel-snooze') {
          A.data.snoozes = A.data.snoozes.filter(s => s.id !== b.dataset.id); A.save('snoozes'); draw();
        } else if (act === 'unlock') {
          A.Sound.get();
          A.Sound.preview(A.data.prefs.sound);
          setTimeout(drawNotice, 300);
        } else if (act === 'notify') {
          try {
            const r = await Notification.requestPermission();
            A.toast(r === 'granted' ? '알림을 켰어요' : '알림이 허용되지 않았어요. 브라우저 설정에서 바꿀 수 있어요.');
          } catch (err) { A.toast('이 브라우저에서는 알림을 켤 수 없어요'); }
          drawNotice();
        }
      });

      draw();
      let lastMin = new Date().getMinutes();
      const offTick = A.on('tick', now => { if (now.getMinutes() !== lastMin) { lastMin = now.getMinutes(); drawNext(); } });
      const offChange = A.on('alarms:change', draw);
      const offUnlock = A.on('sound:unlock', () => setTimeout(drawNotice, 200));
      return () => { offTick(); offChange(); offUnlock(); };
    }
  });
})();
