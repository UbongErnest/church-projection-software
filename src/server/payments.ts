import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionPlan = "monthly" | "yearly";

export interface PaystackReference {
  message: string;
  reference: string;
  status: string;
  transactionReference: string;
  trace: string;
}

type PaystackInitializeResponse = {
  status: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
};

export type PaystackVerificationResponse = {
  status: boolean;
  message?: string;
  data?: {
    status?: string;
    amount?: number;
    currency?: string;
    reference?: string;
    paid_at?: string;
    email?: string;
    metadata?: Record<string, unknown> & {
      plan?: string;
      userId?: string;
    };
  };
};

export type PaymentVerificationResult = {
  success: boolean;
  message?: string;
  paystackStatus?: string | null;
  verification?: PaystackVerificationResponse | null;
  userId?: string;
  plan?: SubscriptionPlan | null;
  subscriptionEnd?: string;
};

export const PLAN_CONFIG: Record<SubscriptionPlan, { amount: number; durationDays: number }> = {
  monthly: {
    amount: 10000,
    durationDays: 30,
  },
  yearly: {
    amount: 25000,
    durationDays: 365,
  },
};

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for payment features.");
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseKey);
  }

  return supabaseAdmin;
}

function getPaystackSecretKey(): string {
  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }
  return paystackSecretKey;
}

export function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan | null {
  if (value === "monthly" || value === "yearly") {
    return value;
  }
  return null;
}

export function getPlanAmount(plan: SubscriptionPlan): number {
  return PLAN_CONFIG[plan].amount;
}

