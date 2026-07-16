import { getEnv } from "@honey/config";
import { prisma } from "@honey/db";
import {
  deriveReminderWindow,
  getLocalDateInTimeZone,
  getLocalTimeInTimeZone,
  isLocalTimeInQuietHours,
  selectMissionQuestions,
  type Rule,
} from "@honey/domain";
import {
  JsonConsoleOperationalEventSink,
  NoopOperationalEventSink,
  createOperationalEvent,
  type EmitOperationalEventInput,
  type OperationalEventSink,
} from "@honey/observability";

type SchedulerClock = {
  now(): Date;
};

export type SchedulerDependencies = {
  prisma: typeof prisma;
  clock: SchedulerClock;
  operationalEventSink: OperationalEventSink;
};

const schedulerSink: OperationalEventSink =
  getEnv().NODE_ENV === "development"
    ? new JsonConsoleOperationalEventSink()
    : new NoopOperationalEventSink();

function createClock(): SchedulerClock {
  return {
    now: () => new Date(),
  };
}

export function createSchedulerDependencies(
  overrides: Partial<SchedulerDependencies> = {},
): SchedulerDependencies {
  return {
    prisma,
    clock: createClock(),
    operationalEventSink: schedulerSink,
    ...overrides,
  };
}

async function emitSchedulerEvent(
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
    // Telemetry must not corrupt scheduling.
  }
}

async function getRuleContextForClient(
  deps: SchedulerDependencies,
  clientId: string,
) {
  const revisions = await deps.prisma.answerRevision.findMany({
    where: { clientId },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      questionVersion: {
        include: {
          definition: true,
        },
      },
    },
  });

  return {
    answersByQuestionKey: Object.fromEntries(
      revisions.map((revision) => [
        revision.questionVersion.definition.stableKey,
        revision.valueJson as boolean | number | string | null,
      ]),
    ),
    answeredDefinitionIds: new Set(
      revisions.map((revision) => revision.questionVersion.definitionId),
    ),
  };
}

async function hasEligibleMissionContent(input: {
  deps: SchedulerDependencies;
  clientId: string;
  organizationId: string;
  localDate: string;
}) {
  const answeredContext = await getRuleContextForClient(
    input.deps,
    input.clientId,
  );
  const ledgerEntries = await input.deps.prisma.dailyQuestionLedger.findMany({
    where: {
      clientId: input.clientId,
      localDate: input.localDate,
    },
  });
  const clarificationRequests =
    await input.deps.prisma.clarificationRequest.findMany({
      where: {
        clientId: input.clientId,
        state: "OPEN",
      },
      include: {
        questionDefinition: true,
      },
    });
  const questions = await input.deps.prisma.questionVersion.findMany({
    where: {
      legalReviewStatus: "APPROVED",
      definition: {
        organizationId: input.organizationId,
      },
    },
    include: {
      definition: true,
      branchRules: true,
      reviewFlagRules: true,
    },
  });

  const selection = selectMissionQuestions({
    questions: questions.map((question) => ({
      questionVersionId: question.id,
      definitionId: question.definitionId,
      stableKey: question.definition.stableKey,
      promptEs: question.promptEs,
      promptEn: question.promptEn,
      answerType: question.answerType as
        | "BOOLEAN"
        | "TEXT"
        | "NUMBER"
        | "SINGLE_SELECT",
      displayOrder: question.displayOrder,
      legalReviewStatus: question.legalReviewStatus,
      category: question.category,
      priority: question.priority,
      emotionalWeight: question.emotionalWeight,
      estimatedEffort: question.estimatedEffort,
      isAdministrative: question.definition.isAdministrative,
      branchRules: question.branchRules.map((rule) => ({
        targetDefinitionKey: rule.targetDefinitionKey,
        priority: rule.priority,
        rule: rule.ruleJson as Rule,
      })),
      reviewFlagRules: question.reviewFlagRules.map((rule) => ({
        flagType: rule.flagType,
        rule: rule.ruleJson as Rule,
      })),
    })),
    missionKind: "QUICK",
    remainingDailyAllowance: Math.max(0, 10 - ledgerEntries.length),
    answeredDefinitionIds: answeredContext.answeredDefinitionIds,
    alreadyCountedTodayDefinitionIds: new Set(
      ledgerEntries.map((entry) => entry.questionDefinitionId),
    ),
    clarificationRequests: clarificationRequests.map((request) => ({
      definitionId: request.questionDefinitionId,
      stableKey: request.questionDefinition.stableKey,
    })),
    ruleContext: {
      answersByQuestionKey: answeredContext.answersByQuestionKey,
    },
  });

  return selection.selected.length > 0;
}

