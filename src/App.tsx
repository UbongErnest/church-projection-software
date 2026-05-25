import { useState, useEffect, useRef } from "react";
import { ActiveSlide, DetectedVerse } from "./types";
import ControlPanel from "./components/ControlPanel";
import ProjectorScreen from "./components/ProjectorScreen";
import SermonNotepad from "./components/SermonNotepad";
import LandingPage from "./components/LandingPage";
import RegisterPage from "./components/RegisterPage";
import LoginPage from "./components/LoginPage";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { THEME_PRESETS } from "./data";
import { Sparkles, Mic, HelpCircle, CornerDownRight, Volume2, Notebook, LogOut } from "lucide-react";
import { BIBLE_BOOKS, normalizeBookName, parseSpokenNumbers } from "./bibleDatabase";

// High-speed, high-density client-side regex matching to intercept spoken scriptures locally
function scanForVerseLocally(text: string) {
  if (!text) return null;
  const processed = parseSpokenNumbers(text.toLowerCase());

  for (const book of BIBLE_BOOKS) {
    // Collect book name and all aliases, sorted longest-first to bypass greedy substring overlaps
    const namesOrAliases = [book.name, ...book.aliases];
    namesOrAliases.sort((a, b) => b.length - a.length);

    const escapedNames = namesOrAliases.map(n => n.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');

    // Robust matching for common ways scriptures are recited:
    // - "Romans 8:28"
    // - "Romans chapter 8 verse 28"
    // - "Romans 8 verse 28"
    // - "Romans 8 28"
    // - "Romans 8, 28"
    const regex = new RegExp(
      `\\b(${escapedNames})\\s+(?:chapter\\s+)?(\\d+)\\s*(?::|verse|\\s+|,)\\s*(?:verse\\s+)?(\\d+)\\b`,
      'i'
    );

    const match = processed.match(regex);
    if (match) {
      return {
        book: book.name,
        chapter: parseInt(match[2], 10),
        verse: parseInt(match[3], 10),
        displayName: `${book.name} ${match[2]}:${match[3]}`,
      };
    }
  }
  return null;
}

// Fallback preach simulator sequences for seamless sandbox testing
const PulPULP_SIMULATORS = [
  { label: "Matthew 6:9 (Pulpit Preach)", phrase: "Our Father in heaven, hallowed be Your name, let's open Matthew chapter 6 verse 9" },
  { label: "Romans 8:28 (Assurance)", phrase: "We stand on the promises of God, and we know that in all things God works for the good of those who love Him, just as described in Romans chapter 8 verse 28..." },
  { label: "Psalm 23:1 (Comfort)", phrase: "As the Psalmist declared when he was going through dry seasons, turn with me to Psalm 23 verse 1, the Lord is my shepherd..." },
  { label: "Genesis 1:1 (Beginning)", phrase: "Let us read from the very first book of Moses, let's look at Genesis chapter 1 verse 1. In the beginning..." },
  { label: "1 Corinthians 13:4 (Love)", phrase: "My friends, love is patient, love is kind. It does not boast, it is not proud. First Corinthians chapter 13 verse 4 is where we get our core mandate today..." }
];

export default function App() {
  const [viewMode, setViewMode] = useState<"operator" | "projector" | "loading">("loading");

  // Firebase Authenticated Session State Tracking
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [authView, setAuthView] = useState<"landing" | "login" | "register">("landing");

  // Auth monitoring listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  // Main system active slide
  const [activeSlide, setActiveSlide] = useState<ActiveSlide>({
    type: "announcement",
    title: "Sunday Divine Service",
    body: "Welcome to Church. Continuous live speech recognition and automatic scripture projection is active.",
    layout: "fullscreen",
    themeId: "nebula-dark",
    fontSize: 48,
    showLogo: true,
  });

  // Transcription & AI outputs state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [detectedVerses, setDetectedVerses] = useState<DetectedVerse[]>([]);
  const [sermonTopic, setSermonTopic] = useState<string>("Holy Worship Study");
  const [sermonNotes, setSermonNotes] = useState<string[]>([
    "Sermon commenced. Automatic topic detector engaged.",
    "Speak through mic or trigger preacher simulator on the right to test verse extraction!"
  ]);

  // Audio simulation control panel toggles
  const [showSimulators, setShowSimulators] = useState<boolean>(true);
  const [rightPanelTab, setRightPanelTab] = useState<"notes" | "simulator">("notes");

  // HTML5 BroadcastChannel and React references
  const channelRef = useRef<BroadcastChannel | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptionBufferRef = useRef<string>("");

  const activeSlideRef = useRef<ActiveSlide>(activeSlide);
  const detectedVersesRef = useRef<DetectedVerse[]>(detectedVerses);

  // Keep track of registered projector screen callbacks
  const registeredProjectorsRef = useRef<Array<(slide: ActiveSlide) => void>>([]);

  useEffect(() => {
    activeSlideRef.current = activeSlide;
  }, [activeSlide]);

  useEffect(() => {
    detectedVersesRef.current = detectedVerses;
  }, [detectedVerses]);

  // Segment route selection based on URL hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === "#projector") {
        setViewMode("projector");
      } else {
        setViewMode("operator");
      }
    };

    handleHashChange(); // Run once on load
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Safe localStorage helper to avoid SecurityError crashes in sandboxes/iframes
  const getSafeLocalStorage = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.warn("Storage access blocked - operating in sandbox fallback mode:", err);
      return null;
    }
  };

  const setSafeLocalStorage = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn("Storage update blocked - operating in memory sync only:", err);
    }
  };

  // Broadcast channel & LocalStorage syncer
  useEffect(() => {
    // Instantiate BroadcastChannel for same-origin browser tab/iframe sync
    const channel = new BroadcastChannel("church_projection_sync");
    channelRef.current = channel;

    // Listen to incoming messages in both projector and operator modes
    channel.onmessage = (event) => {
      if (event.data) {
        if (event.data.type === "SYNC_SLIDE") {
          setActiveSlide(event.data.slide);
        } else if (event.data.type === "REQUEST_CURRENT_SLIDE") {
          // If this is the operator holding the active state, reply back to sync the new tab
          const isOperator = window.location.hash !== "#projector";
          if (isOperator && activeSlideRef.current) {
            channel.postMessage({ type: "SYNC_SLIDE", slide: activeSlideRef.current });
          }
        }
      }
    };

    // Load initial slide from storage if it exists
    const stored = getSafeLocalStorage("church_projector_active_slide");
    if (stored) {
      try {
        setActiveSlide(JSON.parse(stored));
      } catch (err) {
        console.error("Initial slide parse error", err);
      }
    }

    // Fallback store listener (for sandboxes supporting localStorage cross-events)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "church_projector_active_slide" && e.newValue) {
        try {
          setActiveSlide(JSON.parse(e.newValue));
        } catch (err) {
          console.error("Storage slide reload error", err);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // If we just loaded the projector window/tab, request the active slide from the active operator instantly!
    const isProjector = window.location.hash === "#projector";
    if (isProjector) {
      setTimeout(() => {
        channel.postMessage({ type: "REQUEST_CURRENT_SLIDE" });
      }, 300);
    }

    return () => {
      channel.close();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Direct parent-child window synchronization register
  useEffect(() => {
    (window as any).__registerProjectorScreen = (callback: (s: ActiveSlide) => void) => {
      if (!registeredProjectorsRef.current.includes(callback)) {
        registeredProjectorsRef.current.push(callback);
      }
      if (activeSlideRef.current) {
        callback(activeSlideRef.current);
      }
    };
    return () => {
      delete (window as any).__registerProjectorScreen;
    };
  }, []);

  // Try to register child projector window with parent operator window if available
  useEffect(() => {
    const isProjector = window.location.hash === "#projector";
    if (isProjector && window.opener) {
      try {
        if (typeof window.opener.__registerProjectorScreen === "function") {
          window.opener.__registerProjectorScreen((newSlide: ActiveSlide) => {
            setActiveSlide(newSlide);
          });
          console.log("Direct operator window link established successfully!");
        }
      } catch (err) {
        console.warn("Direct parent opener connection blocked or unavailable, falling back to Broadcast/Storage channels.", err);
      }
    }
  }, []);

  // High-frequency storage poller fallback to ensure sync works flawlessly even in fully restricted frame sandboxes
  useEffect(() => {
    const isProjector = window.location.hash === "#projector";
    if (!isProjector) return;

    let lastSeenJson = "";
    const interval = setInterval(() => {
      const stored = getSafeLocalStorage("church_projector_active_slide");
      if (stored && stored !== lastSeenJson) {
        try {
          const parsed = JSON.parse(stored);
          setActiveSlide(parsed);
          lastSeenJson = stored;
        } catch (e) {}
      }
    }, 450);

    return () => clearInterval(interval);
  }, []);

  // Cast slide wrapper
  const castSlide = (slide: ActiveSlide) => {
    setActiveSlide(slide);

    // Direct callback dispatch to connected child windows
    registeredProjectorsRef.current.forEach((cb) => {
      try {
        cb(slide);
      } catch (err) {
        // Clean up dead listeners
        registeredProjectorsRef.current = registeredProjectorsRef.current.filter((x) => x !== cb);
      }
    });

    // Push across broadcast channel
    if (channelRef.current) {
      channelRef.current.postMessage({ type: "SYNC_SLIDE", slide });
    }
    // Fail-safe persistent LocalStorage fallback
    setSafeLocalStorage("church_projector_active_slide", JSON.stringify(slide));
  };

  // Web Speech Audio Transcription Engine
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: any) => {
      let interim = "";
      let finalStr = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (finalStr) {
        transcriptionBufferRef.current += " " + finalStr;
        const completeTranscript = transcriptionBufferRef.current.trim();
        setTranscript(completeTranscript);
        
        // Trigger backend Gemini AI Verse Detection pipeline for complete phrases!
        triggerAiDetection(completeTranscript);
      } else {
        // Render immediate live words for premium micro-latency feedback
        setTranscript((transcriptionBufferRef.current + " " + interim).trim());
      }
    };

    rec.onend = () => {
      if (isListening) {
        // Auto restart if context is still active
        try {
          rec.start();
        } catch (e) {
          console.error("Speech re-launch exception:", e);
        }
      }
    };

    recognitionRef.current = rec;
  }, [isListening]);

  // Launch AI speech detection endpoint with dual hybrid execution pipelines (micro-latency local regex + fallback deep Gemini NLP)
  const triggerAiDetection = async (transcriptText: string) => {
    if (!transcriptText || transcriptText.trim().length < 8) return;

    // 1. DUAL PIPELINE: HIGH-SPEED MICRO-LATENCY CLIENT REGEX INTERCEPTOR
    const localMatch = scanForVerseLocally(transcriptText);
    if (localMatch) {
      const verseId = `${localMatch.book}-${localMatch.chapter}-${localMatch.verse}-local-${Date.now()}`;
      const isConsecutiveDuplicate = detectedVersesRef.current.length > 0 &&
        detectedVersesRef.current[0].book === localMatch.book &&
        detectedVersesRef.current[0].chapter === localMatch.chapter &&
        detectedVersesRef.current[0].verse === localMatch.verse;

      if (!isConsecutiveDuplicate) {
        const newDetected: DetectedVerse = {
          id: verseId,
          book: localMatch.book,
          chapter: localMatch.chapter,
          verse: localMatch.verse,
          displayName: localMatch.displayName,
          confidence: 100, // Client-side hard regex match is 100% confidence
          transcriptSegment: transcriptText.slice(-180),
          status: "pending",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        };

        setDetectedVerses((prev) => [newDetected, ...prev]);

        // Auto-Project instantly in real-time!
        try {
          const lookup = await fetch(`/api/bible/lookup?book=${localMatch.book}&chapter=${localMatch.chapter}&verse=${localMatch.verse}`);
          const details = await lookup.json();
          if (details && details.text) {
            castSlide({
              type: "verse",
              title: newDetected.displayName,
              body: details.text.NIV, // defaults to NIV
              book: localMatch.book,
              chapter: localMatch.chapter,
              verse: localMatch.verse,
              translation: "NIV",
              layout: activeSlideRef.current.layout || "fullscreen",
              themeId: activeSlideRef.current.themeId,
              fontSize: activeSlideRef.current.fontSize,
              showLogo: activeSlideRef.current.showLogo,
            });

            // Instant reset of active speech buffers to capture next spoken scriptures without overlap!
            transcriptionBufferRef.current = "";
            setTranscript("");
          }
        } catch (e) {
          console.error("Local micro-latency match lookup error:", e);
        }
        return; // Halt further pipeline actions on successful local capture
      }
    }

    // 2. BACKGROUND CONTEXT ANALYZER (Gemini NLP Topics, Bulletpoints, and complex scripture extraction)
    try {
      const res = await fetch("/api/ai/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText }),
      });
      const data = await res.json();

      if (data) {
        // Assess sermon topics and autogenerated point summaries
        if (data.sermonTopic && data.sermonTopic !== "Acoustics Session") {
          setSermonTopic(data.sermonTopic);
        }
        if (data.summaryNotes && data.summaryNotes.length > 0) {
          setSermonNotes(data.summaryNotes);
        }

        // Assess bible verse reference matching
        if (data.detected && data.reference && data.reference.book) {
          const matched = data.reference;
          const verseId = `${matched.book}-${matched.chapter}-${matched.verse}-${Date.now()}`;

          // Avoid duplicating identical scripture triggers consecutively
          const isConsecutiveDuplicate = detectedVersesRef.current.length > 0 &&
            detectedVersesRef.current[0].book === matched.book &&
            detectedVersesRef.current[0].chapter === matched.chapter &&
            detectedVersesRef.current[0].verse === matched.verse;

          if (!isConsecutiveDuplicate) {
            const newDetected: DetectedVerse = {
              id: verseId,
              book: matched.book,
              chapter: matched.chapter,
              verse: matched.verse,
              displayName: matched.displayName || `${matched.book} ${matched.chapter}:${matched.verse}`,
              confidence: matched.confidence || 85,
              transcriptSegment: transcriptText.slice(-180), // take last sentence segment
              status: "pending",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            };

            setDetectedVerses((prev) => [newDetected, ...prev]);
          }

          // Check if this verse is already actively projected to prevent redundant updates or flickering
          const isAlreadyProjected = activeSlideRef.current.type === "verse" &&
            activeSlideRef.current.book === matched.book &&
            activeSlideRef.current.chapter === matched.chapter &&
            activeSlideRef.current.verse === matched.verse;

          if (!isAlreadyProjected) {
            // Lazy load scripture text and project instantly!
            const lookup = await fetch(`/api/bible/lookup?book=${matched.book}&chapter=${matched.chapter}&verse=${matched.verse}`);
            const details = await lookup.json();
            if (details && details.text) {
              castSlide({
                type: "verse",
                title: matched.displayName || `${matched.book} ${matched.chapter}:${matched.verse}`,
                body: details.text.NIV, // defaults to NIV
                book: matched.book,
                chapter: matched.chapter,
                verse: matched.verse,
                translation: "NIV",
                layout: activeSlideRef.current.layout || "fullscreen",
                themeId: activeSlideRef.current.themeId,
                fontSize: activeSlideRef.current.fontSize,
                showLogo: activeSlideRef.current.showLogo,
              });

              // Instant reset of active speech buffers to capture next spoken scriptures without overlap!
              transcriptionBufferRef.current = "";
              setTranscript("");
            }
          }
        }
      }
    } catch (err) {
      console.error("AI Detection route error:", err);
    }
  };

  const toggleListening = () => {
    const nextState = !isListening;
    setIsListening(nextState);

    if (recognitionRef.current) {
      if (nextState) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Mic start trigger issue:", e);
        }
      } else {
        recognitionRef.current.stop();
      }
    } else if (nextState) {
      alert("Local Web Speech system is blockaded or unsupported in this device browser. Please use the Preacher Voice Simulator on the right to test voice-to-verse operations!");
    }
  };

  // Preaching simulation injection trigger
  const triggerPreachSimulator = (phrase: string) => {
    // Append phrase to simulated input
    transcriptionBufferRef.current += " " + phrase;
    const finalPhrase = transcriptionBufferRef.current.trim();
    setTranscript(finalPhrase);
    
    // Process text instantly with AI verse extraction endpoint
    triggerAiDetection(finalPhrase);
  };

  const handleClearNotes = () => {
    setSermonNotes([]);
    setSermonTopic("Worship Session");
    setTranscript("");
    transcriptionBufferRef.current = "";
    setDetectedVerses([]);
  };

  if (!authChecked) {
    return (
      <div className="w-full h-screen bg-[#070b13] text-sky-400 flex flex-col justify-center items-center font-mono">
        <Sparkles className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <span className="tracking-widest text-[11px] uppercase">VERIFYING SANCTUARY CREDENTIALS...</span>
      </div>
    );
  }

  // Unauthenticated visitors must register/login to access the pulpit studio
  if (!currentUser) {
    if (authView === "login") {
      return <LoginPage onNavigate={setAuthView} onAuthSuccess={() => {}} />;
    }
    if (authView === "register") {
      return <RegisterPage onNavigate={setAuthView} onAuthSuccess={() => {}} />;
    }
    return <LandingPage onNavigate={setAuthView} />;
  }

  if (viewMode === "loading") {
    return (
      <div className="w-full h-screen bg-[#070b13] text-sky-400 flex flex-col justify-center items-center font-mono">
        <Sparkles className="w-10 h-10 text-sky-400 animate-spin mb-4" />
        <span className="tracking-widest text-[10px] uppercase">SANCTUARY PROX SYSTEM CORE BOOTING...</span>
      </div>
    );
  }

  // Dual View splitter
  if (viewMode === "projector") {
    return <ProjectorScreen syncedSlide={activeSlide} />;
  }

  return (
    <div className="relative w-full min-h-screen bg-[#0C0D0F] text-[#E0E0E0] font-sans flex flex-col xl:flex-row">
      
      {/* Primary Workspace Control panel layout */}
      <div className="flex-1 flex flex-col">
        <ControlPanel
          onCastSlide={castSlide}
          activeProjectedSlide={activeSlide}
          detectedVerses={detectedVerses}
          onTriggerDetect={triggerAiDetection}
          isListening={isListening}
          onToggleListening={toggleListening}
          transcript={transcript}
          sermonTopic={sermonTopic}
          sermonNotes={sermonNotes}
          onClearNotes={handleClearNotes}
        />
      </div>

      {/* DETACHED SIMULATOR & NOTE JOURNAL AUXILIARY BAR */}
      <div className="w-full xl:w-96 bg-[#121417]/95 border-t xl:border-t-0 xl:border-l border-white/10 p-5 flex flex-col gap-4 text-[#E0E0E0] shadow-2xl relative z-10 font-sans">
        
        {/* Toggle tabs at the top of auxiliary pane */}
        <div className="grid grid-cols-2 bg-black/40 p-1.5 rounded-xl border border-white/5">
          <button
            onClick={() => setRightPanelTab("notes")}
            className={`py-2 text-center text-[10px] uppercase tracking-wider font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 duration-150 ${
              rightPanelTab === "notes"
                ? "bg-blue-600/25 text-blue-400 border border-blue-500/20 font-extrabold shadow-sm"
                : "text-white/40 hover:text-white/80"
            }`}
          >
            <Notebook className="w-3.5 h-3.5" /> Notes Journal
          </button>
          <button
            onClick={() => setRightPanelTab("simulator")}
            className={`py-2 text-center text-[10px] uppercase tracking-wider font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 duration-150 ${
              rightPanelTab === "simulator"
                ? "bg-blue-600/25 text-blue-400 border border-blue-500/20 font-extrabold shadow-sm"
                : "text-white/40 hover:text-white/80"
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" /> Speech Simulator
          </button>
        </div>

        {/* Tab 1: Sermon notes entry */}
        {rightPanelTab === "notes" && (
          <SermonNotepad
            sermonTopic={sermonTopic}
            activeProjectedSlide={activeSlide}
            transcript={transcript}
          />
        )}

        {/* Tab 2: Speech Simulator companion */}
        {rightPanelTab === "simulator" && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-mono tracking-wider font-bold text-blue-400 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-blue-400" /> Speech Simulator Panel
              </h3>
              <button
                onClick={() => setShowSimulators(!showSimulators)}
                className="text-[10px] font-mono text-white/40 hover:text-white/80 transition-colors uppercase tracking-wider"
              >
                {showSimulators ? "Collapse" : "Expand"}
              </button>
            </div>

            {showSimulators && (
              <div className="flex flex-col gap-3">
                <div className="bg-white/5 border border-white/8 rounded-lg p-3 text-[11px] leading-relaxed text-white/70">
                  <span className="font-bold text-blue-400 block mb-1">💡 Sandbox Testing Note</span>
                  Since browser permissions inside sandboxed frames sometimes block physical micro-phonics hardware access, use these high-fidelity sermon phrase templates below! They trigger the exact same AI detection pipeline instantly!
                </div>

                <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest block mb-1 font-semibold">
                  Click to Preach Phrase
                </span>
                <div className="space-y-2">
                  {PulPULP_SIMULATORS.map((sim, index) => (
                    <button
                      key={index}
                      onClick={() => triggerPreachSimulator(sim.phrase)}
                      className="w-full text-left p-2.5 bg-[#191B1F]/60 hover:bg-blue-600/15 duration-150 border border-white/5 hover:border-blue-500/40 rounded-lg text-xs tracking-tight text-white/80 flex flex-col gap-1 cursor-pointer select-none"
                    >
                      <span className="font-bold text-blue-400 text-[10px] flex items-center gap-1 uppercase tracking-wider">
                        <CornerDownRight className="w-3 h-3 text-blue-400" /> {sim.label}
                      </span>
                      <span className="line-clamp-2 italic text-white/60">"{sim.phrase}"</span>
                    </button>
                  ))}
                </div>

                <div className="mt-2 border-t border-white/10 pt-3">
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest block mb-2 font-semibold">
                    Independent Display Screen Help
                  </span>
                  <p className="text-[11px] text-white/60 leading-normal">
                    To run a dual monitor production:
                  </p>
                  <ol className="list-decimal list-inside text-[11px] text-white/50 space-y-1 mt-1 mb-3">
                    <li>Click <span className="text-blue-400 font-semibold">"Projector Screen"</span> in top command bar.</li>
                    <li>Drag the new window to your projector or secondary screen.</li>
                    <li>Go Fullscreen (F11)!</li>
                  </ol>
                  <div className="bg-black/40 p-3 rounded-lg border border-white/5 text-[10px] leading-normal font-mono text-white/30 text-center">
                    Dual Broadcast channel actively synchronized.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
