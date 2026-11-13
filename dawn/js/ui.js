'use strict';
/* 대화창·메뉴(일행/장비/아이템/대열/도감/저장/설정)·상점·안내 */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const josa = (word, a, b) => { const c = word.charCodeAt(word.length - 1); return (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28) ? a : b; };

/* ── 장비 등급 표시 (낡은·기본·쓸만한·유물) ── */
const gearName = (id) => `<span class="gn g-${gradeOf(id)}">${esc(EQUIP[id].name)}</span>`;
const gearTag = (id) => `<i class="gtag g-${gradeOf(id)}">${GRADES[gradeOf(id)].name}</i>`;
/* 장비 설명: 능력치(레벨마다 자라는 값은 주인이 있으면 실제 값, 없으면 「레벨×k」), 고유한 힘, 깨어남 진행 */
function gearDesc(id, h) {
  const e = EQUIP[id];
  const parts = [];
  for (const k of ['patk', 'matk', 'pdef', 'mdef', 'spd', 'hp', 'sp', 'crit']) {
    const g = e.grow && e.grow[k];
    if (!e[k] && !g) continue;
    if (g && h) { const v = Party.gearStat(e, k, h.lv); parts.push(`${STAT_NAME[k]} ${v > 0 ? '+' : ''}${v}`); }
    else if (g) parts.push(`${STAT_NAME[k]} ${e[k] ? (e[k] > 0 ? '+' : '') + e[k] + ' ' : ''}(레벨마다 +${g})`);
    else parts.push(`${STAT_NAME[k]} ${e[k] > 0 ? '+' : ''}${e[k]}`);
  }
  let out = (e.slot === 'weapon' ? TYPE_NAME[e.type] + ' · ' : '') + (e.desc || parts.join(', '));
  if (e.note) out += ` · <b class="gnote">${e.note}</b>`;
  if (e.awaken) {
    const G = App.G, a = e.awaken;
    const cur = Math.min(a.n, (G && G.awaken && G.awaken[id]) || 0);
    out += `<span class="awk">무언가 깃들어 있다 — ${AWAKEN_TEXT[a.kind](a.n)} 깨어날 것 같다. <b>${cur.toLocaleString()} / ${a.n.toLocaleString()}</b></span>`;
  }
  return out;
}
const byGrade = (a, b) => GRADES[gradeOf(b)].order - GRADES[gradeOf(a)].order || EQUIP[a].name.localeCompare(EQUIP[b].name);

