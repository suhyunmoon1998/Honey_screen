import Link from "next/link";
import { getMessages } from "@honey/i18n";
import { LocaleSwitch } from "@/components/locale-switch";
import { requireClientSession } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await requireClientSession();
  const locale = (session.locale === "en" ? "en" : "es") as "es" | "en";
  const messages = getMessages(locale);

  return (
    <main className="page-shell min-h-screen px-4 py-8">
      <section className="mx-auto max-w-md">
        <div className="mb-4 flex justify-end">
          <LocaleSwitch
            currentLocale={locale}
            redirectTo="/onboarding"
            label={messages.switchLanguage}
          />
        </div>
        <div className="card p-6">
          <h1 className="text-2xl font-semibold">
            {messages.onboardingTitle}
          </h1>
          <p className="mt-3 text-base leading-7 muted">
            {messages.onboardingBody}
          </p>
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-line bg-card-2 p-4">
              <p className="text-sm font-medium">{messages.timeZoneLabel}</p>
              <p className="mt-2 muted">America/Los_Angeles</p>
            </div>
            <Link
              className="button-primary block w-full text-center"
              href="/api/client/onboarding/complete"
            >
              {messages.continueToDashboard}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
