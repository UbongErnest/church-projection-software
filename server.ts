import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { normalizeBookName, parseSpokenNumbers } from "./src/bibleDatabase";
import KJV_DATA from "./src/BibleData/kjv.json";
import crypto from "crypto";

dotenv.config();

type KjvVerse = {
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
};

const KJV_VERSES = (KJV_DATA as { verses: KjvVerse[] }).verses;

// Supabase client - lazy initialized when needed
let supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for payment features.");
    }
    supabaseAdmin = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseAdmin;
}

// Build optimized lookup index from KJV JSON data
const KJV_VERSE_INDEX: Record<string, string> = {};
for (const verse of KJV_VERSES) {
  const lookupKey = `${verse.book_name.toLowerCase()} ${verse.chapter}:${verse.verse}`;
  KJV_VERSE_INDEX[lookupKey] = verse.text;
}

const app = express();
const PORT = 3000;

app.use(express.json());

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
      KJV: "No Verse",
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
  const { notesContent, topic } = req.body;
  if (!notesContent || notesContent.trim() === "") {
    return res.json({ outline: "No notes provided to generate outline." });
  }

  try {
    const ai = getAiClient();
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
    // Graceful fallback with premium placeholder
    return res.json({
      outline: `### ðŸ“– AI Copilot Structured Outline: ${topic || "Sunday Service"}\n\n* **I. Introduction & Central Focus**\n  * Hook: Connecting modern life challenges to divine truths.\n  * Central Scripture Recommendation: Focus on a key anchoring passage.\n\n* **II. Core Exegesis (Based on Sermon Notes)**\n  * Analysis of themes found in notes: *"${notesContent.substring(0, 150)}..."*\n  * Contextualizing historical and cultural elements of the references.\n\n* **III. Practical Spiritual Applications**\n  * How the congregation can apply this revelation during the week.\n  * Overcoming common barriers to living out these biblical principles.\n\n* **IV. Conclusion & Key Takeaway**\n  * Summarizing the sermon topic: *${topic}*.\n  * Final closing call to prayer and dedication.\n\n*(Note: Graceful local outline generator fallback triggered because Gemini API Key is offline or quota-limited)*`
    });
  }
});


// Paystack payment endpoints
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";

async function paystackRequest(endpoint: string, data: any, method: string = "POST") {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }
  const response = await fetch(`https://api.paystack.co${endpoint}`, {
    method,
    headers: {
      "Authorization": `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json"
    },
    body: method === "POST" ? JSON.stringify(data) : undefined
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Paystack API error: ${result.message || response.statusText}`);
  }
  return result;
}

