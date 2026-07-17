import Image from "next/image";
import Link from "next/link";
import { StartForm } from "@/components/start-form";
import { resolveLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const query = await searchParams;
  const locale = resolveLocale(query.lang);

  return (
    <main className="page-shell flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <Link
            className="button-secondary text-sm"
            href={`/?lang=${locale === "es" ? "en" : "es"}`}
          >
            {locale === "es" ? "English" : "Español"}
          </Link>
        </div>
        <div className="card overflow-hidden p-6">
          <Image
            src="/honey-source.png"
            alt="Honey"
            width={800}
            height={800}
            className="honey-float-hero mx-auto h-auto w-full drop-shadow-[0_18px_28px_rgba(166,137,255,0.45)]"
            priority
          />
          <h1 className="mt-6 text-3xl font-semibold">
            {locale === "es"
              ? "Explora tu mision con Honey"
              : "Start your mission with Honey"}
          </h1>
          <p className="mt-3 text-base leading-7 muted">
            {locale === "es"
              ? "Ingresa tu numero y te enviamos el enlace por mensaje de texto para continuar en tu telefono."
              : "Enter your number and we will text you the link to continue on your phone."}
          </p>
          <StartForm locale={locale} />
        </div>
      </section>
    </main>
  );
}
