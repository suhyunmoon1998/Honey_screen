import { notFound, redirect } from "next/navigation";
import { canAccessRole } from "@honey/domain";
import { getSession } from "./session";

export async function requireClientSession() {
  const session = await getSession();

  if (!session || session.actorType !== "CLIENT") {
    redirect("/");
  }

  return session;
}

export async function requireStaffSession(
  requiredRole: "STAFF" | "ADMIN" = "STAFF",
) {
  const session = await getSession();

  if (!session || session.actorType !== "STAFF") {
    redirect("/staff/login");
  }

  if (!canAccessRole(session.role, requiredRole)) {
    notFound();
  }

  return session;
}
