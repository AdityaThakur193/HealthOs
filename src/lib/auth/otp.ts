import crypto from "crypto";
import connectDB from "@/lib/mongodb";
import { OtpChallenge } from "@/lib/db/models";
import { getAuthSecret, safeEqual } from "@/lib/auth/session";

/**
 * One-time login codes.
 *
 * Challenges live on the server so a code can be used once and guessed only a
 * few times. The client never receives anything derived from the code.
 */

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
export const OTP_MAX_SENDS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

export type OtpSendDecision = "ok" | "cooldown" | "limit";

export interface OtpRecord {
  email: string;
  codeHash: string | null;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
  windowStart: Date;
  sendCount: number;
}

export function generateRandomOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(email: string, otp: string): string {
  return crypto.createHmac("sha256", getAuthSecret()).update(`${email}:${otp}`).digest("hex");
}

/** Decides whether a new code may be sent, given the previous record. */
export function evaluateOtpSend(existing: OtpRecord | null, now: number): OtpSendDecision {
  if (!existing) return "ok";
  if (now - existing.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) return "cooldown";
  const windowActive = now - existing.windowStart.getTime() < HOUR_MS;
  if (windowActive && existing.sendCount >= OTP_MAX_SENDS_PER_HOUR) return "limit";
  return "ok";
}

function nextOtpRecord(email: string, codeHash: string, existing: OtpRecord | null, now: number): OtpRecord {
  const windowActive = !!existing && now - existing.windowStart.getTime() < HOUR_MS;
  return {
    email,
    codeHash,
    expiresAt: new Date(now + OTP_TTL_MS),
    attempts: 0,
    lastSentAt: new Date(now),
    windowStart: windowActive ? existing.windowStart : new Date(now),
    sendCount: windowActive ? existing.sendCount + 1 : 1,
  };
}

// Development fallback for running without MongoDB. Never used in production.
const memoryStore = new Map<string, OtpRecord>();

async function isMongoAvailable(): Promise<boolean> {
  try {
    await connectDB();
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    return false;
  }
}

/** Stores a new challenge unless rate limits forbid it. */
export async function createOtpChallenge(email: string, otp: string): Promise<OtpSendDecision> {
  const now = Date.now();
  const codeHash = hashOtp(email, otp);

  if (!(await isMongoAvailable())) {
    const existing = memoryStore.get(email) ?? null;
    const decision = evaluateOtpSend(existing, now);
    if (decision === "ok") memoryStore.set(email, nextOtpRecord(email, codeHash, existing, now));
    return decision;
  }

  const existing = await OtpChallenge.findOne({ email }).lean<OtpRecord>();
  const decision = evaluateOtpSend(existing, now);
  if (decision === "ok") {
    // purgeAt outlives the code so the hourly send limit survives expiry.
    const record = { ...nextOtpRecord(email, codeHash, existing, now), purgeAt: new Date(now + HOUR_MS) };
    await OtpChallenge.updateOne({ email }, { $set: record }, { upsert: true });
  }
  return decision;
}

/** Invalidates a challenge whose email could not be delivered. */
export async function cancelOtpChallenge(email: string): Promise<void> {
  if (await isMongoAvailable()) {
    await OtpChallenge.updateOne({ email }, { $set: { codeHash: null } });
  } else {
    memoryStore.delete(email);
  }
}

/** Checks a code. A correct code works once; wrong guesses are capped. */
export async function consumeOtpChallenge(email: string, otp: string): Promise<boolean> {
  const now = new Date();
  const hash = hashOtp(email, otp);

  if (!(await isMongoAvailable())) {
    const record = memoryStore.get(email);
    if (!record?.codeHash || record.expiresAt <= now || record.attempts >= OTP_MAX_ATTEMPTS) return false;
    record.attempts += 1;
    if (!safeEqual(record.codeHash, hash)) return false;
    record.codeHash = null;
    return true;
  }

  // Counting the attempt first means concurrent guesses cannot exceed the cap.
  const record = await OtpChallenge.findOneAndUpdate(
    { email, codeHash: { $ne: null }, expiresAt: { $gt: now }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true }
  ).lean<OtpRecord>();

  if (!record?.codeHash || !safeEqual(record.codeHash, hash)) return false;

  const claimed = await OtpChallenge.updateOne(
    { email, codeHash: record.codeHash },
    { $set: { codeHash: null } }
  );
  return claimed.modifiedCount === 1;
}
