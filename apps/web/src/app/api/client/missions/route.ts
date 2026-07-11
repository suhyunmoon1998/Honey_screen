import { requireClientSession } from "@/lib/authz";
import { noStoreRedirect } from "@/lib/http";
import { getOrCreateMission } from "@/lib/services";

export async function POST(request: Request) {
  const session = await requireClientSession();
  const mission = await getOrCreateMission({
    clientId: session.actorId,
    organizationId: session.organizationId,
    locale: (session.locale === "en" ? "en" : "es") as "es" | "en",
    missionKind: "QUICK",
  });

  return noStoreRedirect(new URL(`/mission/${mission.id}`, request.url));
}
