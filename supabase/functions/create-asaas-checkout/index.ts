import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ============================================================
// create-asaas-checkout — cria um Checkout Asaas (página hospedada)
// com PIX + CARTÃO explícitos para assinatura recorrente.
// Doc: docs.asaas.com/docs/checkout-com-assinatura-recorrente
// billingTypes: ["PIX", "CREDIT_CARD"], chargeTypes: ["RECURRENT"]
//
// Segurança: header x-admin-token deve bater com o secret
// ASAAS_ADMIN_TOKEN (definido no dashboard Supabase).
// POST { plan: "monthly" | "yearly" } → { id, url }
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
};

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api.asaas.com/v3";
const ADMIN_TOKEN = Deno.env.get("ASAAS_ADMIN_TOKEN") ?? "";

const PLANS: Record<string, { value: number; cycle: string; name: string; description: string }> = {
  monthly: {
    value: 19.9,
    cycle: "MONTHLY",
    name: "Curiangoo Premium Mensal",
    description: "Copilot de voz, insights do Curiango, gráfico de evolução e mais — sem fidelidade.",
  },
  yearly: {
    value: 149.9,
    cycle: "YEARLY",
    name: "Curiangoo Premium Anual",
    description: "Tudo do Premium com 37% de desconto — economize R$ 89,90 por ano.",
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth por token admin (simples; só eu e o Matheus chamamos)
  const token = req.headers.get("x-admin-token") ?? "";
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const plan = body?.plan === "yearly" ? "yearly" : "monthly";
    const p = PLANS[plan];

    // Primeira cobrança: amanhã (o cliente paga no checkout, mas a recorrência
    // começa formalmente no dia seguinte — padrão Asaas)
    const next = new Date(Date.now() + 24 * 3600 * 1000);
    const nextDueDate = next.toISOString().slice(0, 10) + " 12:00:00";

    const payload = {
      billingTypes: ["PIX", "CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 1440,
      callback: {
        successUrl: "https://financas-familiares-46529.goskip.app/perfil?checkout=sucesso",
        cancelUrl: "https://financas-familiares-46529.goskip.app/perfil?checkout=cancelado",
        expiredUrl: "https://financas-familiares-46529.goskip.app/perfil?checkout=expirado",
      },
      items: [
        {
          name: p.name,
          description: p.description,
          quantity: 1,
          value: p.value,
        },
      ],
      subscription: {
        cycle: p.cycle,
        nextDueDate,
      },
    };

    const res = await fetch(`${ASAAS_BASE_URL}/checkouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[create-checkout] Asaas HTTP", res.status, JSON.stringify(json).slice(0, 400));
      return new Response(JSON.stringify({ error: "asaas_error", status: res.status, detail: json }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ id: json.id, url: json.link, billingTypes: json.billingTypes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[create-checkout] erro:", e);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
