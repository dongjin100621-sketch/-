'use strict';
/* 홈: 시계, 날씨, 오늘 할 일, 일정·알람, 디데이, 습관, 지출, 빠른 메모 */
(function () {
  const A = App;
  const { esc, icon } = A;

  function greeting(h) {
    if (h < 5) return '늦은 밤이에요';
    if (h < 11) return '좋은 아침이에요';
    if (h < 17) return '좋은 오후예요';
    if (h < 21) return '좋은 저녁이에요';
    return '편안한 밤 보내세요';
  }

  /* ---------- 날씨 (Open-Meteo, 키 없이 사용) ---------- */
  const WMO = {
    0: ['맑음', 'sun'], 1: ['대체로 맑음', 'sun'], 2: ['구름 조금', 'partly'], 3: ['흐림', 'cloud'],
    45: ['안개', 'fog'], 48: ['안개', 'fog'],
    51: ['약한 이슬비', 'rain'], 53: ['이슬비', 'rain'], 55: ['강한 이슬비', 'rain'], 56: ['어는 이슬비', 'rain'], 57: ['어는 이슬비', 'rain'],
    61: ['약한 비', 'rain'], 63: ['비', 'rain'], 65: ['강한 비', 'rain'], 66: ['어는 비', 'rain'], 67: ['어는 비', 'rain'],
    71: ['약한 눈', 'snow'], 73: ['눈', 'snow'], 75: ['많은 눈', 'snow'], 77: ['싸락눈', 'snow'],
    80: ['소나기', 'rain'], 81: ['소나기', 'rain'], 82: ['강한 소나기', 'rain'], 85: ['소낙눈', 'snow'], 86: ['소낙눈', 'snow'],
    95: ['뇌우', 'storm'], 96: ['우박 동반 뇌우', 'storm'], 99: ['우박 동반 뇌우', 'storm']
  };
  const wmo = code => WMO[code] || ['알 수 없음', 'cloud'];
  const DEFAULT_CITY = { name: '서울', lat: 37.5665, lon: 126.978 };

  async function fetchJSON(url, ms = 8000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  async function searchCity(q) {
    const j = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=ko&format=json`);
    return (j.results || []).map(r => ({ name: r.name, lat: r.latitude, lon: r.longitude, region: [r.admin1, r.country].filter(Boolean).join(', ') }));
  }
  async function getWeather(force) {
    const city = A.data.prefs.city || DEFAULT_CITY;
    const key = `${city.lat},${city.lon}`;
    const cache = A.data.weather;
    if (!force && cache && cache.key === key && Date.now() - cache.at < 30 * 60 * 1000) return cache.data;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code' +
      '&hourly=temperature_2m,weather_code,precipitation_probability' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&timezone=auto&forecast_days=2';
    const d = await fetchJSON(url);
    A.data.weather = { key, at: Date.now(), data: d };
    A.save('weather');
    return d;
  }
  function weatherHTML(d) {
    const city = A.data.prefs.city || DEFAULT_CITY;
    const c = d.current;
    const [desc, ic] = wmo(c.weather_code);
    const hi = Math.round(d.daily.temperature_2m_max[0]);
    const lo = Math.round(d.daily.temperature_2m_min[0]);
    const pop = d.daily.precipitation_probability_max ? d.daily.precipitation_probability_max[0] : null;
    const curHour = String(c.time).slice(0, 13);
    let idx = d.hourly.time.findIndex(t => t.slice(0, 13) > curHour);
    if (idx < 0) idx = 0;
    const hours = d.hourly.time.slice(idx, idx + 6).map((t, i) => {
      const j = idx + i;
      return `<div><span>${Number(t.slice(11, 13))}시</span>${icon(wmo(d.hourly.weather_code[j])[1], 18)}<b>${Math.round(d.hourly.temperature_2m[j])}°</b></div>`;
    }).join('');
    return `
      <div class="weather-now">
        ${icon(ic, 40)}
        <span class="weather-temp">${Math.round(c.temperature_2m)}°</span>
        <div class="weather-desc"><strong>${esc(desc)}</strong><span class="muted">체감 ${Math.round(c.apparent_temperature)}°</span></div>
      </div>
      <div class="weather-meta">
        <span>최고 ${hi}° · 최저 ${lo}°</span>
        ${pop != null ? `<span>강수 ${pop}%</span>` : ''}
        <button type="button" class="weather-city" data-act="city" title="지역 바꾸기">${esc(city.name)}</button>
      </div>
      <div class="hours" aria-label="시간별 예보">${hours}</div>`;
  }
  function drawWeather(box, force) {
    if (!box) return;
    const city = A.data.prefs.city || DEFAULT_CITY;
    if (!A.data.weather) box.innerHTML = `<div class="weather-meta">${esc(city.name)} 날씨를 불러오는 중…</div>`;
    getWeather(force).then(d => {
      if (box.isConnected) box.innerHTML = weatherHTML(d);
    }).catch(() => {
      if (!box.isConnected) return;
      const cache = A.data.weather;
      if (cache && cache.data && cache.key === `${city.lat},${city.lon}`) {
        box.innerHTML = weatherHTML(cache.data) + '<div class="weather-meta faint">최근에 받아 둔 날씨예요</div>';
        return;
      }
      box.innerHTML = `
        <div class="weather-meta">${icon('cloud', 18)} 날씨를 불러오지 못했어요.</div>
        <div class="weather-meta"><button type="button" class="weather-city" data-act="retry">다시 시도</button><button type="button" class="weather-city" data-act="city">${esc(city.name)}</button></div>`;
    });
  }
  function openCityPicker(onDone) {
    const m = A.modal({
      title: '날씨 지역',
      body: `
        <form class="form-grid" id="city-form">
          <div class="form-row">
            <label class="field grow"><span>도시 이름</span><input class="input" id="city-q" placeholder="예: 부산, 제주, 수원" autocomplete="off" required></label>
            <button class="btn primary" type="submit">검색</button>
          </div>
          <div id="city-results" class="muted">도시나 구 이름으로 찾아보세요.</div>
        </form>`,
      onMount(el) {
        const form = el.querySelector('#city-form');
        const out = el.querySelector('#city-results');
        let results = [];
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const q = el.querySelector('#city-q').value.trim();
          if (!q) return;
          out.textContent = '찾는 중…';
          try {
            results = await searchCity(q);
            out.innerHTML = results.length
              ? results.map((r, i) => `<div class="list-row"><div class="grow"><strong>${esc(r.name)}</strong> <span class="faint">${esc(r.region)}</span></div><button type="button" class="btn sm" data-pick="${i}">선택</button></div>`).join('')
              : '찾는 지역이 없어요. 다른 이름으로 검색해 보세요.';
          } catch (err) {
            out.textContent = '검색하지 못했어요. 인터넷 연결을 확인하고 다시 시도하세요.';
          }
        });
        out.addEventListener('click', e => {
          const b = e.target.closest('[data-pick]');
          if (!b) return;
          const r = results[Number(b.dataset.pick)];
          A.data.prefs.city = { name: r.name, lat: r.lat, lon: r.lon };
          A.save('prefs');
          A.data.weather = null;
          A.save('weather');
          m.close();
          A.toast(`${r.name} 날씨로 바꿨어요`);
          onDone && onDone();
        });
      }
    });
  }
  A.weather = { openCityPicker, DEFAULT_CITY };

  /* ---------- 홈 화면 ---------- */
  A.register({
    id: 'home', label: '홈', icon: 'home',
    render(el) {
      el.innerHTML = `
        <div class="page">
          <section class="hero">
            <div class="hero-main">
              <p class="greet" id="h-greet"></p>
              <div class="clock" aria-live="off"><span class="ampm" id="h-ampm"></span><span id="h-hm"></span><span class="sec" id="h-sec"></span></div>
              <p class="date-line" id="h-date"></p>
            </div>
            <div class="weather" id="h-weather"></div>
          </section>
          <div id="h-sample"></div>
          <section class="widgets">
            <article class="panel" id="w-todo"></article>
            <article class="panel" id="w-plan"></article>
            <article class="panel" id="w-money"></article>
            <article class="panel" id="w-habit"></article>
            <article class="panel" id="w-dday"></article>
            <article class="panel" id="w-memo"></article>
          </section>
        </div>`;
      const $ = s => el.querySelector(s);
      let lastMinute = -1, lastDay = '';

      function drawClock(now) {
        const c = A.fmtClock(now);
        $('#h-ampm').textContent = c.ampm;
        $('#h-hm').textContent = c.hm;
        $('#h-sec').textContent = A.pad(now.getSeconds());
        if (now.getMinutes() !== lastMinute) {
          lastMinute = now.getMinutes();
          const name = A.data.prefs.name ? `, ${A.data.prefs.name}님` : '';
          $('#h-greet').textContent = greeting(now.getHours()) + name;
          drawPlan();
        }
        const day = A.ymd(now);
        if (day !== lastDay) {
          const first = !lastDay;
          lastDay = day;
          const hol = A.holidays ? A.holidays.nameOf(day) : '';
          const lun = A.lunar(now);
          $('#h-date').innerHTML = `<span>${A.fmtDate(now)}</span>${hol ? `<span class="tag red">${esc(hol)}</span>` : ''}${lun ? `<span class="faint">${lun}</span>` : ''}`;
          if (!first) drawAll();
        }
      }

      /* 예시 안내 */
      function drawSample() {
        const box = $('#h-sample');
        const has = A.hasSamples && A.hasSamples();
        if (!has || A.data.ui.hideSampleBanner) { box.innerHTML = ''; return; }
        box.innerHTML = `
          <div class="notice blue sample-banner">
            ${icon('sparkle', 18)}
            <span class="grow">처음 보이는 메모·할 일·가계부 등의 항목은 사용법을 보여 주는 예시예요.</span>
            <span class="banner-actions">
              <button type="button" class="btn sm" data-act="clear-samples">예시 지우기</button>
              <button type="button" class="btn sm ghost" data-act="hide-banner">닫기</button>
            </span>
          </div>`;
      }

      /* 오늘 할 일 */
      function drawTodo() {
        const box = $('#w-todo');
        const t = A.today();
        const firstList = A.data.todoLists[0].id;
        const list = A.data.todos.filter(x => !x.done && (x.due ? x.due <= t : x.listId === firstList)).sort(A.todoUtil.compare);
        const shown = list.slice(0, 6);
        box.innerHTML = `
          <div class="panel-head"><h2 class="panel-title"><a href="#todo">오늘 할 일</a></h2><span class="faint num">${list.length ? `남은 일 ${list.length}개` : ''}</span></div>
          ${shown.length ? `<ul>${shown.map(x => `
            <li class="list-row">
              <button type="button" class="check" data-act="todo-toggle" data-id="${x.id}" aria-label="완료 표시">${icon('check', 14)}</button>
              <span class="grow">${esc(x.text)}</span>
              ${x.due && x.due < t ? '<span class="tag red">지남</span>' : ''}
              ${x.priority ? '<span class="tag red">중요</span>' : ''}
            </li>`).join('')}</ul>` : '<p class="empty-sm">오늘 할 일을 모두 끝냈어요.</p>'}
          ${list.length > shown.length ? `<a class="link-more" href="#todo">${list.length - shown.length}개 더 보기 ${icon('chevronR', 14)}</a>` : ''}
          <form class="quick-add" data-form="todo">
            <input class="input" id="h-todo-in" placeholder="오늘 할 일 추가" autocomplete="off" aria-label="오늘 할 일 추가">
            <button class="btn" type="submit" aria-label="추가">${icon('plus', 18)}</button>
          </form>`;
      }

      /* 일정과 알람 */
      function drawPlan() {
        const box = $('#w-plan');
        if (!box) return;
        const t = A.today();
        const evs = A.calUtil.eventsOn(t);
        const next = A.alarmUtil ? A.alarmUtil.nextAlarm() : null;
        const timer = A.timerUtil ? A.timerUtil.summary() : '';
        box.innerHTML = `
          <div class="panel-head"><h2 class="panel-title"><a href="#calendar">오늘 일정</a></h2><a class="link-more" href="#calendar">캘린더 ${icon('chevronR', 14)}</a></div>
          ${evs.length ? `<ul>${evs.map(e => `
            <li class="list-row"><span class="ev-time">${e.time ? A.fmtHM(e.time) : '하루 종일'}</span><span class="grow">${esc(e.title)}</span></li>`).join('')}</ul>`
          : '<p class="empty-sm">오늘 잡힌 일정이 없어요.</p>'}
          <a class="next-alarm" href="#alarm" style="text-decoration:none;color:inherit">
            ${icon('alarm', 22)}
            <span class="grow">${next
              ? `<strong>${A.fmtHM(next.alarm.time)}</strong> ${esc(next.alarm.label || '알람')}<br><span class="faint">${A.untilText(next.at - Date.now())}</span>`
              : '<span class="muted">켜 둔 알람이 없어요</span>'}</span>
          </a>
          ${timer ? `<a class="next-alarm" href="#timer" style="text-decoration:none;color:inherit">${icon('timer', 22)}<span class="grow">${esc(timer)}</span></a>` : ''}`;
      }

      /* 이번 달 지출 */
      function drawMoney() {
        const box = $('#w-money');
        const now = new Date();
        const ym = A.ymd(now).slice(0, 7);
        const monthTx = A.data.txs.filter(x => x.date.startsWith(ym));
        const out = monthTx.filter(x => x.type === 'out').reduce((s, x) => s + x.amount, 0);
        const todayOut = monthTx.filter(x => x.type === 'out' && x.date === A.today()).reduce((s, x) => s + x.amount, 0);
        const budget = A.data.budget || 0;
        const pct = budget ? Math.min(100, Math.round(out / budget * 100)) : 0;
        const recent = [...A.data.txs].sort((a, b) => (b.date + b.created).localeCompare(a.date + a.created)).slice(0, 3);
        box.innerHTML = `
          <div class="panel-head"><h2 class="panel-title"><a href="#budget">${now.getMonth() + 1}월 지출</a></h2><span class="faint">오늘 ${A.won(todayOut)}</span></div>
          <p class="big-number">${A.won(out)}</p>
          ${budget ? `
            <div class="bar ${out > budget ? 'over' : pct >= 80 ? 'warn' : ''}" style="margin-top:8px"><i style="width:${pct}%"></i></div>
            <p class="faint" style="font-size:13px;margin-top:4px">예산 ${A.won(budget)} 중 ${pct}% · ${out > budget ? `${A.won(out - budget)} 초과` : `${A.won(budget - out)} 남음`}</p>` : '<p class="faint" style="font-size:13px">가계부에서 한 달 예산을 정할 수 있어요.</p>'}
          ${recent.length ? `<ul style="margin-top:6px">${recent.map(x => `
            <li class="list-row"><span class="tag">${esc(x.category)}</span><span class="grow ellipsis">${esc(x.memo || x.category)}</span><span class="tx-amt ${x.type}">${x.type === 'in' ? '+' : '-'}${A.num(x.amount)}</span></li>`).join('')}</ul>` : ''}
          <form class="quick-add" data-form="money">
            <input class="input" id="h-money-in" placeholder="예: 점심 김치찌개 9000" autocomplete="off" aria-label="지출 빠르게 기록">
            <button class="btn" type="submit" aria-label="기록">${icon('plus', 18)}</button>
          </form>`;
      }

      /* 습관 */
      function drawHabit() {
        const box = $('#w-habit');
        const t = A.today();
        const hs = A.data.habits;
        const done = hs.filter(h => h.log && h.log[t]).length;
        box.innerHTML = `
          <div class="panel-head"><h2 class="panel-title"><a href="#habits">오늘의 습관</a></h2><span class="faint num">${hs.length ? `${done} / ${hs.length}` : ''}</span></div>
          ${hs.length ? `<div class="habit-pills">${hs.map(h => {
            const on = !!(h.log && h.log[t]);
            const st = A.habitUtil.streak(h);
            return `<button type="button" class="habit-pill ${on ? 'on' : ''}" data-act="habit" data-id="${h.id}" aria-pressed="${on}">
              <span class="check ${on ? 'on' : ''}">${icon('check', 12)}</span>${esc(h.name)}${st ? `<small>${st}일</small>` : ''}</button>`;
          }).join('')}</div>` : `<p class="empty-sm">아직 습관이 없어요. <a href="#habits">습관 만들기</a></p>`}`;
      }

      /* 디데이 */
      function ddText(date) {
        const n = A.diffDays(new Date(), A.parseYmd(date));
        if (n === 0) return { t: 'D-Day', cls: 'today' };
        return n > 0 ? { t: `D-${n}`, cls: '' } : { t: `D+${-n}`, cls: 'past' };
      }
      let ddayForm = false;
      function drawDday() {
        const box = $('#w-dday');
        const t = A.today();
        const list = [...A.data.ddays].sort((a, b) => {
          const pa = a.date < t, pb = b.date < t;
          if (pa !== pb) return pa ? 1 : -1;
          return pa ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
        });
        box.innerHTML = `
          <div class="panel-head"><h2 class="panel-title">디데이</h2><button type="button" class="icon-btn" data-act="dday-form" aria-label="디데이 추가">${icon(ddayForm ? 'x' : 'plus', 18)}</button></div>
          ${ddayForm ? `
            <form class="form-grid" data-form="dday" style="margin-bottom:8px">
              <input class="input" id="h-dd-title" placeholder="예: 여름휴가, 시험, 기념일" required autocomplete="off" aria-label="디데이 이름">
              <div class="form-row"><input class="input grow" type="date" id="h-dd-date" required aria-label="날짜"><button class="btn primary" type="submit">추가</button></div>
            </form>` : ''}
          ${list.length ? `<ul>${list.map(d => {
            const x = ddText(d.date);
            const dt = A.parseYmd(d.date);
            return `<li class="dday-row"><span class="dday-num ${x.cls}">${x.t}</span><span class="grow" style="flex:1;min-width:0"><span class="ellipsis" style="display:block">${esc(d.title)}</span><span class="faint" style="font-size:12px">${dt.getFullYear()}. ${dt.getMonth() + 1}. ${dt.getDate()}. (${A.WD[dt.getDay()]})</span></span><button type="button" class="icon-btn danger" data-act="dday-del" data-id="${d.id}" aria-label="${esc(d.title)} 지우기">${icon('trash', 16)}</button></li>`;
          }).join('')}</ul>` : (ddayForm ? '' : '<p class="empty-sm">시험, 여행, 기념일까지 남은 날을 세어 보세요.</p>')}`;
        if (ddayForm) { const i = box.querySelector('#h-dd-title'); i && i.focus(); }
      }

      /* 빠른 메모 */
      function drawMemo() {
        const box = $('#w-memo');
        const recent = [...A.data.notes].sort((a, b) => b.updated - a.updated).slice(0, 3);
        box.innerHTML = `
          <div class="panel-head"><h2 class="panel-title"><a href="#notes">빠른 메모</a></h2><a class="link-more" href="#notes">전체 ${A.data.notes.length}개 ${icon('chevronR', 14)}</a></div>
          <form data-form="memo" class="form-grid" style="gap:8px">
            <textarea class="input" id="h-memo-in" rows="3" placeholder="떠오른 생각을 적어 두세요. 첫 줄이 제목이 돼요." aria-label="빠른 메모"></textarea>
            <div style="display:flex;justify-content:flex-end"><button class="btn sm primary" type="submit">메모로 저장</button></div>
          </form>
          ${recent.length ? `<ul style="margin-top:4px">${recent.map(n => `
            <li class="list-row" style="cursor:pointer" data-act="open-note" data-id="${n.id}"><span class="dot ${n.color && n.color !== 'none' ? n.color : ''}"></span><span class="grow ellipsis">${esc(n.title || A.notesUtil.firstLine(n.body) || '제목 없음')}</span><span class="faint" style="font-size:12px">${A.relTime(n.updated)}</span></li>`).join('')}</ul>` : ''}`;
      }

      function drawAll() {
        drawSample(); drawTodo(); drawPlan(); drawMoney(); drawHabit(); drawDday(); drawMemo();
      }

      /* 이벤트 */
      el.addEventListener('click', async e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act, id = b.dataset.id;
        if (act === 'todo-toggle') {
          const x = A.data.todos.find(t => t.id === id);
          if (x) {
            x.done = true; x.doneAt = Date.now(); A.save('todos');
            b.classList.add('on');
            setTimeout(drawTodo, 260);
            A.toast('완료했어요', { action: '되돌리기', onAction: () => { x.done = false; A.save('todos'); drawTodo(); } });
          }
        } else if (act === 'habit') {
          A.habitUtil.toggle(id, A.today());
          drawHabit();
        } else if (act === 'dday-form') {
          ddayForm = !ddayForm; drawDday();
        } else if (act === 'dday-del') {
          const i = A.data.ddays.findIndex(d => d.id === id);
          if (i >= 0) {
            const [gone] = A.data.ddays.splice(i, 1); A.save('ddays'); drawDday();
            A.toast('디데이를 지웠어요', { action: '되돌리기', onAction: () => { A.data.ddays.splice(i, 0, gone); A.save('ddays'); drawDday(); } });
          }
        } else if (act === 'open-note') {
          A.data.ui.noteSel = id; A.save('ui'); A.go('notes');
        } else if (act === 'city') {
          openCityPicker(() => drawWeather($('#h-weather'), true));
        } else if (act === 'retry') {
          drawWeather($('#h-weather'), true);
        } else if (act === 'clear-samples') {
          const ok = await A.confirm('예시로 넣어 둔 메모, 할 일, 일정, 알람, 가계부, 습관, 디데이를 지울까요? 직접 만든 항목은 그대로 남아요.', { title: '예시 지우기', ok: '지우기', danger: true });
          if (ok) { A.clearSamples(); drawAll(); A.toast('예시 항목을 지웠어요'); }
        } else if (act === 'hide-banner') {
          A.data.ui.hideSampleBanner = true; A.save('ui'); drawSample();
        }
      });
      el.addEventListener('submit', e => {
        const f = e.target.closest('[data-form]');
        if (!f) return;
        e.preventDefault();
        const kind = f.dataset.form;
        if (kind === 'todo') {
          const inp = f.querySelector('input');
          const text = inp.value.trim();
          if (!text) return;
          A.todoUtil.add({ text, due: A.today() });
          drawTodo();
          $('#h-todo-in').focus();
        } else if (kind === 'money') {
          const inp = f.querySelector('input');
          const parsed = A.budgetUtil.parseQuick(inp.value);
          if (!parsed) { A.toast('금액을 찾지 못했어요. "점심 9000"처럼 적어 주세요.'); return; }
          const tx = A.budgetUtil.add(parsed);
          drawMoney();
          $('#h-money-in').focus();
          A.toast(`${tx.category} · ${A.won(tx.amount)} ${tx.type === 'in' ? '수입으로' : '지출로'} 기록했어요`);
        } else if (kind === 'dday') {
          const title = f.querySelector('#h-dd-title').value.trim();
          const date = f.querySelector('#h-dd-date').value;
          if (!title || !date) return;
          A.data.ddays.push({ id: A.uid(), title, date });
          A.save('ddays');
          ddayForm = false;
          drawDday();
        } else if (kind === 'memo') {
          const ta = f.querySelector('textarea');
          const text = ta.value.trim();
          if (!text) { ta.focus(); return; }
          A.notesUtil.create(text);
          ta.value = '';
          drawMemo();
          A.toast('메모로 저장했어요');
        }
      });

      drawClock(new Date());
      drawAll();
      drawWeather($('#h-weather'));
      const offTick = A.on('tick', drawClock);
      const offTimer = A.on('timer:change', drawPlan);
      const weatherTimer = setInterval(() => drawWeather($('#h-weather')), 30 * 60 * 1000);
      return () => { offTick(); offTimer(); clearInterval(weatherTimer); };
    }
  });
})();
