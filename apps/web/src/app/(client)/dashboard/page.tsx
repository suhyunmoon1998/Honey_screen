import Image from "next/image";
import Link from "next/link";
import { getMessages } from "@honey/i18n";
import { prisma } from "@honey/db";
import { HONEY_LEVELS } from "@honey/domain";
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
  const [activeMission, honeyProfile] = await Promise.all([
    prisma.mission.findFirst({
      where: {
        clientId: session.actorId,
        state: "ACTIVE",
      },
    }),
    prisma.honeyProfile.findUnique({
      where: { clientId: session.actorId },
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
      hits: 10,
      tone: "from-[#a689ff] via-[#7c5cff] to-[#1c9d74]",
    },
  ];

  return (
    <main className="page-shell min-h-screen px-4 py-6 sm:py-8">
      <section className="mx-auto max-w-md space-y-5">
        <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(160deg,#1c1433_0%,#3a2a66_45%,#1c9d74_120%)] p-5 pb-0 text-[#ece7fb]">
          <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(166,137,255,0.32),transparent_70%)]" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="pixel-label text-white/70">
                {messages.dashboardHubLabel}
              </p>
              <h1 className="mt-2 text-2xl font-semibold">
                {messages.dashboardTitle}
              </h1>
            </div>
            <div className="pixel-label shrink-0 rounded-full bg-black/30 px-3 py-1.5 text-[#ffd166]">
              NV.{levelNumber}
            </div>
          </div>
          <p className="relative mt-1 text-xs text-[#c9b8ff]">{levelTitle}</p>

          <div className="relative mt-4 flex items-end gap-3">
            <div className="honey-float glow-purple h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-white/25 bg-[#150f28]">
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
            </div>
          </div>

          {!activeMission ? (
            <div className="relative mt-5 flex items-center gap-3 rounded-t-[20px] bg-black/30 px-5 py-3 -mx-5">
              <div className="boss-peek h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-[#f05252]/70 bg-[#150f28]">
                <Image
                  src="/boss-goblin-face.png"
                  alt=""
                  width={88}
                  height={88}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="pixel-label text-[#ff9d9d]">
                  {messages.dashboardBossTeaserLabel}
                </p>
                <p className="mt-1 text-sm font-semibold text-white/90">
                  {messages.dashboardBossTeaserBody}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-5" />
          )}
        </div>

        <div className="space-y-3">
          {query?.status === "daily-cap" ? (
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
          ) : (
            missionChoices.map((choice) => (
              <Link
                key={choice.href}
                className={`block overflow-hidden rounded-[22px] bg-gradient-to-r ${choice.tone} px-4 py-3 text-[#0c0a1d] shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition-transform active:scale-[0.98]`}
                href={choice.href}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/60">
                      {choice.hits} {messages.dashboardHitsLabel}
                    </p>
                    <p className="text-base font-semibold">{choice.label}</p>
                  </div>
                  <span aria-hidden="true" className="text-xl font-semibold">
                    ›
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-1 text-sm">
          <Link className="muted" href="/settings/notifications">
            {messages.notificationSettingsTitle}
          </Link>
          <div className="w-32">
            <SignOutForm />
          </div>
        </div>
      </section>
    </main>
  );
}
