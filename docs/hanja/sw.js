'use strict';
/* 한 번 열어 두면 오프라인에서도 공부할 수 있게 파일을 보관한다.
   목록과 VERSION 은 tools/build_pwa.py hanja 가 갱신한다. */
const VERSION = 'hanja-4d8b0944';
const SHELL = ["./", "index.html", "manifest.webmanifest", "css/style.css", "js/app.js", "js/data.js", "js/tiers.js", "js/unihan.js", "js/write.js", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png"];
const FONTS = /^fonts\.(googleapis|gstatic)\.com$/;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(SHELL.map((f) => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  if (!same && !FONTS.test(url.hostname)) return;
  const put = (r) => { if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return r; };
  if (!same) {
    // 글꼴: 보관본 우선
    e.respondWith(caches.match(req).then((m) => m || fetch(req).then(put).catch(() => m)));
  } else {
    // 앱 파일: 네트워크 우선(고친 내용이 바로 보이게), 오프라인이면 보관본
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req, { ignoreSearch: true }).then((m) => m || caches.match('index.html'))));
  }
});
