import { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { prompt } = req.body;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: prompt
    });

    return res.status(200).json({
      result: response.text
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message
    });
  }
}
