import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMessages } from "@honey/i18n";
import { InvitationFlow } from "@/components/invitation-flow";
import { resolveLocale } from "@/lib/locale";
import { getInvitationPreview } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const invitation = await getInvitationPreview(token);

  if (!invitation) {
    notFound();
  }

  const locale = resolveLocale(query.lang ?? invitation.locale);
  const messages = getMessages(locale);

  return (
    <main className="page-shell min-h-screen px-4 py-6">
      <section className="mx-auto max-w-md">
        <div className="mb-4 flex justify-end">
          <Link
            className="button-secondary text-sm"
            href={`/invite/${token}?lang=${locale === "es" ? "en" : "es"}`}
          >
            {messages.switchLanguage}
          </Link>
        </div>
        <div className="card overflow-hidden p-6">
          <div className="rounded-[28px] bg-[#f2ddc7] p-4">
            <Image
              src="/honey-source.png"
              alt="Honey, a friendly dog guide for the mission"
              width={800}
              height={800}
              className="mx-auto h-auto w-full rounded-[22px] object-cover"
              priority
            />
          </div>
          <h1 className="mt-6 text-3xl font-semibold">
            {messages.inviteTitle}
          </h1>
          <p className="mt-3 text-base leading-7 muted">
            {messages.inviteBody}
          </p>
          <InvitationFlow
            token={token}
            locale={locale}
            messages={{
              privacyConsent: messages.privacyConsent,
              messageConsent: messages.messageConsent,
              requestOtp: messages.requestOtp,
              verifyOtp: messages.verifyOtp,
            }}
          />
        </div>
      </section>
    </main>
  );
}
