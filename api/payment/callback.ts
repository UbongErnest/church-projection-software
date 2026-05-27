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

  const reference = req.query?.reference || req.query?.trxref;
  if (!reference || typeof reference !== "string") {
    return redirect(res, "/?payment=error");
  }

  return redirect(res, `/?payment=verify&reference=${encodeURIComponent(reference)}`);
}
