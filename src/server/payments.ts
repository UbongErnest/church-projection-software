import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionPlan = "monthly" | "yearly";

export interface FlutterwaveTransactionResponse {
  status: string;
  message?: string;
  data?: {
    link?: string;
    reference?: string;
    id?: string;
  };
}

export interface FlutterwaveTransaction {
  status?: string;
  amount?: number;
  currency?: string;
  tx_ref?: string;
  reference?: string;
  created_at?: string;
  customer?: {
    email?: string;
  };
  meta?: Record<string, unknown> & {
    plan?: string;
    userId?: string;
  };
}

export interface FlutterwaveVerificationResponse {
  status: string;
  message?: string;
  data?: FlutterwaveTransaction[];
}

export type PaymentVerificationResult = {
  success: boolean;
  message?: string;
  flutterwaveStatus?: string | null;
  verification?: FlutterwaveVerificationResponse | null;
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
      throw new Error("SERVER_CONFIG_ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for payment features.");
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseKey);
  }

  return supabaseAdmin;
}

function getFlutterwaveSecretKey(): string {
  const flutterwaveSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!flutterwaveSecretKey) {
    throw new Error("SERVER_CONFIG_ERROR: FLUTTERWAVE_SECRET_KEY is not configured");
  }
  return flutterwaveSecretKey;
}

export function getFlutterwaveSecretKeySafe(): string | null {
  const key = process.env.FLUTTERWAVE_SECRET_KEY || null;
  if (key && !key.startsWith("FLW")) {
    return null;
  }
  return key;
}

export function getSupabaseAdminSafe(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseUrl.includes("supabase.co")) {
    return null;
  }
  
  if (!supabaseKey || !supabaseKey.startsWith("eyJ")) {
    return null;
  }

  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    return supabaseAdmin;
  } catch {
    return null;
  }
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

async function flutterwaveRequest<TResponse>(
  endpoint: string,
  method: "GET" | "POST" = "POST",
  data?: unknown,
): Promise<TResponse> {
  const response = await fetch(`https://api.flutterwave.com/v3${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${getFlutterwaveSecretKey()}`,
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

export async function initializeFlutterwaveTransaction(args: {
  email: string;
  plan: SubscriptionPlan;
  userId: string;
  callbackUrl?: string;
}): Promise<{ reference: string; link: string }> {
  try {
    const reference = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const flutterwavePayload: Record<string, unknown> = {
      tx_ref: reference,
      amount: getPlanAmount(args.plan),
      currency: "NGN",
      customer: {
        email: args.email,
      },
      meta: {
        plan: args.plan,
        userId: args.userId,
      },
      redirect_url: args.callbackUrl,
    };

    const transaction = await flutterwaveRequest<FlutterwaveTransactionResponse>("/payments", "POST", flutterwavePayload);

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
  } catch (error: any) {
    const errorMessage = error.message || "Unknown error";
    console.error("[Flutterwave Initialize] Error:", {
      message: errorMessage,
      email: args.email,
      plan: args.plan,
      userId: args.userId,
    });
    throw error;
  }
}

export async function verifyFlutterwaveTransaction(
  reference: string,
  logPrefix: string,
  maxAttempts = 3,
  retryDelayMs = 1500,
): Promise<FlutterwaveTransaction | null> {
  let lastVerification: FlutterwaveTransaction | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await flutterwaveRequest<FlutterwaveVerificationResponse>(`/transactions?tx_ref=${reference}`, "GET");

    const transactions = response.data || [];
    const transaction = transactions[0];

    if (transaction) {
      lastVerification = transaction;
      const flutterwaveStatus = transaction.status || null;

      console.log(`${logPrefix} Attempt ${attempt}/${maxAttempts}:`, {
        status: response.status,
        message: response.message,
        flutterwaveStatus,
        reference,
      });

      if (flutterwaveStatus === "successful") {
        return transaction;
      }

      const shouldRetry =
        attempt < maxAttempts &&
        (
          flutterwaveStatus === "pending" ||
          flutterwaveStatus === "processing"
        );

      if (!shouldRetry) {
        return transaction;
      }
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
  flutterwave_status?: string;
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
  const verification = await verifyFlutterwaveTransaction(
    args.reference,
    args.logPrefix,
    maxAttempts,
    1500
  );
  const flutterwaveStatus = verification?.status || null;

  if (flutterwaveStatus !== "successful") {
    await updateTransactionStatus(args.reference, {
      flutterwave_status: flutterwaveStatus || "failed",
    });
    
    return {
      success: false as const,
      message: flutterwaveStatus ? `Transaction status: ${flutterwaveStatus}` : "Transaction not successful",
      flutterwaveStatus,
    };
  }

  const metadataPlan = normalizeSubscriptionPlan(verification?.meta?.plan);
  const resolvedPlan = metadataPlan || args.fallbackPlan || null;
  if (!resolvedPlan) {
    throw new Error("Verified transaction is missing a valid subscription plan.");
  }

  const resolvedUserId = verification?.meta?.userId || args.fallbackUserId || "";
  if (!resolvedUserId) {
    throw new Error("Verified transaction is missing a user ID.");
  }

  const expectedAmount = getPlanAmount(resolvedPlan);
  if (typeof verification?.amount === "number" && verification.amount !== expectedAmount) {
    throw new Error(`Transaction amount mismatch. Expected ${expectedAmount}, received ${verification.amount}.`);
  }

  const email = verification?.customer?.email || args.email;
  if (!email) {
    throw new Error("Verified transaction is missing a customer email.");
  }

  await updateTransactionStatus(args.reference, {
    status: "success",
    flutterwave_status: "success",
    verified_at: new Date().toISOString(),
  });

  const { subscriptionEnd } = await activateSubscriptionForUser(resolvedUserId, resolvedPlan);

  return {
    success: true as const,
    userId: resolvedUserId,
    plan: resolvedPlan,
    flutterwaveStatus,
    subscriptionEnd,
  };
}