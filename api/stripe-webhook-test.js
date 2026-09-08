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

  if (typeof req.body === "object") {
    return req.body;
  }

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

    if (!process.env.STRIPE_TEST_SECRET_KEY) {
      return res.status(500).json({
        error: "Falta STRIPE_TEST_SECRET_KEY"
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
      console.error("Stripe TEST verificar evento:", evento);

      return res.status(400).json({
        error: "Stripe no pudo verificar el evento"
      });
    }

    if (evento.livemode !== false) {
      return res.status(400).json({
        error: "Este endpoint solo acepta eventos de prueba"
      });
    }

    if (evento.type !== "checkout.session.completed") {
      return res.status(200).json({
        received: true,
        ignored: evento.type
      });
    }

    const session = evento.data?.object;

    if (!session) {
      return res.status(400).json({
        error: "Sesión de Stripe no encontrada"
      });
    }

    if (session.payment_status !== "paid") {
      return res.status(200).json({
        received: true,
        ignored: "Pago no completado"
      });
    }

    const userId =
      session.metadata?.user_id ||
      session.client_reference_id;

    const paquete = session.metadata?.paquete;

    const email =
      session.metadata?.email ||
      session.customer_details?.email ||
      session.customer_email;

    if (!userId || !paquete || !session.id) {
      return res.status(400).json({
        error: "Faltan datos del usuario o del paquete"
      });
    }

    const venceEn = calcularVencimiento(paquete);

    const respuestaSupabase = await fetch(
      `${SUPABASE_URL}/rest/v1/compras`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": process.env.SUPABASE_SECRET_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          user_id: userId,
          email: email || null,
          paquete,
          stripe_session_id: session.id,
          estado: "pagado_prueba",
          vence_en: venceEn
        })
      }
    );

    if (!respuestaSupabase.ok) {
      const errorTexto = await respuestaSupabase.text();

      if (
        respuestaSupabase.status === 409 ||
        errorTexto.toLowerCase().includes("duplicate")
      ) {
        return res.status(200).json({
          received: true,
          duplicate: true
        });
      }

      console.error("Supabase TEST:", errorTexto);

      return res.status(500).json({
        error: "No se pudo registrar la compra en Supabase",
        detalle: errorTexto
      });
    }

    const compra = await respuestaSupabase.json();

    return res.status(200).json({
      received: true,
      test: true,
      paquete,
      user_id: userId,
      compra
    });

  } catch (error) {
    console.error("Webhook TEST:", error);

    return res.status(500).json({
      error: error.message || "Error procesando webhook de prueba"
    });
  }
}
