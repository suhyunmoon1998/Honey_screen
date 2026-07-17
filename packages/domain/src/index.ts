import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomInt,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";

export type Role = "CLIENT" | "STAFF" | "ADMIN";
export type ActorType = "CLIENT" | "STAFF";
export type Locale = "es" | "en";
export type MissionKind = "QUICK" | "STANDARD" | "FULL";
export type QuestionStatus = "APPROVED" | "DRAFT" | "RETIRED";
export type PrimitiveAnswer = boolean | string | number | null;
export type HoneyLevelKey =
  | "new_friend"
  | "clue_finder"
  | "time_detective"
  | "workplace_investigator"
  | "jacklaw_case_helper";
export type HoneyRewardKey =
  | "magnifying_glass"
  | "time_clock_clue"
  | "lunchbox_clue"
  | "pay_envelope_clue"
  | "investigator_vest";
export type ParticipationEventType =
  | "MISSION_COMPLETED"
  | "ONBOARDING_COMPLETED"
  | "CONTACT_PREFERENCE_COMPLETED"
  | "CATEGORY_COMPLETED"
  | "EVIDENCE_UPLOAD_CLEAN"
  | "INSTALL_PROMPT_AVAILABLE"
  | "INSTALL_PROMPT_ACCEPTED"
  | "APPINSTALLED_OBSERVED"
  | "STANDALONE_LAUNCH_OBSERVED"
  | "PUSH_SUBSCRIPTION_ACTIVE"
  | "NOTIFICATION_PERMISSION_GRANTED";
export type NotificationPurpose = "MISSION_REMINDER";
export type ReminderOccurrenceStatus =
  | "PLANNED"
  | "INTENT_CREATED"
  | "SUPPRESSED"
  | "EXPIRED"
  | "CANCELLED";
export type ReminderSuppressionReason =
  | "preference_disabled"
  | "no_active_subscription"
  | "mission_completed"
  | "daily_cap_exhausted"
  | "no_eligible_questions"
  | "quiet_hours"
  | "account_restricted"
  | "occurrence_expired"
  | "time_zone_changed"
  | "duplicate_occurrence";

export type RulePredicate =
  | {
      answerEquals: {
        questionKey: string;
        value: PrimitiveAnswer;
      };
    }
  | {
      answerOneOf: {
        questionKey: string;
        values: PrimitiveAnswer[];
      };
    }
  | {
      answerGte: {
        questionKey: string;
        value: number;
      };
    }
  | {
      answerExists: {
        questionKey: string;
      };
    }
  | {
      profileFactEquals: {
        fact: string;
        value: PrimitiveAnswer;
      };
    }
  | {
      matterFactEquals: {
        fact: string;
        value: PrimitiveAnswer;
      };
    };

export type Rule =
  | RulePredicate
  | { all: Rule[] }
  | { any: Rule[] }
  | { not: Rule };

export type QuestionSnapshot = {
  questionVersionId: string;
  definitionId?: string;
  stableKey: string;
  promptEs: string;
  promptEn: string;
  answerType: "BOOLEAN" | "TEXT" | "NUMBER" | "SINGLE_SELECT";
  displayOrder: number;
  legalReviewStatus: QuestionStatus;
};

export type SelectorQuestion = QuestionSnapshot & {
  definitionId: string;
  category: string;
  priority: number;
  emotionalWeight: number;
  estimatedEffort: number;
  isAdministrative?: boolean;
  branchRules?: Array<{
    targetDefinitionKey: string;
    priority: number;
    rule: Rule;
  }>;
  reviewFlagRules?: Array<{
    flagType: string;
    rule: Rule;
  }>;
};

export type ClarificationCandidate = {
  definitionId: string;
  stableKey: string;
};

export type RuleEvaluationContext = {
  answersByQuestionKey: Record<string, PrimitiveAnswer>;
  profileFacts?: Record<string, PrimitiveAnswer>;
  matterFacts?: Record<string, PrimitiveAnswer>;
};

export type ReviewFlagResult = {
  flagType: string;
};

export type ParticipationProjectionEvent = {
  eventType: ParticipationEventType;
  idempotencyKey: string;
  points?: number;
};

export type HoneyProfileProjection = {
  totalPoints: number;
  levelNumber: number;
  levelKey: HoneyLevelKey;
  unlockedRewardKeys: HoneyRewardKey[];
};

