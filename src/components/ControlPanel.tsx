import { useState, useEffect, useRef, FormEvent } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import {
  Mic,
  MicOff,
  Tv,
  Search,
  Plus,
  Play,
  Square,
  Trash,
  Settings,
  BookOpen,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Music,
  Clock,
  Check,
  Eye,
  RefreshCw,
  Sliders,
  EyeOff,
  PlusCircle,
  FileText,
  User,
  LogOut,
  Lock,
  Crown,
  CreditCard,
  X,
  AlertTriangle,
  Award,
  Zap,
  Globe
} from "lucide-react";
import { ActiveSlide, DetectedVerse, Song, AnnouncementSlide } from "../types";
import { DEFAULT_SONGS, DEFAULT_ANNOUNCEMENTS, THEME_PRESETS } from "../data";
import { BIBLE_BOOKS, normalizeBookName, OFFLINE_BIBLE_DB } from "../bibleDatabase";

interface ControlPanelProps {
  onCastSlide: (slide: ActiveSlide) => void;
  activeProjectedSlide: ActiveSlide;
  detectedVerses: DetectedVerse[];
  onTriggerDetect: (transcript: string) => void;
  isListening: boolean;
  onToggleListening: () => void;
  transcript: string;
  sermonTopic: string;
  sermonNotes: string[];
  onClearNotes: () => void;
  userProfile?: {
    subscriptionPlan: "free" | "monthly" | "yearly";
    subscriptionStatus: string;
    [key: string]: any;
  } | null;
  onUpdateSubscription?: (newPlan: "free" | "monthly" | "yearly") => Promise<void>;

  // Lifted customizer options:
  bibleVersion: "NIV" | "KJV" | "ESV";
  onChangeBibleVersion: (version: "NIV" | "KJV" | "ESV") => void;
  layoutMode: "fullscreen" | "lower-third" | "split-screen";
  onChangeLayoutMode: (mode: "fullscreen" | "lower-third" | "split-screen") => void;
  activeThemeId: string;
  onChangeActiveThemeId: (themeId: string) => void;
  fontSize: number;
  onChangeFontSize: (size: number) => void;
  showLogo: boolean;
  onChangeShowLogo: (show: boolean) => void;
  isParallelEnabled: boolean;
  onChangeIsParallelEnabled: (enabled: boolean) => void;
  parallelVersion: "NIV" | "KJV" | "ESV";
  onChangeParallelVersion: (version: "NIV" | "KJV" | "ESV") => void;
  customBrandingText: string;
  onChangeCustomBrandingText: (text: string) => void;
}

