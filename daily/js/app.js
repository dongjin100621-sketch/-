'use strict';
/* 시작: 처음 방문 예시 데이터, 메뉴, 시계 틱, 라우팅 */
(function () {
  const A = App;
  const { icon } = A;

  /* ---------- 예시 데이터 ---------- */
  const SAMPLE_KEYS = ['notes', 'todos', 'events', 'alarms', 'txs', 'habits', 'ddays'];
  function seed() {
    const d = A.data;
    const now = Date.now();
    const t = new Date();
    const day = n => A.ymd(A.addDays(t, n));
    d.notes = [
      {
        id: A.uid(), title: '하루 책상 사용법', color: 'yellow', pinned: true, created: now, updated: now, sample: true,
        body: [
          '처음 보이는 메모, 할 일, 가계부 같은 항목은 예시예요. 홈이나 설정에서 한 번에 지울 수 있어요.',
          '',
          '· 메모: 입력하는 즉시 저장돼요. 아래에 공백 포함·제외 글자 수가 나와요.',
          '· 할 일: 목록을 나누고 마감일과 중요 표시를 붙여요. 글자를 누르면 고칠 수 있어요.',
          '· 캘린더: 공휴일과 대체공휴일, 음력 날짜가 보여요. 날짜를 눌러 일정을 넣어요.',
          '· 알람·타이머: 이 페이지가 열려 있는 동안 울려요. 처음엔 화면을 한 번 눌러 소리를 허용해 주세요.',
          '· 음악: 기기의 음악 파일을 넣으면 이 브라우저에 보관돼요. 빗소리·파도 같은 집중 사운드도 있어요.',
          '· 가계부: 홈에서 "점심 9000"처럼 쓰면 분류까지 알아서 기록돼요.',
          '· 설정: 백업 파일로 내보내고 다른 기기에서 불러올 수 있어요.'
        ].join('\n')
      },
      { id: A.uid(), title: '여행 준비물', color: 'green', pinned: false, created: now - 3600e3, updated: now - 3600e3, sample: true, body: '여권\n충전기와 보조배터리\n상비약\n우산\n세면도구' }
    ];
    d.todoLists = [{ id: 'inbox', name: '할 일' }, { id: 'shop', name: '장보기', sample: true }];
    d.todos = [
      { id: A.uid(), listId: 'inbox', text: '택배 반품 접수하기', due: day(0), priority: false, done: false, created: now, sample: true },
      { id: A.uid(), listId: 'inbox', text: '보고서 초안 쓰기', due: day(1), priority: true, done: false, created: now + 1, sample: true },
      { id: A.uid(), listId: 'inbox', text: '물 2L 마시기', due: '', priority: false, done: false, created: now + 2, sample: true },
      { id: A.uid(), listId: 'inbox', text: '세탁소에서 코트 찾기', due: day(-1), priority: false, done: true, doneAt: now - 1000, created: now - 86400e3, sample: true },
      { id: A.uid(), listId: 'shop', text: '우유', due: '', priority: false, done: false, created: now, sample: true },
      { id: A.uid(), listId: 'shop', text: '계란 30구', due: '', priority: false, done: false, created: now + 1, sample: true },
      { id: A.uid(), listId: 'shop', text: '대파', due: '', priority: false, done: false, created: now + 2, sample: true }
    ];
    d.events = [
      { id: A.uid(), date: day(0), time: '19:00', title: '저녁 약속', yearly: false, sample: true },
      { id: A.uid(), date: day(2), time: '14:30', title: '치과 예약', yearly: false, sample: true }
    ];
    d.alarms = [{ id: A.uid(), time: '07:00', label: '기상', days: [1, 2, 3, 4, 5], sound: 'chime', enabled: false, sample: true }];
    d.txs = [
      { id: A.uid(), type: 'out', amount: 9000, memo: '점심 김치찌개', category: '식비', date: day(0), created: now, sample: true },
      { id: A.uid(), type: 'out', amount: 4500, memo: '아메리카노', category: '카페·간식', date: day(0), created: now + 1, sample: true },
      { id: A.uid(), type: 'out', amount: 30000, memo: '교통카드 충전', category: '교통', date: day(t.getDate() > 1 ? -1 : 0), created: now - 86400e3, sample: true }
    ];
    const log = offsets => offsets.reduce((o, n) => { o[day(-n)] = true; return o; }, {});
    d.habits = [
      { id: A.uid(), name: '물 8잔 마시기', log: log([1, 2, 3, 5, 6, 7, 8, 10, 11, 12]), created: now - 20 * 86400e3, sample: true },
      { id: A.uid(), name: '스트레칭 10분', log: log([0, 1, 3, 4, 6]), created: now - 14 * 86400e3, sample: true }
    ];
    const xmas = new Date(t.getFullYear(), 11, 25);
    if (A.diffDays(t, xmas) < 0) xmas.setFullYear(xmas.getFullYear() + 1);
    d.ddays = [
      { id: A.uid(), title: '크리스마스', date: A.ymd(xmas), sample: true },
      { id: A.uid(), title: '새해 첫날', date: `${t.getFullYear() + 1}-01-01`, sample: true }
    ];
    ['notes', 'todoLists', 'todos', 'events', 'alarms', 'txs', 'habits', 'ddays'].forEach(k => A.save(k));
    d.prefs.seeded = true;
    A.save('prefs');
  }
  A.hasSamples = () => SAMPLE_KEYS.some(k => A.data[k].some(x => x.sample)) || A.data.todoLists.some(l => l.sample);
  A.clearSamples = () => {
    SAMPLE_KEYS.forEach(k => { A.data[k] = A.data[k].filter(x => !x.sample); });
    // 예시 목록에 직접 넣은 할 일이 남아 있으면 그 목록은 사용자 목록으로 남긴다
    A.data.todoLists = A.data.todoLists.filter(l => !l.sample || A.data.todos.some(x => x.listId === l.id));
    A.data.todoLists.forEach(l => { delete l.sample; });
    if (!A.data.todoLists.length) A.data.todoLists = A.clone(A.DEFAULTS.todoLists);
    SAMPLE_KEYS.concat('todoLists').forEach(k => A.save(k));
  };

  /* ---------- 메뉴 ---------- */
  function buildNav() {
    document.getElementById('nav').innerHTML = A.order.map(id => {
      const v = A.views.get(id);
      return `<a href="#${id}" data-id="${id}">${icon(v.icon, 19)}<span>${v.label}</span><span class="badge" data-badge="${id}" hidden></span></a>`;
    }).join('');
  }
  const badgeCache = {};
  function setBadge(id, text) {
    if (badgeCache[id] === text) return;
    badgeCache[id] = text;
    const b = document.querySelector(`[data-badge="${id}"]`);
    if (!b) return;
    b.textContent = text;
    b.hidden = !text;
  }
  function updateBadges() {
    const t = A.today();
    const due = A.data.todos.filter(x => !x.done && x.due && x.due <= t).length;
    setBadge('todo', due ? String(due) : '');
    setBadge('timer', A.timerUtil.badge());
  }

  /* ---------- 시작 ---------- */
  if (!A.data.prefs.seeded) seed();
  A.applyTheme();
  buildNav();
  window.addEventListener('hashchange', A.route);
  A.route();
  updateBadges();
  setInterval(() => {
    const now = new Date();
    A.emit('tick', now);
    updateBadges();
  }, 500);
  // 다른 탭에서 기록이 바뀌면 이 탭도 새로 그린다
  window.addEventListener('storage', e => {
    if (!e.key || !e.key.startsWith('haru.')) return;
    const k = e.key.slice(5);
    if (!A.KEYS.includes(k) || ['timer', 'stopwatch', 'pomo', 'player', 'ui', 'weather'].includes(k)) return;
    try { A.data[k] = e.newValue == null ? A.clone(A.DEFAULTS[k]) : JSON.parse(e.newValue); } catch (err) { return; }
    if (k === 'prefs') A.applyTheme();
    const active = document.activeElement;
    if (!(active && active.closest && active.closest('#view') && active.matches('input, textarea'))) A.route();
  });
})();
