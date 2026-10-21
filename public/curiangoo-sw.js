/**
 * Service Worker do Curiangoo — v2 (curiangoo-sw.js)
 *
 * POR QUE NOME NOVO: o Chrome serve /sw.js do cache HTTP por até 24h — updates presos.
 * Arquivo novo = nunca cacheado = o PWA pega a versão nova na 1ª abertura.
 *
 * Push: notificação com som do canal do sistema (determinístico, app fechado ou aberto).
 * O piu do Curiango com app aberto é tocado pela PÁGINA via Supabase Realtime
 * (src/services/realtime-piu.ts) — direto banco→página, sem SW, sem handshake.
 */

const SW_VERSION = 'curiangoo-sw-v2'
const STATIC_CACHE_NAME = `static-${SW_VERSION}`

const PRECACHE_ASSETS = ['/', '/manifest.json', '/icon.svg', '/icon-maskable.svg', '/favicon.ico']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pré-cache parcial finalizado com alerta:', err)
      })
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== STATIC_CACHE_NAME) {
              return caches.delete(name)
            }
            return Promise.resolve()
          }),
        )
      }),
      self.clients.claim().then(() => {
        return self.clients
          .matchAll({ type: 'window', includeUncontrolled: true })
          .then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: 'SW_VERSION_ACTIVATED',
                version: SW_VERSION,
              })
            })
          })
      }),
    ]),
  )
})

self.addEventListener('message', (event) => {
  if (!event.data) return

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ version: SW_VERSION })
  }
})

// ===== WEB PUSH (Curiangoo — notificações da família) =====
// Simples e determinístico: mostra a notificação com o som do canal do sistema.
// O piu da marca (app aberto) é responsabilidade da página via Realtime — não do SW.
self.addEventListener('push', (event) => {
  let payload = { title: 'Curiangoo', body: 'Nova atividade da família', data: { url: '/inicio' } }
  try {
    if (event.data) {
      const raw = event.data.json()
      payload = {
        title: raw.title || payload.title,
        body: raw.body || payload.body,
        tag: raw.tag,
        data: { url: raw.data?.url || '/inicio', ...(raw.data || {}) },
      }
    }
  } catch (e) {
    console.warn('[SW] push payload inválido:', e)
  }

  const title = payload.title
  const options = {
    body: payload.body,
    // FIX ÍCONE NOTIFICAÇÃO (21/10, relato do Matheus — Samsung Internet): o
    // push-icon antigo tinha fundo TRANSPARENTE e o Android/Samsung caía no
    // fallback do ícone do browser (Saturno). Novo: fundo branco sólido.
    icon: 'https://evcxjxuakiyjerujntli.supabase.co/storage/v1/object/public/branding/push-icon-192-v3.png',
    badge:
      'https://evcxjxuakiyjerujntli.supabase.co/storage/v1/object/public/branding/push-badge-96.png?v=2',
    tag: payload.tag,
    data: payload.data,
    vibrate: [80, 40, 80],
    renotify: !!payload.tag,
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Clique na notificação: foca o app (ou abre) — o piu toca pelo gesto via PLAY_PIU
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/inicio'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          client.postMessage({ type: 'PLAY_PIU' })
          if ('navigate' in client) client.navigate(targetUrl)
          return
        }
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})

// Estratégia de Fetch: navegação NETWORK-FIRST (nunca index.html preso no cache);
// estáticos hashados: Stale-While-Revalidate.
self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  const isSameOrigin = url.origin === self.location.origin

  if (!isSameOrigin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone()
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return networkResponse
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request)
          if (cachedResponse) return cachedResponse
          const rootFallback = await caches.match('/')
          if (rootFallback) return rootFallback
          return new Response('Sem conexão à internet no momento.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone()
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return networkResponse
        })
        .catch(() => cachedResponse)

      return cachedResponse || fetchPromise
    }),
  )
})
