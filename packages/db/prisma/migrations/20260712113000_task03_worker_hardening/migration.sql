ALTER TYPE "public"."NotificationAttemptStatus"
ADD VALUE IF NOT EXISTS 'PROVIDER_CALL_STARTED';

ALTER TABLE "public"."NotificationIntent"
DROP CONSTRAINT "NotificationIntent_processing_lease_chk",
DROP CONSTRAINT "NotificationIntent_terminal_no_open_lease_chk";

ALTER TABLE "public"."NotificationIntent"
ADD CONSTRAINT "NotificationIntent_attemptCount_within_maxAttempts_chk" CHECK (
  "attemptCount" <= "maxAttempts"
),
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
);

ALTER TABLE "public"."NotificationDeliveryAttempt"
ADD CONSTRAINT "NotificationDeliveryAttempt_attemptNumber_positive_chk" CHECK (
  "attemptNumber" > 0
);
