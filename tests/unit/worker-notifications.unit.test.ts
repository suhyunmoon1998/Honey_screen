import {
  getEnv,
  resetEnvForTests,
  WORKER_ACK_SAFETY_MARGIN_MS,
  WORKER_MAX_PROVIDER_TIMEOUT_MS,
  WORKER_MIN_POLL_MS,
} from "@honey/config";
import {
  computeRetryDelayMs,
  sanitizeProviderErrorCode,
} from "../../apps/worker/src/notifications";

const baseEnv = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://localhost/honey_case_adventure?schema=public",
  SESSION_COOKIE_NAME: "honey_session",
  SESSION_TTL_HOURS: "24",
  DEV_OTP_ENABLED: "true",
  DEV_OTP_CODE: "246810",
  DEV_STAFF_AUTH_ENABLED: "true",
  DEV_STAFF_PASSWORD: "FictionalPass123!",
  INVITATION_SIGNING_SECRET: "replace-with-a-local-secret-1234",
  PRIVACY_POLICY_VERSION: "2026-07-10",
  ORGANIZATION_DEFAULT_TIME_ZONE: "America/Los_Angeles",
  WORKER_POLL_MS: "500",
  WORKER_CLAIM_BATCH_SIZE: "10",
  WORKER_DELIVERY_CONCURRENCY: "4",
  WORKER_LEASE_MS: "30000",
  WORKER_PROVIDER_TIMEOUT_MS: "10000",
  WORKER_SHUTDOWN_GRACE_MS: "10000",
  WORKER_RETRY_BASE_MS: "1000",
  WORKER_RETRY_MAX_MS: "60000",
  WORKER_NOTIFICATION_MAX_ATTEMPTS: "5",
  ALLOW_DEMO_CONTENT: "true",
  PUSH_DELIVERY_ENABLED: "false",
};

describe("worker notification helpers", () => {
  afterEach(() => {
    resetEnvForTests();
  });

  it("computes the first retry without jitter inflation", () => {
    expect(
      computeRetryDelayMs({
        attemptNumber: 1,
        baseDelayMs: 1000,
        maxDelayMs: 60_000,
        jitterValue: 0,
      }),
    ).toBe(1000);
  });

  it("grows exponentially with deterministic jitter", () => {
    expect(
      computeRetryDelayMs({
        attemptNumber: 3,
        baseDelayMs: 1000,
        maxDelayMs: 60_000,
        jitterValue: 0.5,
      }),
    ).toBe(4400);
  });

  it("caps exponential growth at the configured maximum", () => {
    expect(
      computeRetryDelayMs({
        attemptNumber: 10,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        jitterValue: 1,
      }),
    ).toBe(5000);
  });

  it("honors retry-after below the configured maximum", () => {
    expect(
      computeRetryDelayMs({
        attemptNumber: 2,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        retryAfterMs: 3000,
      }),
    ).toBe(3000);
  });

  it("caps retry-after above the configured maximum", () => {
    expect(
      computeRetryDelayMs({
        attemptNumber: 2,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        retryAfterMs: 7000,
      }),
    ).toBe(5000);
  });

  it("supports deterministic minimum and maximum jitter bounds", () => {
    expect(
      computeRetryDelayMs({
        attemptNumber: 2,
        baseDelayMs: 1000,
        maxDelayMs: 10_000,
        jitterValue: 0,
      }),
    ).toBe(2000);

    expect(
      computeRetryDelayMs({
        attemptNumber: 2,
        baseDelayMs: 1000,
        maxDelayMs: 10_000,
        jitterValue: 1,
      }),
    ).toBe(2400);
  });

  it("sanitizes provider errors to allowlisted safe codes", () => {
    expect(sanitizeProviderErrorCode(new Error("PROVIDER_TIMEOUT"))).toBe(
      "provider_timeout",
    );
    expect(sanitizeProviderErrorCode(new Error("INVALID_SUBSCRIPTION"))).toBe(
      "invalid_subscription",
    );
    expect(
      sanitizeProviderErrorCode(new Error("super secret raw provider body")),
    ).toBe("provider_unavailable");
  });

  it("rejects invalid worker config when provider timeout is not shorter than lease duration", () => {
    const originalEnv = process.env;
    process.env = {
      ...baseEnv,
      WORKER_LEASE_MS: "10000",
      WORKER_PROVIDER_TIMEOUT_MS: "10000",
    };

    expect(() => getEnv()).toThrow();
    process.env = originalEnv;
  });

  it("rejects invalid worker config when acknowledgement safety margin is missing", () => {
    const originalEnv = process.env;
    process.env = {
      ...baseEnv,
      WORKER_LEASE_MS: String(10_000 + WORKER_ACK_SAFETY_MARGIN_MS - 1),
      WORKER_PROVIDER_TIMEOUT_MS: "10000",
    };

    expect(() => getEnv()).toThrow();
    process.env = originalEnv;
  });

  it("rejects invalid worker config when provider timeout exceeds the upper bound", () => {
    const originalEnv = process.env;
    process.env = {
      ...baseEnv,
      WORKER_PROVIDER_TIMEOUT_MS: String(WORKER_MAX_PROVIDER_TIMEOUT_MS + 1),
      WORKER_LEASE_MS: String(WORKER_MAX_PROVIDER_TIMEOUT_MS + 10_000),
    };

    expect(() => getEnv()).toThrow();
    process.env = originalEnv;
  });

  it("rejects invalid worker config when retry maximum is below retry base", () => {
    const originalEnv = process.env;
    process.env = {
      ...baseEnv,
      WORKER_RETRY_BASE_MS: "5000",
      WORKER_RETRY_MAX_MS: "4000",
    };

    expect(() => getEnv()).toThrow();
    process.env = originalEnv;
  });

  it("rejects invalid worker config when poll interval is too small", () => {
    const originalEnv = process.env;
    process.env = {
      ...baseEnv,
      WORKER_POLL_MS: String(WORKER_MIN_POLL_MS - 1),
    };

    expect(() => getEnv()).toThrow();
    process.env = originalEnv;
  });
});
