import { prisma } from "@honey/db";
import { hashToken } from "@honey/domain";
import { resetDatabase } from "../../packages/testing/src/db";
import {
  createSessionRecord,
  readSession,
  revokeSession,
} from "../../apps/web/src/lib/session";
import {
  requestOtp,
  verifyOtpAndRegister,
} from "../../apps/web/src/lib/services";

describe("session and OTP integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates a server-side session as part of successful OTP verification", async () => {
    await requestOtp({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      locale: "es",
      acceptedPrivacy: true,
      acceptedMessages: true,
    });

    const result = await verifyOtpAndRegister({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      code: "246810",
      locale: "es",
    });

    const storedSession = await readSession(result.session.rawToken);

    expect(result.client.phoneE164).toBe("+15555550101");
    expect(storedSession?.actorId).toBe(result.client.id);
    expect(storedSession?.actorType).toBe("CLIENT");
  });

  it("rejects invalid or expired sessions", async () => {
    await prisma.session.create({
      data: {
        tokenHash: hashToken("expired-session-token"),
        actorType: "CLIENT",
        actorId: "client_expired",
        organizationId: "org_jacklaw_demo",
        role: "CLIENT",
        locale: "es",
        expiresAt: new Date("2026-07-09T12:00:00.000Z"),
      },
    });

    expect(await readSession("expired-session-token")).toBeNull();
    expect(await readSession("missing-session-token")).toBeNull();
  });

  it("keeps a session valid across repeated reads until it is revoked", async () => {
    const created = await createSessionRecord(prisma, {
      actorType: "CLIENT",
      actorId: "client_repeat",
      organizationId: "org_jacklaw_demo",
      role: "CLIENT",
      locale: "es",
    });

    expect((await readSession(created.rawToken))?.actorId).toBe(
      "client_repeat",
    );
    expect((await readSession(created.rawToken))?.actorId).toBe(
      "client_repeat",
    );
  });

  it("revokes a session on logout", async () => {
    const created = await createSessionRecord(prisma, {
      actorType: "STAFF",
      actorId: "staff_repeat",
      organizationId: "org_jacklaw_demo",
      role: "STAFF",
      locale: "es",
    });

    expect(await readSession(created.rawToken)).not.toBeNull();

    await revokeSession(created.rawToken);

    expect(await readSession(created.rawToken)).toBeNull();
  });

  it("handles repeated verification attempts for the same invitation without creating a second client", async () => {
    await requestOtp({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      locale: "es",
      acceptedPrivacy: true,
      acceptedMessages: true,
    });

    const first = await verifyOtpAndRegister({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      code: "246810",
      locale: "es",
    });

    await requestOtp({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      locale: "es",
      acceptedPrivacy: true,
      acceptedMessages: true,
    });

    const second = await verifyOtpAndRegister({
      token: "honey-demo-invite",
      rawPhone: "(555) 555-0101",
      code: "246810",
      locale: "es",
    });

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: hashToken("honey-demo-invite") },
    });

    expect(first.client.id).toBe(second.client.id);
    expect(await prisma.client.count()).toBe(1);
    expect(invitation?.acceptedAt).not.toBeNull();
  });
});
