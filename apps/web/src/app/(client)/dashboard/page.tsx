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
  const messages = getMessages(
    (session.locale === "en" ? "en" : "es") as "es" | "en",
  );
  const activeMission = await prisma.mission.findFirst({
    where: {
      clientId: session.actorId,
      state: "ACTIVE",
    },
  });

  return (
    <main className="page-shell min-h-screen px-4 py-6">
      <section className="mx-auto max-w-md space-y-4">
        <div className="card p-5">
          <div className="rounded-[28px] bg-[#e3c8ad] p-4">
            <Image
              src="/honey-source.png"
              alt="Honey on the client dashboard"
              width={800}
              height={800}
              className="mx-auto h-auto w-full rounded-[22px] object-cover"
              priority
            />
          </div>
          <h1 className="mt-5 text-3xl font-semibold">
            {messages.dashboardTitle}
          </h1>
          <p className="mt-3 text-base leading-7 muted">
            {messages.dashboardBody}
          </p>
        </div>
        <div className="card p-5">
          {query?.status === "daily-cap" ? (
            <p className="mb-4 rounded-2xl bg-[#f7efe7] px-4 py-3 text-sm muted">
              {messages.dailyCapReached}
            </p>
          ) : null}
          {activeMission ? (
            <Link
              className="button-primary block text-center"
              href={`/mission/${activeMission.id}`}
            >
              {messages.resumeMission}
            </Link>
          ) : (
            <div className="space-y-3">
              <Link
                className="button-primary block text-center"
                href="/api/client/missions/start?kind=quick"
              >
                {messages.quickMission}
              </Link>
              <Link
                className="button-secondary block text-center"
                href="/api/client/missions/start?kind=standard"
              >
                {messages.standardMission}
              </Link>
              <Link
                className="button-secondary block text-center"
                href="/api/client/missions/start?kind=full"
              >
                {messages.fullMission}
              </Link>
            </div>
          )}
        </div>
        <SignOutForm />
      </section>
    </main>
  );
}
