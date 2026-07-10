export function hasGroqKey(): boolean {
  const key = process.env.GROQ_API_KEY;
  return !!key && key !== "your_groq_api_key_here";
}

export function hasGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return !!key && key !== "your_gemini_api_key_here";
}
