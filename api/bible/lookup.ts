import dotenv from "dotenv";
dotenv.config();

import { normalizeBookName } from "../../src/bibleDatabase";
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
  const { book, chapter, verse } = req.query;

  if (!book || !chapter || !verse) {
    return res.status(400).json({ error: "Missing required parameters: book, chapter, verse" });
  }

  console.log(`[API LOOKUP REQUEST] Book: "${book}", Chapter: ${chapter}, Verse: ${verse}`);

  const chNum = parseInt(chapter as string, 10);
  const vNum = parseInt(verse as string, 10);
  const normalizedBook = normalizeBookName(book as string) || (book as string);

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

  return res.json({
    book: normalizedBook,
    chapter: chNum,
    verse: vNum,
    text: {
      KJV: "No Verse",
    },
    source: "invalid_reference",
  });
}