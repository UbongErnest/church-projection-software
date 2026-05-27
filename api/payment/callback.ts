import {
  verifyAndActivatePayment,
} from "../../src/server/payments.ts";

function redirect(res: any, location: string) {
  if (typeof res.redirect === "function") {
    return res.redirect(302, location);
  }

  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const reference = req.query?.reference || req.query?.trxref;
  if (!reference || typeof reference !== "string") {
    return redirect(res, "/?payment=error");
  }

  try {
    const result = await verifyAndActivatePayment({
      reference,
      logPrefix: "[Paystack Callback]",
    });

    if (!result.success) {
      const status = encodeURIComponent(result.paystackStatus || "failed");
      return redirect(res, `/?payment=failed&status=${status}&reference=${encodeURIComponent(reference)}`);
    }

    const plan = encodeURIComponent(result.plan);
    const encodedReference = encodeURIComponent(reference);
    return redirect(res, `/?payment=success&plan=${plan}&reference=${encodedReference}`);
  } catch (error: any) {
    console.error("Paystack callback error:", error);
    return redirect(res, "/?payment=error");
  }
}
