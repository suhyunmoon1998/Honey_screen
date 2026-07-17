import { z } from "zod";
import { requireStaffSession } from "@/lib/authz";
import { noStoreRedirect } from "@/lib/http";
import { createInvitationForClient } from "@/lib/services";

const schema = z.object({
  rawPhone: z.string().min(8),
  locale: z.enum(["es", "en"]),
});

export async function POST(request: Request) {
  const session = await requireStaffSession("STAFF");
  const formData = await request.formData();

  let body: z.infer<typeof schema>;

  try {
    body = schema.parse({
      rawPhone: formData.get("rawPhone"),
      locale: formData.get("locale") === "en" ? "en" : "es",
    });
  } catch {
    return noStoreRedirect(
      new URL("/staff/clients?status=invite-invalid", request.url),
    );
  }

  try {
    await createInvitationForClient({
      actorId: session.actorId,
      rawPhone: body.rawPhone,
      locale: body.locale,
    });
  } catch {
    return noStoreRedirect(
      new URL("/staff/clients?status=invite-failed", request.url),
    );
  }

  return noStoreRedirect(
    new URL("/staff/clients?status=invite-sent", request.url),
  );
}
