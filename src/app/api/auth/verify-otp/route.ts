import { NextResponse } from "next/server";
import { verifyOtpHash } from "@/lib/auth/otp";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, otp, hash } = body;

    if (!email || !otp || !hash) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Verify the OTP against the hash
    const isValid = verifyOtpHash(email, otp, hash);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 401 });
    }

    // 2. Authentication successful!
    // At this point, you would typically issue a session cookie or JWT token.
    // Since this is a simple setup, we return success.

    return NextResponse.json({ 
      success: true, 
      message: "Successfully verified" 
    });

  } catch (error) {
    console.error("Error verifying OTP:", error);
    return NextResponse.json({ error: "Failed to verify OTP" }, { status: 500 });
  }
}
