import {
  initializePaystackTransaction,
  normalizeSubscriptionPlan,
  resolveAppUrlFromRequest,
  getPaystackSecretKeySafe,
} from "../../src/server/payments";

function readJsonBody(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secretMissing = !getPaystackSecretKeySafe();
  if (secretMissing) {
    console.error("[API Initialize] Configuration error: PAYSTACK_SECRET_KEY missing");
    return res.status(500).json({
      error: "Failed to initialize payment",
      details: "Server configuration error: PAYSTACK_SECRET_KEY is not set",
    });
  }

  try {
    const body = readJsonBody(req.body) as { email?: string; plan?: string; userId?: string };

    const plan = normalizeSubscriptionPlan(body.plan);
    if (!body.email || !body.userId || !plan) {
      return res.status(400).json({ error: "Missing or invalid email, userId, or plan." });
    }

    const callbackUrl = `${resolveAppUrlFromRequest(req)}/api/payment/callback`;
    const transaction = await initializePaystackTransaction({
      email: body.email,
      plan,
      userId: body.userId,
      callbackUrl,
    });

    console.log("[API Initialize] Response:", {
      success: true,
      authorizationUrl: transaction.authorizationUrl,
      reference: transaction.reference,
    });

    return res.status(200).json({
      success: true,
      authorizationUrl: transaction.authorizationUrl,
      accessCode: transaction.accessCode,
      reference: transaction.reference,
    });
  } catch (error: any) {
    const errorMessage = error.message || "Unknown error occurred";
    console.error("Paystack initialize error:", errorMessage);

    return res.status(500).json({
      error: "Failed to initialize payment",
      details: errorMessage,
    });
  }
}