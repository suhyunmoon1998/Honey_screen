import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(moduleDir, "../../.env");

for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    continue;
  }

  const separatorIndex = trimmed.indexOf("=");

  if (separatorIndex === -1) {
    continue;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const value = trimmed.slice(separatorIndex + 1).trim();

  if (!(key in process.env)) {
    process.env[key] = value;
  }
}

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
