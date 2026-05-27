import {
  RequestAuthError,
  getAuthenticatedUserProfileFromRequest,
} from "../src/server/userProfiles.ts";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
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
    return res.status(500).json({
      error: "Failed to fetch profile",
      details: error.message,
    });
  }
}
