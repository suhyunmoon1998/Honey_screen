import { z } from "zod";
import { noStoreJson } from "@/lib/http";
import { resolveLocale } from "@/lib/locale";
import { startSelfServiceInvitation } from "@/lib/services";

const schema = z.object({
  rawPhone: z.string().min(8),
  locale: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const locale = resolveLocale(body.locale);

    await startSelfServiceInvitation({
      rawPhone: body.rawPhone,
      locale,
    });

    return noStoreJson({ status: "sent" });
  } catch {
    return noStoreJson(
      { error: "No fue posible enviar el enlace." },
      { status: 400 },
    );
  }
}
