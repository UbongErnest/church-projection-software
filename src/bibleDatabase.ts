// Bible Books Alias & Regex Parsing Engine
// Pre-populated popular church scriptures for instant local offline lookup.

import KJV_JSON from "./BibleData/kjv.json";

export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: {
    KJV: string;
  };
}

export const BIBLE_BOOKS = [
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

// Seed standard references for 100% offline accuracy on popular search terms
export const OFFLINE_BIBLE_DB: BibleVerse[] = [
    {
      book: "John",
      chapter: 3,
      verse: 16,
      text: {
        KJV: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."
      }
    },
    {
      book: "Romans",
      chapter: 8,
      verse: 28,
      text: {
        KJV: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose."
      }
    },
    {
      book: "Genesis",
      chapter: 1,
      verse: 1,
      text: {
        KJV: "In the beginning God created the heaven and the earth."
      }
    },
    {
      book: "Psalms",
      chapter: 23,
      verse: 1,
      text: {
        KJV: "The LORD is my shepherd; I shall not want."
      }
    },
    {
      book: "Psalms",
      chapter: 23,
      verse: 2,
      text: {
        KJV: "He maketh me to lie down in green pastures: he leadeth me beside the still waters."
      }
    },
    {
      book: "Psalms",
      chapter: 23,
      verse: 3,
      text: {
        KJV: "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake."
      }
    },
    {
      book: "Psalms",
      chapter: 23,
      verse: 4,
      text: {
        KJV: "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me."
      }
    },
    {
      book: "Psalms",
      chapter: 23,
      verse: 5,
      text: {
        KJV: "Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over."
      }
    },
    {
      book: "Psalms",
      chapter: 23,
      verse: 6,
      text: {
        KJV: "Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever."
      }
    },
    {
      book: "Proverbs",
      chapter: 3,
      verse: 5,
      text: {
        KJV: "Trust in the LORD with all thine heart; and lean not unto thine own understanding."
      }
    },
    {
      book: "Proverbs",
      chapter: 3,
      verse: 6,
      text: {
        KJV: "In all thy ways acknowledge him, and he shall direct thy paths."
      }
    },
    {
      book: "Philippians",
      chapter: 4,
      verse: 13,
      text: {
        KJV: "I can do all things through Christ which strengtheneth me."
      }
    },
    {
      book: "1 Corinthians",
      chapter: 13,
      verse: 4,
      text: {
        KJV: "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,"
      }
    },
    {
      book: "Isaiah",
      chapter: 40,
      verse: 31,
      text: {
        KJV: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint."
      }
    },
    {
      book: "Ephesians",
      chapter: 6,
      verse: 10,
      text: {
        KJV: "Finally, my brethren, be strong in the Lord, and in the power of his might."
      }
    },
    {
      book: "Hebrews",
      chapter: 11,
      verse: 1,
      text: {
        KJV: "Now faith is the substance of things hoped for, the evidence of things not seen."
      }
    }
  ];

// Robust normalizer for spoken church numbers and aliases
export function normalizeBookName(input: string): string | null {
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

// Converts standard wording like "First John" to "1 John" or "chapter three" to 3
export function parseSpokenNumbers(input: string): string {
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

// Build KJV verse lookup index at module load time
const KJV_VERSE_INDEX: Record<string, string> = {};
for (const key of Object.keys((KJV_JSON as any).verses)) {
  const verse = (KJV_JSON as any).verses[key];
  const lookupKey = `${verse.book_name.toLowerCase()} ${verse.chapter}:${verse.verse}`;
  KJV_VERSE_INDEX[lookupKey] = verse.text;
}

// Comprehensive offline KJV verse lookup using JSON data
export function getKjvVerseText(book: string, chapter: number, verse: number): string | null {
  const normalized = normalizeBookName(book);
  const key = `${(normalized || book).toLowerCase()} ${chapter}:${verse}`;
  return KJV_VERSE_INDEX[key] || null;
}
