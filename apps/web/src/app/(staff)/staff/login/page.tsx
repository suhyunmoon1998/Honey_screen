export const dynamic = "force-dynamic";

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const query = searchParams ? await searchParams : undefined;

  return (
    <main className="page-shell min-h-screen px-4 py-8">
      <section className="card mx-auto max-w-md p-6">
        <h1 className="text-3xl font-semibold">Ingreso del equipo</h1>
        {query?.status === "invalid" ? (
          <p className="mt-4 rounded-2xl border border-[#f05252]/40 bg-[#2f1a1a] px-4 py-3 text-sm text-[#f5b8b8]">
            Contrasena incorrecta. Intenta de nuevo.
          </p>
        ) : null}
        <form
          action="/api/staff/login"
          className="mt-6 space-y-4"
          method="post"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Contrasena</span>
            <input className="field" name="password" type="password" autoFocus />
          </label>
          <button className="button-primary w-full" type="submit">
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
