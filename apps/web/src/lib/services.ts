import { getEnv } from "@honey/config";
import { prisma, type Prisma } from "@honey/db";
import {
  answerValueSchema,
  deriveReviewFlags,
  getParticipationPointsForEvent,
  getLocalDateInTimeZone,
  hashToken as hashDomainToken,
  hashOtp,
  hashToken,
  isInvitationExpired,
  isOtpExpired,
  normalizePhoneToE164,
  parseRule,
  projectHoneyProfile,
  rewardDependsOnlyOnParticipation,
  selectMissionQuestions,
  verifyPassword,
  type MissionKind,
  type ParticipationEventType,
  type PrimitiveAnswer,
  type Rule,
} from "@honey/domain";
import type { Locale } from "@honey/i18n";
import { emitOperationalEvent } from "./operational-events";
import { createSessionRecord } from "./session";

type DbTransaction = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

type RuleValidationContext = {
  stableKeyToDefinitionId: Map<string, string>;
  optionsByStableKey: Map<string, Set<string>>;
};

async function rebuildHoneyProfile(
  tx: DbTransaction,
  input: { clientId: string; organizationId: string },
) {
  const events = await tx.participationEvent.findMany({
    where: {
      clientId: input.clientId,
      organizationId: input.organizationId,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const projected = projectHoneyProfile(
    events.map((event) => ({
      eventType: event.eventType as ParticipationEventType,
      idempotencyKey: event.idempotencyKey,
      points: event.points,
    })),
  );

  const previous = await tx.honeyProfile.findUnique({
    where: { clientId: input.clientId },
  });

  const driftDetected =
    previous &&
    (previous.totalPoints !== projected.totalPoints ||
      previous.levelNumber !== projected.levelNumber ||
      previous.levelKey !== projected.levelKey ||
      JSON.stringify(previous.unlockedRewardKeys) !==
        JSON.stringify(projected.unlockedRewardKeys));

  await tx.honeyProfile.upsert({
    where: { clientId: input.clientId },
    update: {
      organizationId: input.organizationId,
      totalPoints: projected.totalPoints,
      levelNumber: projected.levelNumber,
      levelKey: projected.levelKey,
      unlockedRewardKeys: projected.unlockedRewardKeys,
      currentState: "RESTING",
      projectionVersion: 1,
      lastProjectedAt: new Date(),
      driftDetectedAt: driftDetected ? new Date() : null,
    },
    create: {
      clientId: input.clientId,
      organizationId: input.organizationId,
      totalPoints: projected.totalPoints,
      levelNumber: projected.levelNumber,
      levelKey: projected.levelKey,
      unlockedRewardKeys: projected.unlockedRewardKeys,
      currentState: "RESTING",
      projectionVersion: 1,
      lastProjectedAt: new Date(),
      driftDetectedAt: null,
    },
  });

  return projected;
}

async function syncHoneyRewardGrants(
  tx: DbTransaction,
  input: {
    clientId: string;
    organizationId: string;
    sourceParticipationEventId: string;
    unlockedRewardKeys: string[];
  },
) {
  if (input.unlockedRewardKeys.length === 0) {
    return;
  }

  const rewardDefinitions = await tx.rewardDefinition.findMany({
    where: {
      organizationId: input.organizationId,
      rewardKey: {
        in: input.unlockedRewardKeys,
      },
    },
  });

  for (const reward of rewardDefinitions) {
    await tx.rewardGrant.upsert({
      where: {
        clientId_rewardDefinitionId: {
          clientId: input.clientId,
          rewardDefinitionId: reward.id,
        },
      },
      update: {
        sourceParticipationEventId: input.sourceParticipationEventId,
      },
      create: {
        clientId: input.clientId,
        rewardDefinitionId: reward.id,
        sourceProgressEventId: input.sourceParticipationEventId,
        sourceParticipationEventId: input.sourceParticipationEventId,
      },
    });
  }
}

async function recordParticipationEvent(
  tx: DbTransaction,
  input: {
    clientId: string;
    organizationId: string;
    eventType: ParticipationEventType;
    sourceType: string;
    sourceId: string;
    idempotencyKey: string;
    metadataJson?: Record<string, unknown>;
  },
) {
  const event = await tx.participationEvent.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: {},
    create: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      eventType: input.eventType,
      points: getParticipationPointsForEvent(input.eventType),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      idempotencyKey: input.idempotencyKey,
      metadataJson: input.metadataJson as Prisma.InputJsonValue | undefined,
    },
  });

  const profile = await rebuildHoneyProfile(tx, {
    clientId: input.clientId,
    organizationId: input.organizationId,
  });

  await syncHoneyRewardGrants(tx, {
    clientId: input.clientId,
    organizationId: input.organizationId,
    sourceParticipationEventId: event.id,
    unlockedRewardKeys: profile.unlockedRewardKeys,
  });

  return { event, profile };
}

export async function getInvitationPreview(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: {
      organization: true,
    },
  });

  if (
    !invitation ||
    invitation.deletedAt ||
    isInvitationExpired(invitation.expiresAt)
  ) {
    return null;
  }

  return invitation;
}

