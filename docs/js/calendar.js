'use strict';
/* 캘린더: 월 보기, 공휴일·대체공휴일, 음력, 일정(매년 반복 가능), 마감일 있는 할 일 */
(function () {
  const A = App;
  const { esc, icon, pad } = A;

  /* ---------- 공휴일 ---------- */
  // [월, 일, 이름, 대체공휴일 규칙] — 'sub': 토·일 또는 다른 공휴일과 겹치면 대체공휴일
  const FIXED = [
    [1, 1, '신정', 'none'], [3, 1, '삼일절', 'sub'], [5, 5, '어린이날', 'sub'], [6, 6, '현충일', 'none'],
    [8, 15, '광복절', 'sub'], [10, 3, '개천절', 'sub'], [10, 9, '한글날', 'sub'], [12, 25, '성탄절', 'sub']
  ];
  const SPECIAL = { '2025-01-27': '임시공휴일', '2025-06-03': '대통령 선거일', '2026-06-03': '지방선거일' };
  // Intl 음력 계산을 쓸 수 없는 브라우저를 위한 예비 값: [설날, 부처님오신날, 추석]
  const FALLBACK = {
    2024: ['2024-02-10', '2024-05-15', '2024-09-17'],
    2025: ['2025-01-29', '2025-05-05', '2025-10-06'],
    2026: ['2026-02-17', '2026-05-24', '2026-09-25'],
    2027: ['2027-02-07', '2027-05-13', '2027-09-15']
  };
  function lunarHolidays(y) {
    const res = {};
    if (A.lunarParts(new Date(y, 0, 1))) {
      for (let d = new Date(y, 0, 15); d.getMonth() < 10; d = A.addDays(d, 1)) {
        const p = A.lunarParts(d);
        if (!p) break;
        if (p.month === '1' && p.day === 1 && d.getMonth() < 3) res.seol = A.ymd(d);
        else if (p.month === '4' && p.day === 8) res.buddha = A.ymd(d);
        else if (p.month === '8' && p.day === 15) res.chuseok = A.ymd(d);
      }
    }
    if ((!res.seol || !res.chuseok) && FALLBACK[y]) {
      [res.seol, res.buddha, res.chuseok] = FALLBACK[y];
    }
    return res;
  }
  const cache = new Map();
  function holidaysOf(y) {
    if (cache.has(y)) return cache.get(y);
    const map = new Map();
    const count = new Map();
    const add = (s, name) => {
      map.set(s, map.has(s) ? `${map.get(s)}·${name}` : name);
      count.set(s, (count.get(s) || 0) + 1);
    };
    const subRule = [];
    const blocks = [];
    FIXED.forEach(([m, d, name, rule]) => {
      const s = `${y}-${pad(m)}-${pad(d)}`;
      add(s, name);
      if (rule === 'sub') subRule.push(s);
    });
    const L = lunarHolidays(y);
    const block = (center, name) => {
      const c = A.parseYmd(center);
      const days = [-1, 0, 1].map(k => A.ymd(A.addDays(c, k)));
      days.forEach((s, i) => add(s, i === 1 ? name : `${name} 연휴`));
      blocks.push(days);
    };
    if (L.seol) block(L.seol, '설날');
    if (L.buddha) { add(L.buddha, '부처님오신날'); subRule.push(L.buddha); }
    if (L.chuseok) block(L.chuseok, '추석');
    Object.keys(SPECIAL).forEach(s => { if (s.startsWith(y + '-')) add(s, SPECIAL[s]); });

    // 대체공휴일 (현행 규정 기준으로 단순화)
    const dow = s => A.parseYmd(s).getDay();
    const triggers = new Set();
    subRule.forEach(s => {
      if (y < 2023 && !s.endsWith('-05-05')) return;
      if (dow(s) === 0 || dow(s) === 6) triggers.add(s);
    });
    blocks.forEach(days => { if (days.some(s => dow(s) === 0)) triggers.add(days[2]); });
    count.forEach((n, s) => { if (n > 1) triggers.add(s); });
    const taken = new Set(map.keys());
    [...triggers].sort().forEach(s => {
      let d = A.addDays(A.parseYmd(s), 1);
      while (d.getDay() === 0 || d.getDay() === 6 || taken.has(A.ymd(d))) d = A.addDays(d, 1);
      const k = A.ymd(d);
      taken.add(k);
      map.set(k, map.has(k) ? `${map.get(k)}·대체공휴일` : '대체공휴일');
    });
    cache.set(y, map);
    return map;
  }
  function nameOf(s) { return holidaysOf(Number(s.slice(0, 4))).get(s) || ''; }
  A.holidays = { of: holidaysOf, nameOf };

  /* ---------- 일정 ---------- */
  function eventsOn(s) {
    return A.data.events
      .filter(e => e.date === s || (e.yearly && e.date.slice(5) === s.slice(5) && e.date <= s))
      .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  }
  A.calUtil = { eventsOn };

  A.register({
    id: 'calendar', label: '캘린더', icon: 'calendar',
    render(el) {
      const now = new Date();
      let sel = A.today();
      let month = new Date(now.getFullYear(), now.getMonth(), 1);
      el.innerHTML = `
        <div class="page">
          <div class="page-head">
            <div class="cal-head">
              <h1 class="sr-only">캘린더</h1>
              <button type="button" class="icon-btn" data-act="prev" aria-label="이전 달">${icon('chevronL')}</button>
              <h2 id="cal-title" aria-live="polite"></h2>
              <button type="button" class="icon-btn" data-act="next" aria-label="다음 달">${icon('chevronR')}</button>
            </div>
            <div class="head-actions"><button type="button" class="btn" data-act="today">오늘</button></div>
          </div>
          <div class="cal">
            <section class="panel cal-board">
              <div class="cal-week">${A.WD.map(w => `<div>${w}</div>`).join('')}</div>
              <div class="cal-grid" id="cal-grid"></div>
            </section>
            <aside class="panel cal-side" id="cal-side"></aside>
          </div>
        </div>`;
      const $ = s => el.querySelector(s);

      function drawGrid() {
        const y = month.getFullYear(), m = month.getMonth();
        $('#cal-title').textContent = `${y}년 ${m + 1}월`;
        const start = A.addDays(month, -month.getDay());
        const t = A.today();
        const todosByDay = {};
        A.data.todos.forEach(x => { if (x.due && !x.done) (todosByDay[x.due] = todosByDay[x.due] || []).push(x); });
        let html = '';
        for (let i = 0; i < 42; i++) {
          const d = A.addDays(start, i);
          const s = A.ymd(d);
          const hol = nameOf(s);
          const evs = eventsOn(s);
          const tds = todosByDay[s] || [];
          const cls = [
            'cal-day',
            d.getMonth() !== m ? 'out' : '',
            d.getDay() === 0 ? 'sun' : '',
            d.getDay() === 6 ? 'sat' : '',
            hol ? 'hol' : '',
            s === t ? 'today' : '',
            s === sel ? 'sel' : ''
          ].filter(Boolean).join(' ');
          const chips = evs.slice(0, 2).map(e => `<span class="cal-ev">${e.time ? e.time + ' ' : ''}${esc(e.title)}</span>`).join('') +
            (tds.length && evs.length < 2 ? `<span class="cal-ev todo">할 일 ${tds.length}</span>` : '');
          const more = evs.length > 2 ? `<span class="cal-more">+${evs.length - 2 + (tds.length ? 1 : 0)}</span>` : '';
          const dots = (hol ? '<i class="hol"></i>' : '') + evs.slice(0, 3).map(() => '<i></i>').join('') + (tds.length ? '<i class="todo"></i>' : '');
          const label = `${d.getMonth() + 1}월 ${d.getDate()}일${hol ? ' ' + hol : ''}${evs.length ? `, 일정 ${evs.length}개` : ''}`;
          html += `<button type="button" class="${cls}" data-day="${s}" aria-label="${esc(label)}" aria-pressed="${s === sel}">
            <span class="cal-num">${d.getDate()}</span>
            ${hol ? `<span class="cal-hol">${esc(hol)}</span>` : ''}
            ${chips}${more}
            <span class="cal-dots">${dots}</span>
          </button>`;
        }
        $('#cal-grid').innerHTML = html;
      }

      function drawSide() {
        const d = A.parseYmd(sel);
        const hol = nameOf(sel);
        const lun = A.lunar(d);
        const evs = eventsOn(sel);
        const tds = A.data.todos.filter(x => x.due === sel).sort(A.todoUtil.compare);
        const spent = A.data.txs.filter(x => x.date === sel && x.type === 'out').reduce((s, x) => s + x.amount, 0);
        const n = A.diffDays(new Date(), d);
        const rel = n === 0 ? '오늘' : n > 0 ? `${n}일 후` : `${-n}일 전`;
        $('#cal-side').innerHTML = `
          <div>
            <h3>${d.getMonth() + 1}월 ${d.getDate()}일 ${A.WD[d.getDay()]}요일</h3>
            <p class="faint" style="font-size:13px;margin-top:4px">${[rel, lun, hol].filter(Boolean).map(esc).join(' · ')}</p>
          </div>
          <form class="form-grid" id="ev-form" style="gap:8px">
            <input class="input" id="ev-title" placeholder="일정 추가 (예: 치과 예약)" autocomplete="off" aria-label="일정 이름">
            <div class="form-row">
              <input class="input grow" type="time" id="ev-time" aria-label="시간 (선택)">
              <button class="btn primary" type="submit">추가</button>
            </div>
            <label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--ink-2)"><input type="checkbox" id="ev-yearly"> 매년 반복 (생일, 기념일)</label>
          </form>
          <div>
            <h4 class="panel-title" style="margin-bottom:4px">일정</h4>
            ${evs.length ? `<ul>${evs.map(e => `
              <li class="list-row">
                <span class="ev-time">${e.time ? A.fmtHM(e.time) : '하루 종일'}</span>
                <span class="grow">${esc(e.title)}${e.yearly ? ' <span class="tag">매년</span>' : ''}</span>
                <button type="button" class="icon-btn danger" data-act="ev-del" data-id="${e.id}" aria-label="${esc(e.title)} 지우기">${icon('trash', 16)}</button>
              </li>`).join('')}</ul>` : '<p class="empty-sm">이 날은 일정이 없어요.</p>'}
          </div>
          ${tds.length ? `<div>
            <h4 class="panel-title" style="margin-bottom:4px">마감인 할 일</h4>
            <ul>${tds.map(x => `
              <li class="list-row ${x.done ? 'done' : ''}">
                <button type="button" class="check ${x.done ? 'on' : ''}" data-act="td-toggle" data-id="${x.id}" aria-label="완료 표시">${icon('check', 14)}</button>
                <span class="grow" style="${x.done ? 'text-decoration:line-through;color:var(--ink-3)' : ''}">${esc(x.text)}</span>
              </li>`).join('')}</ul>
          </div>` : ''}
          ${spent ? `<a class="kv" href="#budget" style="text-decoration:none;color:inherit;border-top:1px solid var(--line);padding-top:12px"><span>이 날 쓴 돈</span><strong class="mono">${A.won(spent)}</strong></a>` : ''}`;
      }

      function draw() { drawGrid(); drawSide(); }

      el.addEventListener('click', e => {
        const day = e.target.closest('[data-day]');
        if (day) {
          sel = day.dataset.day;
          const d = A.parseYmd(sel);
          if (d.getMonth() !== month.getMonth()) month = new Date(d.getFullYear(), d.getMonth(), 1);
          draw();
          if (window.matchMedia('(max-width: 1100px)').matches) $('#cal-side').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return;
        }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'prev' || act === 'next') {
          month = new Date(month.getFullYear(), month.getMonth() + (act === 'prev' ? -1 : 1), 1);
          drawGrid();
        } else if (act === 'today') {
          const n = new Date();
          month = new Date(n.getFullYear(), n.getMonth(), 1);
          sel = A.today();
          draw();
        } else if (act === 'ev-del') {
          const i = A.data.events.findIndex(x => x.id === b.dataset.id);
          if (i < 0) return;
          const [gone] = A.data.events.splice(i, 1);
          A.save('events'); draw();
          A.toast('일정을 지웠어요', { action: '되돌리기', onAction: () => { A.data.events.splice(i, 0, gone); A.save('events'); draw(); } });
        } else if (act === 'td-toggle') {
          const x = A.data.todos.find(t => t.id === b.dataset.id);
          if (x) { x.done = !x.done; x.doneAt = x.done ? Date.now() : null; A.save('todos'); draw(); }
        }
      });
      el.addEventListener('submit', e => {
        if (e.target.id !== 'ev-form') return;
        e.preventDefault();
        const title = $('#ev-title').value.trim();
        if (!title) { $('#ev-title').focus(); return; }
        A.data.events.push({ id: A.uid(), date: sel, time: $('#ev-time').value, title, yearly: $('#ev-yearly').checked });
        A.save('events');
        draw();
        $('#ev-title').focus();
      });

      draw();
    }
  });
})();
