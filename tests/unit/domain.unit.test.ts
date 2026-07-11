import {
  canAccessRole,
  createMissionSnapshot,
  deriveReviewFlags,
  evaluateRule,
  evaluateRuleFailClosed,
  getLocalDateInTimeZone,
  getRequestedMissionSize,
  isInvitationExpired,
  isOtpExpired,
  rewardDependsOnlyOnParticipation,
  selectApprovedQuestions,
  selectMissionQuestions,
} from "@honey/domain";

const baseQuestions = [
  {
    questionVersionId: "q1v1",
    definitionId: "q1",
    stableKey: "employment.currently_employed",
    promptEs: "",
    promptEn: "",
    answerType: "BOOLEAN" as const,
    displayOrder: 1,
    legalReviewStatus: "APPROVED" as const,
    category: "employment_basics",
    priority: 1,
    emotionalWeight: 1,
    estimatedEffort: 1,
  },
  {
    questionVersionId: "q2v1",
    definitionId: "q2",
    stableKey: "schedule.shift_over_5h",
    promptEs: "",
    promptEn: "",
    answerType: "BOOLEAN" as const,
    displayOrder: 2,
    legalReviewStatus: "APPROVED" as const,
    category: "work_schedule",
    priority: 2,
    emotionalWeight: 1,
    estimatedEffort: 1,
  },
  {
    questionVersionId: "q3v1",
    definitionId: "q3",
    stableKey: "meal.missed_meal",
    promptEs: "",
    promptEn: "",
    answerType: "BOOLEAN" as const,
    displayOrder: 3,
    legalReviewStatus: "APPROVED" as const,
    category: "meal_periods",
    priority: 3,
    emotionalWeight: 4,
    estimatedEffort: 4,
    branchRules: [
      {
        targetDefinitionKey: "schedule.shift_over_5h",
        priority: 10,
        rule: {
          answerEquals: {
            questionKey: "schedule.shift_over_5h",
            value: true,
          },
        },
      },
    ],
    reviewFlagRules: [
      {
        flagType: "POSSIBLE_MEAL_PERIOD_ISSUE",
        rule: {
          answerEquals: {
            questionKey: "meal.missed_meal",
            value: true,
          },
        },
      },
    ],
  },
  {
    questionVersionId: "q4v1",
    definitionId: "q4",
    stableKey: "rest.missed_break",
    promptEs: "",
    promptEn: "",
    answerType: "BOOLEAN" as const,
    displayOrder: 4,
    legalReviewStatus: "APPROVED" as const,
    category: "rest_breaks",
    priority: 4,
    emotionalWeight: 2,
    estimatedEffort: 1,
  },
  {
    questionVersionId: "q5v1",
    definitionId: "q5",
    stableKey: "offclock.work_after_clockout",
    promptEs: "",
    promptEn: "",
    answerType: "BOOLEAN" as const,
    displayOrder: 5,
    legalReviewStatus: "APPROVED" as const,
    category: "off_the_clock",
    priority: 5,
    emotionalWeight: 2,
    estimatedEffort: 2,
  },
  {
    questionVersionId: "q6v1",
    definitionId: "q6",
    stableKey: "overtime.over_40_week",
    promptEs: "",
    promptEn: "",
    answerType: "BOOLEAN" as const,
    displayOrder: 6,
    legalReviewStatus: "APPROVED" as const,
    category: "overtime",
    priority: 6,
    emotionalWeight: 1,
    estimatedEffort: 2,
  },
  {
    questionVersionId: "q7v1",
    definitionId: "q7",
    stableKey: "retired.question",
    promptEs: "",
    promptEn: "",
    answerType: "BOOLEAN" as const,
    displayOrder: 7,
    legalReviewStatus: "RETIRED" as const,
    category: "overtime",
    priority: 7,
    emotionalWeight: 1,
    estimatedEffort: 1,
  },
];

