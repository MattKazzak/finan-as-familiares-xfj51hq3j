import { supabase } from '@/lib/supabase/client'
import {
  VoiceAiResponse,
  ParsedVoiceTransaction,
  mapAiResponseToParsedTransaction,
  parseVoiceInput,
} from './voice-parser'

export interface VoiceAiPreviousContext {
  descricao?: string
  estabelecimento?: string | null
  valor?: number | null
  categoria?: string | null
  subcategoria?: string | null
  balde?: string | null
  tipo?: 'despesa' | 'receita'
  status?: string | null
  opcoes_sugestao?: any[] | null
  lastCreatedTransactionId?: string | null
}
export interface CategoryPayloadInput {
  id?: string
  name: string
  type: string
  budget_bucket?: string | null
  subcategories?: Array<{ id?: string; name: string }>
}

export interface ChatMessagePayload {
  role: 'user' | 'assistant'
  content: string
}

export interface ParseVoiceWithAiOptions {
  texto: string
  familyId?: string
  categories?: Array<{
    id: string
    name: string
    type: string
    budget_bucket?: string | null
    subcategories?: Array<{ id: string; name: string }>
  }>
  contexto_anterior?: VoiceAiPreviousContext | null
  historico_mensagens?: ChatMessagePayload[] | null
}

/**
 * Invoca a Edge Function 'voice-parse' no Supabase autenticado.
 * Se falhar por erro de rede ou indisponibilidade, faz fallback transparente para o parser local em pt-BR.
 */
export async function parseVoiceWithAi({
  texto,
  familyId,
  categories = [],
  contexto_anterior,
  historico_mensagens,
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
    const serializedCategories = categories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      budget_bucket: c.budget_bucket,
      subcategories: (c.subcategories || []).map((s) => ({ id: s.id, name: s.name })),
    }))

    const { data, error } = await supabase.functions.invoke<VoiceAiResponse>('voice-parse', {
      body: {
        texto: trimmed,
        familyId,
        contexto_anterior: contexto_anterior || null,
        historico_mensagens:
          Array.isArray(historico_mensagens) && historico_mensagens.length > 0
            ? historico_mensagens.slice(-6)
            : null,
        categorias: serializedCategories.length > 0 ? serializedCategories : null,
      },
    })

    if (error) {
      console.warn('Erro ao invocar edge function voice-parse:', error)
      let detailedError = error.message || 'Falha na conexão com a Edge Function'
      let httpStatus: number | string | null = null

      // Se a resposta contiver contexto de erro ou status HTTP da function
      const anyError = error as any
      if (anyError?.context?.status) {
        httpStatus = anyError.context.status
      }

      if (anyError?.context?.json) {
        try {
          const bodyJson = await anyError.context.json()
          if (bodyJson?.error_detail) {
            detailedError = bodyJson.error_detail
          } else if (bodyJson?.error) {
            detailedError = `Erro OpenAI: ${bodyJson.error}`
          } else if (bodyJson?.mensagem_amigavel) {
            detailedError = bodyJson.mensagem_amigavel
          }
        } catch {
          // ignora falha de parse
        }
      }

      const statusTag = httpStatus ? `HTTP ${httpStatus}` : 'Erro na requisição'
      const aiError = `Falha na IA [${statusTag}]: ${detailedError}`
      const friendlyMessage = `${aiError}. Toque para tentar novamente.`

      return {
        rawText: trimmed,
        amountCents: 0,
        amountFormatted: 'R$ 0,00',
        type: 'expense',
        description: trimmed,
        confidence: 0,
        processingSource: 'openai',
        aiStatus: 'invalido',
        aiError,
        friendlyMessage,
      }
    }

    if (!data || !data.status) {
      console.warn('Resposta vazia da edge function voice-parse')
      const aiError = 'Falha na IA [Resposta Vazia]: Resposta vazia ou inválida da Edge Function'
      return {
        rawText: trimmed,
        amountCents: 0,
        amountFormatted: 'R$ 0,00',
        type: 'expense',
        description: trimmed,
        confidence: 0,
        processingSource: 'openai',
        aiStatus: 'invalido',
        aiError,
        friendlyMessage: `${aiError}. Toque para tentar novamente.`,
      }
    }

    // Se a edge function retornou status mas com erro explícito (ex: 500, chave não configurada ou erro OpenAI)
    if (data.error || data.error_detail) {
      const edgeErrorMsg =
        data.error_detail || (data.error === 'OPENAI_ERROR' ? 'Erro na API da OpenAI' : data.error)
      const statusTag = data.openai_status ? `HTTP ${data.openai_status}` : 'Erro Edge Function'
      const aiError = `Falha na IA [${statusTag}]: ${edgeErrorMsg}`
      return {
        rawText: trimmed,
        amountCents: 0,
        amountFormatted: 'R$ 0,00',
        type: 'expense',
        description: trimmed,
        confidence: 0,
        processingSource: 'openai',
        aiStatus: 'invalido',
        aiError,
        friendlyMessage: `${aiError}. Toque para tentar novamente.`,
      }
    }

    // Sucesso ou clarificação ou inválido retornado da IA com estrutura oficial
    return mapAiResponseToParsedTransaction(data, trimmed)
  } catch (err: any) {
    console.warn('Exceção ao chamar edge function voice-parse:', err)
    const detailedError = err?.message || 'Exceção ao conectar com a inteligência de voz'
    const aiError = `Falha na IA [Exceção]: ${detailedError}`
    return {
      rawText: trimmed,
      amountCents: 0,
      amountFormatted: 'R$ 0,00',
      type: 'expense',
      description: trimmed,
      confidence: 0,
      processingSource: 'openai',
      aiStatus: 'invalido',
      aiError,
      friendlyMessage: `${aiError}. Toque para tentar novamente.`,
    }
  }
}
