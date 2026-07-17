import Image from "next/image";
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
        <div className="card overflow-hidden p-0 mb-4">
          <div className="relative rounded-[24px] bg-[linear-gradient(145deg,#1c1433_0%,#3a2a66_48%,#1c9d74_100%)] p-6 text-center text-[#ece7fb]">
            <p className="pixel-label text-white/70">
              {messages.dashboardConsoleLabel}
            </p>
            <div className="relative mx-auto mt-4 h-36 w-36">
              <Image
                src="/boss-goblin.png"
                alt=""
                fill
                className="victory-boss-defeat object-contain"
              />
            </div>
            <p className="victory-text mt-2 text-2xl font-black uppercase tracking-wide">
              {messages.missionVictoryTitle}
            </p>
          </div>
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
