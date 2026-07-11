import {
  getCanonicalAppOrigin,
  getSessionCookieName,
  getSessionCookieOptions,
} from "../../apps/web/src/lib/session";

describe("session configuration", () => {
  it("uses insecure localhost cookies in development", () => {
    const options = getSessionCookieOptions(
      new Date("2026-07-10T12:00:00.000Z"),
      "development",
    );

    expect(options.secure).toBe(false);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("uses secure cookies in production", () => {
    const options = getSessionCookieOptions(
      new Date("2026-07-10T12:00:00.000Z"),
      "production",
    );

    expect(options.secure).toBe(true);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("keeps one canonical localhost origin and cookie name in test and development", () => {
    expect(getCanonicalAppOrigin()).toBe("http://localhost:3000");
    expect(getSessionCookieName()).toBe("honey_session");
  });
});
