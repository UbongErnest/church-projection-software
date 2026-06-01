import { useState, useEffect, useRef, FormEvent } from "react";
 import { supabase, UserProfile } from "../supabase";
 import { User as SupabaseUser } from "@supabase/supabase-js";
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
   Globe,
   Image,
   Video
 } from "lucide-react";
import { ActiveSlide, DetectedVerse, Song, AnnouncementSlide, MediaSlide } from "../types";
import { DEFAULT_SONGS, DEFAULT_ANNOUNCEMENTS, THEME_PRESETS } from "../data";
import { BIBLE_BOOKS, normalizeBookName, OFFLINE_BIBLE_DB, getKjvVerseText } from "../bibleDatabase";

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
   userProfile?: UserProfile | null;
   currentUser?: SupabaseUser | null;
   onUpdateSubscription?: (newPlan: "free" | "monthly" | "yearly") => Promise<void>;
   isAutoProjectEnabled?: boolean;
   onToggleAutoProject?: () => void;

   bibleVersion: "KJV";
   onChangeBibleVersion: (version: "KJV") => void;
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
   parallelVersion: "KJV";
   onChangeParallelVersion: (version: "KJV") => void;
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
    onChangeCustomBrandingText,
    currentUser,
    isAutoProjectEnabled,
    onToggleAutoProject,
  }: ControlPanelProps) {
  // User level plan and restrictions state mapping
  const userPlan = userProfile?.subscriptionPlan || "free";

  // Real-time speech recognition state
  const [audioStatusMessage, setAudioStatusMessage] = useState("Ready to start live transcription.");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isListeningToMic, setIsListeningToMic] = useState(false);
  const recognitionRef = useRef<any>(null);
  const interimTranscriptRef = useRef<string>("");

  // Navigation sub-tabs (adding plans tab)
  const [activeTab, setActiveTab] = useState<"ai-feed" | "manual-bible" | "songs" | "announcements" | "media-library" | "plans">("plans");

// Upgrade prompt modal states
    const [showUpgradePromptModal, setShowUpgradePromptModal] = useState(false);
    const [upgradeTriggerSource, setUpgradeTriggerSource] = useState("");
    const [checkoutLoading, setCheckoutLoading] = useState(false);

/* Selection states for Bible Search */
   const [selectedBook, setSelectedBook] = useState<string>("John");
   const [selectedChapter, setSelectedChapter] = useState<number>(3);
   const [selectedVerse, setSelectedVerse] = useState<number>(16);
   const [searchQuery, setSearchQuery] = useState<string>("");

   // Search results for manual lookup
   const [lookupText, setLookupText] = useState<{ KJV: string } | null>(null);
   const [isLoadingLookup, setIsLoadingLookup] = useState<boolean>(false);
   const [lookupError, setLookupError] = useState<string | null>(null);

// Theme lock helper
const isThemeLocked = (themeId: string) => {
       if (["sanctuary-aurora"].includes(themeId)) {
         return userPlan !== "yearly"; // Premium (yearly) only - special premium theme
       }
       return false;
     };

// Flutterwave checkout handler - server initializes checkout, Flutterwave redirects back after payment
    const readApiResponse = async (response: Response) => {
      const rawText = await response.text();

      try {
        return rawText ? JSON.parse(rawText) : {};
      } catch {
        return {
          error: rawText || "Unexpected server response.",
          details: rawText || "Unexpected server response.",
        };
      }
    };

    const initializeSpeechRecognition = () => {
      if (typeof window === "undefined") return null;

      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (!SpeechRecognition) {
        setAudioError("Web Speech API is not supported in your browser.");
        setAudioStatusMessage("Speech recognition unavailable.");
        return null;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListeningToMic(true);
        setAudioStatusMessage("Listening... Transcription streaming to AI.");
        setAudioError(null);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }

        interimTranscriptRef.current = interimTranscript;

        if (finalTranscript) {
          const fullText = finalTranscript.trim();
          onTriggerDetect(fullText);
        }
      };

      recognition.onerror = (event: any) => {
        let errorMsg = "Unknown error occurred.";
        switch (event.error) {
          case "network":
            errorMsg = "Network error. Check your connection.";
            break;
          case "audio":
            errorMsg = "Audio capture error. Check microphone.";
            break;
          case "not-allowed":
            errorMsg = "Microphone permission denied.";
            break;
          case "no-speech":
            errorMsg = "No speech detected. Please speak.";
            break;
          default:
            errorMsg = `Speech recognition error: ${event.error}`;
        }
        setAudioError(errorMsg);
        setAudioStatusMessage("Speech recognition error.");
      };

      recognition.onend = () => {
        setIsListeningToMic(false);
        setAudioStatusMessage("Listening stopped.");
      };

      return recognition;
    };

    const handleStartLiveTranscription = () => {
      if (!recognitionRef.current) {
        recognitionRef.current = initializeSpeechRecognition();
      }

      if (!recognitionRef.current) {
        setAudioError("Unable to initialize speech recognition.");
        return;
      }

      try {
        recognitionRef.current.start();
      } catch (err: any) {
        setAudioError(err.message || "Failed to start speech recognition.");
      }
    };

    const handleStopLiveTranscription = () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListeningToMic(false);
        setAudioStatusMessage("Live transcription stopped.");
      }
    };

