import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ActiveSlide, BackgroundThemeId } from "../types";
import { THEME_PRESETS } from "../data";
import { Sparkles, Clock } from "lucide-react";

interface ProjectorScreenProps {
  syncedSlide?: ActiveSlide;
  subscriptionPlan?: string;
}

export default function ProjectorScreen({ syncedSlide, subscriptionPlan = "free" }: ProjectorScreenProps) {
  const [slide, setSlide] = useState<ActiveSlide>({
    type: "announcement",
    title: "Service Starting Soon",
    body: "Welcome to our live worship service! Praise and worship starts in a few moments.",
    layout: "fullscreen",
    themeId: "nebula-dark",
    fontSize: 48,
    showLogo: true,
  });

  const [timeLeft, setTimeLeft] = useState<string>("");

  // Listen for local system events and window updates
  useEffect(() => {
    if (syncedSlide) {
      setSlide(syncedSlide);
    }
  }, [syncedSlide]);

  // Handle countdown timers
  useEffect(() => {
    if (slide.type !== "timer") return;

    const interval = setInterval(() => {
      const now = Date.now();
      const endTime = slide.timerEndTime || (now + (slide.timerDuration || 300) * 1000);
      const remainingMs = endTime - now;

      if (remainingMs <= 0) {
        setTimeLeft("00:00");
        clearInterval(interval);
      } else {
        const totalSecs = Math.floor(remainingMs / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        setTimeLeft(
          `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
        );
      }
    }, 250);

    return () => clearInterval(interval);
  }, [slide.type, slide.timerEndTime, slide.timerDuration]);

  const activeTheme = THEME_PRESETS.find((t) => t.id === slide.themeId) || THEME_PRESETS[0];
  const isLightTheme = slide.themeId === "clean-light" || slide.themeId === "pure-white";

  // If black-screen mode is triggered
  if (slide.type === "black") {
    return (
      <div id="full-viewport-blackout" className="w-full h-screen bg-black flex items-center justify-center transition-all duration-500" />
    );
  }

  return (
    <div
      id="projector-immersive-viewport"
      className={`relative w-full h-screen flex flex-col justify-between p-12 overflow-hidden transition-all duration-700 select-none ${
        slide.layout === "lower-third" ? "bg-stone-950/85" : activeTheme.bgClass
      } ${slide.themeId === "sanctuary-aurora" ? "animate-aurora-bg" : ""}`}
    >
      <style>{`
        @keyframes aurora-bg {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-aurora-bg {
          background-size: 200% 200%;
          animation: aurora-bg 18s ease infinite;
        }
        @keyframes drift-blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(40px, -60px) scale(1.1); }
          66% { transform: translate(-30px, 30px) scale(0.95); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-drift-1 {
          animation: drift-blob 22s infinite alternate ease-in-out;
        }
        .animate-drift-2 {
          animation: drift-blob 26s infinite alternate-reverse ease-in-out;
        }
      `}</style>

      {/* Floating Aurora Blobs */}
      {slide.themeId === "sanctuary-aurora" && slide.layout !== "lower-third" && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[10%] left-[20%] w-[40vw] h-[40vw] bg-teal-500/10 rounded-full blur-[100px] animate-drift-1" />
          <div className="absolute bottom-[15%] right-[20%] w-[35vw] h-[35vw] bg-emerald-500/10 rounded-full blur-[110px] animate-drift-2" />
        </div>
      )}

      {/* Background Ambience Aura */}
      {slide.layout !== "lower-third" && (
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.06),transparent_60%)]" />
      )}

      {/* Slide Upper Header: Category Title */}
      {slide.layout !== "lower-third" && (
        <div className={`z-10 flex justify-between items-center opacity-70 border-b ${isLightTheme ? "border-black/10 text-stone-600" : "border-white/5 text-white/70"} pb-4`}>
          <div className="flex items-center space-x-2 text-xs uppercase tracking-[0.25em] font-mono">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>{slide.type === "verse" ? "Holy Scripture" : slide.type === "lyrics" ? "Worship Lyric" : slide.type === "media" ? "Media Projection" : "Church Announcement"}</span>
          </div>
          {slide.showLogo && (
            <div className={`text-xs font-semibold tracking-widest uppercase font-display border px-2.5 py-0.5 rounded ${isLightTheme ? "border-stone-400 text-stone-800" : "border-white/20 text-white/80"}`}>
              {slide.customBrandingText ? slide.customBrandingText : "† SANCTUARY"}
            </div>
          )}
        </div>
      )}

      {/* Main Slide Presentation Core */}
      <div className="z-10 flex-1 flex flex-col justify-center items-center text-center my-6">
        <AnimatePresence mode="wait">
          {slide.type === "verse" && (
            <motion.div
              key={`verse-${slide.book}-${slide.chapter}-${slide.verse}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="max-w-5xl w-full flex flex-col justify-center"
            >
              {slide.parallelBody && slide.parallelTranslation ? (
                // Parallel translation side-by-side layout
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-left items-center justify-center w-full my-auto animate-fade-in relative z-10 px-6">
                  <div className={`border-r pr-8 ${isLightTheme ? "border-black/10 text-stone-900" : "border-white/10 text-white"}`}>
                    <blockquote 
                      style={{ fontSize: `${(slide.fontSize || 48) * 0.7}px` }}
                      className="font-sans italic leading-relaxed font-medium tracking-wide mb-6"
                    >
                      “{slide.body}”
                    </blockquote>
                    <h4 className="font-display font-semibold tracking-wider text-amber-500 text-lg uppercase">
                      {slide.book} {slide.chapter}:{slide.verse} ({slide.translation || "KJV"})
                    </h4>
                  </div>
                  <div className={`${isLightTheme ? "text-stone-850" : "text-white/95"}`}>
                    <blockquote 
                      style={{ fontSize: `${(slide.fontSize || 48) * 0.7}px` }}
                      className="font-sans italic leading-relaxed font-medium tracking-wide mb-6"
                    >
                      “{slide.parallelBody}”
                    </blockquote>
                    <h4 className="font-display font-semibold tracking-wider text-amber-500 text-lg uppercase">
                      {slide.book} {slide.chapter}:{slide.verse} ({slide.parallelTranslation})
                    </h4>
                  </div>
                </div>
              ) : slide.layout === "lower-third" ? (
                // Lower Third layout for OBS overlay - stays dark and immersive for transparent capture
                <div className="fixed bottom-12 left-12 right-12 text-left bg-slate-950/90 backdrop-blur-md rounded-xl p-8 border border-white/10 shadow-2xl">
                  <p
                    className="font-sans font-light leading-relaxed mb-3 text-white"
                    style={{ fontSize: `${(slide.fontSize || 48) * 0.7}px` }}
                  >
                    "{slide.body}"
                  </p>
                  <p className="font-display font-medium text-sky-400 text-lg uppercase tracking-wide">
                    — {slide.book} {slide.chapter}:{slide.verse} <span className="text-white/40 text-sm font-mono ml-2 font-normal">{slide.translation || "KJV"}</span>
                  </p>
                </div>
              ) : slide.layout === "split-screen" ? (
                // Split presentation layout
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 text-left items-center">
                  <div className={`md:col-span-4 border-r pr-6 ${isLightTheme ? "border-black/10" : "border-white/10"}`}>
                    <h2 className={`font-display font-bold text-4xl lg:text-5xl uppercase tracking-tight leading-tight ${isLightTheme ? "text-amber-900" : "text-amber-100"}`}>
                      {slide.book}
                    </h2>
                    <p className={`font-mono text-xl mt-2 ${isLightTheme ? "text-blue-800" : "text-sky-450"}`}>
                      Chapter {slide.chapter} : Verse {slide.verse}
                    </p>
<div className={`mt-4 inline-block font-mono text-xs px-2.5 py-1 rounded ${isLightTheme ? "bg-stone-200 text-stone-800" : "bg-white/10 text-white"}`}>
                       {slide.translation || "KJV"}
                     </div>
                  </div>
                  <div className="md:col-span-8">
                    <blockquote
                      className={`font-sans font-light leading-relaxed text-3xl font-medium tracking-wide ${isLightTheme ? "text-black" : "text-white"}`}
                      style={{ fontSize: `${(slide.fontSize || 48) * 0.9}px` }}
                    >
                      "{slide.body}"
                    </blockquote>
                  </div>
                </div>
              ) : (
                // Standard Fullscreen layout
                <div className="flex flex-col items-center">
                  <blockquote
                    className={`font-sans font-normal leading-normal max-w-4xl opacity-95 text-center !leading-normal italic ${isLightTheme ? "text-black" : "text-white"}`}
                    style={{ fontSize: `${slide.fontSize || 48}px` }}
                  >
                    “{slide.body}”
                  </blockquote>
                  <h3 className={`font-display font-medium mt-8 tracking-wider text-xl lg:text-2xl uppercase border-t pt-4 px-6 ${isLightTheme ? "text-amber-800 border-black/10" : "text-amber-400 border-white/10"}`}>
                    {slide.book} {slide.chapter}:{slide.verse}
                    <span className={`text-sm font-mono ml-3 uppercase font-normal ${isLightTheme ? "text-stone-500" : "text-white/40"}`}>{slide.translation || "KJV"}</span>
                  </h3>
                </div>
              )}
            </motion.div>
          )}

          {slide.type === "lyrics" && (
            <motion.div
              key={`lyrics-${slide.title}-${slide.body}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.5 }}
              className="max-w-4xl flex flex-col items-center"
            >
              <p
                className={`font-sans font-medium text-center leading-relaxed whitespace-pre-line tracking-wide font-display ${isLightTheme ? "text-black" : "text-white drop-shadow"}`}
                style={{ fontSize: `${slide.fontSize || 48}px` }}
              >
                {slide.body}
              </p>
              <p className={`font-mono text-xs uppercase tracking-widest mt-12 ${isLightTheme ? "text-stone-500" : "text-white/40"}`}>
                🎵 Song: {slide.title}
              </p>
            </motion.div>
          )}

{slide.type === "announcement" && (
            <motion.div
              key={`announcement-${slide.title}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.5 }}
              className="max-w-4xl flex flex-col items-center"
            >
              <h2 className={`font-display font-bold text-4xl lg:text-5xl uppercase tracking-wider mb-8 text-center border-b pb-4 w-full ${isLightTheme ? "text-amber-950 border-black/10" : "text-amber-100 border-white/10"}`}>
                {slide.title}
              </h2>
              <p
                className={`font-sans font-light text-center leading-relaxed opacity-90 max-w-3xl ${isLightTheme ? "text-stone-900" : "text-white"}`}
                style={{ fontSize: `${(slide.fontSize || 48) * 0.8}px` }}
              >
                {slide.body}
              </p>
            </motion.div>
          )}

          {slide.type === "timer" && (
            <motion.div
              key={`timer-${slide.title}-${timeLeft}`}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className={`flex flex-col items-center justify-center p-8 rounded-full border bg-slate-950/20 backdrop-blur-sm shadow-inner ${isLightTheme ? "border-black/10" : "border-white/10"}`}
            >
              <h3 className="text-amber-500 font-display text-lg tracking-widest uppercase mb-4 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-500 animate-spin" />
                <span>{slide.title || "Countdown Timer"}</span>
              </h3>
              <p className={`font-display font-bold text-7xl md:text-8xl tracking-widest font-mono ${isLightTheme ? "text-black" : "text-white"}`}>
                {timeLeft || "00:00"}
              </p>
            </motion.div>
          )}

{slide.type === "media" && (
             <motion.div
               key={`media-${slide.mediaUrl}-${slide.mediaType}`}
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               transition={{ duration: 0.5 }}
               className="w-full h-full flex items-center justify-center"
             >
               {slide.mediaUrl ? (
                 slide.mediaType === "image" ? (
                   <img
                     src={slide.mediaUrl}
                     alt={slide.title}
                     className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                   />
                 ) : (
                   <video
                     src={slide.mediaUrl}
                     autoPlay
                     muted
                     loop
                     playsInline
                     className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                   />
                 )
               ) : (
                 <div className="text-center">
                   <span className="text-white/40 text-xl font-mono">{slide.title || "No Media Loaded"}</span>
                 </div>
               )}
             </motion.div>
           )}
        </AnimatePresence>
      </div>

      {/* Footer Meta Details */}
      {slide.layout !== "lower-third" && (
        <div className={`z-10 flex justify-between items-center text-[10px] font-mono opacity-50 border-t pt-4 ${isLightTheme ? "border-black/10 text-stone-600" : "border-white/5 text-white/50"}`}>
          <span>Active Projection Live Feed</span>
          <span>LAYOUT: {(slide.layout || "fullscreen").toUpperCase()} • THEME: {(slide.themeId || "nebula-dark").toUpperCase()}</span>
        </div>
      )}

      {/* Forced Free Watermark */}
      {subscriptionPlan === "free" && (
        <div className={`absolute bottom-3 right-5 z-20 text-[9px] font-mono tracking-widest uppercase px-2.5 py-0.5 rounded bg-black/50 border border-white/10 ${isLightTheme ? "text-stone-750 border-stone-300 bg-stone-100/90" : "text-white/45"}`}>
          ⚡ Powered by Chaver AI
        </div>
      )}
    </div>
  );
}
