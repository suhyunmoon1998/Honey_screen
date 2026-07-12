-- CreateEnum
CREATE TYPE "public"."HoneyState" AS ENUM ('NEUTRAL', 'INVESTIGATING', 'RESTING', 'MISSION_COMPLETE');

-- CreateTable
CREATE TABLE "public"."ParticipationEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HoneyProfile" (
    "clientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "levelNumber" INTEGER NOT NULL DEFAULT 1,
    "levelKey" TEXT NOT NULL DEFAULT 'new_friend',
    "currentState" "public"."HoneyState" NOT NULL DEFAULT 'NEUTRAL',
    "unlockedRewardKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "projectionVersion" INTEGER NOT NULL DEFAULT 1,
    "lastProjectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "driftDetectedAt" TIMESTAMP(3),

    CONSTRAINT "HoneyProfile_pkey" PRIMARY KEY ("clientId")
);

-- AlterTable
ALTER TABLE "public"."RewardGrant"
ADD COLUMN "sourceParticipationEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ParticipationEvent_idempotencyKey_key" ON "public"."ParticipationEvent"("idempotencyKey");
CREATE INDEX "ParticipationEvent_clientId_createdAt_idx" ON "public"."ParticipationEvent"("clientId", "createdAt");
CREATE INDEX "ParticipationEvent_organizationId_clientId_createdAt_idx" ON "public"."ParticipationEvent"("organizationId", "clientId", "createdAt");
CREATE UNIQUE INDEX "HoneyProfile_organizationId_clientId_key" ON "public"."HoneyProfile"("organizationId", "clientId");

-- AddForeignKey
ALTER TABLE "public"."ParticipationEvent" ADD CONSTRAINT "ParticipationEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ParticipationEvent" ADD CONSTRAINT "ParticipationEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."HoneyProfile" ADD CONSTRAINT "HoneyProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."HoneyProfile" ADD CONSTRAINT "HoneyProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RewardGrant" ADD CONSTRAINT "RewardGrant_sourceParticipationEventId_fkey" FOREIGN KEY ("sourceParticipationEventId") REFERENCES "public"."ParticipationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill immutable participation events from Task 02 progression records.
INSERT INTO "public"."ParticipationEvent" (
    "id",
    "organizationId",
    "clientId",
    "eventType",
    "points",
    "sourceType",
    "sourceId",
    "idempotencyKey",
    "createdAt"
)
SELECT
    p."id",
    c."organizationId",
    p."clientId",
    p."eventType",
    p."points",
    p."sourceType",
    p."sourceId",
    p."idempotencyKey",
    p."createdAt"
FROM "public"."ProgressEvent" p
JOIN "public"."Client" c
  ON c."id" = p."clientId"
ON CONFLICT ("idempotencyKey") DO NOTHING;

-- Link existing reward grants to their participation source when one exists.
UPDATE "public"."RewardGrant" rg
SET "sourceParticipationEventId" = pe2."id"
FROM "public"."ProgressEvent" pe
JOIN "public"."ParticipationEvent" pe2
  ON pe2."idempotencyKey" = pe."idempotencyKey"
WHERE rg."sourceProgressEventId" = pe."id";

-- Build the rebuildable honey projection from immutable participation events.
WITH point_totals AS (
  SELECT
    pe."clientId",
    pe."organizationId",
    COALESCE(SUM(GREATEST(pe."points", 0)), 0) AS total_points,
    MAX(pe."createdAt") AS last_projected_at
  FROM "public"."ParticipationEvent" pe
  GROUP BY pe."clientId", pe."organizationId"
)
INSERT INTO "public"."HoneyProfile" (
  "clientId",
  "organizationId",
  "totalPoints",
  "levelNumber",
  "levelKey",
  "currentState",
  "unlockedRewardKeys",
  "projectionVersion",
  "lastProjectedAt",
  "driftDetectedAt"
)
SELECT
  pt."clientId",
  pt."organizationId",
  pt.total_points,
  CASE
    WHEN pt.total_points >= 4 THEN 5
    WHEN pt.total_points >= 3 THEN 4
    WHEN pt.total_points >= 2 THEN 3
    WHEN pt.total_points >= 1 THEN 2
    ELSE 1
  END AS "levelNumber",
  CASE
    WHEN pt.total_points >= 4 THEN 'jacklaw_case_helper'
    WHEN pt.total_points >= 3 THEN 'workplace_investigator'
    WHEN pt.total_points >= 2 THEN 'time_detective'
    WHEN pt.total_points >= 1 THEN 'clue_finder'
    ELSE 'new_friend'
  END AS "levelKey",
  CASE
    WHEN pt.total_points > 0 THEN 'RESTING'::"public"."HoneyState"
    ELSE 'NEUTRAL'::"public"."HoneyState"
  END AS "currentState",
  ARRAY_REMOVE(ARRAY[
    CASE WHEN pt.total_points >= 1 THEN 'magnifying_glass' END,
    CASE WHEN pt.total_points >= 2 THEN 'time_clock_clue' END,
    CASE WHEN pt.total_points >= 3 THEN 'lunchbox_clue' END,
    CASE WHEN pt.total_points >= 4 THEN 'pay_envelope_clue' END,
    CASE WHEN pt.total_points >= 4 THEN 'investigator_vest' END
  ], NULL)::TEXT[] AS "unlockedRewardKeys",
  1 AS "projectionVersion",
  COALESCE(pt.last_projected_at, CURRENT_TIMESTAMP) AS "lastProjectedAt",
  NULL AS "driftDetectedAt"
FROM point_totals pt
ON CONFLICT ("clientId") DO UPDATE
SET
  "organizationId" = EXCLUDED."organizationId",
  "totalPoints" = EXCLUDED."totalPoints",
  "levelNumber" = EXCLUDED."levelNumber",
  "levelKey" = EXCLUDED."levelKey",
  "currentState" = EXCLUDED."currentState",
  "unlockedRewardKeys" = EXCLUDED."unlockedRewardKeys",
  "projectionVersion" = EXCLUDED."projectionVersion",
  "lastProjectedAt" = EXCLUDED."lastProjectedAt",
  "driftDetectedAt" = EXCLUDED."driftDetectedAt";
