import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

export default async function handler(req: any, res: any) {
  const { notesContent, topic } = req.body;
  
  if (!notesContent || notesContent.trim() === "") {
    return res.json({ outline: "No notes provided to generate outline." });
  }

  const ai = getAiClient();
  
  if (!ai) {
    return res.json({
      outline: `### AI Copilot Structured Outline: ${topic || "Sunday Service"}\n\n* **I. Introduction & Central Focus**\n  * Hook: Connecting modern life challenges to divine truths.\n  * Central Scripture Recommendation: Focus on a key anchoring passage.\n\n* **II. Core Exegesis (Based on Sermon Notes)**\n  * Analysis of themes found in notes: *"${notesContent.substring(0, 150)}..."*\n  * Contextualizing historical and cultural elements of the references.\n\n* **III. Practical Spiritual Applications**\n  * How the congregation can apply this revelation during the week.\n  * Overcoming common barriers to living out these biblical principles.\n\n* **IV. Conclusion & Key Takeaway**\n  * Summarizing the sermon topic: *${topic}*.\n  * Final closing call to prayer and dedication.\n\n*(Note: Graceful local outline generator fallback triggered because Gemini API Key is offline or quota-limited)*`
    });
  }

  try {
    const systemPrompt = "You are an expert theologian and sermon outline editor. Create a beautifully structured sermon outline with clear headings, scriptural suggestions, and real-life application points from the rough pastor notes.";
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `Sermon Topic: ${topic || "Untold Sunday Study"}\nRough Notes:\n"${notesContent}"`,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    return res.json({ outline: response.text || "Could not generate outline." });
  } catch (error: any) {
    console.error("AI Copilot error:", error);
    return res.json({
      outline: `### AI Copilot Structured Outline: ${topic || "Sunday Service"}\n\n* **I. Introduction & Central Focus**\n  * Hook: Connecting modern life challenges to divine truths.\n  * Central Scripture Recommendation: Focus on a key anchoring passage.\n\n* **II. Core Exegesis (Based on Sermon Notes)**\n  * Analysis of themes found in notes: *"${notesContent.substring(0, 150)}..."*\n  * Contextualizing historical and cultural elements of the references.\n\n* **III. Practical Spiritual Applications**\n  * How the congregation can apply this revelation during the week.\n  * Overcoming common barriers to living out these biblical principles.\n\n* **IV. Conclusion & Key Takeaway**\n  * Summarizing the sermon topic: *${topic}*.\n  * Final closing call to prayer and dedication.\n\n*(Note: Graceful local outline generator fallback triggered because Gemini API Key is offline or quota-limited)*`
    });
  }
}