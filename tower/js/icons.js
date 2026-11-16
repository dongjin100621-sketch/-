'use strict';
/* 강화·유물·스킬 아이콘(18×18 도트). ICONS.get(이름, 배율) → 캔버스, ICONS.url → data URL */

const ICONS = (() => {
  const { Spr } = PX;
  const G = PX.mat('#e0a838', { gloss: true, n: 7 }), STEEL = PX.mat('#c8d4ec', { gloss: true, n: 7 }), WOOD = PX.mat('#8a5a30');
  const red = PX.mat('#e8384a', { gloss: true, n: 7 }), blue = PX.mat('#5ab0ff', { gloss: true, n: 7 }), green = PX.mat('#5ad04a', { gloss: true, n: 7 }), purple = PX.mat('#a860ff', { gloss: true, n: 7 });
  const em = (h) => PX.mat(h, { noAO: true, n: 5, lt: 0.9, dk: 0.3, dither: 0 });
  const sword = (s, x0, y0, x1, y1) => { s.cyl(x0, y0, x1, y1, 1.6, 0.6, STEEL); s.np(); const a = Math.atan2(y1 - y0, x1 - x0), px = -Math.sin(a), py = Math.cos(a); s.line(x0 + px * 3, y0 + py * 3, x0 - px * 3, y0 - py * 3, G, 0.7); s.np(); s.cyl(x0, y0, x0 - Math.cos(a) * 3, y0 - Math.sin(a) * 3, 1, 1, WOOD); };
  const D = {
    power: (s) => { s.poly([[9, 1], [15, 7], [9, 17], [3, 7]], red, (x, y) => x < 9 ? 0.85 : 0.45 - y * 0.01); s.np(); s.line(9, 2, 9, 16, PX.mat('#ffd0d8', { flat: true }), 1); },
    haste: (s) => { s.poly([[10, 1], [4, 10], [9, 10], [7, 17], [14, 7], [9, 7]], PX.mat('#ffe04a', { gloss: true }), (x) => x < 9 ? 0.9 : 0.55); },
    swift: (s) => { s.chain([[3, 16], [7, 9], [12, 4], [16, 1]], 1, 1, WOOD); s.np(); s.poly([[4, 15], [6, 6], [14, 1], [12, 8]], PX.mat('#e8f4ff'), (x, y) => 0.8 - y * 0.02); },
    vigor: (s) => { s.ball(9, 11, 6, 6, green); s.np(); s.cyl(9, 5, 9, 1, 1, 1, PX.mat('#3a8a2a')); s.np(); s.ball(12, 3, 3, 1.6, green); },
    keen: (s) => { s.ball(9, 9, 8, 5, PX.mat('#f4f0ff')); s.np(); s.ball(9, 9, 3.5, 3.5, blue); s.np(); s.ball(9, 9, 1.5, 1.5, PX.mat('#101020', { flat: true }), { flatS: 0 }); },
    brutal: (s) => { s.poly([[2, 16], [8, 2], [10, 2], [7, 10], [12, 10], [16, 16]], red, (x) => 0.7 - x * 0.02); s.np(); s.px(8, 3, PX.mat('#fff', { flat: true }), 1); },
    heal: (s) => { s.ball(9, 11, 6, 6, PX.mat('#ff6a8a', { gloss: true, n: 7 })); s.np(); s.rect(7, 2, 4, 4, PX.mat('#c8e8ff'), 0.7); s.np(); s.rect(8, 8, 2, 6, PX.mat('#fff', { flat: true }), 1); s.rect(6, 10, 6, 2, PX.mat('#fff', { flat: true }), 1); },
    greed: (s) => { s.ball(6, 12, 5, 4.5, G); s.ball(12, 10, 5, 4.5, G); s.np(); s.ball(9, 6, 5, 4.5, G); s.np(); s.rect(8, 4, 2, 4, PX.mat('#fff0b0', { flat: true }), 1); },
    magnet: (s) => { s.chain([[4, 2], [4, 10], [9, 15], [14, 10], [14, 2]], 2.4, 2.4, red); s.np(); s.rect(2, 1, 5, 3, STEEL, 0.7); s.rect(12, 1, 5, 3, STEEL, 0.7); },
    guard: (s) => { s.poly([[3, 2], [15, 2], [15, 9], [9, 17], [3, 9]], STEEL, (x, y) => (x < 9 ? 0.8 : 0.5) - y * 0.01); s.np(); s.poly([[7, 5], [11, 5], [11, 9], [9, 12], [7, 9]], blue, 0.6); },
    multi: (s) => { for (const a of [-0.5, 0, 0.5]) { const ex = 9 + Math.sin(a) * 8, ey = 9 - Math.cos(a) * 8; s.cyl(9, 16, ex, ey, 0.8, 0.8, WOOD); s.np(); s.poly([[ex, ey - 2], [ex + 2, ey + 1], [ex - 2, ey + 1]], STEEL, 0.7); s.np(); } },
    pierce: (s) => { s.cyl(1, 15, 16, 2, 0.9, 0.9, WOOD); s.np(); s.poly([[17, 1], [12, 3], [15, 6]], STEEL, 0.8); s.np(); s.ball(8, 9, 3, 3, red, { m: {} }); },
    vamp: (s) => { s.poly([[4, 2], [14, 2], [12, 8], [9, 17], [6, 8]], PX.mat('#c81e3a', { gloss: true }), (x) => x < 9 ? 0.85 : 0.5); s.np(); s.px(7, 4, PX.mat('#fff', { flat: true }), 1); },
    burn: (s) => { s.poly([[9, 1], [14, 8], [13, 14], [9, 17], [5, 14], [4, 8], [7, 9]], em('#ff7a2a'), (x, y) => 0.4 + y * 0.03); s.np(); s.ball(9, 13, 2.5, 3, em('#ffe08a'), { flatS: 1 }); },
    frost: (s) => { const c = PX.mat('#9ae4ff', { gloss: true }); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; s.line(9 - Math.cos(a) * 7, 9 - Math.sin(a) * 7, 9 + Math.cos(a) * 7, 9 + Math.sin(a) * 7, c, 0.9); } s.np(); s.ball(9, 9, 2, 2, c); },
    dashcd: (s) => { for (let i = 0; i < 3; i++) { s.poly([[3 + i * 4, 3], [8 + i * 4, 9], [3 + i * 4, 15]], PX.mat(['#5a6aa8', '#8a9ad8', '#c8d8ff'][i]), 0.6); s.np(); } },
    dashstrike: (s) => { sword(s, 4, 14, 15, 3); s.np(); s.line(1, 9, 6, 9, PX.mat('#fff', { flat: true }), 1); s.line(2, 12, 6, 12, PX.mat('#fff', { flat: true }), 1); },
    skillcd: (s) => { s.ball(9, 9, 7, 7, purple); s.np(); s.ball(9, 9, 4, 4, PX.mat('#1a1030'), { flatS: 0.3 }); s.np(); s.line(9, 9, 9, 5, PX.mat('#fff', { flat: true }), 1); s.line(9, 9, 12, 9, PX.mat('#fff', { flat: true }), 1); },
    skillpow: (s) => { s.star(9, 9, 8, 3.5, 4, 0, em('#d8a0ff')); s.np(); s.ball(9, 9, 2.5, 2.5, PX.mat('#fff', { flat: true }), { flatS: 1 }); },
    thorns: (s) => { s.ball(9, 9, 5.5, 5.5, PX.mat('#4a8a36')); s.np(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s.poly([[9 + Math.cos(a - 0.3) * 5, 9 + Math.sin(a - 0.3) * 5], [9 + Math.cos(a) * 8.5, 9 + Math.sin(a) * 8.5], [9 + Math.cos(a + 0.3) * 5, 9 + Math.sin(a + 0.3) * 5]], PX.mat('#d8c8a8'), 0.7); } },
    regen: (s) => { s.ball(9, 9, 7, 7, PX.mat('#3a7a3a')); s.np(); s.rect(7, 4, 4, 10, PX.mat('#9aff9a', { flat: true }), 1); s.rect(4, 7, 10, 4, PX.mat('#9aff9a', { flat: true }), 1); },
    chain: (s) => { s.chain([[13, 1], [6, 8], [11, 9], [4, 17]], 1.4, 1, em('#bfe8ff')); s.np(); s.ball(13, 1.5, 1.5, 1.5, PX.mat('#fff', { flat: true })); },
    boom: (s) => { s.star(9, 10, 8, 4, 7, 0.2, em('#ff9a3a')); s.np(); s.ball(9, 10, 3.5, 3.5, em('#fff0a0'), { flatS: 1 }); },
    orbit: (s) => { const r = PX.mat('#c8b8ff', { flat: true }); for (let a = 0; a < 24; a++) s.px(9 + Math.cos(a / 24 * U.TAU) * 7, 9 + Math.sin(a / 24 * U.TAU) * 5, r, 0.6); s.np(); s.ball(9, 9, 2.5, 2.5, purple); s.np(); s.ball(15, 8, 2.4, 2.4, blue); s.ball(3, 10, 2.4, 2.4, blue); },
    shield: (s) => { s.ball(9, 9, 7.5, 8, PX.mat('#8ad8ff', { gloss: true, alpha: 0.85 })); s.np(); s.poly([[9, 4], [13, 6], [12, 11], [9, 14], [6, 11], [5, 6]], PX.mat('#e8f8ff'), 0.7); },
    berserk: (s) => { s.ball(9, 10, 7, 6.5, red); s.np(); s.poly([[4, 6], [8, 9], [4, 9]], PX.mat('#1a0a10', { flat: true }), 0); s.poly([[14, 6], [10, 9], [14, 9]], PX.mat('#1a0a10', { flat: true }), 0); s.rect(6, 13, 6, 1, PX.mat('#1a0a10', { flat: true }), 0); },
    giant: (s) => { s.poly([[2, 16], [2, 10], [8, 16]], STEEL, 0.6); s.poly([[16, 2], [16, 8], [10, 2]], STEEL, 0.8); s.np(); s.line(3, 15, 15, 3, PX.mat('#fff', { flat: true }), 1); },
    focus: (s) => { const c = PX.mat('#ff5a5a', { flat: true }); for (let a = 0; a < 30; a++) s.px(9 + Math.cos(a / 30 * U.TAU) * 7, 9 + Math.sin(a / 30 * U.TAU) * 7, c, 1); s.np(); s.line(9, 1, 9, 17, c, 1); s.line(1, 9, 17, 9, c, 1); s.np(); s.ball(9, 9, 2, 2, red); },
    phoenix: (s) => { const o = em('#ffa03a'); s.poly([[9, 3], [16, 7], [12, 9], [16, 13], [9, 11], [2, 13], [6, 9], [2, 7]], o, (x, y) => 0.5 + (9 - Math.abs(x - 9)) * 0.04); s.np(); s.ball(9, 6, 2.4, 2.4, em('#fff0a0'), { flatS: 1 }); s.poly([[8, 11], [10, 11], [9, 17]], em('#ff6a2a'), 0.7); },
    blessing: (s) => { s.star(9, 9, 8.5, 3.6, 5, -Math.PI / 2, PX.mat('#ffe070', { gloss: true, n: 7 })); },
    twin: (s) => { s.star(6, 7, 5.5, 2.4, 5, -Math.PI / 2, PX.mat('#ffe070', { gloss: true })); s.np(); s.star(12, 12, 5.5, 2.4, 5, -Math.PI / 2, PX.mat('#ffb0e0', { gloss: true })); },
    timewarp: (s) => { s.poly([[4, 2], [14, 2], [10, 9], [14, 16], [4, 16], [8, 9]], PX.mat('#c8a8ff', { gloss: true, alpha: 0.9 }), 0.6); s.np(); s.rect(3, 1, 12, 2, G, 0.7); s.rect(3, 15, 12, 2, G, 0.7); s.np(); s.poly([[6, 15], [12, 15], [9, 11]], PX.mat('#ffe08a'), 0.8); },
    spore: (s) => { s.ball(9, 7, 7, 5, PX.mat('#c8342e', { gloss: true }), { half: 'top' }); s.np(); s.cyl(9, 8, 9, 15, 2.5, 2.2, PX.mat('#efe2c4')); s.np(); s.ball(6, 5, 1.4, 1.2, PX.mat('#fff')); s.ball(11, 4, 1.6, 1.4, PX.mat('#fff')); },
    leaf: (s) => { s.poly([[3, 15], [5, 6], [11, 2], [16, 2], [14, 9], [8, 14]], green, (x, y) => 0.8 - (x + y) * 0.015); s.np(); s.line(3, 15, 14, 4, PX.mat('#2a6a2a', { flat: true }), 0.4); },
    stinger: (s) => { s.chain([[3, 15], [3, 8], [7, 3], [13, 3]], 2, 1.4, PX.mat('#7a3a6a', { gloss: true })); s.np(); s.poly([[13, 1], [17, 5], [12, 6]], PX.mat('#2a1426'), 0.5); s.np(); s.px(16, 7, PX.mat('#c06aff', { flat: true }), 1); },
    crown: (s) => { s.poly([[2, 14], [2, 5], [6, 9], [9, 3], [12, 9], [16, 5], [16, 14]], G, (x, y) => 0.75 - y * 0.015 - x * 0.01); s.np(); s.ball(9, 11, 1.6, 1.6, blue); s.ball(5, 11, 1.2, 1.2, red); s.ball(13, 11, 1.2, 1.2, red); },
    scarab: (s) => { s.ball(9, 10, 5.5, 6.5, PX.mat('#2a8a9a', { gloss: true })); s.np(); s.ball(9, 4, 3, 2.2, PX.mat('#1a5a6a')); s.np(); s.line(9, 5, 9, 16, PX.mat('#0a2a30', { flat: true }), 0); for (const sx of [-1, 1]) { s.line(9 + sx * 5, 8, 9 + sx * 8, 6, G, 0.6); s.line(9 + sx * 5, 13, 9 + sx * 8, 15, G, 0.6); } },
    fur: (s) => { s.ball(9, 9, 7.5, 7, PX.mat('#e8f0fa'), { tex: (x, y) => ((x + y * 2) % 4 ? 0 : -0.25) }); s.np(); s.ball(9, 9, 3, 3, PX.mat('#7a8cae')); },
    mirror: (s) => { s.ball(9, 8, 6, 7, G); s.np(); s.ball(9, 8, 4.5, 5.5, PX.mat('#bfeeff', { gloss: true, n: 7 })); s.np(); s.cyl(9, 14, 9, 17, 1.4, 1.4, G); },
    hammer: (s) => { s.cyl(4, 16, 11, 7, 1.1, 1.1, WOOD); s.np(); s.box(7, 1, 10, 7, PX.mat('#6a6a7a', { gloss: true }), { bevel: 1 }); },
    scale: (s) => { for (let r = 0; r < 3; r++) for (let c = 0; c < 3 - (r % 2); c++) { s.ball(4 + c * 5 + (r % 2) * 2.5, 5 + r * 4, 3, 3, PX.mat('#d8463a', { gloss: true })); s.np(); } },
    flame: (s) => { s.poly([[9, 1], [15, 9], [13, 15], [9, 17], [5, 15], [3, 9], [7, 6], [8, 10]], em('#ff5a2a'), (x, y) => 0.35 + y * 0.035); s.np(); s.ball(9, 13, 2.5, 3, em('#ffe08a'), { flatS: 1 }); },
    eye: (s) => { s.ball(9, 9, 8, 6, PX.mat('#f2e6ee', { gloss: true })); s.np(); s.ball(9, 9, 4, 4, PX.mat('#e8a020', { gloss: true })); s.np(); s.ball(9, 9, 1.2, 3, PX.mat('#0e0414', { flat: true }), { flatS: 0 }); },
    core: (s) => { s.ball(9, 9, 7, 7, PX.mat('#2a1a4a')); s.np(); s.ball(9, 9, 4, 4, em('#c070ff'), { flatS: 0.9 }); s.np(); s.px(7, 7, PX.mat('#fff', { flat: true }), 1); },
    star: (s) => { s.poly([[9, 1], [13, 9], [9, 17], [5, 9]], PX.mat('#a8f0ff', { gloss: true, n: 7 }), (x) => x < 9 ? 0.85 : 0.45); },
    hourglass: (s) => { s.rect(3, 1, 12, 2, G, 0.7); s.rect(3, 15, 12, 2, G, 0.7); s.np(); s.poly([[4, 3], [14, 3], [10, 9], [14, 15], [4, 15], [8, 9]], PX.mat('#e8f4ff', { alpha: 0.85 }), 0.7); s.np(); s.poly([[5, 15], [13, 15], [9, 11]], PX.mat('#e8c070'), 0.7); s.poly([[7, 5], [11, 5], [9, 8]], PX.mat('#e8c070'), 0.7); },
    clover: (s) => { for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) s.ball(9 + dx, 8 + dy, 3.2, 3.2, green); s.np(); s.cyl(9, 9, 12, 17, 0.8, 0.8, PX.mat('#3a7a2a')); },
    skill_blade: (s) => { sword(s, 5, 13, 15, 3); s.np(); const c = PX.mat('#c8f0ff', { flat: true, alpha: 0.8 }); for (let a = 0; a < 20; a++) { const t = a / 20 * U.TAU * 0.75 + 2; s.px(9 + Math.cos(t) * 8, 9 + Math.sin(t) * 8, c, 1); } },
    skill_ranger: (s) => { for (let i = -2; i <= 2; i++) { const a = -Math.PI / 2 + i * 0.32, ex = 9 + Math.cos(a) * 8, ey = 15 + Math.sin(a) * 13; s.line(9, 16, ex, ey, WOOD, 0.6); s.px(ex, ey, STEEL, 0.9); } },
    skill_mage: (s) => { s.ball(11, 7, 5, 5, em('#ff9a3a')); s.np(); s.ball(11, 7, 2.5, 2.5, em('#fff0a0'), { flatS: 1 }); s.np(); s.cyl(7, 11, 2, 16, 2, 0.5, em('#ff6a2a')); },
    dash: (s) => { s.ball(11, 9, 5, 5, PX.mat('#c8d8ff')); s.np(); for (let i = 0; i < 3; i++) s.line(1, 6 + i * 3, 6 - i, 6 + i * 3, PX.mat('#ffffff', { flat: true }), 1); }
  };
  const cache = new Map();
  function get(name, k = 1) {
    const key = name + '|' + k;
    if (cache.has(key)) return cache.get(key);
    const s = new Spr(19, 19);
    (D[name] || D.star)(s);
    let c = s.render();
    if (k > 1) c = PX.scaled(c, k);
    cache.set(key, c);
    return c;
  }
  const urls = new Map();
  function url(name, k = 3) { const key = name + k; if (!urls.has(key)) urls.set(key, get(name, k).toDataURL()); return urls.get(key); }
  return { get, url, D };
})();
