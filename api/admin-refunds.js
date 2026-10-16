const SUPABASE_URL = "https://nfvkmxnprchvkufwvhpr.supabase.co";
const ADMIN_EMAIL = "idaelvargasbusiness@gmail.com";
const PAQUETES_REEMBOLSABLES = ["Premium Diario", "Exclusiva Diaria"];

async function isAdmin(authorization, secret) {
  if (!/^Bearer \S+$/.test(authorization || "")) return false;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: secret, Authorization: authorization },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) return false;
  const user = await response.json();
  const adminId = (process.env.ADMIN_USER_ID || "").trim();
  const correo = typeof user.email === "string" ? user.email.toLowerCase() : "";
  const correoAutorizado = Boolean(user.email_confirmed_at) &&
    [ADMIN_EMAIL, "felixyaiden@icloud.com"].includes(correo);
  return (adminId && user.id === adminId) || correoAutorizado;
}

function centralDayBounds(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "")) return null;
  const [year, month, date] = day.split("-").map(Number);
  const base = Date.UTC(year, month - 1, date);
  if (new Date(base).toISOString().slice(0, 10) !== day) return null;
  const midnightUtc = utc => {
    const hour = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(utc)).find(item => item.type === "hour")?.value);
    if (!Number.isFinite(hour)) throw new Error("No se pudo calcular la fecha Central.");
    return new Date(utc - hour * 60 * 60 * 1000);
  };
  const next = Date.UTC(year, month - 1, date + 1);
  return { start: midnightUtc(base + 6 * 60 * 60 * 1000), end: midnightUtc(next + 6 * 60 * 60 * 1000) };
}

async function supabaseRequest(path, secret, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(8000)
  });
}

async function stripeRequest(path, method = "GET", params, idempotencyKey) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    ...(params ? { body: params.toString() } : {}),
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json();
  return { response, data };
}

