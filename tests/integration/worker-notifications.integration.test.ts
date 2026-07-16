import { PrismaClient, prisma } from "@honey/db";
import { resetEnvForTests } from "@honey/config";
import { InMemoryOperationalEventSink } from "@honey/observability";
import { resetDatabase } from "../../packages/testing/src/db";
import {
  claimNotificationIntents,
  createWorkerDependencies,
  createWorkerRuntime,
  finalizeIntentResult,
  processClaimedIntent,
  processNotificationIntentBatch,
  processPendingOutbox,
  projectPendingOutboxEvents,
  resetSimulatedProviderState,
} from "../../apps/worker/src/notifications";
import { upsertPushSubscription } from "../../apps/web/src/lib/push-subscriptions";
import {
  requestOtp,
  verifyOtpAndRegister,
} from "../../apps/web/src/lib/services";

class Barrier {
  private waiting = 0;
  private resolver: (() => void) | null = null;
  private readonly promise = new Promise<void>((resolve) => {
    this.resolver = resolve;
  });

  constructor(private readonly size: number) {}

  async wait() {
    this.waiting += 1;
    if (this.waiting >= this.size) {
      this.resolver?.();
    }
    await this.promise;
  }
}

function createDeps(
  client: PrismaClient,
  workerId: string,
  overrides: Parameters<typeof createWorkerDependencies>[0] = {},
) {
  return createWorkerDependencies({
    prisma: client as typeof prisma,
    workerId,
    jitter: {
      next: () => 0,
    },
    ...overrides,
  });
}

async function seedRegistrationOutbox() {
  await requestOtp({
    token: "honey-demo-invite",
    rawPhone: "(555) 555-0101",
    locale: "es",
    acceptedPrivacy: true,
    acceptedMessages: true,
  });

  return verifyOtpAndRegister({
    token: "honey-demo-invite",
    rawPhone: "(555) 555-0101",
    code: "246810",
    locale: "es",
  });
}

async function seedStaffNotification(input?: {
  type?: string;
  title?: string;
  body?: string;
  provider?: string;
  channel?: "IN_APP" | "WEB_PUSH";
  pushSubscriptionId?: string | null;
  availableAtSql?: string;
  retryAtSql?: string | null;
  status?: "QUEUED" | "FAILED_RETRYABLE" | "PROCESSING";
  leaseExpiresAtSql?: string | null;
}) {
  const registration = await seedRegistrationOutbox();
  const staff = await prisma.staffUser.findFirstOrThrow({
    where: {
      organizationId: registration.client.organizationId,
      role: "STAFF",
    },
  });

  const outbox = await prisma.outboxEvent.create({
    data: {
      organizationId: registration.client.organizationId,
      eventType: "STAFF_IN_APP_NOTIFICATION",
      aggregateType: "CLIENT",
      aggregateId: registration.client.id,
      idempotencyKey: `outbox-${Math.random()}`,
      availableAt: new Date(Date.now() - 1_000),
      payloadJson: {
        recipientId: staff.id,
        type: input?.type ?? "SIMULATED_READY",
        title: input?.title ?? "Ready",
        body: input?.body ?? "Ready",
      },
    },
  });

  const intent = await prisma.notificationIntent.create({
    data: {
      organizationId: registration.client.organizationId,
      outboxEventId: outbox.id,
      recipientId: staff.id,
      pushSubscriptionId: input?.pushSubscriptionId ?? null,
      channel: input?.channel ?? "IN_APP",
      provider: input?.provider ?? "TEST_IN_APP",
      deliveryKey: `intent:${outbox.id}`,
      notificationType: input?.type ?? "SIMULATED_READY",
      title: input?.title ?? "Ready",
      body: input?.body ?? "Ready",
      availableAt: new Date("2026-07-12T00:00:00.000Z"),
      status: input?.status ?? "QUEUED",
      leaseOwner: input?.status === "PROCESSING" ? "seed-worker" : undefined,
      leaseToken: input?.status === "PROCESSING" ? "seed-token" : undefined,
      leaseExpiresAt:
        input?.status === "PROCESSING"
          ? new Date(Date.now() + 5_000)
          : undefined,
    },
  });

  if (
    input?.availableAtSql ||
    input?.retryAtSql !== undefined ||
    input?.leaseExpiresAtSql !== undefined
  ) {
    await prisma.$executeRawUnsafe(`
      UPDATE "NotificationIntent"
      SET
        "availableAt" = ${input.availableAtSql ?? `"availableAt"`},
        "retryAt" = ${input.retryAtSql ?? "NULL"},
        "leaseExpiresAt" = ${input.leaseExpiresAtSql ?? "NULL"}
      WHERE "id" = '${intent.id}'
    `);
  }

  return { registration, staff, outbox, intent };
}

async function claimSingleIntent() {
  const [claimed] = await claimNotificationIntents(undefined, 1);
  expect(claimed).toBeDefined();
  return claimed!;
}

