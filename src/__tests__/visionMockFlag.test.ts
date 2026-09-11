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
      expect(data.analysis.plateType).toBe("hostel_mess_thali");
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
    });
  });
});
