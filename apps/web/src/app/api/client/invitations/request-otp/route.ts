import { getEnv } from "@honey/config";
import { z } from "zod";
import { noStoreJson } from "@/lib/http";
import { resolveLocale } from "@/lib/locale";
import { commitSessionCookie } from "@/lib/session";
import { registerClientForInvitation, requestOtp } from "@/lib/services";

const schema = z.object({
  token: z.string().min(1),
  rawPhone: z.string().min(8),
  locale: z.string().optional(),
  acceptedPrivacy: z.boolean(),
  acceptedMessages: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const locale = resolveLocale(body.locale);

    if (!getEnv().OTP_VERIFICATION_ENABLED) {
      const result = await registerClientForInvitation({
        ...body,
        locale,
      });

      await commitSessionCookie({
        rawToken: result.session.rawToken,
        expiresAt: result.session.session.expiresAt,
      });

      return noStoreJson({ redirectTo: "/onboarding" });
    }

    const result = await requestOtp({
      ...body,
      locale,
    });
    return noStoreJson(result);
  } catch {
    return noStoreJson(
      { error: "No fue posible preparar el codigo." },
      { status: 400 },
    );
  }
}
