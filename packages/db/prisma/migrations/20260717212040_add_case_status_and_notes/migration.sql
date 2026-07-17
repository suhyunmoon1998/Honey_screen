-- CreateEnum
CREATE TYPE "public"."CaseStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'QUALIFIED', 'NOT_QUALIFIED', 'CALLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."CaseNoteType" AS ENUM ('EVALUATION', 'CALL_LOG', 'GENERAL');

-- DropIndex
DROP INDEX "public"."MissionSlot_missionId_questionDefinitionId_key";

-- DropIndex
DROP INDEX "public"."NotificationIntent_claim_ready_idx";

-- AlterTable
ALTER TABLE "public"."Client" ADD COLUMN     "caseStatus" "public"."CaseStatus" NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "public"."NotificationIntent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."NotificationPreference" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."OutboxEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."ReminderOccurrence" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."CaseNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "noteType" "public"."CaseNoteType" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseNote_organizationId_clientId_createdAt_idx" ON "public"."CaseNote"("organizationId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationIntent_status_retryAt_availableAt_leaseExpiresA_idx" ON "public"."NotificationIntent"("status", "retryAt", "availableAt", "leaseExpiresAt", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."CaseNote" ADD CONSTRAINT "CaseNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."NotificationDeliveryAttempt_notificationIntentId_attemptNumber_" RENAME TO "NotificationDeliveryAttempt_notificationIntentId_attemptNum_key";