export function calculateSubscriptionEnd(plan: SubscriptionPlan): string {
  const durationDays = PLAN_CONFIG[plan].durationDays;
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

export function resolveAppUrlFromRequest(req: {
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

async function paystackRequest<TResponse>(
  endpoint: string,
  method: "GET" | "POST" = "POST",
  data?: unknown,
): Promise<TResponse> {
  const response = await fetch(`https://api.paystack.co${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${getPaystackSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? JSON.stringify(data ?? {}) : undefined,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`Paystack API error: ${result.message || response.statusText}`);
  }

  return result as TResponse;
}

export async function initializePaystackTransaction(args: {
  email: string;
  plan: SubscriptionPlan;
  userId: string;
  callbackUrl?: string;
}): Promise<{ reference: string; authorizationUrl: string; accessCode: string }> {
  const reference = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const paystackPayload: Record<string, unknown> = {
      email: args.email,
      amount: getPlanAmount(args.plan) * 100,
      reference,
      metadata: {
        plan: args.plan,
        userId: args.userId,
      },
    };

    if (args.callbackUrl) {
      paystackPayload.callback_url = args.callbackUrl;
    }

    const transaction = await paystackRequest<PaystackInitializeResponse>("/transaction/initialize", "POST", paystackPayload);

    if (!transaction.status) {
      throw new Error(transaction.message || "Paystack transaction initialization failed");
    }

    const authorizationUrl = transaction.data?.authorization_url;
    const accessCode = transaction.data?.access_code || "";
    const returnedReference = transaction.data?.reference;

    if (!returnedReference) {
      throw new Error("Paystack did not return a transaction reference");
    }

    console.log("[Paystack Initialize] Transaction initialized:", {
      reference: returnedReference,
      authorizationUrl,
      accessCode: accessCode ? "***" : "(none)",
      userId: args.userId,
      plan: args.plan,
      callbackUrl: args.callbackUrl,
    });

    return {
      reference: returnedReference,
      authorizationUrl: authorizationUrl || "",
      accessCode,
    };
  } catch (error: any) {
    console.error("[Paystack Initialize] Error:", {
      message: error.message,
      email: args.email,
      plan: args.plan,
      userId: args.userId,
    });
    throw error;
  }
}

export async function verifyPaystackTransaction(
  reference: string,
  logPrefix: string,
  maxAttempts = 3,
  retryDelayMs = 1500,
): Promise<PaystackVerificationResponse | null> {
  let lastVerification: PaystackVerificationResponse | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastVerification = await paystackRequest<PaystackVerificationResponse>(`/transaction/verify/${reference}`, "GET");
    const paystackStatus = lastVerification.data?.status || null;

    console.log(`${logPrefix} Attempt ${attempt}/${maxAttempts}:`, {
      status: lastVerification.status,
      message: lastVerification.message,
      paystackStatus,
      reference,
    });

    if (paystackStatus === "success") {
      return lastVerification;
    }

    const shouldRetry =
      attempt < maxAttempts &&
      (
        !lastVerification.status ||
        ["pending", "ongoing", "processing", "queued", "failed", "abandoned"].includes(paystackStatus || "") ||
        lastVerification.message?.toLowerCase().includes("api error")
      );

    if (!shouldRetry) {
      return lastVerification;
    }

    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
  }

  return lastVerification;
}

export async function recordTransaction(transaction: {
  reference: string;
  userId: string;
  plan: SubscriptionPlan;
  amount: number;
  currency?: string;
  email: string;
}) {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from("transactions")
    .upsert({
      reference: transaction.reference,
      user_id: transaction.userId,
      plan: transaction.plan,
      amount: transaction.amount,
      currency: transaction.currency || "NGN",
      email: transaction.email,
      status: "pending",
      created_at: new Date().toISOString(),
    }, {
      onConflict: "reference",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error("Failed to record transaction:", error);
  }
}

export async function updateTransactionStatus(reference: string, updates: {
  status?: string;
  paystack_status?: string;
  verified_at?: string;
  webhook_received_at?: string;
}) {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from("transactions")
    .update(updates)
    .eq("reference", reference);

  if (error) {
    console.error("Failed to update transaction status:", error);
  }
}

export async function activateSubscriptionForUser(userId: string, plan: SubscriptionPlan) {
  const subscriptionEnd = calculateSubscriptionEnd(plan);
  const supabase = getSupabaseAdmin();
  
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

export async function verifyAndActivatePayment(args: {
  reference: string;
  fallbackPlan?: SubscriptionPlan | null;
  fallbackUserId?: string;
  logPrefix: string;
  email?: string;
}): Promise<PaymentVerificationResult> {
  const maxAttempts = 5;
  const verification = await verifyPaystackTransaction(
    args.reference,
    args.logPrefix,
    maxAttempts,
    1500
  );
  const paystackStatus = verification?.data?.status || null;

  if (paystackStatus !== "success") {
    await updateTransactionStatus(args.reference, {
      paystack_status: paystackStatus || "failed",
    });
    
    return {
      success: false as const,
      message: verification?.message || "Transaction not successful",
      paystackStatus,
      verification,
    };
  }

  const metadataPlan = normalizeSubscriptionPlan(verification?.data?.metadata?.plan);
  const resolvedPlan = metadataPlan || args.fallbackPlan || null;
  if (!resolvedPlan) {
    throw new Error("Verified transaction is missing a valid subscription plan.");
  }

  const resolvedUserId = verification?.data?.metadata?.userId || args.fallbackUserId || "";
  if (!resolvedUserId) {
    throw new Error("Verified transaction is missing a user ID.");
  }

  const expectedAmount = getPlanAmount(resolvedPlan) * 100;
  if (typeof verification?.data?.amount === "number" && verification.data.amount !== expectedAmount) {
    throw new Error(`Transaction amount mismatch. Expected ${expectedAmount}, received ${verification.data.amount}.`);
  }

  const email = verification?.data?.email || args.email;
  if (!email) {
    throw new Error("Verified transaction is missing a customer email.");
  }

  await updateTransactionStatus(args.reference, {
    status: "success",
    paystack_status: "success",
    verified_at: new Date().toISOString(),
  });

  const { subscriptionEnd } = await activateSubscriptionForUser(resolvedUserId, resolvedPlan);

  return {
    success: true as const,
    userId: resolvedUserId,
    plan: resolvedPlan,
    paystackStatus,
    subscriptionEnd,
    verification,
  };
}