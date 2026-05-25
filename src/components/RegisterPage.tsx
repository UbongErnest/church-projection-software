import React, { useState, FormEvent } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { 
  BookOpen, 
  User, 
  Mail, 
  Lock, 
  Sparkles, 
  LogIn, 
  ChevronLeft, 
  Building2, 
  Globe, 
  MapPin, 
  Landmark,
  FileText,
  X
} from "lucide-react";

interface RegisterPageProps {
  onNavigate: (view: "landing" | "login" | "register") => void;
  onAuthSuccess: () => void;
}

export default function RegisterPage({ onNavigate, onAuthSuccess }: RegisterPageProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [churchName, setChurchName] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [location, setLocation] = useState("");
  const [denomination, setDenomination] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeLegal, setAgreeLegal] = useState(false);
  
  // Modals for legal popups inside register view for convenience
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText("");

    const nameVal = fullName.trim();
    const emailVal = email.trim();
    const churchVal = churchName.trim();
    const countryVal = country.trim();
    const stateVal = state.trim();
    const cityVal = city.trim();
    const locationVal = location.trim();
    const denomVal = denomination.trim();
    const passVal = password;

    if (
      !nameVal || 
      !emailVal || 
      !churchVal || 
      !countryVal || 
      !stateVal || 
      !cityVal || 
      !locationVal || 
      !denomVal || 
      !passVal
    ) {
      setErrorText("Please fill out all required fields.");
      return;
    }

    if (!agreeLegal) {
      setErrorText("You must accept the Privacy Policy and Terms & Conditions before creating an account.");
      return;
    }

    if (passVal.length < 6) {
      setErrorText("Password must be at least 6 characters long.");
      return;
    }

    if (passVal !== confirmPassword) {
      setErrorText("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // 1. Create client credential inside Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, emailVal, passVal);
      const user = userCredential.user;

      // 2. Attach human name to Firebase Authentication Profile
      await updateProfile(user, {
        displayName: nameVal
      });

      // 3. Document the profile representation inside Firestore database
      const userRef = doc(db, "users", user.uid);
      const userPayload = {
        uid: user.uid,
        email: emailVal,
        displayName: nameVal,
        createdAt: new Date().toISOString(),
        churchName: churchVal,
        country: countryVal,
        state: stateVal,
        city: cityVal,
        location: locationVal,
        denomination: denomVal,
        subscriptionPlan: "free",
        subscriptionStatus: "active"
      };

      try {
        await setDoc(userRef, userPayload);
      } catch (firestoreError) {
        // Enforce the custom error handle as outlined in skill guidelines
        handleFirestoreError(firestoreError, OperationType.CREATE, `users/${user.uid}`);
      }

      // Success Trigger
      onAuthSuccess();
    } catch (err: any) {
      console.error("Auth register failed", err);
      let friendlyMessage = "An unexpected error occurred during registration. Please try again.";
      
      if (err.code === "auth/email-already-in-use") {
        friendlyMessage = "This email is already registered. Please login or use a different one.";
      } else if (err.code === "auth/invalid-email") {
        friendlyMessage = "Please provide a valid email address structure.";
      } else if (err.code === "auth/weak-password") {
        friendlyMessage = "Weak password. Minimum of 6 characters required by security policies.";
      } else if (err.message && err.message.includes("Firestore")) {
        friendlyMessage = "Authentication succeeded, but profile creation was blocked by security rules.";
      }

      setErrorText(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#E0E0E0] select-none font-sans relative overflow-y-auto flex flex-col justify-center items-center py-10 px-4">
      
      {/* Background glow atmosphere */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-blue-600/10 rounded-full blur-[100px] -z-10" />

      {/* Back to landing */}
      <button
        onClick={() => onNavigate("landing")}
        className="absolute top-6 left-6 flex items-center gap-1.5 text-xs text-stone-400 hover:text-white transition cursor-pointer font-medium"
      >
        <ChevronLeft className="w-4 h-4" /> Exit to Home
      </button>

      {/* Main card */}
      <div className="w-full max-w-2xl bg-white/5 border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
        
        {/* Logo block */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="bg-gradient-to-tr from-blue-600 to-sky-400 p-2.5 rounded-xl shadow-lg shadow-blue-500/10 mb-2">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-sans font-extrabold text-xl text-white tracking-tight uppercase">
            Create Sanctuary Workspace
          </h2>
          <span className="text-[9px] font-mono text-blue-400 uppercase tracking-widest block font-bold mt-0.5">
            Register Chaver AI Account
          </span>
        </div>

        {errorText && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] p-3 rounded-lg flex items-start gap-2 mb-4 animate-fade-in leading-normal font-sans">
            <span className="font-bold shrink-0">⚠️ Error:</span>
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
                Registrant Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input
                  type="text"
                  placeholder="Pastor / Brother / Sister ..."
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input
                  type="email"
                  placeholder="pastor@churchname.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Church Name */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
                Church Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input
                  type="text"
                  placeholder="Grace Chapel International"
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Denomination */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
                Church Denomination
              </label>
              <div className="relative">
                <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input
                  type="text"
                  placeholder="Pentecostal, Methodist, Baptist, etc."
                  value={denomination}
                  onChange={(e) => setDenomination(e.target.value)}
                  className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Country */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
                Country
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input
                  type="text"
                  placeholder="United Kingdom, Nigeria, etc."
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* State */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
                State / Province
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input
                  type="text"
                  placeholder="Texas, London, Akwa Ibom, etc."
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* City */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
                City
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input
                  type="text"
                  placeholder="Houston, Uyo, etc."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Specific Location Address */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
                Specific Location / Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input
                  type="text"
                  placeholder="12 Main Sanctuary Avenue"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
                Create Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input
                  type="password"
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-white/40 uppercase tracking-widest block font-semibold">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input
                  type="password"
                  placeholder="••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#111317] border border-white/10 focus:border-blue-500 focus:outline-none pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-white/25 transition-all"
                  required
                  disabled={loading}
                />
              </div>
            </div>

          </div>

          {/* Privacy & Terms Consent Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer text-[#8b9bb4] select-none">
              <input
                type="checkbox"
                checked={agreeLegal}
                onChange={(e) => setAgreeLegal(e.target.checked)}
                className="mt-0.5 rounded border-white/10 bg-[#111317] text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer h-3.5 w-3.5"
                disabled={loading}
              />
              <span className="text-[10px] sm:text-[11px] leading-tight font-sans">
                I accept the secure cloud mapping protocols of the{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPrivacy(true);
                  }}
                  className="text-blue-400 font-bold hover:underline"
                >
                  Privacy Policy
                </button>{" "}
                and the liturgical operational agreements in the{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowTerms(true);
                  }}
                  className="text-blue-400 font-bold hover:underline"
                >
                  Terms & Conditions
                </button>
                .
              </span>
            </label>
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
                <Sparkles className="w-3.5 h-3.5" /> Initialize Account
              </>
            )}
          </button>

        </form>

        {/* Dynamic selector to login */}
        <div className="mt-6 pt-5 border-t border-white/5 text-center">
          <p className="text-[11px] text-[#8b9bb4]">
            Already registered?{" "}
            <button
              onClick={() => onNavigate("login")}
              className="text-blue-400 hover:underline font-bold transition select-none cursor-pointer"
              disabled={loading}
            >
              Sign In Here <LogIn className="w-3 h-3 inline pb-0.5" />
            </button>
          </p>
        </div>

      </div>

      {/* PRIVACY POLICY MODAL OVERLAY */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 bg-[#070b13]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#111317] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col max-h-[85vh] shadow-2xl relative select-none">
            <button
              onClick={() => setShowPrivacy(false)}
              className="absolute top-5 right-5 p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
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

            <div className="flex-1 overflow-y-auto text-xs text-stone-300 space-y-4 pr-1 leading-relaxed font-sans scrollbar-thin scrollbar-thumb-white/10 text-left">
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

      {/* TERMS & CONDITIONS MODAL OVERLAY */}
      {showTerms && (
        <div className="fixed inset-0 z-50 bg-[#070b13]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#111317] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col max-h-[85vh] shadow-2xl relative select-none">
            <button
              onClick={() => setShowTerms(false)}
              className="absolute top-5 right-5 p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
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

            <div className="flex-1 overflow-y-auto text-xs text-stone-300 space-y-4 pr-1 leading-relaxed font-sans scrollbar-thin scrollbar-thumb-white/10 text-left">
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
