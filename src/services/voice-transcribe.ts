import { supabase } from '@/lib/supabase/client'

export interface TranscribeVoiceAudioResult {
  text: string
  error?: string
  status?: number
}

/**
 * Detecta o melhor MIME type suportado pelo navegador atual para MediaRecorder.
 * Safari iOS suporta prioritariamente audio/mp4; Chrome/Firefox suportam audio/webm;codecs=opus.
 */
export function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return ''
  }

  const preferredCandidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/wav',
  ]

  for (const candidate of preferredCandidates) {
    try {
      if (
        typeof MediaRecorder.isTypeSupported === 'function' &&
        MediaRecorder.isTypeSupported(candidate)
      ) {
        return candidate
      }
    } catch {
      // Ignora erro de verificação em navegadores antigos
    }
  }

  return ''
}

/**
 * Envia o blob de áudio gravado para a Edge Function voice-transcribe (OpenAI Whisper).
 * Retorna o texto transcrito ou erro descritivo.
 */
export async function transcribeVoiceAudio(audioBlob: Blob): Promise<TranscribeVoiceAudioResult> {
  if (!audioBlob || audioBlob.size === 0) {
    return {
      text: '',
      error: 'Áudio vazio ou não capturado.',
    }
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const token = session?.access_token

    let fileExtension = 'webm'
    const blobType = audioBlob.type || ''
    if (blobType.includes('mp4') || blobType.includes('m4a')) {
      fileExtension = 'mp4'
    } else if (blobType.includes('ogg')) {
      fileExtension = 'ogg'
    } else if (blobType.includes('wav')) {
      fileExtension = 'wav'
    } else if (blobType.includes('mpeg') || blobType.includes('mp3')) {
      fileExtension = 'mp3'
    }

    const formData = new FormData()
    formData.append('audio', audioBlob, `gravacao.${fileExtension}`)

    // Chamada direta para o endpoint da Edge Function com FormData
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    const functionUrl = `${supabaseUrl}/functions/v1/voice-transcribe`

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    const responseText = await response.text()
    let parsedJson: any = null
    try {
      parsedJson = JSON.parse(responseText)
    } catch {
      // Resposta não é JSON
    }

    if (!response.ok) {
      const errorMessage =
        parsedJson?.message || parsedJson?.error || `Erro ${response.status} ao transcrever áudio.`
      return {
        text: '',
        error: errorMessage,
        status: response.status,
      }
    }

    const transcribed = (parsedJson?.text || '').trim()
    return {
      text: transcribed,
      status: response.status,
    }
  } catch (err: any) {
    console.warn('Exceção ao chamar transcribeVoiceAudio:', err)
    return {
      text: '',
      error: err?.message || 'Falha de conexão com o servidor de transcrição.',
    }
  }
}
