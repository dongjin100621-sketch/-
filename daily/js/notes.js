'use strict';
/* 메모: 목록 + 편집기, 자동 저장, 고정, 색, 검색, 글자 수 */
(function () {
  const A = App;
  const { esc, icon } = A;
  const COLORS = [['none', '기본'], ['yellow', '노랑'], ['green', '초록'], ['blue', '파랑'], ['red', '빨강']];

  const firstLine = s => {
    const line = String(s || '').split('\n').find(l => l.trim());
    return line ? line.trim().slice(0, 80) : '';
  };
  function create(text = '') {
    let title = '', body = '';
    if (text) {
      const lines = text.split('\n');
      title = lines[0].trim().slice(0, 80);
      body = lines.slice(1).join('\n').replace(/^\n+/, '');
    }
    const n = { id: A.uid(), title, body, color: 'none', pinned: false, created: Date.now(), updated: Date.now() };
    A.data.notes.unshift(n);
    A.save('notes');
    return n;
  }
  A.notesUtil = { firstLine, create };

  const isEmpty = n => !n.title.trim() && !n.body.trim();
  function countChars(s) {
    return { all: [...s].length, noSpace: [...s.replace(/\s/g, '')].length };
  }

  A.register({
    id: 'notes', label: '메모', icon: 'note',
    render(el) {
      const fromHome = A.data.ui.noteSel;
      if (fromHome) { delete A.data.ui.noteSel; A.save('ui'); }
      let q = '';
      const find = id => A.data.notes.find(n => n.id === id);
      const visible = () => {
        const needle = q.trim().toLowerCase();
        return A.data.notes
          .filter(n => !needle || n.title.toLowerCase().includes(needle) || n.body.toLowerCase().includes(needle))
          .sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
      };
      let sel = fromHome && find(fromHome) ? fromHome : (A.data.ui.noteLast && find(A.data.ui.noteLast) ? A.data.ui.noteLast : (visible()[0] || {}).id || null);
      let editing = !!fromHome;

      el.innerHTML = `
        <div class="page">
          <div class="page-head">
            <div><h1>메모</h1><p class="sub">입력하는 즉시 저장돼요.</p></div>
            <div class="head-actions"><button type="button" class="btn primary" data-act="new">${icon('plus', 18)} 새 메모</button></div>
          </div>
          <div class="notes" id="notes">
            <div class="note-side">
              <div class="note-search"><input class="input" id="note-q" type="search" placeholder="메모 검색" aria-label="메모 검색" autocomplete="off"></div>
              <div class="note-list" id="note-list"></div>
            </div>
            <div class="note-editor" id="note-editor"></div>
          </div>
        </div>`;
      const $ = s => el.querySelector(s);
      const wrap = $('#notes');

      const persist = A.debounce(() => {
        A.save('notes');
        const s = $('#note-saved');
        if (s) { const c = A.fmtClock(new Date()); s.textContent = `저장됨 · ${c.ampm} ${c.hm}`; }
      }, 300);

      function prune(keepId) {
        const before = A.data.notes.length;
        A.data.notes = A.data.notes.filter(n => n.id === keepId || !isEmpty(n));
        if (A.data.notes.length !== before) A.save('notes');
      }

      function drawList() {
        const list = visible();
        const box = $('#note-list');
        if (!list.length) {
          box.innerHTML = `<p class="empty-sm" style="padding:16px">${q ? '찾는 메모가 없어요.' : '아직 메모가 없어요.'}</p>`;
          return;
        }
        box.innerHTML = list.map(n => {
          const title = n.title.trim() || firstLine(n.body) || '제목 없음';
          const snip = n.title.trim() ? firstLine(n.body) : firstLine(n.body.split('\n').slice(1).join('\n'));
          return `
            <button type="button" class="note-item ${n.id === sel ? 'active' : ''}" data-sel="${n.id}">
              <span class="note-item-top"><span class="dot ${n.color !== 'none' ? n.color : ''}"></span><span class="note-item-title ellipsis">${esc(title)}</span>${n.pinned ? icon('pin', 14) : ''}</span>
              <span class="note-item-snip ellipsis">${esc(snip || '내용 없음')}</span>
              <span class="note-item-date">${A.relTime(n.updated)}</span>
            </button>`;
        }).join('');
      }

      function drawMeta() {
        const n = find(sel);
        const box = $('#note-count');
        if (!n || !box) return;
        const c = countChars(n.title + (n.title && n.body ? '\n' : '') + n.body);
        box.textContent = `공백 포함 ${A.num(c.all)}자 · 공백 제외 ${A.num(c.noSpace)}자`;
      }

      function drawEditor() {
        const n = find(sel);
        const box = $('#note-editor');
        wrap.classList.toggle('editing', editing && !!n);
        if (!n) {
          box.innerHTML = `<div class="empty" style="margin:auto">${icon('note', 32)}<p>${A.data.notes.length ? '왼쪽에서 메모를 고르세요.' : '첫 메모를 써 보세요.'}</p><button type="button" class="btn primary" data-act="new">새 메모</button></div>`;
          return;
        }
        A.data.ui.noteLast = n.id;
        A.save('ui');
        box.innerHTML = `
          <div class="note-tools">
            <button type="button" class="icon-btn note-back" data-act="back" aria-label="목록으로">${icon('back')}</button>
            <button type="button" class="icon-btn ${n.pinned ? 'on' : ''}" data-act="pin" aria-pressed="${n.pinned}" aria-label="위에 고정" title="위에 고정">${icon('pin', 18)}</button>
            <div class="color-pick" role="group" aria-label="메모 색">
              ${COLORS.map(([c, label]) => `<button type="button" class="${n.color === c ? 'on' : ''}" data-color="${c}" aria-label="${label}" aria-pressed="${n.color === c}" title="${label}"><span class="dot ${c !== 'none' ? c : ''}"></span></button>`).join('')}
            </div>
            <span class="spacer"></span>
            <button type="button" class="icon-btn" data-act="copy" aria-label="내용 복사" title="내용 복사">${icon('copy', 18)}</button>
            <button type="button" class="icon-btn danger" data-act="delete" aria-label="메모 지우기" title="메모 지우기">${icon('trash', 18)}</button>
          </div>
          <div class="note-body-wrap">
            <input class="note-title" id="note-title" placeholder="제목" value="${esc(n.title)}" aria-label="제목" autocomplete="off">
            <textarea class="note-body" id="note-body" placeholder="내용을 적어 보세요" aria-label="내용">${esc(n.body)}</textarea>
          </div>
          <div class="note-meta"><span id="note-count"></span><span id="note-saved">${A.relTime(n.updated)} 수정</span></div>`;
        drawMeta();
      }

      function select(id, focusBody) {
        if (sel !== id) prune(id);
        sel = id;
        editing = true;
        drawList();
        drawEditor();
        if (focusBody) { const b = $('#note-body'); b && b.focus(); }
      }

      el.addEventListener('click', e => {
        const item = e.target.closest('[data-sel]');
        if (item) { select(item.dataset.sel); return; }
        const colorBtn = e.target.closest('[data-color]');
        const n = find(sel);
        if (colorBtn && n) {
          n.color = colorBtn.dataset.color; n.updated = Date.now();
          A.save('notes'); drawList(); drawEditor();
          return;
        }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'new') {
          q = ''; $('#note-q').value = '';
          prune();
          const fresh = create();
          sel = fresh.id; editing = true;
          drawList(); drawEditor();
          $('#note-title').focus();
        } else if (act === 'back') {
          editing = false; prune(); drawList(); drawEditor();
        } else if (act === 'pin' && n) {
          n.pinned = !n.pinned; A.save('notes'); drawList(); drawEditor();
          A.toast(n.pinned ? '맨 위에 고정했어요' : '고정을 풀었어요');
        } else if (act === 'copy' && n) {
          const text = [n.title, n.body].filter(Boolean).join('\n\n');
          const done = () => A.toast('메모 내용을 복사했어요');
          const fail = () => { const ta = $('#note-body'); ta.focus(); ta.select(); A.toast('복사하지 못했어요. 선택된 내용을 직접 복사하세요.'); };
          try { navigator.clipboard.writeText(text).then(done, fail); } catch (err) { fail(); }
        } else if (act === 'delete' && n) {
          const idx = A.data.notes.indexOf(n);
          A.data.notes.splice(idx, 1);
          A.save('notes');
          const rest = visible();
          sel = rest.length ? rest[0].id : null;
          editing = false;
          drawList(); drawEditor();
          if (!isEmpty(n)) {
            A.toast('메모를 지웠어요', {
              action: '되돌리기',
              onAction: () => { A.data.notes.splice(idx, 0, n); A.save('notes'); sel = n.id; drawList(); drawEditor(); }
            });
          }
        }
      });

      el.addEventListener('input', e => {
        if (e.target.id === 'note-q') { q = e.target.value; drawList(); return; }
        const n = find(sel);
        if (!n) return;
        if (e.target.id === 'note-title') n.title = e.target.value;
        else if (e.target.id === 'note-body') n.body = e.target.value;
        else return;
        n.updated = Date.now();
        const s = $('#note-saved');
        if (s) s.textContent = '저장 중…';
        persist();
        drawList();
        drawMeta();
      });
      el.addEventListener('keydown', e => {
        if (e.target.id === 'note-title' && e.key === 'Enter') { e.preventDefault(); $('#note-body').focus(); }
      });

      drawList();
      drawEditor();
      if (fromHome) { const b = $('#note-body'); b && b.focus(); }
      return () => { persist.flush(); prune(); };
    }
  });
})();
