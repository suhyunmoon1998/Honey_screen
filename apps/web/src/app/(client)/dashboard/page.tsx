import Image from "next/image";
import Link from "next/link";
import { getMessages } from "@honey/i18n";
import { prisma } from "@honey/db";
import { SignOutForm } from "@/components/signout-form";
import { requireClientSession } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const session = await requireClientSession();
  const query = searchParams ? await searchParams : undefined;
  const locale = (session.locale === "en" ? "en" : "es") as "es" | "en";
  const messages = getMessages(locale);
  const activeMission = await prisma.mission.findFirst({
    where: {
      clientId: session.actorId,
      state: "ACTIVE",
    },
  });

  const missionChoices = [
    {
      href: "/api/client/missions/start?kind=quick",
      label: messages.quickMission,
      meta: "01",
      tone: "from-[#3ee8a8] via-[#22c98f] to-[#1c9d74]",
      accent: "bg-[#1a2f2a]",
    },
    {
      href: "/api/client/missions/start?kind=standard",
      label: messages.standardMission,
      meta: "02",
      tone: "from-[#c3aeff] via-[#a689ff] to-[#6a4fd6]",
      accent: "bg-[#241c3e]",
    },
    {
      href: "/api/client/missions/start?kind=full",
      label: messages.fullMission,
      meta: "03",
      tone: "from-[#a689ff] via-[#7c5cff] to-[#1c9d74]",
      accent: "bg-[#221b3a]",
    },
  ];

  return (
    <main className="page-shell min-h-screen px-4 py-6 sm:py-8">
      <section className="mx-auto max-w-md space-y-4">
        <div className="card overflow-hidden p-0">
          <div className="relative rounded-[24px] bg-[linear-gradient(145deg,#1c1433_0%,#3a2a66_48%,#1c9d74_100%)] p-5 text-[#ece7fb]">
            <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(166,137,255,0.32),transparent_70%)]" />
            <div className="relative rounded-[20px] border border-white/15 bg-black/25 px-4 py-3 backdrop-blur-sm">
              <p className="pixel-label text-white/70">
                {messages.dashboardHubLabel}
              </p>
              <h1 className="mt-2 text-2xl font-semibold">
                {messages.dashboardTitle}
              </h1>
            </div>

            <div className="relative mt-4 flex items-start gap-3">
              <div className="glow-purple h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-white/25 bg-[#150f28]">
                <Image
                  src="/honey-avatar.png"
                  alt="Honey"
                  width={128}
                  height={128}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>

              <div className="speech-bubble relative flex-1 rounded-[24px] border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                <p className="pixel-label text-[#c9b8ff]">
                  {messages.dashboardBriefLabel}
                </p>
                <p className="mt-3 text-sm leading-6 text-white/85">
                  {messages.dashboardBody}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-white/75">
                    {messages.dashboardMobileReady}
                  </div>
                  <div className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-white/75">
                    {messages.dashboardSafePace}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="pixel-label muted">
                {messages.dashboardConsoleLabel}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                {activeMission
                  ? messages.resumeMission
                  : messages.dashboardChooseRoute}
              </h2>
            </div>
            <div className="rounded-2xl border border-line bg-[#241c3e] px-3 py-2 text-right">
              <p className="pixel-label muted">
                {messages.dashboardDailyCapLabel}
              </p>
              <p className="mt-1 text-lg font-semibold text-[#3ee8a8]">10</p>
            </div>
          </div>

          {query?.status === "daily-cap" ? (
            <p className="mt-4 rounded-2xl border border-[#4a3b7a] bg-[#241c3e] px-4 py-3 text-sm text-[#c9b8ff]">
              {messages.dailyCapReached}
            </p>
          ) : null}

          {activeMission ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-[22px] border border-line bg-[linear-gradient(180deg,#241c3e_0%,#1d1733_100%)] p-4">
                <p className="pixel-label text-[#a689ff]">
                  {messages.dashboardActiveSlotLabel}
                </p>
                <p className="mt-2 text-sm leading-6 muted">
                  {messages.dashboardActiveSlotBody}
                </p>
              </div>
              <Link
                className="button-primary block text-center text-base"
                href={`/mission/${activeMission.id}`}
              >
                {messages.resumeMission}
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {missionChoices.map((choice) => (
                <Link
                  key={choice.href}
                  className={`block overflow-hidden rounded-[22px] border border-line ${choice.accent}`}
                  href={choice.href}
                >
                  <div
                    className={`flex items-center gap-3 bg-gradient-to-r ${choice.tone} px-4 py-3 text-[#0c0a1d]`}
                  >
                    <div className="pixel-label rounded-2xl border border-white/25 bg-black/20 px-3 py-2 text-[#f5f2ff]">
                      {choice.meta}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/60">
                        {messages.dashboardMissionSelectLabel}
                      </p>
                      <p className="text-base font-semibold">{choice.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <p className="text-sm leading-6 muted">
                      {messages.dashboardMissionCardBody}
                    </p>
                    <span
                      aria-hidden="true"
                      className="text-lg font-semibold text-[#3ee8a8]"
                    >
                      ›
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <Link
            className="button-secondary mt-4 block text-center"
            href="/settings/notifications"
          >
            {messages.notificationSettingsTitle}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="pixel-label muted">
              {messages.dashboardComfortLabel}
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {messages.dashboardComfortBody}
            </p>
          </div>
          <div className="card p-4">
            <p className="pixel-label muted">
              {messages.dashboardPrivacyLabel}
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {messages.dashboardPrivacyBody}
            </p>
          </div>
        </div>

        <div className="card p-5">
          <SignOutForm />
        </div>
      </section>
    </main>
  );
}