export type SelectionInput = {
  questions: SelectorQuestion[];
  missionKind: MissionKind;
  remainingDailyAllowance: number;
  answeredDefinitionIds: Set<string>;
  alreadyCountedTodayDefinitionIds?: Set<string>;
  clarificationRequests?: ClarificationCandidate[];
  ruleContext: RuleEvaluationContext;
};

export type MissionSelection = {
  requestedSize: number;
  selected: Array<
    SelectorQuestion & {
      position: number;
      isClarification: boolean;
      countsTowardDailyCap: boolean;
    }
  >;
};

export const answerValueSchema = z.union([
  z.boolean(),
  z.number().finite(),
  z.string().trim().min(1).max(500),
]);

const ruleSchema: z.ZodType<Rule> = z.lazy(() =>
  z.union([
    z.object({
      all: z.array(ruleSchema).min(1),
    }),
    z.object({
      any: z.array(ruleSchema).min(1),
    }),
    z.object({
      not: ruleSchema,
    }),
    z.object({
      answerEquals: z.object({
        questionKey: z.string().min(1),
        value: z.union([z.boolean(), z.number(), z.string(), z.null()]),
      }),
    }),
    z.object({
      answerOneOf: z.object({
        questionKey: z.string().min(1),
        values: z
          .array(z.union([z.boolean(), z.number(), z.string(), z.null()]))
          .min(1),
      }),
    }),
    z.object({
      answerGte: z.object({
        questionKey: z.string().min(1),
        value: z.number().finite(),
      }),
    }),
    z.object({
      answerExists: z.object({
        questionKey: z.string().min(1),
      }),
    }),
    z.object({
      profileFactEquals: z.object({
        fact: z.string().min(1),
        value: z.union([z.boolean(), z.number(), z.string(), z.null()]),
      }),
    }),
    z.object({
      matterFactEquals: z.object({
        fact: z.string().min(1),
        value: z.union([z.boolean(), z.number(), z.string(), z.null()]),
      }),
    }),
  ]),
);

export function normalizePhoneToE164(rawPhone: string) {
  const digits = rawPhone.replace(/[^\d]/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (digits.startsWith("+") && digits.length >= 8) {
    return digits;
  }

  if (rawPhone.startsWith("+") && digits.length >= 8) {
    return `+${digits}`;
  }

  throw new Error("INVALID_PHONE");
}

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashOpaqueValue(value: string) {
  return hashToken(value);
}

export function hashOtp(value: string) {
  return hashToken(value);
}

export function generateOtpCode() {
  return `${randomInt(100000, 999999)}`;
}

export type SmsSendResult =
  | { ok: true; providerReference: string }
  | { ok: false; errorCode: string; message: string };

export async function sendSms(input: {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  toE164: string;
  body: string;
}): Promise<SmsSendResult> {
  const credentials = Buffer.from(
    `${input.accountSid}:${input.authToken}`,
  ).toString("base64");

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: input.toE164,
        From: input.fromNumber,
        Body: input.body,
      }),
    },
  );

  const data = (await response.json().catch(() => null)) as {
    sid?: string;
    code?: number;
    message?: string;
  } | null;

  if (!response.ok) {
    return {
      ok: false,
      errorCode: data?.code ? String(data.code) : String(response.status),
      message: data?.message ?? "Twilio request failed.",
    };
  }

  return {
    ok: true,
    providerReference: data?.sid ?? "",
  };
}

export function isInvitationExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}

export function isOtpExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}

export function canAttemptOtp(attemptCount: number, maxAttempts: number) {
  return attemptCount < maxAttempts;
}

export function canResendOtp(resendAvailableAt: Date, now = new Date()) {
  return resendAvailableAt.getTime() <= now.getTime();
}

export function getRequestedMissionSize(
  missionKind: MissionKind,
  remainingDailyAllowance: number,
) {
  if (missionKind === "QUICK") {
    return 3;
  }

  if (missionKind === "STANDARD") {
    return 5;
  }

  return Math.min(12, Math.max(0, remainingDailyAllowance));
}

export function getLocalDateInTimeZone(date: Date, timeZone: string) {
  return Temporal.Instant.from(date.toISOString())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString();
}

const localTimePattern = /^(?<hour>[01]\d|2[0-3]):(?<minute>[0-5]\d)$/;

function parseLocalTimeParts(value: string) {
  const match = localTimePattern.exec(value);

  if (!match?.groups) {
    throw new Error("INVALID_LOCAL_TIME");
  }

  return {
    hour: Number(match.groups.hour),
    minute: Number(match.groups.minute),
  };
}

