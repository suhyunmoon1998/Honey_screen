import Link from "next/link";
import { prisma } from "@honey/db";
import { requireStaffSession } from "@/lib/authz";

export const dynamic = "force-dynamic";

const STATUS_MESSAGES: Record<string, { text: string; tone: "ok" | "error" }> = {
  "invite-sent": {
    text: "Invitacion enviada por SMS.",
    tone: "ok",
  },
  "invite-failed": {
    text: "No se pudo enviar el SMS. Revisa la configuracion de Twilio o intenta de nuevo.",
    tone: "error",
  },
  "invite-invalid": {
    text: "Numero de telefono invalido.",
    tone: "error",
  },
};

export default async function StaffClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const session = await requireStaffSession("STAFF");
  const query = searchParams ? await searchParams : undefined;
  const statusMessage = query?.status ? STATUS_MESSAGES[query.status] : null;

  const clients = await prisma.client.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      missions: {
        select: { state: true },
      },
      reviewFlags: {
        where: { state: "OPEN" },
        select: { id: true },
      },
      honeyProfile: {
        select: { levelKey: true, totalPoints: true },
      },
    },
  });

  return (
    <main className="page-shell min-h-screen px-4 py-8">
      <section className="mx-auto max-w-5xl space-y-4">
        <div className="card p-6">
          <h1 className="text-3xl font-semibold">Clientes</h1>
          <p className="mt-3 muted">
            {clients.length} cliente(s) en esta organizacion.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold">Invitar cliente nuevo</h2>
          <p className="mt-2 text-sm muted">
            Crea una invitacion real y envia el enlace por SMS al numero
            indicado.
          </p>
          {statusMessage ? (
            <p
              className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
                statusMessage.tone === "ok"
                  ? "border-[#3ee8a8]/40 bg-[#1a2f2a] text-[#a9f5d6]"
                  : "border-[#f05252]/40 bg-[#2f1a1a] text-[#f5b8b8]"
              }`}
            >
              {statusMessage.text}
            </p>
          ) : null}
          <form
            action="/api/staff/invitations"
            className="mt-4 flex flex-wrap items-end gap-3"
            method="post"
          >
            <label className="block flex-1 min-w-[200px]">
              <span className="mb-1 block text-sm font-medium">
                Numero de telefono
              </span>
              <input
                className="field"
                name="rawPhone"
                placeholder="+1 555 555 0101"
                type="tel"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Idioma</span>
              <select className="field" name="locale">
                <option value="es">Espanol</option>
                <option value="en">English</option>
              </select>
            </label>
            <button className="button-primary" type="submit">
              Enviar invitacion
            </button>
          </form>
        </div>

        <div className="card overflow-hidden p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-white/60 text-left text-[#1c1433]">
                <th className="px-4 py-3 font-semibold">Telefono</th>
                <th className="px-4 py-3 font-semibold">Idioma</th>
                <th className="px-4 py-3 font-semibold">Registrado</th>
                <th className="px-4 py-3 font-semibold">Mision activa</th>
                <th className="px-4 py-3 font-semibold">Alertas abiertas</th>
                <th className="px-4 py-3 font-semibold">Nivel Honey</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const hasActiveMission = client.missions.some(
                  (mission) => mission.state === "ACTIVE",
                );
                const openFlagCount = client.reviewFlags.length;

                return (
                  <tr
                    key={client.id}
                    className="border-b border-line bg-white text-[#1c1433]"
                  >
                    <td className="px-4 py-3 font-medium">
                      {client.phoneE164}
                      {client.legalHold ? (
                        <span className="ml-2 rounded-full bg-[#f3ebe2] px-2 py-0.5 text-xs uppercase tracking-[0.15em]">
                          Retencion legal
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 uppercase text-[#6b6382]">
                      {client.locale}
                    </td>
                    <td className="px-4 py-3 text-[#6b6382]">
                      {client.createdAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      {hasActiveMission ? "Si" : "No"}
                    </td>
                    <td className="px-4 py-3">
                      {openFlagCount > 0 ? (
                        <span className="rounded-full bg-[#f6dede] px-2 py-1 text-xs font-semibold text-[#8a2b2b]">
                          {openFlagCount}
                        </span>
                      ) : (
                        <span className="text-[#6b6382]">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#6b6382]">
                      {client.honeyProfile
                        ? `${client.honeyProfile.levelKey} (${client.honeyProfile.totalPoints})`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="button-secondary inline-block px-3 py-1.5 text-xs"
                        href={`/staff/clients/${client.id}`}
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
