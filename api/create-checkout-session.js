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
      "Premium Diario": "price_1UDCftDLF0zUmGGz5ZXKtc9v",
      "Premium Semanal": "price_1UDCk9DLF0zUmGGzhOLvZdRN",
      "Exclusiva Diaria": "price_1UDCm0DLF0zUmGGzY5gLMWFD",
      "Exclusiva Semanal": "price_1UDCp1DLF0zUmGGzCfpEVDA8",
      "Pack Mensual": "price_1UDCr7DLF0zUmGGz7LKrBTrt",
      "Económica": "price_1UDCuyDLF0zUmGGzmkJlRLw8"
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
