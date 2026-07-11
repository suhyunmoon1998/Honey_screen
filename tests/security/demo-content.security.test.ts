import { isDemoContentAllowedForEnvironment } from "@honey/config";

describe("demo content production guard", () => {
  it("allows demo content only in development or test with an explicit flag", () => {
    expect(
      isDemoContentAllowedForEnvironment({
        nodeEnv: "development",
        allowDemoContent: true,
      }),
    ).toBe(true);
    expect(
      isDemoContentAllowedForEnvironment({
        nodeEnv: "test",
        allowDemoContent: true,
      }),
    ).toBe(true);
    expect(
      isDemoContentAllowedForEnvironment({
        nodeEnv: "development",
        allowDemoContent: false,
      }),
    ).toBe(false);
  });

  it("fails closed in production even when demo loading is requested", () => {
    expect(
      isDemoContentAllowedForEnvironment({
        nodeEnv: "production",
        allowDemoContent: true,
      }),
    ).toBe(false);
  });
});
