'use strict';
/* 캐릭터·몬스터·보스·투사체·아이콘 도트.
   모두 PX(도트 조각 엔진)로 도형을 조합해 그 자리에서 굽고, 한 번 구운 그림은 보관한다.
   각 그림은 발밑(ax, ay)을 기준점으로 그린다. */

const ART = (() => {
  const { Spr } = PX;
  const nz = (sd, amt) => (x, y) => (U.hash2(x, y, sd) - 0.5) * amt;
  const fur = (sd, amt = 0.22) => (x, y) => (U.hash2(x, y >> 1, sd) - 0.5) * amt + ((x + y * 3) % 5 === 0 ? -0.12 : 0);

  /* 자주 쓰는 재질 */
  const M = {
    eye: PX.mat('#18122a', { flat: true, noAO: true }),
    white: PX.mat('#f4f0ff', { flat: true, noAO: true }),
    steel: PX.mat('#9aa6bf', { gloss: true, n: 7 }),
    gold: PX.mat('#e0a838', { gloss: true, n: 7, hs: 30 }),
    bone: PX.mat('#e6dcc4', { n: 6 }),
    leather: PX.mat('#7a4a2e'),
    darkLeather: PX.mat('#4a2c22'),
    blush: PX.mat('#ff8fa0', { flat: true, noAO: true, alpha: 0.75, outA: 0 })
  };
  const emit = (hex) => PX.mat(hex, { noAO: true, n: 5, lt: 0.85, dk: 0.3, dither: 0 });

  /* 구멍 난 칸에 별가루를 뿌린다(우주 재질) */
  function sprinkle(s, onMat, starMat, dens, seed) {
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      if (s.M[y * s.w + x] !== onMat) continue;
      const r = U.hash2(x, y, seed);
      if (r < dens) s.set(x, y, starMat, r < dens * 0.3 ? 1 : 0.7);
    }
  }

  /* ───────── 사람형(주인공·미라·기사 등) ───────── */
  const HEROES = {
    blade: { name: '카인', skin: '#f2c29c', hair: '#5a3424', hairStyle: 'spiky', top: '#3b5c9e', top2: '#cfd6e6', pants: '#3a3448', boots: '#5a3a2a', belt: '#7a4a2e', cape: '#c23a3a', pads: true, scarf: '#d8463c' },
    ranger: { name: '리라', skin: '#f6cba6', hair: '#f0c860', hairStyle: 'hood', top: '#4f8a3c', top2: '#e8d7a8', pants: '#5a4632', boots: '#6a4428', belt: '#8a5a32', hood: '#3f7a3a', cape: '#3a6a34' },
    mage: { name: '에온', skin: '#f0c8a8', hair: '#d6dcf4', hairStyle: 'long', top: '#5b3c9a', top2: '#e8c050', pants: '#2e2448', boots: '#3a2a4a', belt: '#e8c050', robe: true, hat: '#4a2f86' }
  };

  const skinMat = (hex) => PX.mat(hex, { hs: 6, sh: 12, dk: 0.4, lt: 0.5, dither: 0.3 });
  function humanFront(s, f, P, back) {
    const cx = 18, b = (f % 2) ? -1 : 0, sw = [0, 1, 0, -1][f];
    const lf = f === 1 ? -2 : 0, rf = f === 3 ? -2 : 0;
    const top = P.top, skin = skinMat(P.skin);
    // 망토(앞모습에선 몸 뒤)
    if (P.cape && !back) {
      s.poly([[cx - 6, 27 + b], [cx + 6, 27 + b], [cx + 8.5, 40 + b], [cx + 3, 41 + b], [cx, 40 + b], [cx - 3, 41 + b], [cx - 8.5, 40 + b]], P.cape, (x, y) => 0.3 + (cx - x) * 0.02);
      s.np();
    }
    if (P.hairStyle === 'long' && !back) { s.ball(cx, 25 + b, 8.6, 10, P.hair, { bias: -0.18 }); s.np(); }
    // 다리
    if (!P.robe) {
      s.cyl(cx - 2.6, 35.5 + b, cx - 2.6, 41 + lf, 2.3, 2.1, P.pants); s.ball(cx - 2.6, 42 + lf, 2.8, 1.9, P.boots); s.np();
      s.cyl(cx + 2.6, 35.5 + b, cx + 2.6, 41 + rf, 2.3, 2.1, P.pants); s.ball(cx + 2.6, 42 + rf, 2.8, 1.9, P.boots); s.np();
    } else {
      s.ball(cx - 2.8, 42.2 + lf * 0.5, 2.7, 1.8, P.boots); s.ball(cx + 2.8, 42.2 + rf * 0.5, 2.7, 1.8, P.boots); s.np();
      s.poly([[cx - 6, 29 + b], [cx + 6, 29 + b], [cx + 8.6, 42], [cx - 8.6, 42]], top, (x, y) => 0.62 - (x - cx) * 0.035 - (y - 30) * 0.008 + (Math.abs(x - cx) < 1 && !back ? -0.15 : 0));
      s.rect(cx - 8, 40, 17, 2, P.top2, 0.6);
      s.np();
    }
    // 몸통
    s.ball(cx, 31.5 + b, 6.3, 5.7, top);
    if (!back) {
      s.rect(cx - 1, 27 + b, 2, 8, P.top2, 0.6);
      if (!P.robe) s.rect(cx - 6, 35 + b, 13, 1.6, P.belt, 0.5);
      else s.rect(cx - 6, 34 + b, 13, 1.4, P.belt, 0.7);
      s.px(cx, 35 + b, M.gold, 0.9);
    }
    s.np();
    if (P.scarf) { s.ball(cx, 26.5 + b, 6, 2.4, P.scarf); if (!back) s.cyl(cx + 3, 27 + b, cx + 4.5, 31 + b, 1.3, 1, P.scarf); s.np(); }
    // 팔
    const arm = (side, d) => {
      const x = cx + side * 6.9;
      s.cyl(x, 27.6 + b, x + side * 0.6, 32.6 + b + d, 1.95, 1.75, top, { bias: side > 0 ? -0.05 : 0 });
      s.ball(x + side * 0.6, 34 + b + d, 1.7, 1.7, skin); s.np();
      if (P.pads) { s.ball(x - side * 0.3, 27.5 + b, 2.8, 2.2, M.steel); s.np(); }
    };
    arm(-1, sw); arm(1, -sw);
    // 등 망토
    if (P.cape && back) {
      s.poly([[cx - 6.5, 26 + b], [cx + 6.5, 26 + b], [cx + 8.5, 40 + b], [cx + 3, 41.5 + b], [cx, 40 + b], [cx - 3, 41.5 + b], [cx - 8.5, 40 + b]], P.cape, (x, y) => 0.6 + (cx - x) * 0.03 - (y - 26) * 0.012);
      s.np();
    }
    // 머리
    const hy = 19.5 + b;
    if (P.hairStyle === 'hood') {
      s.ball(cx, hy - 0.5, 8.6, 8.2, P.hood); s.np();
      if (!back) {
        s.ball(cx, hy + 1.5, 6.4, 5.8, skin, { nk: 0.55, amb: 0.35 }); s.np();
        // 앞머리
        for (let x = cx - 5; x <= cx + 5; x++) { const yy = hy - 3 + ((x + 1) % 3 === 0 ? 1 : 0); s.rect(x, hy - 4.5, 1, yy - (hy - 4.5) + 1, P.hair, 0.65 - (x - cx) * 0.03); }
        s.np();
      } else {
        s.chain([[cx, hy + 5], [cx + 0.5, hy + 8], [cx - 0.5, hy + 12]], 2.6, 1.3, P.hair); s.np();
      }
    } else {
      if (back) s.ball(cx, hy, 7.4, 7, P.hair);
      else {
        if (P.hairStyle !== 'long') s.ball(cx, hy - 0.8, 7.8, 7.2, P.hair, { bias: -0.15 });
        else s.ball(cx, hy - 0.5, 8.3, 7.6, P.hair, { bias: -0.1 });
        s.np();
        s.ball(cx, hy + 0.6, 6.9, 6.4, skin, { nk: 0.55, amb: 0.35 });
      }
      s.np();
      // 머리카락
      if (P.hairStyle === 'spiky') {
        const hs = (x, y) => 0.7 - (y - hy + 10) * 0.025 - (x - cx) * 0.03;
        const spikes = [[-7, -1, -11, -3], [-5.5, -4, -9, -10], [-2.5, -6, -4, -13], [1, -6.5, 2, -14], [4.5, -5, 8, -11], [7, -1.5, 11, -5]];
        if (back) spikes.push([-6, 4, -10, 7], [6, 4, 10, 7], [-2, 6, -3, 10], [2, 6, 3, 10]);
        for (const [bx, by, tx, ty] of spikes) s.poly([[cx + bx - 3, hy + by + 1.5], [cx + tx, hy + ty], [cx + bx + 3, hy + by + 1.5]], P.hair, hs);
        s.ball(cx, hy - 1.6, 7.6, 6.2, P.hair, { half: 'top' });
        if (!back) {
          s.poly([[cx - 7.6, hy - 3], [cx + 7.6, hy - 3], [cx + 7.2, hy + 1.5], [cx + 5, hy - 1.2], [cx + 3, hy + 1], [cx + 1, hy - 1.5], [cx - 1.5, hy + 1.2], [cx - 3.5, hy - 1.2], [cx - 5.5, hy + 0.8], [cx - 7.2, hy + 2]], P.hair, hs);
        }
      } else if (P.hairStyle === 'long') {
        if (!back) {
          s.poly([[cx - 7.8, hy - 4.5], [cx + 7.8, hy - 4.5], [cx + 7.5, hy + 1], [cx + 3, hy - 1.5], [cx + 1, hy + 0.5], [cx - 2, hy - 1.8], [cx - 7.5, hy + 1]], P.hair, (x, y) => 0.72 - (y - hy + 4) * 0.05);
          s.cyl(cx - 6.6, hy, cx - 7.2, hy + 7, 1.7, 1.2, P.hair, { bias: -0.1 }); s.cyl(cx + 6.6, hy, cx + 7.2, hy + 7, 1.7, 1.2, P.hair, { bias: -0.2 });
        } else {
          s.poly([[cx - 7.5, hy], [cx + 7.5, hy], [cx + 8, hy + 12], [cx + 4, hy + 13], [cx, hy + 12], [cx - 4, hy + 13], [cx - 8, hy + 12]], P.hair, (x, y) => 0.62 - (x - cx) * 0.03 - (y - hy) * 0.015);
        }
      }
      s.np();
    }
    // 얼굴
    if (!back) {
      const ey = hy + 0.5;
      for (const ex of [cx - 3.5, cx + 2.5]) {
        s.rect(ex, ey, 2, 3, M.eye, 0.2);
        s.px(ex, ey, M.white, 1);
      }
      s.px(cx - 5, ey + 3, M.blush, 1); s.px(cx + 5, ey + 3, M.blush, 1);
      s.px(cx, ey + 4, PX.mat('#c07868', { flat: true, noAO: true }), 0.5);
      s.np();
    }
    // 모자
    if (P.hat) {
      s.ball(cx, hy - 3.5, 11, 3, P.hat, { bias: 0.05 }); s.np();
      s.poly([[cx - 6.5, hy - 4.5], [cx + 6.5, hy - 4.5], [cx + 3.5, hy - 12], [cx + 6, hy - 17], [cx + 9, hy - 18], [cx + 3, hy - 16.5], [cx - 1, hy - 12]], P.hat, (x, y) => 0.62 - (x - cx) * 0.04 + (y - hy) * -0.004);
      s.rect(cx - 6, hy - 6.5, 13, 2, P.top2, 0.6);
      s.np();
      if (!back) s.star(cx + 9, hy - 18, 2.2, 1, 4, 0, M.gold);
      s.np();
    }
  }

  function humanSide(s, f, P) {
    const cx = 18, b = (f % 2) ? -1 : 0, ph = f * Math.PI / 2;
    const ls = Math.sin(ph) * 3.2, as = Math.sin(ph) * 2.4;
    const top = P.top, skin = skinMat(P.skin);
    if (P.cape) { s.poly([[cx - 1, 26 + b], [cx - 4, 27 + b], [cx - 9 - as * 0.5, 39 + b], [cx - 3, 40 + b]], P.cape, 0.32); s.np(); }
    if (P.hairStyle === 'long') { s.ball(cx - 3, 25 + b, 5, 9, P.hair, { bias: -0.2 }); s.np(); }
    // 뒷팔·뒷다리
    s.cyl(cx - 0.5, 27.8 + b, cx - 0.5 - as, 32.8 + b, 1.9, 1.7, top, { bias: -0.2 }); s.ball(cx - 0.5 - as, 34 + b, 1.6, 1.6, skin, { bias: -0.2 }); s.np();
    if (!P.robe) {
      s.cyl(cx - 0.5, 35.5 + b, cx - 0.5 - ls, 41 - (ls < -1 ? 1 : 0), 2.3, 2.1, P.pants, { bias: -0.2 }); s.ball(cx + 0.5 - ls, 42 - (ls < -1 ? 1 : 0), 3, 1.9, P.boots, { bias: -0.2 }); s.np();
    }
    // 몸통
    if (P.robe) {
      s.ball(cx + 1 - ls * 0.3, 42.2, 3, 1.8, P.boots); s.np();
      s.poly([[cx - 4.5, 29 + b], [cx + 4.5, 29 + b], [cx + 6.5 - ls * 0.2, 42], [cx - 6.5 - ls * 0.2, 42]], top, (x, y) => 0.6 - (x - cx) * 0.03);
      s.rect(cx - 6, 40, 13, 2, P.top2, 0.6);
    }
    s.ball(cx, 31.5 + b, 4.8, 5.7, top);
    if (!P.robe) s.rect(cx - 4.5, 35 + b, 9.5, 1.6, P.belt, 0.5);
    s.np();
    if (!P.robe) {
      s.cyl(cx + 0.5, 35.5 + b, cx + 0.5 + ls, 41 - (ls > 1 ? 1 : 0), 2.3, 2.1, P.pants); s.ball(cx + 1.5 + ls, 42 - (ls > 1 ? 1 : 0), 3, 1.9, P.boots); s.np();
    }
    if (P.scarf) { s.ball(cx, 26.6 + b, 4.6, 2.3, P.scarf); s.cyl(cx - 3, 27 + b, cx - 7, 29 + b + as * 0.3, 1.4, 1, P.scarf); s.np(); }
    const hy = 19.5 + b;
    if (P.hairStyle === 'hood') {
      s.ball(cx, hy - 0.5, 8, 8.2, P.hood); s.np();
      s.ball(cx + 2.5, hy + 1.5, 4.8, 5.6, skin, { nk: 0.55, amb: 0.35 }); s.np();
      s.chain([[cx - 6, hy + 1], [cx - 9, hy + 4], [cx - 9.5, hy + 9]], 2.4, 1.2, P.hair); s.np();
      for (let x = cx; x <= cx + 6; x++) s.rect(x, hy - 4.5, 1, 2 + ((x % 3) ? 0 : 1), P.hair, 0.65);
      s.np();
    } else {
      s.ball(cx - 0.5, hy - 0.8, 7.6, 7.2, P.hair, { bias: -0.1 }); s.np();
      s.ball(cx + 1.6, hy + 0.8, 5.8, 6.2, skin, { nk: 0.55, amb: 0.35 }); s.np();
      if (P.hairStyle === 'spiky') {
        const hs = (x, y) => 0.68 - (y - hy + 10) * 0.025 - (x - cx) * 0.02;
        for (const [bx, by, tx, ty] of [[-6, 0, -11, 1], [-5, -4, -10, -7], [-2, -6, -5, -13], [1.5, -6.5, 1, -14], [4.5, -5, 8, -10]]) s.poly([[bx + cx - 3, hy + by + 1.5], [cx + tx, hy + ty], [cx + bx + 3, hy + by + 1.5]], P.hair, hs);
        s.poly([[cx - 4, hy - 5], [cx + 7.5, hy - 4], [cx + 7, hy - 1], [cx + 4, hy - 2], [cx + 1, hy + 1], [cx - 2, hy + 3], [cx - 5, hy + 2]], P.hair, 0.6);
      } else {
        s.poly([[cx - 6, hy - 5], [cx + 7.5, hy - 4], [cx + 7.4, hy], [cx + 4, hy - 2], [cx, hy - 1], [cx - 3, hy + 2]], P.hair, 0.66);
        s.cyl(cx - 5, hy, cx - 5.5, hy + 8, 2.4, 1.6, P.hair);
      }
      s.np();
    }
    // 앞팔
    s.cyl(cx + 0.5, 27.8 + b, cx + 0.5 + as, 32.8 + b, 1.95, 1.75, top); s.ball(cx + 0.5 + as, 34 + b, 1.7, 1.7, skin); s.np();
    if (P.pads) { s.ball(cx + 0.5, 27.5 + b, 2.8, 2.3, M.steel); s.np(); }
    const ey = hy + 0.5;
    s.rect(cx + 4, ey, 2, 3, M.eye, 0.2); s.px(cx + 4, ey, M.white, 1); s.px(cx + 3, ey + 3, M.blush, 1);
    s.np();
    if (P.hat) {
      s.ball(cx, hy - 3.5, 10, 2.8, P.hat); s.np();
      s.poly([[cx - 6, hy - 4.5], [cx + 6, hy - 4.5], [cx + 1, hy - 12], [cx - 4, hy - 17], [cx - 8, hy - 18], [cx - 4, hy - 15.5], [cx - 4, hy - 11]], P.hat, (x, y) => 0.6 - (x - cx) * 0.04);
      s.rect(cx - 6, hy - 6.5, 12, 2, P.top2, 0.6); s.np();
      s.star(cx - 8, hy - 18, 2.2, 1, 4, 0, M.gold); s.np();
    }
  }

  /* ───────── 그림 정의 ───────── */
  const D = {};
  const def = (name, w, h, ax, ay, n, draw, o = {}) => { D[name] = { w, h, ax, ay, n, draw, ...o }; };

  // 주인공 3인: view 별로 따로 굽는다
  for (const [id, P] of Object.entries(HEROES)) {
    def('hero_' + id + '_down', 36, 46, 18, 44, 4, (s, f) => humanFront(s, f, P, false));
    def('hero_' + id + '_up', 36, 46, 18, 44, 4, (s, f) => humanFront(s, f, P, true));
    def('hero_' + id + '_side', 36, 46, 18, 44, 4, (s, f) => humanSide(s, f, P));
  }

  /* ── 1계층: 이끼 낀 정원 ── */
  function slimeBody(s, f, col, o = {}) {
    const sq = [0, 1.6, -1.2, 0.4][f];
    const rx = 9 + sq, ry = 6.6 - sq * 0.8, cy = 18 - ry;
    s.ball(12, cy, rx, ry, col, { m: { gloss: true, alpha: o.alpha ?? 0.92 }, amb: 0.3 });
    if (o.core) s.ball(12 + 1, cy + 1.5, rx * 0.4, ry * 0.4, o.core, { m: { noAO: true } });
    if (o.crack) for (let i = 0; i < 18; i++) { const a = U.hash2(i, 3, 9) * U.TAU, r = U.hash2(i, 5, 9); s.px(12 + Math.cos(a) * rx * r * 0.85, cy + Math.sin(a) * ry * r * 0.85, o.crack, 0.9); }
    s.np();
    const ey = cy - 0.5;
    s.rect(12 - 4, ey, 2, 3, M.eye, 0); s.rect(12 + 2, ey, 2, 3, M.eye, 0);
    s.px(12 - 4, ey, M.white, 1); s.px(12 + 2, ey, M.white, 1);
    if (o.angry) { s.px(12 - 5, ey - 1, M.eye, 0); s.px(12 + 4, ey - 1, M.eye, 0); }
  }
  def('slime', 24, 20, 12, 18, 4, (s, f) => slimeBody(s, f, '#5ccf5a'));
  def('slimeKing', 24, 20, 12, 18, 4, (s, f) => slimeBody(s, f, '#3fb0d8', { angry: true }));

  def('shroom', 26, 28, 13, 26, 2, (s, f) => {
    const p = f ? 1 : 0;
    s.ball(10, 25.5, 3, 1.6, '#c9b48a'); s.ball(16, 25.5, 3, 1.6, '#c9b48a'); s.np();
    s.cyl(13, 25, 13, 15, 4.6, 3.8, '#efe2c4'); s.np();
    s.ball(13, 14.5 + p, 10, 3, '#b8946a', { bias: -0.15 }); s.np();
    s.ball(13, 11 + p, 11.5 + p * 0.6, 7.5 - p * 0.6, '#d0423c', { half: 'top', m: { gloss: true } });
    s.ball(13, 11 + p, 11.5 + p * 0.6, 2.5, '#d0423c', { half: 'bottom', bias: -0.2 }); s.np();
    for (const [x, y, r] of [[8, 8, 1.8], [14, 6, 2.2], [19, 9, 1.6], [12, 10.5, 1.2]]) s.ball(x, y + p, r, r * 0.9, '#f8f0e0');
    s.np();
    s.rect(10, 18, 2, 2, M.eye, 0); s.rect(15, 18, 2, 2, M.eye, 0);
  });

  def('boar', 36, 26, 18, 24, 4, (s, f) => {
    const ph = f * Math.PI / 2, l1 = Math.sin(ph) * 2.2, l2 = -l1;
    const legs = [[9, l2, -0.2], [23, l1, -0.2], [12, l1, 0], [26, l2, 0]];
    for (const [x, l, bb] of legs.slice(0, 2)) { s.cyl(x, 16, x + l, 22.5, 2, 1.7, '#5a3826', { bias: bb }); s.ball(x + l, 23, 2, 1.2, '#2a1c18'); }
    s.np();
    s.ball(16, 14, 11.5, 7.4, '#8a5634', { tex: fur(3) });
    s.ball(14, 9, 8, 3, '#5a3020', { tex: fur(4, 0.3), bias: -0.05 }); s.np();
    for (const [x, l, bb] of legs.slice(2)) { s.cyl(x, 17, x + l, 22.5, 2.2, 1.8, '#6a4028', { bias: bb }); s.ball(x + l, 23, 2.2, 1.2, '#2a1c18'); }
    s.np();
    s.ball(28, 14.5, 6, 5.4, '#8a5634', { tex: fur(5) }); s.np();
    s.ball(33, 16, 2.6, 2.4, '#d08a7a'); s.px(33, 15, M.eye, 0); s.px(34, 16, M.eye, 0); s.np();
    s.cyl(31, 18, 34, 13.5, 1, 0.6, M.bone); s.np();
    s.ball(25, 9.5, 2, 2.6, '#6a4028'); s.np();
    s.rect(29, 12, 2, 2, PX.mat('#ff4a3a', { noAO: true }), 0.9);
  });

  def('wasp', 30, 26, 15, 24, 2, (s, f) => {
    const wy = f ? 3 : -2;
    const wing = PX.mat('#cfe8ff', { alpha: 0.55, noAO: true, outA: 0.5 });
    s.poly([[13, 9], [4, 2 + wy], [1, 6 + wy], [9, 11]], wing, 0.8); s.np();
    s.ball(19, 13, 7, 5.2, '#e8b830', { tex: (x) => ((x + 2) % 5 < 2 ? -0.55 : 0), m: { gloss: true } }); s.np();
    s.cyl(25, 14, 28.5, 16, 1.2, 0.3, '#2a2030'); s.np();
    s.ball(11, 11, 4.4, 4, '#3a2c20', { tex: fur(8, 0.2) }); s.np();
    s.ball(6.5, 11, 4, 3.8, '#e8b830'); s.np();
    s.ball(5, 10.5, 2, 2.3, '#c82a2a', { m: { gloss: true } }); s.np();
    for (const x of [9, 12, 14]) s.line(x, 14, x - 1, 18, '#2a2030', 0.3);
    s.np();
    s.poly([[13, 9], [8, 1 + wy], [5, 4 + wy], [11, 11]], wing, 0.95);
  }, { fly: 14 });

  /* ── 2계층: 모래시계 신전 ── */
  def('scorpion', 36, 26, 18, 24, 4, (s, f) => {
    const ph = f * Math.PI / 2;
    const shell = '#c4782e';
    for (let i = 0; i < 3; i++) { const lx = 12 + i * 5, l = Math.sin(ph + i) * 1.5; s.chain([[lx, 17], [lx - 2 + l, 20], [lx - 3 + l, 23.5]], 1.2, 0.8, '#8a4a20'); }
    s.np();
    s.chain([[9, 16], [5, 12], [5, 6], [9, 2.5], [14, 3]], 2.8, 2, shell, { m: { gloss: true } });
    s.cyl(14, 3, 17, 5, 1.6, 0.4, '#3a2014'); s.np();
    s.ball(15, 17, 8, 4.6, shell, { m: { gloss: true }, tex: (x) => (x % 4 === 0 ? -0.2 : 0) }); s.np();
    s.ball(24, 18, 4.6, 3.8, shell, { m: { gloss: true } }); s.np();
    s.cyl(26, 19, 31, 21, 1.6, 1.5, shell); s.ball(32, 21, 3, 2.4, shell, { m: { gloss: true } }); s.px(34, 20, M.eye, 0); s.np();
    for (let i = 0; i < 3; i++) { const lx = 14 + i * 5, l = Math.sin(ph + i + 1.5) * 1.5; s.chain([[lx, 19], [lx + 1 + l, 21], [lx + l, 23.5]], 1.3, 0.8, '#a05a26'); }
    s.np();
    s.px(26, 16, PX.mat('#ff3a2a', { noAO: true }), 1); s.px(27, 17, PX.mat('#ff3a2a', { noAO: true }), 1);
  });

  def('mummy', 36, 46, 18, 44, 4, (s, f) => {
    const cx = 18, b = (f % 2) ? -1 : 0, lf = f === 1 ? -2 : 0, rf = f === 3 ? -2 : 0;
    const band = '#d8caa0', bt = (x, y) => ((y + (x >> 2)) % 3 === 0 ? -0.28 : 0) + (U.hash2(x, y, 4) - 0.5) * 0.1;
    s.cyl(cx - 2.6, 35 + b, cx - 2.6, 42 + lf, 2.5, 2.2, band, { tex: bt }); s.np();
    s.cyl(cx + 2.6, 35 + b, cx + 2.6, 42 + rf, 2.5, 2.2, band, { tex: bt }); s.np();
    s.ball(cx, 31 + b, 6.6, 6.4, band, { tex: bt }); s.np();
    s.cyl(cx - 6, 27 + b, cx - 6.5, 31 + b + (f === 1 ? 1 : 0), 2.1, 1.9, band, { tex: bt });
    s.cyl(cx + 6, 27 + b, cx + 6.5, 31 + b + (f === 3 ? 1 : 0), 2.1, 1.9, band, { tex: bt }); s.np();
    s.ball(cx - 6.6, 32 + b, 2.1, 2.3, band, { tex: bt }); s.ball(cx + 6.6, 32 + b, 2.1, 2.3, band, { tex: bt }); s.np();
    s.ball(cx, 19.5 + b, 7, 6.8, band, { tex: bt }); s.np();
    s.rect(cx - 6, 18 + b, 13, 3, '#3a2a20', 0.2);
    const gl = PX.mat('#7cf0ff', { noAO: true });
    s.rect(cx - 4, 19 + b, 2, 1, gl, 1); s.rect(cx + 2, 19 + b, 2, 1, gl, 1);
    s.line(cx + 4, 23 + b, cx + 9, 29 + b, band, 0.4);
  });

  def('sandworm', 30, 34, 15, 32, 3, (s, f) => {
    const h = [0.65, 0.85, 1][f];
    const flesh = '#c88a5a';
    for (let i = 4; i >= 0; i--) { const y = 30 - i * 5 * h, x = 15 + Math.sin(i * 1.3 + f) * 1.4; s.ball(x, y, 7 - i * 0.5, 4.2, flesh, { tex: (xx) => ((xx % 3) ? 0 : -0.1) }); s.np(); }
    const ty = 30 - 4 * 5 * h - 2;
    s.ball(15, ty, 6, 3.4, '#5a1e26'); s.np();
    for (let i = 0; i < 8; i++) { const a = i / 8 * U.TAU; s.px(15 + Math.cos(a) * 5, ty + Math.sin(a) * 2.6, M.bone, 0.9); }
    s.np();
    s.ball(15, 32, 11, 3, '#d8b070', { bias: 0.05 });
  });
  def('mound', 34, 14, 17, 12, 2, (s, f) => {
    s.ball(17, 10, 13 + f, 5 - f * 0.5, '#d8b070', { tex: nz(7, 0.15) }); s.np();
    for (let i = 0; i < 6; i++) s.ball(6 + i * 4.4, 7 + U.hash2(i, f, 2) * 2, 1.6, 1.3, '#c49858');
  });

  def('skeleton', 36, 46, 18, 44, 4, (s, f) => {
    const cx = 18, b = (f % 2) ? -1 : 0, lf = f === 1 ? -2 : 0, rf = f === 3 ? -2 : 0;
    const bone = M.bone;
    s.cyl(cx - 2.5, 35 + b, cx - 2.5, 42 + lf, 1.2, 1.1, bone); s.ball(cx - 2.5, 42.5 + lf, 2.2, 1.3, bone); s.np();
    s.cyl(cx + 2.5, 35 + b, cx + 2.5, 42 + rf, 1.2, 1.1, bone); s.ball(cx + 2.5, 42.5 + rf, 2.2, 1.3, bone); s.np();
    s.ball(cx, 34.5 + b, 4.5, 2.2, bone); s.np();
    s.cyl(cx, 26 + b, cx, 34 + b, 1, 1, bone); s.np();
    for (let i = 0; i < 4; i++) s.ball(cx, 27.5 + i * 2 + b, 5 - i * 0.6, 0.9, bone);
    s.np();
    s.rect(cx - 5, 24.5 + b, 11, 1.5, '#7a3a2a', 0.5); s.np();
    s.cyl(cx - 5.5, 25.5 + b, cx - 6.5, 32 + b, 1.1, 1, bone); s.cyl(cx + 5.5, 25.5 + b, cx + 7.5, 29.5 + b, 1.1, 1, bone); s.np();
    s.chain([[cx + 9, 22 + b], [cx + 11, 29 + b], [cx + 9, 36 + b]], 1, 1, '#7a4a2e'); s.line(cx + 9, 22 + b, cx + 9, 36 + b, '#e8e0d0', 0.9); s.np();
    s.ball(cx, 18.5 + b, 6.6, 6.2, bone); s.ball(cx, 23.2 + b, 3.8, 2, bone); s.np();
    const gl = PX.mat('#ff7a3a', { noAO: true });
    s.rect(cx - 4, 18 + b, 3, 3, M.eye, 0); s.rect(cx + 1, 18 + b, 3, 3, M.eye, 0);
    s.px(cx - 3, 19 + b, gl, 1); s.px(cx + 2, 19 + b, gl, 1);
    s.px(cx, 21 + b, M.eye, 0);
    for (let x = -2; x <= 2; x += 2) s.px(cx + x, 23 + b, M.eye, 0);
  });

  /* ── 3계층: 얼어붙은 회랑 ── */
  def('wolf', 40, 28, 20, 26, 4, (s, f) => {
    const ph = f * Math.PI / 2, l1 = Math.sin(ph) * 3, l2 = -l1, by = (f % 2) ? -1 : 0;
    const furC = '#cfe0f0';
    s.chain([[7, 13 + by], [3, 9 + by], [1, 5 + by]], 2.6, 1.5, furC, { tex: fur(11) }); s.np();
    for (const [x, l] of [[10, l2], [25, l1]]) { s.cyl(x, 16 + by, x + l, 24.5, 1.8, 1.4, '#9ab0c8', { bias: -0.2 }); s.ball(x + l, 25, 1.8, 1, '#5a6a80'); }
    s.np();
    s.ball(17, 14 + by, 11, 6, furC, { tex: fur(12) });
    s.ball(16, 10.5 + by, 9, 2.4, '#8ea8c4', { tex: fur(13, 0.3) }); s.np();
    for (const [x, l] of [[13, l1], [28, l2]]) { s.cyl(x, 17 + by, x + l, 24.5, 2, 1.5, furC); s.ball(x + l, 25, 2, 1.1, '#5a6a80'); }
    s.np();
    s.ball(30, 11 + by, 5.4, 4.8, furC, { tex: fur(14) }); s.np();
    s.ball(35, 13 + by, 3.5, 2.3, furC); s.px(38, 12 + by, M.eye, 0); s.np();
    s.poly([[27, 8 + by], [28, 2 + by], [31, 7 + by]], '#9ab0c8', 0.6); s.poly([[30, 7 + by], [32, 1 + by], [34, 7 + by]], furC, 0.7); s.np();
    s.rect(31, 10 + by, 2, 1, PX.mat('#4ad8ff', { noAO: true }), 1);
    s.line(34, 15 + by, 37, 15 + by, M.white, 1);
  });

  def('wisp', 26, 30, 13, 28, 4, (s, f) => {
    const ice = PX.mat('#8fe0ff', { gloss: true, n: 7 });
    const a = f * Math.PI / 8;
    const shard = (cx, cy, len, w, ang, sh) => {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const P = (u, v) => [cx + ca * u - sa * v, cy + sa * u + ca * v];
      s.poly([P(-len, 0), P(0, -w), P(len, 0), P(0, w)], ice, (x, y) => sh - ((x - cx) * 0.5 + (y - cy)) * 0.04);
    };
    shard(13, 6, 5, 2.2, Math.PI / 2 + Math.sin(a) * 0.2, 0.6); s.np();
    shard(6, 13, 4.6, 2, 0.4 + a * 0.3, 0.5); shard(20, 13, 4.6, 2, -0.4 - a * 0.3, 0.45); s.np();
    s.ball(13, 14, 6, 6.4, '#bff0ff', { m: { gloss: true }, amb: 0.35 }); s.np();
    shard(9, 21, 4, 1.8, 1.2, 0.5); shard(17, 21, 4, 1.8, -1.2 + Math.PI, 0.4); s.np();
    s.rect(10, 13, 2, 3, PX.mat('#2a5a8a', { flat: true }), 0); s.rect(14, 13, 2, 3, PX.mat('#2a5a8a', { flat: true }), 0);
  }, { fly: 12 });

  def('snowgolem', 36, 42, 18, 40, 2, (s, f) => {
    const p = f ? 1 : 0;
    const snow = '#eef4ff';
    s.ball(18, 32, 12, 8.5, snow, { tex: nz(21, 0.08) }); s.np();
    s.cyl(8, 22 + p, 3, 30 - p, 2.2, 3, '#7a8aa8', { tex: nz(5, 0.2) }); s.ball(3, 31 - p, 3.4, 3, '#7a8aa8'); s.np();
    s.cyl(28, 22 + p, 33, 30 - p, 2.2, 3, '#7a8aa8', { tex: nz(6, 0.2) }); s.ball(33, 31 - p, 3.4, 3, '#7a8aa8'); s.np();
    s.ball(18, 21 + p, 9, 7, snow, { tex: nz(22, 0.08) }); s.np();
    for (const y of [19, 23]) s.ball(18, y + p, 1.1, 1.1, '#2a2a3a');
    s.np();
    s.ball(18, 11 + p, 7, 6.2, snow, { tex: nz(23, 0.08) }); s.np();
    s.rect(15, 10 + p, 2, 2, M.eye, 0); s.rect(20, 10 + p, 2, 2, M.eye, 0);
    s.poly([[18, 13 + p], [23, 14 + p], [18, 15 + p]], '#f08a30', 0.6); s.np();
    for (let i = 0; i < 5; i++) s.poly([[12 + i * 3, 6 + p], [13.5 + i * 3, 1 + p - (i % 2) * 2], [15 + i * 3, 6 + p]], PX.mat('#7fdcff', { gloss: true }), 0.7);
  });

  def('icebat', 32, 22, 16, 20, 2, (s, f) => {
    const wy = f ? 5 : -3;
    const wing = '#5a7ab8';
    s.poly([[13, 9], [2, 4 + wy], [4, 10 + wy * 0.5], [1, 13 + wy * 0.3], [11, 13]], wing, (x, y) => 0.4 + (x - 2) * 0.02);
    s.poly([[19, 9], [30, 4 + wy], [28, 10 + wy * 0.5], [31, 13 + wy * 0.3], [21, 13]], wing, (x, y) => 0.35 - (x - 19) * 0.01); s.np();
    s.ball(16, 11, 5, 4.6, '#7ea2d8', { tex: fur(31) }); s.np();
    s.poly([[12, 8], [12, 3], [15, 7]], '#7ea2d8', 0.6); s.poly([[20, 8], [20, 3], [17, 7]], '#7ea2d8', 0.5); s.np();
    const gl = PX.mat('#c8f8ff', { noAO: true });
    s.px(14, 10, gl, 1); s.px(18, 10, gl, 1); s.px(14, 14, M.white, 1); s.px(18, 14, M.white, 1);
  }, { fly: 16 });

  /* ── 4계층: 용암 대장간 ── */
  def('imp', 30, 32, 15, 30, 2, (s, f) => {
    const wy = f ? 3 : -2;
    const red = '#d8463a';
    s.poly([[12, 14], [3, 7 + wy], [2, 13 + wy], [5, 12 + wy], [11, 18]], '#6a2030', 0.4);
    s.poly([[18, 14], [27, 7 + wy], [28, 13 + wy], [25, 12 + wy], [19, 18]], '#6a2030', 0.35); s.np();
    s.chain([[17, 24], [22, 26], [25, 22], [26, 19]], 1, 0.6, red); s.poly([[24, 19], [26, 16], [28, 19]], red, 0.5); s.np();
    s.cyl(13, 24, 12, 28, 1.4, 1.2, '#a82e2e'); s.cyl(17, 24, 18, 28, 1.4, 1.2, '#a82e2e'); s.np();
    s.ball(15, 21, 5, 5, red); s.np();
    s.ball(15, 12, 6, 5.6, red); s.np();
    s.chain([[11, 9], [9, 6], [9, 3]], 1.4, 0.5, '#f0d8b8'); s.chain([[19, 9], [21, 6], [21, 3]], 1.4, 0.5, '#f0d8b8'); s.np();
    const gl = PX.mat('#ffe060', { noAO: true });
    s.rect(12, 11, 2, 2, gl, 1); s.rect(17, 11, 2, 2, gl, 1);
    s.line(13, 15, 17, 15, M.eye, 0); s.px(14, 16, M.white, 1); s.px(16, 16, M.white, 1);
  }, { fly: 10 });

  def('magmaslime', 24, 20, 12, 18, 4, (s, f) => slimeBody(s, f, '#3a2a2e', { alpha: 1, crack: emit('#ff8a2a'), core: emit('#ff5a1a'), angry: true }));

  def('bomber', 26, 28, 13, 26, 4, (s, f) => {
    const lf = (f === 1) ? -1.5 : 0, rf = (f === 3) ? -1.5 : 0;
    s.cyl(9, 21, 8, 25 + lf, 1.4, 1.2, '#5a4a40'); s.cyl(17, 21, 18, 25 + rf, 1.4, 1.2, '#5a4a40'); s.np();
    s.ball(8, 25.5 + lf, 2.4, 1.4, '#3a2a24'); s.ball(18, 25.5 + rf, 2.4, 1.4, '#3a2a24'); s.np();
    s.ball(13, 15, 9, 8.6, '#3a3a4a', { m: { gloss: true, n: 7 } }); s.np();
    s.rect(11, 5, 4, 3, '#8a8a9a', 0.6); s.np();
    s.chain([[13, 5], [14, 2], [17, 1]], 0.8, 0.8, '#c8a878'); s.np();
    s.ball(9, 14, 3, 2.6, M.steel); s.ball(16, 14, 3, 2.6, M.steel); s.np();
    s.ball(9, 14, 1.7, 1.5, '#ffb84a', { m: { gloss: true } }); s.ball(16, 14, 1.7, 1.5, '#ffb84a', { m: { gloss: true } }); s.np();
    s.rect(4, 13, 18, 1, '#5a3a2a', 0.4);
  });

  def('automaton', 32, 38, 16, 36, 4, (s, f) => {
    const lf = f === 1 ? -2 : 0, rf = f === 3 ? -2 : 0, b = (f % 2) ? -1 : 0;
    const brass = PX.mat('#b88a3a', { gloss: true, n: 7 }), iron = PX.mat('#5a5a6e', { gloss: true, n: 7 });
    s.cyl(11, 28 + b, 11, 34 + lf, 1.8, 1.8, iron); s.box(8, 33 + lf, 6, 3, iron); s.np();
    s.cyl(21, 28 + b, 21, 34 + rf, 1.8, 1.8, iron); s.box(18, 33 + rf, 6, 3, iron); s.np();
    s.box(6, 14 + b, 20, 16, brass, { bevel: 2, round: 3 }); s.np();
    for (const [x, y] of [[8, 16], [23, 16], [8, 27], [23, 27]]) s.px(x, y + b, M.steel, 1);
    s.box(10, 19 + b, 12, 7, '#2a2a34', { base: 0.3 }); s.np();
    for (let i = 0; i < 3; i++) s.rect(12 + i * 3, 20 + b, 1, 5, emit('#ff8a3a'), 0.6 + i * 0.1);
    s.np();
    s.cyl(5, 17 + b, 2, 26 + b, 2, 2.4, iron); s.cyl(27, 17 + b, 30, 26 + b, 2, 2.4, iron); s.np();
    s.box(9, 5 + b, 14, 10, brass, { bevel: 1, round: 2 }); s.np();
    s.ball(16, 10 + b, 3.2, 3, '#1a1a24'); s.ball(16, 10 + b, 1.8, 1.8, emit('#5af0ff')); s.np();
    s.line(16, 5 + b, 16, 1 + b, iron, 0.5); s.px(16, 0 + b, emit('#ff4a3a'), 1);
  });

  /* ── 5계층: 별의 첨탑 ── */
  def('voideye', 30, 32, 15, 30, 4, (s, f) => {
    const flesh = '#6a3a8a';
    for (let i = 0; i < 4; i++) {
      const x0 = 9 + i * 4, w = Math.sin(f * Math.PI / 2 + i) * 2;
      s.chain([[x0, 18], [x0 + w, 23], [x0 - w * 0.5, 27], [x0 + w, 30]], 1.6, 0.5, flesh); s.np();
    }
    s.ball(15, 12, 9.5, 9, '#f0e6f4', { m: { gloss: true } }); s.np();
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4; s.line(15 + Math.cos(a) * 8, 12 + Math.sin(a) * 7.5, 15 + Math.cos(a) * 5, 12 + Math.sin(a) * 4.5, '#d84a6a', 0.5); }
    s.np();
    const blink = f === 3;
    if (!blink) {
      s.ball(15, 13, 4.6, 4.6, '#9a4ae0', { m: { gloss: true } }); s.np();
      s.ball(15, 13, 1.8, 3, '#14081e', { flatS: 0 });
    } else {
      s.ball(15, 12, 9.5, 9, flesh, { half: 'top' }); s.ball(15, 12, 9.5, 3, flesh, { half: 'bottom' });
    }
  }, { fly: 12 });

  def('shadowknight', 36, 46, 18, 44, 4, (s, f) => {
    const cx = 18, b = (f % 2) ? -1 : 0, lf = f === 1 ? -2 : 0, rf = f === 3 ? -2 : 0;
    const arm = PX.mat('#3a3456', { gloss: true, n: 7 }), cape = '#24183a';
    s.poly([[cx - 7, 26 + b], [cx + 7, 26 + b], [cx + 10, 43], [cx + 5, 41], [cx + 1, 44], [cx - 3, 41], [cx - 9, 43]], cape, 0.3); s.np();
    s.cyl(cx - 2.6, 35 + b, cx - 2.6, 41 + lf, 2.4, 2.2, arm); s.box(cx - 5.5, 41 + lf, 6, 3, arm); s.np();
    s.cyl(cx + 2.6, 35 + b, cx + 2.6, 41 + rf, 2.4, 2.2, arm); s.box(cx, 41 + rf, 6, 3, arm); s.np();
    s.ball(cx, 30.5 + b, 7, 6.4, arm); s.np();
    s.rect(cx - 1, 26 + b, 2, 9, emit('#a06aff'), 0.5); s.np();
    s.ball(cx - 7.5, 26.5 + b, 3.4, 2.8, arm); s.ball(cx + 7.5, 26.5 + b, 3.4, 2.8, arm); s.np();
    s.cyl(cx - 8, 28 + b, cx - 8.5, 33 + b, 2, 1.8, arm); s.cyl(cx + 8, 28 + b, cx + 8.5, 33 + b, 2, 1.8, arm); s.np();
    s.cyl(cx + 9, 34 + b, cx + 9, 12 + b, 1.3, 0.6, PX.mat('#c8b8ff', { gloss: true, n: 7 })); s.np();
    s.rect(cx + 6, 33 + b, 7, 2, M.gold, 0.6); s.np();
    s.ball(cx, 19 + b, 7.2, 7, arm); s.np();
    s.poly([[cx - 2, 12 + b], [cx + 2, 12 + b], [cx + 1, 6 + b], [cx - 1, 6 + b]], '#7a3aa8', 0.6); s.np();
    s.rect(cx - 5, 19 + b, 10, 2, '#0a0812', 0);
    s.rect(cx - 4, 19 + b, 3, 1, emit('#5af0ff'), 1); s.rect(cx + 1, 19 + b, 3, 1, emit('#5af0ff'), 1);
  });

  def('starling', 28, 28, 14, 26, 4, (s, f) => {
    const rot = -Math.PI / 2 + f * 0.12;
    s.star(14, 13, 11, 4.8, 5, rot, PX.mat('#ffd86a', { gloss: true, n: 7 })); s.np();
    s.ball(14, 13, 4.4, 4.2, '#fff0b0', { m: { gloss: true } }); s.np();
    s.rect(11, 12, 2, 2, M.eye, 0); s.rect(15, 12, 2, 2, M.eye, 0);
    s.px(13, 15, M.eye, 0); s.px(14, 15, M.eye, 0);
  }, { fly: 12 });

  def('tentacle', 26, 40, 13, 38, 4, (s, f) => {
    const portal = PX.mat('#1a0a2e', { noAO: true });
    s.ball(13, 36, 11, 3.4, portal, { flatS: 0.3 }); s.np();
    s.ball(13, 36, 11, 3.4, emit('#b04aff'), { flatS: 0.9 }); s.ball(13, 36, 9, 2.4, portal, { flatS: 0.1 }); s.np();
    const pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([13 + Math.sin(t * 3.2 + f * Math.PI / 2) * 4 * t, 36 - t * 30]); }
    s.chain(pts, 4.2, 1.2, '#8a4ab8', { tex: (x, y) => ((y % 4) ? 0 : -0.15) }); s.np();
    for (let i = 1; i < 6; i++) { const p = pts[i]; s.px(p[0] + 1, p[1], '#e0b0ff', 0.7); }
  });

  /* ───────── 보스 ───────── */
  // 1. 포자왕 (5층)
  def('b_sporeking', 100, 96, 50, 92, 4, (s, f) => {
    const br = [0, 1, 2, 1][f];
    const cream = '#f0e2c0', red = '#c8342e';
    s.ball(36, 88, 9, 5, '#c9b48a'); s.ball(64, 88, 9, 5, '#c9b48a'); s.np();
    s.cyl(28, 64, 18, 76 + br, 5, 4.5, cream); s.ball(17, 78 + br, 6, 5.5, cream); s.np();
    s.ball(50, 68, 21, 20 - br * 0.5, cream, { tex: nz(41, 0.08) }); s.np();
    s.cyl(72, 64, 82, 76 + br, 5, 4.5, cream, { bias: -0.08 }); s.ball(83, 78 + br, 6, 5.5, cream, { bias: -0.08 }); s.np();
    // 얼굴
    s.poly([[37, 60], [47, 63], [46, 67], [38, 66]], M.eye, 0); s.poly([[63, 60], [53, 63], [54, 67], [62, 66]], M.eye, 0);
    const gl = emit('#ffe24a');
    s.rect(41, 64, 3, 2, gl, 1); s.rect(56, 64, 3, 2, gl, 1);
    s.ball(50, 76, 8, 4.5, '#3a1418', { flatS: 0.2 }); s.np();
    for (let x = 44; x <= 56; x += 3) s.poly([[x, 72], [x + 2, 72], [x + 1, 75]], M.bone, 0.9);
    s.np();
    s.ball(50, 46 + br, 34, 8, '#a88660', { bias: -0.12, tex: (x) => (x % 3 ? 0 : -0.15) }); s.np();
    s.ball(50, 34 + br, 46, 22, red, { half: 'top', m: { gloss: true, n: 7 } });
    s.ball(50, 34 + br, 46, 10, red, { half: 'bottom', bias: -0.15 }); s.np();
    for (const [x, y, r] of [[24, 30, 5], [40, 20, 6.5], [60, 18, 5.5], [78, 30, 5], [50, 33, 4], [32, 38, 3.4], [70, 39, 3.4], [88, 38, 2.8], [12, 38, 2.8]]) s.ball(x, y + br, r, r * 0.85, '#fbf3e4', { m: { gloss: true } });
    s.np();
    s.poly([[38, 15 + br], [36, 3 + br], [42, 9 + br], [46, 0 + br], [50, 8 + br], [54, 0 + br], [58, 9 + br], [64, 3 + br], [62, 15 + br]], M.gold, (x, y) => 0.75 - (y - br) * 0.015 - (x - 50) * 0.01); s.np();
    for (const x of [44, 50, 56]) s.ball(x, 12 + br, 1.6, 1.6, PX.mat('#4ae0ff', { gloss: true }));
  });

  // 2. 고목 수호자 (10층)
  def('b_treant', 116, 120, 58, 116, 4, (s, f) => {
    const sw = Math.sin(f * Math.PI / 2) * 2;
    const bark = '#6a4a32', bt = (x, y) => (U.hash2(x >> 1, y >> 3, 51) - 0.5) * 0.25 + ((x % 4) === 0 ? -0.15 : 0);
    for (const [dx, sy] of [[-1, 1], [1, 1], [-0.5, 0.6], [0.6, 0.5]]) s.chain([[58 + dx * 10, 104], [58 + dx * 22, 110], [58 + dx * 34 * sy, 114]], 5, 2, '#4a3222', { tex: bt });
    s.np();
    s.cyl(58, 108, 58, 52, 22, 17, bark, { tex: bt }); s.np();
    for (const [x, y, r] of [[42, 92, 6], [72, 80, 5], [50, 62, 4]]) s.ball(x, y, r, r * 0.6, '#5a8a3a', { tex: nz(53, 0.2) });
    s.np();
    s.ball(48, 72, 6, 4.5, '#1a100c', { flatS: 0.1 }); s.ball(68, 72, 6, 4.5, '#1a100c', { flatS: 0.1 }); s.np();
    const gl = emit('#c8ff5a');
    s.ball(49, 72, 2.4, 2.2, gl, { flatS: 1 }); s.ball(67, 72, 2.4, 2.2, gl, { flatS: 1 }); s.np();
    s.poly([[46, 86], [52, 83], [58, 87], [64, 83], [70, 86], [66, 94], [58, 91], [50, 94]], '#1a100c', 0.1); s.np();
    // 가지 팔
    s.chain([[40, 66], [26, 58 + sw], [14, 44 + sw], [10, 30 + sw]], 6, 3, bark, { tex: bt });
    s.chain([[26, 58 + sw], [16, 64 + sw]], 3, 1.5, bark); s.np();
    s.chain([[76, 66], [90, 58 - sw], [102, 44 - sw], [106, 30 - sw]], 6, 3, bark, { tex: bt, bias: -0.06 });
    s.chain([[90, 58 - sw], [100, 64 - sw]], 3, 1.5, bark); s.np();
    const leaf = '#4e9a3a', lt = (x, y) => (U.hash2(x >> 1, y >> 1, 57) - 0.5) * 0.35;
    s.ball(10, 26 + sw, 11, 9, leaf, { tex: lt }); s.ball(106, 26 - sw, 11, 9, leaf, { tex: lt, bias: -0.05 }); s.np();
    s.ball(58, 34, 34, 22, leaf, { tex: lt }); s.np();
    s.ball(34, 42, 18, 13, '#3e8a34', { tex: lt }); s.ball(82, 42, 18, 13, '#3e8a34', { tex: lt, bias: -0.08 }); s.np();
    s.ball(58, 18, 22, 14, '#5aae44', { tex: lt }); s.np();
    for (const [x, y] of [[40, 28], [66, 14], [80, 34], [52, 40], [24, 40], [92, 44], [6, 22], [104, 24]]) s.ball(x, y, 2, 2, '#ff8ab0', { m: { gloss: true } });
  });

  // 3. 사막 군주 전갈 (15층)
  def('b_scorpion', 132, 92, 66, 86, 4, (s, f) => {
    const ph = f * Math.PI / 2, sh = '#7a3a6a', shm = { gloss: true, n: 7 };
    for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
      const l = Math.sin(ph + i + (side > 0 ? 1.5 : 0)) * 2.5, bx = 66 + side * 16, by = 60 + i * 6;
      s.chain([[bx, by], [bx + side * 22, by - 6 + l], [bx + side * 34, by + 14 + l]], 2.4, 1.2, '#5a2a4e');
    }
    s.np();
    // 꼬리(몸 뒤에서 위로)
    const tw = Math.sin(ph) * 3;
    s.chain([[66, 52], [62, 36], [64, 20], [74 + tw, 10], [86 + tw, 12]], 7, 4.5, sh, { m: shm, tex: (x, y) => (y % 7 === 0 ? -0.2 : 0) }); s.np();
    s.chain([[86 + tw, 12], [92 + tw, 20], [90 + tw, 27]], 3.4, 0.6, '#2a1426', { m: shm }); s.np();
    s.ball(66, 62, 24, 14, sh, { m: shm, tex: (x) => ((x % 8) === 0 ? -0.22 : 0) }); s.np();
    s.ball(66, 72, 14, 9, sh, { m: shm }); s.np();
    for (const side of [-1, 1]) {
      const cl = Math.sin(ph * 2) * 2;
      s.chain([[66 + side * 12, 72], [66 + side * 26, 76], [66 + side * 36, 72 + cl]], 4.5, 4, sh, { m: shm });
      s.ball(66 + side * 44, 72 + cl, 11, 8.5, sh, { m: shm });
      s.poly([[66 + side * 48, 64 + cl], [66 + side * 63, 62 + cl], [66 + side * 54, 72 + cl]], sh, 0.6);
      s.poly([[66 + side * 48, 77 + cl], [66 + side * 62, 84 + cl], [66 + side * 46, 82 + cl]], sh, 0.4);
      s.np();
    }
    const gl = emit('#ff4a5a');
    for (const [x, y] of [[61, 70], [71, 70], [58, 73], [74, 73], [66, 68]]) s.rect(x, y, 2, 2, gl, 1);
    for (let i = 0; i < 5; i++) s.ball(50 + i * 8, 58 - (i === 2 ? 2 : 0), 2, 1.6, '#e8c070', { m: shm });
  });

  // 4. 태양왕 (20층)
  def('b_pharaoh', 96, 116, 48, 112, 4, (s, f) => {
    const fl = [0, -1, -2, -1][f];
    const sun = emit('#ffb83a');
    for (let i = 0; i < 12; i++) { const a = i / 12 * U.TAU + f * 0.06; s.poly([[48 + Math.cos(a - 0.12) * 22, 30 + fl + Math.sin(a - 0.12) * 22], [48 + Math.cos(a) * 36, 30 + fl + Math.sin(a) * 36], [48 + Math.cos(a + 0.12) * 22, 30 + fl + Math.sin(a + 0.12) * 22]], sun, 0.6); }
    s.ball(48, 30 + fl, 24, 24, sun, { flatS: 0.85 }); s.np();
    const linen = '#efe8d4', blue = '#2a4ab8';
    s.poly([[34, 50 + fl], [62, 50 + fl], [70, 96 + fl], [60, 106 + fl], [48, 100 + fl], [36, 106 + fl], [26, 96 + fl]], linen, (x, y) => 0.6 - (x - 48) * 0.012 + ((x % 6) === 0 ? -0.12 : 0)); s.np();
    s.poly([[42, 62 + fl], [54, 62 + fl], [56, 92 + fl], [40, 92 + fl]], blue, (x, y) => 0.5 + ((y % 6) < 3 ? 0.1 : -0.1)); s.np();
    s.ball(48, 52 + fl, 20, 9, M.gold, { half: 'bottom' });
    for (let i = 0; i < 3; i++) s.ball(48, 52 + fl, 18 - i * 5, 7 - i * 2, i % 2 ? blue : '#d83a3a', { half: 'bottom' });
    s.np();
    s.cyl(28, 52 + fl, 30, 66 + fl, 3.4, 3, linen); s.cyl(68, 52 + fl, 66, 66 + fl, 3.4, 3, linen); s.np();
    s.cyl(30, 66 + fl, 46, 70 + fl, 3, 2.8, '#c8905a'); s.cyl(66, 66 + fl, 50, 70 + fl, 3, 2.8, '#c8905a'); s.np();
    s.chain([[40, 78 + fl], [40, 48 + fl], [36, 42 + fl], [32, 46 + fl]], 1.6, 1.6, M.gold); s.np();
    s.cyl(56, 78 + fl, 58, 50 + fl, 1.5, 1.5, blue); for (let i = 0; i < 3; i++) s.chain([[58, 50 + fl], [62 + i * 2, 54 + fl], [63 + i * 3, 60 + fl]], 1, 1, M.gold);
    s.np();
    // 두건
    const nemes = (x, y) => 0.6 + ((y % 5) < 2 ? -0.25 : 0.05) - (x - 48) * 0.01;
    s.poly([[34, 24 + fl], [62, 24 + fl], [68, 50 + fl], [60, 54 + fl], [48, 40 + fl], [36, 54 + fl], [28, 50 + fl]], '#3a5ad8', nemes); s.np();
    s.ball(48, 26 + fl, 15, 12, M.gold, { half: 'top' }); s.np();
    s.ball(48, 34 + fl, 10, 11, PX.mat('#e8b448', { gloss: true, n: 7 }), { nk: 0.6, amb: 0.35 }); s.np();
    const gl = emit('#5af0ff');
    for (const ex of [41, 51]) { s.rect(ex, 31 + fl, 6, 3, M.eye, 0); s.rect(ex + 1, 32 + fl, 4, 1, M.white, 1); s.px(ex + 2, 32 + fl, gl, 1); s.px(ex + 3, 32 + fl, gl, 1); }
    s.line(40, 33 + fl, 38, 35 + fl, M.eye, 0); s.line(57, 33 + fl, 59, 35 + fl, M.eye, 0);
    s.line(46, 39 + fl, 50, 39 + fl, '#8a5a20', 0.3);
    s.cyl(48, 43 + fl, 48, 48 + fl, 1.8, 1.4, blue); s.np();
    s.ball(48, 17 + fl, 3, 3.4, M.gold); s.ball(48, 16 + fl, 1.4, 1.4, PX.mat('#3af07a', { gloss: true }));
  }, { fly: 6 });

  // 5. 서리 예티 (25층)
  def('b_yeti', 104, 104, 52, 100, 4, (s, f) => {
    const br = [0, 1, 2, 1][f];
    const fw = '#e8f0fa', ft = fur(61, 0.28);
    s.cyl(36, 80, 34, 96, 9, 8, fw, { tex: ft }); s.cyl(68, 80, 70, 96, 9, 8, fw, { tex: ft, bias: -0.08 }); s.np();
    s.ball(34, 97, 9, 4, '#7a8aa8'); s.ball(70, 97, 9, 4, '#7a8aa8'); s.np();
    s.ball(52, 62 + br * 0.5, 31, 26 - br * 0.5, fw, { tex: ft }); s.np();
    s.ball(52, 70, 17, 14, '#c8d8ea', { tex: fur(62, 0.15) }); s.np();
    s.cyl(24, 46, 14, 80 + br, 9, 10, fw, { tex: ft }); s.ball(13, 86 + br, 11, 9, '#8a9ab8', { tex: nz(63, 0.15) }); s.np();
    s.cyl(80, 46, 90, 80 + br, 9, 10, fw, { tex: ft, bias: -0.08 }); s.ball(91, 86 + br, 11, 9, '#8a9ab8', { tex: nz(64, 0.15), bias: -0.06 }); s.np();
    s.ball(52, 34 + br, 17, 15, fw, { tex: ft }); s.np();
    s.ball(52, 39 + br, 11, 9, '#7a8cae'); s.np();
    s.poly([[42, 33 + br], [49, 36 + br], [48, 39 + br], [42, 37 + br]], M.eye, 0); s.poly([[62, 33 + br], [55, 36 + br], [56, 39 + br], [62, 37 + br]], M.eye, 0);
    const gl = emit('#6af6ff'); s.rect(45, 36 + br, 2, 2, gl, 1); s.rect(57, 36 + br, 2, 2, gl, 1);
    s.ball(52, 44 + br, 6, 2.6, '#2a1a28', { flatS: 0.15 }); s.np();
    s.poly([[47, 42 + br], [49, 42 + br], [48, 46 + br]], M.white, 1); s.poly([[55, 42 + br], [57, 42 + br], [56, 46 + br]], M.white, 1);
    const horn = PX.mat('#9ae4ff', { gloss: true, n: 7 });
    s.chain([[40, 24 + br], [32, 18 + br], [30, 10 + br], [34, 6 + br]], 3.6, 1, horn); s.chain([[64, 24 + br], [72, 18 + br], [74, 10 + br], [70, 6 + br]], 3.6, 1, horn);
  });

  // 6. 빙결의 여왕 (30층)
  def('b_queen', 84, 116, 42, 112, 4, (s, f) => {
    const fl = [0, -1, -2, -1][f];
    const gown = '#6aa8e8', gt = (x, y) => ((x + (y >> 2)) % 7 === 0 ? 0.18 : 0) - (y - 60) * 0.004;
    s.ball(42, 34 + fl, 13, 20, '#8eb4e8', { bias: -0.12 }); s.np();
    s.poly([[32, 52 + fl], [52, 52 + fl], [70, 100 + fl], [62, 108 + fl], [52, 102 + fl], [42, 110 + fl], [32, 102 + fl], [22, 108 + fl], [14, 100 + fl]], gown, (x, y) => 0.55 - (x - 42) * 0.01 + gt(x, y)); s.np();
    s.poly([[20, 96 + fl], [30, 100 + fl], [42, 98 + fl], [54, 100 + fl], [64, 96 + fl], [70, 100 + fl], [62, 108 + fl], [52, 102 + fl], [42, 110 + fl], [32, 102 + fl], [22, 108 + fl], [14, 100 + fl]], '#c8ecff', 0.7, { m: { gloss: true } }); s.np();
    s.ball(42, 52 + fl, 8, 9, gown); s.np();
    s.rect(38, 56 + fl, 9, 2, M.gold, 0.7); s.np();
    s.cyl(34, 46 + fl, 24, 58 + fl, 2.2, 1.8, '#f0e8f4'); s.cyl(50, 46 + fl, 62, 52 + fl, 2.2, 1.8, '#f0e8f4'); s.np();
    s.cyl(64, 62 + fl, 64, 26 + fl, 1.4, 1.2, '#c0d8f0'); s.np();
    const crys = PX.mat('#9af0ff', { gloss: true, n: 7 });
    s.poly([[64, 30 + fl], [60, 22 + fl], [64, 12 + fl], [68, 22 + fl]], crys, (x, y) => 0.8 - (x - 60) * 0.06); s.np();
    s.ball(42, 34 + fl, 7.5, 8, '#f6e2ea', { nk: 0.55, amb: 0.4 }); s.np();
    s.cyl(34, 34 + fl, 30, 54 + fl, 3, 2, '#9ac0f0'); s.cyl(50, 34 + fl, 54, 54 + fl, 3, 2, '#9ac0f0', { bias: -0.1 }); s.np();
    s.poly([[34, 29 + fl], [50, 29 + fl], [50, 33 + fl], [46, 31 + fl], [42, 33 + fl], [38, 31 + fl], [34, 33 + fl]], '#9ac0f0', 0.75); s.np();
    const gl = emit('#4ae8ff');
    s.rect(38, 35 + fl, 2, 2, gl, 1); s.rect(44, 35 + fl, 2, 2, gl, 1);
    s.px(42, 39 + fl, PX.mat('#9a5ab8', { flat: true }), 0.5);
    for (let i = 0; i < 5; i++) { const x = 34 + i * 4, h = [6, 9, 13, 9, 6][i]; s.poly([[x - 1.5, 27 + fl], [x, 27 + fl - h], [x + 1.5, 27 + fl]], crys, 0.8); }
    s.np();
    for (let i = 0; i < 3; i++) { const a = f * 0.4 + i * 2.1, x = 42 + Math.cos(a) * 32, y = 60 + fl + Math.sin(a) * 10; s.poly([[x, y - 5], [x + 2.5, y], [x, y + 5], [x - 2.5, y]], crys, 0.8); }
  }, { fly: 8 });

  // 7. 용광로 거인 (35층)
  def('b_golem', 120, 116, 60, 112, 4, (s, f) => {
    const br = [0, 1, 2, 1][f];
    const iron = PX.mat('#4a4a5e', { gloss: true, n: 7 }), dark = PX.mat('#2e2e3c', { n: 6 });
    s.cyl(44, 84, 42, 104, 8, 9, iron); s.box(32, 102, 20, 8, iron, { bevel: 2 }); s.np();
    s.cyl(76, 84, 78, 104, 8, 9, iron, { bias: -0.1 }); s.box(68, 102, 20, 8, iron, { bevel: 2 }); s.np();
    s.box(30, 40 + br, 60, 48, iron, { bevel: 3, round: 6, tex: nz(71, 0.08) }); s.np();
    for (const [x, y] of [[34, 44], [85, 44], [34, 83], [85, 83], [60, 44]]) s.ball(x, y + br, 1.6, 1.6, M.steel);
    s.np();
    s.box(42, 54 + br, 36, 24, dark, { bevel: 2, round: 4, base: 0.3 }); s.np();
    const fire = emit('#ff8a2a');
    s.box(45, 57 + br, 30, 18, fire, { bevel: 0, round: 3, base: 0.75, tex: (x, y) => (U.hash2(x >> 1, (y + f * 3) >> 1, 72) - 0.5) * 0.5 }); s.np();
    for (let i = 0; i < 5; i++) s.rect(48 + i * 6, 56 + br, 2, 20, dark, 0.45);
    s.np();
    s.ball(26, 44 + br, 12, 11, iron); s.ball(94, 44 + br, 12, 11, iron, { bias: -0.08 }); s.np();
    s.cyl(22, 54 + br, 16, 78 + br, 7, 8, iron); s.ball(15, 82 + br, 9, 8, iron); s.np();
    s.cyl(98, 54 + br, 104, 72 + br, 7, 7, iron, { bias: -0.08 });
    s.cyl(104, 72 + br, 104, 96 + br, 2.6, 2.6, '#6a4a32');
    s.box(92, 88 + br, 26, 18, iron, { bevel: 2, round: 2 }); s.np();
    s.box(48, 22 + br, 24, 20, iron, { bevel: 2, round: 4 }); s.np();
    s.rect(52, 30 + br, 16, 4, '#0e0e14', 0); s.rect(54, 31 + br, 12, 2, fire, 1); s.np();
    s.cyl(38, 40 + br, 36, 16 + br, 4, 4, dark); s.cyl(82, 40 + br, 84, 18 + br, 4, 4, dark);
    s.ball(36, 16 + br, 4.6, 2, '#1a1a24'); s.ball(84, 18 + br, 4.6, 2, '#1a1a24');
  });

  // 8. 화염룡 이그니스 (40층)
  def('b_dragon', 156, 124, 78, 118, 4, (s, f) => {
    const wf = [0, -4, -7, -4][f];
    const red = '#c83a2a', scale = (x, y) => (((x >> 1) + (y >> 1)) % 3 === 0 ? -0.12 : 0) + (U.hash2(x, y, 81) - 0.5) * 0.08;
    const memb = PX.mat('#7a1e2a', { n: 6 });
    for (const sd of [-1, 1]) {
      const wx = (x) => 78 + sd * x;
      s.poly([[wx(18), 62], [wx(40), 30 + wf], [wx(70), 14 + wf * 1.5], [wx(76), 34 + wf], [wx(70), 52 + wf * 0.6], [wx(58), 60], [wx(44), 70], [wx(28), 74]], memb, (x, y) => 0.45 + (y - 14) * -0.003 + (sd > 0 ? -0.05 : 0));
      s.np();
      s.chain([[wx(18), 62], [wx(40), 30 + wf], [wx(70), 14 + wf * 1.5]], 3.2, 1.6, red);
      s.line(wx(40), 30 + wf, wx(58), 60, red, 0.5); s.line(wx(40), 30 + wf, wx(44), 70, red, 0.5); s.line(wx(70), 14 + wf * 1.5, wx(70), 52 + wf * 0.6, red, 0.5);
      s.np();
    }
    s.chain([[90, 100], [112, 108], [130, 104], [144, 94]], 9, 3, red, { tex: scale }); s.poly([[140, 90], [152, 86], [148, 98]], '#f0d8a0', 0.6); s.np();
    s.cyl(60, 92, 56, 110, 7, 6, red, { tex: scale }); s.cyl(96, 92, 100, 110, 7, 6, red, { tex: scale, bias: -0.1 }); s.np();
    for (const x of [50, 56, 62, 94, 100, 106]) s.poly([[x - 2, 109], [x, 116], [x + 2, 109]], '#f0e0c0', 0.7);
    s.np();
    s.ball(78, 80, 28, 25, red, { tex: scale }); s.np();
    s.ball(78, 86, 15, 18, '#f0c890', { tex: (x, y) => (y % 4 === 0 ? -0.25 : 0) }); s.np();
    s.chain([[78, 62], [76, 48], [78, 36]], 11, 9, red, { tex: scale }); s.np();
    s.ball(78, 28, 15, 12, red, { tex: scale }); s.np();
    s.ball(78, 36, 10, 7, red, { tex: scale }); s.np();
    s.chain([[68, 20], [60, 12], [56, 2]], 3.4, 1, '#f0e0c0'); s.chain([[88, 20], [96, 12], [100, 2]], 3.4, 1, '#f0e0c0'); s.np();
    const gl = emit('#ffe04a');
    s.poly([[66, 25], [74, 27], [73, 30], [67, 29]], gl, 1); s.poly([[90, 25], [82, 27], [83, 30], [89, 29]], gl, 1);
    s.px(70, 28, M.eye, 0); s.px(86, 28, M.eye, 0);
    s.ball(78, 41, 7, 2.6, '#3a0a10', { flatS: 0.2 }); s.np();
    for (let x = 73; x <= 83; x += 3) s.poly([[x, 39], [x + 1.5, 39], [x + 0.7, 42]], M.white, 1);
    s.ball(74, 36, 1, 1, M.eye); s.ball(82, 36, 1, 1, M.eye);
    for (let i = 0; i < 5; i++) s.poly([[76, 50 + i * 8 - 4], [78, 50 + i * 8 - 9], [80, 50 + i * 8 - 4]], '#f0d8a0', 0.7);
  });

  // 9. 심연의 감시자 (45층)
  def('b_watcher', 112, 112, 56, 108, 4, (s, f) => {
    const flesh = '#5a2a6a', ft = (x, y) => (U.hash2(x >> 1, y >> 1, 91) - 0.5) * 0.18;
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (0.15 + 0.7 * i / 7), ph = f * Math.PI / 2 + i;
      const x0 = 56 + Math.cos(a) * 26, y0 = 62 + Math.sin(a) * 20;
      const pts = []; for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push([x0 + Math.cos(a) * t * 30 + Math.sin(ph + t * 3) * 4, y0 + Math.sin(a) * t * 34 + t * 8]); }
      s.chain(pts, 4.2, 1, flesh, { tex: ft }); s.np();
    }
    for (let i = 0; i < 10; i++) { const a = i / 10 * U.TAU; s.poly([[56 + Math.cos(a - 0.15) * 34, 50 + Math.sin(a - 0.15) * 32], [56 + Math.cos(a) * 46, 50 + Math.sin(a) * 44], [56 + Math.cos(a + 0.15) * 34, 50 + Math.sin(a + 0.15) * 32]], '#3a1a4a', 0.4); }
    s.np();
    s.ball(56, 50, 36, 34, flesh, { tex: ft }); s.np();
    const open = f === 3 ? 0.55 : 1;
    s.ball(56, 50, 30, 24 * open, '#f2e6ee', { m: { gloss: true, n: 7 } }); s.np();
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, r1 = 28, r2 = 15; s.chain([[56 + Math.cos(a) * r1, 50 + Math.sin(a) * r1 * 0.8 * open], [56 + Math.cos(a + 0.2) * (r1 + r2) / 2, 50 + Math.sin(a + 0.2) * (r1 + r2) / 2 * 0.8 * open], [56 + Math.cos(a) * r2, 50 + Math.sin(a) * r2 * open]], 0.6, 0.6, '#d0405a', { flatS: 0.6 }); }
    s.np();
    s.ball(56, 50, 14, 14 * open, '#e8a020', { m: { gloss: true, n: 7 }, tex: (x, y) => (Math.round(Math.atan2(y - 50, x - 56) * 6) % 2 ? -0.15 : 0.05) }); s.np();
    s.ball(56, 50, 4, 10 * open, '#0e0414', { flatS: 0 }); s.np();
    s.px(50, 44, M.white, 1); s.px(51, 44, M.white, 1); s.px(50, 45, M.white, 1);
    s.ball(56, 26 + (1 - open) * 10, 32, 8, flesh, { half: 'bottom', tex: ft, bias: -0.1 });
    s.ball(56, 74 - (1 - open) * 10, 32, 8, flesh, { half: 'top', tex: ft, bias: 0.05 });
  }, { fly: 10 });

  // 10. 별을 삼킨 자 (50층)
  def('b_devourer', 140, 144, 70, 140, 4, (s, f) => {
    const fl = [0, -1, -2, -1][f];
    const vm = PX.mat('#1c1236', { n: 6 }), star = emit('#ffe8ff');
    const halo = emit('#c88aff');
    for (let i = 0; i < 48; i++) { const a = i / 48 * U.TAU + f * 0.03; if (i % 3) s.px(70 + Math.cos(a) * 56, 46 + fl + Math.sin(a) * 40, halo, 0.8); else s.ball(70 + Math.cos(a) * 56, 46 + fl + Math.sin(a) * 40, 1.6, 1.6, star, { flatS: 1 }); }
    s.np();
    const cloak = (x, y) => 0.5 - (x - 70) * 0.006 - (y - 60) * 0.002;
    s.poly([[44, 52 + fl], [96, 52 + fl], [118, 124 + fl], [104, 134 + fl], [92, 126 + fl], [80, 138 + fl], [70, 128 + fl], [60, 138 + fl], [48, 126 + fl], [36, 134 + fl], [22, 124 + fl]], vm, cloak); s.np();
    sprinkle(s, vm, star, 0.05, 101);
    s.np();
    // 팔
    for (const sd of [-1, 1]) {
      const w = Math.sin(f * Math.PI / 2) * 3 * sd;
      s.chain([[70 + sd * 24, 58 + fl], [70 + sd * 44, 72 + fl + w], [70 + sd * 54, 94 + fl + w]], 6, 4, vm, { bias: sd > 0 ? -0.1 : 0 });
      for (let k = -1; k <= 1; k++) s.chain([[70 + sd * 54, 94 + fl + w], [70 + sd * (58 + k * 3), 104 + fl + w], [70 + sd * (60 + k * 5), 110 + fl + w]], 1.8, 0.4, '#d8c8ff');
      s.np();
    }
    sprinkle(s, vm, star, 0.04, 103);
    // 가슴의 아가리
    const maw = emit('#ff6ae0');
    s.ball(70, 80 + fl, 8, 18, '#0a0414', { flatS: 0 }); s.np();
    s.ball(70, 80 + fl, 4, 13, maw, { flatS: 0.9 }); s.np();
    for (let i = 0; i < 6; i++) { const y = 66 + i * 5 + fl; s.poly([[62, y], [67, y + 1.5], [62, y + 3]], M.white, 1); s.poly([[78, y], [73, y + 1.5], [78, y + 3]], M.white, 1); }
    s.np();
    // 머리
    s.ball(70, 40 + fl, 17, 18, vm, { bias: 0.08 }); s.np();
    sprinkle(s, vm, star, 0.03, 107);
    const horn = PX.mat('#e8dcff', { gloss: true, n: 7 });
    for (const sd of [-1, 1]) { s.chain([[70 + sd * 10, 26 + fl], [70 + sd * 20, 14 + fl], [70 + sd * 22, 2 + fl]], 3.6, 0.8, horn); s.chain([[70 + sd * 15, 32 + fl], [70 + sd * 28, 26 + fl], [70 + sd * 34, 16 + fl]], 2.6, 0.6, horn); }
    s.np();
    s.ball(70, 44 + fl, 11, 9, '#e8e0f8', { m: { gloss: true } }); s.np();
    const eye = emit('#b04aff');
    for (const [x, y, r] of [[64, 42, 2.6], [76, 42, 2.6], [70, 36, 2]]) { s.ball(x, y + fl, r + 0.8, r, '#0a0414', { flatS: 0 }); s.ball(x, y + fl, r * 0.6, r * 0.6, eye, { flatS: 1 }); }
    s.np();
    for (let x = 64; x <= 76; x += 3) s.line(x, 49 + fl, x, 52 + fl, '#0a0414', 0);
  }, { fly: 8 });

  /* ───────── 무기(따로 돌려 그림) ───────── */
  def('w_sword', 10, 30, 5, 26, 1, (s) => {
    s.poly([[5, 1], [7.5, 5], [7.5, 21], [2.5, 21], [2.5, 5]], PX.mat('#d8e2f4', { gloss: true, n: 7 }), (x, y) => x < 5 ? 0.9 : 0.55); s.np();
    s.rect(1, 21, 8, 2, M.gold, 0.7); s.np();
    s.rect(4, 23, 2, 5, '#5a3424', 0.5); s.np(); s.ball(5, 28.5, 1.6, 1.4, M.gold);
  });
  def('w_bow', 14, 30, 4, 15, 1, (s) => {
    s.chain([[3, 2], [8, 6], [10, 15], [8, 24], [3, 28]], 1.6, 1.6, '#8a5a30'); s.np();
    s.rect(9, 13, 3, 4, '#5a3424', 0.5); s.np();
    s.line(3, 2, 3, 28, PX.mat('#f0f0e0', { flat: true, noAO: true }), 1);
  });
  def('w_staff', 12, 36, 6, 30, 1, (s) => {
    s.cyl(6, 34, 6, 10, 1.4, 1.3, '#6a4a32'); s.np();
    s.chain([[6, 10], [3, 6], [4, 2], [8, 2], [9, 6], [6, 10]], 1.2, 1.2, M.gold); s.np();
    s.ball(6, 6, 2.6, 2.8, PX.mat('#c06aff', { gloss: true, n: 7 }));
  });

  /* ───────── 투사체·줍는 것 ───────── */
  const orbCache = new Map();
  function orb(hex, r) {
    const key = hex + r;
    if (orbCache.has(key)) return orbCache.get(key);
    const sz = Math.ceil(r * 2 + 4), s = new Spr(sz, sz), c = sz / 2;
    s.ball(c, c, r, r, PX.mat(hex, { gloss: true, noAO: true, n: 6, lt: 0.9 }), { amb: 0.45 });
    s.ball(c - r * 0.2, c - r * 0.2, r * 0.45, r * 0.45, PX.mat('#ffffff', { flat: true, noAO: true, alpha: 0.85 }), { flatS: 1 });
    const cv = s.render({ outline: U.rgbHex(...U.mix(U.hexRgb(hex), [10, 4, 20], 0.7)) });
    const res = { c: cv, ax: sz / 2, ay: sz / 2 };
    orbCache.set(key, res); return res;
  }
  def('p_arrow', 22, 7, 11, 3.5, 1, (s) => {
    s.line(2, 3, 17, 3, '#c8a070', 0.7); s.line(2, 4, 17, 4, '#8a6040', 0.4); s.np();
    s.poly([[16, 0.5], [21.5, 3.5], [16, 6.5]], M.steel, 0.8); s.np();
    s.poly([[1, 0.5], [5, 3], [1, 3]], '#f0f0f0', 0.8); s.poly([[1, 6.5], [5, 4], [1, 4]], '#d8d8d8', 0.5);
  });
  def('p_wave', 18, 30, 9, 15, 1, (s) => {
    const c = PX.mat('#c8f0ff', { noAO: true, alpha: 0.9, lt: 1, dither: 0 });
    for (let y = 0; y < 30; y++) for (let x = 0; x < 18; x++) {
      const d1 = Math.hypot(x - 0, (y - 15) * 0.95), d2 = Math.hypot(x + 6, (y - 15) * 0.95);
      if (d1 < 16 && d2 > 17) s.set(x, y, c, U.clamp((16 - d1) / 4, 0.3, 1));
    }
  }, { outline: '#4aa0e0' });
  def('p_shard', 16, 8, 8, 4, 1, (s) => { s.poly([[0, 4], [5, 1], [16, 4], [5, 7]], PX.mat('#aaf0ff', { gloss: true, noAO: true }), (x) => 0.5 + x * 0.03); });
  def('p_fire', 18, 12, 10, 6, 2, (s, f) => {
    const a = emit('#ff7a2a'), b2 = emit('#ffe08a');
    s.poly([[0, 6], [8, 1 + f], [16, 3], [18, 6], [16, 9], [8, 11 - f]], a, (x) => 0.4 + x * 0.03); s.np();
    s.ball(13, 6, 4, 3, b2, { flatS: 1 });
  }, { outline: '#7a1a0a' });
  def('p_star', 14, 14, 7, 7, 2, (s, f) => { s.star(7, 7, 6.5, 2.8, 4, f * Math.PI / 4, emit('#ffe8a0')); s.np(); s.ball(7, 7, 2, 2, PX.mat('#ffffff', { flat: true }), { flatS: 1 }); }, { outline: '#7a4a10' });
  def('p_rock', 16, 16, 8, 8, 1, (s) => { s.ball(8, 8, 6.5, 6, '#8a7a6a', { tex: nz(5, 0.25) }); });
  def('p_boulder', 34, 34, 17, 17, 1, (s) => { s.ball(17, 17, 15, 14, '#b8e0ff', { m: { gloss: true }, tex: nz(9, 0.15) }); s.np(); s.ball(13, 13, 6, 5, '#e8f8ff', { m: { gloss: true } }); });
  def('coin', 10, 10, 5, 5, 4, (s, f) => {
    const w = [4, 2.6, 0.9, 2.6][f];
    s.ball(5, 5, w, 4, M.gold, { amb: 0.35 });
    if (f !== 2) { s.np(); s.rect(5 - Math.max(0, w * 0.3), 3, Math.max(1, w * 0.5), 4, PX.mat('#fff0b0', { flat: true }), 1); }
  });
  def('heart', 14, 13, 7, 7, 1, (s) => {
    const r = PX.mat('#ff4a6a', { gloss: true, n: 7 });
    s.ball(4.5, 5, 3.5, 3.5, r); s.ball(9.5, 5, 3.5, 3.5, r); s.poly([[1.2, 6.2], [12.8, 6.2], [7, 12.4]], r, (x, y) => 0.6 - (y - 6) * 0.05 - (x - 7) * 0.02);
  });
  def('shard', 12, 14, 6, 7, 2, (s, f) => {
    const c = PX.mat('#a8f0ff', { gloss: true, n: 7 });
    s.poly([[6, 0.5], [11, 6], [6, 13.5], [1, 6]], c, (x, y) => (x < 6 ? 0.85 : 0.45) + (f ? 0.1 : 0) - y * 0.01);
    s.np(); s.line(6, 1, 6, 13, PX.mat('#ffffff', { flat: true }), 1);
  });

  /* ───────── 굽기 ───────── */
  const baked = new Map();
  function get(name, f = 0) {
    const d = D[name];
    if (!d) return null;
    const fi = ((f % d.n) + d.n) % d.n;
    const key = name + '|' + fi;
    let r = baked.get(key);
    if (!r) {
      const s = new Spr(d.w, d.h);
      d.draw(s, fi);
      const c = s.render({ outline: d.outline });
      r = { c, ax: d.ax, ay: d.ay, w: d.w, h: d.h, fly: d.fly || 0, n: d.n };
      baked.set(key, r);
    }
    return r;
  }
  const flashCache = new Map();
  function flash(name, f, rgb = [255, 255, 255]) {
    const g = get(name, f); if (!g) return null;
    const key = name + '|' + f + '|' + rgb.join(',');
    let c = flashCache.get(key);
    if (!c) { c = PX.silhouette(g.c, rgb); flashCache.set(key, c); }
    return c;
  }
  function warm() { for (const n of Object.keys(D)) for (let f = 0; f < D[n].n; f++) get(n, f); }

  return { get, flash, orb, warm, D, HEROES, M, emit, nz, fur, sprinkle };
})();
