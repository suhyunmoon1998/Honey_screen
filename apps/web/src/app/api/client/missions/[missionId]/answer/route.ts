import { z } from "zod";
import { requireClientSession } from "@/lib/authz";
import { noStoreJson } from "@/lib/http";
import { getMissionForClient, saveMissionAnswer } from "@/lib/services";

const schema = z.object({
  missionSlotId: z.string().min(1),
  value: z.boolean(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ missionId: string }> },
) {
  const session = await requireClientSession();
  const { missionId } = await context.params;

  try {
    const body = schema.parse(await request.json());
    await saveMissionAnswer({
      missionId,
      clientId: session.actorId,
      missionSlotId: body.missionSlotId,
      idempotencyKey: `${body.missionSlotId}:${body.value}`,
      value: body.value,
    });

    const mission = await getMissionForClient(missionId, session.actorId);

    return noStoreJson({
      redirectTo:
        mission?.state === "COMPLETED" ? "/reward" : `/mission/${missionId}`,
    });
  } catch {
    return noStoreJson(
      { error: "No se pudo guardar la respuesta." },
      { status: 400 },
    );
  }
}
