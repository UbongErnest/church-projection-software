import React, { useState, FormEvent, useRef } from "react";
import { supabase } from "../supabase";
import { BookOpen, Mail, Lock, LogIn, ChevronLeft, Eye, EyeOff, UserPlus } from "lucide-react";

interface LoginPageProps {
  onNavigate: (view: "landing" | "login" | "register" | "reset-password" | "otp-verification" | "otp-reset-password") => void;
}

export default function LoginPage({ onNavigate }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const isSubmittingRef = useRef(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText("");

    // Prevent double submission
    if (isSubmittingRef.current) {
      console.log("Login already in progress, ignoring duplicate request");
      return;
    }
    isSubmittingRef.current = true;

    const emailVal = email.trim();
    const passVal = password;

    if (!emailVal || !passVal) {
      setErrorText("Please fill out both email and password fields.");
      isSubmittingRef.current = false;
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailVal,
        password: passVal,
      });
      
      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error("Auth login failed", err);
      const msg = err.message || "";
      let friendlyMessage = "Error signing in. Please verify your credentials and try again.";
      
      if (msg.includes("Invalid login credentials") || msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found")) {
        friendlyMessage = "Incorrect email address or password. Please try again.";
      } else if (msg.includes("Invalid email")) {
        friendlyMessage = "The email address entered is invalid.";
      } else if (msg.includes("too many requests") || msg.includes("Too many") || msg.includes("rate limit") || msg.includes("429")) {
        friendlyMessage = "Too many requests. Please wait a moment and try again.";
      }
      
      setErrorText(friendlyMessage);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#E0E0E0] select-none font-sans relative overflow-hidden flex flex-col justify-center items-center px-4">
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] -z-10" />

      <button
        onClick={() => onNavigate("landing")}
        className="absolute top-6 left-6 flex items-center gap-1.5 text-xs text-stone-400 hover:text-white transition cursor-pointer font-medium"
      >
        <ChevronLeft className="w-4 h-4" /> Exit to Home
      </button>

      <div className="w-full max-w-md bg-white/5 border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
        
        <div className="flex flex-col items-center text-center mb-6">
          <div className="bg-gradient-to-tr from-blue-600 to-sky-400 p-2.5 rounded-xl shadow-lg shadow-blue-500/10 mb-2">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-sans font-extrabold text-xl text-white tracking-tight uppercase">
            Sign In to Sanctuary
          </h2>
          <span className="text-[9px] font-mono text-blue-400 uppercase tracking-widest block font-bold mt-0.5">
            Access Pulpit Workspace Console
          </span>
        </div>

        {errorText && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] p-3 rounded-lg flex items-start gap-2 mb-4 animate-fade-in leading-normal font-sans">
            <span className="font-bold shrink-0">⚠️ Error:</span>
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="email"
                placeholder="pastor@churchname.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-10 pr-4 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
              Secret Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-10 pr-10 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 text-white font-sans font-bold text-xs py-3 rounded-xl cursor-pointer transition-all shadow-md shadow-blue-900/10 flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5" /> Sign In securely
              </>
            )}
          </button>

        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => onNavigate("reset-password")}
            disabled={loading}
            className="text-[10px] text-blue-400/80 hover:text-blue-300 transition cursor-pointer font-medium"
          >
            Forgot Password?
          </button>
        </div>

        <div className="mt-6 pt-5 border-t border-white/5 text-center">
          <p className="text-[11px] text-[#8b9bb4]">
            New to Pulpit Studio?{" "}
            <button
              onClick={() => onNavigate("register")}
              className="text-blue-400 hover:underline font-bold transition select-none cursor-pointer"
              disabled={loading}
            >
              Register Here <UserPlus className="w-3.5 h-3.5 inline pb-0.5" />
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}