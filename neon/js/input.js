'use strict';
/* 입력: 왼쪽 조이스틱(위로 밀면 점프), 오른쪽 공격·스킬·아이템 버튼, 키보드 */
const LAYOUT = {
  stick: { x: 186, y: 642, r: 96 },
  atk: { x: 1160, y: 686, r: 80 },
  sk: { atk: { x: 1000, y: 664, r: 46 }, util: { x: 1040, y: 560, r: 46 }, ult: { x: 1158, y: 510, r: 54 } },
  item: { x: 918, y: 742, r: 38 },
  menu: [
    { k: 'inv', n: '가방', ic: '▣' }, { k: 'stat', n: '능력', ic: '✦' }, { k: 'quest', n: '퀘스트', ic: '❖' },
    { k: 'map', n: '지도', ic: '◎' }, { k: 'opt', n: '설정', ic: '≡' },
  ],
  menuX(i) { return VW - 16 - (5 - i) * 70 + 4; }, menuY: 12, menuW: 62, menuH: 62,
  mini: { x: 16, y: 112, w: 312, h: 100 },
};
const INPUT = {
  mx: 0, my: 0, atk: false, jumpPressed: false, skill: null, item: false, interact: false,
  stick: null, keys: {}, atkPid: null, upLatch: false, pressed: {},
  init(stage) {
    this.stage = stage;
    const pt = (e) => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH]; };
    const cv = document.getElementById('cv');
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); SND.init(); const [x, y] = pt(e); this.down(e.pointerId, x, y); try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
    cv.addEventListener('pointermove', (e) => { const [x, y] = pt(e); this.move(e.pointerId, x, y); });
    const up = (e) => this.up(e.pointerId);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => { this.keys = {}; this.atk = false; this.stick = null; });
  },
  hit(x, y, b, k = 1.15) { return Math.hypot(x - b.x, y - b.y) < b.r * k; },
  down(id, x, y) {
    if (!G.started || UI.dialogOpen || G.menuOpen) return;
    const L = LAYOUT;
    for (let i = 0; i < L.menu.length; i++) { const mx = L.menuX(i); if (x > mx && x < mx + L.menuW && y > L.menuY && y < L.menuY + L.menuH) { SND.play('ui'); UI.open(L.menu[i].k); return; } }
    if (x > L.mini.x && x < L.mini.x + L.mini.w && y > L.mini.y && y < L.mini.y + L.mini.h) { SND.play('ui'); UI.open('map'); return; }
    const bb = HUD.bubble; if (bb && x > bb.x && x < bb.x + bb.w && y > bb.y && y < bb.y + bb.h) { this.interact = true; return; }
    if (this.hit(x, y, L.atk)) { this.pressAtk(id); return; }
    for (const k of ['atk', 'util', 'ult']) if (this.hit(x, y, L.sk[k])) { this.skill = k; this.pressed[k] = 0.15; return; }
    if (this.hit(x, y, L.item)) { this.item = true; this.pressed.item = 0.15; return; }
    if (x < VW * 0.5 && y > 220 && !this.stick) { this.stick = { id, ox: x, oy: y, x, y }; this.upLatch = false; return; }
  },
  pressAtk(id) {
    const P = G.P;
    if (G.near && !G.enemies.some((e) => !e.dead && Math.abs(e.x - P.x) < 520)) { this.interact = true; this.pressed.atk = 0.15; return; }
    this.atk = true; this.atkPid = id;
  },
  move(id, x, y) {
    const s = this.stick; if (!s || s.id !== id) return;
    s.x = x; s.y = y;
  },
  up(id) {
    if (this.stick && this.stick.id === id) this.stick = null;
    if (this.atkPid === id) { this.atk = false; this.atkPid = null; }
  },
  key(e, d) {
    const k = e.key.toLowerCase();
    if (d && (UI.dialogOpen || G.menuOpen)) { UI.key(k, e); return; }
    if (!G.started) { if (d && (k === 'enter' || k === ' ')) UI.titleKey(); return; }
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
    const was = this.keys[k]; this.keys[k] = d;
    if (!d || was) { if (!d && (k === 'z' || k === 'j')) this.atk = false; return; }
    SND.init();
    if (k === ' ' || k === 'w' || k === 'arrowup') this.jumpPressed = true;
    if (k === 'z' || k === 'j') { const P = G.P; if (G.near && !G.enemies.some((e) => !e.dead && Math.abs(e.x - P.x) < 520)) this.interact = true; else this.atk = true; }
    if (k === 'x' || k === 'k') this.skill = 'atk';
    if (k === 'c' || k === 'l') this.skill = 'util';
    if (k === 'v' || k === 'u') this.skill = 'ult';
    if (k === 'q') this.item = true;
    if (k === 'e' || k === 'f' || k === 'enter') this.interact = true;
    if (k === 'i' || k === 'b') UI.open('inv');
    if (k === 'p') UI.open('stat');
    if (k === 't' || k === 'tab') UI.open('quest');
    if (k === 'm') UI.open('map');
    if (k === 'escape') UI.open('opt');
  },
  frame() {
    // 조이스틱 → 이동 값
    const s = this.stick, L = LAYOUT.stick;
    let mx = 0, my = 0;
    if (s) {
      const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), m = Math.min(1, d / L.r);
      if (d > 8) { mx = dx / d * m; my = dy / d * m; }
      if (my < -0.55 && !this.upLatch) { this.upLatch = true; this.jumpPressed = true; }
      if (my > -0.3) this.upLatch = false;
    }
    const K = this.keys;
    if (K.a || K.arrowleft) mx = -1; if (K.d || K.arrowright) mx = 1;
    if (K.s || K.arrowdown) my = 1;
    this.mx = mx; this.my = my;
    for (const k in this.pressed) if ((this.pressed[k] -= 1 / 60) <= 0) delete this.pressed[k];
  },
};
