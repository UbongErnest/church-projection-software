import dotenv from "dotenv";
dotenv.config();

import { normalizeSubscriptionPlan, activateSubscriptionForUser } from "@/server/payments";

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