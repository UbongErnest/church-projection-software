import {
  normalizeSubscriptionPlan,
  verifyAndActivatePayment,
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
    reference?: string;
    userId?: string;
    plan?: string;
  };

  if (!body.reference) {
    return res.status(400).json({ error: "Missing reference." });
  }

  try {
    const result = await verifyAndActivatePayment({
      reference: body.reference,
      fallbackPlan: normalizeSubscriptionPlan(body.plan),
      fallbackUserId: body.userId,
      logPrefix: "[Paystack Verify]",
    });

    if (!result.success) {
      return res.status(200).json({
        success: false,
        status: result.paystackStatus || "pending",
        paystackStatus: result.paystackStatus,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      status: "active",
      paystackStatus: result.paystackStatus,
      plan: result.plan,
      subscriptionEnd: result.subscriptionEnd,
      reference: body.reference,
    });
  } catch (error: any) {
    console.error("Paystack verify error:", error);
    return res.status(500).json({
      error: "Failed to verify payment",
      details: error.message,
    });
  }
}
