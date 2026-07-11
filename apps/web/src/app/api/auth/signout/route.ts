import { noStoreRedirect } from "@/lib/http";
import { destroySession } from "@/lib/session";

export async function POST(request: Request) {
  await destroySession();
  return noStoreRedirect(new URL("/", request.url));
}
