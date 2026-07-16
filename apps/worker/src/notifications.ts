import { randomUUID } from "node:crypto";
import { getEnv } from "@honey/config";
import { prisma, Prisma, type Prisma as PrismaNamespace } from "@honey/db";
import {
  decryptOpaqueValue,
  getLocalDateInTimeZone,
  getLocalTimeInTimeZone,
  hashOpaqueValue,
  isLocalTimeInQuietHours,
} from "@honey/domain";
import {
  JsonConsoleOperationalEventSink,
  NoopOperationalEventSink,
  createOperationalEvent,
  type EmitOperationalEventInput,
  type OperationalEventSink,
} from "@honey/observability";

export type ProviderDeliveryStatus =
  | "DELIVERED"
  | "SIMULATED"
  | "SUPPRESSED"
  | "RETRYABLE_FAILURE"
  | "PERMANENT_FAILURE"
  | "INVALID_SUBSCRIPTION"
  | "AMBIGUOUS";

export type SafeErrorCode =
  | "delivered"
  | "simulated"
  | "preference_disabled"
  | "no_active_subscription"
  | "mission_completed"
  | "daily_cap_exhausted"
  | "no_eligible_questions"
  | "quiet_hours"
  | "account_restricted"
  | "occurrence_expired"
  | "time_zone_changed"
  | "provider_timeout"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "invalid_subscription"
  | "attempts_exhausted"
  | "ambiguous_provider_outcome"
  | "provider_rejected"
  | "lease_lost";

export type ProviderIdempotencyCapability =
  | "GUARANTEED"
  | "BEST_EFFORT"
  | "NONE";

export type ProviderDeliveryResult = {
  status: ProviderDeliveryStatus;
  safeResultCode: SafeErrorCode;
  providerReference?: string;
  retryAfterMs?: number;
  providerIdempotencyMode: ProviderIdempotencyCapability;
  dispatchStarted: boolean;
};

export type WorkerClock = {
  now(): Date;
};

export type JitterSource = {
  next(): number;
};

export type WorkerTestHooks = {
  afterClaimBeforeDispatchStarted?(input: {
    intent: ClaimedIntent;
  }): Promise<void> | void;
  afterDispatchStartedBeforeProviderCall?(input: {
    intent: ClaimedIntent;
    attemptNumber: number;
  }): Promise<void> | void;
  afterProviderAcceptedBeforeReceiptPersistence?(input: {
    intent: ClaimedIntent;
    attemptNumber: number;
    result: ProviderDeliveryResult;
  }): Promise<void> | void;
  afterReceiptPersistenceBeforeIntentFinalization?(input: {
    intent: ClaimedIntent;
    attemptNumber: number;
    result: ProviderDeliveryResult;
  }): Promise<void> | void;
  beforeFinalizeCas?(input: {
    intent: ClaimedIntent;
    attemptNumber: number;
    result: ProviderDeliveryResult;
  }): Promise<void> | void;
  afterIntentFinalization?(input: {
    intent: ClaimedIntent;
    attemptNumber: number;
    result: ProviderDeliveryResult;
    finalized: boolean;
  }): Promise<void> | void;
};

export type WorkerDependencies = {
  prisma: typeof prisma;
  clock: WorkerClock;
  jitter: JitterSource;
  workerId: string;
  operationalEventSink: OperationalEventSink;
  deliverIntent?: (
    deps: WorkerDependencies,
    intent: ClaimedIntent,
  ) => Promise<ProviderDeliveryResult>;
  testHooks?: WorkerTestHooks;
};

