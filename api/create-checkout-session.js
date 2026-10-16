export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { paquete, user_id, email, nombre } = req.body || {};

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

    const paqueteChampions = paquete === "Champions League Completa";
    const paqueteReto = paquete === "Reto de 10 días para $10K";
    const montoManualCentavos = paqueteChampions ? 20000 : paqueteReto ? 15000 : null;
    const priceId = precios[paquete];

    if (!priceId && montoManualCentavos === null) {
      return res.status(400).json({
        error: `Paquete no reconocido: ${paquete}`
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: "STRIPE_SECRET_KEY no está configurada"
      });
    }

    if (paqueteChampions && Date.now() >= Date.parse("2027-06-06T05:00:00.000Z")) {
      return res.status(410).json({ error: "La temporada 2026/27 de Champions League ya terminó." });
    }

    const params = new URLSearchParams();
    let promocion = false;

    // The promotion is read server-side; client requests cannot choose their own price.
    if (paquete !== "Económica" && process.env.SUPABASE_SECRET_KEY) {
      try {
        const query = new URLSearchParams({ select: "value", key: "eq.package_discount", limit: "1" });
        const settingsResponse = await fetch(
          `https://nfvkmxnprchvkufwvhpr.supabase.co/rest/v1/isb_site_settings?${query}`,
          { headers: { apikey: process.env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` }, signal: AbortSignal.timeout(4000) }
        );
        if (settingsResponse.ok) {
          const settings = await settingsResponse.json();
          promocion = settings[0]?.value?.active === true;
        }
      } catch (error) {
        console.error("No se pudo consultar la promoción; se usará el precio normal.", error);
      }
    }

    // All configured prices are one-time purchases. Monthly access is granted by the webhook.
    params.append("mode", "payment");
    if (promocion) {
      const price = montoManualCentavos !== null
        ? { unit_amount: montoManualCentavos, currency: "usd", product: null, recurring: null }
        : await (async () => {
            const priceResponse = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
              headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
              signal: AbortSignal.timeout(5000)
            });
            const data = await priceResponse.json();
            if (!priceResponse.ok || !Number.isInteger(data.unit_amount) || !data.product || data.recurring) return null;
            return data;
          })();
      if (!price || !Number.isInteger(price.unit_amount) || (montoManualCentavos === null && (!price.product || price.recurring))) {
        return res.status(502).json({ error: "No se pudo calcular el precio promocional. Inténtalo de nuevo." });
      }
      const discountedAmount = Math.round(price.unit_amount * 0.7);
      params.append("line_items[0][price_data][currency]", price.currency);
      if (price.product) params.append("line_items[0][price_data][product]", price.product);
      else params.append("line_items[0][price_data][product_data][name]", paquete);
      params.append("line_items[0][price_data][unit_amount]", String(discountedAmount));
      params.append("metadata[descuento_porcentaje]", "30");
      params.append("metadata[precio_original_centavos]", String(price.unit_amount));
    } else if (montoManualCentavos !== null) {
      params.append("line_items[0][price_data][currency]", "usd");
      params.append("line_items[0][price_data][product_data][name]", paquete);
      params.append("line_items[0][price_data][unit_amount]", String(montoManualCentavos));
    } else {
      params.append("line_items[0][price]", priceId);
    }
    params.append("line_items[0][quantity]", "1");

    params.append(
      "success_url",
      "https://www.idaelsportbet.me/cuenta.html?payment=success&session_id={CHECKOUT_SESSION_ID}"
    );

    params.append(
      "cancel_url",
      "https://www.idaelsportbet.me/paquetes.html?payment=cancelled"
    );

    params.append("client_reference_id", user_id);
    params.append("metadata[user_id]", user_id);
params.append("metadata[paquete]", paquete);

if (nombre) {
  params.append("metadata[nombre]", nombre);
}

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

