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
   const action = req.query.action || "outline";
   
if (action === "refine") {
      const { notesContent, topic, sermonContext } = req.body;
      
      if (!notesContent || notesContent.trim() === "") {
        return res.json({ refined: "No notes provided to refine." });
      }

      const ai = getAiClient();
      
      if (!ai) {
        const formattedDate = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return res.json({
          refined: `SERMON NOTES: ${topic || "Sunday Message"}

Date: ${formattedDate}

MAIN POINTS FROM THE MESSAGE

${notesContent.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => {
  const trimmed = line.trim();
  if (trimmed.length > 100) {
    return `• ${trimmed}\n\n`;
  }
  return `• ${trimmed}\n`;
}).join('')}

KEY SCRIPTURE REFERENCES

Meditate on the core scriptures referenced during the sermon to deepen your understanding.

PRACTICAL APPLICATION AND REFLECTION

Consider how these truths apply to your daily walk with Christ. What changes do you need to make in your life based on today's message?

QUESTIONS FOR PERSONAL STUDY

1. What stood out most from today's message?
2. How can you practically apply this teaching this week?
3. What questions arose during the sermon that you should explore further?

(Local structure generator used - Gemini API unavailable)`
        });
      }

      try {
        const systemPrompt = `You are a skilled theological editor and spiritual mentor. Transform raw sermon notes into a beautifully formatted document with:

- Use bold text for important points using **text** format
- Use clear paragraph breaks for readability
- Use simple bullet points with • for lists
- Write in clear, well-structured sentences
- Add contextual explanations to help understanding
- Include reflection questions at the end
- Avoid markdown headers (#), roman numerals, and complex formatting
- Keep it accessible and edifying for anyone reading later

Format with clear sections, bold headings, and well-structured paragraphs.`;

        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: `Sermon Topic: ${topic || "Sunday Service"}
Sermon Notes (raw):
"${notesContent}"

${sermonContext ? `Additional Context: ${sermonContext}` : ""}

Please structure and enhance these notes for clarity, understanding, and spiritual edification.`,
          config: {
            systemInstruction: systemPrompt,
          }
        });

        return res.json({ refined: response.text || "Could not refine notes." });
      } catch (error: any) {
        console.error("AI Refine endpoint error:", error);
        const formattedDate = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return res.json({
          refined: `SERMON NOTES: ${topic || "Sunday Message"}

Date: ${formattedDate}

MAIN POINTS FROM THE MESSAGE

${notesContent.split('\n').filter((l: string) => l.trim()).map((line: string) => `• ${line.trim()}\n`).join('')}

KEY SCRIPTURE REFERENCES

Meditate on the core scriptures referenced during the sermon to deepen your understanding.

PRACTICAL APPLICATION AND REFLECTION

Consider how these truths apply to your daily walk with Christ. What changes do you need to make in your life based on today's message?

QUESTIONS FOR PERSONAL STUDY

1. What stood out most from today's message?
2. How can you practically apply this teaching this week?
3. What questions arose during the sermon that you should explore further?

(Graceful local structure generator fallback triggered)`
        });
      }
    }
   
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