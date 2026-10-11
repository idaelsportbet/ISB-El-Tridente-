const SUPABASE_URL = "https://nfvkmxnprchvkufwvhpr.supabase.co";
const ADMIN_EMAIL = "idaelvargasbusiness@gmail.com";
const CHANNELS = new Set(["portal", "email", "whatsapp"]);
const clean = value => String(value ?? "").trim();

async function supabase(path, secret, options = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(10000)
  });
}

async function notifyAdmin(subject, text, secret) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.PICK_EMAIL_FROM;
  if (!key || !from) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [ADMIN_EMAIL], subject, text }),
      signal: AbortSignal.timeout(8000)
    });
    return r.ok;
  } catch { return false; }
}

function ticketId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "PATCH"].includes(req.method)) return res.status(405).json({ error: "Método no permitido." });
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: "Falta configurar la conexión segura del soporte." });
  const authorization = req.headers.authorization || "";
  if (!/^Bearer \S+$/.test(authorization)) return res.status(401).json({ error: "Inicia sesión para usar el soporte." });
  try {
    const auth = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: secret, Authorization: authorization }, signal: AbortSignal.timeout(8000)
    });
    if (!auth.ok) return res.status(401).json({ error: "Tu sesión venció. Inicia sesión de nuevo." });
    const user = await auth.json();
    const adminId = clean(process.env.ADMIN_USER_ID);
    const isAdmin = adminId ? user.id === adminId : user.email?.toLowerCase() === ADMIN_EMAIL && Boolean(user.email_confirmed_at);
    const headers = { Prefer: "return=representation" };

    if (req.method === "GET") {
      const isAdminView = req.query?.vista === "admin";
      if (isAdminView && !isAdmin) return res.status(403).json({ error: "Solo el administrador puede ver los mensajes." });
      const q = new URLSearchParams({ select: "id,customer_user_id,customer_email,customer_name,customer_phone,subject,preferred_channel,status,created_at,updated_at", order: "updated_at.desc", limit: isAdminView ? "60" : "30" });
      if (!isAdminView) q.set("customer_user_id", `eq.${user.id}`);
      const tr = await supabase(`/rest/v1/support_tickets?${q}`, secret);
      if (!tr.ok) return res.status(503).json({ error: "El buzón de soporte todavía no está configurado." });
      const tickets = await tr.json();
      if (!tickets.length) return res.status(200).json({ tickets: [] });
      const ids = tickets.map(t => t.id);
      const mr = await supabase(`/rest/v1/support_messages?select=id,ticket_id,author_role,body,channel,created_at&ticket_id=in.(${ids.join(",")})&order=created_at.asc&limit=1000`, secret);
      if (!mr.ok) return res.status(503).json({ error: "No se pudo cargar el historial de mensajes." });
      const byTicket = new Map(tickets.map(t => [t.id, []]));
      for (const message of await mr.json()) byTicket.get(message.ticket_id)?.push(message);
      return res.status(200).json({ tickets: tickets.map(t => ({ ...t, messages: byTicket.get(t.id) || [] })) });
    }

    if (req.method === "POST") {
      const subject = clean(req.body?.subject), body = clean(req.body?.message), channel = clean(req.body?.channel);
      if (subject.length < 3 || subject.length > 120 || body.length < 5 || body.length > 4000 || !CHANNELS.has(channel)) return res.status(400).json({ error: "Escribe un asunto, un mensaje y selecciona cómo prefieres recibir la respuesta." });
      const name = clean(user.user_metadata?.full_name || user.user_metadata?.name || "Cliente").slice(0, 120);
      const phone = clean(user.phone || user.user_metadata?.phone || "").slice(0, 40);
      const created = await supabase("/rest/v1/support_tickets", secret, { method: "POST", headers, body: JSON.stringify({ customer_user_id: user.id, customer_email: user.email || "", customer_name: name, customer_phone: phone, subject, preferred_channel: channel, status: "open" }) });
      if (!created.ok) return res.status(503).json({ error: "No se pudo abrir la conversación. Inténtalo nuevamente." });
      const rows = await created.json(), ticket = rows[0];
      if (!ticket?.id) return res.status(503).json({ error: "No se pudo confirmar la conversación." });
      const saved = await supabase("/rest/v1/support_messages", secret, { method: "POST", headers, body: JSON.stringify({ ticket_id: ticket.id, author_role: "customer", body, channel: "portal" }) });
      if (!saved.ok) {
        await supabase(`/rest/v1/support_tickets?id=eq.${ticket.id}`, secret, { method: "DELETE" });
        return res.status(503).json({ error: "No se pudo guardar tu mensaje. Inténtalo nuevamente." });
      }
      await notifyAdmin(`Nuevo mensaje de soporte · ${subject}`, `Cliente: ${name}\nCorreo: ${user.email || "No disponible"}\nTeléfono: ${phone || "No registrado"}\nCanal preferido: ${channel}\n\n${body}`, secret);
      let externalUrl = "";
      if (channel === "whatsapp") externalUrl = `https://wa.me/12254329795?text=${encodeURIComponent(`Hola, soy ${name}. Envié una consulta desde mi cuenta ISB sobre: ${subject}.`)}`;
      if (channel === "email") externalUrl = `mailto:${encodeURIComponent(ADMIN_EMAIL)}?subject=${encodeURIComponent(`Soporte ISB · ${subject}`)}&body=${encodeURIComponent(`Hola, soy ${name}. Envié una consulta desde mi cuenta ISB. Mi mensaje: ${body}`)}`;
      return res.status(201).json({ ticket, external_url: externalUrl });
    }

    const action = clean(req.body?.accion), id = req.body?.ticket_id;
    if (!ticketId(id)) return res.status(400).json({ error: "No se pudo identificar la conversación." });
    const lookup = await supabase(`/rest/v1/support_tickets?select=id,customer_user_id,customer_email,customer_phone,status&id=eq.${id}&limit=1`, secret);
    if (!lookup.ok) return res.status(503).json({ error: "No se pudo localizar la conversación." });
    const [ticket] = await lookup.json();
    if (!ticket) return res.status(404).json({ error: "La conversación ya no está disponible." });
    if (action === "cerrar") {
      if (!isAdmin) return res.status(403).json({ error: "Solo el administrador puede cerrar conversaciones." });
      const closed = await supabase(`/rest/v1/support_tickets?id=eq.${id}`, secret, { method: "PATCH", headers, body: JSON.stringify({ status: "closed", updated_at: new Date().toISOString() }) });
      return closed.ok ? res.status(200).json({ status: "closed" }) : res.status(503).json({ error: "No se pudo cerrar la conversación." });
    }
    if (action !== "respuesta") return res.status(400).json({ error: "Acción de soporte desconocida." });
    const body = clean(req.body?.body), channel = clean(req.body?.channel);
    if (body.length < 1 || body.length > 4000) return res.status(400).json({ error: "La respuesta debe tener entre 1 y 4,000 caracteres." });
    if (isAdmin) {
      if (!CHANNELS.has(channel)) return res.status(400).json({ error: "Selecciona un canal de respuesta." });
      if (channel === "whatsapp") {
        const digits = clean(ticket.customer_phone).replace(/\D/g, "");
        if (digits.length < 8) return res.status(400).json({ error: "Este cliente no registró un número de teléfono para WhatsApp." });
        return res.status(200).json({ whatsapp_url: `https://wa.me/${digits}?text=${encodeURIComponent(body)}` });
      }
      if (channel === "email") {
        const key = process.env.RESEND_API_KEY, from = process.env.PICK_EMAIL_FROM;
        if (!key || !from) return res.status(503).json({ error: "El envío de correo aún no está conectado." });
        const mail = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [ticket.customer_email], subject: `Respuesta de soporte ISB · ${id.slice(0, 8)}`, text: body }), signal: AbortSignal.timeout(8000) });
        if (!mail.ok) return res.status(502).json({ error: "No se pudo enviar el correo. La respuesta no se guardó." });
      }
    } else {
      if (ticket.customer_user_id !== user.id) return res.status(403).json({ error: "No tienes acceso a esta conversación." });
      if (channel !== "portal") return res.status(400).json({ error: "Responde desde el portal para mantener la conversación segura." });
    }
    const saved = await supabase("/rest/v1/support_messages", secret, { method: "POST", headers, body: JSON.stringify({ ticket_id: id, author_role: isAdmin ? "admin" : "customer", body, channel }) });
    if (!saved.ok) return res.status(503).json({ error: "No se pudo guardar la respuesta." });
    const status = isAdmin ? "answered" : "open";
    const updated = await supabase(`/rest/v1/support_tickets?id=eq.${id}`, secret, { method: "PATCH", headers, body: JSON.stringify({ status, updated_at: new Date().toISOString() }) });
    if (!updated.ok) return res.status(503).json({ error: "Se guardó el mensaje, pero no se pudo actualizar el estado." });
    if (!isAdmin) await notifyAdmin(`Respuesta de cliente · ${ticket.customer_email}`, body, secret);
    return res.status(200).json({ status });
  } catch {
    return res.status(502).json({ error: "El soporte no pudo conectarse. Inténtalo nuevamente." });
  }
}
