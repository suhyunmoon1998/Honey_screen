import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

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
    INVITATION_SIGNING_SECRET: z.string().min(16),
    PRIVACY_POLICY_VERSION: z.string().min(1),
    ORGANIZATION_DEFAULT_TIME_ZONE: z.string().min(1),
    WORKER_POLL_MS: z.coerce.number().int().positive().default(500),
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

    if (data.NODE_ENV === "production" && data.DEV_STAFF_AUTH_ENABLED) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DEV_STAFF_AUTH_ENABLED"],
        message: "DEV_STAFF_AUTH_ENABLED must be false in production.",
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
