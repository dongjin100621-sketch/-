'use strict';
/* 일기: 하루 한 장. 기분, 감사한 일 세 가지, 자유 기록, 그날 한 일 자동 요약, 달력으로 기분 흐름 보기 */
(function () {
  const A = App;
  const { esc, icon } = A;

  const MOODS = [
    null,
    { label: '힘들어요', icon: 'mood1' },
    { label: '별로예요', icon: 'mood2' },
    { label: '그저 그래요', icon: 'mood3' },
    { label: '좋아요', icon: 'mood4' },
    { label: '최고예요', icon: 'mood5' }
  ];
  const PROMPTS = [
    '오늘 가장 기억에 남는 순간은 무엇이었나요?',
    '오늘 나를 웃게 한 건 무엇이었나요?',
    '오늘 새로 알게 된 것이 있나요?',
    '오늘 힘들었던 일과, 그걸 어떻게 넘겼는지 적어 보세요.',
    '내일의 나에게 한마디 해 주세요.',
    '오늘 누구에게 고마웠나요?',
    '오늘 잘한 일 한 가지를 칭찬해 주세요.',
    '오늘 먹은 것 중 가장 맛있었던 건?',
    '요즘 마음을 차지하고 있는 생각은 무엇인가요?',
    '오늘 하루를 한 문장으로 표현한다면?',
    '오늘 더 잘하고 싶었던 일이 있나요?',
    '이번 주에 기대되는 일은 무엇인가요?',
    '오늘 몸 상태는 어땠나요?',
    '오늘 들은 말 중 기억에 남는 말이 있나요?'
  ];
  const promptOf = day => PROMPTS[Math.abs(A.parseYmd(day).getTime() / 86400000 | 0) % PROMPTS.length];

  function entry(day) { return A.data.journal[day] || null; }
  function ensure(day) {
    if (!A.data.journal[day]) A.data.journal[day] = { mood: 0, grateful: ['', '', ''], text: '', updated: Date.now() };
    return A.data.journal[day];
  }
  function isEmpty(e) { return !e || (!e.mood && !e.text.trim() && !e.grateful.some(g => g.trim())); }
  function commit(day) {
    const e = A.data.journal[day];
    if (e && isEmpty(e)) delete A.data.journal[day];
    else if (e) e.updated = Date.now();
    A.save('journal');
    A.emit('journal:change');
  }
  function setMood(day, m) { const e = ensure(day); e.mood = e.mood === m ? 0 : m; commit(day); }
  A.journalUtil = { entry, setMood, MOODS };

  /* 그날 한 일 (다른 도구의 기록에서 모은다) */
  function summary(day) {
    const out = [];
    const done = A.data.todos.filter(t => t.done && t.doneAt && A.ymd(new Date(t.doneAt)) === day);
    if (done.length) out.push({ icon: 'todo', text: `할 일 ${done.length}개 끝냄`, more: done.slice(0, 4).map(t => t.text).join(', ') });
    const evs = A.calUtil ? A.calUtil.eventsOn(day) : [];
    if (evs.length) out.push({ icon: 'calendar', text: `일정 ${evs.length}개`, more: evs.map(e => e.title).join(', ') });
    const hs = A.data.habits, hd = hs.filter(h => h.log && h.log[day]).length;
    if (hs.length && hd) out.push({ icon: 'habit', text: `습관 ${hd}/${hs.length}` });
    A.data.routines.forEach(r => {
      const p = A.routineUtil.progress(r, day);
      if (p.done) out.push({ icon: r.when === 'night' ? 'moon' : 'sunrise', text: `${r.name} ${p.done}/${p.total}` });
    });
    const spent = A.data.txs.filter(x => x.date === day && x.type === 'out').reduce((s, x) => s + x.amount, 0);
    if (spent) out.push({ icon: 'wallet', text: `지출 ${A.won(spent)}` });
    const h = A.data.health[day];
    if (h && h.water) out.push({ icon: 'drop', text: `물 ${h.water}잔` });
    if (h && h.workouts && h.workouts.length) out.push({ icon: 'dumbbell', text: `운동 ${h.workouts.reduce((s, w) => s + (w.min || 0), 0)}분`, more: h.workouts.map(w => w.text).join(', ') });
    const sl = A.sleepUtil ? A.sleepUtil.forDay(day) : null;
    if (sl) out.push({ icon: 'bed', text: `잠 ${A.sleepUtil.durText(sl.wake - sl.bed)}` });
    const pomo = A.data.pomoLog && A.data.pomoLog[day];
    if (pomo) out.push({ icon: 'timer', text: `집중 ${pomo}회` });
    return out;
  }

  A.register({
    id: 'journal', label: '일기', icon: 'book',
    render(el) {
      let day = A.data.ui.journalDay && A.data.ui.journalDay <= A.today() ? A.data.ui.journalDay : A.today();
      delete A.data.ui.journalDay;
      let month = A.parseYmd(day); month.setDate(1);
      let query = '', dirty = false;
      el.innerHTML = `
        <div class="page">
          <div class="page-head">
            <div><h1>일기</h1><p class="sub">하루 한 장씩 기분과 생각을 남겨요. 쓰는 즉시 저장돼요.</p></div>
            <div class="head-actions day-nav">
              <button type="button" class="icon-btn" data-act="prev" aria-label="전날">${icon('chevronL', 18)}</button>
              <strong id="jr-date"></strong>
              <button type="button" class="icon-btn" data-act="next" aria-label="다음 날">${icon('chevronR', 18)}</button>
              <button type="button" class="btn sm" data-act="today">오늘</button>
            </div>
          </div>
          <div class="journal">
            <section class="panel jr-main" id="jr-main"></section>
            <aside class="jr-side">
              <section class="panel" id="jr-cal"></section>
              <section class="panel">
                <div class="panel-head"><h2 class="panel-title">지난 일기</h2></div>
                <input class="input" id="jr-q" type="search" placeholder="일기에서 찾기" autocomplete="off" aria-label="일기 검색">
                <ul id="jr-list" style="margin-top:6px"></ul>
              </section>
            </aside>
          </div>
        </div>`;
      const $ = s => el.querySelector(s);

      function drawMain() {
        const d = A.parseYmd(day);
        $('#jr-date').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 (${A.WD[d.getDay()]})`;
        el.querySelector('[data-act="next"]').disabled = day >= A.today();
        el.querySelector('[data-act="today"]').hidden = day === A.today();
        const e = entry(day) || { mood: 0, grateful: ['', '', ''], text: '' };
        const sum = summary(day);
        $('#jr-main').innerHTML = `
          <div class="jr-block">
            <h2 class="panel-title">${day === A.today() ? '오늘' : A.relDay(day)} 기분</h2>
            <div class="moods" role="radiogroup" aria-label="기분">
              ${MOODS.slice(1).map((m, k) => `<button type="button" class="mood ${e.mood === k + 1 ? 'on' : ''}" data-mood="${k + 1}" role="radio" aria-checked="${e.mood === k + 1}">${icon(m.icon, 30)}<span>${m.label}</span></button>`).join('')}
            </div>
          </div>
          <div class="jr-block">
            <label class="panel-title" for="jr-text">${esc(promptOf(day))}</label>
            <textarea class="input jr-text" id="jr-text" rows="9" placeholder="자유롭게 적어 보세요.">${esc(e.text)}</textarea>
          </div>
          <div class="jr-block">
            <h2 class="panel-title">감사한 일 세 가지</h2>
            <ol class="jr-grat">${[0, 1, 2].map(k => `<li><input class="input" data-g="${k}" value="${esc(e.grateful[k] || '')}" placeholder="${['작은 것도 좋아요', '누군가에게 고마웠던 일', '나 자신에게 고마운 점'][k]}" autocomplete="off" aria-label="감사한 일 ${k + 1}"></li>`).join('')}</ol>
          </div>
          <div class="jr-block">
            <h2 class="panel-title">이날 한 일</h2>
            ${sum.length ? `<ul class="jr-sum">${sum.map(s => `<li>${icon(s.icon, 16)}<span><b>${esc(s.text)}</b>${s.more ? ` <span class="faint">${esc(s.more)}</span>` : ''}</span></li>`).join('')}</ul>` : '<p class="empty-sm">다른 도구에 남긴 기록이 여기 모여요.</p>'}
          </div>
          <div class="jr-foot"><span class="faint" id="jr-saved">${entry(day) ? `저장됨 · ${A.relTime(entry(day).updated)}` : ''}</span>${entry(day) ? '<button type="button" class="btn sm ghost" data-act="del">이날 일기 지우기</button>' : ''}</div>`;
      }
      function drawCal() {
        const y = month.getFullYear(), mo = month.getMonth();
        const first = new Date(y, mo, 1).getDay();
        const days = new Date(y, mo + 1, 0).getDate();
        const t = A.today();
        let cells = '';
        for (let i = 0; i < first; i++) cells += '<span></span>';
        let count = 0;
        for (let n = 1; n <= days; n++) {
          const k = A.ymd(new Date(y, mo, n));
          const e = entry(k);
          if (e) count++;
          const future = k > t;
          cells += `<button type="button" class="jc ${k === day ? 'sel' : ''} ${k === t ? 'today' : ''} ${e && e.mood ? 'm' + e.mood : ''} ${e ? 'has' : ''}" data-day="${k}" ${future ? 'disabled' : ''} aria-label="${mo + 1}월 ${n}일${e && e.mood ? ' · ' + MOODS[e.mood].label : ''}">${e && e.mood ? icon(MOODS[e.mood].icon, 18) : `<span>${n}</span>`}</button>`;
        }
        $('#jr-cal').innerHTML = `
          <div class="panel-head">
            <button type="button" class="icon-btn" data-act="m-prev" aria-label="이전 달">${icon('chevronL', 16)}</button>
            <h2 class="panel-title">${y}년 ${mo + 1}월 · ${count}일 기록</h2>
            <button type="button" class="icon-btn" data-act="m-next" aria-label="다음 달" ${y * 12 + mo >= new Date().getFullYear() * 12 + new Date().getMonth() ? 'disabled' : ''}>${icon('chevronR', 16)}</button>
          </div>
          <div class="jcal">${A.WD.map(w => `<b>${w}</b>`).join('')}${cells}</div>`;
      }
      function drawList() {
        const q = query.trim().toLowerCase();
        const keys = Object.keys(A.data.journal).sort().reverse();
        const hits = keys.filter(k => {
          if (!q) return true;
          const e = A.data.journal[k];
          return (e.text + ' ' + e.grateful.join(' ')).toLowerCase().includes(q);
        }).slice(0, q ? 30 : 8);
        $('#jr-list').innerHTML = hits.length ? hits.map(k => {
          const e = A.data.journal[k], d = A.parseYmd(k);
          const line = (e.text.trim().split('\n')[0] || e.grateful.find(g => g.trim()) || '').slice(0, 60);
          return `<li class="list-row jr-item" data-day="${k}" tabindex="0" role="button">${e.mood ? icon(MOODS[e.mood].icon, 18) : '<span class="dot"></span>'}<span class="grow"><b>${d.getMonth() + 1}/${d.getDate()} (${A.WD[d.getDay()]})</b> <span class="faint ellipsis" style="display:block">${esc(line || '기분만 남김')}</span></span></li>`;
        }).join('') : `<li class="empty-sm">${q ? '찾는 내용이 없어요.' : '아직 쓴 일기가 없어요.'}</li>`;
      }
      function drawAll() { drawMain(); drawCal(); drawList(); }
      function select(k) {
        save.flush();
        day = k;
        const d = A.parseYmd(k);
        if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) { month = new Date(d.getFullYear(), d.getMonth(), 1); }
        drawAll();
      }

      const save = A.debounce(() => {
        const ta = $('#jr-text');
        if (!ta || !dirty) return;
        dirty = false;
        const e = ensure(day);
        e.text = ta.value;
        el.querySelectorAll('[data-g]').forEach(i => { e.grateful[Number(i.dataset.g)] = i.value; });
        commit(day);
        const s = $('#jr-saved');
        if (s) s.textContent = entry(day) ? '저장됨 · 방금' : '';
        drawCal(); drawList();
      }, 400);

      el.addEventListener('input', e => {
        if (e.target.id === 'jr-q') { query = e.target.value; drawList(); return; }
        if (e.target.id === 'jr-text' || e.target.dataset.g) { dirty = true; save(); }
      });
      el.addEventListener('click', async e => {
        const mood = e.target.closest('[data-mood]');
        if (mood) { save.flush(); setMood(day, Number(mood.dataset.mood)); drawAll(); return; }
        const dd = e.target.closest('[data-day]');
        if (dd) { select(dd.dataset.day); return; }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'prev') select(A.ymd(A.addDays(A.parseYmd(day), -1)));
        else if (act === 'next' && day < A.today()) select(A.ymd(A.addDays(A.parseYmd(day), 1)));
        else if (act === 'today') select(A.today());
        else if (act === 'm-prev') { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); drawCal(); }
        else if (act === 'm-next') { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); drawCal(); }
        else if (act === 'del') {
          const ok = await A.confirm('이날 일기를 지울까요?', { title: '일기 지우기', ok: '지우기', danger: true });
          if (!ok) return;
          save.flush();
          const gone = A.data.journal[day];
          delete A.data.journal[day]; A.save('journal'); drawAll();
          const k = day;
          A.toast('일기를 지웠어요', { action: '되돌리기', onAction: () => { A.data.journal[k] = gone; A.save('journal'); drawAll(); } });
        }
      });
      el.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('jr-item')) { e.preventDefault(); select(e.target.dataset.day); }
      });

      drawAll();
      return () => { save.flush(); };
    }
  });
})();
