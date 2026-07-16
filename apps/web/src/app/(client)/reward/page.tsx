import { prisma } from "@honey/db";
import { getMessages } from "@honey/i18n";
import { LocaleSwitch } from "@/components/locale-switch";
import { SignOutForm } from "@/components/signout-form";
import { requireClientSession } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function RewardPage() {
  const session = await requireClientSession();
  const locale = (session.locale === "en" ? "en" : "es") as "es" | "en";
  const messages = getMessages(locale);
  const rewardGrant = await prisma.rewardGrant.findFirst({
    where: { clientId: session.actorId },
    include: { rewardDefinition: true },
  });

  return (
    <main className="page-shell min-h-screen px-4 py-8">
      <section className="mx-auto max-w-md">
        <div className="mb-4 flex justify-end">
          <LocaleSwitch
            currentLocale={locale}
            redirectTo="/reward"
            label={messages.switchLanguage}
          />
        </div>
        <div className="card p-6">
          <h1 className="text-3xl font-semibold">
            {messages.completeMission}
          </h1>
          <p className="mt-4 text-base leading-7 muted">
            {messages.rewardTitle}
          </p>
          {rewardGrant ? (
            <div className="glow-green mt-5 rounded-3xl border border-line bg-card-2 p-4">
              <p className="pixel-label muted">Honey reward</p>
              <p className="mt-2 text-xl font-semibold">
                {locale === "es"
                  ? rewardGrant.rewardDefinition.nameEs
                  : rewardGrant.rewardDefinition.nameEn}
              </p>
            </div>
          ) : null}
          <div className="mt-6">
            <SignOutForm />
          </div>
        </div>
      </section>
    </main>
  );
}
