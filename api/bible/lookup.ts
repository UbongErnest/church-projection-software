import dotenv from "dotenv";
dotenv.config();

import KJV_DATA from "../../BibleData/kjv.json";

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

const KJV_VERSES = (KJV_DATA as { verses: { book_name: string; chapter: number; verse: number; text: string }[] }).verses;
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
       KJV: ".",
     },
     source: "invalid_reference",
   });
}