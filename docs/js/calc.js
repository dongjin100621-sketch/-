'use strict';
/* 계산기, 더치페이(N빵), 단위 변환(평·㎡ 등) */
(function () {
  const A = App;
  const { esc, icon } = A;
  const OPS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

  /* 토큰 배열을 계산: 곱셈·나눗셈 먼저 */
  function evaluate(tokens) {
    const t = tokens.slice();
    if (!t.length) return 0;
    if (OPS[t[t.length - 1]]) t.pop();
    const nums = [], ops = [];
    t.forEach(x => { if (OPS[x]) ops.push(x); else nums.push(parseFloat(x)); });
    if (nums.some(n => !isFinite(n))) throw new Error('식이 올바르지 않아요');
    const n2 = [nums[0]], o2 = [];
    ops.forEach((op, i) => {
      const b = nums[i + 1];
      if (op === '*') n2[n2.length - 1] *= b;
      else if (op === '/') {
        if (b === 0) throw new Error('0으로 나눌 수 없어요');
        n2[n2.length - 1] /= b;
      } else { o2.push(op); n2.push(b); }
    });
    let r = n2[0];
    o2.forEach((op, i) => { r = op === '+' ? r + n2[i + 1] : r - n2[i + 1]; });
    return parseFloat(r.toPrecision(12));
  }
  function fmtNum(s) {
    if (s === '' || s === '-') return s;
    const neg = s.startsWith('-');
    const [i, d] = s.replace('-', '').split('.');
    const int = (i || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + int + (d !== undefined ? '.' + d : '');
  }
  function numStr(n) {
    if (!isFinite(n)) return 'NaN';
    if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-9 && n !== 0)) return n.toExponential(6);
    return String(n);
  }

  const CONV = [
    { id: 'pyeong', a: '평', b: '㎡', ab: v => v * 3.305785, ba: v => v / 3.305785, note: '1평 = 3.3058㎡' },
    { id: 'temp', a: '℃', b: '℉', ab: v => v * 9 / 5 + 32, ba: v => (v - 32) * 5 / 9, note: '℉ = ℃ × 9/5 + 32' },
    { id: 'geun', a: '근 (고기)', b: 'g', ab: v => v * 600, ba: v => v / 600, note: '고기 1근 = 600g' },
    { id: 'inch', a: '인치', b: 'cm', ab: v => v * 2.54, ba: v => v / 2.54, note: '1인치 = 2.54cm' },
    { id: 'mile', a: '마일', b: 'km', ab: v => v * 1.609344, ba: v => v / 1.609344, note: '1마일 = 1.609km' },
    { id: 'lb', a: '파운드', b: 'kg', ab: v => v * 0.45359237, ba: v => v / 0.45359237, note: '1파운드 = 0.4536kg' }
  ];

  A.register({
    id: 'calc', label: '계산기', icon: 'calc',
    render(el) {
      let tokens = [];
      let justEval = false;
      let error = '';
      const hist = A.data.ui.calcHist || [];
      const split = Object.assign({ total: '', people: 4, unit: 100 }, A.data.ui.split || {});
      const conv = Object.assign({ id: 'pyeong', dir: 'ab', val: '30' }, A.data.ui.conv || {});

      el.innerHTML = `
        <div class="page">
          <div class="page-head"><div><h1>계산기</h1><p class="sub">키보드로도 입력할 수 있어요.</p></div></div>
          <div class="calc-wrap">
            <section class="panel calc">
              <div class="calc-display" aria-live="polite">
                <div class="calc-expr" id="cc-expr"></div>
                <div class="calc-result" id="cc-res">0</div>
              </div>
              <div class="keys" id="cc-keys">
                ${[['C', 'fn'], ['±', 'fn'], ['%', 'fn'], ['/', 'op'],
                   ['7'], ['8'], ['9'], ['*', 'op'],
                   ['4'], ['5'], ['6'], ['-', 'op'],
                   ['1'], ['2'], ['3'], ['+', 'op'],
                   ['0'], ['.'], ['⌫', 'fn'], ['=', 'eq']]
                  .map(([k, c]) => `<button type="button" class="key ${c || ''}" data-key="${k}" aria-label="${{ C: '모두 지우기', '±': '부호 바꾸기', '%': '퍼센트', '/': '나누기', '*': '곱하기', '-': '빼기', '+': '더하기', '⌫': '한 글자 지우기', '=': '계산' }[k] || k}">${OPS[k] || k}</button>`).join('')}
              </div>
              <div id="cc-hist"></div>
            </section>
            <div class="calc-side">
              <section class="panel">
                <div class="panel-head"><h2 class="panel-title">더치페이</h2></div>
                <form class="form-grid" id="sp-form">
                  <label class="field"><span>총 금액 (원)</span><input class="input amount-input" id="sp-total" inputmode="numeric" placeholder="예: 87,000" value="${split.total ? A.num(split.total) : ''}" autocomplete="off"></label>
                  <div class="form-row">
                    <div class="field"><span>인원</span>
                      <div class="stepper">
                        <button type="button" class="icon-btn" data-step="-1" aria-label="한 명 빼기">−</button>
                        <input class="input" id="sp-people" type="number" min="1" max="99" value="${split.people}" inputmode="numeric" aria-label="인원">
                        <button type="button" class="icon-btn" data-step="1" aria-label="한 명 더하기">${icon('plus', 16)}</button>
                      </div>
                    </div>
                    <label class="field grow"><span>올림 단위</span>
                      <select class="input" id="sp-unit">${[1, 10, 100, 1000].map(u => `<option value="${u}" ${u === Number(split.unit) ? 'selected' : ''}>${u === 1 ? '올리지 않음' : `${A.num(u)}원 단위`}</option>`).join('')}</select>
                    </label>
                  </div>
                </form>
                <div id="sp-out"></div>
              </section>
              <section class="panel">
                <div class="panel-head"><h2 class="panel-title">단위 변환</h2></div>
                <div class="form-grid">
                  <select class="input" id="cv-kind" aria-label="변환 종류">${CONV.map(c => `<option value="${c.id}" ${c.id === conv.id ? 'selected' : ''}>${c.a} ↔ ${c.b}</option>`).join('')}</select>
                  <div class="conv-row">
                    <label class="field"><span id="cv-from-l"></span><input class="input" id="cv-in" inputmode="decimal" value="${esc(conv.val)}" autocomplete="off"></label>
                    <button type="button" class="icon-btn" data-act="swap" aria-label="방향 바꾸기" title="방향 바꾸기" style="margin-bottom:3px">${icon('swap', 18)}</button>
                    <label class="field"><span id="cv-to-l"></span><input class="input" id="cv-out" readonly tabindex="-1"></label>
                  </div>
                  <p class="faint" id="cv-note" style="font-size:13px"></p>
                </div>
              </section>
            </div>
          </div>
        </div>`;
      const $ = s => el.querySelector(s);

      /* ----- 계산기 ----- */
      const last = () => tokens[tokens.length - 1];
      const isNum = x => x !== undefined && !OPS[x];
      function press(k) {
        error = '';
        if (/^\d$/.test(k)) {
          if (justEval) { tokens = []; justEval = false; }
          if (isNum(last())) tokens[tokens.length - 1] = last() === '0' ? k : last() === '-0' ? '-' + k : last() + k;
          else tokens.push(k);
        } else if (k === '.') {
          if (justEval) { tokens = []; justEval = false; }
          if (isNum(last())) { if (!last().includes('.')) tokens[tokens.length - 1] += '.'; }
          else tokens.push('0.');
        } else if (OPS[k]) {
          justEval = false;
          if (!tokens.length) tokens.push('0');
          if (OPS[last()]) tokens[tokens.length - 1] = k;
          else tokens.push(k);
        } else if (k === 'C') { tokens = []; justEval = false; }
        else if (k === '⌫') {
          justEval = false;
          const l = last();
          if (l === undefined) return draw();
          if (OPS[l] || l.length <= 1 || (l.length === 2 && l.startsWith('-'))) tokens.pop();
          else tokens[tokens.length - 1] = l.slice(0, -1);
        } else if (k === '±') {
          if (isNum(last())) tokens[tokens.length - 1] = last().startsWith('-') ? last().slice(1) : '-' + last();
          justEval = false;
        } else if (k === '%') {
          if (isNum(last())) tokens[tokens.length - 1] = numStr(parseFloat((parseFloat(last()) / 100).toPrecision(12)));
          justEval = false;
        } else if (k === '=') {
          if (!tokens.length || tokens.length < 3) return draw();
          try {
            const r = evaluate(tokens);
            const expr = tokens.map(x => OPS[x] ? ` ${OPS[x]} ` : fmtNum(x)).join('');
            hist.unshift({ expr, r: numStr(r) });
            hist.splice(8);
            A.data.ui.calcHist = hist; A.save('ui');
            tokens = [numStr(r)];
            justEval = true;
          } catch (err) { error = err.message; }
        }
        draw();
      }
      function draw() {
        const expr = tokens.map(x => OPS[x] ? ` ${OPS[x]} ` : fmtNum(x)).join('');
        const res = $('#cc-res');
        if (error) {
          $('#cc-expr').textContent = expr;
          res.textContent = error;
          res.classList.add('err');
        } else {
          res.classList.remove('err');
          let preview = '0';
          try { preview = tokens.length ? fmtNum(numStr(evaluate(tokens))) : '0'; } catch (e) { preview = '…'; }
          $('#cc-expr').textContent = justEval ? (hist[0] ? hist[0].expr + ' =' : '') : expr;
          res.textContent = preview;
        }
        $('#cc-hist').innerHTML = hist.length ? `
          <div class="panel-head" style="margin:4px 0 0"><h3 class="panel-title">최근 계산</h3><button type="button" class="btn sm ghost" data-act="clear-hist">지우기</button></div>
          <div class="calc-hist">${hist.map((h, i) => `<div class="list-row" data-hist="${i}" title="결과 다시 쓰기"><span class="ellipsis">${esc(h.expr)}</span><b>${esc(fmtNum(h.r))}</b></div>`).join('')}</div>` : '';
      }
      el.addEventListener('click', e => {
        const k = e.target.closest('[data-key]');
        if (k) { press(k.dataset.key); return; }
        const h = e.target.closest('[data-hist]');
        if (h) { tokens = [hist[Number(h.dataset.hist)].r]; justEval = true; draw(); return; }
        const st = e.target.closest('[data-step]');
        if (st) { const p = $('#sp-people'); p.value = A.clamp((Number(p.value) || 1) + Number(st.dataset.step), 1, 99); drawSplit(); return; }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'clear-hist') { hist.length = 0; A.data.ui.calcHist = hist; A.save('ui'); draw(); }
        else if (b.dataset.act === 'swap') { conv.dir = conv.dir === 'ab' ? 'ba' : 'ab'; const out = $('#cv-out').value; if (out) $('#cv-in').value = out; drawConv(); }
      });
      const onKey = e => {
        if (A.current() !== 'calc' || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.target.closest && e.target.closest('input, select, textarea')) return;
        const map = { Enter: '=', '=': '=', Backspace: '⌫', Escape: 'C', Delete: 'C', ',': '.', x: '*', X: '*' };
        const k = map[e.key] || e.key;
        if (/^[\d.+\-*/%=]$/.test(k) || k === '⌫' || k === 'C') {
          if (e.key === 'Escape' && document.querySelector('.modal-wrap')) return;
          e.preventDefault();
          press(k);
          const btn = el.querySelector(`[data-key="${CSS.escape(k)}"]`);
          if (btn) { btn.classList.add('pressed'); setTimeout(() => btn.classList.remove('pressed'), 120); }
        }
      };
      document.addEventListener('keydown', onKey);

      /* ----- 더치페이 ----- */
      function drawSplit() {
        const total = A.budgetUtil.parseAmount($('#sp-total').value) || 0;
        const people = A.clamp(Number($('#sp-people').value) || 1, 1, 99);
        const unit = Number($('#sp-unit').value) || 1;
        Object.assign(split, { total, people, unit });
        A.data.ui.split = split; A.save('ui');
        if (!total) { $('#sp-out').innerHTML = '<p class="faint" style="font-size:13px;margin-top:12px">총 금액과 인원을 넣으면 한 사람이 낼 돈을 계산해요.</p>'; return; }
        const exact = total / people;
        const per = Math.ceil(exact / unit) * unit;
        const extra = per * people - total;
        $('#sp-out').innerHTML = `
          <div class="split-result">
            <span class="muted" style="font-size:13px">한 사람당</span>
            <span class="big-number">${A.won(per)}</span>
            <span class="faint" style="font-size:13px">${extra > 0 ? `${people}명이 ${A.won(per)}씩 내면 ${A.won(extra)}이 남아요 (정확히는 ${A.num(Math.floor(exact))}원)` : `${people}명이 똑같이 나눠요`}</span>
          </div>`;
      }
      $('#sp-total').addEventListener('input', e => {
        const d = e.target.value.replace(/[^\d]/g, '');
        e.target.value = d ? Number(d).toLocaleString('ko-KR') : '';
        drawSplit();
      });
      $('#sp-people').addEventListener('input', drawSplit);
      $('#sp-unit').addEventListener('change', drawSplit);
      $('#sp-form').addEventListener('submit', e => e.preventDefault());

      /* ----- 단위 변환 ----- */
      function drawConv() {
        const c = CONV.find(x => x.id === $('#cv-kind').value) || CONV[0];
        conv.id = c.id;
        conv.val = $('#cv-in').value;
        A.data.ui.conv = conv; A.save('ui');
        const [from, to] = conv.dir === 'ab' ? [c.a, c.b] : [c.b, c.a];
        $('#cv-from-l').textContent = from;
        $('#cv-to-l').textContent = to;
        const v = parseFloat(String(conv.val).replace(/,/g, ''));
        const r = isFinite(v) ? (conv.dir === 'ab' ? c.ab(v) : c.ba(v)) : NaN;
        $('#cv-out').value = isFinite(r) ? String(parseFloat(r.toFixed(4))) : '';
        $('#cv-note').textContent = c.note;
      }
      $('#cv-kind').addEventListener('change', drawConv);
      $('#cv-in').addEventListener('input', drawConv);

      draw();
      drawSplit();
      drawConv();
      return () => document.removeEventListener('keydown', onKey);
    }
  });
})();
