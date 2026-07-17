import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

export const WORKER_MIN_POLL_MS = 100;
export const WORKER_MAX_PROVIDER_TIMEOUT_MS = 60_000;
export const WORKER_ACK_SAFETY_MARGIN_MS = 1_000;
export const SCHEDULER_MIN_POLL_MS = 1_000;
export const SCHEDULER_MAX_BATCH_SIZE = 100;
export const SCHEDULER_MAX_CATCH_UP_MINUTES = 180;

function isValidLocalTimeString(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(moduleDir, "../../../.env") });

export function isDemoContentAllowedForEnvironment(input: {
  nodeEnv: "development" | "test" | "production";
  allowDemoContent: boolean;
}) {
  return (
    input.allowDemoContent &&
    (input.nodeEnv === "development" || input.nodeEnv === "test")
  );
}

export function isPushEncryptionKeyValid(value: string) {
  try {
    return Buffer.from(value, "base64").byteLength === 32;
  } catch {
    return false;
  }
}

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),
    SESSION_COOKIE_NAME: z.string().min(1).default("honey_session"),
    SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),
    DEV_OTP_ENABLED: z
      .string()
      .transform((value) => value === "true")
      .default(false),
    DEV_OTP_CODE: z.string().min(4).default("246810"),
    DEV_STAFF_AUTH_ENABLED: z
      .string()
      .transform((value) => value === "true")
      .default(false),
    DEV_STAFF_PASSWORD: z.string().min(8),
    OTP_VERIFICATION_ENABLED: z
      .string()
      .transform((value) => value !== "false")
      .default(true),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM_NUMBER: z.string().optional(),
    INVITATION_SIGNING_SECRET: z.string().min(16),
    PRIVACY_POLICY_VERSION: z.string().min(1),
    ORGANIZATION_DEFAULT_TIME_ZONE: z.string().min(1),
    WORKER_POLL_MS: z.coerce.number().int().positive().default(500),
    WORKER_CLAIM_BATCH_SIZE: z.coerce.number().int().positive().default(10),
    WORKER_DELIVERY_CONCURRENCY: z.coerce.number().int().positive().default(4),
    WORKER_LEASE_MS: z.coerce.number().int().positive().default(30_000),
    WORKER_PROVIDER_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(10_000),
    WORKER_SHUTDOWN_GRACE_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(10_000),
    WORKER_RETRY_BASE_MS: z.coerce.number().int().positive().default(1_000),
    WORKER_RETRY_MAX_MS: z.coerce.number().int().positive().default(60_000),
    WORKER_NOTIFICATION_MAX_ATTEMPTS: z.coerce
      .number()
      .int()
      .positive()
      .default(5),
    SCHEDULER_ENABLED: z
      .string()
      .transform((value) => value === "true")
      .default(true),
    SCHEDULER_POLL_MS: z.coerce.number().int().positive().default(30_000),
    SCHEDULER_BATCH_SIZE: z.coerce.number().int().positive().default(25),
    SCHEDULER_LOOKAHEAD_MINUTES: z.coerce.number().int().positive().default(15),
    SCHEDULER_CATCH_UP_MINUTES: z.coerce.number().int().min(0).default(60),
    DEFAULT_QUIET_HOURS_START: z.string().default("20:00"),
    DEFAULT_QUIET_HOURS_END: z.string().default("08:00"),
    ALLOWED_REMINDER_TIME_CHOICES: z
      .string()
      .default("09:00,12:00,17:00,18:00"),
    REMINDER_TEMPLATE_VERSION: z.string().min(1).default("V1"),
    NOTIFICATION_CONSENT_VERSION: z.string().min(1).default("2026-07-12"),
    SMS_REMINDERS_ENABLED: z
      .string()
      .transform((value) => value === "true")
      .default(false),
    ALLOW_DEMO_CONTENT: z
      .string()
      .transform((value) => value === "true")
      .default(false),
    PUSH_DELIVERY_ENABLED: z
      .string()
      .transform((value) => value === "true")
      .default(false),
    PUSH_ENCRYPTION_KEY_B64: z.string().optional(),
    PUSH_ENCRYPTION_KEY_VERSION: z.coerce.number().int().positive().default(1),
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && data.DEV_OTP_ENABLED) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DEV_OTP_ENABLED"],
        message: "DEV_OTP_ENABLED must be false in production.",
      });
    }

    const requiresRealOtpDelivery =
      data.OTP_VERIFICATION_ENABLED && data.NODE_ENV === "production";

    if (
      requiresRealOtpDelivery &&
      (!data.TWILIO_ACCOUNT_SID ||
        !data.TWILIO_AUTH_TOKEN ||
        !data.TWILIO_FROM_NUMBER)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TWILIO_ACCOUNT_SID"],
        message:
          "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are required to send real OTP codes in production.",
      });
    }

    if (
      data.ALLOW_DEMO_CONTENT &&
      !isDemoContentAllowedForEnvironment({
        nodeEnv: data.NODE_ENV,
        allowDemoContent: data.ALLOW_DEMO_CONTENT,
      })
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ALLOW_DEMO_CONTENT"],
        message:
          "ALLOW_DEMO_CONTENT may be true only in development or test environments.",
      });
    }

    if (
      data.PUSH_ENCRYPTION_KEY_B64 &&
      !isPushEncryptionKeyValid(data.PUSH_ENCRYPTION_KEY_B64)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PUSH_ENCRYPTION_KEY_B64"],
        message: "PUSH_ENCRYPTION_KEY_B64 must decode to exactly 32 bytes.",
      });
    }

    if (data.NODE_ENV === "production" && data.PUSH_DELIVERY_ENABLED) {
      if (!data.PUSH_ENCRYPTION_KEY_B64) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["PUSH_ENCRYPTION_KEY_B64"],
          message:
            "PUSH_ENCRYPTION_KEY_B64 is required when push delivery is enabled in production.",
        });
      }

      if (!data.VAPID_PUBLIC_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["VAPID_PUBLIC_KEY"],
          message:
            "VAPID_PUBLIC_KEY is required when push delivery is enabled in production.",
        });
      }

      if (!data.VAPID_PRIVATE_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["VAPID_PRIVATE_KEY"],
          message:
            "VAPID_PRIVATE_KEY is required when push delivery is enabled in production.",
        });
      }
    }

    if (data.WORKER_PROVIDER_TIMEOUT_MS >= data.WORKER_LEASE_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["WORKER_PROVIDER_TIMEOUT_MS"],
        message:
          "WORKER_PROVIDER_TIMEOUT_MS must be shorter than WORKER_LEASE_MS.",
      });
    }

    if (
      data.WORKER_LEASE_MS - data.WORKER_PROVIDER_TIMEOUT_MS <
      WORKER_ACK_SAFETY_MARGIN_MS
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["WORKER_LEASE_MS"],
        message: `WORKER_LEASE_MS must exceed WORKER_PROVIDER_TIMEOUT_MS by at least ${WORKER_ACK_SAFETY_MARGIN_MS} ms.`,
      });
    }

    if (data.WORKER_PROVIDER_TIMEOUT_MS > WORKER_MAX_PROVIDER_TIMEOUT_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["WORKER_PROVIDER_TIMEOUT_MS"],
        message: `WORKER_PROVIDER_TIMEOUT_MS must be less than or equal to ${WORKER_MAX_PROVIDER_TIMEOUT_MS}.`,
      });
    }

    if (data.WORKER_RETRY_MAX_MS < data.WORKER_RETRY_BASE_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["WORKER_RETRY_MAX_MS"],
        message:
          "WORKER_RETRY_MAX_MS must be greater than or equal to WORKER_RETRY_BASE_MS.",
      });
    }

    if (data.WORKER_POLL_MS < WORKER_MIN_POLL_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["WORKER_POLL_MS"],
        message: `WORKER_POLL_MS must be at least ${WORKER_MIN_POLL_MS} to avoid a tight loop.`,
      });
    }

    if (data.SCHEDULER_POLL_MS < SCHEDULER_MIN_POLL_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SCHEDULER_POLL_MS"],
        message: `SCHEDULER_POLL_MS must be at least ${SCHEDULER_MIN_POLL_MS}.`,
      });
    }

    if (data.SCHEDULER_BATCH_SIZE > SCHEDULER_MAX_BATCH_SIZE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SCHEDULER_BATCH_SIZE"],
        message: `SCHEDULER_BATCH_SIZE must be less than or equal to ${SCHEDULER_MAX_BATCH_SIZE}.`,
      });
    }

    if (data.SCHEDULER_CATCH_UP_MINUTES > SCHEDULER_MAX_CATCH_UP_MINUTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SCHEDULER_CATCH_UP_MINUTES"],
        message: `SCHEDULER_CATCH_UP_MINUTES must be less than or equal to ${SCHEDULER_MAX_CATCH_UP_MINUTES}.`,
      });
    }

    if (!isValidLocalTimeString(data.DEFAULT_QUIET_HOURS_START)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DEFAULT_QUIET_HOURS_START"],
        message: "DEFAULT_QUIET_HOURS_START must be a valid HH:MM local time.",
      });
    }

    if (!isValidLocalTimeString(data.DEFAULT_QUIET_HOURS_END)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DEFAULT_QUIET_HOURS_END"],
        message: "DEFAULT_QUIET_HOURS_END must be a valid HH:MM local time.",
      });
    }

    if (data.DEFAULT_QUIET_HOURS_START === data.DEFAULT_QUIET_HOURS_END) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DEFAULT_QUIET_HOURS_END"],
        message:
          "DEFAULT_QUIET_HOURS_START and DEFAULT_QUIET_HOURS_END must differ.",
      });
    }

    const allowedReminderTimes = data.ALLOWED_REMINDER_TIME_CHOICES.split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (allowedReminderTimes.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ALLOWED_REMINDER_TIME_CHOICES"],
        message:
          "ALLOWED_REMINDER_TIME_CHOICES must include at least one time.",
      });
    }

    for (const time of allowedReminderTimes) {
      if (!isValidLocalTimeString(time)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ALLOWED_REMINDER_TIME_CHOICES"],
          message:
            "ALLOWED_REMINDER_TIME_CHOICES must contain valid HH:MM values.",
        });
        break;
      }
    }

    if (data.SMS_REMINDERS_ENABLED) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMS_REMINDERS_ENABLED"],
        message:
          "SMS_REMINDERS_ENABLED must remain false until an approved provider is configured.",
      });
    }

    if (
      data.NODE_ENV === "production" &&
      data.SCHEDULER_ENABLED &&
      (!data.PUSH_ENCRYPTION_KEY_B64 ||
        !data.VAPID_PUBLIC_KEY ||
        !data.VAPID_PRIVATE_KEY)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SCHEDULER_ENABLED"],
        message:
          "SCHEDULER_ENABLED in production requires valid push encryption and VAPID configuration.",
      });
    }
  });

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }

  return cachedEnv;
}

export function resetEnvForTests() {
  cachedEnv = null;
}
