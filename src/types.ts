// Shared type definitions and interfaces for Church Projection Software

export type PresentationType = "verse" | "lyrics" | "announcement" | "timer" | "black" | "media";

export interface MediaSlide {
  id: string;
  type: "image" | "video";
  name: string;
  url: string;
}

export type LayoutMode = "fullscreen" | "lower-third" | "split-screen";

export type BackgroundThemeId = "warm-charcoal" | "nebula-dark" | "emerald-sanctuary" | "crimson-grace" | "royal-gold" | "clean-light" | "pure-white" | "sanctuary-aurora";

export interface ActiveSlide {
  type: PresentationType;
  title: string;
  body: string;
  book?: string;
  chapter?: number;
  verse?: number;
  translation?: string;
  parallelBody?: string;
  parallelTranslation?: string;
  customBrandingText?: string;
  layout: LayoutMode;
  themeId: BackgroundThemeId;
  fontSize: number;
  showLogo: boolean;
  timerDuration?: number;
  timerEndTime?: number;
  mediaUrl?: string;
  mediaType?: "image" | "video";
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

// Payment types
export interface TransactionRecord {
  id?: string;
  reference: string;
  user_id: string;
  plan: "monthly" | "yearly";
  amount: number;
  currency: string;
  status: "pending" | "success" | "failed" | "abandoned";
  flutterwave_status?: string;
  email: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  verified_at?: string;
  webhook_received_at?: string;
}

export interface PaymentState {
  status: "idle" | "loading" | "verifying" | "success" | "error";
  message: string;
  reference?: string;
}
