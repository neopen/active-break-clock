/**
 * Service Worker (Web/PWA 专属)
 * 注意：此文件仅在浏览器环境中生效，Neutralino/Electron 桌面端会自动跳过注册。
 * 功能：静态资源缓存、离线回退、后台推送与同步
 */
const CACHE_NAME = 'health-clock-v1.0.0';
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'css/base.css',
  'css/components.css',
  'css/lock.css',
  'js/modules/config.js',
  'js/modules/audio.js',
  'js/modules/notification.js',
  'js/modules/stats.js',
  'js/modules/reminder.js',
  'js/modules/ui.js',
  'js/core/app.js'
];

// 安装阶段：预缓存核心资源
self.addEventListener('install', (event) => {
  console.log('[SW] Install phase started');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .catch(err => console.error('[SW] Cache prefill failed:', err))
  );
  self.skipWaiting(); // 激活新版本，无需等待旧标签页关闭
});

// 激活阶段：清理旧版本缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate phase started');
  event.waitUntil(
    caches.keys().then(keyList =>
      Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Deleting outdated cache:', key);
          return caches.delete(key);
        }
      }))
    ).then(() => self.clients.claim()) // 立即接管所有活跃页面
  );
});

// 网络请求拦截：优先缓存，失败回退网络
self.addEventListener('fetch', (event) => {
  // 仅处理 GET 请求，忽略扩展协议
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        return networkResponse;
      }).catch(() => {
        // 离线状态：返回主页面保障 SPA 路由可用
        return caches.match('index.html');
      });
    })
  );
});

// 后台同步：用于 Web 端离线状态下的提醒同步
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  if (event.tag === 'reminder-sync') {
    event.waitUntil(
      self.registration.showNotification('[提醒] 该活动啦！', {
        body: '站起来走走，伸个懒腰，活动一下筋骨！',
        icon: './icons/icon-192.png',
        badge: './icons/icon-96.png',
        vibrate: [200, 100, 200],
        tag: 'health-reminder',
        requireInteraction: true
      })
    );
  }
});

// 推送通知：接收服务端推送的健康提醒
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || '[提醒] 该活动啦！', {
      body: data.body || '站起来走走，伸个懒腰！',
      icon: './icons/icon-192.png',
      badge: './icons/icon-96.png',
      vibrate: [200, 100, 200],
      tag: 'health-reminder',
      requireInteraction: true
    })
  );
});