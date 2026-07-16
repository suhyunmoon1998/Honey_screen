import { execFileSync } from "node:child_process";
import { prisma, seedDatabase } from "@honey/db";

let schemaEnsured = false;

async function ensureDatabaseSchema() {
  if (schemaEnsured) {
    return;
  }

  execFileSync(
    "pnpm",
    ["--filter", "@honey/db", "prisma", "migrate", "deploy"],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "ignore",
    },
  );

  schemaEnsured = true;
}

export async function resetDatabase() {
  await ensureDatabaseSchema();
  await prisma.notificationDeliveryAttempt.deleteMany();
  await prisma.reminderOccurrence.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.notificationIntent.deleteMany();
  await prisma.notificationProviderReceipt.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.deviceInstallation.deleteMany();
  await prisma.honeyProfile.deleteMany();
  await prisma.participationEvent.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.branchRule.deleteMany();
  await prisma.reviewFlagRule.deleteMany();
  await prisma.dailyQuestionLedger.deleteMany();
  await prisma.reviewFlag.deleteMany();
  await prisma.clarificationRequest.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.rewardGrant.deleteMany();
  await prisma.progressEvent.deleteMany();
  await prisma.answerCurrent.deleteMany();
  await prisma.answerRevision.deleteMany();
  await prisma.missionSlot.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationChallenge.deleteMany();
  await prisma.inAppNotification.deleteMany();
  await prisma.outboxEvent.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.client.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.questionVersion.deleteMany();
  await prisma.questionDefinition.deleteMany();
  await prisma.rewardDefinition.deleteMany();
  await prisma.staffUser.deleteMany();
  await prisma.organization.deleteMany();

  await seedDatabase();
}
