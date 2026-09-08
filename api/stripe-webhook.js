import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false
  }
};

const SUPABASE_URL = "https://nfvkmxnprchvkufwvhpr.supabase.co";

function leerBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verificarFirmaStripe(payload, firma, secreto) {
  if (!firma || !secreto) return false;

  const partes = firma.split(",");
  const timestamp = partes
    .find(p => p.startsWith("t="))
    ?.split("=")[1];

  const firmas = partes
    .filter(p => p.startsWith("v1="))
    .map(p => p.split("=")[1]);

  if (!timestamp || firmas.length === 0) return false;

  const signedPayload = `${timestamp}.${payload.toString("utf8")}`;

  const firmaEsperada = crypto
    .createHmac("sha256", secreto)
    .update(signedPayload)
    .digest("hex");

  return firmas.some(firma => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(firma, "hex"),
        Buffer.from(firmaEsperada, "hex")
      );
    } catch {
      return false;
    }
  });
}

function calcularVencimiento(paquete) {
  const ahora = new Date();
  const vence = new Date(ahora);

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const rawBody = await leerBody(req);

    const stripeSignature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    const firmaValida = verificarFirmaStripe(
      rawBody,
      stripeSignature,
      webhookSecret
    );

    if (!firmaValida) {
      return res.status(400).json({
        error: "Firma de Stripe no válida"
      });
    }

    const evento = JSON.parse(rawBody.toString("utf8"));

    if (evento.type !== "checkout.session.completed") {
      return res.status(200).json({ received: true });
    }

    const session = evento.data.object;

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
          estado: "pagado",
          vence_en: venceEn
        })
      }
    );

    if (!respuestaSupabase.ok) {
      const errorTexto = await respuestaSupabase.text();

      if (
        respuestaSupabase.status === 409 ||
        errorTexto.includes("duplicate")
      ) {
        return res.status(200).json({
          received: true,
          duplicate: true
        });
      }

      console.error("Supabase:", errorTexto);

      return res.status(500).json({
        error: "No se pudo registrar la compra"
      });
    }

    return res.status(200).json({
      received: true,
      paquete,
      user_id: userId
    });

  } catch (error) {
    console.error("Webhook error:", error);

    return res.status(500).json({
      error: "Error procesando webhook"
    });
  }
}
