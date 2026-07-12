import { resetEnvForTests } from "@honey/config";
import { prisma } from "@honey/db";
import { resetDatabase } from "../../packages/testing/src/db";
import {
  decryptPushValue,
  listClientPushSubscriptions,
  upsertPushSubscription,
} from "../../apps/web/src/lib/push-subscriptions";
import {
  requestOtp,
  verifyOtpAndRegister,
} from "../../apps/web/src/lib/services";

describe("push subscription encryption", () => {
  beforeEach(async () => {
    process.env.PUSH_ENCRYPTION_KEY_B64 = Buffer.alloc(32, 7).toString(
      "base64",
    );
    process.env.PUSH_ENCRYPTION_KEY_VERSION = "1";
    resetEnvForTests();
    await resetDatabase();
  });

  it("stores encrypted push material and returns only safe fields", async () => {
    await requestOtp({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      locale: "es",
      acceptedPrivacy: true,
      acceptedMessages: true,
    });

    const registration = await verifyOtpAndRegister({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      code: "246810",
      locale: "es",
    });

    const saved = await upsertPushSubscription({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      anonymousDeviceId: "device-123",
      platformHint: "ios",
      endpoint: "https://push.example.test/endpoint/123",
      p256dh: "p256dh-key",
      auth: "auth-key",
    });

    const raw = await prisma.pushSubscription.findUniqueOrThrow({
      where: { id: saved.id },
    });

    expect(saved).toEqual({
      id: raw.id,
      deviceInstallationId: raw.deviceInstallationId,
      status: "ACTIVE",
      createdAt: raw.createdAt,
      endpointHash: raw.endpointHash,
      encryptionKeyVersion: 1,
    });
    expect(raw.endpointCiphertext).not.toContain("push.example.test");
    expect(
      decryptPushValue({
        ciphertext: raw.endpointCiphertext,
        nonce: raw.endpointNonce,
      }),
    ).toBe("https://push.example.test/endpoint/123");
  });

  it("never returns raw endpoints or keys from the normal list API", async () => {
    await requestOtp({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      locale: "es",
      acceptedPrivacy: true,
      acceptedMessages: true,
    });

    const registration = await verifyOtpAndRegister({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      code: "246810",
      locale: "es",
    });

    await upsertPushSubscription({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
      anonymousDeviceId: "device-123",
      platformHint: "android",
      endpoint: "https://push.example.test/endpoint/abc",
      p256dh: "p256dh-key",
      auth: "auth-key",
    });

    const listed = await listClientPushSubscriptions({
      clientId: registration.client.id,
      organizationId: registration.client.organizationId,
    });

    expect(JSON.stringify(listed)).not.toContain("push.example.test");
    expect(JSON.stringify(listed)).not.toContain("p256dh-key");
    expect(JSON.stringify(listed)).not.toContain("auth-key");
    expect(listed).toHaveLength(1);
  });
});
