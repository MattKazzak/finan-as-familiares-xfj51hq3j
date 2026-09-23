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
      const localParsed = parseVoiceInput(trimmed, categories)
      return localParsed
    }

    if (!data || !data.status) {
      console.warn('Resposta vazia da edge function voice-parse, acionando fallback local')
      const localParsed = parseVoiceInput(trimmed, categories)
      return localParsed
    }

    // Sucesso ou clarificação ou inválido retornado da IA com estrutura oficial
    return mapAiResponseToParsedTransaction(data, trimmed)
  } catch (err) {
    console.warn('Exceção ao chamar edge function voice-parse, usando fallback local:', err)
    return parseVoiceInput(trimmed, categories)
  }
}
