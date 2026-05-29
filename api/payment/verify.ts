import dotenv from "dotenv";
dotenv.config();

import {
  normalizeSubscriptionPlan,
  verifyAndActivatePayment,
} from "../../src/server/payments";

export default async function handler(req: any, res: any) {
  // Vercel uses httpMethod, not method
  const method = (req.method || req.httpMethod || "GET").toUpperCase();
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      error: "Failed to verify payment",
      details: "SUPABASE_SERVICE_ROLE_KEY is not set in environment",
    });
  }

  if (method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", receivedMethod: method });
  }

  try {
    const body = req.body || {};
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