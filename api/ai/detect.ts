import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI } from "@google/genai";
import KJV_DATA from "../../BibleData/kjv.json";

type KjvVerse = {
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
};

const BIBLE_BOOKS = [
  { name: "Genesis", aliases: ["gen", "ge", "gn"], chapters: 50 },
  { name: "Exodus", aliases: ["ex", "exod"], chapters: 40 },
  { name: "Leviticus", aliases: ["lev", "lv"], chapters: 27 },
  { name: "Numbers", aliases: ["num", "nm", "nb"], chapters: 36 },
  { name: "Deuteronomy", aliases: ["deut", "dt"], chapters: 34 },
  { name: "Joshua", aliases: ["josh", "jos"], chapters: 24 },
  { name: "Judges", aliases: ["judg", "jdg", "jg"], chapters: 21 },
  { name: "Ruth", aliases: ["ruth", "ru", "rt"], chapters: 4 },
  { name: "1 Samuel", aliases: ["1 sam", "1sam", "first samuel", "1st samuel", "1st sam"], chapters: 31 },
  { name: "2 Samuel", aliases: ["2 sam", "2sam", "second samuel", "2nd samuel", "2nd sam"], chapters: 24 },
  { name: "1 Kings", aliases: ["1 ki", "1ki", "first kings", "1st kings", "1st ki"], chapters: 22 },
  { name: "2 Kings", aliases: ["2 ki", "2ki", "second kings", "2nd kings", "2nd ki"], chapters: 25 },
  { name: "1 Chronicles", aliases: ["1 chr", "1chr", "first chronicles", "1st chronicles", "1st chr"], chapters: 29 },
  { name: "2 Chronicles", aliases: ["2 chr", "2chr", "second chronicles", "2nd chronicles", "2nd chr"], chapters: 36 },
  { name: "Ezra", aliases: ["ezr"], chapters: 10 },
  { name: "Nehemiah", aliases: ["neh", "ne"], chapters: 13 },
  { name: "Esther", aliases: ["esth", "est", "es"], chapters: 10 },
  { name: "Job", aliases: ["jb"], chapters: 42 },
  { name: "Psalms", aliases: ["psalm", "ps", "pss"], chapters: 150 },
  { name: "Proverbs", aliases: ["prov", "pr"], chapters: 31 },
  { name: "Ecclesiastes", aliases: ["eccl", "ecc", "ec"], chapters: 12 },
  { name: "Song of Solomon", aliases: ["song", "so", "canticles", "canticle of canticles"], chapters: 8 },
  { name: "Isaiah", aliases: ["isa", "is"], chapters: 66 },
  { name: "Jeremiah", aliases: ["jer", "jr"], chapters: 52 },
  { name: "Lamentations", aliases: ["lam", "lm"], chapters: 5 },
  { name: "Ezekiel", aliases: ["ezek", "ez", "eze"], chapters: 48 },
  { name: "Daniel", aliases: ["dan", "dn", "dl"], chapters: 12 },
  { name: "Hosea", aliases: ["hos", "hs"], chapters: 14 },
  { name: "Joel", aliases: ["jl"], chapters: 3 },
  { name: "Amos", aliases: ["am"], chapters: 9 },
  { name: "Obadiah", aliases: ["obad", "ob"], chapters: 1 },
  { name: "Jonah", aliases: ["jonah", "jon"], chapters: 4 },
  { name: "Micah", aliases: ["mic", "mc"], chapters: 7 },
  { name: "Nahum", aliases: ["nah", "na"], chapters: 3 },
  { name: "Habakkuk", aliases: ["hab", "hb"], chapters: 3 },
  { name: "Zephaniah", aliases: ["zeph", "zph", "zp"], chapters: 3 },
  { name: "Haggai", aliases: ["hag", "hg"], chapters: 2 },
  { name: "Zechariah", aliases: ["zech", "zec", "zc"], chapters: 14 },
  { name: "Malachi", aliases: ["mal", "ml"], chapters: 4 },
  { name: "Matthew", aliases: ["matt", "mt"], chapters: 28 },
  { name: "Mark", aliases: ["mrk", "mk"], chapters: 16 },
  { name: "Luke", aliases: ["luk", "lk"], chapters: 24 },
  { name: "John", aliases: ["jhn", "jn"], chapters: 21 },
  { name: "Acts", aliases: ["act", "ac"], chapters: 28 },
  { name: "Romans", aliases: ["rom", "ro", "rm"], chapters: 16 },
  { name: "1 Corinthians", aliases: ["1 cor", "1cor", "first corinthians", "1st corinthians", "1st cor", "1st corinthians"], chapters: 16 },
  { name: "2 Corinthians", aliases: ["2 cor", "2cor", "second corinthians", "2nd corinthians", "2nd cor", "2nd corinthians"], chapters: 13 },
  { name: "Galatians", aliases: ["gal", "ga", "gl"], chapters: 6 },
  { name: "Ephesians", aliases: ["eph", "ep"], chapters: 6 },
  { name: "Philippians", aliases: ["phil", "php", "pp"], chapters: 4 },
  { name: "Colossians", aliases: ["col", "cl"], chapters: 4 },
  { name: "1 Thessalonians", aliases: ["1 thes", "1thess", "first thessalonians", "1st thessalonians", "1st thes"], chapters: 5 },
  { name: "2 Thessalonians", aliases: ["2 thes", "2thess", "second thessalonians", "2nd thessalonians", "2nd thes"], chapters: 3 },
  { name: "1 Timothy", aliases: ["1 tim", "1tim", "first timothy", "1st timothy", "1st tim"], chapters: 6 },
  { name: "2 Timothy", aliases: ["2 tim", "2tim", "second timothy", "2nd timothy", "2nd tim"], chapters: 4 },
  { name: "Titus", aliases: ["tit", "ti", "ts"], chapters: 3 },
  { name: "Philemon", aliases: ["philem", "phm"], chapters: 1 },
  { name: "Hebrews", aliases: ["heb", "hb"], chapters: 13 },
  { name: "James", aliases: ["jas", "jm"], chapters: 5 },
  { name: "1 Peter", aliases: ["1 pet", "1pet", "first peter", "1st peter", "1st pet"], chapters: 5 },
  { name: "2 Peter", aliases: ["2 pet", "2pet", "second peter", "2nd peter", "2nd pet"], chapters: 3 },
  { name: "1 John", aliases: ["1 jn", "1jn", "first john", "1st john", "1st jn"], chapters: 5 },
  { name: "2 John", aliases: ["2 jn", "2jn", "second john", "2nd john", "2nd jn"], chapters: 1 },
  { name: "3 John", aliases: ["3 jn", "3jn", "third john", "3rd john", "3rd jn"], chapters: 1 },
  { name: "Jude", aliases: ["jud", "jd"], chapters: 1 },
  { name: "Revelation", aliases: ["rev", "revelations", "apocalypse"], chapters: 22 }
];

