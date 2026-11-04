/* 조국과 민족을 위하여 — 미니게임 (경부고속도로 / 수출 100억 달러) */
'use strict';

const Minigames = (() => {
  const W = 640, H = 360;
  let cv, g, raf = 0, keyHandler = null, clickHandler = null, moveHandler = null, active = null;
  const mouse = { x: -1, y: -1 };

  function text(s, x, y, c = '#efe6d2', size = 12, align = 'left', bold = false) {
    g.font = `${size}px ${bold ? 'Galmuri11Bold' : (size >= 15 ? 'Galmuri14' : 'Galmuri11')}, sans-serif`;
    g.textAlign = align; g.textBaseline = 'top'; g.fillStyle = c;
    g.fillText(s, Math.round(x), Math.round(y));
  }
  function rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function frame(x, y, w, h, bg = 'rgba(10,8,6,0.88)', border = '#efe6d2') {
    rect(x, y, w, h, bg); rect(x, y, w, 1, border); rect(x, y + h - 1, w, 1, border); rect(x, y, 1, h, border); rect(x + w - 1, y, 1, h, border);
  }
  function inside(b) { return mouse.x >= b.x && mouse.x < b.x + b.w && mouse.y >= b.y && mouse.y < b.y + b.h; }
  function button(b, label, on = true, hot = false) {
    const hov = on && inside(b);
    frame(b.x, b.y, b.w, b.h, !on ? 'rgba(40,36,30,0.8)' : hot ? '#8a2a22' : hov ? '#3a3024' : 'rgba(20,16,12,0.9)', on ? (hov ? '#e0b84c' : '#efe6d2') : '#5a5248');
    text(label, b.x + b.w / 2, b.y + (b.h - 12) / 2, on ? '#efe6d2' : '#7a7266', 12, 'center');
  }
  function wrap(s, maxW, size = 12) {
    g.font = `${size}px Galmuri11, sans-serif`;
    const out = [];
    for (const para of s.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const tryLine = line ? `${line} ${word}` : word;
        if (g.measureText(tryLine).width <= maxW) { line = tryLine; continue; }
        if (line) out.push(line);
        line = '';
        let chunk = '';
        for (const ch of word) {
          if (g.measureText(chunk + ch).width > maxW) { out.push(chunk); chunk = ch; } else chunk += ch;
        }
        line = chunk;
      }
      out.push(line);
    }
    return out;
  }

  function attach(game) {
    active = game;
    cv.classList.remove('hidden');
    const toLocal = (e) => {
      const r = cv.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * W; mouse.y = ((e.clientY - r.top) / r.height) * H;
    };
    moveHandler = (e) => toLocal(e);
    clickHandler = (e) => { toLocal(e); game.click && game.click(); };
    keyHandler = (e) => {
      if (e.repeat && e.code !== 'Space') return;
      if (['Space', 'ShiftLeft', 'ShiftRight', 'Enter'].includes(e.code)) e.preventDefault();
      game.key && game.key(e);
    };
    cv.addEventListener('mousemove', moveHandler);
    cv.addEventListener('mousedown', clickHandler);
    window.addEventListener('keydown', keyHandler, true);
    let last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      game.update(dt); game.draw();
    };
    raf = requestAnimationFrame(loop);
  }
  function detach() {
    cancelAnimationFrame(raf);
    cv.removeEventListener('mousemove', moveHandler);
    cv.removeEventListener('mousedown', clickHandler);
    window.removeEventListener('keydown', keyHandler, true);
    cv.classList.add('hidden');
    active = null;
  }

  /* ───────────── 경부고속도로 ───────────── */
  const NODES = ['서울', '수원', '오산', '천안', '목천', '대전', '옥천', '영동', '추풍령', '김천', '구미', '대구', '경주', '언양', '부산'];
  const DIFF = [1, 1, 1, 2, 2, 3, 2, 3, 2, 1, 1, 2, 2, 2];
  const KM = [30, 20, 35, 25, 30, 30, 30, 25, 25, 30, 35, 50, 30, 33];
  const SPECIAL = { 5: '당재터널 — 낙반 사고가 잇따른 최대 난공사', 7: '추풍령 — 소백산맥을 넘는 고갯길' };

  function highway(resolve) {
    const r = Math.random;
    const s = { phase: 'intro', seg: 0, left: DIFF[0], months: 0, deaths: 0, rush: false, p: 0, dir: 1, zone: null, msgs: [], t: 0, flash: 0 };
    const zoneW = () => [0, 0.26, 0.18, 0.11][DIFF[s.seg]] * (s.rush ? 0.85 : 1);
    const newZone = () => { const w = zoneW(); s.zone = { w, c: w / 2 + 0.04 + r() * (1 - w - 0.08) }; };
    newZone();
    const rushBtn = { x: 448, y: 300, w: 176, h: 24 };
    const msg = (t, c = '#efe6d2') => { s.msgs.push({ t, c, life: 1.6 }); if (s.msgs.length > 3) s.msgs.shift(); };
    const km = () => KM.slice(0, s.seg).reduce((a, b) => a + b, 0) + (s.seg < KM.length ? KM[s.seg] * (1 - s.left / DIFF[s.seg]) : 0);
    const date = () => { const m = 1 + Math.floor(s.months); const y = 1968 + Math.floor(m / 12); return `${y}년 ${(m % 12) + 1}월`; };

    function strike() {
      if (s.phase === 'intro') { s.phase = 'play'; return; }
      if (s.phase === 'done') { finish(); return; }
      const d = Math.abs(s.p - s.zone.c), diff = DIFF[s.seg];
      let cost = s.rush ? 0.5 : 1;
      if (d <= s.zone.w / 2) {
        const perfect = d <= s.zone.w / 6;
        if (perfect) cost *= 0.6;
        s.left--;
        Sound.sfx('hit');
        msg(perfect ? '완벽한 공정!' : '공정 진행', perfect ? '#e0b84c' : '#9fd08a');
        if (s.rush && diff === 3 && r() < 0.1) { s.deaths += 1; msg('무리한 작업 — 순직 1명', '#e07a5f'); s.flash = 0.5; }
        if (s.left <= 0) {
          msg(`${NODES[s.seg]}–${NODES[s.seg + 1]} 구간 완공`, '#e0b84c');
          s.seg++;
          if (s.seg >= DIFF.length) { s.phase = 'done'; Sound.sfx('chime'); }
          else s.left = DIFF[s.seg];
        }
      } else {
        Sound.sfx('miss');
        const chance = s.rush ? 0.35 + diff * 0.1 : diff * 0.12;
        if (r() < chance) {
          const n = s.rush ? 1 + Math.floor(r() * 3) : 1;
          s.deaths += n; s.flash = 0.8;
          msg(`사고 발생 — 순직 ${n}명`, '#e07a5f');
        } else msg('공정 지연', '#c8b8a0');
      }
      s.months += cost;
      if (s.months >= 60 && s.phase !== 'done') { s.phase = 'done'; msg('공사 기한 초과', '#e07a5f'); }
      if (s.phase !== 'done') newZone();
    }
    function finish() {
      detach();
      const months = Math.round(s.months);
      const done = s.seg >= DIFF.length;
      const eco = Math.max(3, Math.min(14, Math.round((44 - months) / 2.5))) - (done ? 0 : 4);
      const sup = 4 - Math.round(s.deaths / 12);
      resolve({
        fx: { eco, sup, pow: 2 },
        lines: [
          ['n', done ? `경부고속도로 개통. 공사 기간 ${months}개월, 순직자 ${s.deaths}명.` : `공사는 ${months}개월이 지나도록 끝나지 않았다. 순직자 ${s.deaths}명.`],
          ['n', '실제 역사: 1970년 7월 7일 개통. 공사 기간 2년 5개월(29개월), 순직자 77명.'],
        ],
        ach: [done && months <= 29 ? 'ACH_HIGHWAY' : null, done && s.deaths === 0 ? 'ACH_SAFE' : null].filter(Boolean),
      });
    }

    const game = {
      key(e) {
        if (e.code === 'Space' || e.code === 'Enter') strike();
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyR') { if (s.phase === 'play') { s.rush = !s.rush; Sound.sfx(s.rush ? 'alarm' : 'select'); newZone(); } }
      },
      click() {
        if (s.phase === 'play' && inside(rushBtn)) { s.rush = !s.rush; Sound.sfx(s.rush ? 'alarm' : 'select'); newZone(); return; }
        strike();
      },
      update(dt) {
        s.t += dt;
        if (s.phase === 'play') {
          const sp = (s.rush ? 1.45 : 0.85) + DIFF[s.seg] * 0.12;
          s.p += s.dir * sp * dt;
          if (s.p > 1) { s.p = 1; s.dir = -1; } if (s.p < 0) { s.p = 0; s.dir = 1; }
        }
        s.msgs.forEach((m) => (m.life -= dt)); s.msgs = s.msgs.filter((m) => m.life > 0);
        s.flash = Math.max(0, s.flash - dt * 2);
      },
      draw() {
        const diff = DIFF[Math.min(s.seg, DIFF.length - 1)];
        // 하늘과 지형
        const sky = g.createLinearGradient(0, 0, 0, 170); sky.addColorStop(0, '#6aa4d4'); sky.addColorStop(1, '#d4e6ee');
        g.fillStyle = sky; g.fillRect(0, 0, W, 170);
        g.fillStyle = diff === 3 ? '#4a6a44' : diff === 2 ? '#6a8a54' : '#8a9a5a';
        for (let x = 0; x < W; x++) {
          const h = diff === 3 ? 60 + Math.abs(Math.sin(x / 70)) * 70 : diff === 2 ? 30 + Math.sin(x / 40) * 14 + 16 : 14 + Math.sin(x / 90) * 4;
          g.fillRect(x, 170 - h, 1, h);
        }
        rect(0, 150, W, 20, '#8a7a50');
        const prog = s.seg >= DIFF.length ? 1 : 1 - s.left / DIFF[s.seg];
        rect(0, 146, W * (0.1 + prog * 0.9), 8, '#38383c');
        for (let x = 6; x < W * (0.1 + prog * 0.9); x += 16) rect(x, 149, 8, 2, '#e8d070');
        if (diff === 3 && s.seg === 5) { g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(W * 0.78, 154, 18, Math.PI, 0); g.fill(); text('당재터널', W * 0.78, 126, '#efe6d2', 12, 'center'); }
        for (let i = 0; i < 6; i++) {
          const x = W * (0.1 + prog * 0.9) - 10 - i * 14, y = 134 + (Math.floor(s.t * 6 + i) % 2);
          rect(x, y, 4, 3, '#e8e0c0'); rect(x, y + 3, 4, 6, s.rush ? '#a04a3a' : '#5a6a7a'); rect(x, y + 9, 4, 3, '#2a2a2e');
        }
        if (s.flash > 0) rect(0, 0, W, 170, `rgba(200,40,30,${s.flash * 0.35})`);

        // 상단 정보
        frame(8, 8, W - 16, 30);
        text('경부고속도로 건설', 18, 17, '#e0b84c', 12, 'left', true);
        text(date(), 170, 17);
        text(`경과 ${Math.round(s.months)}개월`, 270, 17);
        text(`진척 ${Math.round(km())} / 428km`, 380, 17);
        text(`순직 ${s.deaths}명`, W - 18, 17, s.deaths ? '#e07a5f' : '#efe6d2', 12, 'right');

        // 노선도
        rect(0, 170, W, 190, '#14110d');
        const x0 = 30, x1 = W - 30, y = 196, step = (x1 - x0) / DIFF.length;
        for (let i = 0; i < DIFF.length; i++) {
          const ax = x0 + i * step, bx = ax + step, built = i < s.seg, curSeg = i === s.seg;
          const col = built ? '#e8d070' : curSeg ? (Math.floor(s.t * 3) % 2 ? '#e0b84c' : '#8a6a3a') : ['', '#4a4a3a', '#5a4a34', '#6a3a2e'][DIFF[i]];
          rect(ax, y - 2, step, 4, col);
        }
        for (let i = 0; i < NODES.length; i++) {
          const nx = x0 + i * step;
          rect(nx - 2, y - 4, 5, 8, i <= s.seg ? '#efe6d2' : '#6a6258');
          text(NODES[i], nx, y + (i % 2 ? 18 : 8), i <= s.seg ? '#efe6d2' : '#7a7266', 12, 'center');
        }
        if (s.seg < DIFF.length) {
          const lab = `현재 구간: ${NODES[s.seg]}–${NODES[s.seg + 1]} (${['', '평지', '구릉', '산악'][diff]})` + (SPECIAL[s.seg] ? `  ·  ${SPECIAL[s.seg]}` : '');
          text(lab, W / 2, 232, '#c8b8a0', 12, 'center');
        }

        // 타이밍 바
        if (s.phase === 'play') {
          const bx = 80, by = 258, bw = W - 160, bh = 24;
          frame(bx - 2, by - 2, bw + 4, bh + 4, '#0a0806');
          rect(bx + (s.zone.c - s.zone.w / 2) * bw, by, s.zone.w * bw, bh, s.rush ? '#8a5a2a' : '#3a6a34');
          rect(bx + (s.zone.c - s.zone.w / 6) * bw, by, (s.zone.w / 3) * bw, bh, s.rush ? '#c8902a' : '#6aa64a');
          const mx = bx + s.p * bw;
          rect(mx - 1, by - 6, 3, bh + 12, '#ffffff');
          text('Space · 클릭: 공정 진행', bx, 296, '#c8b8a0');
          button(rushBtn, s.rush ? '돌관 공사: 켜짐 (Shift)' : '돌관 공사: 꺼짐 (Shift)', true, s.rush);
          text(s.rush ? '속도 2배 · 사고 위험 큼' : '정상 공정 · 안전 우선', 448, 330, s.rush ? '#e07a5f' : '#9fd08a');
          text(`남은 공정 ${s.left}`, bx, 330, '#efe6d2');
        }
        // 메시지
        s.msgs.forEach((m, i) => text(m.t, W / 2, 62 + i * 18 - (1.6 - m.life) * 6, m.c, 12, 'center', true));

        if (s.phase === 'intro' || s.phase === 'done') {
          frame(90, 54, W - 180, 240, 'rgba(10,8,6,0.94)');
          if (s.phase === 'intro') {
            text('미니게임 · 경부고속도로', W / 2, 70, '#e0b84c', 15, 'center');
            const body = '서울에서 부산까지 428km, 14개 구간을 이어라.\n\n움직이는 막대가 초록 구역에 들어왔을 때 Space(또는 클릭)를 눌러 공정을 진행한다. 산악 구간일수록 구역이 좁다.\n\n‘돌관 공사’를 켜면 한 번에 반 달씩만 걸려 공기가 크게 줄지만, 막대가 빨라지고 실패할 때 사고가 날 확률이 훨씬 높아진다.';
            wrap(body, W - 220).forEach((l, i) => text(l, 110, 100 + i * 17));
            text('Space 또는 클릭으로 착공', W / 2, 268, '#e0b84c', 12, 'center', true);
          } else {
            const done = s.seg >= DIFF.length;
            text(done ? '경부고속도로 개통' : '공사 중단', W / 2, 70, '#e0b84c', 15, 'center');
            text(`공사 기간  ${Math.round(s.months)}개월`, W / 2, 108, '#efe6d2', 12, 'center');
            text(`순직자  ${s.deaths}명`, W / 2, 128, s.deaths ? '#e07a5f' : '#efe6d2', 12, 'center');
            text('실제 역사 — 29개월 · 순직자 77명', W / 2, 160, '#c8b8a0', 12, 'center');
            wrap('추풍령 휴게소의 위령탑에는 공사 중 숨진 이들의 이름이 새겨져 있다.', W - 220).forEach((l, i) => text(l, W / 2, 196 + i * 17, '#c8b8a0', 12, 'center'));
            text('Space 또는 클릭으로 계속', W / 2, 268, '#e0b84c', 12, 'center', true);
          }
        }
      },
    };
    attach(game);
  }

  /* ───────────── 수출 100억 달러 ───────────── */
  const IND = [
    { id: 'tex', name: '섬유·의류', cost: 4, add: 3 },
    { id: 'wig', name: '가발·합판', cost: 7, add: 5 },
    { id: 'shoe', name: '신발', cost: 12, add: 8 },
    { id: 'elec', name: '전자', cost: 22, add: 15, heavy: true },
    { id: 'steel', name: '철강', cost: 40, add: 26, heavy: true },
    { id: 'ship', name: '조선', cost: 70, add: 45, heavy: true },
  ];
  const DURATION = 60;

  function exportGame(resolve) {
    const s = {
      phase: 'intro', t: 0, money: 6, rate: 32, ot: false, tired: 0, strikes: 0, strikeT: 0, otT: 0,
      inds: IND.map((d) => ({ ...d, n: 0 })), last12: [], msgs: [], news: '1973년. 중화학공업화 선언. 수출 목표는 4년 뒤 100억 달러.', ev: {},
    };
    const btns = s.inds.map((d, i) => ({ x: 16, y: 72 + i * 38, w: 300, h: 32 }));
    const sellBtn = { x: 340, y: 236, w: 284, h: 40 };
    const otBtn = { x: 340, y: 284, w: 284, h: 28 };
    const msg = (t, c = '#efe6d2') => { s.msgs.push({ t, c, life: 1.6 }); if (s.msgs.length > 3) s.msgs.shift(); };
    const eff = () => (s.strikeT > 0 ? 0 : s.rate * (s.ot ? 1.35 : 1));
    const exports1977 = () => s.last12.reduce((a, b) => a + b, 0);

    function buy(i) {
      if (s.phase !== 'play') return;
      const d = s.inds[i];
      if (s.money < d.cost) { Sound.sfx('miss'); return; }
      s.money -= d.cost; d.n++; s.rate += d.add; d.cost = Math.round(d.cost * 1.25 * 10) / 10;
      Sound.sfx('up'); msg(`${d.name} 공장 증설 · 연 수출 +${d.add}억 달러`, '#9fd08a');
    }
    function sell() {
      if (s.phase === 'intro') { s.phase = 'play'; return; }
      if (s.phase === 'done') { finish(); return; }
      s.money += 0.45; Sound.sfx('coin');
    }
    function toggleOT() { if (s.phase !== 'play') return; s.ot = !s.ot; Sound.sfx(s.ot ? 'alarm' : 'select'); }
    function finish() {
      detach();
      const x = Math.round(exports1977());
      const ok = x >= 100, otMonths = Math.round(s.otT);
      const sup = -(Math.round(s.otT / 8) + s.strikes * 2) + (ok ? 2 : 0);
      const lines = [['n', `1977년 수출액 ${x}억 달러.${ok ? ' 목표 달성.' : ' 목표에 미치지 못했다.'}`]];
      if (otMonths > 0) lines.push(['n', `잔업과 철야로 버틴 기간 ${otMonths}개월. 공장의 불은 꺼지지 않았고, 노동자들의 몸은 그만큼 닳았다.`]);
      if (s.strikes) lines.push(['n', `노동자들이 ${s.strikes}번 작업을 멈췄다.`]);
      lines.push(['n', '실제 역사: 1977년 12월 22일, 수출 100억 달러 달성.']);
      resolve({ fx: { eco: ok ? 10 : 4 + Math.floor(x / 25), sup }, lines, ach: [ok ? 'ACH_EXPORT' : null, ok && s.otT === 0 ? 'ACH_NO_OT' : null].filter(Boolean) });
    }

    const game = {
      key(e) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= 6) buy(n - 1);
        if (e.code === 'Space' || e.code === 'Enter') sell();
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyO') toggleOT();
      },
      click() {
        if (s.phase !== 'play') { sell(); return; }
        btns.forEach((b, i) => inside(b) && buy(i));
        if (inside(sellBtn)) sell();
        if (inside(otBtn)) toggleOT();
      },
      update(dt) {
        s.msgs.forEach((m) => (m.life -= dt)); s.msgs = s.msgs.filter((m) => m.life > 0);
        if (s.phase !== 'play') return;
        s.t += dt;
        const month = Math.floor(s.t);
        s.money += eff() * 0.03 * dt;
        if (s.ot) { s.tired += 4 * dt; s.otT += dt; } else s.tired = Math.max(0, s.tired - 2.5 * dt);
        if (s.strikeT > 0) s.strikeT -= dt;
        if (s.tired >= 100) { s.tired = 40; s.strikes++; s.strikeT = 4; s.ot = false; Sound.sfx('down'); s.news = '노동자들이 작업을 거부했다. 생산이 멈췄다.'; }
        if (month >= 48 && month !== s.lastMonth) { s.last12.push(0); s.lastMonth = month; }
        if (month >= 48 && s.last12.length) s.last12[s.last12.length - 1] += (eff() / 12) * dt;
        if (s.t > 26 && !s.ev.mid) { s.ev.mid = 1; s.money += 15; s.news = '중동 특수: 건설 노동자들이 벌어 온 오일 달러가 들어왔다. 자금 +15억 달러'; Sound.sfx('chime'); }
        if (s.t > 34 && !s.ev.buyer) { s.ev.buyer = 1; s.rate += 6; s.news = '미국 백화점 체인의 대량 주문. 연 수출 +6억 달러'; Sound.sfx('chime'); }
        if (s.t > 48 && !s.ev.y77) { s.ev.y77 = 1; s.news = '1977년. 올해 수출액이 100억 달러를 넘어야 한다.'; }
        if (s.t >= DURATION) { s.t = DURATION; s.phase = 'done'; Sound.sfx(exports1977() >= 100 ? 'chime' : 'down'); }
      },
      draw() {
        const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#120e14'); bg.addColorStop(1, '#2a1a14');
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.fillStyle = '#0c0a0e';
        for (const [x, w, h] of [[360, 40, 120], [420, 16, 170], [446, 16, 150], [480, 90, 90], [590, 30, 130]]) g.fillRect(x, H - h, w, h);
        for (let i = 0; i < 12; i++) rect(486 + (i % 6) * 14, H - 70 + Math.floor(i / 6) * 14, 8, 6, s.strikeT > 0 ? '#2a2420' : '#d8801e');
        const m = Math.min(59, Math.floor(s.t)), y = 1973 + Math.floor(m / 12);
        frame(8, 8, W - 16, 52);
        text('수출 100억 달러', 18, 16, '#e0b84c', 15, 'left');
        text(`${y}년 ${(m % 12) + 1}월`, W - 18, 16, '#efe6d2', 12, 'right');
        rect(18, 42, W - 36, 6, '#2a2420'); rect(18, 42, (W - 36) * (s.t / DURATION), 6, '#e0b84c');
        rect(18 + (W - 36) * 0.8, 40, 1, 10, '#efe6d2');
        // 공장 목록
        s.inds.forEach((d, i) => {
          const b = btns[i], can = s.money >= d.cost && s.phase === 'play';
          frame(b.x, b.y, b.w, b.h, can && inside(b) ? '#3a3024' : 'rgba(20,16,12,0.92)', can ? '#efe6d2' : '#5a5248');
          text(`${i + 1}. ${d.name}`, b.x + 8, b.y + 4, can ? '#efe6d2' : '#8a8276');
          if (d.heavy) text('중화학', b.x + 120, b.y + 4, '#e07a5f');
          text(`보유 ${d.n}`, b.x + b.w - 8, b.y + 4, '#c8b8a0', 12, 'right');
          text(`비용 ${d.cost.toFixed(1)}억 · 연 수출 +${d.add}억`, b.x + 8, b.y + 18, can ? '#e0b84c' : '#7a7266');
        });
        // 오른쪽 정보
        frame(340, 72, 284, 156);
        text('자금', 352, 82, '#c8b8a0'); text(`${s.money.toFixed(1)}억 달러`, 612, 82, '#efe6d2', 12, 'right');
        text('연 수출 능력', 352, 102, '#c8b8a0'); text(`${Math.round(eff())}억 달러`, 612, 102, s.ot ? '#e0b84c' : '#efe6d2', 12, 'right');
        text('1977년 수출액', 352, 122, '#c8b8a0');
        text(s.t >= 48 ? `${exports1977().toFixed(1)} / 100억` : '1977년부터 집계', 612, 122, exports1977() >= 100 ? '#9fd08a' : '#efe6d2', 12, 'right');
        text('노동자 피로', 352, 146, '#c8b8a0');
        rect(352, 164, 260, 8, '#2a2420'); rect(352, 164, 260 * (s.tired / 100), 8, s.tired > 70 ? '#e07a5f' : '#c8a050');
        if (s.strikeT > 0) text('파업 — 생산 중단', 482, 182, '#e07a5f', 12, 'center', true);
        else if (s.tired > 70) text('피로 누적 — 파업 위험', 482, 182, '#e07a5f', 12, 'center');
        text(`파업 ${s.strikes}회`, 352, 204, '#c8b8a0');
        button(sellBtn, '해외 바이어 상담 (Space)', s.phase === 'play');
        button(otBtn, s.ot ? '잔업·철야: 켜짐 (Shift)' : '잔업·철야: 꺼짐 (Shift)', s.phase === 'play', s.ot);
        // 뉴스
        frame(16, 312, 300, 40);
        wrap(s.news, 284).slice(0, 2).forEach((l, i) => text(l, 24, 316 + i * 16, '#c8b8a0'));
        s.msgs.forEach((mm, i) => text(mm.t, 482, 330 - i * 14 - (1.6 - mm.life) * 6, mm.c, 12, 'center'));

        if (s.phase !== 'play') {
          frame(90, 54, W - 180, 250, 'rgba(10,8,6,0.95)');
          if (s.phase === 'intro') {
            text('미니게임 · 수출 100억 달러', W / 2, 70, '#e0b84c', 15, 'center');
            const body = '1973년부터 1977년까지, 1초가 한 달이다.\n\n수출로 번 자금으로 공장을 늘려(숫자 1~6 또는 클릭) 연 수출 능력을 키워라. 중화학 공장은 비싸지만 크게 늘어난다. Space는 바이어 상담으로 자금을 조금 번다.\n\n‘잔업·철야’를 켜면 생산이 35% 늘지만 노동자 피로가 쌓인다. 피로가 가득 차면 파업이 일어나 생산이 멈춘다.\n\n목표: 1977년 한 해 동안의 수출액 100억 달러.';
            wrap(body, W - 220).forEach((l, i) => text(l, 110, 98 + i * 16));
            text('Space 또는 클릭으로 시작', W / 2, 280, '#e0b84c', 12, 'center', true);
          } else {
            const x = exports1977();
            text(x >= 100 ? '수출 100억 달러 달성' : '목표 미달', W / 2, 74, '#e0b84c', 15, 'center');
            text(`1977년 수출액  ${x.toFixed(1)}억 달러`, W / 2, 112, '#efe6d2', 12, 'center');
            text(`잔업·철야  ${Math.round(s.otT)}개월   ·   파업  ${s.strikes}회`, W / 2, 134, '#efe6d2', 12, 'center');
            text('실제 역사 — 1977년 12월 22일, 100억 달러 달성', W / 2, 168, '#c8b8a0', 12, 'center');
            wrap('수출 실적의 이면에는 저임금과 하루 열몇 시간의 노동, 그리고 노동 기본권의 제한이 있었다.', W - 220).forEach((l, i) => text(l, W / 2, 200 + i * 17, '#c8b8a0', 12, 'center'));
            text('Space 또는 클릭으로 계속', W / 2, 280, '#e0b84c', 12, 'center', true);
          }
        }
      },
    };
    attach(game);
  }

  const AUTO = {
    highway: () => ({ fx: { eco: 6, sup: -2, pow: 2 }, lines: [['n', '경부고속도로 개통. 공사 기간 29개월, 순직자 77명. (미니게임 자동 진행)']], ach: [] }),
    export: () => ({ fx: { eco: 10, sup: -2 }, lines: [['n', '1977년 12월, 수출 100억 달러 달성. (미니게임 자동 진행)']], ach: [] }),
  };

  return {
    init(canvas) { cv = canvas; g = cv.getContext('2d'); g.imageSmoothingEnabled = false; },
    run(name, { auto = false } = {}) {
      if (auto) return Promise.resolve(AUTO[name]());
      return new Promise((resolve) => (name === 'highway' ? highway(resolve) : exportGame(resolve)));
    },
    isActive: () => !!active,
  };
})();
