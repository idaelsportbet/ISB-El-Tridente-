const SUPABASE_URL = "https://nfvkmxnprchvkufwvhpr.supabase.co";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "No se pudo comprobar el pago." });
  if (!/^Bearer \S+$/.test(req.headers.authorization || "")) return res.status(401).json({ error: "Inicia sesión para consultar tu pago." });
  const id = req.query?.session_id;
  if (typeof id !== "string" || !/^cs_live_[A-Za-z0-9]{1,240}$/.test(id)) return res.status(400).json({ error: "Referencia de pago inválida." });
  try {
    const auth = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: secret, Authorization: req.headers.authorization }, signal: AbortSignal.timeout(8000) });
    if (!auth.ok) return res.status(401).json({ error: "Tu sesión venció. Inicia sesión nuevamente." });
    const user = await auth.json();
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return res.status(404).json({ error: "No se encontró el pago." });
    const session = await response.json();
    if (!user.id || session.metadata?.user_id !== user.id || session.client_reference_id !== user.id) return res.status(403).json({ error: "Este pago no pertenece a tu cuenta." });
    if (!session.livemode || session.payment_status !== "paid") return res.status(200).json({ estado: "pendiente" });
    const query = new URLSearchParams({ select: "paquete", user_id: `eq.${user.id}`, paquete: `eq.${session.metadata.paquete}`, fecha_compra: `gte.${new Date(session.created * 1000).toISOString()}`, vencimiento: `gt.${new Date().toISOString()}`, limit: "1" });
    const purchases = await fetch(`${SUPABASE_URL}/rest/v1/compras?${query}`, { headers: { apikey: secret, Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(8000) });
    if (!purchases.ok) throw new Error("Compra pendiente");
    const rows = await purchases.json();
    return res.status(200).json({ estado: rows.length ? "activo" : "activando", paquete: session.metadata.paquete });
  } catch {
    return res.status(502).json({ error: "No se pudo comprobar el pago. Vuelve a intentarlo." });
  }
}
