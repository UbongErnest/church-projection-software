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

async function activateSubscriptionForUser(userId: string, plan: SubscriptionPlan) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase not configured");
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const durationDays = plan === "monthly" ? 30 : 30;
  const subscriptionEnd = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

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

function parseRequestBody(body: unknown): { data?: { status?: string; tx_ref?: string; meta?: Record<string, unknown> } } {
  if (body && typeof body === "object") {
    return body as { data?: { status?: string; tx_ref?: string; meta?: Record<string, unknown> } };
  }
  return {};
}

export default async function handler(req: any, res: any) {
  const signature = req.headers?.["verif-hash"] as string;
  const secret = process.env.FLUTTERWAVE_SECRET_KEY || "";

  const body = parseRequestBody(req.body);
  const { data } = body;

  console.log("[Flutterwave Webhook] Event data:", { status: data?.status, tx_ref: data?.tx_ref, meta: data?.meta });

  if (!data || !data.status) {
    console.error("[Flutterwave Webhook] Missing data in webhook body");
    return res.status(400).json({ received: false, error: "Missing data" });
  }

  if (data.status === "successful") {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[Flutterwave Webhook] Supabase credentials not configured");
      return res.status(500).json({ received: false, error: "Server configuration error" });
    }
    
    const meta = data.meta || {};
    let userId: string | undefined;
    let planValue: string | undefined;
    
    // Case-insensitive search for userId and plan keys
    for (const key of Object.keys(meta)) {
      if (key.toLowerCase() === "userid") {
        userId = typeof meta[key] === "string" ? meta[key] : undefined;
      }
      if (key.toLowerCase() === "plan") {
        planValue = typeof meta[key] === "string" ? meta[key] : undefined;
      }
    }
    
    const plan = normalizeSubscriptionPlan(planValue);

    console.log("[Flutterwave Webhook] Processing - userId:", userId, "plan:", plan, "all meta keys:", Object.keys(meta));

    if (userId && plan) {
      try {
        const result = await activateSubscriptionForUser(userId, plan);
        console.log("[Flutterwave Webhook] Activated subscription for user:", userId, "plan:", plan, "ends:", result.subscriptionEnd);
      } catch (error: any) {
        console.error("[Flutterwave Webhook] Failed to activate subscription:", error.message);
      }
    } else {
      console.error("[Flutterwave Webhook] Missing userId or plan in webhook meta:", JSON.stringify(meta));
    }
  }

  return res.status(200).json({ received: true });
}