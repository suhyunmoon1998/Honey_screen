import { z } from "zod";
import { noStoreJson } from "@/lib/http";
import { requireClientSession } from "@/lib/authz";
import { emitOperationalEvent } from "@/lib/operational-events";

const schema = z.object({
  permission: z.enum(["default", "granted", "denied"]),
});

export async function POST(request: Request) {
  const session = await requireClientSession();

  try {
    const body = schema.parse(await request.json());

    if (body.permission === "default") {
      await emitOperationalEvent({
        eventName: "notification_permission_requested",
        result: "STARTED",
        reasonCode: "PERMISSION_REQUESTED",
        resourceId: session.actorId,
      });
    } else if (body.permission === "granted") {
      await emitOperationalEvent({
        eventName: "notification_permission_granted",
        result: "SUCCESS",
        reasonCode: "PERMISSION_GRANTED",
        resourceId: session.actorId,
      });
    } else {
      await emitOperationalEvent({
        eventName: "notification_permission_denied",
        result: "REJECTED",
        reasonCode: "PERMISSION_DENIED",
        resourceId: session.actorId,
      });
    }

    return noStoreJson({ ok: true });
  } catch {
    return noStoreJson(
      { error: "Invalid permission payload." },
      { status: 400 },
    );
  }
}
