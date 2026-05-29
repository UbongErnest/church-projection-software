import dotenv from "dotenv";
dotenv.config();

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const hasFlutterwave = !!process.env.FLUTTERWAVE_SECRET_KEY;
  const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const flutterwaveValid = hasFlutterwave && process.env.FLUTTERWAVE_SECRET_KEY?.startsWith("FLW");
  const supabaseKeyValid = process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith("eyJ");

  res.json({
    hasFlutterwaveKey: hasFlutterwave,
    flutterwaveKeyFormat: flutterwaveValid ? "valid" : "invalid-or-missing",
    hasSupabaseConfig: hasSupabase,
    supabaseKeyFormat: supabaseKeyValid ? "valid-jwt" : "invalid-or-missing",
    appUrl: process.env.APP_URL || "not-set",
  });
}