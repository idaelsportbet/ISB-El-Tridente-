export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { paquete, user_id, email } = req.body || {};

    if (!paquete) {
      return res.status(400).json({ error: "Falta el paquete" });
    }

    if (!user_id) {
      return res.status(400).json({ error: "Falta el usuario" });
    }

    const precios = {
  "Premium Diario": "price_1UDFtGDLF0zUmGGzJOv04WQ8",
  "Premium Semanal": "price_1UDOflDLF0zUmGGzWFPpR0yY",
  "Exclusiva Diaria": "price_1UDOhQDLF0zUmGGzQXzbmB4F",
  "Exclusiva Semanal": "price_1UDOj7DLF0zUmGGz8bHbbRsH",
  "Pack Mensual": "price_1UDOkQDLF0zUmGGzdnxmQBFi",
  "Económica": "price_1UDOlhDLF0zUmGGzMsNtCE7h"
};

    const priceId = precios[paquete];

    if (!priceId) {
      return res.status(400).json({
        error: `Paquete no reconocido: ${paquete}`
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: "STRIPE_SECRET_KEY no está configurada"
      });
    }

    const params = new URLSearchParams();

    params.append("mode", "payment");
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");

    params.append(
      "success_url",
      "https://www.idaelsportbet.me/paquetes.html?payment=success&session_id={CHECKOUT_SESSION_ID}"
    );

    params.append(
      "cancel_url",
      "https://www.idaelsportbet.me/paquetes.html?payment=cancelled"
    );

    params.append("client_reference_id", user_id);
    params.append("metadata[user_id]", user_id);
    params.append("metadata[paquete]", paquete);

    if (email) {
      params.append("customer_email", email);
      params.append("metadata[email]", email);
    }

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      }
    );

    const stripeData = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error("Stripe error:", stripeData);

      return res.status(stripeResponse.status).json({
        error:
          stripeData?.error?.message ||
          "Stripe no pudo crear la sesión de pago"
      });
    }

    return res.status(200).json({
      url: stripeData.url,
      id: stripeData.id
    });

  } catch (error) {
    console.error("create-checkout-session error:", error);

    return res.status(500).json({
      error: error.message || "Error creando el pago"
    });
  }
}
