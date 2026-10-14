// Service worker: lưu sẵn các trang để mở được khi mất mạng và để cài thành app.
// Trang HTML luôn lấy bản mới khi có mạng; tệp khác dùng bản đã lưu rồi cập nhật ngầm.
const CACHE = 'mrminhdeptrai-v2';
const CORE = [
  './', 'index.html', 'pwa.js', 'manifest.webmanifest',
  'tools/drive/', 'tools/drive/huong-dan.html',
  'games/tien-len/', 'games/tien-len/manifest.webmanifest', 'games/caro/',
  'icons/site-192.png', 'icons/site-512.png', 'icons/tienlen-192.png', 'icons/tienlen-512.png'
];
// Chỉ lưu tệp của web này, phông chữ và thư viện kết nối; không bao giờ lưu dữ liệu Google Drive
const CACHEABLE_HOSTS = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin && !CACHEABLE_HOSTS.test(url.hostname)) return;

  const save = res => {
    if (res && (res.ok || res.type === 'opaque')) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  };

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(save).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(save).catch(() => hit);
    return hit || net;
  }));
});
