import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": "/apps/web/src",
      "@honey/config": "/packages/config/src/index.ts",
      "@honey/db": "/packages/db/src/index.ts",
      "@honey/domain": "/packages/domain/src/index.ts",
      "@honey/i18n": "/packages/i18n/src/index.ts",
      "@honey/testing": "/packages/testing/src/index.ts",
      "@honey/ui": "/packages/ui/src/index.ts",
    },
  },
  test: {
    globals: true,
  },
});
