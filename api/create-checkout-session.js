const PRICE_IDS = {
  "Premium Diario": "price_1UDCftDLF0zUmGGz5ZXKtc9v",
  "Premium Semanal": "price_1UDCk9DLF0zUmGGzh0LvZdRN",
  "Exclusiva Diaria": "price_1UDCm0DLF0zUmGGzY5gLMWFD",
  "Exclusiva Semanal": "price_1UDCp1DLF0zUmGGzCfpEVDA8",
  "Pack Mensual": "price_1UDCr7DLF0zUmGGz7LKrBTrt",
  "Económica": "price_1UDCuyDLF0zUmGGzmkJ1RLw8"
};

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {

    const { paquete } = req.body || {};

    const priceId = PRICE_IDS[paquete];

    if (!priceId) {
      return res.status(400).json({
        error: "Paquete no válido"
      });
    }

    const params = new URLSearchParams();

    params.append("mode", "payment");

    params.append(
      "success_url",
      "https://idaelsportbet.me/paquetes.html?payment=success&session_id={CHECKOUT_SESSION_ID}"
    );

    params.append(
      "cancel_url",
      "https://idaelsportbet.me/paquetes.html?payment=cancelled"
    );

    params.append(
      "line_items[0][price]",
      priceId
    );

    params.append(
      "line_items[0][quantity]",
      "1"
    );

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },

        body: params.toString()
      }
    );

    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error(session);

      return res.status(500).json({
        error: "No se pudo crear el pago"
      });
    }

    return res.status(200).json({
      url: session.url
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Error interno"
    });

  }
}
