import { z } from "zod";
import { requireStaffSession } from "@/lib/authz";
import { noStoreRedirect } from "@/lib/http";
import { addCaseNote } from "@/lib/services";

const schema = z.object({
  noteType: z.enum(["EVALUATION", "CALL_LOG", "GENERAL"]),
  body: z.string().trim().min(1).max(4000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const session = await requireStaffSession("STAFF");
  const { clientId } = await context.params;
  const formData = await request.formData();

  try {
    const parsed = schema.parse({
      noteType: formData.get("noteType"),
      body: formData.get("body"),
    });

    await addCaseNote({
      actorId: session.actorId,
      clientId,
      noteType: parsed.noteType,
      body: parsed.body,
    });
  } catch {
    return noStoreRedirect(
      new URL(`/staff/clients/${clientId}?status=note-failed`, request.url),
    );
  }

  return noStoreRedirect(new URL(`/staff/clients/${clientId}`, request.url));
}