/* ── 대화창 ── */
const Dialog = (() => {
  let active = false, typing = null, resolve = null, choiceRes = null, choiceIdx = 0, choices = [];
  function speaker(who) {
    if (!who) return null;
    if (HEROES[who]) return { name: HEROES[who].name, spr: HEROES[who].spr, color: HEROES[who].color };
    if (SPEAKERS[who]) return { name: SPEAKERS[who][0], spr: SPEAKERS[who][1], color: '#f5f2fb' };
    return { name: who, spr: null };
  }
  function say(who, text) {
    return new Promise(res => {
      active = true; resolve = res;
      const sp = speaker(who);
      const box = $('dlg');
      box.hidden = false;
      box.classList.toggle('narr', !sp);
      $('dChoices').innerHTML = '';
      const face = $('dFace');
      if (sp && sp.spr) {
        face.src = Gfx.portrait(sp.spr, 96); face.hidden = false;
        face.style.setProperty('--pc', sp.color && sp.color !== '#f5f2fb' ? sp.color : '#8a7ab8');
      } else face.hidden = true;
      $('dName').textContent = sp ? sp.name : '';
      $('dName').style.color = sp ? sp.color : '';
      $('dName').hidden = !sp;
      const t = $('dText');
      t.textContent = '';
      $('dNext').hidden = true;
      const speedMs = { slow: 45, normal: 24, fast: 10, instant: 0 }[App.settings.textSpeed] ?? 24;
      let i = 0;
      clearInterval(typing);
      if (!speedMs) { t.textContent = text; $('dNext').hidden = false; typing = null; return; }
      typing = setInterval(() => {
        i++;
        t.textContent = text.slice(0, i);
        if (i % 3 === 0 && text[i - 1] !== ' ') Sound.sfx('text');
        if (i >= text.length) { clearInterval(typing); typing = null; $('dNext').hidden = false; }
      }, speedMs);
      t.dataset.full = text;
    });
  }
  function advance() {
    if (choiceRes) return;
    if (typing) { clearInterval(typing); typing = null; $('dText').textContent = $('dText').dataset.full; $('dNext').hidden = false; return; }
    if (!resolve) return;
    const r = resolve; resolve = null;
    active = false;
    $('dlg').hidden = true;
    r();
  }
  function choice(who, text, opts) {
    return new Promise(res => {
      say(who, text).then(() => {});
      clearInterval(typing); typing = null;
      $('dText').textContent = text; $('dNext').hidden = true;
      choices = opts; choiceIdx = 0;
      choiceRes = (i) => { choiceRes = null; resolve = null; active = false; $('dlg').hidden = true; $('dChoices').innerHTML = ''; res(i); };
      renderChoices();
    });
  }
  function renderChoices() {
    const box = $('dChoices');
    box.innerHTML = '';
    choices.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'btn small' + (i === choiceIdx ? ' cur' : '');
      b.textContent = o;
      b.addEventListener('click', (e) => { e.stopPropagation(); Sound.sfx('ok'); choiceRes(i); });
      box.appendChild(b);
    });
  }
  function key(e) {
    if (!active) return false;
    const k = e.key;
    if (choiceRes) {
      if (k === 'ArrowDown' || k === 'ArrowRight') { choiceIdx = (choiceIdx + 1) % choices.length; Sound.sfx('menu'); renderChoices(); }
      else if (k === 'ArrowUp' || k === 'ArrowLeft') { choiceIdx = (choiceIdx - 1 + choices.length) % choices.length; Sound.sfx('menu'); renderChoices(); }
      else if (['Enter', ' ', 'z', 'Z'].includes(k)) { Sound.sfx('ok'); choiceRes(choiceIdx); }
      else if (['Escape', 'x', 'X'].includes(k)) { Sound.sfx('cancel'); choiceRes(choices.length - 1); }
      return true;
    }
    if (['Enter', ' ', 'z', 'Z', 'x', 'X', 'Escape'].includes(k)) { advance(); return true; }
    return true;
  }
  document.addEventListener('DOMContentLoaded', () => { $('dlg').addEventListener('click', advance); });
  return { say, choice, key, get active() { return active; } };
})();

/* ── 창 (메뉴·상점·안내) ── */
const Modal = (() => {
  let open = false, onClose = null;
  function show(html, cls = '', close = null) {
    const m = $('modal'), p = $('panel');
    p.className = 'panel ' + cls;
    p.innerHTML = html;
    m.hidden = false; open = true; onClose = close;
    p.scrollTop = 0;
    return p;
  }
  function hide() {
    if (!open) return;
    $('modal').hidden = true; open = false;
    const f = onClose; onClose = null;
    if (f) f();
  }
  return { show, hide, get open() { return open; } };
})();

