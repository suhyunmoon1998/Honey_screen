import { prisma } from "@honey/db";
import { requireStaffSession } from "@/lib/authz";

export const dynamic = "force-dynamic";

function canonicalJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function canonicalOptions(
  options: Array<{
    optionKey: string;
    value: string;
    labelEs: string;
    labelEn: string;
    displayOrder: number;
  }>,
) {
  if (options.length === 0) {
    return "(none)";
  }

  return options
    .map(
      (option) =>
        `[${option.displayOrder}] ${option.optionKey} = ${option.value}\nES: ${option.labelEs}\nEN: ${option.labelEn}`,
    )
    .join("\n\n");
}

function canonicalBranchRules(
  rules: Array<{
    targetDefinitionKey: string;
    priority: number;
    ruleJson: unknown;
  }>,
) {
  if (rules.length === 0) {
    return "(none)";
  }

  return rules
    .map(
      (rule) =>
        `target=${rule.targetDefinitionKey}; priority=${rule.priority}\n${canonicalJson(rule.ruleJson)}`,
    )
    .join("\n\n");
}

function canonicalReviewRules(
  rules: Array<{
    flagType: string;
    ruleJson: unknown;
  }>,
) {
  if (rules.length === 0) {
    return "(none)";
  }

  return rules
    .map((rule) => `flag=${rule.flagType}\n${canonicalJson(rule.ruleJson)}`)
    .join("\n\n");
}

function getDiffState(left: string, right: string) {
  if (!left && right) {
    return "ADDED";
  }

  if (left && !right) {
    return "REMOVED";
  }

  if (left !== right) {
    return "CHANGED";
  }

  return "SAME";
}

