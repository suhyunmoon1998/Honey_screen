import { prisma } from "@honey/db";
import { getMessages } from "@honey/i18n";
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
      <section className="card mx-auto max-w-md p-6">
        <h1 className="text-3xl font-semibold">{messages.completeMission}</h1>
        <p className="mt-4 text-base leading-7 muted">{messages.rewardTitle}</p>
        {rewardGrant ? (
          <div className="mt-5 rounded-3xl border border-line bg-white p-4">
            <p className="text-sm uppercase tracking-[0.2em] muted">
              Honey reward
            </p>
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
      </section>
    </main>
  );
}
