import {
  createHash,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";

export type Role = "CLIENT" | "STAFF" | "ADMIN";
export type ActorType = "CLIENT" | "STAFF";
export type Locale = "es" | "en";
export type MissionKind = "QUICK" | "STANDARD" | "FULL";
export type QuestionStatus = "APPROVED" | "DRAFT" | "RETIRED";
export type PrimitiveAnswer = boolean | string | number | null;

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

export function hashOtp(value: string) {
  return hashToken(value);
}

export function generateOtpCode() {
  return `${randomInt(100000, 999999)}`;
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

  return Math.min(10, Math.max(0, remainingDailyAllowance));
}

export function getLocalDateInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
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
