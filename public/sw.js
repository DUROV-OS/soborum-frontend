// Service worker Durov OS (0080-e): минимальный — только показ входящего
// браузерного push как системного уведомления ОС. Никакого офлайн-кэша
// страниц тут нет и не планируется, задача уже рассылки, а не PWA.

self.addEventListener('install', () => {
  // Сразу активируется, без ожидания закрытия старых вкладок — это не
  // кэширующий воркер, старая версия ничего не держит открытым.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = { title: 'Durov OS', body: '' }
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() }
    } catch {
      payload.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Durov OS', {
      body: payload.body || '',
      icon: '/meme.jpg',
      tag: payload.title,
    }),
  )
})

// Клик по системному уведомлению — просто выводит приложение на передний
// план (фокус уже открытой вкладки или открытие новой на корне). Переход
// на конкретную карточку уведомления — задача 0080-d (там есть object_type/
// object_id), здесь решается только видимость самого push.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})
