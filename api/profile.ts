import dotenv from "dotenv";
dotenv.config();

import {
  RequestAuthError,
  getAuthenticatedUserProfileFromRequest,
} from "../src/server/userProfiles";

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
    
    // Check if it's a configuration error
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
