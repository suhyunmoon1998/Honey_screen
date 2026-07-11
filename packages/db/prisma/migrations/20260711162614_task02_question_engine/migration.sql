-- CreateEnum
CREATE TYPE "public"."MissionKind" AS ENUM ('QUICK', 'STANDARD', 'FULL');

-- CreateEnum
CREATE TYPE "public"."ClarificationState" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."ReviewFlagState" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "public"."AnswerRevision" ADD COLUMN "createdLocalDate" TEXT;

-- AlterTable
ALTER TABLE "public"."Mission"
ADD COLUMN "kind" "public"."MissionKind" NOT NULL DEFAULT 'QUICK',
ADD COLUMN "localDate" TEXT;

-- AlterTable
ALTER TABLE "public"."MissionSlot"
ADD COLUMN "countsTowardDailyCap" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isClarification" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "questionDefinitionId" TEXT;

-- AlterTable
ALTER TABLE "public"."QuestionDefinition"
ADD COLUMN "isAdministrative" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."QuestionVersion"
ADD COLUMN "activeFrom" TIMESTAMP(3),
ADD COLUMN "activeUntil" TIMESTAMP(3),
ADD COLUMN "answerSchemaJson" JSONB,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedByStaffId" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "createdByStaffId" TEXT,
ADD COLUMN "emotionalWeight" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "estimatedEffort" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "fictionalSeed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "retiredAt" TIMESTAMP(3);

-- Backfill question category from the stable definition.
UPDATE "public"."QuestionVersion" qv
SET "category" = qd."category"
FROM "public"."QuestionDefinition" qd
WHERE qv."definitionId" = qd."id"
  AND qv."category" IS NULL;

ALTER TABLE "public"."QuestionVersion"
ALTER COLUMN "category" SET NOT NULL;

-- Backfill mission-slot definition IDs from their frozen version snapshot.
UPDATE "public"."MissionSlot" ms
SET "questionDefinitionId" = qv."definitionId"
FROM "public"."QuestionVersion" qv
WHERE ms."questionVersionId" = qv."id"
  AND ms."questionDefinitionId" IS NULL;

ALTER TABLE "public"."MissionSlot"
ALTER COLUMN "questionDefinitionId" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."QuestionOption" (
    "id" TEXT NOT NULL,
    "questionVersionId" TEXT NOT NULL,
    "optionKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "labelEs" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BranchRule" (
    "id" TEXT NOT NULL,
    "questionVersionId" TEXT NOT NULL,
    "targetDefinitionKey" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "ruleJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewFlagRule" (
    "id" TEXT NOT NULL,
    "questionVersionId" TEXT NOT NULL,
    "flagType" TEXT NOT NULL,
    "ruleJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewFlagRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyQuestionLedger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "questionDefinitionId" TEXT NOT NULL,
    "questionVersionId" TEXT NOT NULL,
    "missionSlotId" TEXT NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyQuestionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewFlag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "missionSlotId" TEXT,
    "answerRevisionId" TEXT,
    "flagType" TEXT NOT NULL,
    "state" "public"."ReviewFlagState" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClarificationRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "questionDefinitionId" TEXT NOT NULL,
    "requestedByStaffId" TEXT,
    "reasonCode" TEXT NOT NULL,
    "state" "public"."ClarificationState" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ClarificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "responseJson" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionVersionId_optionKey_key" ON "public"."QuestionOption"("questionVersionId", "optionKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuestionLedger_clientId_localDate_questionDefinitionId_key" ON "public"."DailyQuestionLedger"("clientId", "localDate", "questionDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuestionLedger_missionSlotId_key" ON "public"."DailyQuestionLedger"("missionSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewFlag_clientId_answerRevisionId_flagType_key" ON "public"."ReviewFlag"("clientId", "answerRevisionId", "flagType");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_clientId_scope_key_key" ON "public"."IdempotencyRecord"("clientId", "scope", "key");

-- AddForeignKey
ALTER TABLE "public"."QuestionVersion" ADD CONSTRAINT "QuestionVersion_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "public"."StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestionVersion" ADD CONSTRAINT "QuestionVersion_approvedByStaffId_fkey" FOREIGN KEY ("approvedByStaffId") REFERENCES "public"."StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestionOption" ADD CONSTRAINT "QuestionOption_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "public"."QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BranchRule" ADD CONSTRAINT "BranchRule_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "public"."QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewFlagRule" ADD CONSTRAINT "ReviewFlagRule_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "public"."QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionSlot" ADD CONSTRAINT "MissionSlot_questionDefinitionId_fkey" FOREIGN KEY ("questionDefinitionId") REFERENCES "public"."QuestionDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyQuestionLedger" ADD CONSTRAINT "DailyQuestionLedger_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyQuestionLedger" ADD CONSTRAINT "DailyQuestionLedger_questionDefinitionId_fkey" FOREIGN KEY ("questionDefinitionId") REFERENCES "public"."QuestionDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyQuestionLedger" ADD CONSTRAINT "DailyQuestionLedger_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "public"."QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyQuestionLedger" ADD CONSTRAINT "DailyQuestionLedger_missionSlotId_fkey" FOREIGN KEY ("missionSlotId") REFERENCES "public"."MissionSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnswerRevision" ADD CONSTRAINT "AnswerRevision_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "public"."QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewFlag" ADD CONSTRAINT "ReviewFlag_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClarificationRequest" ADD CONSTRAINT "ClarificationRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClarificationRequest" ADD CONSTRAINT "ClarificationRequest_questionDefinitionId_fkey" FOREIGN KEY ("questionDefinitionId") REFERENCES "public"."QuestionDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClarificationRequest" ADD CONSTRAINT "ClarificationRequest_requestedByStaffId_fkey" FOREIGN KEY ("requestedByStaffId") REFERENCES "public"."StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
