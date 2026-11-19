'use strict';
/* 화면 그리기: 세계 → 효과 → HUD(왼쪽 위 체력바·지도, 오른쪽 위 메뉴, 조작 버튼) */
const HUD = {
  ctx: null, bubble: null,
  init(cv) { this.ctx = cv.getContext('2d'); this.ctx.imageSmoothingEnabled = false; },
  draw(dt) {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    if (!G.started) { UI.drawTitle(ctx, dt); return; }
    ctx.save();
    if (FX.shakeT > 0) ctx.translate(Math.round(rand(-FX.shakeA, FX.shakeA) / 2) * 2, Math.round(rand(-FX.shakeA, FX.shakeA) / 2) * 2);
    BG.draw(ctx, G.camX, G.time, dt);
    ctx.save();
    ctx.translate(-Math.round(G.camX), 0);
    this.world(ctx);
    ctx.restore();
    BG.drawFront(ctx, G.camX, G.time, dt);
    ctx.save(); ctx.translate(-Math.round(G.camX), 0); FX.drawTexts(ctx); ctx.restore();
    if (G.P.chronoT > 0) { ctx.fillStyle = 'rgba(62,232,255,0.08)'; ctx.fillRect(0, 0, VW, VH); }
    ctx.restore();
    if (FX.flashT > 0) { ctx.fillStyle = hexA(FX.flashC, Math.min(0.6, FX.flashT * 3)); ctx.fillRect(0, 0, VW, VH); }
    // 체력이 낮으면 화면 가장자리가 붉게
    const P = G.P;
    if (P.hp < G.st.maxHp * 0.3 && !P.dead) { const g = ctx.createRadialGradient(VW / 2, VH / 2, 300, VW / 2, VH / 2, 760); g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, `rgba(255,0,40,${0.25 + Math.sin(G.time * 6) * 0.1})`); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); }
    this.hud(ctx, dt);
    if (G.fade > 0) { ctx.fillStyle = `rgba(4,2,10,${G.fade})`; ctx.fillRect(0, 0, VW, VH); }
  },
  world(ctx) {
    const P = G.P, t = G.time;
    // 조사할 물건
    for (const o of G.objs) {
      const y = GROUND - 70 + Math.sin(t * 3 + o.x) * 6;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const col = o.id === 'terminal' ? '#3ee8ff' : o.id === 'capsule' ? '#ff6ab8' : '#ff8ad8';
      ctx.fillStyle = hexA(col, 0.18); ctx.fillRect(o.x - 4, y - 140, 8, 210);
      if (o.id === 'capsule') { ctx.fillStyle = hexA(col, 0.25); rrect(ctx, o.x - 50, GROUND - 120, 100, 120, 20); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(o.x - 30, GROUND - 100, 10, 70); }
      ctx.restore();
      ctx.font = FONT(30, true); ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.fillText(o.icon, o.x, y);
      ctx.font = FONT(15); ctx.fillStyle = '#e8ecff'; ctx.fillText(o.n, o.x, y + 26);
    }
    // NPC
    for (const n of G.npcs) {
      const D = n.D, f = P.x > n.x ? 1 : -1;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(n.x, GROUND + 2, 36, 7, 0, 0, 7); ctx.fill();
      const A = n.anim || (n.anim = new Animator());
      A.tick(G.time);
      const NP = A.begin();
      A.breathe(NP, 1.2, 2 + (n.x % 7) * 0.05);
      const hair = { sera: 4, lyla: 3, nova: 2.5, momo: 3.5 }[n.id];
      if (hair) { NP.waveFrom = 0.4; NP.wave = hair; NP.waveT = A.t * 2.2; }
      const [ff, tsx] = A.face(f); NP.sx *= tsx;
      SPR.pose(ctx, D.spr, n.x, GROUND, { sc: D.sc, f: ff }, NP);
      if (n.id === 'toto') { // 로봇 볼트: 통통 튄다
        const hop = Math.abs(Math.sin(A.t * 4)), up = Math.round(hop * 10);
        const B = { ...POSE0, sy: 1 + (hop < 0.25 ? -0.08 : hop * 0.05), sx: 1 + (hop < 0.25 ? 0.06 : 0) };
        SPR.pose(ctx, 'bolt', n.x + 110, GROUND - up, { sc: 0.9, f: -1 }, B);
      }
      const [, sh] = SPR.size(D.spr, D.sc);
      const top = GROUND - sh - 14;
      ctx.font = FONT(15); ctx.textAlign = 'center';
      const label = (D.title ? D.title + ' · ' : '') + D.n;
      const w = ctx.measureText(label).width + 16;
      ctx.fillStyle = 'rgba(6,4,14,0.75)'; rrect(ctx, n.x - w / 2, top - 18, w, 24, 6); ctx.fill();
      ctx.fillStyle = D.c; ctx.fillText(label, n.x, top);
      const q = G.npcQuest(n.id), offer = G.npcOffers(n.id).length;
      if (q || offer) {
        const yy = top - 34 + Math.sin(t * 4) * 5;
        ctx.font = FONT(30, true); ctx.fillStyle = q ? (QUESTS[q.id].main ? '#3ee8ff' : '#ffd23e') : '#ffd23e';
        ctx.strokeStyle = '#05030c'; ctx.lineWidth = 5; const m = q ? '?' : '!';
        ctx.strokeText(m, n.x, yy); ctx.fillText(m, n.x, yy);
      }
    }
    // 적
    for (const e of G.enemies) e.draw(ctx);
    G.drawDrops(ctx);
    if (G.comp) G.comp.draw(ctx);
    P.draw(ctx);
    G.drawBullets(ctx);
    FX.draw(ctx);
    // 보스 방 벽
    if (G.arena) { ctx.fillStyle = `rgba(255,59,92,${0.25 + Math.sin(t * 5) * 0.1})`; ctx.fillRect(G.arena[0], 0, 6, GROUND); ctx.fillRect(G.arena[1] - 6, 0, 6, GROUND); }
    // 지역 끝 화살표
    const m = G.map;
    if (!G.arena) {
      ctx.font = FONT(22, true); ctx.fillStyle = `rgba(62,232,255,${0.5 + Math.sin(t * 4) * 0.3})`; ctx.textAlign = 'center';
      if (m.idx > 0) { ctx.fillText('◀', 30, GROUND - 40); ctx.font = FONT(13); ctx.fillText(MAPS[m.idx - 1].n, 70, GROUND - 70); }
      if (m.idx < MAPS.length - 1) { ctx.font = FONT(22, true); ctx.fillText('▶', m.w - 30, GROUND - 40); ctx.font = FONT(13); ctx.fillText(MAPS[m.idx + 1].n, m.w - 70, GROUND - 70); }
    }
  },
  bar(ctx, x, y, w, h, k, c1, c2, back = 'rgba(10,6,24,0.85)') {
    ctx.fillStyle = back; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(x, y, Math.max(0, w * clamp(k, 0, 1)), h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, Math.max(0, w * clamp(k, 0, 1)), Math.max(1, h * 0.3));
  },
  panel(ctx, x, y, w, h, c = '#3ee8ff') {
    ctx.fillStyle = 'rgba(8,5,20,0.72)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = hexA(c, 0.55); ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = c; ctx.fillRect(x, y, 10, 2); ctx.fillRect(x, y, 2, 10); ctx.fillRect(x + w - 10, y + h - 2, 10, 2); ctx.fillRect(x + w - 2, y + h - 10, 2, 10);
  },
  hud(ctx, dt) {
    const P = G.P, S = G.S, st = G.st;
    ctx.textAlign = 'left';
    // ── 왼쪽 위: 체력바 ──
    this.panel(ctx, 12, 10, 396, 94);
    ctx.fillStyle = 'rgba(62,232,255,0.15)'; ctx.beginPath(); ctx.arc(56, 56, 40, 0, 7); ctx.fill();
    SPR.face(ctx, 'kai_face', 18, 18, 76);
    ctx.strokeStyle = '#3ee8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(56, 56, 38, 0, 7); ctx.stroke();
    ctx.fillStyle = '#05030c'; ctx.fillRect(22, 80, 34, 20); ctx.fillStyle = '#ffd23e'; ctx.font = FONT(15, true); ctx.fillText('Lv' + S.lv, 25, 96);
    ctx.font = FONT(16, true); ctx.fillStyle = '#e8ecff'; ctx.fillText('카이', 106, 32);
    if (S.ap > 0 || S.pp > 0) { ctx.fillStyle = '#ffd23e'; ctx.font = FONT(13); ctx.fillText(`● 포인트 ${S.ap + S.pp}`, 150, 31); }
    // 버프 아이콘
    let bx = 250; const buffs = [];
    if (P.berserkT > 0) buffs.push(['☠', '#ff2a4a']); if (P.adrenT > 0) buffs.push(['♥', '#ff4f6d']); if (P.shield > 0) buffs.push(['⬡', '#ffd23e']);
    if (P.cloakT > 0) buffs.push(['◌', '#d9e8ff']); if (P.chronoT > 0) buffs.push(['◷', '#3ee8ff']); if (P.coldStacks) buffs.push(['❄' + P.coldStacks, '#bfe6ff']);
    for (const b of P.buffs) buffs.push(['▲', '#5dff9a']);
    ctx.font = FONT(15, true); for (const [ic, c] of buffs.slice(0, 8)) { ctx.fillStyle = c; ctx.fillText(ic, bx, 31); bx += 20; }
    this.bar(ctx, 106, 40, 290, 20, P.hp / st.maxHp, '#ff2a4a', '#ff7a8f');
    if (P.shield > 0) { ctx.fillStyle = 'rgba(255,210,62,0.6)'; ctx.fillRect(106, 40, 290 * Math.min(1, P.shield / st.maxHp), 4); }
    ctx.font = FONT(14, true); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`${Math.ceil(P.hp)} / ${st.maxHp}`, 251, 56); ctx.textAlign = 'left';
    this.bar(ctx, 106, 66, 290, 10, P.ram / st.maxRam, '#1a7cff', '#3ee8ff');
    ctx.font = FONT(11); ctx.fillStyle = '#bfe6ff'; ctx.fillText(`RAM ${Math.floor(P.ram)}`, 110, 75);
    this.bar(ctx, 106, 84, 290, 6, S.lv >= LEVEL_MAX ? 1 : S.exp / expNeed(S.lv), '#ffb02e', '#ffe680');
    ctx.font = FONT(11); ctx.fillStyle = '#ffe680'; ctx.textAlign = 'right'; ctx.fillText(S.lv >= LEVEL_MAX ? 'MAX' : `EXP ${Math.floor(S.exp / expNeed(S.lv) * 100)}%`, 396, 101); ctx.textAlign = 'left';
    // ── 왼쪽 위: 지도 ──
    this.minimap(ctx);
    // ── 오른쪽 위: 크레딧과 메뉴 ──
    const L = LAYOUT;
    for (let i = 0; i < L.menu.length; i++) {
      const x = L.menuX(i), y = L.menuY, it = L.menu[i];
      this.panel(ctx, x, y, L.menuW, L.menuH, i === 1 && (S.ap || S.pp) ? '#ffd23e' : '#3ee8ff');
      ctx.textAlign = 'center'; ctx.font = FONT(24, true); ctx.fillStyle = '#e8ecff'; ctx.fillText(it.ic, x + L.menuW / 2, y + 32);
      ctx.font = FONT(13); ctx.fillStyle = '#9fb0d0'; ctx.fillText(it.n, x + L.menuW / 2, y + 53);
      if (i === 1 && (S.ap || S.pp)) { ctx.fillStyle = '#ffd23e'; ctx.beginPath(); ctx.arc(x + L.menuW - 6, y + 6, 7, 0, 7); ctx.fill(); }
    }
    ctx.textAlign = 'right'; ctx.font = FONT(18, true); ctx.fillStyle = '#ffd23e'; ctx.fillText(`₡ ${fmt(S.cr)}`, L.menuX(0) - 14, 36);
    if (S.q.m1 && S.q.m1.s >= 3 || G.qDone('m1')) { ctx.font = FONT(15, true); ctx.fillStyle = '#ff8ad8'; ctx.fillText(`♥ 세라 ${S.aff}`, L.menuX(0) - 14, 60); }
    // ── 퀘스트 추적 ──
    this.tracker(ctx);
    // ── 보스 체력 ──
    if (G.boss && !G.boss.dead) {
      const b = G.boss, w = 560, x = (VW - w) / 2, y = 132;
      ctx.textAlign = 'center'; ctx.font = FONT(18, true); ctx.fillStyle = b.B.c;
      ctx.fillText(`${b.B.title} · ${b.B.n}  Lv.${b.B.lv}`, VW / 2, y - 10);
      this.bar(ctx, x, y, w, 16, b.hp / b.maxHp, '#ff2a4a', b.B.c);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x + w / 2, y, 2, 16);
    }
    // ── 알림 ──
    let ty = G.boss ? 170 : 130;
    ctx.textAlign = 'center';
    for (const t of G.toasts) {
      t.t -= dt; const a = Math.min(1, t.t * 2);
      ctx.font = FONT(17, true); const w = ctx.measureText(t.txt).width + 30;
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(6,4,14,0.82)'; rrect(ctx, VW / 2 - w / 2, ty - 22, w, 32, 8); ctx.fill();
      ctx.fillStyle = t.c; ctx.fillText(t.txt, VW / 2, ty); ctx.globalAlpha = 1; ty += 38;
    }
    G.toasts = G.toasts.filter((t) => t.t > 0);
    if (G.banner) {
      const b = G.banner; b.t -= dt; const a = Math.min(1, b.t * 1.5, (b.max || (b.max = b.t)) - b.t > 0.3 ? 1 : ((b.max - b.t) / 0.3));
      ctx.globalAlpha = Math.max(0, a);
      const y = b.ult ? 330 : 300;
      const g = ctx.createLinearGradient(0, y - 50, 0, y + 40); g.addColorStop(0, 'rgba(6,4,14,0)'); g.addColorStop(0.5, 'rgba(6,4,14,0.8)'); g.addColorStop(1, 'rgba(6,4,14,0)');
      ctx.fillStyle = g; ctx.fillRect(0, y - 60, VW, b.sub ? 110 : 90);
      ctx.font = FONT(b.ult ? 46 : 36, true); ctx.fillStyle = b.c; ctx.shadowColor = b.c; ctx.shadowBlur = 20; ctx.fillText(b.txt, VW / 2, y); ctx.shadowBlur = 0;
      if (b.sub) { ctx.font = FONT(17); ctx.fillStyle = '#e8ecff'; ctx.fillText(b.sub, VW / 2, y + 34); }
      ctx.globalAlpha = 1; if (b.t <= 0) G.banner = null;
    }
    // ── 상호작용 말풍선 ──
    this.bubble = null;
    if (G.near && !UI.dialogOpen && !G.menuOpen) {
      const o = G.near.o, sx = o.x - G.camX;
      const isNpc = G.near.type === 'npc';
      const txt = isNpc ? '💬 대화하기' : '🔍 조사하기';
      ctx.font = FONT(18, true); const w = ctx.measureText(txt).width + 36, h = 44;
      const by = isNpc ? GROUND - SPR.size(o.D.spr, o.D.sc)[1] - 100 : GROUND - 170;
      const bx = clamp(sx - w / 2, 10, VW - w - 10);
      ctx.fillStyle = 'rgba(62,232,255,0.92)'; rrect(ctx, bx, by, w, h, 10); ctx.fill();
      ctx.fillStyle = '#05030c'; ctx.textAlign = 'center'; ctx.fillText(txt, bx + w / 2, by + 29);
      this.bubble = { x: bx, y: by, w, h };
    }
    this.controls(ctx);
  },
  minimap(ctx) {
    const M = LAYOUT.mini, m = G.map;
    this.panel(ctx, M.x, M.y, M.w, M.h, '#7c6bff');
    // 지역 사슬
    const n = MAPS.length, x0 = M.x + 20, x1 = M.x + M.w - 20, y = M.y + 22;
    ctx.strokeStyle = 'rgba(124,107,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    for (let i = 0; i < n; i++) {
      const x = lerp(x0, x1, i / (n - 1)), cur = i === m.idx;
      ctx.fillStyle = cur ? '#3ee8ff' : MAPS[i].safe ? '#5dff9a' : '#ff4f6d';
      if (cur) { ctx.fillStyle = 'rgba(62,232,255,0.3)'; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#3ee8ff'; }
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }
    ctx.textAlign = 'left'; ctx.font = FONT(15, true); ctx.fillStyle = '#e8ecff'; ctx.fillText(m.n, M.x + 12, M.y + 52);
    ctx.font = FONT(12); ctx.fillStyle = '#8f9cc0'; ctx.textAlign = 'right'; ctx.fillText(m.safe ? '안전 지역' : `위험도 Lv.${m.lv[0]}~${m.lv[1]}`, M.x + M.w - 12, M.y + 52);
    // 현재 지역 띠
    const bx = M.x + 12, bw = M.w - 24, by = M.y + 70;
    ctx.fillStyle = 'rgba(124,107,255,0.18)'; ctx.fillRect(bx, by, bw, 18);
    const X = (wx) => bx + wx / m.w * bw;
    ctx.fillStyle = 'rgba(62,232,255,0.15)'; ctx.fillRect(X(G.camX), by, VW / m.w * bw, 18);
    for (const e of G.enemies) if (!e.dead) { ctx.fillStyle = e.boss ? '#ff2a4a' : e.elite ? '#ffd23e' : '#ff4f6d'; const s = e.boss ? 8 : 4; ctx.fillRect(X(e.x) - s / 2, by + 9 - s / 2, s, s); }
    if (G.bossTrig) { ctx.fillStyle = '#ff2a4a'; ctx.font = FONT(14, true); ctx.textAlign = 'center'; ctx.fillText('☠', X(G.bossTrig.x), by + 15); }
    for (const nn of G.npcs) { ctx.fillStyle = G.npcQuest(nn.id) ? '#ffd23e' : '#5dff9a'; ctx.fillRect(X(nn.x) - 3, by + 2, 6, 6); }
    for (const o of G.objs) { ctx.fillStyle = '#ff8ad8'; ctx.fillRect(X(o.x) - 3, by + 10, 6, 6); }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(X(G.P.x) - 2, by - 3, 4, 24);
  },
  tracker(ctx) {
    const list = [];
    for (const id of QUEST_ORDER) {
      const q = G.S.q[id]; if (!q || q.done) continue;
      const Q = QUESTS[id], st = Q.steps[q.s];
      let prog = '';
      if (st.t === 'kill') prog = ` (${q.c}/${st.n})`;
      if (st.t === 'collect' || st.t === 'give') prog = ` (${Math.min(G.S.inv[st.item] || 0, st.n || 1)}/${st.n || 1})`;
      if (st.t === 'flags') prog = ` (${st.f.filter((f) => G.flag(f)).length}/${st.f.length})`;
      list.push({ main: Q.main, n: Q.n, d: st.d + prog, where: st.map ? MAP[st.map].n : '' });
    }
    if (!list.length) return;
    const show = [list.find((q) => q.main), ...list.filter((q) => !q.main).slice(0, 1)].filter(Boolean);
    let y = 90;
    const x = VW - 16 - 360;
    ctx.textAlign = 'left';
    for (const q of show) {
      this.panel(ctx, x, y, 360, 58, q.main ? '#3ee8ff' : '#ffd23e');
      ctx.font = FONT(14, true); ctx.fillStyle = q.main ? '#3ee8ff' : '#ffd23e'; ctx.fillText((q.main ? '◆ ' : '◇ ') + q.n, x + 10, y + 22);
      if (q.where) { ctx.textAlign = 'right'; ctx.font = FONT(12); ctx.fillStyle = '#8f9cc0'; ctx.fillText('📍' + q.where, x + 350, y + 22); ctx.textAlign = 'left'; }
      ctx.font = FONT(14); ctx.fillStyle = '#e8ecff'; ctx.fillText(q.d.length > 25 ? q.d.slice(0, 25) + '…' : q.d, x + 10, y + 45);
      y += 64;
    }
  },
  btn(ctx, b, col, pressed, label) {
    ctx.save();
    ctx.fillStyle = pressed ? hexA(col, 0.5) : 'rgba(8,5,20,0.32)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
    ctx.strokeStyle = hexA(col, 0.9); ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = hexA(col, 0.25); ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, 0, 7); ctx.stroke();
    ctx.restore();
  },
  controls(ctx) {
    const L = LAYOUT, P = G.P, S = G.S;
    // 조이스틱
    const s = INPUT.stick, base = s ? { x: s.ox, y: s.oy } : L.stick;
    ctx.fillStyle = 'rgba(8,5,20,0.35)'; ctx.beginPath(); ctx.arc(base.x, base.y, L.stick.r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(62,232,255,0.5)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(62,232,255,0.5)'; ctx.font = FONT(16, true); ctx.textAlign = 'center';
    ctx.fillText('▲', base.x, base.y - L.stick.r + 22); ctx.fillText('◀', base.x - L.stick.r + 18, base.y + 6); ctx.fillText('▶', base.x + L.stick.r - 18, base.y + 6);
    ctx.font = FONT(11); ctx.fillText('점프', base.x, base.y - L.stick.r + 38);
    let kx = base.x, ky = base.y;
    if (s) { const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), m = Math.min(d, L.stick.r); if (d > 0) { kx += dx / d * m; ky += dy / d * m; } }
    ctx.fillStyle = 'rgba(62,232,255,0.75)'; ctx.beginPath(); ctx.arc(kx, ky, 40, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(kx - 10, ky - 10, 14, 0, 7); ctx.fill();
    // 기본 공격
    const w = G.weapon(), T = WTYPES[w.wt];
    const talk = G.near && !G.enemies.some((e) => !e.dead && Math.abs(e.x - P.x) < 520);
    this.btn(ctx, L.atk, talk ? '#5dff9a' : '#ff3fa4', INPUT.atk || INPUT.pressed.atk);
    ctx.fillStyle = '#fff'; ctx.font = FONT(talk ? 30 : 46, true); ctx.textAlign = 'center';
    ctx.fillText(talk ? '💬' : T.melee ? '⚔' : '➹', L.atk.x, L.atk.y + (talk ? 10 : 16));
    ctx.font = FONT(13, true); ctx.fillStyle = '#ffd6ee'; ctx.fillText(talk ? '대화' : '공격', L.atk.x, L.atk.y + 50);
    // 스킬
    for (const k of ['atk', 'util', 'ult']) {
      const b = L.sk[k], id = S.slots[k], sk = id ? SKILL[id] : null;
      const col = sk ? sk.c : '#5a6080';
      this.btn(ctx, b, col, INPUT.pressed[k]);
      if (sk) {
        ctx.font = FONT(k === 'ult' ? 34 : 28, true); ctx.fillStyle = '#fff'; ctx.fillText(sk.icon, b.x, b.y + 11);
        const cd = P.cd[k];
        const ready = k === 'ult' ? P.ult >= 100 : P.ram >= sk.ram;
        if (k === 'ult') { ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * P.ult / 100); ctx.stroke(); if (P.ult >= 100) { ctx.strokeStyle = hexA('#ffd23e', 0.5 + Math.sin(G.time * 8) * 0.4); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 10, 0, 7); ctx.stroke(); } }
        if (cd > 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd / (sk.cd || 1))); ctx.closePath(); ctx.fill();
          ctx.font = FONT(18, true); ctx.fillStyle = '#fff'; ctx.fillText(cd.toFixed(cd < 1 ? 1 : 0), b.x, b.y + 7);
        } else if (!ready) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); }
      } else { ctx.font = FONT(22, true); ctx.fillStyle = '#5a6080'; ctx.fillText('+', b.x, b.y + 8); }
      ctx.font = FONT(12, true); ctx.fillStyle = '#c9d2e3';
      ctx.fillText(sk ? sk.n : SLOT_NAME[k], b.x, b.y + b.r + 16);
    }
    // 아이템 칸
    const ib = L.item, qid = S.quick, qit = qid && ITEMS[qid];
    this.btn(ctx, ib, qit ? GRADES[qit.g].c : '#5a6080', INPUT.pressed.item);
    if (qit) {
      ctx.save(); ctx.translate(ib.x, ib.y - 2); ctx.rotate(Math.PI / 4); ctx.fillStyle = GRADES[qit.g].c; ctx.fillRect(-11, -11, 22, 22); ctx.fillStyle = '#0a0714'; ctx.fillRect(-6, -6, 12, 12); ctx.restore();
      ctx.font = FONT(14, true); ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.fillText('×' + (S.inv[qid] || 0), ib.x + ib.r - 2, ib.y + ib.r - 4); ctx.textAlign = 'center';
    } else { ctx.font = FONT(20, true); ctx.fillStyle = '#5a6080'; ctx.fillText('+', ib.x, ib.y + 7); }
    ctx.font = FONT(12, true); ctx.fillStyle = '#c9d2e3'; ctx.fillText(qit ? (qit.n.length > 7 ? qit.n.slice(0, 7) + '…' : qit.n) : '아이템', ib.x, ib.y + ib.r + 15);
  },
};
