import React, { useState, FormEvent, useRef, useEffect } from "react";
import { supabase } from "../supabase";
import { Shield, ChevronLeft, RefreshCw, KeyRound } from "lucide-react";

interface ResetPasswordOTPPageProps {
  email: string;
  onNavigate: (view: "landing" | "login" | "register" | "reset-password" | "otp-reset-password" | "set-new-password", email?: string) => void;
}

export default function ResetPasswordOTPPage({ email, onNavigate }: ResetPasswordOTPPageProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpiry, setOtpExpiry] = useState(300);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isVerifyingRef = useRef(false);
  const isResendingRef = useRef(false);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }

    setOtpExpiry(300);
    const expiryInterval = setInterval(() => {
      setOtpExpiry((prev) => {
        if (prev <= 1) {
          clearInterval(expiryInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(expiryInterval);
  }, []);

  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 6) {
      setOtp(pastedData.split(""));
    }
  };

  const handleVerifyOTP = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText("");
    setSuccessText("");

    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      setErrorText("Please enter all 6 digits of the OTP code.");
      return;
    }

    if (isVerifyingRef.current) {
      console.log("OTP verification already in progress");
      return;
    }
    isVerifyingRef.current = true;
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email,
        token: otpCode,
        type: "recovery",
      });

      if (error) {
        throw error;
      }

      // Navigate to set-new-password - the session is valid for updateUser
      setSuccessText("OTP verified successfully! You can now set your new password.");
      setTimeout(() => {
        onNavigate("set-new-password", email);
      }, 1500);
    } catch (err: any) {
      console.error("OTP verification failed", err);
      let msg = (err.message || "").toLowerCase();

      let friendlyMessage = "Invalid or expired OTP code. Please try again.";

      if (msg.includes("expired") || msg.includes("invalid")) {
        friendlyMessage = "This OTP code has expired. Click 'Resend OTP Code' to get a fresh one.";
      } else if (msg.includes("rate limit") || msg.includes("too many") || msg.includes("429")) {
        friendlyMessage = "Too many requests. Please wait a moment and try again.";
      }

      setErrorText(friendlyMessage);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
      isVerifyingRef.current = false;
    }
  };

  const handleResendOTP = async () => {
    if (isResendingRef.current) {
      console.log("Resend already in progress");
      return;
    }

    if (resendCooldown > 0) {
      setErrorText(`Please wait ${resendCooldown} seconds before requesting another OTP code.`);
      return;
    }

    setErrorText("");
    setSuccessText("");
    setResendLoading(true);
    isResendingRef.current = true;

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false,
        }
      });

      if (error) {
        throw error;
      }

      setSuccessText("A new OTP code has been sent to your email.");
      setOtpExpiry(300);
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => prev <= 1 ? (clearInterval(interval), 0) : prev - 1);
      }, 1000);
    } catch (err: any) {
      console.error("Resend OTP failed", err);
      const msg = err.message || "";
      if (msg.includes("rate limit") || msg.toLowerCase().includes("too many") || msg.includes("429")) {
        setErrorText("Too many requests. Please wait a moment and try again.");
      } else {
        setErrorText(msg || "Failed to resend OTP. Please try again.");
      }
    } finally {
      setResendLoading(false);
      isResendingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#E0E0E0] select-none font-sans relative overflow-y-auto flex flex-col justify-center items-center py-10 px-4">
       
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] -z-10" />

      <button
        onClick={() => onNavigate("landing")}
        className="absolute top-6 left-6 flex items-center gap-1.5 text-xs text-stone-400 hover:text-white transition cursor-pointer font-medium"
        disabled={loading}
      >
        <ChevronLeft className="w-4 h-4" /> Exit to Home
      </button>

      <div className="w-full max-w-md bg-white/5 border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
        
        <div className="flex flex-col items-center text-center mb-6">
          <div className="bg-gradient-to-tr from-blue-600 to-sky-400 p-2.5 rounded-xl shadow-lg shadow-blue-500/10 mb-2">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-sans font-extrabold text-xl text-white tracking-tight uppercase">
            Reset Password
          </h2>
          <span className="text-[9px] font-mono text-blue-400 uppercase tracking-widest block font-bold mt-0.5">
            Verify your identity with OTP
          </span>
        </div>

        <div className="mb-4 p-3 bg-blue-600/10 border border-blue-500/20 rounded-lg">
          <p className="text-[10px] text-blue-300 text-center">
            We sent a 6-digit verification code to:
          </p>
          <p className="text-[11px] text-white font-bold text-center mt-1 truncate">
            {email}
          </p>
        </div>

        <div className="mb-4 p-3 bg-amber-600/10 border border-amber-500/20 rounded-lg">
          <p className="text-[10px] text-amber-300 text-center font-mono">
            Code expires in: <span className="text-white font-bold">{Math.floor(otpExpiry / 60)}:{String(otpExpiry % 60).padStart(2, '0')}</span>
          </p>
        </div>

        {errorText && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] p-3 rounded-lg flex items-start gap-2 mb-4 animate-fade-in leading-normal font-sans">
            <span className="font-bold shrink-0">⚠️ Error:</span>
            <span>{errorText}</span>
          </div>
        )}

        {successText && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] p-3 rounded-lg flex items-start gap-2 mb-4 animate-fade-in leading-normal font-sans">
            <span className="font-bold shrink-0">✓ Success:</span>
            <span>{successText}</span>
          </div>
        )}

        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block font-semibold text-center">
              Enter OTP Code
            </label>
            <div className="flex justify-center gap-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="w-10 h-12 bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl text-xs text-white text-center placeholder-white/25 transition-all font-bold"
                  required
                  disabled={loading}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || otp.join("").length !== 6}
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 text-white font-sans font-bold text-xs py-3 rounded-xl cursor-pointer transition-all shadow-md shadow-blue-900/10 flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Shield className="w-3.5 h-3.5" /> Verify OTP
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={handleResendOTP}
            disabled={resendLoading || resendCooldown > 0}
            className="text-[10px] text-blue-400/80 hover:text-blue-300 transition cursor-pointer font-medium flex items-center gap-1 justify-center mx-auto disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${resendLoading ? 'animate-spin' : ''}`} />
            {resendCooldown > 0 ? `Wait ${resendCooldown}s` : resendLoading ? "Sending..." : "Resend OTP Code"}
          </button>
        </div>

        <div className="mt-2 text-center border-t border-white/5 pt-3">
          <button
            onClick={() => onNavigate("login")}
            disabled={loading}
            className="text-[10px] text-amber-400/80 hover:text-amber-300 transition cursor-pointer font-medium flex items-center gap-1 justify-center mx-auto"
          >
            Back to Sign In
          </button>
        </div>

      </div>
    </div>
  );
}