import Image from "next/image";
import Link from "next/link";
import { getMessages } from "@honey/i18n";
import { prisma } from "@honey/db";
import { HONEY_LEVELS } from "@honey/domain";
import { GameConsoleNav } from "@/components/game-console-nav";
import { LocaleSwitch } from "@/components/locale-switch";
import { SignOutForm } from "@/components/signout-form";
import { requireClientSession } from "@/lib/authz";
import { getDashboardMissionStatus } from "@/lib/services";

export const dynamic = "force-dynamic";

const JACK_PHONE_E164 = "+18665225529";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const session = await requireClientSession();
  const query = searchParams ? await searchParams : undefined;
  const locale = (session.locale === "en" ? "en" : "es") as "es" | "en";
  const messages = getMessages(locale);
  const [activeMission, honeyProfile, missionStatus] = await Promise.all([
    prisma.mission.findFirst({
      where: {
        clientId: session.actorId,
        state: "ACTIVE",
      },
    }),
    prisma.honeyProfile.findUnique({
      where: { clientId: session.actorId },
    }),
    getDashboardMissionStatus({
      clientId: session.actorId,
      organizationId: session.organizationId,
    }),
  ]);

  const levelNumber = honeyProfile?.levelNumber ?? 1;
  const level =
    HONEY_LEVELS.find((entry) => entry.levelNumber === levelNumber) ??
    HONEY_LEVELS[0];
  const levelTitle = locale === "es" ? level.titleEs : level.titleEn;

  const missionChoices = [
    {
      href: "/api/client/missions/start?kind=quick",
      label: messages.quickMission,
      hits: 3,
      tone: "from-[#3ee8a8] via-[#22c98f] to-[#1c9d74]",
    },
    {
      href: "/api/client/missions/start?kind=standard",
      label: messages.standardMission,
      hits: 5,
      tone: "from-[#c3aeff] via-[#a689ff] to-[#6a4fd6]",
    },
    {
      href: "/api/client/missions/start?kind=full",
      label: messages.fullMission,
      hits: 12,
      tone: "from-[#a689ff] via-[#7c5cff] to-[#1c9d74]",
    },
  ];

  const isAllCaughtUp = !activeMission && !missionStatus.hasUnansweredQuestions;

  return (
    <main className="page-shell min-h-screen px-4 py-6 sm:py-8">
      <GameConsoleNav
        currentLocale={locale}
        currentPath="/dashboard"
        levelNumber={levelNumber}
        levelTitle={levelTitle}
        homeLabel={messages.navHomeLabel}
        rewardLabel={messages.navRewardLabel}
        remindersLabel={messages.navRemindersLabel}
        menuLabel={messages.navMenuLabel}
        openLabel={messages.navOpenLabel}
        closeLabel={messages.navCloseLabel}
        powerLabel={messages.navPowerLabel}
        switchLanguageLabel={messages.switchLanguage}
      />
      <section className="mx-auto max-w-md space-y-3">
        <div className="flex justify-end">
          <LocaleSwitch
            currentLocale={locale}
            redirectTo="/dashboard"
            label={messages.switchLanguage}
          />
        </div>
        <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(160deg,#1c1433_0%,#3a2a66_45%,#1c9d74_120%)] p-4 pb-0 text-[#ece7fb]">
          <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(166,137,255,0.32),transparent_70%)]" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="pixel-label text-white/70">
                {messages.dashboardHubLabel}
              </p>
              <h1 className="mt-1 text-xl font-semibold leading-tight">
                {messages.dashboardTitle}
              </h1>
            </div>
            <div className="pixel-label shrink-0 rounded-full bg-black/30 px-3 py-1.5 text-[#ffd166]">
              NV.{levelNumber}
            </div>
          </div>
          <p className="relative mt-1 text-xs text-[#c9b8ff]">{levelTitle}</p>

          <div className="relative mt-3 flex items-center gap-3">
            <div className="honey-float glow-purple h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/25 bg-[#150f28]">
              <Image
                src="/honey-avatar.png"
                alt="Honey"
                width={128}
                height={128}
                className="h-full w-full object-cover"
                priority
              />
            </div>

            <div className="speech-bubble relative flex-1 rounded-[20px] border border-white/12 bg-white/8 px-3 py-2 backdrop-blur-sm">
              <p className="text-sm leading-5 text-white/85">
                {messages.dashboardBody}
              </p>
            </div>
          </div>

          {!activeMission ? (
            <div className="relative mt-3 flex items-center gap-2 rounded-t-[16px] bg-black/30 px-4 py-2 -mx-4">
              <div className="boss-peek h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-[#f05252]/70 bg-[#150f28]">
                <Image
                  src="/boss-goblin-face.png"
                  alt=""
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="text-xs font-semibold text-[#ff9d9d]">
                {messages.dashboardBossTeaserLabel}
              </p>
            </div>
          ) : (
            <div className="h-2" />
          )}
        </div>

        <div className="flex items-center justify-between px-1 text-xs">
          <span className="pixel-label muted">
            {messages.dashboardProgressLabel}
          </span>
          <span className="font-semibold text-[#c9b8ff]">
            {missionStatus.answeredCount}/{missionStatus.totalCount}{" "}
            {messages.dashboardHitsLabel}
          </span>
        </div>

        <div className="space-y-2">
          {query?.status === "daily-cap" && !isAllCaughtUp ? (
            <p className="rounded-2xl border border-[#4a3b7a] bg-[#241c3e] px-4 py-3 text-sm text-[#c9b8ff]">
              {messages.dailyCapReached}
            </p>
          ) : null}

          {activeMission ? (
            <>
              <Link
                className="button-primary block text-center text-base"
                href={`/mission/${activeMission.id}`}
              >
                {messages.resumeMission}
              </Link>
              <p className="px-1 text-center text-sm muted">
                {messages.dashboardActiveSlotBody}
              </p>
            </>
          ) : isAllCaughtUp ? (
            <div className="rounded-[20px] border border-[#2f5f4c] bg-[#152a22] px-4 py-3 text-center">
              <p className="text-base font-semibold text-[#a9f5d6]">
                {messages.dashboardAllDoneTitle}
              </p>
              <p className="mt-1 text-xs text-[#8fd9bb]">
                {messages.dashboardAllDoneBody}
              </p>
            </div>
          ) : (
            missionChoices.map((choice) => (
              <Link
                key={choice.href}
                className={`block overflow-hidden rounded-[18px] bg-gradient-to-r ${choice.tone} px-4 py-2.5 text-[#0c0a1d] shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition-transform active:scale-[0.98]`}
                href={choice.href}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/60">
                      {choice.hits} {messages.dashboardHitsLabel}
                    </p>
                    <p className="text-sm font-semibold">{choice.label}</p>
                  </div>
                  <span aria-hidden="true" className="text-xl font-semibold">
                    ›
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="flex items-center gap-2">
          <a
            className="button-secondary flex flex-1 items-center justify-center gap-1.5 text-center text-sm"
            href={`tel:${JACK_PHONE_E164}`}
          >
            <span aria-hidden="true">📞</span>
            {messages.callJackLabel}
          </a>
          <div className="flex-1">
            <SignOutForm />
          </div>
        </div>
      </section>
    </main>
  );
}
