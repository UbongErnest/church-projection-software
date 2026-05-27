import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionPlan = "monthly" | "yearly";

type PaystackInitializeResponse = {
  status: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
};

type PaystackVerificationResponse = {
  status: boolean;
  message?: string;
  data?: {
    status?: string;
    amount?: number;
    currency?: string;
    reference?: string;
    paid_at?: string;
    metadata?: {
      plan?: string;
      userId?: string;
    };
  };
};

const PLAN_CONFIG: Record<SubscriptionPlan, { amount: number; durationDays: number }> = {
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

function getPaystackSecretKey() {
  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }
  return paystackSecretKey;
}

export function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan | null {
  return value === "monthly" || value === "yearly" ? value : null;
}

export function getPlanAmount(plan: SubscriptionPlan) {
  return PLAN_CONFIG[plan].amount;
}

export function calculateSubscriptionEnd(plan: SubscriptionPlan) {
  const durationDays = PLAN_CONFIG[plan].durationDays;
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

export function resolveAppUrlFromRequest(req: {
  headers?: Record<string, string | string[] | undefined>;
  protocol?: string;
  get?: (name: string) => string | undefined;
}) {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, "");
  }

  const forwardedProtoHeader = req.headers?.["x-forwarded-proto"];
  const hostHeader = req.headers?.host;
  const forwardedProto = Array.isArray(forwardedProtoHeader) ? forwardedProtoHeader[0] : forwardedProtoHeader;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const protocol = forwardedProto || req.protocol || "http";

  // Fallback for serverless environments
  if (!host) {
    return "http://localhost:3000";
  }

  return `${protocol}://${host}`;
}

async function paystackRequest<TResponse>(
  endpoint: string,
  method: "GET" | "POST" = "POST",
  data?: unknown
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
  callbackUrl: string;
}) {
  const transaction = await paystackRequest<PaystackInitializeResponse>("/transaction/initialize", "POST", {
    email: args.email,
    amount: getPlanAmount(args.plan) * 100,
    callback_url: args.callbackUrl,
    metadata: {
      plan: args.plan,
      userId: args.userId,
    },
  });

  if (!transaction.status || !transaction.data?.authorization_url || !transaction.data.reference) {
    throw new Error(transaction.message || "Failed to initialize payment");
  }

  return {
    authorizationUrl: transaction.data.authorization_url,
    accessCode: transaction.data.access_code || "",
    reference: transaction.data.reference,
  };
}

export async function verifyPaystackTransaction(
  reference: string,
  logPrefix: string,
  maxAttempts = 3,
  retryDelayMs = 1500
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

export async function activateSubscriptionForUser(userId: string, plan: SubscriptionPlan) {
  const subscriptionEnd = calculateSubscriptionEnd(plan);
  const { error } = await getSupabaseAdmin()
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
}) {
  const maxAttempts = 3;
  const verification = await verifyPaystackTransaction(
    args.reference,
    args.logPrefix,
    maxAttempts,
    1500
  );
  const paystackStatus = verification?.data?.status || null;

  if (paystackStatus !== "success") {
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