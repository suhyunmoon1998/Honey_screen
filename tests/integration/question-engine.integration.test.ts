import { prisma } from "@honey/db";
import { InMemoryOperationalEventSink } from "@honey/observability";
import {
  resetOperationalEventSink,
  setOperationalEventSink,
} from "../../apps/web/src/lib/operational-events";
import { resetDatabase } from "../../packages/testing/src/db";
import {
  approveDraftQuestionVersion,
  createDraftQuestionVersion,
  getMissionForClient,
  getOrCreateMission,
  requestOtp,
  retireQuestionVersion,
  saveMissionAnswer,
  verifyOtpAndRegister,
} from "../../apps/web/src/lib/services";

async function registerDemoClient() {
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

describe("question engine integration", () => {
  let sink: InMemoryOperationalEventSink;

  beforeEach(async () => {
    await resetDatabase();
    sink = new InMemoryOperationalEventSink();
    setOperationalEventSink(sink);
  });

  afterEach(() => {
    resetOperationalEventSink();
  });

  it("concurrent mission creation never exceeds 10 daily slots", async () => {
    const registration = await registerDemoClient();
    const now = new Date("2026-07-11T18:00:00.000Z");

    const [missionA, missionB] = await Promise.all([
      getOrCreateMission({
        clientId: registration.client.id,
        organizationId: registration.client.organizationId,
        locale: "es",
        missionKind: "FULL",
        idempotencyKey: "full-a",
        now,
      }),
      getOrCreateMission({
        clientId: registration.client.id,
        organizationId: registration.client.organizationId,
        locale: "es",
        missionKind: "FULL",
        idempotencyKey: "full-b",
        now,
      }),
    ]);

    const ledgerEntries = await prisma.dailyQuestionLedger.findMany({
      where: {
        clientId: registration.client.id,
        localDate: "2026-07-11",
      },
    });

    expect(missionA.id).toBe(missionB.id);
    expect(
      new Set(ledgerEntries.map((entry) => entry.questionDefinitionId)).size,
    ).toBeLessThanOrEqual(10);
    expect(ledgerEntries).toHaveLength(missionA.requestedSize);
  });

  it("idempotent mission creation returns the original mission and conflicts on mismatched reuse", async () => {
    const registration = await registerDemoClient();
    const now = new Date("2026-07-11T18:00:00.000Z");

    const first = await getOrCreateMission({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
      missionKind: "STANDARD",
      idempotencyKey: "mission-key",
      now,
    });

    const second = await getOrCreateMission({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
      missionKind: "STANDARD",
      idempotencyKey: "mission-key",
      now,
    });

    await expect(
      getOrCreateMission({
        clientId: registration.client.id,
        organizationId: registration.client.organizationId,
        locale: "es",
        missionKind: "QUICK",
        idempotencyKey: "mission-key",
        now,
      }),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");

    expect(first.id).toBe(second.id);
  });

  it("same-day second mission stops at the remaining daily allowance and next day resets capacity", async () => {
    const registration = await registerDemoClient();
    const sameDay = new Date("2026-07-11T18:00:00.000Z");

    const fullMission = await getOrCreateMission({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
      missionKind: "FULL",
      idempotencyKey: "day-one-full",
      now: sameDay,
    });

    for (const slot of fullMission.slots) {
      await saveMissionAnswer({
        missionId: fullMission.id,
        clientId: registration.client.id,
        missionSlotId: slot.id,
        idempotencyKey: `${slot.id}:true`,
        value: true,
      });
    }

    const usedToday = await prisma.dailyQuestionLedger.count({
      where: {
        clientId: registration.client.id,
        localDate: "2026-07-11",
      },
    });
    const remainingToday = Math.max(0, 10 - usedToday);

    if (remainingToday === 0) {
      await expect(
        getOrCreateMission({
          clientId: registration.client.id,
          organizationId: registration.client.organizationId,
          locale: "es",
          missionKind: "QUICK",
          idempotencyKey: "same-day-second",
          now: sameDay,
        }),
      ).rejects.toThrow("DAILY_CAP_REACHED");
    } else {
      const sameDaySecond = await getOrCreateMission({
        clientId: registration.client.id,
        organizationId: registration.client.organizationId,
        locale: "es",
        missionKind: "QUICK",
        idempotencyKey: "same-day-second",
        now: sameDay,
      });

      expect(sameDaySecond.requestedSize).toBe(Math.min(3, remainingToday));
    }

    const nextDayMission = await getOrCreateMission({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
      missionKind: "QUICK",
      idempotencyKey: "next-day",
      now: new Date("2026-07-12T18:00:00.000Z"),
    });

    expect(nextDayMission.requestedSize).toBe(3);
  });

  it("snapshot stability survives new question approval and retirement", async () => {
    const registration = await registerDemoClient();
    const mission = await getOrCreateMission({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
      missionKind: "QUICK",
      idempotencyKey: "snapshot-stable",
      now: new Date("2026-07-11T18:00:00.000Z"),
    });

    const admin = await prisma.staffUser.findUniqueOrThrow({
      where: { email: "admin.fictional@jacklaw.example" },
    });
    const definition = await prisma.questionDefinition.findFirstOrThrow({
      where: { stableKey: "schedule.shift_over_5h" },
    });
    const currentVersion = await prisma.questionVersion.findFirstOrThrow({
      where: {
        definitionId: definition.id,
        versionNumber: 1,
      },
    });

    await prisma.questionVersion.create({
      data: {
        definitionId: definition.id,
        versionNumber: 2,
        promptEs: "Contenido ficticio para pruebas. Hubo turnos muy largos?",
        promptEn:
          "This is fictional test content. Were there very long shifts?",
        answerType: "BOOLEAN",
        category: definition.category,
        priority: 2,
        emotionalWeight: 1,
        estimatedEffort: 1,
        legalReviewStatus: "APPROVED",
        displayOrder: currentVersion.displayOrder,
        fictionalSeed: true,
        createdByStaffId: admin.id,
        approvedByStaffId: admin.id,
        approvedAt: new Date("2026-07-11T19:00:00.000Z"),
      },
    });

    await prisma.questionVersion.update({
      where: { id: currentVersion.id },
      data: {
        legalReviewStatus: "RETIRED",
        retiredAt: new Date("2026-07-11T19:05:00.000Z"),
      },
    });

    const reloaded = await getMissionForClient(
      mission.id,
      registration.client.id,
    );

    expect(reloaded?.slots.map((slot) => slot.questionVersionId)).toEqual(
      mission.slots.map((slot) => slot.questionVersionId),
    );
  });

  it("answer creates branch eligibility for a future mission without mutating the current mission", async () => {
    const registration = await registerDemoClient();

    const mission = await getOrCreateMission({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
      missionKind: "FULL",
      idempotencyKey: "branch-day-one",
      now: new Date("2026-07-11T18:00:00.000Z"),
    });

    const foundationalSlot = mission.slots.find(
      (slot) =>
        slot.questionVersion.definition.stableKey === "leave.medical_condition",
    );

    expect(foundationalSlot).toBeDefined();

    await saveMissionAnswer({
      missionId: mission.id,
      clientId: registration.client.id,
      missionSlotId: foundationalSlot!.id,
      idempotencyKey: `${foundationalSlot!.id}:true`,
      value: true,
    });

    const afterAnswer = await getMissionForClient(
      mission.id,
      registration.client.id,
    );

    expect(afterAnswer?.slots.map((slot) => slot.questionVersionId)).toEqual(
      mission.slots.map((slot) => slot.questionVersionId),
    );

    for (const slot of mission.slots.filter(
      (slot) => slot.id !== foundationalSlot!.id,
    )) {
      await saveMissionAnswer({
        missionId: mission.id,
        clientId: registration.client.id,
        missionSlotId: slot.id,
        idempotencyKey: `${slot.id}:true`,
        value: true,
      });
    }

    const futureMission = await getOrCreateMission({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
      missionKind: "STANDARD",
      idempotencyKey: "branch-next-day",
      now: new Date("2026-07-12T18:00:00.000Z"),
    });

    expect(
      futureMission.slots.some(
        (slot) =>
          slot.questionVersion.definition.stableKey ===
          "leave.time_off_requested",
      ),
    ).toBe(true);
  });

  it("staff cannot approve question content but admin can and the approval is audited", async () => {
    const staff = await prisma.staffUser.findUniqueOrThrow({
      where: { email: "staff.fictional@jacklaw.example" },
    });
    const admin = await prisma.staffUser.findUniqueOrThrow({
      where: { email: "admin.fictional@jacklaw.example" },
    });
    const definition = await prisma.questionDefinition.findFirstOrThrow({
      where: { stableKey: "schedule.shift_over_5h" },
      include: {
        versions: {
          where: { legalReviewStatus: "APPROVED" },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    const approvedVersion = definition.versions[0];

    const draft = await createDraftQuestionVersion({
      actorId: admin.id,
      definitionId: definition.id,
      promptEs: "Contenido ficticio actualizado para pruebas de aprobacion.",
      promptEn: "Updated fictional content for approval testing.",
    });

    await expect(
      approveDraftQuestionVersion({
        actorId: staff.id,
        versionId: draft.id,
      }),
    ).rejects.toThrow("FORBIDDEN");

    const approved = await approveDraftQuestionVersion({
      actorId: admin.id,
      versionId: draft.id,
    });

    const retiredPrevious = await prisma.questionVersion.findUniqueOrThrow({
      where: { id: approvedVersion.id },
    });
    const approvalAudit = await prisma.auditEvent.findFirst({
      where: {
        action: "QUESTION_VERSION_APPROVED",
        targetId: approved.id,
      },
    });

    expect(approved.legalReviewStatus).toBe("APPROVED");
    expect(approved.approvedByStaffId).toBe(admin.id);
    expect(retiredPrevious.legalReviewStatus).toBe("RETIRED");
    expect(retiredPrevious.retiredAt).not.toBeNull();
    expect(approvalAudit?.actorId).toBe(admin.id);
  });

  it("admin can retire a version and the retirement is audited", async () => {
    const admin = await prisma.staffUser.findUniqueOrThrow({
      where: { email: "admin.fictional@jacklaw.example" },
    });
    const version = await prisma.questionVersion.findFirstOrThrow({
      where: {
        legalReviewStatus: "APPROVED",
        definition: {
          stableKey: "termination.employment_ended",
        },
      },
    });

    const retired = await retireQuestionVersion({
      actorId: admin.id,
      versionId: version.id,
    });

    const retirementAudit = await prisma.auditEvent.findFirst({
      where: {
        action: "QUESTION_VERSION_RETIRED",
        targetId: retired.id,
      },
    });

    expect(retired.legalReviewStatus).toBe("RETIRED");
    expect(retired.retiredAt).not.toBeNull();
    expect(retirementAudit?.actorId).toBe(admin.id);
  });

  it("emits operational events for mission creation, daily-cap rejection, and mission completion without content fields", async () => {
    const registration = await registerDemoClient();
    const sameDay = new Date("2026-07-11T18:00:00.000Z");

    const mission = await getOrCreateMission({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
      missionKind: "FULL",
      idempotencyKey: "telemetry-day-one",
      now: sameDay,
    });

    for (const slot of mission.slots) {
      await saveMissionAnswer({
        missionId: mission.id,
        clientId: registration.client.id,
        missionSlotId: slot.id,
        idempotencyKey: `${slot.id}:complete`,
        value: true,
      });
    }

    await expect(
      getOrCreateMission({
        clientId: registration.client.id,
        organizationId: registration.client.organizationId,
        locale: "es",
        missionKind: "QUICK",
        idempotencyKey: "telemetry-cap-hit",
        now: sameDay,
      }),
    ).rejects.toThrow("DAILY_CAP_REACHED");

    expect(
      sink.events.some(
        (event) =>
          event.eventName === "mission_creation_attempted" &&
          event.reasonCode === "MISSION_CREATE",
      ),
    ).toBe(true);
    expect(
      sink.events.some(
        (event) =>
          event.eventName === "mission_creation_succeeded" &&
          event.reasonCode === "MISSION_CREATED",
      ),
    ).toBe(true);
    expect(
      sink.events.some(
        (event) =>
          event.eventName === "daily_cap_reached" &&
          event.reasonCode === "DAILY_CAP_REACHED",
      ),
    ).toBe(true);
    expect(
      sink.events.some(
        (event) =>
          event.eventName === "mission_completed" &&
          event.reasonCode === "MISSION_COMPLETED",
      ),
    ).toBe(true);

    for (const event of sink.events) {
      expect(JSON.stringify(event)).not.toMatch(/\+15555550101/);
      expect(JSON.stringify(event)).not.toMatch(/fictional test content/i);
      expect(JSON.stringify(event)).not.toMatch(/Mision completada/i);
    }
  });

  it("rejects invalid draft approval and emits a rule-failure operational event", async () => {
    const admin = await prisma.staffUser.findUniqueOrThrow({
      where: { email: "admin.fictional@jacklaw.example" },
    });
    const definition = await prisma.questionDefinition.findFirstOrThrow({
      where: { stableKey: "schedule.shift_over_5h" },
    });

    const draft = await createDraftQuestionVersion({
      actorId: admin.id,
      definitionId: definition.id,
      promptEs: "Contenido ficticio con regla invalida.",
      promptEn: "Fictional content with an invalid rule.",
    });

    await prisma.branchRule.create({
      data: {
        questionVersionId: draft.id,
        targetDefinitionKey: "missing.definition.key",
        priority: 100,
        ruleJson: {
          answerEquals: {
            questionKey: "missing.definition.key",
            value: true,
          },
        } as never,
      },
    });

    await expect(
      approveDraftQuestionVersion({
        actorId: admin.id,
        versionId: draft.id,
      }),
    ).rejects.toThrow(/RULE_TARGET_MISSING|RULE_INVALID/);

    expect(
      sink.events.some(
        (event) =>
          event.eventName === "rule_evaluation_failed" &&
          (event.reasonCode === "RULE_TARGET_MISSING" ||
            event.reasonCode === "RULE_INVALID") &&
          event.resourceId === draft.id,
      ),
    ).toBe(true);
  });
});
