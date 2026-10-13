// Zappit Web Push Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'Zappit Reminder', body: event.data.text() };
    }
  }

  const title = data.title || 'Zappit Follow-up Due';
  const options = {
    body: data.body || 'You have a scheduled follow-up reminder waiting.',
    icon: data.icon || '/brand/zappit-mark.png',
    badge: data.badge || '/brand/zappit-mark.png',
    tag: data.tag || 'zappit-reminder',
    renotify: data.renotify !== false,
    requireInteraction: data.requireInteraction !== false,
    data: data.data || { url: '/dashboard' },
    actions: [
      { action: 'open', title: 'Open Lead' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';
  const urlToOpen = new URL(targetUrl, self.location.origin).href;

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    // 1. Check if there's already a matching window/tab open on this origin
    for (const client of windowClients) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        if ('navigate' in client) {
          client.navigate(urlToOpen);
        }
        return client.focus();
      }
    }
    // 2. If no window open, open new one
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(promiseChain);
});
