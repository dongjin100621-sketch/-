/* 별을 삼킨 탑 자동 플레이 시험.
   헤드리스 브라우저에서 게임을 열고, 가까운 적을 겨누며 탄·예고를 피하는 봇으로 층을 올라간다.
   강화는 늘 첫 카드를 고르고, 상점은 들르기만 한다(사람보다 서툰 기준선).
   런타임 오류를 찾고(무적 모드로 50층 끝까지), 직업·계층별로 어디까지 가는지 본다.

     node tools/tower_bot.js [blade|ranger|mage] [무적 1/0] [최대 분] [배속] [시작 계층 0~4]
     예) node tools/tower_bot.js ranger 1 10 10 0     # 무적으로 1층부터 끝까지, 10배속
         node tools/tower_bot.js mage 0 4 10 4        # 41층부터 실제 난이도로

   필요: playwright(크로미움). 저장소 뿌리를 작은 웹 서버로 직접 띄운다. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BOT_SRC = String.raw`// 자동 플레이 봇: 가까운 적을 겨누고 탄을 피하며, 다 잡으면 출구로 간다
window.BOT = {
  fast: 6, floorSeen: -1, portalFlow: null, stuck: 0, lx: 0, ly: 0,
  input(w, dt) {
    const p = w.player, L = w.L, T = 32;
    const inp = { mx: 0, my: 0, attack: false, dash: false, skill: false, aim: null, aimMode: 'auto' };
    if (this.floorSeen !== L.floor) { this.floorSeen = L.floor; this.portalFlow = null; }
    const e = ENT.nearestEnemy(p.x, p.y, 2000);
    let mx = 0, my = 0;
    if (e) {
      const a = Math.atan2(e.y - e.h * 0.4 - (e.fly || 0) - (p.y - 16), e.x - p.x);
      inp.aim = a; inp.attack = true;
      const d = U.dist(e.x, e.y, p.x, p.y);
      const want = p.cls === 'blade' ? 58 : 220;
      const [ux, uy] = ENT.steer({ x: p.x, y: p.y, fly: 0 }, e.x, e.y);
      // flow 는 주인공 기준이라 steer 대신 직접 방향 사용, 막히면 steer
      let dx = (e.x - p.x) / d, dy = (e.y - p.y) / d;
      if (!ENT.los(p.x, p.y, e.x, e.y) || this.stuck > 0.3) {
        this.ft = (this.ft || 0) - dt;
        if (this.ft <= 0 || !this.eflow) { this.ft = 0.5; this.eflow = this.flowFrom(L, Math.floor(e.x / T), Math.floor(e.y / T)); }
        const save = this.portalFlow; this.portalFlow = this.eflow; const [gx, gy] = this.next(L, p, e); this.portalFlow = save;
        const gd = Math.hypot(gx - p.x, gy - p.y) || 1; dx = (gx - p.x) / gd; dy = (gy - p.y) / gd;
        mx += dx * 1.5; my += dy * 1.5;
      }
      if (d > want + 30) { mx += dx; my += dy; } else if (d < want - 30) { mx -= dx; my -= dy; }
      mx += -dy * 0.6 * Math.sin(w.t * 0.7); my += dx * 0.6 * Math.sin(w.t * 0.7);
      if (p.skillT <= 0 && d < 260) inp.skill = true;
      void ux; void uy;
    } else if (G.portal) {
      if (!this.portalFlow) this.portalFlow = this.flowFrom(L, Math.floor(G.portal.x / T), Math.floor(G.portal.y / T));
      const [gx, gy] = this.next(L, p);
      const d = Math.hypot(gx - p.x, gy - p.y) || 1; mx = (gx - p.x) / d; my = (gy - p.y) / d;
    }
    // 탄 피하기
    let ax = 0, ay = 0, danger = 0;
    for (const b of w.eb) {
      const dx = p.x - b.x, dy = (p.y - 12) - b.y, d = Math.hypot(dx, dy);
      if (d < 70) { const s = (70 - d) / 70; ax += dx / d * s; ay += dy / d * s; danger += s; }
    }
    for (const t of w.tels) if (!t.friendly && t.k === 'circle' && U.dist(t.x, t.y, p.x, p.y) < t.r + 10) { const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy) || 1; ax += dx / d * 2; ay += dy / d * 2; danger += 1; }
    for (const o of w.enemies) {
      if (o.dead || o.spawnT > 0 || o.under) continue;
      const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1, R = o.r + p.r + (o.boss ? 50 : 22);
      if (d < R) { const s = (R - d) / R; ax += dx / d * s * 1.6; ay += dy / d * s * 1.6; if (s > 0.5) danger += 0.6; }
    }
    for (const bm of w.beams) { const px = p.x - bm.x, py = (p.y - 12) - bm.y, al = px * Math.cos(bm.ang) + py * Math.sin(bm.ang), pe = -px * Math.sin(bm.ang) + py * Math.cos(bm.ang); if (al > 0 && Math.abs(pe) < 50) { ax += -Math.sin(bm.ang) * Math.sign(pe || 1) * 2; ay += Math.cos(bm.ang) * Math.sign(pe || 1) * 2; danger += 0.5; } }
    for (const t of w.tels) if (!t.friendly && t.k === 'line') { const px = p.x - t.x, py = p.y - t.y, al = px * Math.cos(t.ang) + py * Math.sin(t.ang), pe = -px * Math.sin(t.ang) + py * Math.cos(t.ang); if (al > -20 && al < t.len && Math.abs(pe) < t.w / 2 + 14) { ax += -Math.sin(t.ang) * Math.sign(pe || 1) * 2.5; ay += Math.cos(t.ang) * Math.sign(pe || 1) * 2.5; danger += 0.8; } }
    mx += ax * 2; my += ay * 2;
    if (danger > 1.2 && p.dashCdT <= 0) inp.dash = true;
    // 끼임 탈출
    if (Math.hypot(p.x - this.lx, p.y - this.ly) < 0.5 && (mx || my)) this.stuck += dt; else this.stuck = 0;
    this.lx = p.x; this.ly = p.y;
    if (this.stuck > 0.6) { const a = Math.random() * 6.28; mx = Math.cos(a); my = Math.sin(a); if (this.stuck > 1.2) this.stuck = 0; }
    inp.mx = mx; inp.my = my;
    return inp;
  },
  flowFrom(L, cx, cy) {
    const f = new Int16Array(L.w * L.h).fill(-1), q = [cy * L.w + cx]; f[q[0]] = 0;
    while (q.length) { const i = q.shift(), x = i % L.w, y = (i / L.w) | 0; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy, j = ny * L.w + nx; if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue; const v = L.grid[j]; if (f[j] < 0 && (v === 0 || v === 3)) { f[j] = f[i] + 1; q.push(j); } } }
    return f;
  },
  next(L, p, tgt) {
    const T = 32, cx = Math.floor(p.x / T), cy = Math.floor(p.y / T), f = this.portalFlow;
    let best = f[cy * L.w + cx], bx = cx, by = cy; if (best < 0) best = 1e9;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const v = f[(cy + dy) * L.w + cx + dx]; if (v >= 0 && v < best) { best = v; bx = cx + dx; by = cy + dy; } }
    if (bx === cx && by === cy) return tgt ? [tgt.x, tgt.y] : [G.portal.x, G.portal.y];
    return [bx * T + 16, by * T + 16];
  }
};
`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const PORT = () => server.address().port;
const { chromium } = require('playwright');
(async () => {
  const [cls, god, maxMin, fast, startTier] = [process.argv[2] || 'blade', process.argv[3] !== '0', +(process.argv[4] || 6), +(process.argv[5] || 6), +(process.argv[6] || 0)];
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1066, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 4).join(' / ')));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:${PORT()}/tower/index.html`); await p.waitForTimeout(800);
  await p.addScriptTag({ content: BOT_SRC });
  await p.evaluate(([god, fast, t]) => { localStorage.clear(); G.meta.unlocked = 4; G.god = god; window.BOT.fast = fast; G.bot = window.BOT; window.confirm = () => true; }, [god, fast, startTier]);
  await p.evaluate(([cls, t]) => { G.newRun(cls, t); }, [cls, startTier]);
  const t0 = Date.now(); let lastFloor = 0; const shots = new Set(); const log = [];
  while (Date.now() - t0 < maxMin * 60000) {
    await p.waitForTimeout(250);
    const s = await p.evaluate(() => ({ st: G.state, f: G.run && G.run.floor, hp: ENT.w && ENT.w.player ? Math.round(ENT.w.player.hp) : 0, boss: ENT.w && ENT.w.boss ? Math.round(ENT.w.boss.hp) + '/' + Math.round(ENT.w.boss.maxHp) + ' ph' + ENT.w.boss.phase : '', t: G.run && Math.round(G.run.time), en: ENT.w ? ENT.w.enemies.length : 0, eb: ENT.w ? ENT.w.eb.length : 0 }));
    if (s.f !== lastFloor) { log.push(`F${s.f} t=${s.t} hp=${s.hp}`); lastFloor = s.f; }
    if (s.st === 'play' && s.boss && !shots.has(s.f) && s.t > 0) {
      const ph = await p.evaluate(() => ENT.w.boss && ENT.w.boss.cur ? 1 : 0);
      if (ph) { shots.add(s.f); if (process.env.SHOTS) await p.screenshot({ path: `boss${s.f}.png` }); }
    }
    if (s.st === 'play' && !s.boss && [3, 14, 27, 38, 46].includes(s.f) && !shots.has(s.f) && s.en > 3) { shots.add(s.f); if (process.env.SHOTS) await p.screenshot({ path: `mob${s.f}.png` }); }
    if (s.st === 'reward') {
      await p.evaluate(() => { const c = document.querySelector('.card.upg:not(.item), .card.relic'); if (c) { c.click(); return; } const go = document.querySelector('#sGo'); if (go) go.click(); });
    }
    if (s.st === 'dead' || s.st === 'victory') { log.push(`END ${s.st} F${s.f} t=${s.t}`); break; }
  }
  const fin = await p.evaluate(() => ({ st: G.state, f: G.run.floor, t: G.run.time, kills: G.run.kills, upg: G.run.upg, relics: G.run.relics }));
  console.log(log.join('\n')); console.log(JSON.stringify(fin));
  console.log(errs.slice(0, 20).join('\n') || 'no errors');
  await b.close();
  server.close();
})();
