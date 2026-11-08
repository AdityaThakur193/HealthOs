import { Resend } from "resend";
import { generateRandomOtp, createOtpChallenge, cancelOtpChallenge } from "@/lib/auth/otp";
import { normalizeEmail, readJsonObject, invalidBodyResponse } from "@/lib/validation";
import { checkRateLimit, clientIp, rateLimitedResponse } from "@/lib/rateLimit";

const HOUR_MS = 60 * 60 * 1000;

async function deliverOtp(email: string, otp: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not configured.");
    }
    console.info(`[dev] Login code for ${email}: ${otp}`);
    return;
  }

  // The Resend SDK reports failures in `error` rather than throwing.
  const { error } = await new Resend(apiKey).emails.send({
    from: process.env.EMAIL_FROM || "HealthOS <onboarding@resend.dev>",
    to: email,
    subject: "Your Health OS Login Code",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #10b981;">Health OS Authentication</h2>
        <p>Your 6-digit login code is:</p>
        <h1 style="font-size: 32px; letter-spacing: 4px; color: #111;">${otp}</h1>
        <p style="color: #666; font-size: 12px;">This code will expire in 5 minutes.</p>
      </div>
    `,
  });

  if (error) throw new Error(`Resend rejected the email: ${error.message}`);
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body) return invalidBodyResponse();

  const email = normalizeEmail(body.email);
  if (!email) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  if (!checkRateLimit(`otp-send:${clientIp(request)}`, 20, HOUR_MS)) {
    return rateLimitedResponse();
  }

  try {
    const otp = generateRandomOtp();
    const decision = await createOtpChallenge(email, otp);

    if (decision !== "ok") {
      const error =
        decision === "cooldown"
          ? "Please wait 30 seconds before requesting another code."
          : "Too many login codes requested. Please try again later.";
      return Response.json({ error }, { status: 429 });
    }

    try {
      await deliverOtp(email, otp);
    } catch (deliveryError) {
      await cancelOtpChallenge(email);
      throw deliveryError;
    }

    return Response.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return Response.json({ error: "Failed to send login code. Please try again." }, { status: 500 });
  }
}
