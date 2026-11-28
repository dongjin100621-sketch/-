'use strict';
/* 은빛 유랑기 — 진행: 시작 화면, 캐릭터 만들기, 마을(허브), 탐험, 이야기, 상점, 여관, 여행 */

const Game = {
  mode: 'title',

  refresh() { UI.renderTop(); UI.renderPanel(); },

  /* ── 시작 ── */
  boot() {
    let z = 'm'; try { z = localStorage.getItem('wander-size') || 'm'; } catch (e) { /* 무시 */ }
    UI.setSize(z);
    let th = 'auto'; try { th = localStorage.getItem('wander-theme') || 'auto'; } catch (e) { /* 무시 */ }
    UI.setTheme(th);
    document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => UI.setTab(b.dataset.tab));
    $('#tb-open').onclick = () => UI.openSheet('status');
    $('#topbar .tb-hero').onclick = () => UI.openSheet('status');
    $('#sheet-close').onclick = UI.closeSheet;
    $('#scrim').onclick = UI.closeSheet;
    $('#modal-close').onclick = UI.closeModal;
    $('#modal').onclick = e => { if (e.target.id === 'modal') UI.closeModal(); };
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { if (!$('#modal').hidden) UI.closeModal(); else UI.closeSheet(); return; }
      if (e.target.tagName === 'INPUT' || !$('#modal').hidden || Game.mode === 'title') return;
      const n = +e.key;
      if (n >= 1 && n <= 9) { const b = document.querySelectorAll('#choices .choice')[n - 1]; if (b && !b.disabled) b.click(); }
    });
    Game.title();
  },

  title() {
    Game.mode = 'title';
    const save = G.load();
    $('#title').hidden = false; $('#app').hidden = true;
    $('#t-continue').hidden = !save;
    if (save) $('#t-continue').innerHTML = `이어하기 <small>${esc(save.name)} · Lv.${save.lvl} ${CLASSES[save.cls].name} · ${save.day}일째 · ${REGIONS[save.region].town}</small>`;
    $('#t-continue').onclick = () => { G.S = save; Game.enter(); UI.say(`<i>${esc(save.name)}의 유람기를 다시 펼친다.</i>`, 'muted'); Game.hub(true); };
    $('#t-new').onclick = () => (save ? UI.confirm('저장된 여정이 지워집니다. 새로 시작할까요?', Game.create) : Game.create());
  },

  create() {
    let cls = 'sword';
    const card = k => {
      const C = CLASSES[k];
      return `<button class="cls ${k === cls ? 'on' : ''}" data-k="${k}" aria-pressed="${k === cls}">
        <span class="ci">${C.icon}</span><b>${C.name}</b><small>${C.blurb}</small>
        <span class="cst">${STAT_KEYS.map(s => `<span>${STATS[s].short} <b>${C.st[s]}</b></span>`).join('')}</span>
        <span class="ctr">${C.trait}</span><span class="csk">기술: ${C.skills.map(s => SKILLS[s].name).join(', ')}</span></button>`;
    };
    UI.modal('여행자 만들기', `
      <div class="create">
        <img class="cr-portrait" src="img/hero_face.jpg" alt="은빛 머리와 푸른 눈의 여행자 초상">
        <label class="fld">이름<input id="cr-name" maxlength="10" value="엘리아" autocomplete="off"></label>
        <p class="muted small">은빛 머리, 푸른 눈. 어머니가 남긴 마른 청령화 한 송이를 품고 길을 떠난다. 어떤 방식으로 길을 걸을까?</p>
        <div class="cls-grid">${Object.keys(CLASSES).map(card).join('')}</div>
        <button class="btn primary wide" id="cr-go">유람을 시작한다</button>
      </div>`, b => {
      const grid = $('.cls-grid', b);
      grid.onclick = e => {
        const t = e.target.closest('.cls'); if (!t) return;
        cls = t.dataset.k; grid.innerHTML = Object.keys(CLASSES).map(card).join('');
      };
      $('#cr-go', b).onclick = () => {
        const name = ($('#cr-name', b).value || '').trim() || '엘리아';
        UI.closeModal(); G.wipe(); Game.start(name, cls);
      };
    });
  },

  start(name, cls) {
    G.newState(name, cls);
    G.log('유람을 시작했다');
    Game.enter();
    const S = G.S;
    UI.head('서장 · 마른 꽃');
    UI.say(`대륙 에이렌. 왕도 루멘하르트의 성문 앞에 은빛 머리의 여행자가 선다. 이름은 <b>${esc(S.name)}</b>.`);
    UI.say('품속에는 어머니가 남긴 낡은 일지와, 그 사이에 끼워 둔 마른 꽃 한 송이가 있다. 푸른 종 모양의 꽃 — <b>청령화</b>. 일지의 마지막 장에는 이렇게 적혀 있다.');
    UI.say('<i>“다섯 바람이 한 꽃에 머물 때, 꽃은 다시 핀다. 중앙의 금빛, 서부의 초록, 남부의 주홍, 동부의 연분홍, 북부의 서리. 바람은 재앙이 걷힌 땅에서만 대답한다.”</i>', 'quote');
    UI.say('어머니는 그 꽃을 피우러 떠났다가 돌아오지 않았다. 이제 당신 차례다. 다섯 지역을 유람하며, 각 땅의 재앙을 걷어 내고 바람의 꽃잎을 모아라.');
    UI.say('<span class="muted">도움말: 선택지 옆 숫자 키(1~9)로도 고를 수 있다. 판정은 d20 + 능력치 보정이 DC 이상이면 성공. 상태창에서 능력치·장비·임무·지도를 확인하자.</span>');
    Game.arrive('central', true);
  },

  enter() {
    $('#title').hidden = true; $('#app').hidden = false;
    $('#log').innerHTML = '';
    Game.refresh();
  },

  /* ── 마을 ── */
  hub(quiet) {
    Game.mode = 'hub';
    const S = G.S, R = REGIONS[S.region];
    if (S.hp <= 0) return Game.defeat();
    G.save();
    if (!quiet) UI.say(`<span class="sep"></span>${R.town}, ${PHASES[S.phase]}. 무엇을 할까?`, 'prompt');
    else UI.say(`${R.town}, ${PHASES[S.phase]}. 무엇을 할까?`, 'prompt');
    const list = [];
    list.push({ t: '🧭 주변을 탐험한다', hint: `${R.land} · 반나절 · 무작위 사건`, fn: () => Game.explore() });
    for (const [id, M] of Object.entries(MAINS)) {
      const q = S.quest[id] || 0;
      if (M.region !== S.region || q >= M.scenes.length || (M.unlock && !M.unlock(S))) continue;
      const fin = id === 'final' || id === 'sky';
      list.push({ t: `${fin ? '🌸' : '📜'} ${M.part || '지역 이야기'} — ${M.name}`, hint: `${q + 1}장 · ${M.hints[q]}`, fn: () => Game.story(id), cls: 'main' + (fin ? ' final' : '') });
    }
    for (const [id, Q] of Object.entries(SIDEQ)) {
      const n = S.side[id] || 0;
      if (Q.region !== S.region || n >= 3 || !Q.unlock(S)) continue;
      list.push({ t: `🧩 곁이야기 — ${Q.name}`, hint: `${n + 1}장 · ${Q.hints[n] || ''}`, fn: () => Game.side(id), cls: 'side' });
    }
    if (S.region === 'central' && G.canJob()) list.push({ t: '⚜ 영웅의 전당 — 전직 시험', hint: '레벨 6 달성 · 새로운 길을 고른다', fn: () => Game.jobTrial(), cls: 'main' });
    const bk = `${S.region}-${S.day}`;
    list.push({ t: '📋 의뢰 게시판', hint: S.bountyDone === bk ? '오늘 의뢰는 끝냈다' : '현상금 토벌 · 하루 한 번', disabled: S.bountyDone === bk, fn: () => Game.bounty() });
    list.push({ t: '🏪 상점', hint: `금화 ${S.gold}`, fn: () => Game.shop() });
    list.push({ t: '🛏 여관', hint: `숙박 금화 ${R.inn} · 소문`, fn: () => Game.inn() });
    list.push({ t: '🗺 다른 지역으로 떠난다', hint: Game.routes(S.region).map(([r]) => REGIONS[r].name).join(' · '), fn: () => Game.travelMenu() });
    if (S.pendingStat) list.push({ t: '⬆ 능력치 포인트 배분', hint: `${S.pendingStat}점 남음 · 상태창`, fn: () => { UI.openSheet('status'); Game.hub(true); }, cls: 'ghost' });
    if (S.sp) list.push({ t: '🌳 기술 포인트 사용', hint: `${S.sp}점 남음 · 상태창 → 성장`, fn: () => { UI.openSheet('grow'); Game.hub(true); }, cls: 'ghost' });
    UI.choices(list); UI.flush(); Game.refresh();
  },

  /* ── 장면 실행 ── */
  runScene(sc, ctx = {}) {
    if (typeof sc === 'string') sc = SCENES[sc];
    Game.mode = 'scene';
    const S = G.S;
    if (sc.title) UI.head(sc.title);
    UI.say(typeof sc.text === 'function' ? sc.text(S) : sc.text);
    const list = sc.choices.map(c => {
      const okReq = !c.req || c.req(S), okCost = !c.cost || S.gold >= c.cost;
      let hint = '';
      if (c.check) {
        const [k, dc] = c.check, b = G.checkBonus(k) + Game.extra(c, ctx);
        const p = clamp(Math.round((21 - (dc - b)) / 20 * 100), 5, 95);
        hint = `${STATS[k].name} 판정 DC ${dc} · 보정 ${sign(b)} · 성공 약 ${p}%`;
      }
      if (c.req) hint = (hint ? hint + ' · ' : '') + (okReq ? `✓ ${c.reqText}` : `필요: ${c.reqText}`);
      if (c.cost) hint = (hint ? hint + ' · ' : '') + (okCost ? `금화 ${c.cost}` : `금화 ${c.cost} 부족`);
      const fight = (c.ok && (c.ok.fight || c.ok.fightLv)) ? 'fight' : '';
      return { t: c.t, hint, disabled: !okReq || !okCost, cls: fight, fn: () => Game.choose(c, ctx) };
    });
    UI.choices(list); UI.flush(); Game.refresh();
  },

  extra(c, ctx) {
    let x = c.bonus ? c.bonus(G.S) : 0;
    if (ctx.road && G.S.cls === 'ranger') x += 3;
    return x;
  },

  choose(c, ctx) {
    const S = G.S;
    UI.say(`▸ ${c.t}`, 'me');
    if (c.cost) S.gold -= c.cost;
    let o = c.ok;
    if (c.check) o = G.check(c.check[0], c.check[1], Game.extra(c, ctx)) ? c.ok : c.no;
    Game.runOutcome(o, ctx);
  },

  runOutcome(o, ctx = {}) {
    o = o || {};
    const S = G.S;
    G.apply(o);
    if (o.once && ctx.id) S.seen[ctx.id] = 99;
    if (S.hp <= 0) return Game.defeat();
    if (o.fight || o.fightLv) {
      const id = o.fight || Game.levelEnemy(ctx.dest || S.region);
      return Combat.start(id, { win: o.win, flee: o.flee, noFlee: o.noFlee, weak: o.weakFlag && S.flags[o.weakFlag], ctx });
    }
    if (o.go) return Game.runScene(o.go, ctx);
    if (o.then) return o.then();
    if (ctx.after) { const f = ctx.after; ctx.after = null; return f(); }
    Game.hub();
  },

  levelEnemy(region) {
    const pool = REGIONS[region].enemies;
    return pick(pool.slice(0, Math.max(2, pool.length - 1)));
  },

  /* ── 탐험 ── */
  explore() {
    const S = G.S, pool = EXPLORE[S.region].filter(e => S.seen[e.id] !== 99);
    const w = pool.map(e => 1 / (1 + (S.seen[e.id] || 0)));
    let r = Math.random() * w.reduce((a, b) => a + b, 0), ev = pool[0];
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { ev = pool[i]; break; } }
    S.seen[ev.id] = (S.seen[ev.id] || 0) + 1;
    G.advance(1);
    UI.say(`▸ 주변을 탐험한다`, 'me');
    Game.runScene(ev, { id: ev.id });
  },

  story(id) {
    const S = G.S, M = MAINS[id], q = S.quest[id] || 0;
    UI.say(`▸ ${M.name}`, 'me');
    G.advance(1);
    Game.runScene(M.scenes[q], { id: `q_${id}_${q}` });
  },

  side(id) {
    const S = G.S, Q = SIDEQ[id], n = S.side[id] || 0;
    UI.say(`▸ ${Q.name}`, 'me');
    G.advance(1);
    Game.runScene(Q.scenes[n], { id: `s_${id}_${n}` });
  },

  routes(r) {
    const S = G.S;
    return Object.entries(ROUTES[r]).filter(([d]) => !REGIONS[d].locked || !REGIONS[d].locked(S));
  },

  /* ── 전직 ── */
  jobTrial() {
    const S = G.S, C = CLASSES[S.cls];
    UI.say('▸ 영웅의 전당으로 간다', 'me');
    Game.runScene({
      title: '영웅의 전당',
      text: `대성당 옆 하얀 대리석 전당. 역대 영웅들의 석상 사이에서 늙은 전당지기가 등불을 든다.<br>“${C.name}의 길을 걸어온 자여. 그대의 다음 걸음을 보여 주게. 석상 하나가 그대를 시험할 걸세.”`,
      choices: [
        { t: '시험을 받는다', ok: { text: '석상이 눈을 뜨고 검을 든다!', fight: S.lvl >= 8 ? 'guardian' : 'royalguard', noFlee: true, win: { text: '석상이 무릎을 꿇고 빛이 되어 흩어진다. 전당지기가 고개를 끄덕인다. “두 갈래 길이 보이는군. 고르게.”', then: () => Game.jobPick() } } },
        { t: '다음에 온다', ok: {} }
      ]
    }, { id: 'job' });
  },
  jobPick() {
    const S = G.S;
    const jobs = Object.entries(JOBS).filter(([, J]) => J.base === S.cls);
    UI.choices(jobs.map(([id, J]) => ({
      t: `${J.icon} ${J.name}`, hint: `${J.blurb} · 기술: ${J.skills.map(k => SKILLS[k].name).join(', ')} · ${Object.entries(J.st).map(([k, v]) => `${STATS[k].name} +${v}`).join(', ')}`,
      fn: () => UI.confirm(`<b>${J.name}</b>(으)로 전직할까요? 되돌릴 수 없습니다.`, () => {
        G.setJob(id);
        UI.say(`▸ ${J.name}의 길을 고른다`, 'me');
        UI.say(`<b>${J.icon} ${J.name}</b>(으)로 전직했다! 새 기술: ${J.skills.map(k => `<b>${SKILLS[k].name}</b>`).join(', ')}. 성장 탭에 전직 기술 트리가 열렸다.`, 'level');
        Game.hub();
      }, () => Game.jobPick())
    })));
    UI.flush(); Game.refresh();
  },

  bounty() {
    const S = G.S, R = REGIONS[S.region];
    const id = pick(R.enemies), E = ENEMIES[id], reward = Math.round(E.xp * 0.45);
    UI.say('▸ 의뢰 게시판을 살핀다', 'me');
    Game.runScene({
      title: '현상 수배',
      text: `게시판에 붙은 양피지: <b>「${E.name} 토벌 — 보상 금화 ${reward}」</b><br><span class="muted">${E.desc}</span>`,
      choices: [
        { t: '의뢰를 받는다', ok: { time: 1, fight: id, win: { text: '토벌 증표를 들고 돌아오자 경비대장이 보상을 건넨다.', gold: reward, fn: S2 => { S2.bountyDone = `${S2.region}-${S2.day}`; } } } },
        { t: '다음에 한다', ok: {} }
      ]
    }, { id: 'bounty' });
  },

  /* ── 여관 ── */
  inn() {
    const S = G.S, R = REGIONS[S.region];
    UI.say('▸ 여관에 들른다', 'me');
    Game.runScene({
      title: '여관',
      text: `벽난로 불빛이 따뜻한 여관. 주인이 잔을 닦으며 고개를 든다. “묵어 가시겠소?”`,
      choices: [
        { t: `하룻밤 묵는다`, cost: R.inn, ok: { text: '푹신한 침대에서 깊이 잠들었다. 몸과 마음이 가득 찼다.', fn: S2 => { G.sleep(); S2.hp = G.maxHp(); S2.mp = G.maxMp(); }, log: `${R.town}의 여관에서 쉬었다` } },
        { t: '술 한 잔 시키고 소문을 듣는다', cost: 1, ok: { fn: () => UI.say(pick(R.rumors), 'quote'), time: 0 } },
        { t: '🎲 주인과 주사위 내기를 한다', ok: { then: () => Game.dice() } },
        { t: '마구간 건초 더미에서 잔다', ok: { text: '말 냄새가 나지만 그럭저럭 잤다.', fn: S2 => { G.sleep(); G.heal(Math.ceil(G.maxHp() / 2)); G.restoreMp(Math.ceil(G.maxMp() / 2)); } } },
        { t: '나간다', ok: {} }
      ]
    }, { id: 'inn' });
  },

  dice(again) {
    const S = G.S;
    if (!again) UI.say('주인이 나무 컵에 주사위 두 개를 넣고 흔든다. “두 눈의 합이 큰 쪽이 이기는 거요. 쌍육(12)이 나오면 두 배!”');
    const bets = [5, 20, 50].map(b => ({ t: `금화 ${b} 걸기`, hint: S.gold < b ? '금화 부족' : `보유 ${S.gold}`, disabled: S.gold < b, fn: () => { DiceGame.play(b); G.save(); Game.dice(true); } }));
    bets.push({ t: '↩ 그만한다', cls: 'ghost', fn: () => Game.hub(true) });
    UI.choices(bets); UI.flush(); Game.refresh();
  },

  /* ── 상점 ── */
  shop() {
    const S = G.S, R = REGIONS[S.region];
    const draw = b => {
      const buy = R.shop.map(id => {
        const it = ITEMS[id], p = G.priceOf(id);
        return `<div class="item"><span class="in">${it.name}<small>${it.desc}${it.dmg ? ` · ${it.dmg} ${STATS[it.stat].name}` : ''}</small></span><span class="price">${p}</span><button class="mini" data-buy="${id}" ${S.gold < p ? 'disabled' : ''}>사기</button></div>`;
      }).join('');
      const sellable = Object.keys(S.inv).filter(id => ITEMS[id].type !== 'key' && ITEMS[id].price > 0);
      const sell = sellable.map(id => `<div class="item"><span class="in">${ITEMS[id].name} <em>×${S.inv[id]}</em></span><span class="price">${Math.floor(ITEMS[id].price / 2)}</span><button class="mini" data-sell="${id}">팔기</button></div>`).join('') || '<p class="muted small">팔 물건이 없다.</p>';
      b.innerHTML = `<p class="shop-gold">보유 금화 <b>${S.gold}</b>${S.cls === 'bard' ? ' <span class="tag">음유시인 10% 할인</span>' : ''}</p><h3>사기</h3>${buy}<h3>팔기 <small>(장착 중인 물건은 가방에 없다)</small></h3>${sell}`;
      b.querySelectorAll('[data-buy]').forEach(x => x.onclick = () => { const id = x.dataset.buy, p = G.priceOf(id); if (S.gold < p) return; S.gold -= p; G.give(id); UI.toast(`${ITEMS[id].name} 구입`); G.save(); Game.refresh(); draw(b); });
      b.querySelectorAll('[data-sell]').forEach(x => x.onclick = () => { const id = x.dataset.sell; if (!G.take(id)) return; S.gold += Math.floor(ITEMS[id].price / 2); UI.toast(`${ITEMS[id].name} 판매`); G.save(); Game.refresh(); draw(b); });
    };
    UI.modal(`🏪 ${R.town}의 상점`, '', draw);
  },

  useItem(id) {
    const S = G.S, it = ITEMS[id];
    if (!it || it.type !== 'use' || it.combatOnly || Game.mode === 'combat') return;
    if (!G.take(id)) return;
    const u = it.use; let msg = `${it.name} 사용`;
    if (u.heal) msg += ` · 체력 +${G.heal(Dice.roll(u.heal).total)}`;
    if (u.mp) msg += ` · 마나 +${G.restoreMp(u.mp)}`;
    UI.toast(msg); G.save(); Game.refresh();
  },

  /* ── 여행 ── */
  travelMenu() {
    const S = G.S;
    UI.say('▸ 지도를 펼친다', 'me');
    UI.say('어디로 갈까?');
    const list = Game.routes(S.region).map(([r, d]) => {
      const R = REGIONS[r], need = Game.rationNeed(d);
      return { t: `${R.icon} ${R.name} — ${R.town}`, hint: `${d}일 · 식량 ${need} 필요 (보유 ${S.inv.ration || 0}) · 권장 Lv.${R.lv}${S.seals.includes(r) ? ' · 인장 ✓' : ''}`, fn: () => Game.travelAsk(r) };
    });
    list.push({ t: '↩ 그만둔다', cls: 'ghost', fn: () => Game.hub(true) });
    UI.choices(list); UI.flush();
  },
  rationNeed(d) { return G.S.cls === 'ranger' ? Math.ceil(d / 2) : d; },

  travelAsk(dest) {
    const S = G.S, d = ROUTES[S.region][dest], need = Game.rationNeed(d), have = S.inv.ration || 0, R = REGIONS[dest];
    const lvMin = +R.lv.split('~')[0];
    let warn = '';
    if (have < need) warn += `<br><span class="bad">식량이 ${need - have}일치 모자란다. 굶은 날마다 체력을 잃는다.</span>`;
    if (S.lvl < lvMin) warn += `<br><span class="bad">권장 레벨(${R.lv})보다 낮다. 위험할 수 있다.</span>`;
    UI.say(`${R.icon} <b>${R.town}</b>까지 ${d}일 길. 식량 ${need}개를 쓴다.${warn}`);
    UI.choices([
      { t: '떠난다', fn: () => Game.travel(dest) },
      { t: '↩ 다시 생각한다', cls: 'ghost', fn: () => Game.hub(true) }
    ]);
    UI.flush();
  },

  travel(dest) {
    const S = G.S, d = ROUTES[S.region][dest], need = Game.rationNeed(d);
    const used = Math.min(need, S.inv.ration || 0), miss = need - used;
    G.take('ration', used);
    UI.say(`▸ ${REGIONS[dest].town}을(를) 향해 떠난다`, 'me');
    UI.head(`${REGIONS[S.region].name} → ${REGIONS[dest].name} · ${d}일`);
    UI.say(`식량 ${used}개를 먹으며 길을 걸었다.`);
    if (miss > 0) { const h = Dice.roll(`${miss}d4`).total; S.hp = Math.max(1, S.hp - h); UI.say(`굶주림에 시달렸다. 체력 -${h}`, 'loss'); }
    S.day += d; S.phase = 2; S.travelled += d;
    const ev = pick(ROAD);
    Game.runScene(ev, { id: ev.id, road: true, dest, after: () => Game.arrive(dest) });
  },

  arrive(dest, first) {
    const S = G.S, R = REGIONS[dest];
    S.region = dest;
    UI.head(`${R.icon} ${R.town}`);
    if (!S.flags['visit_' + dest]) {
      S.flags['visit_' + dest] = true;
      UI.say(R.desc);
      UI.say(`<span class="muted">${R.name} · 권장 레벨 ${R.lv}${MAINS[dest] ? ` · 지역 이야기: 「${MAINS[dest].name}」` : ''}</span>`);
      if (!first) G.log(`${R.town}에 처음 도착했다`);
    } else UI.say(`${R.town}에 돌아왔다.`);
    Game.refresh();
    Game.hub(true);
  },

  /* ── 패배 ── */
  defeat() {
    const S = G.S, lost = Math.floor(S.gold / 2);
    Game.mode = 'scene';
    S.gold -= lost; G.sleep();
    S.hp = Math.ceil(G.maxHp() / 2); S.mp = Math.ceil(G.maxMp() / 2);
    UI.head('쓰러진 뒤');
    UI.say(`어둠 속에서 누군가 이름을 부르는 소리를 들었다… 눈을 뜨니 ${REGIONS[S.region].town}의 여관 침대 위다. 지나가던 순례자가 옮겨 주었다고 한다.${lost ? ` 주머니가 가벼워졌다. (금화 -${lost})` : ''}`);
    G.log('쓰러졌다가 여관에서 깨어났다');
    UI.choices([{ t: '다시 일어선다', fn: () => Game.hub() }]);
    UI.flush(); G.save(); Game.refresh();
  }
};

window.addEventListener('DOMContentLoaded', Game.boot);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
