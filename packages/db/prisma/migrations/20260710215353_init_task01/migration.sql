-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('CLIENT', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."ActorType" AS ENUM ('CLIENT', 'STAFF');

-- CreateEnum
CREATE TYPE "public"."MissionState" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."MissionSlotState" AS ENUM ('ALLOCATED', 'ANSWERED');

-- CreateEnum
CREATE TYPE "public"."LegalReviewStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "public"."OutboxStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultTimeZone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StaffUser" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "allowlisted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "retentionClass" TEXT NOT NULL DEFAULT 'ABANDONED_INTAKE',
    "eligibleForDeletionAt" TIMESTAMP(3),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "deletionRequestedAt" TIMESTAMP(3),
    "deletionApprovedAt" TIMESTAMP(3),
    "restrictedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionClass" TEXT NOT NULL DEFAULT 'INVITATION',
    "eligibleForDeletionAt" TIMESTAMP(3),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "deletionRequestedAt" TIMESTAMP(3),
    "deletionApprovedAt" TIMESTAMP(3),
    "restrictedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationChallenge" (
    "id" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resendAvailableAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "actorType" "public"."ActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "locale" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConsentRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuestionDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuestionVersion" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "promptEs" TEXT NOT NULL,
    "promptEn" TEXT NOT NULL,
    "answerType" TEXT NOT NULL,
    "legalReviewStatus" "public"."LegalReviewStatus" NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Mission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestedSize" INTEGER NOT NULL,
    "state" "public"."MissionState" NOT NULL DEFAULT 'ACTIVE',
    "locale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MissionSlot" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "questionVersionId" TEXT NOT NULL,
    "state" "public"."MissionSlotState" NOT NULL DEFAULT 'ALLOCATED',
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "MissionSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnswerRevision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "missionSlotId" TEXT NOT NULL,
    "questionVersionId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "valueJson" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnswerCurrent" (
    "missionSlotId" TEXT NOT NULL,
    "latestRevisionId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerCurrent_pkey" PRIMARY KEY ("missionSlotId")
);

-- CreateTable
CREATE TABLE "public"."ProgressEvent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RewardDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rewardKey" TEXT NOT NULL,
    "nameEs" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "RewardDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RewardGrant" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "rewardDefinitionId" TEXT NOT NULL,
    "sourceProgressEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OutboxEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" "public"."OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InAppNotification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorType" "public"."ActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadataJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "public"."StaffUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_phoneE164_key" ON "public"."Client"("phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "public"."Invitation"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "public"."Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionDefinition_stableKey_key" ON "public"."QuestionDefinition"("stableKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionVersion_definitionId_versionNumber_key" ON "public"."QuestionVersion"("definitionId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MissionSlot_missionId_position_key" ON "public"."MissionSlot"("missionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerRevision_missionSlotId_revisionNumber_key" ON "public"."AnswerRevision"("missionSlotId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerRevision_clientId_idempotencyKey_key" ON "public"."AnswerRevision"("clientId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerCurrent_latestRevisionId_key" ON "public"."AnswerCurrent"("latestRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressEvent_idempotencyKey_key" ON "public"."ProgressEvent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RewardDefinition_rewardKey_key" ON "public"."RewardDefinition"("rewardKey");

-- CreateIndex
CREATE UNIQUE INDEX "RewardGrant_clientId_rewardDefinitionId_key" ON "public"."RewardGrant"("clientId", "rewardDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_idempotencyKey_key" ON "public"."OutboxEvent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "InAppNotification_sourceEventId_key" ON "public"."InAppNotification"("sourceEventId");

-- AddForeignKey
ALTER TABLE "public"."StaffUser" ADD CONSTRAINT "StaffUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsentRecord" ADD CONSTRAINT "ConsentRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestionDefinition" ADD CONSTRAINT "QuestionDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestionVersion" ADD CONSTRAINT "QuestionVersion_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "public"."QuestionDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mission" ADD CONSTRAINT "Mission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mission" ADD CONSTRAINT "Mission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionSlot" ADD CONSTRAINT "MissionSlot_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionSlot" ADD CONSTRAINT "MissionSlot_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "public"."QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnswerRevision" ADD CONSTRAINT "AnswerRevision_missionSlotId_fkey" FOREIGN KEY ("missionSlotId") REFERENCES "public"."MissionSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnswerRevision" ADD CONSTRAINT "AnswerRevision_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnswerCurrent" ADD CONSTRAINT "AnswerCurrent_missionSlotId_fkey" FOREIGN KEY ("missionSlotId") REFERENCES "public"."MissionSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProgressEvent" ADD CONSTRAINT "ProgressEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RewardDefinition" ADD CONSTRAINT "RewardDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RewardGrant" ADD CONSTRAINT "RewardGrant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RewardGrant" ADD CONSTRAINT "RewardGrant_rewardDefinitionId_fkey" FOREIGN KEY ("rewardDefinitionId") REFERENCES "public"."RewardDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OutboxEvent" ADD CONSTRAINT "OutboxEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InAppNotification" ADD CONSTRAINT "InAppNotification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InAppNotification" ADD CONSTRAINT "InAppNotification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "public"."StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
