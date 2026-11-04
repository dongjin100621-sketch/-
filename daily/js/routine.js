'use strict';
/* 루틴: 아침·저녁에 순서대로 하는 일. 날짜가 바뀌면 체크가 새로 시작되고, 단계별 타이머로 따라 할 수 있다. */
(function () {
  const A = App;
  const { esc, icon } = A;

  const WHEN = { morning: { label: '아침', icon: 'sunrise' }, night: { label: '저녁', icon: 'moon' }, any: { label: '언제든', icon: 'check' } };
  function defaults() {
    const st = (text, min = 0, link = '') => ({ id: A.uid(), text, min, link });
    return [
      { id: A.uid(), name: '아침 루틴', when: 'morning', steps: [st('물 한 잔 마시기'), st('이불 정리하기', 2), st('스트레칭', 5), st('씻고 옷 입기', 15), st('오늘 할 일 3가지 고르기', 3, 'todo')] },
      { id: A.uid(), name: '저녁 루틴', when: 'night', steps: [st('내일 입을 옷·준비물 챙기기', 5), st('씻기', 15), st('일기 쓰기', 5, 'journal'), st('휴대폰 내려놓기'), st('잠 모드 켜기', 0, 'sleep')] }
    ];
  }
  // 처음 한 번 기본 루틴을 넣어 준다 (기존 사용자 포함)
  if (!A.data.prefs.routinesSeeded) {
    if (!A.data.routines.length) { A.data.routines = defaults(); A.save('routines'); }
    A.data.prefs.routinesSeeded = true;
    A.save('prefs');
  }
  // 오래된 체크 기록 정리 (120일)
  (function prune() {
    const cut = A.ymd(A.addDays(new Date(), -120));
    let changed = false;
    Object.keys(A.data.routineLog).forEach(k => { if (k < cut) { delete A.data.routineLog[k]; changed = true; } });
    if (changed) A.save('routineLog');
  })();

  const LINKS = { todo: '할 일', journal: '일기', sleep: '잠', health: '건강', music: '음악', timer: '타이머', calendar: '캘린더' };

  function doneMap(rid, day = A.today()) { return ((A.data.routineLog[day] || {})[rid]) || {}; }
  function progress(r, day = A.today()) {
    const m = doneMap(r.id, day);
    const total = r.steps.length;
    const done = r.steps.filter(s => m[s.id]).length;
    return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
  }
  function setStep(rid, sid, on, day = A.today()) {
    const log = A.data.routineLog;
    log[day] = log[day] || {};
    log[day][rid] = log[day][rid] || {};
    if (on) log[day][rid][sid] = true; else delete log[day][rid][sid];
    A.save('routineLog');
    A.emit('routine:change');
  }
  function toggleStep(rid, sid, day) { setStep(rid, sid, !doneMap(rid, day)[sid], day); }
  function current(now = new Date()) {
    const h = now.getHours();
    const want = h >= 4 && h < 15 ? 'morning' : 'night';
    return A.data.routines.find(r => r.when === want) || A.data.routines[0] || null;
  }
  const totalMin = r => r.steps.reduce((s, x) => s + (Number(x.min) || 0), 0);
  A.routineUtil = { progress, toggleStep, current, doneMap, WHEN };

  /* ---------- 따라 하기 (단계별 타이머) ---------- */
  function run(r) {
    let i = r.steps.findIndex(s => !doneMap(r.id)[s.id]);
    if (i < 0) i = 0;
    let left = 0, running = false, last = 0, timer = null;
    const m = A.modal({
      title: r.name,
      className: 'routine-run',
      body: '<div id="rr"></div>',
      onMount(box) {
        box.addEventListener('click', e => {
          const b = e.target.closest('[data-rr]');
          if (!b) return;
          const act = b.dataset.rr;
          if (act === 'done') { setStep(r.id, r.steps[i].id, true); go(i + 1); }
          else if (act === 'skip') go(i + 1);
          else if (act === 'prev') go(i - 1);
          else if (act === 'timer') { running = !running; last = Date.now(); draw(); }
          else if (act === 'link') { const l = r.steps[i].link; m.close(); A.go(l); }
          else if (act === 'close') m.close();
        });
      }
    });
    function go(n) {
      i = n;
      running = false;
      left = i < r.steps.length ? (Number(r.steps[i].min) || 0) * 60000 : 0;
      draw();
    }
    function draw() {
      const box = m.el.querySelector('#rr');
      if (!box) return;
      if (i >= r.steps.length) {
        const p = progress(r);
        box.innerHTML = `
          <div class="rr-end">
            ${icon(r.when === 'night' ? 'moon' : 'sunrise', 40)}
            <p class="rr-step">${p.done === p.total ? '루틴을 모두 마쳤어요' : `${p.total}개 중 ${p.done}개를 했어요`}</p>
            <p class="muted">${r.when === 'night' ? '오늘 하루도 수고했어요.' : '좋은 하루 보내세요.'}</p>
            <div class="rr-actions"><button type="button" class="btn primary lg" data-rr="close">닫기</button></div>
          </div>`;
        return;
      }
      const s = r.steps[i];
      const done = !!doneMap(r.id)[s.id];
      box.innerHTML = `
        <div class="rr-dots" aria-hidden="true">${r.steps.map((x, k) => `<i class="${doneMap(r.id)[x.id] ? 'on' : ''} ${k === i ? 'cur' : ''}"></i>`).join('')}</div>
        <p class="faint">${i + 1} / ${r.steps.length}</p>
        <p class="rr-step">${esc(s.text)}</p>
        ${s.min ? `<button type="button" class="rr-timer num ${running ? 'on' : ''}" data-rr="timer" aria-label="${running ? '타이머 멈추기' : '타이머 시작'}">${A.fmtDur(left)}<small>${running ? '누르면 멈춰요' : '누르면 시작해요'}</small></button>` : ''}
        ${s.link && LINKS[s.link] ? `<button type="button" class="btn sm" data-rr="link">${esc(LINKS[s.link])} 열기 ${icon('chevronR', 14)}</button>` : ''}
        <div class="rr-actions">
          <button type="button" class="btn ghost" data-rr="prev" ${i === 0 ? 'disabled' : ''}>이전</button>
          <button type="button" class="btn" data-rr="skip">건너뛰기</button>
          <button type="button" class="btn primary lg" data-rr="done">${done ? '다음' : '했어요'}</button>
        </div>`;
    }
    timer = setInterval(() => {
      if (!running) return;
      const now = Date.now();
      left -= now - last;
      last = now;
      if (left <= 0) {
        left = 0; running = false;
        A.Sound.preview('marimba');
        try { navigator.vibrate && navigator.vibrate(200); } catch (e) { /* noop */ }
        draw();
        return;
      }
      const t = m.el.querySelector('.rr-timer');
      if (t) t.firstChild.textContent = A.fmtDur(left);
    }, 250);
    m.onClose = () => { clearInterval(timer); A.emit('routine:change'); };
    go(i);
  }

  /* ---------- 화면 ---------- */
  A.register({
    id: 'routine', label: '루틴', icon: 'sunrise',
    render(el) {
      let editing = null; // 편집 중인 루틴 사본
      el.innerHTML = `
        <div class="page">
          <div class="page-head">
            <div><h1>루틴</h1><p class="sub">아침과 저녁에 할 일을 순서대로 체크해요. 날짜가 바뀌면 새로 시작돼요.</p></div>
            <div class="head-actions"><button type="button" class="btn" data-act="new">${icon('plus', 16)} 새 루틴</button></div>
          </div>
          <div class="routine-grid" id="rt-list"></div>
        </div>`;
      const list = el.querySelector('#rt-list');

      function week(r) {
        return A.lastDays(7).map(d => {
          const p = progress(r, A.ymd(d));
          const cls = p.total && p.done === p.total ? 'full' : p.done ? 'part' : '';
          return `<span class="rt-day ${cls}" title="${d.getMonth() + 1}/${d.getDate()} · ${p.done}/${p.total}"><i></i>${A.WD[d.getDay()]}</span>`;
        }).join('');
      }
      function viewCard(r) {
        const p = progress(r), m = doneMap(r.id), w = WHEN[r.when] || WHEN.any;
        const mins = totalMin(r);
        const cur = current();
        return `
          <article class="panel routine ${cur && cur.id === r.id ? 'is-now' : ''}" data-id="${r.id}">
            <div class="panel-head">
              <h2 class="rt-name">${icon(w.icon, 20)}<span>${esc(r.name)}</span>${cur && cur.id === r.id ? '<span class="tag blue">지금</span>' : ''}</h2>
              <div class="head-actions">
                <button type="button" class="icon-btn" data-act="edit" aria-label="${esc(r.name)} 고치기">${icon('edit', 18)}</button>
                <button type="button" class="btn sm primary" data-act="run" ${r.steps.length ? '' : 'disabled'}>${icon('play', 14)} 따라 하기</button>
              </div>
            </div>
            <div class="rt-prog"><div class="bar grow"><i style="width:${p.pct}%"></i></div><span class="num faint">${p.done}/${p.total}</span></div>
            ${r.steps.length ? `<ul class="rt-steps">${r.steps.map(s => `
              <li class="list-row ${m[s.id] ? 'done' : ''}">
                <button type="button" class="check ${m[s.id] ? 'on' : ''}" data-act="step" data-sid="${s.id}" aria-pressed="${!!m[s.id]}" aria-label="${esc(s.text)} 완료">${icon('check', 14)}</button>
                <span class="grow">${esc(s.text)}</span>
                ${s.min ? `<span class="faint num" style="font-size:13px">${s.min}분</span>` : ''}
                ${s.link && LINKS[s.link] ? `<a class="link-more" href="#${s.link}">${esc(LINKS[s.link])}${icon('chevronR', 14)}</a>` : ''}
              </li>`).join('')}</ul>` : '<p class="empty-sm">단계가 없어요. 연필 버튼을 눌러 추가하세요.</p>'}
            <div class="rt-foot">
              <div class="rt-week" aria-label="최근 7일">${week(r)}</div>
              ${mins ? `<span class="faint" style="font-size:13px">약 ${mins}분</span>` : ''}
            </div>
          </article>`;
      }
      function editCard(r) {
        return `
          <article class="panel routine editing" data-id="${r.id}">
            <form class="form-grid" data-form="routine">
              <div class="form-row">
                <label class="field grow"><span>이름</span><input class="input" id="rt-name" value="${esc(r.name)}" required autocomplete="off"></label>
                <label class="field"><span>시간대</span><select class="input" id="rt-when" style="width:110px">${Object.entries(WHEN).map(([k, v]) => `<option value="${k}" ${k === r.when ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
              </div>
              <div class="rt-edit-steps">
                ${r.steps.map((s, k) => `
                  <div class="rt-edit-row" data-k="${k}">
                    <input class="input" data-f="text" value="${esc(s.text)}" placeholder="할 일" aria-label="${k + 1}번째 단계" autocomplete="off">
                    <label class="rt-min"><input class="input num" data-f="min" type="number" min="0" max="180" inputmode="numeric" value="${s.min || ''}" placeholder="0" aria-label="걸리는 시간(분)"><span>분</span></label>
                    <button type="button" class="icon-btn" data-act="up" data-k="${k}" aria-label="위로" ${k === 0 ? 'disabled' : ''}>${icon('chevronL', 16, 'rot90')}</button>
                    <button type="button" class="icon-btn danger" data-act="del-step" data-k="${k}" aria-label="단계 지우기">${icon('x', 16)}</button>
                  </div>`).join('')}
                <button type="button" class="btn sm" data-act="add-step">${icon('plus', 14)} 단계 추가</button>
              </div>
              <p class="faint" style="font-size:13px">시간을 적으면 "따라 하기"에서 타이머가 돌아가요.</p>
              <div class="form-row" style="justify-content:space-between">
                <button type="button" class="btn ghost danger-text" data-act="del">루틴 지우기</button>
                <span class="head-actions"><button type="button" class="btn ghost" data-act="cancel">취소</button><button type="submit" class="btn primary">저장</button></span>
              </div>
            </form>
          </article>`;
      }
      function draw() {
        const rs = A.data.routines;
        if (!rs.length && !editing) {
          list.innerHTML = `<div class="panel empty">${icon('sunrise', 32)}<p>루틴이 없어요.</p><button type="button" class="btn primary" data-act="new">새 루틴 만들기</button></div>`;
          return;
        }
        const ids = rs.map(r => r.id);
        const extra = editing && !ids.includes(editing.id) ? [editing] : [];
        list.innerHTML = rs.concat(extra).map(r => (editing && editing.id === r.id ? editCard(editing) : viewCard(r))).join('');
        if (editing) { const n = list.querySelector('.editing [data-f="text"]:last-of-type'); if (n && !n.value) n.focus(); }
      }
      function readEdit() {
        const card = list.querySelector('.editing');
        if (!card || !editing) return;
        editing.name = card.querySelector('#rt-name').value;
        editing.when = card.querySelector('#rt-when').value;
        card.querySelectorAll('.rt-edit-row').forEach(row => {
          const s = editing.steps[Number(row.dataset.k)];
          if (!s) return;
          s.text = row.querySelector('[data-f="text"]').value;
          s.min = Math.max(0, Math.min(180, Number(row.querySelector('[data-f="min"]').value) || 0));
        });
      }

      el.addEventListener('click', async e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        const card = b.closest('[data-id]');
        const r = card ? A.data.routines.find(x => x.id === card.dataset.id) : null;
        if (act === 'step' && r) { toggleStep(r.id, b.dataset.sid); draw(); }
        else if (act === 'run' && r) run(r);
        else if (act === 'edit' && r) { editing = A.clone(r); draw(); }
        else if (act === 'new') {
          const h = new Date().getHours();
          editing = { id: A.uid(), name: '', when: h >= 4 && h < 15 ? 'morning' : 'night', steps: [{ id: A.uid(), text: '', min: 0 }] };
          draw();
          const n = list.querySelector('#rt-name'); n && n.focus();
        } else if (act === 'add-step') { readEdit(); editing.steps.push({ id: A.uid(), text: '', min: 0 }); draw(); const rows = list.querySelectorAll('.rt-edit-row [data-f="text"]'); rows[rows.length - 1].focus(); }
        else if (act === 'del-step') { readEdit(); editing.steps.splice(Number(b.dataset.k), 1); draw(); }
        else if (act === 'up') { readEdit(); const k = Number(b.dataset.k); const [s] = editing.steps.splice(k, 1); editing.steps.splice(k - 1, 0, s); draw(); }
        else if (act === 'cancel') { editing = null; draw(); }
        else if (act === 'del') {
          const i = A.data.routines.findIndex(x => x.id === editing.id);
          if (i < 0) { editing = null; draw(); return; }
          const ok = await A.confirm(`"${A.data.routines[i].name}" 루틴을 지울까요?`, { title: '루틴 지우기', ok: '지우기', danger: true });
          if (!ok) return;
          const [gone] = A.data.routines.splice(i, 1);
          A.save('routines'); editing = null; draw();
          A.toast('루틴을 지웠어요', { action: '되돌리기', onAction: () => { A.data.routines.splice(i, 0, gone); A.save('routines'); draw(); } });
        }
      });
      el.addEventListener('submit', e => {
        if (!e.target.closest('[data-form="routine"]')) return;
        e.preventDefault();
        readEdit();
        editing.name = editing.name.trim() || `${WHEN[editing.when].label} 루틴`;
        editing.steps = editing.steps.map(s => Object.assign(s, { text: s.text.trim() })).filter(s => s.text);
        const i = A.data.routines.findIndex(x => x.id === editing.id);
        if (i >= 0) A.data.routines[i] = editing; else A.data.routines.push(editing);
        A.save('routines');
        editing = null;
        draw();
        A.toast('루틴을 저장했어요');
      });

      draw();
      const off = A.on('routine:change', () => { if (!editing) draw(); });
      let day = A.today();
      const offTick = A.on('tick', () => { if (A.today() !== day) { day = A.today(); if (!editing) draw(); } });
      return () => { off(); offTick(); };
    }
  });
})();
