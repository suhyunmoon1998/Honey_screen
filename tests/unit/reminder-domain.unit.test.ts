import {
  assertPreferredReminderTimeAllowed,
  deriveReminderWindow,
  getLocalDateInTimeZone,
  getLocalTimeInTimeZone,
  isLocalTimeInQuietHours,
  resolveScheduledInstantForLocalDate,
} from "../../packages/domain/src/index";

describe("reminder scheduling domain helpers", () => {
  it("rejects preferred times inside quiet hours", () => {
    expect(() =>
      assertPreferredReminderTimeAllowed({
        preferredLocalTime: "21:00",
        quietHoursStart: "20:00",
        quietHoursEnd: "08:00",
        allowedReminderTimes: ["09:00", "12:00", "17:00", "18:00", "21:00"],
      }),
    ).toThrow("PREFERRED_TIME_IN_QUIET_HOURS");
  });

  it("supports quiet hours that cross midnight", () => {
    expect(
      isLocalTimeInQuietHours({
        localTime: "07:30",
        quietHoursStart: "20:00",
        quietHoursEnd: "08:00",
      }),
    ).toBe(true);
    expect(
      isLocalTimeInQuietHours({
        localTime: "12:00",
        quietHoursStart: "20:00",
        quietHoursEnd: "08:00",
      }),
    ).toBe(false);
  });

  it("rejects equal quiet-hour bounds", () => {
    expect(() =>
      isLocalTimeInQuietHours({
        localTime: "12:00",
        quietHoursStart: "20:00",
        quietHoursEnd: "20:00",
      }),
    ).toThrow("QUIET_HOURS_EQUAL");
  });

  it("derives local date and local time from the stored IANA zone", () => {
    const date = new Date("2026-07-12T23:30:00.000Z");
    expect(getLocalDateInTimeZone(date, "America/Los_Angeles")).toBe(
      "2026-07-12",
    );
    expect(getLocalTimeInTimeZone(date, "America/Los_Angeles")).toBe("16:30");
  });

  it("moves nonexistent spring-forward local times to the first valid instant after the gap", () => {
    const resolved = resolveScheduledInstantForLocalDate({
      localDate: "2026-03-08",
      localTime: "02:30",
      timeZone: "America/Los_Angeles",
    });

    expect(resolved.toISOString()).toBe("2026-03-08T10:30:00.000Z");
  });

  it("chooses the earlier instant for ambiguous fall-back local times", () => {
    const resolved = resolveScheduledInstantForLocalDate({
      localDate: "2026-11-01",
      localTime: "01:30",
      timeZone: "America/Los_Angeles",
    });

    expect(resolved.toISOString()).toBe("2026-11-01T08:30:00.000Z");
  });

  it("schedules deterministically in a non-DST time zone", () => {
    const resolved = resolveScheduledInstantForLocalDate({
      localDate: "2026-07-12",
      localTime: "18:00",
      timeZone: "Asia/Seoul",
    });

    expect(resolved.toISOString()).toBe("2026-07-12T09:00:00.000Z");
  });

  it("creates a bounded catch-up expiry window", () => {
    const window = deriveReminderWindow({
      localDate: "2026-07-12",
      preferredLocalTime: "18:00",
      timeZone: "America/Los_Angeles",
      catchUpWindowMinutes: 60,
    });

    expect(window.scheduledFor.toISOString()).toBe("2026-07-13T01:00:00.000Z");
    expect(window.expiresAt.toISOString()).toBe("2026-07-13T02:00:00.000Z");
  });
});
