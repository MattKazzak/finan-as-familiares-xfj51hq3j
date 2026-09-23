import { supabase } from '@/lib/supabase/client'
import {
  VoiceAiResponse,
  ParsedVoiceTransaction,
  mapAiResponseToParsedTransaction,
  parseVoiceInput,
} from './voice-parser'

export interface ParseVoiceWithAiOptions {
  texto: string
  familyId?: string
  categories?: Array<{ id: string; name: string; type: string; budget_bucket?: string | null }>
}

/**
 * Invoca a Edge Function 'voice-parse' no Supabase autenticado.
 * Se falhar por erro de rede ou indisponibilidade, faz fallback transparente para o parser local em pt-BR.
 */
export async function parseVoiceWithAi({
  texto,
  familyId,
  categories = [],
}: ParseVoiceWithAiOptions): Promise<ParsedVoiceTransaction> {
  const trimmed = texto.trim()
  if (!trimmed) {
    return {
      rawText: '',
      amountCents: 0,
      amountFormatted: 'R$ 0,00',
      type: 'expense',
      description: '',
      confidence: 0,
      aiStatus: 'invalido',
      friendlyMessage: 'Nenhum texto informado para processar.',
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke<VoiceAiResponse>('voice-parse', {
      body: { texto: trimmed, familyId },
    })

    if (error) {
      console.warn('Erro ao invocar edge function voice-parse, acionando fallback local:', error)
      let detailedError = error.message || 'Falha na conexão com a Edge Function'

      // Se a resposta contiver contexto de erro ou status HTTP da function
      const anyError = error as any
      if (anyError?.context?.json) {
        try {
          const bodyJson = await anyError.context.json()
          if (bodyJson?.error_detail) {
            detailedError = bodyJson.error_detail
          } else if (bodyJson?.error) {
            detailedError = `Erro OpenAI: ${bodyJson.error}`
          }
        } catch {
          // ignora
        }
      } else if (anyError?.context?.status) {
        detailedError = `Erro Edge Function (HTTP ${anyError.context.status}): ${detailedError}`
      }

      const localParsed = parseVoiceInput(trimmed, categories)
      return {
        ...localParsed,
        processingSource: 'local',
        aiError: detailedError,
      }
    }

    if (!data || !data.status) {
      console.warn('Resposta vazia da edge function voice-parse, acionando fallback local')
      const localParsed = parseVoiceInput(trimmed, categories)
      return {
        ...localParsed,
        processingSource: 'local',
        aiError: 'Resposta vazia ou inválida da Edge Function',
      }
    }

    // Se a edge function retornou status mas com erro (ex: chave não configurada ou erro OpenAI)
    if (data.error || data.error_detail) {
      const edgeErrorMsg =
        data.error_detail || (data.error === 'OPENAI_ERROR' ? 'Erro na API da OpenAI' : data.error)
      const localParsed = parseVoiceInput(trimmed, categories)
      return {
        ...localParsed,
        processingSource: 'local',
        aiError: edgeErrorMsg,
      }
    }

    // Sucesso ou clarificação ou inválido retornado da IA com estrutura oficial
    return mapAiResponseToParsedTransaction(data, trimmed)
  } catch (err: any) {
    console.warn('Exceção ao chamar edge function voice-parse, usando fallback local:', err)
    const localParsed = parseVoiceInput(trimmed, categories)
    return {
      ...localParsed,
      processingSource: 'local',
      aiError: err?.message || 'Exceção ao conectar com a inteligência de voz',
    }
  }
}
