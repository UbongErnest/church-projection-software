import dotenv from "dotenv";
dotenv.config();

import {
  normalizeSubscriptionPlan,
  verifyAndActivatePayment,
  getSupabaseAdminSafe,
} from "../../src/server/payments";

function readJsonBody(body: unknown) {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body && typeof body === "object" ? body : {};
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminMissing = !getSupabaseAdminSafe();
  if (adminMissing) {
    console.error("[API Verify] Configuration error: Supabase admin client not configured");
    return res.status(500).json({
      error: "Failed to verify payment",
      details: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set",
    });
  }

  try {
    const body = readJsonBody(req.body) as {
      reference?: string;
      userId?: string;
      plan?: string;
    };

    if (!body.reference) {
      return res.status(400).json({ error: "Missing reference." });
    }

    const result = await verifyAndActivatePayment({
      reference: body.reference,
      fallbackPlan: normalizeSubscriptionPlan(body.plan),
      fallbackUserId: body.userId,
      logPrefix: "[Flutterwave Verify]",
    });

    if (!result.success) {
      return res.status(200).json({
        success: false,
        status: result.flutterwaveStatus || "pending",
        flutterwaveStatus: result.flutterwaveStatus,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      status: "active",
      flutterwaveStatus: result.flutterwaveStatus,
      plan: result.plan,
      subscriptionEnd: result.subscriptionEnd,
      reference: body.reference,
    });
  } catch (error: any) {
    console.error("Flutterwave verify error:", error);
    return res.status(500).json({
      error: "Failed to verify payment",
      details: error.message || "Unknown error occurred",
    });
  }
}