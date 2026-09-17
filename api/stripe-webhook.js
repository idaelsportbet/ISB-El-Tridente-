const SUPABASE_URL = "https://nfvkmxnprchvkufwvhpr.supabase.co";

function calcularVencimiento(paquete) {
  const ahora = new Date();

  if (
    paquete === "Premium Diario" ||
    paquete === "Exclusiva Diaria"
  ) {
    // Obtener la fecha actual según horario Central de EE. UU.
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(ahora);

    const valores = {};
    for (const parte of partes) {
      if (parte.type !== "literal") {
        valores[parte.type] = parte.value;
      }
    }

    // Medianoche que inicia el día siguiente en horario Central.
    // Primero usamos una aproximación UTC y luego calculamos
    // qué offset tiene Chicago en ese instante.
    const aproximacion = new Date(
      Date.UTC(
        Number(valores.year),
        Number(valores.month) - 1,
        Number(valores.day) + 1,
        0,
        0,
        0
      )
    );

    const formatoChicago = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });

    const p = {};
    for (const parte of formatoChicago.formatToParts(aproximacion)) {
      if (parte.type !== "literal") {
        p[parte.type] = parte.value;
      }
    }

    const chicagoComoUTC = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second)
    );

    const offset = chicagoComoUTC - aproximacion.getTime();

    return new Date(
      aproximacion.getTime() - offset
    ).toISOString();
  }

  const vence = new Date(ahora);

  switch (paquete) {
    case "Premium Semanal":
    case "Exclusiva Semanal":
      vence.setDate(vence.getDate() + 7);
      break;

    case "Pack Mensual":
    case "Económica":
      vence.setDate(vence.getDate() + 30);
      break;

    default:
      return null;
  }

  return vence.toISOString();
}

function obtenerBody(req) {
  if (!req.body) return null;

  if (typeof req.body === "object") return req.body;

  if (Buffer.isBuffer(req.body)) {
    return JSON.parse(req.body.toString("utf8"));
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  try {
    const body = obtenerBody(req);

    if (!body?.id) {
      return res.status(400).json({
        error: "No se recibió ID del evento"
      });
    }

    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/events/${encodeURIComponent(body.id)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`
        }
      }
    );

    const evento = await stripeResponse.json();

    if (!stripeResponse.ok) {
      return res.status(400).json({
        error: "Stripe no pudo verificar el evento"
      });
    }

    if (evento.livemode !== true) {
      return res.status(400).json({
        error: "Este evento no pertenece al modo real"
      });
    }

    if (evento.type !== "checkout.session.completed") {
      return res.status(200).json({
        received: true
      });
    }

    const session = evento.data.object;

    if (session.payment_status !== "paid") {
      return res.status(200).json({
        received: true
      });
    }
const userId =
  session.metadata?.user_id ||
  session.client_reference_id ||
  null;
    const nombre =
      session.customer_details?.name ||
      "Sin nombre";

    const correo =
      session.customer_details?.email ||
      session.customer_email ||
      session.metadata?.email ||
      "Sin correo";

    const paquete =
      session.metadata?.paquete ||
      "Sin paquete";

    const cantidadPagada =
      (session.amount_total || 0) / 100;

    const fechaCompra =
      new Date(evento.created * 1000).toISOString();

    const vencimiento =
      calcularVencimiento(paquete);

    const respuestaSupabase = await fetch(
      `${SUPABASE_URL}/rest/v1/compras`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
          Prefer: "return=representation"
        },
        body: JSON.stringify({
  user_id: userId,
  nombre,
  correo,
  paquete,
  cantidad_pagada_dolar: cantidadPagada,
  fecha_compra: fechaCompra,
  vencimiento
})
      }
    );

    if (!respuestaSupabase.ok) {
      const detalle = await respuestaSupabase.text();

      return res.status(500).json({
        error: "No se pudo registrar la compra en Supabase",
        detalle
      });
    }

    const compra = await respuestaSupabase.json();

    return res.status(200).json({
      received: true,
      live: true,
      compra
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Error procesando webhook real"
    });
  }
}
