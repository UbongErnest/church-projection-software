import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

type SubscriptionPlan = "monthly" | "yearly";

function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan | null {
  if (value === "monthly" || value === "yearly") {
    return value;
  }
  return null;
}

function getPlanAmount(plan: SubscriptionPlan): number {
  const amounts: Record<string, number> = { monthly: 10000, yearly: 25000 };
  return amounts[plan] || 10000;
}

async function flutterwaveRequest<TResponse>(
  endpoint: string,
  method: "GET" | "POST" = "POST",
): Promise<TResponse> {
  const response = await fetch(`https://api.flutterwave.com/v3${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    const errorMsg = result.message || result.error || JSON.stringify(result);
    throw new Error(`Flutterwave API error (${response.status}): ${errorMsg}`);
  }

  return result as TResponse;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase not configured");
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function verifyFlutterwaveTransaction(
  reference: string,
  maxAttempts = 3,
  retryDelayMs = 1500,
): Promise<{ status?: string; meta?: { plan?: string; userId?: string }; amount?: number; customer?: { email?: string } } | null> {
  let lastVerification: { status?: string; meta?: { plan?: string; userId?: string }; amount?: number; customer?: { email?: string } } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await flutterwaveRequest<{ data?: Array<{ tx_ref?: string; status?: string; meta?: Record<string, unknown>; amount?: number; customer?: { email?: string } }> }>(`/transactions?tx_ref=${reference}`, "GET");

    const transactions = response.data || [];
    const transaction = transactions[0];

    if (transaction) {
      lastVerification = transaction;

      if (transaction.status === "successful") {
        return transaction;
      }

      const shouldRetry =
        attempt < maxAttempts &&
        (transaction.status === "pending" || transaction.status === "processing");

      if (!shouldRetry) {
        return transaction;
      }
    }

    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
  }

  return lastVerification;
}

async function activateSubscriptionForUser(userId: string, plan: SubscriptionPlan) {
  const durationDays = plan === "monthly" ? 30 : 365;
  const subscriptionEnd = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("users")
    .update({
      subscription_plan: plan,
      subscription_status: "active",
      subscription_end: subscriptionEnd,
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to update user subscription: ${error.message}`);
  }

  return {
    plan,
    subscriptionEnd,
  };
}

export default async function handler(req: any, res: any) {
  const method = (req.method || "GET").toUpperCase();
  
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
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    if (!body.reference) {
      return res.status(400).json({ error: "Missing reference." });
    }

    const verification = await verifyFlutterwaveTransaction(body.reference);
    const flutterwaveStatus = verification?.status || null;

    if (flutterwaveStatus !== "successful") {
      return res.status(200).json({
        success: false,
        status: flutterwaveStatus || "pending",
        flutterwaveStatus,
        message: `Transaction status: ${flutterwaveStatus}`,
      });
    }

    const metadataPlan = normalizeSubscriptionPlan(verification?.meta?.plan);
    const resolvedPlan = metadataPlan || normalizeSubscriptionPlan(body.plan) || null;
    if (!resolvedPlan) {
      throw new Error("Verified transaction is missing a valid subscription plan.");
    }

    const resolvedUserId = verification?.meta?.userId || body.userId || "";
    if (!resolvedUserId) {
      throw new Error("Verified transaction is missing a user ID.");
    }

    const { subscriptionEnd } = await activateSubscriptionForUser(resolvedUserId, resolvedPlan);

    return res.status(200).json({
      success: true,
      status: "active",
      flutterwaveStatus,
      plan: resolvedPlan,
      subscriptionEnd,
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