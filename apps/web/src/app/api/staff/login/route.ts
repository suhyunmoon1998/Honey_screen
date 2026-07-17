import { z } from "zod";
import { noStoreRedirect } from "@/lib/http";
import { createSession } from "@/lib/session";
import { signInStaff } from "@/lib/services";

const STAFF_LOGIN_EMAIL = "admin.fictional@jacklaw.example";

const schema = z.object({
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = schema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return noStoreRedirect(
      new URL("/staff/login?status=invalid", request.url),
    );
  }

  try {
    const staff = await signInStaff({
      email: STAFF_LOGIN_EMAIL,
      password: parsed.data.password,
    });
    await createSession({
      actorType: "STAFF",
      actorId: staff.id,
      organizationId: staff.organizationId,
      role: staff.role,
      locale: "es",
    });
  } catch {
    return noStoreRedirect(
      new URL("/staff/login?status=invalid", request.url),
    );
  }

  return noStoreRedirect(new URL("/staff/notifications", request.url));
}
