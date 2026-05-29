import dotenv from "dotenv";
dotenv.config();

import {
  initializeFlutterwaveTransaction,
  normalizeSubscriptionPlan,
  resolveAppUrlFromRequest,
} from "@/server/payments";

export default async function handler(req: any, res: any) {
  const method = (req.method || "GET").toUpperCase();
  
  // Check if environment variables are set first
  if (!process.env.FLUTTERWAVE_SECRET_KEY) {
    return res.status(500).json({
      error: "Failed to initialize payment",
      details: "FLUTTERWAVE_SECRET_KEY is not set in environment",
    });
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      error: "Failed to initialize payment",
      details: "SUPABASE_SERVICE_ROLE_KEY is not set in environment",
    });
  }

  if (method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", receivedMethod: method });
  }

  try {
    // req.body should be parsed by Vercel when Content-Type: application/json
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const plan = normalizeSubscriptionPlan(body.plan);
    if (!body.email || !body.userId || !plan) {
      return res.status(400).json({ error: "Missing or invalid email, userId, or plan.", received: body });
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
    console.error("[API Initialize] Error:", error);
    return res.status(500).json({
      error: "Failed to initialize payment",
      details: error.message || "Unknown error occurred",
    });
  }
}