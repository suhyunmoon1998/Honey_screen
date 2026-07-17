import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@honey/db";
import { requireStaffSession } from "@/lib/authz";
import { translateToEnglish } from "@/lib/translate";

export const dynamic = "force-dynamic";

function formatAnswer(valueJson: unknown) {
  if (typeof valueJson === "boolean") {
    return valueJson ? "Yes" : "No";
  }

  return String(valueJson);
}

const CASE_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  UNDER_REVIEW: "Under review",
  QUALIFIED: "Qualified",
  NOT_QUALIFIED: "Not qualified",
  CALLED: "Called",
  CLOSED: "Closed",
};

const NOTE_TYPE_LABELS: Record<string, string> = {
  EVALUATION: "Evaluation",
  CALL_LOG: "Call log",
  GENERAL: "General",
};

export default async function StaffClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams?: Promise<{ status?: string }>;
}) {
  const session = await requireStaffSession("STAFF");
  const { clientId } = await params;
  const query = searchParams ? await searchParams : undefined;

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
      caseNotes: {
        orderBy: { createdAt: "desc" },
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

  const noteStaffIds = [...new Set(client.caseNotes.map((note) => note.staffId))];
  const noteStaff = noteStaffIds.length
    ? await prisma.staffUser.findMany({
        where: { id: { in: noteStaffIds } },
        select: { id: true, displayName: true },
      })
    : [];
  const staffNameById = new Map(noteStaff.map((staff) => [staff.id, staff.displayName]));

  const translatableAnswers =
    client.locale === "es"
      ? client.missions.flatMap((mission) =>
          mission.slots
            .filter(
              (slot) =>
                slot.questionVersion.answerType === "TEXT" &&
                typeof slot.answerRevisions[0]?.valueJson === "string",
            )
            .map((slot) => ({
              slotId: slot.id,
              text: slot.answerRevisions[0]!.valueJson as string,
            })),
        )
      : [];

  const translationEntries = await Promise.all(
    translatableAnswers.map(async ({ slotId, text }) => [
      slotId,
      await translateToEnglish(text),
    ] as const),
  );
  const translationBySlotId = new Map(translationEntries);

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
          &larr; Back to clients
        </Link>

        {query?.status === "update-failed" ? (
          <p className="rounded-2xl border border-[#f05252]/40 bg-[#2f1a1a] px-4 py-3 text-sm text-[#f5b8b8]">
            Could not update the case status.
          </p>
        ) : null}
        {query?.status === "note-failed" ? (
          <p className="rounded-2xl border border-[#f05252]/40 bg-[#2f1a1a] px-4 py-3 text-sm text-[#f5b8b8]">
            Could not save the note.
          </p>
        ) : null}

        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold">{client.phoneE164}</h1>
              <span className="rounded-full bg-[#ece7fb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#3a2a66]">
                {CASE_STATUS_LABELS[client.caseStatus] ?? client.caseStatus}
              </span>
              {client.legalHold ? (
                <span className="rounded-full bg-[#f3ebe2] px-3 py-1 text-xs uppercase tracking-[0.15em]">
                  Legal hold
                </span>
              ) : null}
              {client.deletedAt ? (
                <span className="rounded-full bg-[#f6dede] px-3 py-1 text-xs uppercase tracking-[0.15em] text-[#8a2b2b]">
                  Deleted
                </span>
              ) : null}
            </div>
            <a
              className="button-primary px-4 py-2 text-sm"
              href={`tel:${client.phoneE164}`}
            >
              Call
            </a>
          </div>

          <form
            action={`/api/staff/clients/${client.id}/case-status`}
            className="mt-4 flex flex-wrap items-end gap-3"
            method="post"
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Case status
              </span>
              <select
                className="field"
                defaultValue={client.caseStatus}
                name="caseStatus"
              >
                {Object.entries(CASE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="button-secondary" type="submit">
              Update status
            </button>
          </form>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="muted">Language</dt>
              <dd className="uppercase">{client.locale}</dd>
            </div>
            <div>
              <dt className="muted">Time zone</dt>
              <dd>{client.timeZone}</dd>
            </div>
            <div>
              <dt className="muted">Registered</dt>
              <dd>{client.createdAt.toISOString().slice(0, 10)}</dd>
            </div>
            <div>
              <dt className="muted">Retention class</dt>
              <dd>{client.retentionClass}</dd>
            </div>
          </dl>
          {client.honeyProfile ? (
            <p className="mt-4 text-sm muted">
              Honey progress: {client.honeyProfile.levelKey} (
              {client.honeyProfile.totalPoints} points)
            </p>
          ) : null}
        </div>

        {client.reviewFlags.length > 0 ? (
          <div className="card p-6">
            <h2 className="text-xl font-semibold">Review alerts</h2>
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

        <div className="card p-6">
          <h2 className="text-xl font-semibold">Evaluation and calls</h2>
          <form
            action={`/api/staff/clients/${client.id}/notes`}
            className="mt-4 space-y-3"
            method="post"
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Type</span>
              <select className="field" name="noteType">
                {Object.entries(NOTE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Note</span>
              <textarea
                className="field min-h-24"
                name="body"
                placeholder="Evaluation result or call outcome..."
                required
              />
            </label>
            <button className="button-primary" type="submit">
              Save note
            </button>
          </form>

          {client.caseNotes.length > 0 ? (
            <div className="mt-6 space-y-2">
              {client.caseNotes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-2xl border border-line bg-white p-4 text-sm text-[#1c1433]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-[#f3ebe2] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#6b6382]">
                      {NOTE_TYPE_LABELS[note.noteType] ?? note.noteType}
                    </span>
                    <span className="text-xs text-[#6b6382]">
                      {staffNameById.get(note.staffId) ?? note.staffId} &middot;{" "}
                      {note.createdAt.toISOString().slice(0, 16)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap">{note.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm muted">No notes yet.</p>
          )}
        </div>

        {client.missions.map((mission) => (
          <div className="card p-6" key={mission.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] muted">
                  {mission.kind} &middot; {mission.state}
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Mission created {mission.createdAt.toISOString().slice(0, 10)}
                </h2>
              </div>
              <span className="muted text-sm">
                {mission.slots.filter((slot) => slot.state === "ANSWERED").length}/
                {mission.requestedSize} answered
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {mission.slots.map((slot) => {
                const latestAnswer = slot.answerRevisions[0];
                const translation = translationBySlotId.get(slot.id);

                return (
                  <div
                    key={slot.id}
                    className="rounded-2xl border border-line bg-white p-4 text-[#1c1433]"
                  >
                    <p className="text-xs uppercase tracking-[0.15em] text-[#6b6382]">
                      {slot.questionDefinition.category}
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {slot.questionVersion.promptEn}
                    </p>
                    {latestAnswer ? (
                      <>
                        <p className="mt-2 text-sm">
                          <span className="font-semibold">Answer:</span>{" "}
                          {formatAnswer(latestAnswer.valueJson)}
                          <span className="text-[#6b6382]">
                            {" "}
                            &middot;{" "}
                            {latestAnswer.createdAt.toISOString().slice(0, 16)}
                          </span>
                        </p>
                        {translation ? (
                          <p className="mt-1 text-sm text-[#6b6382]">
                            <span className="font-semibold">
                              Translation (EN):
                            </span>{" "}
                            {translation}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-[#6b6382]">
                        Not answered
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
