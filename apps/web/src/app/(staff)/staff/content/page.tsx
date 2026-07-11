import { prisma } from "@honey/db";
import { requireStaffSession } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function StaffContentPage() {
  await requireStaffSession("STAFF");
  const definitions = await prisma.questionDefinition.findMany({
    orderBy: [{ category: "asc" }, { stableKey: "asc" }],
    include: {
      versions: {
        orderBy: [{ versionNumber: "desc" }],
        include: {
          approvedBy: true,
          createdBy: true,
          missionSlots: {
            select: {
              missionId: true,
            },
          },
        },
      },
    },
  });

  return (
    <main className="page-shell min-h-screen px-4 py-8">
      <section className="mx-auto max-w-5xl space-y-4">
        <div className="card p-6">
          <h1 className="text-3xl font-semibold">Contenido de preguntas</h1>
          <p className="mt-3 muted">
            Vista de solo lectura para personal. Solo administracion autorizada
            puede aprobar o retirar versiones.
          </p>
        </div>
        {definitions.map((definition) => (
          <article className="card p-5" key={definition.id}>
            <p className="text-sm uppercase tracking-[0.2em] muted">
              {definition.category}
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              {definition.stableKey}
            </h2>
            <div className="mt-4 space-y-3">
              {definition.versions.map((version) => (
                <div
                  className="rounded-2xl border border-line bg-white p-4"
                  key={version.id}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold">
                      Version {version.versionNumber}
                    </span>
                    <span className="rounded-full bg-[#f3ebe2] px-3 py-1 text-xs">
                      {version.legalReviewStatus}
                    </span>
                    <span className="text-xs muted">
                      Usada en {version.missionSlots.length} snapshots
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium">ES</p>
                  <p className="mt-1 text-sm muted">{version.promptEs}</p>
                  <p className="mt-3 text-sm font-medium">EN</p>
                  <p className="mt-1 text-sm muted">{version.promptEn}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
