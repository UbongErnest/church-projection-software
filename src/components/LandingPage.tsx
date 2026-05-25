import React, { useState } from "react";
import { Sparkles, ArrowRight, BookOpen, Play, Laptop, FileText, ChevronRight, X } from "lucide-react";

interface LandingPageProps {
  onNavigate: (view: "landing" | "login" | "register") => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#E0E0E0] select-none font-sans relative overflow-hidden flex flex-col justify-between">
      
      {/* Visual background atmospheric elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#2563EB]/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#3B82F6]/10 rounded-full blur-[120px]" />

      {/* Header navigation bar */}
      <header className="max-w-7xl mx-auto w-full px-6 py-5 flex items-center justify-between border-b border-white/5 relative z-10">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-blue-600 to-sky-400 p-2 rounded-xl shadow-lg shadow-blue-500/10">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-sans font-bold text-base tracking-tight text-white uppercase">Chaver AI</h1>
            <span className="text-[9px] font-mono text-blue-400 uppercase tracking-widest block font-bold mt-[-2px]">
              Pulpit Studio
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("login")}
            className="text-xs font-semibold hover:text-white text-stone-400 transition cursor-pointer"
          >
            Sign In
          </button>
          <button
            onClick={() => onNavigate("register")}
            className="bg-blue-600 hover:bg-blue-500 text-white font-sans font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition shadow-md shadow-blue-900/10 flex items-center gap-1"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero section */}
      <main className="max-w-4xl mx-auto w-full px-6 py-12 md:py-20 text-center relative z-10 flex-1 flex flex-col justify-center">
        <div className="inline-flex items-center gap-1.5 bg-blue-950/20 border border-blue-500/20 px-3 py-1 rounded-full text-[10px] font-mono tracking-wider text-blue-400 uppercase font-bold mb-6 mx-auto animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Currently Enforcing Zero-Trust Security With Firebase Realtime
        </div>

        <h2 className="font-sans font-extrabold text-3xl md:text-5xl text-white tracking-tight leading-none max-w-2xl mx-auto">
          Elevate Your Preaching with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-blue-500">Intelligent Digital Projection</span>
        </h2>
        
        <p className="mt-4 text-[#8b9bb4] text-xs md:text-sm font-sans leading-relaxed max-w-lg mx-auto">
          The all-in-one church command cockpit. Auto-broadcast lyrics, detect spoken biblical scriptures with voice-simulation, and keep beautiful sermon notes synchronized securely in the cloud.
        </p>

        {/* Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            onClick={() => onNavigate("register")}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-sans font-bold text-xs px-6 py-3 rounded-xl cursor-pointer transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-1.5"
          >
            Register Account <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate("login")}
            className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-white font-sans font-medium text-xs px-6 py-3 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1"
          >
            Access Studio Console <ChevronRight className="w-4 h-4 text-stone-400" />
          </button>
        </div>

        {/* Dynamic feature columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 text-left">
          
          <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-2">
            <div className="text-blue-400 bg-blue-600/10 p-2 rounded-lg w-fit">
              <Laptop className="w-4 h-4" />
            </div>
            <h4 className="font-sans font-bold text-xs text-white uppercase tracking-wider">Dual-Monitor Projection</h4>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Open a separate static projector frame, drag it to the second screen, hit F11, and broadcast scripture passages or song lyrics dynamically.
            </p>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-2">
            <div className="text-sky-400 bg-sky-600/10 p-2 rounded-lg w-fit">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="font-sans font-bold text-xs text-white uppercase tracking-wider">Speech Simulated AI Parser</h4>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Sandbox limits won't stop you—simulate spoken sermons instantly. Preach verses like "John 3:16" and see the projector overlay scripture on speed match!
            </p>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-2">
            <div className="text-amber-400 bg-amber-600/10 p-2 rounded-lg w-fit">
              <FileText className="w-4 h-4" />
            </div>
            <h4 className="font-sans font-bold text-xs text-white uppercase tracking-wider">Private Sermon Journal</h4>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Never lose your inspirations. Write notes as the pastor preaches, tap to embed scripture, export to markdown, or delete old logs securely.
            </p>
          </div>

        </div>
      </main>

      {/* Compact footer */}
      <footer className="w-full px-6 py-6 border-t border-white/5 text-center relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-7xl mx-auto">
        <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">
          2026 chaver ai
        </p>
        <div className="flex gap-4 text-[10px] font-mono text-stone-400 uppercase tracking-widest">
          <button
            onClick={() => setShowPrivacy(true)}
            className="hover:text-blue-400 transition cursor-pointer"
          >
            Privacy Policy
          </button>
          <span>•</span>
          <button
            onClick={() => setShowTerms(true)}
            className="hover:text-blue-400 transition cursor-pointer"
          >
            Terms & Conditions
          </button>
        </div>
      </footer>

      {/* PRIVACY POLICY MODAL */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 bg-[#070b13]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#111317] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col max-h-[85vh] shadow-2xl relative">
            <button
              onClick={() => setShowPrivacy(false)}
              className="absolute top-5 right-5 p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
              <BookOpen className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="font-sans font-black text-sm uppercase text-white tracking-tight">Privacy Policy</h3>
                <span className="text-[9px] font-mono text-stone-400">LAST REVISED: MAY 25, 2026</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto text-xs text-stone-300 space-y-4 pr-1 leading-relaxed font-sans scrollbar-thin scrollbar-thumb-white/10">
              <p className="font-semibold text-white">1. INTRODUCTION & DATA ETHICS</p>
              <p>
                Welcome to Chaver AI. We respect your sanctuary's privacy and administrative confidentiality. This privacy statement documents our data handling policies for the Pulpit Studio church software ecosystem integrated with Firebase Authentication and Firestore DB instances.
              </p>

              <p className="font-semibold text-white">2. INFORMATION WE COLLECT</p>
              <p>
                During account creation, we collect critical organizational attributes to tailor and safe-keep your profile, specifically containing: email address, church name, country, state, city, specific location address, and denomination affiliation.
              </p>

              <p className="font-semibold text-white">3. SECURING SERMON NOTES & PRIVATE LITURGY DATA</p>
              <p>
                All personal notes, scriptures saved, and logs created in the Sermon Journal are stored securely under individual secure records restricted by Firestore Security rules. No ecclesiastical or scriptural texts written are transferred, shared, or scanned by unauthorized exterior third-parties.
              </p>

              <p className="font-semibold text-white">4. SPEECH TRANSCRIPTION AND SIMULATION DATA</p>
              <p>
                Dynamic Voice Recognition functions process temporary audio signals purely to translate word strings to bible citations. No live spoken audio is catalogued, recorded, or saved to cloud servers.
              </p>

              <p className="font-semibold text-white">5. COMPLIANCE & LEGAL SAFETY</p>
              <p>
                We execute our framework with full modern encryptions. You remain the complete intellectual author, supervisor, and controller of your congregation’s stored assets.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex justify-end">
              <button
                onClick={() => setShowPrivacy(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-sans font-bold text-xs px-5 py-2.5 rounded-lg cursor-pointer transition"
              >
                Close Privacy Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TERMS & CONDITIONS MODAL */}
      {showTerms && (
        <div className="fixed inset-0 z-50 bg-[#070b13]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#111317] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col max-h-[85vh] shadow-2xl relative">
            <button
              onClick={() => setShowTerms(false)}
              className="absolute top-5 right-5 p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
              <BookOpen className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="font-sans font-black text-sm uppercase text-white tracking-tight">Terms & Conditions</h3>
                <span className="text-[9px] font-mono text-stone-400">LAST REVISED: MAY 25, 2026</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto text-xs text-stone-300 space-y-4 pr-1 leading-relaxed font-sans scrollbar-thin scrollbar-thumb-white/10">
              <p className="font-semibold text-white">1. LICENSURE & USER CONDUCT</p>
              <p>
                By accessing Chaver AI Pulpit Studio ("The Service"), you agree to utilize this system solely for ecclesiastical operations, sermon assistance, media design, or interactive study purposes.
              </p>

              <p className="font-semibold text-white">2. REGISTERED MEMBER RESPONSIBILITIES</p>
              <p>
                You are responsible for the confidentiality of your credentials. You agree to provide authentic coordinates (denomination, church name, and location) to prevent unauthorized duplicate profiles.
              </p>

              <p className="font-semibold text-white">3. PROJECTION CONTENT COPYRIGHTS</p>
              <p>
                Church operators must ensure the lyrics, visual slide files, and scriptural translations projected to the congregation comply with relevant copyright systems or fair-use exceptions in their jurisdictions.
              </p>

              <p className="font-semibold text-white">4. LIMITATION OF LIABILITY & STABILITY</p>
              <p>
                Chaver AI is delivered on an "as-is" and "as available" basis. While we provide robust Firebase synchronization, we are not liable for accidental hardware internet dropouts occurring mid-sermon.
              </p>

              <p className="font-semibold text-white">5. INTELLECTUAL CODES</p>
              <p>
                Chaver AI retains all software source and design trademark copyrights. Users retain complete ownership of all sermons compiled, downloaded, or synchronized within their personal notes section.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex justify-end">
              <button
                onClick={() => setShowTerms(false)}
                className="bg-sky-600 hover:bg-sky-500 text-white font-sans font-bold text-xs px-5 py-2.5 rounded-lg cursor-pointer transition"
              >
                Accept & Close Terms
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