async function buscarSesionCompra(compra) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const fecha = Date.parse(compra.fecha_compra);
  const montoCentavos = Math.round(Number(compra.cantidad_pagada_dolar) * 100);
  if (!Number.isFinite(fecha) || !Number.isInteger(montoCentavos) || montoCentavos <= 0) return null;
  const segundoCompra = Math.floor(fecha / 1000);
  let cursor = null;
  const candidatas = [];

  for (let pagina = 0; pagina < 5; pagina++) {
    const query = new URLSearchParams({
      "created[gte]": String(segundoCompra - 21600),
      "created[lte]": String(segundoCompra + 21600),
      status: "complete",
      limit: "100"
    });
    if (cursor) query.set("starting_after", cursor);
    const { response, data } = await stripeRequest(`checkout/sessions?${query}`);
    if (!response.ok) throw new Error("Stripe no pudo localizar el pago de esta compra.");
    for (const session of data.data || []) {
      const email = String(session.customer_details?.email || session.customer_email || session.metadata?.email || "").toLowerCase();
      if (
        session.payment_status === "paid" &&
        session.mode === "payment" &&
        session.client_reference_id === compra.user_id &&
        session.metadata?.user_id === compra.user_id &&
        session.metadata?.paquete === compra.paquete &&
        email === String(compra.correo || "").toLowerCase() &&
        session.currency === "usd" &&
        session.amount_total === montoCentavos &&
        typeof session.payment_intent === "string"
      ) candidatas.push(session);
    }
    if (!data.has_more || !(data.data || []).length) break;
    cursor = data.data[data.data.length - 1].id;
    if (pagina === 4) throw new Error("Hay demasiados pagos recientes para identificar este con seguridad.");
  }

  candidatas.sort((a, b) => Math.abs(a.created - segundoCompra) - Math.abs(b.created - segundoCompra));
  if (!candidatas.length || Math.abs(candidatas[0].created - segundoCompra) > 21600) return null;
  if (candidatas.length > 1 && Math.abs(Math.abs(candidatas[1].created - segundoCompra) - Math.abs(candidatas[0].created - segundoCompra)) < 60) {
    throw new Error("Hay más de un pago que coincide. Revisa la compra en Stripe antes de reembolsar.");
  }
  return candidatas[0];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Método no permitido" });
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Falta configurar la conexión segura de pagos." });
  try {
    if (!(await isAdmin(req.headers.authorization, secret))) return res.status(403).json({ error: "Solo la cuenta administradora puede gestionar reembolsos." });

    if (req.method === "GET") {
      const paquete = String(req.query?.paquete || "");
      const fecha = String(req.query?.fecha || "");
      const bounds = centralDayBounds(fecha);
      if (!PAQUETES_REEMBOLSABLES.includes(paquete)) return res.status(400).json({ error: "Solo se permiten Premium Diario y Exclusiva Diaria." });
      if (!bounds) return res.status(400).json({ error: "Selecciona una fecha válida." });
      const query = new URLSearchParams({
        select: "id,user_id,nombre,correo,paquete,cantidad_pagada_dolar,fecha_compra,vencimiento",
        paquete: `eq.${paquete}`,
        order: "fecha_compra.asc",
        limit: "500",
        and: `(fecha_compra.gte.${bounds.start.toISOString()},fecha_compra.lt.${bounds.end.toISOString()})`
      });
      const response = await supabaseRequest(`compras?${query}`, secret);
      if (!response.ok) return res.status(502).json({ error: "No se pudieron cargar las compras recientes." });
      return res.status(200).json({ paquete, compras: await response.json() });
    }

    const purchaseId = String(req.body?.purchase_id || "");
    const paquete = String(req.body?.paquete || "");
    const fecha = String(req.body?.fecha || "");
    const bounds = centralDayBounds(fecha);
    if (!/^(?:[0-9]{1,18}|[0-9a-f]{8}-[0-9a-f-]{27})$/i.test(purchaseId) || !PAQUETES_REEMBOLSABLES.includes(paquete) || !bounds) {
      return res.status(400).json({ error: "Selecciona una compra válida de Premium Diario o Exclusiva Diaria y su fecha." });
    }
    const query = new URLSearchParams({
      select: "id,user_id,nombre,correo,paquete,cantidad_pagada_dolar,fecha_compra",
      id: `eq.${purchaseId}`,
      paquete: `eq.${paquete}`,
      limit: "1"
    });
    const purchaseResponse = await supabaseRequest(`compras?${query}`, secret);
    if (!purchaseResponse.ok) return res.status(502).json({ error: "No se pudo comprobar la compra seleccionada." });
    const purchases = await purchaseResponse.json();
    const compra = purchases[0];
    if (!compra?.user_id || !compra.correo || !compra.fecha_compra) return res.status(404).json({ error: "No se encontró esa compra." });
    const fechaCompra = Date.parse(compra.fecha_compra);
    if (!Number.isFinite(fechaCompra) || fechaCompra < bounds.start.getTime() || fechaCompra >= bounds.end.getTime()) {
      return res.status(400).json({ error: "La compra no pertenece al paquete y fecha seleccionados." });
    }

    const session = await buscarSesionCompra(compra);
    if (!session) return res.status(409).json({ error: "No encontré un pago de Stripe que coincida exactamente con esta compra. No se envió ningún reembolso." });

    const paymentIntentUrl = new URL(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(session.payment_intent)}`);
    paymentIntentUrl.searchParams.set("expand[]", "latest_charge");
    const intentResult = await stripeRequest(paymentIntentUrl.pathname + paymentIntentUrl.search);
    const intent = intentResult.data;
    const montoCentavos = Math.round(Number(compra.cantidad_pagada_dolar) * 100);
    if (!intentResult.response.ok || intent.status !== "succeeded" || intent.amount_received !== montoCentavos || intent.currency !== "usd") {
      return res.status(409).json({ error: "El pago ya no coincide con el importe de la compra; no se reembolsó." });
    }
    const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    if (!charge || Number(charge.amount_refunded) > 0) {
      return res.status(409).json({ error: "Este pago ya tiene un reembolso o no se pudo verificar. Compruébalo en Stripe." });
    }

    const refundParams = new URLSearchParams({
      payment_intent: intent.id,
      reason: "requested_by_customer",
      "metadata[purchase_id]": purchaseId,
      "metadata[package]": paquete,
      "metadata[trigger]": "admin_confirmed_lost_pick"
    });
    const refundResult = await stripeRequest("refunds", "POST", refundParams, `isb-package-refund-${purchaseId}`);
    if (!refundResult.response.ok) return res.status(502).json({ error: refundResult.data?.error?.message || "Stripe no pudo procesar el reembolso." });

    const expiration = new URLSearchParams({ id: `eq.${purchaseId}`, paquete: `eq.${paquete}` });
    const revokeResponse = await supabaseRequest(`compras?${expiration}`, secret, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ vencimiento: new Date().toISOString() })
    });
    return res.status(200).json({
      refund_id: refundResult.data.id,
      refund_status: refundResult.data.status,
      amount_cents: refundResult.data.amount,
      access_revoked: revokeResponse.ok
    });
  } catch (error) {
    return res.status(502).json({ error: error.message || "No se pudo completar el reembolso." });
  }
}
