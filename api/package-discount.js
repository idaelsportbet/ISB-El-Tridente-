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

async function isAdmin(authorization, secret) {
  if (!/^Bearer \S+$/.test(authorization || "")) return false;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: secret, Authorization: authorization },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) return false;
  const user = await response.json();
  const adminId = (process.env.ADMIN_USER_ID || "").trim();
  return adminId ? user.id === adminId :
    typeof user.email === "string" && user.email.toLowerCase() === ADMIN_EMAIL && Boolean(user.email_confirmed_at);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Método no permitido" });
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: "Falta configurar la conexión del panel en Vercel." });

  try {
    if (req.method === "GET") return res.status(200).json(await readSetting(secret));
    if (!(await isAdmin(req.headers.authorization, secret))) {
      return res.status(403).json({ error: "Solo la cuenta administradora puede cambiar esta promoción." });
    }
    if (typeof req.body?.active !== "boolean") return res.status(400).json({ error: "Indica si el descuento estará activo." });

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

