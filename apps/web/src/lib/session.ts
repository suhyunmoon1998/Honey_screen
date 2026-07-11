import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getEnv } from "@honey/config";
import { prisma } from "@honey/db";
import { hashToken } from "@honey/domain";

export type AppSession = {
  actorType: "CLIENT" | "STAFF";
  actorId: string;
  organizationId: string;
  role: "CLIENT" | "STAFF" | "ADMIN";
  locale: string;
};

export type SessionRecord = NonNullable<
  Awaited<ReturnType<typeof prisma.session.findFirst>>
>;

type SessionStore = {
  session: {
    create: typeof prisma.session.create;
  };
};

export const SESSION_COOKIE_SAME_SITE = "lax";

export function getSessionCookieName() {
  return getEnv().SESSION_COOKIE_NAME;
}

export function getCanonicalAppOrigin() {
  return new URL(getEnv().APP_URL).origin;
}

export function getSessionExpiry(now = new Date()) {
  const env = getEnv();
  return new Date(now.getTime() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
}

export function getSessionCookieOptions(
  expiresAt: Date,
  nodeEnv = getEnv().NODE_ENV,
) {
  return {
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAME_SITE,
    secure: nodeEnv === "production",
    path: "/",
    expires: expiresAt,
  } as const;
}

export async function createSessionRecord(
  store: SessionStore,
  input: AppSession,
  now = new Date(),
) {
  const rawToken = randomBytes(24).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = getSessionExpiry(now);

  const session = await store.session.create({
    data: {
      tokenHash,
      actorType: input.actorType,
      actorId: input.actorId,
      organizationId: input.organizationId,
      role: input.role,
      locale: input.locale,
      expiresAt,
    },
  });

  return {
    rawToken,
    session,
  };
}

export async function commitSessionCookie(input: {
  rawToken: string;
  expiresAt: Date;
}) {
  const cookieStore = await cookies();
  cookieStore.set(
    getSessionCookieName(),
    input.rawToken,
    getSessionCookieOptions(input.expiresAt),
  );
}

export async function createSession(input: AppSession) {
  const created = await createSessionRecord(prisma, input);
  await commitSessionCookie({
    rawToken: created.rawToken,
    expiresAt: created.session.expiresAt,
  });
  return created.rawToken;
}

export async function readSession(rawToken: string) {
  return prisma.session.findFirst({
    where: {
      tokenHash: hashToken(rawToken),
      expiresAt: {
        gt: new Date(),
      },
    },
  });
}

export async function revokeSession(rawToken: string) {
  return prisma.session.deleteMany({
    where: { tokenHash: hashToken(rawToken) },
  });
}

export async function deleteSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());
}

export async function destroySession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(getSessionCookieName())?.value;
  if (rawToken) {
    await revokeSession(rawToken);
  }

  await deleteSessionCookie();
}

export async function getSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(getSessionCookieName())?.value;

  if (!rawToken) {
    return null;
  }

  const session = await readSession(rawToken);

  if (!session) {
    await deleteSessionCookie();
    return null;
  }

  return session;
}
