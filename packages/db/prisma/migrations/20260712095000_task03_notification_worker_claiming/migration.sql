-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('IN_APP', 'WEB_PUSH');

-- CreateEnum
CREATE TYPE "public"."NotificationIntentStatus" AS ENUM (
  'QUEUED',
  'PROCESSING',
  'DELIVERED',
  'SIMULATED',
  'SUPPRESSED',
  'FAILED_RETRYABLE',
  'FAILED_PERMANENT',
  'INVALID_SUBSCRIPTION',
  'AMBIGUOUS'
);

-- CreateEnum
CREATE TYPE "public"."NotificationAttemptStatus" AS ENUM (
  'CLAIMED',
  'DISPATCH_STARTED',
  'DELIVERED',
  'SIMULATED',
  'SUPPRESSED',
  'RETRYABLE_FAILURE',
  'PERMANENT_FAILURE',
  'INVALID_SUBSCRIPTION',
  'AMBIGUOUS'
);

-- CreateEnum
CREATE TYPE "public"."ProviderIdempotencyMode" AS ENUM ('GUARANTEED', 'BEST_EFFORT', 'NONE');

-- AlterTable
ALTER TABLE "public"."OutboxEvent"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "public"."NotificationIntent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "outboxEventId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "pushSubscriptionId" TEXT,
    "channel" "public"."NotificationChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "public"."NotificationIntentStatus" NOT NULL DEFAULT 'QUEUED',
    "deliveryKey" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retryAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "leaseOwner" TEXT,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastSafeErrorCode" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "notificationIntentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "leaseToken" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerIdempotencyMode" "public"."ProviderIdempotencyMode" NOT NULL,
    "status" "public"."NotificationAttemptStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "dispatchStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "safeResultCode" TEXT,
    "retryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationProviderReceipt" (
    "id" TEXT NOT NULL,
    "deliveryKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerIdempotencyMode" "public"."ProviderIdempotencyMode" NOT NULL,
    "status" "public"."NotificationAttemptStatus" NOT NULL,
    "safeResultCode" TEXT NOT NULL,
    "providerReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationProviderReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationIntent_outboxEventId_key" ON "public"."NotificationIntent"("outboxEventId");
CREATE UNIQUE INDEX "NotificationIntent_deliveryKey_key" ON "public"."NotificationIntent"("deliveryKey");
CREATE INDEX "NotificationIntent_claim_ready_idx" ON "public"."NotificationIntent"("status", "retryAt", "availableAt", "leaseExpiresAt", "createdAt", "id");
CREATE INDEX "NotificationIntent_organizationId_recipientId_createdAt_idx" ON "public"."NotificationIntent"("organizationId", "recipientId", "createdAt");
CREATE UNIQUE INDEX "NotificationDeliveryAttempt_notificationIntentId_attemptNumber_key" ON "public"."NotificationDeliveryAttempt"("notificationIntentId", "attemptNumber");
CREATE INDEX "NotificationDeliveryAttempt_notificationIntentId_createdAt_idx" ON "public"."NotificationDeliveryAttempt"("notificationIntentId", "createdAt");
CREATE UNIQUE INDEX "NotificationProviderReceipt_deliveryKey_key" ON "public"."NotificationProviderReceipt"("deliveryKey");

-- AddConstraints
ALTER TABLE "public"."NotificationIntent"
  ADD CONSTRAINT "NotificationIntent_attemptCount_nonnegative_chk" CHECK ("attemptCount" >= 0),
  ADD CONSTRAINT "NotificationIntent_maxAttempts_positive_chk" CHECK ("maxAttempts" > 0),
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
    OR ("leaseToken" IS NULL AND "leaseExpiresAt" IS NULL)
  );

-- AddForeignKey
ALTER TABLE "public"."NotificationIntent" ADD CONSTRAINT "NotificationIntent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."NotificationIntent" ADD CONSTRAINT "NotificationIntent_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "public"."OutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."NotificationIntent" ADD CONSTRAINT "NotificationIntent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "public"."StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."NotificationIntent" ADD CONSTRAINT "NotificationIntent_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "public"."PushSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."NotificationDeliveryAttempt" ADD CONSTRAINT "NotificationDeliveryAttempt_notificationIntentId_fkey" FOREIGN KEY ("notificationIntentId") REFERENCES "public"."NotificationIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
