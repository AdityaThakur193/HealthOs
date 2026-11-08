import { describe, it, expect } from "vitest";
import { isValidEmail, isValidEventId, isValidObjectId, normalizeEmail } from "../lib/validation";

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

  describe("Query Injection Prevention", () => {
    it("should reject non-string identifiers that could carry MongoDB operators", () => {
      expect(isValidObjectId({ $ne: null })).toBe(false);
      expect(isValidEventId({ $gt: "" })).toBe(false);
      expect(normalizeEmail({ $ne: null })).toBeNull();
      expect(isValidEmail({ $ne: null })).toBe(false);
    });

    it("should normalize email case and whitespace", () => {
      expect(normalizeEmail("  User.Name@Example.COM ")).toBe("user.name@example.com");
    });
  });
});
