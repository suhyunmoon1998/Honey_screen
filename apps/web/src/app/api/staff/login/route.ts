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
  const body = schema.parse({
    password: formData.get("password"),
  });
  const staff = await signInStaff({
    email: STAFF_LOGIN_EMAIL,
    password: body.password,
  });
  await createSession({
    actorType: "STAFF",
    actorId: staff.id,
    organizationId: staff.organizationId,
    role: staff.role,
    locale: "es",
  });
  return noStoreRedirect(new URL("/staff/notifications", request.url));
}
