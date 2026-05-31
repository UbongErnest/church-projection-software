import React, { useState, FormEvent, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { BookOpen, Mail, ChevronLeft, CheckCircle } from "lucide-react";

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

interface ResetPasswordPageProps {
  onNavigate: (view: "landing" | "login" | "register" | "reset-password" | "set-new-password") => void;
}

export default function ResetPasswordPage({ onNavigate }: ResetPasswordPageProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const isSubmittingRef = useRef(false);

  // If user lands on reset-password with recovery hash, redirect to password set page
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);
    if (hashParams.get("type") === "recovery" || queryParams.get("type") === "recovery") {
      onNavigate("set-new-password");
    }
  }, [onNavigate]);

  const handleRequestReset = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText("");

    // Prevent double submission
    if (isSubmittingRef.current) {
      console.log("Password reset already in progress");
      return;
    }
    isSubmittingRef.current = true;
    setResetSent(false);

    const emailVal = email.trim();
    if (!emailVal) {
      setErrorText("Please enter your email address.");
      isSubmittingRef.current = false;
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailVal, {
        redirectTo: `${APP_URL}/reset-password`,
      });

      if (error) {
        throw error;
      }
      setResetSent(true);
    } catch (err: any) {
      console.error("Password reset failed", err);
      const msg = err.message || "";
      if (msg.includes("User not found") || msg.includes("not found")) {
        setErrorText("No account found with this email address.");
      } else if (msg.includes("too many requests") || msg.includes("Too many") || msg.includes("rate limit") || msg.includes("429")) {
        setErrorText("Too many requests. Please wait a moment and try again.");
      } else {
        setErrorText("Failed to send reset email. Please try again.");
      }
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
            Reset Password
          </h2>
          <span className="text-[9px] font-mono text-blue-400 uppercase tracking-widest block font-bold mt-0.5">
            Enter your email to receive a reset link
          </span>
        </div>

        {errorText && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] p-3 rounded-lg flex items-start gap-2 mb-4 animate-fade-in leading-normal font-sans">
            <span className="font-bold shrink-0">⚠️ Error:</span>
            <span>{errorText}</span>
          </div>
        )}

        {resetSent && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] p-3 rounded-lg flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Reset email sent! Check your inbox for the link.</span>
          </div>
        )}

        <form onSubmit={handleRequestReset} className="space-y-4">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 text-white font-sans font-bold text-xs py-3 rounded-xl cursor-pointer transition-all shadow-md shadow-blue-900/10 flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Mail className="w-3.5 h-3.5" /> Send Reset Link
              </>
            )}
          </button>

          <div className="mt-4 text-center">
            <button
              onClick={() => onNavigate("login")}
              disabled={loading}
              className="text-[10px] text-blue-400/80 hover:text-blue-300 transition cursor-pointer font-medium"
            >
              Back to Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}