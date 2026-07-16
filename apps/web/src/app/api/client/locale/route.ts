import { prisma } from "@honey/db";
import { requireClientSession } from "@/lib/authz";
import { noStoreRedirect } from "@/lib/http";
import { resolveLocale } from "@/lib/locale";

function safeRedirectPath(path: string | null, fallback: string) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }

  return path;
}

export async function GET(request: Request) {
  const session = await requireClientSession();
  const url = new URL(request.url);
  const locale = resolveLocale(url.searchParams.get("lang"));
  const redirectPath = safeRedirectPath(
    url.searchParams.get("redirectTo"),
    "/dashboard",
  );

  await prisma.session.update({
    where: { tokenHash: session.tokenHash },
    data: { locale },
  });

  await prisma.client.update({
    where: { id: session.actorId },
    data: { locale },
  });

  return noStoreRedirect(new URL(redirectPath, request.url));
}
