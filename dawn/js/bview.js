'use strict';
/* 전투 화면: 전투 규칙(battle.js)이 돌려준 사건을 차례로 연출하고, 명령을 받는다.
   무대는 400×200 좌표(적은 왼쪽, 일행은 오른쪽)를 캔버스에 맞춰 넣고, 배경은 화면을 가득 채운다.
   글자(실드·약점·피해 숫자·메뉴)는 또렷하게 보이도록 DOM 으로 그린다. */

const BattleView = (() => {
  /* 무대 좌표 (발 위치). 가로 화면은 400×200, 세로 화면은 280×300 */
  const LAYOUTS = {
    wide: { W: 400, H: 200, hy: 74, party: [[280, 98], [298, 127], [316, 156], [334, 185]],
      enemy: [[126, 136], [84, 106], [84, 168], [168, 104], [168, 170], [40, 138]],
      big: [[108, 168], [192, 104], [194, 178], [34, 104], [34, 184], [150, 82]] },
    tall: { W: 280, H: 300, hy: 108, party: [[196, 150], [212, 186], [228, 222], [244, 258]],
      enemy: [[86, 198], [52, 154], [52, 244], [122, 148], [122, 250], [22, 200]],
      big: [[78, 240], [148, 150], [148, 262], [24, 156], [24, 268], [112, 120]] }
  };
  let L = LAYOUTS.wide, SW = 400, SH = 200;
  const $ = (id) => document.getElementById(id);

  let B = null, opts = {}, resolveEnd = null, running = false;
  let cv, ctx, bg = null, bgKey = '', T = { scale: 1, ox: 0, oy: 0, dpr: 1, u: 2 };
  let vis = new Map();         // uid → 연출 상태
  let fx = [], time = 0, raf = 0, lastT = 0;
  let ui = null;               // 명령 상태
  let speed = 1, tutorialShown = {};
  const sleep = (ms) => new Promise(r => setTimeout(r, ms * speed));

  /* ── 시작 ── */
  function start(engine, o) {
    B = engine; opts = o || {};
    cv = $('bcv'); ctx = cv.getContext('2d');
    speed = App.settings.battleSpeed === 'fast' ? 0.55 : 1;
    vis = new Map(); fx = []; pt = []; ui = null; tutorialShown = {};
    bgKey = '';
    $('bFx').innerHTML = ''; $('bTags').innerHTML = ''; $('bBanner').className = ''; $('bResult').hidden = true;
    for (const u of [...B.front, ...B.back]) if (u) vis.set(u.uid, { a: 1, dx: 0, dy: 0, shake: 0, flash: 0, ko: u.hp <= 0 ? 1 : 0 });
    for (const e of B.enemies) vis.set(e.uid, { a: 0, dx: -40, dy: 0, shake: 0, flash: 0, ko: 0, enter: 1 });
    running = true;
    lastT = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    buildTags(); updateParty(); updateOrder(); clearMenu();
    return new Promise(res => { resolveEnd = res; run(); });
  }
  async function run() {
    banner(B.enemies.some(e => e.boss) ? `${B.enemies.find(e => e.boss).name}이(가) 앞을 가로막았다!` : enemyIntro(), 'big');
    await sleep(700);
    for (const e of B.enemies) { const v = vis.get(e.uid); v.enter = 0; }
    if (opts.tutorial) await App.tip('battle1', true);
    await play(B.advance());
    loopTurns();
  }
  function enemyIntro() {
    const names = {};
    for (const e of B.enemies) names[e.name] = (names[e.name] || 0) + 1;
    return Object.entries(names).map(([n, c]) => c > 1 ? `${n} ${c}마리` : n).join(', ') + '이(가) 나타났다!';
  }
  async function loopTurns() {
    while (running) {
      if (B.over) return finish();
      if (B.waiting) { await command(); continue; }
      await play(B.advance());
    }
  }

  /* ── 사건 연출 ── */
  async function play(events) {
    for (const ev of events) await handle(ev);
    updateParty(); updateOrder(); refreshTags();
  }
  function posOf(uid) {
    const u = B.unit(uid);
    if (!u) return [SW / 2, SH / 2];
    if (u.side === 'p') {
      const c = B.front.indexOf(u);
      if (c >= 0) return L.party[c];
      const b = B.back.indexOf(u);
      return [L.party[Math.max(0, b)][0] + 40, L.party[Math.max(0, b)][1]];
    }
    const big = B.enemies.some(e => e.big);
    if (u.big) return L.big[0];
    return (big ? L.big : L.enemy)[u.slot % 6];
  }
  function centerOf(uid) {
    const u = B.unit(uid);
    const [x, y] = posOf(uid);
    const h = u && u.big ? 64 : 32;
    return [x, y - h / 2];
  }
  async function handle(ev) {
    const u = ev.uid ? B.unit(ev.uid) : null;
    const v = ev.uid ? vis.get(ev.uid) : null;
    switch (ev.t) {
      case 'round': updateOrder(); break;
      case 'turn':
        updateParty(); updateOrder();
        if (ev.swapIn) { banner(`${u.name} 등장!`); await sleep(250); }
        break;
      case 'eturn': updateOrder(); break;
      case 'act': {
        const name = ev.name;
        if (u.side === 'p') {
          if (ev.anim === 'attack' || ev.kind === 'phys') { v.dx = -18; Sound.sfx('swing'); if (ev.anim !== 'attack') castFx(ev.uid, 'phys', ev.type); }
          else if (ev.kind === 'item') { v.dx = -8; Sound.sfx('pickup'); }
          else { v.dx = -8; v.glow = 1; castFx(ev.uid, ev.kind, ev.type, ev.kind === 'heal' || ev.kind === 'revive'); Sound.sfx('cast'); }
          if (name !== '공격') banner(name + (ev.boost ? `  BP×${ev.boost}` : ''), ev.boost ? 'boost' : '');
          if (ev.boost) boostFx(ev.uid, ev.boost);
        } else {
          v.dx = 16; v.flash = 0.6;
          banner(`${u.name} — ${name}`, ev.big ? 'danger' : 'enemy');
          if (ev.kind === 'mag' || ev.big) castFx(ev.uid, 'mag', ev.big ? 'dark' : ev.type);
          if (ev.big) { Sound.sfx('roar'); shake(6); flash('#ff3a3a'); flashT = 0.5; }
          else Sound.sfx(ev.kind === 'mag' ? 'cast' : 'swing');
        }
        await sleep(ev.big ? 600 : 300);
        break;
      }
      case 'hit': {
        const [x, y] = centerOf(ev.uid);
        const src = B.unit(ev.src);
        hitFx(ev.type, x, y, ev.uid, ev.src, ev.crit);
        if (v) { v.shake = 1; v.flash = 1; }
        pop(ev.uid, ev.dmg, ev.crit ? 'crit' : (u.side === 'p' ? 'hurt' : ''), ev.weak ? '약점!' : (ev.crit ? '치명!' : (ev.warded ? '반감' : (ev.guarded ? '호위로 반감' : ''))));
        if (ev.weak && ev.shieldHit) { addFx({ k: 'shard', x, y, dur: 500 }); burst(x, y, 6, { col: ['#bfe4ff', '#ffffff'], sp0: 40, sp1: 100, g: 160, shape: 'shard', l0: 0.4, l1: 0.6, add: false }); Sound.sfx('weak'); }
        else Sound.sfx(u.side === 'p' ? 'hurt' : (ev.crit ? 'crit' : 'hit'));
        if (ev.crit) shake(3);
        if (u.side === 'e') refreshTag(u, ev.shieldHit ? 'crack' : '');
        else updateParty();
        await sleep(src && src.side === 'e' ? 200 : 170);
        break;
      }
      case 'miss': pop(ev.uid, 'MISS', 'miss'); Sound.sfx('miss'); await sleep(160); break;
      case 'break': {
        const [x, y] = centerOf(ev.uid);
        breakFx(x, y, sizeOf(ev.uid)); flash('#ffffff'); flashT = 0.4;
        bigText(ev.uid, 'BREAK!');
        Sound.sfx('break'); shake(5);
        refreshTag(u, 'break');
        if (ev.canceled) { await sleep(400); banner('모으던 힘이 흩어졌다!', 'good'); }
        updateOrder();
        if (opts.tutorial) { await sleep(500); await App.tip('battle3', true); }
        await sleep(650);
        break;
      }
      case 'ward': {
        const [x, y] = centerOf(ev.uid);
        if (ev.on) { pop(ev.uid, `${ev.kind === 'phys' ? '물리' : '마법'} 반감`, 'info'); addFx({ k: 'shock', x, y, r: 26, color: ev.kind === 'phys' ? '#bfe4ff' : '#d0a0ff', dur: 600, flat: 1 }); Sound.sfx('defend'); }
        else { pop(ev.uid, '갑옷이 깨졌다!', 'buff'); burst(x, y, 16, { col: ['#bfe4ff', '#ffffff', '#d0a0ff'], sp0: 60, sp1: 150, g: 180, shape: 'shard', l0: 0.5, l1: 0.8, add: false }); }
        refreshTag(u); await sleep(ev.on ? 450 : 300); break;
      }
      case 'recover': pop(ev.uid, '실드 회복', 'info'); refreshTag(u, 'recover'); Sound.sfx('recover'); await sleep(300); break;
      case 'heal':
        if (ev.amount || ev.sp) { pop(ev.uid, ev.amount ? ev.amount : `SP ${ev.sp}`, 'heal'); healFx(ev.uid); Sound.sfx('heal'); }
        updateParty(); refreshTags(); await sleep(200); break;
      case 'rest': updateParty(); break;
      case 'dot': pop(ev.uid, ev.dmg, 'poison'); statusFx(ev.uid, 'poison'); updateParty(); refreshTags(); await sleep(220); break;
      case 'revive': pop(ev.uid, '부활', 'heal'); if (v) v.ko = 0; healFx(ev.uid, true); Sound.sfx('revive'); updateParty(); await sleep(350); break;
      case 'buff': if (ev.lv) { buffFx(ev.uid, ev.lv > 0); pop(ev.uid, `${BUFF_NAME[ev.stat]} ${ev.lv > 0 ? '▲' : '▼'}`, ev.lv > 0 ? 'buff' : 'debuff'); Sound.sfx(ev.lv > 0 ? 'buff' : 'debuff'); await sleep(150); } updateParty(); refreshTags(); break;
      case 'status': if (ev.on) { statusFx(ev.uid, ev.status); pop(ev.uid, STATUS_NAME[ev.status] + '!', 'debuff'); await sleep(200); } updateParty(); refreshTags(); break;
      case 'ko':
        if (u.side === 'e') { v.dying = 1; Sound.sfx('kill'); dissolveFx(ev.uid); await sleep(380); }
        else { v.ko = 1; Sound.sfx('down'); banner(`${u.name}이(가) 쓰러졌다!`, 'danger'); updateParty(); await sleep(400); }
        refreshTags(); updateOrder();
        break;
      case 'swap': {
        Sound.sfx('swap');
        const inV = vis.get(ev.in); if (inV) { inV.dx = 50; inV.a = 0.2; }
        banner(ev.auto ? `${u ? u.name : B.unit(ev.in).name}이(가) 앞으로 나섰다!` : `교대! ${B.unit(ev.in).name} 등장`, 'good');
        updateParty(); updateOrder();
        await sleep(350);
        break;
      }
      case 'latent':
        Sound.sfx('latent'); flash(HEROES[u.id].color);
        banner(`잠재력 — ${ev.name}`, 'latent');
        latentFx(ev.uid, HEROES[u.id].color);
        updateParty(); refreshTags();
        await sleep(700);
        break;
      case 'latentReady':
        Sound.sfx('ready'); updateParty();
        if (opts.tutorial || !App.G.flags['tip:battle4']) { await sleep(200); await App.tip('battle4', true); }
        break;
      case 'charge': v.charge = 1; banner(`${u.name}이(가) 힘을 모으고 있다! 브레이크해서 막아라!`, 'danger'); Sound.sfx('charge'); await sleep(800); break;
      case 'charging': banner(`${u.name}이(가) 힘을 모으고 있다…`, 'enemy'); await sleep(450); break;
      case 'phase': {
        if (v) { v.flash = 1; }
        const [x, y] = centerOf(ev.uid);
        addFx({ k: 'rays', x, y, r: 70, n: 16, color: '#ff8a6a', dur: 900 });
        banner(ev.msg, 'danger'); shake(5); Sound.sfx('roar'); refreshTag(u, 'recover'); updateOrder();
        await sleep(1500);
        if (!App.G.flags['tip:phase']) await App.tip('phase', true);
        break;
      }
      case 'summon': {
        vis.set(ev.uid, { a: 0, dx: -30, dy: 0, shake: 0, flash: 1, ko: 0, enter: 1 });
        buildTags(); banner(`${ev.name}이(가) 나타났다!`, 'enemy'); Sound.sfx('summon');
        await sleep(200); vis.get(ev.uid).enter = 0; await sleep(400);
        break;
      }
      case 'runaway': v.dying = 1; pop(ev.uid, '도망쳤다', 'info'); await sleep(400); refreshTags(); break;
      case 'msg': banner(ev.text, ev.good ? 'good' : ''); await sleep(600); break;
      case 'bpgain': updateParty(); break;
      case 'bp': if (ev.gain) { pop(ev.uid, `BP ${ev.bp}`, 'buff'); Sound.sfx('bp'); } updateParty(); await sleep(150); break;
      case 'defend': pop(ev.uid, '방어', 'info'); Sound.sfx('defend'); updateParty(); await sleep(250); break;
      case 'reveal': refreshTag(u, 'reveal', ev.type); Sound.sfx('reveal'); await sleep(140); break;
      case 'aim': { const [x, y] = centerOf(ev.uid); addFx({ k: 'ring', x, y, dur: 450, color: '#ffe080' }); await sleep(200); break; }
      case 'sleep': pop(ev.uid, 'Zzz', 'info'); banner(`${u.name}은(는) 잠들어 있다…`); await sleep(500); break;
      case 'end': break;
    }
    if (v && (ev.t === 'act')) setTimeout(() => { v.dx = 0; v.glow = 0; }, 260 * speed);
  }

  const TYPE_COLOR = { sword: '#e8eef8', spear: '#d8e0f0', dagger: '#f0f0ff', axe: '#ffd0a0', bow: '#e0f0c0', staff: '#d0c0ff', fire: '#ff7a3a', ice: '#9ce0ff', thunder: '#ffe24a', wind: '#9ef08a', light: '#fff4b0', dark: '#b07aff' };
  const typeColor = (t) => TYPE_COLOR[t] || '#ffffff';

  /* ── 화면 흔들림·번쩍임 ── */
  let shakeAmt = 0, flashCol = null, flashT = 0;
  function shake(n) { shakeAmt = Math.max(shakeAmt, n); }
  function flash(col) { flashCol = col; flashT = 1; }
  function addFx(f) { f.t = 0; fx.push(f); }

  /* ── 그리기 ── */
  function loop(now) {
    if (!running) return;
    const dt = Math.min(50, now - lastT); lastT = now; time += dt;
    draw(dt);
    raf = requestAnimationFrame(loop);
  }
  function layout() {
    const f = Gfx.fit(cv);
    L = f.W / f.H < 1.25 ? LAYOUTS.tall : LAYOUTS.wide;
    SW = L.W; SH = L.H;
    const sc = Math.min(f.W / SW, f.H / SH);
    T = { W: f.W, H: f.H, dpr: f.dpr, scale: sc, u: Math.max(1, Math.round(sc * 2)), ox: (f.W - SW * sc) / 2, oy: (f.H - SH * sc) / 2 };
    const key = f.W + 'x' + f.H + (opts.bg || 'plains') + (opts.dawn ? 1 : 0);
    if (key !== bgKey) { bgKey = key; bg = paintBg(f.W, f.H, opts.bg || 'plains', opts.dawn); placeTags(); }
  }
  const SX = (x) => T.ox + x * T.scale, SY = (y) => T.oy + y * T.scale;
  function drawSprite(name, mode, x, y, alpha = 1, sz = 16) {
    const s = Gfx.sprite(name, mode);
    if (!s) return;
    const w = s.width * T.u, h = s.height * T.u;
    ctx.globalAlpha = alpha;
    ctx.drawImage(s, Math.round(SX(x) - w / 2), Math.round(SY(y) - h), w, h);
    ctx.globalAlpha = 1;
  }
  function draw(dt) {
    layout();
    const { W, H } = T;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (shakeAmt > 0) { ctx.translate((Math.random() - 0.5) * shakeAmt * T.u, (Math.random() - 0.5) * shakeAmt * T.u); shakeAmt = Math.max(0, shakeAmt - dt / 40); }
    ctx.drawImage(bg, 0, 0);
    const list = [];
    for (const e of B.enemies) {
      const v = vis.get(e.uid); if (!v) continue;
      if (v.dying && v.a <= 0.02) continue;
      list.push({ y: posOf(e.uid)[1], fn: () => drawUnit(e, v, dt) });
    }
    B.front.forEach((p) => { if (p) { const v = vis.get(p.uid); if (v) list.push({ y: posOf(p.uid)[1], fn: () => drawUnit(p, v, dt) }); } });
    list.sort((a, b) => a.y - b.y).forEach(o => o.fn());
    drawFx(dt);
    ctx.restore();
    if (flashT > 0) { ctx.globalAlpha = flashT * 0.45; ctx.fillStyle = flashCol || '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; flashT = Math.max(0, flashT - dt / 350); }
    placeCursor();
  }
  function drawUnit(u, v, dt) {
    const [bx, by] = posOf(u.uid);
    // 부드럽게 제자리로
    v.a += ((v.dying ? 0 : (v.enter ? 0 : 1)) - v.a) * Math.min(1, dt / 120);
    if (v.enter === 0 && v.dx < 0 && u.side === 'e') v.dx += Math.min(-v.dx, dt / 6);
    if (u.side === 'p' && v.dx > 0) v.dx = Math.max(0, v.dx - dt / 5);
    v.flash = Math.max(0, v.flash - dt / 200);
    v.shake = Math.max(0, v.shake - dt / 260);
    const bob = u.side === 'p' && !v.ko ? Math.sin(time / 380 + bx) * 0.6 : (u.side === 'e' ? Math.sin(time / 520 + bx) * 0.8 : 0);
    const x = bx + v.dx + (v.shake ? (Math.random() - 0.5) * 4 * v.shake : 0);
    const y = by + bob;
    const big = u.big;
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath(); ctx.ellipse(SX(bx + v.dx), SY(by - 1), (big ? 26 : 12) * T.scale, 3.2 * T.scale, 0, 0, Math.PI * 2); ctx.fill();
    const isActor = B.waiting && B.actor() === u;
    if (u.side === 'p') {
      const ko = u.hp <= 0;
      if (isActor) {
        ctx.fillStyle = `rgba(255,230,140,${0.18 + 0.1 * Math.sin(time / 200)})`;
        ctx.beginPath(); ctx.ellipse(SX(bx + v.dx), SY(by - 1), 15 * T.scale, 4.5 * T.scale, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (u.la || (isActor && ui && ui.boost)) aura(x, y, HEROES[u.id].color, ui && isActor ? ui.boost : 2);
      if (ko) { drawSprite(u.spr, 'fg', x + 4, y + 2, 0.75 * v.a); }
      else {
        drawSprite(u.spr, 'f', x, y, v.a);
        if (v.flash > 0) drawSprite(u.spr, 'fw', x, y, v.flash * 0.8);
      }
      if (u.status.sleep && !ko) txt('z', x + 8, y - 34 - (time / 300 % 6), '#ffffff');
    } else {
      const name = u.spr;
      if (v.charge && u.charging) {
        aura(x, y - (big ? 16 : 0), '#ff4040', 3, big);
        if (Math.random() < dt / 60) { const [cx, cy] = centerOf(u.uid), a = Math.random() * 6.28, r0 = big ? 50 : 30; spark(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, { vx: -Math.cos(a) * r0 / 0.4, vy: -Math.sin(a) * r0 / 0.4, life: 0.4, col: ['#ff4040', '#ffa080'], shape: 'line', s: 1 }); }
      }
      else v.charge = 0;
      const mode = u.broken ? 'g' : '';
      drawSprite(name, mode, x, y, v.a);
      if (v.flash > 0) drawSprite(name, 'w', x, y, v.flash * 0.85 * v.a);
      if (v.dying) drawSprite(name, 'w', x, y, v.a * 0.8);
      if (u.broken && !v.dying) {
        const k = Math.floor(time / 250) % 3;
        for (let i = 0; i < 3; i++) txt('★', x - 10 + i * 10, y - (big ? 70 : 38) - (i === k ? 2 : 0), i === k ? '#ffe24a' : '#ffffff');
      }
      if (ui && ui.mode === 'target' && ui.tkind === 'enemy' && ui.targets[ui.cursor] === u) {
        drawSprite(name, 'o', x, y, 0.6 + 0.4 * Math.sin(time / 120));
      }
    }
  }
  function aura(x, y, col, n, big) {
    const r = (big ? 30 : 15) + n * 2 + Math.sin(time / 150) * 2;
    const g = ctx.createRadialGradient(SX(x), SY(y - (big ? 32 : 16)), 0, SX(x), SY(y - (big ? 32 : 16)), r * T.scale);
    const [a, b, c] = Gfx.hexRgb(col);
    g.addColorStop(0, `rgba(${a},${b},${c},${0.15 + n * 0.08})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
    ctx.fillRect(SX(x) - r * T.scale, SY(y - (big ? 32 : 16)) - r * T.scale, r * 2 * T.scale, r * 2 * T.scale);
    ctx.restore();
  }
  function txt(s, x, y, col) {
    ctx.font = `${Math.round(8 * T.scale)}px Galmuri11, sans-serif`;
    ctx.fillStyle = '#000'; ctx.fillText(s, SX(x) + T.u / 2, SY(y) + T.u / 2);
    ctx.fillStyle = col; ctx.fillText(s, SX(x), SY(y));
  }
  /* ── 이펙트 ──
     fx: 시간에 따라 모양이 바뀌는 것(베기 궤적·번개·빛기둥·마법진·충격파…), pt: 입자(불꽃·얼음 조각·불티·잎…).
     좌표는 무대 좌표(400×200 / 280×300), 크기는 T.u(도트 한 칸) 단위로 그려 도트 느낌을 살린다. */
  let pt = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => Array.isArray(a) ? a[(Math.random() * a.length) | 0] : a;
  function spark(x, y, o) {
    if (pt.length > 650) return;
    pt.push(Object.assign({ x, y, vx: 0, vy: 0, g: 0, drag: 0, swirl: 0, life: 0.6, t: -(o.delay || 0), s: 1, s2: null, col: '#fff', shape: 'sq', add: true, fade: 1 }, o, { col: o.pal ? null : pick(o.col || '#fff') }));
  }
  function burst(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = o.ang !== undefined ? o.ang + rnd(-(o.spread || 0.5), o.spread || 0.5) : rnd(0, Math.PI * 2);
      const sp = rnd(o.sp0 ?? 20, o.sp1 ?? 80);
      spark(x + rnd(-(o.jx || 0), o.jx || 0), y + rnd(-(o.jy || 0), o.jy || 0), Object.assign({}, o, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (o.flat || 1) + (o.up || 0), life: rnd(o.l0 ?? 0.35, o.l1 ?? 0.7) }));
    }
  }
  const FIRE = ['#fff6c0', '#ffd447', '#ff9a3a', '#ff5a2a', '#c8301a', '#5a2018'];
  const sizeOf = (uid) => { const u = B.unit(uid); return u && u.big ? 1.8 : 1; };
  const feetOf = (uid) => posOf(uid)[1];

  /* 공격이 닿았을 때: 무기·속성마다 다른 연출 */
  function hitFx(type, x, y, uid, src, crit) {
    const k = sizeOf(uid), gy = feetOf(uid);
    const [sx, sy] = src ? centerOf(src) : [x + 40, y];
    const dir = Math.atan2(y - sy, x - sx);
    switch (type) {
      case 'sword':
        addFx({ k: 'arc', x, y, r: 15 * k, a0: -2.5, a1: 0.5, w: 4, color: '#dfe8ff', dur: 300 });
        burst(x, y, 10, { col: ['#ffffff', '#cfe0ff'], sp0: 40, sp1: 130, ang: -0.6, spread: 0.7, drag: 4, shape: 'line', l0: 0.15, l1: 0.3 });
        break;
      case 'spear':
        addFx({ k: 'thrust', x0: x - Math.cos(dir) * 40 * k, y0: y - Math.sin(dir) * 40 * k, x1: x + Math.cos(dir) * 20 * k, y1: y + Math.sin(dir) * 20 * k, color: '#e6ecff', dur: 300 });
        addFx({ k: 'thrust', x0: x - Math.cos(dir) * 30 * k, y0: y - Math.sin(dir) * 30 * k + 5, x1: x + Math.cos(dir) * 12 * k, y1: y + Math.sin(dir) * 12 * k + 5, color: '#b8c8f0', dur: 260, delay: 50 });
        burst(x, y, 9, { col: ['#ffffff', '#d8e0f0'], sp0: 60, sp1: 160, ang: dir, spread: 0.35, drag: 5, shape: 'line', l0: 0.12, l1: 0.25 });
        addFx({ k: 'shock', x, y, r: 10 * k, color: '#ffffff', dur: 260, flat: 1 });
        break;
      case 'dagger':
        addFx({ k: 'arc', x: x - 3, y: y - 2, r: 11 * k, a0: -2.2, a1: 0.2, w: 2, color: '#f4f4ff', dur: 200 });
        addFx({ k: 'arc', x: x + 3, y: y + 2, r: 11 * k, a0: -0.9, a1: 1.6, w: 2, color: '#f4f4ff', dur: 220, delay: 70 });
        burst(x, y, 7, { col: ['#ffffff', '#e0e0ff'], sp0: 50, sp1: 120, drag: 5, shape: 'line', l0: 0.1, l1: 0.22 });
        break;
      case 'axe':
        addFx({ k: 'arc', x, y: y - 4, r: 20 * k, a0: -2.0, a1: 1.3, w: 6, color: '#ffd8a8', dur: 340 });
        addFx({ k: 'shock', x, y: gy, r: 18 * k, color: '#ffcf90', dur: 380 });
        burst(x, gy - 2, 12, { col: ['#8a6a4a', '#c8a070', '#5a4a3a', '#d8d0c0'], sp0: 40, sp1: 110, ang: -Math.PI / 2, spread: 1.1, g: 260, l0: 0.4, l1: 0.7, s: 1.5, add: false });
        shake(2);
        break;
      case 'bow':
        addFx({ k: 'arrow', x0: sx, y0: sy, x1: x, y1: y, dur: 150 });
        burst(x, y, 8, { col: ['#ffffff', '#e8f4c8'], sp0: 40, sp1: 110, ang: dir, spread: 0.6, drag: 4, shape: 'line', l0: 0.12, l1: 0.25, delay: 0.12 });
        burst(x, y, 3, { col: ['#e8e0c8', '#c8b890'], sp0: 15, sp1: 40, g: 90, l0: 0.5, l1: 0.8, delay: 0.12, add: false });
        break;
      case 'staff':
        addFx({ k: 'star', x, y, r: 12 * k, color: '#e8dcff', dur: 260 });
        addFx({ k: 'shock', x, y, r: 12 * k, color: '#d0c0ff', dur: 300 });
        burst(x, y, 8, { col: ['#ffffff', '#d0c0ff'], sp0: 30, sp1: 90, drag: 3, shape: 'star', l0: 0.25, l1: 0.45 });
        break;
      case 'fire':
        addFx({ k: 'glow', x, y: y + 4, r: 30 * k, color: '#ff7a3a', dur: 700 });
        addFx({ k: 'glow', x, y: y + 6, r: 14 * k, color: '#fff0a0', dur: 380 });
        for (let i = 0; i < 44; i++) spark(x + rnd(-12, 12) * k, gy - rnd(0, 8), { vx: rnd(-14, 14), vy: rnd(-170, -70) * Math.sqrt(k), drag: 1.4, life: rnd(0.45, 0.85), pal: FIRE, s: rnd(2, 3.4) * k, s2: 0.7, delay: rnd(0, 0.22) });
        burst(x, y, 10, { col: ['#ffe24a', '#fff6c0'], sp0: 20, sp1: 70, up: -40, g: -30, l0: 0.5, l1: 0.9, s: 0.8 });
        for (let i = 0; i < 5; i++) spark(x + rnd(-8, 8), y - rnd(0, 10), { vx: rnd(-6, 6), vy: rnd(-30, -16), life: rnd(0.8, 1.2), col: '#3a2a2a', s: rnd(2.5, 3.5) * k, s2: 4 * k, add: false, fade: 0.45, delay: 0.15 });
        addFx({ k: 'shock', x, y: gy, r: 16 * k, color: '#ff7a3a', dur: 420 });
        break;
      case 'ice':
        addFx({ k: 'spikes', x, y: gy, r: 13 * k, n: 6, color: '#bfe8ff', dur: 520 });
        addFx({ k: 'glow', x, y, r: 22 * k, color: '#8ad0ff', dur: 500 });
        burst(x, y, 18, { col: ['#ffffff', '#cfefff', '#8ad0ff'], sp0: 50, sp1: 140, g: 220, l0: 0.4, l1: 0.7, shape: 'shard', delay: 0.26 });
        for (let i = 0; i < 6; i++) spark(x + rnd(-14, 14) * k, gy - rnd(0, 8), { vx: rnd(-10, 10), vy: rnd(-12, -4), life: rnd(0.7, 1.1), col: '#e8f6ff', s: 3 * k, s2: 5 * k, fade: 0.35, delay: 0.25 });
        break;
      case 'thunder':
        addFx({ k: 'bolt', x, y, top: y - 80 * k, color: '#fff6a0', dur: 300 });
        addFx({ k: 'glow', x, y, r: 26 * k, color: '#ffe24a', dur: 300 });
        burst(x, y, 16, { col: ['#ffffff', '#fff6a0', '#ffe24a'], sp0: 100, sp1: 230, drag: 7, shape: 'line', l0: 0.12, l1: 0.3 });
        addFx({ k: 'shock', x, y: gy, r: 14 * k, color: '#fff6a0', dur: 300 });
        flash('#fff6c0'); flashT = 0.35;
        break;
      case 'wind':
        for (let i = 0; i < 3; i++) addFx({ k: 'arc', x, y, r: (10 + i * 5) * k, a0: i * 2.1, a1: i * 2.1 + 2.6, w: 2, color: i % 2 ? '#c8ffb8' : '#ffffff', dur: 380, spin: 9, delay: i * 50 });
        for (let i = 0; i < 14; i++) { const a = rnd(0, 6.28), r0 = rnd(4, 10); spark(x + Math.cos(a) * r0, y + Math.sin(a) * r0, { vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, swirl: 9, drag: 1.5, life: rnd(0.45, 0.8), col: ['#9ef08a', '#56b048', '#e8ffd8'], s: 1.4, add: false }); }
        break;
      case 'light':
        addFx({ k: 'beam', x, y: gy, w: 9 * k, color: '#fff4b0', dur: 560 });
        addFx({ k: 'rays', x, y, r: 26 * k, n: 8, color: '#fff8d0', dur: 520 });
        for (let i = 0; i < 16; i++) spark(x + rnd(-10, 10) * k, gy - rnd(0, 26) * k, { vx: rnd(-6, 6), vy: rnd(-40, -15), life: rnd(0.5, 0.9), col: ['#ffffff', '#fff4b0', '#ffe24a'], shape: 'star', s: rnd(1, 1.8), delay: rnd(0, 0.2) });
        break;
      case 'dark':
        addFx({ k: 'orb', x, y, r: 14 * k, dur: 560 });
        for (let i = 0; i < 22; i++) { const a = rnd(0, 6.28), r0 = rnd(20, 30) * k; spark(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.8, { vx: -Math.cos(a) * r0 / 0.28, vy: -Math.sin(a) * r0 * 0.8 / 0.28, life: 0.28, col: ['#b07aff', '#6a3ab0', '#ff7ae0'], s: 1.4, shape: 'line' }); }
        burst(x, y, 18, { col: ['#d0a0ff', '#8a4ae0', '#2a1040'], sp0: 50, sp1: 140, drag: 3, l0: 0.35, l1: 0.6, s: 1.6, delay: 0.27 });
        break;
      default:
        addFx({ k: 'arc', x, y, r: 14 * k, a0: -2.4, a1: 0.6, w: 3, color: '#ffffff', dur: 260 });
        burst(x, y, 8, { col: ['#ffffff', '#ffe8c0'], sp0: 40, sp1: 110, drag: 4, shape: 'line', l0: 0.15, l1: 0.3 });
    }
    if (crit) {
      addFx({ k: 'rays', x, y, r: 30 * k, n: 10, color: '#ffffff', dur: 300 });
      burst(x, y, 10, { col: ['#ffe24a', '#ffffff'], sp0: 90, sp1: 200, drag: 5, shape: 'star', l0: 0.2, l1: 0.4 });
    }
  }
  /* 시전: 발밑의 마법진(속성 색) + 떠오르는 빛 알갱이. 물리 기술은 무기의 번쩍임과 잔상 */
  function castFx(uid, kind, type, healing) {
    const [x, y] = centerOf(uid), gy = feetOf(uid), k = sizeOf(uid);
    const col = healing ? '#a6ff9a' : typeColor(type || (kind === 'mag' ? 'staff' : 'sword'));
    if (kind === 'phys') {
      addFx({ k: 'star', x: x - 8, y: y - 6, r: 9 * k, color: '#ffffff', dur: 320 });
      for (let i = 0; i < 6; i++) spark(x + rnd(-6, 6), y + rnd(-10, 10), { vx: -rnd(80, 160), vy: 0, life: 0.22, col: '#ffffff', shape: 'line', s: 1, drag: 2 });
      return;
    }
    addFx({ k: 'circle', x, y: gy, r: 15 * k, color: col, dur: 700 });
    for (let i = 0; i < 12; i++) { const a = rnd(0, 6.28); spark(x + Math.cos(a) * 14 * k, gy + Math.sin(a) * 4, { vx: 0, vy: rnd(-50, -25), life: rnd(0.4, 0.7), col: [col, '#ffffff'], s: 1, delay: rnd(0, 0.25) }); }
  }
  function healFx(uid, revive) {
    const [x, y] = centerOf(uid), gy = feetOf(uid);
    addFx({ k: 'glow', x, y, r: 20, color: '#a6ff9a', dur: 500 });
    if (revive) { addFx({ k: 'beam', x, y: gy, w: 10, color: '#fff4b0', dur: 700 }); for (let i = 0; i < 8; i++) spark(x + rnd(-12, 12), y - rnd(10, 30), { vx: rnd(-8, 8), vy: rnd(10, 25), swirl: rnd(-2, 2), life: rnd(0.8, 1.2), col: '#ffffff', s: 1.3, add: false }); }
    for (let i = 0; i < 14; i++) spark(x + rnd(-10, 10), gy - rnd(0, 6), { vx: rnd(-5, 5), vy: rnd(-55, -25), life: rnd(0.5, 0.9), col: ['#a6ff9a', '#ffffff', '#fff4b0'], s: rnd(0.9, 1.5), shape: i % 4 ? 'sq' : 'plus', delay: rnd(0, 0.2) });
  }
  function buffFx(uid, up) {
    const [x, y] = centerOf(uid);
    for (let i = 0; i < 3; i++) spark(x + (i - 1) * 7, up ? y + 8 : y - 12, { vx: 0, vy: up ? -40 : 40, life: 0.55, col: up ? '#7af0e0' : '#ff7ab0', shape: up ? 'up' : 'down', s: 1.4, delay: i * 0.06 });
    addFx({ k: 'shock', x, y: feetOf(uid), r: 12, color: up ? '#7af0e0' : '#ff7ab0', dur: 400 });
  }
  function statusFx(uid, st) {
    const [x, y] = centerOf(uid);
    if (st === 'poison') for (let i = 0; i < 8; i++) spark(x + rnd(-8, 8), y + rnd(-2, 8), { vx: rnd(-4, 4), vy: rnd(-30, -12), life: rnd(0.5, 0.9), col: ['#7ae05a', '#b0ff8a', '#3a8a3a'], shape: 'ring', s: rnd(1, 1.8), add: false, delay: rnd(0, 0.2) });
    else if (st === 'blind') for (let i = 0; i < 7; i++) spark(x + rnd(-8, 8), y - rnd(0, 8), { vx: rnd(-10, 10), vy: rnd(-8, 4), life: rnd(0.6, 1), col: '#2a2236', s: 3, s2: 5, add: false, fade: 0.6 });
    else for (let i = 0; i < 6; i++) spark(x + rnd(-8, 8), y - rnd(0, 8), { vx: rnd(-6, 6), vy: rnd(-16, -6), life: rnd(0.6, 1), col: '#9cc8ff', s: 1.2 });
  }
  function breakFx(x, y, k) {
    addFx({ k: 'break', x, y, dur: 900 });
    addFx({ k: 'rays', x, y, r: 60 * k, n: 14, color: '#ffe8a0', dur: 650 });
    burst(x, y, 22, { col: ['#bfe4ff', '#7ab8f0', '#ffffff', '#4a7ac0'], sp0: 60, sp1: 170, g: 200, l0: 0.6, l1: 1.0, shape: 'shard', s: 1.6, add: false });
    burst(x, y, 14, { col: ['#ffe24a', '#ffffff'], sp0: 120, sp1: 260, drag: 6, shape: 'line', l0: 0.2, l1: 0.4 });
  }
  function dissolveFx(uid) {
    const [x, y] = centerOf(uid), k = sizeOf(uid);
    for (let i = 0; i < 34 * k; i++) spark(x + rnd(-10, 10) * k, y + rnd(-14, 14) * k, { vx: rnd(-14, 14), vy: rnd(-60, -20), drag: 1, life: rnd(0.5, 1), col: ['#ffffff', '#e8dcff', '#c8b8f0'], s: rnd(0.8, 1.6), delay: rnd(0, 0.25) });
    addFx({ k: 'glow', x, y, r: 26 * k, color: '#ffffff', dur: 420 });
  }
  function latentFx(uid, col) {
    const [x, y] = centerOf(uid), gy = feetOf(uid);
    addFx({ k: 'beam', x, y: gy, w: 12, color: col, dur: 900 });
    addFx({ k: 'circle', x, y: gy, r: 20, color: col, dur: 1000 });
    addFx({ k: 'rays', x, y, r: 34, n: 12, color: col, dur: 800 });
    for (let i = 0; i < 24; i++) spark(x + rnd(-14, 14), gy - rnd(0, 4), { vx: rnd(-8, 8), vy: rnd(-90, -40), life: rnd(0.6, 1), col: [col, '#ffffff'], shape: i % 3 ? 'sq' : 'star', s: rnd(1, 1.6), delay: rnd(0, 0.35) });
  }
  function boostFx(uid, n) {
    const [x, y] = centerOf(uid), gy = feetOf(uid);
    for (let i = 0; i < 8 + n * 8; i++) spark(x + rnd(-10, 10), gy - rnd(0, 4), { vx: rnd(-6, 6), vy: rnd(-110, -50), drag: 1, life: rnd(0.35, 0.6), pal: ['#fff6c0', '#ffe24a', '#ff9a3a', '#c8501a'], s: rnd(1.2, 2), s2: 0.5 });
    for (let i = 0; i < n; i++) spark(x, y - 6 - i * 5, { vy: -40, life: 0.5, col: '#ffe24a', shape: 'up', s: 1.6, delay: i * 0.08 });
  }

  function drawFx(dt) {
    const u = T.u, sec = dt / 1000;
    // 모양
    fx = fx.filter(f => (f.t += dt) < f.dur + (f.delay || 0));
    for (const f of fx) {
      const tt = f.t - (f.delay || 0);
      if (tt < 0) continue;
      const k = tt / f.dur;
      let [x, y] = f.uid ? centerOf(f.uid) : [f.x, f.y];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      switch (f.k) {
        case 'arc': {   // 초승달 궤적: 앞쪽 40% 동안 휘두르고 사라진다
          const sweep = Math.min(1, k / 0.4), fade = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
          const rot = (f.spin || 0) * tt / 1000;
          const a0 = f.a0 + rot, a1 = f.a0 + (f.a1 - f.a0) * sweep + rot;
          const R = f.r * T.scale;
          for (let i = 0; i < 4; i++) {
            ctx.globalAlpha = fade * (1 - i * 0.22);
            ctx.strokeStyle = i === 0 ? '#ffffff' : f.color;
            ctx.lineWidth = Math.max(1, u * f.w * (1 - i * 0.22) * 0.5);
            const lag = i * 0.18;
            ctx.beginPath(); ctx.arc(SX(x), SY(y), R * (1 - i * 0.05), Math.max(a0, a1 - (a1 - a0) * (0.55 + lag)), a1); ctx.stroke();
          }
          break;
        }
        case 'thrust': {
          const e = Math.min(1, k / 0.35), fade = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65;
          const xe = f.x0 + (f.x1 - f.x0) * e, ye = f.y0 + (f.y1 - f.y0) * e;
          ctx.globalAlpha = fade; ctx.strokeStyle = f.color; ctx.lineWidth = u * 3;
          ctx.beginPath(); ctx.moveTo(SX(f.x0), SY(f.y0)); ctx.lineTo(SX(xe), SY(ye)); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = u;
          ctx.beginPath(); ctx.moveTo(SX(f.x0 + (xe - f.x0) * 0.4), SY(f.y0 + (ye - f.y0) * 0.4)); ctx.lineTo(SX(xe), SY(ye)); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.fillRect(SX(xe) - u * 2, SY(ye) - u / 2, u * 4, u); ctx.fillRect(SX(xe) - u / 2, SY(ye) - u * 2, u, u * 4);
          break;
        }
        case 'arrow': {
          const e = Math.min(1, k * 1.15), xe = f.x0 + (f.x1 - f.x0) * e, ye = f.y0 + (f.y1 - f.y0) * e;
          const a = Math.atan2(f.y1 - f.y0, f.x1 - f.x0), L = 12;
          ctx.globalAlpha = 1 - Math.max(0, k - 0.85) / 0.15;
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = u;
          ctx.beginPath(); ctx.moveTo(SX(xe - Math.cos(a) * L * 2.4), SY(ye - Math.sin(a) * L * 2.4)); ctx.lineTo(SX(xe), SY(ye)); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = '#c8a070'; ctx.lineWidth = u;
          ctx.beginPath(); ctx.moveTo(SX(xe - Math.cos(a) * L), SY(ye - Math.sin(a) * L)); ctx.lineTo(SX(xe), SY(ye)); ctx.stroke();
          ctx.fillStyle = '#e8eef8'; ctx.fillRect(SX(xe) - u, SY(ye) - u, u * 2, u * 2);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(SX(xe - Math.cos(a) * L) - u, SY(ye - Math.sin(a) * L) - u, u * 2, u * 2);
          break;
        }
        case 'star': {
          const R = f.r * T.scale * (0.4 + k * 0.8);
          ctx.globalAlpha = 1 - k; ctx.fillStyle = f.color;
          ctx.fillRect(SX(x) - R, SY(y) - u / 2, R * 2, u); ctx.fillRect(SX(x) - u / 2, SY(y) - R, u, R * 2);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(SX(x) - R * 0.4, SY(y) - u, R * 0.8, u * 2); ctx.fillRect(SX(x) - u, SY(y) - R * 0.4, u * 2, R * 0.8);
          break;
        }
        case 'shock': {
          ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = f.color; ctx.lineWidth = u * (1.5 - k);
          ctx.beginPath(); ctx.ellipse(SX(x), SY(y), (4 + k * f.r) * T.scale, (4 + k * f.r) * T.scale * (f.flat ? 1 : 0.32), 0, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'glow': {
          const R = f.r * T.scale * (0.6 + k * 0.6);
          const g = ctx.createRadialGradient(SX(x), SY(y), 0, SX(x), SY(y), R);
          g.addColorStop(0, f.color); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = (1 - k) * 0.75; ctx.fillStyle = g;
          ctx.fillRect(SX(x) - R, SY(y) - R, R * 2, R * 2);
          break;
        }
        case 'bolt': {   // 번개: 하늘에서 내리꽂히는 갈래 번개(조금씩 모양이 바뀜)
          if (!f.pts || tt - (f.at || 0) > 60) {
            f.at = tt; f.pts = []; f.br = [];
            let xx = x + rnd(-10, 10), yy = f.top;
            while (yy < y) { f.pts.push([xx, yy]); yy += rnd(5, 9); xx += rnd(-6, 6); if (Math.random() < 0.18) f.br.push([xx, yy, xx + rnd(-16, 16), yy + rnd(8, 18)]); }
            f.pts.push([x, y]);
          }
          ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
          for (const [col, w] of [[f.color, 3.2], ['#ffffff', 1.2]]) {
            ctx.strokeStyle = col; ctx.lineWidth = u * w;
            ctx.beginPath(); f.pts.forEach(([a, b], i) => i ? ctx.lineTo(SX(a), SY(b)) : ctx.moveTo(SX(a), SY(b))); ctx.stroke();
            ctx.lineWidth = u * w * 0.5;
            for (const [a, b, c, d] of f.br) { ctx.beginPath(); ctx.moveTo(SX(a), SY(b)); ctx.lineTo(SX(c), SY(d)); ctx.stroke(); }
          }
          break;
        }
        case 'beam': {   // 하늘에서 내려오는 빛기둥
          const w = f.w * T.scale * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) * 0.6);
          const top = T.oy - 20 * T.scale;
          const g = ctx.createLinearGradient(SX(x) - w, 0, SX(x) + w, 0);
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, f.color); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = (k < 0.2 ? 1 : 1 - (k - 0.2) / 0.8) * 0.8; ctx.fillStyle = g;
          ctx.fillRect(SX(x) - w, top, w * 2, SY(y) - top);
          ctx.fillStyle = '#ffffff'; ctx.globalAlpha *= 0.8;
          ctx.fillRect(SX(x) - w * 0.15, top, w * 0.3, SY(y) - top);
          break;
        }
        case 'rays': {   // 사방으로 뻗는 빛살
          ctx.globalAlpha = (1 - k) * 0.85; ctx.fillStyle = f.color;
          const R = f.r * T.scale * (0.5 + k * 0.7);
          for (let i = 0; i < f.n; i++) {
            const a = i / f.n * Math.PI * 2 + k * 0.6;
            ctx.beginPath(); ctx.moveTo(SX(x), SY(y));
            ctx.lineTo(SX(x) + Math.cos(a - 0.06) * R, SY(y) + Math.sin(a - 0.06) * R);
            ctx.lineTo(SX(x) + Math.cos(a + 0.06) * R, SY(y) + Math.sin(a + 0.06) * R); ctx.fill();
          }
          break;
        }
        case 'circle': {   // 마법진: 두 겹 고리 + 눈금 + 도는 별 모양
          const R = f.r * T.scale * (k < 0.2 ? 0.6 + k * 2 : 1), fy = 0.34;
          ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
          ctx.strokeStyle = f.color; ctx.lineWidth = u;
          ctx.beginPath(); ctx.ellipse(SX(x), SY(y), R, R * fy, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(SX(x), SY(y), R * 0.72, R * 0.72 * fy, 0, 0, Math.PI * 2); ctx.stroke();
          const rot = tt / 300;
          ctx.fillStyle = f.color;
          for (let i = 0; i < 12; i++) { const a = rot + i / 12 * Math.PI * 2; ctx.fillRect(SX(x) + Math.cos(a) * R * 0.86 - u / 2, SY(y) + Math.sin(a) * R * 0.86 * fy - u / 2, u, u); }
          ctx.beginPath();
          for (let i = 0; i <= 5; i++) { const a = -rot * 0.7 + i * 4 * Math.PI / 5; const px = SX(x) + Math.cos(a) * R * 0.7, py = SY(y) + Math.sin(a) * R * 0.7 * fy; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.stroke();
          const g = ctx.createRadialGradient(SX(x), SY(y), 0, SX(x), SY(y), R);
          g.addColorStop(0, f.color); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha *= 0.35; ctx.fillStyle = g; ctx.fillRect(SX(x) - R, SY(y) - R * fy, R * 2, R * 2 * fy);
          break;
        }
        case 'spikes': {   // 얼음 가시가 솟았다가 깨진다
          const grow = Math.min(1, k / 0.25), fade = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
          ctx.globalCompositeOperation = 'source-over';
          for (let i = 0; i < f.n; i++) {
            const a = i / f.n * Math.PI * 2 + 0.3, ox = Math.cos(a) * f.r * 0.8, oy = Math.sin(a) * f.r * 0.25;
            const hgt = (14 + (i % 3) * 6) * grow * (f.r / 13), w = 3 + (i % 2);
            const bx = SX(x + ox), by = SY(y + oy);
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#7ac0f0'; ctx.beginPath(); ctx.moveTo(bx - w * T.scale, by); ctx.lineTo(bx + Math.cos(a) * 2 * T.scale, by - hgt * T.scale); ctx.lineTo(bx + w * T.scale, by); ctx.fill();
            ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.moveTo(bx - w * 0.6 * T.scale, by); ctx.lineTo(bx + Math.cos(a) * 2 * T.scale, by - hgt * T.scale); ctx.lineTo(bx, by); ctx.fill();
          }
          break;
        }
        case 'orb': {   // 어둠의 구슬: 안으로 빨려 들었다가 터진다
          const R = f.r * T.scale * (k < 0.5 ? 1 - k : (k - 0.5) * 3);
          const g = ctx.createRadialGradient(SX(x), SY(y), 0, SX(x), SY(y), Math.max(1, R));
          g.addColorStop(0, 'rgba(20,0,40,.95)'); g.addColorStop(0.6, 'rgba(120,60,220,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4; ctx.fillStyle = g;
          ctx.fillRect(SX(x) - R, SY(y) - R, R * 2, R * 2);
          break;
        }
        case 'cast': case 'aura': {
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = f.color; ctx.lineWidth = u;
          ctx.beginPath(); ctx.ellipse(SX(x), SY(y + 14), (8 + k * 16) * T.scale, (3 + k * 5) * T.scale, 0, 0, Math.PI * 2); ctx.stroke();
          for (let i = 0; i < 6; i++) { ctx.fillStyle = f.color; ctx.fillRect(SX(x + Math.sin(i * 2 + time / 200) * 10), SY(y + 12 - k * 30 - i * 3), u, u); }
          break;
        }
        case 'ring': {
          ctx.strokeStyle = f.color; ctx.lineWidth = u; ctx.globalAlpha = 1 - k;
          ctx.beginPath(); ctx.arc(SX(x), SY(y), (4 + k * 18) * T.scale, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'shard': {
          ctx.globalAlpha = 1 - k; ctx.fillStyle = '#bfe4ff';
          for (let i = 0; i < 6; i++) { const a = i; ctx.fillRect(SX(x + Math.cos(a) * k * 22), SY(y + Math.sin(a) * k * 16), u * 1.5, u * 1.5); }
          break;
        }
        case 'break': {
          ctx.globalAlpha = (1 - k) * 0.9;
          ctx.strokeStyle = '#ffe24a'; ctx.lineWidth = u * 2;
          ctx.beginPath(); ctx.arc(SX(x), SY(y), (6 + k * 50) * T.scale, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = u;
          ctx.beginPath(); ctx.arc(SX(x), SY(y), (3 + k * 34) * T.scale, 0, Math.PI * 2); ctx.stroke();
          break;
        }
      }
      ctx.restore();
    }
    // 입자
    pt = pt.filter(p => (p.t += sec) < p.life);
    for (const p of pt) {
      if (p.t < 0) continue;
      if (p.drag) { const d = Math.max(0, 1 - p.drag * sec); p.vx *= d; p.vy *= d; }
      if (p.swirl) { const c = Math.cos(p.swirl * sec), s = Math.sin(p.swirl * sec), vx = p.vx; p.vx = vx * c - p.vy * s; p.vy = vx * s + p.vy * c; }
      p.vy += p.g * sec;
      p.x += p.vx * sec; p.y += p.vy * sec;
      const k = p.t / p.life;
      const col = p.pal ? p.pal[Math.min(p.pal.length - 1, (k * p.pal.length) | 0)] : p.col;
      const sz = Math.max(1, Math.round(u * (p.s2 == null ? p.s : p.s + (p.s2 - p.s) * k)));
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      ctx.globalAlpha = Math.max(0, (1 - k) * p.fade);
      ctx.fillStyle = col;
      const X = Math.round(SX(p.x)), Y = Math.round(SY(p.y));
      switch (p.shape) {
        case 'line': {
          const L = Math.min(18, Math.hypot(p.vx, p.vy) * 0.05) * T.scale, a = Math.atan2(p.vy, p.vx);
          ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, sz * 0.8);
          ctx.beginPath(); ctx.moveTo(X - Math.cos(a) * L, Y - Math.sin(a) * L); ctx.lineTo(X, Y); ctx.stroke();
          break;
        }
        case 'star': ctx.fillRect(X - sz * 1.5, Y - sz / 2, sz * 3, sz); ctx.fillRect(X - sz / 2, Y - sz * 1.5, sz, sz * 3); break;
        case 'plus': ctx.fillRect(X - sz * 2, Y - sz / 2, sz * 4, sz); ctx.fillRect(X - sz / 2, Y - sz * 2, sz, sz * 4); break;
        case 'shard': ctx.beginPath(); ctx.moveTo(X, Y - sz * 1.5); ctx.lineTo(X + sz, Y + sz); ctx.lineTo(X - sz, Y + sz * 0.5); ctx.fill(); break;
        case 'ring': ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, u * 0.6); ctx.strokeRect(X - sz, Y - sz, sz * 2, sz * 2); break;
        case 'up': case 'down': {
          const d = p.shape === 'up' ? -1 : 1;
          ctx.fillRect(X - sz / 2, Y - sz * 1.5, sz, sz * 3);
          ctx.fillRect(X - sz * 1.5, Y + d * sz * 0.5, sz * 3, sz); ctx.fillRect(X - sz, Y + d * sz * 1.5 - (d < 0 ? 0 : 0), sz * 2, sz);
          break;
        }
        default: ctx.fillRect(X - sz / 2, Y - sz / 2, sz, sz);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  /* ── 배경 (화면 크기에 맞춰 한 번 그려 둠) ── */
  function paintBg(W, H, kind, dawn) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const sc = Math.min(W / SW, H / SH), ox = (W - SW * sc) / 2, oy = (H - SH * sc) / 2;
    const hy = oy + L.hy * sc;     // 지평선
    const P = {
      plains: { sky: dawn ? ['#8ec5f0', '#f7d6a8'] : ['#4a3a78', '#f08c5a'], far: dawn ? '#7aa0b8' : '#5c3c6a', mid: dawn ? '#4f8a48' : '#3d4a3a', ground: dawn ? ['#6aa84f', '#4b8a3c'] : ['#6a7448', '#40452f'], prop: 'tree' },
      forest: { sky: dawn ? ['#6fb0d8', '#e8e0b0'] : ['#2e2a52', '#c86a52'], far: dawn ? '#3f7a52' : '#2c3a3a', mid: dawn ? '#2f6a3a' : '#1f2c26', ground: dawn ? ['#5a9a44', '#3c7a34'] : ['#4a5a38', '#2c3424'], prop: 'tree' },
      desert: { sky: dawn ? ['#7cc0ee', '#fbe3b0'] : ['#5a3a6a', '#f2964e'], far: dawn ? '#d8a868' : '#8a5048', mid: dawn ? '#c89a5a' : '#7a4a3a', ground: dawn ? ['#ecd08a', '#d2ad69'] : ['#c9955e', '#94643e'], prop: 'cactus' },
      tomb: { sky: ['#1e1418', '#3a2a22'], far: '#2a1e18', mid: '#4a3624', ground: ['#a07c48', '#5e4528'], prop: 'pillar', inside: true },
      snow: { sky: dawn ? ['#9cd0f4', '#f4f0e6'] : ['#463a72', '#d88a8a'], far: dawn ? '#c8dcec' : '#7a6a92', mid: dawn ? '#e8f0f8' : '#a89ab8', ground: dawn ? ['#f4f8fc', '#cfdcea'] : ['#d8d0e4', '#9a90b0'], prop: 'pine_snow' },
      ice: { sky: ['#0e1a30', '#1e3a5c'], far: '#1a3050', mid: '#2a5480', ground: ['#9fcbe4', '#4a7aa8'], prop: 'crystal', inside: true },
      swamp: { sky: dawn ? ['#8ab0c0', '#d8dcc0'] : ['#2a2a40', '#7a6a6a'], far: dawn ? '#5a7a6a' : '#3a4440', mid: dawn ? '#3e5a44' : '#283228', ground: dawn ? ['#6a8a5a', '#4a6440'] : ['#4a5a40', '#2a3428'], prop: 'tree_dead' },
      tower: { sky: ['#140e24', '#2e2050'], far: '#241a40', mid: '#3a2c60', ground: ['#5a4a80', '#2e2448'], prop: 'pillar', inside: true },
      dusk: { sky: ['#2a0e1e', '#c0402a'], far: '#4a1a2a', mid: '#6a2430', ground: ['#7a3a3a', '#3a1820'], prop: 'pillar', inside: true }
    }[kind] || {};
    // 하늘
    let gr = g.createLinearGradient(0, 0, 0, hy);
    gr.addColorStop(0, P.sky[0]); gr.addColorStop(1, P.sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, hy + 2);
    const r = makeRng(kind.length * 77 + 5);
    if (!P.inside) {
      // 해 (지평선에 걸린)
      const sx = W * 0.72, sy = hy - 4 * sc;
      const sg = g.createRadialGradient(sx, sy, 0, sx, sy, 70 * sc);
      sg.addColorStop(0, dawn ? 'rgba(255,250,220,.95)' : 'rgba(255,200,120,.9)'); sg.addColorStop(0.15, dawn ? 'rgba(255,240,190,.5)' : 'rgba(255,150,90,.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg; g.fillRect(0, 0, W, hy);
      // 구름
      g.fillStyle = dawn ? 'rgba(255,255,255,.35)' : 'rgba(255,170,150,.22)';
      for (let i = 0; i < 7; i++) { const cx = r.range(0, W), cy = r.range(oy, hy - 20 * sc); g.beginPath(); g.ellipse(cx, cy, r.range(30, 70) * sc, r.range(4, 8) * sc, 0, 0, Math.PI * 2); g.fill(); }
      // 먼 산
      g.fillStyle = P.far;
      g.beginPath(); g.moveTo(0, hy);
      for (let x = 0; x <= W; x += 8 * sc) g.lineTo(x, hy - (14 + 10 * Math.sin(x / (40 * sc)) + 6 * Math.sin(x / (13 * sc))) * sc);
      g.lineTo(W, hy); g.fill();
      // 가까운 숲·언덕 실루엣
      g.fillStyle = P.mid;
      g.beginPath(); g.moveTo(0, hy + 2);
      for (let x = 0; x <= W; x += 5 * sc) g.lineTo(x, hy - (4 + 4 * Math.abs(Math.sin(x / (9 * sc))) + 3 * Math.sin(x / (31 * sc))) * sc);
      g.lineTo(W, hy + 2); g.fill();
    } else {
      // 실내: 벽돌 벽
      g.fillStyle = 'rgba(0,0,0,.25)';
      for (let y = oy - 200 * sc; y < hy; y += 8 * sc) {
        const off = ((y - oy) / (8 * sc)) % 2 ? 8 * sc : 0;
        for (let x = -off; x < W; x += 16 * sc) g.fillRect(x, y, 15 * sc, 7 * sc);
      }
      const wg = g.createLinearGradient(0, hy - 30 * sc, 0, hy);
      wg.addColorStop(0, 'rgba(0,0,0,0)'); wg.addColorStop(1, P.mid);
      g.fillStyle = wg; g.fillRect(0, hy - 30 * sc, W, 30 * sc);
    }
    // 땅
    gr = g.createLinearGradient(0, hy, 0, H);
    gr.addColorStop(0, P.ground[0]); gr.addColorStop(1, P.ground[1]);
    g.fillStyle = gr; g.fillRect(0, hy, W, H - hy);
    // 원근 줄무늬
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = Math.max(1, sc * 0.6);
    const vx = W / 2, vy = hy - 40 * sc;
    for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(vx + i * 30 * sc * 0.2, hy); g.lineTo(vx + i * 60 * sc, H); g.stroke(); }
    for (let k = 1; k < 8; k++) { const y = hy + (H - hy) * Math.pow(k / 8, 1.8); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // 풀·돌 점
    for (let i = 0; i < 220; i++) {
      const y = hy + Math.pow(r.next(), 0.7) * (H - hy), x = r.range(0, W);
      g.fillStyle = r.chance(0.5) ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.09)';
      const s = Math.max(1, sc * (0.6 + (y - hy) / (H - hy)));
      g.fillRect(x, y, s * 2, s);
    }
    // 소품 (뒤쪽 줄)
    const hdProp = P.prop && Gfx.isHD('o_' + P.prop);
    const prop = Gfx.sprite(P.prop === 'pillar' ? null : (hdProp ? 'o_' + P.prop : P.prop));
    for (let i = 0; i < 9; i++) {
      const x = ox + (i / 8) * SW * sc + r.range(-10, 10) * sc;
      if (Math.abs(x - W / 2) < 50 * sc && !P.inside) continue;
      if (P.prop === 'pillar') {
        const px = x, pw = 10 * sc, ph = 60 * sc;
        const pg = g.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0);
        pg.addColorStop(0, 'rgba(0,0,0,.4)'); pg.addColorStop(0.4, P.mid); pg.addColorStop(1, 'rgba(0,0,0,.5)');
        g.fillStyle = pg; g.fillRect(px - pw / 2, hy - ph + 6 * sc, pw, ph);
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(px - pw / 2 - 2 * sc, hy - ph + 6 * sc, pw + 4 * sc, 4 * sc);
      } else if (prop) {
        const u = hdProp ? Math.max(1, Math.round(sc * 0.8)) : Math.max(1, Math.round(sc * 1.4));
        g.globalAlpha = 0.8;
        if (hdProp) g.drawImage(prop, Math.round(x - prop.width * u / 2), Math.round(hy - prop.height * u + 6 * sc), prop.width * u, prop.height * u);
        else g.drawImage(prop, Math.round(x - 8 * u), Math.round(hy - 14 * u + 3 * sc), 16 * u, 16 * u);
        g.globalAlpha = 1;
      }
    }
    // 빛줄기
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x0 = W * (0.15 + i * 0.25) + r.range(-20, 20) * sc;
      const lg = g.createLinearGradient(x0, 0, x0 + 60 * sc, H);
      const col = P.inside ? (kind === 'dusk' ? '255,120,80' : kind === 'ice' ? '150,210,255' : '200,170,255') : (dawn ? '255,245,210' : '255,170,110');
      lg.addColorStop(0, `rgba(${col},.10)`); lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg;
      g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + 26 * sc, 0); g.lineTo(x0 + 90 * sc, H); g.lineTo(x0 + 40 * sc, H); g.fill();
    }
    g.restore();
    // 지평선 안개
    const fg = g.createLinearGradient(0, hy - 14 * sc, 0, hy + 22 * sc);
    fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(0.5, P.inside ? 'rgba(0,0,0,.18)' : (dawn ? 'rgba(255,255,255,.22)' : 'rgba(255,170,140,.2)')); fg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = fg; g.fillRect(0, hy - 14 * sc, W, 36 * sc);
    // 아래·가장자리 어둡게 (심도)
    const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return c;
  }

  /* ── 적 표시(실드·약점·HP) ── */
  function buildTags() {
    const box = $('bTags');
    box.innerHTML = '';
    for (const e of B.enemies) {
      const d = document.createElement('div');
      d.className = 'etag'; d.dataset.uid = e.uid;
      d.innerHTML = `<div class="hit"></div><div class="row"><span class="shield"><b></b></span><span class="weak"></span></div><div class="ehp"><i></i></div>`;
      d.querySelector('.hit').addEventListener('click', () => tapUnit(e.uid));
      box.appendChild(d);
      refreshTag(e);
    }
    const pc = document.createElement('div');
    pc.id = 'bCursor'; pc.hidden = true; pc.textContent = '▼';
    box.appendChild(pc);
    placeTags();
  }
  function refreshTags() { for (const e of B.enemies) refreshTag(e); }
  function refreshTag(e, anim, type) {
    const d = document.querySelector(`.etag[data-uid="${e.uid}"]`);
    if (!d) return;
    const v = vis.get(e.uid);
    d.hidden = e.hp <= 0 && (!v || v.dying);
    d.classList.toggle('broken', e.broken);
    d.classList.toggle('boss', !!e.big);
    const sh = d.querySelector('.shield');
    sh.querySelector('b').textContent = e.broken ? '' : e.shield;
    sh.classList.toggle('off', e.broken);
    if (anim) { sh.classList.remove('crack', 'recover', 'break'); void sh.offsetWidth; sh.classList.add(anim === 'reveal' ? 'crack' : anim); }
    d.querySelector('.weak').innerHTML = e.weak.map(w => {
      const known = B.isRevealed(e, w);
      return known ? `<img src="${Gfx.icon(w, 16)}" alt="${TYPE_NAME[w]}" title="${TYPE_NAME[w]}"${type === w ? ' class="new"' : ''}>` : '<i>?</i>';
    }).join('');
    d.querySelector('.ehp i').style.width = (e.hp / e.maxhp * 100) + '%';
    const st = [];
    for (const [k, b] of Object.entries(e.buffs)) st.push(`<em class="${b.lv > 0 ? 'up' : 'dn'}">${BUFF_NAME[k]}${b.lv > 0 ? '▲' : '▼'}</em>`);
    for (const s of Object.keys(e.status)) st.push(`<em class="dn">${STATUS_NAME[s]}</em>`);
    if (e.ward) st.unshift(`<em class="wd">${e.ward === 'phys' ? '물리' : '마법'} 반감</em>`);
    if (e.boss && B.enemies.some(m => m !== e && m.hp > 0 && m.d.guard)) st.unshift('<em class="gd">호위받음</em>');
    if (e.d.guard) st.unshift('<em class="gd">호위</em>');
    if (e.d.ai && e.d.ai.some(([a]) => a === 'mend')) st.unshift('<em class="gd">치유</em>');
    let s = d.querySelector('.st');
    if (!s) { s = document.createElement('div'); s.className = 'st'; d.appendChild(s); }
    s.innerHTML = st.join('');
  }
  function placeTags() {
    if (!B) return;
    const r = cv.getBoundingClientRect(), host = $('bStage').getBoundingClientRect();
    const k = T.scale / T.dpr;
    for (const e of B.enemies) {
      const d = document.querySelector(`.etag[data-uid="${e.uid}"]`);
      if (!d) continue;
      const [x, y] = posOf(e.uid);
      const cx = r.left - host.left + (T.ox / T.dpr) + x * k, cy = r.top - host.top + (T.oy / T.dpr) + y * k;
      d.style.left = Math.round(cx) + 'px'; d.style.top = Math.round(cy + 2) + 'px';
      const hit = d.querySelector('.hit');
      const h = (e.big ? 64 : 32) * k, w = (e.big ? 56 : 30) * k;
      hit.style.width = w + 'px'; hit.style.height = h + 'px'; hit.style.left = -w / 2 + 'px'; hit.style.top = -h - 2 + 'px';
    }
  }
  function placeCursor() {
    const c = $('bCursor');
    if (!c) return;
    if (!ui || ui.mode !== 'target' || ui.tkind !== 'enemy') { c.hidden = true; return; }
    const t = ui.targets[ui.cursor];
    if (!t) { c.hidden = true; return; }
    const r = cv.getBoundingClientRect(), host = $('bStage').getBoundingClientRect();
    const k = T.scale / T.dpr;
    const [x, y] = posOf(t.uid);
    c.hidden = false;
    c.style.left = Math.round(r.left - host.left + T.ox / T.dpr + x * k) + 'px';
    c.style.top = Math.round(r.top - host.top + T.oy / T.dpr + (y - (t.big ? 66 : 34)) * k - 14 + Math.sin(time / 150) * 3) + 'px';
  }

  /* 떠오르는 글자 */
  function pop(uid, text, cls = '', sub = '') {
    const r = cv.getBoundingClientRect(), host = $('bStage').getBoundingClientRect();
    const k = T.scale / T.dpr;
    const [x, y] = centerOf(uid);
    const d = document.createElement('div');
    d.className = 'pop ' + cls;
    d.innerHTML = (sub ? `<small>${sub}</small>` : '') + `<span>${text}</span>`;
    const jitter = (Math.random() - 0.5) * 14;
    d.style.left = Math.round(r.left - host.left + T.ox / T.dpr + x * k + jitter) + 'px';
    d.style.top = Math.round(r.top - host.top + T.oy / T.dpr + y * k - 10) + 'px';
    $('bFx').appendChild(d);
    setTimeout(() => d.remove(), 1100);
  }
  function bigText(uid, text) {
    const r = cv.getBoundingClientRect(), host = $('bStage').getBoundingClientRect();
    const k = T.scale / T.dpr;
    const [x, y] = centerOf(uid);
    const d = document.createElement('div');
    d.className = 'breaktxt'; d.textContent = text;
    d.style.left = Math.round(r.left - host.left + T.ox / T.dpr + x * k) + 'px';
    d.style.top = Math.round(r.top - host.top + T.oy / T.dpr + y * k) + 'px';
    $('bFx').appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }
  let bannerTimer = 0;
  function banner(text, cls = '') {
    const b = $('bBanner');
    b.textContent = text; b.className = 'show ' + cls;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { b.className = ''; }, 1500 * speed);
  }

  /* ── 차례표 ── */
  function orderIcon(en, cur) {
    const u = en.u;
    const s = u.side === 'p' ? Gfx.face(u.spr, 28, 'f') : Gfx.face(u.spr, 28, u.broken || en.broken ? 'g' : '');
    return `<span class="oi ${u.side}${cur ? ' cur' : ''}${en.broken ? ' brk' : ''}${en.extra ? ' extra' : ''}" title="${u.name}"><img src="${s}" alt="">${en.broken ? '<b>B</b>' : ''}</span>`;
  }
  function updateOrder() {
    if (!B) return;
    const now = B.orderNow(), next = B.orderNext();
    $('bOrderNow').innerHTML = now.map((en, i) => orderIcon(en, i === 0 && en.now)).join('');
    $('bOrderNext').innerHTML = next.map(en => orderIcon(en, false)).join('');
    $('bRound').textContent = B.round;
  }

  /* ── 일행 표 ── */
  function updateParty() {
    if (!B) return;
    const box = $('bParty');
    const actor = B.actor();
    let html = '';
    for (let c = 0; c < 4; c++) {
      const u = B.front[c], b = B.back[c];
      if (!u && !b) continue;
      html += `<div class="prow${u && u === actor ? ' act' : ''}" data-col="${c}">`;
      if (u) {
        const ko = u.hp <= 0;
        const lat = Math.floor(u.latent);
        const pips = Array.from({ length: 5 }, (_, i) => {
          const on = i < u.bp, use = u === actor && ui && i >= u.bp - ui.boost && i < u.bp;
          return `<i class="${on ? 'on' : ''}${use ? ' use' : ''}"></i>`;
        }).join('');
        const tags = [];
        for (const [k, bf] of Object.entries(u.buffs)) tags.push(`<em class="${bf.lv > 0 ? 'up' : 'dn'}">${BUFF_NAME[k]}${bf.lv > 0 ? '▲' : '▼'}</em>`);
        for (const s of Object.keys(u.status)) tags.push(`<em class="dn">${STATUS_NAME[s]}</em>`);
        if (u.taunt) tags.push('<em class="up">도발</em>');
        if (u.defending) tags.push('<em class="up">방어</em>');
        if (u.la) tags.push(`<em class="la">${LATENTS[u.la].name}</em>`);
        html += `<div class="pcard${ko ? ' ko' : ''}" data-uid="${u.uid}">
          <img class="pf" src="${Gfx.face(u.spr, 30, ko ? 'fg' : 'f')}" alt="">
          <div class="pinfo">
            <div class="pn"><b>${u.name}</b><span class="bp">${pips}</span></div>
            <div class="bar hp"><i style="width:${u.hp / u.maxhp * 100}%"></i><span>${u.hp}</span></div>
            <div class="bar sp"><i style="width:${u.sp / u.maxsp * 100}%"></i><span>${u.sp}</span></div>
            <div class="lat${lat >= 100 ? ' full' : ''}"><i style="width:${lat}%"></i></div>
            <div class="tags">${tags.join('')}</div>
          </div>
        </div>`;
      } else html += '<div class="pcard empty"></div>';
      if (b) {
        html += `<div class="bcard${b.hp <= 0 ? ' ko' : ''}" data-uid="${b.uid}" title="후열: ${b.name}">
          <img src="${Gfx.face(b.spr, 22, b.hp <= 0 ? 'fg' : 'f')}" alt=""><div class="bar hp"><i style="width:${b.hp / b.maxhp * 100}%"></i></div><div class="bar sp"><i style="width:${b.sp / b.maxsp * 100}%"></i></div><span class="bpn">${b.bp}</span></div>`;
      } else html += '<div class="bcard empty"></div>';
      html += '</div>';
    }
    box.innerHTML = html;
    box.querySelectorAll('.pcard[data-uid]').forEach(el => el.addEventListener('click', () => tapUnit(el.dataset.uid)));
  }

  /* ── 명령 받기 ── */
  function clearMenu() { $('bMenu').innerHTML = ''; $('bHelp').textContent = ''; $('bBoost').classList.add('off'); }
  function command() {
    return new Promise(resolve => {
      const u = B.actor();
      ui = { mode: 'root', boost: 0, cursor: 0, resolve, u, stack: [] };
      if (opts.tutorial && !tutorialShown.b2) { tutorialShown.b2 = true; App.tip('battle2', true).then(() => renderMenu()); }
      Sound.sfx('turn');
      renderMenu();
      updateParty();
    });
  }
  function maxBoost() { return ui ? B.maxBoost(ui.u) : 0; }
  function setBoost(n) {
    if (!ui) return;
    const m = maxBoost();
    const nb = Math.max(0, Math.min(m, n));
    if (nb !== ui.boost) { ui.boost = nb; Sound.sfx(nb > 0 ? 'boostup' : 'menu'); }
    updateParty(); renderBoost();
  }
  function renderBoost() {
    const el = $('bBoost');
    if (!ui) { el.classList.add('off'); return; }
    el.classList.toggle('off', !['root', 'weapon', 'skill', 'target'].includes(ui.mode) || ui.noBoost);
    el.querySelector('.lv').innerHTML = `부스트 <b>${ui.boost}</b><small>/ ${maxBoost()}</small>`;
    el.dataset.lv = ui.boost;
  }
  const BATTLE_ITEMS = () => Object.entries(App.G.items).filter(([id, n]) => n > 0 && ITEMS[id]);
  function renderMenu() {
    if (!ui) return;
    const u = ui.u;
    const m = $('bMenu');
    let items = [];
    const help = $('bHelp');
    if (ui.mode === 'root') {
      const sw = B.swapOptions();
      const hasItems = BATTLE_ITEMS().length > 0;
      const w = B.state.waiting;
      items = [
        { label: '공격', sub: HEROES[u.id].weapons.map(t => `<img src="${Gfx.icon(t, 16)}" alt="">`).join(''), act: () => pickWeapon(), help: '무기로 공격합니다. 부스트하면 그만큼 더 때립니다.' },
        { label: '기술', act: () => go('skill'), help: '기술을 씁니다. SP가 듭니다.' },
        { label: '아이템', act: () => go('item'), disabled: !hasItems, help: '아이템을 씁니다.' },
        { label: '방어', act: () => send({ type: 'defend' }), help: '받는 피해를 절반으로 줄이고, 다음 라운드에 가장 먼저 움직입니다.' },
        { label: '교대', sub: sw.some(o => o.self) ? `<img src="${Gfx.face(B.back[w.col].spr, 16, 'f')}" alt="">` : '', act: () => doSwap(), disabled: !sw.length, help: sw.length ? '후열과 자리를 바꿉니다. 들어온 사람이 바로 행동합니다.' : '교대할 수 있는 후열이 없습니다.' },
        { label: '잠재력', cls: u.latent >= 100 && !u.la ? 'latent' : '', act: () => doLatent(), disabled: u.latent < 100 || !!u.la, help: `${LATENTS[HEROES[u.id].latent].name}: ${LATENTS[HEROES[u.id].latent].desc}` },
        { label: '도망', act: () => send({ type: 'flee' }), disabled: B.state.noEscape, help: B.state.noEscape ? '도망칠 수 없는 싸움입니다.' : '전투에서 도망칩니다.' }
      ];
      if (w.twice) items = items.filter(i => i.label !== '교대' && i.label !== '잠재력');
    } else if (ui.mode === 'weapon') {
      items = HEROES[u.id].weapons.map(t => ({ label: TYPE_NAME[t], icon: Gfx.icon(t, 16), act: () => target('enemy', { type: 'attack', weapon: t }), help: `${TYPE_NAME[t]}(으)로 공격합니다.` }));
    } else if (ui.mode === 'skill') {
      items = Party.skills(u.h).map(id => {
        const s = SKILLS[id];
        const ok = B.canSkill(u, id);
        const cost = B.spCost(u, id);
        return { label: s.name, icon: s.type ? Gfx.icon(s.type, 16) : '', right: `${cost}`, disabled: !ok, act: () => chooseSkill(id), help: s.desc + (s.boost === 'hits' ? ' (부스트: 타수)' : s.boost === 'turns' ? ' (부스트: 지속)' : s.boost === 'power' ? ' (부스트: 위력)' : '') };
      });
    } else if (ui.mode === 'item') {
      items = BATTLE_ITEMS().map(([id, n]) => {
        const it = ITEMS[id];
        return { label: it.name, icon: Gfx.icon(it.icon, 16), right: '×' + n, act: () => chooseItem(id), help: it.desc };
      });
    } else if (ui.mode === 'swapcol') {
      items = B.swapOptions().map(o => ({ label: `${(B.front[o.col] || { name: '빈 자리' }).name} ↔ ${B.back[o.col].name}`, act: () => send({ type: 'swap', col: o.col }), help: o.self ? '들어온 사람이 이번 차례에 바로 행동합니다.' : '쓰러진 동료를 후열과 바꿉니다(이번 차례는 그대로).' }));
    } else if (ui.mode === 'target') {
      items = ui.targets.map((t, i) => ({ label: t.name, right: t.side === 'e' ? (t.broken ? 'BREAK' : `◆${t.shield}`) : `${t.hp}/${t.maxhp}`, act: () => { ui.cursor = i; confirmTarget(); }, cur: i === ui.cursor, hover: () => { ui.cursor = i; } }));
    }
    m.innerHTML = '';
    if (ui.mode !== 'root') {
      const back = document.createElement('button');
      back.className = 'mi back'; back.textContent = '◀ 뒤로';
      back.addEventListener('click', () => backMenu());
      m.appendChild(back);
    }
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'mi' + (it.cls ? ' ' + it.cls : '') + (i === ui.cursor ? ' cur' : '');
      b.disabled = !!it.disabled;
      b.innerHTML = `${it.icon ? `<img src="${it.icon}" alt="">` : ''}<span>${it.label}</span>${it.sub ? `<span class="sub">${it.sub}</span>` : ''}${it.right ? `<small>${it.right}</small>` : ''}`;
      b.addEventListener('click', () => { if (!it.disabled) { ui.cursor = i; Sound.sfx('ok'); it.act(); } });
      b.addEventListener('pointerenter', () => { help.textContent = it.help || ''; if (it.hover) { it.hover(); } });
      m.appendChild(b);
    });
    ui.items = items;
    const cur = items[ui.cursor];
    help.textContent = cur ? (cur.help || '') : '';
    m.dataset.mode = ui.mode;
    renderBoost();
    $('bCmd').classList.toggle('waiting', false);
    $('bWho').innerHTML = `<img src="${Gfx.face(u.spr, 22, 'f')}" alt=""><b>${u.name}</b>의 차례${B.state.waiting.twice ? ' (한 번 더)' : ''}`;
  }
  function go(mode) { ui.stack.push({ mode: ui.mode, cursor: ui.cursor }); ui.mode = mode; ui.cursor = 0; renderMenu(); }
  function backMenu() {
    const p = ui.stack.pop();
    if (!p) return;
    ui.mode = p.mode; ui.cursor = p.cursor; ui.pending = null; ui.targets = null;
    Sound.sfx('cancel');
    renderMenu();
  }
  function pickWeapon() {
    const ws = HEROES[ui.u.id].weapons;
    if (ws.length === 1) target('enemy', { type: 'attack', weapon: ws[0] });
    else go('weapon');
  }
  function chooseSkill(id) {
    const s = SKILLS[id];
    const u = ui.u;
    let t = s.target;
    if (u.la === 'surge' && s.kind === 'mag' && (t === 'enemy' || t === 'random')) t = 'enemies';
    if (u.la === 'grace' && t === 'ally') t = 'allies';
    if (u.la === 'grace' && t === 'ko') t = 'kos';
    if (t === 'enemy') return target('enemy', { type: 'skill', skill: id });
    if (t === 'ally') return target(s.notSelf ? 'other' : 'ally', { type: 'skill', skill: id });
    if (t === 'ko') return target('ko', { type: 'skill', skill: id });
    send({ type: 'skill', skill: id });
  }
  function chooseItem(id) {
    const it = ITEMS[id];
    const cat = ui.u.la === 'catalyst';
    ui.noBoost = true;
    if (cat || it.target === 'enemies') return send({ type: 'item', item: id });
    if (it.target === 'enemy') return target('enemy', { type: 'item', item: id });
    if (it.target === 'ko') return target('ko', { type: 'item', item: id });
    return target('ally', { type: 'item', item: id });
  }
  function target(kind, pending) {
    const u = ui.u;
    let list;
    if (kind === 'enemy') list = B.enemies.filter(e => e.hp > 0).sort((a, b) => posOf(a.uid)[1] - posOf(b.uid)[1]);
    else if (kind === 'ko') list = B.front.filter(x => x && x.hp <= 0);
    else list = B.front.filter(x => x && x.hp > 0 && (kind !== 'other' || x !== u));
    if (!list.length) { Sound.sfx('error'); return; }
    ui.stack.push({ mode: ui.mode, cursor: ui.cursor });
    ui.mode = 'target'; ui.tkind = kind === 'enemy' ? 'enemy' : 'ally'; ui.targets = list; ui.pending = pending;
    ui.cursor = 0;
    if (kind === 'enemy' && ui.lastTarget) { const i = list.findIndex(e => e.uid === ui.lastTarget); if (i >= 0) ui.cursor = i; }
    if (kind === 'enemy' && ui.cursor === 0 && !ui.lastTarget) {
      const i = list.findIndex(e => e.broken); if (i >= 0) ui.cursor = i;
    }
    renderMenu();
  }
  function confirmTarget() {
    const t = ui.targets[ui.cursor];
    if (!t) return;
    ui.lastTarget = t.uid;
    send({ ...ui.pending, target: t.uid });
  }
  function tapUnit(uid) {
    if (!ui) return;
    if (ui.mode === 'target') {
      const i = ui.targets.findIndex(t => t.uid === uid);
      if (i >= 0) { ui.cursor = i; Sound.sfx('ok'); confirmTarget(); }
    } else if (ui.mode === 'root') {
      const e = B.unit(uid);
      if (e && e.side === 'e' && e.hp > 0) {
        // 적을 바로 누르면 그 적을 일반 공격
        const ws = HEROES[ui.u.id].weapons;
        ui.lastTarget = uid;
        if (ws.length === 1) send({ type: 'attack', weapon: ws[0], target: uid });
        else { go('weapon'); }
      }
    }
  }
  function doSwap() {
    const sw = B.swapOptions();
    if (sw.length === 1) send({ type: 'swap', col: sw[0].col });
    else go('swapcol');
  }
  function doLatent() {
    const u = ui.u;
    if (HEROES[u.id].latent === 'encore') {
      const others = B.front.filter(x => x && x.hp > 0 && x !== u);
      if (!others.length) { Sound.sfx('error'); return; }
      ui.stack.push({ mode: ui.mode, cursor: ui.cursor });
      ui.mode = 'target'; ui.tkind = 'ally'; ui.targets = others; ui.cursor = 0; ui.pending = { type: 'latent' }; ui.latentEncore = true;
      return renderMenu();
    }
    send({ type: 'latent' });
  }
  async function send(cmd) {
    if (!ui) return;
    if (cmd.type === 'latent' && cmd.target) { cmd.col = B.front.findIndex(x => x && x.uid === cmd.target); delete cmd.target; }
    if (cmd.type === 'attack' || cmd.type === 'skill') cmd.boost = ui.noBoost ? 0 : ui.boost;
    const keep = ui;
    $('bMenu').innerHTML = ''; $('bHelp').textContent = ''; $('bBoost').classList.add('off');
    $('bCmd').classList.add('waiting');
    const free = cmd.type === 'swap' || cmd.type === 'latent';
    ui = null;
    const evs = B.act(cmd);
    await play(evs);
    if (B.waiting && !B.over) {
      // 같은 사람(또는 들어온 사람)이 이어서 고른다
      const u = B.actor();
      ui = { mode: 'root', boost: free && keep.u === u ? Math.min(keep.boost, B.maxBoost(u)) : 0, cursor: 0, resolve: keep.resolve, u, stack: [], lastTarget: keep.lastTarget };
      renderMenu(); updateParty();
      return;
    }
    keep.resolve();
  }

  /* 키보드 */
  function key(e) {
    const k = e.key;
    if (!$('bResult').hidden) {
      if (['Enter', ' ', 'z', 'Z'].includes(k)) { const b = $('bResult').querySelector('button'); if (b) b.click(); return true; }
      return false;
    }
    if (!running) return false;
    if (!ui) return false;
    const n = ui.items ? ui.items.length : 0;
    if (k === 'ArrowDown' || k === 's' || k === 'S') { ui.cursor = (ui.cursor + 1) % Math.max(1, n); Sound.sfx('menu'); renderMenu(); return true; }
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { ui.cursor = (ui.cursor - 1 + n) % Math.max(1, n); Sound.sfx('menu'); renderMenu(); return true; }
    if (ui.mode === 'target' && (k === 'ArrowRight' || k === 'ArrowLeft')) { ui.cursor = (ui.cursor + (k === 'ArrowRight' ? 1 : -1) + n) % n; Sound.sfx('menu'); renderMenu(); return true; }
    if (k === 'e' || k === 'E' || k === 'PageUp' || (k === 'ArrowRight' && ui.mode !== 'target')) { setBoost(ui.boost + 1); return true; }
    if (k === 'q' || k === 'Q' || k === 'PageDown' || (k === 'ArrowLeft' && ui.mode !== 'target')) { setBoost(ui.boost - 1); return true; }
    if (['Enter', ' ', 'z', 'Z'].includes(k)) {
      const it = ui.items && ui.items[ui.cursor];
      if (it && !it.disabled) { Sound.sfx('ok'); it.act(); }
      else Sound.sfx('error');
      return true;
    }
    if (['Escape', 'Backspace', 'x', 'X'].includes(k)) { backMenu(); return true; }
    return false;
  }

  /* ── 끝 ── */
  function finish() {
    running = false;
    cancelAnimationFrame(raf);
    const res = B.over;
    if (res === 'flee') { Sound.sfx('flee'); return done('flee'); }
    if (res === 'lose') {
      Sound.play('gameover');
      showResult(`<h2 class="lose">전멸했다…</h2><p>눈앞이 캄캄해졌다.</p>`, [
        ['다시 도전', () => done('retry')],
        ['마지막 저장에서', () => done('load')],
        ['타이틀로', () => done('title')]
      ]);
      return;
    }
    const r = B.rewards;
    Sound.play('victory', App.currentMusic());
    const up = (v) => v ? ` <small class="rup">유물 +${Math.round(v * 100)}%</small>` : '';
    let html = `<h2>승리!</h2><div class="rw"><span>경험치 <b>${r.exp}</b>${up(r.expUp)}</span><span>골드 <b>${r.gold} G</b>${up(r.goldUp)}</span></div>`;
    const got = [...r.items.map(i => esc(ITEMS[i].name)), ...(r.gear || []).map(g => gearTag(g) + gearName(g))];
    if (got.length) html += `<p class="drops">얻은 것: ${got.join(', ')}</p>`;
    for (const l of r.levels) {
      html += `<p class="lvup"><img src="${Gfx.face(HEROES[l.id].spr, 22, 'f')}" alt=""><b>${HEROES[l.id].name}</b> 레벨 ${l.from} → <b>${l.to}</b>${l.learned.length ? ` · 새 기술 「${l.learned.map(s => SKILLS[s].name).join('」「')}」` : ''}</p>`;
    }
    if (r.levels.length) Sound.sfx('levelup', { delay: 500 });
    const breaks = B.log.breaks ? `<p class="small">브레이크 ${B.log.breaks}회 · 최대 피해 ${B.log.maxDmg}</p>` : '';
    showResult(html + breaks, [['계속', () => done('win')]]);
  }
  function showResult(html, buttons) {
    const box = $('bResult');
    box.innerHTML = `<div class="rbox">${html}<div class="rbtn"></div></div>`;
    const row = box.querySelector('.rbtn');
    for (const [label, fn] of buttons) {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = label;
      b.addEventListener('click', () => { Sound.sfx('ok'); fn(); });
      row.appendChild(b);
    }
    box.hidden = false;
    clearMenu();
  }
  function done(result) {
    $('bResult').hidden = true;
    running = false;
    ui = null;
    const r = resolveEnd; resolveEnd = null;
    if (r) r(result);
  }

  window.addEventListener('resize', () => { if (running) { bgKey = ''; setTimeout(placeTags, 30); } });
  document.addEventListener('DOMContentLoaded', () => {
    $('bBoostUp').addEventListener('click', () => setBoost((ui ? ui.boost : 0) + 1));
    $('bBoostDn').addEventListener('click', () => setBoost((ui ? ui.boost : 0) - 1));
  });

  return { start, key, get active() { return running; } };
})();
