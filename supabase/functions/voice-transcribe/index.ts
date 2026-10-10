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
      'Transcreva gastos, receitas e compras em português do Brasil: reais, centavos, pix, cartão, débito, crédito, supermercado, farmácia.',
    )

    const openAiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: openaiFormData,
    })

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