function DiffRow({
  label,
  approved,
  draft,
}: {
  label: string;
  approved: string;
  draft: string;
}) {
  const state = getDiffState(approved, draft);

  return (
    <div className="rounded-2xl border border-line bg-white p-4 text-[#1c1433]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-[#6b6382]">
          {state}
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b6382]">
            Approved
          </p>
          <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-[#f8f3ee] p-3 text-xs leading-6 text-[#46352d]">
            {approved || "(empty)"}
          </pre>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b6382]">
            Draft
          </p>
          <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-[#fffaf4] p-3 text-xs leading-6 text-[#46352d]">
            {draft || "(empty)"}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default async function AdminPage() {
  await requireStaffSession("ADMIN");
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
          options: {
            orderBy: { displayOrder: "asc" },
          },
          branchRules: {
            orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
          },
          reviewFlagRules: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  return (
    <main className="page-shell min-h-screen px-4 py-8">
      <section className="mx-auto max-w-6xl space-y-4">
        <div className="card p-6">
          <h1 className="text-3xl font-semibold">
            Administracion de contenido
          </h1>
          <p className="mt-3 muted">
            Crear borradores, comparar cambios de solo lectura frente a la
            version aprobada, aprobar versiones validas y retirar versiones
            activas.
          </p>
        </div>
        {definitions.map((definition) => {
          const approved = definition.versions.find(
            (version) => version.legalReviewStatus === "APPROVED",
          );
          const drafts = definition.versions.filter(
            (version) => version.legalReviewStatus === "DRAFT",
          );

          return (
            <article className="card p-5" key={definition.id}>
              <p className="text-sm uppercase tracking-[0.2em] muted">
                {definition.category}
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                {definition.stableKey}
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-line bg-white p-4 text-[#1c1433]">
                  <p className="text-sm font-semibold">Version aprobada</p>
                  {approved ? (
                    <>
                      <p className="mt-3 text-sm font-medium">ES</p>
                      <p className="mt-1 text-sm text-[#6b6382]">
                        {approved.promptEs}
                      </p>
                      <p className="mt-3 text-sm font-medium">EN</p>
                      <p className="mt-1 text-sm text-[#6b6382]">
                        {approved.promptEn}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-[#6b6382]">
                      Todavia no hay version aprobada.
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-line bg-white p-4 text-[#1c1433]">
                  <p className="text-sm font-semibold">Crear version DRAFT</p>
                  <form
                    action="/api/staff/questions/draft"
                    className="mt-3 space-y-3"
                    method="post"
                  >
                    <input
                      name="definitionId"
                      type="hidden"
                      value={definition.id}
                    />
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium">ES</span>
                      <textarea
                        className="field min-h-28"
                        defaultValue={approved?.promptEs ?? ""}
                        name="promptEs"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium">EN</span>
                      <textarea
                        className="field min-h-28"
                        defaultValue={approved?.promptEn ?? ""}
                        name="promptEn"
                      />
                    </label>
                    <button className="button-primary" type="submit">
                      Crear DRAFT
                    </button>
                  </form>
                </div>
              </div>
              <div className="mt-5 space-y-5">
                {drafts.map((draft) => (
                  <div
                    className="rounded-3xl border border-line bg-[#fcf8f4] p-4 text-[#1c1433]"
                    key={draft.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          DRAFT v{draft.versionNumber}
                        </p>
                        <p className="text-xs text-[#6b6382]">
                          Usada en {draft.missionSlots.length} snapshots
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <form
                          action="/api/staff/questions/approve"
                          method="post"
                        >
                          <input
                            name="versionId"
                            type="hidden"
                            value={draft.id}
                          />
                          <button className="button-primary" type="submit">
                            Aprobar
                          </button>
                        </form>
                        <form
                          action="/api/staff/questions/retire"
                          method="post"
                        >
                          <input
                            name="versionId"
                            type="hidden"
                            value={draft.id}
                          />
                          <button className="button-secondary" type="submit">
                            Retirar
                          </button>
                        </form>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      <DiffRow
                        label="Spanish text"
                        approved={approved?.promptEs ?? ""}
                        draft={draft.promptEs}
                      />
                      <DiffRow
                        label="English text"
                        approved={approved?.promptEn ?? ""}
                        draft={draft.promptEn}
                      />
                      <DiffRow
                        label="Answer type"
                        approved={approved?.answerType ?? ""}
                        draft={draft.answerType}
                      />
                      <DiffRow
                        label="Category"
                        approved={approved?.category ?? ""}
                        draft={draft.category}
                      />
                      <DiffRow
                        label="Priority"
                        approved={String(approved?.priority ?? "")}
                        draft={String(draft.priority)}
                      />
                      <DiffRow
                        label="Emotional weight"
                        approved={String(approved?.emotionalWeight ?? "")}
                        draft={String(draft.emotionalWeight)}
                      />
                      <DiffRow
                        label="Estimated effort"
                        approved={String(approved?.estimatedEffort ?? "")}
                        draft={String(draft.estimatedEffort)}
                      />
                      <DiffRow
                        label="Options"
                        approved={canonicalOptions(approved?.options ?? [])}
                        draft={canonicalOptions(draft.options)}
                      />
                      <DiffRow
                        label="Branch rules"
                        approved={canonicalBranchRules(
                          approved?.branchRules ?? [],
                        )}
                        draft={canonicalBranchRules(draft.branchRules)}
                      />
                      <DiffRow
                        label="Review-flag rules"
                        approved={canonicalReviewRules(
                          approved?.reviewFlagRules ?? [],
                        )}
                        draft={canonicalReviewRules(draft.reviewFlagRules)}
                      />
                    </div>
                  </div>
                ))}
                {definition.versions
                  .filter((version) => version.legalReviewStatus !== "DRAFT")
                  .map((version) => (
                    <div
                      className="rounded-2xl border border-line bg-white p-4 text-[#1c1433]"
                      key={version.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            Version {version.versionNumber}
                          </p>
                          <p className="text-xs text-[#6b6382]">
                            Estado {version.legalReviewStatus}. Usada en{" "}
                            {version.missionSlots.length} snapshots.
                          </p>
                        </div>
                        {version.legalReviewStatus === "APPROVED" ? (
                          <form
                            action="/api/staff/questions/retire"
                            method="post"
                          >
                            <input
                              name="versionId"
                              type="hidden"
                              value={version.id}
                            />
                            <button className="button-secondary" type="submit">
                              Retirar aprobada
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  ))}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
