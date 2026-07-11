import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
  });

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }

  return cachedEnv;
}
