'use strict';
/* 전체 찾기: 메모, 할 일, 일정, 일기, 가계부, 루틴, 디데이를 한 번에 찾는다. ⌘K / Ctrl+K 또는 "/" */
(function () {
  const A = App;
  const { esc, icon } = A;

  const GO = [
    ['home', '홈'], ['routine', '루틴'], ['todo', '할 일'], ['calendar', '캘린더'], ['notes', '메모'], ['journal', '일기'],
    ['health', '건강'], ['budget', '가계부'], ['habits', '습관'], ['music', '음악'], ['timer', '타이머'], ['alarm', '알람'],
    ['sleep', '잠'], ['calc', '계산기'], ['prefs', '설정']
  ];

  function hit(text, q) { return String(text || '').toLowerCase().includes(q); }
  function snippet(text, q) {
    const s = String(text || '').replace(/\s+/g, ' ');
    const i = s.toLowerCase().indexOf(q);
    const from = Math.max(0, i - 20);
    const part = s.slice(from, from + 70);
    const j = part.toLowerCase().indexOf(q);
    if (j < 0) return esc(part);
    return (from ? '…' : '') + esc(part.slice(0, j)) + `<mark>${esc(part.slice(j, j + q.length))}</mark>` + esc(part.slice(j + q.length));
  }
  function find(raw) {
    const q = raw.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    GO.forEach(([id, label]) => { if (hit(label, q) && A.views.get(id)) out.push({ group: '바로 가기', title: label, icon: A.views.get(id).icon, run: () => A.go(id) }); });
    A.data.notes.forEach(n => {
      if (hit(n.title, q) || hit(n.body, q)) out.push({ group: '메모', title: n.title || A.notesUtil.firstLine(n.body) || '제목 없음', sub: snippet(n.body, q), icon: 'note', run: () => { A.data.ui.noteSel = n.id; A.save('ui'); A.go('notes'); } });
    });
    A.data.todos.forEach(t => {
      if (hit(t.text, q)) out.push({ group: '할 일', title: t.text, sub: `${t.done ? '끝냄' : '남음'}${t.due ? ' · ' + A.relDay(t.due) : ''}`, icon: 'todo', run: () => A.go('todo') });
    });
    A.data.events.forEach(e => {
      if (hit(e.title, q)) out.push({ group: '일정', title: e.title, sub: `${e.date}${e.time ? ' ' + A.fmtHM(e.time) : ''}`, icon: 'calendar', run: () => A.go('calendar') });
    });
    Object.keys(A.data.journal).sort().reverse().forEach(k => {
      const j = A.data.journal[k];
      const all = j.text + ' ' + j.grateful.join(' ');
      const d = A.parseYmd(k);
      if (hit(all, q)) out.push({ group: '일기', title: `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${A.WD[d.getDay()]})`, sub: snippet(all, q), icon: 'book', run: () => { A.data.ui.journalDay = k; A.go('journal'); } });
    });
    A.data.txs.forEach(x => {
      if (hit(x.memo, q) || hit(x.category, q)) out.push({ group: '가계부', title: x.memo || x.category, sub: `${x.date} · ${x.type === 'in' ? '+' : '-'}${A.won(x.amount)}`, icon: 'wallet', run: () => A.go('budget') });
    });
    A.data.routines.forEach(r => {
      if (hit(r.name, q) || r.steps.some(s => hit(s.text, q))) out.push({ group: '루틴', title: r.name, sub: esc(r.steps.filter(s => hit(s.text, q)).map(s => s.text).join(', ')), icon: 'sunrise', run: () => A.go('routine') });
    });
    A.data.ddays.forEach(d => { if (hit(d.title, q)) out.push({ group: '디데이', title: d.title, sub: d.date, icon: 'flag', run: () => A.go('home') }); });
    return out.slice(0, 60);
  }

  function open() {
    if (document.querySelector('.search-modal')) return;
    let results = [], sel = 0;
    const m = A.modal({
      title: '찾기',
      className: 'search-modal',
      body: `
        <input class="input" id="sq" type="search" placeholder="메모, 할 일, 일정, 일기, 지출… 무엇이든" autocomplete="off" aria-label="찾을 내용" autofocus>
        <div class="search-res" id="sr" role="listbox"><p class="empty-sm">찾을 말을 적어 보세요. 메뉴 이름을 적으면 바로 갈 수 있어요.</p></div>`,
      onMount(box) {
        const inp = box.querySelector('#sq'), res = box.querySelector('#sr');
        function draw() {
          if (!inp.value.trim()) { res.innerHTML = '<p class="empty-sm">찾을 말을 적어 보세요. 메뉴 이름을 적으면 바로 갈 수 있어요.</p>'; return; }
          if (!results.length) { res.innerHTML = '<p class="empty-sm">찾는 내용이 없어요.</p>'; return; }
          let g = '';
          res.innerHTML = results.map((r, i) => {
            const head = r.group !== g ? `<p class="sr-group">${esc(r.group)}</p>` : '';
            g = r.group;
            return `${head}<button type="button" class="sr-item ${i === sel ? 'sel' : ''}" data-i="${i}" role="option" aria-selected="${i === sel}">${icon(r.icon, 18)}<span class="grow"><b>${esc(r.title)}</b>${r.sub ? `<small>${r.sub}</small>` : ''}</span></button>`;
          }).join('');
          const s = res.querySelector('.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
        }
        inp.addEventListener('input', () => { results = find(inp.value); sel = 0; draw(); });
        inp.addEventListener('keydown', e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); draw(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
          else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); const r = results[sel]; m.close(); r.run(); }
        });
        res.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; const r = results[Number(b.dataset.i)]; m.close(); r.run(); });
      }
    });
  }
  A.search = { open };

  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'k') { e.preventDefault(); open(); return; }
    if (k === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const a = document.activeElement;
      if (a && (a.matches('input, textarea, select, [contenteditable]'))) return;
      if (document.querySelector('.modal-wrap, .ringer, .night')) return;
      e.preventDefault(); open();
    }
  });
})();