function normalizeBookName(input: string): string | null {
  const normalized = input.toLowerCase().trim()
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ');
  
  for (const book of BIBLE_BOOKS) {
    if (book.name.toLowerCase() === normalized) {
      return book.name;
    }
    for (const alias of book.aliases) {
      if (alias === normalized) {
        return book.name;
      }
    }
  }
  return null;
}

function parseSpokenNumbers(input: string): string {
  return input
    .replace(/first\s+corinthians/gi, "1 Corinthians")
    .replace(/second\s+corinthians/gi, "2 Corinthians")
    .replace(/first\s+samuel/gi, "1 Samuel")
    .replace(/second\s+samuel/gi, "2 Samuel")
    .replace(/first\s+kings/gi, "1 Kings")
    .replace(/second\s+kings/gi, "2 Kings")
    .replace(/first\s+chronicles/gi, "1 Chronicles")
    .replace(/second\s+chronicles/gi, "2 Chronicles")
    .replace(/first\s+thessalonians/gi, "1 Thessalonians")
    .replace(/second\s+thessalonians/gi, "2 Thessalonians")
    .replace(/first\s+timothy/gi, "1 Timothy")
    .replace(/second\s+timothy/gi, "2 Timothy")
    .replace(/first\s+peter/gi, "1 Peter")
    .replace(/second\s+peter/gi, "2 Peter")
    .replace(/first\s+john/gi, "1 John")
    .replace(/second\s+john/gi, "2 John")
    .replace(/third\s+john/gi, "3 John")
    .replace(/1st\s+corinthians/gi, "1 Corinthians")
    .replace(/2nd\s+corinthians/gi, "2 Corinthians")
    .replace(/1st\s+samuel/gi, "1 Samuel")
    .replace(/2nd\s+samuel/gi, "2 Samuel")
    .replace(/1st\s+kings/gi, "1 Kings")
    .replace(/2nd\s+kings/gi, "2 Kings")
    .replace(/1st\s+thessalonians/gi, "1 Thessalonians")
    .replace(/2nd\s+thessalonians/gi, "2 Thessalonians")
    .replace(/1st\s+timothy/gi, "1 Timothy")
    .replace(/2nd\s+timothy/gi, "2 Timothy")
    .replace(/1st\s+peter/gi, "1 Peter")
    .replace(/2nd\s+peter/gi, "2 Peter")
    .replace(/1st\s+john/gi, "1 John")
    .replace(/2nd\s+john/gi, "2 John")
    .replace(/3rd\s+john/gi, "3 John");
}

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
      model: "gemini-2.0-flash",
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