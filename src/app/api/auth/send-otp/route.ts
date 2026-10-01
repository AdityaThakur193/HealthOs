import { NextResponse } from "next/server";
import { generateRandomOtp, generateOtpHash } from "@/lib/auth/otp";
import { Resend } from "resend";

// Initialize Resend (with a fallback to prevent build-time crashes if env var is missing during Vercel build)
const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key_for_build");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // 1. Generate a random 6-digit OTP
    const otp = generateRandomOtp();

    // 2. Encrypt it into a stateless hash (valid for 5 minutes)
    const hash = generateOtpHash(email, otp, 5);

    // 3. Send the OTP via email
    await resend.emails.send({
      from: "HealthOS <onboarding@resend.dev>", // Using resend.dev for testing, change to your domain in production
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

    // FOR DEVELOPMENT: Log the OTP to the console so you can test it without sending emails
    console.log(`[DEV ONLY] OTP for ${email} is: ${otp}`);

    // 4. Return the encrypted hash to the client
    // The client MUST save this hash (e.g. in state) and send it back during verification
    return NextResponse.json({ 
      success: true, 
      message: "OTP sent successfully", 
      hash: hash 
    });

  } catch (error) {
    console.error("Error sending OTP:", error);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