function toMinutesSinceMidnight(value: string) {
  const { hour, minute } = parseLocalTimeParts(value);
  return hour * 60 + minute;
}

export function isValidLocalTime(value: string) {
  return localTimePattern.test(value);
}

export function isLocalTimeInQuietHours(input: {
  localTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
}) {
  const time = toMinutesSinceMidnight(input.localTime);
  const start = toMinutesSinceMidnight(input.quietHoursStart);
  const end = toMinutesSinceMidnight(input.quietHoursEnd);

  if (start === end) {
    throw new Error("QUIET_HOURS_EQUAL");
  }

  if (start < end) {
    return time >= start && time < end;
  }

  return time >= start || time < end;
}

export function assertPreferredReminderTimeAllowed(input: {
  preferredLocalTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  allowedReminderTimes?: string[];
}) {
  if (!isValidLocalTime(input.preferredLocalTime)) {
    throw new Error("INVALID_PREFERRED_LOCAL_TIME");
  }

  if (
    input.allowedReminderTimes &&
    !input.allowedReminderTimes.includes(input.preferredLocalTime)
  ) {
    throw new Error("PREFERRED_TIME_NOT_ALLOWED");
  }

  if (
    isLocalTimeInQuietHours({
      localTime: input.preferredLocalTime,
      quietHoursStart: input.quietHoursStart,
      quietHoursEnd: input.quietHoursEnd,
    })
  ) {
    throw new Error("PREFERRED_TIME_IN_QUIET_HOURS");
  }
}

export function resolveScheduledInstantForLocalDate(input: {
  localDate: string;
  localTime: string;
  timeZone: string;
}) {
  const { hour, minute } = parseLocalTimeParts(input.localTime);

  return new Date(
    Temporal.ZonedDateTime.from(
      {
        timeZone: input.timeZone,
        year: Number(input.localDate.slice(0, 4)),
        month: Number(input.localDate.slice(5, 7)),
        day: Number(input.localDate.slice(8, 10)),
        hour,
        minute,
      },
      {
        disambiguation: "compatible",
      },
    ).toInstant().epochMilliseconds,
  );
}

export function getLocalTimeInTimeZone(date: Date, timeZone: string) {
  return Temporal.Instant.from(date.toISOString())
    .toZonedDateTimeISO(timeZone)
    .toPlainTime()
    .toString({
      smallestUnit: "minute",
    });
}

export function getNextLocalDate(localDate: string) {
  return Temporal.PlainDate.from(localDate).add({ days: 1 }).toString();
}

export function deriveReminderWindow(input: {
  localDate: string;
  preferredLocalTime: string;
  timeZone: string;
  catchUpWindowMinutes: number;
}) {
  const scheduledFor = resolveScheduledInstantForLocalDate({
    localDate: input.localDate,
    localTime: input.preferredLocalTime,
    timeZone: input.timeZone,
  });

  const nextLocalDateStart = resolveScheduledInstantForLocalDate({
    localDate: getNextLocalDate(input.localDate),
    localTime: "00:00",
    timeZone: input.timeZone,
  });

  const catchUpExpiry = new Date(
    scheduledFor.getTime() + input.catchUpWindowMinutes * 60 * 1000,
  );

  return {
    scheduledFor,
    expiresAt:
      catchUpExpiry.getTime() < nextLocalDateStart.getTime()
        ? catchUpExpiry
        : nextLocalDateStart,
  };
}

export function selectApprovedQuestions(
  questions: QuestionSnapshot[],
  missionSize: number,
): QuestionSnapshot[] {
  const approved = questions
    .filter((question) => question.legalReviewStatus === "APPROVED")
    .sort(
      (left, right) =>
        left.displayOrder - right.displayOrder ||
        left.stableKey.localeCompare(right.stableKey),
    );

  return approved.slice(0, missionSize);
}

export function createMissionSnapshot(
  questions: QuestionSnapshot[],
  missionSize: number,
) {
  const selected = selectApprovedQuestions(questions, missionSize);

  if (selected.length < missionSize) {
    throw new Error("NOT_ENOUGH_APPROVED_QUESTIONS");
  }

  return selected.map((question, index) => ({
    ...question,
    position: index + 1,
  }));
}

export function parseRule(rule: unknown) {
  return ruleSchema.safeParse(rule);
}

function comparePrimitive(left: PrimitiveAnswer, right: PrimitiveAnswer) {
  return left === right;
}

