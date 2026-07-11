import { z } from "zod";
import { requireStaffSession } from "@/lib/authz";
import { noStoreRedirect } from "@/lib/http";
import { createDraftQuestionVersion } from "@/lib/services";

const schema = z.object({
  definitionId: z.string().min(1),
  promptEs: z.string().min(5),
  promptEn: z.string().min(5),
});

export async function POST(request: Request) {
  const session = await requireStaffSession("ADMIN");
  const formData = await request.formData();
  const body = schema.parse({
    definitionId: formData.get("definitionId"),
    promptEs: formData.get("promptEs"),
    promptEn: formData.get("promptEn"),
  });

  await createDraftQuestionVersion({
    actorId: session.actorId,
    definitionId: body.definitionId,
    promptEs: body.promptEs,
    promptEn: body.promptEn,
  });

  return noStoreRedirect(new URL("/staff/admin", request.url));
}
