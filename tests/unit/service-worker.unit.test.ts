import {
  classifyServiceWorkerRequest,
  isNextDataPrefetchRequest,
} from "../../apps/web/src/lib/pwa-cache-policy";

describe("service worker cache policy", () => {
  it("caches only explicit public immutable assets", () => {
    expect(
      classifyServiceWorkerRequest({
        url: "http://localhost:3000/manifest.webmanifest",
        method: "GET",
      }),
    ).toBe("cache_public_asset");

    expect(
      classifyServiceWorkerRequest({
        url: "http://localhost:3000/_next/static/chunks/app.js",
        method: "GET",
      }),
    ).toBe("cache_public_asset");
  });

  it("keeps authenticated pages, client APIs, and non-GET requests out of CacheStorage", () => {
    expect(
      classifyServiceWorkerRequest({
        url: "http://localhost:3000/dashboard",
        method: "GET",
        mode: "navigate",
      }),
    ).toBe("navigation_network_first");

    expect(
      classifyServiceWorkerRequest({
        url: "http://localhost:3000/api/client/missions/start",
        method: "GET",
      }),
    ).toBe("network_only");

    expect(
      classifyServiceWorkerRequest({
        url: "http://localhost:3000/api/client/missions/mission-1/answer",
        method: "POST",
      }),
    ).toBe("network_only");
  });

  it("treats RSC and prefetch signals as non-cacheable", () => {
    expect(
      isNextDataPrefetchRequest({
        rsc: "1",
      }),
    ).toBe(true);

    expect(
      classifyServiceWorkerRequest({
        url: "http://localhost:3000/dashboard",
        method: "GET",
        headers: {
          rsc: "1",
        },
      }),
    ).toBe("network_only");

    expect(
      classifyServiceWorkerRequest({
        url: "http://localhost:3000/dashboard",
        method: "GET",
        headers: {
          "next-router-prefetch": "1",
        },
      }),
    ).toBe("network_only");
  });
});
