import dotenv from "dotenv";
dotenv.config();

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

  const reference = req.query?.tx_ref || req.query?.reference;
  if (!reference || (typeof reference !== "string" && Array.isArray(reference) && reference.length === 0)) {
    return redirect(res, "/?payment=error");
  }

  const refValue = typeof reference === "string" ? reference : reference[0];
  return redirect(res, `/?payment=verify&reference=${encodeURIComponent(refValue)}`);
}
