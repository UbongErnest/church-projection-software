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

  // General AI chat for app assistance
  if (action === "ai-chat") {
    const { messages, newMessage } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ 
        error: "AI Chat is unavailable - Gemini API key not configured." 
      });
    }

    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({ 
        error: "AI Chat is currently unavailable. Please try again later." 
      });
    }

    try {
      const conversationHistory = (messages || []).map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      }));

      const requestBody = {
        model: "gemini-2.0-flash",
        contents: [
          ...conversationHistory,
          { role: "user", parts: [{ text: newMessage }] }
        ],
        config: {
          systemInstruction: `You are Chaver AI, a helpful assistant integrated into the Church Projection Software application.

APP NAVIGATION & FEATURES:
- Operator View (main): Control panel left, projector output right
- Projector View: Access via #projector URL hash or top bar - shows full-screen scripture/lyrics
- Speech Simulator: Click phrases in right panel to test verse detection without microphone
- Live Listening: Requires Monthly+ subscription, uses Web Speech API for real-time transcription
- Notes Journal: Save sermon notes to Supabase cloud, export as Markdown or PDF
- AI Copilot: Yearly subscription-only - generates sermon outlines and structures notes
- AI Chat: Yearly subscription-only - chat with AI assistant about anything
- Layout Modes: fullscreen, lower-third, split-screen (control panel settings)
- Themes: nebula-dark (default), plus other presets (control panel)
- Plans: Monthly for live listening, Yearly for AI features

Be helpful, concise, and conversational. No markdown headers (#) or complex formatting.`
        }
      };

let response;
       let lastError: any;
       for (let attempt = 0; attempt < 3; attempt++) {
         try {
           response = await ai.models.generateContent(requestBody);
           break;
         } catch (err: any) {
           lastError = err;
           const msg = err.message || "";
           if (msg.includes("429") || msg.includes("quota")) {
             const delay = Math.pow(2, attempt) * 1000;
             await new Promise(resolve => setTimeout(resolve, delay));
             continue;
           }
           throw err;
         }
       }
       if (!response) throw lastError;

      const botReply = response.text || "I couldn't process your message.";
      const updatedMessages = [...(messages || []), { role: "user", content: newMessage }, { role: "assistant", content: botReply }];
      return res.json({ messages: updatedMessages });
    } catch (error: any) {
      console.error("AI Chat error:", error.message || error);
      const msg = error.message || "";
      if (msg.includes("429") || msg.includes("quota")) {
        return res.status(429).json({ 
          error: "AI service rate limit exceeded. Please try again later."
        });
      }
      return res.status(500).json({ 
        error: "AI service temporarily unavailable."
      });
    }
  }

  if (action === "refine") {
    const { notesContent, topic, sermonContext } = req.body;

    if (!notesContent || notesContent.trim() === "") {
      return res.json({ refined: "No notes provided to refine." });
    }

    const formattedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // If no API key, return local structure
    if (!process.env.GEMINI_API_KEY) {
      const structuredNotes = notesContent.split('\n').filter((l: string) => l.trim());
      return res.json({
        refined: `SERMON NOTES: ${topic || "Sunday Message"}

Date: ${formattedDate}

MAIN POINTS FROM THE MESSAGE

${structuredNotes.map((line: string) => `• ${line}\n`).join('')}

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

    const ai = getAiClient();
    if (!ai) {
      const structuredNotes = notesContent.split('\n').filter((l: string) => l.trim());
      return res.json({
        refined: `SERMON NOTES: ${topic || "Sunday Message"}

Date: ${formattedDate}

MAIN POINTS FROM THE MESSAGE

${structuredNotes.map((line: string, i: number) => {
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
        model: "gemini-2.0-flash",
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
      const structuredNotes = notesContent.split('\n').filter((l: string) => l.trim());
      return res.json({
        refined: `SERMON NOTES: ${topic || "Sunday Message"}

Date: ${formattedDate}

MAIN POINTS FROM THE MESSAGE

${structuredNotes.map((line: string) => `• ${line.trim()}\n`).join('')}

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

  // Graceful fallback without API key
  if (!process.env.GEMINI_API_KEY) {
    return res.json({
      outline: `AI Copilot Structured Outline: ${topic || "Sunday Service"}

I. Introduction & Central Focus
- Hook: Connecting modern life challenges to divine truths.
- Central Scripture Recommendation: Focus on a key anchoring passage.

II. Core Exegesis (Based on Sermon Notes)
- Analysis of themes found in notes: "${notesContent.substring(0, 150)}..."
- Contextualizing historical and cultural elements of the references.

III. Practical Spiritual Applications
- How the congregation can apply this revelation during the week.
- Overcoming common barriers to living out these biblical principles.

IV. Conclusion & Key Takeaway
- Summarizing the sermon topic: ${topic}
- Final closing call to prayer and dedication.

(Graceful local outline generator fallback triggered because Gemini API Key is offline or quota-limited)`
    });
  }

  const ai = getAiClient();
  if (!ai) {
    return res.json({
      outline: `AI Copilot Structured Outline: ${topic || "Sunday Service"}

I. Introduction & Central Focus
- Hook: Connecting modern life challenges to divine truths.
- Central Scripture Recommendation: Focus on a key anchoring passage.

II. Core Exegesis (Based on Sermon Notes)
- Analysis of themes found in notes: "${notesContent.substring(0, 150)}..."
- Contextualizing historical and cultural elements of the references.

III. Practical Spiritual Applications
- How the congregation can apply this revelation during the week.
- Overcoming common barriers to living out these biblical principles.

IV. Conclusion & Key Takeaway
- Summarizing the sermon topic: ${topic}
- Final closing call to prayer and dedication.

(Graceful local outline generator fallback triggered because Gemini API Key is offline or quota-limited)`
    });
  }

  try {
    const systemPrompt = "You are an expert theologian and sermon outline editor. Create a beautifully structured sermon outline with clear headings, scriptural suggestions, and real-life application points from the rough pastor notes.";
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Sermon Topic: ${topic || "Untold Sunday Study"}\nRough Notes:\n"${notesContent}"`,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    return res.json({ outline: response.text || "Could not generate outline." });
  } catch (error: any) {
    console.error("AI Copilot error:", error);
    return res.json({
      outline: `AI Copilot Structured Outline: ${topic || "Sunday Service"}

I. Introduction & Central Focus
- Hook: Connecting modern life challenges to divine truths.
- Central Scripture Recommendation: Focus on a key anchoring passage.

II. Core Exegesis (Based on Sermon Notes)
- Analysis of themes found in notes: "${notesContent.substring(0, 150)}..."
- Contextualizing historical and cultural elements of the references.

III. Practical Spiritual Applications
- How the congregation can apply this revelation during the week.
- Overcoming common barriers to living out these biblical principles.

IV. Conclusion & Key Takeaway
- Summarizing the sermon topic: ${topic}
- Final closing call to prayer and dedication.

(Graceful local outline generator fallback triggered because Gemini API Key is offline or quota-limited)`
    });
  }
}