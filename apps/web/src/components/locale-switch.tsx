import type { Locale } from "@honey/i18n";

type Props = {
  currentLocale: Locale;
  redirectTo: string;
  label: string;
  className?: string;
};

export function LocaleSwitch({
  currentLocale,
  redirectTo,
  label,
  className,
}: Props) {
  const targetLocale: Locale = currentLocale === "es" ? "en" : "es";

  return (
    // A plain anchor forces a full browser navigation. Next's <Link> treats
    // this as navigating to the same route it's already on (since the
    // redirect target matches the current pathname) and skips refetching,
    // leaving the page showing the old locale even though the session
    // updated server-side.
    <a
      className={className ?? "button-secondary text-sm"}
      href={`/api/client/locale?lang=${targetLocale}&redirectTo=${encodeURIComponent(redirectTo)}`}
    >
      {label}
    </a>
  );
}
