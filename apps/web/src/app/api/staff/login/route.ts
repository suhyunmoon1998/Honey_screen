import { z } from "zod";
import { noStoreRedirect } from "@/lib/http";
import { createSession } from "@/lib/session";
import { signInStaff } from "@/lib/services";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const formData = await request.formData();
  const body = schema.parse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const staff = await signInStaff(body);
  await createSession({
    actorType: "STAFF",
    actorId: staff.id,
    organizationId: staff.organizationId,
    role: staff.role,
    locale: "es",
  });
  return noStoreRedirect(new URL("/staff/notifications", request.url));
}
