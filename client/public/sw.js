self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'إشعار جديد', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'سوق ميت جابر';
  const options = {
    body: data.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    dir: 'rtl',
    lang: 'ar',
    data: data.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: data.data?.subOrderId || data.data?.orderId || 'default',
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

function getNavigationUrl(notifData) {
  if (!notifData) return '/';
  const type = notifData.type;
  if (type === 'NEW_ORDER' || type === 'ORDER_STATUS_UPDATE') {
    if (notifData.subOrderId || notifData.orderId) {
      return '/customer/store/orders';
    }
    return '/customer/orders';
  }
  if (type === 'NEW_OFFER') return '/customer/orders';
  if (type === 'OFFER_ACCEPTED' || type === 'OFFER_REJECTED' || type === 'OFFER_COUNTERED') {
    return '/driver/tasks';
  }
  if (type === 'ACCOUNT_APPROVED') return '/';
  if (type === 'DEPOSIT_APPROVED' || type === 'DEPOSIT_REJECTED' || type === 'WALLET_UPDATE') {
    return '/customer/wallet';
  }
  if (type === 'WITHDRAWAL_APPROVED' || type === 'WITHDRAWAL_REJECTED') {
    return '/customer/wallet';
  }
  if (type === 'SYSTEM_ALERT') {
    if (notifData.role === 'ADMIN' || notifData.userId) return '/admin/approvals';
    return '/';
  }
  return '/';
}

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const notifData = event.notification.data || {};
  const targetUrl = getNavigationUrl(notifData);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