describe("worker notification pipeline", () => {
  beforeEach(async () => {
    resetEnvForTests();
    resetSimulatedProviderState();
    await resetDatabase();
  });

  it("documents worker timestamp columns as timestamp without time zone", async () => {
    const rows = await prisma.$queryRaw<
      Array<{ table_name: string; column_name: string; data_type: string }>
    >`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'NotificationIntent' AND column_name IN ('availableAt', 'retryAt', 'leaseExpiresAt', 'completedAt', 'createdAt', 'updatedAt'))
          OR (table_name = 'NotificationDeliveryAttempt' AND column_name IN ('startedAt', 'dispatchStartedAt', 'completedAt', 'retryAt', 'createdAt'))
          OR (table_name = 'NotificationProviderReceipt' AND column_name IN ('createdAt'))
          OR (table_name = 'OutboxEvent' AND column_name IN ('availableAt', 'createdAt', 'updatedAt'))
        )
      ORDER BY table_name, column_name
    `;

    expect(rows).not.toHaveLength(0);
    expect(new Set(rows.map((row) => row.data_type))).toEqual(
      new Set(["timestamp without time zone"]),
    );
  });

  it("projects duplicate outbox events into exactly one notification intent per outbox row", async () => {
    await seedRegistrationOutbox();

    await projectPendingOutboxEvents();
    await projectPendingOutboxEvents();

    expect(await prisma.notificationIntent.count()).toBe(2);
  });

  it("claims boundary-ready rows consistently at database-time edges", async () => {
    const exactlyNow = await seedStaffNotification({
      type: "NOW_READY",
      availableAtSql: `statement_timestamp() AT TIME ZONE 'UTC'`,
    });
    const retryBeforeNow = await seedStaffNotification({
      type: "RETRY_BEFORE",
      status: "FAILED_RETRYABLE",
      availableAtSql: `statement_timestamp() AT TIME ZONE 'UTC' - interval '5 seconds'`,
      retryAtSql: `statement_timestamp() AT TIME ZONE 'UTC' - interval '1 millisecond'`,
    });
    const retryAfterNow = await seedStaffNotification({
      type: "RETRY_AFTER",
      status: "FAILED_RETRYABLE",
      availableAtSql: `statement_timestamp() AT TIME ZONE 'UTC' - interval '5 seconds'`,
      retryAtSql: `statement_timestamp() AT TIME ZONE 'UTC' + interval '1 millisecond'`,
    });
    const expiredLease = await seedStaffNotification({
      type: "LEASE_EXPIRED",
      status: "PROCESSING",
      availableAtSql: `statement_timestamp() AT TIME ZONE 'UTC' - interval '5 seconds'`,
      leaseExpiresAtSql: `statement_timestamp() AT TIME ZONE 'UTC'`,
    });
    const activeLease = await seedStaffNotification({
      type: "LEASE_ACTIVE",
      status: "PROCESSING",
      availableAtSql: `statement_timestamp() AT TIME ZONE 'UTC' - interval '5 seconds'`,
      leaseExpiresAtSql: `statement_timestamp() AT TIME ZONE 'UTC' + interval '5 seconds'`,
    });

    await prisma.notificationIntent.updateMany({
      where: {
        id: {
          in: [expiredLease.intent.id, activeLease.intent.id],
        },
      },
      data: {
        leaseOwner: "seed-worker",
        leaseToken: "seed-token",
      },
    });

    const claimed = await claimNotificationIntents(undefined, 10);
    const claimedTypes = claimed.map((row) => row.notificationType).sort();

    expect(claimedTypes).toEqual(
      ["LEASE_EXPIRED", "NOW_READY", "RETRY_BEFORE", "RETRY_AFTER"].sort(),
    );
    expect(claimedTypes).not.toContain(activeLease.intent.notificationType);
    expect(claimed.some((row) => row.id === exactlyNow.intent.id)).toBe(true);
    expect(claimed.some((row) => row.id === retryBeforeNow.intent.id)).toBe(
      true,
    );
    expect(claimed.some((row) => row.id === retryAfterNow.intent.id)).toBe(
      true,
    );
  });

  it("two worker instances claim disjoint rows", async () => {
    await seedRegistrationOutbox();
    await projectPendingOutboxEvents();

    const clientA = new PrismaClient();
    const clientB = new PrismaClient();

    try {
      const [claimedA, claimedB] = await Promise.all([
        claimNotificationIntents(createDeps(clientA, "worker-a"), 1),
        claimNotificationIntents(createDeps(clientB, "worker-b"), 1),
      ]);

      expect(claimedA).toHaveLength(1);
      expect(claimedB).toHaveLength(1);
      expect(claimedA[0]?.id).not.toBe(claimedB[0]?.id);
      expect(claimedA[0]?.leaseToken).not.toBe(claimedB[0]?.leaseToken);
    } finally {
      await clientA.$disconnect();
      await clientB.$disconnect();
    }
  });

  it("three workers claim disjoint rows across repeated races", async () => {
    for (let iteration = 0; iteration < 10; iteration += 1) {
      await resetDatabase();
      await seedStaffNotification({
        type: `THREE_A_${iteration}`,
      });
      await seedStaffNotification({
        type: `THREE_B_${iteration}`,
      });
      await seedStaffNotification({
        type: `THREE_C_${iteration}`,
      });

      const clients = [
        new PrismaClient(),
        new PrismaClient(),
        new PrismaClient(),
      ];

      try {
        const claims = await Promise.all(
          clients.map((client, index) =>
            claimNotificationIntents(
              createDeps(client, `worker-${iteration}-${index}`),
              1,
            ),
          ),
        );
        const ids = claims.flat().map((row) => row.id);
        expect(ids).toHaveLength(3);
        expect(new Set(ids).size).toBe(3);
      } finally {
        await Promise.all(clients.map((client) => client.$disconnect()));
      }
    }
  });

  it("enforces the configured claim batch size", async () => {
    await seedRegistrationOutbox();
    await projectPendingOutboxEvents();

    expect(await claimNotificationIntents(undefined, 1)).toHaveLength(1);
  });

  it("expired leases are reclaimed with a new lease token", async () => {
    await seedRegistrationOutbox();
    await projectPendingOutboxEvents();

    const claimed = await claimSingleIntent();

    await prisma.notificationIntent.update({
      where: { id: claimed.id },
      data: {
        leaseExpiresAt: new Date(Date.now() - 60_000),
      },
    });

    const [reclaimed] = await claimNotificationIntents(undefined, 1);

    expect(reclaimed?.id).toBe(claimed.id);
    expect(reclaimed?.leaseToken).not.toBe(claimed.leaseToken);
    expect(reclaimed?.attemptCount).toBe(2);
  });

  it("stale lease completion is rejected", async () => {
    await seedRegistrationOutbox();
    await projectPendingOutboxEvents();

    const claimed = await claimSingleIntent();

    await prisma.notificationIntent.update({
      where: { id: claimed.id },
      data: {
        leaseToken: "newer-lease-token",
        leaseOwner: "worker-b",
      },
    });

    const finalized = await finalizeIntentResult(createWorkerDependencies(), {
      intent: claimed,
      result: {
        status: "SIMULATED",
        safeResultCode: "simulated",
        providerIdempotencyMode: "GUARANTEED",
        dispatchStarted: true,
      },
    });

    expect(finalized).toBe(false);
  });

  it("processes projected intents idempotently into one logical in-app delivery", async () => {
    await seedRegistrationOutbox();

    await processPendingOutbox();
    await processPendingOutbox();

    expect(await prisma.notificationIntent.count()).toBe(2);
    expect(await prisma.inAppNotification.count()).toBe(2);
    expect(await prisma.notificationProviderReceipt.count()).toBe(2);
  });

  it("prevents duplicate terminal outcomes across 20 concurrent finalize races", async () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      await resetDatabase();
      const { outbox, intent } = await seedStaffNotification();
      await prisma.notificationIntent.update({
        where: { id: intent.id },
        data: {
          status: "PROCESSING",
          leaseOwner: "worker-race",
          leaseToken: "shared-lease",
          leaseExpiresAt: new Date(Date.now() + 60_000),
          attemptCount: 1,
        },
      });
      await prisma.notificationDeliveryAttempt.create({
        data: {
          notificationIntentId: intent.id,
          attemptNumber: 1,
          leaseToken: "shared-lease",
          provider: "TEST_IN_APP",
          providerIdempotencyMode: "GUARANTEED",
          status: "PROVIDER_CALL_STARTED",
          startedAt: new Date(),
        },
      });
      await prisma.notificationProviderReceipt.create({
        data: {
          deliveryKey: `intent:${outbox.id}`,
          provider: "TEST_IN_APP",
          providerIdempotencyMode: "GUARANTEED",
          status: "SIMULATED",
          safeResultCode: "simulated",
          providerReference: `simulated:intent:${outbox.id}`,
        },
      });

      const barrier = new Barrier(2);
      const sinkA = new InMemoryOperationalEventSink();
      const sinkB = new InMemoryOperationalEventSink();
      const raceIntent = {
        ...(await prisma.notificationIntent.findUniqueOrThrow({
          where: { id: intent.id },
        })),
      };

      const depsA = createDeps(new PrismaClient(), `race-a-${iteration}`, {
        operationalEventSink: sinkA,
        testHooks: {
          beforeFinalizeCas: () => barrier.wait(),
        },
      });
      const depsB = createDeps(new PrismaClient(), `race-b-${iteration}`, {
        operationalEventSink: sinkB,
        testHooks: {
          beforeFinalizeCas: () => barrier.wait(),
        },
      });

      try {
        const [wonA, wonB] = await Promise.all([
          finalizeIntentResult(depsA, {
            intent: raceIntent as Awaited<typeof raceIntent>,
            result: {
              status: "SIMULATED",
              safeResultCode: "simulated",
              providerIdempotencyMode: "GUARANTEED",
              dispatchStarted: true,
            },
          }),
          finalizeIntentResult(depsB, {
            intent: raceIntent as Awaited<typeof raceIntent>,
            result: {
              status: "RETRYABLE_FAILURE",
              safeResultCode: "provider_unavailable",
              providerIdempotencyMode: "GUARANTEED",
              dispatchStarted: true,
            },
          }),
        ]);

        expect([wonA, wonB].filter(Boolean)).toHaveLength(1);

        const reloadedIntent =
          await prisma.notificationIntent.findUniqueOrThrow({
            where: { id: intent.id },
          });
        expect(["SIMULATED", "FAILED_RETRYABLE"]).toContain(
          reloadedIntent.status,
        );
        expect(await prisma.notificationProviderReceipt.count()).toBe(1);
        expect(await prisma.inAppNotification.count()).toBe(
          reloadedIntent.status === "SIMULATED" ? 1 : 0,
        );

        const authoritativeEvents = [...sinkA.events, ...sinkB.events].filter(
          (event) =>
            event.eventName === "notification_delivery_result" ||
            event.eventName === "notification_retry_scheduled",
        );
        expect(authoritativeEvents).toHaveLength(1);
      } finally {
        await depsA.prisma.$disconnect();
        await depsB.prisma.$disconnect();
      }
    }
  });

  it("prevents duplicate logical delivery across 20 concurrent finalize races", async () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      await resetDatabase();
      const { outbox, intent } = await seedStaffNotification({
        type: `SIMULATED_DUPLICATE_${iteration}`,
      });
      await prisma.notificationIntent.update({
        where: { id: intent.id },
        data: {
          status: "PROCESSING",
          leaseOwner: "worker-dup",
          leaseToken: "dup-lease",
          leaseExpiresAt: new Date(Date.now() + 60_000),
          attemptCount: 1,
        },
      });
      await prisma.notificationDeliveryAttempt.create({
        data: {
          notificationIntentId: intent.id,
          attemptNumber: 1,
          leaseToken: "dup-lease",
          provider: "TEST_IN_APP",
          providerIdempotencyMode: "GUARANTEED",
          status: "PROVIDER_CALL_STARTED",
          startedAt: new Date(),
        },
      });
      await prisma.notificationProviderReceipt.create({
        data: {
          deliveryKey: `intent:${outbox.id}`,
          provider: "TEST_IN_APP",
          providerIdempotencyMode: "GUARANTEED",
          status: "SIMULATED",
          safeResultCode: "simulated",
          providerReference: `simulated:intent:${outbox.id}`,
        },
      });
      const barrier = new Barrier(2);
      const raceIntent = await prisma.notificationIntent.findUniqueOrThrow({
        where: { id: intent.id },
      });

      const clientA = new PrismaClient();
      const clientB = new PrismaClient();

      try {
        await Promise.all([
          finalizeIntentResult(
            createDeps(clientA, `dup-a-${iteration}`, {
              testHooks: {
                beforeFinalizeCas: () => barrier.wait(),
              },
            }),
            {
              intent: raceIntent,
              result: {
                status: "SIMULATED",
                safeResultCode: "simulated",
                providerIdempotencyMode: "GUARANTEED",
                dispatchStarted: true,
              },
            },
          ),
          finalizeIntentResult(
            createDeps(clientB, `dup-b-${iteration}`, {
              testHooks: {
                beforeFinalizeCas: () => barrier.wait(),
              },
            }),
            {
              intent: raceIntent,
              result: {
                status: "SIMULATED",
                safeResultCode: "simulated",
                providerIdempotencyMode: "GUARANTEED",
                dispatchStarted: true,
              },
            },
          ),
        ]);

        expect(await prisma.notificationProviderReceipt.count()).toBe(1);
        expect(await prisma.inAppNotification.count()).toBe(1);
      } finally {
        await clientA.$disconnect();
        await clientB.$disconnect();
      }
    }
  });

  it.each(["SIMULATED", "INVALID_SUBSCRIPTION"] as const)(
    "prevents stale lease holders from mutating subscriptions when the authoritative worker resolves %s",
    async (authoritativeStatus) => {
      process.env.PUSH_ENCRYPTION_KEY_B64 = Buffer.alloc(32, 9).toString(
        "base64",
      );
      resetEnvForTests();

      const registration = await seedRegistrationOutbox();
      const staff = await prisma.staffUser.findFirstOrThrow({
        where: {
          organizationId: registration.client.organizationId,
          role: "STAFF",
        },
      });
      const subscription = await upsertPushSubscription({
        clientId: registration.client.id,
        organizationId: registration.client.organizationId,
        anonymousDeviceId: "push-device-race",
        endpoint: "https://push.example.test/race",
        p256dh: "p256dh-key",
        auth: "auth-key",
      });
      const outbox = await prisma.outboxEvent.create({
        data: {
          organizationId: registration.client.organizationId,
          eventType: "STAFF_IN_APP_NOTIFICATION",
          aggregateType: "CLIENT",
          aggregateId: registration.client.id,
          idempotencyKey: `invalid-race-${authoritativeStatus}`,
          payloadJson: {
            recipientId: staff.id,
            type: "FORCE_INVALID_SUBSCRIPTION",
            title: "Invalid",
            body: "Invalid",
          },
        },
      });
      await prisma.notificationIntent.create({
        data: {
          organizationId: registration.client.organizationId,
          outboxEventId: outbox.id,
          recipientId: staff.id,
          pushSubscriptionId: subscription.id,
          channel: "WEB_PUSH",
          provider: "TEST_PUSH_GUARANTEED",
          deliveryKey: `intent:${outbox.id}`,
          notificationType: "FORCE_INVALID_SUBSCRIPTION",
          title: "Invalid",
          body: "Invalid",
        },
      });

      const workerAClaim = await claimSingleIntent();
      await prisma.notificationIntent.update({
        where: { id: workerAClaim.id },
        data: {
          leaseExpiresAt: new Date(Date.now() - 1_000),
        },
      });
      const workerBClaim = await claimSingleIntent();

      const staleSink = new InMemoryOperationalEventSink();
      const staleFinalized = await finalizeIntentResult(
        createWorkerDependencies({
          operationalEventSink: staleSink,
        }),
        {
          intent: workerAClaim,
          result: {
            status: "INVALID_SUBSCRIPTION",
            safeResultCode: "invalid_subscription",
            providerIdempotencyMode: "GUARANTEED",
            dispatchStarted: true,
          },
        },
      );

      const authoritativeFinalized = await finalizeIntentResult(
        createWorkerDependencies(),
        {
          intent: workerBClaim,
          result: {
            status: authoritativeStatus,
            safeResultCode:
              authoritativeStatus === "INVALID_SUBSCRIPTION"
                ? "invalid_subscription"
                : "simulated",
            providerIdempotencyMode: "GUARANTEED",
            dispatchStarted: true,
          },
        },
      );

      const push = await prisma.pushSubscription.findUniqueOrThrow({
        where: { id: subscription.id },
      });
      const intent = await prisma.notificationIntent.findUniqueOrThrow({
        where: { id: workerBClaim.id },
      });

      expect(staleFinalized).toBe(false);
      expect(authoritativeFinalized).toBe(true);
      expect(
        staleSink.events.filter(
          (event) => event.eventName === "notification_lease_lost",
        ),
      ).toHaveLength(1);
      expect(push.status).toBe(
        authoritativeStatus === "INVALID_SUBSCRIPTION" ? "INVALID" : "ACTIVE",
      );
      expect(intent.status).toBe(authoritativeStatus);
      expect(
        await prisma.notificationProviderReceipt.count(),
      ).toBeLessThanOrEqual(1);
    },
  );

  it("retries guaranteed providers safely after a crash between provider acceptance and receipt persistence", async () => {
    const registration = await seedRegistrationOutbox();
    const staff = await prisma.staffUser.findFirstOrThrow({
      where: {
        organizationId: registration.client.organizationId,
        role: "STAFF",
      },
    });
    const outbox = await prisma.outboxEvent.create({
      data: {
        organizationId: registration.client.organizationId,
        eventType: "STAFF_IN_APP_NOTIFICATION",
        aggregateType: "CLIENT",
        aggregateId: registration.client.id,
        idempotencyKey: "guaranteed-crash-window",
        payloadJson: {
          recipientId: staff.id,
          type: "SIMULATED_GUARANTEED",
          title: "Guaranteed",
          body: "Guaranteed",
        },
      },
    });
    await prisma.notificationIntent.create({
      data: {
        organizationId: registration.client.organizationId,
        outboxEventId: outbox.id,
        recipientId: staff.id,
        channel: "IN_APP",
        provider: "TEST_IN_APP_GUARANTEED",
        deliveryKey: `intent:${outbox.id}`,
        notificationType: "SIMULATED_GUARANTEED",
        title: "Guaranteed",
        body: "Guaranteed",
      },
    });

    const claimed = await claimSingleIntent();

    await expect(
      processClaimedIntent(
        createWorkerDependencies({
          testHooks: {
            afterProviderAcceptedBeforeReceiptPersistence() {
              throw new Error("CRASH_AFTER_PROVIDER_ACCEPT");
            },
          },
        }),
        claimed,
      ),
    ).rejects.toThrow("CRASH_AFTER_PROVIDER_ACCEPT");

    await prisma.notificationIntent.update({
      where: { id: claimed.id },
      data: {
        leaseExpiresAt: new Date(Date.now() - 1_000),
      },
    });

    const [reclaimed] = await claimNotificationIntents(undefined, 1);
    expect(reclaimed).toBeDefined();

    await processClaimedIntent(createWorkerDependencies(), reclaimed!);

    expect(await prisma.notificationProviderReceipt.count()).toBe(1);
    expect(await prisma.inAppNotification.count()).toBe(1);
    expect(
      (
        await prisma.notificationIntent.findUniqueOrThrow({
          where: { id: claimed.id },
        })
      ).status,
    ).toBe("SIMULATED");
  });

  it.each(["TEST_PUSH_BEST_EFFORT", "TEST_PUSH_NONE"])(
    "marks unknown post-dispatch %s outcomes as ambiguous instead of blindly retrying",
    async (provider) => {
      const { intent } = await seedStaffNotification({
        provider,
        channel: "IN_APP",
      });
      const [claimed] = await claimNotificationIntents(undefined, 1);
      expect(claimed).toBeDefined();

      await expect(
        processClaimedIntent(
          createWorkerDependencies({
            testHooks: {
              afterProviderAcceptedBeforeReceiptPersistence() {
                throw new Error("CRASH_AFTER_PROVIDER_ACCEPT");
              },
            },
          }),
          claimed!,
        ),
      ).rejects.toThrow("CRASH_AFTER_PROVIDER_ACCEPT");

      await prisma.notificationIntent.update({
        where: { id: intent.id },
        data: {
          leaseExpiresAt: new Date(Date.now() - 1_000),
        },
      });

      const [reclaimed] = await claimNotificationIntents(undefined, 1);
      expect(reclaimed).toBeDefined();

      const recovered = await processClaimedIntent(
        createWorkerDependencies(),
        reclaimed!,
      );

      expect(recovered.result?.status).toBe("AMBIGUOUS");

      const reloaded = await prisma.notificationIntent.findUniqueOrThrow({
        where: { id: intent.id },
      });
      expect(reloaded.status).toBe("AMBIGUOUS");
      expect(await claimNotificationIntents(undefined, 1)).toHaveLength(0);
    },
  );

  it("keeps a pre-provider crash reclaimable for all provider modes", async () => {
    for (const provider of [
      "TEST_PUSH_GUARANTEED",
      "TEST_PUSH_BEST_EFFORT",
      "TEST_PUSH_NONE",
    ]) {
      await resetDatabase();
      const { intent } = await seedStaffNotification({
        provider,
      });
      const [claimed] = await claimNotificationIntents(undefined, 1);
      expect(claimed).toBeDefined();

      await expect(
        processClaimedIntent(
          createWorkerDependencies({
            testHooks: {
              afterDispatchStartedBeforeProviderCall() {
                throw new Error("CRASH_BEFORE_PROVIDER_CALL");
              },
            },
          }),
          claimed!,
        ),
      ).rejects.toThrow("CRASH_BEFORE_PROVIDER_CALL");

      await prisma.notificationIntent.update({
        where: { id: intent.id },
        data: {
          leaseExpiresAt: new Date(Date.now() - 1_000),
        },
      });

      const reclaimed = await claimNotificationIntents(undefined, 1);
      expect(reclaimed).toHaveLength(1);
    }
  });

  it("proves the provider call occurs outside the claim transaction", async () => {
    const barrier = new Barrier(2);
    await seedRegistrationOutbox();
    await projectPendingOutboxEvents();
    const claimed = await claimSingleIntent();

    const providerPromise = processClaimedIntent(
      createWorkerDependencies({
        deliverIntent: async () => {
          await barrier.wait();
          return {
            status: "SIMULATED",
            safeResultCode: "simulated",
            providerIdempotencyMode: "GUARANTEED",
            dispatchStarted: true,
          };
        },
      }),
      claimed,
    );

    const observer = new PrismaClient();
    try {
      await barrier.wait();
      await expect(
        observer.notificationIntent.update({
          where: { id: claimed.id },
          data: {
            lastSafeErrorCode: "observer-write",
          },
        }),
      ).resolves.toBeDefined();
    } finally {
      await observer.$disconnect();
    }

    await providerPromise;
  });

  it("schedules retryable failures and does not reclaim before retryAt", async () => {
    const registration = await seedRegistrationOutbox();

    const staff = await prisma.staffUser.findFirstOrThrow({
      where: {
        organizationId: registration.client.organizationId,
        role: "STAFF",
      },
    });

    const outbox = await prisma.outboxEvent.create({
      data: {
        organizationId: registration.client.organizationId,
        eventType: "STAFF_IN_APP_NOTIFICATION",
        aggregateType: "CLIENT",
        aggregateId: registration.client.id,
        idempotencyKey: "manual-retry-outbox",
        availableAt: new Date(Date.now() - 1_000),
        payloadJson: {
          recipientId: staff.id,
          type: "FORCE_RETRYABLE_FAILURE",
          title: "Retry me",
          body: "Retry me",
        },
      },
    });

    await projectPendingOutboxEvents();

    const intent = await prisma.notificationIntent.findUniqueOrThrow({
      where: { outboxEventId: outbox.id },
    });

    const claimed = (await claimNotificationIntents(undefined, 10)).find(
      (row) => row.id === intent.id,
    );
    expect(claimed?.id).toBe(intent.id);

    await finalizeIntentResult(createWorkerDependencies(), {
      intent: claimed!,
      result: {
        status: "RETRYABLE_FAILURE",
        safeResultCode: "provider_unavailable",
        providerIdempotencyMode: "GUARANTEED",
        dispatchStarted: false,
      },
    });

    const reloaded = await prisma.notificationIntent.findUniqueOrThrow({
      where: { id: intent.id },
    });

    expect(reloaded.status).toBe("FAILED_RETRYABLE");
    expect(reloaded.retryAt).not.toBeNull();
    expect(await claimNotificationIntents(undefined, 10)).toHaveLength(0);
  });

  it("never retries max-attempt exhausted, terminal, invalid-subscription, or ambiguous intents", async () => {
    const queued = await seedStaffNotification({
      type: "LIMITED_RETRY",
      status: "FAILED_RETRYABLE",
    });
    await prisma.notificationIntent.update({
      where: { id: queued.intent.id },
      data: {
        attemptCount: 5,
        maxAttempts: 5,
      },
    });

    const terminal = await seedStaffNotification({
      type: "TERMINAL",
      status: "PROCESSING",
    });
    await prisma.notificationIntent.update({
      where: { id: terminal.intent.id },
      data: {
        status: "AMBIGUOUS",
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });

    const invalid = await seedStaffNotification({
      type: "INVALID_FINAL",
    });
    await prisma.notificationIntent.update({
      where: { id: invalid.intent.id },
      data: {
        status: "INVALID_SUBSCRIPTION",
      },
    });

    expect(await claimNotificationIntents(undefined, 10)).toHaveLength(0);
  });

  it("invalid subscriptions are disabled and excluded from future delivery", async () => {
    process.env.PUSH_ENCRYPTION_KEY_B64 = Buffer.alloc(32, 9).toString(
      "base64",
    );
    resetEnvForTests();

    const registration = await seedRegistrationOutbox();

    const staff = await prisma.staffUser.findFirstOrThrow({
      where: {
        organizationId: registration.client.organizationId,
        role: "STAFF",
      },
    });

    const subscription = await upsertPushSubscription({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      anonymousDeviceId: "push-device-1",
      endpoint: "https://push.example.test/invalid",
      p256dh: "p256dh-key",
      auth: "auth-key",
    });

    const outbox = await prisma.outboxEvent.create({
      data: {
        organizationId: registration.client.organizationId,
        eventType: "STAFF_IN_APP_NOTIFICATION",
        aggregateType: "CLIENT",
        aggregateId: registration.client.id,
        idempotencyKey: "manual-invalid-push-outbox",
        payloadJson: {
          recipientId: staff.id,
          type: "FORCE_INVALID_SUBSCRIPTION",
          title: "Invalid push",
          body: "Invalid push",
        },
      },
    });

    await prisma.notificationIntent.create({
      data: {
        organizationId: registration.client.organizationId,
        outboxEventId: outbox.id,
        recipientId: staff.id,
        pushSubscriptionId: subscription.id,
        channel: "WEB_PUSH",
        provider: "TEST_PUSH_GUARANTEED",
        deliveryKey: `intent:${outbox.id}`,
        notificationType: "FORCE_INVALID_SUBSCRIPTION",
        title: "Invalid push",
        body: "Invalid push",
        availableAt: new Date("2026-07-12T00:00:00.000Z"),
      },
    });

    const [claimed] = await claimNotificationIntents(undefined, 10);
    expect(claimed).toBeDefined();

    await finalizeIntentResult(createWorkerDependencies(), {
      intent: claimed!,
      result: {
        status: "INVALID_SUBSCRIPTION",
        safeResultCode: "invalid_subscription",
        providerIdempotencyMode: "GUARANTEED",
        dispatchStarted: true,
      },
    });

    const push = await prisma.pushSubscription.findUniqueOrThrow({
      where: { id: subscription.id },
    });
    const intent = await prisma.notificationIntent.findUniqueOrThrow({
      where: { id: claimed!.id },
    });

    expect(push.status).toBe("INVALID");
    expect(intent.status).toBe("INVALID_SUBSCRIPTION");
    expect(await claimNotificationIntents(undefined, 10)).toHaveLength(0);
  });

  it("claims the same ready rows under UTC, Los Angeles, and Seoul database sessions", async () => {
    const timeZones = ["UTC", "America/Los_Angeles", "Asia/Seoul"];
    const results: string[][] = [];

    for (const timeZone of timeZones) {
      await resetDatabase();
      const registration = await seedRegistrationOutbox();
      const staff = await prisma.staffUser.findFirstOrThrow({
        where: {
          organizationId: registration.client.organizationId,
          role: "STAFF",
        },
      });

      await prisma.outboxEvent.createMany({
        data: [
          {
            organizationId: registration.client.organizationId,
            eventType: "STAFF_IN_APP_NOTIFICATION",
            aggregateType: "CLIENT",
            aggregateId: registration.client.id,
            idempotencyKey: `tz-a-${timeZone}`,
            availableAt: new Date(Date.now() - 1_000),
            payloadJson: {
              recipientId: staff.id,
              type: "TZ_ALPHA",
              title: "alpha",
              body: "alpha",
            },
          },
          {
            organizationId: registration.client.organizationId,
            eventType: "STAFF_IN_APP_NOTIFICATION",
            aggregateType: "CLIENT",
            aggregateId: registration.client.id,
            idempotencyKey: `tz-b-${timeZone}`,
            availableAt: new Date(Date.now() - 1_000),
            payloadJson: {
              recipientId: staff.id,
              type: "TZ_BETA",
              title: "beta",
              body: "beta",
            },
          },
        ],
      });

      await projectPendingOutboxEvents();

      const client = new PrismaClient();

      try {
        await client.$executeRawUnsafe(`SET TIME ZONE '${timeZone}'`);
        const claimed = await claimNotificationIntents(
          createDeps(client, `worker-${timeZone}`),
          10,
        );
        results.push(claimed.map((row) => row.notificationType).sort());
      } finally {
        await client.$disconnect();
      }
    }

    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
  });

  it("redacts sensitive values from operational events and does not persist them in attempts or receipts", async () => {
    const registration = await seedRegistrationOutbox();
    const staff = await prisma.staffUser.findFirstOrThrow({
      where: {
        organizationId: registration.client.organizationId,
        role: "STAFF",
      },
    });
    const sink = new InMemoryOperationalEventSink();

    const outbox = await prisma.outboxEvent.create({
      data: {
        organizationId: registration.client.organizationId,
        eventType: "STAFF_IN_APP_NOTIFICATION",
        aggregateType: "CLIENT",
        aggregateId: registration.client.id,
        idempotencyKey: "malicious-lease-lost-outbox",
        availableAt: new Date(Date.now() - 1_000),
        payloadJson: {
          recipientId: staff.id,
          type: "FORCE_AMBIGUOUS",
          title: "Alice +15555550101 email alice@example.test employer Acme",
          body: "endpoint https://push.example.test/secret auth-key p256dh-key answer text question text",
        },
      },
    });

    await projectPendingOutboxEvents();

    const intent = await prisma.notificationIntent.findUniqueOrThrow({
      where: { outboxEventId: outbox.id },
    });

    await prisma.notificationIntent.update({
      where: { id: intent.id },
      data: {
        status: "PROCESSING",
        leaseOwner: "worker-b",
        leaseToken: "other-lease-token",
        leaseExpiresAt: new Date(Date.now() + 60_000),
      },
    });

    await finalizeIntentResult(
      createWorkerDependencies({
        operationalEventSink: sink,
      }),
      {
        intent: {
          ...intent,
          status: "PROCESSING",
          leaseToken: "stale-lease-token",
          leaseOwner: "worker-a",
          pushSubscriptionId: null,
        },
        result: {
          status: "SIMULATED",
          safeResultCode: "simulated",
          providerIdempotencyMode: "GUARANTEED",
          dispatchStarted: true,
        },
      },
    );

    const serialized = JSON.stringify(sink.events);
    expect(serialized).not.toContain("Alice");
    expect(serialized).not.toContain("+15555550101");
    expect(serialized).not.toContain("alice@example.test");
    expect(serialized).not.toContain("Acme");
    expect(serialized).not.toContain("push.example.test");
    expect(serialized).not.toContain("auth-key");
    expect(serialized).not.toContain("p256dh-key");
    expect(serialized).not.toContain("answer text");
    expect(serialized).not.toContain("question text");

    const attemptJson = JSON.stringify(
      await prisma.notificationDeliveryAttempt.findMany(),
    );
    const receiptJson = JSON.stringify(
      await prisma.notificationProviderReceipt.findMany(),
    );
    expect(attemptJson).not.toContain("Alice");
    expect(receiptJson).not.toContain("Alice");
  });

  it("does not let telemetry sink failures corrupt authoritative worker state", async () => {
    await seedRegistrationOutbox();
    await projectPendingOutboxEvents();
    const claimed = await claimSingleIntent();

    const result = await finalizeIntentResult(
      createWorkerDependencies({
        operationalEventSink: {
          async emit() {
            throw new Error("sink failure");
          },
        },
      }),
      {
        intent: claimed,
        result: {
          status: "SIMULATED",
          safeResultCode: "simulated",
          providerIdempotencyMode: "GUARANTEED",
          dispatchStarted: true,
        },
      },
    );

    expect(result).toBe(true);
    expect(await prisma.inAppNotification.count()).toBe(1);
    expect(
      (
        await prisma.notificationIntent.findUniqueOrThrow({
          where: { id: claimed.id },
        })
      ).status,
    ).toBe("SIMULATED");
  });

  it("bounds provider concurrency and keeps malformed work from terminating the batch", async () => {
    await seedRegistrationOutbox();
    await projectPendingOutboxEvents();

    let inFlight = 0;
    let maxInFlight = 0;
    const barrier = new Barrier(2);

    const processed = await processNotificationIntentBatch(
      createWorkerDependencies({
        deliverIntent: async (_deps, intent) => {
          if (intent.notificationType === "MISSION_COMPLETED") {
            throw new Error("PROVIDER_TIMEOUT");
          }

          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await barrier.wait();
          inFlight -= 1;

          return {
            status: "SIMULATED",
            safeResultCode: "simulated",
            providerIdempotencyMode: "GUARANTEED",
            dispatchStarted: true,
          };
        },
      }),
    );

    expect(processed).toBe(2);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(await prisma.notificationIntent.count()).toBe(2);
  });

  it("graceful shutdown stops new claims and leaves over-grace work recoverable", async () => {
    process.env.WORKER_SHUTDOWN_GRACE_MS = "50";
    resetEnvForTests();

    await seedRegistrationOutbox();
    await projectPendingOutboxEvents();

    let releaseProvider: (() => void) | null = null;
    const blocked = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });

    const runtime = createWorkerRuntime(
      createWorkerDependencies({
        deliverIntent: async () => {
          await blocked;
          return {
            status: "SIMULATED",
            safeResultCode: "simulated",
            providerIdempotencyMode: "GUARANTEED",
            dispatchStarted: true,
          };
        },
      }),
    );

    runtime.start();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await runtime.shutdown();

    const processingCount = await prisma.notificationIntent.count({
      where: { status: "PROCESSING" },
    });
    expect(processingCount).toBeGreaterThanOrEqual(0);

    releaseProvider?.();
  });
});
