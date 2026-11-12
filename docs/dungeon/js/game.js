'use strict';
/* 게임 규칙: 턴 진행, 전투, 몬스터 행동, 아이템·기술, 저장.
   화면·소리는 Game.on() 으로 받는 사건(event)으로만 알린다. */

const Game = (() => {
  let S = null;            // 저장되는 상태
  let rng = makeRng(1);
  let vis = null;          // 지금 보이는 칸 (저장 안 함)
  let pdist = null;        // 주인공까지의 거리 지도 (몬스터 길찾기)
  let delay = 0;           // 이번 턴 연출 지연(ms): 투사체가 날아간 뒤 피해가 뜨게
  const listeners = [];
  const FOV_R = 7;

  const on = (fn) => listeners.push(fn);
  function emit(type, data = {}) {
    data.delay = data.delay ?? delay;
    for (const fn of listeners) fn(type, data);
  }
  function msg(text, cls = '') {
    S.log.push({ text, cls, turn: S.turn });
    if (S.log.length > 80) S.log.shift();
    emit('msg', { text, cls });
  }

  /* ── 상태 만들기 ── */
  function newGame(seed = (Math.random() * 2 ** 32) >>> 0) {
    rng = makeRng(seed);
    uidSeq = 1;
    const p = {
      uid: 'p', x: 0, y: 0, hp: START.hp, mp: START.mp, lv: 1, exp: 0, gold: 0,
      baseHp: START.hp, baseMp: START.mp, baseAtk: START.atk, baseDef: START.def,
      equip: { weapon: makeItem('dagger', rng, 1, 0), armor: makeItem('armor_cloth', rng, 1, 0), acc: null },
      inv: [{ id: 'potion_heal', n: 2 }, { id: 'scroll_teleport', n: 1 }],
      poison: 0, poisonDmg: 0, power: 0, regenAcc: 0, mpAcc: 0, facing: 1
    };
    S = {
      v: 1, seed, depth: 1, turn: 0, over: false, won: false, player: p, floor: null, log: [],
      stats: { kills: 0, deaths: 0, playMs: 0, goldEarned: 0, bossKills: 0, killedBy: '' }
    };
    enterFloor(1);
    return S;
  }

  function enterFloor(depth) {
    S.depth = depth;
    S.floor = generateFloor(depth, rng);
    const p = S.player, f = S.floor;
    p.x = f.start.x; p.y = f.start.y;
    vis = new Uint8Array(f.w * f.h);
    updateFov();
    const th = THEMES[f.theme];
    msg(`지하 ${depth}층 · ${th.name}`, 'floor');
    if (STORY.floorIn[depth]) msg(STORY.floorIn[depth], 'story');
    if (f.shop) msg('어딘가에서 상인의 콧노래가 들린다.', 'info');
    emit('floor', { depth });
  }

  /* ── 능력치 ── */
  function stats() {
    const p = S.player;
    const w = p.equip.weapon ? ITEMS[p.equip.weapon.id] : null;
    const a = p.equip.armor ? ITEMS[p.equip.armor.id] : null;
    const c = p.equip.acc ? ITEMS[p.equip.acc.id] : null;
    return {
      atk: p.baseAtk + (w ? w.atk + (p.equip.weapon.plus || 0) : 0) + (c?.atk || 0) + (p.power > 0 ? 6 : 0),
      def: p.baseDef + (a ? a.def + (p.equip.armor.plus || 0) : 0) + (c?.def || 0),
      mhp: p.baseHp + (c?.hp || 0),
      mmp: p.baseMp + (c?.mp || 0) + (w?.mp || 0),
      crit: START.crit + (w?.crit || 0) + (c?.crit || 0),
      eva: a?.eva || 0,
      regen: c?.regen || 1,
      mpRegen: c?.mpRegen || 1,
      steal: w?.steal || 0,
      spell: 1 + (w?.spell || 0),
      fireRes: a?.fireRes || 0,
      goldMul: c?.goldMul || 1
    };
  }

  /* ── 지도 도우미 ── */
  const idx = (x, y) => y * S.floor.w + x;
  const tileAt = (x, y) => {
    const f = S.floor;
    return x < 0 || y < 0 || x >= f.w || y >= f.h ? T.WALL : f.tiles[y * f.w + x];
  };
  const monsterAt = (x, y) => S.floor.monsters.find(m => m.x === x && m.y === y && !m.dead) || null;
  const objectAt = (x, y) => S.floor.objects.find(o => o.x === x && o.y === y) || null;
  const itemAt = (x, y) => S.floor.items.find(i => i.x === x && i.y === y) || null;
  const trapAt = (x, y) => S.floor.traps.find(t => t.x === x && t.y === y) || null;
  const isVisible = (x, y) => !!vis[idx(x, y)];

  function updateFov() {
    const f = S.floor, p = S.player;
    vis.fill(0);
    computeFov(p.x, p.y, FOV_R, f.w, f.h, (x, y) => OPAQUE.has(f.tiles[y * f.w + x]), (x, y) => {
      vis[y * f.w + x] = 1;
      f.seen[y * f.w + x] = 1;
    });
  }

  function canMonsterEnter(m, x, y) {
    const t = tileAt(x, y);
    const d = MONSTERS[m.id];
    if (d.phase) { if (x < 1 || y < 1 || x >= S.floor.w - 1 || y >= S.floor.h - 1) return false; }
    else if (!(WALKABLE.has(t) || (t === T.LAVA && d.fly))) return false;
    if (x === S.player.x && y === S.player.y) return false;
    if (monsterAt(x, y) || objectAt(x, y)) return false;
    return true;
  }

  /* ── 피해 계산 ── */
  const calcDmg = (atk, def) => Math.max(1, Math.round(atk * rng.range(0.85, 1.15) - def * 0.7));

  function damagePlayer(dmg, src, kind = 'phys') {
    const p = S.player;
    if (S.over) return;
    p.hp -= dmg;
    emit('hit', { target: p, dmg, kind });
    if (p.hp <= 0) {
      p.hp = 0;
      S.over = true;
      S.stats.killedBy = src;
      msg(src === '독' ? '독이 온몸에 퍼져 쓰러졌다…' : src === '가시 함정' ? '가시 함정에 찔려 쓰러졌다…' : `${src}에게 쓰러졌다…`, 'bad');
      emit('death', { by: src });
    }
  }

  function healPlayer(n) {
    const p = S.player, st = stats();
    const before = p.hp;
    p.hp = Math.min(st.mhp, p.hp + n);
    if (p.hp > before) emit('heal', { target: p, amount: p.hp - before });
    return p.hp - before;
  }

  function damageMonster(m, dmg, opts = {}) {
    m.hp -= dmg;
    emit('hit', { target: m, dmg, crit: !!opts.crit, kind: opts.kind || 'phys' });
    if (m.state === 'sleep' || m.sleep) { m.sleep = 0; m.state = 'hunt'; m.lastX = S.player.x; m.lastY = S.player.y; }
    if (m.state === 'wander') m.state = 'hunt';
    if (m.hp <= 0) killMonster(m);
  }

  function killMonster(m) {
    const d = MONSTERS[m.id], f = S.floor, p = S.player, st = stats();
    m.dead = true;
    f.monsters = f.monsters.filter(x => x !== m);
    S.stats.kills++;
    emit('die', { m });
    msg(`${josa(monName(m), '을를')} 쓰러뜨렸다.`, 'good');
    const g = Math.round(rng.int(d.gold?.[0] || 0, d.gold?.[1] || 0) * st.goldMul * (m.elite ? 2 : 1));
    if (g > 0) { p.gold += g; S.stats.goldEarned += g; emit('gold', { n: g, x: m.x, y: m.y }); }
    if (d.exp) gainExp(Math.round(d.exp * (m.elite ? 2 : 1)));
    // 떨어뜨리는 물건
    const drops = [];
    if (m.boss) drops.push(randomItem(S.depth + 2, rng, ['weapon', 'armor']), randomItem(S.depth + 1, rng, ['acc']), makeItem('potion_heal', rng));
    else if (m.id === 'mimic') drops.push(randomItem(S.depth + 2, rng, ['weapon', 'armor', 'acc']));
    else if (m.elite || rng.chance(0.11)) drops.push(randomItem(S.depth + (m.elite ? 1 : 0), rng));
    for (const it of drops) dropItem(it, m.x, m.y);
    if (m.boss) {
      f.bossDead = true;
      S.stats.bossKills++;
      for (const x of f.monsters.filter(x => x.summoner === m.uid)) { x.dead = true; emit('die', { m: x }); }
      f.monsters = f.monsters.filter(x => !x.dead);
      const cx = f.arena.x + Math.floor(f.arena.w / 2), cy = f.arena.y + Math.floor(f.arena.h / 2);
      if (S.depth < LAST_FLOOR) {
        f.tiles[idx(cx, cy)] = T.STAIRS;
        f.stairs = { x: cx, y: cy };
        msg('보스 방 한가운데에 아래로 내려가는 계단이 열렸다!', 'gold');
      } else {
        dropItem({ id: 'ember', n: 1 }, m.x, m.y, true);
        msg('군주가 쥐고 있던 첫 불씨가 바닥에 떨어졌다.', 'gold');
      }
      emit('bossdead', { m });
    }
  }

  function dropItem(item, x, y, force) {
    const f = S.floor;
    const cells = [[x, y], ...DIRS8.map(([dx, dy]) => [x + dx, y + dy])];
    for (let r = 2; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) cells.push([x + dx, y + dy]);
    for (const [cx, cy] of cells) {
      const t = tileAt(cx, cy);
      if ((t === T.FLOOR || t === T.WATER || (force && t === T.STAIRS)) && !itemAt(cx, cy) && !objectAt(cx, cy)) {
        f.items.push({ x: cx, y: cy, item });
        emit('drop', { x: cx, y: cy, item });
        return true;
      }
    }
    return false;
  }

  function gainExp(n) {
    const p = S.player;
    p.exp += n;
    while (p.exp >= expToNext(p.lv)) {
      p.exp -= expToNext(p.lv);
      p.lv++;
      p.baseHp += LEVEL_UP.hp;
      p.baseMp += LEVEL_UP.mp;
      p.baseAtk += LEVEL_UP.atk;
      if (p.lv % 2 === 0) p.baseDef += 1;
      const st = stats();
      p.hp = st.mhp; p.mp = st.mmp;
      msg(`레벨 ${p.lv}! 체력과 마나가 모두 찼다.`, 'gold');
      const sk = SKILLS.find(s => s.lv === p.lv);
      if (sk) msg(`새 기술 「${sk.name}」을 익혔다! (${SKILLS.indexOf(sk) + 1}번 기술)`, 'gold');
      emit('levelup', { lv: p.lv, skill: sk });
    }
  }

  const monName = (m) => (m.elite ? '정예 ' : '') + MONSTERS[m.id].name;

  /* ── 주인공 행동 ──
     act() 는 턴을 썼으면 true. 턴을 쓰면 몬스터가 움직인다. */
  function act(a) {
    if (!S || S.over || S.won) return false;
    delay = 0;
    let used = false;
    switch (a.type) {
      case 'move': used = tryMove(a.dx, a.dy); break;
      case 'wait': used = true; break;
      case 'skill': used = castSkill(a.id); break;
      case 'use': used = useItem(a.index, a.target); break;
      case 'equip': used = equipItem(a.index); break;
      case 'unequip': used = unequip(a.slot); break;
      case 'descend': return descend();
    }
    if (used) endTurn();
    return used;
  }

  function tryMove(dx, dy) {
    const p = S.player, f = S.floor;
    if (dx) p.facing = dx;
    const nx = p.x + dx, ny = p.y + dy;
    const m = monsterAt(nx, ny);
    if (m) { playerAttack(m); return true; }
    const o = objectAt(nx, ny);
    if (o) {
      if (o.type === 'merchant') { emit('shop', {}); return false; }
      if (o.type === 'chest') return openChest(o);
    }
    const t = tileAt(nx, ny);
    if (t === T.DOOR) {
      f.tiles[idx(nx, ny)] = T.DOOR_OPEN;
      emit('door', { x: nx, y: ny });
      updateFov();
      return true;
    }
    if (!WALKABLE.has(t)) {
      if (t === T.LAVA) msg('용암이다. 들어갈 수 없다.', 'info');
      return false;
    }
    const fx = p.x, fy = p.y;
    p.x = nx; p.y = ny;
    emit('move', { who: p, fx, fy, tx: nx, ty: ny });
    updateFov();
    afterStep();
    return true;
  }

  function afterStep() {
    const p = S.player, f = S.floor;
    // 함정
    const tr = trapAt(p.x, p.y);
    if (tr) triggerTrap(tr);
    if (S.over) return;
    // 줍기
    const it = itemAt(p.x, p.y);
    if (it) pickUp(it);
    if (tileAt(p.x, p.y) === T.STAIRS) { msg('아래로 내려가는 계단이다. (▼ 버튼 / Enter)', 'info'); emit('stairs', {}); }
    // 보스 방에 들어섬
    if (f.boss && !f.bossAwake && !f.bossDead && f.arena && inRoom(f.arena, p.x, p.y)) {
      const b = f.monsters.find(m => m.boss);
      if (b) {
        f.bossAwake = true;
        b.state = 'hunt'; b.lastX = p.x; b.lastY = p.y;
        msg(b.id === 'abyss' ? '「불씨를 되찾으러 왔느냐, 작은 기사여.」' : '「누가 감히 나의 잠을 깨우느냐!」', 'boss');
        msg(`${josa(MONSTERS[b.id].name, '이가')} 일어섰다!`, 'bad');
        emit('boss', { m: b });
      }
    }
  }

  function pickUp(fi) {
    const p = S.player, f = S.floor, it = fi.item;
    if (it.id === 'gold') {
      const n = Math.round(it.n * stats().goldMul);
      p.gold += n; S.stats.goldEarned += n;
      f.items = f.items.filter(x => x !== fi);
      msg(`금화 ${n}닢을 주웠다.`, 'gold');
      emit('gold', { n, x: p.x, y: p.y });
      return;
    }
    if (it.id === 'ember') {
      f.items = f.items.filter(x => x !== fi);
      S.won = true;
      msg('첫 불씨를 되찾았다!', 'gold');
      emit('win', {});
      return;
    }
    if (!addToInv(it)) { msg(`가방이 가득 찼다. (${itemName(it)})`, 'bad'); return; }
    f.items = f.items.filter(x => x !== fi);
    msg(`${josa(itemName(it), '을를')} 주웠다.`, 'item');
    emit('pickup', { item: it });
  }

  const stackable = (id) => ['potion', 'scroll'].includes(ITEMS[id]?.kind);
  const canCarry = (it) => it.id === 'gold' || it.id === 'ember' || S.player.inv.length < INV_SIZE || (stackable(it.id) && S.player.inv.some(x => x.id === it.id));
  function addToInv(it) {
    const inv = S.player.inv;
    if (stackable(it.id)) {
      const s = inv.find(x => x.id === it.id);
      if (s) { s.n += it.n || 1; return true; }
    }
    if (inv.length >= INV_SIZE) return false;
    inv.push(it);
    return true;
  }

  function itemName(it) {
    const d = ITEMS[it.id];
    if (!d) return it.id === 'gold' ? `금화 ${it.n}` : it.id;
    return d.name + (it.plus ? ` +${it.plus}` : '') + (it.n > 1 ? ` ×${it.n}` : '');
  }

  function openChest(o) {
    const p = S.player;
    o.open = true;
    emit('chest', { x: o.x, y: o.y });
    if (o.gold) {
      const n = Math.round(rng.int(15, 30) * (1 + S.depth * 0.5) * stats().goldMul);
      p.gold += n; S.stats.goldEarned += n;
      msg(`상자에서 금화 ${n}닢이 쏟아졌다!`, 'gold');
      emit('gold', { n, x: o.x, y: o.y });
    } else {
      const it = randomItem(S.depth + 1, rng, rng.chance(0.55) ? ['weapon', 'armor', 'acc'] : null);
      msg(`상자를 열었다: ${itemName(it)}`, 'item');
      if (!addToInv(it)) { dropItem(it, o.x, o.y); msg('가방이 가득 차서 바닥에 내려 두었다.', 'bad'); }
      else emit('pickup', { item: it });
    }
    S.floor.objects = S.floor.objects.filter(x => x !== o);
    S.floor.openChests = (S.floor.openChests || []).concat([[o.x, o.y]]);
    return true;
  }

  function playerAttack(m) {
    const p = S.player, st = stats(), d = MONSTERS[m.id];
    p.facing = m.x > p.x ? 1 : m.x < p.x ? -1 : p.facing;
    emit('attack', { who: p, tx: m.x, ty: m.y });
    if (m.disguised) {
      m.disguised = false; m.state = 'hunt'; m.lastX = p.x; m.lastY = p.y;
      msg('상자가 입을 쩍 벌렸다. 미믹이다!', 'bad');
      emit('reveal', { m });
      return;
    }
    const sneak = m.state === 'sleep' || m.sleep > 0;
    if (!sneak && !rng.chance(Math.max(0.5, 0.93 - (d.eva || 0)))) {
      emit('miss', { target: m });
      return;
    }
    const crit = rng.chance(st.crit);
    let dmg = calcDmg(st.atk, m.def);
    if (crit) dmg = Math.round(dmg * 1.8);
    if (sneak) dmg = Math.round(dmg * 1.5);
    if (sneak) msg(`기습! ${monName(m)}에게 ${dmg}의 피해.`, 'good');
    damageMonster(m, dmg, { crit });
    if (st.steal) healPlayer(Math.max(1, Math.round(dmg * st.steal)));
  }

  /* ── 기술 ── */
  /* 보이는 적이면 모두 노릴 수 있다 (가까운 순) */
  function skillTargets() {
    const p = S.player;
    return S.floor.monsters
      .filter(m => !m.dead && !m.disguised && isVisible(m.x, m.y))
      .sort((a, b) => manhattan(a.x, a.y, p.x, p.y) - manhattan(b.x, b.y, p.x, p.y));
  }

  function castSkill(id) {
    const p = S.player, st = stats();
    const sk = SKILLS.find(s => s.id === id);
    if (!sk) return false;
    if (p.lv < sk.lv) { msg(`「${sk.name}」은 레벨 ${sk.lv}에 익힌다.`, 'info'); return false; }
    if (p.mp < sk.mp) { msg('마나가 부족하다.', 'bad'); emit('fail', {}); return false; }
    if (id === 'fire') {
      const t = skillTargets()[0];
      if (!t) { msg('불덩이를 던질 적이 보이지 않는다.', 'info'); emit('fail', {}); return false; }
      p.mp -= sk.mp;
      p.facing = t.x > p.x ? 1 : t.x < p.x ? -1 : p.facing;
      emit('skill', { id });
      shoot(p.x, p.y, t.x, t.y, 'fireball');
      const dmg = Math.round((6 + p.lv * 2 + st.atk * 0.3) * st.spell * rng.range(0.9, 1.1));
      damageMonster(t, dmg, { kind: 'fire' });
      return true;
    }
    if (id === 'whirl') {
      const ts = DIRS8.map(([dx, dy]) => monsterAt(p.x + dx, p.y + dy)).filter(Boolean);
      if (!ts.length) { msg('주위에 벨 적이 없다.', 'info'); emit('fail', {}); return false; }
      p.mp -= sk.mp;
      emit('skill', { id });
      emit('whirl', { x: p.x, y: p.y });
      for (const m of ts) {
        if (m.disguised) { m.disguised = false; m.state = 'hunt'; emit('reveal', { m }); }
        const dmg = Math.round(calcDmg(st.atk * 1.15, m.def) * st.spell);
        damageMonster(m, dmg);
        if (st.steal && !S.over) healPlayer(Math.max(1, Math.round(dmg * st.steal * 0.5)));
      }
      return true;
    }
    if (id === 'heal') {
      if (p.hp >= st.mhp && !p.poison) { msg('이미 체력이 가득하다.', 'info'); return false; }
      p.mp -= sk.mp;
      emit('skill', { id });
      p.poison = 0;
      healPlayer(Math.round(st.mhp * 0.4 * st.spell));
      msg('따스한 빛이 상처를 감싼다.', 'good');
      return true;
    }
    if (id === 'chain') {
      const ts = skillTargets().slice(0, 5);
      if (!ts.length) { msg('번개를 떨어뜨릴 적이 보이지 않는다.', 'info'); emit('fail', {}); return false; }
      p.mp -= sk.mp;
      emit('skill', { id });
      ts.forEach((m, i) => {
        emit('bolt', { x: m.x, y: m.y, delay: i * 90 });
        const dmg = Math.round((10 + p.lv * 2.5) * st.spell * rng.range(0.9, 1.1));
        delay = i * 90 + 120;
        damageMonster(m, dmg, { kind: 'bolt' });
      });
      delay += 60;
      return true;
    }
    return false;
  }

  function shoot(fx, fy, tx, ty, spr) {
    const dist = Math.max(Math.abs(tx - fx), Math.abs(ty - fy));
    const dur = 60 + dist * 35;
    emit('proj', { spr, fx, fy, tx, ty, dur });
    delay += dur;
  }

  /* ── 아이템 ── */
  function useItem(index, target) {
    const p = S.player, st = stats();
    const it = p.inv[index];
    if (!it) return false;
    const d = ITEMS[it.id];
    if (d.kind === 'weapon' || d.kind === 'armor' || d.kind === 'acc') return equipItem(index);
    switch (it.id) {
      case 'potion_heal':
        p.poison = 0;
        healPlayer(Math.max(20, Math.round(st.mhp * 0.5)));
        msg('회복 물약을 마셨다. 몸이 가벼워진다.', 'good');
        break;
      case 'potion_mana': {
        const b = p.mp;
        p.mp = Math.min(st.mmp, p.mp + 20);
        emit('mana', { target: p, amount: p.mp - b });
        msg('마나 물약을 마셨다.', 'good');
        break;
      }
      case 'potion_power':
        p.power = 30;
        msg('힘이 솟구친다! (30턴 동안 공격력 +6)', 'good');
        emit('buff', {});
        break;
      case 'potion_life':
        p.baseHp += 8;
        p.hp = stats().mhp;
        msg('생명의 물약! 최대 체력이 8 올랐다.', 'gold');
        emit('heal', { target: p, amount: 8 });
        break;
      case 'scroll_teleport':
        teleportPlayer();
        msg('주문서가 빛나며 몸이 다른 곳으로 옮겨졌다.', 'info');
        break;
      case 'scroll_map': {
        const f = S.floor;
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
          if (f.tiles[y * f.w + x] !== T.WALL) {
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx, yy = y + dy;
              if (xx >= 0 && yy >= 0 && xx < f.w && yy < f.h) f.seen[yy * f.w + xx] = 1;
            }
          }
        }
        for (const t of f.traps) t.hidden = false;
        msg('층의 모든 길과 함정이 머릿속에 그려졌다.', 'info');
        emit('map', {});
        break;
      }
      case 'scroll_fire': {
        const ts = skillTargets();
        emit('firestorm', {});
        if (!ts.length) msg('불길이 허공을 태웠다.', 'info');
        else msg('주문서에서 불길이 쏟아졌다!', 'good');
        delay = 200;
        for (const m of ts) damageMonster(m, Math.round((14 + S.depth * 4) * rng.range(0.9, 1.1)), { kind: 'fire' });
        break;
      }
      case 'scroll_sleep': {
        const ts = skillTargets().filter(m => !m.boss);
        for (const m of ts) { m.sleep = 14; m.state = 'sleep'; emit('sleep', { m }); }
        msg(ts.length ? `보이는 적 ${ts.length}마리가 잠들었다.` : '주문서의 자장가가 아무도 없는 방에 울렸다.', 'info');
        break;
      }
      case 'scroll_enchant': {
        const slot = target || (p.equip.weapon ? 'weapon' : p.equip.armor ? 'armor' : null);
        const eq = slot && p.equip[slot];
        if (!eq) { msg('강화할 장비를 끼고 있지 않다.', 'info'); return false; }
        eq.plus = (eq.plus || 0) + 1;
        msg(`${josa(ITEMS[eq.id].name, '이가')} 빛나며 ${josa('+' + eq.plus, '이가')} 되었다!`, 'gold');
        emit('enchant', {});
        break;
      }
      default: return false;
    }
    it.n--;
    if (it.n <= 0) p.inv.splice(index, 1);
    const st2 = stats();
    p.hp = Math.min(p.hp, st2.mhp); p.mp = Math.min(p.mp, st2.mmp);
    return true;
  }

  function equipItem(index) {
    const p = S.player;
    const it = p.inv[index];
    if (!it) return false;
    const d = ITEMS[it.id];
    if (!['weapon', 'armor', 'acc'].includes(d.kind)) return false;
    const old = p.equip[d.kind];
    p.inv.splice(index, 1);
    p.equip[d.kind] = it;
    if (old) p.inv.splice(index, 0, old);
    const st = stats();
    p.hp = Math.min(p.hp, st.mhp); p.mp = Math.min(p.mp, st.mmp);
    msg(`${josa(itemName(it), '을를')} 장착했다.`, 'item');
    emit('equip', {});
    return true;
  }

  function unequip(slot) {
    const p = S.player;
    const it = p.equip[slot];
    if (!it) return false;
    if (p.inv.length >= INV_SIZE) { msg('가방이 가득 찼다.', 'bad'); return false; }
    p.equip[slot] = null;
    p.inv.push(it);
    const st = stats();
    p.hp = Math.min(p.hp, st.mhp); p.mp = Math.min(p.mp, st.mmp);
    msg(`${josa(itemName(it), '을를')} 벗었다.`, 'item');
    emit('equip', {});
    return true;
  }

  function dropFromInv(index) {
    const p = S.player;
    const it = p.inv[index];
    if (!it || S.over) return false;
    if (!dropItem(it, p.x, p.y)) { msg('내려놓을 자리가 없다.', 'bad'); return false; }
    p.inv.splice(index, 1);
    msg(`${josa(itemName(it), '을를')} 내려놓았다.`, 'info');
    return true;
  }

  /* ── 상점 ── */
  function buy(k) {
    const p = S.player, s = S.floor.shop?.[k];
    if (!s || s.n <= 0) return false;
    if (p.gold < s.price) { msg('금화가 모자란다.', 'bad'); emit('fail', {}); return false; }
    const it = JSON.parse(JSON.stringify(s.item));
    if (!addToInv(it)) { msg('가방이 가득 찼다.', 'bad'); emit('fail', {}); return false; }
    p.gold -= s.price;
    s.n--;
    msg(`${josa(itemName(it), '을를')} ${s.price}닢에 샀다.`, 'item');
    emit('buy', {});
    return true;
  }
  const sellPrice = (it) => Math.max(1, Math.floor(((ITEMS[it.id]?.price || 0) + (it.plus || 0) * 40) * 0.4));
  function sell(index) {
    const p = S.player, it = p.inv[index];
    if (!it || ITEMS[it.id].kind === 'quest') return false;
    const price = sellPrice(it);
    p.gold += price;
    if (it.n > 1) it.n--; else p.inv.splice(index, 1);
    msg(`${josa(ITEMS[it.id].name, '을를')} ${price}닢에 팔았다.`, 'item');
    emit('buy', {});
    return true;
  }

  /* ── 함정·순간이동 ── */
  function triggerTrap(tr) {
    const p = S.player;
    tr.hidden = false;
    emit('trap', { kind: tr.kind, x: tr.x, y: tr.y });
    if (tr.kind === 'spike') {
      msg('가시 함정을 밟았다!', 'bad');
      damagePlayer(3 + S.depth * 2, '가시 함정');
      return;
    }
    S.floor.traps = S.floor.traps.filter(t => t !== tr);
    if (tr.kind === 'poison') {
      msg('독 안개가 피어올랐다! 중독되었다.', 'bad');
      p.poison = Math.max(p.poison, 7); p.poisonDmg = 1 + Math.floor(S.depth / 3);
    } else if (tr.kind === 'teleport') {
      msg('발밑의 마법진이 번쩍였다!', 'bad');
      teleportPlayer();
    } else if (tr.kind === 'alarm') {
      msg('째깍— 경보 함정이 요란하게 울린다!', 'bad');
      for (const m of S.floor.monsters) if (!m.disguised && !m.boss) { m.state = 'hunt'; m.sleep = 0; m.lastX = p.x; m.lastY = p.y; m.lost = -10; }
    }
  }

  function teleportPlayer() {
    const f = S.floor, p = S.player;
    for (let k = 0; k < 500; k++) {
      const x = rng.int(1, f.w - 2), y = rng.int(1, f.h - 2);
      if (tileAt(x, y) !== T.FLOOR || monsterAt(x, y) || objectAt(x, y) || trapAt(x, y)) continue;
      if (manhattan(x, y, p.x, p.y) < 10 && k < 400) continue;
      if (f.arena && inRoom(f.arena, x, y) && !f.bossDead) continue;
      const fx = p.x, fy = p.y;
      p.x = x; p.y = y;
      emit('teleport', { fx, fy, tx: x, ty: y });
      updateFov();
      afterStep();
      return;
    }
  }

  /* ── 턴 끝: 상태 변화, 몬스터 행동 ── */
  function endTurn() {
    const p = S.player, f = S.floor;
    S.turn++;
    let st = stats();
    if (p.poison > 0 && !S.over) {
      p.poison--;
      damagePlayer(p.poisonDmg || 1, '독', 'poison');
      if (p.poison === 0 && !S.over) msg('독이 빠졌다.', 'info');
    }
    if (p.power > 0) { p.power--; if (!p.power) msg('힘의 물약 기운이 사라졌다.', 'info'); }
    if (!p.poison) {
      p.regenAcc += (st.mhp / 110) * st.regen;
      if (p.regenAcc >= 1) { const n = Math.floor(p.regenAcc); p.regenAcc -= n; p.hp = Math.min(st.mhp, p.hp + n); }
    }
    p.mpAcc += (0.2 + p.lv * 0.01) * st.mpRegen;
    if (p.mpAcc >= 1) { const n = Math.floor(p.mpAcc); p.mpAcc -= n; p.mp = Math.min(st.mmp, p.mp + n); }
    // 숨은 함정 찾기
    for (const t of f.traps) {
      if (t.hidden && chebyshev(t.x, t.y, p.x, p.y) <= 1 && rng.chance(0.3)) {
        t.hidden = false;
        msg('발밑의 함정을 알아챘다.', 'info');
        emit('trapFound', { x: t.x, y: t.y });
      }
    }
    // 몬스터
    pdist = null;
    for (const m of f.monsters.slice()) {
      if (m.dead) continue;
      m.energy += m.spd;
      while (m.energy >= 100 && !m.dead && !S.over) {
        m.energy -= 100;
        monsterAct(m);
      }
      if (S.over) break;
    }
    // 떠돌이 몬스터
    if (!f.boss && !S.over) {
      f.spawnTimer++;
      const cap = FLOORS[S.depth].count + 3;
      if (f.spawnTimer > 80 && f.monsters.length < cap && rng.chance(0.025)) {
        f.spawnTimer = 0;
        spawnWanderer();
      }
    }
    updateFov();
  }

  function spawnWanderer() {
    const f = S.floor, p = S.player;
    for (let k = 0; k < 100; k++) {
      const r = rng.pick(f.rooms);
      const x = r.x + rng.int(0, r.w - 1), y = r.y + rng.int(0, r.h - 1);
      if (tileAt(x, y) !== T.FLOOR || isVisible(x, y) || manhattan(x, y, p.x, p.y) < 12 || monsterAt(x, y) || objectAt(x, y)) continue;
      f.monsters.push(spawnMonster(rng.weighted(FLOORS[S.depth].mon), x, y, S.depth, rng, { state: 'wander' }));
      return;
    }
  }

  /* ── 몬스터 행동 ── */
  function playerDist() {
    if (pdist) return pdist;
    const f = S.floor;
    pdist = distanceMap(f.w, f.h, [[S.player.x, S.player.y]], (x, y) => {
      const t = f.tiles[y * f.w + x];
      return WALKABLE.has(t) || t === T.DOOR;
    });
    return pdist;
  }

  function moveMonster(m, nx, ny) {
    const f = S.floor;
    if (tileAt(nx, ny) === T.DOOR) {
      f.tiles[idx(nx, ny)] = T.DOOR_OPEN;
      emit('door', { x: nx, y: ny, quiet: !isVisible(nx, ny) });
      updateFov();
    }
    const fx = m.x, fy = m.y;
    m.x = nx; m.y = ny;
    emit('move', { who: m, fx, fy, tx: nx, ty: ny });
  }

  function stepToward(m, tx, ty) {
    const p = S.player, f = S.floor, d = MONSTERS[m.id];
    let options = [];
    if (d.phase) {
      for (const [dx, dy] of DIRS4) {
        const nx = m.x + dx, ny = m.y + dy;
        if (canMonsterEnter(m, nx, ny)) options.push([nx, ny, manhattan(nx, ny, tx, ty)]);
      }
    } else {
      let dm;
      if (tx === p.x && ty === p.y) dm = playerDist();
      else dm = distanceMap(f.w, f.h, [[tx, ty]], (x, y) => { const t = f.tiles[y * f.w + x]; return WALKABLE.has(t) || t === T.DOOR || (t === T.LAVA && d.fly); }, 60);
      for (const [dx, dy] of DIRS4) {
        const nx = m.x + dx, ny = m.y + dy;
        const v = dm[ny * f.w + nx];
        if (v >= 0 && canMonsterEnter(m, nx, ny)) options.push([nx, ny, v]);
      }
      if (!options.length && d.fly) {
        for (const [dx, dy] of DIRS4) {
          const nx = m.x + dx, ny = m.y + dy;
          if (canMonsterEnter(m, nx, ny)) options.push([nx, ny, manhattan(nx, ny, tx, ty) + 50]);
        }
      }
    }
    const here = d.phase ? manhattan(m.x, m.y, tx, ty) : null;
    options = options.filter(o => d.phase ? o[2] < here : true);
    if (!options.length) return false;
    options.sort((a, b) => a[2] - b[2]);
    const best = options.filter(o => o[2] === options[0][2]);
    const [nx, ny] = rng.pick(best);
    if (!d.phase) {
      const cur = (tx === p.x && ty === p.y) ? playerDist()[m.y * f.w + m.x] : -1;
      if (cur >= 0 && options[0][2] >= cur && rng.chance(0.5)) return false;  // 막혔으면 가끔 기다림
    }
    moveMonster(m, nx, ny);
    return true;
  }

  function randomStep(m) {
    const opts = DIRS4.map(([dx, dy]) => [m.x + dx, m.y + dy]).filter(([x, y]) => canMonsterEnter(m, x, y));
    if (opts.length) { const [x, y] = rng.pick(opts); moveMonster(m, x, y); }
  }

  function stepAway(m) {
    const p = S.player;
    const here = manhattan(m.x, m.y, p.x, p.y);
    const opts = DIRS4.map(([dx, dy]) => [m.x + dx, m.y + dy]).filter(([x, y]) => canMonsterEnter(m, x, y) && manhattan(x, y, p.x, p.y) > here);
    if (!opts.length) return false;
    const [x, y] = rng.pick(opts);
    moveMonster(m, x, y);
    return true;
  }

  function clearShot(m, tx, ty) {
    const cells = lineCells(m.x, m.y, tx, ty);
    for (let i = 1; i < cells.length - 1; i++) {
      const [x, y] = cells[i];
      if (OPAQUE.has(tileAt(x, y)) || monsterAt(x, y)) return false;
    }
    return true;
  }

  function monsterAttack(m, mult = 1) {
    const p = S.player, st = stats(), d = MONSTERS[m.id];
    emit('attack', { who: m, tx: p.x, ty: p.y });
    if (!rng.chance((m.boss ? 0.92 : 0.87) - st.eva)) {
      emit('miss', { target: p });
      return;
    }
    const dmg = calcDmg(m.atk * mult, st.def);
    damagePlayer(dmg, monName(m));
    if (!S.over && d.poison && rng.chance(d.poison[0])) {
      if (!p.poison) msg(`${d.name}의 독이 몸에 퍼진다!`, 'bad');
      p.poison = Math.max(p.poison, d.poison[1]);
      p.poisonDmg = Math.max(p.poisonDmg || 0, d.poison[2]);
    }
  }

  function monsterShoot(m) {
    const p = S.player, st = stats(), d = MONSTERS[m.id];
    shoot(m.x, m.y, p.x, p.y, d.ranged.proj);
    if (!rng.chance(0.85 - st.eva)) { emit('miss', { target: p }); return; }
    let dmg;
    if (d.ranged.magic) dmg = Math.max(1, Math.round((m.atk * 0.8 * rng.range(0.9, 1.1) - st.def * 0.35) * (1 - st.fireRes)));
    else dmg = calcDmg(m.atk * 0.9, st.def);
    damagePlayer(dmg, monName(m), d.ranged.magic ? 'fire' : 'phys');
  }

  function wake(m) {
    m.state = 'hunt';
    m.lastX = S.player.x; m.lastY = S.player.y;
    emit('wake', { m });
  }

  function monsterAct(m) {
    const p = S.player, f = S.floor, d = MONSTERS[m.id];
    if (m.disguised) return;
    if (m.sleep > 0) { m.sleep--; if (m.sleep === 0) m.state = 'hunt'; return; }
    const seen = isVisible(m.x, m.y) && manhattan(m.x, m.y, p.x, p.y) <= FOV_R + 1;
    if (m.boss && !f.bossAwake) return;
    if (m.state === 'sleep') {
      if (seen && rng.chance(manhattan(m.x, m.y, p.x, p.y) <= 3 ? 0.4 : 0.15)) wake(m);
      return;
    }
    if (seen) {
      if (m.state !== 'hunt') wake(m);
      m.lastX = p.x; m.lastY = p.y; m.lost = 0;
    } else if (m.state === 'hunt') {
      m.lost++;
      if (m.lost > 20) m.state = 'wander';
    }
    if (m.state === 'wander') { wander(m); return; }
    if (m.boss && bossAct(m, seen)) return;

    const dist = manhattan(m.x, m.y, p.x, p.y);
    if (d.erratic && rng.chance(d.erratic)) { randomStep(m); return; }
    if (dist === 1) {
      if (d.keepAway && rng.chance(0.5) && stepAway(m)) return;
      monsterAttack(m);
      return;
    }
    if (d.ranged && seen && dist <= d.ranged.range && clearShot(m, p.x, p.y) && rng.chance(0.7)) {
      monsterShoot(m);
      return;
    }
    if (d.keepAway && seen && dist <= 2 && stepAway(m)) return;
    if (!stepToward(m, m.lastX, m.lastY) && m.x === m.lastX && m.y === m.lastY) m.state = 'wander';
  }

  function wander(m) {
    const f = S.floor;
    if ((m.x === m.wx && m.y === m.wy) || rng.chance(0.02)) {
      const r = rng.pick(f.rooms.filter(r => !r.arena) );
      m.wx = r.x + rng.int(0, r.w - 1); m.wy = r.y + rng.int(0, r.h - 1);
    }
    if (rng.chance(0.25)) return;
    if (!stepToward(m, m.wx, m.wy)) { m.wx = m.x; m.wy = m.y; }
  }

  /* 보스: 특수 행동을 했으면 true */
  function bossAct(m, seen) {
    const p = S.player, f = S.floor;
    m.cd++; m.cd2 = (m.cd2 || 0) + 1;
    const minions = f.monsters.filter(x => x.summoner === m.uid).length;
    const dist = manhattan(m.x, m.y, p.x, p.y);
    if (!m.phase2 && m.hp < m.mhp * 0.5) {
      m.phase2 = true;
      m.spd = 125;
      m.atk += 3;
      msg(m.id === 'abyss' ? '「감히… 이 몸에게 상처를!」 군주의 눈이 붉게 타오른다.' : '기사왕의 뼈가 덜그럭거리며 붉은 기운을 두른다!', 'boss');
      emit('enrage', { m });
      if (m.id === 'abyss') {
        // 순간이동
        const a = f.arena;
        for (let k = 0; k < 50; k++) {
          const x = a.x + rng.int(1, a.w - 2), y = a.y + rng.int(1, a.h - 2);
          if (tileAt(x, y) === T.FLOOR && !monsterAt(x, y) && manhattan(x, y, p.x, p.y) >= 5) {
            emit('teleport', { who: m, fx: m.x, fy: m.y, tx: x, ty: y });
            const fx = m.x, fy = m.y;
            m.x = x; m.y = y;
            emit('move', { who: m, fx, fy, tx: x, ty: y, instant: true });
            break;
          }
        }
        summon(m, ['knight'], 1);
        m.cd = 0;
        return true;
      }
    }
    if (m.id === 'boneking') {
      if (m.cd >= 8 && minions < 3) {
        m.cd = 0;
        msg('「일어나라, 나의 병사들이여!」', 'boss');
        summon(m, ['skeleton', m.phase2 ? 'archer' : 'skeleton'], 2);
        return true;
      }
      // 돌진: 일직선 3~4칸에서 단숨에 다가와 벤다
      if (seen && m.cd2 >= 4 && (m.x === p.x || m.y === p.y) && dist >= 2 && dist <= 4) {
        const dx = Math.sign(p.x - m.x), dy = Math.sign(p.y - m.y);
        let x = m.x, y = m.y, ok = true;
        while (manhattan(x + dx, y + dy, p.x, p.y) >= 1 && !(x + dx === p.x && y + dy === p.y)) {
          x += dx; y += dy;
          if (!canMonsterEnter(m, x, y)) { ok = false; break; }
        }
        if (ok) {
          m.cd2 = 0;
          msg('기사왕이 뼈 창을 겨누고 돌진한다!', 'bad');
          moveMonster(m, x, y);
          monsterAttack(m, 1.4);
          return true;
        }
      }
      return false;
    }
    if (m.id === 'abyss') {
      if (m.cd >= (m.phase2 ? 8 : 10) && minions < (m.phase2 ? 3 : 2)) {
        m.cd = 0;
        msg('「어둠이여, 나의 종을 보내라.」', 'boss');
        summon(m, ['imp'], 1);
        return true;
      }
      if (m.phase2 && m.cd2 >= 6 && dist <= 2) {
        m.cd2 = 0;
        msg('군주의 몸에서 어둠의 파동이 터져 나왔다!', 'bad');
        emit('nova', { x: m.x, y: m.y });
        const st = stats();
        damagePlayer(Math.max(1, Math.round((m.atk * 1.1 - st.def * 0.3) * (1 - st.fireRes * 0.5))), MONSTERS[m.id].name, 'magic');
        return true;
      }
      if (seen && dist >= 2 && m.cd2 >= 3 && clearShot(m, p.x, p.y)) {
        m.cd2 = 0;
        monsterShoot(m);
        return true;
      }
      return false;
    }
    return false;
  }

  function summon(m, ids, n) {
    let k = 0;
    const cells = DIRS8.map(([dx, dy]) => [m.x + dx, m.y + dy]).concat(DIRS8.map(([dx, dy]) => [m.x + dx * 2, m.y + dy * 2]));
    for (const [x, y] of rng.shuffle(cells)) {
      if (k >= n) break;
      if (tileAt(x, y) !== T.FLOOR || monsterAt(x, y) || (x === S.player.x && y === S.player.y)) continue;
      const s = spawnMonster(ids[k % ids.length], x, y, S.depth, rng, { state: 'hunt' });
      s.summoner = m.uid; s.lastX = S.player.x; s.lastY = S.player.y; s.energy = 0;
      S.floor.monsters.push(s);
      emit('summon', { m: s });
      k++;
    }
  }

  /* ── 계단 ── */
  function descend() {
    const p = S.player;
    if (S.over || tileAt(p.x, p.y) !== T.STAIRS) return false;
    if (S.depth >= LAST_FLOOR) return false;
    emit('descend', { depth: S.depth + 1 });
    enterFloor(S.depth + 1);
    return true;
  }

  /* ── 자동 탐험·이동 ── */
  /* 아는 길만 지난다. 드러난 함정은 피하되, 다른 길이 없으면 밟고 지나간다(allowTraps). */
  let allowTraps = false;
  function knownPassable(x, y) {
    const f = S.floor;
    if (!f.seen[y * f.w + x]) return false;
    const t = f.tiles[y * f.w + x];
    if (!(WALKABLE.has(t))) return false;
    if (!allowTraps) { const tr = trapAt(x, y); if (tr && !tr.hidden) return false; }
    if (objectAt(x, y)) return false;
    return true;
  }
  function withTrapFallback(fn) {
    allowTraps = false;
    let r = fn();
    if (!r) { allowTraps = true; r = fn(); allowTraps = false; }
    return r;
  }

  function pathTo(tx, ty) {
    const f = S.floor, p = S.player;
    if (tx === p.x && ty === p.y) return [];
    return withTrapFallback(() => findPath(f.w, f.h, p.x, p.y, tx, ty, (x, y) => knownPassable(x, y) || (x === tx && y === ty && f.seen[y * f.w + x] && (WALKABLE.has(tileAt(x, y)) || objectAt(x, y) || monsterAt(x, y)))));
  }

  function explorePath() { return withTrapFallback(explorePath1); }
  /* 다음 탐험 목적지까지의 경로. 없으면 null */
  function explorePath1() {
    const f = S.floor, p = S.player;
    const dm = distanceMap(f.w, f.h, [[p.x, p.y]], (x, y) => knownPassable(x, y));
    let best = null, bd = 1e9;
    const consider = (x, y, bonus = 0) => {
      const d = dm[y * f.w + x];
      if (d >= 0 && d + bonus < bd) { bd = d + bonus; best = [x, y]; }
    };
    for (const it of f.items) if (f.seen[it.y * f.w + it.x] && !(it.x === p.x && it.y === p.y) && canCarry(it.item)) consider(it.x, it.y, -2);
    for (let y = 1; y < f.h - 1; y++) for (let x = 1; x < f.w - 1; x++) {
      const i = y * f.w + x;
      if (dm[i] < 0) continue;
      if (!f.seen[i - 1] || !f.seen[i + 1] || !f.seen[i - f.w] || !f.seen[i + f.w]) consider(x, y);
    }
    // 아직 열지 않은 상자
    for (const o of f.objects) if (o.type === 'chest' && f.seen[o.y * f.w + o.x]) {
      for (const [dx, dy] of DIRS4) consider(o.x + dx, o.y + dy, 1);
    }
    if (!best) return null;
    const path = findPath(f.w, f.h, p.x, p.y, best[0], best[1], knownPassable) || [];
    // 상자 옆에 도착했다면 상자를 연다
    if (!path.length) {
      const chest = f.objects.find(o => o.type === 'chest' && manhattan(o.x, o.y, p.x, p.y) === 1);
      if (chest) return [[chest.x, chest.y]];
    }
    return path.length ? path : null;
  }

  function hostilesInView() {
    return S.floor.monsters.filter(m => !m.dead && !m.disguised && isVisible(m.x, m.y) && m.state !== 'sleep' && !m.sleep);
  }
  function anyMonsterInView() {
    return S.floor.monsters.some(m => !m.dead && !m.disguised && isVisible(m.x, m.y));
  }

  /* ── 저장 ── */
  function serialize() {
    const f = S.floor;
    const pack = (arr) => Array.from(arr, v => String.fromCharCode(48 + v)).join('');
    const data = { ...S, rng: rng.state, uidSeq, floor: { ...f, tiles: pack(f.tiles), seen: pack(f.seen) } };
    return JSON.stringify(data);
  }
  function load(str) {
    const data = JSON.parse(str);
    if (!data || data.v !== 1) throw new Error('저장 형식이 다릅니다');
    const unpack = (s) => Uint8Array.from(s, c => c.charCodeAt(0) - 48);
    data.floor.tiles = unpack(data.floor.tiles);
    data.floor.seen = unpack(data.floor.seen);
    rng = makeRng(data.seed);
    rng.state = data.rng;
    uidSeq = data.uidSeq || 1000;
    delete data.rng; delete data.uidSeq;
    S = data;
    vis = new Uint8Array(S.floor.w * S.floor.h);
    pdist = null;
    updateFov();
    emit('load', {});
    return S;
  }

  return {
    on, emit, newGame, load, serialize, act, stats, msg,
    get S() { return S; }, get vis() { return vis; },
    tileAt, monsterAt, objectAt, itemAt, trapAt, isVisible, itemName, monName, sellPrice,
    pathTo, explorePath, hostilesInView, anyMonsterInView, dropFromInv, buy, sell, expToNext,
    addPlayTime(ms) { if (S) S.stats.playMs += ms; }
  };
})();
