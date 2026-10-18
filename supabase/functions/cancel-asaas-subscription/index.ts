import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// cancel-asaas-subscription — cancela a assinatura do usuário
// logado em DOIS lugares: no banco (subscriptions.status='canceled')
// e no Asaas (DELETE /v3/subscriptions/{id} — remove a recorrência
// e as cobranças pendentes, docs.asaas.com/reference/remove-subscription).
// Segurança: verify_jwt=true (Supabase valida o JWT); o user_id vem
// do payload do token. Service role só para ler/escrever a própria
// assinatura do usuário (user_id ou família dele).
// v1 (17/10): resolve a pendência do cancelamento real.
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api.asaas.com/v3";

function decodeJwtPayload(token: string): { sub?: string } {
  const b64 = (token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(atob(padded));
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

  try {
    // verify_jwt=true: o Supabase já validou a assinatura do token.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    let userId: string | undefined;
    try {
      userId = decodeJwtPayload(token).sub;
    } catch {
      userId = undefined;
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Famílias do usuário (mesma lógica da RPC cancel_my_subscription)
    const { data: memberships } = await db
      .from("family_members")
      .select("family_id")
      .eq("user_id", userId);
    const familyIds = (memberships ?? []).map((m) => m.family_id);

    // Assinatura ativa mais recente do usuário OU da família dele
    let query = db
      .from("subscriptions")
      .select(
        "id, provider, provider_subscription_id, preapproval_id, status, current_period_end",
      )
      .in("status", ["active", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1);
    query =
      familyIds.length > 0
        ? query.or(`user_id.eq.${userId},family_id.in.(${familyIds.join(",")})`)
        : query.eq("user_id", userId);
    const { data: subs, error: subErr } = await query;
    if (subErr) throw subErr;
    const sub = subs?.[0];
    if (!sub) {
      return new Response(JSON.stringify({ error: "no_active_subscription" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Remover a recorrência no Asaas (se houver id do provedor)
    const asaasId = sub.provider_subscription_id || sub.preapproval_id;
    const asaasResult: { attempted: boolean; deleted?: boolean; http?: number; error?: string } = {
      attempted: false,
    };
    if (asaasId && ASAAS_API_KEY) {
      asaasResult.attempted = true;
      try {
        const res = await fetch(`${ASAAS_BASE_URL}/subscriptions/${asaasId}`, {
          method: "DELETE",
          headers: { access_token: ASAAS_API_KEY },
        });
        asaasResult.http = res.status;
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          asaasResult.deleted = (json as { deleted?: boolean })?.deleted ?? true;
        } else {
          const body = await res.text().catch(() => "");
          asaasResult.error = body.slice(0, 300);
          console.error(`[cancel-asaas] Asaas HTTP ${res.status}:`, body.slice(0, 300));
        }
      } catch (e) {
        asaasResult.error = String(e);
        console.error("[cancel-asaas] falha de rede no Asaas:", e);
      }
    }

    // 2. Cancelar no banco (independe do Asaas: se a remoção lá falhar,
    //    o pedido fica registrado e o suporte resolve manualmente)
    const nowIso = new Date().toISOString();
    const { error: upErr } = await db
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: nowIso, updated_at: nowIso })
      .eq("id", sub.id);
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({
        ok: true,
        canceled_at: nowIso,
        current_period_end: sub.current_period_end,
        asaas: asaasResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[cancel-asaas] erro:", e);
    return new Response(JSON.stringify({ error: "cancel_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
