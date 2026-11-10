self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'Doña Gloria Bar-Terraza',
      body: event.data ? event.data.text() : 'Nueva actualización de reservación.',
    };
  }

  const title = data.title || 'Doña Gloria Bar-Terraza';
  const options = {
    body: data.body || 'Tienes una actualización en tu reservación.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || 'dg-reservation-push',
    renotify: true,
    data: {
      url: data.url || '/#reservas',
      openGestion: Boolean(data.openGestion),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/#reservas';
  const openGestion = Boolean(event.notification?.data?.openGestion);

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if (openGestion) {
              client.postMessage({ type: 'DG_OPEN_GESTION' });
            }
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
