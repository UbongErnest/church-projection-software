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

function calculateSubscriptionEnd(plan: SubscriptionPlan): string {
  const durationDays = plan === "monthly" ? 30 : 365;
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

interface TransactionRecord {
  user_id: string;
  plan: SubscriptionPlan;
  status: string;
  flutterwave_status: string;
}

async function readBody(req: any): Promise<Record<string, unknown>> {
  console.log("[Webhook] Parsing body, type:", typeof req.body);
  
  if (req.body && typeof req.body === "object") {
    return req.body as Record<string, unknown>;
  }
  
  if (typeof req.body?.text === "function") {
    try {
      const text = await req.body.text();
      const parsed = JSON.parse(text);
      return typeof parsed === "object" ? parsed : {};
    } catch (e) {
      console.error("[Webhook] Failed to parse streaming body:", e);
      return {};
    }
  }
  
  if (typeof req.body === "string") {
    try {
      const parsed = JSON.parse(req.body);
      return typeof parsed === "object" ? parsed : {};
    } catch (e) {
      console.error("[Webhook] Failed to parse string body:", e);
      return {};
    }
  }
  
  return {};
}

async function getTransactionRecord(supabase: SupabaseClient, reference: string): Promise<TransactionRecord | null> {
  console.log("[Supabase] Checking existing transaction record:", reference);
  
  const { data, error } = await supabase
    .from("transactions")
    .select("user_id, plan, status, flutterwave_status")
    .eq("reference", reference)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("[Supabase] Error checking transaction record:", error.message);
  }
  
  console.log("[Supabase] Transaction record lookup result:", data || "not found");
  return data as TransactionRecord | null;
}

async function activateSubscriptionForUser(supabase: SupabaseClient, userId: string, plan: SubscriptionPlan) {
  const subscriptionEnd = calculateSubscriptionEnd(plan);
  const subscriptionStart = new Date().toISOString();
  
  console.log("[Supabase] Activating subscription via webhook:", { userId, plan, subscriptionStart, subscriptionEnd });

  const { data, error } = await supabase
    .from("users")
    .update({
      subscription_plan: plan,
      subscription_status: "active",
      subscription_start: subscriptionStart,
      subscription_end: subscriptionEnd,
    })
    .eq("user_id", userId)
    .select("user_id, subscription_plan, subscription_status")
    .single();

  if (error) {
    const errMsg = error.message || "Unknown error";
    const err = new Error(`Failed to update user subscription: ${errMsg}`) as any;
    err.stage = "subscription_update";
    console.error("[Supabase] Webhook subscription activation failed:", errMsg, { code: error.code });
    throw err;
  }
  
  console.log("[Supabase] Subscription activated via webhook:", data);

  return {
    plan,
    subscriptionEnd,
  };
}

export default async function handler(req: any, res: any) {
  const method = (req.method || "GET").toUpperCase();
  
  console.log("[Flutterwave Webhook] Request received", { method });

  // Validate environment
  const missingEnvVars: string[] = [];
  if (!process.env.SUPABASE_URL) missingEnvVars.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingEnvVars.push("SUPABASE_SERVICE_ROLE_KEY");
  
  if (missingEnvVars.length > 0) {
    console.error("[Flutterwave Webhook] Missing environment variables:", missingEnvVars);
    return res.status(500).json({ 
      received: false, 
      error: `Server configuration error: missing ${missingEnvVars.join(", ")}` 
    });
  }

  if (method !== "POST") {
    return res.status(405).json({ received: false, error: "Method not allowed" });
  }

  let body: Record<string, unknown>;
  try {
    body = await readBody(req);
  } catch (e: any) {
    console.error("[Flutterwave Webhook] Failed to read body:", e.message);
    return res.status(400).json({ received: false, error: "Invalid request body" });
  }

  const data = (body.data || {}) as Record<string, unknown>;
  const dataStatus = typeof data.status === "string" ? data.status : undefined;
  const reference = typeof data.tx_ref === "string" ? data.tx_ref : undefined;

  console.log("[Flutterwave Webhook] Event data:", { 
    status: dataStatus, 
    tx_ref: reference, 
    meta: data.meta 
  });

  if (!data || typeof data.status !== "string") {
    console.error("[Flutterwave Webhook] Missing or invalid data in webhook body");
    return res.status(400).json({ received: false, error: "Missing or invalid data in webhook body" });
  }

  // Only process successful transactions
  if (dataStatus !== "successful") {
    console.log("[Flutterwave Webhook] Transaction not successful, skipping activation:", dataStatus);
    return res.status(200).json({ received: true, status: "skipped_non_successful" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Idempotency check - if already processed, just return success
  if (reference) {
    const existingRecord = await getTransactionRecord(supabase, reference);
    if (existingRecord && existingRecord.flutterwave_status === "success") {
      console.log("[Flutterwave Webhook] Transaction already processed, returning success");
      return res.status(200).json({ received: true, status: "already_processed" });
    }
  }

  const meta = (data.meta || {}) as Record<string, unknown>;
  let userId: string | undefined;
  let planValue: string | undefined;

  // Case-insensitive search for userId and plan keys in meta
  for (const key of Object.keys(meta)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "userid") {
      userId = typeof meta[key] === "string" ? meta[key] : undefined;
    }
    if (lowerKey === "plan") {
      planValue = typeof meta[key] === "string" ? meta[key] : undefined;
    }
  }

  const plan = normalizeSubscriptionPlan(planValue);

  console.log("[Flutterwave Webhook] Processing - userId:", userId, "plan:", plan, "meta keys:", Object.keys(meta));

  if (!userId) {
    console.error("[Flutterwave Webhook] Missing userId in webhook meta");
    return res.status(200).json({ received: true, status: "skipped_missing_userid" });
  }

  if (!plan) {
    console.error("[Flutterwave Webhook] Missing or invalid plan in webhook meta");
    return res.status(200).json({ received: true, status: "skipped_missing_plan" });
  }

  try {
    // Update transaction record
    if (reference) {
      const amount = typeof data.amount === "number" ? data.amount : 0;
      const customer = data.customer as { email?: string } | undefined;
      const customerEmail = customer?.email;
      
      console.log("[Supabase] Recording/updating transaction:", { reference, userId, plan, amount });
      
      const { error: upsertError } = await supabase
        .from("transactions")
        .upsert({
          reference,
          user_id: userId,
          plan,
          amount,
          currency: typeof data.currency === "string" ? data.currency : "NGN",
          email: customerEmail,
          status: "success",
          flutterwave_status: "success",
          verified_at: new Date().toISOString(),
          webhook_received_at: new Date().toISOString(),
        }, {
          onConflict: "reference",
        });

      if (upsertError) {
        console.error("[Supabase] Transaction upsert failed:", upsertError.message);
      } else {
        console.log("[Supabase] Transaction recorded/updated successfully");
      }
    }

    // Activate subscription
    const result = await activateSubscriptionForUser(supabase, userId, plan);
    console.log("[Flutterwave Webhook] Activated subscription for user:", userId, "plan:", plan, "ends:", result.subscriptionEnd);
  } catch (error: any) {
    console.error("[Flutterwave Webhook] Failed to activate subscription:", {
      message: error.message,
      stack: error.stack,
    });
  }

  return res.status(200).json({ received: true, status: "processed" });
}