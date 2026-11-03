'use strict';
/* 할 일: 여러 목록, 마감일, 중요 표시, 필터, 인라인 수정 */
(function () {
  const A = App;
  const { esc, icon } = A;

  function rank(x, t) {
    if (x.due && x.due <= t) return x.priority ? 0 : 1;
    if (x.priority) return 2;
    return 3;
  }
  function compare(a, b) {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    if (a.done) return (b.doneAt || 0) - (a.doneAt || 0);
    const t = A.today();
    const ra = rank(a, t), rb = rank(b, t);
    if (ra !== rb) return ra - rb;
    const da = a.due || '9999-99-99', db = b.due || '9999-99-99';
    if (da !== db) return da.localeCompare(db);
    return (a.created || 0) - (b.created || 0);
  }
  function add({ text, due = '', priority = false, listId }) {
    const item = {
      id: A.uid(),
      listId: listId || A.data.todoLists[0].id,
      text, due, priority, done: false, created: Date.now()
    };
    A.data.todos.push(item);
    A.save('todos');
    return item;
  }
  function dueTag(x) {
    if (!x.due) return '';
    const t = A.today();
    const n = A.diffDays(new Date(), A.parseYmd(x.due));
    if (x.done) return `<span class="tag">${A.relDay(x.due)}</span>`;
    if (n < 0) return `<span class="tag red">${n === -1 ? '어제까지' : `${-n}일 지남`}</span>`;
    if (x.due === t) return '<span class="tag yellow">오늘</span>';
    if (n === 1) return '<span class="tag blue">내일</span>';
    const d = A.parseYmd(x.due);
    return `<span class="tag">${d.getMonth() + 1}/${d.getDate()} (${A.WD[d.getDay()]})</span>`;
  }
  A.todoUtil = { compare, add, dueTag };

  A.register({
    id: 'todo', label: '할 일', icon: 'todo',
    render(el) {
      const ui = A.data.ui;
      let listId = A.data.todoLists.some(l => l.id === ui.todoList) ? ui.todoList : A.data.todoLists[0].id;
      let filter = ui.todoFilter || 'active';
      let prio = false;
      el.innerHTML = `
        <div class="page">
          <div class="page-head">
            <div><h1>할 일</h1><p class="sub" id="td-sub"></p></div>
            <div class="head-actions">
              <div class="seg" id="td-filter" role="group" aria-label="보기">
                <button type="button" data-filter="active">남은 일</button>
                <button type="button" data-filter="all">전체</button>
                <button type="button" data-filter="done">완료</button>
              </div>
            </div>
          </div>
          <div class="chips scroll" id="td-lists" role="tablist" aria-label="목록"></div>
          <section class="panel todo-wrap">
            <form class="todo-add" id="td-form">
              <input class="input" id="td-text" placeholder="할 일을 적고 Enter" autocomplete="off" aria-label="새 할 일">
              <input class="input" type="date" id="td-due" aria-label="마감일 (선택)">
              <button type="button" class="btn prio-btn" id="td-prio" aria-pressed="false" title="중요 표시">${icon('flag', 16)} 중요</button>
              <button class="btn primary" type="submit">추가</button>
            </form>
            <ul class="todo-list" id="td-items"></ul>
            <div class="todo-foot" id="td-foot"></div>
          </section>
        </div>`;
      const $ = s => el.querySelector(s);

      function persistUi() { ui.todoList = listId; ui.todoFilter = filter; A.save('ui'); }

      function draw() {
        const lists = A.data.todoLists;
        $('#td-lists').innerHTML = lists.map(l => {
          const left = A.data.todos.filter(x => x.listId === l.id && !x.done).length;
          return `<button type="button" role="tab" class="chip ${l.id === listId ? 'on' : ''}" aria-selected="${l.id === listId}" data-list="${l.id}">${esc(l.name)}<span class="count">${left}</span></button>`;
        }).join('') + `<button type="button" class="chip" data-act="add-list">${icon('plus', 14)} 새 목록</button>`;

        el.querySelectorAll('#td-filter button').forEach(b => b.classList.toggle('on', b.dataset.filter === filter));

        const all = A.data.todos.filter(x => x.listId === listId);
        const items = all.filter(x => filter === 'all' || (filter === 'done' ? x.done : !x.done)).sort(compare);
        const doneN = all.filter(x => x.done).length;
        const overdue = all.filter(x => !x.done && x.due && x.due < A.today()).length;
        $('#td-sub').textContent = all.length
          ? `${all.length - doneN}개 남음${overdue ? ` · 마감 지난 일 ${overdue}개` : ''}`
          : '목록이 비어 있어요.';

        $('#td-items').innerHTML = items.length ? items.map(x => `
          <li class="todo-item ${x.done ? 'done' : ''}" data-id="${x.id}">
            <button type="button" class="check ${x.done ? 'on' : ''}" data-act="toggle" aria-label="${x.done ? '완료 취소' : '완료 표시'}">${icon('check', 14)}</button>
            <span class="todo-text" data-act="edit" tabindex="0" title="눌러서 고치기">${esc(x.text)}</span>
            <span class="todo-meta">${A.todoUtil.dueTag(x)}${x.priority ? '<span class="tag red">중요</span>' : ''}</span>
            <button type="button" class="icon-btn ${x.priority ? 'on' : ''}" data-act="prio" aria-pressed="${!!x.priority}" aria-label="중요 표시" title="중요 표시">${icon('flag', 16)}</button>
            <button type="button" class="icon-btn danger" data-act="del" aria-label="지우기" title="지우기">${icon('trash', 16)}</button>
          </li>`).join('')
          : `<li class="empty">${icon('todo', 30)}<p>${filter === 'done' ? '완료한 일이 아직 없어요.' : filter === 'active' && all.length ? '모두 끝냈어요. 수고했어요!' : '위 입력칸에 첫 할 일을 적어 보세요.'}</p></li>`;

        const pct = all.length ? Math.round(doneN / all.length * 100) : 0;
        $('#td-foot').innerHTML = `
          <span class="num">${all.length}개 중 ${doneN}개 완료</span>
          <div class="bar"><i style="width:${pct}%"></i></div>
          <span class="head-actions">
            ${doneN ? '<button type="button" class="btn sm ghost" data-act="clear-done">완료 항목 지우기</button>' : ''}
            <button type="button" class="btn sm ghost" data-act="rename-list">목록 이름 바꾸기</button>
            ${A.data.todoLists.length > 1 ? '<button type="button" class="btn sm ghost" data-act="del-list">목록 지우기</button>' : ''}
          </span>`;
      }

      function listNameModal(title, initial, onSave) {
        const m = A.modal({
          title,
          body: `<form id="ln-form"><label class="field"><span>목록 이름</span><input class="input" id="ln-name" value="${esc(initial)}" placeholder="예: 장보기, 회사, 여행 준비" required autocomplete="off"></label></form>`,
          actions: [
            { label: '취소', kind: 'ghost' },
            { label: '저장', kind: 'primary', onClick: () => { const v = m.el.querySelector('#ln-name').value.trim(); if (!v) return false; onSave(v); } }
          ],
          onMount(box, api) {
            box.querySelector('#ln-form').addEventListener('submit', e => {
              e.preventDefault();
              const v = box.querySelector('#ln-name').value.trim();
              if (v) { onSave(v); api.close(); }
            });
          }
        });
      }

      function startEdit(span) {
        const li = span.closest('.todo-item');
        const x = A.data.todos.find(t => t.id === li.dataset.id);
        if (!x) return;
        const input = document.createElement('input');
        input.className = 'input todo-edit';
        input.value = x.text;
        input.setAttribute('aria-label', '할 일 고치기');
        span.replaceWith(input);
        input.focus();
        input.select();
        let finished = false;
        const finish = saveIt => {
          if (finished) return;
          finished = true;
          const v = input.value.trim();
          if (saveIt && v && v !== x.text) { x.text = v; A.save('todos'); }
          draw();
        };
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); finish(true); }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
        });
        input.addEventListener('blur', () => finish(true));
      }

      el.addEventListener('click', async e => {
        const listBtn = e.target.closest('[data-list]');
        if (listBtn) { listId = listBtn.dataset.list; persistUi(); draw(); return; }
        const fBtn = e.target.closest('[data-filter]');
        if (fBtn) { filter = fBtn.dataset.filter; persistUi(); draw(); return; }
        if (e.target.closest('#td-prio')) {
          prio = !prio;
          const b = $('#td-prio');
          b.classList.toggle('on', prio);
          b.setAttribute('aria-pressed', prio);
          return;
        }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        const li = b.closest('.todo-item');
        const x = li ? A.data.todos.find(t => t.id === li.dataset.id) : null;
        if (act === 'toggle' && x) {
          x.done = !x.done;
          x.doneAt = x.done ? Date.now() : null;
          A.save('todos');
          draw();
        } else if (act === 'edit') {
          startEdit(b);
        } else if (act === 'prio' && x) {
          x.priority = !x.priority; A.save('todos'); draw();
        } else if (act === 'del' && x) {
          const i = A.data.todos.indexOf(x);
          A.data.todos.splice(i, 1); A.save('todos'); draw();
          A.toast('할 일을 지웠어요', { action: '되돌리기', onAction: () => { A.data.todos.splice(i, 0, x); A.save('todos'); draw(); } });
        } else if (act === 'clear-done') {
          const removed = A.data.todos.filter(t => t.listId === listId && t.done);
          A.data.todos = A.data.todos.filter(t => !(t.listId === listId && t.done));
          A.save('todos'); draw();
          A.toast(`완료한 일 ${removed.length}개를 지웠어요`, { action: '되돌리기', onAction: () => { A.data.todos.push(...removed); A.save('todos'); draw(); } });
        } else if (act === 'add-list') {
          listNameModal('새 목록', '', name => {
            const l = { id: A.uid(), name };
            A.data.todoLists.push(l); A.save('todoLists');
            listId = l.id; persistUi(); draw();
            $('#td-text').focus();
          });
        } else if (act === 'rename-list') {
          const l = A.data.todoLists.find(x => x.id === listId);
          listNameModal('목록 이름 바꾸기', l.name, name => { l.name = name; A.save('todoLists'); draw(); });
        } else if (act === 'del-list') {
          const l = A.data.todoLists.find(x => x.id === listId);
          const n = A.data.todos.filter(t => t.listId === listId).length;
          const ok = await A.confirm(`'${l.name}' 목록${n ? `과 그 안의 할 일 ${n}개` : ''}를 지울까요?`, { title: '목록 지우기', ok: '지우기', danger: true });
          if (!ok) return;
          A.data.todoLists = A.data.todoLists.filter(x => x.id !== listId);
          A.data.todos = A.data.todos.filter(t => t.listId !== listId);
          A.save('todoLists'); A.save('todos');
          listId = A.data.todoLists[0].id; persistUi(); draw();
        }
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.matches('.todo-text')) { e.preventDefault(); startEdit(e.target); }
      });
      $('#td-form').addEventListener('submit', e => {
        e.preventDefault();
        const text = $('#td-text').value.trim();
        if (!text) { $('#td-text').focus(); return; }
        add({ text, due: $('#td-due').value, priority: prio, listId });
        $('#td-text').value = '';
        prio = false;
        $('#td-prio').classList.remove('on');
        $('#td-prio').setAttribute('aria-pressed', 'false');
        if (filter === 'done') filter = 'active';
        persistUi();
        draw();
        $('#td-text').focus();
      });

      draw();
    }
  });
})();
