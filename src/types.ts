// Shared type definitions and interfaces for Church Projection Software

export type PresentationType = "verse" | "lyrics" | "announcement" | "timer" | "black";

export type LayoutMode = "fullscreen" | "lower-third" | "split-screen";

export type BackgroundThemeId = "warm-charcoal" | "nebula-dark" | "emerald-sanctuary" | "crimson-grace" | "royal-gold" | "clean-light" | "pure-white";

export interface ActiveSlide {
  type: PresentationType;
  title: string;
  body: string;
  book?: string;
  chapter?: number;
  verse?: number;
  translation?: string;
  layout: LayoutMode;
  themeId: BackgroundThemeId;
  fontSize: number; // in pixels or percentage ratio
  showLogo: boolean;
  timerDuration?: number; // total duration in seconds for counting down
  timerEndTime?: number; // timestamp when timer expires
}

export interface DetectedVerse {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  displayName: string;
  confidence: number;
  transcriptSegment: string;
  status: "pending" | "approved" | "ignored";
  timestamp: string;
}

export interface Song {
  id: string;
  title: string;
  author?: string;
  stanzas: string[];
}

export interface AnnouncementSlide {
  id: string;
  title: string;
  body: string;
  icon?: string;
}

export interface SermonSession {
  topic: string;
  notes: string[];
  transcripts: string[];
}
