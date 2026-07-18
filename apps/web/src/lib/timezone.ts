const DEFAULT_TIME_ZONE = "America/Los_Angeles";

export function resolveTimeZone(value?: string | null): string {
  if (!value) {
    return DEFAULT_TIME_ZONE;
  }

  try {
    if (Intl.supportedValuesOf("timeZone").includes(value)) {
      return value;
    }
  } catch {
    // Intl.supportedValuesOf unavailable in this runtime; fall through.
  }

  return DEFAULT_TIME_ZONE;
}
