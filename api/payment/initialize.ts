import {
  initializePaystackTransaction,
  normalizeSubscriptionPlan,
  resolveAppUrlFromRequest,
} from "../../src/server/payments";

function readJsonBody(body: unknown) {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body && typeof body === "object" ? body : {};
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = readJsonBody(req.body) as {
    email?: string;
    plan?: string;
    userId?: string;
  };

  const plan = normalizeSubscriptionPlan(body.plan);
  if (!body.email || !body.userId || !plan) {
    return res.status(400).json({ error: "Missing or invalid email, userId, or plan." });
  }

  try {
    const callbackUrl = `${resolveAppUrlFromRequest(req)}/api/payment/callback`;
    const transaction = await initializePaystackTransaction({
      email: body.email,
      plan,
      userId: body.userId,
      callbackUrl,
    });

    return res.status(200).json({
      success: true,
      authorizationUrl: transaction.authorizationUrl,
      accessCode: transaction.accessCode,
      reference: transaction.reference,
    });
  } catch (error: any) {
    console.error("Paystack initialize error:", error);
    return res.status(500).json({
      error: "Failed to initialize payment",
      details: error.message,
    });
  }
}
