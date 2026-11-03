// SUDCO PWA service worker
// ไฟล์เว็บ: ผ่านตรงไปเน็ตเสมอ ไม่เก็บแคช เพื่อให้แอปเป็นเวอร์ชันล่าสุดตลอด
// (เว็บใช้ข้อมูลสดอยู่แล้ว การแคชไฟล์เว็บจะทำให้เห็นของเก่า)
//
// ข้อยกเว้นเดียว: ภาพถ่ายดาวเทียมของแผนที่เสาเข็ม
// เพราะที่หน้างานสัญญาณอ่อน ภาพ 20-80 ชิ้นต่อหน้าจอมักโหลดไม่ครบ แล้วค้างเป็นช่องเทา
// ภาพถ่ายทางอากาศแทบไม่เปลี่ยน (Esri อัปเดตเป็นปี ๆ) เก็บไว้ใช้ซ้ำจึงไม่เสี่ยงเห็นของเก่าผิด

const TILE_CACHE = 'sudco-tiles-v1';

// เก็บเฉพาะไทล์ของ Esri เท่านั้น เงื่อนไขแคบไว้ก่อน
// ถ้าเผลอเขียนกว้างไปจนครอบไฟล์เว็บ แอปจะค้างเวอร์ชันเก่าแล้วหาสาเหตุยากมาก
function isTile(url) {
  return url.hostname.endsWith('arcgisonline.com') && url.pathname.includes('/MapServer/tile/');
}

// ใช้ที่อยู่แบบตัดท้าย ?... ออกเป็นกุญแจเก็บของ
// ตอนสัญญาณอ่อนแผนที่จะลองโหลดซ้ำโดยต่อ ?r=1, ?r=2 ท้ายที่อยู่ (กันเบราว์เซอร์คืนของที่พลาดมาให้)
// ถ้าเก็บตามที่อยู่เต็ม ไทล์เดิมใบเดียวจะกลายเป็นของคนละชิ้นหลายก้อน เปลืองที่เปล่า ๆ
function tileKey(url) {
  return url.origin + url.pathname;
}

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // ลบแคชไทล์รุ่นเก่าทิ้ง เวลาเปลี่ยนเลขรุ่นจะได้ไม่กินที่ซ้อนกันไปเรื่อย ๆ
    const names = await caches.keys();
    await Promise.all(names
      .filter(n => n.startsWith('sudco-tiles-') && n !== TILE_CACHE)
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  let url;
  try { url = new URL(e.request.url); } catch (err) { return; }

  // ไฟล์เว็บทั้งหมดไม่แตะ ปล่อยผ่านเหมือนเดิม
  if (!isTile(url)) return;

  const key = tileKey(url);

  e.respondWith((async () => {
    const cache  = await caches.open(TILE_CACHE);
    const cached = await cache.match(key);
    if (cached) return cached;                 // มีในเครื่องแล้ว ไม่ต้องแตะเน็ตเลย

    try {
      const res = await fetch(e.request);
      // เก็บเฉพาะที่สำเร็จจริงและอ่านเนื้อได้
      // opaque คือตอบกลับที่อ่านไม่ได้ (ขอแบบไม่มี CORS) เบราว์เซอร์จะคิดโควตาเผื่อไว้
      // ก้อนละหลาย MB ทั้งที่ไฟล์จริงแค่ 12 KB เก็บไปจะเต็มเครื่องเร็วมาก
      // ฝั่งแผนที่ตั้ง crossOrigin ไว้แล้ว และ Esri ส่ง Access-Control-Allow-Origin: *
      // ของที่วิ่งมาถึงตรงนี้จึงควรเป็น basic/cors ไม่ใช่ opaque
      if (res && res.ok && res.type !== 'opaque') {
        cache.put(key, res.clone()).catch(() => {});   // เต็มเครื่องก็แค่ไม่เก็บ ไม่ให้พัง
      }
      return res;
    } catch (err) {
      // เน็ตล่มและไม่มีของเก่าเก็บไว้ ส่งต่อให้ฝั่งแผนที่จัดการ (มีลองใหม่ให้อยู่)
      throw err;
    }
  })());
});

// ให้หน้าเว็บถามขนาดที่เก็บไว้ / สั่งล้างได้
self.addEventListener('message', (e) => {
  const msg = e.data || {};
  if (msg.type === 'tiles-clear') {
    e.waitUntil(caches.delete(TILE_CACHE).then(() => {
      if (e.source) e.source.postMessage({ type: 'tiles-cleared' });
    }));
  }
});
