'use strict';
/* 습관: 최근 7일 체크, 연속 기록, 최근 30일 달성률과 5주 기록 */
(function () {
  const A = App;
  const { esc, icon } = A;

  function streak(h) {
    const log = h.log || {};
    let d = new Date();
    if (!log[A.ymd(d)]) d = A.addDays(d, -1);
    let n = 0;
    while (log[A.ymd(d)]) { n++; d = A.addDays(d, -1); }
    return n;
  }
  function best(h) {
    const days = Object.keys(h.log || {}).filter(k => h.log[k]).sort();
    let bestN = 0, cur = 0, prev = null;
    days.forEach(k => {
      cur = prev && A.diffDays(A.parseYmd(prev), A.parseYmd(k)) === 1 ? cur + 1 : 1;
      bestN = Math.max(bestN, cur);
      prev = k;
    });
    return bestN;
  }
  function rate30(h) {
    const log = h.log || {};
    const created = h.created ? A.startOfDay(new Date(h.created)) : A.addDays(new Date(), -29);
    const span = Math.min(30, Math.max(1, A.diffDays(created, new Date()) + 1));
    let n = 0;
    for (let i = 0; i < span; i++) if (log[A.ymd(A.addDays(new Date(), -i))]) n++;
    return Math.round(n / span * 100);
  }
  function toggle(id, day) {
    const h = A.data.habits.find(x => x.id === id);
    if (!h) return;
    h.log = h.log || {};
    if (h.log[day]) delete h.log[day]; else h.log[day] = true;
    A.save('habits');
  }
  A.habitUtil = { streak, toggle };

  A.register({
    id: 'habits', label: '습관', icon: 'habit',
    render(el) {
      el.innerHTML = `
        <div class="page">
          <div class="page-head">
            <div><h1>습관</h1><p class="sub" id="hb-sub"></p></div>
          </div>
          <section class="panel">
            <form class="form-row" id="hb-form">
              <input class="input grow" id="hb-name" placeholder="새 습관 (예: 물 8잔, 영어 단어 20개, 산책 30분)" autocomplete="off" aria-label="새 습관 이름">
              <button class="btn primary" type="submit">${icon('plus', 18)} 추가</button>
            </form>
          </section>
          <section class="panel" id="hb-list"></section>
        </div>`;
      const $ = s => el.querySelector(s);
      let open = null;

      function draw() {
        const hs = A.data.habits;
        const t = A.today();
        const done = hs.filter(h => h.log && h.log[t]).length;
        $('#hb-sub').textContent = hs.length ? `오늘 ${hs.length}개 중 ${done}개 했어요.` : '매일 하고 싶은 일을 정해 체크해 보세요.';
        const days = [...Array(7)].map((_, i) => A.addDays(new Date(), i - 6));
        if (!hs.length) {
          $('#hb-list').innerHTML = `<div class="empty">${icon('habit', 32)}<p>아직 습관이 없어요.<br><span class="faint">위에서 작은 것부터 하나 만들어 보세요.</span></p></div>`;
          return;
        }
        const head = `
          <div class="habit-row head" aria-hidden="true">
            <div class="habit-info"></div>
            <div class="hcells">${days.map(d => {
              const s = A.ymd(d);
              return `<div class="hlabel ${s === t ? 'today' : ''} ${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''}">${A.WD[d.getDay()]}<b>${d.getDate()}</b></div>`;
            }).join('')}</div>
          </div>`;
        $('#hb-list').innerHTML = head + hs.map(h => {
          const st = streak(h);
          const isOpen = open === h.id;
          const heat = isOpen ? [...Array(35)].map((_, i) => {
            const d = A.addDays(new Date(), i - 34);
            return `<i class="${h.log && h.log[A.ymd(d)] ? 'on' : ''}" title="${d.getMonth() + 1}/${d.getDate()}"></i>`;
          }).join('') : '';
          return `
            <div class="habit-row" data-id="${h.id}">
              <div class="habit-info">
                <div class="habit-name"><span class="ellipsis">${esc(h.name)}</span>
                  <button type="button" class="icon-btn" data-act="more" aria-expanded="${isOpen}" aria-label="${esc(h.name)} 기록 보기" title="기록 보기">${icon(isOpen ? 'chevronL' : 'chevronR', 16)}</button>
                </div>
                <div class="habit-stats"><span>연속 <b>${st}</b>일</span><span>최근 30일 <b>${rate30(h)}</b>%</span><span>최고 <b>${best(h)}</b>일</span></div>
                ${isOpen ? `
                  <div class="heat" aria-label="최근 5주 기록">${heat}</div>
                  <div class="head-actions" style="margin-top:6px">
                    <button type="button" class="btn sm" data-act="rename">이름 바꾸기</button>
                    <button type="button" class="btn sm ghost" data-act="del">지우기</button>
                  </div>` : ''}
              </div>
              <div class="hcells">${days.map(d => {
                const s = A.ymd(d);
                const on = !!(h.log && h.log[s]);
                return `<button type="button" class="hcell ${on ? 'on' : ''} ${s === t ? 'today' : ''}" data-day="${s}" aria-pressed="${on}" aria-label="${d.getMonth() + 1}월 ${d.getDate()}일 ${esc(h.name)}">${icon('check', 18)}</button>`;
              }).join('')}</div>
            </div>`;
        }).join('');
      }

      el.addEventListener('click', async e => {
        const row = e.target.closest('.habit-row[data-id]');
        const cell = e.target.closest('[data-day]');
        if (cell && row) { toggle(row.dataset.id, cell.dataset.day); draw(); return; }
        const b = e.target.closest('[data-act]');
        if (!b || !row) return;
        const h = A.data.habits.find(x => x.id === row.dataset.id);
        if (!h) return;
        const act = b.dataset.act;
        if (act === 'more') { open = open === h.id ? null : h.id; draw(); }
        else if (act === 'rename') {
          const m = A.modal({
            title: '습관 이름 바꾸기',
            body: `<form id="hr-form"><label class="field"><span>이름</span><input class="input" id="hr-name" value="${esc(h.name)}" autocomplete="off"></label></form>`,
            actions: [{ label: '취소', kind: 'ghost' }, { label: '저장', kind: 'primary', onClick: () => doRename() }],
            onMount(box) { box.querySelector('#hr-form').addEventListener('submit', ev => { ev.preventDefault(); if (doRename() !== false) m.close(); }); }
          });
          const doRename = () => {
            const v = m.el.querySelector('#hr-name').value.trim();
            if (!v) return false;
            h.name = v; A.save('habits'); draw();
          };
        } else if (act === 'del') {
          const ok = await A.confirm(`'${h.name}' 습관과 기록을 지울까요?`, { title: '습관 지우기', ok: '지우기', danger: true });
          if (!ok) return;
          A.data.habits = A.data.habits.filter(x => x.id !== h.id);
          A.save('habits'); open = null; draw();
        }
      });
      $('#hb-form').addEventListener('submit', e => {
        e.preventDefault();
        const name = $('#hb-name').value.trim();
        if (!name) { $('#hb-name').focus(); return; }
        A.data.habits.push({ id: A.uid(), name, log: {}, created: Date.now() });
        A.save('habits');
        $('#hb-name').value = '';
        draw();
      });

      draw();
    }
  });
})();
