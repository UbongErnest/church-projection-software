import * as dotenv from "dotenv";
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
  const amounts: Record<string, number> = { monthly: 10500, yearly: 25500 };
  return amounts[plan] || 10500;
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

  let result: any;
  try {
    result = await response.json();
  } catch (parseError) {
    const text = await response.text();
    throw new Error(`Flutterwave API returned non-JSON response (${response.status}): ${text.slice(0, 200)}`);
  }

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
  maxAttempts = 5,
  retryDelayMs = 2000,
): Promise<{ status?: string; meta?: { plan?: string; userId?: string; user_id?: string }; amount?: number; customer?: { email?: string } } | null> {
  let lastVerification: { status?: string; meta?: { plan?: string; userId?: string; user_id?: string }; amount?: number; customer?: { email?: string } } | null = null;

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
  const durationDays = plan === "monthly" ? 30 : 30;
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

async function readBody(req: any): Promise<{ reference?: string; plan?: string; userId?: string; [key: string]: unknown }> {
  // If body is already parsed (Express middleware)
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  
  // If body is a stream or needs to be read
  if (req.body?.getReader || typeof req.body?.text === "function") {
    try {
      const text = await req.body.text();
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
  
  // If body is a string
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  
  return {};
}

export default async function handler(req: any, res: any) {
  const method = (req.method || "GET").toUpperCase();
  
  if (!process.env.FLUTTERWAVE_SECRET_KEY) {
    return res.status(500).json({
      error: "Failed to verify payment",
      details: "FLUTTERWAVE_SECRET_KEY is not set in environment",
    });
  }
  
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
    const body = await readBody(req);
    if (!body.reference) {
      return res.status(400).json({ error: "Missing reference." });
    }

    const verification = await verifyFlutterwaveTransaction(body.reference);
    
    if (!verification) {
      return res.status(200).json({
        success: false,
        status: "not_found",
        flutterwaveStatus: null,
        message: "Transaction not found. Please wait for webhook confirmation.",
      });
    }

    const flutterwaveStatus = verification.status || null;

    if (flutterwaveStatus !== "successful") {
      // Still try to activate with the userId from body if we have one (for webhook pre-activation)
      if (body.userId && typeof body.userId === "string" && body.plan) {
        const bodyPlan = typeof body.plan === "string" ? body.plan : undefined;
        if (bodyPlan === "monthly" || bodyPlan === "yearly") {
          const fallbackPlan = normalizeSubscriptionPlan(bodyPlan);
          if (fallbackPlan) {
            try {
              await activateSubscriptionForUser(body.userId, fallbackPlan);
              return res.status(200).json({
                success: true,
                status: "active",
                flutterwaveStatus: "pre-activated",
                plan: fallbackPlan,
                message: "Subscription pre-activated via fallback",
              });
            } catch (e) {
              console.log("Fallback activation failed, continuing with verification...");
            }
          }
        }
      }
      
      return res.status(200).json({
        success: false,
        status: flutterwaveStatus || "pending",
        flutterwaveStatus,
        message: `Transaction status: ${flutterwaveStatus}`,
      });
    }

    // Case-insensitive search for user ID and plan in verification meta
    let resolvedUserId: string | undefined;
    let resolvedPlan: SubscriptionPlan | null = normalizeSubscriptionPlan(verification.meta?.plan);
    
    // Try to find user ID with case-insensitive matching
    if (verification.meta?.userId || verification.meta?.user_id) {
      resolvedUserId = verification.meta?.userId || verification.meta?.user_id;
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
      resolvedUserId = body.userId;
    }
    if (!resolvedPlan) {
      resolvedPlan = normalizeSubscriptionPlan(body.plan);
    }
    
    if (!resolvedPlan) {
      throw new Error("Verified transaction is missing a valid subscription plan.");
    }
    
    if (!resolvedUserId) {
      throw new Error("Verified transaction is missing a user ID.");
    }

    const { subscriptionEnd } = await activateSubscriptionForUser(resolvedUserId as string, resolvedPlan);

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