import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI } from "@google/genai";
import { normalizeBookName, parseSpokenNumbers } from "../../src/bibleDatabase";
import KJV_DATA from "../../src/BibleData/kjv.json";

type KjvVerse = {
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
};

const KJV_VERSES = (KJV_DATA as { verses: KjvVerse[] }).verses;
const KJV_VERSE_INDEX: Record<string, string> = {};
for (const verse of KJV_VERSES) {
  const lookupKey = `${verse.book_name.toLowerCase()} ${verse.chapter}:${verse.verse}`;
  KJV_VERSE_INDEX[lookupKey] = verse.text;
}

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

function getKjvVerseText(book: string, chapter: number, verse: number): string | null {
  const normalized = normalizeBookName(book);
  const key = `${(normalized || book).toLowerCase()} ${chapter}:${verse}`;
  return KJV_VERSE_INDEX[key] || null;
}

function mockRegexDetect(text: string) {
  const bookRegex = /(john|romans|genesis|psalms|proverbs|matthew|luke|acts|revelation|ephesians|hebrews|corinthians|philippians)\s+(\d+)(?:\s+|:|\s+verse\s+)(\d+)/i;
  const match = text.match(bookRegex);
  if (match) {
    const matchedBook = normalizeBookName(match[1]);
    if (matchedBook) {
      return {
        book: matchedBook,
        chapter: parseInt(match[2], 10),
        verse: parseInt(match[3], 10),
        displayName: `${matchedBook} ${match[2]}:${match[3]}`,
        confidence: 90,
      };
    }
  }
  return null;
}

export default async function handler(req: any, res: any) {
  const { transcript } = req.body;

  if (!transcript || transcript.trim() === "") {
    return res.json({
      detected: false,
      reference: null,
      predictions: [],
      alternatives: [],
      sermonTopic: "Live Sermon Listening...",
      summaryNotes: [],
    });
  }

  const processedTranscript = parseSpokenNumbers(transcript);
  const ai = getAiClient();

  if (!ai) {
    const localMatch = mockRegexDetect(processedTranscript);
    return res.json({
      detected: localMatch !== null,
      reference: localMatch,
      predictions: localMatch
        ? [
            {
              book: localMatch.book,
              chapter: localMatch.chapter,
              verse: localMatch.verse + 1,
              displayName: `${localMatch.book} ${localMatch.chapter}:${localMatch.verse + 1}`,
            },
          ]
        : [],
      alternatives: [],
      sermonTopic: "Acoustics Session",
      summaryNotes: ["Listening to live preaching stream...", "Automatic local fallback triggered."],
      error: "Gemini API Key not configured - using local regex fallback.",
    });
  }

  try {
    const systemPrompt = `You are a live church projection AI sermon assistant. Analyzes live speech transcripts.
Goal:
1. Detect if the pastor mentions any Bible scriptures (ranges, explicit single verses, or chapter mentions).
2. Format the primary verse mentioned with book name, chapter number, and verse number.
3. Assess a confidence matching score (0% to 100%).
4. Provide alternatives if ambiguous.
5. Predict exactly 2 likely next verses based on the detected context (for example, if verse 28 is read, verse 29 and 30 are preloaded).
6. Detect the running sermon topic in 2-4 words.
7. Outline a running set of sermon main points so far (up to 3 concise notes).

You MUST strictly reply with a raw JSON object matching the schema below. No markdown wrapping.
Schema:
{
  "detected": true/false,
  "reference": {
    "book": "Name of Book" or null,
    "chapter": number or null,
    "verse": number or null,
    "displayName": "Book Chapter:Verse" or null,
    "confidence": number
  },
  "predictions": [
    { "book": "Book", "chapter": number, "verse": number, "displayName": "Book Chapter:Verse" }
  ],
  "alternatives": [
    { "book": "Book", "chapter": number, "verse": number, "displayName": "Book Chapter:Verse", "confidence": number }
  ],
  "sermonTopic": "String topic",
  "summaryNotes": ["Bullet 1", "Bullet 2"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `Live Speech Transcript:\n"${processedTranscript}"`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text || "{}");
    return res.json(result);
  } catch (error: any) {
    console.error("AI Detect endpoint error:", error);
    const localMatch = mockRegexDetect(processedTranscript);
    return res.json({
      detected: localMatch !== null,
      reference: localMatch,
      predictions: localMatch
        ? [
            {
              book: localMatch.book,
              chapter: localMatch.chapter,
              verse: localMatch.verse + 1,
              displayName: `${localMatch.book} ${localMatch.chapter}:${localMatch.verse + 1}`,
            },
          ]
        : [],
      alternatives: [],
      sermonTopic: "Acoustics Session",
      summaryNotes: ["Listening to live preaching stream...", "Automatic local fallback triggered."],
      error: error.message || "Offline local regex backup utilized.",
    });
  }
}