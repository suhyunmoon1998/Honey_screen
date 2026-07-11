import { requireClientSession } from "@/lib/authz";
import { noStoreRedirect } from "@/lib/http";
import { completeOnboarding } from "@/lib/services";

export async function GET(request: Request) {
  const session = await requireClientSession();
  await completeOnboarding({
    clientId: session.actorId,
    timeZone: "America/Los_Angeles",
    locale: (session.locale === "en" ? "en" : "es") as "es" | "en",
  });
  return noStoreRedirect(new URL("/dashboard", request.url));
}
