import { z } from "zod";
import { noStoreJson } from "@/lib/http";
import { resolveLocale } from "@/lib/locale";
import { commitSessionCookie } from "@/lib/session";
import { verifyOtpAndRegister } from "@/lib/services";

const schema = z.object({
  token: z.string().min(1),
  rawPhone: z.string().min(8),
  code: z.string().min(4),
  locale: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const locale = resolveLocale(body.locale);
    const result = await verifyOtpAndRegister({
      token: body.token,
      rawPhone: body.rawPhone,
      code: body.code,
      locale,
    });

    await commitSessionCookie({
      rawToken: result.session.rawToken,
      expiresAt: result.session.session.expiresAt,
    });

    return noStoreJson({ redirectTo: "/api/client/onboarding/complete" });
  } catch {
    return noStoreJson(
      { error: "No fue posible verificar el codigo." },
      { status: 400 },
    );
  }
}
