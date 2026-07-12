-- CreateEnum
CREATE TYPE "public"."PushSubscriptionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'INVALID');

-- CreateTable
CREATE TABLE "public"."DeviceInstallation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "anonymousDeviceIdHash" TEXT NOT NULL,
    "platformHint" TEXT,
    "standaloneLaunchAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PushSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "deviceInstallationId" TEXT NOT NULL,
    "endpointHash" TEXT NOT NULL,
    "endpointCiphertext" TEXT NOT NULL,
    "endpointNonce" TEXT NOT NULL,
    "p256dhCiphertext" TEXT NOT NULL,
    "p256dhNonce" TEXT NOT NULL,
    "authCiphertext" TEXT NOT NULL,
    "authNonce" TEXT NOT NULL,
    "encryptionKeyVersion" INTEGER NOT NULL,
    "status" "public"."PushSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInstallation_anonymousDeviceIdHash_key" ON "public"."DeviceInstallation"("anonymousDeviceIdHash");
CREATE INDEX "DeviceInstallation_organizationId_clientId_idx" ON "public"."DeviceInstallation"("organizationId", "clientId");
CREATE UNIQUE INDEX "PushSubscription_endpointHash_key" ON "public"."PushSubscription"("endpointHash");
CREATE INDEX "PushSubscription_organizationId_clientId_status_idx" ON "public"."PushSubscription"("organizationId", "clientId", "status");

-- AddForeignKey
ALTER TABLE "public"."DeviceInstallation" ADD CONSTRAINT "DeviceInstallation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."DeviceInstallation" ADD CONSTRAINT "DeviceInstallation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."PushSubscription" ADD CONSTRAINT "PushSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."PushSubscription" ADD CONSTRAINT "PushSubscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."PushSubscription" ADD CONSTRAINT "PushSubscription_deviceInstallationId_fkey" FOREIGN KEY ("deviceInstallationId") REFERENCES "public"."DeviceInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
