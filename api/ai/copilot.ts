import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI } from "@google/genai";

// For serverless, use a minimal set of common verses instead of full KJV
const COMMON_VERSES: Array<{ book: string; chapter: number; verse: number; text: string }> = [
  { book: "John", chapter: 3, verse: 16, text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." },
  { book: "Jeremiah", chapter: 29, verse: 11, text: "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end." },
  { book: "Romans", chapter: 8, verse: 28, text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose." },
  { book: "Psalms", chapter: 23, verse: 1, text: "The LORD is my shepherd; I shall not want." },
  { book: "Philippians", chapter: 4, verse: 13, text: "I can do all things through Christ which strengtheneth me." },
  { book: "Proverbs", chapter: 3, verse: 5, text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding." },
  { book: "Matthew", chapter: 11, verse: 28, text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest." },
  { book: "Isaiah", chapter: 40, verse: 31, text: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles." },
  { book: "Genesis", chapter: 1, verse: 1, text: "In the beginning God created the heaven and the earth." },
  { book: "Exodus", chapter: 20, verse: 11, text: "For in six days the LORD made heaven and earth, and all the host of them, and rested the seventh day." },
  { book: "Psalms", chapter: 1, verse: 1, text: "Blessed is the man that walketh not in the counsel of the ungodly." },
  { book: "Proverbs", chapter: 3, verse: 6, text: "In all thy ways acknowledge him, and he shall direct thy paths." },
  { book: "Matthew", chapter: 5, verse: 5, text: "Blessed are the meek: for they shall inherit the earth." },
  { book: "Luke", chapter: 6, verse: 38, text: "Give, and it shall be given unto you; good measure, pressed down, and shaken together, and running over." },
  { book: "John", chapter: 14, verse: 6, text: "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me." },
  { book: "1 Corinthians", chapter: 10, verse: 13, text: "There hath no temptation taken you but such as is common to man." },
  { book: "Revelation", chapter: 22, verse: 21, text: "The grace of our Lord Jesus Christ be with you all. Amen." },
  { book: "Genesis", chapter: 12, verse: 1, text: "Now the LORD had said unto Abram, Get thee out of thy country, and from thy kindred, and from thy father house." },
  { book: "Exodus", chapter: 14, verse: 14, text: "The LORD shall fight for you, and you shall hold your peace." },
  { book: "Leviticus", chapter: 19, verse: 18, text: "Thou shalt not avenge, nor bear any grudge against the children of thy people." },
  { book: "Deuteronomy", chapter: 6, verse: 5, text: "Thou shalt love the LORD thy God with all thine heart, and with all thy soul." },
  { book: "Joshua", chapter: 1, verse: 9, text: "Have not I commanded thee? Be strong and courageous." },
  { book: "Judges", chapter: 6, verse: 12, text: "And the angel of the LORD appeared unto him, and said unto him, The LORD is with thee." },
  { book: "Ruth", chapter: 1, verse: 16, text: "Ruth said, Entreat me not to leave thee, or to turn back from following thee." },
  { book: "1 Samuel", chapter: 16, verse: 7, text: "The LORD seeth not as man seeth; for man looketh on the outward appearance." },
  { book: "Job", chapter: 1, verse: 21, text: "Naked came I out of my mother in-door, and naked shall I return thither." },
  { book: "Psalms", chapter: 139, verse: 14, text: "I will praise thee; for I am fearfully and wonderfully made." },
  { book: "Ecclesiastes", chapter: 3, verse: 1, text: "To every thing there is a season, and a time to every purpose under the heaven." },
  { book: "Song of Solomon", chapter: 2, verse: 4, text: "He brought me to the house of wine, and his banner over me was love." },
  { book: "Isaiah", chapter: 9, verse: 6, text: "For unto us a child is born, unto us a son is given." },
  { book: "Jeremiah", chapter: 31, verse: 33, text: "I will make a new covenant with the house of Israel." },
  { book: "Lamentations", chapter: 3, verse: 22, text: "The LORD's mercies are new every morning." },
  { book: "Ezekiel", chapter: 36, verse: 26, text: "A new heart also will I give you, and a new spirit will I put within you." },
  { book: "Daniel", chapter: 6, verse: 27, text: "The God whom ye serve is able to deliver you." },
  { book: "Hosea", chapter: 6, verse: 6, text: "For I desired mercy, and not sacrifice; and the knowledge of God more than burnt offering." },
  { book: "Joel", chapter: 2, verse: 28, text: "And it shall come to pass afterward, I will pour out my spirit upon all flesh." },
  { book: "Amos", chapter: 5, verse: 24, text: "Let judgment run down as waters, and righteousness as a mighty stream." },
  { book: "Micah", chapter: 6, verse: 8, text: "He hath shewed thee, O man, what is good; and what doth the LORD require of thee." },
  { book: "Habakkuk", chapter: 2, verse: 4, text: "The just shall live by faith." },
  { book: "Zephaniah", chapter: 3, verse: 17, text: "The LORD thy God in the midst of thee; he will rejoice over thee with joy." },
  { book: "Malachi", chapter: 4, verse: 2, text: "But unto you that fear my name shall the Sun of righteousness arise." },
  { book: "Matthew", chapter: 28, verse: 19, text: "Go ye therefore, and teach all nations, baptizing them in the name of the Father." },
  { book: "Mark", chapter: 12, verse: 31, text: "Thou shalt love thy neighbor as thyself." },
  { book: "Luke", chapter: 24, verse: 6, text: "He is not here, but is risen." },
  { book: "John", chapter: 1, verse: 1, text: "In the beginning was the Word, and the Word was with God." },
  { book: "Acts", chapter: 2, verse: 38, text: "Repent, and be baptized every one of you in the name of Jesus Christ." },
  { book: "Romans", chapter: 5, verse: 8, text: "But God commendeth his love toward us, in that, when we were yet sinners." },
  { book: "1 Corinthians", chapter: 13, verse: 4, text: "Charity suffereth long, and is kind; charity envieth not." },
  { book: "2 Corinthians", chapter: 5, verse: 17, text: "Therefore if any man be in Christ, he is a new creature." },
  { book: "Galatians", chapter: 5, verse: 22, text: "The fruit of the Spirit is love, joy, peace, longsuffering." },
  { book: "Ephesians", chapter: 2, verse: 8, text: "For by grace are ye saved through faith; and that not of yourselves." },
  { book: "Philippians", chapter: 4, verse: 19, text: "But my God shall supply all your need." },
  { book: "Colossians", chapter: 3, verse: 23, text: "Whatsoever ye do, do it heartily, as to the Lord." },
  { book: "1 Thessalonians", chapter: 5, verse: 17, text: "Pray without ceasing." },
  { book: "2 Thessalonians", chapter: 3, verse: 16, text: "The Lord of peace himself give you peace by all means." },
  { book: "1 Timothy", chapter: 4, verse: 12, text: "Let no man despise thy youth; but be thou an example." },
  { book: "2 Timothy", chapter: 3, verse: 16, text: "All scripture is given by inspiration of God." },
  { book: "Titus", chapter: 2, verse: 11, text: "The grace of God that bringeth salvation hath appeared to all men." },
  { book: "Hebrews", chapter: 11, verse: 1, text: "Now faith is the substance of things hoped for, the evidence of things not seen." },
  { book: "James", chapter: 1, verse: 5, text: "If any of you lack wisdom, let him ask of God." },
  { book: "1 Peter", chapter: 5, verse: 7, text: "Casting all your care upon him; for he careth for you." },
  { book: "2 Peter", chapter: 3, verse: 9, text: "The Lord is not slack concerning his promise." },
  { book: "1 John", chapter: 4, verse: 8, text: "God is love; and he that dwelleth in love dwelleth in God." },
  { book: "Jude", chapter: 1, verse: 25, text: "To the only wise God our Saviour, be glory through Jesus Christ." },
  { book: "Revelation", chapter: 21, verse: 4, text: "He will wipe away all tears from their eyes." }
];

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

// Search common verses for text matches
function searchVerses(query: string): Array<{ book: string; chapter: number; verse: number; text: string }> {
  return COMMON_VERSES.filter(v => v.text.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
}

// Check for book name mentions
function findBookVerses(query: string): Array<{ book: string; chapter: number; verse: number; text: string }> {
  const bookPattern = /\b(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|1\s?samuel|2\s?samuel|1\s?kings|2\s?kings|1\s?chronicles|2\s?chronicles|ezra|nehemiah|esther|job|psalms|proverbs|ecclesiastes|song\s?of\s?songs|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|1\s?corinthians|2\s?corinthians|galatians|ephesians|philippians|colossians|1\s?thessalonians|2\s?thessalonians|1\s?timothy|2\s?timothy|1\s?peter|2\s?peter|1\s?john|2\s?john|3\s?john|jude|revelation)\b/i;
  
  if (bookPattern.test(query)) {
    const bookMatch = query.match(bookPattern);
    const matchedBook = bookMatch?.[0].toLowerCase().replace(/\s/g, " ");
    return COMMON_VERSES.filter(v => v.book.toLowerCase().includes(matchedBook)).slice(0, 5);
  }
  return [];
}

export default async function handler(req: any, res: any) {
  const action = req.query.action || "outline";

  // Bible Reference chat - AI-powered conversation about scripture
  if (action === "bibleref-chat") {
    const { messages, newMessage } = req.body;

    // Local search fallback
    const normalizedQuery = newMessage?.toLowerCase().trim() || "";
    let localMatches = searchVerses(normalizedQuery);
    
    if (localMatches.length === 0) {
      localMatches = findBookVerses(normalizedQuery);
    }

    // If no API key, return local response
    if (!process.env.GEMINI_API_KEY) {
      const botReply = localMatches.length > 0
        ? `**Scripture Reference Found:**\n\n${localMatches.map(v => `${v.book} ${v.chapter}:${v.verse}\n"${v.text}"`).join("\n\n")}\n\n— Local KJV Search (AI unavailable)`
        : `I couldn't locate that specific scripture. Try:\n• Book names (John, Psalms, Romans)\n• Key phrases (love, faith, grace)\n• Well-known verses (John 3:16)\n\n— Local Search Mode`;

      const updatedMessages = [...(messages || []), { role: "user", content: newMessage }, { role: "assistant", content: botReply }];
      return res.json({ messages: updatedMessages });
    }

    const ai = getAiClient();
    if (!ai) {
      const botReply = localMatches.length > 0
        ? `**Scripture Reference Found:**\n\n${localMatches.map(v => `${v.book} ${v.chapter}:${v.verse}\n"${v.text}"`).join("\n\n")}`
        : `No direct match found. Try searching for book names or phrases.`;
      const updatedMessages = [...(messages || []), { role: "user", content: newMessage }, { role: "assistant", content: botReply }];
      return res.json({ messages: updatedMessages });
    }

    try {
      const conversationHistory = (messages || []).map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          ...conversationHistory,
          { role: "user", parts: [{ text: newMessage }] }
        ],
        config: {
          systemInstruction: `You are a Bible scholar and theological assistant for the "Church Projection Software" (Chaver app). Help users find scriptures, explain biblical concepts, and discuss biblical stories. Always cite KJV scriptures when relevant.

APP NAVIGATION & FEATURES:
- Operator View (main): Control panel on left, projector output on right
- Projector View: Access via #projector URL hash or Control Panel top bar - shows full-screen scripture/lyrics
- Speech Simulator: Click phrases to test verse detection without microphone (right panel tab)
- Live Listening: Requires Monthly+ subscription, uses Web Speech API for real-time transcription
- Notes Journal: Save sermon notes to Supabase cloud, export as Markdown or PDF
- AI Copilot: Yearly subscription-only - generates sermon outlines and structures notes
- Bible Reference AI: Yearly subscription-only - chat about scriptures and biblical topics
- Layout Modes: fullscreen, lower-third, split-screen (settings in control panel)
- Themes: nebula-dark (default), plus other presets (customizer in control panel)
- Plans Tab: Upgrade to Monthly for live listening, Yearly for AI features

Be concise and helpful. Avoid markdown headers (#), roman numerals, and complex formatting. Use simple bullet points and bold text (**text**) sparingly for emphasis.`
        }
      });

      const botReply = response.text || "I couldn't retrieve that scripture reference.";
      const updatedMessages = [...(messages || []), { role: "user", content: newMessage }, { role: "assistant", content: botReply }];
      return res.json({ messages: updatedMessages });
    } catch (error: any) {
      console.error("Bible Reference chat error:", error);
      const botReply = `Scripture lookup error. Using local search:\n\n${localMatches.length > 0 ? localMatches.map(v => `${v.book} ${v.chapter}:${v.verse}\n"${v.text}"`).join("\n\n") : "No matches found."}`;
      const updatedMessages = [...(messages || []), { role: "user", content: newMessage }, { role: "assistant", content: botReply }];
      return res.json({ messages: updatedMessages });
    }
  }

  // Legacy bible-ref endpoint
  if (action === "bible-ref") {
    const { query } = req.body;

    if (!query || query.trim() === "") {
      return res.json({ error: "No query provided." });
    }

    const matches = searchVerses(query);

    if (matches.length === 0) {
      return res.json({
        title: "No Direct Match Found",
        scripture: "Could not locate exact reference",
        summary: "Try providing more specific details about the story, event, or quote.",
        relatedScriptures: [],
        confidence: "low"
      });
    }

    return res.json({
      title: "Possible Matches Found",
      scripture: matches.slice(0, 3).map((v) => `${v.book} ${v.chapter}:${v.verse}`).join("\n"),
      summary: matches[0].text,
      relatedScriptures: matches.slice(3).map((v) => `${v.book} ${v.chapter}:${v.verse}`),
      confidence: "medium"
    });
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