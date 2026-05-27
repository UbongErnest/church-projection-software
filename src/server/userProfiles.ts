import { createClient, SupabaseClient } from "@supabase/supabase-js";

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

export class RequestAuthError extends Error {}

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for profile features.");
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseKey);
  }

  return supabaseAdmin;
}

function getAuthorizationHeader(req: RequestLike) {
  const header = req.headers?.authorization;
  return Array.isArray(header) ? header[0] : header || "";
}

function getBearerToken(req: RequestLike) {
  const authorizationHeader = getAuthorizationHeader(req);
  if (!authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorizationHeader.slice(7).trim();
}

export async function getAuthenticatedUserIdFromRequest(req: RequestLike) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    throw new RequestAuthError("Missing bearer token.");
  }

  const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken);
  if (error || !data.user) {
    throw new RequestAuthError(error?.message || "Unable to authenticate user.");
  }

  return data.user.id;
}

export async function getNormalizedUserProfileById(userId: string) {
  const { data: profile, error } = await getSupabaseAdmin()
    .from("users")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch user profile: ${error.message}`);
  }

  if (!profile) {
    return null;
  }

  const subscriptionEnd = profile.subscription_end ? new Date(profile.subscription_end) : null;
  const hasExpiredSubscription =
    subscriptionEnd &&
    !Number.isNaN(subscriptionEnd.getTime()) &&
    subscriptionEnd < new Date() &&
    profile.subscription_plan !== "free";

  if (!hasExpiredSubscription) {
    return profile;
  }

  const expiredPayload = {
    subscription_plan: "free",
    subscription_status: "expired",
  };

  const { data: updatedProfile, error: updateError } = await getSupabaseAdmin()
    .from("users")
    .update(expiredPayload)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(`Failed to expire user subscription: ${updateError.message}`);
  }

  return updatedProfile || { ...profile, ...expiredPayload };
}

export async function getAuthenticatedUserProfileFromRequest(req: RequestLike) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  const profile = await getNormalizedUserProfileById(userId);

  return {
    userId,
    profile,
  };
}
