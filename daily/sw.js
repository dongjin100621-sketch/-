'use strict';
/* 오프라인에서도 열리도록 앱 파일을 보관한다. 파일을 고치면 VERSION을 올린다. */
const VERSION = 'haru-v5';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/core.js', 'js/home.js', 'js/notes.js', 'js/todo.js', 'js/calendar.js', 'js/alarm.js',
  'js/timer.js', 'js/music.js', 'js/budget.js', 'js/habits.js', 'js/calc.js', 'js/prefs.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 날씨 API는 항상 네트워크로
  if (url.hostname.includes('open-meteo.com')) return;
  const same = url.origin === location.origin;
  if (same) {
    // 네트워크 우선, 실패하면 보관본 (수정 사항이 바로 반영되도록)
    e.respondWith(fetch(req).then(r => {
      const copy = r.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(m => m || caches.match('index.html'))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(m => m || fetch(req).then(r => {
      const copy = r.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
      return r;
    }).catch(() => m)));
  }
});
