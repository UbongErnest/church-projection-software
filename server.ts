import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
dotenv.config();

import { GoogleGenAI } from "@google/genai";
import KJV_DATA from "./src/BibleData/kjv.json";
import { normalizeBookName, parseSpokenNumbers } from "./src/bibleDatabase";
import {
  initializeFlutterwaveTransaction,
  normalizeSubscriptionPlan,
  resolveAppUrlFromRequest,
  verifyAndActivatePayment,
  getFlutterwaveSecretKeySafe,
  getSupabaseAdminSafe,
  activateSubscriptionForUser,
} from "./src/server/payments";
import {
  RequestAuthError,
  getAuthenticatedUserProfileFromRequest,
} from "./src/server/userProfiles";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

type KjvVerse = {
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
};

const KJV_VERSES = (KJV_DATA as { verses: KjvVerse[] }).verses;

// Build optimized lookup index from KJV JSON data
const KJV_VERSE_INDEX: Record<string, string> = {};
for (const verse of KJV_VERSES) {
  const lookupKey = `${verse.book_name.toLowerCase()} ${verse.chapter}:${verse.verse}`;
  KJV_VERSE_INDEX[lookupKey] = verse.text;
}

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/api/profile", async (req, res) => {
  try {
    const { profile } = await getAuthenticatedUserProfileFromRequest(req);
    return res.json({ profile });
  } catch (error: any) {
    if (error instanceof RequestAuthError) {
      return res.status(401).json({
        error: "Unauthorized",
        details: error.message,
      });
    }

    console.error("Profile fetch error:", error);
    return res.status(500).json({
      error: "Failed to fetch profile",
      details: error.message,
    });
  }
});

// Lazy-loaded Gemini API Client initialization
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please add it in Settings > Secrets in AI Studio.");
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

// 1. Bible Verse Lookup Endpoint - KJV Only
app.get("/api/bible/lookup", (req, res) => {
  const { book, chapter, verse } = req.query;

  if (!book || !chapter || !verse) {
    return res.status(400).json({ error: "Missing required parameters: book, chapter, verse" });
  }

  console.log(`[API LOOKUP REQUEST] Book: "${book}", Chapter: ${chapter}, Verse: ${verse}`);

  const chNum = parseInt(chapter as string, 10);
  const vNum = parseInt(verse as string, 10);
  const normalizedBook = normalizeBookName(book as string) || (book as string);

  // Attempt local KJV JSON database lookup
  const kjvLookupKey = `${normalizedBook.toLowerCase()} ${chNum}:${vNum}`;
  const kjvText = KJV_VERSE_INDEX[kjvLookupKey];

  if (kjvText) {
    const cleanKjvText = kjvText.trim().replace(/^Â¶\s*/, "");
    return res.json({
      book: normalizedBook,
      chapter: chNum,
      verse: vNum,
      text: {
        KJV: cleanKjvText,
      },
      source: "kjv_json_database",
    });
  }

// Invalid reference - no verse found
   return res.json({
     book: normalizedBook,
     chapter: chNum,
     verse: vNum,
     text: {
       KJV: ".",
     },
     source: "invalid_reference",
   });
});

// 2. AI Real-Time Verse Detection & Sermon Context Annotation Endpoint (Pro/Premium)
app.post("/api/ai/detect", async (req, res) => {
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

  // Quick pre-processing of vocal/spoken books to numbers
  const processedTranscript = parseSpokenNumbers(transcript);

  try {
    const ai = getAiClient();
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
    // Safe heuristic local regex backup
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
      error: error.message || "Offline local regex backup utilized."
    });
  }
});

