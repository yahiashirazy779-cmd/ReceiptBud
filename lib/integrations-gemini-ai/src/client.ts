import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error(
    "GEMINI_API_KEY must be set. Please add your Gemini API key to secrets.",
  );
}

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
