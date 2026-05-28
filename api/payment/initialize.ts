import {
  initializeFlutterwaveTransaction,
  normalizeSubscriptionPlan,
  resolveAppUrlFromRequest,
  getFlutterwaveSecretKeySafe,
  getSupabaseAdminSafe,
} from "../../src/server/payments";

async function parseBody(req: any): Promise<Record<string, unknown>> {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  return {};
}

export default async function handler(req: any, res: any) {
  if (!getFlutterwaveSecretKeySafe()) {
    console.error("[API Initialize] Configuration error: FLUTTERWAVE_SECRET_KEY missing");
    return res.status(500).json({
      error: "Failed to initialize payment",
      details: "Server configuration error: FLUTTERWAVE_SECRET_KEY is not set",
    });
  }

  if (!getSupabaseAdminSafe()) {
    console.error("[API Initialize] Configuration error: SUPABASE_SERVICE_ROLE_KEY missing");
    return res.status(500).json({
      error: "Failed to initialize payment",
      details: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await parseBody(req) as { email?: string; plan?: string; userId?: string };
    const plan = normalizeSubscriptionPlan(body.plan);
    if (!body.email || !body.userId || !plan) {
      return res.status(400).json({ error: "Missing or invalid email, userId, or plan." });
    }

    const callbackUrl = `${resolveAppUrlFromRequest(req)}/api/payment/callback`;
    const transaction = await initializeFlutterwaveTransaction({
      email: body.email,
      plan,
      userId: body.userId,
      callbackUrl,
    });

    return res.status(200).json({
      success: true,
      paymentLink: transaction.link,
      reference: transaction.reference,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "Failed to initialize payment",
      details: error.message || "Unknown error occurred",
    });
  }
}