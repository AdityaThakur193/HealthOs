import { clearSessionCookieHeader } from "@/lib/auth/session";

export async function POST() {
  return Response.json({ success: true }, { headers: { "Set-Cookie": clearSessionCookieHeader() } });
}