const getAudioEnvironmentHint = () => {
      if (typeof window === "undefined") return "Browser environment required.";
      if (!window.isSecureContext) {
        return "Microphone capture requires a secure context (HTTPS or localhost).";
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return "Your browser does not support navigator.mediaDevices.getUserMedia().";
      }
      if (typeof MediaRecorder === "undefined") {
        return "Your browser does not support MediaRecorder.";
      }
      return "Microphone available.";
    };

    const mapMediaErrorToMessage = (error: unknown) => {
      const defaultMsg = "Unable to access microphone. Please retry with permission enabled.";
      if (error instanceof DOMException) {
        switch (error.name) {
          case "NotAllowedError":
            return "Microphone permission denied. Allow microphone access in your browser settings.";
          case "NotFoundError":
            return "No microphone found. Connect a microphone and retry.";
          case "NotReadableError":
            return "Microphone is currently unavailable or in use by another application.";
          case "OverconstrainedError":
            return "Requested microphone constraints cannot be satisfied by this device.";
          case "SecurityError":
            return "Microphone access was blocked by browser security settings.";
          default:
            return `${defaultMsg} (${error.name})`;
        }
      }
      if (error && typeof error === "object" && "name" in error) {
        return `${defaultMsg} (${(error as any).name})`;
      }
      return defaultMsg;
    };

const handleFlutterwaveCheckout = async (plan: "monthly" | "yearly") => {
        if (!currentUser?.id) {
          alert("Please log in to upgrade your subscription.");
          return;
        }

        const userEmail = userProfile?.email || currentUser.email;
        if (!userEmail) {
          alert("Unable to proceed with payment - no email found.");
          return;
        }

        setCheckoutLoading(true);

        try {
          const user_id = currentUser.id;
          const initializeResponse = await fetch("/api/payment/initialize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: userEmail,
              plan,
              userId: user_id,
            }),
          });

          const initializeData = await readApiResponse(initializeResponse);

          if (!initializeResponse.ok) {
            const errorMsg = initializeData?.details || initializeData?.error || "Unable to start Flutterwave checkout.";
            throw new Error(errorMsg);
          }

          if (!initializeData?.success) {
            throw new Error(initializeData?.details || initializeData?.error || "Payment initialization failed.");
          }

          const paymentLink = initializeData.paymentLink;
          if (!paymentLink) {
            throw new Error("Payment link not returned from server.");
          }

          window.location.assign(paymentLink);
        } catch (error: any) {
          console.error("Flutterwave checkout error:", error);
          setCheckoutLoading(false);
          const errorMessage = error.message || "Please try again.";
          if (errorMessage.includes("FLUTTERWAVE_SECRET_KEY") || errorMessage.includes("configuration")) {
            alert(`Payment configuration error. Please configure FLUTTERWAVE_SECRET_KEY in your environment.`);
          } else {
            alert(`Payment processing error: ${errorMessage}`);
          }
        }
      };

// Song and announcements selection
   const [selectedSongId, setSelectedSongId] = useState<string>(DEFAULT_SONGS[0].id);
   const [selectedStanzaIndex, setSelectedStanzaIndex] = useState<number>(0);

   // Custom hymns state (user-uploaded songs)
   const [customSongs, setCustomSongs] = useState<Song[]>(() => {
     try {
       const stored = localStorage.getItem("chaver_custom_songs");
       if (stored) return JSON.parse(stored);
     } catch (e) {
       console.warn("Storage reading blocked or empty, loaded defaults.");
     }
     return [];
   });

   // Persist custom songs to localStorage
   useEffect(() => {
     try {
       localStorage.setItem("chaver_custom_songs", JSON.stringify(customSongs));
     } catch (err) {
       console.error("Storage save failed:", err);
     }
   }, [customSongs]);

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

