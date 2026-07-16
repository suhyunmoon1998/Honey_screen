import Image from "next/image";
import { redirect } from "next/navigation";
import { getMessages } from "@honey/i18n";
import { AnswerForm } from "@/components/answer-form";
import { LocaleSwitch } from "@/components/locale-switch";
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

  const total = mission.requestedSize;
  const answeredCount = mission.slots.filter(
    (slot: (typeof mission.slots)[number]) => slot.state === "ANSWERED",
  ).length;
  const progressLabel = messages.missionProgress
    .replace("{current}", String(nextSlot.position))
    .replace("{total}", String(total));

  return (
    <main className="page-shell min-h-screen px-4 py-8">
      <section className="mx-auto max-w-md space-y-4">
        <div className="flex justify-end">
          <LocaleSwitch
            currentLocale={locale}
            redirectTo={`/mission/${mission.id}`}
            label={messages.switchLanguage}
          />
        </div>
        <div className="card overflow-hidden p-0">
          <div className="relative rounded-[24px] bg-[linear-gradient(145deg,#1c1433_0%,#3a2a66_48%,#1c9d74_100%)] p-5 text-[#ece7fb]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="glow-purple h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/20 bg-[#150f28]">
                  <Image
                    src="/honey-avatar.png"
                    alt="Honey"
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="pixel-label text-white/70">
                  {messages.dashboardConsoleLabel}
                </p>
              </div>
              <div className="shrink-0 rounded-full border border-[#3ee8a8]/50 bg-[#3ee8a8]/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#a9f5d6]">
                {progressLabel}
              </div>
            </div>
            <div
              className="mission-pips mt-4"
              role="img"
              aria-label={progressLabel}
            >
              {Array.from({ length: total }).map((_, index) => {
                const state =
                  index < answeredCount
                    ? "done"
                    : index === answeredCount
                      ? "active"
                      : "upcoming";
                return (
                  <span key={index} className="mission-pip" data-state={state} />
                );
              })}
            </div>
          </div>
        </div>

        <div className="card p-6">
          <p className="pixel-label muted">{messages.missionQuestionLabel}</p>
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
        </div>
      </section>
    </main>
  );
}