// Heuristic local matcher for immediate local testing if Gemini key is unset
function mockRegexDetect(text: string) {
  // Simple regex matching: (Book) (Chapter) (:| |verse) (Verse)
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

// AI Copilot Sermon Outline Generator (Premium exclusive)
app.post("/api/ai/copilot", async (req, res) => {
  const action = req.query.action || "outline";
  
  if (action === "bible-ref") {
    const { query } = req.body;
    if (!query || query.trim() === "") {
      return res.json({ error: "No query provided." });
    }

    // Search KJV for partial matches (works without API key)
    const normalizedQuery = query.toLowerCase().trim();
    const matches: Array<{ book: string; chapter: number; verse: number; text: string }> = [];
    
    for (const verse of KJV_VERSES) {
      if (matches.length >= 10) break;
      if (verse.text.toLowerCase().includes(normalizedQuery)) {
        matches.push({
          book: verse.book_name,
          chapter: verse.chapter,
          verse: verse.verse,
          text: verse.text
        });
      }
    }
    
    // Return KJV matches if found (works without API key)
    if (matches.length > 0) {
      return res.json({
        title: "Possible Matches Found",
        scripture: matches.slice(0, 3).map((v) => `${v.book} ${v.chapter}:${v.verse}`).join("\n"),
        summary: matches[0].text,
        relatedScriptures: matches.slice(3).map((v) => `${v.book} ${v.chapter}:${v.verse}`).filter((v, i) => i < 5),
        confidence: "medium"
      });
    }
    
    // Try AI if available
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        title: "No Direct Match Found",
        scripture: "Could not locate exact reference",
        summary: "Try providing more specific details about the story, event, or quote.",
        relatedScriptures: [],
        confidence: "low"
      });
    }
    
    try {
      const ai = getAiClient();
      const systemPrompt = `You are a biblical reference expert. Your task is to identify Bible verses, chapters, and passages from user descriptions, stories, events, partial quotes, or remembered phrases.

Rules:
1. If the user describes a Bible story, identify the story and provide the exact scripture reference.
2. If the user provides part of a verse, find the matching verse.
3. If multiple scriptures match, provide the most relevant ones.
4. Include the Bible book, chapter, and verse.
5. Give a short explanation of the context (1-2 sentences).
6. Be accurate and avoid guessing.
7. If uncertain, provide possible matches and state confidence levels.

Response format (strictly follow this):
Title: [Story or Verse Name]

Scripture:
[Book Chapter:Verse]

Summary:
[Brief explanation]

Related Scriptures:
[List additional references if applicable]`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `User Query: ${query}`,
        config: {
          systemInstruction: systemPrompt,
        }
      });

      return res.json({ bibleReference: response.text || "Could not find reference." });
    } catch (error: any) {
      console.error("Bible Reference endpoint error:", error);
      return res.json({
        title: "Search Error",
        scripture: "Could not complete search",
        summary: "Bible reference search encountered an error.",
        relatedScriptures: [],
        confidence: "low"
      });
    }
  }
  
  if (action === "refine") {
    const { notesContent, topic, sermonContext } = req.body;
    if (!notesContent || notesContent.trim() === "") {
      return res.json({ refined: "No notes provided to refine." });
    }

    // Graceful fallback - works without API key
    const formattedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const structuredNotes = notesContent.split('\n').filter((l: string) => l.trim());
    
    // If no API key, return local structure (works always)
    if (!process.env.GEMINI_API_KEY) {
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

    try {
      const ai = getAiClient();
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

(Graceful local structure generator fallback triggered)`
      });
    }
  }
  
  const { notesContent, topic } = req.body;
  if (!notesContent || notesContent.trim() === "") {
    return res.json({ outline: "No notes provided to generate outline." });
  }

  // Graceful fallback - works without API key
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

  try {
    const ai = getAiClient();
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
});


// Flutterwave payment endpoints - Initialize payment and redirect to payment link
function readJsonBody(body: unknown) {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body && typeof body === "object" ? body : {};
}

app.post("/api/payment/initialize", async (req, res) => {
  const adminMissing = !getSupabaseAdminSafe();
  if (!getFlutterwaveSecretKeySafe() || adminMissing) {
    console.error("[API Initialize] Configuration error: Missing Flutterwave or Supabase config");
    return res.status(500).json({
      error: "Failed to initialize payment",
      details: "Server configuration error: FLUTTERWAVE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is not set",
    });
  }

  try {
    const body = readJsonBody(req.body) as { email?: string; plan?: string; userId?: string };
    const plan = normalizeSubscriptionPlan(body.plan) as "monthly" | "yearly" | null;
    if (!body.email || !body.userId || !plan) {
      return res.status(400).json({ error: "Missing or invalid email, userId, or plan." });
    }

    const callbackUrl = `${resolveAppUrlFromRequest(req)}/api/payment/callback`;
    const transaction = await initializeFlutterwaveTransaction({
      email: body.email,
      plan,
      userId: body.userId,
      callbackUrl,
    });

    return res.status(200).json({
      success: true,
      paymentLink: transaction.link,
      reference: transaction.reference,
    });
  } catch (error: any) {
    console.error("[API Initialize] Error:", error);
    const errorMessage = error.message || "Unknown error occurred";
    const isFlutterwaveError = errorMessage.includes("Flutterwave") || errorMessage.includes("API error");
    return res.status(500).json({
      error: "Failed to initialize payment",
      details: isFlutterwaveError ? `Flutterwave API error: ${errorMessage}` : errorMessage,
    });
  }
});

app.post("/api/payment/verify", async (req, res) => {
  if (!getSupabaseAdminSafe()) {
    console.error("[API Verify] Configuration error: Supabase admin client not configured");
    return res.status(500).json({
      success: false,
      error: "Failed to verify payment",
      stage: "environment_validation",
      details: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set",
    });
  }

  try {
    const body = readJsonBody(req.body) as {
      reference?: string;
      userId?: string;
      plan?: string;
    };

    if (!body.reference) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing payment reference", 
        stage: "validation" 
      });
    }

    const result = await verifyAndActivatePayment({
      reference: body.reference,
      fallbackPlan: normalizeSubscriptionPlan(body.plan),
      fallbackUserId: body.userId,
      logPrefix: "[Flutterwave Verify]",
    });

    if (!result.success) {
      return res.status(200).json({
        success: false,
        status: result.flutterwaveStatus || "pending",
        flutterwaveStatus: result.flutterwaveStatus,
        message: result.message,
        stage: result.flutterwaveStatus ? "flutterwave_verification" : "supabase_check",
      });
    }

    return res.status(200).json({
      success: true,
      status: "active",
      flutterwaveStatus: result.flutterwaveStatus,
      plan: result.plan,
      subscriptionEnd: result.subscriptionEnd,
      reference: body.reference,
    });
  } catch (error: any) {
    console.error("[API Verify] Error:", {
      message: error.message,
      stack: error.stack,
      stage: error.stage || "unknown",
    });
    return res.status(500).json({
      success: false,
      error: "Failed to verify payment",
      stage: error.stage || "unknown",
      details: error.message || "Unknown error occurred",
    });
  }
});

app.get("/api/payment/callback", async (req, res) => {
  const reference = req.query.tx_ref || req.query.reference;

  if (!reference || typeof reference !== "string") {
    return res.redirect("/?payment=error");
  }

  return res.redirect(`/?payment=verify&reference=${encodeURIComponent(reference)}`);
});

// Flutterwave webhook for async payment confirmation
app.post("/api/webhook/flutterwave", async (req, res) => {
  const signature = req.headers["verif-hash"] as string;
  const secret = process.env.FLUTTERWAVE_SECRET_KEY || "";

  if (signature && secret) {
    console.log("[Flutterwave Webhook] Received signature:", signature.substring(0, 20) + "...");
  }

  const { data } = req.body || {};
  const dataStatus = typeof data?.status === "string" ? data.status : undefined;
  const reference = typeof data?.tx_ref === "string" ? data.tx_ref : undefined;

  console.log("[Flutterwave Webhook] Event data:", { 
    status: dataStatus, 
    tx_ref: reference, 
    meta: data?.meta 
  });

  // Only process successful transactions
  if (dataStatus !== "successful") {
    console.log("[Flutterwave Webhook] Transaction not successful, skipping:", dataStatus);
    return res.status(200).json({ received: true, status: "skipped_non_successful" });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[Flutterwave Webhook] Supabase credentials not configured");
    return res.status(500).json({ 
      received: false, 
      error: "Server configuration error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing" 
    });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Idempotency check - if already processed, skip
  if (reference) {
    const { data: existingRecord } = await supabase
      .from("transactions")
      .select("flutterwave_status")
      .eq("reference", reference)
      .single();

    if (existingRecord?.flutterwave_status === "success") {
      console.log("[Flutterwave Webhook] Transaction already processed, idempotency check passed");
      return res.status(200).json({ received: true, status: "already_processed" });
    }
  }

  const meta = (data?.meta || {}) as Record<string, unknown>;
  let userId: string | undefined;
  let planValue: string | undefined;
  
  // Case-insensitive search for userId and plan
  for (const key of Object.keys(meta)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "userid") {
      userId = typeof meta[key] === "string" ? meta[key] : undefined;
    }
    if (lowerKey === "plan") {
      planValue = typeof meta[key] === "string" ? meta[key] : undefined;
    }
  }
  
  const plan = normalizeSubscriptionPlan(planValue);

  console.log("[Flutterwave Webhook] Processing - userId:", userId, "plan:", plan, "meta keys:", Object.keys(meta));

  if (!userId) {
    console.error("[Flutterwave Webhook] Missing userId in webhook meta");
    return res.status(200).json({ received: true, status: "skipped_missing_userid" });
  }

  if (!plan) {
    console.error("[Flutterwave Webhook] Missing or invalid plan in webhook meta");
    return res.status(200).json({ received: true, status: "skipped_missing_plan" });
  }

  try {
    // Record/update transaction
    if (reference) {
      const amount = typeof data?.amount === "number" ? data.amount : 0;
      const customerEmail = typeof (data?.customer as { email?: string })?.email === "string" 
        ? (data?.customer as { email?: string }).email 
        : undefined;

      console.log("[Supabase] Recording/updating webhook transaction:", { reference, userId, plan, amount });

      await supabase
        .from("transactions")
        .upsert({
          reference,
          user_id: userId,
          plan,
          amount,
          currency: typeof data?.currency === "string" ? data.currency : "NGN",
          email: customerEmail,
          status: "success",
          flutterwave_status: "success",
          verified_at: new Date().toISOString(),
          webhook_received_at: new Date().toISOString(),
        }, {
          onConflict: "reference",
        });
    }

    // Activate subscription
    const { subscriptionEnd } = await activateSubscriptionForUser(userId, plan);
    console.log("[Flutterwave Webhook] Activated subscription for user:", userId, "plan:", plan, "ends:", subscriptionEnd);
  } catch (error: any) {
    console.error("[Flutterwave Webhook] Failed to activate subscription:", {
      message: error.message,
      stack: error.stack,
    });
  }

  return res.status(200).json({ received: true, status: "processed" });
});

// 3. Mount Vite or serve static production folder
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Church Projections full stack server is active on http://0.0.0.0:${PORT}`);
  });
}

