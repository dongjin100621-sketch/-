'use strict';
/* ────────────────────────────────────────────────────────────
   도트 모션: 원본 그림 한 장을 조각내어 움직인다 (컷아웃 리그)
   · 상체: 엉덩이 축 위쪽. 숨쉬기(세로 1~2px), 몸통 흔들림
   · 하체 고정부(@u)와 두 다리(@a, @b): 엉덩이 축에서 다리를 기울여 걷기·달리기
   · 리그가 없는 그림: 위쪽 숨쉬기 + 아래쪽 천·머리카락 물결(띠 단위)
   · 전체: 발밑 기준 찌그러짐/늘어남(스프링), 기울기, 회전, 방향 전환 뒤집기
   모든 변위는 원본 픽셀 단위로 반올림해 도트 느낌을 살린다.
   ──────────────────────────────────────────────────────────── */

const POSE0 = { legA: 0, legB: 0, liftA: 0, liftB: 0, breath: 0, sway: 0, lean: 0, sx: 1, sy: 1, ox: 0, oy: 0, wave: 0, waveT: 0, waveFrom: 0.5 };

const ANIM = {
  cv: null, cx: null,
  /* 작업용 캔버스(재사용) */
  scratch(w, h) {
    if (!this.cv || this.cv.width < w || this.cv.height < h) {
      const [c, x] = makeCanvas(Math.max(w, this.cv ? this.cv.width : 0), Math.max(h, this.cv ? this.cv.height : 0));
      this.cv = c; this.cx = x;
    }
    return this.cx;
  },
  /* 한 조각을 원본 좌표계로 그린다 */
  part(cx, key, dy0) {
    const q = ATLAS[key]; if (!q) return;
    cx.drawImage(SPR.img, q[0], q[1], q[2], q[3], q[5], q[6] - dy0, q[2], q[3]);
  },
};

/* name: 스프라이트, (x, y): 발밑, o: SPR.draw 와 같은 옵션(sc, f, alpha, flash, tint, tintA, rot), P: 자세 */
SPR.pose = function (ctx, name, x, y, o = {}, P = POSE0) {
  const a = ATLAS[name]; if (!a || !SPR.img) return;
  const w = a[2], h = a[3];
  const rig = RIG[name];
  const padX = Math.ceil(h * 0.4), padY = Math.ceil(h * 0.12);
  const cw = w + padX * 2, ch = h + padY;
  const cx = ANIM.scratch(cw, ch);
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1;
  cx.clearRect(0, 0, cw, ch);
  const hy = rig ? rig[0] : Math.round(h * (P.waveFrom || 0.5));
  // 숨쉬기: 상체 높이를 정수 픽셀만큼 바꾼다
  const bpx = Math.round(hy * (P.breath || 0));
  const bs = (hy + bpx) / hy;
  let drop = 0;
  if (rig) {
    const L = h - hy;
    const ka = Math.cos(P.legA || 0) * (1 - (P.liftA || 0)), kb = Math.cos(P.legB || 0) * (1 - (P.liftB || 0));
    drop = Math.round(L * (1 - Math.max(ka, kb)));
    // 하체 고정부(가랑이 위 받침 포함)
    cx.setTransform(1, 0, 0, 1, padX, padY + drop);
    ANIM.part(cx, name + '@u', 0);
    // 두 다리: 엉덩이 축에서 기울이고(가로 밀림) 세로로 줄여(발 들기) 그린다
    const legs = [['@a', P.legA || 0, ka], ['@b', P.legB || 0, kb]];
    if ((P.legA || 0) > (P.legB || 0)) legs.reverse(); // 앞으로 나간 다리를 나중에(앞에) 그린다
    for (const [k, ang, kk] of legs) {
      const L2 = Math.round(L * kk) / L;
      cx.setTransform(1, 0, Math.tan(ang), L2, padX, padY + hy + drop);
      ANIM.part(cx, name + k, hy);
    }
    // 상체
    const sw = Math.round((P.sway || 0) * hy) / hy;
    cx.setTransform(1, 0, -sw, bs, padX, padY + hy + drop);
    cx.drawImage(SPR.img, a[0], a[1], w, hy, 0, -hy, w, hy);
  } else {
    // 상체(숨쉬기)
    const sw = Math.round((P.sway || 0) * hy) / hy;
    cx.setTransform(1, 0, -sw, bs, padX, padY + hy);
    cx.drawImage(SPR.img, a[0], a[1], w, hy, 0, -hy, w, hy);
    cx.setTransform(1, 0, 0, 1, 0, 0);
    const amp = P.wave || 0;
    if (!amp) cx.drawImage(SPR.img, a[0], a[1] + hy, w, h - hy, padX, padY + hy, w, h - hy);
    else {
      // 아래로 갈수록 크게 흔들리는 물결(3px 띠)
      const H = h - hy, band = 3;
      for (let r = 0; r < H; r += band) {
        const bh = Math.min(band, H - r), v = r / H;
        const dx = Math.round(amp * Math.pow(v, 1.3) * Math.sin(P.waveT - v * 4.2));
        cx.drawImage(SPR.img, a[0], a[1] + hy + r, w, bh, padX + dx, padY + hy + r, w, bh);
      }
    }
  }
  cx.setTransform(1, 0, 0, 1, 0, 0);
  // 화면에 옮긴다: 발밑 기준으로 뒤집기 → 크기 → 찌그러짐 → 기울기
  const sc = o.sc || 1, flip = (o.f || 1) !== a[4];
  const put = (alpha) => {
    ctx.save();
    ctx.translate(Math.round(x + (P.ox || 0) * sc * (o.f || 1)), Math.round(y + (P.oy || 0) * sc));
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale((flip ? -1 : 1) * sc * (P.sx || 1), sc * (P.sy || 1));
    if (P.lean) ctx.transform(1, 0, -P.lean, 1, 0, 0);
    ctx.globalAlpha *= alpha;
    ctx.drawImage(ANIM.cv, 0, 0, cw, ch, -padX - w / 2, -ch, cw, ch);
    ctx.restore();
  };
  const alpha = o.alpha ?? 1;
  put(alpha);
  if (o.tint || o.flash > 0) {
    cx.globalCompositeOperation = 'source-atop';
    if (o.tint) { cx.fillStyle = o.tint; cx.fillRect(0, 0, cw, ch); put(alpha * (o.tintA || 0.35)); }
    if (o.flash > 0) { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cw, ch); put(alpha * o.flash); }
    cx.globalCompositeOperation = 'source-over';
  }
};

