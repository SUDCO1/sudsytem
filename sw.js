// SUDCO PWA service worker
// ตั้งใจให้ "ผ่านตรงไปเน็ต" ไม่เก็บแคช เพื่อให้แอปอัปเดตเป็นเวอร์ชันล่าสุดเสมอ
// (เว็บใช้ Firebase ข้อมูลสดอยู่แล้ว การแคชจะทำให้เห็นของเก่า)

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // ส่งต่อทุก request ไปเน็ตตามปกติ ไม่แตะต้อง ไม่แคช
  return;
});
