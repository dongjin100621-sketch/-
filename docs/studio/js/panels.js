'use strict';
/* 믹서(음량·EQ·앰프·컴프·이펙트)와 배우기(소리의 크기·박자·화성·리듬) */
(function (S) {
  const T = S.theory, SG = S.song, A = S.audio, app = S.app;
  const { PPQ, BAR } = T;
  const $ = (id) => document.getElementById(id);
  const esc = app.esc;

  /* ================= 믹서 ================= */
  const pct = (v) => Math.round(v * 100) + '%';
  const db = (v) => (v > 0 ? '+' : '') + (+v).toFixed(1) + ' dB';
  const hz = (v) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + ' kHz' : Math.round(v) + ' Hz');
  const panTxt = (v) => (Math.abs(v) < 0.03 ? '가운데' : (v < 0 ? '왼 ' : '오른 ') + Math.round(Math.abs(v) * 100));
  // 트랙 조절기: 경로, 이름, 최소, 최대, 칸, 표시, 로그(주파수)
  const TRACK_CTRL = [
    ['sec', '앰프'],
    ['amp.type', '종류', 'select'],
    ['amp.drive', '드라이브', 0, 1, 0.01, pct],
    ['amp.tone', '톤(밝기)', 0, 1, 0.01, pct],
    ['sec', 'EQ'],
    ['eq.hp', '저역 컷', 20, 1000, 0, hz, true],
    ['eq.low', '저음 (120Hz)', -15, 15, 0.5, db],
    ['eq.mid', '중음', -15, 15, 0.5, db],
    ['eq.midF', '중음 주파수', 200, 8000, 0, hz, true],
    ['eq.high', '고음 (7kHz)', -15, 15, 0.5, db],
    ['sec', '다이내믹·공간'],
    ['comp', '컴프레서', 0, 1, 0.01, pct],
    ['rev', '리버브 보내기', 0, 1, 0.01, pct],
    ['dly', '딜레이 보내기', 0, 1, 0.01, pct],
    ['pan', '좌우(팬)', -1, 1, 0.05, panTxt],
    ['vol', '음량', 0, 1.2, 0.01, pct],
  ];
  const MASTER_CTRL = [
    ['sec', '마스터 EQ'],
    ['mix.low', '저음 (110Hz)', -12, 12, 0.5, db],
    ['mix.mid', '중음 (1kHz)', -12, 12, 0.5, db],
    ['mix.high', '고음 (8kHz)', -12, 12, 0.5, db],
    ['sec', '다이내믹'],
    ['mix.comp', '버스 컴프', 0, 1, 0.01, pct],
    ['mix.limit', '리미터 (-1 dB에서 막기)', 'check'],
    ['sec', '공간'],
    ['mix.revLevel', '리버브 양', 0, 1.5, 0.01, pct],
    ['mix.dlyDiv', '딜레이 박자', 'div'],
    ['mix.dlyFb', '딜레이 되울림', 0, 0.85, 0.01, pct],
    ['sec', '출력'],
    ['master', '전체 음량', 0, 1.2, 0.01, pct],
  ];
  const DIV_NAMES = { '1/16': '16분', '1/8': '8분', '3/16': '점8분', '1/4': '4분', '3/8': '점4분', '1/2': '2분' };
  const getp = (o, path) => path.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const setpth = (o, path, v) => { const ks = path.split('.'); const last = ks.pop(); const tgt = ks.reduce((x, k) => x[k], o); tgt[last] = v; };
  const toSlider = (c, v) => (c[6] ? Math.round(1000 * Math.log(v / c[2]) / Math.log(c[3] / c[2])) : v);
  const fromSlider = (c, x) => (c[6] ? Math.round(c[2] * Math.pow(c[3] / c[2], x / 1000)) : +x);

  function ctrlHtml(c, obj, scope) {
    if (c[0] === 'sec') return `<div class="st-sec">${c[1]}</div>`;
    const [path, label, kind] = c;
    const v = getp(obj, path);
    const id = `mx-${scope}-${path.replace('.', '-')}`;
    if (kind === 'select') {
      return `<label class="st-row"><span>${label}</span><select id="${id}" data-k="${path}">${Object.entries(A.AMPS).map(([k, a]) => `<option value="${k}"${k === v ? ' selected' : ''}>${a.name}</option>`).join('')}</select></label>`;
    }
    if (kind === 'div') {
      return `<label class="st-row"><span>${label}</span><select id="${id}" data-k="${path}">${Object.entries(DIV_NAMES).map(([k, n]) => `<option value="${k}"${k === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`;
    }
    if (kind === 'check') return `<label class="st-row chk"><input type="checkbox" id="${id}" data-k="${path}"${v ? ' checked' : ''}> ${label}</label>`;
    const [, , min, max, step, fmt, log] = c;
    return `<label class="st-row"><span>${label} <output>${fmt(v)}</output></span>
      <input type="range" id="${id}" data-k="${path}" min="${log ? 0 : min}" max="${log ? 1000 : max}" step="${log ? 1 : step}" value="${toSlider(c, v)}"></label>`;
  }
  const findCtrl = (path, master) => (master ? MASTER_CTRL : TRACK_CTRL).find((c) => c[0] === path);

  const AMP_SUGGEST = { egtr_clean: 'clean', egtr_drive: 'crunch', heavy: 'lead', muted: 'crunch', fbass: 'bass', slap: 'bass', upright: 'bass', epiano: 'tube', wurli: 'tube', organ: 'crunch', clav: 'crunch' };

  function renderMixer() {
    const s = app.song;
    const strips = s.tracks.map((tr) => {
      const inst = tr.type === 'drums' ? SG.KITS[tr.inst] : (SG.INSTRUMENTS[tr.inst] || {}).name;
      const sug = AMP_SUGGEST[tr.inst] && tr.amp.type === 'none' ? `<button type="button" class="mini" data-act="suggest">추천 앰프: ${A.AMPS[AMP_SUGGEST[tr.inst]].name}</button>` : '';
      return `<section class="strip${tr.id === app.track.id ? ' on' : ''}" data-id="${tr.id}" style="--c:${tr.color}">
        <header><span class="sw"></span><b>${esc(tr.name)}</b><small>${esc(inst || '')}</small></header>
        <div class="st-top"><canvas class="st-meter" width="120" height="10"></canvas>
          <button type="button" class="mute" data-act="mute" aria-pressed="${tr.mute}">M</button><button type="button" class="solo" data-act="solo" aria-pressed="${tr.solo}">S</button></div>
        ${sug}
        ${TRACK_CTRL.map((c) => ctrlHtml(c, tr, tr.id)).join('')}
        <button type="button" class="mini" data-act="reset">이 트랙 처음 값으로</button>
      </section>`;
    }).join('');
    const master = `<section class="strip master" data-id="master" style="--c:var(--accent)">
      <header><span class="sw"></span><b>마스터</b><small>모든 트랙이 모이는 곳</small></header>
      <div class="st-top"><canvas class="st-meter" width="120" height="10"></canvas></div>
      ${MASTER_CTRL.map((c) => ctrlHtml(c, s, 'master')).join('')}
      <button type="button" class="mini" data-act="reset">마스터 처음 값으로</button>
    </section>`;
    $('mixStrips').innerHTML = strips + master;
    $('mixPlay').innerHTML = app.icon(app.player.playing ? 'pause' : 'play');
  }
  function stripTarget(el) {
    const st = el.closest('.strip'); if (!st) return null;
    return st.dataset.id === 'master' ? { master: true, obj: app.song } : { master: false, obj: app.song.tracks.find((t) => t.id === st.dataset.id) };
  }
  $('mixStrips').addEventListener('input', (e) => {
    const k = e.target.dataset.k; if (!k) return;
    const tg = stripTarget(e.target); if (!tg || !tg.obj) return;
    const c = findCtrl(k, tg.master);
    let v;
    if (e.target.type === 'checkbox') v = e.target.checked;
    else if (e.target.tagName === 'SELECT') v = e.target.value;
    else v = fromSlider(c, e.target.value);
    setpth(tg.obj, k, v);
    const out = e.target.closest('.st-row').querySelector('output');
    if (out && c[5]) out.textContent = c[5](v);
    app.refreshAudio();
  });
  $('mixStrips').addEventListener('change', (e) => {
    if (!e.target.dataset.k) return;
    app.commit('믹서');
    if (e.target.dataset.k === 'amp.type') renderMixer();
  });
  $('mixStrips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const tg = stripTarget(b); if (!tg || !tg.obj) return;
    const tr = tg.obj;
    if (b.dataset.act === 'mute') tr.mute = !tr.mute;
    else if (b.dataset.act === 'solo') tr.solo = !tr.solo;
    else if (b.dataset.act === 'suggest') { tr.amp.type = AMP_SUGGEST[tr.inst]; tr.amp.drive = tr.amp.type === 'lead' ? 0.7 : 0.5; }
    else if (b.dataset.act === 'reset') {
      if (tg.master) { tr.mix = SG.defaultMix(); tr.master = 0.85; }
      else { tr.eq = SG.defaultEq(); tr.amp = { type: 'none', drive: 0.5, tone: 0.5 }; tr.comp = 0; tr.dly = 0; tr.rev = 0.2; tr.pan = 0; tr.vol = 0.8; }
    }
    app.commit('믹서'); app.refreshAudio(); renderMixer();
  });
  $('mixStrips').addEventListener('dblclick', (e) => {
    // 조절기를 두 번 누르면 기본값으로
    const inp = e.target.closest('input[type="range"]'); if (!inp) return;
    const tg = stripTarget(inp); if (!tg) return;
    const k = inp.dataset.k;
    const defs = { 'eq.hp': 20, 'eq.low': 0, 'eq.mid': 0, 'eq.midF': 1000, 'eq.high': 0, 'amp.drive': 0.5, 'amp.tone': 0.5, comp: 0, rev: 0.2, dly: 0, pan: 0, vol: 0.8,
      'mix.low': 0, 'mix.mid': 0, 'mix.high': 0, 'mix.comp': 0.4, 'mix.revLevel': 0.7, 'mix.dlyFb': 0.35, master: 0.85 };
    if (defs[k] == null) return;
    setpth(tg.obj, k, defs[k]); app.commit('믹서'); app.refreshAudio(); renderMixer();
  });
  $('mixPlay').onclick = () => { $('btnPlay').click(); setTimeout(renderMixer, 30); };
  $('btnMixer').onclick = () => { app.audio(); renderMixer(); $('dlgMixer').showModal(); meterLoop(); };

  function meterLoop() {
    const dlg = $('dlgMixer');
    if (!dlg.open) return;
    const ses = app.player.session || app.preview;
    const css = getComputedStyle(document.documentElement);
    const ok = css.getPropertyValue('--good').trim() || '#6fd08c', hot = css.getPropertyValue('--rec').trim() || '#ef4b5f', bg = css.getPropertyValue('--panel-3').trim();
    const buf = new Float32Array(512);
    dlg.querySelectorAll('.strip').forEach((st) => {
      const cv = st.querySelector('.st-meter'); if (!cv) return;
      let an = null;
      if (st.dataset.id === 'master') an = app.engine && app.engine.analyse();
      else if (ses) { const tr = app.song.tracks.find((t) => t.id === st.dataset.id); if (tr) an = ses.meter(tr); }
      let pk = 0;
      if (an) { an.getFloatTimeDomainData(buf.subarray(0, an.fftSize)); for (let i = 0; i < an.fftSize; i++) pk = Math.max(pk, Math.abs(buf[i])); }
      const prev = +(cv.dataset.pk || 0); pk = Math.max(pk, prev * 0.9); cv.dataset.pk = pk;
      const g = cv.getContext('2d'), W = cv.width, H = cv.height;
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const dbv = pk > 0 ? 20 * Math.log10(pk) : -60;
      const w = Math.max(0, Math.min(1, (dbv + 48) / 48));
      g.fillStyle = dbv > -1.5 ? hot : ok; g.fillRect(0, 0, W * w, H);
      g.fillStyle = 'rgba(128,128,128,.6)'; g.fillRect(W * (42 / 48), 0, 1, H); // -6 dB 눈금
    });
    requestAnimationFrame(meterLoop);
  }

  /* ================= 배우기 ================= */
  let demo = null;
  /** 짧은 예시를 들려준다. evs: {t(틱), d(틱), p, v, drum} */
  function playDemo(evs, inst = 'piano', bpm = app.song.bpm) {
    const eng = app.audio();
    if (demo) demo.stop();
    demo = new A.Session(eng);
    const tr = { id: 'demo', type: 'synth', inst, vol: 0.85, pan: 0, rev: 0.15, dly: 0, comp: 0, eq: SG.defaultEq(), amp: { type: 'none', drive: 0.5, tone: 0.5 } };
    const now = app.ctx.currentTime;
    const c = demo.applyTrack(tr, true, now);
    eng.applyMaster(app.song, now);
    const spt = 60 / bpm / PPQ, t0 = now + 0.06;
    for (const e of evs) {
      const t = t0 + e.t * spt;
      if (e.drum) A.drumHit(eng, c.input, 'std', e.p, t, e.v == null ? 0.8 : e.v);
      else A.synthVoice(eng, c.input, inst, t, e.p, (e.d || PPQ) * spt, e.v == null ? 0.75 : e.v);
    }
  }
  const chordEvs = (ch, t, d, v = 0.65) => CPvoice(ch).map((p) => ({ t, d, p, v }));
  const CPvoice = (ch) => S.compose.voice(ch, null);
  const ROW = Object.fromEntries(SG.DRUMS.map((d, i) => [d.id, i]));

  let tab = 'dyn';
  const tapTimes = [];
  function setTab(t) {
    tab = t;
    $('learnTabs').querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    $('learnBody').innerHTML = ({ dyn: learnDyn, time: learnTime, harm: learnHarm, rhy: learnRhy })[t]();
    $('learnBody').scrollTop = 0;
  }
  $('learnTabs').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); };
  $('btnLearn').onclick = () => { setTab(tab); $('dlgLearn').showModal(); };
  const play = (act, arg, label = '▶') => `<button type="button" class="mini" data-lx="${act}" data-arg="${esc(arg)}">${label}</button>`;

  /* --- 소리의 크기 --- */
  const DYN = [['ppp', '피아니시시모', '아주아주 여리게', 16], ['pp', '피아니시모', '아주 여리게', 33], ['p', '피아노', '여리게', 49], ['mp', '메조피아노', '조금 여리게', 64],
    ['mf', '메조포르테', '조금 세게', 80], ['f', '포르테', '세게', 96], ['ff', '포르티시모', '아주 세게', 112], ['fff', '포르티시시모', '아주아주 세게', 127]];
  function learnDyn() {
    return `
      <section><h3>셈여림: 음표 하나하나의 세기</h3>
        <p>악보의 셈여림 기호는 이 앱에서 음표의 <b>세기(벨로시티, 1~127)</b>로 바뀝니다. 세기가 크면 소리가 커질 뿐 아니라 대부분의 악기가 더 밝고 단단해집니다. <b>보기 → 세기 레인</b>을 켜면 음표마다 세기를 끌어서 바꿀 수 있어요.</p>
        <div class="tbl"><table><thead><tr><th>기호</th><th>읽기</th><th>뜻</th><th>세기</th><th></th></tr></thead><tbody>
        ${DYN.map(([s, r, m, v]) => `<tr><td><i class="dyn">${s}</i></td><td>${r}</td><td>${m}</td><td class="num">${v}</td><td>${play('dyn', v)}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="row-btns">${play('cresc', 1, '▶ 크레셴도 (점점 세게 <)')} ${play('cresc', 0, '▶ 디크레셴도 (점점 여리게 >)')} ${play('accent', 0, '▶ 악센트 (센박만 세게)')}</p>
      </section>
      <section><h3>데시벨(dB) 기본 상식</h3>
        <ul>
          <li><b>−6 dB</b>는 소리의 진폭(파형 높이)이 절반이라는 뜻입니다. <b>+10 dB</b> 정도가 되어야 사람 귀에 "두 배 크게" 들립니다.</li>
          <li>디지털 소리는 <b>0 dBFS</b>가 넘을 수 없는 천장입니다. 넘으면 찢어지는 소리(클리핑)가 나므로 마스터의 최고점(피크)은 <b>−1 dB</b> 아래로 둡니다. 믹서의 마스터 <b>리미터</b>가 이 일을 합니다.</li>
          <li>믹서의 막대 미터에서 회색 눈금이 −6 dB, 빨갛게 바뀌면 −1.5 dB를 넘은 것입니다.</li>
        </ul>
        <p class="row-btns">${play('measure', 0, '지금 곡 음량 재기')} <span id="measureOut" class="muted"></span></p>
      </section>
      <section><h3>믹스할 때 음량 잡는 순서</h3>
        <ol>
          <li><b>킥과 스네어</b>를 먼저 정합니다(드럼 트랙 음량). 곡의 뼈대입니다.</li>
          <li><b>베이스</b>를 킥과 비슷하게 맞춥니다. 둘이 저음을 나눠 가지므로 베이스는 120 Hz 아래, 킥은 그 위의 쿵 소리가 들리게 EQ를 나눕니다.</li>
          <li><b>멜로디(보컬 자리)</b>를 가장 또렷하게 둡니다. 다른 소리에 묻히면 다른 트랙을 줄이는 쪽이 먼저입니다.</li>
          <li><b>코드·패드·기타</b>는 멜로디보다 한 걸음 뒤로. 저역 컷(100~200 Hz)을 걸면 탁한 소리가 사라집니다.</li>
          <li><b>팬</b>: 킥·스네어·베이스·멜로디는 가운데, 하이햇·기타·코드는 좌우로 나누면 넓어집니다.</li>
          <li><b>컴프레서</b>는 큰 소리를 눌러 크기를 고르게 합니다. 베이스·보컬에 30~50%가 무난합니다.</li>
          <li><b>EQ는 올리기보다 깎기</b>부터. 겹치는 대역을 한쪽에서 줄이면 둘 다 잘 들립니다.</li>
        </ol>
      </section>`;
  }

  /* --- 박자·빠르기 --- */
  const TEMPI = [['Largo', '라르고', '아주 느리게', 50], ['Adagio', '아다지오', '느리게', 70], ['Andante', '안단테', '걷는 빠르기', 90], ['Moderato', '모데라토', '보통 빠르기', 112],
    ['Allegro', '알레그로', '빠르게', 135], ['Vivace', '비바체', '생기 있게 빠르게', 165], ['Presto', '프레스토', '아주 빠르게', 185]];
  const GENRE_TEMPI = [['발라드', 60, 80], ['로파이', 70, 90], ['힙합', 85, 95], ['팝·시티팝', 100, 125], ['하우스', 120, 128], ['J-pop', 125, 150], ['록', 120, 160], ['트랩', 130, 150], ['애니송', 160, 185], ['드럼앤베이스', 170, 176]];
  const NOTE_VALUES = [['온음표', '𝅝', BAR], ['2분음표', '𝅗𝅥', PPQ * 2], ['점4분음표', '♩.', PPQ * 1.5], ['4분음표', '♩', PPQ], ['8분음표', '♪', PPQ / 2], ['셋잇단 8분음표', '♪³', PPQ / 3], ['16분음표', '𝅘𝅥𝅯', PPQ / 4], ['32분음표', '𝅘𝅥𝅰', PPQ / 8]];
  const METERS = [['4/4', '가장 흔한 박자. 강-약-중강-약', [1, 0, 0.6, 0]], ['3/4', '왈츠. 강-약-약', [1, 0, 0]], ['6/8', '8분음표 여섯 개를 셋씩 두 묶음. 출렁이는 느낌', [1, 0, 0, 0.6, 0, 0]], ['5/4', '홀수 박자. 3+2로 묶어 셉니다', [1, 0, 0, 0.6, 0]]];
  function learnTime() {
    const s = app.song, sec = 60 / s.bpm;
    return `
      <section><h3>지금 곡: ${s.bpm} BPM</h3>
        <p><b>BPM</b>은 1분에 4분음표(한 박)가 몇 번 오는지입니다. 지금은 한 박이 <b>${sec.toFixed(3)}초</b>, 한 마디(4박)가 <b>${(sec * 4).toFixed(2)}초</b>, 곡 전체 ${s.bars}마디가 <b>${Math.round(sec * 4 * s.bars)}초</b>입니다.</p>
        <p class="row-btns"><button type="button" class="btn" data-lx="tap" id="tapBtn">탭 템포: 박자에 맞춰 여러 번 누르세요</button> <span id="tapOut" class="muted"></span></p>
      </section>
      <section><h3>음표의 길이</h3>
        <p>이 앱에서 한 박(4분음표)은 ${PPQ}틱입니다. 위쪽 <b>격자</b>를 바꾸면 그 길이 단위로 음표가 들어갑니다.</p>
        <div class="tbl"><table><thead><tr><th>음표</th><th></th><th>박</th><th>지금 빠르기에서</th><th></th></tr></thead><tbody>
        ${NOTE_VALUES.map(([n, sym, t]) => `<tr><td>${n}</td><td class="sym">${sym}</td><td class="num">${+(t / PPQ).toFixed(3)}</td><td class="num">${(t * sec / PPQ).toFixed(3)}초</td><td>${play('noteval', t)}</td></tr>`).join('')}
        </tbody></table></div>
      </section>
      <section><h3>박자표</h3>
        <p>박자표의 위 숫자는 한 마디의 박 수, 아래 숫자는 한 박이 어떤 음표인지(4 = 4분음표, 8 = 8분음표)입니다. 이 앱의 편집기는 4/4로 고정이지만, 다른 박자도 들어 보며 느낌을 익힐 수 있어요.</p>
        <div class="tbl"><table><tbody>${METERS.map(([m, d], i) => `<tr><td class="sym">${m}</td><td>${d}</td><td>${play('meter', i)}</td></tr>`).join('')}</tbody></table></div>
      </section>
      <section><h3>빠르기말과 장르별 빠르기</h3>
        <div class="two">
          <div class="tbl"><table><thead><tr><th>빠르기말</th><th>뜻</th><th>BPM</th><th></th></tr></thead><tbody>
          ${TEMPI.map(([it, ko, m, b]) => `<tr><td><i>${it}</i><br><small class="muted">${ko}</small></td><td>${m}</td><td class="num">≈${b}</td><td>${play('setbpm', b, '적용')}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="tbl"><table><thead><tr><th>장르</th><th>흔한 BPM</th><th></th></tr></thead><tbody>
          ${GENRE_TEMPI.map(([g, a, b]) => `<tr><td>${g}</td><td class="num">${a}–${b}</td><td>${play('setbpm', Math.round((a + b) / 2), '적용')}</td></tr>`).join('')}
          </tbody></table></div>
        </div>
      </section>`;
  }

  /* --- 화성 --- */
  const INTERVALS = [['완전1도', '같은 음'], ['단2도', '부딪히는 긴장'], ['장2도', '한 걸음'], ['단3도', '어둡고 슬픈 색'], ['장3도', '밝은 색'], ['완전4도', '열린 울림'],
    ['증4도/감5도', '트라이톤. 가장 불안정'], ['완전5도', '단단하고 빈 울림(파워 코드)'], ['단6도', '애틋함'], ['장6도', '따뜻함'], ['단7도', '블루지한 긴장'], ['장7도', '세련된 긴장'], ['완전8도', '옥타브. 같은 음 이름']];
  const FUNC = ['T', 'S', 'T', 'S', 'D', 'T', 'D'];
  const FUNC_NAME = { T: '토닉: 안정·집', S: '서브도미넌트: 나아감', D: '도미넌트: 긴장 → 토닉으로 풀림' };
  const QUAL_DEMO = [['', '장3화음', '밝고 안정'], ['m', '단3화음', '어둡고 차분'], ['7', '도미넌트 7', '다음 화음으로 가고 싶은 긴장'], ['maj7', '메이저 7', '세련·도시적'],
    ['m7', '마이너 7', '부드러운 어둠'], ['sus4', 'sus4', '떠 있는 느낌, 보통 장3화음으로 풀림'], ['dim', '감3화음', '불안·긴박'], ['add9', 'add9', '반짝이는 밝음']];
  function learnHarm() {
    const s = app.song, flats = T.prefersFlats(s.key, s.scale), names = flats ? T.FLAT_NAMES : T.NOTE_NAMES;
    const steps = T.SCALES[s.scale].steps;
    const tri = [], sev = [];
    for (let d = 0; d < 7; d++) { tri.push(T.diatonic(s.key, s.scale, d, false)); sev.push(T.diatonic(s.key, s.scale, d, true)); }
    const chordBtn = (ch, d) => `<div class="chordcard"><b>${esc(T.chordName(ch, flats))}</b><small>${esc(T.roman(ch, s.key, s.scale))}${d != null && steps.length === 7 ? ' · ' + FUNC[d] : ''}</small>
      <span>${play('chord', JSON.stringify(ch))}${play('tolane', JSON.stringify(ch), '코드 줄에')}</span></div>`;
    return `
      <section><h3>지금 곡의 조: ${T.keyName(s.key, s.scale)} ${esc(T.SCALES[s.scale].name)}</h3>
        <p>음계는 곡에서 주로 쓰는 음들의 모임입니다. 피아노 롤 왼쪽 건반의 주황색 표시가 이 음들이에요.</p>
        <div class="chips">${steps.map((st) => `<span class="chip">${names[(s.key + st) % 12]}<small>${T.NOTE_KO[(s.key + st) % 12]}</small></span>`).join('')}</div>
        <p class="row-btns">${play('scale', 0, '▶ 음계 올라가기')}</p>
      </section>
      <section><h3>이 조의 기본 코드(다이어토닉 코드)</h3>
        <p>음계의 각 음 위에 음계 음을 한 칸씩 건너 쌓으면 그 조에 어울리는 코드가 됩니다. 「코드 줄에」를 누르면 재생 위치가 있는 마디의 코드로 들어갑니다.</p>
        <div class="chordgrid">${tri.map((c, d) => chordBtn(c, d)).join('')}</div>
        <p class="muted small">7화음(네 음)</p>
        <div class="chordgrid">${sev.map((c, d) => chordBtn(c, d)).join('')}</div>
        ${steps.length === 7 ? `<ul class="func">${Object.entries(FUNC_NAME).map(([k, v]) => `<li><b>${k}</b> ${v}</li>`).join('')}</ul>
        <p>대부분의 진행은 <b>T → S → D → T</b>의 흐름을 변형한 것입니다. 예: I(T) – IV(S) – V(D) – I(T).</p>` : ''}
      </section>
      <section><h3>자주 쓰는 코드 진행</h3>
        <div class="tbl"><table><tbody>
        ${T.PROGRESSIONS.map((p) => { const chs = T.progressionChords(p.id, s.key, s.scale); return `<tr><td>${esc(p.name)}<br><small class="muted">${chs.map((c) => esc(T.chordName(c, flats))).join(' – ')}</small></td><td class="nowrap">${play('prog', p.id)}${play('applyprog', p.id, '코드 줄에 적용')}</td></tr>`; }).join('')}
        </tbody></table></div>
      </section>
      <section><h3>음정: 두 음 사이의 거리</h3>
        <div class="tbl"><table><thead><tr><th>반음</th><th>이름</th><th>느낌</th><th></th></tr></thead><tbody>
        ${INTERVALS.map(([n, f], i) => `<tr><td class="num">${i}</td><td>${n}</td><td>${f}</td><td class="nowrap">${play('interval', i, '▶ 따로')}${play('interval2', i, '▶ 함께')}</td></tr>`).join('')}
        </tbody></table></div>
      </section>
      <section><h3>코드의 종류와 색깔 (근음 ${names[s.key]})</h3>
        <div class="tbl"><table><tbody>
        ${QUAL_DEMO.map(([q, n, f]) => `<tr><td><b>${names[s.key]}${T.QUALITIES[q].label}</b></td><td>${n}</td><td>${f}</td><td>${play('qual', q)}</td></tr>`).join('')}
        </tbody></table></div>
      </section>`;
  }

  /* --- 리듬 --- */
  const RHYTHMS = [
    { name: '8비트 록', desc: '하이햇 8분음표, 2·4박 스네어. 록·팝의 기본', p: { kick: 'x.......x.x.....', snare: '....x.......x...', chh: 'x.x.x.x.x.x.x.x.' } },
    { name: '16비트 팝', desc: '하이햇을 16분으로 잘게. 경쾌하고 바쁜 느낌', p: { kick: 'x.....x...x.....', snare: '....x.......x...', chh: 'xoxoxoxoxoxoxoxo' } },
    { name: '포 온 더 플로어', desc: '매 박 킥. 하우스·디스코·EDM', p: { kick: 'x...x...x...x...', clap: '....x.......x...', ohh: '..x...x...x...x.', chh: 'o.o.o.o.o.o.o.o.' } },
    { name: '하프타임 (트랩)', desc: '스네어가 3박에만. 템포가 반으로 느껴짐', p: { kick: 'x......x..x.....', snare: '........x.......', chh: 'x.x.x.x.x.xxx.x.' } },
    { name: '붐뱁 (힙합)', desc: '킥이 엇박에 걸리는 묵직한 힙합. 스윙을 곁들이면 좋음', p: { kick: 'x......x..x.....', snare: '....x.......x...', chh: 'x.o.x.o.x.o.x.oo' } },
    { name: '셔플', desc: '8분음표를 길게-짧게. 블루스·재즈. 곡 스윙 50~60%와 함께', p: { kick: 'x.......x.......', snare: '....x.......x...', ride: 'x..xx..xx..xx..x' }, swing: 0.55 },
    { name: '보사노바', desc: '브라질. 림샷이 클라베 꼴로 흩어짐', p: { kick: 'x..xx..xx..xx..x', clap: 'x..x..x...x..x..', chh: 'xxxxxxxxxxxxxxxx' } },
    { name: '레게 원드롭', desc: '킥과 스네어가 3박에 함께. 1박은 비움', p: { kick: '........x.......', snare: '........x.......', chh: '..x...x...x...x.' } },
    { name: '트레실로 (3-3-2)', desc: '16칸을 3+3+2로. 라틴·K-pop·댄스홀에서 흔함', p: { kick: 'x..x..x.x..x..x.', snare: '....x.......x...', chh: 'x.x.x.x.x.x.x.x.' } },
    { name: '투스텝 (드럼앤베이스)', desc: '빠른 템포에서 킥 1·(2&), 스네어 2·4', p: { kick: 'x.........x.....', snare: '....x.......x...', chh: 'x.x.x.x.x.x.x.x.' } },
    { name: '발라드', desc: '여백이 많은 느린 8비트', p: { kick: 'x.......x.....o.', snare: '........x.......', chh: 'x...o...x...o...' } },
  ];
  function grid(p) {
    const ids = Object.keys(p);
    return `<div class="rgrid">${ids.map((id) => `<div class="rrow"><span>${SG.DRUMS[ROW[id]].name}</span>${[...p[id]].map((c, i) => `<i class="${c === 'x' ? 'on' : c === 'o' ? 'soft' : ''}${i % 4 === 0 ? ' beat' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
  }
  function learnRhy() {
    return `
      <section><h3>센박과 여린박</h3>
        <p>4/4에서는 <b>1박이 가장 세고(강), 3박이 다음(중강), 2·4박은 여립니다(약)</b>. 팝·록은 일부러 2·4박에 스네어를 쳐서(백비트) 몸이 움직이게 합니다.</p>
        <ul>
          <li><b>당김음(싱코페이션)</b>: 센박이 와야 할 자리를 비우고 바로 앞 엇박을 세게. 리듬이 앞으로 쏠리는 느낌을 줍니다.</li>
          <li><b>스윙</b>: 짝을 이룬 8분(또는 16분)음표의 뒤쪽을 늦춰 길게-짧게 만드는 것. 파일·설정의 <b>스윙</b>으로 곡 전체에 걸 수 있어요.</li>
          <li><b>셋잇단음표</b>: 한 박을 셋으로. 격자를 「8분 셋잇단」으로 바꾸면 입력할 수 있습니다.</li>
          <li><b>필인</b>: 4마디·8마디 끝에서 탐이나 스네어를 몰아 쳐서 다음 단락을 알립니다.</li>
        </ul>
        <p class="row-btns">${play('beatfeel', 0, '▶ 강-약-중강-약 들어 보기')} ${play('synco', 0, '▶ 당김음 들어 보기')}</p>
      </section>
      <section><h3>장르별 기본 드럼 리듬</h3>
        <p>한 마디(16칸)를 그린 것입니다. 진한 칸은 세게, 옅은 칸은 약하게 칩니다. 「드럼 트랙에 넣기」는 지금 드럼 트랙(없으면 새로 만듦)의 반복 구간에, 반복 구간이 꺼져 있으면 곡 전체에 채웁니다.</p>
        <div class="rlist">${RHYTHMS.map((r, i) => `<div class="rcard"><div class="rhead"><b>${esc(r.name)}</b><span>${play('rhythm', i)}${play('rinsert', i, '드럼 트랙에 넣기')}</span></div><p class="muted small">${esc(r.desc)}</p>${grid(r.p)}</div>`).join('')}</div>
      </section>`;
  }
  const patEvs = (p, bars = 2) => {
    const out = [];
    for (let b = 0; b < bars; b++) for (const [id, str] of Object.entries(p)) [...str].forEach((c, i) => { if (c === 'x' || c === 'o') out.push({ t: b * BAR + i * PPQ / 4, p: ROW[id], v: c === 'x' ? 0.9 : 0.5, drum: true }); });
    return out;
  };
  function insertRhythm(r) {
    const s = app.song;
    let tr = app.track.type === 'drums' ? app.track : s.tracks.find((t) => t.type === 'drums');
    if (!tr) { tr = SG.makeTrack('drums', { name: '드럼', color: SG.COLORS[3] }); s.tracks.push(tr); }
    const a = s.loop.on ? s.loop.start : 0, b = s.loop.on ? s.loop.end : s.bars * BAR;
    tr.notes = tr.notes.filter((n) => n.t < a || n.t >= b);
    for (let bar = Math.floor(a / BAR); bar * BAR < b; bar++) for (const e of patEvs(r.p, 1)) tr.notes.push({ t: bar * BAR + e.t, d: PPQ / 4, p: e.p, v: e.v });
    app.sortNotes(tr);
    if (r.swing && !s.swing) s.swing = r.swing;
    app.selectTrack(tr.id);
    app.commit('리듬 넣기'); app.renderAll();
    app.toast(`「${r.name}」을(를) ${tr.name}에 넣었어요${r.swing ? ' (스윙도 켰어요)' : ''}`);
  }

  async function measure(out) {
    const s = app.song;
    if (!s.tracks.some((t) => t.notes.length)) { out.textContent = '음표가 없어요'; return; }
    out.textContent = '재는 중…';
    try {
      const buf = await A.render(s);
      let pk = 0, sum = 0, n = 0;
      for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const x = Math.abs(d[i]); if (x > pk) pk = x; sum += x * x; n++; } }
      const pkdb = 20 * Math.log10(pk || 1e-9), rms = 10 * Math.log10(sum / n || 1e-12);
      let tip = '적당해요.';
      if (pkdb > -0.5) tip = '최고점이 천장에 닿았어요. 전체 음량이나 큰 트랙을 줄이세요.';
      else if (rms < -26) tip = '전체적으로 작아요. 마스터 버스 컴프나 전체 음량을 올려 보세요.';
      else if (rms > -10) tip = '아주 크게 눌려 있어요. 컴프를 줄이면 숨 쉬는 느낌이 살아납니다.';
      out.textContent = `최고점 ${pkdb.toFixed(1)} dBFS · 평균(RMS) ${rms.toFixed(1)} dBFS — ${tip}`;
    } catch (e) { out.textContent = '재지 못했어요: ' + e.message; }
  }

  $('learnBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lx]'); if (!b) return;
    const s = app.song, arg = b.dataset.arg, root = 60 + s.key;
    const C = { root: s.key, q: '' };
    switch (b.dataset.lx) {
      case 'dyn': playDemo(chordEvs(C, 0, PPQ * 1.5, +arg / 127)); break;
      case 'cresc': { const up = arg === '1'; playDemo([0, 2, 4, 5, 7, 9, 11, 12].map((st, i) => ({ t: i * PPQ / 2, d: PPQ / 2, p: root + st, v: up ? 0.12 + i * 0.12 : 0.96 - i * 0.12 }))); break; }
      case 'accent': playDemo(Array.from({ length: 16 }, (_, i) => ({ t: i * PPQ / 2, d: PPQ / 2 - 6, p: root + (i % 2 ? 7 : 0), v: i % 4 === 0 ? 0.95 : 0.3 }))); break;
      case 'measure': measure($('measureOut')); break;
      case 'tap': {
        const now = performance.now();
        if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2000) tapTimes.length = 0;
        tapTimes.push(now); if (tapTimes.length > 8) tapTimes.shift();
        app.audio(); playDemo([{ t: 0, p: ROW.clap, v: 0.7, drum: true }]);
        if (tapTimes.length >= 3) {
          const iv = (tapTimes[tapTimes.length - 1] - tapTimes[0]) / (tapTimes.length - 1);
          const bpm = Math.round(60000 / iv);
          $('tapOut').innerHTML = `약 <b>${bpm}</b> BPM ${play('setbpm', Math.max(30, Math.min(300, bpm)), '이 빠르기로')}`;
        } else $('tapOut').textContent = '더 눌러 주세요…';
        break;
      }
      case 'setbpm': s.bpm = +arg; app.commit('템포'); app.renderHeader(); app.toast(`빠르기를 ${arg} BPM으로 바꿨어요`); if (tab === 'time') setTab('time'); break;
      case 'noteval': { const t = +arg; const evs = []; for (let x = 0; x < BAR * 2 - 1; x += t) evs.push({ t: x, d: Math.max(12, t - 8), p: root + 7, v: 0.7 }); for (let k = 0; k < 8; k++) evs.push({ t: k * PPQ, p: ROW.chh, v: k % 4 === 0 ? 0.6 : 0.3, drum: true }); playDemo(evs); break; }
      case 'meter': {
        const m = METERS[+arg], unit = m[0] === '6/8' ? PPQ / 2 : PPQ, acc = m[2], evs = [];
        for (let bar = 0; bar < 3; bar++) acc.forEach((a, i) => evs.push({ t: (bar * acc.length + i) * unit, p: a === 1 ? ROW.kick : a > 0 ? ROW.snare : ROW.chh, v: a === 1 ? 0.95 : a > 0 ? 0.6 : 0.45, drum: true }));
        playDemo(evs); break;
      }
      case 'scale': { const st = T.SCALES[s.scale].steps; playDemo([...st, 12].map((x, i) => ({ t: i * PPQ / 2, d: PPQ / 2, p: root + x, v: 0.7 }))); break; }
      case 'chord': playDemo(chordEvs(JSON.parse(arg), 0, PPQ * 2)); break;
      case 'tolane': {
        const bar = Math.min(s.bars - 1, Math.floor(app.player.now() / BAR));
        const ch = JSON.parse(arg); s.chords[bar] = { root: ch.root, q: ch.q };
        app.commit('코드'); app.toast(`${bar + 1}마디에 ${T.chordName(ch, T.prefersFlats(s.key, s.scale))}`);
        app.seek(Math.min((s.bars - 1) * BAR, (bar + 1) * BAR));
        break;
      }
      case 'prog': { const chs = T.progressionChords(arg, s.key, s.scale); playDemo(chs.flatMap((c, i) => chordEvs(c, i * PPQ * 2, PPQ * 2 - 10))); break; }
      case 'applyprog': {
        const chs = T.progressionChords(arg, s.key, s.scale);
        for (let i = 0; i < s.bars; i++) s.chords[i] = { ...chs[i % chs.length] };
        app.commit('코드 진행'); app.toast('코드 줄에 진행을 채웠어요. 자동 작곡에서 「코드 줄 그대로 쓰기」로 반주를 만들 수 있어요'); break;
      }
      case 'interval': playDemo([{ t: 0, d: PPQ - 10, p: root }, { t: PPQ, d: PPQ, p: root + +arg }]); break;
      case 'interval2': playDemo([{ t: 0, d: PPQ * 2, p: root }, { t: 0, d: PPQ * 2, p: root + +arg }]); break;
      case 'qual': playDemo(chordEvs({ root: s.key, q: arg }, 0, PPQ * 2)); break;
      case 'beatfeel': { const evs = []; for (let i = 0; i < 8; i++) { const a = [0.95, 0.35, 0.7, 0.35][i % 4]; evs.push({ t: i * PPQ, p: i % 4 === 0 ? ROW.kick : ROW.chh, v: a, drum: true }); evs.push({ t: i * PPQ, d: PPQ - 10, p: root, v: a }); } playDemo(evs); break; }
      case 'synco': playDemo([...patEvs({ kick: 'x...x...x...x...', chh: 'x.x.x.x.x.x.x.x.' }, 2), ...[0, 3, 6, 10, 12].flatMap((st, i) => [{ t: [0, 72, 144, 240, 288][i], d: 60, p: root + [0, 4, 7, 9, 7][i], v: 0.8 }, { t: BAR + [0, 72, 144, 240, 288][i], d: 60, p: root + [0, 4, 7, 9, 12][i], v: 0.8 }])]); break;
      case 'rhythm': { const r = RHYTHMS[+arg]; playDemo(patEvs(r.p, 2), 'piano', r.name.includes('드럼앤베이스') ? 172 : app.song.bpm); break; }
      case 'rinsert': insertRhythm(RHYTHMS[+arg]); break;
    }
  });
  $('dlgLearn').addEventListener('close', () => { if (demo) { demo.stop(); demo = null; } });

  S.panels = { renderMixer, setTab, RHYTHMS };
})(globalThis.Studio = globalThis.Studio || {});
