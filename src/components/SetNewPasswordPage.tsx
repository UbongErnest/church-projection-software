import React, { useState, FormEvent, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { BookOpen, Lock, KeyRound, ChevronLeft, Eye, EyeOff, CheckCircle } from "lucide-react";

interface SetNewPasswordPageProps {
  onNavigate: (view: "landing" | "login" | "register" | "reset-password" | "set-new-password" | "otp-verification") => void;
}

export default function SetNewPasswordPage({ onNavigate }: SetNewPasswordPageProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [success, setSuccess] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const checkRecoverySession = async () => {
      // Supabase automatically processes hash fragment via onAuthStateChange
      // Check if we have recovery params in hash or query
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);
      const type = hashParams.get("type") || queryParams.get("type");

      if (type !== "recovery") {
        setErrorText("Invalid or expired reset link. Please request a new password reset.");
        return;
      }

      // Get session - Supabase client should have processed the hash
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErrorText("Invalid or expired reset link. Please request a new password reset.");
      }
    };
    checkRecoverySession();
  }, []);

  // Watch for session changes - if session is cleared after signOut, navigate to login
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        // After signOut, Supabase clears the hash, so clear recovery mode
        // and navigate to login page
        window.history.replaceState({}, document.title, window.location.pathname);
        onNavigate("login");
      }
    });
    return () => subscription.unsubscribe();
  }, [onNavigate]);

  const handleSetNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText("");

    // Prevent double submission
    if (isSubmittingRef.current) {
      console.log("Password update already in progress");
      return;
    }
    isSubmittingRef.current = true;

    if (!password || password.length < 6) {
      setErrorText("Password must be at least 6 characters.");
      isSubmittingRef.current = false;
      return;
    }

    if (password !== confirmPassword) {
      setErrorText("Passwords do not match.");
      isSubmittingRef.current = false;
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErrorText("Invalid or expired reset link. Please request a new password reset.");
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }
      // Sign out after successful password update so user can login with new password
      await supabase.auth.signOut();
      // Clear hash to prevent re-processing
      window.history.replaceState({}, document.title, "/login");
      setSuccess(true);
      setTimeout(() => {
        onNavigate("login");
      }, 2000);
    } catch (err: any) {
      console.error("Password update failed", err);
      const msg = err.message || "";
      if (msg.includes("too many requests") || msg.includes("Too many") || msg.includes("rate limit") || msg.includes("429")) {
        setErrorText("Too many signup emails have been sent recently. Please try again later.");
      } else {
        setErrorText(msg || "Failed to update password. Please try again.");
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
            Set New Password
          </h2>
          <span className="text-[9px] font-mono text-blue-400 uppercase tracking-widest block font-bold mt-0.5">
            Create your new password for Sanctuary
          </span>
        </div>

        {success && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] p-3 rounded-lg flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Password updated successfully! Redirecting to login...</span>
          </div>
        )}

        {errorText && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] p-3 rounded-lg flex items-start gap-2 mb-4 animate-fade-in leading-normal font-sans">
            <span className="font-bold shrink-0">⚠️ Error:</span>
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={handleSetNewPassword} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-10 pr-10 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                required
                disabled={loading || success}
                minLength={6}
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

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-10 pr-10 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                required
                disabled={loading || success}
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 text-white font-sans font-bold text-xs py-3 rounded-xl cursor-pointer transition-all shadow-md shadow-blue-900/10 flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5" /> Update Password
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}