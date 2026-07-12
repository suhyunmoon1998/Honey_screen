import {
  getEnv,
  isPushEncryptionKeyValid,
  resetEnvForTests,
} from "@honey/config";

describe("push subscription security guards", () => {
  afterEach(() => {
    resetEnvForTests();
  });

  it("validates the push encryption key length", () => {
    expect(isPushEncryptionKeyValid(Buffer.alloc(32).toString("base64"))).toBe(
      true,
    );
    expect(isPushEncryptionKeyValid(Buffer.alloc(16).toString("base64"))).toBe(
      false,
    );
  });

  it("fails closed in production if push delivery is enabled without required secrets", () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://localhost/honey_case_adventure?schema=public",
      SESSION_COOKIE_NAME: "honey_session",
      SESSION_TTL_HOURS: "24",
      DEV_OTP_ENABLED: "false",
      DEV_OTP_CODE: "246810",
      DEV_STAFF_AUTH_ENABLED: "false",
      DEV_STAFF_PASSWORD: "FictionalPass123!",
      INVITATION_SIGNING_SECRET: "replace-with-a-local-secret-1234",
      PRIVACY_POLICY_VERSION: "2026-07-10",
      ORGANIZATION_DEFAULT_TIME_ZONE: "America/Los_Angeles",
      WORKER_POLL_MS: "500",
      ALLOW_DEMO_CONTENT: "false",
      PUSH_DELIVERY_ENABLED: "true",
      PUSH_ENCRYPTION_KEY_B64: "",
      VAPID_PUBLIC_KEY: "",
      VAPID_PRIVATE_KEY: "",
    };

    resetEnvForTests();
    expect(() => getEnv()).toThrow();
    process.env = originalEnv;
  });
});
