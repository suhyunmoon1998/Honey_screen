import { getEnv } from "@honey/config";
import { prisma, type Prisma } from "@honey/db";
import {
  decryptOpaqueValue,
  encryptOpaqueValue,
  hashOpaqueValue,
} from "@honey/domain";

const MAX_ENDPOINT_LENGTH = 2048;
const MAX_KEY_LENGTH = 512;

type TxClient = Prisma.TransactionClient;

function getPushEncryptionKey() {
  const env = getEnv();

  if (!env.PUSH_ENCRYPTION_KEY_B64) {
    if (env.NODE_ENV === "production") {
      throw new Error("PUSH_ENCRYPTION_KEY_MISSING");
    }

    return {
      key: Buffer.alloc(32, 11),
      version: env.PUSH_ENCRYPTION_KEY_VERSION,
    };
  }

  return {
    key: Buffer.from(env.PUSH_ENCRYPTION_KEY_B64, "base64"),
    version: env.PUSH_ENCRYPTION_KEY_VERSION,
  };
}

function hashEndpoint(value: string) {
  return hashOpaqueValue(value);
}

function encryptPushValue(value: string) {
  const { key } = getPushEncryptionKey();
  return encryptOpaqueValue({ key, value });
}

export function decryptPushValue(input: { ciphertext: string; nonce: string }) {
  const { key } = getPushEncryptionKey();
  return decryptOpaqueValue({
    key,
    ciphertext: input.ciphertext,
    nonce: input.nonce,
  });
}

function hashAnonymousDeviceId(value: string) {
  return hashOpaqueValue(value);
}

function assertPushValueBounds(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  if (
    input.endpoint.length === 0 ||
    input.endpoint.length > MAX_ENDPOINT_LENGTH ||
    input.p256dh.length === 0 ||
    input.p256dh.length > MAX_KEY_LENGTH ||
    input.auth.length === 0 ||
    input.auth.length > MAX_KEY_LENGTH
  ) {
    throw new Error("INVALID_PUSH_SUBSCRIPTION");
  }
}

export async function upsertPushSubscriptionInTransaction(
  tx: TxClient,
  input: {
    clientId: string;
    organizationId: string;
    anonymousDeviceId: string;
    platformHint?: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  },
) {
  assertPushValueBounds(input);

  const { version } = getPushEncryptionKey();
  const endpointHash = hashEndpoint(input.endpoint);
  const endpoint = encryptPushValue(input.endpoint);
  const p256dh = encryptPushValue(input.p256dh);
  const auth = encryptPushValue(input.auth);

  const deviceInstallation = await tx.deviceInstallation.upsert({
    where: {
      anonymousDeviceIdHash: hashAnonymousDeviceId(input.anonymousDeviceId),
    },
    update: {
      lastSeenAt: new Date(),
      platformHint: input.platformHint,
    },
    create: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      anonymousDeviceIdHash: hashAnonymousDeviceId(input.anonymousDeviceId),
      platformHint: input.platformHint,
    },
  });

  const subscription = await tx.pushSubscription.upsert({
    where: { endpointHash },
    update: {
      clientId: input.clientId,
      organizationId: input.organizationId,
      deviceInstallationId: deviceInstallation.id,
      endpointCiphertext: endpoint.ciphertext,
      endpointNonce: endpoint.nonce,
      p256dhCiphertext: p256dh.ciphertext,
      p256dhNonce: p256dh.nonce,
      authCiphertext: auth.ciphertext,
      authNonce: auth.nonce,
      encryptionKeyVersion: version,
      status: "ACTIVE",
      revokedAt: null,
    },
    create: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      deviceInstallationId: deviceInstallation.id,
      endpointHash,
      endpointCiphertext: endpoint.ciphertext,
      endpointNonce: endpoint.nonce,
      p256dhCiphertext: p256dh.ciphertext,
      p256dhNonce: p256dh.nonce,
      authCiphertext: auth.ciphertext,
      authNonce: auth.nonce,
      encryptionKeyVersion: version,
    },
  });

  return {
    id: subscription.id,
    deviceInstallationId: subscription.deviceInstallationId,
    status: subscription.status,
    createdAt: subscription.createdAt,
    endpointHash: subscription.endpointHash,
    encryptionKeyVersion: subscription.encryptionKeyVersion,
  };
}

export async function upsertPushSubscription(input: {
  clientId: string;
  organizationId: string;
  anonymousDeviceId: string;
  platformHint?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  return prisma.$transaction(async (tx) =>
    upsertPushSubscriptionInTransaction(tx, input),
  );
}

export async function revokeClientPushSubscriptionsInTransaction(
  tx: TxClient,
  input: {
    clientId: string;
    organizationId: string;
    deviceInstallationId?: string;
  },
) {
  return tx.pushSubscription.updateMany({
    where: {
      clientId: input.clientId,
      organizationId: input.organizationId,
      status: "ACTIVE",
      ...(input.deviceInstallationId
        ? { deviceInstallationId: input.deviceInstallationId }
        : {}),
    },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
    },
  });
}

export async function listClientPushSubscriptions(input: {
  clientId: string;
  organizationId: string;
}) {
  return prisma.pushSubscription.findMany({
    where: {
      clientId: input.clientId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      deviceInstallationId: true,
      endpointHash: true,
      status: true,
      encryptionKeyVersion: true,
      createdAt: true,
      revokedAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getClientPushSubscriptionState(input: {
  clientId: string;
  organizationId: string;
}) {
  const active = await prisma.pushSubscription.findFirst({
    where: {
      clientId: input.clientId,
      organizationId: input.organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      deviceInstallationId: true,
      status: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    hasActiveSubscription: Boolean(active),
    activeSubscriptionId: active?.id ?? null,
    activeDeviceInstallationId: active?.deviceInstallationId ?? null,
  };
}
