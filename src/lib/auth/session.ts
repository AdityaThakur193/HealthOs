import crypto from "crypto";
import { isValidTimeZone } from "@/lib/dateUtils";

/**
 * Stateless, HMAC-signed session stored in an HTTP-only cookie.
 *
 * The session is the only source of user identity on the server. API routes
 * must never trust an email or userId sent by the client.
 */

export const SESSION_COOKIE = "healthos_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 32;
const DEV_ONLY_SECRET = "healthos-dev-only-secret-never-used-in-production";

export interface Session {
  email: string;
  /** Null until the user finishes onboarding and a profile exists. */
  userId: string | null;
  tz?: string;
  exp: number;
}

/** A session guaranteed to belong to a user who has a profile. */
export type UserSession = Session & { userId: string };

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && (secret.length >= MIN_SECRET_LENGTH || process.env.NODE_ENV !== "production")) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(`AUTH_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters in production.`);
  }
  return DEV_ONLY_SECRET;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export function createSessionToken(input: { email: string; userId: string | null; tz?: unknown }): string {
  const session: Session = {
    email: input.email,
    userId: input.userId,
    tz: isValidTimeZone(input.tz) ? input.tz : undefined,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  if (!safeEqual(signature, sign(body))) return null;

  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    if (typeof session.email !== "string" || typeof session.exp !== "number") return null;
    if (session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return undefined;
}

export function getSession(request: Request): Session | null {
  return verifySessionToken(readCookie(request, SESSION_COOKIE));
}

function cookieAttributes(maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${token}; ${cookieAttributes(SESSION_TTL_SECONDS)}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; ${cookieAttributes(0)}`;
}

function unauthorized(): Response {
  return Response.json({ error: "Please sign in again." }, { status: 401 });
}

/** Returns the session, or a 401 Response for the route to return. */
export function requireSession(request: Request): Session | Response {
  return getSession(request) ?? unauthorized();
}

/** Like requireSession, but also requires a finished profile. */
export function requireUserSession(request: Request): UserSession | Response {
  const session = getSession(request);
  if (!session) return unauthorized();
  if (!session.userId) {
    return Response.json({ error: "Profile not set up yet.", notInitialized: true }, { status: 403 });
  }
  return session as UserSession;
}
