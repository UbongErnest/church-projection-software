import { Song, AnnouncementSlide, BackgroundThemeId } from "./types";

export interface ThemeConfig {
  id: BackgroundThemeId;
  name: string;
  bgClass: string;
  textClass: string;
  accentClass: string;
  badgeClass: string;
  previewGradient: string;
}

export const THEME_PRESETS: ThemeConfig[] = [
  {
    id: "warm-charcoal",
    name: "Warm Charcoal",
    bgClass: "bg-slate-950 text-slate-100 border-slate-800",
    textClass: "text-slate-100",
    accentClass: "border-sky-500 hover:bg-sky-500/10 text-sky-400",
    badgeClass: "bg-sky-500/20 text-sky-200 border-sky-500/30",
    previewGradient: "from-slate-900 to-slate-950 border border-slate-800",
  },
  {
    id: "nebula-dark",
    name: "Nebula Dark",
    bgClass: "bg-gradient-to-tr from-slate-950 via-indigo-950 to-purple-950 text-indigo-50 border-purple-900/40",
    textClass: "text-white drop-shadow-[0_2px_8px_rgba(168,85,247,0.4)]",
    accentClass: "border-purple-500 hover:bg-purple-500/10 text-purple-300",
    badgeClass: "bg-purple-500/20 text-purple-100 border-purple-500/30",
    previewGradient: "from-slate-950 via-indigo-950 to-purple-950",
  },
  {
    id: "emerald-sanctuary",
    name: "Emerald Grace",
    bgClass: "bg-gradient-to-tr from-zinc-950 via-stone-900 to-emerald-950 text-emerald-50 border-emerald-900/40",
    textClass: "text-white drop-shadow-[0_2px_8px_rgba(16,185,129,0.3)]",
    accentClass: "border-emerald-500 hover:bg-emerald-500/10 text-emerald-300",
    badgeClass: "bg-emerald-500/20 text-emerald-100 border-emerald-500/30",
    previewGradient: "from-zinc-950 via-stone-900 to-emerald-950",
  },
  {
    id: "crimson-grace",
    name: "Crimson Grace",
    bgClass: "bg-gradient-to-tl from-slate-950 via-stone-900 to-red-950 text-red-50 border-red-900/40",
    textClass: "text-white drop-shadow-[0_2px_8px_rgba(239,68,68,0.3)]",
    accentClass: "border-red-500 hover:bg-red-500/10 text-red-300",
    badgeClass: "bg-red-500/20 text-red-100 border-red-500/30",
    previewGradient: "from-slate-950 via-stone-900 to-red-950",
  },
  {
    id: "royal-gold",
    name: "Royal Amber",
    bgClass: "bg-gradient-to-tr from-slate-950 via-stone-950 to-amber-950 text-amber-50 border-amber-900/30",
    textClass: "text-amber-100 drop-shadow-[0_2px_8px_rgba(245,158,11,0.2)]",
    accentClass: "border-amber-500 hover:bg-amber-500/10 text-amber-400",
    badgeClass: "bg-amber-500/20 text-amber-100 border-amber-500/30",
    previewGradient: "from-slate-950 via-stone-950 to-amber-950",
  },
  {
    id: "clean-light",
    name: "Sienna Light",
    bgClass: "bg-stone-50 text-stone-900 border-stone-200",
    textClass: "text-stone-900",
    accentClass: "border-stone-800 hover:bg-stone-800/5 text-stone-800",
    badgeClass: "bg-stone-200/50 text-stone-800 border-stone-300",
    previewGradient: "from-stone-50 to-stone-100 border border-stone-200",
  },
  {
    id: "pure-white",
    name: "Pure White",
    bgClass: "bg-white text-black border-stone-200",
    textClass: "text-black",
    accentClass: "border-black hover:bg-black/5 text-black",
    badgeClass: "bg-stone-100 text-black border-stone-200",
    previewGradient: "from-white to-stone-50 border border-stone-200",
  },
  {
    id: "sanctuary-aurora",
    name: "★ Sanctuary Aurora (Premium)",
    bgClass: "bg-gradient-to-tr from-slate-950 via-teal-950 to-emerald-950 text-teal-50 border-teal-900/40 relative overflow-hidden",
    textClass: "text-white drop-shadow-[0_2px_12px_rgba(45,212,191,0.5)] font-sans",
    accentClass: "border-teal-400 hover:bg-teal-400/10 text-teal-300",
    badgeClass: "bg-teal-500/20 text-teal-100 border-teal-500/30",
    previewGradient: "from-slate-950 via-teal-950 to-emerald-950",
  }
];

export const DEFAULT_SONGS: Song[] = [
  {
    id: "amazing-grace",
    title: "Amazing Grace",
    author: "John Newton",
    stanzas: [
      "Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.",
      "'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed.",
      "Through many dangers, toils and snares,\nI have already come;\n'Tis grace hath brought me safe thus far,\nAnd grace will lead me home.",
      "When we've been there ten thousand years,\nBright shining as the sun,\nWe've no less days to sing God's praise\nThan when we first begun."
    ]
  },
  {
    id: "how-great-is-our-god",
    title: "How Great Is Our God",
    author: "Chris Tomlin",
    stanzas: [
      "The splendor of a King, clothed in majesty\nLet all the earth rejoice, all the earth rejoice\nHe wraps Himself in light, and darkness tries to hide\nAnd trembles at His voice, trembles at His voice",
      "Chorus:\nHow great is our God, sing with me\nHow great is our God, and all will see\nHow great, how great is our God",
      "Age to age He stands, and time is in His hands\nBeginning and the end, beginning and the end\nThe Godhead three in one: Father, Spirit, Son\nThe Lion and the Lamb, the Lion and the Lamb",
      "Name above all names, Worthy of all praise\nMy heart will sing: How great is our God"
    ]
  },
  {
    id: "in-christ-alone",
    title: "In Christ Alone",
    author: "Keith Getty / Stuart Townend",
    stanzas: [
      "In Christ alone my hope is found\nHe is my light, my strength, my song\nThis cornerstone, this solid ground\nFirm through the fiercest drought and storm.",
      "What heights of love, what depths of peace\nWhen fears are stilled, when strivings cease\nMy comforter, my all in all\nHere in the love of Christ I stand.",
      "In Christ alone! Who took on flesh\nFullness of God in helpless babe!\nThis gift of love and righteousness\nScorned by the ones He came to save.",
      "No guilt in life, no fear in death\nThis is the power of Christ in me\nFrom life's first cry to final breath\nJesus commands my destiny."
    ]
  }
];

export const DEFAULT_ANNOUNCEMENTS: AnnouncementSlide[] = [
  {
    id: "welcome-sunday",
    title: "Welcome to Sunday Services",
    body: "We are so glad you joined us today! Please scan the QR code in the bulletin to fill out a connection card.",
    icon: "Heart"
  },
  {
    id: "youth-gathering",
    title: "Youth Fellowship Gathering",
    body: "Every Wednesday at 6:30 PM in the Fellowship Hall. Games, worship, and group study. Ages 13-18 welcome!",
    icon: "Users"
  },
  {
    id: "sunday-school",
    title: "Children Sunday School",
    body: "Classes starting in the Annex building directly after the worship segment wraps. Parents can pick up children at 11:45 AM.",
    icon: "Sparkles"
  },
  {
    id: "prayer-meeting",
    title: "Mid-Week Prayer Meeting",
    body: "Join us this Thursday at 7:00 PM for an evening of corporate prayer, devotional reflections, and acoustic worship.",
    icon: "Calendar"
  }
];
