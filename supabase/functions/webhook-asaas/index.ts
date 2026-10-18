import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// webhook-asaas — recebe eventos de COBRANÇA/ASSINATURA do Asaas
// e atualiza public.subscriptions no app.
// Segurança: header 'asaas-access-token' (token definido no painel
// do Asaas ao configurar o webhook) comparado com secret do Supabase.
// Docs: https://docs.asaas.com/docs/webhooks-para-cobrancas
//
// v3 (17/10): plan detectado pelo valor da cobrança (149,90 = yearly);
// provider 'asaas' na RPC; eventos de assinatura também aceitos.
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api.asaas.com/v3";

const MONTHLY_VALUE = 19.9;
const YEARLY_VALUE = 149.9;

const admin = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function getCustomerEmail(customerId: string): Promise<string | null> {
  if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurado");
  const res = await fetch(`${ASAAS_BASE_URL}/customers/${customerId}`, {
    headers: { access_token: ASAAS_API_KEY },
  });
  if (!res.ok) {
    console.error(`[webhook-asaas] customer ${customerId}: HTTP ${res.status}`);
    return null;
  }
  const json = await res.json();
  return json?.email ?? null;
}

async function syncSubscription(
  email: string,
  status: string,
  plan: string,
  subscriptionId: string | null,
): Promise<void> {
  const db = admin();
  const { error } = await db.rpc("upsert_subscription_from_webhook", {
    p_email: email,
    p_preapproval_id: subscriptionId,
    p_status: status, // authorized | paused | cancelled
    p_plan: plan,
    p_external_reference: subscriptionId,
    p_payer_id: null,
    p_provider: "asaas",
  });
  if (error) throw error;
  console.log(`[webhook-asaas] ${email} sincronizado (${status}, ${plan})`);
}

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

  // 1. Autenticidade: token compartilhado definido no painel do Asaas
  const token = req.headers.get("asaas-access-token") ?? "";
  if (!ASAAS_WEBHOOK_TOKEN || token !== ASAAS_WEBHOOK_TOKEN) {
    console.warn("[webhook-asaas] token inválido ou ausente — rejeitado");
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Parse do evento
  let evt: {
    event?: string;
    payment?: { customer?: string; subscription?: string | null; value?: number; billingType?: string };
    subscription?: { id?: string; customer?: string; value?: number; cycle?: string };
  };
  try {
    evt = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const event = evt.event ?? "";
    const payment = evt.payment;
    const subscription = evt.subscription;

    // Eventos relevantes de cobrança recorrente (assinatura)
    const relevant =
      event === "PAYMENT_RECEIVED" ||
      event === "PAYMENT_CONFIRMED" ||
      event === "PAYMENT_OVERDUE" ||
      event === "PAYMENT_REFUNDED" ||
      event === "SUBSCRIPTION_RENEWED";

    if (!relevant) {
      console.log(`[webhook-asaas] evento ignorado: ${event}`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SUBSCRIPTION_RENEWED traz o objeto subscription (sem payment)
    const customerId = payment?.customer ?? subscription?.customer;
    if (!customerId) {
      return new Response(JSON.stringify({ error: "customer_not_found" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = await getCustomerEmail(customerId);
    if (!email) {
      return new Response(JSON.stringify({ error: "customer_email_not_found" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Status → convenção da RPC (authorized | paused | cancelled)
    let status = "authorized";
    if (event === "PAYMENT_OVERDUE") status = "paused";
    if (event === "PAYMENT_REFUNDED") status = "cancelled";

    // Plano: pelo valor (19,90 = monthly; 149,90 = yearly) — à prova de ciclo ausente
    const value = payment?.value ?? subscription?.value ?? 0;
    const plan = Math.abs(value - YEARLY_VALUE) < 0.01 ? "yearly" : "monthly";

    await syncSubscription(email, status, plan, payment?.subscription ?? subscription?.id ?? null);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[webhook-asaas] erro ao sincronizar:", e);
    return new Response(JSON.stringify({ error: "sync_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
