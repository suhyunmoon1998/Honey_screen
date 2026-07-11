import { z } from "zod";
import { requireClientSession } from "@/lib/authz";
import { noStoreRedirect } from "@/lib/http";
import { resolveLocale } from "@/lib/locale";
import { completeOnboarding } from "@/lib/services";

const schema = z.object({
  timeZone: z.string().min(1),
  locale: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await requireClientSession();
  const formData = await request.formData();
  const body = schema.parse({
    timeZone: formData.get("timeZone"),
    locale: formData.get("locale"),
  });
  await completeOnboarding({
    clientId: session.actorId,
    timeZone: body.timeZone,
    locale: resolveLocale(body.locale),
  });
  return noStoreRedirect(new URL("/dashboard", request.url));
}
