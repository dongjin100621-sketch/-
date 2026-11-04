'use strict';
/* 건강: 물, 식사(오늘 뭐 먹지), 운동, 약·영양제 알림, 체중, 수면 요약 */
(function () {
  const A = App;
  const { esc, icon } = A;

  const MEALS = [['breakfast', '아침'], ['lunch', '점심'], ['dinner', '저녁'], ['snack', '간식']];
  const MENU = {
    한식: ['김치찌개', '된장찌개', '순두부찌개', '부대찌개', '제육볶음', '비빔밥', '불고기', '갈비탕', '설렁탕', '삼계탕', '감자탕', '닭갈비', '보쌈', '김치볶음밥', '냉면', '칼국수', '육개장', '쌈밥', '생선구이', '고등어조림', '청국장', '닭볶음탕', '국밥', '오징어볶음'],
    중식: ['짜장면', '짬뽕', '탕수육', '볶음밥', '마라탕', '마파두부', '깐풍기', '울면', '양장피', '마라샹궈'],
    일식: ['초밥', '라멘', '돈가스', '우동', '규동', '회덮밥', '소바', '가츠동', '오야코동', '텐동'],
    양식: ['파스타', '피자', '햄버거', '스테이크', '리조또', '샐러드', '샌드위치', '오므라이스', '함박스테이크'],
    분식: ['떡볶이', '김밥', '라면', '순대', '튀김', '쫄면', '만두', '라볶이', '어묵탕', '컵밥'],
    가볍게: ['샐러드', '포케', '샌드위치', '요거트볼', '죽', '고구마와 우유', '닭가슴살 도시락', '두부 샐러드', '토스트']
  };
  const WORKOUTS = [['걷기', 30], ['스트레칭', 10], ['달리기', 20], ['홈트', 15], ['자전거', 30], ['요가', 20], ['계단 오르기', 10], ['근력 운동', 30]];

  function day(d = A.today(), create = false) {
    let h = A.data.health[d];
    if (!h && create) h = A.data.health[d] = { water: 0, meals: {}, workouts: [], weight: null, meds: {} };
    if (h) { h.meals = h.meals || {}; h.workouts = h.workouts || []; h.meds = h.meds || {}; }
    return h || null;
  }
  function changed() { A.save('health'); A.emit('health:change'); }
  function addWater(n, d = A.today()) {
    const h = day(d, true);
    h.water = Math.max(0, Math.min(40, (h.water || 0) + n));
    changed();
    return h.water;
  }
  function takeMed(id, d = A.today(), on = true) {
    const h = day(d, true);
    if (on) h.meds[id] = Date.now(); else delete h.meds[id];
    changed();
  }
  function lastWeight(before = A.today()) {
    const ks = Object.keys(A.data.health).filter(k => k <= before && A.data.health[k].weight).sort();
    return ks.length ? { day: ks[ks.length - 1], kg: A.data.health[ks[ks.length - 1]].weight } : null;
  }
  function mealSlot(now = new Date()) {
    const m = now.getHours() * 60 + now.getMinutes();
    if (m < 10 * 60 + 30) return 'breakfast';
    if (m < 15 * 60) return 'lunch';
    if (m < 21 * 60) return 'dinner';
    return 'snack';
  }
  function pick(cat, avoid = []) {
    const pool = cat === '아무거나' ? [...new Set(Object.values(MENU).flat())] : MENU[cat];
    const recent = new Set();
    A.lastDays(3).forEach(d => { const h = A.data.health[A.ymd(d)]; if (h && h.meals) Object.values(h.meals).forEach(v => String(v).split(/[,·]/).forEach(x => recent.add(x.trim()))); });
    let cand = pool.filter(x => !recent.has(x) && !avoid.includes(x));
    if (!cand.length) cand = pool.filter(x => !avoid.includes(x));
    if (!cand.length) cand = pool;
    return cand[Math.floor(Math.random() * cand.length)];
  }
  A.healthUtil = { day, addWater, takeMed, mealSlot };

  /* ---------- 알림: 약 먹을 시간, 물 마실 시간 ---------- */
  let lastMin = -1;
  A.on('tick', now => {
    if (now.getMinutes() === lastMin) return;
    lastMin = now.getMinutes();
    const t = A.today();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const rem = A.data.ui.medRem && A.data.ui.medRem.day === t ? A.data.ui.medRem : { day: t, ids: [], water: 0 };
    let dirty = false;
    A.data.healthCfg.meds.forEach(m => {
      if (!m.time || rem.ids.includes(m.id)) return;
      const h = day(t);
      if (h && h.meds[m.id]) return;
      const [hh, mm] = m.time.split(':').map(Number);
      const diff = nowMin - (hh * 60 + mm);
      if (diff < 0 || diff > 180) return;
      rem.ids.push(m.id); dirty = true;
      A.Sound.preview('marimba');
      A.notify('약·영양제 먹을 시간', m.name);
      A.toast(`${m.name} 먹을 시간이에요`, { action: '먹었어요', duration: 30000, onAction: () => { takeMed(m.id); A.toast('체크했어요'); } });
    });
    // 물: 9시~21시 사이, 2시간마다, 목표 진도보다 늦을 때만
    const cfg = A.data.healthCfg;
    if (cfg.waterRemind && nowMin >= 9 * 60 && nowMin <= 21 * 60 && nowMin - (rem.water || 0) >= 120) {
      const h = day(t), w = h ? h.water || 0 : 0;
      const pace = Math.floor(cfg.waterGoal * (nowMin - 8 * 60) / (13 * 60));
      if (w < pace) {
        rem.water = nowMin; dirty = true;
        A.notify('물 마실 시간', `오늘 ${w}잔 / ${cfg.waterGoal}잔`);
        A.toast(`물 한 잔 어때요? 오늘 ${w}잔 마셨어요`, { action: '+1잔', duration: 20000, onAction: () => { addWater(1); A.toast(`${(day() || {}).water}잔째예요`); } });
      } else if (!rem.water) { rem.water = nowMin; dirty = true; }
    }
    if (dirty) { A.data.ui.medRem = rem; A.save('ui'); }
  });

  /* ---------- 화면 ---------- */
  A.register({
    id: 'health', label: '건강', icon: 'heart',
    render(el) {
      let sel = A.today();
      let menu = null; // { cat, item }
      el.innerHTML = `
        <div class="page">
          <div class="page-head">
            <div><h1>건강</h1><p class="sub">물, 식사, 운동, 약, 체중을 하루 단위로 기록해요.</p></div>
            <div class="head-actions day-nav">
              <button type="button" class="icon-btn" data-act="prev" aria-label="전날">${icon('chevronL', 18)}</button>
              <strong id="hl-date"></strong>
              <button type="button" class="icon-btn" data-act="next" aria-label="다음 날">${icon('chevronR', 18)}</button>
              <button type="button" class="btn sm" data-act="today">오늘</button>
            </div>
          </div>
          <div class="health-grid">
            <section class="panel" id="hl-water"></section>
            <section class="panel" id="hl-meal"></section>
            <section class="panel" id="hl-work"></section>
            <section class="panel" id="hl-med"></section>
            <section class="panel" id="hl-weight"></section>
            <section class="panel" id="hl-sleep"></section>
          </div>
        </div>`;
      const $ = s => el.querySelector(s);
      const isToday = () => sel === A.today();

      function head(ic, title, extra = '') { return `<div class="panel-head"><h2 class="hl-title">${icon(ic, 18)}<span>${title}</span></h2>${extra}</div>`; }

      function drawDate() {
        const d = A.parseYmd(sel);
        $('#hl-date').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 (${A.WD[d.getDay()]})`;
        el.querySelector('[data-act="next"]').disabled = sel >= A.today();
        el.querySelector('[data-act="today"]').hidden = isToday();
      }
      function drawWater() {
        const cfg = A.data.healthCfg, h = day(sel), w = h ? h.water || 0 : 0;
        const n = Math.max(cfg.waterGoal, w);
        const bars = A.lastDays(7, A.parseYmd(sel)).map(d => {
          const k = A.ymd(d), v = (A.data.health[k] || {}).water || 0;
          return { label: A.WD[d.getDay()], value: v, now: k === sel, tip: `${d.getMonth() + 1}/${d.getDate()} · ${v}잔` };
        });
        $('#hl-water').innerHTML = `
          ${head('drop', '물', `<label class="hl-goal">목표 <select class="input" data-cfg="waterGoal" aria-label="하루 목표">${[4, 5, 6, 7, 8, 9, 10, 12, 14, 16].map(v => `<option value="${v}" ${v === cfg.waterGoal ? 'selected' : ''}>${v}잔</option>`).join('')}</select></label>`)}
          <p class="hl-big"><b class="num">${w}</b> / ${cfg.waterGoal}잔 <span class="faint">${A.num(w * cfg.cupMl)}ml</span></p>
          <div class="cups" role="group" aria-label="마신 잔 수">${Array.from({ length: n }, (_, k) => `<button type="button" class="cup ${k < w ? 'on' : ''}" data-cup="${k}" aria-label="${k + 1}잔">${icon('drop', 22)}</button>`).join('')}</div>
          <div class="inline-form two rev"><button type="button" class="btn" data-act="w-" ${w ? '' : 'disabled'}>− 1잔</button><button type="button" class="btn primary" data-act="w+">+ 1잔 (${cfg.cupMl}ml)</button></div>
          ${A.miniBars(bars, { goal: cfg.waterGoal, label: '최근 7일 물' })}
          <label class="hl-opt"><input type="checkbox" data-cfg="waterRemind" ${cfg.waterRemind ? 'checked' : ''}> 덜 마신 날엔 2시간마다 알려 주기</label>`;
      }
      function drawMeal() {
        const h = day(sel) || { meals: {} };
        $('#hl-meal').innerHTML = `
          ${head('meal', '식사', '<button type="button" class="btn sm" data-act="menu">오늘 뭐 먹지?</button>')}
          ${menu ? `
            <div class="menu-pick">
              <div class="chips scroll">${['아무거나', ...Object.keys(MENU)].map(c => `<button type="button" class="chip ${c === menu.cat ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
              <p class="menu-item">${esc(menu.item)}</p>
              <div class="form-row" style="justify-content:center">
                <button type="button" class="btn" data-act="reroll">다른 메뉴</button>
                <button type="button" class="btn primary" data-act="menu-save">${MEALS.find(m => m[0] === mealSlot())[1]}으로 기록</button>
                <button type="button" class="btn ghost" data-act="menu-close">닫기</button>
              </div>
            </div>` : ''}
          <div class="form-grid" style="gap:8px">
            ${MEALS.map(([k, label]) => `<label class="meal-row"><span>${label}</span><input class="input" data-meal="${k}" value="${esc(h.meals[k] || '')}" placeholder="${{ breakfast: '예: 토스트, 커피', lunch: '예: 김치찌개', dinner: '예: 샐러드', snack: '예: 과일' }[k]}" autocomplete="off"></label>`).join('')}
          </div>`;
      }
      function drawWork() {
        const h = day(sel) || { workouts: [] };
        const total = h.workouts.reduce((s, w) => s + (w.min || 0), 0);
        const bars = A.lastDays(7, A.parseYmd(sel)).map(d => {
          const k = A.ymd(d), v = ((A.data.health[k] || {}).workouts || []).reduce((s, w) => s + (w.min || 0), 0);
          return { label: A.WD[d.getDay()], value: v, now: k === sel, tip: `${d.getMonth() + 1}/${d.getDate()} · ${v}분` };
        });
        $('#hl-work').innerHTML = `
          ${head('dumbbell', '운동', `<span class="faint num">${total ? `${total}분` : ''}</span>`)}
          <div class="chips">${WORKOUTS.map(([n, m]) => `<button type="button" class="chip" data-wk="${n}" data-min="${m}">${n} ${m}분</button>`).join('')}</div>
          <form class="inline-form" data-form="work">
            <input class="input" id="wk-text" placeholder="직접 적기 (예: 수영)" autocomplete="off" aria-label="운동 이름">
            <input class="input num" id="wk-min" type="number" min="1" max="600" inputmode="numeric" placeholder="분" style="width:76px" aria-label="시간(분)">
            <button type="submit" class="btn">${icon('plus', 16)}</button>
          </form>
          ${h.workouts.length ? `<ul style="margin-top:6px">${h.workouts.map(w => `<li class="list-row"><span class="grow">${esc(w.text)}</span><span class="num faint">${w.min}분</span><button type="button" class="icon-btn danger" data-act="wk-del" data-id="${w.id}" aria-label="${esc(w.text)} 지우기">${icon('x', 16)}</button></li>`).join('')}</ul>` : ''}
          ${A.miniBars(bars, { label: '최근 7일 운동 시간(분)' })}
          <a class="link-more" href="#timer">타이머로 시간 재기 ${icon('chevronR', 14)}</a>`;
      }
      function drawMed() {
        const meds = A.data.healthCfg.meds.slice().sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
        const h = day(sel) || { meds: {} };
        $('#hl-med').innerHTML = `
          ${head('pill', '약·영양제', meds.length ? `<span class="faint num">${meds.filter(m => h.meds[m.id]).length} / ${meds.length}</span>` : '')}
          ${meds.length ? `<ul>${meds.map(m => `
            <li class="list-row">
              <button type="button" class="check ${h.meds[m.id] ? 'on' : ''}" data-med="${m.id}" aria-pressed="${!!h.meds[m.id]}" aria-label="${esc(m.name)} 먹음">${icon('check', 14)}</button>
              <span class="grow">${esc(m.name)}</span>
              ${m.time ? `<span class="faint num" style="font-size:13px">${A.fmtHM(m.time)}</span>` : ''}
              <button type="button" class="icon-btn danger" data-act="med-del" data-id="${m.id}" aria-label="${esc(m.name)} 지우기">${icon('x', 16)}</button>
            </li>`).join('')}</ul>` : '<p class="empty-sm">매일 챙겨 먹는 약이나 영양제를 넣어 두세요.</p>'}
          <form class="inline-form" data-form="med">
            <input class="input" id="med-name" placeholder="예: 비타민D, 유산균" autocomplete="off" aria-label="이름">
            <input class="input" id="med-time" type="time" style="width:120px" aria-label="알림 시간">
            <button type="submit" class="btn">${icon('plus', 16)}</button>
          </form>
          <p class="faint" style="font-size:13px;margin-top:6px">시간을 적어 두면 그때 소리와 함께 알려 드려요.</p>`;
      }
      function drawWeight() {
        const h = day(sel), last = lastWeight(sel);
        const pts = A.lastDays(30, A.parseYmd(sel)).map(d => ({ d, v: (A.data.health[A.ymd(d)] || {}).weight || null })).filter(p => p.v);
        const prev = pts.length > 1 ? pts[0] : null;
        let chart = '';
        if (pts.length > 1) {
          const W = 300, H = 80, P = 6;
          const vs = pts.map(p => p.v), lo = Math.min(...vs) - 0.5, hi = Math.max(...vs) + 0.5;
          const t0 = A.addDays(A.parseYmd(sel), -29).getTime(), span = 29 * 86400000;
          const xy = pts.map(p => [P + (p.d.getTime() - t0) / span * (W - 2 * P), P + (1 - (p.v - lo) / (hi - lo)) * (H - 2 * P)]);
          chart = `<svg class="wline" viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 30일 체중">
            <polyline points="${xy.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
            ${xy.map((p, k) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="var(--accent)" stroke="var(--sheet)" stroke-width="2"><title>${pts[k].d.getMonth() + 1}/${pts[k].d.getDate()} · ${pts[k].v}kg</title></circle>`).join('')}
          </svg>
          <div class="mbars-x" style="--n:2;display:flex;justify-content:space-between"><span>30일 전</span><span>${isToday() ? '오늘' : A.relDay(sel)}</span></div>`;
        }
        const delta = prev && last ? Math.round((last.kg - prev.v) * 10) / 10 : null;
        $('#hl-weight').innerHTML = `
          ${head('scale', '체중')}
          <p class="hl-big">${last ? `<b class="num">${last.kg}</b> kg` : '<span class="faint">기록 없음</span>'} ${delta != null ? `<span class="faint">30일 사이 ${delta > 0 ? '+' : ''}${delta}kg</span>` : ''}</p>
          ${last && last.day !== sel ? `<p class="faint" style="font-size:13px">${A.relDay(last.day)} 기록</p>` : ''}
          <form class="inline-form two" data-form="weight">
            <input class="input num" id="wt-in" type="number" step="0.1" min="20" max="300" inputmode="decimal" value="${h && h.weight ? h.weight : ''}" placeholder="몸무게 (kg)" aria-label="몸무게">
            <button type="submit" class="btn">기록</button>
          </form>
          ${chart}`;
      }
      function drawSleep() {
        const S = A.sleepUtil;
        const box = $('#hl-sleep');
        if (!S) { box.hidden = true; return; }
        const s = S.forDay(sel);
        const week = A.lastDays(7, A.parseYmd(sel)).map(d => S.forDay(A.ymd(d))).filter(Boolean);
        const avg = week.length ? week.reduce((t, x) => t + (x.wake - x.bed), 0) / week.length : 0;
        box.innerHTML = `
          ${head('bed', '잠', `<a class="link-more" href="#sleep">잠 ${icon('chevronR', 14)}</a>`)}
          <p class="hl-big">${s ? `<b class="num">${S.durText(s.wake - s.bed)}</b>` : '<span class="faint">기록 없음</span>'}</p>
          ${s ? `<p class="faint" style="font-size:13px">${S.hm(s.bed)} 잠듦 → ${S.hm(s.wake)} 일어남</p>` : '<p class="faint" style="font-size:13px">잠 모드를 켜고 자면 자동으로 기록돼요.</p>'}
          ${week.length ? `<p style="margin-top:8px">최근 7일 평균 <b>${S.durText(avg)}</b> <span class="faint">(${week.length}일)</span></p>` : ''}`;
      }
      function drawAll() { drawDate(); drawWater(); drawMeal(); drawWork(); drawMed(); drawWeight(); drawSleep(); }

      el.addEventListener('click', e => {
        const cup = e.target.closest('[data-cup]');
        if (cup) {
          const k = Number(cup.dataset.cup) + 1, h = day(sel, true);
          h.water = h.water === k ? k - 1 : k; changed(); drawWater(); return;
        }
        const med = e.target.closest('[data-med]');
        if (med) { const h = day(sel); takeMed(med.dataset.med, sel, !(h && h.meds[med.dataset.med])); drawMed(); return; }
        const wk = e.target.closest('[data-wk]');
        if (wk) { day(sel, true).workouts.push({ id: A.uid(), text: wk.dataset.wk, min: Number(wk.dataset.min) }); changed(); drawWork(); A.toast(`${wk.dataset.wk} ${wk.dataset.min}분 기록했어요`); return; }
        const cat = e.target.closest('[data-cat]');
        if (cat) { menu = { cat: cat.dataset.cat, item: pick(cat.dataset.cat) }; drawMeal(); return; }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'prev') { sel = A.ymd(A.addDays(A.parseYmd(sel), -1)); drawAll(); }
        else if (act === 'next' && sel < A.today()) { sel = A.ymd(A.addDays(A.parseYmd(sel), 1)); drawAll(); }
        else if (act === 'today') { sel = A.today(); drawAll(); }
        else if (act === 'w+') { addWater(1, sel); drawWater(); }
        else if (act === 'w-') { addWater(-1, sel); drawWater(); }
        else if (act === 'menu') { menu = menu ? null : { cat: '아무거나', item: pick('아무거나') }; drawMeal(); }
        else if (act === 'reroll') { menu.item = pick(menu.cat, [menu.item]); drawMeal(); }
        else if (act === 'menu-close') { menu = null; drawMeal(); }
        else if (act === 'menu-save') {
          const slot = mealSlot(), h = day(sel, true);
          h.meals[slot] = h.meals[slot] ? `${h.meals[slot]}, ${menu.item}` : menu.item;
          changed(); menu = null; drawMeal();
          A.toast('식사에 기록했어요');
        } else if (act === 'wk-del') {
          const h = day(sel), i = h.workouts.findIndex(w => w.id === b.dataset.id);
          if (i >= 0) { const [g] = h.workouts.splice(i, 1); changed(); drawWork(); A.toast('지웠어요', { action: '되돌리기', onAction: () => { h.workouts.splice(i, 0, g); changed(); drawWork(); } }); }
        } else if (act === 'med-del') {
          const meds = A.data.healthCfg.meds, i = meds.findIndex(m => m.id === b.dataset.id);
          if (i >= 0) { const [g] = meds.splice(i, 1); A.save('healthCfg'); drawMed(); A.toast(`${g.name}을(를) 지웠어요`, { action: '되돌리기', onAction: () => { meds.splice(i, 0, g); A.save('healthCfg'); drawMed(); } }); }
        }
      });
      el.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.cfg === 'waterGoal') { A.data.healthCfg.waterGoal = Number(t.value); A.save('healthCfg'); drawWater(); }
        else if (t.dataset.cfg === 'waterRemind') { A.data.healthCfg.waterRemind = t.checked; A.save('healthCfg'); A.toast(t.checked ? '물 알림을 켰어요' : '물 알림을 껐어요'); }
        else if (t.dataset.meal) { const h = day(sel, true); const v = t.value.trim(); if (v) h.meals[t.dataset.meal] = v; else delete h.meals[t.dataset.meal]; changed(); }
      });
      el.addEventListener('submit', e => {
        const f = e.target.closest('[data-form]');
        if (!f) return;
        e.preventDefault();
        if (f.dataset.form === 'work') {
          const text = $('#wk-text').value.trim(), min = Math.round(Number($('#wk-min').value));
          if (!text || !(min > 0)) { A.toast('운동 이름과 시간(분)을 적어 주세요'); return; }
          day(sel, true).workouts.push({ id: A.uid(), text, min }); changed(); drawWork(); $('#wk-text').focus();
        } else if (f.dataset.form === 'med') {
          const name = $('#med-name').value.trim();
          if (!name) { $('#med-name').focus(); return; }
          A.data.healthCfg.meds.push({ id: A.uid(), name, time: $('#med-time').value || '' });
          A.save('healthCfg'); drawMed(); $('#med-name').focus();
        } else if (f.dataset.form === 'weight') {
          const v = Math.round(Number($('#wt-in').value) * 10) / 10;
          const h = day(sel, true);
          if (!v) { h.weight = null; changed(); drawWeight(); return; }
          if (v < 20 || v > 300) { A.toast('몸무게를 다시 확인해 주세요'); return; }
          h.weight = v; changed(); drawWeight(); A.toast(`${v}kg 기록했어요`);
        }
      });

      drawAll();
      const off = A.on('health:change', () => { const a = document.activeElement; if (!(a && el.contains(a) && a.matches('input:not([type=checkbox]), textarea'))) drawAll(); });
      return () => { off(); };
    }
  });
})();
