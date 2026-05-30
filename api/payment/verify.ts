import * as dotenv from "dotenv";
dotenv.config();

import { createClient, SupabaseClient } from "@supabase/supabase-js";

type SubscriptionPlan = "monthly" | "yearly";

function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan | null {
  if (value === "monthly" || value === "yearly") {
    return value;
  }
  return null;
}

function getPlanAmount(plan: SubscriptionPlan): number {
  const amounts: Record<string, number> = { monthly: 10500, yearly: 25500 };
  return amounts[plan] || 10500;
}

function calculateSubscriptionEnd(plan: SubscriptionPlan): string {
  const durationDays = plan === "monthly" ? 30 : 30;
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

async function flutterwaveRequest<TResponse>(
  endpoint: string,
  method: "GET" | "POST" = "POST",
): Promise<TResponse> {
  console.log(`[Flutterwave Request] ${method} ${endpoint}`);
  
  const response = await fetch(`https://api.flutterwave.com/v3${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });

  let result: any;
  try {
    result = await response.json();
  } catch (parseError) {
    const text = await response.text();
    throw new Error(`Flutterwave API returned non-JSON response (${response.status}): ${text.slice(0, 200)}`);
  }

  console.log(`[Flutterwave Response] Status: ${response.status}`, result);

  // Don't throw on 5xx - return result for graceful error handling
  if (!response.ok) {
    const errorMsg = result.message || result.error || JSON.stringify(result);
    const error = new Error(`Flutterwave API error (${response.status}): ${errorMsg}`) as any;
    error.status = response.status;
    error.stage = "flutterwave_verification";
    throw error;
  }

  return result as TResponse;
}

function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("[Supabase] Getting admin client", { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase not configured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function verifyFlutterwaveTransaction(
  reference: string,
): Promise<{ status?: string; meta?: Record<string, unknown>; amount?: number; customer?: { email?: string } } | null> {
  console.log("[Flutterwave Verify] Starting verification for reference:", reference);
  
  try {
    // Use verify_by_reference endpoint (more stable than list endpoint)
    const response = await flutterwaveRequest<{ 
      status?: string; 
      data?: { tx_ref?: string; status?: string; meta?: Record<string, unknown>; amount?: number; customer?: { email?: string } },
      message?: string
    }>(`/transactions/verify_by_reference?tx_ref=${reference}`, "GET");

    // Validate response structure
    if (!response || !response.data) {
      console.error("[Flutterwave Verify] Invalid response structure - no data field");
      return null;
    }

    const tx = response.data;
    console.log("[Flutterwave Verify] Response received:", { status: tx.status, tx_ref: tx.tx_ref });
    
    if (tx.status === "successful") {
      console.log("[Flutterwave Verify] Transaction successful, returning");
      return tx;
    }
    
    console.log("[Flutterwave Verify] Transaction status:", tx.status);
    return null;
  } catch (error: any) {
    const isServerError = error.status >= 500;
    console.error("[Flutterwave Verify] Error:", { 
      message: error.message, 
      status: error.status,
      isServerError,
    });
    
    // For 5xx errors, return null instead of throwing - allows webhook retry
    if (isServerError) {
      console.log("[Flutterwave Verify] Server error - returning null for graceful handling");
      return null;
    }
    
    throw error;
  }
}

interface TransactionRecord {
  user_id: string;
  plan: SubscriptionPlan;
  status: string;
  flutterwave_status: string;
}

async function getTransactionRecord(supabase: SupabaseClient, reference: string): Promise<TransactionRecord | null> {
  console.log("[Supabase] Checking transaction record for:", reference);
  
  const { data, error } = await supabase
    .from("transactions")
    .select("user_id, plan, status, flutterwave_status")
    .eq("reference", reference)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] Error fetching transaction record:", { 
      message: error.message, 
      code: error.code,
      details: error.details 
    });
    return null;
  }
  
  console.log("[Supabase] Transaction record lookup result:", data || "not found");
  return data as TransactionRecord | null;
}

async function recordTransaction(supabase: SupabaseClient, transaction: {
  reference: string;
  userId: string;
  plan: SubscriptionPlan;
  amount: number;
  email?: string;
}): Promise<void> {
  console.log("[Supabase] Recording transaction:", { reference: transaction.reference, userId: transaction.userId });
  
  const { error } = await supabase
    .from("transactions")
    .upsert({
      reference: transaction.reference,
      user_id: transaction.userId,
      plan: transaction.plan,
      amount: transaction.amount,
      currency: "NGN",
      email: transaction.email,
      status: "pending",
      created_at: new Date().toISOString(),
    }, {
      onConflict: "reference",
    });

  if (error) {
    const errorMsg = error.message || "Unknown error";
    console.error("[Supabase] Failed to record transaction:", errorMsg);
  } else {
    console.log("[Supabase] Transaction recorded successfully");
  }
}

async function updateTransactionStatus(supabase: SupabaseClient, reference: string, updates: {
  status?: string;
  flutterwave_status?: string;
  verified_at?: string;
}): Promise<void> {
  console.log("[Supabase] Updating transaction status:", { reference, updates });
  
  const { error } = await supabase
    .from("transactions")
    .update(updates)
    .eq("reference", reference);

  if (error) {
    console.error("[Supabase] Failed to update transaction status:", error.message);
  } else {
    console.log("[Supabase] Transaction status updated successfully");
  }
}

async function activateSubscriptionForUser(supabase: SupabaseClient, userId: string, plan: SubscriptionPlan): Promise<{ plan: SubscriptionPlan; subscriptionEnd: string }> {
  const subscriptionEnd = calculateSubscriptionEnd(plan);
  const now = new Date().toISOString();
  
  console.log("[Supabase] Activating subscription for user:", { userId, plan, subscriptionStart: now, subscriptionEnd });

  const { data, error } = await supabase
    .from("users")
    .update({
      subscription_plan: plan,
      subscription_status: "active",
      subscription_start: now,
      subscription_end: subscriptionEnd,
    })
    .eq("user_id", userId)
    .select("user_id, subscription_plan, subscription_status")
    .single();

  if (error) {
    const errorMsg = error.message || "Unknown error";
    const err = new Error(`Failed to update user subscription: ${errorMsg}`) as any;
    err.stage = "subscription_update";
    console.error("[Supabase] Subscription activation failed:", errorMsg, { code: error.code });
    throw err;
  }
  
  console.log("[Supabase] Subscription activated successfully:", data);

  return {
    plan,
    subscriptionEnd,
  };
}

function readBody(req: any): Record<string, unknown> {
  console.log("[Request] Parsing body, type:", typeof req.body);
  
  // Vercel/Next.js parses body automatically - use it directly
  if (req.body && typeof req.body === "object") {
    console.log("[Request] Body already parsed by Vercel");
    return req.body as Record<string, unknown>;
  }
  
  // If body is already a string
  if (typeof req.body === "string") {
    try {
      const parsed = JSON.parse(req.body);
      console.log("[Request] Body parsed from string");
      return typeof parsed === "object" ? parsed : {};
    } catch (e) {
      console.error("[Request] Failed to parse string body:", e);
      return {};
    }
  }
  
  // Query parameters fallback (for GET-style callback)
  if (req.query && typeof req.query === "object") {
    console.log("[Request] Using query parameters as fallback");
    return req.query as Record<string, unknown>;
  }
  
  console.log("[Request] No body or query found in request");
  return {};
}

export default async function handler(req: any, res: any) {
  console.log("[Payment Verify] Request started", { method: req.method, hasBody: !!req.body });
  
  const method = (req.method || "GET").toUpperCase();

  const requiredEnvVars = {
    FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error("[Payment Verify] Missing environment variables:", missingVars);
    return res.status(500).json({
      success: false,
      error: "Server configuration error",
      stage: "environment_validation",
      details: `Missing required environment variables: ${missingVars.join(", ")}`,
    });
  }

  if (method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed", receivedMethod: method });
  }

  const body = readBody(req);
  console.log("[Payment Verify] Parsed body:", { reference: body.reference, userId: body.userId, plan: body.plan });

  const reference = typeof body.reference === "string" ? body.reference : undefined;
  if (!reference) {
    console.error("[Payment Verify] Missing reference in request");
    return res.status(400).json({ success: false, error: "Missing transaction reference", stage: "validation" });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Idempotency check - see if transaction was already processed
    console.log("[Payment Verify] Stage: checking_idempotency");
    const existingRecord = await getTransactionRecord(supabase, reference);
    
    if (existingRecord && (existingRecord.flutterwave_status === "success" || existingRecord.status === "success")) {
      console.log("[Payment Verify] Transaction already processed, returning success");
      return res.status(200).json({
        success: true,
        message: "Subscription already activated",
        plan: existingRecord.plan,
        status: "active",
        reference,
      });
    }

    // Verify with Flutterwave
    console.log("[Payment Verify] Stage: flutterwave_verification");
    const verification = await verifyFlutterwaveTransaction(reference);
    
    if (!verification) {
      console.log("[Payment Verify] Transaction not found or Flutterwave server error");
      return res.status(200).json({
        success: false,
        status: "pending",
        flutterwaveStatus: null,
        message: "Transaction verification pending. Please wait for webhook confirmation.",
        reference,
        stage: "flutterwave_verification",
      });
    }

    const flutterwaveStatus = verification.status || null;
    console.log("[Payment Verify] Flutterwave status:", flutterwaveStatus);

    if (flutterwaveStatus !== "successful") {
      return res.status(200).json({
        success: false,
        status: flutterwaveStatus || "pending",
        flutterwaveStatus,
        message: `Transaction status: ${flutterwaveStatus}`,
        reference,
        stage: "flutterwave_verification",
      });
    }

    // Case-insensitive search for user ID and plan in verification meta
    console.log("[Payment Verify] Stage: resolving_user_and_plan");
    let resolvedUserId: string | undefined;
    let resolvedPlan: SubscriptionPlan | null = normalizeSubscriptionPlan(verification.meta?.plan);
    
    if (verification.meta?.userId || verification.meta?.user_id) {
      resolvedUserId = (verification.meta?.userId || verification.meta?.user_id) as string;
    } else if (verification.meta) {
      const meta = verification.meta as Record<string, unknown>;
      for (const key of Object.keys(meta)) {
        if (key.toLowerCase() === "userid") {
          resolvedUserId = typeof meta[key] === "string" ? meta[key] : undefined;
          break;
        }
      }
    }

    // Try to find plan with case-insensitive matching if meta plan failed
    if (!resolvedPlan && verification.meta) {
      const meta = verification.meta as Record<string, unknown>;
      for (const key of Object.keys(meta)) {
        if (key.toLowerCase() === "plan") {
          const planValue = typeof meta[key] === "string" ? meta[key] : null;
          if (planValue === "monthly" || planValue === "yearly") {
            resolvedPlan = planValue;
          }
          break;
        }
      }
    }

    // Fallback to body parameters
    if (!resolvedUserId) {
      resolvedUserId = typeof body.userId === "string" ? body.userId : undefined;
    }
    if (!resolvedPlan) {
      const bodyPlan = typeof body.plan === "string" ? body.plan : undefined;
      resolvedPlan = normalizeSubscriptionPlan(bodyPlan);
    }

    if (!resolvedPlan) {
      console.error("[Payment Verify] Missing plan - validation failed");
      return res.status(400).json({
        success: false,
        error: "Verified transaction is missing a valid subscription plan in meta data and request body.",
        stage: "validation",
      });
    }

    if (!resolvedUserId) {
      console.error("[Payment Verify] Missing userId - validation failed");
      return res.status(400).json({
        success: false,
        error: "Verified transaction is missing a user ID in meta data and request body.",
        stage: "validation",
      });
    }

    // Record and update transaction before activating subscription
    const expectedAmount = getPlanAmount(resolvedPlan);
    const customerEmail = verification.customer?.email;
    
    console.log("[Payment Verify] Stage: recording_transaction");
    await recordTransaction(supabase, {
      reference,
      userId: resolvedUserId,
      plan: resolvedPlan,
      amount: expectedAmount,
      email: customerEmail,
    });

    await updateTransactionStatus(supabase, reference, {
      status: "success",
      flutterwave_status: "success",
      verified_at: new Date().toISOString(),
    });

    // Activate subscription
    console.log("[Payment Verify] Stage: subscription_update");
    const { subscriptionEnd } = await activateSubscriptionForUser(supabase, resolvedUserId, resolvedPlan);

    console.log("[Payment Verify] Stage: complete - subscription activated");
    return res.status(200).json({
      success: true,
      status: "active",
      flutterwaveStatus,
      plan: resolvedPlan,
      subscriptionEnd,
      reference,
      message: "Subscription activated",
    });
  } catch (error: any) {
    console.error("[Payment Verify] Unhandled error:", {
      message: error.message,
      stack: error.stack,
      stage: error.stage || "unknown",
      reference,
    });
    return res.status(500).json({
      success: false,
      error: "Failed to verify payment",
      stage: error.stage || "unknown",
      details: error.message || "Unknown error occurred",
    });
  }
}