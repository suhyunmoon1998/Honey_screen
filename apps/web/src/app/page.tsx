import Link from "next/link";

export default function Home() {
  return (
    <main className="page-shell flex min-h-screen items-center justify-center px-4 py-10">
      <section className="card w-full max-w-xl p-6 sm:p-8">
        <h1 className="text-3xl font-semibold">Honey Case Adventure</h1>
        <p className="mt-3 text-base leading-7 muted">
          Demo routes for the approved Task 01 vertical slice.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            className="button-primary text-center"
            href="/invite/honey-demo-invite"
          >
            Abrir invitacion de cliente
          </Link>
          <Link className="button-secondary text-center" href="/staff/login">
            Entrar como personal
          </Link>
        </div>
      </section>
    </main>
  );
}
