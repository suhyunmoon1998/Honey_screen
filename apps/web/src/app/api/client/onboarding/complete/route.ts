import { requireClientSession } from "@/lib/authz";
import { noStoreRedirect } from "@/lib/http";
import { completeOnboarding } from "@/lib/services";
import { resolveTimeZone } from "@/lib/timezone";

export async function GET(request: Request) {
  const session = await requireClientSession();
  const timeZone = resolveTimeZone(new URL(request.url).searchParams.get("tz"));
  await completeOnboarding({
    clientId: session.actorId,
    timeZone,
    locale: (session.locale === "en" ? "en" : "es") as "es" | "en",
  });
  return noStoreRedirect(new URL("/dashboard", request.url));
}
