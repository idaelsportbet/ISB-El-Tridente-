const SUPABASE_URL = "https://nfvkmxnprchvkufwvhpr.supabase.co";
const SETTINGS_URL = `${SUPABASE_URL}/rest/v1/isb_site_settings`;
const PACKAGE = "Reto de 10 días para $10K";
const FOREVER = "2099-12-31T23:59:59.999Z";
const ADMIN_EMAILS = new Set(["idaelvargasbusiness@gmail.com", "felixyaiden@icloud.com"]);

async function authenticatedAdmin(authorization, secret) {
  if (!/^Bearer \\S+$/.test(authorization || "")) return false;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: secret, Authorization: authorization },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) return false;
  const user = await response.json();
  const adminId = (process.env.ADMIN_USER_ID || "").trim();
  if (adminId && user.id === adminId) return true;
  const email = typeof user.email === "string" ? user.email.toLowerCase() : "";
  return Boolean(user.email_confirmed_at) && ADMIN_EMAILS.has(email);
}

async function readSetting(secret) {
  const query = new URLSearchParams({ select: "value", key: "eq.reto_10_dias", limit: "1" });
  const response = await fetch(`${SETTINGS_URL}?${query}`, {
    headers: { apikey: secret, Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error("No se pudo leer el estado del reto.");
  const rows = await response.json();
  return rows[0]?.value?.active !== false;
}

async function writeSetting(secret, active) {
  const query = new URLSearchParams({ key: "eq.reto_10_dias" });
  const response = await fetch(`${SETTINGS_URL}?${query}`, {
    method: "PATCH",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({ value: { active }, updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error("No se pudo guardar el estado del reto.");
  const rows = await response.json();
  if (rows.length) return;

  const create = await fetch(SETTINGS_URL, {
    method: "POST",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({ key: "reto_10_dias", value: { active }, updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(8000)
  });
  if (!create.ok) throw new Error("No se pudo crear la configuración del reto.");
}

async function updateActivePurchases(secret, vencimiento) {
  const query = new URLSearchParams({
    paquete: `eq.${PACKAGE}`,
    vencimiento: `gt.${new Date().toISOString()}`
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/compras?${query}`, {
    method: "PATCH",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ vencimiento }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("No se pudieron actualizar los accesos activos del reto.");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Método no permitido" });
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: "Falta configurar la conexión segura del reto." });

  try {
    if (req.method === "GET") {
      const isAdminView = req.query?.vista === "admin";
      if (isAdminView && !(await authenticatedAdmin(req.headers.authorization, secret))) {
        return res.status(403).json({ error: "Solo el administrador puede gestionar el reto." });
      }
      const active = await readSetting(secret);
      if (isAdminView && active) await updateActivePurchases(secret, FOREVER);
      return res.status(200).json({ active });
    }

    if (!(await authenticatedAdmin(req.headers.authorization, secret))) {
      return res.status(403).json({ error: "Solo el administrador puede cambiar el ciclo del reto." });
    }
    if (typeof req.body?.active !== "boolean") return res.status(400).json({ error: "Indica si el reto debe estar abierto o cerrado." });

    const active = req.body.active;
    await writeSetting(secret, active);
    if (!active) {
      try {
        await updateActivePurchases(secret, new Date().toISOString());
      } catch (error) {
        return res.status(503).json({ error: "El reto se cerró para nuevas compras, pero no se pudieron quitar todos los accesos. Pulsa finalizar otra vez para reintentar." });
      }
    }
    return res.status(200).json({ active });
  } catch (error) {
    console.error("Error al administrar el ciclo del reto.", error);
    return res.status(503).json({ error: error.message || "No se pudo actualizar el reto." });
  }
}
