const SW_VERSION = "flopitec-sw-v3";
const STATIC_CACHE = `${SW_VERSION}-static`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./supabase.js",
  "./utils.js",
  "./app.js",
];

const ALLOWED_STATIC_DESTINATIONS = new Set([
  "style",
  "script",
  "image",
  "font",
  "document",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);

      await Promise.all(
        APP_SHELL.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch (error) {
            console.warn("No se pudo precachear el recurso:", asset, error);
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== RUNTIME_CACHE) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (!shouldHandleRequest(url, request)) {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (isStaticLocalAsset(url, request)) {
    event.respondWith(handleStaticAssetRequest(request));
    return;
  }

  event.respondWith(handleRuntimeRequest(request));
});

function shouldHandleRequest(url, request) {
  if (url.origin !== self.location.origin) {
    return false;
  }

  if (url.pathname.startsWith("/storage/")) {
    return false;
  }

  if (url.pathname.includes("/auth/v1/")) {
    return false;
  }

  if (url.pathname.includes("/rest/v1/")) {
    return false;
  }

  if (url.pathname.includes("/functions/v1/")) {
    return false;
  }

  if (request.headers.get("cache-control") === "no-store") {
    return false;
  }

  return true;
}

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

function isStaticLocalAsset(url, request) {
  const pathname = url.pathname;

  if (
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".ttf")
  ) {
    return true;
  }

  return ALLOWED_STATIC_DESTINATIONS.has(request.destination);
}

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const appShell = await caches.match("./index.html");
    if (appShell) {
      return appShell;
    }

    return new Response("Sin conexión.", {
      status: 503,
      statusText: "Service Unavailable",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}

async function handleStaticAssetRequest(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (isResponseCacheable(networkResponse)) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    return cachedResponse || Response.error();
  }
}

async function handleRuntimeRequest(request) {
  try {
    const networkResponse = await fetch(request);

    if (isResponseCacheable(networkResponse)) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    return Response.error();
  }
}

function isResponseCacheable(response) {
  if (!response) return false;
  if (response.status !== 200) return false;
  if (response.type === "opaque") return false;
  return true;
}