// Veeb Service Worker — PWA 오프라인 셸 + 네트워크 우선 캐싱
const CACHE_NAME = 'veeb-v3'
const SHELL_ASSETS = ['/', '/index.html']

// 설치: 앱 셸 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

// 활성화: 이전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// 요청 처리: 네트워크 우선, 실패 시 캐시 폴백
self.addEventListener('fetch', (event) => {
  // Supabase API / Realtime은 캐싱하지 않음
  if (event.request.url.includes('supabase.co')) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 성공 응답 캐싱 (GET만)
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
