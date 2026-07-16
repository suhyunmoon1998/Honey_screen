import { z } from "zod";
import { noStoreJson } from "@/lib/http";
import { requireClientSession } from "@/lib/authz";
import {
  disableMissionReminderPreference,
  enableMissionReminderPreference,
  getClientNotificationSettings,
} from "@/lib/notification-preferences";

const enableSchema = z.object({
  preferredLocalTime: z.string().min(1),
  consentVersion: z.string().min(1),
  anonymousDeviceId: z.string().min(8),
  platformHint: z.string().optional(),
  permission: z.enum(["default", "granted", "denied"]),
  subscription: z.object({
    endpoint: z.string().min(1),
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const disableSchema = z.object({
  anonymousDeviceId: z.string().optional(),
});

export async function GET() {
  const session = await requireClientSession();
  const settings = await getClientNotificationSettings({
    clientId: session.actorId,
    organizationId: session.organizationId,
  });

  return noStoreJson({
    ...settings,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
  });
}

export async function PUT(request: Request) {
  const session = await requireClientSession();

  try {
    const body = enableSchema.parse(await request.json());

    if (body.permission !== "granted") {
      return noStoreJson(
        { error: "Permission was not granted." },
        { status: 400 },
      );
    }

    const settings = await enableMissionReminderPreference({
      clientId: session.actorId,
      organizationId: session.organizationId,
      locale: session.locale === "en" ? "en" : "es",
      preferredLocalTime: body.preferredLocalTime,
      consentVersion: body.consentVersion,
      anonymousDeviceId: body.anonymousDeviceId,
      platformHint: body.platformHint,
      subscription: body.subscription,
    });

    return noStoreJson(settings);
  } catch {
    return noStoreJson(
      { error: "No fue posible activar los recordatorios." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await requireClientSession();

  try {
    const body = disableSchema.parse(await request.json());
    const settings = await disableMissionReminderPreference({
      clientId: session.actorId,
      organizationId: session.organizationId,
      locale: session.locale === "en" ? "en" : "es",
      anonymousDeviceId: body.anonymousDeviceId,
    });

    return noStoreJson(settings);
  } catch {
    return noStoreJson(
      { error: "No fue posible desactivar los recordatorios." },
      { status: 400 },
    );
  }
}