/* ── 움직임 상태: 개체마다 하나. 속도를 스스로 재고, 스프링으로 찌그러짐을 되돌린다 ── */
class Animator {
  constructor(seed = Math.random() * 10) {
    this.t = seed; this.last = null; this.px = null; this.vx = 0; this.vy = 0;
    this.ph = 0; this.amp = 0; this.lean = 0; this.sq = 0; this.sqv = 0;
    this.f = 0; this.turn = 0; this.kick = 0; this.lunge = 0; this.prev = null; this.ghost = 0;
    this.P = { ...POSE0 };
  }
  /* now: 경과 시간(초), x·y: 현재 위치. dt 를 돌려준다 */
  tick(now, x, y) {
    let dt = this.last == null ? 1 / 60 : now - this.last; this.last = now;
    dt = clamp(dt, 0, 0.05);
    this.t += dt;
    if (x != null) {
      if (this.px != null && dt > 0) { this.vx = lerp(this.vx, (x - this.px) / dt, Math.min(1, dt * 18)); this.vy = lerp(this.vy, (y - this.py) / dt, Math.min(1, dt * 18)); }
      this.px = x; this.py = y;
    }
    // 찌그러짐 스프링 (sq>0 위로 늘어남, sq<0 납작)
    this.sqv += (-260 * this.sq - 15 * this.sqv) * dt; this.sq += this.sqv * dt;
    this.kick = Math.max(0, this.kick - dt * 6);
    this.lunge = Math.max(0, this.lunge - dt * 7);
    this.ghost = Math.max(0, this.ghost - dt);
    if (this.turn > 0) this.turn = Math.max(0, this.turn - dt);
    this.dt = dt;
    return dt;
  }
  bump(v) { this.sqv += v; }
  /* 방향이 바뀌면 짧게 납작해졌다가 돌아선다 */
  face(f) {
    if (this.f && f !== this.f) this.turn = 0.09;
    this.f = f;
    if (this.turn <= 0) return [f, 1];
    const p = 1 - this.turn / 0.09;
    return [p < 0.5 ? -f : f, Math.max(0.35, Math.abs(Math.cos(p * Math.PI)))];
  }
  /* 자세 초기화 + 공통 값 */
  begin() {
    const P = this.P; Object.assign(P, POSE0);
    const s = clamp(this.sq, -0.22, 0.22);
    P.sy = 1 + s; P.sx = 1 - s * 0.7;
    return P;
  }
  breathe(P, k = 1, speed = 2.3) {
    // 들숨은 천천히, 날숨은 빠르게 (사인을 비틀어 자연스럽게)
    const s = Math.sin(this.t * speed); P.breath = 0.014 * k * (s > 0 ? s : s * 0.7);
    P.sway = 0.004 * k * Math.sin(this.t * speed * 0.5 + 1);
  }
  /* 걷기·달리기: 이동 거리에 맞춰 발을 내딛는다 (8컷 주기로 끊어 도트 느낌) */
  walk(P, speed, stride, maxAmp, frames = 8) {
    const target = Math.min(1, speed / stride.full) * maxAmp;
    this.amp = lerp(this.amp, speed > 15 ? target : 0, Math.min(1, this.dt * (speed > 15 ? 10 : 7)));
    if (speed > 15) this.ph = (this.ph + speed * this.dt / stride.len) % 1;
    else if (this.amp < 0.03) this.ph = 0;
    const q = Math.floor(this.ph * frames) / frames;
    const s = Math.sin(q * Math.PI * 2), c = Math.cos(q * Math.PI * 2);
    // 비스듬히 선 그림이라 안쪽(다리끼리 겹치는 쪽)으로는 덜 움직여 가위처럼 꼬이지 않게 한다
    P.legA = this.amp * s * (s > 0 ? 0.4 : 1); P.legB = -this.amp * s * (s < 0 ? 0.4 : 1);
    P.liftA = Math.max(0, c) * this.amp * 0.32; P.liftB = Math.max(0, -c) * this.amp * 0.32;
    // 발이 모이는 순간 몸이 살짝 떠오르고, 몸통은 걸음에 맞춰 흔들린다
    P.sway += this.amp * 0.035 * Math.abs(s) - this.amp * 0.012;
    return this.amp;
  }
}
