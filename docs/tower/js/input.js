'use strict';
/* 입력: 키보드·마우스·터치(가상 조이스틱)·게임패드 */

const INPUT = (() => {
  const down = new Set(), hit = new Set();
  let edge = new Set();
  const mouse = { x: 533, y: 300, l: false, r: false, rHit: false };
  let aimMode = 'auto', lastSrc = 'key';
  let touch = false;
  const stick = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  const tb = { atk: false, dash: false, skill: false, pause: false };
  let pad = null, padPrev = {};

  function stagePos(cx, cy) {
    const st = document.getElementById('stage'), r = st.getBoundingClientRect();
    return [(cx - r.left) / (r.width / 1066), (cy - r.top) / (r.height / 600)];
  }
  function init() {
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (!down.has(k)) hit.add(k);
      down.add(k);
      if (['j', 'k', 'l', 'z', 'x', 'c'].includes(k)) lastSrc = 'key';
      SND.unlock();
    });
    window.addEventListener('keyup', (e) => down.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { down.clear(); mouse.l = mouse.r = false; });
    const cv = document.getElementById('cv');
    cv.addEventListener('mousemove', (e) => { [mouse.x, mouse.y] = stagePos(e.clientX, e.clientY); if (!touch) { aimMode = 'mouse'; lastSrc = 'mouse'; } });
    cv.addEventListener('mousedown', (e) => {
      if (touch) return;
      [mouse.x, mouse.y] = stagePos(e.clientX, e.clientY);
      aimMode = 'mouse'; lastSrc = 'mouse';
      if (e.button === 0) mouse.l = true;
      if (e.button === 2) { mouse.r = true; mouse.rHit = true; }
      SND.unlock();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    // 터치
    const tz = document.getElementById('touch');
    const zone = document.getElementById('stickZone');
    const knob = document.getElementById('stickKnob'), base = document.getElementById('stickBase');
    const useTouch = () => { if (!touch) { touch = true; document.body.classList.add('touch'); aimMode = 'auto'; } };
    window.addEventListener('touchstart', () => { useTouch(); SND.unlock(); }, { passive: true });
    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      stick.id = t.identifier; stick.ox = t.clientX; stick.oy = t.clientY; stick.dx = stick.dy = 0;
      base.style.left = (t.clientX - zone.getBoundingClientRect().left) + 'px'; base.style.top = (t.clientY - zone.getBoundingClientRect().top) + 'px';
      base.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === stick.id) {
        const R = 46;
        let dx = t.clientX - stick.ox, dy = t.clientY - stick.oy;
        const l = Math.hypot(dx, dy);
        if (l > R) { dx *= R / l; dy *= R / l; }
        stick.dx = dx / R; stick.dy = dy / R;
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
    }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === stick.id) { stick.id = null; stick.dx = stick.dy = 0; base.classList.remove('on'); } };
    zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
    const btn = (id, key, hold) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); tb[key] = true; if (!hold) edge.add('t' + key); el.classList.add('on'); }, { passive: false });
      const up = (e) => { e.preventDefault(); tb[key] = false; el.classList.remove('on'); };
      el.addEventListener('touchend', up); el.addEventListener('touchcancel', up);
    };
    btn('tAtk', 'atk', true); btn('tDash', 'dash'); btn('tSkill', 'skill'); btn('tPause', 'pause');
    void tz;
  }
  function poll() {
    edge = new Set([...hit, ...edge]);
    hit.clear();
    // 게임패드
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    pad = null;
    for (const g of gps) if (g && g.connected) { pad = g; break; }
    if (pad) {
      const b = (i) => pad.buttons[i] && pad.buttons[i].pressed;
      for (const [i, name] of [[0, 'pa'], [1, 'pb'], [2, 'px'], [9, 'pstart'], [5, 'prb'], [4, 'plb']]) { if (b(i) && !padPrev[i]) edge.add(name); padPrev[i] = b(i); }
    }
  }
  const consume = (k) => { if (edge.has(k)) { edge.delete(k); return true; } return false; };
  const any = (...ks) => ks.some(k => down.has(k));

  function state(w) {
    const p = w.player;
    let mx = 0, my = 0;
    if (any('a', 'arrowleft')) mx -= 1;
    if (any('d', 'arrowright')) mx += 1;
    if (any('w', 'arrowup')) my -= 1;
    if (any('s', 'arrowdown')) my += 1;
    if (stick.id !== null) { mx += stick.dx; my += stick.dy; }
    let padAim = null, padAtk = false;
    if (pad) {
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.2) { mx += ax; my += ay; }
      const rx = pad.axes[2] || 0, ry = pad.axes[3] || 0;
      if (Math.hypot(rx, ry) > 0.35) { padAim = Math.atan2(ry, rx); padAtk = true; }
      if (pad.buttons[7] && pad.buttons[7].pressed) padAtk = true;
    }
    const keyAtk = any('j', 'z');
    let attack = keyAtk || mouse.l || tb.atk || padAtk;
    const dash = consume(' ') || consume('shift') || consume('l') || consume('c') || consume('tdash') || consume('pa') || consume('prb');
    const skill = consume('k') || consume('x') || consume('tskill') || consume('px') || consume('plb') || (mouse.rHit && !(mouse.rHit = false));
    mouse.rHit = false;
    // 조준
    let aim = null, mode = 'auto';
    const cam = G.cam;
    const wx = mouse.x + cam.x, wy = mouse.y + cam.y;
    if (padAim !== null) { aim = padAim; mode = 'pad'; }
    else if (aimMode === 'mouse' && lastSrc === 'mouse' && !touch) { aim = Math.atan2(wy - (p.y - 16), wx - p.x); mode = 'mouse'; }
    else {
      const e = ENT.nearestEnemy(p.x, p.y, 460, true) || ENT.nearestEnemy(p.x, p.y, 300);
      if (e) aim = Math.atan2(e.y - e.h * 0.4 - (e.fly || 0) - (p.y - 16), e.x - p.x);
      const auto = G.meta.settings.auto ?? touch;
      if (auto && e && U.dist(e.x, e.y, p.x, p.y) < 400) attack = true;
    }
    return { mx, my, attack, dash, skill, aim, aimMode: mode, wx, wy };
  }
  function pausePressed() { return consume('escape') || consume('p') || consume('tpause') || consume('pstart'); }
  function confirmPressed() { return consume('enter') || consume(' ') || consume('pa'); }

  return { init, poll, state, pausePressed, confirmPressed, get touch() { return touch; }, get aimMode() { return aimMode === 'mouse' && lastSrc === 'mouse' && !touch ? 'mouse' : 'auto'; }, mouse, consume };
})();
