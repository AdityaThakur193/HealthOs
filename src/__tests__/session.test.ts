import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import {
  clearSessionCookieHeader,
  createSessionToken,
  getAuthSecret,
  getSession,
  requireSession,
  requireUserSession,
  SESSION_COOKIE,
  sessionCookieHeader,
  verifySessionToken,
} from "../lib/auth/session";

const identity = { email: "user@example.com", userId: "507f1f77bcf86cd799439011" };

function requestWith(token?: string) {
  return new Request("http://localhost/api/x", {
    headers: token ? { cookie: `other=1; ${SESSION_COOKIE}=${token}` } : {},
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Session tokens", () => {
  it("round-trips identity and a valid timezone", () => {
    const session = verifySessionToken(createSessionToken({ ...identity, tz: "Asia/Kolkata" }));
    expect(session?.email).toBe(identity.email);
    expect(session?.userId).toBe(identity.userId);
    expect(session?.tz).toBe("Asia/Kolkata");
  });

  it("drops an invalid timezone", () => {
    expect(verifySessionToken(createSessionToken({ ...identity, tz: "Mars/Base" }))?.tz).toBeUndefined();
  });

  it("rejects a tampered payload", () => {
    const [, signature] = createSessionToken(identity).split(".");
    const forged = Buffer.from(JSON.stringify({ email: "victim@example.com", userId: "x", exp: 9999999999 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${signature}`)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken("garbage")).toBeNull();
    expect(verifySessionToken("a.b.c")).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(identity);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    vi.stubEnv("AUTH_SECRET", "first-secret-first-secret-first-secret");
    const token = createSessionToken(identity);
    vi.stubEnv("AUTH_SECRET", "other-secret-other-secret-other-secret");
    expect(verifySessionToken(token)).toBeNull();
  });
});

describe("Auth secret", () => {
  it("fails closed in production without a strong secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => getAuthSecret()).toThrow("AUTH_SECRET");
    vi.stubEnv("AUTH_SECRET", "too-short");
    expect(() => getAuthSecret()).toThrow("AUTH_SECRET");
  });

  it("uses a long secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "x".repeat(32));
    expect(getAuthSecret()).toBe("x".repeat(32));
  });
});

describe("Request helpers", () => {
  it("reads the session from the cookie header", () => {
    expect(getSession(requestWith(createSessionToken(identity)))?.email).toBe(identity.email);
    expect(getSession(requestWith())).toBeNull();
  });

  it("returns 401 without a session", () => {
    expect((requireSession(requestWith()) as Response).status).toBe(401);
    expect((requireUserSession(requestWith()) as Response).status).toBe(401);
  });

  it("returns 403 when the user has no profile yet", () => {
    const token = createSessionToken({ email: identity.email, userId: null });
    expect((requireUserSession(requestWith(token)) as Response).status).toBe(403);
    expect(requireSession(requestWith(token))).not.toBeInstanceOf(Response);
  });
});

describe("Session cookie", () => {
  it("is HTTP-only and SameSite=Lax", () => {
    const header = sessionCookieHeader("token");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).not.toContain("Secure");
  });

  it("is Secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieHeader("token")).toContain("Secure");
  });

  it("clears with Max-Age=0", () => {
    expect(clearSessionCookieHeader()).toContain("Max-Age=0");
  });
});

describe("Route protection", () => {
  it("every API route outside /api/auth checks the session", () => {
    const apiRoot = path.join(__dirname, "..", "app", "api");
    const routes = (fs.readdirSync(apiRoot, { recursive: true }) as string[])
      .filter((file) => file.endsWith("route.ts") && !file.startsWith("auth") && !file.startsWith("cron"));

    expect(routes.length).toBeGreaterThanOrEqual(8);
    for (const route of routes) {
      const source = fs.readFileSync(path.join(apiRoot, route), "utf8");
      expect(/require(User)?Session\(request\)/.test(source), `${route} must check the session`).toBe(true);
    }
  });
});
