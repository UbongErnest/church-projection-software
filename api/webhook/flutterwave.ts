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
  const durationDays = plan === "monthly" ? 30 : 365;
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

  if (signature && secret) {
    console.log("[Flutterwave Webhook] Received signature:", signature.substring(0, 20) + "...");
  }

  const { data } = req.body || {};

  console.log("[Flutterwave Webhook] Event data:", { status: data?.status, tx_ref: data?.tx_ref });

  if (data && data.status === "successful" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const userId = data.meta?.userId;
    const plan = normalizeSubscriptionPlan(data.meta?.plan);

    if (userId && plan) {
      try {
        const { subscriptionEnd } = await activateSubscriptionForUser(userId, plan);
        console.log("[Flutterwave Webhook] Activated subscription for user:", userId, "plan:", plan, "ends:", subscriptionEnd);
      } catch (error: any) {
        console.error("[Flutterwave Webhook] Failed to activate subscription:", error.message);
      }
    }
  }

  return res.status(200).json({ received: true });
}