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
  const durationDays = plan === "monthly" ? 30 : 365;
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

  if (!response.ok) {
    const errorMsg = result.message || result.error || JSON.stringify(result);
    const error = new Error(`Flutterwave API error (${response.status}): ${errorMsg}`) as any;
    error.status = response.status;
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
  maxAttempts = 1,
): Promise<{ status?: string; meta?: Record<string, unknown>; amount?: number; customer?: { email?: string } } | null> {
  console.log("[Flutterwave Verify] Starting verification for reference:", reference);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await flutterwaveRequest<{ data?: Array<{ tx_ref?: string; status?: string; meta?: Record<string, unknown>; amount?: number; customer?: { email?: string } }> }>(`/transactions?tx_ref=${reference}`, "GET");

      const transactions = response.data || [];
      const transaction = transactions[0];

      if (transaction) {
        console.log(`[Flutterwave Verify] Attempt ${attempt} response:`, { status: transaction.status, tx_ref: transaction.tx_ref });
        
        if (transaction.status === "successful") {
          console.log("[Flutterwave Verify] Transaction successful, returning");
          return transaction;
        }
      } else {
        console.log("[Flutterwave Verify] No transactions found for reference");
      }
    } catch (error: any) {
      console.error("[Flutterwave Verify] Error:", error.message, "attempt:", attempt);
      throw error;
    }

    const delay = 1500;
    console.log(`[Flutterwave Verify] Waiting ${delay}ms before next check`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  console.log("[Flutterwave Verify] Completed all attempts without success");
  return null;
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
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("[Supabase] Error fetching transaction record:", error.message);
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
}) {
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
    console.error("[Supabase] Failed to record transaction:", error.message);
    throw new Error(`Failed to record transaction: ${error.message}`);
  }
  
  console.log("[Supabase] Transaction recorded successfully");
}

async function updateTransactionStatus(supabase: SupabaseClient, reference: string, updates: {
  status?: string;
  flutterwave_status?: string;
  verified_at?: string;
}) {
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

async function activateSubscriptionForUser(supabase: SupabaseClient, userId: string, plan: SubscriptionPlan) {
  const subscriptionEnd = calculateSubscriptionEnd(plan);
  const now = new Date().toISOString();
  
  console.log("[Supabase] Activating subscription for user:", { userId, plan, subscriptionEnd, subscriptionStart: now });

  const { data, error } = await supabase
    .from("users")
    .update({
      subscription_plan: plan,
      subscription_status: "active",
      subscription_end: subscriptionEnd,
      subscription_start: now,
    })
    .eq("user_id", userId)
    .select("user_id, subscription_plan, subscription_status")
    .single();

  if (error) {
    console.error("[Supabase] Subscription activation failed:", error.message);
    throw new Error(`Failed to update user subscription: ${error.message}`);
  }
  
  console.log("[Supabase] Subscription activated successfully:", data);

  return {
    plan,
    subscriptionEnd,
  };
}

async function readBody(req: any): Promise<Record<string, unknown>> {
  console.log("[Request] Parsing body, type:", typeof req.body);
  
  if (req.body && typeof req.body === "object") {
    return req.body as Record<string, unknown>;
  }
  
  if (typeof req.body?.text === "function") {
    try {
      const text = await req.body.text();
      const parsed = JSON.parse(text);
      return typeof parsed === "object" ? parsed : {};
    } catch (e) {
      console.error("[Request] Failed to parse streaming body:", e);
      return {};
    }
  }
  
  if (typeof req.body === "string") {
    try {
      const parsed = JSON.parse(req.body);
      return typeof parsed === "object" ? parsed : {};
    } catch (e) {
      console.error("[Request] Failed to parse string body:", e);
      return {};
    }
  }
  
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
      details: `Missing required environment variables: ${missingVars.join(", ")}`,
    });
  }

  if (method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed", receivedMethod: method });
  }

  let body: Record<string, unknown>;
  try {
    body = await readBody(req);
    console.log("[Payment Verify] Parsed body:", { reference: body.reference, userId: body.userId, plan: body.plan });
  } catch (e: any) {
    console.error("[Payment Verify] Failed to read body:", e.message);
    return res.status(400).json({ success: false, error: "Invalid request body" });
  }

  const reference = typeof body.reference === "string" ? body.reference : undefined;
  if (!reference) {
    console.error("[Payment Verify] Missing reference in request");
    return res.status(400).json({ success: false, error: "Missing transaction reference" });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Idempotency check - see if transaction was already processed
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
    const verification = await verifyFlutterwaveTransaction(reference);
    
    if (!verification) {
      console.log("[Payment Verify] Transaction not found in Flutterwave");
      return res.status(200).json({
        success: false,
        status: "not_found",
        flutterwaveStatus: null,
        message: "Transaction not found. Please wait for webhook confirmation.",
        reference,
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
      });
    }

    // Case-insensitive search for user ID and plan in verification meta
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
      throw new Error("Verified transaction is missing a valid subscription plan in meta data and request body.");
    }

    if (!resolvedUserId) {
      throw new Error("Verified transaction is missing a user ID in meta data and request body.");
    }

    // Record and update transaction before activating subscription
    const expectedAmount = getPlanAmount(resolvedPlan);
    const customerEmail = verification.customer?.email;
    
    try {
      await recordTransaction(supabase, {
        reference,
        userId: resolvedUserId,
        plan: resolvedPlan,
        amount: expectedAmount,
        email: customerEmail,
      });
    } catch (recordError: any) {
      console.error("[Payment Verify] Could not record transaction (continuing anyway):", recordError.message);
    }

    await updateTransactionStatus(supabase, reference, {
      status: "success",
      flutterwave_status: "success",
      verified_at: new Date().toISOString(),
    });

    const { subscriptionEnd } = await activateSubscriptionForUser(supabase, resolvedUserId, resolvedPlan);

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
      reference,
    });
    return res.status(500).json({
      success: false,
      error: "Failed to verify payment",
      details: error.message || "Unknown error occurred",
    });
  }
}