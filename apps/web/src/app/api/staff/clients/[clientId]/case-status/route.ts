import { z } from "zod";
import { requireStaffSession } from "@/lib/authz";
import { noStoreRedirect } from "@/lib/http";
import { setClientCaseStatus } from "@/lib/services";

const schema = z.object({
  caseStatus: z.enum([
    "NEW",
    "UNDER_REVIEW",
    "QUALIFIED",
    "NOT_QUALIFIED",
    "CALLED",
    "CLOSED",
  ]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const session = await requireStaffSession("STAFF");
  const { clientId } = await context.params;
  const formData = await request.formData();

  try {
    const body = schema.parse({
      caseStatus: formData.get("caseStatus"),
    });

    await setClientCaseStatus({
      actorId: session.actorId,
      clientId,
      caseStatus: body.caseStatus,
    });
  } catch {
    return noStoreRedirect(
      new URL(`/staff/clients/${clientId}?status=update-failed`, request.url),
    );
  }

  return noStoreRedirect(new URL(`/staff/clients/${clientId}`, request.url));
}
