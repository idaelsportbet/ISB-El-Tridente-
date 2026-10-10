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
    if (req.method === "GET" && req.query?.vista === "compras") {
      const pagina = Number(req.query.pagina || 0);
      if (!Number.isInteger(pagina) || pagina < 0 || pagina > 10000) return res.status(400).json({error:"Página inválida."});
      const query = new URLSearchParams({select:"user_id,nombre,correo,paquete,cantidad_pagada_dolar,fecha_compra,vencimiento",order:"fecha_compra.desc",limit:"26",offset:String(pagina*25)});
      const headers = {apikey:secret,Authorization:`Bearer ${secret}`};
      const response = await fetch(`${SUPABASE_URL}/rest/v1/compras?${query}`,{headers});
      if (!response.ok) return res.status(502).json({error:"No se pudieron cargar las compras."});
      const filas = await response.json();
      const compras = filas.slice(0,25);
      const usuarios = new Map();
      const ids = [...new Set(compras.map(c=>c.user_id).filter(Boolean))];
      for(let i=0;i<ids.length;i+=5) {
        await Promise.all(ids.slice(i,i+5).map(async id=>{
          try {
            const info = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`,{headers,signal:AbortSignal.timeout(4000)});
            if(info.ok) {const cuenta=await info.json();usuarios.set(id,cuenta.user_metadata?.username || "");}
          } catch {}
        }));
      }
      return res.status(200).json({compras:compras.map(c=>({...c,usuario:usuarios.get(c.user_id)||null})),pagina,hayMas:filas.length>25});
    }
    if (req.method === "GET") return res.status(200).json({ autorizado: true });
    if (req.body?.accion === "activar_prueba") {
      // Only the authenticated owner can grant a temporary, free access to their own account.
      const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
      const consulta = new URLSearchParams({ select: "paquete,vencimiento", user_id: `eq.${user.id}`, paquete: "eq.Premium Diario", vencimiento: `gt.${new Date().toISOString()}`, limit: "1" });
      const anterior = await fetch(`${SUPABASE_URL}/rest/v1/compras?${consulta}`, { headers });
      if (!anterior.ok) return res.status(502).json({ error: "No se pudo comprobar tu acceso." });
      const filas = await anterior.json();
      if (filas.length) return res.status(200).json({ paquete: "Premium Diario", existente: true });
      const ahora = new Date();
      const resultado = await fetch(`${SUPABASE_URL}/rest/v1/compras`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: user.id, nombre: `${user.user_metadata?.full_name || "Administrador"} (PRUEBA SIN COBRO)`, correo: user.email, paquete: "Premium Diario", cantidad_pagada_dolar: 0, fecha_compra: ahora.toISOString(), vencimiento: new Date(ahora.getTime() + 60 * 60 * 1000).toISOString() })
      });
      if (!resultado.ok) return res.status(502).json({ error: "No se pudo activar el paquete de prueba." });
      return res.status(201).json({ paquete: "Premium Diario", prueba: true, duracion: "1 hora" });
    }
    const { titulo, descripcion, fecha_pick, imagen_url = "", juego_url = "", paquetes } = req.body || {};
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
    let juegoValido = typeof juego_url === "string" && juego_url.length <= 2048;
    if (juegoValido && juego_url) {
      try { const url = new URL(juego_url); juegoValido = url.protocol === "https:" && !url.username && !url.password; }
      catch { juegoValido = false; }
    }
    if (!juegoValido) return res.status(400).json({error:"El juego debe tener un enlace HTTPS válido."});
    // Store an optional plain-text footer with the existing pick, without a schema migration.
    const contenido = descripcion.trim() + (juego_url ? `\n\nVer juego: ${new URL(juego_url).href}` : "");
    if (contenido.length > 10000) return res.status(400).json({error:"Acorta el análisis para incluir el enlace del juego."});
    const filas = [...new Set(paquetes)].map(paquete => ({
      titulo: titulo.trim(), descripcion: contenido, fecha_pick,
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
