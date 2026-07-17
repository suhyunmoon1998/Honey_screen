import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@honey/db";
import { requireStaffSession } from "@/lib/authz";

export const dynamic = "force-dynamic";

function formatAnswer(valueJson: unknown) {
  if (typeof valueJson === "boolean") {
    return valueJson ? "Si" : "No";
  }

  return String(valueJson);
}

export default async function StaffClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const session = await requireStaffSession("STAFF");
  const { clientId } = await params;

  // Scoped to the staff member's own organization — never trust a
  // client-supplied organization id. See docs/RISK_REGISTER.md R2.
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: session.organizationId },
    include: {
      honeyProfile: true,
      reviewFlags: {
        orderBy: { createdAt: "desc" },
      },
      consents: {
        orderBy: { createdAt: "desc" },
      },
      rewardGrants: {
        include: { rewardDefinition: true },
      },
      missions: {
        orderBy: { createdAt: "desc" },
        include: {
          slots: {
            orderBy: { position: "asc" },
            include: {
              questionVersion: true,
              questionDefinition: true,
              answerRevisions: {
                orderBy: { revisionNumber: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!client) {
    notFound();
  }

  await prisma.auditEvent.create({
    data: {
      organizationId: session.organizationId,
      actorType: "STAFF",
      actorId: session.actorId,
      action: "CLIENT_DETAIL_VIEWED",
      targetType: "CLIENT",
      targetId: client.id,
      metadataJson: {},
    },
  });

  return (
    <main className="page-shell min-h-screen px-4 py-8">
      <section className="mx-auto max-w-5xl space-y-4">
        <Link className="text-sm muted" href="/staff/clients">
          &larr; Volver a clientes
        </Link>

        <div className="card p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold">{client.phoneE164}</h1>
            {client.legalHold ? (
              <span className="rounded-full bg-[#f3ebe2] px-3 py-1 text-xs uppercase tracking-[0.15em]">
                Retencion legal
              </span>
            ) : null}
            {client.deletedAt ? (
              <span className="rounded-full bg-[#f6dede] px-3 py-1 text-xs uppercase tracking-[0.15em] text-[#8a2b2b]">
                Eliminado
              </span>
            ) : null}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="muted">Idioma</dt>
              <dd className="uppercase">{client.locale}</dd>
            </div>
            <div>
              <dt className="muted">Zona horaria</dt>
              <dd>{client.timeZone}</dd>
            </div>
            <div>
              <dt className="muted">Registrado</dt>
              <dd>{client.createdAt.toISOString().slice(0, 10)}</dd>
            </div>
            <div>
              <dt className="muted">Clase de retencion</dt>
              <dd>{client.retentionClass}</dd>
            </div>
          </dl>
          {client.honeyProfile ? (
            <p className="mt-4 text-sm muted">
              Progreso Honey: {client.honeyProfile.levelKey} (
              {client.honeyProfile.totalPoints} puntos)
            </p>
          ) : null}
        </div>

        {client.reviewFlags.length > 0 ? (
          <div className="card p-6">
            <h2 className="text-xl font-semibold">Alertas de revision</h2>
            <div className="mt-3 space-y-2">
              {client.reviewFlags.map((flag) => (
                <div
                  key={flag.id}
                  className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-sm text-[#1c1433]"
                >
                  <span className="font-medium">{flag.flagType}</span>
                  <span className="rounded-full bg-[#f3ebe2] px-3 py-1 text-xs uppercase tracking-[0.15em] text-[#6b6382]">
                    {flag.state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {client.missions.map((mission) => (
          <div className="card p-6" key={mission.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] muted">
                  {mission.kind} &middot; {mission.state}
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Mision creada {mission.createdAt.toISOString().slice(0, 10)}
                </h2>
              </div>
              <span className="muted text-sm">
                {mission.slots.filter((slot) => slot.state === "ANSWERED").length}/
                {mission.requestedSize} respondidas
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {mission.slots.map((slot) => {
                const latestAnswer = slot.answerRevisions[0];

                return (
                  <div
                    key={slot.id}
                    className="rounded-2xl border border-line bg-white p-4 text-[#1c1433]"
                  >
                    <p className="text-xs uppercase tracking-[0.15em] text-[#6b6382]">
                      {slot.questionDefinition.category}
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {slot.questionVersion.promptEs}
                    </p>
                    {latestAnswer ? (
                      <p className="mt-2 text-sm">
                        <span className="font-semibold">Respuesta:</span>{" "}
                        {formatAnswer(latestAnswer.valueJson)}
                        <span className="text-[#6b6382]">
                          {" "}
                          &middot;{" "}
                          {latestAnswer.createdAt.toISOString().slice(0, 16)}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-[#6b6382]">
                        Sin responder
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