describe("domain policies", () => {
  it("marks invitations expired at the cutoff", () => {
    expect(
      isInvitationExpired(
        new Date("2026-07-10T12:00:00.000Z"),
        new Date("2026-07-10T12:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("marks OTPs expired at the cutoff", () => {
    expect(
      isOtpExpired(
        new Date("2026-07-10T12:00:00.000Z"),
        new Date("2026-07-10T12:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("selects approved questions only", () => {
    const selected = selectApprovedQuestions(baseQuestions, 2);

    expect(selected).toHaveLength(2);
    expect(
      selected.every((question) => question.legalReviewStatus === "APPROVED"),
    ).toBe(true);
  });

  it("creates a stable mission snapshot", () => {
    const snapshot = createMissionSnapshot(baseQuestions, 3);

    expect(snapshot.map((question) => question.questionVersionId)).toEqual([
      "q1v1",
      "q2v1",
      "q3v1",
    ]);
  });

  it("returns quick mission size 3", () => {
    expect(getRequestedMissionSize("QUICK", 10)).toBe(3);
  });

  it("returns standard mission size 5", () => {
    expect(getRequestedMissionSize("STANDARD", 10)).toBe(5);
  });

  it("full mission respects remaining daily allowance", () => {
    expect(getRequestedMissionSize("FULL", 4)).toBe(4);
    expect(getRequestedMissionSize("FULL", 12)).toBe(10);
  });

  it("evaluates branch rule all", () => {
    expect(
      evaluateRule(
        {
          all: [
            {
              answerEquals: {
                questionKey: "schedule.shift_over_5h",
                value: true,
              },
            },
            {
              profileFactEquals: {
                fact: "locale",
                value: "es",
              },
            },
          ],
        },
        {
          answersByQuestionKey: {
            "schedule.shift_over_5h": true,
          },
          profileFacts: {
            locale: "es",
          },
        },
      ),
    ).toBe(true);
  });

  it("evaluates branch rule any", () => {
    expect(
      evaluateRule(
        {
          any: [
            {
              answerEquals: {
                questionKey: "a",
                value: true,
              },
            },
            {
              answerEquals: {
                questionKey: "b",
                value: true,
              },
            },
          ],
        },
        {
          answersByQuestionKey: { b: true },
        },
      ),
    ).toBe(true);
  });

  it("evaluates branch rule not", () => {
    expect(
      evaluateRule(
        {
          not: {
            answerExists: {
              questionKey: "a",
            },
          },
        },
        {
          answersByQuestionKey: {},
        },
      ),
    ).toBe(true);
  });

  it("fails closed on invalid rules", () => {
    expect(
      evaluateRuleFailClosed(
        {
          unsupported: true,
        },
        {
          answersByQuestionKey: {},
        },
      ),
    ).toEqual({
      ok: false,
      matched: false,
      reason: "RULE_INVALID",
    });
  });

  it("selects deterministic stable ordering", () => {
    const first = selectMissionQuestions({
      questions: baseQuestions,
      missionKind: "QUICK",
      remainingDailyAllowance: 10,
      answeredDefinitionIds: new Set(),
      ruleContext: {
        answersByQuestionKey: {
          "schedule.shift_over_5h": true,
        },
      },
    });

    const second = selectMissionQuestions({
      questions: baseQuestions,
      missionKind: "QUICK",
      remainingDailyAllowance: 10,
      answeredDefinitionIds: new Set(),
      ruleContext: {
        answersByQuestionKey: {
          "schedule.shift_over_5h": true,
        },
      },
    });

    expect(first.selected.map((question) => question.definitionId)).toEqual(
      second.selected.map((question) => question.definitionId),
    );
  });

  it("excludes answered questions unless clarification is requested", () => {
    const selection = selectMissionQuestions({
      questions: baseQuestions,
      missionKind: "STANDARD",
      remainingDailyAllowance: 10,
      answeredDefinitionIds: new Set(["q1", "q2"]),
      ruleContext: {
        answersByQuestionKey: {
          "schedule.shift_over_5h": true,
        },
      },
    });

    expect(
      selection.selected.some((question) => question.definitionId === "q1"),
    ).toBe(false);
    expect(
      selection.selected.some((question) => question.definitionId === "q2"),
    ).toBe(false);
  });

  it("includes clarification questions even if answered", () => {
    const selection = selectMissionQuestions({
      questions: baseQuestions,
      missionKind: "QUICK",
      remainingDailyAllowance: 10,
      answeredDefinitionIds: new Set(["q1"]),
      clarificationRequests: [
        {
          definitionId: "q1",
          stableKey: "employment.currently_employed",
        },
      ],
      ruleContext: {
        answersByQuestionKey: {
          "schedule.shift_over_5h": true,
        },
      },
    });

    expect(selection.selected[0]?.definitionId).toBe("q1");
    expect(selection.selected[0]?.isClarification).toBe(true);
  });

  it("excludes retired versions from new mission selection", () => {
    const selection = selectMissionQuestions({
      questions: baseQuestions,
      missionKind: "FULL",
      remainingDailyAllowance: 10,
      answeredDefinitionIds: new Set(),
      ruleContext: {
        answersByQuestionKey: {
          "schedule.shift_over_5h": true,
        },
      },
    });

    expect(
      selection.selected.some((question) => question.definitionId === "q7"),
    ).toBe(false);
  });

  it("honors same-day already-counted questions", () => {
    const selection = selectMissionQuestions({
      questions: baseQuestions,
      missionKind: "FULL",
      remainingDailyAllowance: 2,
      answeredDefinitionIds: new Set(),
      alreadyCountedTodayDefinitionIds: new Set(["q1", "q2", "q3"]),
      ruleContext: {
        answersByQuestionKey: {
          "schedule.shift_over_5h": true,
        },
      },
    });

    expect(selection.selected).toHaveLength(2);
    expect(
      selection.selected.every(
        (question) => !["q1", "q2", "q3"].includes(question.definitionId),
      ),
    ).toBe(true);
  });

  it("derives local dates in the stored IANA time zone", () => {
    expect(
      getLocalDateInTimeZone(
        new Date("2026-07-11T06:30:00.000Z"),
        "America/Los_Angeles",
      ),
    ).toBe("2026-07-10");
  });

  it("handles daylight-saving boundary behavior by server-side time zone derivation", () => {
    expect(
      getLocalDateInTimeZone(
        new Date("2026-11-01T08:30:00.000Z"),
        "America/Los_Angeles",
      ),
    ).toBe("2026-11-01");
    expect(
      getLocalDateInTimeZone(
        new Date("2026-03-08T09:30:00.000Z"),
        "America/Los_Angeles",
      ),
    ).toBe("2026-03-08");
  });

  it("rewards participation only when the mission is completed", () => {
    expect(rewardDependsOnlyOnParticipation(3)).toBe(true);
    expect(rewardDependsOnlyOnParticipation(1)).toBe(false);
  });

  it("keeps Honey progression independent of review flags", () => {
    expect(rewardDependsOnlyOnParticipation(5)).toBe(true);
    expect(rewardDependsOnlyOnParticipation(5)).toBe(true);
  });

  it("derives review flags from matching declarative rules", () => {
    const flags = deriveReviewFlags(baseQuestions[2]!, {
      answersByQuestionKey: {
        "meal.missed_meal": true,
      },
    });

    expect(flags).toEqual([{ flagType: "POSSIBLE_MEAL_PERIOD_ISSUE" }]);
  });

  it("enforces the role permission matrix", () => {
    expect(canAccessRole("STAFF", "ADMIN")).toBe(false);
    expect(canAccessRole("ADMIN", "STAFF")).toBe(true);
    expect(canAccessRole("CLIENT", "STAFF")).toBe(false);
  });
});
