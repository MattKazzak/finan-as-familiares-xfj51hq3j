import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const MAX_AUDIO_BYTES = 5 * 1024 * 1024 // 5MB

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          text: '',
          message: 'Sessão não autenticada. Faça login novamente.',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY') ?? ''

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'OPENAI_API_KEY_NOT_CONFIGURED',
          text: '',
          message: 'Chave OPENAI_API_KEY não configurada no backend.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Validação estrita do JWT do usuário via Supabase Client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          text: '',
          message: 'Sessão expirada ou inválida. Faça login novamente.',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // CUSTO: rate limit por usuário (20 transcrições / 10 min) contra abuso do Whisper
    const { data: rateLimit, error: rateErr } = await supabase.rpc('check_ai_rate_limit', {
      p_function_name: 'voice-transcribe',
      p_max_requests: 20,
      p_window_minutes: 10,
    })
    if (rateErr) {
      console.warn('[voice-transcribe] Rate limit check falhou (fail-open):', rateErr)
    } else if (rateLimit && rateLimit.allowed === false) {
      return new Response(
        JSON.stringify({
          error: 'RATE_LIMITED',
          text: '',
          message:
            'Limite de transcrições por agora atingido. Aguarde alguns minutos e tente de novo.',
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_CONTENT_TYPE',
          text: '',
          message: 'Requisição deve ser multipart/form-data com campo audio.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const formData = await req.formData()
    const audioEntry = formData.get('audio') || formData.get('file')

    if (!audioEntry || !(audioEntry instanceof File || audioEntry instanceof Blob)) {
      return new Response(
        JSON.stringify({
          error: 'MISSING_AUDIO_FILE',
          text: '',
          message: 'Nenhum arquivo de áudio enviado.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (audioEntry.size === 0) {
      return new Response(
        JSON.stringify({
          error: 'EMPTY_AUDIO_FILE',
          text: '',
          message: 'O arquivo de áudio enviado está vazio.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (audioEntry.size > MAX_AUDIO_BYTES) {
      return new Response(
        JSON.stringify({
          error: 'AUDIO_TOO_LARGE',
          text: '',
          message: 'O arquivo de áudio excede o limite máximo de 5MB.',
        }),
        {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Determina extensão apropriada baseada no tipo ou nome original
    let fileName = 'audio.webm'
    const originalName = audioEntry instanceof File ? audioEntry.name : ''
    const mime = audioEntry.type || ''

    if (originalName && originalName.includes('.')) {
      fileName = originalName
    } else if (mime.includes('mp4') || mime.includes('m4a')) {
      fileName = 'audio.mp4'
    } else if (mime.includes('ogg')) {
      fileName = 'audio.ogg'
    } else if (mime.includes('wav')) {
      fileName = 'audio.wav'
    } else if (mime.includes('mpeg') || mime.includes('mp3')) {
      fileName = 'audio.mp3'
    }

    // Prepara payload multipart para OpenAI Audio Transcriptions API
    const openaiFormData = new FormData()
    openaiFormData.append('file', audioEntry, fileName)
    openaiFormData.append('model', 'whisper-1')
    openaiFormData.append('language', 'pt')
    openaiFormData.append('response_format', 'json')
    openaiFormData.append(
      'prompt',
      // Prompt de domínio: viesa o Whisper para o vocabulário financeiro pt-BR do app
      // (marcas, métodos de pagamento, estabelecimentos). Máx ~60 tokens, sem transcrever literalmente.
      'Registro de gastos por voz em português do Brasil. Vocabulário: reais, centavos, pix, débito, crédito, dinheiro, cartão, supermercado, atacado, hortifruti, padaria, farmácia, posto, gasolina, etanol, uber, 99, ifood, mercado, aluguel, condomínio, luz, água, internet, boleto, parcelado, à vista, churrasco, salário, receita, gastei, paguei, lancei.',
    )

    // Timeout de 20s: falha rápido em vez de deixar o usuário esperando indefinidamente
    const openaiController = new AbortController()
    const openaiTimeout = setTimeout(() => openaiController.abort(), 20000)

    let openAiResponse: Response
    try {
      openAiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: openaiFormData,
        signal: openaiController.signal,
      })
    } catch (fetchErr: any) {
      clearTimeout(openaiTimeout)
      const isTimeout = fetchErr?.name === 'AbortError'
      return new Response(
        JSON.stringify({
          error: isTimeout ? 'WHISPER_TIMEOUT' : 'OPENAI_WHISPER_NETWORK',
          text: '',
          message: isTimeout
            ? 'A transcrição demorou demais e foi cancelada. Toque no microfone e fale de novo — frases mais curtas ajudam.'
            : 'Falha de conexão com o serviço de transcrição. Verifique a internet e tente de novo.',
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }
    clearTimeout(openaiTimeout)

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text()
      console.warn('Erro na API OpenAI Whisper:', openAiResponse.status, errorText)
      let parsedError = ''
      try {
        const errorJson = JSON.parse(errorText)
        parsedError = errorJson?.error?.message || errorText
      } catch {
        parsedError = errorText
      }

      return new Response(
        JSON.stringify({
          error: 'OPENAI_WHISPER_ERROR',
          status: openAiResponse.status,
          text: '',
          message: `Falha ao transcrever o áudio: ${parsedError || 'Erro na transcrição'}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const openAiData = await openAiResponse.json()
    const transcribedText = (openAiData?.text || '').trim()

    return new Response(
      JSON.stringify({
        text: transcribedText,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err: any) {
    console.warn('Exceção na Edge Function voice-transcribe:', err)
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_SERVER_ERROR',
        text: '',
        message: err?.message || 'Erro inesperado ao processar transcrição de voz.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
