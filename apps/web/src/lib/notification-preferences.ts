import { getEnv } from "@honey/config";
import { prisma } from "@honey/db";
import { assertPreferredReminderTimeAllowed, type Locale } from "@honey/domain";
import { emitOperationalEvent } from "./operational-events";
import {
  getClientPushSubscriptionState,
  revokeClientPushSubscriptionsInTransaction,
  upsertPushSubscriptionInTransaction,
} from "./push-subscriptions";

const REMINDER_CONSENT_TYPE = "MISSION_REMINDER_WEB_PUSH";

function getAllowedReminderTimes() {
  return getEnv()
    .ALLOWED_REMINDER_TIME_CHOICES.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function getClientNotificationSettings(input: {
  clientId: string;
  organizationId: string;
}) {
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: input.clientId },
    select: {
      id: true,
      locale: true,
      timeZone: true,
    },
  });

  const preference = await prisma.notificationPreference.findUnique({
    where: {
      clientId_purpose_channel: {
        clientId: input.clientId,
        purpose: "MISSION_REMINDER",
        channel: "WEB_PUSH",
      },
    },
    select: {
      enabled: true,
      preferredLocalTime: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      consentVersion: true,
      enabledAt: true,
      disabledAt: true,
      updatedAt: true,
    },
  });

  const pushState = await getClientPushSubscriptionState(input);

  return {
    clientLocale: client.locale,
    timeZone: client.timeZone,
    allowedReminderTimes: getAllowedReminderTimes(),
    preference: {
      enabled: preference?.enabled ?? false,
      preferredLocalTime:
        preference?.preferredLocalTime ??
        getAllowedReminderTimes().at(-1) ??
        "18:00",
      quietHoursStart:
        preference?.quietHoursStart ?? getEnv().DEFAULT_QUIET_HOURS_START,
      quietHoursEnd:
        preference?.quietHoursEnd ?? getEnv().DEFAULT_QUIET_HOURS_END,
      consentVersion: preference?.consentVersion ?? null,
      enabledAt: preference?.enabledAt ?? null,
      disabledAt: preference?.disabledAt ?? null,
      updatedAt: preference?.updatedAt ?? null,
    },
    subscription: pushState,
    simulatedEnvironment:
      !getEnv().PUSH_DELIVERY_ENABLED ||
      !getEnv().VAPID_PUBLIC_KEY ||
      !getEnv().VAPID_PRIVATE_KEY,
    consentVersion: getEnv().NOTIFICATION_CONSENT_VERSION,
  };
}

export async function enableMissionReminderPreference(input: {
  clientId: string;
  organizationId: string;
  locale: Locale;
  preferredLocalTime: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  consentVersion: string;
  anonymousDeviceId: string;
  platformHint?: string;
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  };
}) {
  if (!input.consentVersion) {
    throw new Error("CONSENT_VERSION_REQUIRED");
  }

  const quietHoursStart =
    input.quietHoursStart ?? getEnv().DEFAULT_QUIET_HOURS_START;
  const quietHoursEnd = input.quietHoursEnd ?? getEnv().DEFAULT_QUIET_HOURS_END;
  const allowedReminderTimes = getAllowedReminderTimes();

  assertPreferredReminderTimeAllowed({
    preferredLocalTime: input.preferredLocalTime,
    quietHoursStart,
    quietHoursEnd,
    allowedReminderTimes,
  });

  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.findUniqueOrThrow({
      where: { id: input.clientId },
      select: {
        id: true,
        organizationId: true,
        timeZone: true,
      },
    });

    const subscription = await upsertPushSubscriptionInTransaction(tx, {
      clientId: input.clientId,
      organizationId: input.organizationId,
      anonymousDeviceId: input.anonymousDeviceId,
      platformHint: input.platformHint,
      endpoint: input.subscription.endpoint,
      p256dh: input.subscription.p256dh,
      auth: input.subscription.auth,
    });

    const preference = await tx.notificationPreference.upsert({
      where: {
        clientId_purpose_channel: {
          clientId: input.clientId,
          purpose: "MISSION_REMINDER",
          channel: "WEB_PUSH",
        },
      },
      update: {
        enabled: true,
        preferredLocalTime: input.preferredLocalTime,
        quietHoursStart,
        quietHoursEnd,
        consentVersion: input.consentVersion,
        enabledAt: new Date(),
        disabledAt: null,
        timeZoneAtPreferenceChange: client.timeZone,
        pushSubscriptionId: subscription.id,
      },
      create: {
        organizationId: input.organizationId,
        clientId: input.clientId,
        purpose: "MISSION_REMINDER",
        channel: "WEB_PUSH",
        enabled: true,
        preferredLocalTime: input.preferredLocalTime,
        quietHoursStart,
        quietHoursEnd,
        consentVersion: input.consentVersion,
        enabledAt: new Date(),
        timeZoneAtPreferenceChange: client.timeZone,
        pushSubscriptionId: subscription.id,
      },
    });

    await tx.consentRecord.create({
      data: {
        clientId: input.clientId,
        consentType: REMINDER_CONSENT_TYPE,
        purpose: "MISSION_REMINDER",
        channel: "WEB_PUSH",
        granted: true,
        policyVersion: input.consentVersion,
        locale: input.locale,
        actorType: "CLIENT",
        actorId: input.clientId,
        timeZone: client.timeZone,
        installationId: input.anonymousDeviceId,
      },
    });

    await tx.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorType: "CLIENT",
        actorId: input.clientId,
        action: "NOTIFICATION_PREFERENCE_ENABLED",
        targetType: "NOTIFICATION_PREFERENCE",
        targetId: preference.id,
        metadataJson: {
          purpose: "MISSION_REMINDER",
          channel: "WEB_PUSH",
          preferredLocalTime: input.preferredLocalTime,
        },
      },
    });

    return {
      preferenceId: preference.id,
      subscriptionId: subscription.id,
      timeZone: client.timeZone,
    };
  });

  await emitOperationalEvent({
    eventName: "notification_preference_enabled",
    result: "SUCCESS",
    reasonCode: "PREFERENCE_ENABLED",
    resourceId: result.preferenceId,
  });
  await emitOperationalEvent({
    eventName: "push_subscription_created",
    result: "SUCCESS",
    reasonCode: "SUBSCRIPTION_CREATED",
    resourceId: result.subscriptionId,
  });

  return getClientNotificationSettings(input);
}

