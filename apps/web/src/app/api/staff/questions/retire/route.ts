import { z } from "zod";
import { requireStaffSession } from "@/lib/authz";
import { noStoreRedirect } from "@/lib/http";
import { retireQuestionVersion } from "@/lib/services";

const schema = z.object({
  versionId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await requireStaffSession("ADMIN");
  const formData = await request.formData();
  const body = schema.parse({
    versionId: formData.get("versionId"),
  });

  await retireQuestionVersion({
    actorId: session.actorId,
    versionId: body.versionId,
  });

  return noStoreRedirect(new URL("/staff/admin", request.url));
}
