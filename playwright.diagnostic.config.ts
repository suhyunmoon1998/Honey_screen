import baseConfig from "./playwright.config";

const artifactMode = process.env.PW_DIAG_ARTIFACT_MODE ?? "default";
const reporter = process.env.PW_DIAG_REPORTER ?? "line";

function resolveUseOverrides() {
  switch (artifactMode) {
    case "none":
      return {
        trace: "off" as const,
        screenshot: "off" as const,
        video: "off" as const,
      };
    case "trace-only":
      return {
        trace: "retain-on-failure" as const,
        screenshot: "off" as const,
        video: "off" as const,
      };
    case "screenshot-only":
      return {
        trace: "off" as const,
        screenshot: "only-on-failure" as const,
        video: "off" as const,
      };
    case "video-only":
      return {
        trace: "off" as const,
        screenshot: "off" as const,
        video: "retain-on-failure" as const,
      };
    case "trace+screenshot":
      return {
        trace: "retain-on-failure" as const,
        screenshot: "only-on-failure" as const,
        video: "off" as const,
      };
    default:
      return {};
  }
}

export default {
  ...baseConfig,
  reporter,
  retries: 0,
  workers: 1,
  outputDir: ".playwright-diag/test-results",
  use: {
    ...baseConfig.use,
    ...resolveUseOverrides(),
  },
};
