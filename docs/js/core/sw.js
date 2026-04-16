// sw.js - Service Worker for it
const CACHE_NAME = 'health-alarm-v1.0.0';
const urlsToCache = [
  './',
  '../index.html',
  '/manifest.json',
  '../../css/base.css',
  '../../css/components.css',
  '../../css/lock.css',
  '../models/config.js',
  '../models/audio.js',
  '../models/notification.js',
  '../models/stats.js',
  '../models/reminder.js',
  '../models/ui.js',
  './app.js'
];

// 安装 Service Worker
self.addEventListener('install', event => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

// 激活 Service Worker
self.addEventListener('activate', event => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// 拦截请求，返回缓存
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 缓存命中，返回缓存
        if (response) {
          return response;
        }
        // 否则发起网络请求
        return fetch(event.request)
          .then(response => {
            // 不缓存非 GET 请求
            if (!event.request.url.includes('chrome-extension') && 
                event.request.method === 'GET') {
              return caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, response.clone());
                  return response;
                });
            }
            return response;
          });
      })
      .catch(() => {
        // 网络请求失败，返回离线页面
        return caches.match('src/renderer/index.html');
      })
  );
});

// 后台同步（用于离线提醒）
self.addEventListener('sync', event => {
  console.log('[SW] Sync', event.tag);
  if (event.tag === 'reminder-sync') {
    event.waitUntil(
      self.registration.showNotification('🧘 别坐了', {
        body: '该活动啦！站起来走走吧！',
        icon: '../../icons/icon-192.png',
        badge: '../../icons/icon-96.png',
        vibrate: [200, 100, 200],
        tag: 'health-reminder',
        requireInteraction: true
      })
    );
  }
});

// 推送通知
self.addEventListener('push', event => {
  console.log('[SW] Push', event);
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || '🧘 别坐了', {
      body: data.body || '该活动啦！站起来走走，伸个懒腰！',
      icon: './icons/icon-192.png',
      badge: './icons/icon-96.png',
      vibrate: [200, 100, 200],
      tag: 'health-reminder',
      requireInteraction: true
    })
  );
});