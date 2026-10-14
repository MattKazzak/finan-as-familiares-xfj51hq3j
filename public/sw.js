/**
 * Service Worker Oficial do Curiangoo v0.0.328
 *
 * Princípios fundamentais:
 * 1. skipWaiting no install: assume imediatamente o controle assim que baixado.
 * 2. clients.claim() no activate: toma posse de todas as abas e janelas abertas de imediato.
 * 3. Network-first para navegação e HTML: NUNCA serve index.html antigo preso em cache.
 * 4. Limpeza agressiva de caches antigos ao ativar versão nova.
 * 5. Notificação via broadcast/postMessage para as abas quando houver nova versão instalada.
 */

const SW_VERSION = 'curiangoo-v0.0.328'
const STATIC_CACHE_NAME = `static-${SW_VERSION}`

// Recursos estáticos mínimos para pré-cache imediato
const PRECACHE_ASSETS = ['/', '/manifest.json', '/icon.svg', '/icon-maskable.svg', '/favicon.ico']

// Instalação: pré-cache básico e SKIP WAITING IMEDIATO
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      // Pré-cache seguro sem quebrar se algum recurso falhar
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pré-cache parcial finalizado com alerta:', err)
      })
    }),
  )
})

// Ativação: assume clientes imediatamente e deleta caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // 1. Limpa todas as versões antigas de cache
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== STATIC_CACHE_NAME) {
              console.log('[SW] Removendo cache obsoleto:', name)
              return caches.delete(name)
            }
            return Promise.resolve()
          }),
        )
      }),
      // 2. Toma posse imediata de todas as páginas abertas (clients.claim)
      self.clients.claim().then(() => {
        // Notifica todas as abas abertas sobre a ativação da nova versão
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

// Responde a mensagens diretas das abas clientes
self.addEventListener('message', (event) => {
  if (!event.data) return

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ version: SW_VERSION })
  }
})

// Estratégia de Fetch:
// - Para navegações (HTML) e chamadas de API: NETWORK-FIRST com fallback de cache
// - Para arquivos estáticos hashados (/assets/*, imagens): STALE-WHILE-REVALIDATE ou Cache-First
self.addEventListener('fetch', (event) => {
  const request = event.request

  // Ignora chamadas de métodos não-GET (POST, PUT, DELETE, etc.)
  if (request.method !== 'GET') {
    return
  }

  // Não intercepta chamadas de analytics, supabase ou domínios de terceiros sensíveis
  const url = new URL(request.url)
  const isSameOrigin = url.origin === self.location.origin

  // Se não for do mesmo domínio, deixa o navegador lidar nativamente
  if (!isSameOrigin) {
    return
  }

  // Navegação de página (document HTML): NETWORK FIRST obrigatório para garantir tema e bundle atualizados!
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
          // Fallback offline se a rede falhar
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

  // Recursos estáticos do mesmo domínio (scripts, css, imagens, svg, json): Stale-While-Revalidate
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
