const CACHE_VERSION = "v3";
const CACHE_NAME = `me-pague-${CACHE_VERSION}`;

// Assets estaticos seguros para cachear no install
const PRECACHE_ASSETS = [
  "/logo.jpeg",
  "/manifest.json",
  "/icons/icon.svg",
];

// Instala o SW e pré-cacheia os assets essenciais
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

// Ativa o novo SW e limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("me-pague-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return url.pathname.startsWith("/icons/") || url.pathname === "/logo.jpeg" || url.pathname === "/manifest.json";
}

// Estrategia: network-first com fallback para cache apenas em assets estaticos.
// Paginas e rotas autenticadas precisam ir sempre para a rede/Next.
self.addEventListener("fetch", (event) => {
  // So intercepta requisicoes GET de mesma origem
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate" || event.request.destination === "document") return;
  if (!isCacheableAsset(url)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cacheia a resposta bem-sucedida de assets estaticos
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }

        return response;
      })
      .catch(() =>
        // Fallback para cache quando offline
        caches.match(event.request).then((cached) => cached || Response.error()),
      ),
  );
});

// Handler de push notification
self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Me Pague";
  const options = {
    badge: payload.badge || "/logo.jpeg",
    body: payload.body || "Voce tem uma atualizacao de recebimento.",
    data: {
      url: payload.url || "/",
    },
    icon: payload.icon || "/logo.jpeg",
    tag: payload.tag || "me-pague-reminder",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handler de clique na notificação
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url.startsWith(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