export async function disableMissionReminderPreference(input: {
  clientId: string;
  organizationId: string;
  locale: Locale;
  anonymousDeviceId?: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.findUniqueOrThrow({
      where: { id: input.clientId },
      select: {
        id: true,
        organizationId: true,
        timeZone: true,
      },
    });

    const preference = await tx.notificationPreference.upsert({
      where: {
        clientId_purpose_channel: {
          clientId: input.clientId,
          purpose: "MISSION_REMINDER",
          channel: "WEB_PUSH",
        },
      },
      update: {
        enabled: false,
        disabledAt: new Date(),
        pushSubscriptionId: null,
        timeZoneAtPreferenceChange: client.timeZone,
      },
      create: {
        organizationId: input.organizationId,
        clientId: input.clientId,
        purpose: "MISSION_REMINDER",
        channel: "WEB_PUSH",
        enabled: false,
        preferredLocalTime: getAllowedReminderTimes().at(-1) ?? "18:00",
        quietHoursStart: getEnv().DEFAULT_QUIET_HOURS_START,
        quietHoursEnd: getEnv().DEFAULT_QUIET_HOURS_END,
        disabledAt: new Date(),
        timeZoneAtPreferenceChange: client.timeZone,
      },
    });

    await revokeClientPushSubscriptionsInTransaction(tx, {
      clientId: input.clientId,
      organizationId: input.organizationId,
    });

    await tx.consentRecord.create({
      data: {
        clientId: input.clientId,
        consentType: REMINDER_CONSENT_TYPE,
        purpose: "MISSION_REMINDER",
        channel: "WEB_PUSH",
        granted: false,
        policyVersion: getEnv().NOTIFICATION_CONSENT_VERSION,
        locale: input.locale,
        actorType: "CLIENT",
        actorId: input.clientId,
        timeZone: client.timeZone,
        installationId: input.anonymousDeviceId,
      },
    });

    await tx.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorType: "CLIENT",
        actorId: input.clientId,
        action: "NOTIFICATION_PREFERENCE_DISABLED",
        targetType: "NOTIFICATION_PREFERENCE",
        targetId: preference.id,
        metadataJson: {
          purpose: "MISSION_REMINDER",
          channel: "WEB_PUSH",
        },
      },
    });

    return {
      preferenceId: preference.id,
    };
  });

  await emitOperationalEvent({
    eventName: "notification_preference_disabled",
    result: "SUCCESS",
    reasonCode: "PREFERENCE_DISABLED",
    resourceId: result.preferenceId,
  });

  return getClientNotificationSettings(input);
}
