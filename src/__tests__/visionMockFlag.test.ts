import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import * as geminiModule from "../lib/gemini";
import { POST, getMockMealAnalysis, enrichMealAnalysisWithIFCT } from "../app/api/vision/route";

vi.mock("../lib/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof geminiModule>();
  return {
    ...actual,
    analyzeMealImage: vi.fn(),
    analyzeMealTextWithGroq: vi.fn(),
  };
});

describe("Vision Route isMock Flag Correctness", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: "valid_test_gemini_key", GROQ_API_KEY: "valid_test_groq_key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("enrichMealAnalysisWithIFCT unit validation", () => {
    it("should throw an error when foods array is missing or invalid instead of silently returning mock data", () => {
      expect(() => enrichMealAnalysisWithIFCT({} as any)).toThrow("foods array missing or invalid");
      expect(() => enrichMealAnalysisWithIFCT({ foods: null } as any)).toThrow("foods array missing or invalid");
      expect(() => enrichMealAnalysisWithIFCT({ foods: "invalid" as any } as any)).toThrow("foods array missing or invalid");
    });

    it("should clamp excessive quantities and append a warning to notes", () => {
      const result = enrichMealAnalysisWithIFCT({
        foods: [
          { name: "Roti", dishName: "roti", quantity: 15, unitType: "piece" },
          { name: "Yellow Dal", dishName: "dal_toor", quantity: 1, unitType: "katori" },
        ],
        totalCalories: 0,
        totalProteinG: 0,
        confidence: 0.95,
      });

      expect(result.foods[0].quantity).toBe(8);
      expect(result.foods[0].quantityClamped).toBe(true);
      expect(result.foods[1].quantity).toBe(1);
      expect(result.foods[1].quantityClamped).toBe(false);
      expect(result.notes).toContain("Quantity adjusted to maximum plausible limit for: Roti — please verify.");
    });
  });

  describe("POST /api/vision image route (Gemini path)", () => {
    it("should return isMock: true when Gemini fails with an error and no mealText is provided", async () => {
      vi.mocked(geminiModule.analyzeMealImage).mockRejectedValueOnce(new Error("Gemini quota exceeded"));

      const req = new NextRequest("http://localhost:3000/api/vision", {
        method: "POST",
        body: JSON.stringify({
          imageBase64: "base64_sample_image_data_test_1",
          mimeType: "image/jpeg",
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.isMock).toBe(true);
      expect(data.source).toBe("mock");
      expect(data.mockReason).toBe("quota_exceeded");
      expect(data.analysis.plateType).toBe("hostel_mess_thali");
    });

    it("should return isMock: true and mockReason: 'api_error' when Gemini fails with a non-quota error", async () => {
      vi.mocked(geminiModule.analyzeMealImage).mockRejectedValueOnce(new Error("500 Internal Server Error"));

      const req = new NextRequest("http://localhost:3000/api/vision", {
        method: "POST",
        body: JSON.stringify({
          imageBase64: "base64_sample_image_data_test_1b",
          mimeType: "image/jpeg",
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.isMock).toBe(true);
      expect(data.source).toBe("mock");
      expect(data.mockReason).toBe("api_error");
    });

    it("should return isMock: true and mockReason: 'missing_key' when GEMINI_API_KEY is not configured", async () => {
      process.env.GEMINI_API_KEY = "your_gemini_api_key_here";

      const req = new NextRequest("http://localhost:3000/api/vision", {
        method: "POST",
        body: JSON.stringify({
          imageBase64: "base64_sample_image_data_test_1c",
          mimeType: "image/jpeg",
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.isMock).toBe(true);
      expect(data.source).toBe("mock");
      expect(data.mockReason).toBe("missing_key");
    });

    it("should return isMock: true when Gemini returns an invalid response (missing foods array)", async () => {
      vi.mocked(geminiModule.analyzeMealImage).mockResolvedValueOnce({
        foods: null as any,
        totalCalories: 0,
        totalProteinG: 0,
        confidence: 0,
      });

      const req = new NextRequest("http://localhost:3000/api/vision", {
        method: "POST",
        body: JSON.stringify({
          imageBase64: "base64_sample_image_data_test_2",
          mimeType: "image/jpeg",
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.isMock).toBe(true);
      expect(data.source).toBe("mock");
      expect(data.mockReason).toBe("api_error");
      expect(data.analysis.plateType).toBe("hostel_mess_thali");
    });

    it("should return isMock: false when Gemini succeeds with valid foods", async () => {
      vi.mocked(geminiModule.analyzeMealImage).mockResolvedValueOnce({
        foods: [
          {
            name: "Roti",
            dishName: "roti",
            quantity: 2,
            unitType: "piece",
            preparationStyle: "plain",
          },
        ],
        totalCalories: 170,
        totalProteinG: 6.4,
        confidence: 0.95,
      });

      const req = new NextRequest("http://localhost:3000/api/vision", {
        method: "POST",
        body: JSON.stringify({
          imageBase64: "base64_sample_image_data_test_3",
          mimeType: "image/jpeg",
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.isMock).toBe(false);
      expect(data.source).toBe("gemini_vision");
      expect(data.mockReason).toBeUndefined();
      expect(data.analysis.foods.length).toBe(1);
    });
  });

  describe("POST /api/vision text route (Groq text path)", () => {
    it("should return isMock: true when pure text analysis with Groq fails", async () => {
      vi.mocked(geminiModule.analyzeMealTextWithGroq).mockRejectedValueOnce(new Error("Groq API rate limit"));

      const req = new NextRequest("http://localhost:3000/api/vision", {
        method: "POST",
        body: JSON.stringify({
          mealText: "2 rotis and yellow dal",
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.isMock).toBe(true);
      expect(data.source).toBe("mock");
      expect(data.mockReason).toBe("quota_exceeded");
      expect(data.analysis.plateType).toBe("hostel_mess_thali");
    });

    it("should return isMock: true when Groq text analysis returns an invalid response (missing foods)", async () => {
      vi.mocked(geminiModule.analyzeMealTextWithGroq).mockResolvedValueOnce({
        foods: undefined as any,
        totalCalories: 0,
        totalProteinG: 0,
        confidence: 0,
      });

      const req = new NextRequest("http://localhost:3000/api/vision", {
        method: "POST",
        body: JSON.stringify({
          mealText: "unparseable text description",
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.isMock).toBe(true);
      expect(data.source).toBe("mock");
      expect(data.mockReason).toBe("api_error");
      expect(data.analysis.plateType).toBe("hostel_mess_thali");
    });

    it("should return isMock: true when Gemini fails and Groq fallback also returns invalid foods", async () => {
      vi.mocked(geminiModule.analyzeMealImage).mockRejectedValueOnce(new Error("Gemini down"));
      vi.mocked(geminiModule.analyzeMealTextWithGroq).mockResolvedValueOnce({
        foods: null as any,
        totalCalories: 0,
        totalProteinG: 0,
        confidence: 0,
      });

      const req = new NextRequest("http://localhost:3000/api/vision", {
        method: "POST",
        body: JSON.stringify({
          imageBase64: "base64_sample_image_data_test_4",
          mealText: "2 rotis",
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.isMock).toBe(true);
      expect(data.source).toBe("mock");
      expect(data.mockReason).toBe("api_error");
    });
  });

  describe("Timeline Mock Data Ingestion Guard (POST /api/timeline)", () => {
    it("should reject saving meal event when source is 'mock'", async () => {
      const { POST: timelinePOST } = await import("../app/api/timeline/route");

      const req = new NextRequest("http://localhost:3000/api/timeline", {
        method: "POST",
        body: JSON.stringify({
          userId: "user_test_mock_guard_1",
          type: "meal",
          source: "mock",
          payload: {
            foods: [{ name: "Roti", estimatedCalories: 170 }],
            totalCalories: 170,
          },
        }),
      });

      const res = await timelinePOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Cannot log demo or mock meal data to timeline.");
    });

    it("should reject saving meal event when payload contains isMock: true", async () => {
      const { POST: timelinePOST } = await import("../app/api/timeline/route");

      const req = new NextRequest("http://localhost:3000/api/timeline", {
        method: "POST",
        body: JSON.stringify({
          userId: "user_test_mock_guard_2",
          type: "meal",
          source: "ai_vision",
          payload: {
            isMock: true,
            foods: [{ name: "Yellow Dal", estimatedCalories: 150 }],
            totalCalories: 150,
          },
        }),
      });

      const res = await timelinePOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Cannot log demo or mock meal data to timeline.");
    });

    it("should reject the exact payload constructed by handleSaveMeal when isMock is true (client bypass scenario)", async () => {
      const { POST: timelinePOST } = await import("../app/api/timeline/route");

      // Exact structure generated by handleSaveMeal() if client-side check were bypassed
      const bypassPayload = {
        userId: "user_test_mock_guard_bypass",
        type: "meal",
        payload: {
          foods: [
            { name: "Roti", dishName: "roti", quantity: 2, estimatedCalories: 170 },
            { name: "Yellow Dal", dishName: "dal_toor", quantity: 1, estimatedCalories: 105 },
            { name: "Curd", dishName: "curd", quantity: 1, estimatedCalories: 61 },
          ],
          totalCalories: 336,
          totalProteinG: 12.8,
          totalCarbsG: 52.4,
          totalFatG: 6.8,
          imagePreview: "data:image/jpeg;base64,mockpreviewdata",
          isMock: true,
        },
        source: "mock",
      };

      const req = new NextRequest("http://localhost:3000/api/timeline", {
        method: "POST",
        body: JSON.stringify(bypassPayload),
      });

      const res = await timelinePOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Cannot log demo or mock meal data to timeline.");
    });

    it("should allow saving genuine meals when isMock is false and source is 'ai_vision'", async () => {
      const { POST: timelinePOST } = await import("../app/api/timeline/route");

      const legitimatePayload = {
        userId: "user_test_legit_meal",
        type: "meal",
        payload: {
          foods: [
            { name: "Roti", dishName: "roti", quantity: 2, estimatedCalories: 170 },
          ],
          totalCalories: 170,
          totalProteinG: 6.4,
          totalCarbsG: 34.0,
          totalFatG: 1.0,
          imagePreview: "data:image/jpeg;base64,legitdata",
          isMock: false,
        },
        source: "ai_vision",
      };

      const req = new NextRequest("http://localhost:3000/api/timeline", {
        method: "POST",
        body: JSON.stringify(legitimatePayload),
      });

      const res = await timelinePOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.event).toBeDefined();
      expect(data.event.type).toBe("meal");
    });
  });
});