export default function ControlPanel({
  onCastSlide,
  activeProjectedSlide,
  detectedVerses,
  onTriggerDetect,
  isListening,
  onToggleListening,
  transcript,
  sermonTopic,
  sermonNotes,
  onClearNotes,
  userProfile,
  onUpdateSubscription,

  bibleVersion,
  onChangeBibleVersion,
  layoutMode,
  onChangeLayoutMode,
  activeThemeId,
  onChangeActiveThemeId,
  fontSize,
  onChangeFontSize,
  showLogo,
  onChangeShowLogo,
  isParallelEnabled,
  onChangeIsParallelEnabled,
  parallelVersion,
  onChangeParallelVersion,
  customBrandingText,
  onChangeCustomBrandingText
}: ControlPanelProps) {
  // User level plan and restrictions state mapping
  const userPlan = userProfile?.subscriptionPlan || "free";

  // Navigation sub-tabs (adding plans tab)
  const [activeTab, setActiveTab] = useState<"ai-feed" | "manual-bible" | "songs" | "announcements" | "plans">("plans");

  // Upgrade prompt modal states
  const [showUpgradePromptModal, setShowUpgradePromptModal] = useState(false);
  const [upgradeTriggerSource, setUpgradeTriggerSource] = useState("");

  // Simulated Checkout Modal state
  const [checkoutPlan, setCheckoutPlan] = useState<"monthly" | "yearly" | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  
  // Checkout form inputs
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  // Selection states for Bible Search
  const [selectedBook, setSelectedBook] = useState<string>("John");
  const [selectedChapter, setSelectedChapter] = useState<number>(3);
  const [selectedVerse, setSelectedVerse] = useState<number>(16);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Search results for manual lookup
  const [lookupText, setLookupText] = useState<{ KJV: string; NIV: string; ESV: string } | null>(null);
  const [isLoadingLookup, setIsLoadingLookup] = useState<boolean>(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Theme lock helper
  const isThemeLocked = (themeId: string) => {
    if (["nebula-dark", "emerald-sanctuary", "crimson-grace", "royal-gold", "sanctuary-aurora"].includes(themeId)) {
      return userPlan !== "yearly"; // Premium (yearly) only
    }
    return false;
  };

  // Song and announcements selection
  const [selectedSongId, setSelectedSongId] = useState<string>(DEFAULT_SONGS[0].id);
  const [selectedStanzaIndex, setSelectedStanzaIndex] = useState<number>(0);

  // Stateful announcements list (loads stored or falls back to DEFAULT_ANNOUNCEMENTS)
  const [announcements, setAnnouncements] = useState<AnnouncementSlide[]>(() => {
    try {
      const stored = localStorage.getItem("chaver_custom_announcements");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Storage reading blocked or empty, loaded defaults.");
    }
    return DEFAULT_ANNOUNCEMENTS;
  });

  const [newAnnTitle, setNewAnnTitle] = useState("");
  const [newAnnBody, setNewAnnBody] = useState("");

  // Timer settings
  const [timerLabel, setTimerLabel] = useState<string>("Service Begins");
  const [timerMinutes, setTimerMinutes] = useState<number>(5);



  // Load selected Bible verse text on change
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      fetchManualVerse(selectedBook, selectedChapter, selectedVerse, false);
    } else {
      fetchManualVerse(selectedBook, selectedChapter, selectedVerse, true);
    }
  }, [selectedBook, selectedChapter, selectedVerse, bibleVersion]);

  const fetchManualVerse = async (b: string, c: number, v: number, autoProject: boolean = false) => {
    setIsLoadingLookup(true);
    setLookupError(null);

    // 1. Attempt client-side offline database lookup first
    const normalized = normalizeBookName(b) || b;
    const offlineMatch = OFFLINE_BIBLE_DB.find(
      (verse) =>
        verse.book.toLowerCase() === normalized.toLowerCase() &&
        verse.chapter === c &&
        verse.verse === v
    );

    if (offlineMatch) {
      setLookupText(offlineMatch.text);
      setIsLoadingLookup(false);
      if (autoProject) {
        const hasParallel = isParallelEnabled && userPlan === "yearly";
        onCastSlide({
          type: "verse",
          title: `${b} ${c}:${v}`,
          body: offlineMatch.text[bibleVersion],
          parallelBody: hasParallel ? offlineMatch.text[parallelVersion] : undefined,
          parallelTranslation: hasParallel ? parallelVersion : undefined,
          customBrandingText: userPlan === "yearly" && customBrandingText ? customBrandingText : undefined,
          book: b,
          chapter: c,
          verse: v,
          translation: bibleVersion,
          layout: layoutMode,
          themeId: activeThemeId as any,
          fontSize: fontSize,
          showLogo: showLogo,
        });
      }
      return;
    }

    try {
      const res = await fetch(`/api/bible/lookup?book=${encodeURIComponent(b)}&chapter=${c}&verse=${v}`);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (data && data.text) {
        setLookupText(data.text);
        if (autoProject) {
          const hasParallel = isParallelEnabled && userPlan === "yearly";
          onCastSlide({
            type: "verse",
            title: `${b} ${c}:${v}`,
            body: data.text[bibleVersion],
            parallelBody: hasParallel ? data.text[parallelVersion] : undefined,
            parallelTranslation: hasParallel ? parallelVersion : undefined,
            customBrandingText: userPlan === "yearly" && customBrandingText ? customBrandingText : undefined,
            book: b,
            chapter: c,
            verse: v,
            translation: bibleVersion,
            layout: layoutMode,
            themeId: activeThemeId as any,
            fontSize: fontSize,
            showLogo: showLogo,
          });
        }
      } else {
        throw new Error(data.error || "Response format invalid: 'text' field missing.");
      }
    } catch (err: any) {
      console.error("fetchManualVerse error:", err);
      setLookupError(err.message || "Unknown error occurred.");
      setLookupText(null);
    } finally {
      setIsLoadingLookup(false);
    }
  };

  // Convert custom manual search bar queries (e.g. "Romans 12 1") and automatically cast
  const handleKeywordSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Direct parser
    const match = searchQuery.match(/([a-zA-Z\s]+)\s+(\d+)(?:\s+|:)(\d+)/i);
    if (match) {
      const bookName = normalizeBookName(match[1]) || match[1];
      const chapterVal = parseInt(match[2], 10);
      const verseVal = parseInt(match[3], 10);
      setSelectedBook(bookName);
      setSelectedChapter(chapterVal);
      setSelectedVerse(verseVal);

      // 1. Attempt client-side offline database lookup first
      const normalized = normalizeBookName(bookName) || bookName;
      const offlineMatch = OFFLINE_BIBLE_DB.find(
        (verse) =>
          verse.book.toLowerCase() === normalized.toLowerCase() &&
          verse.chapter === chapterVal &&
          verse.verse === verseVal
      );

      if (offlineMatch) {
        setLookupText(offlineMatch.text);
        setLookupError(null);
        const hasParallel = isParallelEnabled && userPlan === "yearly";
        onCastSlide({
          type: "verse",
          title: `${bookName} ${chapterVal}:${verseVal}`,
          body: offlineMatch.text[bibleVersion],
          parallelBody: hasParallel ? offlineMatch.text[parallelVersion] : undefined,
          parallelTranslation: hasParallel ? parallelVersion : undefined,
          customBrandingText: userPlan === "yearly" && customBrandingText ? customBrandingText : undefined,
          book: bookName,
          chapter: chapterVal,
          verse: verseVal,
          translation: bibleVersion,
          layout: layoutMode,
          themeId: activeThemeId as any,
          fontSize: fontSize,
          showLogo: showLogo,
        });
        return;
      }

      // Fetch immediately and project automatically without requiring manual "Project Selector Verse" click
      setIsLoadingLookup(true);
      setLookupError(null);
      try {
        const res = await fetch(`/api/bible/lookup?book=${encodeURIComponent(bookName)}&chapter=${chapterVal}&verse=${verseVal}`);
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        if (data && data.text) {
          setLookupText(data.text);
          const hasParallel = isParallelEnabled && userPlan === "yearly";
          onCastSlide({
            type: "verse",
            title: `${bookName} ${chapterVal}:${verseVal}`,
            body: data.text[bibleVersion],
            parallelBody: hasParallel ? data.text[parallelVersion] : undefined,
            parallelTranslation: hasParallel ? parallelVersion : undefined,
            customBrandingText: userPlan === "yearly" && customBrandingText ? customBrandingText : undefined,
            book: bookName,
            chapter: chapterVal,
            verse: verseVal,
            translation: bibleVersion,
            layout: layoutMode,
            themeId: activeThemeId as any,
            fontSize: fontSize,
            showLogo: showLogo,
          });
        } else {
          throw new Error(data.error || "Response format invalid: 'text' field missing.");
        }
      } catch (err: any) {
        console.error("Auto-cast lookup error:", err);
        setLookupError(err.message || "Unknown error occurred.");
        setLookupText(null);
      } finally {
        setIsLoadingLookup(false);
      }
    } else {
      alert("Please match standard references: 'Book Chapter:Verse' (e.g., Romans 8:28)");
    }
  };

  // Trigger quick manual verse projection casting
  const handleCastManualVerse = () => {
    if (!lookupText) return;
    const hasParallel = isParallelEnabled && userPlan === "yearly";
    onCastSlide({
      type: "verse",
      title: `${selectedBook} ${selectedChapter}:${selectedVerse}`,
      body: lookupText[bibleVersion],
      parallelBody: hasParallel ? lookupText[parallelVersion] : undefined,
      parallelTranslation: hasParallel ? parallelVersion : undefined,
      customBrandingText: userPlan === "yearly" && customBrandingText ? customBrandingText : undefined,
      book: selectedBook,
      chapter: selectedChapter,
      verse: selectedVerse,
      translation: bibleVersion,
      layout: layoutMode,
      themeId: activeThemeId as any,
      fontSize: fontSize,
      showLogo: showLogo,
    });
  };

  // Generate customized countdown slide
  const handleCastTimer = () => {
    const totalSecs = timerMinutes * 60;
    onCastSlide({
      type: "timer",
      title: timerLabel,
      body: "",
      customBrandingText: userPlan === "yearly" && customBrandingText ? customBrandingText : undefined,
      layout: "fullscreen",
      themeId: activeThemeId as any,
      fontSize: fontSize,
      showLogo: false,
      timerDuration: totalSecs,
      timerEndTime: Date.now() + totalSecs * 1000,
    });
  };

  // Clean out full screen display matching standard church layout (Blackout)
  const handleBlackout = () => {
    onCastSlide({
      type: "black",
      title: "",
      body: "",
      layout: "fullscreen",
      themeId: "warm-charcoal",
      fontSize: 20,
      showLogo: false,
    });
  };

  // Cast standard song lyrics slide
  const handleCastLyric = (song: Song, stanzaText: string, idx: number) => {
    setSelectedStanzaIndex(idx);
    onCastSlide({
      type: "lyrics",
      title: song.title,
      body: stanzaText,
      customBrandingText: userPlan === "yearly" && customBrandingText ? customBrandingText : undefined,
      layout: layoutMode,
      themeId: activeThemeId as any,
      fontSize: fontSize,
      showLogo: showLogo,
    });
  };

  // Cast church announcements slide
  const handleCastAnnouncement = (slide: AnnouncementSlide) => {
    onCastSlide({
      type: "announcement",
      title: slide.title,
      body: slide.body,
      customBrandingText: userPlan === "yearly" && customBrandingText ? customBrandingText : undefined,
      layout: "fullscreen",
      themeId: activeThemeId as any,
      fontSize: fontSize,
      showLogo: showLogo,
    });
  };

  // Add custom announcement with instant broadcast
  const handleCreateAnnouncement = (e: FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnBody.trim()) return;

    if (userPlan === "free" && announcements.length >= 3) {
      setUpgradeTriggerSource("Unlimited Announcements");
      setShowUpgradePromptModal(true);
      return;
    }

    const newSlide: AnnouncementSlide = {
      id: `ann-${Date.now()}`,
      title: newAnnTitle.trim(),
      body: newAnnBody.trim()
    };

    const updated = [...announcements, newSlide];
    setAnnouncements(updated);
    setNewAnnTitle("");
    setNewAnnBody("");

    try {
      localStorage.setItem("chaver_custom_announcements", JSON.stringify(updated));
    } catch (err) {
      console.error("Storage save failed:", err);
    }

    // Cast it immediately for instant feed updates!
    handleCastAnnouncement(newSlide);
  };

  // Delete announcement (allows customized list management)
  const handleDeleteAnnouncement = (id: string) => {
    const updated = announcements.filter((ann) => ann.id !== id);
    setAnnouncements(updated);
    try {
      localStorage.setItem("chaver_custom_announcements", JSON.stringify(updated));
    } catch (err) {
      console.error("Storage delete failed:", err);
    }
  };

  const handleTabClick = (tab: "ai-feed" | "manual-bible" | "songs" | "announcements" | "plans") => {
    if (tab === "plans" || tab === "manual-bible") {
      setActiveTab(tab);
      return;
    }
    
    if (userPlan === "free") {
      setUpgradeTriggerSource(
        tab === "ai-feed" 
          ? "AI Live Session Listener" 
          : tab === "songs" 
            ? "Hymnals Library" 
            : "Church Announcements"
      );
      setShowUpgradePromptModal(true);
      return;
    }
    
    if (userPlan === "monthly" && (tab === "songs" || tab === "announcements")) {
      setUpgradeTriggerSource(
        tab === "songs" 
          ? "Hymnals (Premium Feature)" 
          : "Church Announcements (Premium Feature)"
      );
      setShowUpgradePromptModal(true);
      return;
    }
    
    setActiveTab(tab);
  };

  const activeSong = DEFAULT_SONGS.find((s) => s.id === selectedSongId) || DEFAULT_SONGS[0];

  const activeProjTheme = THEME_PRESETS.find((t) => t.id === activeProjectedSlide.themeId) || THEME_PRESETS[0];
  const isProjThemeLight = activeProjTheme.id === "clean-light" || activeProjTheme.id === "pure-white";

  return (
    <div id="operator-workspace-layer" className="w-full min-h-screen bg-[#0C0D0F] text-[#E0E0E0] flex flex-col font-sans select-none">
      
      {/* 1. TOP NAVIGATION BAR */}
      <header className="min-h-12 border-b border-white/10 flex flex-wrap items-center justify-between px-4 py-2 bg-[#121417] gap-3 shadow-md">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center font-bold text-xs italic text-white shadow-md">C</div>
            <span className="font-bold tracking-tight text-sm uppercase text-white">Chaver</span>
            {auth.currentUser && (
              <div className="hidden sm:flex items-center gap-2 border-l border-white/10 pl-4">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                  <User className="w-3" />
                </div>
                <span className="text-xs text-white/70 font-medium">
                  {auth.currentUser.displayName || auth.currentUser.email?.split("@")[0]}
                </span>
                <button
                  onClick={async () => {
                    if (confirm("Are you sure you want to sign out?")) {
                      await signOut(auth);
                    }
                  }}
                  title="Sign Out"
                  className="p-1 text-white/40 hover:text-red-400 transition-colors ml-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <nav className="flex gap-4 text-xs font-semibold text-white/50">
            <button
              onClick={() => handleTabClick("ai-feed")}
              className={`pb-1 uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "ai-feed"
                  ? "text-white border-b-2 border-blue-500 font-bold"
                  : "hover:text-white"
              }`}
            >
              LIVE SESSION
            </button>
            <button
              onClick={() => handleTabClick("manual-bible")}
              className={`pb-1 uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "manual-bible"
                  ? "text-white border-b-2 border-blue-500 font-bold"
                  : "hover:text-white"
              }`}
            >
              BIBLE
            </button>
            <button
              onClick={() => handleTabClick("songs")}
              className={`pb-1 uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "songs"
                  ? "text-white border-b-2 border-blue-500 font-bold"
                  : "hover:text-white"
              }`}
            >
              SONGS
            </button>
            <button
              onClick={() => handleTabClick("announcements")}
              className={`pb-1 uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "announcements"
                  ? "text-white border-b-2 border-blue-500 font-bold"
                  : "hover:text-white"
              }`}
            >
              ANNOUNCEMENTS
            </button>
            <button
              onClick={() => handleTabClick("plans")}
              className={`pb-1 uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "plans"
                  ? "text-white border-b-2 border-blue-500 font-bold text-amber-400 font-extrabold flex items-center gap-1"
                  : "hover:text-white text-stone-400"
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" /> PLANS &amp; BILLING
            </button>
          </nav>
        </div>

        {/* Real-time Listening controls & Quick Screens */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-white/5 px-3 py-1 rounded-full border border-white/10">
            <span className="relative flex h-2 w-2 mr-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isListening ? "bg-[#10B981]" : "bg-slate-500"}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isListening ? "bg-[#10B981]" : "bg-slate-500"}`}></span>
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#10B981] font-bold">
              {isListening ? "AI Listening" : "AI Idle"}
            </span>
          </div>

          <button
            onClick={onToggleListening}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer select-none transition-all ${
              isListening
                ? "bg-red-900/45 border border-red-500/50 text-red-200 hover:bg-red-800"
                : "bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-3 h-3 text-red-400" /> Stop Listening
              </>
            ) : (
              <>
                <Mic className="w-3 h-3 text-blue-400 animate-pulse" /> Live Listen
              </>
            )}
          </button>

          {/* Independent Presentation screen pop-out */}
          <a
            href={`${window.location.origin}${window.location.pathname}${window.location.search}#projector`}
            target="_blank"
            rel="opener"
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded cursor-pointer transition-all shadow-md select-none border border-blue-500/30"
          >
            <ExternalLink className="w-3 h-3" /> Projector
          </a>
          
          <button
            onClick={handleBlackout}
            className="flex items-center gap-1 bg-red-950/40 border border-red-500/30 text-red-200 hover:bg-red-900/30 text-xs font-semibold px-3 py-1 rounded cursor-pointer transition-all shadow-md select-none"
          >
            <EyeOff className="w-3 h-3 text-red-400" /> Blackout
          </button>
        </div>
      </header>

      {/* 2. BASE CONTAINER - THREE GRID LAYOUT */}
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-1.5 p-1.5 bg-[#0C0D0F] overflow-y-auto">
        
        {/* ================= LEFT GRID COLUMN: LIVE AUDITORY PIPELINE (3 Cols) ================= */}
        <div className="xl:col-span-3 flex flex-col gap-1.5 overflow-hidden">
          {/* Live Transcript Stream */}
          <div className="glass-panel rounded-lg p-3.5 flex flex-col min-h-[300px]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                <Mic className="w-3 h-3 text-blue-400" /> Live Transcription
              </h3>
              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                Whisper v3
              </span>
            </div>
            
            <div className="bg-black/40 rounded p-3 h-[180px] overflow-y-auto font-sans text-xs text-white/70 leading-relaxed border border-white/5 scrollbar">
              {transcript ? (
                <span>{transcript}</span>
              ) : (
                <span className="text-white/30 italic">
                  {isListening
                    ? "Microphone capturing... pastor speech transcription will stream here instantly."
                    : "Muted. Activate 'Live Listen' in top nav or trigger the preacher templates on the right to test..."}
                </span>
              )}
            </div>

            {/* Simulated Live Audio Level Meter */}
            <div className="mt-3 h-8 bg-black/40 rounded flex items-center px-3 gap-3 border border-white/5">
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full bg-blue-500 ${isListening ? "w-[68%] animate-pulse" : "w-1"}`}></div>
              </div>
              <span className="text-[9px] font-mono text-white/30 font-bold uppercase">
                {isListening ? "MIC IN: -11dB" : "MIC IN: OFF"}
              </span>
            </div>
            
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => onTriggerDetect(transcript)}
                className="flex-1 flex justify-center items-center gap-1.5 bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 text-blue-400 text-xs font-bold py-1.5 rounded cursor-pointer transition-all select-none"
              >
                <Sparkles className="w-3 h-3 text-blue-400" /> RE-SCAN TEXT AI
              </button>
            </div>
          </div>

          {/* Sermon Summary Topics & Notes */}
          <div className="glass-panel rounded-lg p-3.5 flex flex-col glowing-bg min-h-[220px]">
            <div className="flex justify-between items-center mb-2.5">
              <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-blue-400" /> Topic &amp; Analysis
              </h3>
              <button
                onClick={onClearNotes}
                className="text-[9px] font-mono text-white/30 hover:text-white/70 duration-150 uppercase tracking-wider"
              >
                Reset
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest block mb-1">
                  Topic Detection
                </span>
                <div className="bg-black/30 px-2.5 py-1.5 rounded border border-white/5 font-display font-bold text-xs text-blue-400 uppercase tracking-wider">
                  ✨ {sermonTopic || "Divine Sovereignty"}
                </div>
              </div>

              <div>
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest block mb-1">
                  NLP Keynotes
                </span>
                <div className="bg-black/20 rounded p-2.5 min-h-[70px] max-h-[140px] overflow-y-auto border border-white/5 text-[11px] leading-relaxed">
                  {sermonNotes && sermonNotes.length > 0 ? (
                    <ul className="space-y-1.5">
                      {sermonNotes.map((note, index) => (
                        <li key={index} className="flex gap-1.5 text-white/70">
                          <span className="text-blue-500 font-bold">•</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-white/30 italic">No points Captured. Ready for voice streaming analysis.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= MIDDLE GRID COLUMN: PRESENTATION TABS & EXPLORER (4 Cols) ================= */}
        <div className="xl:col-span-4 flex flex-col gap-1.5 overflow-hidden">
          
          <div className="glass-panel rounded-lg p-3.5 flex flex-col flex-1 min-h-[500px]">
            
            {/* Nav Workspace Tabs selector */}
            <div className="flex border-b border-white/10 pb-2 mb-3.5 gap-1 select-none overflow-x-auto scrollbar">
              <button
                onClick={() => handleTabClick("ai-feed")}
                className={`px-3 py-1 font-sans text-[11px] font-bold tracking-tight rounded cursor-pointer transition-all duration-150 whitespace-nowrap ${
                  activeTab === "ai-feed"
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                    : "text-white/45 bg-transparent border border-transparent hover:text-white/90"
                }`}
              >
                📊 AI FEED ({detectedVerses.length})
              </button>
              <button
                onClick={() => handleTabClick("manual-bible")}
                className={`px-3 py-1 font-sans text-[11px] font-bold tracking-tight rounded cursor-pointer transition-all duration-150 whitespace-nowrap ${
                  activeTab === "manual-bible"
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                    : "text-white/45 bg-transparent border border-transparent hover:text-white/90"
                }`}
              >
                📖 BIBLE EXPLORER
              </button>
              <button
                onClick={() => handleTabClick("songs")}
                className={`px-3 py-1 font-sans text-[11px] font-bold tracking-tight rounded cursor-pointer transition-all duration-150 whitespace-nowrap ${
                  activeTab === "songs"
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                    : "text-white/45 bg-transparent border border-transparent hover:text-white/90"
                }`}
              >
                🎵 HYMNALS
              </button>
              <button
                onClick={() => handleTabClick("announcements")}
                className={`px-3 py-1 font-sans text-[11px] font-bold tracking-tight rounded cursor-pointer transition-all duration-150 whitespace-nowrap ${
                  activeTab === "announcements"
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                    : "text-white/45 bg-transparent border border-transparent hover:text-white/90"
                }`}
              >
                📢 MEDIA & TIMERS
              </button>
              <button
                onClick={() => handleTabClick("plans")}
                className={`px-3 py-1 font-sans text-[11px] font-bold tracking-tight rounded cursor-pointer transition-all duration-150 whitespace-nowrap ${
                  activeTab === "plans"
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                    : "text-white/45 bg-transparent border border-transparent hover:text-white/90"
                }`}
              >
                💳 PLANS &amp; BILLING
              </button>
            </div>

            {/* Content Core renders depending on selection */}
            <div className="flex-1 flex flex-col overflow-y-auto max-h-[500px] scrollbar pr-1">
              
              {/* TAB 1: AI IDENTIFIED VERSES PANEL */}
              {activeTab === "ai-feed" && (
                <div className="space-y-3 flex-1 flex flex-col">
                  {detectedVerses.length === 0 ? (
                    <div className="flex-1 flex flex-col justify-center items-center text-center p-6 bg-black/40 border border-white/5 rounded-lg my-auto">
                      <Sparkles className="w-6 h-6 text-blue-500/40 mb-2 animate-pulse" />
                      <h4 className="font-sans font-bold text-white/70 text-xs uppercase tracking-wider">Awaiting Mic Speech...</h4>
                      <p className="text-white/40 text-[10px] max-w-xs mt-1 leading-normal">
                        Our Gemini NLP service is listening. Speak or paste bible references like "Genesis 1:1" to generate matches instantly.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detectedVerses.map((item) => (
                        <div
                          key={item.id}
                          className="bg-white/5 border border-white/5 hover:border-blue-500/45 rounded p-3 transition-all flex flex-col"
                        >
                          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/5">
                            <span className="font-sans font-bold text-xs text-amber-200 uppercase tracking-wide">
                              📖 {item.displayName}
                            </span>
                            <div className="flex items-center gap-1.5 font-mono">
                              <span
                                className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold ${
                                  item.confidence > 80
                                    ? "bg-green-500/15 text-green-400"
                                    : "bg-amber-500/15 text-amber-400"
                                }`}
                              >
                                Match {item.confidence}%
                              </span>
                              <span className="text-[8px] text-white/30">
                                {item.timestamp}
                              </span>
                            </div>
                          </div>

                          <div className="text-white/60 italic text-[11px] mb-2 bg-black/30 p-2 rounded border border-white/5 max-h-[60px] overflow-y-auto leading-normal">
                            "{item.transcriptSegment}"
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                const lookup = await fetch(`/api/bible/lookup?book=${item.book}&chapter=${item.chapter}&verse=${item.verse}`);
                                const details = await lookup.json();
                                onCastSlide({
                                  type: "verse",
                                  title: item.displayName,
                                  body: details.text[bibleVersion],
                                  book: item.book,
                                  chapter: item.chapter,
                                  verse: item.verse,
                                  translation: bibleVersion,
                                  layout: layoutMode,
                                  themeId: activeThemeId as any,
                                  fontSize: fontSize,
                                  showLogo: showLogo,
                                });
                              }}
                              className="flex-1 flex justify-center items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold py-1 px-2.5 rounded cursor-pointer transition-all"
                            >
                              <Play className="w-3 h-3" /> Broadcast Now
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: MANUAL BIBLE EXPLORER */}
              {activeTab === "manual-bible" && (
                <div className="flex flex-col gap-3">
                  {/* Manual Quick Search bar */}
                  <form onSubmit={handleKeywordSearch} className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-white/30" />
                      <input
                        type="text"
                        placeholder="Reference (e.g. John 3:16, Rom 8:28)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-black/40 pl-8 pr-2 py-1.5 rounded border border-white/10 text-xs text-white focus:border-blue-500 focus:outline-none placeholder-white/20"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 rounded text-xs text-white/80 font-bold cursor-pointer select-none"
                    >
                      Parse
                    </button>
                  </form>

                  {/* Manual Picker Selectors */}
                  <div className="grid grid-cols-4 gap-1.5 text-white/80">
                    <div className="col-span-2">
                      <span className="text-[8px] font-mono uppercase tracking-widest text-white/40 block mb-1">Book</span>
                      <select
                        value={selectedBook}
                        onChange={(e) => {
                          setSelectedBook(e.target.value);
                          setSelectedChapter(1);
                          setSelectedVerse(1);
                        }}
                        className="w-full bg-black/40 p-1 text-[11px] rounded border border-white/10 text-white focus:border-blue-500 focus:outline-none"
                      >
                        {BIBLE_BOOKS.map((b) => (
                          <option key={b.name} value={b.name} className="bg-[#121417]">
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[8px] font-mono uppercase tracking-widest text-white/40 block mb-1">Ch.</span>
                      <input
                        type="number"
                        min={1}
                        value={selectedChapter}
                        onChange={(e) => {
                          setSelectedChapter(parseInt(e.target.value, 10) || 1);
                          setSelectedVerse(1);
                        }}
                        className="w-full bg-black/40 p-1 text-[11px] text-white rounded border border-white/10 focus:border-blue-500 focus:outline-none font-mono text-center"
                      />
                    </div>

                    <div>
                      <span className="text-[8px] font-mono uppercase tracking-widest text-white/40 block mb-1">Ver.</span>
                      <input
                        type="number"
                        min={1}
                        value={selectedVerse}
                        onChange={(e) => setSelectedVerse(parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-black/40 p-1 text-[11px] text-white rounded border border-white/10 focus:border-blue-500 focus:outline-none font-mono text-center"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    <div>
                      <span className="text-[8px] font-mono uppercase tracking-widest text-white/40 block mb-1">Translation Version</span>
                      <select
                        value={bibleVersion}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== "NIV" && userPlan === "free") {
                            setUpgradeTriggerSource(`${val} Translation`);
                            setShowUpgradePromptModal(true);
                            return;
                          }
                          onChangeBibleVersion(val as any);
                        }}
                        className="w-full bg-black/40 p-1 text-[11px] rounded border border-white/10 text-white focus:border-blue-500 focus:outline-none"
                      >
                        <option value="NIV" className="bg-[#121417]">NIV — New International Version</option>
                        <option value="KJV" className="bg-[#121417]">{userPlan === "free" ? "🔒 " : ""}KJV — Authorized King James Version</option>
                        <option value="ESV" className="bg-[#121417]">{userPlan === "free" ? "🔒 " : ""}ESV — English Standard Version</option>
                      </select>
                    </div>
                  </div>

                  {/* Manual Scripture Preview Body */}
                  <div className="bg-black/30 border border-white/5 rounded p-3 flex flex-col justify-between min-h-[110px]">
                    <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-white/5">
                      <span className="font-mono text-[9px] text-amber-200 uppercase tracking-widest">
                        Preview: {selectedBook} {selectedChapter}:{selectedVerse}
                      </span>
                      {isLoadingLookup && (
                        <span className="text-[8px] font-mono text-blue-400 flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> API Lookup
                        </span>
                      )}
                    </div>

                    <div className="text-white/80 italic text-xs leading-normal mb-3 font-sans">
                      {lookupText ? (
                        `"${lookupText[bibleVersion]}"`
                      ) : lookupError ? (
                        <span className="text-red-400 italic text-[11px] font-mono leading-relaxed block bg-red-950/20 border border-red-500/10 p-2 rounded">
                          ⚠️ API Error: {lookupError}
                        </span>
                      ) : (
                        <span className="text-white/30 italic">No text fetched. Adjust selector values to load scripture.</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleCastManualVerse}
                        disabled={!lookupText}
                        className="flex-1 flex justify-center items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[10px] font-bold py-1 rounded cursor-pointer transition-all"
                      >
                        <Play className="w-3 h-3" /> Project Selector Verse
                      </button>
                    </div>
                  </div>

                  {/* Scripture prefetching prediction block */}
                  <div className="border border-white/5 rounded p-2.5 bg-white/5">
                    <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest block mb-1.5">
                      🔮 Scripture Sequence Helpers
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedVerse((prev) => Math.max(1, prev - 1));
                        }}
                        className="flex-1 py-1 bg-[#121417] text-white/70 border border-white/10 rounded text-[10px] font-mono text-center hover:text-white hover:border-white/25 cursor-pointer select-none"
                      >
                        ⮜ PREV VERSE
                      </button>
                      <button
                        onClick={() => {
                          setSelectedVerse((prev) => prev + 1);
                        }}
                        className="flex-1 py-1 bg-[#121417] text-white/70 border border-white/10 rounded text-[10px] font-mono text-center hover:text-white hover:border-white/25 cursor-pointer select-none"
                      >
                        NEXT VERSE ⮞
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SONGS / LYRIC WORKSPACE */}
              {activeTab === "songs" && (
                <div className="space-y-3">
                  <div>
                    <span className="text-[8px] font-mono uppercase tracking-widest text-white/40 block mb-1">
                      Active Praise Song Draft
                    </span>
                    <select
                      value={selectedSongId}
                      onChange={(e) => {
                        setSelectedSongId(e.target.value);
                        setSelectedStanzaIndex(0);
                      }}
                      className="w-full bg-black/40 p-1.5 text-[11px] rounded border border-white/10 text-white focus:outline-none"
                    >
                      {DEFAULT_SONGS.map((song) => (
                        <option key={song.id} value={song.id} className="bg-[#121417]">
                          🎵 {song.title} {song.author ? `— ${song.author}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stanza Selector Grid */}
                  <div>
                    <span className="text-[8px] font-mono uppercase tracking-widest text-white/40 block mb-1.5">
                      Stanza Slides (Select to Cast)
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {activeSong.stanzas.map((stanza, index) => (
                        <button
                          key={index}
                          onClick={() => handleCastLyric(activeSong, stanza, index)}
                          className={`text-left p-2 rounded border text-[11px] leading-relaxed transition-all cursor-pointer ${
                            selectedSongId === activeProjectedSlide.title &&
                            stanza === activeProjectedSlide.body &&
                            activeProjectedSlide.type === "lyrics"
                              ? "bg-blue-600/15 border-blue-500 text-blue-300"
                              : "bg-[#121417]/50 border-white/5 hover:border-white/15 text-white/60"
                          }`}
                        >
                          <span className="text-[8px] uppercase font-mono font-bold block text-white/30 mb-0.5">
                            STANZA {index + 1}
                          </span>
                          <span className="whitespace-pre-line">{stanza}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: CHURCH ANNOUNCEMENTS */}
              {activeTab === "announcements" && (
                <div className="space-y-3">
                  {/* Create Custom Announcement Form */}
                  <form onSubmit={handleCreateAnnouncement} className="border border-blue-500/25 bg-blue-950/10 p-3 rounded-lg flex flex-col gap-2 mb-2">
                    <span className="text-[9px] font-mono text-blue-400 uppercase tracking-widest block font-bold">
                      ➕ Create Custom Announcement
                    </span>
                    <input
                      type="text"
                      placeholder="Announcement Title (e.g. Youth Fellowship)"
                      value={newAnnTitle}
                      onChange={(e) => setNewAnnTitle(e.target.value)}
                      className="w-full bg-black/50 px-2 py-1.5 rounded border border-white/10 text-xs text-white focus:border-blue-500 focus:outline-none placeholder-white/20"
                      required
                    />
                    <textarea
                      placeholder="Announcement message/body to display on screen..."
                      value={newAnnBody}
                      onChange={(e) => setNewAnnBody(e.target.value)}
                      rows={2}
                      className="w-full bg-black/50 p-2 rounded border border-white/10 text-xs text-white focus:border-blue-500 focus:outline-none placeholder-white/20 resize-none font-sans leading-normal"
                      required
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 text-white font-sans font-bold text-xs py-1.5 rounded cursor-pointer transition-all flex items-center justify-center gap-1.5 select-none"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Post &amp; Cast Announcement
                    </button>
                  </form>

                  <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest block mt-3 mb-1">
                    📋 Display Announcements Directory
                  </span>

                  <div className="grid grid-cols-1 gap-1.5 max-h-[180px] overflow-y-auto scrollbar pr-0.5">
                    {announcements.map((ann) => (
                      <div
                        key={ann.id}
                        className="bg-white/5 border border-white/5 rounded p-2.5 flex justify-between items-center hover:border-white/15 transition-all group animate-fade-in"
                      >
                        <div className="flex-1 pr-2.5">
                          <h4 className="font-sans font-bold text-[11px] text-white uppercase tracking-wide mb-0.5">
                            {ann.title}
                          </h4>
                          <p className="text-white/50 text-[10px] leading-normal line-clamp-2">{ann.body}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleCastAnnouncement(ann)}
                            className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer transition-all ${
                              ann.title === activeProjectedSlide.title &&
                              activeProjectedSlide.type === "announcement"
                                ? "bg-blue-600/20 text-blue-300 border border-blue-400/30"
                                : "bg-blue-600 hover:bg-blue-500 text-white"
                            }`}
                          >
                            {ann.title === activeProjectedSlide.title &&
                            activeProjectedSlide.type === "announcement" ? (
                              <>
                                <Check className="w-2.5 h-2.5 text-blue-400" /> Casting
                              </>
                            ) : (
                              <>
                                <Play className="w-2.5 h-2.5" /> Cast
                              </>
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            title="Remove announcement"
                            className="p-1 text-white/30 hover:text-red-400 hover:bg-red-950/20 rounded cursor-pointer transition-all shrink-0"
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Countdown Timer trigger segment */}
                  <div className="border-t border-white/10 pt-3 mt-1">
                    <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest block mb-2">
                      ⏲ Countdown Timer Builder
                    </span>
                    <div className="grid grid-cols-1 gap-2 mb-1">
                      <div>
                        <input
                          type="text"
                          placeholder="Label (e.g. Service Starts In)"
                          value={timerLabel}
                          onChange={(e) => setTimerLabel(e.target.value)}
                          className="w-full bg-black/40 px-2 py-1.5 rounded border border-white/10 text-xs text-white focus:outline-none placeholder-white/25"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          placeholder="Mins"
                          value={timerMinutes}
                          onChange={(e) => setTimerMinutes(parseInt(e.target.value, 10) || 5)}
                          className="w-16 bg-black/40 px-2 py-1.5 rounded border border-white/10 text-xs text-center text-white focus:outline-none font-mono"
                        />
                        <button
                          onClick={handleCastTimer}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded cursor-pointer transition-all flex items-center justify-center gap-1.5 select-none"
                        >
                          <Clock className="w-3.5 h-3.5" /> Launch Timer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: PLANS & SUBSCRIPTIONS */}
              {activeTab === "plans" && (
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="bg-blue-950/20 border border-blue-500/20 p-3 rounded-xl flex items-start gap-2.5">
                    <Crown className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-[10.5px] leading-relaxed text-[#b1c3de]">
                      <span className="font-bold text-white block">Active Subscription Management</span>
                      Your current active plan is: <span className="text-amber-400 font-extrabold uppercase font-mono">
                        {userPlan === "free" ? "FREE PLAN" : userPlan === "monthly" ? "PRO MONTHLY PLAN" : "PREMIUM PLAN"}
                      </span>.
                      Upgrade or switch plans below. Updates are immediately saved and synced across screens in real-time.
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Free Card */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all relative ${
                      userPlan === "free" ? "bg-white/5 border-blue-500/40" : "bg-[#121417]/50 border-white/5 opacity-80"
                    }`}>
                      {userPlan === "free" && (
                        <span className="absolute top-3 right-3 bg-blue-500/25 border border-blue-500/30 text-blue-400 font-bold font-mono text-[7px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Active Plan
                        </span>
                      )}
                      <div>
                        <h4 className="font-sans font-bold text-xs text-white uppercase tracking-wider">Free Plan</h4>
                        <div className="text-lg font-bold text-white font-mono mt-1">₦0<span className="text-xs text-white/55">/mo</span></div>
                        <p className="text-[10px] text-white/50 mt-1 leading-normal">Manual Bible Explorer &amp; Casting only. (AI sermon listener, Hymnals, and Announcements locked).</p>
                      </div>
                      {userPlan !== "free" && (
                        <button
                          onClick={async () => {
                            if (confirm("Are you sure you want to downgrade to the Free Plan? AI-powered auto-projection, Hymnals, Announcements, and Note Journaling will be locked.")) {
                              if (onUpdateSubscription) await onUpdateSubscription("free");
                            }
                          }}
                          className="bg-stone-900 hover:bg-stone-850 text-stone-300 font-bold text-xs py-1.5 rounded-lg mt-3 transition cursor-pointer border border-white/5"
                        >
                          Downgrade to Free
                        </button>
                      )}
                    </div>

                    {/* Pro Monthly Card */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all relative ${
                      userPlan === "monthly" ? "bg-white/5 border-blue-500/40" : "bg-[#121417]/50 border-white/5"
                    }`}>
                      {userPlan === "monthly" && (
                        <span className="absolute top-3 right-3 bg-blue-500/25 border border-blue-500/30 text-blue-400 font-bold font-mono text-[7px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Active Plan
                        </span>
                      )}
                      <div>
                        <h4 className="font-sans font-bold text-xs text-white uppercase tracking-wider">Pro Monthly</h4>
                        <div className="text-lg font-bold text-white font-mono mt-1">₦10,000<span className="text-xs text-white/55">/mo</span></div>
                        <p className="text-[10px] text-white/50 mt-1 leading-normal">Unlocks the AI-powered sermon feature alone: automatic speech recognition and instant scripture projection.</p>
                      </div>
                      {userPlan !== "monthly" && (
                        <button
                          onClick={() => setCheckoutPlan("monthly")}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-1.5 rounded-lg mt-3 transition cursor-pointer"
                        >
                          {userPlan === "yearly" ? "Switch to Pro Monthly" : "Upgrade to Pro Monthly (₦10,000)"}
                        </button>
                      )}
                    </div>

                    {/* Premium Card */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all relative ${
                      userPlan === "yearly" ? "bg-white/5 border-amber-500/40" : "bg-gradient-to-tr from-amber-500/5 to-transparent border-white/5"
                    }`}>
                      {userPlan === "yearly" && (
                        <span className="absolute top-3 right-3 bg-amber-500 text-slate-950 font-bold font-mono text-[7px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                          Active Plan
                        </span>
                      )}
                      <div>
                        <h4 className="font-sans font-bold text-xs text-amber-250 uppercase tracking-wider">Premium Plan</h4>
                        <div className="text-lg font-bold text-white font-mono mt-1">₦25,000<span className="text-xs text-white/55">/mo</span></div>
                        <p className="text-[10px] text-white/50 mt-1 leading-normal">Unlocks the ENTIRE application: Hymnals, Announcements, Note cloud journal with Markdown exports, AI outline helper, custom church branding name, parallel dual translations, and advanced themes.</p>
                      </div>
                      {userPlan !== "yearly" && (
                        <button
                          onClick={() => setCheckoutPlan("yearly")}
                          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 text-slate-950 font-extrabold text-xs py-1.5 rounded-lg mt-3 transition cursor-pointer"
                        >
                          Upgrade to Premium (₦25,000)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ================= RIGHT GRID COLUMN: ACTIVE MONITOR & THEMES CUSTOMIZER (5 Cols) ================= */}
        <div className="xl:col-span-5 flex flex-col gap-1.5 overflow-hidden">
          
          {/* Active Broadcast Preview Frame */}
          <div className="glass-panel rounded-lg p-3.5 flex flex-col">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
              <Eye className="w-3.5 h-3.5 text-blue-400" /> ACTIVE BROADCAST FEED
            </h3>

            {/* Simulated Live Projector Frame */}
            <div className={`relative aspect-video rounded border flex flex-col justify-between p-3 select-none shadow-inner overflow-hidden ${
              activeProjectedSlide.type === "black" 
                ? "bg-black text-white border-white/10" 
                : (activeProjectedSlide.type === "verse" && activeProjectedSlide.layout === "lower-third" 
                  ? "bg-[#08090d] border-dashed border-sky-500/40 text-white" 
                  : `border-white/10 ${activeProjTheme.bgClass}`)
            }`}>
              
              <div className="z-10 flex justify-between items-center opacity-70">
                <span className={`font-mono text-[8px] uppercase tracking-wider flex items-center gap-1 ${isProjThemeLight ? "text-stone-700 font-semibold" : "text-white/45"}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                  {activeProjectedSlide.type.toUpperCase()}{activeProjectedSlide.type === "verse" && activeProjectedSlide.layout ? ` (${activeProjectedSlide.layout.replace("-", " ")})` : ""}
                </span>
                <span className="bg-red-950/40 text-red-400 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded border border-red-500/20 uppercase tracking-widest animate-pulse">
                  ON AIR
                </span>
              </div>

              <div className="z-10 flex-1 flex flex-col justify-center items-center text-center px-4 max-h-[140px] overflow-hidden w-full">
                {activeProjectedSlide.type === "black" ? (
                  <div className="text-[10px] font-mono text-white/30 italic">★ SCREEN MUTED - BLACKOUT ACTIVE ★</div>
                ) : activeProjectedSlide.type === "timer" ? (
                  <div className="flex flex-col items-center">
                    <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded-full mb-1 border uppercase ${isProjThemeLight ? "text-amber-800 bg-amber-500/10 border-amber-500/30 font-semibold" : "text-amber-300 bg-amber-500/15 border-amber-500/20"}`}>
                      {activeProjectedSlide.title}
                    </span>
                    <span className={`font-mono font-bold text-3xl tracking-widest ${isProjThemeLight ? "text-stone-900" : "text-white"}`}>04:36</span>
                  </div>
                ) : activeProjectedSlide.type === "verse" && activeProjectedSlide.layout === "lower-third" ? (
                  // Lower third template representation
                  <div className="absolute inset-x-3 bottom-8 text-left bg-slate-950/95 border border-white/10 rounded px-2.5 py-1.5 shadow-xl flex flex-col justify-center animate-fade-in-up">
                    <p className="text-[7.5px] font-sans text-white/90 line-clamp-2 leading-relaxed tracking-wide">
                      "{activeProjectedSlide.body}"
                    </p>
                    <span className="text-[6.5px] font-mono text-sky-400 uppercase tracking-wider block mt-0.5">
                      — {activeProjectedSlide.book} {activeProjectedSlide.chapter}:{activeProjectedSlide.verse}
                    </span>
                  </div>
                ) : activeProjectedSlide.type === "verse" && activeProjectedSlide.layout === "split-screen" ? (
                  // Split screen template representation
                  <div className="grid grid-cols-12 gap-2 text-left items-center w-full my-auto animate-fade-in">
                    <div className={`col-span-4 border-r pr-1.5 ${isProjThemeLight ? "border-black/10" : "border-white/10"}`}>
                      <h4 className={`font-display font-bold text-[8.5px] uppercase tracking-wider truncate leading-tight ${isProjThemeLight ? "text-amber-900" : "text-amber-300"}`}>
                        {activeProjectedSlide.book}
                      </h4>
                      <p className="font-mono text-[6.5px] text-white/40 mt-0.5 leading-none">
                        Ch. {activeProjectedSlide.chapter}:{activeProjectedSlide.verse}
                      </p>
                    </div>
                    <div className="col-span-8">
                      <blockquote
                        style={{ fontSize: `${Math.max(7.5, (activeProjectedSlide.fontSize || 44) * 0.2)}px` }}
                        className={`font-sans leading-normal line-clamp-3 ${isProjThemeLight ? "text-stone-900 font-medium" : "text-white"}`}
                      >
                        "{activeProjectedSlide.body}"
                      </blockquote>
                    </div>
                  </div>
                ) : (
                  // Standard Fullscreen or lyric/announcement template
                  <div className="flex flex-col items-center justify-center w-full">
                    <p 
                      style={{ fontSize: `${Math.max(8, (activeProjectedSlide.fontSize || 44) * 0.25)}px` }}
                      className={`font-sans italic tracking-wide line-clamp-3 leading-relaxed transition-all duration-150 ${isProjThemeLight ? "text-stone-900 font-medium" : "text-white"}`}
                    >
                      "{activeProjectedSlide.body || "Chaver Output Stream Empty. Ready for casting."}"
                    </p>
                    {activeProjectedSlide.type === "verse" && (
                      <span className={`text-[8px] block mt-1.5 font-mono uppercase tracking-widest font-bold ${isProjThemeLight ? "text-stone-600" : "text-sky-400"}`}>
                        — {activeProjectedSlide.book} {activeProjectedSlide.chapter}:{activeProjectedSlide.verse}
                      </span>
                    )}
                    {activeProjectedSlide.type === "lyrics" && (
                      <span className={`text-[7px] block mt-1 px-1.5 py-0.5 font-mono bg-stone-500/10 rounded-full ${isProjThemeLight ? "text-stone-600 border border-stone-200" : "text-white/45"}`}>
                        🎵 {activeProjectedSlide.title}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className={`z-10 border-t pt-1 opacity-50 text-[8px] font-mono flex justify-between ${isProjThemeLight ? "border-black/10 text-stone-700" : "border-white/5 text-white/35"}`}>
                <span>FORMAT: 16:9 • FHD</span>
                <span>EMBLEM: {showLogo ? "YES" : "NO"} • SCALE: {activeProjectedSlide.fontSize}px</span>
              </div>
            </div>
          </div>

          {/* Projector Aesthetics Config Modules */}
          <div className="glass-panel rounded-lg p-3.5 flex flex-col gap-3.5">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-2">
              <Sliders className="w-3.5 h-3.5 text-blue-400" /> STREAM STYLING MATRIX
            </h3>
            {/* Preset themes selection */}
            <div>
              <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest block mb-2">
                Layout Theme Presets
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {THEME_PRESETS.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => {
                      if (isThemeLocked(theme.id)) {
                        setUpgradeTriggerSource(theme.id === "sanctuary-aurora" ? "Premium Sanctuary Aurora Theme" : "Premium Theme Presets");
                        setShowUpgradePromptModal(true);
                        return;
                      }
                      onChangeActiveThemeId(theme.id);
                      onCastSlide({ ...activeProjectedSlide, themeId: theme.id as any });
                    }}
                    className={`p-1.5 flex items-center justify-between bg-black/40 border rounded text-[10px] transition-all cursor-pointer ${
                      activeThemeId === theme.id ? "border-blue-500 text-blue-300 bg-blue-950/20" : "border-white/5 text-white/50 hover:text-white"
                    } ${isThemeLocked(theme.id) ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-tr ${theme.previewGradient} flex-shrink-0`} />
                      <span className="font-sans font-bold text-[10px] tracking-tight block truncate">
                        {theme.name.toUpperCase()}
                      </span>
                    </div>
                    {isThemeLocked(theme.id) && <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout structures selector */}
            <div>
              <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest block mb-2">
                Verse Presentation Template
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(["fullscreen", "lower-third", "split-screen"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      onChangeLayoutMode(mode);
                      onCastSlide({ ...activeProjectedSlide, layout: mode });
                    }}
                    className={`py-1 px-1 text-center font-sans text-[10px] font-bold rounded border cursor-pointer select-none uppercase tracking-wider transition-all ${
                      layoutMode === mode
                        ? "bg-blue-600/15 border-blue-500 text-blue-300"
                        : "bg-black/30 border-white/5 text-white/40 hover:text-white/80"
                    }`}
                  >
                    {mode.replace("-", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Resizing and badges flags */}
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex justify-between items-center text-[9px] font-mono mb-1.5">
                  <span className="text-white/40 uppercase tracking-widest">DISPLAY SCALE</span>
                  <span className="text-blue-400 font-bold">{fontSize}PX</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={fontSize}
                  onChange={(e) => {
                    const size = parseInt(e.target.value, 10);
                    onChangeFontSize(size);
                    onCastSlide({ ...activeProjectedSlide, fontSize: size });
                  }}
                  className="w-full accent-blue-500 h-1 bg-black rounded appearance-none cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                  SHOW CHRISTIAN SACRED EMBLEM {userPlan === "free" && <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                </span>
                <button
                  onClick={() => {
                    if (userPlan === "free") {
                      setUpgradeTriggerSource("Branding Watermark Removal");
                      setShowUpgradePromptModal(true);
                      return;
                    }
                    onChangeShowLogo(!showLogo);
                    onCastSlide({ ...activeProjectedSlide, showLogo: !showLogo });
                  }}
                  className={`w-9 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    showLogo ? "bg-blue-600" : "bg-white/10"
                  } ${userPlan === "free" ? "opacity-55" : ""}`}
                >
                  <div
                    className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${
                      showLogo ? "translate-x-4.5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Yearly Premium Exclusive controls panel */}
            {userPlan === "yearly" ? (
              <div className="border-t border-blue-500/20 pt-3.5 mt-2.5 space-y-3.5 text-left">
                <div className="flex items-center gap-1.5 text-blue-400 font-bold uppercase text-[10px] tracking-wide">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Premium Plan Controls</span>
                </div>

                {/* Custom Brand text */}
                <div className="space-y-1">
                  <label className="text-[8px] font-mono text-white/40 uppercase tracking-widest block">
                    Custom Projector Brand Text
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Grace Temple (displays top-right)"
                    value={customBrandingText}
                    onChange={(e) => {
                      const text = e.target.value;
                      onChangeCustomBrandingText(text);
                      // Cast immediately to update current display!
                      onCastSlide({ ...activeProjectedSlide, customBrandingText: text });
                    }}
                    className="w-full bg-black/40 px-2 py-1.5 rounded border border-white/10 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Multi-Translation Parallel Toggle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">
                      Multi-Translation Parallel Mode
                    </span>
                    <button
                      onClick={() => {
                        const nextVal = !isParallelEnabled;
                        onChangeIsParallelEnabled(nextVal);
                        // Trigger immediate slide update to reflect parallel changes
                        if (activeProjectedSlide.type === "verse") {
                          onCastSlide({
                            ...activeProjectedSlide,
                            parallelBody: nextVal && lookupText ? lookupText[parallelVersion] : undefined,
                            parallelTranslation: nextVal ? parallelVersion : undefined,
                          });
                        }
                      }}
                      className={`w-9 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                        isParallelEnabled ? "bg-teal-500" : "bg-white/10"
                      }`}
                    >
                      <div
                        className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${
                          isParallelEnabled ? "translate-x-4.5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {isParallelEnabled && (
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">Parallel:</span>
                      <select
                        value={parallelVersion}
                        onChange={(e) => {
                          const ver = e.target.value as any;
                          onChangeParallelVersion(ver);
                          if (activeProjectedSlide.type === "verse" && lookupText) {
                            onCastSlide({
                              ...activeProjectedSlide,
                              parallelBody: lookupText[ver],
                              parallelTranslation: ver,
                            });
                          }
                        }}
                        className="bg-black/40 p-1 text-[10px] rounded border border-white/10 text-white focus:outline-none flex-1"
                      >
                        <option value="KJV" className="bg-[#121417]">KJV — King James</option>
                        <option value="NIV" className="bg-[#121417]">NIV — New International</option>
                        <option value="ESV" className="bg-[#121417]">ESV — English Standard</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-t border-white/5 pt-3.5 mt-2 bg-gradient-to-tr from-amber-500/5 to-transparent p-2.5 rounded-lg border border-amber-500/10 flex flex-col gap-1 text-left">
                <span className="text-[9px] font-bold text-amber-400 flex items-center gap-1 uppercase tracking-wide">
                  <Crown className="w-3.5 h-3.5 text-amber-500" /> Unlock Advanced Controls
                </span>
                <p className="text-[9px] text-white/50 leading-normal">
                  Upgrade to the **Premium Plan** to project dual parallel scriptures side-by-side and set your custom church logo text on screens!
                </p>
                <button
                  onClick={() => {
                    setUpgradeTriggerSource("Advanced Premium Controls");
                    setShowUpgradePromptModal(true);
                  }}
                  className="mt-1 text-[9px] font-mono text-amber-300 font-extrabold uppercase hover:underline text-left cursor-pointer"
                >
                  View Premium Features &rarr;
                </button>
              </div>
            )}

          </div>
        </div>

      </main>

      {/* 3. SYSTEM PERFORMANCE MONITOR FOOTER */}
      <footer className="h-8 border-t border-white/10 bg-[#0A0B0D] flex items-center justify-between px-4 text-[10px] text-white/40 select-none">
        <div className="flex gap-6 items-center">
          <div className="flex gap-2 items-center">
            <span className="text-white/20 font-bold uppercase">CPU:</span>
            <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-[24%]"></div>
            </div>
            <span>24%</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-white/20 font-bold uppercase">MEM:</span>
            <span>1.1 GB</span>
          </div>
        </div>
        <div className="flex gap-4 items-center font-mono">
          <span className="text-[#10B981] font-bold uppercase">● ONLINE SYNC ACTIVE</span>
          <span className="text-white/25">|</span>
          <span>v2.5.0-stable</span>
        </div>
      </footer>

      {/* 4. UPGRADE / PAYWALL MODAL */}
      {showUpgradePromptModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-lg bg-[#111317] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col shadow-2xl relative animate-fade-in text-left">
            <button
              onClick={() => setShowUpgradePromptModal(false)}
              className="absolute top-5 right-5 p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
              <Lock className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="font-sans font-black text-sm uppercase text-white tracking-tight">Feature Locked: {upgradeTriggerSource}</h3>
                <span className="text-[9px] font-mono text-amber-400 uppercase tracking-widest font-bold">REQUIRES ACTIVE UPGRADE TIER</span>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed font-sans mb-6">
              You clicked on a locked premium asset. Subscribe to a plan below to unlock unrestricted preaching power for your congregation!
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* Monthly card */}
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-blue-500/35 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans font-bold text-xs text-white uppercase tracking-wider">Pro Monthly</span>
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="text-xl font-bold text-white font-mono mt-1">₦10,000<span className="text-xs text-white/50">/mo</span></div>
                  <ul className="text-[10px] text-white/55 space-y-1 mt-3">
                    <li>✓ AI Sermon Live Listening</li>
                    <li>✓ Automatic verse detection</li>
                    <li>✓ Instant projector casting</li>
                    <li>✓ Unlock KJV &amp; ESV translations</li>
                  </ul>
                </div>
                <button
                  onClick={() => {
                    setCheckoutPlan("monthly");
                    setShowUpgradePromptModal(false);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 rounded-lg mt-5 transition cursor-pointer"
                >
                  Select Pro Monthly
                </button>
              </div>

              {/* Yearly card */}
              <div className="bg-gradient-to-tr from-blue-650/10 via-amber-500/5 to-transparent border border-amber-500/25 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/50 transition-all relative">
                <div className="absolute top-[-9px] right-3 bg-amber-500 text-slate-950 font-bold font-mono text-[7px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Best Value
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans font-bold text-xs text-amber-250 uppercase tracking-wider">Premium Plan</span>
                    <Crown className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  </div>
                  <div className="text-xl font-bold text-white font-mono mt-1">₦25,000<span className="text-xs text-white/50">/mo</span></div>
                  <ul className="text-[10px] text-white/55 space-y-1 mt-3">
                    <li className="text-amber-200/90 font-semibold">★ Sanctuary Notes Cloud Journal</li>
                    <li className="text-amber-200/90 font-semibold">★ Praise Hymnals &amp; Media</li>
                    <li className="text-amber-200/90 font-semibold">★ Parallel scripture projections</li>
                    <li className="text-amber-200/90 font-semibold">★ Custom logo branding text</li>
                    <li>✓ Premium Aurora theme overlay</li>
                    <li>✓ All Pro Monthly features</li>
                  </ul>
                </div>
                <button
                  onClick={() => {
                    setCheckoutPlan("yearly");
                    setShowUpgradePromptModal(false);
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 text-slate-950 font-extrabold text-xs py-2 rounded-lg mt-5 transition cursor-pointer"
                >
                  Select Premium
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. SIMULATED CHECKOUT DIALOG */}
      {checkoutPlan && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in text-left">
          <div className="w-full max-w-md bg-[#111317] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col shadow-2xl relative">
            
            {checkoutSuccess ? (
              <div className="text-center py-6 flex flex-col items-center gap-4 animate-scale-in">
                <div className="w-12 h-12 bg-green-500/20 text-green-400 border border-green-400/30 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                  <Award className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="font-sans font-black text-lg text-white uppercase tracking-wider">Payment Authorized!</h3>
                  <span className="text-[10px] font-mono text-green-400 uppercase tracking-widest block font-bold mt-0.5">
                    Welcome to {checkoutPlan === "yearly" ? "Premium Plan" : "Pro Monthly"}
                  </span>
                </div>
                <p className="text-xs text-white/60 max-w-xs leading-relaxed font-sans">
                  Ecclesiastical upgrade completed successfully. All locked features are now fully mapped to your sanctuary account.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutPlan(null);
                    setCheckoutSuccess(false);
                    setCardHolder("");
                    setCardNumber("");
                    setCardExpiry("");
                    setCardCvc("");
                  }}
                  className="bg-green-600 hover:bg-green-500 text-white font-sans font-bold text-xs px-6 py-2.5 rounded-xl transition cursor-pointer shadow-md shadow-green-900/10"
                >
                  Enter Studio Console
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCheckoutLoading(true);
                  // Simulate network payment auth
                  await new Promise((resolve) => setTimeout(resolve, 1550));
                  setCheckoutLoading(false);
                  setCheckoutSuccess(true);
                  if (onUpdateSubscription) {
                    await onUpdateSubscription(checkoutPlan);
                  }
                }}
                className="space-y-4 text-left"
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-400" />
                    <div>
                      <h3 className="font-sans font-black text-sm uppercase text-white tracking-tight">Secured checkout</h3>
                      <span className="text-[9px] font-mono text-stone-400 uppercase">Simulated Payment Gateway</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCheckoutPlan(null)}
                    className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-3 text-[10.5px] leading-relaxed text-blue-300">
                  <span className="font-bold block mb-0.5">💳 Sandbox Simulation Mode</span>
                  To simulate a successful upgrade, input any cardholder details below. Zero actual funds will be charged.
                </div>

                {/* Amount details */}
                <div className="bg-black/30 p-3 rounded-lg border border-white/5 flex justify-between items-center">
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Upgrade Selection:</span>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {checkoutPlan === "yearly" ? "★ Premium Plan (₦25,000/mo)" : "✓ Pro Monthly (₦10,000/mo)"}
                  </span>
                </div>

                {/* Cardholder Name */}
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block">Cardholder Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Pastor John Doe"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    className="w-full bg-[#181a1f] border border-white/10 focus:border-blue-500 focus:outline-none px-3 py-2 rounded-xl text-xs text-white placeholder-white/20"
                  />
                </div>

                {/* Card Number */}
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block">Credit Card Number</label>
                  <input
                    type="text"
                    required
                    placeholder="4000 1234 5678 9010"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full bg-[#181a1f] border border-white/10 focus:border-blue-500 focus:outline-none px-3 py-2 rounded-xl text-xs text-white placeholder-white/20 font-mono"
                  />
                </div>

                {/* Expiry and CVC */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block">Expiry Date</label>
                    <input
                      type="text"
                      required
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full bg-[#181a1f] border border-white/10 focus:border-blue-500 focus:outline-none px-3 py-2 rounded-xl text-xs text-white placeholder-white/20 font-mono text-center"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block">CVC / CVV</label>
                    <input
                      type="password"
                      required
                      placeholder="•••"
                      maxLength={3}
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value)}
                      className="w-full bg-[#181a1f] border border-white/10 focus:border-blue-500 focus:outline-none px-3 py-2 rounded-xl text-xs text-white placeholder-white/20 font-mono text-center"
                    />
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={checkoutLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-sans font-bold text-xs py-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {checkoutLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-3.5 h-3.5" /> Authorize Upgrade
                    </>
                  )}
                </button>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