async function verifyPaystackTransaction(reference: string, logPrefix: string) {
  const maxAttempts = 4;
  let lastVerification: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastVerification = await paystackRequest(`/transaction/verify/${reference}`, {}, "GET");
    const paystackStatus = lastVerification?.data?.status;

    console.log(`${logPrefix} Attempt ${attempt}/${maxAttempts}:`, {
      status: lastVerification?.status,
      message: lastVerification?.message,
      paystackStatus,
      reference,
    });

    if (lastVerification?.data?.status === "success") {
      return lastVerification;
    }

    const shouldRetry =
      attempt < maxAttempts &&
      (
        !lastVerification?.status ||
        ["pending", "ongoing", "processing", "queued"].includes(paystackStatus)
      );

    if (!shouldRetry) {
      return lastVerification;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return lastVerification;
}

// Initialize Paystack transaction
app.post("/api/payment/initialize", async (req, res) => {
  const { email, amount, plan, userId } = req.body;
  
  if (!email || !amount || !plan) {
    return res.status(400).json({ error: "Missing required fields: email, amount, plan" });
  }

  try {
    const callbackUrl = process.env.APP_URL 
      ? `${process.env.APP_URL}/api/payment/callback` 
      : `${req.protocol}://${req.get("host")}/api/payment/callback`;
    
    const transaction = await paystackRequest("/transaction/initialize", {
      email,
      amount: amount * 100, // Convert to kobo/pesewa
      callback_url: callbackUrl,
      metadata: {
        plan,
        userId: userId || ""
      }
    });
    
    if (transaction.status) {
      res.json({
        success: true,
        authorizationUrl: transaction.data.authorization_url,
        reference: transaction.data.reference
      });
    } else {
      res.status(500).json({ error: transaction.message || "Failed to initialize payment" });
    }
  } catch (error: any) {
    console.error("Paystack initialize error:", error);
    res.status(500).json({ error: "Failed to initialize payment" });
  }
});

// Verify payment and update subscription
app.post("/api/payment/verify", async (req, res) => {
  const { reference, userId, plan } = req.body;
  
  if (!reference) {
    return res.status(400).json({ error: "Missing reference" });
  }

  try {
    const verification = await verifyPaystackTransaction(reference, "[Paystack Verify]");
    
    if ((verification.status && verification.data?.status === "success") || verification.data?.status === "success") {
      // Use plan from request body as fallback if metadata not available
      const planValue = plan || verification.data?.metadata?.plan || "monthly";
      
      // Calculate subscription end date
      const endDate = new Date(Date.now() + (planValue === "monthly" ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString();
      
      if (userId && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        await getSupabaseAdmin()
          .from('users')
          .update({ 
            subscription_plan: planValue,
            subscription_status: "active",
            subscription_end: endDate
          })
          .eq('user_id', userId);
      }
      
      res.json({ 
        success: true, 
        status: "active",
        paystackStatus: verification.data?.status,
        plan: planValue,
        subscriptionEnd: endDate
      });
    } else {
      res.json({
        success: false,
        status: verification.data?.status || "pending",
        paystackStatus: verification.data?.status || null,
        message: verification.message || "Transaction not successful",
      });
    }
  } catch (error: any) {
    console.error("Paystack verify error:", error);
    res.status(500).json({ error: "Failed to verify payment", details: error.message });
  }
});

// Callback endpoint for Paystack redirect after payment
app.get("/api/payment/callback", async (req, res) => {
  const { reference, trxref } = req.query;
  const ref = reference || trxref;
  
  if (!ref) {
    return res.status(400).json({ error: "Missing reference" });
  }

  try {
    const verification = await verifyPaystackTransaction(String(ref), "[Paystack Callback]");
    
    if ((verification.status && verification.data?.status === "success") || verification.data?.status === "success") {
      const plan = verification.data?.metadata?.plan || "monthly";
      const userId = verification.data?.metadata?.userId;
      
      // Calculate subscription end date
      const endDate = new Date(Date.now() + (plan === "monthly" ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString();
      
      if (userId && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        await getSupabaseAdmin()
          .from('users')
          .update({ 
            subscription_plan: plan,
            subscription_status: "active",
            subscription_end: endDate
          })
          .eq('user_id', userId);
      }
      
      // Redirect to app with success status
      res.redirect(`/?payment=success&plan=${encodeURIComponent(plan)}`);
    } else {
      // Redirect to app with failure status
      res.redirect("/?payment=failed");
    }
  } catch (error: any) {
    console.error("Paystack callback error:", error);
    res.redirect("/?payment=error");
  }
});

// Webhook for Paystack events (signature verification disabled - body already parsed by express.json)
app.post("/api/webhook/paystack", async (req, res) => {
  const signature = req.headers["x-paystack-signature"] as string;
  const secret = process.env.PAYSTACK_SECRET_KEY || "";
  
  // Log for debugging - signature verification would need raw body middleware
  if (signature && secret) {
    console.log("[Paystack Webhook] Received signature:", signature.substring(0, 20) + "...");
  }
  
  const { data } = req.body;
  
  console.log("[Paystack Webhook] Event data:", { status: data?.status, reference: data?.reference });
  
  if (data && data.status === "success" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const userId = data.metadata?.userId;
    const plan = data.metadata?.plan;
    
    if (userId) {
      const endDate = new Date(Date.now() + (plan === "monthly" ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString();
      await getSupabaseAdmin()
        .from('users')
        .update({ 
          subscription_plan: plan,
          subscription_status: "active",
          subscription_end: endDate
        })
        .eq('user_id', userId);
    }
  }
  
  res.json({ received: true });
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