const Menu = (() => {
  let tab = 'party', detail = null, eqWho = null, eqSlot = null, fmSel = null, useCtx = null;
  const TABS = [['party', '일행'], ['equip', '장비'], ['items', '아이템'], ['form', '대열'], ['dex', '도감'], ['save', '저장'], ['opt', '설정']];
  const G = () => App.G;
  const members = () => [...G().front, ...G().back].filter(Boolean);

  function openMenu(t = tab) {
    tab = t; detail = null; eqSlot = null; fmSel = null; useCtx = null;
    render();
  }
  function frame(body) {
    const tabs = TABS.map(([id, n]) => `<button class="tab${tab === id ? ' on' : ''}" data-tab="${id}">${n}</button>`).join('');
    const p = Modal.show(`<div class="mhead"><div class="tabs">${tabs}</div><button class="icon-btn close" id="mClose" aria-label="닫기">✕</button></div>
      <div class="mgold"><span>● ${G().gold.toLocaleString()} G</span><span>${playTime()}</span></div><div class="mbody">${body}</div>`, 'menu', () => App.onMenuClosed());
    p.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { Sound.sfx('menu'); openMenu(b.dataset.tab); }));
    $('mClose').addEventListener('click', () => { Sound.sfx('cancel'); Modal.hide(); });
    return p;
  }
  function playTime() {
    const s = Math.floor((G().stats.playMs || 0) / 1000);
    return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  const bar = (v, m, cls) => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v / m * 100))}%"></i><span>${v}/${m}</span></div>`;

  function render() {
    if (tab === 'party') return detail ? renderDetail() : renderParty();
    if (tab === 'equip') return renderEquip();
    if (tab === 'items') return renderItems();
    if (tab === 'form') return renderForm();
    if (tab === 'dex') return renderDex();
    if (tab === 'save') return renderSave();
    if (tab === 'opt') return renderOpt();
  }

  /* 일행 */
  function card(h, extra = '') {
    const s = Party.stats(h);
    const row = G().front.includes(h.id) ? '전열' : '후열';
    return `<button class="hcard" data-id="${h.id}"><img src="${Gfx.icon(HEROES[h.id].spr, 48, 'f')}" alt="">
      <div class="hc"><div class="hn"><b>${HEROES[h.id].name}</b><small>${HEROES[h.id].job} · Lv ${h.lv}</small><em class="row">${row}</em></div>
      ${bar(h.hp, s.hp, 'hp')}${bar(h.sp, s.sp, 'sp')}${extra}</div></button>`;
  }
  function renderParty() {
    const p = frame(`<div class="hgrid">${members().map(id => card(G().heroes[id])).join('')}</div><p class="hint">누르면 자세히 볼 수 있어요. 치유 기술도 여기서 씁니다.</p>`);
    p.querySelectorAll('.hcard').forEach(b => b.addEventListener('click', () => { Sound.sfx('ok'); detail = b.dataset.id; render(); }));
  }
  function renderDetail() {
    const h = G().heroes[detail], d = HEROES[detail], s = Party.stats(h);
    const lat = LATENTS[d.latent];
    const sk = d.skills.map(([id, lv]) => {
      const k = SKILLS[id], learned = h.lv >= lv;
      const usable = learned && k.kind === 'heal' && !k.revive;
      const rev = learned && k.kind === 'heal' && k.revive;
      return `<div class="sk${learned ? '' : ' locked'}">${k.type ? `<img src="${Gfx.icon(k.type, 16)}" alt="">` : '<i class="dot"></i>'}<b>${learned ? k.name : '???'}</b><small>${learned ? `SP ${k.sp}` : `Lv ${lv}`}</small>
        ${(usable || rev) ? `<button class="btn tiny" data-use="${id}">쓰기</button>` : ''}<p>${learned ? k.desc : `레벨 ${lv}에 배운다.`}</p></div>`;
    }).join('');
    const eq = ['weapon', 'armor', 'acc'].map(sl => `<div class="eqr"><span>${{ weapon: '무기', armor: '방어구', acc: '장신구' }[sl]}</span><b>${h.equip[sl] ? gearName(h.equip[sl]) : '—'}</b></div>`).join('');
    const p = frame(`<div class="detail">
      <div class="dtop"><img src="${Gfx.icon(d.spr, 64, 'f')}" alt=""><div><h3>${d.name} <small>${d.job} · Lv ${h.lv}</small></h3>
        <p class="bio">${d.bio}</p>
        <p class="wtypes">무기: ${d.weapons.map(w => `<img src="${Gfx.icon(w, 16)}" alt="">${TYPE_NAME[w]}`).join(' ')}</p></div></div>
      ${bar(h.hp, s.hp, 'hp')}${bar(h.sp, s.sp, 'sp')}
      <p class="exp">다음 레벨까지 ${h.lv >= MAX_LEVEL ? '—' : (expToNext(h.lv) - h.exp).toLocaleString()} EXP</p>
      <div class="stats">${['patk', 'matk', 'pdef', 'mdef', 'spd', 'crit'].map(k => `<div><span>${STAT_NAME[k]}</span><b>${s[k]}${k === 'crit' ? '%' : ''}</b></div>`).join('')}</div>
      <div class="eqbox">${eq}</div>
      <div class="latent"><b>잠재력 「${lat.name}」</b> <span class="lg"><i style="width:${h.latent || 0}%"></i></span><p>${lat.desc}</p></div>
      <h4>기술</h4><div class="sklist">${sk}</div>
      <div class="drow"><button class="btn small" id="dBack">◀ 일행</button></div></div>`);
    $('dBack').addEventListener('click', () => { Sound.sfx('cancel'); detail = null; render(); });
    p.querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', () => fieldSkill(h, b.dataset.use)));
  }
  function fieldSkill(h, sid) {
    const k = SKILLS[sid];
    const cost = Math.ceil(k.sp * Party.stats(h).fx.spCost);
    if (h.sp < cost) { Sound.sfx('error'); toast('SP가 모자랍니다.'); return; }
    pickMember(`${k.name} — 누구에게?`, (t) => {
      const ts = Party.stats(t);
      if (k.revive) { if (t.hp > 0) return false; t.hp = Math.max(1, Math.round(ts.hp * k.revive)); }
      else {
        const targets = k.target === 'allies' ? members().map(id => G().heroes[id]).filter(x => x.hp > 0) : [t];
        if (t.hp <= 0 && k.target !== 'allies') return false;
        const amt = k.power / 100 * (Party.stats(h).matk * 3 + 40);
        for (const x of targets) { const xs = Party.stats(x); x.hp = Math.min(xs.hp, Math.round(x.hp + amt)); }
      }
      if (h.sp < cost) return false;
      h.sp -= cost;
      Sound.sfx('heal');
      return true;
    }, () => render());
  }
  function pickMember(title, apply, back) {
    const p = frame(`<h4>${title}</h4><div class="hgrid">${members().map(id => card(G().heroes[id])).join('')}</div><div class="drow"><button class="btn small" id="pBack">◀ 뒤로</button></div>`);
    p.querySelectorAll('.hcard').forEach(b => b.addEventListener('click', () => {
      if (apply(G().heroes[b.dataset.id]) === false) { Sound.sfx('error'); return; }
      pickMember(title, apply, back);
    }));
    $('pBack').addEventListener('click', () => { Sound.sfx('cancel'); back(); });
  }

  /* 장비 */
  function statDiff(h, slot, id) {
    const a = Party.stats(h), b = Party.stats(h, { ...h.equip, [slot]: id });
    return ['patk', 'matk', 'pdef', 'mdef', 'spd', 'hp', 'sp', 'crit'].map(k => {
      const d = b[k] - a[k];
      return d ? `<em class="${d > 0 ? 'up' : 'dn'}">${STAT_NAME[k]} ${d > 0 ? '+' : ''}${d}</em>` : '';
    }).join('');
  }
  const eqDesc = gearDesc;
  function renderEquip() {
    const ids = members();
    if (!eqWho || !ids.includes(eqWho)) eqWho = ids[0];
    const h = G().heroes[eqWho];
    const chips = ids.map(id => `<button class="chip${id === eqWho ? ' on' : ''}" data-id="${id}"><img src="${Gfx.face(HEROES[id].spr, 22, 'f')}" alt="">${HEROES[id].name}</button>`).join('');
    const slots = ['weapon', 'armor', 'acc'].map(sl => {
      const cur = h.equip[sl];
      return `<button class="slot${eqSlot === sl ? ' on' : ''}" data-slot="${sl}"><span>${{ weapon: '무기', armor: '방어구', acc: '장신구' }[sl]}</span><b>${cur ? gearTag(cur) + gearName(cur) : '—'}</b><small>${cur ? eqDesc(cur, h) : ''}</small></button>`;
    }).join('');
    let list = '';
    if (eqSlot) {
      const cands = Object.entries(G().gear).filter(([id, n]) => n > 0 && EQUIP[id] && EQUIP[id].slot === eqSlot && Party.canEquip(h, id)).sort(([a], [b]) => byGrade(a, b));
      list = `<h4>바꿀 장비</h4><div class="elist">` +
        (h.equip[eqSlot] && eqSlot !== 'weapon' ? `<button class="eitem" data-eq=""><b>벗기</b><span class="diff">${statDiff(h, eqSlot, null)}</span></button>` : '') +
        (cands.length ? cands.map(([id, n]) => `<button class="eitem" data-eq="${id}"><b>${gearTag(id)}${gearName(id)}</b><small>×${n} · ${eqDesc(id, h)}</small><span class="diff">${statDiff(h, eqSlot, id)}</span></button>`).join('') : '<p class="hint">가방에 맞는 장비가 없습니다.</p>') + '</div>';
    }
    const s = Party.stats(h);
    const p = frame(`<div class="chips">${chips}</div>
      <div class="stats small">${['patk', 'matk', 'pdef', 'mdef', 'spd', 'crit'].map(k => `<div><span>${STAT_NAME[k]}</span><b>${s[k]}</b></div>`).join('')}</div>
      <div class="slots">${slots}</div>${list}
      <p class="hint">${HEROES[eqWho].name}의 무기: ${HEROES[eqWho].weapons.map(w => TYPE_NAME[w]).join('·')}. 무기는 공격력을 올리고, 공격할 때는 쓸 줄 아는 무기 종류를 모두 고를 수 있습니다.</p>`);
    p.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { Sound.sfx('menu'); eqWho = b.dataset.id; eqSlot = null; render(); }));
    p.querySelectorAll('.slot').forEach(b => b.addEventListener('click', () => { Sound.sfx('menu'); eqSlot = eqSlot === b.dataset.slot ? null : b.dataset.slot; render(); }));
    p.querySelectorAll('.eitem').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.eq || null;
      const cur = h.equip[eqSlot];
      if (cur) G().gear[cur] = (G().gear[cur] || 0) + 1;
      if (id) { G().gear[id]--; if (!G().gear[id]) delete G().gear[id]; }
      h.equip[eqSlot] = id;
      Party.clamp(h);
      Sound.sfx('equip');
      render();
    }));
  }

  /* 아이템 */
  function renderItems() {
    const its = Object.entries(G().items).filter(([, n]) => n > 0);
    const gear = Object.entries(G().gear).filter(([id, n]) => n > 0 && EQUIP[id]).sort(([a], [b]) => byGrade(a, b));
    const p = frame(`<div class="ilist">${its.length ? its.map(([id, n]) => {
      const it = ITEMS[id];
      const usable = !it.dmg && !it.bp;
      return `<button class="iitem" data-id="${id}"${usable ? '' : ' disabled'}><img src="${Gfx.icon(it.icon, 24)}" alt=""><b>${it.name}</b><small>×${n}</small><p>${it.desc}${usable ? '' : ' (전투 중에만)'}</p></button>`;
    }).join('') : '<p class="hint">아이템이 없습니다.</p>'}</div>
      ${gear.length ? `<h4>장비 가방</h4><div class="ilist">${gear.map(([id, n]) => `<div class="iitem static"><b>${gearTag(id)}${gearName(id)}</b><small>×${n}</small><p>${eqDesc(id)}</p></div>`).join('')}</div>` : ''}`);
    p.querySelectorAll('.iitem[data-id]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id, it = ITEMS[id];
      pickMember(`${it.name} — 누구에게?`, (t) => {
        if (!G().items[id]) return false;
        const s = Party.stats(t);
        if (it.revive) { if (t.hp > 0) return false; t.hp = Math.round(s.hp * it.revive); }
        else {
          if (t.hp <= 0) return false;
          if (it.heal) t.hp = Math.min(s.hp, t.hp + it.heal);
          if (it.spHeal) t.sp = Math.min(s.sp, t.sp + it.spHeal);
        }
        G().items[id]--; if (!G().items[id]) delete G().items[id];
        Sound.sfx('heal');
        return true;
      }, () => render());
    }));
  }

  /* 대열 */
  function renderForm() {
    const slot = (row, c) => {
      const id = G()[row][c];
      const sel = fmSel && fmSel[0] === row && fmSel[1] === c;
      return `<button class="fslot${sel ? ' on' : ''}${id ? '' : ' empty'}" data-row="${row}" data-c="${c}">${id ? `<img src="${Gfx.icon(HEROES[id].spr, 40, 'f')}" alt=""><b>${HEROES[id].name}</b><small>Lv ${G().heroes[id].lv}</small>` : '<small>빈 자리</small>'}</button>`;
    };
    const p = frame(`<div class="form">
      <div class="frow"><span>전열</span>${[0, 1, 2, 3].map(c => slot('front', c)).join('')}</div>
      <div class="frow back"><span>후열</span>${[0, 1, 2, 3].map(c => slot('back', c)).join('')}</div></div>
      <p class="hint">두 칸을 차례로 누르면 자리를 바꿉니다. 전투에는 전열이 나서고, 같은 세로줄의 후열과 교대할 수 있습니다. 후열은 라운드마다 HP·SP를 조금씩 되찾습니다.</p>`);
    p.querySelectorAll('.fslot').forEach(b => b.addEventListener('click', () => {
      const here = [b.dataset.row, +b.dataset.c];
      if (!fmSel) { fmSel = here; Sound.sfx('menu'); return render(); }
      const [r0, c0] = fmSel, [r1, c1] = here;
      const a = G()[r0][c0], bb = G()[r1][c1];
      G()[r0][c0] = bb; G()[r1][c1] = a;
      // 전열 빈자리는 같은 줄 후열이 메운다. 전열이 비면 되돌린다
      for (let c = 0; c < 4; c++) if (!G().front[c] && G().back[c]) { G().front[c] = G().back[c]; G().back[c] = null; }
      if (!G().front.some(Boolean)) { G()[r0][c0] = a; G()[r1][c1] = bb; Sound.sfx('error'); }
      else Sound.sfx('swap');
      fmSel = null; render();
    }));
  }

  /* 도감: 만난 적과 알아낸 약점 */
  function renderDex() {
    const seen = Object.keys(G().seen || {}).filter(id => ENEMIES[id]);
    const order = Object.keys(ENEMIES);
    seen.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const rows = seen.map(id => {
      const e = ENEMIES[id], known = G().dex[id] || [];
      return `<div class="dex"><img src="${Gfx.icon(e.spr, 40)}" alt=""><div><b>${e.name}</b><small>HP ${e.hp.toLocaleString()} · 실드 ${e.shield}</small>
        <div class="dw">${e.weak.map(w => known.includes(w) ? `<img src="${Gfx.icon(w, 16)}" alt="${TYPE_NAME[w]}" title="${TYPE_NAME[w]}">` : '<i>?</i>').join('')}</div></div></div>`;
    }).join('');
    frame(`<p class="hint">만난 적 ${seen.length} / ${order.length}. 약점은 그 종류로 때려 보거나 엘다의 「약점 간파」로 알아낼 수 있습니다.</p><div class="dexl">${rows || '<p class="hint">아직 만난 적이 없습니다.</p>'}</div>`);
  }

  /* 저장 */
  function renderSave() {
    const canSave = App.canSave();
    const slots = ['auto', 1, 2, 3].map(s => {
      const m = App.slotInfo(s);
      return `<div class="sslot"><div><b>${s === 'auto' ? '자동 저장' : '슬롯 ' + s}</b>${m ? `<small>${m.chapter} · ${m.place} · Lv ${m.lv} · ${m.time}</small><small class="ts">${m.when}</small>` : '<small>비어 있음</small>'}</div>
        <div class="sb">${s !== 'auto' ? `<button class="btn small" data-save="${s}"${canSave ? '' : ' disabled'}>저장</button>` : ''}<button class="btn small" data-load="${s}"${m ? '' : ' disabled'}>불러오기</button></div></div>`;
    }).join('');
    const p = frame(`<div class="saves">${slots}</div><p class="hint">기록은 이 브라우저에만 저장됩니다. 장소를 옮기거나 전투에서 이기면 자동 저장됩니다.</p>`);
    p.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', () => { App.save(b.dataset.save); Sound.sfx('save'); toast('저장했습니다.'); render(); }));
    p.querySelectorAll('[data-load]').forEach(b => b.addEventListener('click', async () => {
      Modal.hide();
      const ok = await Dialog.choice(null, '이 기록을 불러올까요? 지금 진행은 사라집니다.', ['불러온다', '그만둔다']);
      if (ok === 0) App.load(b.dataset.load);
    }));
  }

  /* 설정 */
  function renderOpt() {
    const st = App.settings;
    const p = frame(`<div class="opts">
      <label>음악 <input type="range" min="0" max="100" value="${Math.round(Sound.settings.music * 100)}" id="oMusic"></label>
      <label>효과음 <input type="range" min="0" max="100" value="${Math.round(Sound.settings.sfx * 100)}" id="oSfx"></label>
      <div class="orow"><span>전투 연출</span>${[['normal', '보통'], ['fast', '빠르게']].map(([v, n]) => `<button class="chip${st.battleSpeed === v ? ' on' : ''}" data-bs="${v}">${n}</button>`).join('')}</div>
      <div class="orow"><span>글자 속도</span>${[['slow', '느리게'], ['normal', '보통'], ['fast', '빠르게'], ['instant', '바로']].map(([v, n]) => `<button class="chip${st.textSpeed === v ? ' on' : ''}" data-ts="${v}">${n}</button>`).join('')}</div>
      <div class="orow"><span>조작</span><small>이동 방향키·WASD · 조사/결정 Z·Enter·Space · 메뉴/취소 X·Esc · 전투 부스트 Q(－)·E(＋)</small></div>
      <div class="drow"><button class="btn small red" id="oTitle">타이틀로 돌아가기</button></div></div>`);
    $('oMusic').addEventListener('input', (e) => { Sound.setVolume('music', e.target.value / 100); App.saveSettings(); });
    $('oSfx').addEventListener('input', (e) => { Sound.setVolume('sfx', e.target.value / 100); App.saveSettings(); });
    $('oSfx').addEventListener('change', () => Sound.sfx('ok'));
    p.querySelectorAll('[data-bs]').forEach(b => b.addEventListener('click', () => { st.battleSpeed = b.dataset.bs; App.saveSettings(); Sound.sfx('menu'); render(); }));
    p.querySelectorAll('[data-ts]').forEach(b => b.addEventListener('click', () => { st.textSpeed = b.dataset.ts; App.saveSettings(); Sound.sfx('menu'); render(); }));
    $('oTitle').addEventListener('click', async () => {
      Modal.hide();
      const r = await Dialog.choice(null, '타이틀로 돌아갈까요? 저장하지 않은 진행은 사라집니다.', ['돌아간다', '그만둔다']);
      if (r === 0) App.toTitle();
    });
  }

  function key(e) {
    if (['Escape', 'x', 'X', 'Backspace'].includes(e.key)) {
      if (tab === 'party' && detail) { detail = null; render(); }
      else Modal.hide();
      Sound.sfx('cancel');
      return true;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const i = TABS.findIndex(t => t[0] === tab);
      const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
      Sound.sfx('menu'); openMenu(TABS[n][0]); return true;
    }
    return false;
  }
  return { open: openMenu, key };
})();

