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

export default async function handler(req: any, res: any) {
  const signature = req.headers?.["verif-hash"] as string;
  const secret = process.env.FLUTTERWAVE_SECRET_KEY || "";

  console.log("[Flutterwave Webhook] Received webhook:", { 
    hasSignature: !!signature,
    hasSecret: !!secret,
    hasBody: !!req.body 
  });

  const { data } = req.body || {};

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
    
    // Try both userId and user_id in case Flutterwave uses different casing
    const userId = data.meta?.userId || data.meta?.user_id || 
                   (typeof data.meta === "object" ? Object.keys(data.meta).find(k => k.toLowerCase() === "userid") && data.meta[Object.keys(data.meta).find(k => k.toLowerCase() === "userid")!] : undefined);
    const plan = normalizeSubscriptionPlan(data.meta?.plan);

    console.log("[Flutterwave Webhook] Processing - userId:", userId, "plan:", plan, "all meta keys:", data.meta ? Object.keys(data.meta) : "none");

    if (userId && plan) {
      try {
        const result = await activateSubscriptionForUser(userId, plan);
        console.log("[Flutterwave Webhook] Activated subscription for user:", userId, "plan:", plan, "ends:", result.subscriptionEnd);
      } catch (error: any) {
        console.error("[Flutterwave Webhook] Failed to activate subscription:", error.message);
      }
    } else {
      console.error("[Flutterwave Webhook] Missing userId or plan in webhook meta:", JSON.stringify(data.meta));
    }
  }

  return res.status(200).json({ received: true });
}