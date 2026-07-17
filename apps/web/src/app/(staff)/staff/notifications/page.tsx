import Link from "next/link";
import { prisma } from "@honey/db";
import { requireStaffSession } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function StaffNotificationsPage() {
  const session = await requireStaffSession("STAFF");
  const notifications = await prisma.inAppNotification.findMany({
    where: { recipientId: session.actorId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="page-shell min-h-screen px-4 py-8">
      <section className="card mx-auto max-w-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Team notifications</h1>
          <form action="/api/staff/logout" method="post">
            <button className="button-secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link className="button-secondary px-3 py-1.5" href="/staff/clients">
            Clients
          </Link>
          <Link className="button-secondary px-3 py-1.5" href="/staff/content">
            Content
          </Link>
        </nav>
        <div className="mt-6 space-y-3">
          {notifications.map((notification) => (
            <article
              className="rounded-3xl border border-line bg-white p-4 text-[#1c1433]"
              key={notification.id}
            >
              <p className="text-sm uppercase tracking-[0.2em] text-[#6b6382]">
                {notification.type}
              </p>
              <h2 className="mt-2 text-lg font-semibold">
                {notification.title}
              </h2>
              <p className="mt-2 leading-7 text-[#6b6382]">
                {notification.body}
              </p>
            </article>
          ))}
          {notifications.length === 0 ? (
            <p className="muted">No notifications yet.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
