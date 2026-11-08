import { describe, it, expect } from "vitest";
import { validateImageInput, validateMessMenuInput, validateProfileMetrics, validateTimelinePayload } from "../lib/validation";

describe("API Payloads & Edge Case Validation", () => {
  describe("Profile Physical Metrics Boundaries", () => {
    it("should accept realistic human physical measurements", () => {
      const validProfile = {
        age: 21,
        heightCm: 191,
        weightKg: 119.5,
        targetWeightKg: 85,
        sleepTarget: 8,
      };
      const result = validateProfileMetrics(validProfile);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should reject negative or physically impossible values", () => {
      const invalidProfile = {
        age: -5,
        heightCm: 0,
        weightKg: 9000,
        sleepTarget: 30,
      };
      const result = validateProfileMetrics(invalidProfile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Age must be between 10 and 120.");
      expect(result.errors).toContain("Height must be between 50 cm and 250 cm.");
      expect(result.errors).toContain("Weight must be between 20 kg and 500 kg.");
      expect(result.errors).toContain("Sleep target must be between 1 and 24 hours.");
    });
  });

  describe("Mess Menu Input Limits", () => {
    it("should allow valid text inputs under character limit", () => {
      const menuText = "Monday Breakfast: Dosa, Tea\nLunch: Rice, Dal\nDinner: Roti, Paneer";
      expect(validateMessMenuInput(menuText).valid).toBe(true);
    });

    it("should reject massive text payloads over 50k characters to prevent Denial of Service", () => {
      const giantText = "A".repeat(60000);
      const res = validateMessMenuInput(giantText);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("exceeds maximum limit");
    });
  });

  describe("Timeline Payload Edge Cases & Sanity Validation", () => {
    it("should bound water intake", () => {
      expect(validateTimelinePayload("water", { amountL: 100 })).toContain("cannot exceed");
      expect(validateTimelinePayload("water", { amountL: -2 })).toContain("greater than 0");
      expect(validateTimelinePayload("water", { amountL: 1.5 })).toBeNull();
    });

    it("should bound sleep duration", () => {
      expect(validateTimelinePayload("sleep", { hours: 28 })).toContain("cannot exceed");
      expect(validateTimelinePayload("sleep", { hours: 0 })).toContain("greater than 0");
      expect(validateTimelinePayload("sleep", { hours: 7.5 })).toBeNull();
    });

    it("should bound step counts, reading count before steps", () => {
      expect(validateTimelinePayload("steps", { count: 500000 })).toContain("cannot exceed");
      expect(validateTimelinePayload("steps", { count: -50 })).toContain("negative");
      expect(validateTimelinePayload("steps", { count: 0, steps: 999999 })).toBeNull();
      expect(validateTimelinePayload("steps", { count: 8500 })).toBeNull();
    });

    it("should bound weight logs", () => {
      expect(validateTimelinePayload("weight", { weightKg: 15 })).toContain("between 25 kg and 350 kg");
      expect(validateTimelinePayload("weight", { weightKg: 900 })).toContain("between 25 kg and 350 kg");
      expect(validateTimelinePayload("weight", { weightKg: 74.5 })).toBeNull();
    });

    it("should refuse mock meals and non-object payloads", () => {
      expect(validateTimelinePayload("meal", { isMock: true, totalCalories: 100 })).toContain("mock");
      expect(validateTimelinePayload("meal", [])).toContain("valid object");
    });
  });

  describe("Image Input Limits", () => {
    it("should reject oversized and unsupported images", () => {
      expect(validateImageInput("a".repeat(11 * 1024 * 1024), "image/jpeg")).toContain("too large");
      expect(validateImageInput("abc", "application/pdf")).toContain("Unsupported");
      expect(validateImageInput("abc", "image/jpeg")).toBeNull();
    });
  });
});