export function evaluateRule(
  rule: Rule,
  context: RuleEvaluationContext,
): boolean {
  const parsed = parseRule(rule);

  if (!parsed.success) {
    throw new Error("RULE_INVALID");
  }

  const validRule = parsed.data;

  if ("all" in validRule) {
    return validRule.all.every((child) => evaluateRule(child, context));
  }

  if ("any" in validRule) {
    return validRule.any.some((child) => evaluateRule(child, context));
  }

  if ("not" in validRule) {
    return !evaluateRule(validRule.not, context);
  }

  if ("answerEquals" in validRule) {
    return comparePrimitive(
      context.answersByQuestionKey[validRule.answerEquals.questionKey] ?? null,
      validRule.answerEquals.value,
    );
  }

  if ("answerOneOf" in validRule) {
    return validRule.answerOneOf.values.some((value) =>
      comparePrimitive(
        context.answersByQuestionKey[validRule.answerOneOf.questionKey] ?? null,
        value,
      ),
    );
  }

  if ("answerGte" in validRule) {
    const value =
      context.answersByQuestionKey[validRule.answerGte.questionKey] ?? null;

    return typeof value === "number" && value >= validRule.answerGte.value;
  }

  if ("answerExists" in validRule) {
    return (
      context.answersByQuestionKey[validRule.answerExists.questionKey] !==
      undefined
    );
  }

  if ("profileFactEquals" in validRule) {
    return comparePrimitive(
      context.profileFacts?.[validRule.profileFactEquals.fact] ?? null,
      validRule.profileFactEquals.value,
    );
  }

  return comparePrimitive(
    context.matterFacts?.[validRule.matterFactEquals.fact] ?? null,
    validRule.matterFactEquals.value,
  );
}

export function evaluateRuleFailClosed(
  rule: unknown,
  context: RuleEvaluationContext,
) {
  const parsed = parseRule(rule);

  if (!parsed.success) {
    return {
      ok: false as const,
      matched: false,
      reason: "RULE_INVALID" as const,
    };
  }

  try {
    return {
      ok: true as const,
      matched: evaluateRule(parsed.data, context),
    };
  } catch {
    return {
      ok: false as const,
      matched: false,
      reason: "RULE_INVALID" as const,
    };
  }
}

function stableQuestionSort(left: SelectorQuestion, right: SelectorQuestion) {
  return (
    left.priority - right.priority ||
    left.displayOrder - right.displayOrder ||
    left.stableKey.localeCompare(right.stableKey)
  );
}

function isBranchEligible(
  question: SelectorQuestion,
  context: RuleEvaluationContext,
) {
  if (!question.branchRules || question.branchRules.length === 0) {
    return true;
  }

  return question.branchRules.some(
    (rule) => evaluateRuleFailClosed(rule.rule, context).matched,
  );
}

function shouldAvoidConsecutiveHeavyQuestion(
  alreadySelected: SelectorQuestion[],
  candidate: SelectorQuestion,
  remainingCandidates: SelectorQuestion[],
) {
  const previous = alreadySelected.at(-1);

  if (!previous) {
    return false;
  }

  const isHeavy =
    previous.emotionalWeight >= 4 && candidate.emotionalWeight >= 4;

  if (!isHeavy) {
    return false;
  }

  return remainingCandidates.some(
    (question) =>
      question.definitionId !== candidate.definitionId &&
      question.emotionalWeight < 4,
  );
}

function shouldPreferLowerEffortAlternative(
  alreadySelected: SelectorQuestion[],
  candidate: SelectorQuestion,
  remainingCandidates: SelectorQuestion[],
) {
  const previous = alreadySelected.at(-1);

  if (
    !previous ||
    previous.estimatedEffort < 4 ||
    candidate.estimatedEffort < 4
  ) {
    return false;
  }

  return remainingCandidates.some((question) => question.estimatedEffort < 4);
}

