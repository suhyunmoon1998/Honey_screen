import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { getEnv } from "@honey/config";
import { prisma } from "@honey/db";

function getPushEncryptionKey() {
  const env = getEnv();

  if (!env.PUSH_ENCRYPTION_KEY_B64) {
    throw new Error("PUSH_ENCRYPTION_KEY_MISSING");
  }

  return {
    key: Buffer.from(env.PUSH_ENCRYPTION_KEY_B64, "base64"),
    version: env.PUSH_ENCRYPTION_KEY_VERSION,
  };
}

function hashEndpoint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function encryptPushValue(value: string) {
  const { key } = getPushEncryptionKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([ciphertext, tag]).toString("base64"),
    nonce: nonce.toString("base64"),
  };
}

export function decryptPushValue(input: { ciphertext: string; nonce: string }) {
  const { key } = getPushEncryptionKey();
  const payload = Buffer.from(input.ciphertext, "base64");
  const nonce = Buffer.from(input.nonce, "base64");
  const ciphertext = payload.subarray(0, payload.length - 16);
  const tag = payload.subarray(payload.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

function hashAnonymousDeviceId(value: string) {
  return createHash("sha256").update(value).digest("hex");
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
  const { version } = getPushEncryptionKey();
  const endpointHash = hashEndpoint(input.endpoint);
  const endpoint = encryptPushValue(input.endpoint);
  const p256dh = encryptPushValue(input.p256dh);
  const auth = encryptPushValue(input.auth);

  return prisma.$transaction(async (tx) => {
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
