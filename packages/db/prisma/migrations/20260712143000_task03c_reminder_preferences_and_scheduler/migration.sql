-- CreateEnum
ALTER TYPE "public"."NotificationChannel" ADD VALUE IF NOT EXISTS 'EMAIL';
ALTER TYPE "public"."NotificationChannel" ADD VALUE IF NOT EXISTS 'SMS';

-- CreateEnum
CREATE TYPE "public"."NotificationPurpose" AS ENUM ('MISSION_REMINDER');

-- CreateEnum
CREATE TYPE "public"."ReminderOccurrenceStatus" AS ENUM (
  'PLANNED',
  'INTENT_CREATED',
  'SUPPRESSED',
  'EXPIRED',
  'CANCELLED'
);

-- CreateEnum
CREATE TYPE "public"."ReminderSuppressionReason" AS ENUM (
  'preference_disabled',
  'no_active_subscription',
  'mission_completed',
  'daily_cap_exhausted',
  'no_eligible_questions',
  'quiet_hours',
  'account_restricted',
  'occurrence_expired',
  'time_zone_changed',
  'duplicate_occurrence'
);

-- AlterTable
ALTER TABLE "public"."ConsentRecord"
ADD COLUMN "purpose" "public"."NotificationPurpose",
ADD COLUMN "channel" "public"."NotificationChannel",
ADD COLUMN "actorType" "public"."ActorType",
ADD COLUMN "actorId" TEXT,
ADD COLUMN "timeZone" TEXT,
ADD COLUMN "installationId" TEXT;

-- AlterTable
ALTER TABLE "public"."NotificationIntent"
ADD COLUMN "clientId" TEXT,
ALTER COLUMN "recipientId" DROP NOT NULL;

ALTER TABLE "public"."NotificationIntent"
DROP CONSTRAINT "NotificationIntent_processing_lease_chk",
DROP CONSTRAINT "NotificationIntent_terminal_no_open_lease_chk";

ALTER TABLE "public"."NotificationIntent"
ADD CONSTRAINT "NotificationIntent_processing_lease_chk" CHECK (
  "status" <> 'PROCESSING'
  OR (
    "leaseToken" IS NOT NULL
    AND "leaseExpiresAt" IS NOT NULL
    AND "leaseOwner" IS NOT NULL
  )
),
ADD CONSTRAINT "NotificationIntent_terminal_no_open_lease_chk" CHECK (
  "status" NOT IN ('DELIVERED', 'SIMULATED', 'SUPPRESSED', 'FAILED_PERMANENT', 'INVALID_SUBSCRIPTION', 'AMBIGUOUS')
  OR ("leaseOwner" IS NULL AND "leaseToken" IS NULL AND "leaseExpiresAt" IS NULL)
),
ADD CONSTRAINT "NotificationIntent_target_actor_chk" CHECK (
  (CASE WHEN "recipientId" IS NULL THEN 0 ELSE 1 END) +
  (CASE WHEN "clientId" IS NULL THEN 0 ELSE 1 END) = 1
);

-- CreateTable
CREATE TABLE "public"."NotificationPreference" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "pushSubscriptionId" TEXT,
  "purpose" "public"."NotificationPurpose" NOT NULL,
  "channel" "public"."NotificationChannel" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "preferredLocalTime" TEXT NOT NULL,
  "quietHoursStart" TEXT NOT NULL,
  "quietHoursEnd" TEXT NOT NULL,
  "consentVersion" TEXT,
  "enabledAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "timeZoneAtPreferenceChange" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReminderOccurrence" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "purpose" "public"."NotificationPurpose" NOT NULL,
  "localDate" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL,
  "preferredLocalTime" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "channel" "public"."NotificationChannel" NOT NULL,
  "status" "public"."ReminderOccurrenceStatus" NOT NULL DEFAULT 'PLANNED',
  "suppressionReason" "public"."ReminderSuppressionReason",
  "notificationIntentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReminderOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_clientId_purpose_channel_key"
ON "public"."NotificationPreference"("clientId", "purpose", "channel");

CREATE INDEX "NotificationPreference_organizationId_clientId_enabled_idx"
ON "public"."NotificationPreference"("organizationId", "clientId", "enabled");

CREATE UNIQUE INDEX "ReminderOccurrence_clientId_purpose_localDate_key"
ON "public"."ReminderOccurrence"("clientId", "purpose", "localDate");

CREATE UNIQUE INDEX "ReminderOccurrence_notificationIntentId_key"
ON "public"."ReminderOccurrence"("notificationIntentId");

CREATE INDEX "ReminderOccurrence_organizationId_clientId_scheduledFor_idx"
ON "public"."ReminderOccurrence"("organizationId", "clientId", "scheduledFor");

CREATE INDEX "ReminderOccurrence_status_scheduledFor_expiresAt_createdAt_idx"
ON "public"."ReminderOccurrence"("status", "scheduledFor", "expiresAt", "createdAt");

CREATE INDEX "NotificationIntent_organizationId_clientId_createdAt_idx"
ON "public"."NotificationIntent"("organizationId", "clientId", "createdAt");

-- AddConstraints
ALTER TABLE "public"."NotificationPreference"
ADD CONSTRAINT "NotificationPreference_quiet_hours_distinct_chk" CHECK (
  "quietHoursStart" <> "quietHoursEnd"
),
ADD CONSTRAINT "NotificationPreference_enabled_requires_consent_chk" CHECK (
  NOT "enabled"
  OR ("consentVersion" IS NOT NULL AND "enabledAt" IS NOT NULL)
);

ALTER TABLE "public"."ReminderOccurrence"
ADD CONSTRAINT "ReminderOccurrence_schedule_window_chk" CHECK (
  "expiresAt" >= "scheduledFor"
);

-- AddForeignKeys
ALTER TABLE "public"."NotificationIntent"
ADD CONSTRAINT "NotificationIntent_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."NotificationPreference"
ADD CONSTRAINT "NotificationPreference_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "NotificationPreference_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "NotificationPreference_pushSubscriptionId_fkey"
FOREIGN KEY ("pushSubscriptionId") REFERENCES "public"."PushSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."ReminderOccurrence"
ADD CONSTRAINT "ReminderOccurrence_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "ReminderOccurrence_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "ReminderOccurrence_notificationIntentId_fkey"
FOREIGN KEY ("notificationIntentId") REFERENCES "public"."NotificationIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
