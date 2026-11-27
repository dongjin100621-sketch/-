'use strict';
/* 은빛 유랑기 — 턴제 전투. d20 + 명중 보너스 vs 방어도 */

const Combat = {
  C: null,

  start(id, opts = {}) {
    const E = ENEMIES[id];
    let hp = E.hp;
    if (opts.weak) hp = Math.round(hp * 0.7);
    Combat.C = {
      id, e: E, hp, max: hp, turn: 0, opts,
      buff: { ac: 0, acT: 0, hit: 0, dmg: 0, hitT: 0 }, sharp: 0, mark: 0, stun: 0, enraged: false
    };
    G.S.poison = 0; G.S.chill = 0;
    Game.mode = 'combat';
    UI.say(`<b>⚔ 전투 — ${E.name}</b>${E.boss ? ' <span class="tag boss">우두머리</span>' : ''}<br><span class="muted">${E.desc}</span>${opts.weak ? '<br><span class="good">약해진 상태다! (체력 30% 감소)</span>' : ''}`, 'combat');
    Combat.playerTurn();
  },

  enemyAc() { return Combat.C.e.ac - Combat.C.mark; },

  playerTurn() {
    const S = G.S, C = Combat.C;
    if (S.poison > 0) {
      const d = Dice.roll('1d4').total; S.hp = Math.max(0, S.hp - d); S.poison--;
      UI.say(`독이 퍼진다. 체력 -${d}`, 'loss');
      if (S.hp <= 0) return Combat.defeat();
    }
    C.turn++;
    const acts = [];
    const w = G.weapon();
    acts.push({ t: `⚔️ 공격`, hint: `${w.name} · 명중 ${sign(Combat.hitBonus())} · ${w.dmg}${sign(G.mod(w.stat) + C.buff.dmg + C.sharp)}`, fn: () => Combat.attack() });
    for (const sid of S.skills) {
      const sk = SKILLS[sid];
      acts.push({ t: `✨ ${sk.name}`, hint: `마나 ${sk.mp} · ${sk.desc}`, disabled: S.mp < sk.mp, fn: () => Combat.skill(sid), cls: 'skill' });
    }
    const usable = Object.keys(S.inv).filter(id => ITEMS[id].type === 'use' && id !== 'ration');
    if (usable.length) acts.push({ t: '🧪 아이템', hint: usable.map(id => `${ITEMS[id].name}×${S.inv[id]}`).join(', '), fn: () => Combat.itemMenu() });
    if (!C.opts.noFlee) acts.push({ t: '🏃 도주', hint: `민첩 판정 DC ${10 + C.e.hit}`, fn: () => Combat.flee(), cls: 'ghost' });
    UI.enemyCard(C);
    UI.choices(acts);
    UI.flush();
    Game.refresh();
  },

  itemMenu() {
    const S = G.S;
    const list = Object.keys(S.inv).filter(id => ITEMS[id].type === 'use' && id !== 'ration').map(id => ({
      t: `${ITEMS[id].name} ×${S.inv[id]}`, hint: ITEMS[id].desc, disabled: !!(ITEMS[id].use.flee && Combat.C.opts.noFlee), fn: () => { Combat.useItem(id); }
    }));
    list.push({ t: '↩ 돌아가기', fn: () => Combat.playerTurn(), cls: 'ghost' });
    UI.choices(list); UI.flush();
  },

  hitBonus() { return G.atkBonus() + Combat.C.buff.hit - (G.S.chill > 0 ? 2 : 0); },

  /* 무기 공격 한 번. extraHit, extraDmg: 기술 보정 */
  swing(extraHit = 0, extraDmg = '0', label = '공격') {
    const C = Combat.C, w = G.weapon();
    const r = Dice.d(20), b = Combat.hitBonus() + extraHit, total = r + b, ac = Combat.enemyAc();
    const hit = r === 20 || (r !== 1 && total >= ac);
    UI.dice({ label, roll: r, bonus: b, total, dc: ac, dcLabel: '방어도', ok: hit, crit: r === 20, fumble: r === 1 });
    if (!hit) { UI.say(pick(['빗나갔다.', '공격이 막혔다.', '허공을 갈랐다.'])); return; }
    let d = Dice.roll(w.dmg).total + G.mod(w.stat) + C.buff.dmg + C.sharp;
    if (extraDmg !== '0') d += Dice.roll(extraDmg).total;
    if (r === 20) d += Dice.roll(w.dmg).total + (extraDmg !== '0' ? Dice.roll(extraDmg).total : 0);
    Combat.hurt(Math.max(1, d), r === 20 ? '치명타! ' : '');
  },

  hurt(d, prefix = '') {
    const C = Combat.C;
    C.hp = Math.max(0, C.hp - d);
    UI.say(`${prefix}${C.e.name}에게 <b>${d}</b> 피해.`, 'hit');
  },

  attack() { Combat.swing(); Combat.after(); },

  skill(sid) {
    const S = G.S, C = Combat.C, sk = SKILLS[sid];
    if (S.mp < sk.mp) return;
    S.mp -= sk.mp;
    UI.say(`<b>${sk.name}!</b>`, 'skillcast');
    switch (sk.kind) {
      case 'atk': Combat.swing(sk.hit || 0, sk.extra || '0', sk.name); break;
      case 'multi': for (let i = 0; i < sk.n && C.hp > 0; i++) Combat.swing(0, sk.extra || '0', `${sk.name} ${i + 1}`); break;
      case 'spell': {
        let d = Dice.roll(sk.dmg).total + G.mod(sk.stat);
        const sp = C.e.sp || [];
        if (sk.fire && (sp.includes('plant') || sp.includes('ice'))) { d = Math.round(d * 1.5); UI.say('불길이 약점을 파고든다!', 'good'); }
        if (sid === 'requiem' && sp.includes('undead')) { d *= 2; UI.say('진혼가가 망령을 꿰뚫는다!', 'good'); }
        Combat.hurt(Math.max(1, d));
        if (sk.stun && C.hp > 0 && Math.random() < sk.stun) { C.stun = 1; UI.say(`${C.e.name}이(가) 얼어붙었다!`, 'good'); }
        break;
      }
      case 'heal': { const h = G.heal(Dice.roll(sk.heal).total + G.mod(sk.stat)); UI.say(`체력 +${h}`, 'gain'); break; }
      case 'buff':
        if (sk.buff.ac) { C.buff.ac = sk.buff.ac; C.buff.acT = sk.buff.turns; UI.say(`방어도 +${sk.buff.ac} (${sk.buff.turns}턴)`, 'good'); }
        if (sk.buff.hit) { C.buff.hit = sk.buff.hit; C.buff.dmg = sk.buff.dmg; C.buff.hitT = sk.buff.turns; UI.say(`명중 +${sk.buff.hit}, 피해 +${sk.buff.dmg} (${sk.buff.turns}턴)`, 'good'); }
        break;
      case 'mark': C.mark = 2; UI.say(`${C.e.name}의 약점이 드러났다. 방어도 -2`, 'good'); break;
      case 'stun': {
        const dc = 8 + C.e.hit + (C.e.boss ? 2 : 0);
        if (G.check('cha', dc)) { C.stun = 2; UI.say(`${C.e.name}이(가) 노래에 홀려 멍해졌다.`, 'good'); }
        else UI.say('노래가 닿지 않았다.');
        break;
      }
    }
    Combat.after();
  },

  useItem(id) {
    const S = G.S, it = ITEMS[id], u = it.use;
    if (!G.take(id)) return;
    UI.say(`${it.name}을(를) 사용했다.`);
    if (u.flee) {
      UI.say('연기 속으로 몸을 숨겼다.', 'good');
      const C = Combat.C; Combat.end();
      return Game.runOutcome(C.opts.flee || { text: '무사히 빠져나왔다.' }, C.opts.ctx);
    }
    if (u.sharpen) { Combat.C.sharp += u.sharpen; UI.say(`날이 번뜩인다. 이번 전투 동안 피해 +${u.sharpen}`, 'good'); }
    if (u.bomb) { Combat.hurt(Dice.roll(u.bomb).total + ((Combat.C.e.sp || []).includes('plant') ? 4 : 0)); }
    if (u.heal) { const h = G.heal(Dice.roll(u.heal).total); UI.say(`체력 +${h}`, 'gain'); }
    if (u.mp) { const m = G.restoreMp(u.mp); UI.say(`마나 +${m}`, 'gain'); }
    if (u.cure && S.poison) { S.poison = 0; UI.say('독이 사라졌다.', 'good'); }
    Combat.after();
  },

  flee() {
    const C = Combat.C;
    if (G.check('dex', 10 + C.e.hit)) {
      UI.say('간신히 몸을 빼냈다.');
      Combat.end();
      Game.runOutcome(C.opts.flee || { text: '숨을 고르며 물러났다.' }, C.opts.ctx);
    } else {
      UI.say('도망치지 못했다!', 'loss');
      Combat.enemyTurn();
    }
  },

  after() {
    if (Combat.C.hp <= 0) return Combat.victory();
    Combat.enemyTurn();
  },

  enemyTurn() {
    const S = G.S, C = Combat.C, E = C.e, sp = E.sp || [];
    // 버프 지속시간
    if (C.buff.acT > 0 && --C.buff.acT === 0) C.buff.ac = 0;
    if (C.buff.hitT > 0 && --C.buff.hitT === 0) { C.buff.hit = 0; C.buff.dmg = 0; }
    if (S.chill > 0) S.chill--;

    if (C.stun > 0) {
      C.stun--;
      UI.say(`${E.name}은(는) 움직이지 못한다.`, 'muted');
      return Combat.playerTurn();
    }
    if (sp.includes('regen') && C.hp < C.max) {
      const h = Math.min(4, C.max - C.hp); C.hp += h;
      UI.say(`${E.name}의 상처가 뿌리로 아문다. (+${h})`, 'muted');
    }
    if (E.boss && !C.enraged && C.hp <= C.max / 2) {
      C.enraged = true;
      UI.say(`<b>${E.name}이(가) 분노한다!</b> 공격이 더 날카로워졌다.`, 'loss');
    }
    let heavy = false;
    if (sp.includes('heavy')) {
      if (C.turn % 3 === 2) { UI.say(`⚠ ${E.name}이(가) 힘을 모은다… 다음 공격이 강하다! (방어 기술이나 회복을 준비하자)`, 'warn'); return Combat.playerTurn(); }
      if (C.turn % 3 === 0) heavy = true;
    }
    const n = sp.includes('multi') && !heavy ? 2 : 1;
    for (let i = 0; i < n; i++) {
      Combat.enemyAttack(heavy);
      if (S.hp <= 0) return Combat.defeat();
    }
    Combat.playerTurn();
  },

  enemyAttack(heavy) {
    const S = G.S, C = Combat.C, E = C.e, sp = E.sp || [];
    const r = Dice.d(20), b = E.hit + (heavy ? 2 : 0) + (C.enraged ? 1 : 0), ac = G.ac() + C.buff.ac;
    const hit = r === 20 || (r !== 1 && r + b >= ac);
    UI.dice({ label: `${E.name}${heavy ? ' 강공' : ''}`, roll: r, bonus: b, total: r + b, dc: ac, dcLabel: '내 방어도', ok: hit, enemy: true, crit: r === 20, fumble: r === 1 });
    if (!hit) { UI.say(pick(['공격을 피했다.', '갑옷이 막아 냈다.', '몸을 비틀어 흘려 냈다.'])); return; }
    let d = Dice.roll(E.dmg).total;
    if (r === 20) d += Dice.roll(E.dmg).total;
    if (heavy) d = Math.round(d * 1.6);
    S.hp = Math.max(0, S.hp - d);
    UI.say(`${heavy ? '<b>강력한 일격!</b> ' : ''}체력 -${d}`, 'loss');
    if (sp.includes('drain')) { const h = Math.ceil(d / 2); C.hp = Math.min(C.max, C.hp + h); UI.say(`${E.name}이(가) 생기를 빨아들인다. (+${h})`, 'muted'); }
    if (sp.includes('poison') && !S.poison && Math.random() < 0.35) { S.poison = 3; UI.say('독에 중독되었다! (3턴)', 'loss'); }
    if (sp.includes('chill') && Math.random() < 0.3) { S.chill = 2; UI.say('몸이 얼어 움직임이 둔해진다. (명중 -2, 2턴)', 'loss'); }
  },

  victory() {
    const C = Combat.C, S = G.S;
    UI.say(`<b>${C.e.name}을(를) 쓰러뜨렸다!</b>`, 'victory');
    S.kills++; S.bestiary[C.id] = (S.bestiary[C.id] || 0) + 1;
    Combat.end();
    G.apply({ xp: C.e.xp, gold: C.e.gold[1] ? C.e.gold : 0 });
    Game.runOutcome(C.opts.win || {}, C.opts.ctx);
  },

  defeat() {
    const C = Combat.C;
    UI.say(`<b>쓰러졌다…</b>`, 'loss');
    Combat.end();
    Game.defeat(C ? C.e.name : '');
  },

  end() {
    Combat.C = null; G.S.poison = 0; G.S.chill = 0;
    Game.mode = 'scene';
    UI.enemyCard(null);
  }
};
