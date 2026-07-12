const NEXT_STATIC_ASSET_PATTERN = /^\/_next\/static\/.+\.(js|css)$/;

export const SERVICE_WORKER_CACHE_NAME = "honey-public-static-v1";
export const PUBLIC_IMMUTABLE_CACHE_PATHS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/honey-source.png",
  "/file.svg",
  "/globe.svg",
  "/next.svg",
  "/vercel.svg",
  "/window.svg",
] as const;

export type ServiceWorkerRequestKind =
  | "cache_public_asset"
  | "network_only"
  | "navigation_network_first";

export function isNextDataPrefetchRequest(headers: Record<string, string>) {
  return (
    headers["rsc"] === "1" ||
    headers["next-router-prefetch"] === "1" ||
    headers["x-middleware-prefetch"] === "1" ||
    headers["purpose"] === "prefetch"
  );
}

export function classifyServiceWorkerRequest(input: {
  url: string;
  method: string;
  mode?: string;
  destination?: string;
  headers?: Record<string, string>;
}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(input.headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      value.toLowerCase(),
    ]),
  );
  const url = new URL(input.url, "http://localhost");
  const pathname = url.pathname;

  if (input.method.toUpperCase() !== "GET") {
    return "network_only" satisfies ServiceWorkerRequestKind;
  }

  if (isNextDataPrefetchRequest(normalizedHeaders)) {
    return "network_only" satisfies ServiceWorkerRequestKind;
  }

  if (input.mode === "navigate") {
    return "navigation_network_first" satisfies ServiceWorkerRequestKind;
  }

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/mission/") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/reward") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/staff/") ||
    pathname.startsWith("/invite/")
  ) {
    return "network_only" satisfies ServiceWorkerRequestKind;
  }

  if (
    PUBLIC_IMMUTABLE_CACHE_PATHS.includes(
      pathname as (typeof PUBLIC_IMMUTABLE_CACHE_PATHS)[number],
    ) ||
    NEXT_STATIC_ASSET_PATTERN.test(pathname)
  ) {
    return "cache_public_asset" satisfies ServiceWorkerRequestKind;
  }

  return "network_only" satisfies ServiceWorkerRequestKind;
}
