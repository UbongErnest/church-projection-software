export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req: any, res: any) {
  // Accept both GET and POST
  console.log('[EMAIL DIAGNOSTIC] Received report:', {
    method: req.method,
    type: req.method === 'GET' ? req.query.type : req.body?.type,
    email: req.method === 'GET' ? req.query.email : req.body?.email,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
  });

  return res.status(200).json({ received: true, success: true });
}