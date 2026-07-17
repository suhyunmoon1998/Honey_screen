export const dynamic = "force-dynamic";

export default function StaffLoginPage() {
  return (
    <main className="page-shell min-h-screen px-4 py-8">
      <section className="card mx-auto max-w-md p-6">
        <h1 className="text-3xl font-semibold">Ingreso del equipo</h1>
        <p className="mt-3 text-base leading-7 muted">
          Adaptador de desarrollo solamente. Nunca debe habilitarse en
          produccion.
        </p>
        <form
          action="/api/staff/login"
          className="mt-6 space-y-4"
          method="post"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Correo</span>
            <input
              className="field"
              defaultValue="staff.fictional@jacklaw.example"
              name="email"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Contrasena</span>
            <input
              className="field"
              defaultValue="jacklaw123"
              name="password"
              type="password"
            />
          </label>
          <button className="button-primary w-full" type="submit">
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
