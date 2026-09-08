export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { user_id, email } = req.body || {};

    if (!user_id) {
      return res.status(400).json({ error: "Falta el usuario" });
    }

    const params = new URLSearchParams();

    params.append("mode", "payment");
    params.append(
      "line_items[0][price]",
      "price_1UDFtGDLF0zUmGGzJOv04WQ8"
    );
    params.append("line_items[0][quantity]", "1");

    params.append(
      "success_url",
      "https://www.idaelsportbet.me/paquetes.html?test_payment=success&session_id={CHECKOUT_SESSION_ID}"
    );

    params.append(
      "cancel_url",
      "https://www.idaelsportbet.me/paquetes.html?test_payment=cancelled"
    );

    params.append("client_reference_id", user_id);
    params.append("metadata[user_id]", user_id);
    params.append("metadata[paquete]", "Premium Diario");

    if (email) {
      params.append("customer_email", email);
      params.append("metadata[email]", email);
    }

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_TEST_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      }
    );

    const stripeData = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error("Stripe TEST error:", stripeData);

      return res.status(stripeResponse.status).json({
        error:
          stripeData?.error?.message ||
          "No se pudo crear el pago de prueba"
      });
    }

    return res.status(200).json({
      url: stripeData.url,
      id: stripeData.id
    });

  } catch (error) {
    console.error("Test checkout error:", error);

    return res.status(500).json({
      error: error.message || "Error creando el pago de prueba"
    });
  }
}
