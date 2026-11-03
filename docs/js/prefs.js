'use strict';
/* 설정: 이름, 테마, 날씨 지역, 알람 소리, 알림, 백업·복원, 초기화 */
(function () {
  const A = App;
  const { esc, icon } = A;

  function exportData() {
    const out = { app: 'haru-desk', version: 1, exportedAt: new Date().toISOString(), data: {} };
    A.KEYS.forEach(k => { if (k !== 'weather') out.data[k] = A.data[k]; });
    return JSON.stringify(out, null, 2);
  }

  A.register({
    id: 'prefs', label: '설정', icon: 'prefs',
    render(el) {
      el.innerHTML = `
        <div class="page">
          <div class="page-head"><div><h1>설정</h1><p class="sub">모든 기록은 이 브라우저에만 저장돼요. 다른 기기로 옮기려면 백업 파일을 쓰세요.</p></div></div>
          <div class="prefs">
            <section class="panel">
              <h2 class="panel-title">나에게 맞추기</h2>
              <div class="pref-row">
                <div class="grow"><h3>부를 이름</h3><p>홈 화면 인사말에 쓰여요.</p></div>
                <div class="pref-ctl"><input class="input" id="pf-name" value="${esc(A.data.prefs.name)}" placeholder="예: 민지" style="width:180px" autocomplete="off" aria-label="부를 이름"></div>
              </div>
              <div class="pref-row">
                <div class="grow"><h3>화면 테마</h3><p>시스템을 고르면 기기 설정을 따라가요.</p></div>
                <div class="pref-ctl"><div class="seg" role="group" aria-label="테마">
                  <button type="button" data-theme-opt="system">시스템</button><button type="button" data-theme-opt="light">밝게</button><button type="button" data-theme-opt="dark">어둡게</button>
                </div></div>
              </div>
              <div class="pref-row">
                <div class="grow"><h3>날씨 지역</h3><p id="pf-city"></p></div>
                <div class="pref-ctl"><button type="button" class="btn" data-act="city">지역 바꾸기</button></div>
              </div>
            </section>

            <section class="panel">
              <h2 class="panel-title">알람과 알림</h2>
              <div class="pref-row">
                <div class="grow"><h3>기본 알람 소리</h3><p>새 알람과 타이머가 끝날 때 쓰여요.</p></div>
                <div class="pref-ctl">
                  <select class="input" id="pf-sound" style="width:160px" aria-label="기본 알람 소리">${Object.entries(A.Sound.PATTERNS).map(([k, p]) => `<option value="${k}" ${k === A.data.prefs.sound ? 'selected' : ''}>${p.label}</option>`).join('')}</select>
                  <button type="button" class="btn" data-act="preview">미리 듣기</button>
                </div>
              </div>
              <div class="pref-row">
                <div class="grow"><h3>브라우저 알림</h3><p id="pf-notify"></p></div>
                <div class="pref-ctl" id="pf-notify-ctl"></div>
              </div>
            </section>

            <section class="panel">
              <h2 class="panel-title">데이터</h2>
              <div class="pref-row">
                <div class="grow"><h3>백업 내보내기</h3><p>메모, 할 일, 일정, 알람, 가계부, 습관을 파일 하나로 저장해요. 음악 파일은 들어가지 않아요.</p></div>
                <div class="pref-ctl"><button type="button" class="btn" data-act="export">${icon('download', 16)} 파일로 저장</button><button type="button" class="btn ghost" data-act="copy">${icon('copy', 16)} 복사</button></div>
              </div>
              <div class="pref-row">
                <div class="grow"><h3>백업 불러오기</h3><p>지금 기록을 백업 파일의 내용으로 바꿔요.</p></div>
                <div class="pref-ctl"><label class="btn" for="pf-import">${icon('upload', 16)} 파일 고르기</label><input type="file" id="pf-import" accept="application/json,.json" hidden></div>
              </div>
              <div class="pref-row">
                <div class="grow"><h3>예시 항목 지우기</h3><p>처음에 넣어 둔 사용법 예시만 지워요.</p></div>
                <div class="pref-ctl"><button type="button" class="btn" data-act="samples" ${A.hasSamples() ? '' : 'disabled'}>예시 지우기</button></div>
              </div>
              <div class="pref-row">
                <div class="grow"><h3>모든 기록 지우기</h3><p>이 브라우저에 저장된 하루 책상의 모든 기록과 음악을 지워요. 되돌릴 수 없어요.</p></div>
                <div class="pref-ctl"><button type="button" class="btn danger" data-act="wipe">모두 지우기</button></div>
              </div>
            </section>
          </div>
        </div>`;
      const $ = s => el.querySelector(s);

      function drawTheme() {
        el.querySelectorAll('[data-theme-opt]').forEach(b => {
          const on = b.dataset.themeOpt === A.data.prefs.theme;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on);
        });
      }
      function drawCity() {
        const c = A.data.prefs.city || A.weather.DEFAULT_CITY;
        $('#pf-city').textContent = `지금: ${c.name}${A.data.prefs.city ? '' : ' (기본값)'}`;
      }
      function drawNotify() {
        const ctl = $('#pf-notify-ctl');
        if (!('Notification' in window)) {
          $('#pf-notify').textContent = '이 브라우저는 알림을 지원하지 않아요.';
          ctl.innerHTML = '';
          return;
        }
        const p = Notification.permission;
        $('#pf-notify').textContent = p === 'granted' ? '켜져 있어요. 다른 탭을 볼 때 알람이 울리면 알려 드려요.'
          : p === 'denied' ? '막혀 있어요. 브라우저의 사이트 설정에서 허용할 수 있어요.'
          : '다른 탭을 보고 있을 때도 알람을 알 수 있어요.';
        ctl.innerHTML = p === 'default' ? '<button type="button" class="btn" data-act="notify">알림 켜기</button>' : `<span class="tag ${p === 'granted' ? 'green' : 'red'}">${p === 'granted' ? '켜짐' : '꺼짐'}</span>`;
      }

      const saveName = A.debounce(() => { A.data.prefs.name = $('#pf-name').value.trim(); A.save('prefs'); }, 300);
      $('#pf-name').addEventListener('input', saveName);
      $('#pf-sound').addEventListener('change', e => {
        A.data.prefs.sound = e.target.value; A.save('prefs');
        A.Sound.preview(e.target.value);
      });
      $('#pf-import').addEventListener('change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        let obj;
        try { obj = JSON.parse(await f.text()); } catch (err) { A.toast('읽을 수 없는 파일이에요. 하루 책상에서 내보낸 .json 파일을 골라 주세요.'); return; }
        if (!obj || obj.app !== 'haru-desk' || !obj.data) { A.toast('하루 책상 백업 파일이 아니에요'); return; }
        const when = obj.exportedAt ? new Date(obj.exportedAt) : null;
        const ok = await A.confirm(`${when ? `${A.fmtDate(when)}에 만든 ` : ''}백업으로 지금 기록을 바꿀까요? 현재 기록은 사라져요.`, { title: '백업 불러오기', ok: '불러오기', danger: true });
        if (!ok) return;
        A.KEYS.forEach(k => { if (k in obj.data) { A.data[k] = obj.data[k]; A.save(k); } });
        A.data.prefs.seeded = true; A.save('prefs');
        A.toast('백업을 불러왔어요. 다시 여는 중…');
        setTimeout(() => location.reload(), 600);
      });

      el.addEventListener('click', async e => {
        const t = e.target.closest('[data-theme-opt]');
        if (t) { A.data.prefs.theme = t.dataset.themeOpt; A.save('prefs'); A.applyTheme(); drawTheme(); return; }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'city') A.weather.openCityPicker(drawCity);
        else if (act === 'preview') A.Sound.preview($('#pf-sound').value);
        else if (act === 'notify') {
          try { await Notification.requestPermission(); } catch (err) { /* noop */ }
          drawNotify();
        } else if (act === 'export') {
          try {
            const blob = new Blob([exportData()], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `haru-desk-backup-${A.today()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            A.toast('백업 파일을 저장했어요. 저장되지 않았다면 복사 버튼을 쓰세요.');
          } catch (err) { A.toast('파일로 저장하지 못했어요. 복사 버튼을 써 보세요.'); }
        } else if (act === 'copy') {
          const text = exportData();
          try {
            await navigator.clipboard.writeText(text);
            A.toast('백업 내용을 복사했어요. 메모장 등에 붙여 넣어 .json으로 저장하세요.');
          } catch (err) {
            A.modal({ title: '백업 내용', body: `<p class="modal-text" style="margin-bottom:8px">아래 내용을 모두 선택해 복사하세요.</p><textarea class="input mono" rows="10" readonly style="font-size:12px">${esc(text)}</textarea>`, onMount(box) { const ta = box.querySelector('textarea'); ta.focus(); ta.select(); } });
          }
        } else if (act === 'samples') {
          const ok = await A.confirm('처음에 넣어 둔 예시 항목을 지울까요? 직접 만든 항목은 그대로 남아요.', { title: '예시 지우기', ok: '지우기', danger: true });
          if (ok) { A.clearSamples(); b.disabled = true; A.toast('예시 항목을 지웠어요'); }
        } else if (act === 'wipe') {
          const ok = await A.confirm('이 브라우저에 저장된 메모, 할 일, 일정, 알람, 가계부, 습관, 음악을 모두 지울까요? 되돌릴 수 없어요.', { title: '모든 기록 지우기', ok: '모두 지우기', danger: true });
          if (!ok) return;
          try { await A.music.clearAll(); } catch (err) { /* noop */ }
          A.wipeAll();
          A.persist('prefs', Object.assign(A.clone(A.DEFAULTS.prefs), { seeded: true }));
          location.reload();
        }
      });

      drawTheme(); drawCity(); drawNotify();
    }
  });
})();