// Media files state
     const [mediaFiles, setMediaFiles] = useState<MediaSlide[]>(() => {
       try {
         const stored = localStorage.getItem("chaver_media_files");
         if (stored) return JSON.parse(stored);
       } catch (e) {
         console.warn("Storage reading blocked or empty, loaded defaults.");
       }
       return [];
     });

    // Persist media files to localStorage
    useEffect(() => {
      try {
        localStorage.setItem("chaver_media_files", JSON.stringify(mediaFiles));
      } catch (err) {
        console.error("Storage save failed:", err);
      }
    }, [mediaFiles]);

    useEffect(() => {
      return () => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      };
    }, []);

   // Handle media file upload and projection
   const handleCastMedia = (media: { type: "image" | "video"; name: string; url: string }) => {
     onCastSlide({
       type: "media",
       title: media.name,
       body: "",
       mediaUrl: media.url,
       mediaType: media.type,
       customBrandingText: userPlan === "yearly" && customBrandingText ? customBrandingText : undefined,
       layout: layoutMode,
       themeId: activeThemeId as any,
       fontSize: fontSize,
       showLogo: showLogo,
     });
   };

const handleDeleteMedia = (id: string) => {
      setMediaFiles(prev => prev.filter(m => m.id !== id));
    };

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

    // 1. Attempt client-side KJV JSON database lookup first (comprehensive offline coverage)
    const kjvText = getKjvVerseText(b, c, v);
    if (kjvText) {
      const cleanKjvText = kjvText.trim().replace(/^¶\s*/, "");
      setLookupText({ KJV: cleanKjvText });
      setIsLoadingLookup(false);
      if (autoProject) {
        const hasParallel = isParallelEnabled && userPlan === "yearly";
        onCastSlide({
          type: "verse",
          title: `${b} ${c}:${v}`,
          body: cleanKjvText,
          parallelBody: hasParallel ? cleanKjvText : undefined,
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

    // 2. Attempt small offline database match for multi-translation fallback
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
      console.warn("API lookup failed, using offline fallback:", err.message);
      const fallbackText = generateFallbackVerseText(b, c, v);
      setLookupText(fallbackText);
      setLookupError(null);
      if (autoProject) {
        const hasParallel = isParallelEnabled && userPlan === "yearly";
        onCastSlide({
          type: "verse",
          title: `${b} ${c}:${v}`,
          body: fallbackText[bibleVersion],
          parallelBody: hasParallel ? fallbackText[parallelVersion] : undefined,
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
    } finally {
      setIsLoadingLookup(false);
    }
  };

function generateFallbackVerseText(book: string, chapter: number, verse: number): { KJV: string } {
  const kjvText = getKjvVerseText(book, chapter, verse);
  if (kjvText) {
    const cleanText = kjvText.trim().replace(/^¶\s*/, "");
    return {
      KJV: cleanText,
    };
  }
return {
     KJV: ".",
   };
}

// Convert custom manual search bar queries (e.g. "Romans 12 1") and automatically cast
  const handleKeywordSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
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

      // 1. Attempt client-side KJV JSON database lookup first (comprehensive offline coverage)
      const kjvText = getKjvVerseText(bookName, chapterVal, verseVal);
      if (kjvText) {
        const cleanKjvText = kjvText.trim().replace(/^¶\s*/, "");
        setLookupText({ KJV: cleanKjvText });
        setLookupError(null);
        const hasParallel = isParallelEnabled && userPlan === "yearly";
        onCastSlide({
          type: "verse",
          title: `${bookName} ${chapterVal}:${verseVal}`,
          body: cleanKjvText,
          parallelBody: hasParallel ? cleanKjvText : undefined,
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

      // 2. Attempt small offline database match for multi-translation fallback
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

      // 3. Fetch immediately and project automatically without requiring manual "Project Selector Verse" click
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
          console.warn("API lookup failed, using offline fallback:", err.message);
          const fallbackText = generateFallbackVerseText(bookName, chapterVal, verseVal);
          setLookupText(fallbackText);
          setLookupError(null);
          const hasParallel = isParallelEnabled && userPlan === "yearly";
          onCastSlide({
            type: "verse",
            title: `${bookName} ${chapterVal}:${verseVal}`,
            body: fallbackText[bibleVersion],
            parallelBody: hasParallel ? fallbackText[parallelVersion] : undefined,
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
        } finally {
          setIsLoadingLookup(false);
        }
      } else {
        alert("Please match standard references: 'Book Chapter:Verse' (e.g., Romans 8:28)");
      }
    };

  // Auto-search when a verse is detected in live transcription
  const prevDetectedCountRef = useRef(detectedVerses.length);
  useEffect(() => {
    if (detectedVerses.length > prevDetectedCountRef.current && activeTab === "manual-bible") {
      const latest = detectedVerses[0];
      if (latest) {
        const query = `${latest.book} ${latest.chapter}:${latest.verse}`;
        setSearchQuery(query);
        setSelectedBook(latest.book);
        setSelectedChapter(latest.chapter);
        setSelectedVerse(latest.verse);
        // Only fetch preview, don't re-project since App already projected
        fetchManualVerse(latest.book, latest.chapter, latest.verse, false);
      }
    }
    prevDetectedCountRef.current = detectedVerses.length;
  }, [detectedVerses, activeTab]);

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

const handleDeleteAnnouncement = (id: string) => {
     const updated = announcements.filter((ann) => ann.id !== id);
     setAnnouncements(updated);
     try {
       localStorage.setItem("chaver_custom_announcements", JSON.stringify(updated));
     } catch (err) {
       console.error("Storage delete failed:", err);
     }
   };

// Custom hymn upload handlers
    const [newHymnTitle, setNewHymnTitle] = useState("");
    const [newHymnAuthor, setNewHymnAuthor] = useState("");
    const [newHymnStanzas, setNewHymnStanzas] = useState([{ text: "" }]);
    const [editingHymnId, setEditingHymnId] = useState<string | null>(null);

    // Load hymn into edit form
    const handleEditHymn = (hymn: Song) => {
      setEditingHymnId(hymn.id);
      setNewHymnTitle(hymn.title);
      setNewHymnAuthor(hymn.author || "");
      setNewHymnStanzas(hymn.stanzas.map(s => ({ text: s })));
    };

    const handleAddStanzaField = () => {
      setNewHymnStanzas([...newHymnStanzas, { text: "" }]);
    };

    const handleStanzaChange = (idx: number, text: string) => {
      setNewHymnStanzas(newHymnStanzas.map((s, i) => i === idx ? { text } : s));
    };

    const handleRemoveStanza = (idx: number) => {
      if (newHymnStanzas.length > 1) {
        setNewHymnStanzas(newHymnStanzas.filter((_, i) => i !== idx));
      }
    };

const handleSaveHymn = (e: FormEvent) => {
      e.preventDefault();
      if (!newHymnTitle.trim()) return;

      const validStanzas = newHymnStanzas.filter(s => s.text.trim());
      if (validStanzas.length === 0) return;

      const savedHymn: Song = {
        id: editingHymnId || `custom-hymn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: newHymnTitle.trim(),
        author: newHymnAuthor.trim() || undefined,
        stanzas: validStanzas.map(s => s.text.trim()),
      };

      let updated: Song[];
      if (editingHymnId) {
        updated = customSongs.map(s => s.id === editingHymnId ? savedHymn : s);
      } else {
        updated = [...customSongs, savedHymn];
      }
      setCustomSongs(updated);
      try {
        localStorage.setItem("chaver_custom_songs", JSON.stringify(updated));
      } catch (err) {
        console.error("Storage save failed:", err);
      }
      setNewHymnTitle("");
      setNewHymnAuthor("");
      setNewHymnStanzas([{ text: "" }]);
      setEditingHymnId(null);

      // Auto-select the saved hymn
      setSelectedSongId(savedHymn.id);
      setSelectedStanzaIndex(0);
    };

    // Delete custom hymn
    const handleDeleteHymn = (id: string) => {
      const updated = customSongs.filter(s => s.id !== id);
      setCustomSongs(updated);
      try {
        localStorage.setItem("chaver_custom_songs", JSON.stringify(updated));
      } catch (err) {
        console.error("Storage delete failed:", err);
      }
      if (editingHymnId === id) {
        setEditingHymnId(null);
        setNewHymnTitle("");
        setNewHymnAuthor("");
        setNewHymnStanzas([{ text: "" }]);
      }
    };

    // Cancel editing
    const handleCancelEdit = () => {
      setEditingHymnId(null);
      setNewHymnTitle("");
      setNewHymnAuthor("");
      setNewHymnStanzas([{ text: "" }]);
    };

const handleTabClick = (tab: "ai-feed" | "manual-bible" | "songs" | "announcements" | "media-library" | "plans") => {
     if (tab === "plans" || tab === "manual-bible") {
       setActiveTab(tab);
       return;
     }

     // Free plan: Bible Explorer, Hymns, Announcements, Media Projector
     if (userPlan === "free") {
       if (tab === "ai-feed") {
         setUpgradeTriggerSource("AI Scripture Detection & Projection");
         setShowUpgradePromptModal(true);
         return;
       }
       setActiveTab(tab);
       return;
     }

     // Monthly/Pro plan: all features
     setActiveTab(tab);
   };

  const activeSong = [...DEFAULT_SONGS, ...customSongs].find((s) => s.id === selectedSongId) || DEFAULT_SONGS[0];

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
{currentUser && (
                <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                    <User className="w-3" />
                  </div>
                  <span className="text-xs text-white/70 font-medium">
                    {userProfile?.displayName || currentUser.email?.split("@")[0] || "User"}
                  </span>
                  <button
                    onClick={async () => {
                      if (confirm("Are you sure you want to sign out?")) {
                        await supabase.auth.signOut();
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
              onClick={() => handleTabClick("media-library")}
              className={`pb-1 uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "media-library"
                  ? "text-white border-b-2 border-blue-500 font-bold"
                  : "hover:text-white"
              }`}
            >
              MEDIA
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

           {/* Auto-Projection Toggle */}
           {isAutoProjectEnabled !== undefined && onToggleAutoProject && (
             <button
               onClick={onToggleAutoProject}
               className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer select-none transition-all ${
                 isAutoProjectEnabled
                   ? "bg-amber-600/15 border border-amber-500/30 text-amber-300 hover:bg-amber-600/25"
                   : "bg-white/5 hover:bg-white/10 text-white/60 border border-white/10"
               }`}
               title={isAutoProjectEnabled ? "Auto-projection ON: Verses will project immediately when detected" : "Auto-projection OFF: Verses will be detected but not projected automatically"}
             >
               <Zap className="w-3 h-3" /> Auto-Proj
             </button>
           )}

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

          <div className="glass-panel rounded-lg p-3.5 flex flex-col min-h-[280px] bg-[#111318] border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                <Music className="w-3 h-3 text-emerald-300" /> Live Transcription
              </h3>
              <span className="text-[9px] uppercase tracking-wide text-white/30">
                {isListeningToMic ? "Streaming live" : "Ready"}
              </span>
            </div>

            <div className="grid gap-2 text-xs text-white/80">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleStartLiveTranscription}
                  disabled={isListeningToMic}
                  className="px-2.5 py-2 rounded bg-emerald-600/15 border border-emerald-500/20 text-emerald-200 hover:bg-emerald-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Start Listening
                </button>
                <button
                  onClick={handleStopLiveTranscription}
                  disabled={!isListeningToMic}
                  className="px-2.5 py-2 rounded bg-rose-600/10 border border-rose-500/20 text-rose-200 hover:bg-rose-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Stop Listening
                </button>
              </div>

              <div className="rounded-md bg-black/50 border border-white/10 p-3 text-[11px] text-white/70">
                <p className="font-semibold text-white/90">Status</p>
                <p className="mt-1 leading-snug">{audioStatusMessage}</p>
                {audioError && <p className="mt-1 text-rose-300">{audioError}</p>}
              </div>

              <div className="text-[10px] text-white/30 leading-snug">
                <p>Browser automatically transcribes your microphone using Web Speech API. As you speak, the live transcript streams to AI detection and auto-projects verses in real-time.</p>
              </div>
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
                📢 ANNOUNCEMENTS
              </button>
              <button
                onClick={() => handleTabClick("media-library")}
                className={`px-3 py-1 font-sans text-[11px] font-bold tracking-tight rounded cursor-pointer transition-all duration-150 whitespace-nowrap ${
                  activeTab === "media-library"
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                    : "text-white/45 bg-transparent border border-transparent hover:text-white/90"
                }`}
              >
                🖼 MEDIA PROJECTOR
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
                                 try {
                                   const lookup = await fetch(`/api/bible/lookup?book=${item.book}&chapter=${item.chapter}&verse=${item.verse}`);
                                   const details = await lookup.json();
                                   if (details && details.text) {
                                     const hasParallel = isParallelEnabled && userPlan === "yearly";
                                     onCastSlide({
                                       type: "verse",
                                       title: item.displayName,
                                       body: details.text[bibleVersion],
                                       parallelBody: hasParallel ? details.text[parallelVersion] : undefined,
                                       parallelTranslation: hasParallel ? parallelVersion : undefined,
                                       customBrandingText: userPlan === "yearly" && customBrandingText ? customBrandingText : undefined,
                                       book: item.book,
                                       chapter: item.chapter,
                                       verse: item.verse,
                                       translation: bibleVersion,
                                       layout: layoutMode,
                                       themeId: activeThemeId as any,
                                       fontSize: fontSize,
                                       showLogo: showLogo,
                                     });
                                   } else {
                                     const fallbackText = generateFallbackVerseText(item.book, item.chapter, item.verse);
                                     const hasParallel = isParallelEnabled && userPlan === "yearly";
                                     onCastSlide({
                                       type: "verse",
                                       title: item.displayName,
                                       body: fallbackText[bibleVersion],
                                       parallelBody: hasParallel ? fallbackText[parallelVersion] : undefined,
                                       parallelTranslation: hasParallel ? parallelVersion : undefined,
                                       customBrandingText: userPlan === "yearly" && customBrandingText ? customBrandingText : undefined,
                                       book: item.book,
                                       chapter: item.chapter,
                                       verse: item.verse,
                                       translation: bibleVersion,
                                       layout: layoutMode,
                                       themeId: activeThemeId as any,
                                       fontSize: fontSize,
                                       showLogo: showLogo,
                                     });
                                   }
                                 } catch (err) {
                                   const fallbackText = generateFallbackVerseText(item.book, item.chapter, item.verse);
                                   const hasParallel = isParallelEnabled && userPlan === "yearly";
                                   onCastSlide({
                                     type: "verse",
                                     title: item.displayName,
                                     body: fallbackText[bibleVersion],
                                     parallelBody: hasParallel ? fallbackText[parallelVersion] : undefined,
                                     parallelTranslation: hasParallel ? parallelVersion : undefined,
                                     customBrandingText: userPlan === "yearly" && customBrandingText ? customBrandingText : undefined,
                                     book: item.book,
                                     chapter: item.chapter,
                                     verse: item.verse,
                                     translation: bibleVersion,
                                     layout: layoutMode,
                                     themeId: activeThemeId as any,
                                     fontSize: fontSize,
                                     showLogo: showLogo,
                                   });
                                 }
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
                       <div className="w-full bg-black/40 p-1 text-[11px] rounded border border-white/10 text-white font-mono text-center">
                         KJV — Authorized King James Version
                       </div>
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
                    {/* Custom Hymn Upload/Edit Form */}
                    <form onSubmit={handleSaveHymn} className="border border-green-500/25 bg-green-950/10 p-3 rounded-lg flex flex-col gap-2 mb-3">
                      <span className="text-[9px] font-mono text-green-400 uppercase tracking-widest block font-bold">
                        {editingHymnId ? "✏️ Edit Custom Hymn" : "➕ Upload Custom Hymn"}
                      </span>
                      <input
                        type="text"
                        placeholder="Hymn Title"
                        value={newHymnTitle}
                        onChange={(e) => setNewHymnTitle(e.target.value)}
                        className="w-full bg-black/50 px-2 py-1.5 rounded border border-white/10 text-xs text-white focus:border-green-500 focus:outline-none placeholder-white/20"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Author (optional)"
                        value={newHymnAuthor}
                        onChange={(e) => setNewHymnAuthor(e.target.value)}
                        className="w-full bg-black/50 px-2 py-1.5 rounded border border-white/10 text-xs text-white focus:border-green-500 focus:outline-none placeholder-white/20"
                      />
                      <div className="flex flex-col gap-1.5">
                        {newHymnStanzas.map((stanza, idx) => (
                          <div key={idx} className="flex gap-1">
                            <textarea
                              placeholder={`Stanza ${idx + 1}`}
                              value={stanza.text}
                              onChange={(e) => handleStanzaChange(idx, e.target.value)}
                              rows={2}
                              className="flex-1 bg-black/50 p-2 rounded border border-white/10 text-xs text-white focus:border-green-500 focus:outline-none placeholder-white/20 resize-none font-sans"
                            />
                            {newHymnStanzas.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveStanza(idx)}
                                className="px-1.5 text-red-400 hover:text-red-300 text-xs"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={handleAddStanzaField}
                          className="text-[10px] text-green-400 hover:text-green-300 font-medium"
                        >
                          + Add Stanza
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="flex-1 bg-green-600 hover:bg-green-500 text-white font-sans font-bold text-xs py-1.5 rounded cursor-pointer transition-all flex items-center justify-center gap-1.5 select-none"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> {editingHymnId ? "Update Hymn" : "Save & Add Hymn"}
                        </button>
                        {editingHymnId && (
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-3 bg-red-600/20 hover:bg-red-600/30 text-red-300 font-sans font-bold text-xs py-1.5 rounded cursor-pointer transition-all"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>

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
                        {customSongs.map((song) => (
                          <option key={song.id} value={song.id} className="bg-[#121417]">
                            📝 {song.title} {song.author ? `— ${song.author}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Custom Hymns Management */}
                    {customSongs.length > 0 && (
                      <div className="border border-white/5 rounded p-2 bg-white/5">
                        <span className="text-[8px] font-mono uppercase text-white/40 block mb-1">
                          Your Custom Hymns
                        </span>
                        <div className="grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto">
                          {customSongs.map((song) => (
                            <div key={song.id} className="flex justify-between items-center bg-[#121417]/50 p-1.5 rounded text-[10px]">
                              <span className="text-white/80 truncate flex-1">{song.title}</span>
                              <button
                                onClick={() => handleEditHymn(song)}
                                className="text-blue-400 hover:text-blue-300 text-xs mr-1"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteHymn(song.id)}
                                className="text-red-400 hover:text-red-300 text-xs"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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

              {/* TAB 4.5: MEDIA LIBRARY */}
              {activeTab === "media-library" && (
                <div className="space-y-3">
                  <div>
                    <span className="text-[8px] font-mono uppercase tracking-widest text-white/40 block mb-1.5">
                      📤 Upload Media Files
                    </span>
                    <div className="border-2 border-dashed border-white/10 rounded-lg p-4 text-center hover:border-blue-500/30 transition-all">
                      <input
                        type="file"
                        id="media-upload"
                        accept="image/*,video/*"
                        multiple
onChange={(e) => {
                          const files = e.target.files;
                          if (files) {
                            Array.from(files).forEach(file => {
                              if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const dataUrl = event.target?.result as string;
                                  const mediaItem = {
                                    id: `media-${Date.now()}-${Math.random()}`,
                                    type: file.type.startsWith("video/") ? "video" as const : "image" as const,
                                    name: file.name,
                                    url: dataUrl
                                  };
                                  setMediaFiles(prev => [...prev, mediaItem]);
                                };
                                reader.readAsDataURL(file);
                              }
                            });
                          }
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="media-upload"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                          <Plus className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-[10px] text-white/60 font-mono">
                          Click to upload images or videos
                        </span>
                        <span className="text-[9px] text-white/40">
                          Supports JPG, PNG, GIF, MP4, WebM
                        </span>
                      </label>
                    </div>
                  </div>

                  {mediaFiles.length > 0 && (
                    <>
                      <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest block mt-3 mb-1">
                        🖼 Media Gallery ({mediaFiles.length} files)
                      </span>
                      <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto scrollbar pr-0.5">
                        {mediaFiles.map((media) => (
                          <div
                            key={media.id}
                            className="bg-white/5 border border-white/5 rounded p-2 flex flex-col gap-1.5 hover:border-white/15 transition-all group relative"
                          >
                            {media.type === "image" ? (
                              <img
                                src={media.url}
                                alt={media.name}
                                className="w-full h-20 object-cover rounded border border-white/5"
                              />
                            ) : (
                              <video
                                src={media.url}
                                className="w-full h-20 object-cover rounded border border-white/5"
                              />
                            )}
                            <span className="text-[10px] text-white/70 truncate font-mono">
                              {media.name}
                            </span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleCastMedia(media)}
                                className="flex-1 flex justify-center items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-bold py-1 rounded cursor-pointer transition-all"
                              >
                                <Play className="w-2.5 h-2.5" /> Cast
                              </button>
                              <button
                                onClick={() => handleDeleteMedia(media.id)}
                                title="Remove media"
                                className="p-1 text-white/30 hover:text-red-400 hover:bg-red-950/20 rounded cursor-pointer transition-all"
                              >
                                <Trash className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {mediaFiles.length === 0 && (
                    <div className="flex-1 flex flex-col justify-center items-center text-center p-6 bg-black/40 border border-white/5 rounded-lg">
                      <Image className="w-8 h-8 text-blue-500/40 mb-2" />
                      <h4 className="font-sans font-bold text-white/70 text-xs uppercase tracking-wider">No Media Files</h4>
                      <p className="text-white/40 text-[10px] max-w-xs mt-1 leading-normal">
                        Upload images or videos to display them on the projector screen during your service.
                      </p>
                    </div>
                  )}
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
                        {userPlan === "free" ? "FREE PLAN" : userPlan === "monthly" ? "PRO PLAN" : "PREMIUM PLAN"}
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
                        <p className="text-[10px] text-white/50 mt-1 leading-normal">Core features included: Bible Explorer, Hymns, Announcements, and Media Projector. (AI Scripture Detection & Projection locked).</p>
                      </div>
                      {userPlan !== "free" && (
                        <button
                          onClick={async () => {
                            if (confirm("Are you sure you want to downgrade to the Free Plan? AI Scripture Detection & Projection will be locked.")) {
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
                        <h4 className="font-sans font-bold text-xs text-white uppercase tracking-wider">Pro Plan</h4>
                        <div className="text-lg font-bold text-white font-mono mt-1">₦10,500<span className="text-xs text-white/55">/mo</span></div>
                        <p className="text-[10px] text-white/50 mt-1 leading-normal">All core features plus AI-powered sermon live listening and automatic scripture projection.</p>
                      </div>
{userPlan !== "monthly" && (
                          <button
                            onClick={() => handleFlutterwaveCheckout("monthly")}
                            disabled={checkoutLoading}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs py-1.5 rounded-lg mt-3 transition cursor-pointer"
                          >
                            {userPlan === "yearly" ? "Switch to Pro" : "Upgrade to Pro (₦10,500)"}
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
                        <div className="text-lg font-bold text-white font-mono mt-1">₦25,500<span className="text-xs text-white/55">/mo</span></div>
                        <p className="text-[10px] text-white/50 mt-1 leading-normal">Everything in Pro Plan, plus: Parallel scripture projections, custom church branding, advanced themes, and AI Copilot & Chat features.</p>
                      </div>
{userPlan !== "yearly" && (
                         <button
                           onClick={() => handleFlutterwaveCheckout("yearly")}
                           disabled={checkoutLoading}
                           className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 disabled:opacity-50 text-slate-950 font-extrabold text-xs py-1.5 rounded-lg mt-3 transition cursor-pointer"
                         >
                           Upgrade to Premium (₦25,500)
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
                   SHOW CHRISTIAN SACRED EMBLEM
                 </span>
                 <button
                   onClick={() => {
                     onChangeShowLogo(!showLogo);
                     onCastSlide({ ...activeProjectedSlide, showLogo: !showLogo });
                   }}
                   className={`w-9 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                     showLogo ? "bg-blue-600" : "bg-white/10"
                   }`}
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
                       <div className="bg-black/40 p-1 text-[10px] rounded border border-white/10 text-white font-mono text-center flex-1">
                         KJV — Authorized King James Version
                       </div>
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
                    <span className="font-sans font-bold text-xs text-white uppercase tracking-wider">Pro Plan</span>
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="text-xl font-bold text-white font-mono mt-1">₦10,500<span className="text-xs text-white/50">/mo</span></div>
<ul className="text-[10px] text-white/55 space-y-1 mt-3">
                      <li>✓ Bible Explorer</li>
                      <li>✓ Hymns</li>
                      <li>✓ Announcements</li>
                      <li>✓ Media Projector</li>
                      <li className="text-blue-300 font-semibold">★ AI Scripture Detection & Projection</li>
                    </ul>
                </div>
<button
                    onClick={() => {
                      handleFlutterwaveCheckout("monthly");
                      setShowUpgradePromptModal(false);
                    }}
                    disabled={checkoutLoading}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs py-2 rounded-lg mt-5 transition cursor-pointer"
                  >
                    Select Pro Plan
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
                  <div className="text-xl font-bold text-white font-mono mt-1">₦25,500<span className="text-xs text-white/50">/mo</span></div>
<ul className="text-[10px] text-white/55 space-y-1 mt-3">
                     <li className="text-amber-200/90 font-semibold">★ AI Scripture Detection & Projection</li>
                     <li className="text-amber-200/90 font-semibold">★ All Free Plan features</li>
                     <li className="text-amber-200/90 font-semibold">★ Parallel scripture projections</li>
                     <li className="text-amber-200/90 font-semibold">★ Custom logo branding text</li>
                     <li>✓ Premium Aurora theme overlay</li>
                     <li>✓ AI Copilot & Chat features</li>
                   </ul>
                </div>
<button
                   onClick={() => {
                     handleFlutterwaveCheckout("yearly");
                     setShowUpgradePromptModal(false);
                   }}
                   disabled={checkoutLoading}
                   className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 disabled:opacity-50 text-slate-950 font-extrabold text-xs py-2 rounded-lg mt-5 transition cursor-pointer"
                 >
                   Select Premium
                 </button>
              </div>
            </div>
</div>
        </div>
      )}
    </div>
  );
}
