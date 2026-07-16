import { PrismaClient, prisma } from "@honey/db";
import { resetEnvForTests } from "@honey/config";
import { resetDatabase } from "../../packages/testing/src/db";
import {
  disableMissionReminderPreference,
  enableMissionReminderPreference,
} from "../../apps/web/src/lib/notification-preferences";
import {
  requestOtp,
  verifyOtpAndRegister,
} from "../../apps/web/src/lib/services";
import {
  claimNotificationIntents,
  createWorkerDependencies,
  processClaimedIntent,
  projectPendingOutboxEvents,
} from "../../apps/worker/src/notifications";
import {
  createSchedulerDependencies,
  processReminderSchedulerBatch,
} from "../../apps/worker/src/reminder-scheduler";

async function registerClient(locale: "es" | "en" = "es") {
  await requestOtp({
    token: "honey-demo-invite",
    rawPhone: "(555) 555-0101",
    locale,
    acceptedPrivacy: true,
    acceptedMessages: true,
  });

  return verifyOtpAndRegister({
    token: "honey-demo-invite",
    rawPhone: "(555) 555-0101",
    code: "246810",
    locale,
  });
}

function createReadyWorkerDependencies(
  now = new Date("2026-07-14T01:10:00.000Z"),
) {
  return createWorkerDependencies({
    clock: {
      now: () => now,
    },
  });
}

async function enableReminderPreference(
  now = new Date("2026-07-14T00:55:00.000Z"),
) {
  const registration = await registerClient();

  const beforeProfile = await prisma.honeyProfile.findUnique({
    where: { clientId: registration.client.id },
  });

  await enableMissionReminderPreference({
    clientId: registration.client.id,
    organizationId: registration.client.organizationId,
    locale: "es",
    preferredLocalTime: "18:00",
    consentVersion: "2026-07-12",
    anonymousDeviceId: "device-reminder-1",
    platformHint: "test",
    subscription: {
      endpoint: "https://push.example.test/reminder-1",
      p256dh: "p256dh-key",
      auth: "auth-key",
    },
  });

  const afterProfile = await prisma.honeyProfile.findUnique({
    where: { clientId: registration.client.id },
  });

  expect(afterProfile?.totalPoints ?? 0).toBe(beforeProfile?.totalPoints ?? 0);

  return {
    registration,
    schedulerDeps: createSchedulerDependencies({
      clock: {
        now: () => now,
      },
    }),
  };
}

describe("reminder scheduler integration", () => {
  beforeEach(async () => {
    resetEnvForTests();
    await resetDatabase();
  });

  it("two scheduler instances create one occurrence across 20 races", async () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      await resetDatabase();
      const { schedulerDeps } = await enableReminderPreference();
      const clientA = new PrismaClient();
      const clientB = new PrismaClient();

      try {
        await Promise.all([
          processReminderSchedulerBatch({
            ...schedulerDeps,
            prisma: clientA as typeof prisma,
          }),
          processReminderSchedulerBatch({
            ...schedulerDeps,
            prisma: clientB as typeof prisma,
          }),
        ]);

        expect(await prisma.reminderOccurrence.count()).toBe(1);
        expect(
          await prisma.outboxEvent.count({
            where: { eventType: "CLIENT_MISSION_REMINDER" },
          }),
        ).toBe(1);
      } finally {
        await clientA.$disconnect();
        await clientB.$disconnect();
      }
    }
  });

  it("three scheduler instances create one occurrence across 10 races", async () => {
    for (let iteration = 0; iteration < 10; iteration += 1) {
      await resetDatabase();
      const { schedulerDeps } = await enableReminderPreference();
      const clients = [
        new PrismaClient(),
        new PrismaClient(),
        new PrismaClient(),
      ];

      try {
        await Promise.all(
          clients.map((client) =>
            processReminderSchedulerBatch({
              ...schedulerDeps,
              prisma: client as typeof prisma,
            }),
          ),
        );

        expect(await prisma.reminderOccurrence.count()).toBe(1);
      } finally {
        await Promise.all(clients.map((client) => client.$disconnect()));
      }
    }
  });

  it("reruns without duplicate occurrence, outbox event, or intent", async () => {
    const { registration, schedulerDeps } = await enableReminderPreference();
    const workerDeps = createReadyWorkerDependencies();

    await processReminderSchedulerBatch(schedulerDeps);
    await processReminderSchedulerBatch(schedulerDeps);
    await projectPendingOutboxEvents(workerDeps);
    await projectPendingOutboxEvents(workerDeps);

    expect(await prisma.reminderOccurrence.count()).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: {
          eventType: "CLIENT_MISSION_REMINDER",
        },
      }),
    ).toBe(1);
    expect(
      await prisma.notificationIntent.count({
        where: {
          clientId: registration.client.id,
          channel: "WEB_PUSH",
        },
      }),
    ).toBe(1);
  });

  it("suppresses delivery when the preference is disabled before dispatch", async () => {
    const { registration, schedulerDeps } = await enableReminderPreference(
      new Date("2026-07-14T01:10:00.000Z"),
    );
    const workerDeps = createReadyWorkerDependencies(
      new Date("2026-07-14T01:15:00.000Z"),
    );

    await processReminderSchedulerBatch(schedulerDeps);
    await projectPendingOutboxEvents(workerDeps);
    await disableMissionReminderPreference({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
      anonymousDeviceId: "device-reminder-1",
    });

    const claimed = await claimNotificationIntents(workerDeps, 10);
    const reminderIntent = claimed.find(
      (intent) =>
        intent.clientId === registration.client.id &&
        intent.channel === "WEB_PUSH",
    );

    expect(reminderIntent).toBeDefined();
    await processClaimedIntent(workerDeps, reminderIntent!);

    const intent = await prisma.notificationIntent.findUniqueOrThrow({
      where: { id: reminderIntent!.id },
    });
    const occurrence = await prisma.reminderOccurrence.findFirstOrThrow({
      where: {
        notificationIntentId: reminderIntent!.id,
      },
    });

    expect(intent.status).toBe("SUPPRESSED");
    expect(occurrence.status).toBe("SUPPRESSED");
    expect(occurrence.suppressionReason).toBe("preference_disabled");
  });

  it("records consent revocation and disabling remains idempotent", async () => {
    const { registration } = await enableReminderPreference();

    await disableMissionReminderPreference({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
      anonymousDeviceId: "device-reminder-1",
    });
    await disableMissionReminderPreference({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
      anonymousDeviceId: "device-reminder-1",
    });

    const preference = await prisma.notificationPreference.findUniqueOrThrow({
      where: {
        clientId_purpose_channel: {
          clientId: registration.client.id,
          purpose: "MISSION_REMINDER",
          channel: "WEB_PUSH",
        },
      },
    });
    const revocations = await prisma.consentRecord.findMany({
      where: {
        clientId: registration.client.id,
        consentType: "MISSION_REMINDER_WEB_PUSH",
        granted: false,
      },
    });
    const profile = await prisma.honeyProfile.findUnique({
      where: { clientId: registration.client.id },
    });

    expect(preference.enabled).toBe(false);
    expect(revocations.length).toBeGreaterThan(0);
    expect(profile?.totalPoints ?? 0).toBe(0);
  });
});
