import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function buildEmailHtml(name: string, position: number): string {
  const firstName = name.trim().split(/\s+/)[0]
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vaga garantida no Curiangoo</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F6FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F6FA;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#FFFFFF;border-radius:24px;overflow:hidden;">
          <tr>
            <td style="background-color:#14213D;padding:36px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#FCA311;">Curiangoo</p>
              <h1 style="margin:0;color:#FFFFFF;font-size:26px;font-weight:800;line-height:1.25;">Vaga garantida, ${firstName}! 🎉</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px;">
              <p style="margin:0 0 20px;font-size:17px;color:#14213D;font-weight:700;text-align:center;">
                Você é o <span style="color:#B87700;">#${position}</span> da fila de fundadores.
              </p>
              <p style="margin:0 0 12px;font-size:15px;color:#4B5563;line-height:1.6;">
                Sua vaga está reservada. Quando a próxima turma abrir, você entra <strong style="color:#14213D;">antes de todo mundo</strong> — e como fundador, recebe <strong style="color:#14213D;">30 dias de Premium grátis</strong> (o dobro do trial normal).
              </p>
              <p style="margin:0 0 12px;font-size:15px;color:#4B5563;line-height:1.6;">
                O que acontece agora: vamos te avisar por aqui e no WhatsApp assim que sua vez chegar. Sem spam, prometido.
              </p>
              <div style="margin:28px 0;padding:20px;background-color:#FEF7E6;border-radius:16px;">
                <p style="margin:0;font-size:14px;color:#7C4A03;line-height:1.6;">
                  💡 <strong>Enquanto espera:</strong> converse com quem cuida das finanças em casa sobre o Método dos 3 Baldes — Necessidades, Estilo de Vida e Futuro. Quando o app abrir, vocês já começam organizados.
                </p>
              </div>
              <p style="margin:0;font-size:13px;color:#4B5563;line-height:1.6;">
                Um abraço,<br>
                <strong style="color:#14213D;">Equipe Curiangoo</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background-color:#F8FAFC;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5;">
                Curiangoo · Finanças da família em 3 baldes<br>
                <a href="https://curiangoo.com" style="color:#B87700;text-decoration:none;">curiangoo.com</a> · contato@curiangoo.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildEmailText(name: string, position: number): string {
  const firstName = name.trim().split(/\s+/)[0]
  return `Vaga garantida, ${firstName}!

Você é o #${position} da fila de fundadores do Curiangoo.

Quando a próxima turma abrir, você entra antes de todo mundo — e como fundador, recebe 30 dias de Premium grátis (o dobro do trial normal).

Vamos te avisar por aqui e no WhatsApp assim que sua vez chegar. Sem spam, prometido.

Equipe Curiangoo
https://curiangoo.com`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          error: 'CONFIG_MISSING',
          message: 'SERVICE_ROLE não configurado (env padrão).',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const { email, name, position } = body ?? {}

    if (!email || !name || typeof position !== 'number') {
      return new Response(
        JSON.stringify({
          error: 'BAD_REQUEST',
          message: 'Campos obrigatórios: email, name, position.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let emailId: string | null = null

    if (RESEND_API_KEY) {
      // Caminho 1: envio direto pela API do Resend
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Curiangoo <contato@curiangoo.com>',
          to: [email],
          subject: `Vaga garantida! Você é o #${position} da fila do Curiangoo 🎉`,
          html: buildEmailHtml(name, position),
          text: buildEmailText(name, position),
        }),
      })

      if (resendRes.ok) {
        const resendData = await resendRes.json().catch(() => ({}))
        emailId = (resendData as { id?: string }).id ?? null
      } else {
        const errText = await resendRes.text()
        console.error('[waitlist-confirm] Resend falhou:', resendRes.status, errText)
        return new Response(JSON.stringify({ error: 'RESEND_FAILED', status: resendRes.status }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      // Caminho 2 (sem secret): registra o pedido — o robô do Apollo envia via MCP Resend e marca o envio.
      // A edge marca um status 'pending' no email_sent_at NULL; o cron do Apollo varre e envia.
      console.log(
        '[waitlist-confirm] RESEND_API_KEY ausente — registro fica pendente para envio via MCP',
      )
    }

    // Marcar como processado (service role)
    const markRes = await fetch(
      `${SUPABASE_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(
          emailId ? { email_sent_at: new Date().toISOString() } : { email_pending: true },
        ),
      },
    )

    if (!markRes.ok) {
      console.error('[waitlist-confirm] Falha ao marcar registro:', markRes.status)
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_id: emailId,
        mode: emailId ? 'resend' : 'pending-mcp',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('[waitlist-confirm] Erro inesperado:', e)
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
