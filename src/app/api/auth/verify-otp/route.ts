import connectDB from "@/lib/mongodb";
import { UserProfile } from "@/lib/db/models";
import { getLocalProfile } from "@/lib/db/fallback";
import { consumeOtpChallenge } from "@/lib/auth/otp";
import { createSessionToken, sessionCookieHeader } from "@/lib/auth/session";
import { normalizeEmail, readJsonObject, invalidBodyResponse } from "@/lib/validation";
import { checkRateLimit, clientIp, rateLimitedResponse } from "@/lib/rateLimit";

const HOUR_MS = 60 * 60 * 1000;

async function findUserId(email: string): Promise<string | null> {
  try {
    await connectDB();
    const profile = await UserProfile.findOne({ email }).select("_id").lean();
    return profile ? String(profile._id) : null;
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    const local = await getLocalProfile(email);
    return local ? local._id : null;
  }
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body) return invalidBodyResponse();

  const email = normalizeEmail(body.email);
  const otp = typeof body.otp === "string" ? body.otp : "";
  if (!email || !/^\d{6}$/.test(otp)) {
    return Response.json({ error: "Invalid email or code" }, { status: 400 });
  }

  if (!checkRateLimit(`otp-verify:${clientIp(request)}`, 60, HOUR_MS)) {
    return rateLimitedResponse();
  }

  try {
    if (!(await consumeOtpChallenge(email, otp))) {
      return Response.json({ error: "Invalid or expired code" }, { status: 401 });
    }

    const userId = await findUserId(email);
    const token = createSessionToken({ email, userId, tz: body.tz });

    return Response.json(
      { success: true, email, userId },
      { headers: { "Set-Cookie": sessionCookieHeader(token) } }
    );
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return Response.json({ error: "Failed to verify code. Please try again." }, { status: 500 });
  }
}
