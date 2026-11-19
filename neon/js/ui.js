'use strict';
/* 메뉴와 대화창 (HTML) — 1280×800 무대 위에 겹쳐 같은 비율로 커진다 */
const UI = {
  el: null, dialogOpen: false, cur: null, sel: null, tab: 'all', shopTab: 'buy',
  init() { this.el = document.getElementById('ui'); },
  html(h) { this.el.innerHTML = h; },
  $(s) { return this.el.querySelector(s); },
  close() { this.el.innerHTML = ''; G.menuOpen = false; this.cur = null; this.sel = null; G.calcStats(); if (G.started) G.save(true); },
  key(k, e) {
    if (this.dialogOpen) { if ([' ', 'enter', 'z', 'j', 'e', 'f'].includes(k)) { e.preventDefault(); this.dlgNext(); } else if (/^[1-4]$/.test(k)) { const b = this.el.querySelectorAll('.choice')[+k - 1]; if (b) b.click(); } return; }
    if (k === 'escape' || (k === 'i' && this.cur === 'inv') || (k === 'p' && this.cur === 'stat') || (k === 't' && this.cur === 'quest') || (k === 'm' && this.cur === 'map')) { e.preventDefault(); this.close(); }
  },
  win(title, body, cls = '') {
    return `<div class="dim"></div><div class="win ${cls}"><div class="whead"><b>${title}</b><button class="x" data-a="close">✕</button></div><div class="wbody">${body}</div></div>`;
  },
  bind() {
    this.el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); SND.play('ui'); this.act(b.dataset.a, b.dataset.v, b); }));
  },
  open(k) {
    if (!G.started || this.dialogOpen) return;
    if (G.cine) return;
    G.menuOpen = true; this.cur = k;
    INPUT.atk = false; INPUT.stick = null;
    ({ inv: () => this.inv(), stat: () => this.stat(), quest: () => this.quests(), map: () => this.worldMap(), opt: () => this.opts() })[k]();
  },
  act(a, v, b) {
    const S = G.S;
    switch (a) {
      case 'close': this.close(); break;
      case 'tab': this.tab = v; this.sel = null; this.inv(); break;
      case 'sel': this.sel = v; this.cur === 'shop' ? this.shop(this.shopId) : this.inv(); break;
      case 'equip': G.equip(v); this.inv(); break;
      case 'unequip': G.unequip(v); this.inv(); break;
      case 'use': if (G.useItem(v)) { this.sel = G.has(v) ? v : null; } this.inv(); break;
      case 'quick': S.quick = v; G.toast(`아이템 칸에 「${ITEMS[v].n}」 등록`); this.inv(); break;
      case 'attr': if (S.ap > 0 && S.attr[v] < ATTR_MAX) { S.attr[v]++; S.ap--; G.calcStats(); SND.play('item'); } this.stat(); break;
      case 'perk': this.unlock(v); break;
      case 'slot': { const sk = SKILL[v]; S.slots[sk.slot] = v; G.toast(`${SLOT_NAME[sk.slot]}: ${sk.n} 장착`); this.stat(); break; }
      case 'shoptab': this.shopTab = v; this.sel = null; this.shop(this.shopId); break;
      case 'buy': this.buy(v, +b.dataset.n || 1); break;
      case 'sell': this.sell(v); break;
      case 'opt': G.opt[v] = !G.opt[v]; SND.setOpts(G.opt.sfx, G.opt.bgm); try { localStorage.setItem('neonheart-opt', JSON.stringify(G.opt)); } catch (e) {} this.opts(); break;
      case 'save': G.save(); this.close(); break;
      case 'title': G.save(true); location.reload(); break;
      case 'reset': if (confirm('정말 처음부터 다시 시작할까요? 저장된 진행이 지워집니다.')) { localStorage.removeItem(SAVE_KEY); location.reload(); } break;
      case 'talk': this.talkAct(v); break;
      case 'gift': this.close(); G.giveGift(v); break;
      case 'topic': { const tp = SERA_TALK.find((x) => x.id === v); this.close(); const first = !S.talked[v]; S.talked[v] = 1; G.say(tp.lines, () => first && G.addAff(2)); break; }
      case 'qsel': this.qsel = v; this.quests(); break;
    }
  },

  /* ── 가방 ── */
  inv() {
    const S = G.S, st = G.calcStats();
    const slots = SLOTS.map((sl) => {
      const it = ITEMS[S.equip[sl.k]];
      return `<div class="slot ${it ? '' : 'empty'}" data-a="sel" data-v="${it ? it.id : ''}" style="${it ? `--gc:${GRADES[it.g].c}` : ''}"><span class="sk">${sl.n}</span><span class="sn">${it ? esc(it.n) : '비어 있음'}</span></div>`;
    }).join('');
    const row = (n, v) => `<div><span>${n}</span><b>${v}</b></div>`;
    const stats = [row('최대 체력', st.maxHp), row('공격력', st.atk), row('방어력', st.def), row('치명타', st.crit.toFixed(1) + '%'), row('치명 피해', st.cdmg + '%'),
      row('최대 RAM', st.maxRam), row('이동 속도', '+' + st.spd + '%'), row('공격 속도', '+' + st.aspd + '%'), row('재사용 감소', st.cdr + '%'), row('흡혈', st.ls + '%')].join('');
    const items = Object.keys(S.inv).map((id) => ITEMS[id]).filter((it) => it && (this.tab === 'all' || it.t === this.tab))
      .sort((a, b) => b.g - a.g || a.t.localeCompare(b.t) || a.n.localeCompare(b.n));
    const tabs = TYPE_TAB.map((t) => `<button class="tab ${this.tab === t.k ? 'on' : ''}" data-a="tab" data-v="${t.k}">${t.n}</button>`).join('');
    const grid = items.map((it) => {
      const eq = Object.values(S.equip).includes(it.id);
      return `<button class="card ${this.sel === it.id ? 'on' : ''}" style="--gc:${GRADES[it.g].c}" data-a="sel" data-v="${it.id}"><i>${GRADES[it.g].n}</i><span>${esc(it.n)}</span>${S.inv[it.id] > 1 ? `<em>×${S.inv[it.id]}</em>` : ''}${eq ? '<u>장착</u>' : ''}${S.quick === it.id ? '<u>칸</u>' : ''}</button>`;
    }).join('') || '<p class="none">이 종류의 물건이 없다.</p>';
    const total = Object.values(S.inv).reduce((a, b) => a + b, 0);
    const owned = new Set(Object.keys(S.inv));
    const got = ITEM_LIST.filter((it) => owned.has(it.id)).length;
    this.html(this.win(`가방 <small>₡ ${fmt(S.cr)} · 소지품 ${total}개 · 도감 ${got}/${ITEM_LIST.length}</small>`, `
      <div class="invL"><div class="kai"><img src="${SPR.fullImg('kai_idle', 190)}" alt=""></div><div class="slots">${slots}</div><div class="stats">${stats}</div></div>
      <div class="invR"><div class="tabs">${tabs}</div><div class="grid">${grid}</div><div class="detail">${this.detail(this.sel)}</div></div>`, 'invw'));
    this.bind();
  },
  detail(id, shop) {
    const it = ITEMS[id]; if (!it) return '<p class="none">물건을 누르면 설명이 나온다.</p>';
    const S = G.S, eq = Object.values(S.equip).includes(id);
    const typeN = it.t === 'weapon' ? '무기' : it.t === 'gear' ? '의상 · ' + SLOTS.find((s) => s.k === it.slot).n : it.t === 'cyber' ? '사이버웨어 · ' + SLOTS.find((s) => s.k === it.slot).n : it.t === 'use' ? '소모품' : it.t === 'gift' ? '선물' : '퀘스트 물건';
    let btns = '';
    if (!shop) {
      if (it.slot) btns += eq ? (it.slot !== 'weapon' ? `<button data-a="unequip" data-v="${it.slot}">장착 해제</button>` : '') : `<button class="pri" data-a="equip" data-v="${id}">장착하기</button>`;
      if (it.t === 'use') { btns += `<button class="pri" data-a="use" data-v="${id}">사용하기</button>`; btns += S.quick === id ? '<button disabled>아이템 칸에 등록됨</button>' : `<button data-a="quick" data-v="${id}">아이템 칸에 등록</button>`; }
      if (it.t === 'gift') btns += '<span class="hint">세라에게 말을 걸어 「선물하기」로 줄 수 있다.</span>';
    }
    // 비교
    let cmp = '';
    if (it.slot && !eq) {
      const cur = ITEMS[S.equip[it.slot]];
      if (cur) cmp = `<div class="cmp">지금 장착: <span style="color:${GRADES[cur.g].c}">${esc(cur.n)}</span>${it.t === 'weapon' ? ` (공격력 ${cur.atk} → <b class="${it.atk >= cur.atk ? 'up' : 'dn'}">${it.atk}</b>)` : ''}</div>`;
    }
    const lvWarn = it.lv && it.lv > S.lv ? `<div class="warn">필요 레벨 ${it.lv}</div>` : (it.lv ? `<div class="sub">필요 레벨 ${it.lv}</div>` : '');
    return `<div class="dname" style="color:${GRADES[it.g].c}">${esc(it.n)} <small>${GRADES[it.g].n} · ${typeN}</small></div>${lvWarn}
      <ul>${itemDesc(it).map((l) => `<li>${esc(l)}</li>`).join('')}</ul><p class="flavor">${esc(it.d)}</p>${cmp}<div class="btns">${btns}</div>`;
  },

  /* ── 능력 ── */
  stat() {
    const S = G.S, st = G.calcStats();
    const cols = ATTRS.map((A) => {
      const v = S.attr[A.k];
      const nodes = [...PERKS.filter((p) => p.a === A.k).map((p) => ({ ...p, kind: 'perk' })), ...SKILLS.filter((s) => s.a === A.k).map((s) => ({ ...s, kind: 'skill' }))].sort((a, b) => a.req - b.req);
      const list = nodes.map((n) => {
        const own = n.kind === 'perk' ? S.perks.includes(n.id) : S.skills.includes(n.id);
        const can = !own && v >= n.req && S.pp > 0;
        const lock = v < n.req;
        const equipped = n.kind === 'skill' && S.slots[n.slot] === n.id;
        let tail = '';
        if (n.kind === 'skill' && own) tail = equipped ? '<i class="eq">장착 중</i>' : `<button class="mini" data-a="slot" data-v="${n.id}">장착</button>`;
        else if (can) tail = `<button class="mini pri" data-a="perk" data-v="${n.id}">해금</button>`;
        return `<div class="node ${own ? 'own' : lock ? 'lock' : ''} ${n.kind}" title="${esc(n.d)}"><div class="nt"><span class="req">${n.req}</span>${n.kind === 'skill' ? `<b class="sic" style="color:${n.c}">${n.icon}</b>` : ''}<b>${esc(n.n)}</b>${n.kind === 'skill' ? `<i class="sl">${SLOT_NAME[n.slot]}</i>` : ''}</div><div class="nd">${esc(n.d)}${n.kind === 'skill' ? ` <span class="sub">(재사용 ${n.cd}초${n.ram ? ` · RAM ${n.ram}` : ' · 필살 게이지'})</span>` : ''}</div>${tail}</div>`;
      }).join('');
      return `<div class="acol" style="--ac:${A.c}"><div class="ahead"><div><b>${A.n}</b> <small>${A.en}</small></div><div class="aval">${v}<small>/${ATTR_MAX}</small></div>${S.ap > 0 && v < ATTR_MAX ? `<button class="plus" data-a="attr" data-v="${A.k}">+</button>` : ''}</div><p class="ad">${A.d}</p><div class="nodes">${list}</div></div>`;
    }).join('');
    const slotBar = ['atk', 'util', 'ult'].map((k) => { const s = SKILL[S.slots[k]]; return `<span class="sb">${SLOT_NAME[k]}: <b style="color:${s ? s.c : '#5a6080'}">${s ? s.icon + ' ' + s.n : '비어 있음'}</b></span>`; }).join('');
    this.html(this.win(`능력 <small>Lv.${S.lv} · 능력치 포인트 <b class="pt">${S.ap}</b> · 특성 포인트 <b class="pt">${S.pp}</b></small>`, `
      <div class="sbar">${slotBar}<span class="sb sub">공격력 ${st.atk} · 체력 ${st.maxHp} · 방어 ${st.def} · 치명 ${st.crit.toFixed(0)}%/${st.cdmg}% · RAM ${st.maxRam}</span></div>
      <p class="help">레벨이 오를 때마다 능력치 포인트 1, 특성 포인트 1을 얻는다. 능력치를 올리면 그 계열의 특성과 스킬(필요 수치 표시)이 열리고, 특성 포인트로 해금한다. 스킬은 해금한 뒤 「장착」해야 버튼에 올라간다.</p>
      <div class="acols">${cols}</div>`, 'statw'));
    this.bind();
  },
  unlock(id) {
    const S = G.S; if (S.pp <= 0) return;
    const p = PERK[id], s = SKILL[id];
    if (p) { S.perks.push(id); G.toast(`특성 해금: ${p.n}`, '#ffd23e'); }
    if (s) { S.skills.push(id); if (!S.slots[s.slot]) S.slots[s.slot] = id; G.toast(`스킬 해금: ${s.n}`, s.c); }
    S.pp--; G.calcStats(); SND.play('level'); this.stat();
  },

  /* ── 퀘스트 ── */
  quests() {
    const S = G.S;
    const ids = QUEST_ORDER.filter((id) => S.q[id]);
    if (!this.qsel || !S.q[this.qsel]) this.qsel = ids.find((id) => !S.q[id].done) || ids[0];
    const item = (id) => { const Q = QUESTS[id], q = S.q[id]; return `<button class="qi ${this.qsel === id ? 'on' : ''} ${q.done ? 'done' : ''}" data-a="qsel" data-v="${id}"><i>${Q.main ? '메인' : '곁가지'}</i>${esc(Q.n)}${q.done ? ' ✓' : ''}</button>`; };
    const left = `<h4>진행 중</h4>${ids.filter((id) => !S.q[id].done).map(item).join('') || '<p class="none">없음</p>'}<h4>완료</h4>${ids.filter((id) => S.q[id].done).map(item).join('') || '<p class="none">없음</p>'}`;
    let right = '<p class="none">퀘스트가 없다.</p>';
    if (this.qsel) {
      const Q = QUESTS[this.qsel], q = S.q[this.qsel];
      const steps = Q.steps.map((st, i) => {
        const done = q.done || i < q.s, cur = !q.done && i === q.s;
        if (!done && !cur) return `<li class="fut">???</li>`;
        let prog = '';
        if (cur && st.t === 'kill') prog = ` (${q.c}/${st.n})`;
        if (cur && (st.t === 'collect' || st.t === 'give')) prog = ` (${Math.min(S.inv[st.item] || 0, st.n || 1)}/${st.n || 1})`;
        if (cur && st.t === 'flags') prog = ` (${st.f.filter((f) => G.flag(f)).length}/${st.f.length})`;
        return `<li class="${done ? 'ok' : 'cur'}">${done ? '✓' : '▶'} ${esc(st.d)}${prog}${st.map && cur ? ` <span class="sub">📍${MAP[st.map].n}</span>` : ''}</li>`;
      }).join('');
      const R = Q.reward || {};
      const rw = [R.exp ? `경험치 ${fmt(R.exp)}` : '', R.cr ? `${fmt(R.cr)}₡` : '', ...(R.items || []).map(([id, n]) => `<span style="color:${GRADES[ITEMS[id].g].c}">${esc(ITEMS[id].n)}${n > 1 ? ' ×' + n : ''}</span>`)].filter(Boolean).join(' · ');
      const giver = Q.giver ? `<p class="sub">의뢰인: ${NPCS[Q.giver].n}</p>` : '';
      right = `<h3>${Q.main ? `제${Q.ch}장 · ` : ''}${esc(Q.n)}</h3>${giver}<ol class="steps">${steps}</ol><p class="rw">보상: ${rw || '—'}</p>`;
    }
    const offers = QUEST_ORDER.filter((id) => !S.q[id] && !QUESTS[id].main && QUESTS[id].avail()).map((id) => `<li>◇ ${esc(QUESTS[id].n)} — ${NPCS[QUESTS[id].giver].n}에게 말을 걸어 보자</li>`).join('');
    this.html(this.win(`퀘스트 <small>♥ 세라 호감도 ${S.aff}/100</small>`, `<div class="qL">${left}</div><div class="qR">${right}${offers ? `<h4>받을 수 있는 의뢰</h4><ul class="offers">${offers}</ul>` : ''}<p class="help">♥ 세라의 호감도는 대화 선택, 선물, 데이트에 따라 달라지고, 결말이 바뀐다.</p></div>`, 'questw'));
    this.bind();
  },

  /* ── 지도 ── */
  worldMap() {
    const cur = G.map.idx;
    const nodes = MAPS.map((m, i) => {
      const npcs = (m.npcs || []).map((n) => NPCS[n.id].n).filter((n, j, a) => a.indexOf(n) === j).join(', ');
      const target = QUEST_ORDER.some((id) => { const st = G.curStep(id); return st && st.map === m.id; });
      return `<div class="mn ${i === cur ? 'cur' : ''} ${m.safe ? 'safe' : 'danger'}"><div class="mi">${i + 1}</div><b>${m.n}</b><small>${m.sub}</small><span class="sub">${m.safe ? '안전 지역' : `위험도 Lv.${m.lv[0]}~${m.lv[1]}`}${m.boss ? ' · ☠ 보스' : ''}</span>${npcs ? `<span class="np">${npcs}</span>` : ''}${target ? '<span class="tg">◆ 퀘스트 목표</span>' : ''}${i === cur ? '<span class="here">현재 위치</span>' : ''}</div>`;
    }).join('<div class="ml">⇄</div>');
    this.html(this.win('네오 서울 지도', `<p class="help">지역의 왼쪽·오른쪽 끝으로 걸어가면 옆 지역으로 넘어간다. 일부 길은 이야기가 진행되어야 열린다.</p><div class="mapchain">${nodes}</div>`, 'mapw'));
    this.bind();
  },

  /* ── 설정 ── */
  opts() {
    const o = G.opt, on = (k) => `<button class="tog ${o[k] !== false ? 'on' : ''}" data-a="opt" data-v="${k}">${o[k] !== false ? '켜짐' : '꺼짐'}</button>`;
    const S = G.S;
    this.html(this.win('설정', `<div class="opts">
      <div class="orow"><span>효과음</span>${on('sfx')}</div><div class="orow"><span>배경음</span>${on('bgm')}</div><div class="orow"><span>화면 흔들림</span>${on('shake')}</div>
      <div class="orow"><span>플레이 시간 ${Math.floor(S.playT / 3600)}시간 ${Math.floor(S.playT / 60) % 60}분 · 처치 ${fmt(S.kills)}</span></div>
      <div class="btns"><button class="pri" data-a="save">저장하기</button><button data-a="title">타이틀로</button><button class="danger" data-a="reset">처음부터</button></div>
      <h4>조작</h4><table class="keys">
      <tr><td>이동 · 점프</td><td>왼쪽 조이스틱 (위로 밀면 점프, 아래로 밀고 점프하면 발판 아래로) · 키보드 A/D 또는 ←/→, 점프 W/↑/Space</td></tr>
      <tr><td>기본 공격</td><td>오른쪽 큰 버튼 (누르고 있으면 연속 공격) · Z 또는 J</td></tr>
      <tr><td>스킬</td><td>공격 스킬 X/K · 범용 스킬 C/L · 필살기 V/U</td></tr>
      <tr><td>아이템 칸 · 대화</td><td>Q · 대화/조사 E (NPC 옆에서는 공격 버튼이 대화 버튼이 된다)</td></tr>
      <tr><td>메뉴</td><td>가방 I · 능력 P · 퀘스트 T · 지도 M · 설정 Esc</td></tr></table></div>`, 'optw'));
    this.bind();
  },

  /* ── NPC 대화 메뉴 ── */
  talkMenu(npc) {
    if (this.dialogOpen) return;
    const D = NPCS[npc], S = G.S;
    const q = G.npcQuest(npc);
    const opts = [];
    if (q) opts.push([`▶ ${QUESTS[q.id].main ? '' : '[곁가지] '}${q.st.d}`, 'quest', 'main']);
    for (const id of G.npcOffers(npc)) opts.push([`! 의뢰: ${QUESTS[id].n}`, 'offer:' + id, 'offer']);
    if (npc === 'sera') {
      opts.push(['💬 이야기하기', 'topics']);
      opts.push(['🎁 선물하기', 'gifts']);
    } else opts.push(['💬 잡담', 'chat']);
    if (D.shop && (npc !== 'raven' || G.qDone('s6'))) opts.push(['🛒 ' + SHOP_NAME[D.shop], 'shop']);
    opts.push(['떠나기', 'close']);
    G.menuOpen = true; this.cur = 'talk'; this.talkNpc = npc;
    this.html(`<div class="dim"></div><div class="talk"><img class="tf" src="${SPR.faceImg(D.face, 120)}" alt=""><div class="tb"><b style="color:${D.c}">${D.n}</b> <small>${D.title}</small>${npc === 'sera' ? `<div class="aff">♥ 호감도 ${S.aff}/100</div>` : ''}
      <div class="topts">${opts.map(([t, v, c]) => `<button class="${c || ''}" data-a="talk" data-v="${v}">${esc(t)}</button>`).join('')}</div></div></div>`);
    this.bind();
  },
  talkAct(v) {
    const npc = this.talkNpc;
    if (v === 'close') { this.close(); return; }
    if (v === 'quest' || v === 'chat') { this.close(); G.talkTo(npc); return; }
    if (v.startsWith('offer:')) { const id = v.slice(6); this.close(); G.say(QUESTS[id].offer, () => G.startQuest(id)); return; }
    if (v === 'shop') { this.shopId = NPCS[npc].shop; this.shopTab = 'buy'; this.sel = null; this.cur = 'shop'; this.shop(this.shopId); return; }
    if (v === 'topics') {
      const list = SERA_TALK.filter((t) => t.when());
      const S = G.S;
      const btns = list.map((t) => `<button data-a="topic" data-v="${t.id}">${S.talked[t.id] ? '' : '<i class="new">NEW</i> '}${esc(t.n)}</button>`).join('');
      this.$('.topts').innerHTML = (btns || '') + `<button data-a="talk" data-v="idle">그냥 얼굴 보러 왔어</button><button data-a="talk" data-v="back">← 뒤로</button>`;
      this.bind(); return;
    }
    if (v === 'idle') { this.close(); G.say([['sera', choice(SERA_IDLE)]]); return; }
    if (v === 'back') { this.talkMenu(npc); return; }
    if (v === 'gifts') {
      const gifts = Object.keys(G.S.inv).map((id) => ITEMS[id]).filter((it) => it.t === 'gift');
      this.$('.topts').innerHTML = (gifts.map((it) => `<button data-a="gift" data-v="${it.id}" style="color:${GRADES[it.g].c}">${esc(it.n)} ×${G.S.inv[it.id]}</button>`).join('') || '<p class="none">줄 선물이 없다. 야시장 블루 문 바에서 살 수 있다.</p>') + `<button data-a="talk" data-v="back">← 뒤로</button>`;
      this.bind(); return;
    }
  },

  /* ── 상점 ── */
  price(it) { let p = it.price; if (this.shopId === 'toto' && G.flag('totoDiscount')) p = Math.round(p * 0.9); return p; },
  shop(id) {
    const S = G.S, D = Object.values(NPCS).find((n) => n.shop === id);
    G.menuOpen = true; this.cur = 'shop';
    let rows;
    if (this.shopTab === 'buy') {
      rows = shopStock(id).map((x) => ITEMS[x]).map((it) => `<button class="row ${this.sel === it.id ? 'on' : ''}" style="--gc:${GRADES[it.g].c}" data-a="sel" data-v="${it.id}"><i>${GRADES[it.g].n}</i><span>${esc(it.n)}</span><em>${S.inv[it.id] ? '보유 ' + S.inv[it.id] : ''}</em><b>${fmt(this.price(it))}₡</b></button>`).join('');
    } else {
      rows = Object.keys(S.inv).map((x) => ITEMS[x]).filter((it) => it.t !== 'quest').sort((a, b) => b.g - a.g).map((it) => {
        const eq = Object.values(S.equip).includes(it.id) && S.inv[it.id] <= 1;
        return `<button class="row ${this.sel === it.id ? 'on' : ''}" style="--gc:${GRADES[it.g].c}" data-a="sel" data-v="${it.id}"><i>${GRADES[it.g].n}</i><span>${esc(it.n)}</span><em>×${S.inv[it.id]}${eq ? ' · 장착 중' : ''}</em><b>${fmt(Math.floor(it.price * 0.3))}₡</b></button>`;
      }).join('');
    }
    const it = ITEMS[this.sel];
    let btns = '';
    if (it) {
      if (this.shopTab === 'buy') { const p = this.price(it); btns = `<button class="pri" data-a="buy" data-v="${it.id}" data-n="1" ${S.cr < p ? 'disabled' : ''}>사기 (${fmt(p)}₡)</button>` + (it.stack ? `<button data-a="buy" data-v="${it.id}" data-n="5" ${S.cr < p * 5 ? 'disabled' : ''}>5개 사기 (${fmt(p * 5)}₡)</button>` : ''); }
      else { const eq = Object.values(S.equip).includes(it.id) && S.inv[it.id] <= 1; btns = eq ? '<span class="hint">장착 중인 물건은 팔 수 없다.</span>' : `<button class="pri" data-a="sell" data-v="${it.id}">팔기 (+${fmt(Math.floor(it.price * 0.3))}₡)</button>`; }
    }
    const disc = id === 'toto' && G.flag('totoDiscount') ? ' · 단골 할인 10%' : '';
    this.html(this.win(`<img class="hf" src="${SPR.faceImg(D.face, 64)}" alt=""> ${SHOP_NAME[id]} <small>₡ ${fmt(S.cr)}${disc}</small>`, `
      <div class="shopL"><div class="tabs"><button class="tab ${this.shopTab === 'buy' ? 'on' : ''}" data-a="shoptab" data-v="buy">사기</button><button class="tab ${this.shopTab === 'sell' ? 'on' : ''}" data-a="shoptab" data-v="sell">팔기</button></div><div class="rows">${rows || '<p class="none">물건이 없다.</p>'}</div></div>
      <div class="shopR"><div class="detail">${this.detail(this.sel, true)}<div class="btns">${btns}</div></div></div>`, 'shopw'));
    this.bind();
  },
  buy(id, n) {
    const S = G.S, it = ITEMS[id], p = this.price(it) * n;
    if (S.cr < p) { SND.play('deny'); return; }
    S.cr -= p; G.gain(id, n); SND.play('coin'); G.toast(`구매: ${it.n}${n > 1 ? ' ×' + n : ''}`, GRADES[it.g].c);
    this.shop(this.shopId);
  },
  sell(id) {
    const S = G.S, it = ITEMS[id];
    if (Object.values(S.equip).includes(id) && S.inv[id] <= 1) return;
    S.cr += Math.floor(it.price * 0.3); G.take(id); SND.play('coin');
    if (!S.inv[id]) this.sel = null;
    this.shop(this.shopId);
  },

  /* ── 대화창 ── */
  dialog(arr, done) {
    this.dialogOpen = true; G.cine = true; INPUT.atk = false; INPUT.stick = null;
    this.dq = arr.slice(); this.dDone = done;
    this.el.innerHTML = '<div class="dlg"><img class="df" alt=""><div class="db"><b class="dn"></b><p class="dt"></p><div class="dc"></div><span class="dnext">▼</span></div></div>';
    this.el.querySelector('.dlg').addEventListener('click', () => this.dlgNext());
    this.dlgStep();
  },
  dlgStep() {
    const n = this.dq.shift();
    if (!n) { this.dialogOpen = false; G.cine = false; this.el.innerHTML = ''; G.menuOpen = false; const d = this.dDone; this.dDone = null; d && d(); return; }
    if (n.fn) { n.fn(); this.dlgStep(); return; }
    const box = this.el.querySelector('.dlg');
    if (n.ch) {
      const c = box.querySelector('.dc'); box.querySelector('.dnext').style.display = 'none';
      c.innerHTML = n.ch.map((o, i) => `<button class="choice">${i + 1}. ${esc(o.t)}</button>`).join('');
      this.choosing = true;
      c.querySelectorAll('.choice').forEach((b, i) => b.addEventListener('click', (e) => {
        e.stopPropagation(); const o = n.ch[i]; this.choosing = false; c.innerHTML = ''; SND.play('ui');
        if (o.aff) G.addAff(o.aff);
        this.dq = [...(o.then || []), ...this.dq]; this.dlgStep();
      }));
      return;
    }
    const [who, txt] = n, sp = SPEAKERS[who] || SPEAKERS.sys;
    const img = box.querySelector('.df');
    if (sp.face) { img.src = SPR.faceImg(sp.face, 160); img.style.display = ''; } else img.style.display = 'none';
    box.classList.toggle('narr', !sp.face);
    const nm = box.querySelector('.dn'); nm.textContent = sp.n; nm.style.color = sp.c;
    box.querySelector('.dnext').style.display = '';
    this.full = txt; this.shown = 0; this.typing = true;
    const p = box.querySelector('.dt'); p.textContent = '';
    clearInterval(this.tyT);
    this.tyT = setInterval(() => {
      this.shown += 2; p.textContent = this.full.slice(0, this.shown);
      if (this.shown % 6 === 0) SND.play('talk');
      if (this.shown >= this.full.length) { clearInterval(this.tyT); this.typing = false; }
    }, 22);
  },
  dlgNext() {
    if (this.choosing) return;
    if (this.typing) { clearInterval(this.tyT); this.typing = false; this.el.querySelector('.dt').textContent = this.full; return; }
    this.dlgStep();
  },

  /* ── 기타 화면 ── */
  mapTitle(m) { G.banner = { t: 2.2, txt: m.n, sub: m.sub, c: m.safe ? '#5dff9a' : '#ff3fa4' }; },
  bossIntro(B) { G.banner = { t: 2.4, txt: `☠ ${B.n}`, sub: B.title, c: B.c }; SND.play('warn'); },
  deathScreen(cb) {
    G.menuOpen = true;
    this.html(`<div class="dim red"></div><div class="center"><h1 class="dead">쓰러졌다…</h1><p>카이의 의식이 빗속으로 가라앉는다.</p><button class="big pri" id="wake">은신처에서 깨어나기</button></div>`);
    this.el.querySelector('#wake').addEventListener('click', () => { this.close(); cb(); });
  },
  endCard(kind, cb) {
    G.menuOpen = true;
    const T = { true: ['TRUE END', '새벽의 네온', '별이 뜬 하늘 아래, 두 사람은 처음으로 아침을 맞았다.'], normal: ['NORMAL END', '처음 뵙겠습니다', '기억은 사라졌지만, 마음은 다시 같은 곳을 향한다.'], bad: ['END', '빗속의 메아리', '비가 내릴 때마다, 카이는 그녀를 떠올린다.'] }[kind];
    this.html(`<div class="dim"></div><div class="center end"><small>${T[0]}</small><h1>${T[1]}</h1><p>${T[2]}</p><p class="sub">세라 호감도 ${G.S.aff} · 플레이 시간 ${Math.floor(G.S.playT / 60)}분 · 처치 ${fmt(G.S.kills)}</p><button class="big pri" id="cont">계속하기</button></div>`);
    this.el.querySelector('#cont').addEventListener('click', () => { this.close(); cb(); });
  },

  /* ── 타이틀 ── */
  title() {
    const has = !!G.load();
    this.html(`<div class="title"><div class="logo"><small>CYBERPUNK ROMANCE RPG</small><h1>NEON HEART</h1><h2>네온 하트</h2></div>
      <div class="tbtn">${has ? '<button class="big pri" id="cont">이어하기</button>' : ''}<button class="big ${has ? '' : 'pri'}" id="new">새 게임</button></div>
      <p class="tnote">2089년 네오 서울 · 비 오는 하층에서 시작되는 사랑 이야기<br>가로 화면을 권장합니다 · 키보드와 터치 모두 지원</p></div>`);
    const go = (fresh) => { if (fresh && has && !confirm('새 게임을 시작하면 저장된 진행이 지워집니다. 계속할까요?')) return; if (fresh) localStorage.removeItem(SAVE_KEY); SND.init(); G.start(fresh); };
    if (has) this.el.querySelector('#cont').addEventListener('click', () => go(false));
    this.el.querySelector('#new').addEventListener('click', () => go(true));
  },
  titleKey() { const b = this.el.querySelector('#cont') || this.el.querySelector('#new'); if (b) b.click(); },
  hideTitle() { this.el.innerHTML = ''; },
  drawTitle(ctx, dt) {
    if (!this.tbg) { this.tbg = BG.build(MAP.street); this.tt = 0; }
    this.tt += dt;
    const cam = 300 + Math.sin(this.tt * 0.08) * 260;
    BG.draw(ctx, cam, this.tt, dt);
    ctx.fillStyle = 'rgba(4,2,10,0.35)'; ctx.fillRect(0, 0, VW, VH);
    SPR.draw(ctx, 'kai_idle', 470, GROUND + 10, { sc: 1.3, f: 1 });
    SPR.draw(ctx, 'sera_idle', 800, GROUND + 10, { sc: 1.2, f: -1, sy: 1 + Math.sin(this.tt * 2) * 0.01 });
    ctx.font = FONT(40, true); ctx.fillStyle = hexA('#ff8ad8', 0.6 + Math.sin(this.tt * 3) * 0.3); ctx.textAlign = 'center'; ctx.fillText('♥', 640, 430 + Math.sin(this.tt * 2) * 8);
    BG.drawFront(ctx, cam, this.tt, dt);
  },
};
