const SUPABASE_URL = "https://nfvkmxnprchvkufwvhpr.supabase.co";

function calcularVencimiento(paquete) {
  const vence = new Date();

  switch (paquete) {
    case "Premium Diario":
    case "Exclusiva Diaria":
      vence.setHours(24, 0, 0, 0);
      break;

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
          Authorization: `Bearer ${process.env.STRIPE_TEST_SECRET_KEY}`
        }
      }
    );

    const evento = await stripeResponse.json();

    if (!stripeResponse.ok) {
      return res.status(400).json({
        error: "Stripe no pudo verificar el evento"
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

    const nombre =
      session.customer_details?.name ||
      "Sin nombre";

    const correo =
      session.customer_details?.email ||
      session.customer_email ||
      "Sin correo";

    const paquete =
      session.metadata?.paquete ||
      "Sin paquete";

    const cantidadPagada =
      (session.amount_total || 0) / 100;

    const fechaCompra =
      new Date(session.created * 1000).toISOString();

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
      test: true,
      compra
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Error procesando webhook de prueba"
    });
  }
}
