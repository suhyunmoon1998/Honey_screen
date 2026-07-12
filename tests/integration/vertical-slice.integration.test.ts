import { prisma } from "@honey/db";
import { processPendingOutbox } from "../../apps/worker/src/index";
import { resetDatabase } from "../../packages/testing/src/db";
import {
  completeOnboarding,
  getMissionForClient,
  getOrCreateQuickMission,
  requestOtp,
  saveMissionAnswer,
  signInStaff,
  verifyOtpAndRegister,
} from "../../apps/web/src/lib/services";

describe("vertical slice services", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("accepts an invitation and registers a client idempotently", async () => {
    await requestOtp({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      locale: "es",
      acceptedPrivacy: true,
      acceptedMessages: true,
    });

    const registration = await verifyOtpAndRegister({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      code: "246810",
      locale: "es",
    });

    expect(registration.client.phoneE164).toBe("+15555550101");
    expect(await prisma.client.count()).toBe(1);

    await requestOtp({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      locale: "es",
      acceptedPrivacy: true,
      acceptedMessages: true,
    });

    await verifyOtpAndRegister({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      code: "246810",
      locale: "es",
    });

    expect(await prisma.client.count()).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateType: "CLIENT" },
      }),
    ).toBe(2);
  });

  it("creates a quick mission and resumes it after the first answer", async () => {
    await requestOtp({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      locale: "es",
      acceptedPrivacy: true,
      acceptedMessages: true,
    });

    const registration = await verifyOtpAndRegister({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      code: "246810",
      locale: "es",
    });

    const mission = await getOrCreateQuickMission({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
    });

    expect(mission.slots).toHaveLength(3);

    await saveMissionAnswer({
      missionId: mission.id,
      clientId: registration.client.id,
      missionSlotId: mission.slots[0]!.id,
      idempotencyKey: `${mission.slots[0]!.id}:true`,
      value: true,
    });

    const reloaded = await getMissionForClient(
      mission.id,
      registration.client.id,
    );
    expect(reloaded?.slots[0]?.state).toBe("ANSWERED");
    expect(reloaded?.slots[1]?.state).toBe("ALLOCATED");
  });

  it("completes the mission and creates Honey participation, rewards, and outbox events in the same workflow", async () => {
    await requestOtp({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      locale: "es",
      acceptedPrivacy: true,
      acceptedMessages: true,
    });

    const registration = await verifyOtpAndRegister({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      code: "246810",
      locale: "es",
    });

    const mission = await getOrCreateQuickMission({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
    });

    for (const slot of mission.slots) {
      await saveMissionAnswer({
        missionId: mission.id,
        clientId: registration.client.id,
        missionSlotId: slot.id,
        idempotencyKey: `${slot.id}:true`,
        value: true,
      });
    }

    const completed = await prisma.mission.findUnique({
      where: { id: mission.id },
    });
    const reward = await prisma.rewardGrant.findFirst({
      where: { clientId: registration.client.id },
    });
    const profile = await prisma.honeyProfile.findUnique({
      where: { clientId: registration.client.id },
    });
    const participation = await prisma.participationEvent.findMany({
      where: { clientId: registration.client.id },
      orderBy: { createdAt: "asc" },
    });
    const notifications = await prisma.outboxEvent.findMany({
      where: { aggregateType: "MISSION", aggregateId: mission.id },
    });

    expect(completed?.state).toBe("COMPLETED");
    expect(reward).not.toBeNull();
    expect(profile?.totalPoints).toBeGreaterThanOrEqual(1);
    expect(
      participation.some((event) => event.eventType === "MISSION_COMPLETED"),
    ).toBe(true);
    expect(notifications.length).toBe(2);
  });

  it("records onboarding completion once and rebuilds the Honey profile from immutable events", async () => {
    await requestOtp({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      locale: "es",
      acceptedPrivacy: true,
      acceptedMessages: true,
    });

    const registration = await verifyOtpAndRegister({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      code: "246810",
      locale: "es",
    });

    await completeOnboarding({
      clientId: registration.client.id,
      timeZone: "America/Los_Angeles",
      locale: "es",
    });

    await completeOnboarding({
      clientId: registration.client.id,
      timeZone: "America/Los_Angeles",
      locale: "es",
    });

    expect(
      await prisma.participationEvent.count({
        where: {
          clientId: registration.client.id,
          eventType: "ONBOARDING_COMPLETED",
        },
      }),
    ).toBe(1);

    const profile = await prisma.honeyProfile.findUnique({
      where: { clientId: registration.client.id },
    });

    expect(profile?.totalPoints).toBe(1);
    expect(profile?.levelKey).toBe("clue_finder");
    expect(profile?.unlockedRewardKeys).toEqual(["magnifying_glass"]);
  });

  it("replaying the final answer stays idempotent and does not duplicate completion artifacts", async () => {
    await requestOtp({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      locale: "es",
      acceptedPrivacy: true,
      acceptedMessages: true,
    });

    const registration = await verifyOtpAndRegister({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      code: "246810",
      locale: "es",
    });

    const mission = await getOrCreateQuickMission({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
    });

    for (const slot of mission.slots.slice(0, -1)) {
      await saveMissionAnswer({
        missionId: mission.id,
        clientId: registration.client.id,
        missionSlotId: slot.id,
        idempotencyKey: `${slot.id}:true`,
        value: true,
      });
    }

    const finalSlot = mission.slots.at(-1);

    expect(finalSlot).toBeDefined();

    await saveMissionAnswer({
      missionId: mission.id,
      clientId: registration.client.id,
      missionSlotId: finalSlot!.id,
      idempotencyKey: `${finalSlot!.id}:true`,
      value: true,
    });

    await saveMissionAnswer({
      missionId: mission.id,
      clientId: registration.client.id,
      missionSlotId: finalSlot!.id,
      idempotencyKey: `${finalSlot!.id}:true`,
      value: true,
    });

    expect(
      await prisma.answerRevision.count({
        where: { missionSlotId: finalSlot!.id },
      }),
    ).toBe(1);
    expect(
      await prisma.participationEvent.count({
        where: { sourceType: "MISSION", sourceId: mission.id },
      }),
    ).toBe(1);
    expect(
      await prisma.rewardGrant.count({
        where: { clientId: registration.client.id },
      }),
    ).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateType: "MISSION", aggregateId: mission.id },
      }),
    ).toBe(2);
  });

  it("processes outbox notifications idempotently", async () => {
    await requestOtp({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      locale: "es",
      acceptedPrivacy: true,
      acceptedMessages: true,
    });

    await verifyOtpAndRegister({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      code: "246810",
      locale: "es",
    });

    await processPendingOutbox();
    await processPendingOutbox();

    expect(await prisma.inAppNotification.count()).toBe(2);
  });

  it("denies cross-client mission access", async () => {
    await requestOtp({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      locale: "es",
      acceptedPrivacy: true,
      acceptedMessages: true,
    });

    const registration = await verifyOtpAndRegister({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      code: "246810",
      locale: "es",
    });

    const mission = await getOrCreateQuickMission({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      locale: "es",
    });

    const otherClient = await prisma.client.create({
      data: {
        organizationId: registration.client.organizationId,
        phoneE164: "+15555550109",
        locale: "es",
        timeZone: "America/Los_Angeles",
      },
    });

    expect(await getMissionForClient(mission.id, otherClient.id)).toBeNull();
  });

  it("lets staff sign in but not gain admin permissions", async () => {
    const staff = await signInStaff({
      email: "staff.fictional@jacklaw.example",
      password: "FictionalPass123!",
    });

    expect(staff.role).toBe("STAFF");
  });
});