export type ClaimedIntent = {
  id: string;
  organizationId: string;
  outboxEventId: string;
  recipientId: string | null;
  clientId: string | null;
  pushSubscriptionId: string | null;
  channel: "IN_APP" | "WEB_PUSH";
  provider: string;
  status: "PROCESSING";
  deliveryKey: string;
  notificationType: string;
  title: string;
  body: string;
  availableAt: Date;
  retryAt: Date | null;
  attemptCount: number;
  maxAttempts: number;
  leaseOwner: string | null;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  lastSafeErrorCode: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SimulatedProviderLedgerEntry = {
  status: ProviderDeliveryStatus;
  safeResultCode: SafeErrorCode;
  providerReference?: string;
};

export const WORKER_DB_TIME_POLICY = "statement_timestamp() AT TIME ZONE 'UTC'";
export const WORKER_ACK_SAFETY_MARGIN_MS = 1_000;

const simulatedProviderLedger = new Map<string, SimulatedProviderLedgerEntry>();

const operationalEventSink: OperationalEventSink =
  getEnv().NODE_ENV === "development"
    ? new JsonConsoleOperationalEventSink()
    : new NoopOperationalEventSink();

function utcStatementTimestampSql() {
  return Prisma.sql`statement_timestamp() AT TIME ZONE 'UTC'`;
}

function utcStatementTimestampPlusMsSql(milliseconds: number) {
  return Prisma.sql`${utcStatementTimestampSql()} + (${milliseconds} * interval '1 millisecond')`;
}

function mapProviderModeFromName(
  provider: string,
): ProviderIdempotencyCapability {
  if (provider.includes("NONE")) {
    return "NONE";
  }

  if (provider.includes("BEST_EFFORT")) {
    return "BEST_EFFORT";
  }

  return "GUARANTEED";
}

export function resetSimulatedProviderState() {
  simulatedProviderLedger.clear();
}

export function createWorkerId() {
  return `worker-${randomUUID()}`;
}

export function createDefaultClock(): WorkerClock {
  return {
    now: () => new Date(),
  };
}

export function createRandomJitter(): JitterSource {
  return {
    next: () => Math.random(),
  };
}

export function createWorkerDependencies(
  overrides: Partial<WorkerDependencies> = {},
): WorkerDependencies {
  return {
    prisma,
    clock: createDefaultClock(),
    jitter: createRandomJitter(),
    workerId: createWorkerId(),
    operationalEventSink,
    ...overrides,
  };
}

async function emitWorkerEvent(
  sink: OperationalEventSink,
  input: EmitOperationalEventInput,
) {
  try {
    await sink.emit(
      createOperationalEvent(input, {
        environment: getEnv().NODE_ENV,
      }),
    );
  } catch {
    // Telemetry failures must never change authoritative worker state.
  }
}

async function runHook<T>(
  hook: ((input: T) => Promise<void> | void) | undefined,
  input: T,
) {
  if (!hook) {
    return;
  }

  await hook(input);
}

export function sanitizeProviderErrorCode(error: unknown): SafeErrorCode {
  if (!(error instanceof Error)) {
    return "provider_unavailable";
  }

  switch (error.message) {
    case "PROVIDER_TIMEOUT":
      return "provider_timeout";
    case "PROVIDER_RATE_LIMITED":
      return "provider_rate_limited";
    case "INVALID_SUBSCRIPTION":
      return "invalid_subscription";
    case "AMBIGUOUS_PROVIDER_OUTCOME":
      return "ambiguous_provider_outcome";
    default:
      return "provider_unavailable";
  }
}

export function computeRetryDelayMs(input: {
  attemptNumber: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio?: number;
  retryAfterMs?: number | null;
  jitterValue?: number;
}) {
  if (input.retryAfterMs && input.retryAfterMs > 0) {
    return Math.min(input.retryAfterMs, input.maxDelayMs);
  }

  const exponent = Math.max(0, input.attemptNumber - 1);
  const base = Math.min(input.baseDelayMs * 2 ** exponent, input.maxDelayMs);
  const ratio = input.jitterRatio ?? 0.2;
  const jitterValue = input.jitterValue ?? 0;
  const jitterOffset = Math.round(base * ratio * jitterValue);
  return Math.min(base + jitterOffset, input.maxDelayMs);
}

function getPushEncryptionKey() {
  const env = getEnv();

  if (!env.PUSH_ENCRYPTION_KEY_B64) {
    if (env.NODE_ENV === "production") {
      throw new Error("PUSH_ENCRYPTION_KEY_MISSING");
    }

    return Buffer.alloc(32, 11);
  }

  return Buffer.from(env.PUSH_ENCRYPTION_KEY_B64, "base64");
}

async function projectOutboxEventToIntent(
  tx: PrismaNamespace.TransactionClient,
  event: {
    id: string;
    organizationId: string;
    payloadJson: PrismaNamespace.JsonValue;
    eventType: string;
    createdAt: Date;
  },
) {
  if (event.eventType === "STAFF_IN_APP_NOTIFICATION") {
    const payload = event.payloadJson as {
      recipientId: string;
      title?: string;
      body?: string;
      type: string;
    };

    return tx.notificationIntent.upsert({
      where: {
        outboxEventId: event.id,
      },
      update: {},
      create: {
        organizationId: event.organizationId,
        outboxEventId: event.id,
        recipientId: payload.recipientId,
        channel: "IN_APP",
        provider: "TEST_IN_APP",
        deliveryKey: `intent:${event.id}`,
        notificationType: payload.type,
        title: payload.title ?? payload.type,
        body: payload.body ?? payload.type,
        availableAt: event.createdAt,
        maxAttempts: getEnv().WORKER_NOTIFICATION_MAX_ATTEMPTS,
      },
    });
  }

  if (event.eventType === "CLIENT_MISSION_REMINDER") {
    const payload = event.payloadJson as {
      clientId: string;
      occurrenceId: string;
      pushSubscriptionId: string | null;
      title: string;
      body: string;
      templateKey: string;
    };

    const intent = await tx.notificationIntent.upsert({
      where: {
        outboxEventId: event.id,
      },
      update: {},
      create: {
        organizationId: event.organizationId,
        outboxEventId: event.id,
        clientId: payload.clientId,
        pushSubscriptionId: payload.pushSubscriptionId,
        channel: "WEB_PUSH",
        provider: "TEST_PUSH_GUARANTEED",
        deliveryKey: `mission-reminder:${payload.occurrenceId}:v1`,
        notificationType: payload.templateKey,
        title: payload.title,
        body: payload.body,
        availableAt: event.createdAt,
        maxAttempts: getEnv().WORKER_NOTIFICATION_MAX_ATTEMPTS,
      },
    });

    await tx.reminderOccurrence.updateMany({
      where: {
        id: payload.occurrenceId,
        notificationIntentId: null,
      },
      data: {
        status: "INTENT_CREATED",
        notificationIntentId: intent.id,
      },
    });

    return intent;
  }

  return null;
}

export async function projectPendingOutboxEvents(
  deps: WorkerDependencies = createWorkerDependencies(),
) {
  const events = await deps.prisma.outboxEvent.findMany({
    where: {
      status: "PENDING",
      availableAt: {
        lte: deps.clock.now(),
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: getEnv().WORKER_CLAIM_BATCH_SIZE,
  });

  for (const event of events) {
    await deps.prisma.$transaction(async (tx) => {
      await projectOutboxEventToIntent(tx, event);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "OutboxEvent"
        SET
          "status" = 'PROCESSED',
          "processedAt" = ${utcStatementTimestampSql()},
          "attemptCount" = "attemptCount" + 1,
          "updatedAt" = ${utcStatementTimestampSql()}
        WHERE "id" = ${event.id}
      `);
    });
  }

  return events.length;
}

async function createClaimedAttemptRows(
  tx: PrismaNamespace.TransactionClient,
  claimed: ClaimedIntent[],
) {
  for (const intent of claimed) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "NotificationDeliveryAttempt" (
        "id",
        "notificationIntentId",
        "attemptNumber",
        "leaseToken",
        "provider",
        "providerIdempotencyMode",
        "status",
        "startedAt"
      )
      VALUES (
        ${randomUUID()},
        ${intent.id},
        ${intent.attemptCount},
        ${intent.leaseToken!},
        ${intent.provider},
        CAST(${mapProviderModeFromName(intent.provider)} AS "ProviderIdempotencyMode"),
        'CLAIMED',
        ${utcStatementTimestampSql()}
      )
      ON CONFLICT ("notificationIntentId", "attemptNumber") DO NOTHING
    `);
  }
}

export async function claimNotificationIntents(
  deps: WorkerDependencies = createWorkerDependencies(),
  batchSize = getEnv().WORKER_CLAIM_BATCH_SIZE,
) {
  const leaseMs = getEnv().WORKER_LEASE_MS;

  return deps.prisma.$transaction(async (tx) => {
    const claimed = await tx.$queryRaw<ClaimedIntent[]>(Prisma.sql`
      WITH candidates AS (
        SELECT ni."id"
        FROM "NotificationIntent" ni
        WHERE
          (
            ni."status" IN ('QUEUED', 'FAILED_RETRYABLE')
            AND COALESCE(ni."retryAt", ni."availableAt") <= ${utcStatementTimestampSql()}
            AND ni."attemptCount" < ni."maxAttempts"
          )
          OR
          (
            ni."status" = 'PROCESSING'
            AND ni."leaseExpiresAt" <= ${utcStatementTimestampSql()}
          )
        ORDER BY
          COALESCE(ni."retryAt", ni."availableAt"),
          ni."createdAt",
          ni."id"
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      )
      UPDATE "NotificationIntent" ni
      SET
        "status" = 'PROCESSING',
        "leaseOwner" = ${deps.workerId},
        "leaseToken" = md5(ni."id" || clock_timestamp()::text || random()::text),
        "leaseExpiresAt" = ${utcStatementTimestampPlusMsSql(leaseMs)},
        "attemptCount" = ni."attemptCount" + 1,
        "updatedAt" = ${utcStatementTimestampSql()}
      FROM candidates
      WHERE ni."id" = candidates."id"
        AND ni."status" NOT IN (
          'DELIVERED',
          'SIMULATED',
          'SUPPRESSED',
          'FAILED_PERMANENT',
          'INVALID_SUBSCRIPTION',
          'AMBIGUOUS'
        )
      RETURNING ni.*
    `);

    if (claimed.length === 0) {
      await emitWorkerEvent(deps.operationalEventSink, {
        eventName: "notification_claim_empty",
        result: "SUCCESS",
        reasonCode: "NO_READY_INTENTS",
      });
      return [];
    }

    await createClaimedAttemptRows(tx, claimed);

    for (const intent of claimed) {
      if (intent.attemptCount > 1) {
        await emitWorkerEvent(deps.operationalEventSink, {
          eventName: "notification_lease_recovered",
          result: "SUCCESS",
          reasonCode: "EXPIRED_LEASE_RECLAIMED",
          resourceId: intent.id,
          retryCount: intent.attemptCount,
        });
      }
    }

    await emitWorkerEvent(deps.operationalEventSink, {
      eventName: "notification_claim_batch",
      result: "SUCCESS",
      reasonCode: "CLAIMED",
      retryCount: claimed.length,
    });

    return claimed;
  });
}

export async function renewLease(
  deps: WorkerDependencies,
  input: {
    intentId: string;
    leaseToken: string;
  },
) {
  const updated = await deps.prisma.$executeRaw(Prisma.sql`
    UPDATE "NotificationIntent"
    SET
      "leaseExpiresAt" = ${utcStatementTimestampPlusMsSql(getEnv().WORKER_LEASE_MS)},
      "updatedAt" = ${utcStatementTimestampSql()}
    WHERE "id" = ${input.intentId}
      AND "status" = 'PROCESSING'
      AND "leaseToken" = ${input.leaseToken}
  `);

  if (updated === 0) {
    await emitWorkerEvent(deps.operationalEventSink, {
      eventName: "notification_lease_lost",
      result: "REJECTED",
      reasonCode: "LEASE_LOST",
      resourceId: input.intentId,
    });
    return false;
  }

  await emitWorkerEvent(deps.operationalEventSink, {
    eventName: "notification_lease_renewed",
    result: "SUCCESS",
    reasonCode: "LEASE_EXTENDED",
    resourceId: input.intentId,
  });
  return true;
}

async function markDispatchStarted(
  deps: WorkerDependencies,
  input: { intentId: string; leaseToken: string; attemptNumber: number },
) {
  const [intentResult, attemptResult] = await deps.prisma.$transaction([
    deps.prisma.$executeRaw(Prisma.sql`
      UPDATE "NotificationIntent"
      SET "updatedAt" = ${utcStatementTimestampSql()}
      WHERE "id" = ${input.intentId}
        AND "status" = 'PROCESSING'
        AND "leaseToken" = ${input.leaseToken}
    `),
    deps.prisma.$executeRaw(Prisma.sql`
      UPDATE "NotificationDeliveryAttempt"
      SET
        "status" = 'DISPATCH_STARTED',
        "dispatchStartedAt" = ${utcStatementTimestampSql()}
      WHERE "notificationIntentId" = ${input.intentId}
        AND "attemptNumber" = ${input.attemptNumber}
        AND "leaseToken" = ${input.leaseToken}
    `),
  ]);

  if (intentResult === 0 || attemptResult === 0) {
    await emitWorkerEvent(deps.operationalEventSink, {
      eventName: "notification_lease_lost",
      result: "REJECTED",
      reasonCode: "LEASE_LOST",
      resourceId: input.intentId,
      retryCount: input.attemptNumber,
    });
    return false;
  }

  await emitWorkerEvent(deps.operationalEventSink, {
    eventName: "notification_delivery_attempted",
    result: "STARTED",
    reasonCode: "DISPATCH_STARTED",
    resourceId: input.intentId,
    retryCount: input.attemptNumber,
  });
  return true;
}

async function markProviderCallStarted(
  deps: WorkerDependencies,
  input: { intentId: string; leaseToken: string; attemptNumber: number },
) {
  const updated = await deps.prisma.$executeRaw(Prisma.sql`
    UPDATE "NotificationDeliveryAttempt"
    SET "status" = 'PROVIDER_CALL_STARTED'
    WHERE "notificationIntentId" = ${input.intentId}
      AND "attemptNumber" = ${input.attemptNumber}
      AND "leaseToken" = ${input.leaseToken}
  `);

  return updated > 0;
}

async function loadPushSubscriptionForProvider(
  deps: WorkerDependencies,
  pushSubscriptionId: string,
) {
  const subscription = await deps.prisma.pushSubscription.findUnique({
    where: { id: pushSubscriptionId },
  });

  if (!subscription || subscription.status !== "ACTIVE") {
    return null;
  }

  const key = getPushEncryptionKey();

  return {
    endpoint: decryptOpaqueValue({
      key,
      ciphertext: subscription.endpointCiphertext,
      nonce: subscription.endpointNonce,
    }),
    p256dh: decryptOpaqueValue({
      key,
      ciphertext: subscription.p256dhCiphertext,
      nonce: subscription.p256dhNonce,
    }),
    auth: decryptOpaqueValue({
      key,
      ciphertext: subscription.authCiphertext,
      nonce: subscription.authNonce,
    }),
    subscription,
  };
}

async function getReceiptResult(
  deps: WorkerDependencies,
  intent: ClaimedIntent,
): Promise<ProviderDeliveryResult | null> {
  const receipt = await deps.prisma.notificationProviderReceipt.findUnique({
    where: {
      deliveryKey: intent.deliveryKey,
    },
  });

  if (!receipt) {
    return null;
  }

  return {
    status:
      receipt.status === "SIMULATED"
        ? "SIMULATED"
        : receipt.status === "INVALID_SUBSCRIPTION"
          ? "INVALID_SUBSCRIPTION"
          : receipt.status === "AMBIGUOUS"
            ? "AMBIGUOUS"
            : receipt.status === "RETRYABLE_FAILURE"
              ? "RETRYABLE_FAILURE"
              : receipt.status === "PERMANENT_FAILURE"
                ? "PERMANENT_FAILURE"
                : receipt.status === "SUPPRESSED"
                  ? "SUPPRESSED"
                  : "DELIVERED",
    safeResultCode: receipt.safeResultCode as SafeErrorCode,
    providerReference: receipt.providerReference ?? undefined,
    providerIdempotencyMode: mapProviderModeFromName(intent.provider),
    dispatchStarted: true,
  };
}

async function getRecoveredAmbiguousAttempt(
  deps: WorkerDependencies,
  intent: ClaimedIntent,
) {
  if (intent.attemptCount <= 1) {
    return null;
  }

  const priorAttempt = await deps.prisma.notificationDeliveryAttempt.findFirst({
    where: {
      notificationIntentId: intent.id,
      attemptNumber: {
        lt: intent.attemptCount,
      },
      status: "PROVIDER_CALL_STARTED",
    },
    orderBy: {
      attemptNumber: "desc",
    },
    select: {
      status: true,
    },
  });

  if (!priorAttempt) {
    return null;
  }

  const mode = mapProviderModeFromName(intent.provider);

  if (mode === "GUARANTEED") {
    return null;
  }

  return {
    status: "AMBIGUOUS" as const,
    safeResultCode: "ambiguous_provider_outcome" as const,
    providerIdempotencyMode: mode,
    dispatchStarted: true,
  };
}

async function dispatchWithTestProvider(
  deps: WorkerDependencies,
  intent: ClaimedIntent,
): Promise<ProviderDeliveryResult> {
  const providerIdempotencyMode = mapProviderModeFromName(intent.provider);
  const receiptResult = await getReceiptResult(deps, intent);
  if (receiptResult) {
    return receiptResult;
  }

  const simulated = simulatedProviderLedger.get(intent.deliveryKey);
  if (simulated && providerIdempotencyMode === "GUARANTEED") {
    return {
      ...simulated,
      providerIdempotencyMode,
      dispatchStarted: true,
    };
  }

  if (intent.channel === "WEB_PUSH") {
    if (!intent.pushSubscriptionId) {
      return {
        status: "INVALID_SUBSCRIPTION",
        safeResultCode: "invalid_subscription",
        providerIdempotencyMode,
        dispatchStarted: true,
      };
    }

    const decrypted = await loadPushSubscriptionForProvider(
      deps,
      intent.pushSubscriptionId,
    );

    if (!decrypted) {
      return {
        status: "INVALID_SUBSCRIPTION",
        safeResultCode: "invalid_subscription",
        providerIdempotencyMode,
        dispatchStarted: true,
      };
    }

    void hashOpaqueValue(decrypted.endpoint);
    void hashOpaqueValue(decrypted.p256dh);
    void hashOpaqueValue(decrypted.auth);
  }

  let result: ProviderDeliveryResult;

  switch (intent.notificationType) {
    case "FORCE_RETRYABLE_FAILURE":
      result = {
        status: "RETRYABLE_FAILURE",
        safeResultCode: "provider_unavailable",
        providerIdempotencyMode,
        dispatchStarted: false,
      };
      break;
    case "FORCE_INVALID_SUBSCRIPTION":
      result = {
        status: "INVALID_SUBSCRIPTION",
        safeResultCode: "invalid_subscription",
        providerIdempotencyMode,
        dispatchStarted: true,
      };
      break;
    case "FORCE_AMBIGUOUS":
      result = {
        status: "AMBIGUOUS",
        safeResultCode: "ambiguous_provider_outcome",
        providerIdempotencyMode,
        dispatchStarted: true,
      };
      break;
    case "FORCE_PERMANENT_FAILURE":
      result = {
        status: "PERMANENT_FAILURE",
        safeResultCode: "provider_rejected",
        providerIdempotencyMode,
        dispatchStarted: true,
      };
      break;
    default:
      result = {
        status: "SIMULATED",
        safeResultCode: "simulated",
        providerIdempotencyMode,
        dispatchStarted: true,
        providerReference: `simulated:${intent.deliveryKey}`,
      };
  }

  if (providerIdempotencyMode === "GUARANTEED") {
    simulatedProviderLedger.set(intent.deliveryKey, {
      status: result.status,
      safeResultCode: result.safeResultCode,
      providerReference: result.providerReference,
    });
  }

  return result;
}

function shouldPersistProviderReceipt(result: ProviderDeliveryResult) {
  if (result.providerIdempotencyMode === "NONE") {
    return false;
  }

  return result.status !== "RETRYABLE_FAILURE" && result.status !== "AMBIGUOUS";
}

async function persistProviderReceipt(
  deps: WorkerDependencies,
  intent: ClaimedIntent,
  result: ProviderDeliveryResult,
) {
  if (!shouldPersistProviderReceipt(result)) {
    return null;
  }

  return deps.prisma.notificationProviderReceipt.upsert({
    where: { deliveryKey: intent.deliveryKey },
    update: {},
    create: {
      deliveryKey: intent.deliveryKey,
      provider: intent.provider,
      providerIdempotencyMode: result.providerIdempotencyMode,
      status:
        result.status === "PERMANENT_FAILURE"
          ? "PERMANENT_FAILURE"
          : result.status === "INVALID_SUBSCRIPTION"
            ? "INVALID_SUBSCRIPTION"
            : result.status === "SUPPRESSED"
              ? "SUPPRESSED"
              : result.status === "DELIVERED"
                ? "DELIVERED"
                : "SIMULATED",
      safeResultCode: result.safeResultCode,
      providerReference: result.providerReference,
    },
  });
}

async function revalidateReminderIntentBeforeDispatch(
  deps: WorkerDependencies,
  intent: ClaimedIntent,
): Promise<SafeErrorCode | null> {
  if (intent.channel !== "WEB_PUSH" || !intent.clientId) {
    return null;
  }

  const occurrence = await deps.prisma.reminderOccurrence.findFirst({
    where: {
      notificationIntentId: intent.id,
    },
  });

  if (!occurrence) {
    return null;
  }

  const client = await deps.prisma.client.findUnique({
    where: { id: intent.clientId },
  });

  if (!client || client.deletedAt || client.restrictedAt) {
    return "account_restricted";
  }

  const preference = await deps.prisma.notificationPreference.findUnique({
    where: {
      clientId_purpose_channel: {
        clientId: intent.clientId,
        purpose: "MISSION_REMINDER",
        channel: "WEB_PUSH",
      },
    },
  });

  if (!preference || !preference.enabled) {
    return "preference_disabled";
  }

  if (deps.clock.now().getTime() > occurrence.expiresAt.getTime()) {
    return "occurrence_expired";
  }

  const localTime = getLocalTimeInTimeZone(
    deps.clock.now(),
    occurrence.timeZone,
  );
  if (
    isLocalTimeInQuietHours({
      localTime,
      quietHoursStart: preference.quietHoursStart,
      quietHoursEnd: preference.quietHoursEnd,
    })
  ) {
    return "quiet_hours";
  }

  const activeSubscription = await deps.prisma.pushSubscription.findFirst({
    where: {
      clientId: intent.clientId,
      organizationId: intent.organizationId,
      status: "ACTIVE",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!activeSubscription) {
    return "no_active_subscription";
  }

  const localDate = getLocalDateInTimeZone(deps.clock.now(), client.timeZone);
  const ledgerCount = await deps.prisma.dailyQuestionLedger.count({
    where: {
      clientId: intent.clientId,
      localDate,
    },
  });

  if (ledgerCount >= 10) {
    return "daily_cap_exhausted";
  }

  const completedMission = await deps.prisma.mission.findFirst({
    where: {
      clientId: intent.clientId,
      localDate,
      state: "COMPLETED",
    },
  });

  if (completedMission) {
    return "mission_completed";
  }

  const activeMission = await deps.prisma.mission.findFirst({
    where: {
      clientId: intent.clientId,
      state: "ACTIVE",
    },
  });

  if (activeMission) {
    return null;
  }

  const remainingApprovedQuestions = await deps.prisma.questionVersion.count({
    where: {
      legalReviewStatus: "APPROVED",
      definition: {
        organizationId: intent.organizationId,
        isAdministrative: false,
      },
      NOT: {
        definitionId: {
          in: (
            await deps.prisma.answerRevision.findMany({
              where: {
                clientId: intent.clientId,
              },
              select: {
                questionVersion: {
                  select: {
                    definitionId: true,
                  },
                },
              },
            })
          ).map((revision) => revision.questionVersion.definitionId),
        },
      },
    },
  });

  if (remainingApprovedQuestions === 0) {
    return "no_eligible_questions";
  }

  return null;
}

async function suppressReminderIntent(
  deps: WorkerDependencies,
  input: {
    intent: ClaimedIntent;
    safeReasonCode: SafeErrorCode;
  },
) {
  await deps.prisma.$transaction(async (tx) => {
    await tx.reminderOccurrence.updateMany({
      where: {
        notificationIntentId: input.intent.id,
      },
      data: {
        status:
          input.safeReasonCode === "occurrence_expired"
            ? "EXPIRED"
            : "SUPPRESSED",
        suppressionReason:
          input.safeReasonCode === "occurrence_expired"
            ? "occurrence_expired"
            : (input.safeReasonCode as
                | "preference_disabled"
                | "no_active_subscription"
                | "mission_completed"
                | "daily_cap_exhausted"
                | "no_eligible_questions"
                | "quiet_hours"
                | "account_restricted"
                | "time_zone_changed"),
      },
    });
  });

  await emitWorkerEvent(deps.operationalEventSink, {
    eventName: "reminder_dispatch_suppressed",
    result: "SUPPRESSED",
    reasonCode:
      input.safeReasonCode === "occurrence_expired"
        ? "occurrence_expired"
        : (input.safeReasonCode as
            | "preference_disabled"
            | "no_active_subscription"
            | "mission_completed"
            | "daily_cap_exhausted"
            | "no_eligible_questions"
            | "quiet_hours"
            | "account_restricted"
            | "time_zone_changed"),
    resourceId: input.intent.id,
  });

  return finalizeIntentResult(deps, {
    intent: input.intent,
    result: {
      status: "SUPPRESSED",
      safeResultCode: input.safeReasonCode,
      providerIdempotencyMode: mapProviderModeFromName(input.intent.provider),
      dispatchStarted: false,
    },
  });
}

function mapTerminalIntentStatus(result: ProviderDeliveryResult) {
  switch (result.status) {
    case "DELIVERED":
      return "DELIVERED" as const;
    case "SIMULATED":
      return "SIMULATED" as const;
    case "SUPPRESSED":
      return "SUPPRESSED" as const;
    case "PERMANENT_FAILURE":
      return "FAILED_PERMANENT" as const;
    case "INVALID_SUBSCRIPTION":
      return "INVALID_SUBSCRIPTION" as const;
    case "AMBIGUOUS":
      return "AMBIGUOUS" as const;
    default:
      return null;
  }
}

function mapAttemptStatus(result: ProviderDeliveryResult) {
  switch (result.status) {
    case "RETRYABLE_FAILURE":
      return "RETRYABLE_FAILURE";
    case "PERMANENT_FAILURE":
      return "PERMANENT_FAILURE";
    default:
      return result.status;
  }
}

function mapThrownProviderErrorToResult(
  intent: ClaimedIntent,
  error: unknown,
): ProviderDeliveryResult {
  const providerIdempotencyMode = mapProviderModeFromName(intent.provider);
  const safeResultCode = sanitizeProviderErrorCode(error);

  if (providerIdempotencyMode === "GUARANTEED") {
    if (safeResultCode === "invalid_subscription") {
      return {
        status: "INVALID_SUBSCRIPTION",
        safeResultCode,
        providerIdempotencyMode,
        dispatchStarted: true,
      };
    }

    return {
      status: "RETRYABLE_FAILURE",
      safeResultCode,
      providerIdempotencyMode,
      dispatchStarted: true,
    };
  }

  if (safeResultCode === "invalid_subscription") {
    return {
      status: "INVALID_SUBSCRIPTION",
      safeResultCode,
      providerIdempotencyMode,
      dispatchStarted: true,
    };
  }

  return {
    status: "AMBIGUOUS",
    safeResultCode: "ambiguous_provider_outcome",
    providerIdempotencyMode,
    dispatchStarted: true,
  };
}

export async function finalizeIntentResult(
  deps: WorkerDependencies,
  input: {
    intent: ClaimedIntent;
    result: ProviderDeliveryResult;
  },
) {
  await runHook(deps.testHooks?.beforeFinalizeCas, {
    intent: input.intent,
    attemptNumber: input.intent.attemptCount,
    result: input.result,
  });

  const terminalStatus = mapTerminalIntentStatus(input.result);
  const attemptNumber = input.intent.attemptCount;
  const shouldRetry =
    input.result.status === "RETRYABLE_FAILURE" &&
    input.intent.attemptCount < input.intent.maxAttempts;
  const attemptsExhausted =
    input.result.status === "RETRYABLE_FAILURE" &&
    input.intent.attemptCount >= input.intent.maxAttempts;
  const retryDelayMs = shouldRetry
    ? computeRetryDelayMs({
        attemptNumber,
        baseDelayMs: getEnv().WORKER_RETRY_BASE_MS,
        maxDelayMs: getEnv().WORKER_RETRY_MAX_MS,
        retryAfterMs: input.result.retryAfterMs,
        jitterValue: deps.jitter.next(),
      })
    : null;
  const nextStatus = shouldRetry
    ? "FAILED_RETRYABLE"
    : attemptsExhausted
      ? "FAILED_PERMANENT"
      : (terminalStatus ?? "AMBIGUOUS");

  const updated = await deps.prisma.$transaction(async (tx) => {
    const intentUpdated = await tx.$executeRaw(Prisma.sql`
      UPDATE "NotificationIntent"
      SET
        "status" = CAST(${nextStatus} AS "NotificationIntentStatus"),
        "retryAt" = ${
          shouldRetry && retryDelayMs !== null
            ? utcStatementTimestampPlusMsSql(retryDelayMs)
            : Prisma.sql`NULL`
        },
        "completedAt" = ${
          shouldRetry ? Prisma.sql`NULL` : utcStatementTimestampSql()
        },
        "leaseOwner" = NULL,
        "leaseToken" = NULL,
        "leaseExpiresAt" = NULL,
        "lastSafeErrorCode" = ${
          attemptsExhausted ? "attempts_exhausted" : input.result.safeResultCode
        },
        "updatedAt" = ${utcStatementTimestampSql()}
      WHERE "id" = ${input.intent.id}
        AND "status" = 'PROCESSING'
        AND "leaseToken" = ${input.intent.leaseToken!}
    `);

    if (intentUpdated === 0) {
      return false;
    }

    await tx.$executeRaw(Prisma.sql`
      UPDATE "NotificationDeliveryAttempt"
      SET
        "status" = CAST(${mapAttemptStatus(input.result)} AS "NotificationAttemptStatus"),
        "completedAt" = ${utcStatementTimestampSql()},
        "safeResultCode" = ${
          attemptsExhausted ? "attempts_exhausted" : input.result.safeResultCode
        },
        "retryAt" = ${
          shouldRetry && retryDelayMs !== null
            ? utcStatementTimestampPlusMsSql(retryDelayMs)
            : Prisma.sql`NULL`
        }
      WHERE "notificationIntentId" = ${input.intent.id}
        AND "attemptNumber" = ${attemptNumber}
        AND "leaseToken" = ${input.intent.leaseToken!}
    `);

    if (
      (input.result.status === "SIMULATED" ||
        input.result.status === "DELIVERED") &&
      input.intent.channel === "IN_APP" &&
      input.intent.recipientId
    ) {
      await tx.inAppNotification.upsert({
        where: {
          sourceEventId: input.intent.outboxEventId,
        },
        update: {},
        create: {
          organizationId: input.intent.organizationId,
          recipientId: input.intent.recipientId,
          sourceEventId: input.intent.outboxEventId,
          title: input.intent.title,
          body: input.intent.body,
          type: input.intent.notificationType,
        },
      });
    }

    if (
      input.result.status === "INVALID_SUBSCRIPTION" &&
      input.intent.pushSubscriptionId
    ) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "PushSubscription"
        SET
          "status" = 'INVALID',
          "revokedAt" = ${utcStatementTimestampSql()}
        WHERE "id" = ${input.intent.pushSubscriptionId}
          AND "status" = 'ACTIVE'
      `);
    }

    return true;
  });

  if (!updated) {
    await emitWorkerEvent(deps.operationalEventSink, {
      eventName: "notification_lease_lost",
      result: "REJECTED",
      reasonCode: "LEASE_LOST",
      resourceId: input.intent.id,
      retryCount: attemptNumber,
    });
    return false;
  }

  if (shouldRetry && retryDelayMs) {
    await emitWorkerEvent(deps.operationalEventSink, {
      eventName: "notification_retry_scheduled",
      result: "RETRYING",
      reasonCode: input.result.safeResultCode as
        | "provider_timeout"
        | "provider_rate_limited"
        | "provider_unavailable",
      resourceId: input.intent.id,
      retryCount: attemptNumber,
      durationMs: retryDelayMs,
    });
    return true;
  }

  if (attemptsExhausted) {
    await emitWorkerEvent(deps.operationalEventSink, {
      eventName: "notification_attempts_exhausted",
      result: "FAILED",
      reasonCode: "attempts_exhausted",
      resourceId: input.intent.id,
      retryCount: attemptNumber,
    });
    return true;
  }

  if (input.result.status === "AMBIGUOUS") {
    await emitWorkerEvent(deps.operationalEventSink, {
      eventName: "notification_ambiguous",
      result: "AMBIGUOUS",
      reasonCode: "ambiguous_provider_outcome",
      resourceId: input.intent.id,
      retryCount: attemptNumber,
    });
  }

  if (input.result.status === "INVALID_SUBSCRIPTION") {
    await emitWorkerEvent(deps.operationalEventSink, {
      eventName: "push_subscription_invalidated",
      result: "SUCCESS",
      reasonCode: "invalid_subscription",
      resourceId: input.intent.pushSubscriptionId ?? input.intent.id,
      retryCount: attemptNumber,
    });
  }

  await emitWorkerEvent(deps.operationalEventSink, {
    eventName: "notification_delivery_result",
    result:
      input.result.status === "SIMULATED"
        ? "SIMULATED"
        : input.result.status === "SUPPRESSED"
          ? "SUPPRESSED"
          : input.result.status === "RETRYABLE_FAILURE"
            ? "RETRYING"
            : input.result.status === "AMBIGUOUS"
              ? "AMBIGUOUS"
              : input.result.status === "PERMANENT_FAILURE" ||
                  input.result.status === "INVALID_SUBSCRIPTION"
                ? "FAILED"
                : "SUCCESS",
    reasonCode:
      input.result.status === "DELIVERED"
        ? "DELIVERED"
        : input.result.status === "SIMULATED"
          ? "SIMULATED"
          : input.result.status === "SUPPRESSED"
            ? "SUPPRESSED"
            : input.result.status === "RETRYABLE_FAILURE"
              ? "RETRYABLE_FAILURE"
              : input.result.status === "PERMANENT_FAILURE"
                ? "PERMANENT_FAILURE"
                : input.result.status === "INVALID_SUBSCRIPTION"
                  ? "INVALID_SUBSCRIPTION"
                  : "AMBIGUOUS",
    resourceId: input.intent.id,
    retryCount: attemptNumber,
  });

  return true;
}

async function resolveProviderResult(
  deps: WorkerDependencies,
  intent: ClaimedIntent,
) {
  if (deps.deliverIntent) {
    return deps.deliverIntent(deps, intent);
  }

  return dispatchWithTestProvider(deps, intent);
}

async function processClaimedIntentSafely(
  deps: WorkerDependencies,
  intent: ClaimedIntent,
) {
  try {
    const recoveredAmbiguous = await getRecoveredAmbiguousAttempt(deps, intent);
    if (recoveredAmbiguous) {
      const finalized = await finalizeIntentResult(deps, {
        intent,
        result: recoveredAmbiguous,
      });

      return {
        ok: finalized,
        reason: finalized ? "PROCESSED" : ("LEASE_LOST" as const),
        result: recoveredAmbiguous,
      };
    }

    const result = await resolveProviderResult(deps, intent);
    await runHook(
      deps.testHooks?.afterProviderAcceptedBeforeReceiptPersistence,
      {
        intent,
        attemptNumber: intent.attemptCount,
        result,
      },
    );
    await persistProviderReceipt(deps, intent, result);
    await runHook(
      deps.testHooks?.afterReceiptPersistenceBeforeIntentFinalization,
      {
        intent,
        attemptNumber: intent.attemptCount,
        result,
      },
    );
    const finalized = await finalizeIntentResult(deps, {
      intent,
      result,
    });
    await runHook(deps.testHooks?.afterIntentFinalization, {
      intent,
      attemptNumber: intent.attemptCount,
      result,
      finalized,
    });

    return {
      ok: finalized,
      reason: finalized ? "PROCESSED" : ("LEASE_LOST" as const),
      result,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CRASH_")) {
      throw error;
    }

    const mapped = mapThrownProviderErrorToResult(intent, error);
    const finalized = await finalizeIntentResult(deps, {
      intent,
      result: mapped,
    });

    return {
      ok: finalized,
      reason: finalized ? "PROCESSED" : ("LEASE_LOST" as const),
      result: mapped,
    };
  }
}

export async function processClaimedIntent(
  deps: WorkerDependencies,
  intent: ClaimedIntent,
) {
  await runHook(deps.testHooks?.afterClaimBeforeDispatchStarted, {
    intent,
  });

  const started = await markDispatchStarted(deps, {
    intentId: intent.id,
    leaseToken: intent.leaseToken!,
    attemptNumber: intent.attemptCount,
  });

  if (!started) {
    return { ok: false, reason: "LEASE_LOST" as const };
  }

  await runHook(deps.testHooks?.afterDispatchStartedBeforeProviderCall, {
    intent,
    attemptNumber: intent.attemptCount,
  });

  const providerCallStarted = await markProviderCallStarted(deps, {
    intentId: intent.id,
    leaseToken: intent.leaseToken!,
    attemptNumber: intent.attemptCount,
  });

  if (!providerCallStarted) {
    await emitWorkerEvent(deps.operationalEventSink, {
      eventName: "notification_lease_lost",
      result: "REJECTED",
      reasonCode: "LEASE_LOST",
      resourceId: intent.id,
      retryCount: intent.attemptCount,
    });
    return { ok: false, reason: "LEASE_LOST" as const };
  }

  const reminderSuppression = await revalidateReminderIntentBeforeDispatch(
    deps,
    intent,
  );

  if (reminderSuppression) {
    const suppressed = await suppressReminderIntent(deps, {
      intent,
      safeReasonCode: reminderSuppression,
    });
    return {
      ok: suppressed,
      reason: suppressed ? "PROCESSED" : ("LEASE_LOST" as const),
    };
  }

  return processClaimedIntentSafely(deps, intent);
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  let index = 0;

  async function runNext() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () =>
      runNext(),
    ),
  );
}

export async function processNotificationIntentBatch(
  deps: WorkerDependencies = createWorkerDependencies(),
) {
  const claimed = await claimNotificationIntents(deps);

  await runWithConcurrency(
    claimed,
    getEnv().WORKER_DELIVERY_CONCURRENCY,
    async (intent) => {
      await processClaimedIntent(deps, intent);
    },
  );

  return claimed.length;
}

export async function processPendingOutbox(
  deps: WorkerDependencies = createWorkerDependencies(),
) {
  await projectPendingOutboxEvents(deps);
  return processNotificationIntentBatch(deps);
}

export function createWorkerRuntime(
  deps: WorkerDependencies = createWorkerDependencies(),
) {
  let shutdownRequested = false;
  let running = false;
  let timer: NodeJS.Timeout | null = null;
  const inFlight = new Set<Promise<unknown>>();

  async function tick() {
    if (shutdownRequested) {
      return;
    }

    const run = processPendingOutbox(deps).catch(async (error) => {
      const code =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : null;

      if (code === "P2034") {
        await emitWorkerEvent(deps.operationalEventSink, {
          eventName: "serialization_retry",
          result: "RETRYING",
          reasonCode: "PRISMA_P2034",
        });
        return;
      }

      console.error("[worker] tick failed", {
        name:
          typeof error === "object" && error && "name" in error
            ? String(error.name)
            : "UnknownError",
        code,
      });
    });

    inFlight.add(run);
    await run.finally(() => {
      inFlight.delete(run);
    });

    if (!shutdownRequested) {
      timer = setTimeout(tick, getEnv().WORKER_POLL_MS);
    }
  }

  return {
    start() {
      if (running) {
        return;
      }

      running = true;
      timer = setTimeout(tick, 0);
    },
    async shutdown() {
      shutdownRequested = true;

      await emitWorkerEvent(deps.operationalEventSink, {
        eventName: "worker_shutdown_started",
        result: "STARTED",
        reasonCode: "SHUTDOWN_SIGNAL",
      });

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      await Promise.race([
        Promise.allSettled([...inFlight]),
        new Promise((resolve) =>
          setTimeout(resolve, getEnv().WORKER_SHUTDOWN_GRACE_MS),
        ),
      ]);

      await emitWorkerEvent(deps.operationalEventSink, {
        eventName: "worker_shutdown_completed",
        result: "SUCCESS",
        reasonCode: "SHUTDOWN_COMPLETE",
      });
    },
  };
}
