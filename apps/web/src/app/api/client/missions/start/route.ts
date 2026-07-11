import { requireClientSession } from "@/lib/authz";
import { noStoreRedirect } from "@/lib/http";
import { getOrCreateMission } from "@/lib/services";

export async function GET(request: Request) {
  const session = await requireClientSession();
  const kind = new URL(request.url).searchParams.get("kind");
  const missionKind =
    kind === "standard" ? "STANDARD" : kind === "full" ? "FULL" : "QUICK";

  try {
    const mission = await getOrCreateMission({
      clientId: session.actorId,
      organizationId: session.organizationId,
      locale: (session.locale === "en" ? "en" : "es") as "es" | "en",
      missionKind,
    });
    return noStoreRedirect(new URL(`/mission/${mission.id}`, request.url));
  } catch (error) {
    if (error instanceof Error && error.message === "DAILY_CAP_REACHED") {
      return noStoreRedirect(
        new URL("/dashboard?status=daily-cap", request.url),
      );
    }

    throw error;
  }
}
