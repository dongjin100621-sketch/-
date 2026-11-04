/* 루미나리아: Eight Fates — 화면 파티클 (별, 먼지빛, 꽃잎, 비, 불꽃놀이, 반짝임) */
const FX = (() => {
'use strict';
const cv = document.getElementById('fx'), g = cv.getContext('2d');
const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
let mode = null, parts = [], bursts = [], raf = 0, last = 0, W = 0, H = 0, spawn = 0;
const R = (a, b) => a + Math.random() * (b - a);
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize); resize();

const dot = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); };
const MODES = {
  stars: {
    n: 80,
    make: () => ({ x: R(0, W), y: R(0, H * .75), r: R(.4, 1.7), a: R(0, 6.28), s: R(.6, 2.2) }),
    step(p, dt) { p.a += dt * p.s; g.globalAlpha = .25 + .75 * Math.abs(Math.sin(p.a)); g.fillStyle = '#fff4d6'; dot(p.x, p.y, p.r); },
    extra(dt) { // 가끔 별똥별
      spawn -= dt;
      if (spawn <= 0) { spawn = R(3, 7); bursts.push({ k: 'meteor', x: R(W * .2, W), y: R(0, H * .3), vx: R(-520, -380), vy: R(140, 220), life: .9, t: 0 }); }
    },
  },
  motes: {
    n: 36,
    make: (init) => ({ x: R(0, W), y: init ? R(0, H) : H + 10, r: R(1, 2.8), vx: R(-6, 6), vy: R(-18, -6), a: R(0, 6.28) }),
    step(p, dt) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.a += dt;
      if (p.y < -10) Object.assign(p, MODES.motes.make(false));
      g.globalAlpha = .35 + .35 * Math.sin(p.a); g.fillStyle = '#ffe2a0'; g.shadowColor = '#ffd27a'; g.shadowBlur = 8; dot(p.x, p.y, p.r); g.shadowBlur = 0;
    },
  },
  petals: {
    n: 26,
    make: (init) => ({ x: R(-50, W), y: init ? R(0, H) : -20, s: R(4, 8), vx: R(18, 50), vy: R(30, 70), a: R(0, 6.28), va: R(-2, 2), c: Math.random() < .5 ? '#ffd9e4' : '#fff4f0' }),
    step(p, dt) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
      if (p.y > H + 20 || p.x > W + 40) Object.assign(p, MODES.petals.make(false));
      g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.scale(1, Math.abs(Math.sin(p.a * 1.3)) * .6 + .4);
      g.globalAlpha = .85; g.fillStyle = p.c; g.beginPath(); g.ellipse(0, 0, p.s, p.s * .55, 0, 0, 6.283); g.fill(); g.restore();
    },
  },
  rain: {
    n: 110,
    make: (init) => ({ x: R(-100, W), y: init ? R(0, H) : R(-80, -10), l: R(12, 26), v: R(650, 950) }),
    step(p, dt) {
      p.x += p.v * .18 * dt; p.y += p.v * dt;
      if (p.y > H) Object.assign(p, MODES.rain.make(false));
      g.globalAlpha = .35; g.strokeStyle = '#cfe0ff'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + p.l * .18, p.y + p.l); g.stroke();
    },
  },
  fireworks: {
    n: 40,
    make: () => ({ x: R(0, W), y: R(0, H * .6), r: R(.4, 1.4), a: R(0, 6.28), s: R(.5, 2) }),
    step: (p, dt) => MODES.stars.step(p, dt),
    extra(dt) {
      spawn -= dt;
      if (spawn <= 0) {
        spawn = R(.6, 1.4);
        const x = R(W * .1, W * .9), y = R(H * .08, H * .45), hue = [0, 35, 50, 200, 280, 330][Math.floor(R(0, 6))];
        const n = calm ? 16 : 42;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * 6.283, v = R(80, 190);
          bursts.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: R(1.1, 1.8), t: 0, c: `hsl(${hue + R(-15, 15)},90%,${R(60, 80)}%)`, g: 70 });
        }
      }
    },
  },
};

function frame(ts) {
  const dt = Math.min(.05, (ts - (last || ts)) / 1000); last = ts;
  g.clearRect(0, 0, W, H);
  const M = MODES[mode];
  if (M) { for (const p of parts) M.step(p, dt); if (M.extra) M.extra(dt); }
  for (const b of bursts) {
    b.t += dt;
    const k = 1 - b.t / b.life;
    if (b.k === 'meteor') {
      b.x += b.vx * dt; b.y += b.vy * dt;
      const grd = g.createLinearGradient(b.x, b.y, b.x - b.vx * .18, b.y - b.vy * .18);
      grd.addColorStop(0, `rgba(255,248,220,${k})`); grd.addColorStop(1, 'rgba(255,248,220,0)');
      g.globalAlpha = 1; g.strokeStyle = grd; g.lineWidth = 2; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * .18, b.y - b.vy * .18); g.stroke();
      continue;
    }
    b.vy += (b.g || 0) * dt; b.vx *= 1 - dt * 1.2; b.vy *= 1 - dt * 1.2; b.x += b.vx * dt; b.y += b.vy * dt;
    g.globalAlpha = Math.max(0, k); g.fillStyle = b.c;
    if (b.k === 'heart') { g.font = `${b.s}px serif`; g.fillText('♥', b.x, b.y); } else dot(b.x, b.y, b.k === 'spark' ? 1.8 : 2.4 * k + .6);
  }
  bursts = bursts.filter((b) => b.t < b.life);
  g.globalAlpha = 1;
  if (M || bursts.length) raf = requestAnimationFrame(frame); else { raf = 0; last = 0; g.clearRect(0, 0, W, H); }
}
const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

return {
  set(m) {
    if (m === mode) return;
    mode = MODES[m] ? m : null; spawn = 1;
    const M = MODES[mode];
    parts = M ? Array.from({ length: Math.round(M.n * (calm ? .4 : 1)) }, () => M.make(true)) : [];
    kick();
  },
  get mode() { return mode; },
  /* 반짝임 / 하트 터뜨리기 */
  burst(x, y, kind = 'sparkle', color = '#ffe6a8') {
    const n = calm ? 8 : kind === 'heart' ? 10 : 26;
    for (let i = 0; i < n; i++) {
      const a = R(0, 6.283), v = kind === 'heart' ? R(30, 90) : R(60, 220);
      bursts.push({ k: kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'heart' ? 60 : 0), life: R(.7, 1.3), t: 0, c: color, g: kind === 'heart' ? -20 : 40, s: R(12, 22) });
    }
    kick();
  },
};
})();