startServer();


// Test endpoint to verify environment configuration
app.get("/api/debug/env", (_req, res) => {
   const hasFlutterwave = !!process.env.FLUTTERWAVE_SECRET_KEY;
   const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
   const flutterwaveValid = hasFlutterwave && process.env.FLUTTERWAVE_SECRET_KEY?.startsWith("FLW");
   const supabaseKeyValid = process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith("eyJ");
   
   res.json({
     hasFlutterwaveKey: hasFlutterwave,
     flutterwaveKeyFormat: flutterwaveValid ? "valid" : "invalid-or-missing",
     hasSupabaseConfig: hasSupabase,
     supabaseKeyFormat: supabaseKeyValid ? "valid-jwt" : "invalid-or-missing",
     appUrl: process.env.APP_URL || "not-set",
   });
 });

// Email diagnostics endpoint - for logging and debugging SMTP/email issues
app.post("/api/email/diagnostic", async (req, res) => {
  console.log("[EMAIL DIAGNOSTIC] Received diagnostic report:", {
    type: req.query.type,
    email: req.body?.email,
    timestamp: new Date().toISOString(),
    userAgent: req.get("User-Agent")
  });
  
  // Log to help diagnose SMTP issues
  const body = req.body;
  if (body?.error) {
    console.error("[EMAIL DIAGNOSTIC] Error details:", {
      error: body.error,
      message: body.message,
      statusCode: body.statusCode,
      hint: body.hint
    });
  }
  
  return res.status(200).json({ received: true });
});
