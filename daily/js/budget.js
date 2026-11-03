'use strict';
/* 가계부: 수입·지출 기록, 월 예산, 분류별 합계, "점심 9000" 같은 빠른 입력 */
(function () {
  const A = App;
  const { esc, icon } = A;

  const OUT = ['식비', '카페·간식', '교통', '쇼핑', '생활', '주거·통신', '의료·건강', '문화·여가', '교육', '경조사', '기타'];
  const IN = ['월급', '용돈', '부수입', '환급', '기타 수입'];
  const KEYWORDS = {
    '식비': ['점심', '저녁', '아침', '밥', '식당', '배달', '치킨', '피자', '김밥', '라면', '마트', '장보기', '편의점', '국밥', '찌개', '떡볶이', '고기', '회식', '분식', '햄버거', '도시락', '반찬', '식재료', '삼겹살', '초밥', '짜장', '짬뽕'],
    '카페·간식': ['커피', '카페', '아메리카노', '라떼', '빵', '디저트', '케이크', '아이스크림', '간식', '음료', '과자', '베이커리', '버블티', '스무디'],
    '교통': ['버스', '지하철', '택시', '교통', '기차', 'ktx', 'srt', '주유', '기름', '주차', '톨비', '통행료', '따릉이', '킥보드', '항공'],
    '쇼핑': ['옷', '신발', '쇼핑', '가방', '화장품', '의류', '액세서리', '전자', '이어폰'],
    '생활': ['생필품', '휴지', '세제', '다이소', '미용실', '세탁', '샴푸', '청소'],
    '주거·통신': ['월세', '관리비', '전기', '가스', '수도', '통신', '휴대폰', '인터넷', '핸드폰', '요금'],
    '의료·건강': ['병원', '약국', '약', '치과', '헬스', '운동', '요가', '필라테스', '한의원', '안과'],
    '문화·여가': ['영화', '넷플릭스', '공연', '책', '게임', '여행', '숙소', '노래방', '전시', '구독', '콘서트', '호텔'],
    '교육': ['학원', '강의', '수강', '교재', '인강', '시험', '자격증'],
    '경조사': ['축의금', '부의금', '조의금', '생일', '선물', '경조사'],
    '월급': ['월급', '급여', '상여', '보너스', '성과급'],
    '용돈': ['용돈'],
    '부수입': ['알바', '부업', '중고', '판매', '이자', '배당'],
    '환급': ['환급', '환불', '캐시백', '페이백']
  };
  const INCOME_HINT = ['월급', '급여', '상여', '보너스', '성과급', '용돈 받', '알바비', '환급', '환불', '캐시백', '페이백', '수입', '이자', '배당', '판매'];

  function guessType(memo) {
    const m = memo.toLowerCase();
    return INCOME_HINT.some(k => m.includes(k)) ? 'in' : 'out';
  }
  function guessCategory(memo, type) {
    const m = memo.toLowerCase();
    const pool = type === 'in' ? IN : OUT;
    for (const cat of pool) {
      const keys = KEYWORDS[cat];
      if (keys && keys.some(k => m.includes(k))) return cat;
    }
    return type === 'in' ? '기타 수입' : '기타';
  }
  function parseAmount(raw) {
    const s = String(raw).replace(/[,\s]/g, '').replace(/원$/, '');
    let m = s.match(/^(\d+(?:\.\d+)?)만(?:(\d+)천)?(\d+)?$/);
    if (m) return Math.round(parseFloat(m[1]) * 10000 + (m[2] ? Number(m[2]) * 1000 : 0) + (m[3] ? Number(m[3]) : 0));
    m = s.match(/^(\d+(?:\.\d+)?)천(\d+)?$/);
    if (m) return Math.round(parseFloat(m[1]) * 1000 + (m[2] ? Number(m[2]) : 0));
    if (/^\d+(?:\.\d+)?$/.test(s)) return Math.round(parseFloat(s));
    return NaN;
  }
  /* "점심 김치찌개 9000", "택시 1.2만원", "월급 320만" */
  function parseQuick(text) {
    const tokens = String(text).trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return null;
    for (const k of [2, 1]) {
      if (tokens.length < k) continue;
      const tail = tokens.slice(-k).join('');
      const amt = parseAmount(tail);
      if (amt > 0) {
        const memo = tokens.slice(0, -k).join(' ');
        const type = guessType(memo);
        return { type, amount: amt, memo, category: guessCategory(memo, type), date: A.today() };
      }
    }
    return null;
  }
  function add({ type = 'out', amount, memo = '', category, date }) {
    const tx = {
      id: A.uid(), type, amount: Math.round(amount), memo,
      category: category || guessCategory(memo, type),
      date: date || A.today(), created: Date.now()
    };
    A.data.txs.push(tx);
    A.save('txs');
    return tx;
  }
  A.budgetUtil = { parseQuick, parseAmount, add, guessCategory, OUT, IN };

  A.register({
    id: 'budget', label: '가계부', icon: 'wallet',
    render(el) {
      const now = new Date();
      let month = new Date(now.getFullYear(), now.getMonth(), 1);
      let type = 'out';
      let catTouched = false;
      el.innerHTML = `
        <div class="page">
          <div class="page-head">
            <div class="month-nav">
              <h1 class="sr-only">가계부</h1>
              <button type="button" class="icon-btn" data-act="prev" aria-label="이전 달">${icon('chevronL')}</button>
              <h2 id="bg-month" aria-live="polite"></h2>
              <button type="button" class="icon-btn" data-act="next" aria-label="다음 달">${icon('chevronR')}</button>
            </div>
            <div class="head-actions"><button type="button" class="btn" data-act="budget">${icon('edit', 16)} 한 달 예산</button></div>
          </div>
          <section class="panel" id="bg-sum"></section>
          <div class="money-grid">
            <div class="money-left">
              <section class="panel">
                <div class="panel-head"><h2 class="panel-title">기록하기</h2>
                  <div class="seg" role="group" aria-label="종류"><button type="button" data-type="out">지출</button><button type="button" data-type="in">수입</button></div>
                </div>
                <form class="form-grid" id="bg-form">
                  <label class="field"><span>금액</span><input class="input amount-input" id="bg-amt" inputmode="numeric" placeholder="0" autocomplete="off" required></label>
                  <label class="field"><span>내용</span><input class="input" id="bg-memo" placeholder="예: 점심 김치찌개" autocomplete="off"></label>
                  <div class="form-row">
                    <label class="field grow"><span>분류</span><select class="input" id="bg-cat"></select></label>
                    <label class="field grow"><span>날짜</span><input class="input" type="date" id="bg-date" required></label>
                  </div>
                  <button class="btn primary" type="submit">기록</button>
                </form>
              </section>
              <section class="panel" id="bg-cats"></section>
            </div>
            <section class="panel" id="bg-list"></section>
          </div>
        </div>`;
      const $ = s => el.querySelector(s);
      $('#bg-date').value = A.today();

      const ym = () => `${month.getFullYear()}-${A.pad(month.getMonth() + 1)}`;
      const monthTx = () => A.data.txs.filter(x => x.date.startsWith(ym()));

      function drawForm() {
        el.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('on', b.dataset.type === type));
        const cats = type === 'in' ? IN : OUT;
        const cur = $('#bg-cat').value;
        $('#bg-cat').innerHTML = cats.map(c => `<option ${c === cur ? 'selected' : ''}>${c}</option>`).join('');
      }
      function drawSum() {
        $('#bg-month').textContent = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;
        const txs = monthTx();
        const out = txs.filter(x => x.type === 'out').reduce((s, x) => s + x.amount, 0);
        const inc = txs.filter(x => x.type === 'in').reduce((s, x) => s + x.amount, 0);
        const budget = A.data.budget || 0;
        const isThisMonth = ym() === A.today().slice(0, 7);
        const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        const daysLeft = isThisMonth ? lastDay - new Date().getDate() + 1 : 0;
        const pct = budget ? Math.round(out / budget * 100) : 0;
        $('#bg-sum').innerHTML = `
          <div class="money-sum">
            <div><span class="label">지출</span><span class="big-number out">${A.won(out)}</span></div>
            <div><span class="label">수입</span><span class="big-number in">${A.won(inc)}</span></div>
            <div><span class="label">수입 − 지출</span><span class="big-number">${inc - out < 0 ? '−' : ''}${A.won(Math.abs(inc - out))}</span></div>
          </div>
          ${budget ? `
            <div class="budget-line">
              <div class="kv"><span>예산 ${A.won(budget)} 중 ${pct}% 사용</span><strong class="mono">${out > budget ? `${A.won(out - budget)} 초과` : `${A.won(budget - out)} 남음`}</strong></div>
              <div class="bar ${out > budget ? 'over' : pct >= 80 ? 'warn' : ''}"><i style="width:${Math.min(100, pct)}%"></i></div>
              ${isThisMonth && out <= budget && daysLeft > 0 ? `<p class="faint" style="font-size:13px">남은 ${daysLeft}일 동안 하루 ${A.won(Math.floor((budget - out) / daysLeft))}씩 쓸 수 있어요.</p>` : ''}
            </div>` : `<div class="budget-line"><p class="faint" style="font-size:13px">한 달 예산을 정하면 남은 금액과 하루 사용 가능 금액을 알려 드려요.</p></div>`}`;
      }
      function drawCats() {
        const txs = monthTx().filter(x => x.type === 'out');
        const total = txs.reduce((s, x) => s + x.amount, 0);
        const by = {};
        txs.forEach(x => { by[x.category] = (by[x.category] || 0) + x.amount; });
        const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
        $('#bg-cats').innerHTML = `
          <div class="panel-head"><h2 class="panel-title">분류별 지출</h2></div>
          ${rows.length ? rows.map(([c, v]) => {
            const p = total ? Math.round(v / total * 100) : 0;
            return `<div class="cat-row"><div class="kv"><span>${esc(c)} <span class="faint">${p}%</span></span><strong class="mono">${A.won(v)}</strong></div><div class="bar"><i style="width:${p}%"></i></div></div>`;
          }).join('') : '<p class="empty-sm">이번 달 지출 기록이 없어요.</p>'}`;
      }
      function drawList() {
        const txs = monthTx().sort((a, b) => (b.date + String(b.created).padStart(15, '0')).localeCompare(a.date + String(a.created).padStart(15, '0')));
        const groups = [];
        txs.forEach(x => {
          const g = groups[groups.length - 1];
          if (g && g.date === x.date) g.items.push(x); else groups.push({ date: x.date, items: [x] });
        });
        $('#bg-list').innerHTML = `
          <div class="panel-head"><h2 class="panel-title">내역 · ${txs.length}건</h2></div>
          ${groups.length ? groups.map(g => {
            const d = A.parseYmd(g.date);
            const dayOut = g.items.filter(x => x.type === 'out').reduce((s, x) => s + x.amount, 0);
            return `
              <div class="tx-day"><span>${d.getMonth() + 1}월 ${d.getDate()}일 (${A.WD[d.getDay()]})${g.date === A.today() ? ' · 오늘' : ''}</span><span class="mono">${dayOut ? '−' + A.num(dayOut) : ''}</span></div>
              ${g.items.map(x => `
                <div class="tx">
                  <span class="tag ${x.type === 'in' ? 'green' : ''}">${esc(x.category)}</span>
                  <span class="tx-memo ellipsis">${esc(x.memo || x.category)}</span>
                  <span class="tx-amt ${x.type}">${x.type === 'in' ? '+' : '−'}${A.num(x.amount)}</span>
                  <button type="button" class="icon-btn danger" data-del="${x.id}" aria-label="지우기" title="지우기">${icon('trash', 16)}</button>
                </div>`).join('')}`;
          }).join('') : `<div class="empty">${icon('wallet', 32)}<p>${month.getMonth() + 1}월 기록이 아직 없어요.<br><span class="faint">홈 화면에서 "점심 9000"처럼 빠르게 적을 수도 있어요.</span></p></div>`}`;
      }
      const draw = () => { drawForm(); drawSum(); drawCats(); drawList(); };

      el.addEventListener('click', e => {
        const tb = e.target.closest('[data-type]');
        if (tb) { type = tb.dataset.type; catTouched = false; drawForm(); autoCat(); return; }
        const del = e.target.closest('[data-del]');
        if (del) {
          const i = A.data.txs.findIndex(x => x.id === del.dataset.del);
          if (i < 0) return;
          const [gone] = A.data.txs.splice(i, 1);
          A.save('txs'); draw();
          A.toast('기록을 지웠어요', { action: '되돌리기', onAction: () => { A.data.txs.splice(i, 0, gone); A.save('txs'); draw(); } });
          return;
        }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'prev' || act === 'next') {
          month = new Date(month.getFullYear(), month.getMonth() + (act === 'prev' ? -1 : 1), 1);
          draw();
        } else if (act === 'budget') {
          const m = A.modal({
            title: '한 달 예산',
            body: `<form id="bd-form"><label class="field"><span>매달 쓸 돈 (원)</span><input class="input amount-input" id="bd-amt" inputmode="numeric" value="${A.data.budget ? A.num(A.data.budget) : ''}" placeholder="예: 800,000" autocomplete="off"></label><p class="faint" style="font-size:13px;margin-top:8px">비워 두면 예산을 쓰지 않아요.</p></form>`,
            actions: [{ label: '취소', kind: 'ghost' }, { label: '저장', kind: 'primary', onClick: () => saveBudget() }],
            onMount(box) {
              const inp = box.querySelector('#bd-amt');
              inp.addEventListener('input', () => formatInput(inp));
              box.querySelector('#bd-form').addEventListener('submit', ev => { ev.preventDefault(); if (saveBudget() !== false) m.close(); });
            }
          });
          const saveBudget = () => {
            const raw = m.el.querySelector('#bd-amt').value.trim();
            const v = raw ? parseAmount(raw) : 0;
            if (raw && !(v >= 0)) { A.toast('숫자로 적어 주세요'); return false; }
            A.data.budget = v || 0; A.save('budget'); draw();
            A.toast(v ? `한 달 예산을 ${A.won(v)}으로 정했어요` : '예산을 쓰지 않아요');
          };
        }
      });
      function formatInput(inp) {
        const digits = inp.value.replace(/[^\d]/g, '');
        inp.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
      }
      function autoCat() {
        if (catTouched) return;
        const memo = $('#bg-memo').value;
        if (!memo.trim()) return;
        $('#bg-cat').value = guessCategory(memo, type);
      }
      $('#bg-amt').addEventListener('input', e => formatInput(e.target));
      $('#bg-memo').addEventListener('input', autoCat);
      $('#bg-cat').addEventListener('change', () => { catTouched = true; });
      $('#bg-form').addEventListener('submit', e => {
        e.preventDefault();
        const amount = parseAmount($('#bg-amt').value);
        if (!(amount > 0)) { A.toast('금액을 적어 주세요'); $('#bg-amt').focus(); return; }
        const date = $('#bg-date').value || A.today();
        add({ type, amount, memo: $('#bg-memo').value.trim(), category: $('#bg-cat').value, date });
        $('#bg-amt').value = '';
        $('#bg-memo').value = '';
        catTouched = false;
        const d = A.parseYmd(date);
        month = new Date(d.getFullYear(), d.getMonth(), 1);
        draw();
        $('#bg-amt').focus();
        A.toast(type === 'in' ? '수입을 기록했어요' : '지출을 기록했어요');
      });

      draw();
    }
  });
})();