export async function requestOtp(input: {
  token: string;
  rawPhone: string;
  locale: Locale;
  acceptedPrivacy: boolean;
  acceptedMessages: boolean;
}) {
  const invitation = await getInvitationPreview(input.token);
  const env = getEnv();

  if (!invitation || !input.acceptedPrivacy || !input.acceptedMessages) {
    throw new Error("INVITATION_INVALID");
  }

  const phoneE164 = normalizePhoneToE164(input.rawPhone);

  if (phoneE164 !== invitation.phoneE164) {
    throw new Error("GENERIC_OTP_REQUEST");
  }

  const code = env.DEV_OTP_CODE;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const resendAvailableAt = new Date(Date.now() + 60 * 1000);

  await prisma.verificationChallenge.create({
    data: {
      phoneE164,
      codeHash: hashOtp(code),
      purpose: "CLIENT_SIGN_IN",
      expiresAt,
      resendAvailableAt,
      attemptCount: 0,
      maxAttempts: 5,
    },
  });

  return {
    phoneE164,
    devCode:
      env.NODE_ENV === "development" && env.DEV_OTP_ENABLED ? code : null,
  };
}

export async function verifyOtpAndRegister(input: {
  token: string;
  rawPhone: string;
  code: string;
  locale: Locale;
}) {
  const invitation = await getInvitationPreview(input.token);

  if (!invitation) {
    throw new Error("INVITATION_INVALID");
  }

  const phoneE164 = normalizePhoneToE164(input.rawPhone);
  const challenge = await prisma.verificationChallenge.findFirst({
    where: {
      phoneE164,
      purpose: "CLIENT_SIGN_IN",
      consumedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!challenge || isOtpExpired(challenge.expiresAt)) {
    throw new Error("OTP_INVALID");
  }

  if (challenge.attemptCount >= challenge.maxAttempts) {
    throw new Error("OTP_LOCKED");
  }

  if (challenge.codeHash !== hashOtp(input.code)) {
    await prisma.verificationChallenge.update({
      where: { id: challenge.id },
      data: {
        attemptCount: {
          increment: 1,
        },
      },
    });
    throw new Error("OTP_INVALID");
  }

  const env = getEnv();

  const sessionInput = {
    actorType: "CLIENT" as const,
    organizationId: invitation.organizationId,
    role: "CLIENT" as const,
    locale: input.locale,
  };

  const result = await prisma.$transaction(async (tx) => {
    const upsertedClient = await tx.client.upsert({
      where: { phoneE164 },
      update: {
        locale: input.locale,
        timeZone: invitation.timeZone,
      },
      create: {
        organizationId: invitation.organizationId,
        phoneE164,
        locale: input.locale,
        timeZone: invitation.timeZone,
        eligibleForDeletionAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    await tx.verificationChallenge.update({
      where: { id: challenge.id },
      data: {
        consumedAt: new Date(),
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        acceptedAt: invitation.acceptedAt ?? new Date(),
      },
    });

    const existingConsents = await tx.consentRecord.findMany({
      where: {
        clientId: upsertedClient.id,
        consentType: {
          in: ["PRIVACY_NOTICE", "TRANSACTIONAL_MESSAGES"],
        },
      },
    });

    const existingTypes = new Set(
      existingConsents.map((consent) => consent.consentType),
    );

    if (!existingTypes.has("PRIVACY_NOTICE")) {
      await tx.consentRecord.create({
        data: {
          clientId: upsertedClient.id,
          consentType: "PRIVACY_NOTICE",
          granted: true,
          policyVersion: env.PRIVACY_POLICY_VERSION,
          locale: input.locale,
        },
      });
    }

    if (!existingTypes.has("TRANSACTIONAL_MESSAGES")) {
      await tx.consentRecord.create({
        data: {
          clientId: upsertedClient.id,
          consentType: "TRANSACTIONAL_MESSAGES",
          granted: true,
          policyVersion: env.PRIVACY_POLICY_VERSION,
          locale: input.locale,
        },
      });
    }

    const staffRecipients = await tx.staffUser.findMany({
      where: {
        organizationId: invitation.organizationId,
        allowlisted: true,
      },
    });

    for (const staff of staffRecipients) {
      const idempotencyKey = `registration:${upsertedClient.id}:${staff.id}`;
      const existing = await tx.outboxEvent.findUnique({
        where: { idempotencyKey },
      });

      if (!existing) {
        await tx.outboxEvent.create({
          data: {
            organizationId: invitation.organizationId,
            eventType: "STAFF_IN_APP_NOTIFICATION",
            aggregateType: "CLIENT",
            aggregateId: upsertedClient.id,
            idempotencyKey,
            payloadJson: {
              recipientId: staff.id,
              type: "CLIENT_REGISTERED",
              title: "Nuevo registro de cliente",
              body: "Un cliente ficticio completo su registro inicial con Honey.",
            },
          },
        });
      }
    }

    const createdSession = await createSessionRecord(
      tx,
      {
        ...sessionInput,
        actorId: upsertedClient.id,
      },
      new Date(),
    );

    return {
      client: upsertedClient,
      session: createdSession,
    };
  });

  return result;
}

export async function completeOnboarding(input: {
  clientId: string;
  timeZone: string;
  locale: Locale;
}) {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.client.findUniqueOrThrow({
      where: { id: input.clientId },
    });

    const client = await tx.client.update({
      where: { id: input.clientId },
      data: {
        timeZone: input.timeZone,
        locale: input.locale,
        onboardingCompletedAt: new Date(),
      },
    });

    if (previous.timeZone !== input.timeZone) {
      await tx.auditEvent.create({
        data: {
          organizationId: previous.organizationId,
          actorType: "CLIENT",
          actorId: previous.id,
          action: "CLIENT_TIME_ZONE_CHANGED",
          targetType: "CLIENT",
          targetId: previous.id,
          metadataJson: {
            previousTimeZone: previous.timeZone,
            nextTimeZone: input.timeZone,
          },
        },
      });
    }

    await recordParticipationEvent(tx, {
      clientId: client.id,
      organizationId: client.organizationId,
      eventType: "ONBOARDING_COMPLETED",
      sourceType: "CLIENT",
      sourceId: client.id,
      idempotencyKey: `onboarding_completed:${client.id}`,
    });

    return client;
  });
}

function buildMissionRequestHash(input: {
  missionKind: MissionKind;
  localDate: string;
}) {
  return hashDomainToken(`${input.missionKind}:${input.localDate}`);
}

type RuleContextStore = Pick<typeof prisma, "answerRevision">;

async function getRuleContextForClient(
  tx: RuleContextStore,
  clientId: string,
  currentAnswer?: { stableKey: string; value: unknown },
) {
  const revisions = await tx.answerRevision.findMany({
    where: {
      clientId,
    },
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

  const answersByQuestionKey: Record<string, boolean | number | string | null> =
    {};
  const answeredDefinitionIds = new Set<string>();

  for (const revision of revisions) {
    answersByQuestionKey[revision.questionVersion.definition.stableKey] =
      revision.valueJson as boolean | number | string | null;
    answeredDefinitionIds.add(revision.questionVersion.definitionId);
  }

  if (currentAnswer) {
    answersByQuestionKey[currentAnswer.stableKey] = currentAnswer.value as
      | boolean
      | number
      | string
      | null;
  }

  return {
    answersByQuestionKey,
    answeredDefinitionIds,
  };
}

async function loadMissionById(missionId: string) {
  return prisma.mission.findUniqueOrThrow({
    where: { id: missionId },
    include: {
      slots: {
        include: {
          questionVersion: {
            include: {
              definition: true,
              branchRules: true,
              reviewFlagRules: true,
            },
          },
        },
        orderBy: {
          position: "asc",
        },
      },
    },
  });
}

function isRetryableTransactionError(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2034"
  );
}

async function runWithSerializationRetry<T>(
  operation: (retryCount: number) => Promise<T>,
) {
  let retryCount = 0;

  while (true) {
    try {
      return await operation(retryCount);
    } catch (error) {
      if (!isRetryableTransactionError(error) || retryCount >= 2) {
        throw error;
      }

      retryCount += 1;
      await emitOperationalEvent({
        eventName: "serialization_retry",
        result: "RETRYING",
        reasonCode: "PRISMA_P2034",
        retryCount,
      });
    }
  }
}

function collectRuleReferences(
  rule: Rule,
  references: Array<{
    questionKey: string;
    predicate: "answerEquals" | "answerOneOf" | "answerGte" | "answerExists";
    values?: PrimitiveAnswer[];
  }>,
) {
  if ("all" in rule) {
    for (const child of rule.all) {
      collectRuleReferences(child, references);
    }
    return references;
  }

  if ("any" in rule) {
    for (const child of rule.any) {
      collectRuleReferences(child, references);
    }
    return references;
  }

  if ("not" in rule) {
    collectRuleReferences(rule.not, references);
    return references;
  }

  if ("answerEquals" in rule) {
    references.push({
      questionKey: rule.answerEquals.questionKey,
      predicate: "answerEquals",
      values: [rule.answerEquals.value],
    });
    return references;
  }

  if ("answerOneOf" in rule) {
    references.push({
      questionKey: rule.answerOneOf.questionKey,
      predicate: "answerOneOf",
      values: rule.answerOneOf.values,
    });
    return references;
  }

  if ("answerGte" in rule) {
    references.push({
      questionKey: rule.answerGte.questionKey,
      predicate: "answerGte",
      values: [rule.answerGte.value],
    });
    return references;
  }

  if ("answerExists" in rule) {
    references.push({
      questionKey: rule.answerExists.questionKey,
      predicate: "answerExists",
    });
  }

  return references;
}

function createRuleValidationContext(
  definitions: Array<{
    stableKey: string;
    versions: Array<{
      options: Array<{
        value: string;
      }>;
    }>;
  }>,
): RuleValidationContext {
  return {
    stableKeyToDefinitionId: new Map(
      definitions.map((definition, index) => [
        definition.stableKey,
        String(index),
      ]),
    ),
    optionsByStableKey: new Map(
      definitions.map((definition) => [
        definition.stableKey,
        new Set(
          definition.versions.flatMap((version) =>
            version.options.map((option) => option.value),
          ),
        ),
      ]),
    ),
  };
}

async function emitRuleValidationFailure(input: {
  reasonCode: "RULE_INVALID" | "RULE_TARGET_MISSING";
  resourceId: string;
}) {
  await emitOperationalEvent({
    eventName: "rule_evaluation_failed",
    result: "FAIL_CLOSED",
    reasonCode: input.reasonCode,
    resourceId: input.resourceId,
  });
}

async function assertRuleIsOperationallyValid(
  ruleJson: unknown,
  validationContext: RuleValidationContext,
  resourceId: string,
) {
  const parsed = parseRule(ruleJson);

  if (!parsed.success) {
    await emitRuleValidationFailure({
      reasonCode: "RULE_INVALID",
      resourceId,
    });
    throw new Error("RULE_INVALID");
  }

  const references = collectRuleReferences(parsed.data, []);

  for (const reference of references) {
    if (!validationContext.stableKeyToDefinitionId.has(reference.questionKey)) {
      await emitRuleValidationFailure({
        reasonCode: "RULE_TARGET_MISSING",
        resourceId,
      });
      throw new Error("RULE_TARGET_MISSING");
    }

    const optionValues =
      validationContext.optionsByStableKey.get(reference.questionKey) ??
      new Set();

    if (optionValues.size === 0 || !reference.values) {
      continue;
    }

    const invalidOptionValue = reference.values.find(
      (value) => typeof value === "string" && !optionValues.has(value),
    );

    if (invalidOptionValue !== undefined) {
      await emitRuleValidationFailure({
        reasonCode: "RULE_INVALID",
        resourceId,
      });
      throw new Error("RULE_INVALID");
    }
  }
}

export async function getOrCreateMission(input: {
  clientId: string;
  organizationId: string;
  locale: Locale;
  missionKind: MissionKind;
  idempotencyKey?: string;
  now?: Date;
}) {
  const startedAt = Date.now();
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: input.clientId },
  });
  const now = input.now ?? new Date();
  const localDate = getLocalDateInTimeZone(now, client.timeZone);
  const requestHash = buildMissionRequestHash({
    missionKind: input.missionKind,
    localDate,
  });
  let finalRetryCount = 0;

  await emitOperationalEvent({
    eventName: "mission_creation_attempted",
    result: "STARTED",
    reasonCode: "MISSION_CREATE",
    resourceId: input.clientId,
  });

  if (input.idempotencyKey) {
    const existingRecord = await prisma.idempotencyRecord.findUnique({
      where: {
        clientId_scope_key: {
          clientId: input.clientId,
          scope: "MISSION_CREATE",
          key: input.idempotencyKey,
        },
      },
    });

    if (existingRecord) {
      if (existingRecord.requestHash !== requestHash) {
        throw new Error("IDEMPOTENCY_CONFLICT");
      }

      if (existingRecord.resourceId) {
        return loadMissionById(existingRecord.resourceId);
      }
    }
  }

  try {
    const createdMission = await runWithSerializationRetry((retryCount) => {
      finalRetryCount = retryCount;

      return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
          input.clientId,
          localDate,
        );

        const activeMission = await tx.mission.findFirst({
          where: {
            clientId: input.clientId,
            state: "ACTIVE",
          },
          include: {
            slots: {
              include: {
                questionVersion: {
                  include: {
                    definition: true,
                    branchRules: true,
                    reviewFlagRules: true,
                  },
                },
              },
              orderBy: {
                position: "asc",
              },
            },
          },
        });

        if (activeMission) {
          return activeMission;
        }

        if (input.idempotencyKey) {
          const existingRecord = await tx.idempotencyRecord.findUnique({
            where: {
              clientId_scope_key: {
                clientId: input.clientId,
                scope: "MISSION_CREATE",
                key: input.idempotencyKey,
              },
            },
          });

          if (existingRecord) {
            if (existingRecord.requestHash !== requestHash) {
              throw new Error("IDEMPOTENCY_CONFLICT");
            }

            if (existingRecord.resourceId) {
              return tx.mission.findUniqueOrThrow({
                where: { id: existingRecord.resourceId },
                include: {
                  slots: {
                    include: {
                      questionVersion: {
                        include: {
                          definition: true,
                          branchRules: true,
                          reviewFlagRules: true,
                        },
                      },
                    },
                    orderBy: { position: "asc" },
                  },
                },
              });
            }
          }
        }

        const ledgerEntries = await tx.dailyQuestionLedger.findMany({
          where: {
            clientId: input.clientId,
            localDate,
          },
        });

        const remainingDailyAllowance = Math.max(0, 10 - ledgerEntries.length);

        const answeredContext = await getRuleContextForClient(
          tx,
          input.clientId,
        );
        const clarificationRequests = await tx.clarificationRequest.findMany({
          where: {
            clientId: input.clientId,
            state: "OPEN",
          },
          include: {
            questionDefinition: true,
          },
        });

        const questionDefinitions = await tx.questionDefinition.findMany({
          where: {
            organizationId: input.organizationId,
          },
          include: {
            versions: {
              include: {
                options: true,
              },
            },
          },
        });
        const validationContext =
          createRuleValidationContext(questionDefinitions);
        const questions = await tx.questionVersion.findMany({
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
        const validQuestions = [];

        for (const question of questions) {
          let isValid = true;

          for (const rule of question.branchRules) {
            if (
              !questionDefinitions.some(
                (definition) =>
                  definition.stableKey === rule.targetDefinitionKey,
              )
            ) {
              await emitRuleValidationFailure({
                reasonCode: "RULE_TARGET_MISSING",
                resourceId: question.id,
              });
              isValid = false;
              break;
            }

            try {
              await assertRuleIsOperationallyValid(
                rule.ruleJson,
                validationContext,
                question.id,
              );
            } catch {
              isValid = false;
              break;
            }
          }

          if (!isValid) {
            continue;
          }

          for (const rule of question.reviewFlagRules) {
            try {
              await assertRuleIsOperationallyValid(
                rule.ruleJson,
                validationContext,
                question.id,
              );
            } catch {
              isValid = false;
              break;
            }
          }

          if (isValid) {
            validQuestions.push(question);
          }
        }

        const selection = selectMissionQuestions({
          questions: validQuestions.map((question) => ({
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
          missionKind: input.missionKind,
          remainingDailyAllowance,
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

        if (selection.selected.length === 0) {
          throw new Error("DAILY_CAP_REACHED");
        }

        const mission = await tx.mission.create({
          data: {
            organizationId: input.organizationId,
            clientId: input.clientId,
            kind: input.missionKind,
            requestedSize: selection.selected.length,
            locale: input.locale,
            localDate,
            slots: {
              create: selection.selected.map((question) => ({
                position: question.position,
                questionDefinitionId: question.definitionId,
                questionVersionId: question.questionVersionId,
                countsTowardDailyCap: question.countsTowardDailyCap,
                isClarification: question.isClarification,
              })),
            },
          },
          include: {
            slots: {
              include: {
                questionVersion: {
                  include: {
                    definition: true,
                    branchRules: true,
                    reviewFlagRules: true,
                  },
                },
              },
              orderBy: {
                position: "asc",
              },
            },
          },
        });

        for (const slot of mission.slots) {
          await tx.dailyQuestionLedger.create({
            data: {
              organizationId: input.organizationId,
              clientId: input.clientId,
              localDate,
              questionDefinitionId: slot.questionVersion.definitionId,
              questionVersionId: slot.questionVersionId,
              missionSlotId: slot.id,
            },
          });
        }

        if (input.idempotencyKey) {
          await tx.idempotencyRecord.upsert({
            where: {
              clientId_scope_key: {
                clientId: input.clientId,
                scope: "MISSION_CREATE",
                key: input.idempotencyKey,
              },
            },
            update: {
              requestHash,
              resourceType: "MISSION",
              resourceId: mission.id,
              responseJson: { missionId: mission.id },
            },
            create: {
              organizationId: input.organizationId,
              clientId: input.clientId,
              scope: "MISSION_CREATE",
              key: input.idempotencyKey,
              requestHash,
              resourceType: "MISSION",
              resourceId: mission.id,
              responseJson: { missionId: mission.id },
              expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
          });
        }

        await tx.auditEvent.create({
          data: {
            organizationId: input.organizationId,
            actorType: "CLIENT",
            actorId: input.clientId,
            action: "MISSION_CREATED",
            targetType: "MISSION",
            targetId: mission.id,
            metadataJson: {
              missionKind: input.missionKind,
              localDate,
              requestedSize: selection.selected.length,
            },
          },
        });

        return mission;
      });
    });

    await emitOperationalEvent({
      eventName: "mission_creation_succeeded",
      result: "SUCCESS",
      reasonCode: "MISSION_CREATED",
      resourceId: createdMission.id,
      durationMs: Date.now() - startedAt,
      retryCount: finalRetryCount,
    });

    return createdMission;
  } catch (error) {
    if (error instanceof Error && error.message === "DAILY_CAP_REACHED") {
      await emitOperationalEvent({
        eventName: "daily_cap_reached",
        result: "REJECTED",
        reasonCode: "DAILY_CAP_REACHED",
        resourceId: input.clientId,
        durationMs: Date.now() - startedAt,
      });
    }

    throw error;
  }
}

export async function getOrCreateQuickMission(input: {
  clientId: string;
  organizationId: string;
  locale: Locale;
}) {
  return getOrCreateMission({
    ...input,
    missionKind: "QUICK",
  });
}

export async function getMissionForClient(missionId: string, clientId: string) {
  return prisma.mission.findFirst({
    where: {
      id: missionId,
      clientId,
    },
    include: {
      client: true,
      slots: {
        include: {
          questionVersion: {
            include: {
              definition: true,
            },
          },
          answerCurrent: true,
        },
        orderBy: {
          position: "asc",
        },
      },
    },
  });
}

export async function saveMissionAnswer(input: {
  missionId: string;
  clientId: string;
  missionSlotId: string;
  idempotencyKey: string;
  value: unknown;
}) {
  const validatedValue = answerValueSchema.parse(input.value);
  const existingRevision = await prisma.answerRevision.findFirst({
    where: {
      clientId: input.clientId,
      idempotencyKey: input.idempotencyKey,
    },
    include: {
      missionSlot: {
        include: {
          mission: true,
        },
      },
    },
  });

  if (existingRevision) {
    if (
      existingRevision.missionSlotId !== input.missionSlotId ||
      existingRevision.missionSlot.missionId !== input.missionId
    ) {
      throw new Error("IDEMPOTENCY_CONFLICT");
    }

    if (
      JSON.stringify(existingRevision.valueJson) !==
      JSON.stringify(validatedValue)
    ) {
      throw new Error("IDEMPOTENCY_CONFLICT");
    }

    return;
  }

  const mission = await prisma.mission.findFirst({
    where: {
      id: input.missionId,
      clientId: input.clientId,
    },
    include: {
      slots: {
        orderBy: { position: "asc" },
        include: {
          questionVersion: {
            include: {
              definition: true,
              reviewFlagRules: true,
            },
          },
        },
      },
      client: true,
    },
  });

  if (!mission || mission.state !== "ACTIVE") {
    throw new Error("MISSION_NOT_FOUND");
  }

  const slot = mission.slots.find(
    (candidate) => candidate.id === input.missionSlotId,
  );

  if (!slot) {
    throw new Error("SLOT_NOT_FOUND");
  }

  let missionCompleted = false;

  await prisma.$transaction(async (tx) => {
    const duplicateRevision = await tx.answerRevision.findFirst({
      where: {
        clientId: input.clientId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    if (!duplicateRevision) {
      const currentCount = await tx.answerRevision.count({
        where: { missionSlotId: slot.id },
      });

      const revision = await tx.answerRevision.create({
        data: {
          organizationId: mission.organizationId,
          clientId: input.clientId,
          missionSlotId: slot.id,
          questionVersionId: slot.questionVersionId,
          revisionNumber: currentCount + 1,
          valueJson: validatedValue as never,
          idempotencyKey: input.idempotencyKey,
          createdLocalDate: getLocalDateInTimeZone(
            new Date(),
            mission.client.timeZone,
          ),
        },
      });

      await tx.answerCurrent.upsert({
        where: { missionSlotId: slot.id },
        update: {
          latestRevisionId: revision.id,
        },
        create: {
          missionSlotId: slot.id,
          latestRevisionId: revision.id,
        },
      });

      await tx.missionSlot.update({
        where: { id: slot.id },
        data: {
          state: "ANSWERED",
          answeredAt: new Date(),
        },
      });

      const ruleContext = await getRuleContextForClient(tx, input.clientId, {
        stableKey: slot.questionVersion.definition.stableKey,
        value: validatedValue,
      });

      const reviewFlags = deriveReviewFlags(
        {
          questionVersionId: slot.questionVersion.id,
          definitionId: slot.questionVersion.definitionId,
          stableKey: slot.questionVersion.definition.stableKey,
          promptEs: slot.questionVersion.promptEs,
          promptEn: slot.questionVersion.promptEn,
          answerType: slot.questionVersion.answerType as
            | "BOOLEAN"
            | "TEXT"
            | "NUMBER"
            | "SINGLE_SELECT",
          displayOrder: slot.questionVersion.displayOrder,
          legalReviewStatus: slot.questionVersion.legalReviewStatus,
          category: slot.questionVersion.category,
          priority: slot.questionVersion.priority,
          emotionalWeight: slot.questionVersion.emotionalWeight,
          estimatedEffort: slot.questionVersion.estimatedEffort,
          reviewFlagRules: slot.questionVersion.reviewFlagRules.map((rule) => ({
            flagType: rule.flagType,
            rule: rule.ruleJson as Rule,
          })),
        },
        {
          answersByQuestionKey: ruleContext.answersByQuestionKey,
        },
      );

      for (const flag of reviewFlags) {
        await tx.reviewFlag.upsert({
          where: {
            clientId_answerRevisionId_flagType: {
              clientId: input.clientId,
              answerRevisionId: revision.id,
              flagType: flag.flagType,
            },
          },
          update: {},
          create: {
            organizationId: mission.organizationId,
            clientId: input.clientId,
            missionSlotId: slot.id,
            answerRevisionId: revision.id,
            flagType: flag.flagType,
          },
        });
      }
    }

    const answeredCount = await tx.missionSlot.count({
      where: {
        missionId: mission.id,
        state: "ANSWERED",
      },
    });

    if (answeredCount >= mission.requestedSize) {
      missionCompleted = true;
      await tx.mission.update({
        where: { id: mission.id },
        data: {
          state: "COMPLETED",
          completedAt: new Date(),
        },
      });

      if (rewardDependsOnlyOnParticipation(mission.requestedSize)) {
        await recordParticipationEvent(tx, {
          clientId: mission.clientId,
          organizationId: mission.organizationId,
          eventType: "MISSION_COMPLETED",
          sourceType: "MISSION",
          sourceId: mission.id,
          idempotencyKey: `mission_completed:${mission.id}`,
        });
      }

      const staffRecipients = await tx.staffUser.findMany({
        where: {
          organizationId: mission.organizationId,
          allowlisted: true,
        },
      });

      for (const staff of staffRecipients) {
        const idempotencyKey = `mission_complete:${mission.id}:${staff.id}`;
        const existing = await tx.outboxEvent.findUnique({
          where: { idempotencyKey },
        });

        if (!existing) {
          await tx.outboxEvent.create({
            data: {
              organizationId: mission.organizationId,
              eventType: "STAFF_IN_APP_NOTIFICATION",
              aggregateType: "MISSION",
              aggregateId: mission.id,
              idempotencyKey,
              payloadJson: {
                recipientId: staff.id,
                type: "MISSION_COMPLETED",
                title: "Mision completada",
                body: "Un cliente ficticio completo una mision corta con Honey.",
              },
            },
          });
        }
      }
    }
  });

  if (missionCompleted) {
    await emitOperationalEvent({
      eventName: "mission_completed",
      result: "SUCCESS",
      reasonCode: "MISSION_COMPLETED",
      resourceId: mission.id,
    });
  }
}

async function getAuthorizedStaffActor(
  tx: DbTransaction,
  actorId: string,
  requiredRole: "STAFF" | "ADMIN",
) {
  const staff = await tx.staffUser.findUniqueOrThrow({
    where: { id: actorId },
  });

  if (
    staff.role !== requiredRole &&
    !(staff.role === "ADMIN" && requiredRole === "STAFF")
  ) {
    throw new Error("FORBIDDEN");
  }

  return staff;
}

async function assertQuestionVersionReadyForApproval(
  tx: DbTransaction,
  input: {
    versionId: string;
    organizationId: string;
  },
) {
  const version = await tx.questionVersion.findFirstOrThrow({
    where: {
      id: input.versionId,
      definition: {
        organizationId: input.organizationId,
      },
    },
    include: {
      definition: true,
      options: true,
      branchRules: true,
      reviewFlagRules: true,
    },
  });
  const definitions = await tx.questionDefinition.findMany({
    where: {
      organizationId: input.organizationId,
    },
    include: {
      versions: {
        include: {
          options: true,
        },
      },
    },
  });
  const validationContext = createRuleValidationContext(definitions);

  for (const rule of version.branchRules) {
    if (
      !definitions.some(
        (definition) => definition.stableKey === rule.targetDefinitionKey,
      )
    ) {
      await emitRuleValidationFailure({
        reasonCode: "RULE_TARGET_MISSING",
        resourceId: version.id,
      });
      throw new Error("RULE_TARGET_MISSING");
    }

    await assertRuleIsOperationallyValid(
      rule.ruleJson,
      validationContext,
      version.id,
    );
  }

  for (const rule of version.reviewFlagRules) {
    await assertRuleIsOperationallyValid(
      rule.ruleJson,
      validationContext,
      version.id,
    );
  }

  if (version.answerType === "SINGLE_SELECT" && version.options.length === 0) {
    await emitRuleValidationFailure({
      reasonCode: "RULE_INVALID",
      resourceId: version.id,
    });
    throw new Error("RULE_INVALID");
  }

  return version;
}

export async function createDraftQuestionVersion(input: {
  actorId: string;
  definitionId: string;
  promptEs: string;
  promptEn: string;
}) {
  return prisma.$transaction(async (tx) => {
    const actor = await getAuthorizedStaffActor(tx, input.actorId, "ADMIN");
    const definition = await tx.questionDefinition.findFirstOrThrow({
      where: {
        id: input.definitionId,
        organizationId: actor.organizationId,
      },
      include: {
        versions: {
          orderBy: [{ versionNumber: "desc" }],
          include: {
            options: {
              orderBy: { displayOrder: "asc" },
            },
            branchRules: {
              orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
            },
            reviewFlagRules: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    const sourceVersion =
      definition.versions.find(
        (version) => version.legalReviewStatus === "APPROVED",
      ) ?? definition.versions[0];

    if (!sourceVersion) {
      throw new Error("QUESTION_VERSION_SOURCE_NOT_FOUND");
    }

    const draft = await tx.questionVersion.create({
      data: {
        definitionId: definition.id,
        versionNumber: sourceVersion.versionNumber + 1,
        promptEs: input.promptEs.trim(),
        promptEn: input.promptEn.trim(),
        answerType: sourceVersion.answerType,
        category: sourceVersion.category,
        priority: sourceVersion.priority,
        emotionalWeight: sourceVersion.emotionalWeight,
        estimatedEffort: sourceVersion.estimatedEffort,
        answerSchemaJson:
          sourceVersion.answerSchemaJson === undefined
            ? undefined
            : (sourceVersion.answerSchemaJson as never),
        activeFrom: sourceVersion.activeFrom,
        activeUntil: sourceVersion.activeUntil,
        legalReviewStatus: "DRAFT",
        displayOrder: sourceVersion.displayOrder,
        fictionalSeed: sourceVersion.fictionalSeed,
        createdByStaffId: actor.id,
        options: {
          create: sourceVersion.options.map((option) => ({
            optionKey: option.optionKey,
            value: option.value,
            labelEs: option.labelEs,
            labelEn: option.labelEn,
            displayOrder: option.displayOrder,
          })),
        },
        branchRules: {
          create: sourceVersion.branchRules.map((rule) => ({
            targetDefinitionKey: rule.targetDefinitionKey,
            priority: rule.priority,
            ruleJson: rule.ruleJson as never,
          })),
        },
        reviewFlagRules: {
          create: sourceVersion.reviewFlagRules.map((rule) => ({
            flagType: rule.flagType,
            ruleJson: rule.ruleJson as never,
          })),
        },
      },
      include: {
        options: true,
        branchRules: true,
        reviewFlagRules: true,
      },
    });

    await tx.auditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorType: "STAFF",
        actorId: actor.id,
        action: "QUESTION_VERSION_DRAFT_CREATED",
        targetType: "QUESTION_VERSION",
        targetId: draft.id,
        metadataJson: {
          definitionId: definition.id,
          versionNumber: draft.versionNumber,
        },
      },
    });

    return draft;
  });
}

export async function approveDraftQuestionVersion(input: {
  actorId: string;
  versionId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const actor = await getAuthorizedStaffActor(tx, input.actorId, "ADMIN");
    const version = await assertQuestionVersionReadyForApproval(tx, {
      versionId: input.versionId,
      organizationId: actor.organizationId,
    });

    if (version.legalReviewStatus === "APPROVED") {
      return version;
    }

    if (version.legalReviewStatus !== "DRAFT") {
      throw new Error("QUESTION_VERSION_NOT_DRAFT");
    }

    const approvedAt = new Date();

    await tx.questionVersion.updateMany({
      where: {
        definitionId: version.definitionId,
        legalReviewStatus: "APPROVED",
      },
      data: {
        legalReviewStatus: "RETIRED",
        retiredAt: approvedAt,
      },
    });

    const approved = await tx.questionVersion.update({
      where: { id: version.id },
      data: {
        legalReviewStatus: "APPROVED",
        approvedByStaffId: actor.id,
        approvedAt,
        retiredAt: null,
      },
    });

    await tx.auditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorType: "STAFF",
        actorId: actor.id,
        action: "QUESTION_VERSION_APPROVED",
        targetType: "QUESTION_VERSION",
        targetId: approved.id,
        metadataJson: {
          definitionId: version.definitionId,
          versionNumber: approved.versionNumber,
        },
      },
    });

    await emitOperationalEvent({
      eventName: "question_version_approved",
      result: "SUCCESS",
      reasonCode: "QUESTION_VERSION_APPROVED",
      resourceId: approved.id,
    });

    return approved;
  });
}

export async function retireQuestionVersion(input: {
  actorId: string;
  versionId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const actor = await getAuthorizedStaffActor(tx, input.actorId, "ADMIN");
    const version = await tx.questionVersion.findFirstOrThrow({
      where: {
        id: input.versionId,
        definition: {
          organizationId: actor.organizationId,
        },
      },
    });

    if (version.legalReviewStatus === "RETIRED") {
      return version;
    }

    const retiredAt = new Date();
    const retired = await tx.questionVersion.update({
      where: { id: version.id },
      data: {
        legalReviewStatus: "RETIRED",
        retiredAt,
      },
    });

    await tx.auditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorType: "STAFF",
        actorId: actor.id,
        action: "QUESTION_VERSION_RETIRED",
        targetType: "QUESTION_VERSION",
        targetId: retired.id,
        metadataJson: {
          definitionId: retired.definitionId,
          versionNumber: retired.versionNumber,
        },
      },
    });

    await emitOperationalEvent({
      eventName: "question_version_retired",
      result: "SUCCESS",
      reasonCode: "QUESTION_VERSION_RETIRED",
      resourceId: retired.id,
    });

    return retired;
  });
}

export async function signInStaff(input: { email: string; password: string }) {
  const env = getEnv();

  if (!env.DEV_STAFF_AUTH_ENABLED) {
    throw new Error("STAFF_AUTH_DISABLED");
  }

  const staff = await prisma.staffUser.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (
    !staff ||
    !staff.allowlisted ||
    !verifyPassword(input.password, staff.passwordHash)
  ) {
    throw new Error("STAFF_LOGIN_INVALID");
  }

  return staff;
}