export function selectMissionQuestions(
  input: SelectionInput,
): MissionSelection {
  const requestedSize = getRequestedMissionSize(
    input.missionKind,
    input.remainingDailyAllowance,
  );

  const selected: MissionSelection["selected"] = [];
  const selectedDefinitionIds = new Set<string>();
  const clarificationMap = new Map(
    (input.clarificationRequests ?? []).map((request) => [
      request.definitionId,
      request,
    ]),
  );

  const eligibleQuestions = input.questions
    .filter((question) => question.legalReviewStatus === "APPROVED")
    .filter((question) => !question.isAdministrative)
    .filter(
      (question) =>
        !input.answeredDefinitionIds.has(question.definitionId) ||
        clarificationMap.has(question.definitionId),
    )
    .filter((question) => isBranchEligible(question, input.ruleContext))
    .sort(stableQuestionSort);

  const remainingCounted = eligibleQuestions.filter(
    (question) =>
      !input.alreadyCountedTodayDefinitionIds?.has(question.definitionId),
  );

  const cap = Math.min(
    requestedSize,
    input.remainingDailyAllowance,
    remainingCounted.length,
  );

  const clarificationQuestions = eligibleQuestions.filter((question) =>
    clarificationMap.has(question.definitionId),
  );

  for (const question of clarificationQuestions) {
    if (selected.length >= cap) {
      break;
    }

    if (selectedDefinitionIds.has(question.definitionId)) {
      continue;
    }

    selected.push({
      ...question,
      position: selected.length + 1,
      isClarification: true,
      countsTowardDailyCap: !input.alreadyCountedTodayDefinitionIds?.has(
        question.definitionId,
      ),
    });
    selectedDefinitionIds.add(question.definitionId);
  }

  const groupedByCategory = new Map<string, SelectorQuestion[]>();

  for (const question of eligibleQuestions) {
    const existing = groupedByCategory.get(question.category) ?? [];
    existing.push(question);
    groupedByCategory.set(question.category, existing);
  }

  const categoryCoveragePass = Array.from(groupedByCategory.keys()).sort();

  for (const category of categoryCoveragePass) {
    if (selected.length >= cap) {
      break;
    }

    const categoryCandidates =
      groupedByCategory
        .get(category)
        ?.filter(
          (question) =>
            !selectedDefinitionIds.has(question.definitionId) &&
            !input.alreadyCountedTodayDefinitionIds?.has(question.definitionId),
        ) ?? [];

    const candidate = categoryCandidates[0];

    if (!candidate) {
      continue;
    }

    selected.push({
      ...candidate,
      position: selected.length + 1,
      isClarification: false,
      countsTowardDailyCap: true,
    });
    selectedDefinitionIds.add(candidate.definitionId);
  }

  while (selected.length < cap) {
    const remaining = eligibleQuestions.filter(
      (question) =>
        !selectedDefinitionIds.has(question.definitionId) &&
        !input.alreadyCountedTodayDefinitionIds?.has(question.definitionId),
    );

    if (remaining.length === 0) {
      break;
    }

    const candidate =
      remaining.find(
        (question) =>
          !shouldAvoidConsecutiveHeavyQuestion(selected, question, remaining) &&
          !shouldPreferLowerEffortAlternative(selected, question, remaining),
      ) ?? remaining[0];

    if (!candidate) {
      break;
    }

    selected.push({
      ...candidate,
      position: selected.length + 1,
      isClarification: false,
      countsTowardDailyCap: true,
    });
    selectedDefinitionIds.add(candidate.definitionId);
  }

  return {
    requestedSize,
    selected,
  };
}

export function deriveReviewFlags(
  question: SelectorQuestion,
  context: RuleEvaluationContext,
): ReviewFlagResult[] {
  const results: ReviewFlagResult[] = [];

  for (const rule of question.reviewFlagRules ?? []) {
    if (evaluateRuleFailClosed(rule.rule, context).matched) {
      results.push({ flagType: rule.flagType });
    }
  }

  return results;
}

export function rewardDependsOnlyOnParticipation(completedQuestions: number) {
  return completedQuestions >= 3;
}

export const HONEY_LEVELS: Array<{
  levelNumber: number;
  minPoints: number;
  key: HoneyLevelKey;
  titleEs: string;
  titleEn: string;
}> = [
  {
    levelNumber: 1,
    minPoints: 0,
    key: "new_friend",
    titleEs: "Nuevo companero",
    titleEn: "New Friend",
  },
  {
    levelNumber: 2,
    minPoints: 1,
    key: "clue_finder",
    titleEs: "Buscador de pistas",
    titleEn: "Clue Finder",
  },
  {
    levelNumber: 3,
    minPoints: 2,
    key: "time_detective",
    titleEs: "Detective del tiempo",
    titleEn: "Time Detective",
  },
  {
    levelNumber: 4,
    minPoints: 3,
    key: "workplace_investigator",
    titleEs: "Investigador del trabajo",
    titleEn: "Workplace Investigator",
  },
  {
    levelNumber: 5,
    minPoints: 4,
    key: "jacklaw_case_helper",
    titleEs: "Ayudante de casos JACKLAW",
    titleEn: "JACKLAW Case Helper",
  },
];

