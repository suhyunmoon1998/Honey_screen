import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "**/*.d.ts",
      "**/*.js",
      "apps/worker/dist/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/worker/src/**/*.ts", "packages/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-undef": "off",
    },
  },
];
