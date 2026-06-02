const CACHE_VERSION = "v1";
const CACHE_NAME = `me-pague-${CACHE_VERSION}`;

// Assets estáticos para cachear no install
const PRECACHE_ASSETS = [
  "/",
  "/login",
  "/logo.jpeg",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
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

// Estratégia: network-first com fallback para cache
self.addEventListener("fetch", (event) => {
  // Só intercepta requisições GET de mesma origem
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // API routes: nunca interceptar (sempre vai para a rede)
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cacheia a resposta bem-sucedida de assets estáticos
        if (response.ok && (url.pathname.startsWith("/icons/") || url.pathname === "/logo.jpeg")) {
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
