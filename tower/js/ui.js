'use strict';
/* 화면 위 메뉴(DOM): 타이틀, 직업 고르기, 강화 카드, 유물, 상점, 별의 제단, 일시정지, 설정, 결과 */

const UI = (() => {
  let root, stage;
  let keyHandler = null;
  const $ = (s, el = root) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const portrait = vh > vw && document.body.classList.contains('touch');
    const availH = portrait ? vh - 230 : vh;
    const s = Math.min(vw / 1066, availH / 600);
    stage.style.transform = `translate(-50%, ${portrait ? '0' : '-50%'}) scale(${s})`;
    stage.style.top = portrait ? '8px' : '50%';
    document.body.classList.toggle('portrait', portrait);
    G.scale = s;
  }
  function init() {
    root = document.getElementById('ui');
    stage = document.getElementById('stage');
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', () => setTimeout(fit, 200));
    window.addEventListener('touchstart', () => setTimeout(fit, 50), { once: true });
    fit();
    window.addEventListener('keydown', (e) => { if (keyHandler) keyHandler(e); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { SND.suspend(); if (G.state === 'play') pause(); }
      else SND.resume();
    });
    root.addEventListener('click', () => SND.unlock());
  }
  function show(html, cls = '') {
    root.innerHTML = `<div class="scr ${cls}">${html}</div>`;
    root.classList.add('on');
    keyHandler = null;
    return root.firstChild;
  }
  function hide() { root.innerHTML = ''; root.classList.remove('on'); keyHandler = null; }
  function hud(on) { document.body.classList.toggle('playing', !!on); }
  const click = (sel, fn, el = root) => { const b = el.querySelector(sel); if (b) b.addEventListener('click', (e) => { e.stopPropagation(); SND.unlock(); SND.sfx('ok'); fn(e); }); };
  const icon = (name, k = 3) => `<img class="ico" src="${ICONS.url(name, k)}" alt="">`;

  /* ───────── 타이틀 ───────── */
  function title() {
    G.state = 'title';
    SND.play('title');
    const run = G.loadRun(), m = G.meta;
    const el = show(`
      <div class="logo"><h1>별을 삼킨 탑</h1><p>TOWER OF THE STAR EATER</p></div>
      <div class="menu">
        ${run ? `<button class="btn gold" id="bCont">이어하기 <small>${DATA.CLASSES[run.cls].title} · ${run.floor}층</small></button>` : ''}
        <button class="btn" id="bNew">새 등반</button>
        <button class="btn" id="bAltar">별의 제단 <small>${m.shards} ✦</small></button>
        <button class="btn" id="bRec">기록</button>
        <button class="btn" id="bSet">설정</button>
        <button class="btn" id="bHelp">조작법</button>
      </div>
      <p class="foot">${m.best ? `최고 ${Math.min(50, m.best)}층 · ` : ''}${m.clears ? `등정 ${m.clears}회 · ` : ''}5계층 50층 · 5층마다 중간 보스, 10층마다 계층 보스</p>
      <p class="hint audio-hint">♪ 화면을 누르면 소리가 켜져요</p>`, 'title');
    click('#bCont', () => { G.run = run; hide(); G.startFloor(); });
    click('#bNew', () => { if (run && !confirm('저장된 등반이 사라집니다. 새로 시작할까요?')) return; classSelect(); });
    click('#bAltar', altar);
    click('#bRec', records);
    click('#bSet', () => settings(title));
    click('#bHelp', () => help(title));
    void el;
  }

  /* ───────── 직업 고르기 ───────── */
  function classSelect() {
    const m = G.meta;
    let tier = 0;
    const cards = Object.entries(DATA.CLASSES).map(([id, c]) => `
      <button class="card cls" data-id="${id}">
        <canvas width="36" height="46" data-hero="${id}"></canvas>
        <h3>${c.title} <b>${c.name}</b></h3>
        <div class="stats"><span>체력 ${c.hp}</span><span>공격 ${c.dmg}</span><span>속도 ${c.spd}</span></div>
        <p>${c.atk}</p>
        <p class="sk">${icon('skill_' + id, 2)} <b>${c.skill.name}</b> ${c.skill.desc}</p>
      </button>`).join('');
    const tiers = m.unlocked ? `<div class="tiers"><span>시작 계층</span>${DATA.TIERS.slice(0, (m.unlocked || 0) + 1).map((t, i) => `<button class="chip ${i ? '' : 'sel'}" data-t="${i}">${i * 10 + 1}층 · ${t.name}</button>`).join('')}</div><p class="small" id="tierNote"></p>` : '';
    show(`<h2>누구로 오를까</h2><div class="row3">${cards}</div>${tiers}<button class="btn ghost back" id="bBack">← 돌아가기</button>`, 'classes');
    const anim = () => {
      if (!root.querySelector('[data-hero]')) return;
      const f = Math.floor(performance.now() / 120) % 4;
      for (const c of root.querySelectorAll('[data-hero]')) { const x = c.getContext('2d'); x.clearRect(0, 0, 36, 46); x.drawImage(ART.get(`hero_${c.dataset.hero}_down`, f).c, 0, 0); }
      requestAnimationFrame(anim);
    };
    anim();
    for (const b of root.querySelectorAll('.card.cls')) b.addEventListener('click', () => { SND.unlock(); SND.sfx('pick'); hide(); G.newRun(b.dataset.id, tier); });
    for (const b of root.querySelectorAll('.chip[data-t]')) b.addEventListener('click', () => {
      tier = +b.dataset.t; SND.sfx('menu');
      root.querySelectorAll('.chip[data-t]').forEach(c => c.classList.toggle('sel', c === b));
      $('#tierNote').textContent = tier ? `${tier * 10 + 1}층부터 시작하면 강화 ${tier * 8}개와 유물 ${tier}개, 골드 ${tier * 120}을(를) 무작위로 받습니다.` : '';
    });
    click('#bBack', title);
    keyHandler = (e) => { if (e.key === 'Escape') title(); const n = +e.key; if (n >= 1 && n <= 3) root.querySelectorAll('.card.cls')[n - 1].click(); };
  }

  /* ───────── 강화 ───────── */
  function rollUpgrades(run, n) {
    const pool = DATA.UPG.filter(u => (run.upg[u.id] || 0) < u.max);
    const out = [];
    const f = run.floor;
    while (out.length < n && pool.length) {
      const u = U.R.weighted(pool, x => DATA.RARITY[x.r].w * (x.r === 3 ? Math.min(2.5, 0.5 + f / 15) : x.r === 2 ? Math.min(1.6, 0.6 + f / 25) : 1) * (x.id === 'heal' ? (ENT.w && ENT.w.player.hp < ENT.w.player.st.maxHp * 0.5 ? 2.5 : 0.6) : 1));
      out.push(u); pool.splice(pool.indexOf(u), 1);
    }
    return out;
  }
  function applyUpgrade(u) {
    const run = G.run;
    if (!u.once) run.upg[u.id] = (run.upg[u.id] || 0) + 1;
    const p = ENT.w.player;
    const oldMax = p.st.maxHp;
    p.st = ENT.stats(run);
    if (p.st.maxHp > oldMax && !u.now) p.hp += p.st.maxHp - oldMax;
    if (u.now) u.now(p);
    p.hp = Math.min(p.hp, p.st.maxHp);
    run.hp = p.hp;
    SND.sfx(u.r >= 3 ? 'legend' : 'pick');
  }
  function cardHtml(u, i, price) {
    const n = G.run.upg[u.id] || 0, R = DATA.RARITY[u.r];
    return `<button class="card upg r${u.r}" data-i="${i}" style="--rc:${R.color}">
      <span class="rar">${R.name}</span>${icon(u.icon, 3)}<h3>${esc(u.name)}</h3><p>${esc(u.d)}</p>
      <span class="lv">${u.once ? '' : `${n} → ${n + 1}${u.max < 99 ? ' / ' + u.max : ''}`}</span>${price !== undefined ? `<span class="price">${price} G</span>` : ''}<kbd>${i + 1}</kbd></button>`;
  }
  function upgrades(done) {
    const run = G.run, st = ENT.w.player.st;
    const n = st.cards;
    let rerolls = run.rerolls + (run.relicRerollsGiven ? 0 : 0);
    let cards = rollUpgrades(run, n);
    const draw = () => {
      show(`<h2>${run.floor}층 돌파</h2><p class="sub">강화 하나를 고르세요</p>
        <div class="row${cards.length}">${cards.map((u, i) => cardHtml(u, i)).join('')}</div>
        <div class="bar"><button class="btn ghost" id="bRe" ${rerolls > 0 ? '' : 'disabled'}>다시 고르기 (${rerolls})</button><button class="btn ghost" id="bBuild">지금 가진 것</button></div>
        ${hpLine()}`, 'pick');
      root.querySelectorAll('.card.upg').forEach(b => b.addEventListener('click', () => { applyUpgrade(cards[+b.dataset.i]); hide(); done(); }));
      click('#bRe', () => { if (rerolls <= 0) return; rerolls--; run.rerolls--; SND.sfx('reroll'); cards = rollUpgrades(run, n); draw(); });
      click('#bBuild', () => build(draw));
      keyHandler = (e) => { const k = +e.key; if (k >= 1 && k <= cards.length) root.querySelectorAll('.card.upg')[k - 1].click(); if (e.key.toLowerCase() === 'r') $('#bRe').click(); };
    };
    draw();
  }
  function hpLine() {
    const p = ENT.w.player;
    return `<p class="hpline">체력 ${Math.ceil(p.hp)} / ${p.st.maxHp} · 골드 ${G.run.gold}</p>`;
  }

  /* ───────── 유물 ───────── */
  function relics(done) {
    const run = G.run;
    const left = DATA.RELICS.filter(r => !run.relics.includes(r.id));
    U.R.shuffle(left);
    const pick = left.slice(0, 3);
    const p = ENT.w.player;
    p.heal(Math.round(p.st.maxHp * 0.4));
    run.hp = p.hp;
    if (!pick.length) { run.gold += 150; return done(); }
    show(`<h2>보스가 남긴 유물</h2><p class="sub">하나만 가져갈 수 있습니다 · 체력을 40% 회복했습니다</p>
      <div class="row${pick.length}">${pick.map((r, i) => `<button class="card relic" data-i="${i}">${icon(r.icon, 4)}<h3>${esc(r.name)}</h3><p>${esc(r.d)}</p><kbd>${i + 1}</kbd></button>`).join('')}</div>${hpLine()}`, 'pick relics');
    root.querySelectorAll('.card.relic').forEach(b => b.addEventListener('click', () => {
      const r = pick[+b.dataset.i];
      run.relics.push(r.id);
      if (r.id === 'clover') run.rerolls += 3;
      const oldMax = p.st.maxHp; p.st = ENT.stats(run); if (p.st.maxHp > oldMax) p.hp += p.st.maxHp - oldMax;
      p.shield = p.st.shield;
      run.hp = p.hp;
      SND.sfx('legend'); hide(); done();
    }));
    keyHandler = (e) => { const k = +e.key; if (k >= 1 && k <= pick.length) root.querySelectorAll('.card.relic')[k - 1].click(); };
  }

  /* ───────── 상점 ───────── */
  function shop(done) {
    const run = G.run, p = ENT.w.player, tier = Math.floor((run.floor - 1) / 10);
    const mul = (1 + tier * 0.45) * (1 - (p.st.discount || 0));
    const price = (v) => Math.round(v * mul);
    let stock = rollUpgrades(run, 3).map(u => ({ u, cost: price([45, 80, 140, 240][u.r]), sold: false }));
    let healBought = 0, hpBought = 0, rerollCost = price(20);
    const draw = () => {
      const healCost = price(35 + healBought * 25), hpCost = price(60 + hpBought * 40);
      show(`<h2>떠돌이 상인</h2><p class="sub">「별빛 조각을 모으는 손님이군. 천천히 골라 보게.」</p>
        <div class="shop">
          <button class="card item" id="sHeal" ${run.gold < healCost || p.hp >= p.st.maxHp ? 'disabled' : ''}>${icon('heal', 3)}<h3>회복 물약</h3><p>체력 35% 회복</p><span class="price">${healCost} G</span></button>
          <button class="card item" id="sHp" ${run.gold < hpCost ? 'disabled' : ''}>${icon('vigor', 3)}<h3>생명의 열매</h3><p>최대 체력 +15</p><span class="price">${hpCost} G</span></button>
          ${stock.map((s, i) => s.sold ? `<div class="card item sold"><h3>팔림</h3></div>` : cardHtml(s.u, i, s.cost).replace('class="card upg', `class="card upg item ${run.gold < s.cost ? 'poor' : ''}`)).join('')}
        </div>
        <div class="bar"><button class="btn ghost" id="sRe" ${run.gold < rerollCost ? 'disabled' : ''}>물건 바꾸기 (${rerollCost} G)</button><button class="btn ghost" id="bBuild">지금 가진 것</button><button class="btn gold" id="sGo">다음 층으로 ▲</button></div>
        ${hpLine()}`, 'shopscr');
      click('#sHeal', () => { if (run.gold < healCost) return SND.sfx('error'); run.gold -= healCost; healBought++; p.heal(p.st.maxHp * 0.35); run.hp = p.hp; SND.sfx('buy'); draw(); });
      click('#sHp', () => { if (run.gold < hpCost) return SND.sfx('error'); run.gold -= hpCost; hpBought++; run.bonusHp = (run.bonusHp || 0) + 15; p.st = ENT.stats(run); p.hp += 15; run.hp = p.hp; SND.sfx('buy'); draw(); });
      root.querySelectorAll('.card.upg').forEach(b => b.addEventListener('click', () => {
        const s = stock[+b.dataset.i];
        if (s.sold) return;
        if (run.gold < s.cost) return SND.sfx('error');
        run.gold -= s.cost; s.sold = true; applyUpgrade(s.u); draw();
      }));
      click('#sRe', () => { if (run.gold < rerollCost) return; run.gold -= rerollCost; rerollCost = Math.round(rerollCost * 1.5); stock = rollUpgrades(run, 3).map(u => ({ u, cost: price([45, 80, 140, 240][u.r]), sold: false })); SND.sfx('reroll'); draw(); });
      click('#bBuild', () => build(draw));
      click('#sGo', () => { hide(); done(); });
      keyHandler = (e) => { if (e.key === 'Enter') $('#sGo').click(); };
    };
    draw();
  }

  /* ───────── 가진 것 ───────── */
  function build(back) {
    const run = G.run, p = ENT.w.player, s = p.st;
    const ups = Object.entries(run.upg).filter(([, n]) => n > 0).map(([id, n]) => ({ u: DATA.UPG_BY[id], n })).filter(x => x.u).sort((a, b) => b.u.r - a.u.r);
    const rel = run.relics.map(id => DATA.RELIC_BY[id]).filter(Boolean);
    const stat = [
      ['공격력', Math.round(s.dmg * s.dmgMul)], ['공격 속도', `×${s.atkSpd.toFixed(2)}`], ['치명타', `${Math.round(s.crit * 100)}% · ×${s.critDmg.toFixed(1)}`],
      ['이동 속도', Math.round(s.spd * s.spdMul)], ['받는 피해', `-${Math.round(s.armor * 100)}%`], ['투사체', `+${s.proj} · 관통 ${s.pierce}`], ['구르기', `${s.dashCd.toFixed(2)}초`], ['스킬 재사용', `×${s.skillCd.toFixed(2)}`]
    ];
    show(`<h2>지금 가진 것</h2>
      <div class="buildbox">
        <div class="statgrid">${stat.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
        <h4>유물 ${rel.length}</h4><div class="chips">${rel.map(r => `<div class="tip">${icon(r.icon, 2)}<span><b>${esc(r.name)}</b> ${esc(r.d)}</span></div>`).join('') || '<p class="small">아직 없음</p>'}</div>
        <h4>강화 ${ups.reduce((a, b) => a + b.n, 0)}</h4><div class="chips">${ups.map(({ u, n }) => `<div class="tip r${u.r}">${icon(u.icon, 2)}<span><b>${esc(u.name)}${n > 1 ? ' ×' + n : ''}</b> ${esc(u.d)}</span></div>`).join('') || '<p class="small">아직 없음</p>'}</div>
      </div><button class="btn" id="bBack">돌아가기</button>`, 'build');
    click('#bBack', back);
    keyHandler = (e) => { if (e.key === 'Escape') back(); };
  }

  /* ───────── 일시정지 ───────── */
  function pause() {
    if (G.state !== 'play') return;
    G.state = 'pause';
    hud(false);
    const draw = () => {
      show(`<h2>잠시 멈춤</h2><p class="sub">${G.run.floor}층 · ${DATA.TIERS[ENT.w.L.tier].name} · ${U.fmtTime(G.run.time)}</p>
        <div class="menu">
          <button class="btn gold" id="pRes">계속하기</button>
          <button class="btn" id="pBuild">지금 가진 것</button>
          <button class="btn" id="pSet">설정</button>
          <button class="btn" id="pHelp">조작법</button>
          <button class="btn ghost" id="pQuit">층 처음에 저장하고 타이틀로</button>
          <button class="btn ghost danger" id="pGive">등반 포기</button>
        </div>`, 'pause');
      click('#pRes', resume);
      click('#pBuild', () => build(draw));
      click('#pSet', () => settings(draw));
      click('#pHelp', () => help(draw));
      click('#pQuit', () => { hide(); title(); });
      click('#pGive', () => { if (!confirm('이번 등반을 포기할까요? 얻은 별조각은 받습니다.')) return; G.state = 'play'; const sh = G.endRun(false); SND.play('gameover'); gameOver(G.run, sh); });
      keyHandler = (e) => { if (e.key === 'Escape' || e.key.toLowerCase() === 'p') resume(); };
    };
    draw();
  }
  function resume() { hide(); G.state = 'play'; hud(true); }

  /* ───────── 설정 ───────── */
  function settings(back) {
    const s = G.meta.settings;
    const autoVal = s.auto === null ? 'default' : s.auto ? 'on' : 'off';
    show(`<h2>설정</h2><div class="form">
      <label>음악 <input type="range" min="0" max="1" step="0.05" id="sMus" value="${s.music}"></label>
      <label>효과음 <input type="range" min="0" max="1" step="0.05" id="sSfx" value="${s.sfx}"></label>
      <label>화면 흔들림 <input type="range" min="0" max="1" step="0.25" id="sShake" value="${s.shake}"></label>
      <label>피해 숫자 <select id="sNums"><option value="1" ${s.nums ? 'selected' : ''}>보기</option><option value="0" ${s.nums ? '' : 'selected'}>숨기기</option></select></label>
      <label>자동 공격 <select id="sAuto"><option value="default" ${autoVal === 'default' ? 'selected' : ''}>터치에서만</option><option value="on" ${autoVal === 'on' ? 'selected' : ''}>항상</option><option value="off" ${autoVal === 'off' ? 'selected' : ''}>끄기</option></select></label>
      <label>프레임 표시 <select id="sFps"><option value="0">끄기</option><option value="1" ${G.showFps ? 'selected' : ''}>켜기</option></select></label>
    </div><button class="btn" id="bBack">돌아가기</button>`, 'settings');
    const save = () => { G.saveMeta(); };
    $('#sMus').addEventListener('input', (e) => { s.music = +e.target.value; SND.setVolume('music', s.music); save(); });
    $('#sSfx').addEventListener('input', (e) => { s.sfx = +e.target.value; SND.setVolume('sfx', s.sfx); SND.sfx('hit'); save(); });
    $('#sShake').addEventListener('input', (e) => { s.shake = +e.target.value; FX.opt.shake = s.shake; save(); });
    $('#sNums').addEventListener('change', (e) => { s.nums = e.target.value === '1'; FX.opt.nums = s.nums; save(); });
    $('#sAuto').addEventListener('change', (e) => { s.auto = e.target.value === 'default' ? null : e.target.value === 'on'; save(); });
    $('#sFps').addEventListener('change', (e) => { G.showFps = e.target.value === '1'; });
    click('#bBack', back);
    keyHandler = (e) => { if (e.key === 'Escape') back(); };
  }
  function help(back) {
    show(`<h2>조작법</h2><div class="help">
      <div><h4>키보드·마우스</h4><p><kbd>W A S D</kbd>·방향키 이동<br><kbd>왼쪽 클릭</kbd> 공격(누르고 있으면 계속), 마우스로 조준<br><kbd>오른쪽 클릭</kbd>·<kbd>K</kbd> 스킬<br><kbd>Space</kbd>·<kbd>Shift</kbd> 구르기(잠깐 무적)<br><kbd>J</kbd> 가까운 적 자동 조준 공격<br><kbd>Esc</kbd>·<kbd>P</kbd> 멈춤</p></div>
      <div><h4>터치·게임패드</h4><p>화면 왼쪽을 끌어 이동, 오른쪽 버튼으로 공격·구르기·스킬. 터치에서는 가까운 적을 자동으로 겨누고 공격합니다(설정에서 바꿀 수 있음).<br>게임패드: 왼쪽 스틱 이동, 오른쪽 스틱 조준·공격, A 구르기, X 스킬, Start 멈춤.</p></div>
      <div><h4>탑 오르기</h4><p>탑은 10층씩 5계층입니다. 5층마다 중간 보스, 10층마다 계층 보스가 있고 나머지 층은 몬스터 무리를 모두 물리치면 위쪽 출구가 열립니다. 층을 돌파하면 강화를 고르고, 보스를 쓰러뜨리면 유물을 하나 얻고 상인을 만납니다. 쓰러지면 별조각을 받아 별의 제단에서 영구 강화를 살 수 있습니다. 진행은 층을 시작할 때마다 저장됩니다.</p></div>
      <div><h4>살아남기</h4><p>붉게 깔리는 표시는 곧 공격이 떨어질 자리입니다. 구르는 동안에는 맞지 않고, 구르면 구덩이도 건널 수 있습니다. 반짝이는 몬스터는 곧 공격합니다. 검사의 베기는 적의 작은 탄환을 지웁니다.</p></div>
    </div><button class="btn" id="bBack">돌아가기</button>`, 'helpscr');
    click('#bBack', back);
    keyHandler = (e) => { if (e.key === 'Escape') back(); };
  }

  /* ───────── 별의 제단 ───────── */
  function altar() {
    const m = G.meta;
    const draw = () => {
      show(`<h2>별의 제단</h2><p class="sub">등반에서 모은 별조각으로 영원히 강해집니다 · 가진 별조각 <b class="shards">${m.shards} ✦</b></p>
        <div class="altar">${DATA.META.map(x => {
          const lv = m.lv[x.id] || 0, max = x.cost.length, cost = x.cost[lv];
          return `<button class="card meta ${lv >= max ? 'max' : ''}" data-id="${x.id}" ${lv >= max || m.shards < cost ? 'disabled' : ''}>${icon(x.icon, 2)}<h3>${x.name}</h3>
            <p>${lv ? x.d(lv) : '아직 없음'}${lv < max ? `<br><small>다음: ${x.d(lv + 1)}</small>` : ''}</p><span class="lv">${'◆'.repeat(lv)}${'◇'.repeat(max - lv)}</span><span class="price">${lv >= max ? '완성' : cost + ' ✦'}</span></button>`;
        }).join('')}</div><button class="btn" id="bBack">돌아가기</button>`, 'altarscr');
      root.querySelectorAll('.card.meta').forEach(b => b.addEventListener('click', () => {
        const x = DATA.META.find(v => v.id === b.dataset.id), lv = m.lv[x.id] || 0;
        if (lv >= x.cost.length || m.shards < x.cost[lv]) return SND.sfx('error');
        m.shards -= x.cost[lv]; m.lv[x.id] = lv + 1; G.saveMeta(); SND.sfx('legend'); draw();
      }));
      click('#bBack', title);
      keyHandler = (e) => { if (e.key === 'Escape') title(); };
    };
    draw();
  }
  function records() {
    const m = G.meta;
    show(`<h2>기록</h2><div class="statgrid big">
      <div><span>최고 도달</span><b>${m.best ? Math.min(50, m.best) + '층' : '-'}</b></div>
      <div><span>등정</span><b>${m.clears}회</b></div>
      <div><span>등반 횟수</span><b>${m.runs}회</b></div>
      <div><span>쓰러뜨린 적</span><b>${m.kills}</b></div>
      <div><span>가장 빠른 등정</span><b>${m.bestTime ? U.fmtTime(m.bestTime) : '-'}</b></div>
      <div><span>열린 시작 계층</span><b>${(m.unlocked || 0) + 1}계층</b></div>
    </div><button class="btn" id="bBack">돌아가기</button>`, 'records');
    click('#bBack', title);
    keyHandler = (e) => { if (e.key === 'Escape') title(); };
  }

  /* ───────── 결과 ───────── */
  function resultHtml(run, sh) {
    const C = DATA.CLASSES[run.cls];
    return `<div class="statgrid">
      <div><span>직업</span><b>${C.title} ${C.name}</b></div><div><span>도달</span><b>${run.floor}층</b></div>
      <div><span>시간</span><b>${U.fmtTime(run.time)}</b></div><div><span>쓰러뜨린 적</span><b>${run.kills}</b></div>
      <div><span>보스</span><b>중간 ${run.mid} · 계층 ${run.bossKills}</b></div><div><span>준 피해</span><b>${Math.round(run.dmgDealt || 0).toLocaleString()}</b></div>
    </div><p class="gain">별조각 +${sh} ✦</p>`;
  }
  function gameOver(run, sh) {
    G.state = 'dead';
    show(`<h2 class="red">쓰러졌다</h2><p class="sub">${run.floor}층 · ${DATA.TIERS[Math.floor((run.floor - 1) / 10)].name}</p>${resultHtml(run, sh)}
      <div class="bar"><button class="btn gold" id="bAgain">다시 오르기</button><button class="btn" id="bAltar">별의 제단</button><button class="btn ghost" id="bTitle">타이틀</button></div>`, 'result');
    click('#bAgain', classSelect); click('#bAltar', altar); click('#bTitle', title);
  }
  function victory(run, sh) {
    show(`<h2 class="gold">별을 되찾았다</h2>
      <p class="story">별을 삼킨 자가 무너지자, 그 안에 갇혀 있던 빛이 한꺼번에 터져 나왔다.<br>탑 꼭대기에서 올려다본 밤하늘에, 사라졌던 별들이 하나둘 제자리로 돌아간다.<br>그날 밤, 땅 위의 사람들은 오랜만에 별자리를 셀 수 있었다.</p>
      ${resultHtml(run, sh)}
      <div class="bar"><button class="btn gold" id="bAgain">다시 오르기</button><button class="btn ghost" id="bTitle">타이틀</button></div>`, 'result win');
    click('#bAgain', classSelect); click('#bTitle', title);
  }

  return { init, title, classSelect, upgrades, relics, shop, pause, resume, settings, help, altar, records, gameOver, victory, hud, hide, build, rollUpgrades, applyUpgrade };
})();
