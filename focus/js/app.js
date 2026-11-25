'use strict';
/* 시작: 메뉴, 시계 틱, 다른 탭과 동기화 */
(function () {
  const A = App;
  const { icon } = A;
  const nav = document.getElementById('nav');
  nav.innerHTML = A.order.map(id => {
    const v = A.views.get(id);
    return `<a href="#${id}" data-id="${id}">${icon(v.icon, 19)}<span>${v.label}</span><span class="badge" data-badge="${id}" hidden></span></a>`;
  }).join('');
  if (A.data.prefs.theme === 'system') A.data.prefs.theme = 'dark';
  A.applyTheme();
  window.addEventListener('hashchange', A.route);
  A.route();
  let lastBadge = '';
  setInterval(() => {
    A.emit('tick', new Date());
    const p = A.data.pomo;
    const text = p && p.running ? A.fmtDur(Math.max(0, p.endAt - Date.now())) : '';
    if (text !== lastBadge) {
      lastBadge = text;
      const b = document.querySelector('[data-badge="pomodoro"]');
      if (b) { b.textContent = text; b.hidden = !text; }
    }
  }, 500);
})();
