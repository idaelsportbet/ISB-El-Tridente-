const SUPABASE_URL = "https://nfvkmxnprchvkufwvhpr.supabase.co";
const PAQUETES = ["Premium Diario", "Premium Semanal", "Exclusiva Diaria", "Exclusiva Semanal", "Pack Mensual", "Económica"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Método no permitido" });
  const secret = process.env.SUPABASE_SECRET_KEY;
  const adminId = (process.env.ADMIN_USER_ID || "").trim();
  const adminEmail = "idaelvargasbusiness@gmail.com";
  if (!secret) return res.status(503).json({ error: "Falta configurar la conexión del panel en Vercel." });
  if (!/^Bearer \S+$/.test(req.headers.authorization || "")) return res.status(401).json({ error: "Inicia sesión para continuar." });
  try {
    const auth = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: secret, Authorization: req.headers.authorization }
    });
    if (!auth.ok) return res.status(401).json({ error: "Tu sesión venció. Inicia sesión nuevamente." });
    const user = await auth.json();
    const autorizado = adminId ? user.id === adminId :
      typeof user.email === "string" && user.email.toLowerCase() === adminEmail && Boolean(user.email_confirmed_at);
    if (!autorizado) return res.status(403).json({ error: "Esta cuenta no tiene permiso para publicar picks." });
    if (req.method === "GET") return res.status(200).json({ autorizado: true });
    const { titulo, descripcion, fecha_pick, imagen_url = "", paquetes } = req.body || {};
    if (typeof titulo !== "string" || !titulo.trim() || titulo.length > 160 ||
        typeof descripcion !== "string" || !descripcion.trim() || descripcion.length > 10000 ||
        typeof fecha_pick !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_pick) ||
        !Number.isFinite(Date.parse(`${fecha_pick}T00:00:00Z`)) ||
        new Date(`${fecha_pick}T00:00:00Z`).toISOString().slice(0,10) !== fecha_pick ||
        !Array.isArray(paquetes) || !paquetes.length || paquetes.some(p => !PAQUETES.includes(p))) {
      return res.status(400).json({ error: "Revisa el título, contenido, fecha y paquetes." });
    }
    let imagenValida = typeof imagen_url === "string" && imagen_url.length <= 2048;
    if (imagenValida && imagen_url) {
      try { const url = new URL(imagen_url); imagenValida = url.protocol === "https:" && !url.username && !url.password; }
      catch { imagenValida = false; }
    }
    if (!imagenValida) {
      return res.status(400).json({ error: "La imagen debe tener un enlace HTTPS válido." });
    }
    const filas = [...new Set(paquetes)].map(paquete => ({
      titulo: titulo.trim(), descripcion: descripcion.trim(), fecha_pick,
      imagen_url: imagen_url || null, paquete, activo: true
    }));
    const result = await fetch(`${SUPABASE_URL}/rest/v1/picks`, {
      method: "POST",
      headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(filas)
    });
    if (!result.ok) {
      console.error("No se pudo publicar el pick", result.status);
      return res.status(502).json({ error: "No se pudo confirmar la publicación. Revisa la tabla picks antes de volver a intentarlo." });
    }
    return res.status(201).json({ publicados: filas.length });
  } catch {
    return res.status(500).json({ error: "No se pudo confirmar la publicación. Revisa los picks antes de volver a intentarlo." });
  }
}
