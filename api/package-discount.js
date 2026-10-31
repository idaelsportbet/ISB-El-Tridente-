const SUPABASE_URL = "https://nfvkmxnprchvkufwvhpr.supabase.co";
const SETTINGS_URL = `${SUPABASE_URL}/rest/v1/isb_site_settings`;
const ADMIN_EMAIL = "idaelvargasbusiness@gmail.com";

async function readSetting(secret) {
  const query = new URLSearchParams({ select: "value", key: "eq.package_discount", limit: "1" });
  const response = await fetch(`${SETTINGS_URL}?${query}`, {
    headers: { apikey: secret, Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error("No se pudo leer la configuración de descuentos.");
  const rows = await response.json();
  const value = rows[0]?.value;
  return { active: value?.active === true, percent: 30 };
}

async function readWeekendSetting(secret) {
  const query = new URLSearchParams({ select: "value", key: "eq.paquete_fin_de_semana", limit: "1" });
  const response = await fetch(`${SETTINGS_URL}?${query}`, {
    headers: { apikey: secret, Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error("No se pudo leer el estado del paquete de fin de semana.");
  const rows = await response.json();
  return { active: rows[0]?.value?.active === true };
}

async function ensureFloresidaelWeekendAccess(secret) {
  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const email = "floresidael2000@gmail.com";
  let user = null;
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("No se pudo comprobar la cuenta autorizada.");
    const data = await response.json();
    user = data.users?.find(candidate => candidate.email?.toLowerCase() === email) || null;
    if (user || !data.users?.length || data.users.length < 1000) break;
  }
  if (!user?.id || user.email?.toLowerCase() !== email) throw new Error("No se encontró la cuenta autorizada para Fin de Semana.");

  const filter = new URLSearchParams({
    user_id: `eq.${user.id}`,
    paquete: "eq.Paquete Fin de Semana",
    cantidad_pagada_dolar: "eq.0",
    nombre: "like.*(ACCESO DE CORTESÍA)"
  });
  const existing = await fetch(`${SUPABASE_URL}/rest/v1/compras?select=user_id,vencimiento&${filter}`, { headers, signal: AbortSignal.timeout(8000) });
  if (!existing.ok) throw new Error("No se pudo revisar el acceso existente.");
  const rows = await existing.json();
  if (rows.some(row => Date.parse(row.vencimiento) > Date.parse("2098-01-01T00:00:00.000Z"))) return;

  const payload = { vencimiento: "2099-12-31T23:59:59.000Z" };
  if (rows.length) {
    const update = await fetch(`${SUPABASE_URL}/rest/v1/compras?${filter}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    if (!update.ok) throw new Error("No se pudo ampliar el acceso de Floresidael.");
    return;
  }

  const now = new Date().toISOString();
  const create = await fetch(`${SUPABASE_URL}/rest/v1/compras`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify([{
      user_id: user.id,
      nombre: `${user.user_metadata?.full_name || "Cliente"} (ACCESO DE CORTESÍA)`,
      correo: email,
      paquete: "Paquete Fin de Semana",
      cantidad_pagada_dolar: 0,
      fecha_compra: now,
      vencimiento: "2099-12-31T23:59:59.000Z"
    }]),
    signal: AbortSignal.timeout(8000)
  });
  if (!create.ok) throw new Error("No se pudo activar el acceso de Floresidael.");
}

async function saveWeekendSetting(secret, active) {
  if (active) await ensureFloresidaelWeekendAccess(secret);
  const query = new URLSearchParams({ key: "eq.paquete_fin_de_semana" });
  const headers = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Prefer: "return=representation" };
  const payload = { value: { active }, updated_at: new Date().toISOString() };
  const update = await fetch(`${SETTINGS_URL}?${query}`, { method: "PATCH", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) });
  if (!update.ok) throw new Error("No se pudo guardar la activación del paquete.");
  if ((await update.json()).length) return;
  const create = await fetch(SETTINGS_URL, { method: "POST", headers, body: JSON.stringify({ key: "paquete_fin_de_semana", ...payload }), signal: AbortSignal.timeout(8000) });
  if (!create.ok) throw new Error("No se pudo crear la configuración del paquete.");
}

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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Método no permitido" });
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: "Falta configurar la conexión del panel en Vercel." });

  try {
    const weekend = req.query?.feature === "weekend";
    if (req.method === "GET") return res.status(200).json(weekend ? await readWeekendSetting(secret) : await readSetting(secret));
    if (!(await isAdmin(req.headers.authorization, secret))) {
      return res.status(403).json({ error: "Solo la cuenta administradora puede cambiar esta promoción." });
    }
    if (typeof req.body?.active !== "boolean") return res.status(400).json({ error: weekend ? "Indica si el paquete estará activo." : "Indica si el descuento estará activo." });
    if (weekend) { await saveWeekendSetting(secret, req.body.active); return res.status(200).json({ active: req.body.active }); }

    const response = await fetch(`${SETTINGS_URL}?key=eq.package_discount`, {
      method: "PATCH",
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ value: { active: req.body.active, percent: 30 }, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return res.status(502).json({ error: "No se pudo guardar el descuento. Comprueba que la configuración de promociones esté instalada." });
    const updated = await response.json();
    if (!updated.length) return res.status(503).json({ error: "Falta instalar la configuración de promociones en la base de datos." });
    return res.status(200).json({ active: req.body.active, percent: 30 });
  } catch (error) {
    console.error("package-discount error:", error);
    return res.status(502).json({ error: error.message || "No se pudo actualizar el descuento." });
  }
}

