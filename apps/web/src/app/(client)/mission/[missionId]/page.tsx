import { redirect } from "next/navigation";
import { getMessages } from "@honey/i18n";
import { AnswerForm } from "@/components/answer-form";
import { requireClientSession } from "@/lib/authz";
import { getMissionForClient } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function MissionPage({
  params,
}: {
  params: Promise<{ missionId: string }>;
}) {
  const session = await requireClientSession();
  const { missionId } = await params;
  const mission = await getMissionForClient(missionId, session.actorId);

  if (!mission) {
    redirect("/dashboard");
  }

  if (mission.state === "COMPLETED") {
    redirect("/reward");
  }

  const locale = (session.locale === "en" ? "en" : "es") as "es" | "en";
  const messages = getMessages(locale);
  const nextSlot = mission.slots.find(
    (slot: (typeof mission.slots)[number]) => slot.state !== "ANSWERED",
  );

  if (!nextSlot) {
    redirect("/reward");
  }

  return (
    <main className="page-shell min-h-screen px-4 py-8">
      <section className="card mx-auto max-w-md p-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] muted">
          {messages.missionProgress
            .replace("{current}", String(nextSlot.position))
            .replace("{total}", String(mission.requestedSize))}
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          {locale === "es"
            ? nextSlot.questionVersion.promptEs
            : nextSlot.questionVersion.promptEn}
        </h1>
        <p className="mt-3 text-base leading-7 muted">
          {messages.missionSaveBody}
        </p>
        <AnswerForm
          locale={locale}
          missionId={mission.id}
          missionSlotId={nextSlot.id}
        />
      </section>
    </main>
  );
}
