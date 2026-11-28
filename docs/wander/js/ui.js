'use strict';
/* 은빛 유랑기 — 화면: 이야기 기록, 주사위, 선택지, 상태창(상태·가방·임무·지도·일지) */

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const UI = {
  queue: [], pending: null, tab: 'status',

  /* ── 이야기 기록 ── */
  say(html, cls = '') { UI.queue.push({ k: 'text', html, cls }); },
  head(title) { UI.queue.push({ k: 'title', html: title }); },
  dice(info) { UI.queue.push({ k: 'dice', info }); },
  choices(list) { UI.pending = list; },

  flush() {
    const log = $('#log'), box = $('#choices');
    box.innerHTML = ''; box.classList.remove('show');
    let delay = 0;
    const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const q of UI.queue) {
      const el = document.createElement('div');
      if (q.k === 'title') { el.className = 'entry title'; el.innerHTML = q.html; }
      else if (q.k === 'text') { el.className = 'entry ' + q.cls; el.innerHTML = q.html; }
      else el.appendChild(UI.diceEl(q.info, delay)), el.className = 'entry dice-row';
      el.style.animationDelay = fast ? '0ms' : delay + 'ms';
      log.appendChild(el);
      delay += q.k === 'dice' ? 520 : 90;
    }
    UI.queue = [];
    while (log.children.length > 160) log.firstChild.remove();
    const list = UI.pending; UI.pending = null;
    if (list) UI.awaiting = true;
    const show = () => {
      UI.awaiting = false;
      if (list) UI.renderChoices(list);
      log.lastElementChild && log.lastElementChild.scrollIntoView({ block: 'end', behavior: fast ? 'auto' : 'smooth' });
    };
    if (fast) show(); else setTimeout(show, Math.min(delay, 1400));
    requestAnimationFrame(() => { const s = $('#story-scroll'); s.scrollTop = s.scrollHeight; });
  },

  diceEl(i, delay) {
    const wrap = document.createElement('div');
    wrap.className = 'dice ' + (i.ok ? 'ok' : 'no') + (i.enemy ? ' enemy' : '') + (i.crit ? ' crit' : '') + (i.fumble ? ' fumble' : '');
    const res = i.enemy ? (i.ok ? '명중' : '빗나감') : (i.crit ? '대성공' : i.fumble ? '대실패' : i.ok ? '성공' : '실패');
    wrap.innerHTML = `<span class="d20" aria-hidden="true"><svg viewBox="0 0 40 40"><polygon points="20,2 37,11 37,29 20,38 3,29 3,11"/><path d="M20 2 12 24H28L20 2M3 11 12 24 3 29M37 11 28 24 37 29M12 24 20 38 28 24"/></svg><b>${i.roll}</b></span>
      <span class="dice-txt"><span class="dl">${esc(i.label)}</span><span class="dm">d20 <b>${i.roll}</b> ${sign(i.bonus)} = <b>${i.total}</b> <span class="vs">vs ${i.dcLabel || 'DC'} ${i.dc}</span></span></span>
      <span class="res">${res}</span>`;
    const num = wrap.querySelector('.d20 b');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t0 = Date.now() + delay;
      const tick = () => {
        const now = Date.now();
        if (now < t0) return requestAnimationFrame(tick);
        if (now - t0 < 420) { num.textContent = 1 + Math.floor(Math.random() * 20); requestAnimationFrame(tick); }
        else num.textContent = i.roll;
      };
      requestAnimationFrame(tick);
    }
    return wrap;
  },

  renderChoices(list) {
    const box = $('#choices');
    box.innerHTML = '';
    list.forEach((c, n) => {
      const b = document.createElement('button');
      b.className = 'choice ' + (c.cls || '');
      b.disabled = !!c.disabled;
      b.innerHTML = `<span class="cn">${n + 1}</span><span class="ct">${c.t}${c.hint ? `<small>${c.hint}</small>` : ''}</span>`;
      b.onclick = () => {
        if (box.dataset.lock) return; box.dataset.lock = 1; box.classList.remove('show');
        c.fn(); delete box.dataset.lock;
        if (!UI.awaiting && $('#modal').hidden && box.contains(b)) box.classList.add('show');
      };
      box.appendChild(b);
    });
    requestAnimationFrame(() => box.classList.add('show'));
  },

  enemyCard(C) {
    const el = $('#enemy');
    if (!C) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    const pct = Math.round(C.hp / C.max * 100);
    const st = [];
    if (C.stun) st.push('멍함'); if (C.mark) st.push('약점 노출'); if (C.enraged) st.push('분노');
    const me = [];
    if (G.S.poison) me.push(`중독 ${G.S.poison}`); if (G.S.chill) me.push(`둔화 ${G.S.chill}`);
    if (C.sharp) me.push(`날 +${C.sharp}`);
    if (C.buff.acT) me.push(`방어 +${C.buff.ac} (${C.buff.acT})`); if (C.buff.hitT) me.push(`고양 (${C.buff.hitT})`);
    el.innerHTML = `<div class="en-top"><b>${C.e.name}</b>${C.e.boss ? '<span class="tag boss">우두머리</span>' : ''}<span class="en-ac">방어도 ${Combat.enemyAc()}</span></div>
      <div class="bar hp"><i style="width:${pct}%"></i><span>${C.hp} / ${C.max}</span></div>
      <div class="en-st">${st.map(s => `<span class="tag">${s}</span>`).join('')}${me.map(s => `<span class="tag me">${s}</span>`).join('')}<span class="en-turn">${C.turn}턴</span></div>`;
  },

  /* ── 위쪽 요약 막대와 장면 머리 ── */
  renderTop() {
    const S = G.S; if (!S) return;
    const R = REGIONS[S.region];
    $('#tb-name').textContent = S.name;
    $('#tb-lv').textContent = `Lv.${S.lvl} ${G.className()}`;
    UI.bar($('#tb-hp'), S.hp, G.maxHp());
    UI.bar($('#tb-mp'), S.mp, G.maxMp());
    $('#tb-gold').textContent = S.gold;
    $('#tb-alert').hidden = !S.pendingStat && !S.sp;
    document.documentElement.style.setProperty('--region', R.color);
    $('#sh-region').textContent = `${R.icon} ${R.name} · ${R.land}`;
    $('#sh-town').textContent = R.town;
    $('#sh-time').textContent = `${S.day}일째 ${PHASES[S.phase]}`;
    $('#app').dataset.danger = S.hp <= G.maxHp() * 0.3 ? '1' : '';
  },
  bar(el, v, m) {
    el.querySelector('i').style.width = Math.round(clamp(v / m, 0, 1) * 100) + '%';
    el.querySelector('span').textContent = `${v} / ${m}`;
  },

  /* ── 상태창 ── */
  setTab(t) {
    UI.tab = t;
    document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
    UI.renderPanel();
  },
  renderPanel() {
    const S = G.S; if (!S) return;
    const body = $('#panel-body');
    body.innerHTML = UI['tab_' + UI.tab]();
    body.querySelectorAll('[data-act]:not([data-act=""])').forEach(b => {
      b.onclick = () => UI.act(b.dataset.act, b.dataset.id);
      if (b.tagName === 'g') b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.onclick(); } };
    });
  },

  tab_status() {
    const S = G.S, C = CLASSES[S.cls], w = G.weapon();
    const xpPct = Math.round(S.xp / G.xpNeed() * 100);
    const stats = STAT_KEYS.map(k => {
      const v = G.stat(k), m = G.mod(k), cb = G.checkBonus(k), plus = S.pendingStat ? `<button class="plus" data-act="stat" data-id="${k}" aria-label="${STATS[k].name} 올리기">+</button>` : '';
      return `<div class="stat" title="${STATS[k].desc}"><span class="sn">${STATS[k].name}</span><span class="sv">${v}</span><span class="sm">${sign(m)}</span><span class="sc">판정 ${sign(cb)}</span>${plus}</div>`;
    }).join('');
    const eq = SLOTS.map(slot => {
      const it = ITEMS[S.eq[slot]];
      let runes = '';
      if (slot === 'weapon' || slot === 'armor') {
        const holes = it ? it.sockets || 0 : 0, list = S.runes[slot] || [], word = G.runeword(slot);
        const n = Math.max(holes, list.length);
        if (n) runes = `<div class="sockets">${Array.from({ length: n }, (_, i) => list[i]
          ? `<button class="rune ${i < holes ? '' : 'off'}" data-act="unsock" data-id="${slot}:${i}" title="${RUNES[list[i]].desc} · 누르면 금화 15로 회수">${RUNES[list[i]].name.replace(' 룬', '')}</button>`
          : `<span class="rune empty" title="빈 홈 — 가방에서 룬을 새기세요">◇</span>`).join('')}${word ? `<span class="rword">✦ ${word.name}</span>` : ''}</div>`;
      }
      return `<div class="eq"><span class="eqs">${SLOT_NAMES[slot]}</span>${it ? `<span class="eqn"><span class="g${it.grade || 0}">${it.name}</span><small>${it.desc}${it.sockets ? ` · 홈 ${it.sockets}` : ''}</small>${runes}</span><button class="mini" data-act="unequip" data-id="${slot}">해제</button>` : `<span class="eqn empty">비어 있음${runes}</span>`}</div>`;
    }).join('');
    const seals = ['central', 'west', 'south', 'east', 'north'].map(r => `<span class="seal ${S.seals.includes(r) ? 'on' : ''}" style="--c:${REGIONS[r].color}" title="${REGIONS[r].name}">${REGIONS[r].icon}</span>`).join('');
    return `
      <div class="hero">
        <img src="img/hero.jpg" alt="${esc(S.name)}의 초상: 은빛 머리와 푸른 눈의 여행자">
        <div class="hero-cap"><div class="hero-title">${G.title()}</div><div class="hero-name">${esc(S.name)}</div><div class="hero-cls">${G.classIcon()} ${G.className()} · 레벨 ${S.lvl}</div></div>
      </div>
      <div class="bars">
        <label>체력</label><div class="bar hp"><i style="width:${Math.round(S.hp / G.maxHp() * 100)}%"></i><span>${S.hp} / ${G.maxHp()}</span></div>
        <label>마나</label><div class="bar mp"><i style="width:${Math.round(S.mp / G.maxMp() * 100)}%"></i><span>${S.mp} / ${G.maxMp()}</span></div>
        <label>경험</label><div class="bar xp"><i style="width:${xpPct}%"></i><span>${S.xp} / ${G.xpNeed()}</span></div>
      </div>
      <div class="quick">
        <div><small>방어도</small><b>${G.ac()}</b></div><div><small>명중</small><b>${sign(G.atkBonus())}</b></div>
        <div><small>피해</small><b>${w.dmg}${sign(G.mod(w.stat) + G.bonus('dmg'))}</b></div><div><small>금화</small><b>${S.gold}</b></div>
        <div><small>식량</small><b>${S.inv.ration || 0}</b></div><div><small>날짜</small><b>${S.day}일</b></div>
      </div>
      ${S.pendingStat ? `<div class="notice">능력치 포인트 <b>${S.pendingStat}</b> — 올릴 능력치의 + 를 누르세요</div>` : ''}
      <h3>능력치</h3><div class="stats">${stats}</div>
      <h3>장비</h3>${eq}
      <h3>기술 <small>${S.sp ? `기술 포인트 ${S.sp} — 성장 탭` : ''}</small></h3><div class="skills">${S.skills.map(s => `<div class="sk"><b>${SKILLS[s].name}</b><span class="mpc">MP ${SKILLS[s].mp}</span><small>${SKILLS[s].desc}</small></div>`).join('')}</div>
      <h3>특성과 보너스</h3><p class="trait">${C.trait}${S.job ? `<br>${JOBS[S.job].icon} ${JOBS[S.job].name}: ${JOBS[S.job].blurb}` : ''}</p>
      <div class="bonuses">${Object.keys(BONUS_NAMES).filter(k => !STAT_KEYS.includes(k)).map(k => [k, G.bonus(k)]).filter(([, v]) => v).map(([k, v]) => `<span>${BONUS_NAMES[k]} <b>${sign(v)}</b></span>`).join('') || '<span class="muted">추가 보너스 없음</span>'}${G.critMin() < 20 ? `<span>치명타 <b>${G.critMin()}~20</b></span>` : ''}</div>
      <h3>유람 인장 <small>${S.seals.length} / 5</small></h3><div class="seals">${seals}</div>`;
  },

  tab_bag() {
    const S = G.S;
    const order = 'use weapon helm armor acc rune key';
    const ids = Object.keys(S.inv).sort((a, b) => order.indexOf(ITEMS[a].type) - order.indexOf(ITEMS[b].type) || (ITEMS[b].grade || 0) - (ITEMS[a].grade || 0));
    if (!ids.length) return '<p class="empty-note">가방이 비어 있다.</p>';
    const label = { use: '소모품', weapon: '무기', helm: '투구', armor: '방어구', acc: '장신구', rune: '룬 — 무기·방어구의 홈에 새긴다', key: '귀중품' };
    let html = '', last = '';
    for (const id of ids) {
      const it = ITEMS[id];
      if (it.type !== last) { html += `<h3>${label[it.type]}</h3>`; last = it.type; }
      let btn = '';
      if (it.type === 'use' && !it.combatOnly && Game.mode !== 'combat') btn = `<button class="mini" data-act="use" data-id="${id}">사용</button>`;
      if (SLOTS.includes(it.type)) btn = `<button class="mini" data-act="equip" data-id="${id}">장착</button>`;
      if (it.type === 'rune') btn = `<button class="mini" data-act="socket" data-id="${id}">새기기</button>`;
      html += `<div class="item"><span class="in"><span class="g${it.grade || 0}">${it.name}</span> <em>×${S.inv[id]}</em><small>${it.desc}${it.dmg ? ` · ${it.dmg} ${STATS[it.stat].name}` : ''}${it.sockets ? ` · 홈 ${it.sockets}` : ''}</small></span>${btn}</div>`;
    }
    return html;
  },

  tab_grow() {
    const S = G.S;
    const nodeHtml = n => {
      const own = S.tree.includes(n.id), st = G.canLearn(n);
      const what = n.skill ? `기술: ${SKILLS[n.skill].name} — ${SKILLS[n.skill].desc}` : n.desc;
      return `<div class="node ${own ? 'own' : st.ok ? 'can' : 'lock'}">
        <span class="nl">Lv.${n.lv}</span><span class="nn"><b>${n.skill ? '✨ ' : ''}${n.name}</b><small>${what}${n.req ? ` · 선행: ${n.req.map(r => G.node(r).name).join(', ')}` : ''}</small></span>
        ${own ? '<span class="nown">✓</span>' : `<button class="mini" data-act="learn" data-id="${n.id}" ${st.ok ? '' : 'disabled'}>${st.why}</button>`}</div>`;
    };
    const base = TREES[S.cls].slice().sort((a, b) => a.lv - b.lv).map(nodeHtml).join('');
    let job = '';
    if (S.job) {
      const J = JOBS[S.job];
      job = `<h3>${J.icon} ${J.name} 트리</h3>${J.tree.map(nodeHtml).join('')}`;
    } else {
      const opts = Object.values(JOBS).filter(J => J.base === S.cls);
      job = `<h3>전직</h3><p class="trait">${S.lvl >= 6 ? '레벨 6 달성! 왕도 루멘하르트의 <b>영웅의 전당</b>에서 시험을 받으면 전직할 수 있다.' : '레벨 6이 되면 왕도 루멘하르트의 영웅의 전당에서 전직할 수 있다.'}</p>
        <div class="jobs">${opts.map(J => `<div class="job"><b>${J.icon} ${J.name}</b><small>${J.blurb}</small><small>기술: ${J.skills.map(k => SKILLS[k].name).join(', ')}</small></div>`).join('')}</div>`;
    }
    return `<div class="sp-box"><span>기술 포인트</span><b>${S.sp}</b><small>레벨이 오를 때마다 1점</small></div>
      <h3>${CLASSES[S.cls].icon} ${CLASSES[S.cls].name} 트리</h3>${base}${job}
      <h3>룬어 (같은 칸에 세 룬을 맞추면)</h3><div class="rwords">${RUNEWORDS.map(w => `<div class="rw"><b>${w.name}</b> <small>${SLOT_NAMES[w.slot]} · ${w.need.map(r => RUNES[r].name).join(' + ')} → ${w.desc}</small></div>`).join('')}</div>`;
  },

  tab_quest() {
    const S = G.S;
    const mains = Object.entries(MAINS).map(([id, M]) => {
      const q = S.quest[id] || 0, R = REGIONS[M.region], len = M.scenes.length, done = q >= len, open = !M.unlock || M.unlock(S);
      return `<div class="q ${done ? 'done' : ''} ${open ? '' : 'locked'}" style="--c:${R.color}">
        <div class="qh"><span>${open ? R.icon : '🔒'} ${M.part || R.name} — ${M.name}</span><span class="qs">${done ? '완료' : open ? `${q} / ${len}` : '잠김'}</span></div>
        ${open ? `<div class="qp">${M.scenes.map((_, i) => `<i class="${i < q ? 'on' : ''}"></i>`).join('')}</div>` : ''}
        <small>${!open ? M.lockText : done ? '완료했다.' : `${M.hints[q]} · ${R.town}`} · 권장 Lv.${R.lv}</small></div>`;
    }).join('');
    const sides = Object.entries(SIDEQ).map(([id, Q]) => {
      const n = S.side[id] || 0, R = REGIONS[Q.region], open = Q.unlock(S);
      return `<div class="q side ${n >= 3 ? 'done' : ''} ${open ? '' : 'locked'}" style="--c:${R.color}">
        <div class="qh"><span>${open ? '🧩' : '🔒'} ${R.name} — ${Q.name}</span><span class="qs">${n >= 3 ? '완료' : open ? '진행 가능' : '잠김'}</span></div>
        <small>${!open ? Q.lockText : n >= 3 ? '보답을 받았다.' : Q.hints[n]}</small></div>`;
    }).join('');
    const mem = ['memory_crown', 'memory_sea', 'memory_ash'].filter(id => G.has(id)).length;
    return `<p class="lead">다섯 바람을 모아 마른 청령화를 피워라.</p>
      <div class="quick"><div><small>인장</small><b>${S.seals.length}/5</b></div><div><small>기억 조각</small><b>${mem}/3</b></div><div><small>곁이야기</small><b>${Object.keys(SIDEQ).filter(id => (S.side[id] || 0) >= 3).length}/${Object.keys(SIDEQ).length}</b></div></div>
      <h3>메인 이야기</h3>${mains}<h3>곁이야기</h3>${sides}`;
  },

  tab_map() {
    const S = G.S, ids = Object.keys(REGIONS);
    const vis = r => !REGIONS[r].locked || !REGIONS[r].locked(S);
    const seen = new Set();
    let lines = '';
    for (const a of ids) for (const [b, d] of Object.entries(ROUTES[a])) {
      const k = [a, b].sort().join(); if (seen.has(k)) continue; seen.add(k);
      const A = REGIONS[a], B = REGIONS[b], live = a === S.region || b === S.region, locked = !vis(a) || !vis(b);
      const dx = A.x === B.x ? 4 : 0;
      lines += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="${live ? 'live' : ''} ${locked ? 'locked' : ''}"/><text x="${(A.x + B.x) / 2 + dx}" y="${(A.y + B.y) / 2 + (dx ? 1 : -1.5)}" class="days">${locked ? '' : d + '일'}</text>`;
    }
    const routes = Object.fromEntries(Game.routes(S.region));
    const nodes = ids.map(r => {
      const R = REGIONS[r], here = r === S.region, can = routes[r] && Game.mode === 'hub', v = vis(r);
      return `<g class="node ${here ? 'here' : ''} ${can ? 'can' : ''} ${v ? '' : 'hidden'}" data-act="${can ? 'travel' : ''}" data-id="${r}" style="--c:${R.color}" ${can ? 'role="button" tabindex="0"' : ''}>
        <circle cx="${R.x}" cy="${R.y}" r="${here ? 7.5 : 6}"/><text x="${R.x}" y="${R.y + 1.6}" class="ic">${v ? R.icon : '?'}</text>
        <text x="${R.x}" y="${R.y + (R.y > 70 ? -9.5 : 12)}" class="lb">${v ? R.name : '???'}${S.seals.includes(r) ? ' ✓' : ''}</text></g>`;
    }).join('');
    const list = Game.routes(S.region).map(([r, d]) => `<div class="route"><span><span>${REGIONS[r].icon} <b>${REGIONS[r].name}</b> · ${REGIONS[r].town}</span><small>${d}일 · 권장 Lv.${REGIONS[r].lv}</small></span>${Game.mode === 'hub' ? `<button class="mini" data-act="travel" data-id="${r}">떠나기</button>` : ''}</div>`).join('');
    return `<p class="lead">대륙 에이렌 — 지금 <b>${REGIONS[S.region].town}</b></p>
      <svg class="map" viewBox="0 0 100 100" role="img" aria-label="대륙 지도">
        <defs><radialGradient id="mg" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="var(--map-a)"/><stop offset="1" stop-color="var(--map-b)"/></radialGradient></defs>
        <path d="M14 4 C40 1 70 2 86 8 C96 14 97 34 95 52 C94 64 90 70 80 74 C66 80 60 92 46 96 C30 99 14 94 7 80 C2 64 3 40 4 24 C5 12 8 6 14 4Z" fill="url(#mg)" class="land"/>
        <ellipse cx="86" cy="86" rx="10" ry="7" fill="url(#mg)" class="land"/><ellipse cx="76" cy="93" rx="4" ry="3" fill="url(#mg)" class="land"/><ellipse cx="95" cy="76" rx="3" ry="2.5" fill="url(#mg)" class="land"/>
        ${vis('sky') ? '<ellipse cx="74" cy="22" rx="10" ry="5" class="sky-isle"/>' : ''}
        ${lines}${nodes}</svg>
      ${Game.mode === 'hub' ? '' : '<p class="muted small">마을에 있을 때만 떠날 수 있다.</p>'}
      ${list}`;
  },

  tab_log() {
    const S = G.S;
    const j = S.journal.slice().reverse().map(e => `<li><span>${e.d}일</span>${esc(e.t)}</li>`).join('');
    return `<h3>유람 일지</h3><ul class="journal">${j || '<li>아직 기록이 없다.</li>'}</ul>
      <h3>기록</h3><div class="quick"><div><small>쓰러뜨린 적</small><b>${S.kills}</b></div><div><small>여행한 날</small><b>${S.travelled}</b></div><div><small>인장</small><b>${S.seals.length}/5</b></div></div>
      <h3>몬스터 도감 <small>${Object.keys(S.bestiary).length} / ${Object.keys(ENEMIES).length}</small></h3>
      <div class="bestiary">${Object.entries(ENEMIES).map(([id, e]) => S.bestiary[id]
        ? `<div class="be ${e.boss ? 'boss' : ''}"><b>${e.name}</b><span>×${S.bestiary[id]}</span><small>${e.desc} · 체력 ${e.hp} · 방어도 ${e.ac}</small></div>`
        : `<div class="be unknown"><b>???</b></div>`).join('')}</div>
      <h3>설정</h3>
      <div class="setrow"><span>테마</span><span class="seg">${['auto', 'light', 'dark'].map(z => `<button class="mini ${UI.theme === z ? 'on' : ''}" data-act="theme" data-id="${z}">${{ auto: '자동', light: '밝게', dark: '어둡게' }[z]}</button>`).join('')}</span></div>
      <div class="setrow"><span>글자 크기</span><span class="seg">${['s', 'm', 'l'].map(z => `<button class="mini ${UI.size === z ? 'on' : ''}" data-act="size" data-id="${z}">${{ s: '작게', m: '보통', l: '크게' }[z]}</button>`).join('')}</span></div>
      <div class="setrow"><span>진행은 자동 저장된다</span><button class="mini danger" data-act="reset">새 여정</button></div>`;
  },

  act(a, id) {
    const S = G.S;
    if (a === 'stat' && S.pendingStat > 0) {
      S.st[id]++; S.pendingStat--;
      if (id === 'con') S.hp = Math.min(G.maxHp(), S.hp + 1 + S.lvl);
      UI.toast(`${STATS[id].name} +1`);
    } else if (a === 'equip') { G.equip(id); UI.toast(`${ITEMS[id].name} 장착`); }
    else if (a === 'unequip') G.unequip(id);
    else if (a === 'use') { Game.useItem(id); return; }
    else if (a === 'travel') { if (Game.mode === 'hub') { UI.closeSheet(); Game.travelAsk(id); } return; }
    else if (a === 'learn') { if (G.learn(id)) { const n = G.node(id); UI.toast(n.skill ? `새 기술: ${SKILLS[n.skill].name}` : `${n.name} 습득`); } }
    else if (a === 'socket') { UI.socketMenu(id); return; }
    else if (a === 'unsock') {
      const [slot, i] = id.split(':');
      UI.confirm(`${RUNES[S.runes[slot][+i]].name}을(를) 금화 15로 회수할까요? 룬은 가방으로 돌아온다.`, () => { if (G.unsocket(slot, +i)) UI.toast('룬을 회수했다'); else UI.toast('금화가 모자란다'); G.save(); Game.refresh(); });
      return;
    }
    else if (a === 'size') { UI.setSize(id); }
    else if (a === 'theme') { UI.setTheme(id); }
    else if (a === 'reset') { UI.confirm('지금 여정을 지우고 새로 시작할까요?', () => { G.wipe(); location.reload(); }); return; }
    G.save(); Game.refresh();
  },

  socketMenu(runeId) {
    const S = G.S, R = RUNES[runeId];
    const slots = ['weapon', 'armor'].filter(sl => R.slot === 'any' || R.slot === sl);
    const rows = slots.map(sl => {
      const it = ITEMS[S.eq[sl]], holes = it ? it.sockets || 0 : 0, used = (S.runes[sl] || []).length;
      const ok = it && used < holes;
      return `<div class="item"><span class="in">${SLOT_NAMES[sl]}: ${it ? it.name : '없음'}<small>홈 ${used} / ${holes}${(S.runes[sl] || []).length ? ' · ' + S.runes[sl].map(r => RUNES[r].name).join(', ') : ''}</small></span><button class="mini" data-sock="${sl}" ${ok ? '' : 'disabled'}>${ok ? '새기기' : '홈 없음'}</button></div>`;
    }).join('');
    UI.modal(`${R.name} 새기기`, `<p class="muted small">${R.desc}. 룬은 장비 칸에 새겨져 장비를 바꿔도 남는다. 지금 장비의 홈 수만큼만 효과가 켜진다.</p>${rows}`, b => {
      b.querySelectorAll('[data-sock]').forEach(x => x.onclick = () => {
        if (G.socket(runeId, x.dataset.sock)) { UI.toast(`${R.name}을(를) 새겼다`); const w = G.runeword(x.dataset.sock); if (w) UI.toast(`룬어 완성: ${w.name}!`); }
        UI._cancel = null; UI.closeModal(); G.save(); Game.refresh();
      });
    });
  },

  setTheme(t) {
    UI.theme = t;
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    try { localStorage.setItem('wander-theme', t); } catch (e) { /* 무시 */ }
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]').content = dark ? '#1F1E1D' : '#FAF9F5';
  },

  setSize(z) {
    UI.size = z; document.documentElement.dataset.size = z;
    try { localStorage.setItem('wander-size', z); } catch (e) { /* 무시 */ }
  },

  /* ── 모바일 상태창 시트 ── */
  openSheet(tab) { if (tab) UI.setTab(tab); $('#app').classList.add('sheet-open'); $('#panel').focus(); },
  closeSheet() { $('#app').classList.remove('sheet-open'); },

  /* ── 모달 ── */
  modal(title, html, bind) {
    const m = $('#modal');
    $('#modal-title').innerHTML = title;
    $('#modal-body').innerHTML = html;
    m.hidden = false;
    if (bind) bind($('#modal-body'));
    $('#modal-close').focus();
  },
  closeModal() {
    $('#modal').hidden = true;
    const f = UI._cancel; UI._cancel = null;
    if (f) f();
    else if (!UI.awaiting && $('#choices').children.length) $('#choices').classList.add('show');
  },
  confirm(msg, yes, no) {
    UI.modal('확인', `<p>${msg}</p><div class="row"><button class="btn" id="cf-no">취소</button><button class="btn primary" id="cf-yes">확인</button></div>`, b => {
      UI._cancel = no || null;
      $('#cf-no', b).onclick = UI.closeModal;
      $('#cf-yes', b).onclick = () => { UI._cancel = null; UI.closeModal(); yes(); };
    });
  },

  toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(UI._tt); UI._tt = setTimeout(() => t.classList.remove('show'), 1600);
  }
};