async function planOccurrenceForPreference(
  deps: SchedulerDependencies,
  preference: {
    id: string;
    organizationId: string;
    clientId: string;
    preferredLocalTime: string;
    quietHoursStart: string;
    quietHoursEnd: string;
    enabledAt: Date | null;
    client: {
      timeZone: string;
      locale: string;
      deletedAt: Date | null;
      restrictedAt: Date | null;
    };
  },
) {
  const now = deps.clock.now();
  const localDate = getLocalDateInTimeZone(now, preference.client.timeZone);
  const localTime = getLocalTimeInTimeZone(now, preference.client.timeZone);
  const window = deriveReminderWindow({
    localDate,
    preferredLocalTime: preference.preferredLocalTime,
    timeZone: preference.client.timeZone,
    catchUpWindowMinutes: getEnv().SCHEDULER_CATCH_UP_MINUTES,
  });
  const lookaheadStart = new Date(
    window.scheduledFor.getTime() -
      getEnv().SCHEDULER_LOOKAHEAD_MINUTES * 60 * 1000,
  );

  if (
    preference.enabledAt &&
    preference.enabledAt.getTime() > window.scheduledFor.getTime()
  ) {
    return null;
  }

  if (now.getTime() < lookaheadStart.getTime()) {
    return null;
  }

  const existingForCurrentZone = await deps.prisma.reminderOccurrence.findMany({
    where: {
      clientId: preference.clientId,
      purpose: "MISSION_REMINDER",
    },
    select: {
      id: true,
      localDate: true,
      timeZone: true,
      scheduledFor: true,
      status: true,
      suppressionReason: true,
    },
  });

  const equivalentCurrentDay = existingForCurrentZone.find(
    (occurrence) =>
      getLocalDateInTimeZone(
        occurrence.scheduledFor,
        preference.client.timeZone,
      ) === localDate,
  );

  if (equivalentCurrentDay) {
    await emitSchedulerEvent(deps.operationalEventSink, {
      eventName: "reminder_occurrence_conflict",
      result: "SUCCESS",
      reasonCode: "DUPLICATE_OCCURRENCE",
      resourceId: equivalentCurrentDay.id,
    });
    return equivalentCurrentDay;
  }

  let status: "PLANNED" | "SUPPRESSED" | "EXPIRED" = "PLANNED";
  let suppressionReason:
    | "preference_disabled"
    | "no_active_subscription"
    | "mission_completed"
    | "daily_cap_exhausted"
    | "no_eligible_questions"
    | "quiet_hours"
    | "account_restricted"
    | "occurrence_expired"
    | "time_zone_changed"
    | null = null;

  if (preference.client.deletedAt || preference.client.restrictedAt) {
    status = "SUPPRESSED";
    suppressionReason = "account_restricted";
  } else if (now.getTime() > window.expiresAt.getTime()) {
    status = "EXPIRED";
    suppressionReason = "occurrence_expired";
  } else if (
    isLocalTimeInQuietHours({
      localTime,
      quietHoursStart: preference.quietHoursStart,
      quietHoursEnd: preference.quietHoursEnd,
    })
  ) {
    status = "SUPPRESSED";
    suppressionReason = "quiet_hours";
  } else {
    const activeSubscription = await deps.prisma.pushSubscription.findFirst({
      where: {
        clientId: preference.clientId,
        organizationId: preference.organizationId,
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!activeSubscription) {
      status = "SUPPRESSED";
      suppressionReason = "no_active_subscription";
    } else {
      const ledgerCount = await deps.prisma.dailyQuestionLedger.count({
        where: {
          clientId: preference.clientId,
          localDate,
        },
      });

      if (ledgerCount >= 10) {
        status = "SUPPRESSED";
        suppressionReason = "daily_cap_exhausted";
      } else {
        const completedMission = await deps.prisma.mission.findFirst({
          where: {
            clientId: preference.clientId,
            localDate,
            state: "COMPLETED",
          },
        });

        if (completedMission) {
          status = "SUPPRESSED";
          suppressionReason = "mission_completed";
        } else {
          const hasEligibleContent = await hasEligibleMissionContent({
            deps,
            clientId: preference.clientId,
            organizationId: preference.organizationId,
            localDate,
          });

          if (!hasEligibleContent) {
            status = "SUPPRESSED";
            suppressionReason = "no_eligible_questions";
          }
        }
      }
    }
  }

  return deps.prisma.$transaction(async (tx) => {
    const uniqueOccurrence = {
      clientId_purpose_localDate: {
        clientId: preference.clientId,
        purpose: "MISSION_REMINDER" as const,
        localDate,
      },
    };

    await tx.reminderOccurrence.createMany({
      data: {
        organizationId: preference.organizationId,
        clientId: preference.clientId,
        purpose: "MISSION_REMINDER",
        localDate,
        timeZone: preference.client.timeZone,
        preferredLocalTime: preference.preferredLocalTime,
        scheduledFor: window.scheduledFor,
        expiresAt: window.expiresAt,
        channel: "WEB_PUSH",
        status,
        suppressionReason,
      },
      skipDuplicates: true,
    });

    const occurrence = await tx.reminderOccurrence.findUniqueOrThrow({
      where: uniqueOccurrence,
    });

    if (occurrence.status === "PLANNED") {
      await tx.outboxEvent.upsert({
        where: {
          idempotencyKey: `reminder-occurrence:${occurrence.id}:outbox:v1`,
        },
        update: {},
        create: {
          organizationId: preference.organizationId,
          eventType: "CLIENT_MISSION_REMINDER",
          aggregateType: "REMINDER_OCCURRENCE",
          aggregateId: occurrence.id,
          idempotencyKey: `reminder-occurrence:${occurrence.id}:outbox:v1`,
          availableAt: window.scheduledFor,
          payloadJson: {
            clientId: preference.clientId,
            occurrenceId: occurrence.id,
            pushSubscriptionId: null,
            title:
              preference.client.locale === "en"
                ? "Honey reminder"
                : "Recordatorio de Honey",
            body:
              preference.client.locale === "en"
                ? "🐾 Honey prepared a short mission for today."
                : "🐾 Honey preparó una misión corta para hoy.",
            templateKey: `MISSION_REMINDER_${preference.client.locale === "en" ? "EN" : "ES"}_${getEnv().REMINDER_TEMPLATE_VERSION}`,
          },
        },
      });
    }

    return occurrence;
  });
}

export async function processReminderSchedulerBatch(
  deps: SchedulerDependencies = createSchedulerDependencies(),
) {
  const startedAt = deps.clock.now();

  await emitSchedulerEvent(deps.operationalEventSink, {
    eventName: "reminder_scheduler_batch_started",
    result: "STARTED",
    reasonCode: "BATCH_STARTED",
  });

  const preferences = await deps.prisma.notificationPreference.findMany({
    where: {
      enabled: true,
      purpose: "MISSION_REMINDER",
      channel: "WEB_PUSH",
    },
    include: {
      client: {
        select: {
          timeZone: true,
          locale: true,
          deletedAt: true,
          restrictedAt: true,
        },
      },
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: getEnv().SCHEDULER_BATCH_SIZE,
  });

  let processedCount = 0;

  for (const preference of preferences) {
    const occurrence = await planOccurrenceForPreference(deps, preference);
    if (!occurrence) {
      continue;
    }

    processedCount += 1;

    if (occurrence.status === "PLANNED") {
      await emitSchedulerEvent(deps.operationalEventSink, {
        eventName: "reminder_occurrence_created",
        result: "SUCCESS",
        reasonCode: "OCCURRENCE_CREATED",
        resourceId: occurrence.id,
      });
    } else if (occurrence.status === "EXPIRED") {
      await emitSchedulerEvent(deps.operationalEventSink, {
        eventName: "reminder_occurrence_expired",
        result: "EXPIRED",
        reasonCode: "occurrence_expired",
        resourceId: occurrence.id,
      });
    } else if (occurrence.suppressionReason) {
      await emitSchedulerEvent(deps.operationalEventSink, {
        eventName: "reminder_occurrence_suppressed",
        result: "SUPPRESSED",
        reasonCode: occurrence.suppressionReason,
        resourceId: occurrence.id,
      });
    }
  }

  await emitSchedulerEvent(deps.operationalEventSink, {
    eventName: "reminder_scheduler_batch_completed",
    result: "SUCCESS",
    reasonCode: "BATCH_COMPLETED",
    retryCount: processedCount,
    durationMs: deps.clock.now().getTime() - startedAt.getTime(),
  });

  return processedCount;
}

export function createReminderSchedulerRuntime(
  deps: SchedulerDependencies = createSchedulerDependencies(),
) {
  let timer: NodeJS.Timeout | null = null;
  let shutdownRequested = false;

  async function tick() {
    if (shutdownRequested || !getEnv().SCHEDULER_ENABLED) {
      return;
    }

    await processReminderSchedulerBatch(deps).catch(() => {});

    if (!shutdownRequested) {
      timer = setTimeout(tick, getEnv().SCHEDULER_POLL_MS);
    }
  }

  return {
    start() {
      if (!getEnv().SCHEDULER_ENABLED) {
        return;
      }

      timer = setTimeout(tick, 0);
    },
    async shutdown() {
      shutdownRequested = true;
      if (timer) {
        clearTimeout(timer);
      }
    },
  };
}