export const HONEY_REWARD_DEFINITIONS: Array<{
  rewardKey: HoneyRewardKey;
  unlockAtPoints: number;
  nameEs: string;
  nameEn: string;
}> = [
  {
    rewardKey: "magnifying_glass",
    unlockAtPoints: 1,
    nameEs: "Lupa de investigacion",
    nameEn: "Investigation magnifying glass",
  },
  {
    rewardKey: "time_clock_clue",
    unlockAtPoints: 2,
    nameEs: "Pista del reloj",
    nameEn: "Time-clock clue",
  },
  {
    rewardKey: "lunchbox_clue",
    unlockAtPoints: 3,
    nameEs: "Pista de lonchera",
    nameEn: "Lunchbox clue",
  },
  {
    rewardKey: "pay_envelope_clue",
    unlockAtPoints: 4,
    nameEs: "Pista de sobre de pago",
    nameEn: "Pay-envelope clue",
  },
  {
    rewardKey: "investigator_vest",
    unlockAtPoints: 4,
    nameEs: "Chaleco de investigacion",
    nameEn: "Investigator vest",
  },
];

const PARTICIPATION_POINTS: Record<ParticipationEventType, number> = {
  MISSION_COMPLETED: 1,
  ONBOARDING_COMPLETED: 1,
  CONTACT_PREFERENCE_COMPLETED: 1,
  CATEGORY_COMPLETED: 1,
  EVIDENCE_UPLOAD_CLEAN: 1,
  INSTALL_PROMPT_AVAILABLE: 0,
  INSTALL_PROMPT_ACCEPTED: 0,
  APPINSTALLED_OBSERVED: 0,
  STANDALONE_LAUNCH_OBSERVED: 0,
  PUSH_SUBSCRIPTION_ACTIVE: 0,
  NOTIFICATION_PERMISSION_GRANTED: 0,
};

export function getParticipationPointsForEvent(
  eventType: ParticipationEventType,
) {
  return PARTICIPATION_POINTS[eventType];
}

export function getHoneyLevel(totalPoints: number) {
  const safePoints = Math.max(0, totalPoints);

  return (
    [...HONEY_LEVELS]
      .reverse()
      .find((level) => safePoints >= level.minPoints) ?? HONEY_LEVELS[0]!
  );
}

export function getUnlockedHoneyRewardKeys(totalPoints: number) {
  return HONEY_REWARD_DEFINITIONS.filter(
    (reward) => totalPoints >= reward.unlockAtPoints,
  ).map((reward) => reward.rewardKey);
}

export function projectHoneyProfile(
  events: ParticipationProjectionEvent[],
): HoneyProfileProjection {
  const seenIdempotencyKeys = new Set<string>();
  let totalPoints = 0;

  for (const event of events) {
    if (seenIdempotencyKeys.has(event.idempotencyKey)) {
      continue;
    }

    seenIdempotencyKeys.add(event.idempotencyKey);
    totalPoints += Math.max(
      0,
      event.points ?? getParticipationPointsForEvent(event.eventType),
    );
  }

  const level = getHoneyLevel(totalPoints);

  return {
    totalPoints,
    levelNumber: level.levelNumber,
    levelKey: level.key,
    unlockedRewardKeys: getUnlockedHoneyRewardKeys(totalPoints),
  };
}

export function canAccessRole(role: Role, requiredRole: Role) {
  const levels: Record<Role, number> = {
    CLIENT: 1,
    STAFF: 2,
    ADMIN: 3,
  };

  return levels[role] >= levels[requiredRole];
}

export function hashPassword(password: string) {
  const salt = "honey-static-dev-salt";
  return scryptSync(password, salt, 64).toString("hex");
}

export function verifyPassword(password: string, expectedHash: string) {
  const actual = Buffer.from(hashPassword(password), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function encryptOpaqueValue(input: { key: Buffer; value: string }) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", input.key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(input.value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([ciphertext, tag]).toString("base64"),
    nonce: nonce.toString("base64"),
  };
}

export function decryptOpaqueValue(input: {
  key: Buffer;
  ciphertext: string;
  nonce: string;
}) {
  const payload = Buffer.from(input.ciphertext, "base64");
  const nonce = Buffer.from(input.nonce, "base64");
  const ciphertext = payload.subarray(0, payload.length - 16);
  const tag = payload.subarray(payload.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", input.key, nonce);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
