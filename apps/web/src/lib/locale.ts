import type { Locale } from "@honey/i18n";
import { defaultLocale } from "@honey/i18n";

export function resolveLocale(value?: string | null): Locale {
  return value === "en" ? "en" : defaultLocale;
}
