'use strict';
/* 피아노 롤 / 드럼 그리드 편집기 (캔버스 하나에 그린다) */
(function (S) {
  const T = S.theory, SG = S.song;
  const { PPQ, BAR } = T;
  const HI = 108, LO = 21; // C8 ~ A0
  const KEYW = 64, RULER = 22, CHORD = 26;

  class Roll {
    constructor(canvas, app) {
      this.cv = canvas; this.app = app;
      this.g = canvas.getContext('2d');
      this.ppt = 72 / PPQ;          // 한 틱당 픽셀(박 하나 72px)
      this.rowH = 16;               // 건반 한 줄 높이
      this.drumRowH = 34;
      this.sx = 0; this.sy = 0;     // 스크롤(px)
      this.sel = new Set();
      this.op = null;
      this.pointers = new Map();
      this.hover = null;
      this.dirty = true;
      this.colors = {};
      this.w = 0; this.h = 0; this.dpr = 1;
      this.readColors();
      new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
      this.bind();
      this.resize();
      this.centerOn(66);
      const loop = () => {
        requestAnimationFrame(loop);
        if (this.dirty || this.app.player.playing) { try { this.draw(); } catch (e) { console.error(e); } }
      };
      requestAnimationFrame(loop);
    }

    /* ---------- 좌표 ---------- */
    get drum() { return this.app.track && this.app.track.type === 'drums'; }
    get rh() { return this.drum ? this.drumRowH : this.rowH; }
    get rows() { return this.drum ? SG.DRUMS.length : HI - LO + 1; }
    get top() { return RULER + CHORD; }
    get velH() { return this.app.ui.showVel ? Math.min(90, Math.max(56, this.h * 0.16)) : 0; }
    get gridBottom() { return this.h - this.velH; }
    get gridH() { return this.gridBottom - this.top; }
    get gridW() { return this.w - KEYW; }
    rowOf(p) { return this.drum ? p : HI - p; }
    pitchOf(r) { return this.drum ? r : HI - r; }
    tx(t) { return KEYW + t * this.ppt - this.sx; }
    xt(x) { return (x - KEYW + this.sx) / this.ppt; }
    ry(r) { return this.top + r * this.rh - this.sy; }
    yr(y) { return Math.floor((y - this.top + this.sy) / this.rh); }
    contentTicks() {
      const s = this.app.song;
      let end = s.bars * BAR;
      for (const tr of s.tracks) for (const n of tr.notes) end = Math.max(end, n.t + n.d);
      return end + BAR * 2;
    }
    clampScroll() {
      if (!this.app.song) return;
      const maxX = Math.max(0, this.contentTicks() * this.ppt - this.gridW);
      const maxY = Math.max(0, this.rows * this.rh - this.gridH);
      this.sx = Math.min(maxX, Math.max(0, this.sx));
      this.sy = Math.min(maxY, Math.max(0, this.sy));
    }
    centerOn(pitch) {
      if (this.drum) { this.sy = 0; this.requestDraw(); return; }
      this.sy = this.rowOf(pitch) * this.rh - this.gridH / 2;
      this.clampScroll(); this.requestDraw();
    }
    /** 트랙의 음표들이 보이게 세로 위치를 맞춘다 */
    fitTrack() {
      const tr = this.app.track;
      if (!tr || this.drum || !tr.notes.length) { this.centerOn(this.drum ? 0 : 64); return; }
      let lo = 127, hi = 0;
      for (const n of tr.notes) { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); }
      this.centerOn(Math.round((lo + hi) / 2));
    }
    zoomX(f, anchorX) {
      const ax = anchorX == null ? KEYW + this.gridW / 2 : anchorX;
      const t = this.xt(ax);
      this.ppt = Math.min(1.6, Math.max(0.06, this.ppt * f));
      this.sx = t * this.ppt - (ax - KEYW);
      this.clampScroll(); this.requestDraw();
    }
    zoomY(f) {
      if (this.drum) { this.drumRowH = Math.min(60, Math.max(22, this.drumRowH * f)); }
      else {
        const mid = this.yr(this.top + this.gridH / 2);
        this.rowH = Math.min(30, Math.max(8, this.rowH * f));
        this.sy = mid * this.rowH - this.gridH / 2;
      }
      this.clampScroll(); this.requestDraw();
    }
    requestDraw() { this.dirty = true; }

    resize() {
      const r = this.cv.parentElement.getBoundingClientRect();
      this.dpr = Math.min(3, window.devicePixelRatio || 1);
      this.w = Math.max(100, Math.floor(r.width)); this.h = Math.max(120, Math.floor(r.height));
      this.cv.width = this.w * this.dpr; this.cv.height = this.h * this.dpr;
      this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px';
      this.clampScroll(); this.requestDraw();
    }
    readColors() {
      const cs = getComputedStyle(document.documentElement);
      const v = (n) => cs.getPropertyValue(n).trim();
      this.colors = {
        bg: v('--roll-bg'), alt: v('--roll-alt'), black: v('--roll-black'), line: v('--roll-line'), beat: v('--roll-beat'), bar: v('--roll-bar'),
        ink: v('--ink'), muted: v('--muted'), accent: v('--accent'), panel: v('--panel'), panel2: v('--panel-2'),
        keyW: v('--key-white'), keyB: v('--key-black'), loop: v('--loop'), sel: v('--sel'), head: v('--playhead'),
      };
      this.requestDraw();
    }

    /* ---------- 그리기 ---------- */
    draw() {
      this.dirty = false;
      if (!this.app.song) return;
      const g = this.g, C = this.colors, app = this.app, song = app.song, tr = app.track;
      const W = this.w, H = this.h, top = this.top, gb = this.gridBottom, rh = this.rh;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
      if (!tr) return;
      this.clampScroll();
      const t0 = Math.max(0, this.xt(KEYW)), t1 = this.xt(W);
      const r0 = Math.max(0, this.yr(top)), r1 = Math.min(this.rows - 1, this.yr(gb));
      const end = song.bars * BAR;

      // 줄 바탕
      g.save(); g.beginPath(); g.rect(KEYW, top, W - KEYW, gb - top); g.clip();
      for (let r = r0; r <= r1; r++) {
        const y = this.ry(r);
        if (this.drum) { g.fillStyle = r % 2 ? C.alt : C.bg; g.fillRect(KEYW, y, W, rh); }
        else {
          const p = this.pitchOf(r);
          const black = [1, 3, 6, 8, 10].includes(p % 12);
          const inS = T.inScale(p, song.key, song.scale);
          g.fillStyle = !inS ? C.black : black ? C.alt : C.bg;
          if (!inS || black) g.fillRect(KEYW, y, W, rh);
          if (T.mod12(p - song.key) === 0) { g.fillStyle = C.line; g.fillRect(KEYW, y + rh - 1, W, 1); }
        }
      }
      // 화음 음 줄 강조
      if (!this.drum && app.ui.chordTones) {
        const b0 = Math.floor(t0 / BAR), b1 = Math.min(song.bars - 1, Math.floor(t1 / BAR));
        g.fillStyle = hexA(tr.color, 0.09);
        for (let b = b0; b <= b1; b++) {
          const ch = song.chords[b]; if (!ch) continue;
          const pcs = T.chordPcs(ch);
          const x0 = this.tx(b * BAR), x1 = this.tx((b + 1) * BAR);
          for (let r = r0; r <= r1; r++) if (pcs.includes(T.mod12(this.pitchOf(r)))) g.fillRect(x0, this.ry(r), x1 - x0, rh);
        }
      }
      // 곡 끝 뒤는 어둡게
      const ex = this.tx(end);
      if (ex < W) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(Math.max(KEYW, ex), top, W, gb - top); }
      // 루프 구간
      if (song.loop.on) {
        g.fillStyle = C.loop; g.globalAlpha = 0.12;
        g.fillRect(this.tx(song.loop.start), top, (song.loop.end - song.loop.start) * this.ppt, gb - top);
        g.globalAlpha = 1;
      }
      // 세로 격자
      this.vlines(g, t0, t1, top, gb, true);
      // 가로 선(드럼)
      if (this.drum) { g.fillStyle = C.line; for (let r = r0; r <= r1 + 1; r++) g.fillRect(KEYW, this.ry(r), W, 1); }

      // 다른 트랙 그림자
      if (app.ui.ghost && !this.drum) {
        for (const o of song.tracks) {
          if (o === tr || o.type === 'drums') continue;
          g.fillStyle = hexA(o.color, 0.22);
          for (const n of o.notes) {
            if (n.t > t1 || n.t + n.d < t0) continue;
            const r = this.rowOf(n.p); if (r < r0 || r > r1) continue;
            g.fillRect(this.tx(n.t), this.ry(r) + 2, Math.max(2, n.d * this.ppt - 1), rh - 4);
          }
        }
      }
      // 음표
      const showName = !this.drum && rh >= 12;
      g.font = `600 ${Math.min(11, rh - 4)}px system-ui, sans-serif`; g.textBaseline = 'middle';
      for (const n of tr.notes) {
        if (n.t > t1 || n.t + n.d < t0) continue;
        const r = this.rowOf(n.p); if (r < r0 || r > r1) continue;
        const x = this.tx(n.t), y = this.ry(r);
        const w = Math.max(this.drum ? 6 : 3, n.d * this.ppt - 1);
        const sel = this.sel.has(n);
        g.fillStyle = hexA(tr.color, 0.45 + 0.55 * n.v);
        roundRect(g, x + 0.5, y + 1.5, w - 1, rh - 3, Math.min(4, rh / 4));
        g.fill();
        if (sel) { g.strokeStyle = C.sel; g.lineWidth = 2; g.stroke(); }
        else { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke(); }
        if (showName && w > 30) { g.fillStyle = 'rgba(0,0,0,.72)'; g.fillText(T.noteName(n.p), x + 5, y + rh / 2 + 0.5); }
      }
      // 상자 선택
      if (this.op && this.op.kind === 'box') {
        const o = this.op;
        g.fillStyle = hexA(C.sel, 0.12); g.strokeStyle = C.sel; g.lineWidth = 1;
        const x = Math.min(o.x0, o.x1), y = Math.min(o.y0, o.y1);
        g.fillRect(x, y, Math.abs(o.x1 - o.x0), Math.abs(o.y1 - o.y0));
        g.strokeRect(x + 0.5, y + 0.5, Math.abs(o.x1 - o.x0), Math.abs(o.y1 - o.y0));
      }
      // 마우스가 놓인 칸
      if (this.hover && !this.op && app.tool === 'pen') {
        const { t, r } = this.hover;
        if (r >= 0 && r < this.rows) {
          const st = this.snapT(t);
          g.strokeStyle = hexA(tr.color, 0.7); g.setLineDash([3, 3]); g.lineWidth = 1;
          g.strokeRect(this.tx(st) + 0.5, this.ry(r) + 1.5, Math.max(4, (this.drum ? app.snapTicks() : app.lastLen) * this.ppt - 1), rh - 3);
          g.setLineDash([]);
        }
      }
      g.restore();

      // 벨로시티 레인
      if (this.velH) this.drawVel(g, t0, t1);
      // 위: 마디 자, 코드 레인
      this.drawRuler(g, t0, t1);
      // 왼쪽: 건반 / 드럼 이름
      this.drawKeys(g, r0, r1);
      // 재생 위치
      const ph = app.player.now();
      const px = this.tx(ph);
      if (px >= KEYW && px <= W) {
        g.fillStyle = C.head; g.fillRect(Math.round(px) - 1, 0, 2, gb);
        g.beginPath(); g.moveTo(px - 6, 0); g.lineTo(px + 6, 0); g.lineTo(px, 8); g.fill();
      }
      if (app.player.playing && app.ui.follow && !this.op) {
        if (px > W - 40 || px < KEYW) { this.sx = Math.max(0, ph * this.ppt - this.gridW * 0.1); }
      }
      // 왼쪽 위 모서리
      g.fillStyle = C.panel; g.fillRect(0, 0, KEYW, top);
      g.fillStyle = C.muted; g.font = '600 11px system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
      g.fillText('마디', KEYW / 2, RULER / 2 + 1); g.fillText('코드', KEYW / 2, RULER + CHORD / 2);
      g.textAlign = 'left';
      if (this.velH) { g.fillStyle = C.panel; g.fillRect(0, gb, KEYW, this.velH); g.fillStyle = C.muted; g.textAlign = 'center'; g.fillText('세기', KEYW / 2, gb + this.velH / 2); g.textAlign = 'left'; }
    }
    vlines(g, t0, t1, y0, y1, withSnap) {
      const C = this.colors;
      const snap = this.app.snapTicks();
      const step = withSnap && snap * this.ppt >= 7 ? snap : (PPQ * this.ppt >= 7 ? PPQ : BAR);
      for (let t = Math.floor(t0 / step) * step; t <= t1; t += step) {
        const x = Math.round(this.tx(t));
        g.fillStyle = t % BAR === 0 ? C.bar : t % PPQ === 0 ? C.beat : C.line;
        g.fillRect(x, y0, 1, y1 - y0);
      }
    }
    drawRuler(g, t0, t1) {
      const C = this.colors, song = this.app.song, W = this.w;
      g.fillStyle = C.panel; g.fillRect(KEYW, 0, W, RULER);
      g.fillStyle = C.panel2; g.fillRect(KEYW, RULER, W, CHORD);
      if (song.loop.on || (this.op && this.op.kind === 'loop')) {
        const lp = this.op && this.op.kind === 'loop' ? this.op : song.loop;
        g.fillStyle = C.loop; g.globalAlpha = song.loop.on ? 0.85 : 0.4;
        g.fillRect(this.tx(lp.start), 2, (lp.end - lp.start) * this.ppt, RULER - 4);
        g.globalAlpha = 1;
      }
      g.font = '600 11px system-ui, sans-serif'; g.textBaseline = 'middle';
      const barPx = BAR * this.ppt;
      const every = barPx < 26 ? 8 : barPx < 44 ? 4 : barPx < 70 ? 2 : 1;
      for (let b = Math.floor(t0 / BAR); b * BAR <= t1; b++) {
        const x = Math.round(this.tx(b * BAR));
        g.fillStyle = C.bar; g.fillRect(x, 0, 1, RULER + CHORD);
        if (b % every === 0) { g.fillStyle = b < song.bars ? C.ink : C.muted; g.fillText(String(b + 1), x + 4, RULER / 2 + 1); }
        if (barPx > 40) {
          g.fillStyle = C.beat;
          for (let k = 1; k < 4; k++) g.fillRect(Math.round(this.tx(b * BAR + k * PPQ)), RULER - 5, 1, 5);
        }
        // 코드
        if (b < song.bars) {
          const ch = song.chords[b];
          const flats = T.prefersFlats(song.key, song.scale);
          if (ch) {
            g.fillStyle = C.ink; g.font = '700 12px system-ui, sans-serif';
            const name = T.chordName(ch, flats);
            const rn = T.roman(ch, song.key, song.scale);
            g.fillText(barPx > 34 ? name : name.slice(0, 2), x + 5, RULER + CHORD / 2 + 1);
            if (rn && barPx > 90) { const w = g.measureText(name).width; g.fillStyle = C.muted; g.font = '600 10px system-ui, sans-serif'; g.fillText(rn, x + 10 + w, RULER + CHORD / 2 + 1); }
            g.font = '600 11px system-ui, sans-serif';
          } else if (barPx > 40) { g.fillStyle = C.muted; g.fillText('+', x + 6, RULER + CHORD / 2 + 1); }
        }
      }
      g.fillStyle = C.line; g.fillRect(KEYW, RULER + CHORD - 1, W, 1);
    }
    drawKeys(g, r0, r1) {
      const C = this.colors, app = this.app, rh = this.rh, top = this.top, gb = this.gridBottom;
      g.save(); g.beginPath(); g.rect(0, top, KEYW, gb - top); g.clip();
      g.fillStyle = C.panel; g.fillRect(0, top, KEYW, gb - top);
      g.font = `600 ${this.drum ? 12 : Math.min(11, rh - 3)}px system-ui, sans-serif`; g.textBaseline = 'middle';
      for (let r = r0; r <= r1; r++) {
        const y = this.ry(r), p = this.pitchOf(r);
        const held = app.held.has(p) && app.track;
        if (this.drum) {
          g.fillStyle = held ? hexA(app.track.color, 0.5) : r % 2 ? C.panel2 : C.panel;
          g.fillRect(0, y, KEYW, rh);
          g.fillStyle = C.ink; g.fillText(SG.DRUMS[r].name, 6, y + rh / 2);
          g.fillStyle = C.line; g.fillRect(0, y, KEYW, 1);
        } else {
          const black = [1, 3, 6, 8, 10].includes(p % 12);
          g.fillStyle = held ? app.track.color : black ? C.keyB : C.keyW;
          g.fillRect(0, y, black ? KEYW * 0.62 : KEYW, rh);
          if (black) { g.fillStyle = C.keyW; g.fillRect(KEYW * 0.62, y, KEYW * 0.38, rh); }
          g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y + rh - 1, KEYW, 1);
          if (p % 12 === 0 || (rh >= 14 && T.mod12(p - app.song.key) === 0)) {
            g.fillStyle = '#333'; g.fillText(T.noteName(p), KEYW - 30, y + rh / 2 + 0.5);
          }
          if (T.inScale(p, app.song.key, app.song.scale) && app.song.scale !== 'chromatic') {
            g.fillStyle = hexA(C.accent, 0.9); g.fillRect(KEYW - 4, y + 2, 3, rh - 4);
          }
        }
      }
      g.restore();
      g.fillStyle = C.line; g.fillRect(KEYW - 1, top, 1, gb - top);
    }
    drawVel(g, t0, t1) {
      const C = this.colors, tr = this.app.track, y0 = this.gridBottom, h = this.velH, W = this.w;
      g.fillStyle = C.panel2; g.fillRect(KEYW, y0, W, h);
      g.fillStyle = C.line; g.fillRect(KEYW, y0, W, 1);
      g.save(); g.beginPath(); g.rect(KEYW, y0, W - KEYW, h); g.clip();
      this.vlines(g, t0, t1, y0, y0 + h, false);
      for (const n of tr.notes) {
        if (n.t > t1 || n.t < t0 - PPQ) continue;
        const x = this.tx(n.t), vh = (h - 8) * n.v;
        const sel = this.sel.has(n);
        g.fillStyle = sel ? C.sel : hexA(tr.color, 0.85);
        g.fillRect(x, y0 + h - vh - 2, 3, vh);
        g.fillRect(x - 2, y0 + h - vh - 3, 7, 3);
      }
      g.restore();
    }

    /* ---------- 찾기 ---------- */
    snapT(t) { const s = this.app.snapTicks(); return Math.max(0, Math.floor(t / s) * s); }
    noteAt(x, y) {
      const tr = this.app.track; if (!tr) return null;
      const t = this.xt(x), r = this.yr(y), p = this.pitchOf(r);
      let hit = null;
      for (const n of tr.notes) {
        if (n.p !== p) continue;
        const w = Math.max(this.drum ? 6 : 3, n.d * this.ppt) / this.ppt;
        if (t >= n.t && t < n.t + w) hit = n; // 뒤에 그린(위에 보이는) 음표가 이긴다
      }
      return hit;
    }
    zone(e) {
      const x = e.offsetX, y = e.offsetY;
      if (y < RULER && x >= KEYW) return 'ruler';
      if (y < this.top && x >= KEYW) return 'chord';
      if (y < this.top) return 'corner';
      if (y >= this.gridBottom) return x >= KEYW ? 'vel' : 'corner';
      if (x < KEYW) return 'keys';
      return 'grid';
    }

    /* ---------- 입력 ---------- */
    bind() {
      const cv = this.cv;
      cv.addEventListener('pointerdown', (e) => this.down(e));
      cv.addEventListener('pointermove', (e) => this.move(e));
      cv.addEventListener('pointerup', (e) => this.up(e));
      cv.addEventListener('pointercancel', (e) => this.up(e, true));
      cv.addEventListener('pointerleave', () => { if (this.hover) { this.hover = null; this.requestDraw(); } });
      cv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (this.zone(e) !== 'grid') return;
        const n = this.noteAt(e.offsetX, e.offsetY);
        if (n) { this.removeNotes([n]); this.app.commit('음표 지우기'); }
      });
      cv.addEventListener('dblclick', (e) => {
        if (this.zone(e) !== 'grid' || this.drum) return;
        const n = this.noteAt(e.offsetX, e.offsetY);
        if (n && this.app.tool !== 'erase') { this.removeNotes([n]); this.app.commit('음표 지우기'); }
      });
      cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.h : 1;
        const dx = e.deltaX * k, dy = e.deltaY * k;
        if (e.ctrlKey || e.metaKey) { this.zoomX(Math.exp(-dy * 0.0025), e.offsetX); return; }
        if (e.altKey) { this.zoomY(Math.exp(-dy * 0.002)); return; }
        if (e.shiftKey && !dx) this.sx += dy; else { this.sx += dx; this.sy += dy; }
        this.clampScroll(); this.requestDraw();
      }, { passive: false });
    }
    pt(e) { return { x: e.offsetX, y: e.offsetY }; }

    down(e) {
      const app = this.app;
      if (!app.track) return;
      this.cv.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, this.pt(e));
      // 두 손가락: 이동/확대
      if (e.pointerType === 'touch' && this.pointers.size === 2) {
        this.cancelOp();
        const [a, b] = [...this.pointers.values()];
        this.op = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ppt0: this.ppt, sx0: this.sx, sy0: this.sy };
        return;
      }
      if (this.pointers.size > 1) return;
      const z = this.zone(e), x = e.offsetX, y = e.offsetY;
      if (e.button === 1 || (app.tool === 'hand' && z === 'grid')) {
        this.op = { kind: 'pan', x0: x, y0: y, sx0: this.sx, sy0: this.sy }; return;
      }
      if (e.button === 2) return;
      const t = this.xt(x);
      if (z === 'ruler') { this.op = { kind: 'ruler', x0: x, t0: t, start: 0, end: 0 }; return; }
      if (z === 'chord') { app.openChordPicker(Math.floor(t / BAR), e.clientX, e.clientY); return; }
      if (z === 'keys') {
        const r = this.yr(y); if (r < 0 || r >= this.rows) return;
        const p = this.pitchOf(r); app.liveOn(p, 0.8, true); this.op = { kind: 'key', p }; return;
      }
      if (z === 'vel') { this.op = { kind: 'vel', changed: false }; this.velAt(x, y); return; }
      if (z !== 'grid') return;

      const r = this.yr(y);
      if (r < 0 || r >= this.rows) return;
      const tool = app.tool;
      const hit = this.noteAt(x, y);
      const touch = e.pointerType === 'touch';
      if (tool === 'erase') { this.op = { kind: 'erase', changed: false }; this.eraseAt(x, y); return; }
      if (this.drum && tool === 'pen' && !e.shiftKey) {
        const mode = hit ? 'remove' : 'add';
        this.op = { kind: 'paint', mode, changed: false, done: new Set(), t0: Date.now() };
        this.paintAt(x, y);
        return;
      }
      if (hit) {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          if (this.sel.has(hit)) this.sel.delete(hit); else this.sel.add(hit);
          app.onSelection(); this.requestDraw();
          if (!this.sel.has(hit)) return;
        } else if (!this.sel.has(hit)) { this.sel = new Set([hit]); app.onSelection(); }
        const edge = this.tx(hit.t + hit.d);
        const ez = touch ? 14 : 7;
        const resize = !this.drum && x > edge - ez && (hit.d * this.ppt > ez * 1.6 || x > edge - 4);
        const notes = [...this.sel];
        const orig = notes.map((n) => ({ t: n.t, d: n.d, p: n.p }));
        if (e.altKey && !resize) {
          // Alt+끌기: 복사해서 옮기기
          const copies = notes.map((n) => ({ ...n }));
          app.track.notes.push(...copies);
          this.sel = new Set(copies);
          this.op = { kind: 'move', notes: copies, orig: copies.map((n) => ({ t: n.t, d: n.d, p: n.p })), lead: copies[notes.indexOf(hit)], t0: t, r0: r, changed: true, created: true, lastP: hit.p };
        } else {
          this.op = { kind: resize ? 'resize' : 'move', notes, orig, lead: hit, t0: t, r0: r, changed: false, lastP: hit.p };
        }
        if (!resize) app.previewNote(hit.p, hit.v);
        this.requestDraw();
        return;
      }
      // 빈 곳
      if (tool === 'select' || e.shiftKey) {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) { this.sel.clear(); app.onSelection(); }
        this.op = { kind: 'box', x0: x, y0: y, x1: x, y1: y, base: new Set(this.sel) };
        this.requestDraw();
        return;
      }
      if (tool === 'pen') {
        let p = this.pitchOf(r);
        if (!this.drum && app.ui.scaleLock && !T.inScale(p, app.song.key, app.song.scale)) p = T.snapToScale(p, app.song.key, app.song.scale);
        const n = { t: this.snapT(t), d: this.drum ? app.snapTicks() : app.lastLen, p, v: app.lastVel };
        app.track.notes.push(n);
        this.sel = new Set([n]); app.onSelection();
        app.previewNote(p, n.v);
        this.op = { kind: 'resize', notes: [n], orig: [{ t: n.t, d: n.d, p: n.p }], lead: n, t0: t, r0: r, changed: true, created: true, x0: x, at: Date.now() };
        this.requestDraw();
      }
    }

    move(e) {
      const x = e.offsetX, y = e.offsetY;
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x, y });
      const op = this.op;
      if (!op) {
        if (e.pointerType === 'mouse') {
          const z = this.zone(e);
          if (z === 'grid') {
            const hit = this.noteAt(x, y);
            let cur = this.app.tool === 'hand' ? 'grab' : this.app.tool === 'erase' ? 'not-allowed' : 'crosshair';
            if (hit && this.app.tool !== 'erase' && this.app.tool !== 'hand') {
              const edge = this.tx(hit.t + hit.d);
              cur = !this.drum && x > edge - 7 ? 'ew-resize' : 'move';
            }
            this.cv.style.cursor = cur;
            const hv = hit ? null : { t: this.xt(x), r: this.yr(y) };
            if (JSON.stringify(hv) !== JSON.stringify(this.hover)) { this.hover = hv; this.requestDraw(); }
          } else {
            this.cv.style.cursor = z === 'chord' || z === 'ruler' || z === 'keys' ? 'pointer' : z === 'vel' ? 'ns-resize' : 'default';
            if (this.hover) { this.hover = null; this.requestDraw(); }
          }
        }
        return;
      }
      const app = this.app, t = this.xt(x), r = this.yr(y);
      switch (op.kind) {
        case 'pinch': {
          if (this.pointers.size < 2) return;
          const [a, b] = [...this.pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const tAnchor = (op.mx - KEYW + op.sx0) / op.ppt0;
          this.ppt = Math.min(1.6, Math.max(0.06, op.ppt0 * d / op.d0));
          this.sx = tAnchor * this.ppt - (mx - KEYW);
          this.sy = op.sy0 - (my - op.my);
          this.clampScroll(); this.requestDraw();
          return;
        }
        case 'pan':
          this.sx = op.sx0 - (x - op.x0); this.sy = op.sy0 - (y - op.y0);
          this.clampScroll(); this.requestDraw(); return;
        case 'ruler': {
          if (Math.abs(x - op.x0) > 6 || op.kind2 === 'loop') {
            op.kind2 = 'loop';
            const a = Math.min(op.t0, t), b = Math.max(op.t0, t);
            const s = Math.max(0, Math.floor(a / BAR) * BAR), en = Math.max(s + BAR, Math.ceil(b / BAR) * BAR);
            this.op = Object.assign(op, { kind: 'loop', start: s, end: en });
            this.requestDraw();
          }
          return;
        }
        case 'loop': {
          const a = Math.min(op.t0, t), b = Math.max(op.t0, t);
          op.start = Math.max(0, Math.floor(a / BAR) * BAR); op.end = Math.max(op.start + BAR, Math.ceil(b / BAR) * BAR);
          this.requestDraw(); return;
        }
        case 'key': {
          const rr = this.yr(y); if (rr < 0 || rr >= this.rows) return;
          const p = this.pitchOf(rr);
          if (p !== op.p) { app.liveOff(op.p); app.liveOn(p, 0.8, true); op.p = p; }
          return;
        }
        case 'vel': this.velAt(x, y); return;
        case 'erase': this.eraseAt(x, y); return;
        case 'paint': this.paintAt(x, y); return;
        case 'box': op.x1 = x; op.y1 = y; this.boxSelect(); this.requestDraw(); return;
        case 'move': {
          const s = app.snapTicks();
          let dt = Math.round((t - op.t0) / s) * s;
          const minT = Math.min(...op.orig.map((o) => o.t));
          if (minT + dt < 0) dt = -minT;
          let dr = r - op.r0;
          const dp = this.drum ? dr : -dr;
          const ps = op.orig.map((o) => o.p + dp);
          const maxP = this.drum ? SG.DRUMS.length - 1 : 127;
          let fix = 0;
          if (Math.min(...ps) < 0) fix = -Math.min(...ps);
          if (Math.max(...ps) > maxP) fix = maxP - Math.max(...ps);
          op.notes.forEach((n, i) => {
            n.t = op.orig[i].t + dt;
            let p = op.orig[i].p + dp + fix;
            if (!this.drum && app.ui.scaleLock && dp + fix !== 0) p = T.snapToScale(p, app.song.key, app.song.scale);
            n.p = p;
          });
          if (dt || dp) op.changed = true;
          if (op.lead.p !== op.lastP) { op.lastP = op.lead.p; app.previewNote(op.lead.p, op.lead.v); }
          app.onSelection();
          this.requestDraw(); return;
        }
        case 'resize': {
          if (op.created && Math.abs(x - op.x0) < 4) return;
          const s = app.snapTicks();
          const want = Math.max(s, Math.round((t - op.lead.t) / s) * s || s);
          const delta = want - op.orig[op.notes.indexOf(op.lead)].d;
          op.notes.forEach((n, i) => { n.d = Math.max(Math.min(s, op.orig[i].d), op.orig[i].d + delta); });
          op.changed = true; op.resized = true;
          app.onSelection();
          this.requestDraw(); return;
        }
      }
    }

    up(e, cancelled) {
      this.pointers.delete(e.pointerId);
      const op = this.op;
      if (!op) return;
      if (op.kind === 'pinch') { if (this.pointers.size === 0) this.op = null; return; }
      if (this.pointers.size > 0) return;
      const app = this.app;
      this.op = null;
      if (cancelled && op.kind !== 'key') { this.cancelOp(op); this.requestDraw(); return; }
      switch (op.kind) {
        case 'ruler': app.seek(Math.max(0, this.snapT(op.t0))); break;
        case 'loop': app.setLoop(op.start, op.end); break;
        case 'key': app.liveOff(op.p); break;
        case 'vel': if (op.changed) app.commit('세기 바꾸기'); break;
        case 'erase': if (op.changed) app.commit('음표 지우기'); break;
        case 'paint': if (op.changed) app.commit(op.mode === 'add' ? '드럼 찍기' : '드럼 지우기'); break;
        case 'box': break;
        case 'move':
        case 'resize':
          if (op.resized) app.lastLen = op.lead.d;
          if (op.kind === 'move' && !this.drum && op.changed) app.lastLen = op.lead.d;
          if (op.changed) {
            app.track.notes.sort((a, b) => a.t - b.t || a.p - b.p);
            app.commit(op.created ? '음표 넣기' : op.kind === 'move' ? '음표 옮기기' : '길이 바꾸기');
          }
          break;
      }
      this.requestDraw();
    }

    /** 진행 중인 동작을 되돌린다(두 번째 손가락이 닿았을 때) */
    cancelOp(op = this.op) {
      if (!op) return;
      const tr = this.app.track;
      if ((op.kind === 'move' || op.kind === 'resize') && tr) {
        if (op.created) { tr.notes = tr.notes.filter((n) => !op.notes.includes(n)); this.sel.clear(); }
        else op.notes.forEach((n, i) => Object.assign(n, op.orig[i]));
      } else if (op.kind === 'key') this.app.liveOff(op.p);
      else if ((op.kind === 'paint' || op.kind === 'erase' || op.kind === 'vel') && op.changed) {
        this.app.revert();
      }
      this.op = null;
      this.app.onSelection();
    }

    velAt(x, y) {
      const tr = this.app.track, op = this.op;
      const v = Math.max(0.05, Math.min(1, 1 - (y - this.gridBottom - 4) / (this.velH - 8)));
      const pool = this.sel.size ? [...this.sel] : tr.notes;
      let best = [], bd = 8;
      for (const n of pool) {
        const d = Math.abs(this.tx(n.t) - x);
        if (d < bd - 0.5) { bd = d; best = [n]; } else if (Math.abs(d - bd) <= 0.5) best.push(n);
      }
      for (const n of best) { if (n.v !== v) { n.v = v; op.changed = true; } }
      if (best.length) this.app.lastVel = v;
      this.requestDraw();
    }
    eraseAt(x, y) {
      const n = this.noteAt(x, y);
      if (n) { this.removeNotes([n]); this.op.changed = true; }
    }
    paintAt(x, y) {
      const op = this.op, app = this.app, tr = app.track;
      const r = this.yr(y); if (r < 0 || r >= this.rows) return;
      const t = this.snapT(this.xt(x));
      const key = t + ':' + r;
      if (op.done.has(key)) return;
      op.done.add(key);
      const p = this.pitchOf(r);
      const s = app.snapTicks();
      const here = tr.notes.filter((n) => n.p === p && n.t < t + s && n.t + Math.max(n.d, 1) > t);
      if (op.mode === 'add' && !here.length) {
        tr.notes.push({ t, d: s, p, v: app.lastVel });
        app.previewNote(p, app.lastVel);
        op.changed = true;
      } else if (op.mode === 'remove' && here.length) {
        this.removeNotes(here); op.changed = true;
      }
      this.requestDraw();
    }
    boxSelect() {
      const op = this.op, tr = this.app.track;
      const ta = this.xt(Math.min(op.x0, op.x1)), tb = this.xt(Math.max(op.x0, op.x1));
      const ra = this.yr(Math.min(op.y0, op.y1)), rb = this.yr(Math.max(op.y0, op.y1));
      this.sel = new Set(op.base);
      for (const n of tr.notes) {
        const r = this.rowOf(n.p);
        if (r >= ra && r <= rb && n.t < tb && n.t + n.d > ta) this.sel.add(n);
      }
      this.app.onSelection();
    }
    removeNotes(list) {
      const tr = this.app.track, set = new Set(list);
      tr.notes = tr.notes.filter((n) => !set.has(n));
      for (const n of list) this.sel.delete(n);
      this.app.onSelection();
      this.requestDraw();
    }
  }

  function hexA(hex, a) {
    if (!hex || hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) { g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); return; }
    g.rect(x, y, w, h);
  }

  S.Roll = Roll;
  S.hexA = hexA;
})(globalThis.Studio = globalThis.Studio || {});