/* ── 상점 ── */
const Shop = (() => {
  let list = [], label = '', mode = 'buy', who = null;
  const G = () => App.G;
  function open(id, name) { list = SHOPS[id] || []; label = name || '상점'; mode = 'buy'; render(); }
  const owned = (id) => (G().items[id] || 0) + (G().gear[id] || 0) + Object.values(G().heroes).filter(h => Object.values(h.equip).includes(id)).length;
  function gearInfo(id) {
    const e = EQUIP[id];
    const hs = [...G().front, ...G().back].filter(Boolean).map(h => G().heroes[h]);
    return hs.map(h => {
      if (!Party.canEquip(h, id)) return '';
      const a = Party.stats(h), b = Party.stats(h, { ...h.equip, [e.slot]: id });
      const key = e.slot === 'weapon' ? (e.matk > e.patk ? 'matk' : 'patk') : e.slot === 'armor' ? 'pdef' : null;
      let d = '';
      if (key) { const v = b[key] - a[key]; d = `<em class="${v > 0 ? 'up' : v < 0 ? 'dn' : ''}">${v > 0 ? '▲' : v < 0 ? '▼' : '＝'}${Math.abs(v) || ''}</em>`; }
      return `<span class="who"><img src="${Gfx.face(HEROES[h.id].spr, 18, 'f')}" alt="${HEROES[h.id].name}">${d}</span>`;
    }).join('');
  }
  function render() {
    let rows;
    if (mode === 'buy') {
      rows = list.map(id => {
        const it = ITEMS[id] || EQUIP[id];
        const price = it.price;
        const desc = ITEMS[id] ? ITEMS[id].desc : gearDesc(id);
        const icon = ITEMS[id] ? ITEMS[id].icon : (EQUIP[id].slot === 'weapon' ? EQUIP[id].type : EQUIP[id].slot === 'armor' ? 'armor' : 'ring');
        return `<button class="srow" data-id="${id}"${G().gold < price ? ' disabled' : ''}><img src="${Gfx.icon(icon, 24)}" alt=""><div><b>${EQUIP[id] ? gearTag(id) + gearName(id) : it.name}</b><small>${desc}</small>${EQUIP[id] ? `<div class="whos">${gearInfo(id)}</div>` : ''}</div><span class="pr">${price.toLocaleString()} G<small>가진 수 ${owned(id)}</small></span></button>`;
      }).join('');
    } else {
      const sell = [...Object.entries(G().items).map(([id, n]) => [id, n, ITEMS[id]]), ...Object.entries(G().gear).map(([id, n]) => [id, n, EQUIP[id]])].filter(([, n, it]) => n > 0 && it && it.price > 0);
      rows = sell.length ? sell.map(([id, n, it]) => `<button class="srow" data-id="${id}"><div><b>${EQUIP[id] ? gearTag(id) + gearName(id) : it.name}</b><small>×${n}</small></div><span class="pr">${Math.floor(it.price / 2).toLocaleString()} G</span></button>`).join('') : '<p class="hint">팔 수 있는 것이 없습니다. (장착한 장비와 유물·깃든 장비는 팔 수 없어요)</p>';
    }
    const p = Modal.show(`<div class="mhead"><div class="tabs"><button class="tab${mode === 'buy' ? ' on' : ''}" data-m="buy">사기</button><button class="tab${mode === 'sell' ? ' on' : ''}" data-m="sell">팔기</button></div><button class="icon-btn close" id="sClose" aria-label="닫기">✕</button></div>
      <div class="mgold"><span>${esc(label)}</span><span>● ${G().gold.toLocaleString()} G</span></div><div class="mbody"><div class="slist">${rows}</div></div>`, 'menu shop', () => App.onMenuClosed());
    p.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.m; Sound.sfx('menu'); render(); }));
    $('sClose').addEventListener('click', () => { Sound.sfx('cancel'); Modal.hide(); });
    p.querySelectorAll('.srow').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id;
      const it = ITEMS[id] || EQUIP[id];
      const bag = ITEMS[id] ? G().items : G().gear;
      if (mode === 'buy') {
        if (G().gold < it.price) { Sound.sfx('error'); return; }
        G().gold -= it.price; bag[id] = (bag[id] || 0) + 1;
        Sound.sfx('buy'); toast(`${it.name}${josa(it.name, '을', '를')} 샀습니다.`);
      } else {
        if (!bag[id]) return;
        bag[id]--; if (!bag[id]) delete bag[id];
        G().gold += Math.floor(it.price / 2);
        Sound.sfx('buy');
      }
      const y = $('panel').querySelector('.mbody').scrollTop;
      render();
      $('panel').querySelector('.mbody').scrollTop = y;
    }));
  }
  return { open };
})();

/* ── 짧은 알림 ── */
let toastTimer = 0;
function toast(text) {
  const t = $('toast');
  t.textContent = text; t.hidden = false;
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
}
