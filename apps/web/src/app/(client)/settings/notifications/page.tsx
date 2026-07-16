import { getMessages, type Locale } from "@honey/i18n";
import { LocaleSwitch } from "@/components/locale-switch";
import { NotificationSettingsClient } from "@/components/notification-settings-client";
import { requireClientSession } from "@/lib/authz";
import { getClientNotificationSettings } from "@/lib/notification-preferences";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const session = await requireClientSession();
  const locale = (session.locale === "en" ? "en" : "es") as Locale;
  const messages = getMessages(locale);
  const settings = await getClientNotificationSettings({
    clientId: session.actorId,
    organizationId: session.organizationId,
  });

  return (
    <main className="page-shell min-h-screen px-4 py-6">
      <section className="mx-auto max-w-md space-y-4">
        <div className="flex justify-end">
          <LocaleSwitch
            currentLocale={locale}
            redirectTo="/settings/notifications"
            label={messages.switchLanguage}
          />
        </div>
        <NotificationSettingsClient
          initialState={{
            ...settings,
            vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
          }}
          locale={locale}
        />
      </section>
    </main>
  );
}
