import dotenv from "dotenv";
dotenv.config();

import { createClient, SupabaseClient } from "@supabase/supabase-js";

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

class RequestAuthError extends Error {}

function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SERVER_CONFIG_ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  return createClient(supabaseUrl, supabaseKey);
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

async function getAuthenticatedUserIdFromRequest(req: RequestLike) {
  const client = getSupabaseAdmin();
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    throw new RequestAuthError("Missing bearer token.");
  }

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new RequestAuthError(error?.message || "Unable to authenticate user.");
  }

  return data.user.id;
}

async function getNormalizedUserProfileById(userId: string) {
  const client = getSupabaseAdmin();
  const { data: profile, error } = await client
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

  return profile;
}

async function getAuthenticatedUserProfileFromRequest(req: RequestLike) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  const profile = await getNormalizedUserProfileById(userId);

  return {
    userId,
    profile,
  };
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { profile } = await getAuthenticatedUserProfileFromRequest(req);
    return res.status(200).json({ profile });
  } catch (error: any) {
    if (error instanceof RequestAuthError) {
      return res.status(401).json({
        error: "Unauthorized",
        details: error.message,
      });
    }

    console.error("Profile fetch error:", error);
    
    if (error.message?.includes("SUPABASE") || error.message?.includes("environment")) {
      return res.status(500).json({
        error: "Configuration error",
        details: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured on the server.",
      });
    }
    
    return res.status(500).json({
      error: "Failed to fetch profile",
      details: error.message,
    });
  }
}