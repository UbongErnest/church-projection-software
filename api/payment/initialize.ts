import * as dotenv from "dotenv";
dotenv.config();

import { createClient, SupabaseClient } from "@supabase/supabase-js";

type SubscriptionPlan = "monthly" | "yearly";

function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan | null {
  if (value === "monthly" || value === "yearly") {
    return value;
  }
  return null;
}

function getPlanAmount(plan: SubscriptionPlan): number {
  const amounts: Record<SubscriptionPlan, number> = { monthly: 10500, yearly: 25500 };
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
  console.log(`[Flutterwave Request] ${method} ${endpoint}`);
  
  const response = await fetch(`https://api.flutterwave.com/v3${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? JSON.stringify(data ?? {}) : undefined,
  });

  let result: any;
  try {
    result = await response.json();
  } catch (parseError) {
    const text = await response.text();
    throw new Error(`Flutterwave API returned non-JSON response (${response.status}): ${text.slice(0, 200)}`);
  }

  console.log(`[Flutterwave Response] Status: ${response.status}`);

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

async function readBody(req: any): Promise<{ email?: string; userId?: string; plan?: string; [key: string]: unknown }> {
  console.log("[Request] Parsing body, type:", typeof req.body);
  
  // If body is already parsed (Express middleware)
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  
  // If body is a stream or needs to be read
  if (req.body?.getReader || typeof req.body?.text === "function") {
    try {
      const text = await req.body.text();
      const parsed = JSON.parse(text);
      return typeof parsed === "object" ? parsed : {};
    } catch (e) {
      console.error("[Request] Failed to parse streaming body:", e);
      return {};
    }
  }
  
  // If body is a string
  if (typeof req.body === "string") {
    try {
      const parsed = JSON.parse(req.body);
      return typeof parsed === "object" ? parsed : {};
    } catch (e) {
      console.error("[Request] Failed to parse string body:", e);
      return {};
    }
  }
  
  return {};
}

export default async function handler(req: any, res: any) {
  const method = (req.method || "GET").toUpperCase();
  
  console.log("[Payment Initialize] Request received", { method });
  
  // Validate environment
  const missingEnvVars: string[] = [];
  if (!process.env.FLUTTERWAVE_SECRET_KEY) missingEnvVars.push("FLUTTERWAVE_SECRET_KEY");
  if (!process.env.SUPABASE_URL) missingEnvVars.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingEnvVars.push("SUPABASE_SERVICE_ROLE_KEY");
  
  if (missingEnvVars.length > 0) {
    console.error("[Payment Initialize] Missing environment variables:", missingEnvVars);
    return res.status(500).json({
      success: false,
      error: "Server configuration error",
      details: `Missing required environment variables: ${missingEnvVars.join(", ")}`,
    });
  }

  if (method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed", receivedMethod: method });
  }

  let body: { email?: string; userId?: string; plan?: string };
  try {
    body = await readBody(req);
    console.log("[Payment Initialize] Parsed body:", { email: body.email, userId: body.userId, plan: body.plan });
  } catch (e: any) {
    console.error("[Payment Initialize] Failed to read body:", e.message);
    return res.status(400).json({ success: false, error: "Invalid request body" });
  }

  const plan = normalizeSubscriptionPlan(body.plan);
  if (!body.email || !body.userId || !plan) {
    console.error("[Payment Initialize] Missing required fields:", { 
      hasEmail: !!body.email, 
      hasUserId: !!body.userId, 
      hasPlan: !!plan 
    });
    return res.status(400).json({ 
      success: false, 
      error: "Missing or invalid email, userId, or plan.", 
      received: body 
    });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Record transaction in database before sending to Flutterwave (for idempotency)
  const reference = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  const callbackUrl = `${resolveAppUrlFromRequest(req)}/api/payment/callback`;

  try {
    // Record transaction
    const expectedAmount = getPlanAmount(plan);
    console.log("[Supabase] Recording initial transaction:", { reference, userId: body.userId, plan, expectedAmount });
    
    const { error: recordError } = await supabase
      .from("transactions")
      .upsert({
        reference,
        user_id: body.userId,
        plan,
        amount: expectedAmount,
        currency: "NGN",
        email: body.email,
        status: "pending",
        created_at: new Date().toISOString(),
      }, {
        onConflict: "reference",
      });

    if (recordError) {
      console.error("[Supabase] Failed to record initial transaction:", recordError.message);
    } else {
      console.log("[Supabase] Initial transaction recorded");
    }

    const transaction = await initializeFlutterwaveTransaction({
      email: body.email,
      plan,
      userId: body.userId,
      callbackUrl,
    });

    // Update reference with the one returned by Flutterwave
    if (transaction.reference !== reference) {
      console.log("[Supabase] Updating transaction with Flutterwave reference");
      await supabase
        .from("transactions")
        .update({ reference: transaction.reference })
        .eq("reference", reference);
    }

    return res.status(200).json({
      success: true,
      paymentLink: transaction.link,
      reference: transaction.reference,
    });
  } catch (error: any) {
    console.error("[Payment Initialize] Error:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      error: "Failed to initialize payment",
      details: error.message || "Unknown error occurred",
    });
  }
}