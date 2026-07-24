import { describe, it, expect } from "vitest";

/**
 * Validation Logic for Profile Metrics & API Payloads
 */
function validateProfileMetrics(data: {
  age?: number;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  sleepTarget?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data.age !== undefined && (data.age < 10 || data.age > 120)) {
    errors.push("Age must be between 10 and 120.");
  }
  if (data.heightCm !== undefined && (data.heightCm < 50 || data.heightCm > 250)) {
    errors.push("Height must be between 50 cm and 250 cm.");
  }
  if (data.weightKg !== undefined && (data.weightKg < 20 || data.weightKg > 500)) {
    errors.push("Weight must be between 20 kg and 500 kg.");
  }
  if (data.targetWeightKg !== undefined && (data.targetWeightKg < 20 || data.targetWeightKg > 500)) {
    errors.push("Target weight must be between 20 kg and 500 kg.");
  }
  if (data.sleepTarget !== undefined && (data.sleepTarget < 1 || data.sleepTarget > 24)) {
    errors.push("Sleep target must be between 1 and 24 hours.");
  }

  return { valid: errors.length === 0, errors };
}

function validateMessMenuInput(text: string): { valid: boolean; error?: string } {
  if (typeof text !== "string") return { valid: false, error: "Input must be text." };
  if (text.length > 50000) return { valid: false, error: "Mess menu exceeds maximum limit of 50,000 characters." };
  return { valid: true };
}

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
});
