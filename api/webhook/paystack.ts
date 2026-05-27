import { normalizeSubscriptionPlan, activateSubscriptionForUser } from "../../src/server/payments.ts";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const signature = req.headers["x-paystack-signature"];
  const secret = process.env.PAYSTACK_SECRET_KEY || "";

  if (signature && secret) {
    console.log("[Paystack Webhook] Received signature:", (signature as string).substring(0, 20) + "...");
  }

  let body = "";
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve());
    req.on("error", (err: Error) => reject(err));
  });

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const { data } = payload || {};
  console.log("[Paystack Webhook] Event data:", { status: data?.status, reference: data?.reference });

  if (data && data.status === "success" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const userId = data.metadata?.userId;
    const plan = normalizeSubscriptionPlan(data.metadata?.plan);

    if (userId && plan) {
      try {
        await activateSubscriptionForUser(userId, plan);
        console.log("[Paystack Webhook] Activated subscription for user:", userId, "plan:", plan);
      } catch (err: any) {
        console.error("[Paystack Webhook] Failed to activate subscription:", err.message);
      }
    }
  }

  return res.status(200).json({ received: true });
}