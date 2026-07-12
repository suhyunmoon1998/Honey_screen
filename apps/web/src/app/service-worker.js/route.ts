import {
  PUBLIC_IMMUTABLE_CACHE_PATHS,
  SERVICE_WORKER_CACHE_NAME,
} from "@/lib/pwa-cache-policy";

export const dynamic = "force-static";

function buildServiceWorkerSource() {
  return `
const CACHE_NAME = ${JSON.stringify(SERVICE_WORKER_CACHE_NAME)};
const PUBLIC_IMMUTABLE_CACHE_PATHS = ${JSON.stringify(PUBLIC_IMMUTABLE_CACHE_PATHS)};
const NEXT_STATIC_ASSET_PATTERN = /^\\/_next\\/static\\/.+\\.(js|css)$/;

function isPrefetch(headers) {
  return (
    headers.get("rsc") === "1" ||
    headers.get("next-router-prefetch") === "1" ||
    headers.get("x-middleware-prefetch") === "1" ||
    headers.get("purpose") === "prefetch"
  );
}

function classify(request) {
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return "network_only";
  }

  if (isPrefetch(request.headers)) {
    return "network_only";
  }

  if (request.mode === "navigate") {
    return "navigation_network_first";
  }

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/mission/") ||
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/reward") ||
    url.pathname.startsWith("/onboarding") ||
    url.pathname.startsWith("/staff/") ||
    url.pathname.startsWith("/invite/")
  ) {
    return "network_only";
  }

  if (
    PUBLIC_IMMUTABLE_CACHE_PATHS.includes(url.pathname) ||
    NEXT_STATIC_ASSET_PATTERN.test(url.pathname)
  ) {
    return "cache_public_asset";
  }

  return "network_only";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_IMMUTABLE_CACHE_PATHS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const classification = classify(event.request);

  if (classification === "cache_public_asset") {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          const clone = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)),
          );
          return response;
        });
      }),
    );
    return;
  }

  if (classification === "navigation_network_first") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (
          (await cache.match("/offline.html")) ||
          new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          })
        );
      }),
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
`.trim();
}

export async function GET() {
  return new Response(buildServiceWorkerSource(), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
