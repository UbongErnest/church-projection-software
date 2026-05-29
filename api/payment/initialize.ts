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

function getPlanAmount(plan: SubscriptionPlan): number {
  const amounts: Record<SubscriptionPlan, number> = { monthly: 10000, yearly: 25000 };
  return amounts[plan];
}

function resolveAppUrlFromRequest(req: {
  headers?: Record<string, string | string[] | undefined>;
  protocol?: string;
}): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, "");
  }

  const forwardedProtoHeader = req.headers?.["x-forwarded-proto"];
  const hostHeader = req.headers?.host;
  const forwardedProto = Array.isArray(forwardedProtoHeader) ? forwardedProtoHeader[0] : forwardedProtoHeader;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const protocol = forwardedProto || req.protocol || "http";

  if (!host) {
    return "http://localhost:3000";
  }

  return `${protocol}://${host}`;
}

async function flutterwaveRequest<TResponse>(
  endpoint: string,
  method: "GET" | "POST" = "POST",
  data?: unknown,
): Promise<TResponse> {
  const response = await fetch(`https://api.flutterwave.com/v3${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? JSON.stringify(data ?? {}) : undefined,
  });

  const result = await response.json();

  if (!response.ok) {
    const errorMsg = result.message || result.error || JSON.stringify(result);
    throw new Error(`Flutterwave API error (${response.status}): ${errorMsg}`);
  }

  return result as TResponse;
}

async function initializeFlutterwaveTransaction(args: {
  email: string;
  plan: SubscriptionPlan;
  userId: string;
  callbackUrl?: string;
}): Promise<{ reference: string; link: string }> {
  const reference = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const flutterwavePayload = {
    tx_ref: reference,
    amount: getPlanAmount(args.plan),
    currency: "NGN",
    payment_options: "card, ussd, mobilemoney",
    customer: {
      email: args.email,
      phone_number: "08000000000",
      name: args.email.split("@")[0] || "User",
    },
    meta: {
      plan: args.plan,
      userId: args.userId,
    },
    redirect_url: args.callbackUrl,
  };

  const transaction = await flutterwaveRequest<{ status: string; message?: string; data?: { link?: string; reference?: string } }>("/payments", "POST", flutterwavePayload);

  if (transaction.status !== "success") {
    throw new Error(transaction.message || "Flutterwave transaction initialization failed");
  }

  const link = transaction.data?.link;
  const returnedReference = transaction.data?.reference || reference;

  if (!link) {
    throw new Error("Flutterwave did not return a payment link");
  }

  console.log("[Flutterwave Initialize] Transaction initialized:", {
    reference: returnedReference,
    link,
    userId: args.userId,
    plan: args.plan,
  });

  return {
    reference: returnedReference,
    link,
  };
}

export default async function handler(req: any, res: any) {
  const method = (req.method || "GET").toUpperCase();
  
  if (!process.env.FLUTTERWAVE_SECRET_KEY) {
    return res.status(500).json({
      error: "Failed to initialize payment",
      details: "FLUTTERWAVE_SECRET_KEY is not set in environment",
    });
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      error: "Failed to initialize payment",
      details: "SUPABASE_SERVICE_ROLE_KEY is not set in environment",
    });
  }

  if (method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", receivedMethod: method });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const plan = normalizeSubscriptionPlan(body.plan);
    if (!body.email || !body.userId || !plan) {
      return res.status(400).json({ error: "Missing or invalid email, userId, or plan.", received: body });
    }

    const callbackUrl = `${resolveAppUrlFromRequest(req)}/api/payment/callback`;
    const transaction = await initializeFlutterwaveTransaction({
      email: body.email,
      plan,
      userId: body.userId,
      callbackUrl,
    });

    return res.status(200).json({
      success: true,
      paymentLink: transaction.link,
      reference: transaction.reference,
    });
  } catch (error: any) {
    console.error("[API Initialize] Error:", error);
    return res.status(500).json({
      error: "Failed to initialize payment",
      details: error.message || "Unknown error occurred",
    });
  }
}