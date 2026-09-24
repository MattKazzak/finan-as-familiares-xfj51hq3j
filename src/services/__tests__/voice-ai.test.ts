import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseVoiceWithAi } from '../voice-ai'
import { supabase } from '@/lib/supabase/client'

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

describe('voice-ai service (fim do fallback silencioso)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna aiStatus "invalido" e mensagem vazia se texto for em branco', async () => {
    const res = await parseVoiceWithAi({ texto: '   ' })
    expect(res.aiStatus).toBe('invalido')
    expect(res.amountCents).toBe(0)
    expect(res.friendlyMessage).toContain('Nenhum texto informado')
  })

  it('quando a Edge Function retornar erro 401 Unauthorized, captura o erro e NÃO aciona fallback local', async () => {
    const mockError = {
      message: 'Unauthorized',
      context: {
        status: 401,
        json: async () => ({
          status: 'invalido',
          mensagem_amigavel: 'Sessão expirada. Faça login novamente.',
        }),
      },
    }

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: mockError as any,
    })

    const res = await parseVoiceWithAi({ texto: 'Almoço 45 reais' })

    // Não deve fazer fallback local para status "sucesso"
    expect(res.aiStatus).toBe('invalido')
    expect(res.amountCents).toBe(0)
    expect(res.processingSource).toBe('openai')
    expect(res.aiError).toBe('Falha na IA [HTTP 401]: Sessão expirada. Faça login novamente.')
    expect(res.friendlyMessage).toContain('Falha na IA [HTTP 401]')
    expect(res.friendlyMessage).toContain('Toque para tentar novamente.')
  })

  it('quando a Edge Function retornar erro 500 ou 502 da OpenAI, retorna erro explícito sem fallback mascarado', async () => {
    const mockError = {
      message: 'Bad Gateway',
      context: {
        status: 502,
        json: async () => ({
          status: 'invalido',
          error: 'OPENAI_ERROR',
          error_detail: 'Erro OpenAI: rate limit exceeded (HTTP 429)',
        }),
      },
    }

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: mockError as any,
    })

    const res = await parseVoiceWithAi({ texto: 'Supermercado 180 no pix' })

    expect(res.aiStatus).toBe('invalido')
    expect(res.amountCents).toBe(0)
    expect(res.aiError).toBe('Falha na IA [HTTP 502]: Erro OpenAI: rate limit exceeded (HTTP 429)')
    expect(res.friendlyMessage).toBe(
      'Falha na IA [HTTP 502]: Erro OpenAI: rate limit exceeded (HTTP 429). Toque para tentar novamente.',
    )
  })

  it('quando a Edge Function retornar data com error_detail (ex: chave OpenAI ausente)', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        status: 'invalido',
        error: 'OPENAI_API_KEY_NOT_CONFIGURED',
        error_detail: 'Chave OPENAI_API_KEY não configurada no backend Supabase.',
        transacao: null,
        pergunta_clarificacao: null,
        opcoes_sugestao: null,
        mensagem_amigavel: 'Chave não configurada.',
      },
      error: null,
    })

    const res = await parseVoiceWithAi({ texto: 'Gasolina 100 reais' })

    expect(res.aiStatus).toBe('invalido')
    expect(res.amountCents).toBe(0)
    expect(res.aiError).toBe(
      'Falha na IA [Erro Edge Function]: Chave OPENAI_API_KEY não configurada no backend Supabase.',
    )
    expect(res.friendlyMessage).toContain('Toque para tentar novamente.')
  })

  it('quando a Edge Function responder com sucesso oficial, mapeia transação para o formato do app', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        status: 'sucesso',
        transacao: {
          descricao: 'Almoço no restaurante',
          valor: 45.5,
          tipo: 'despesa',
          balde: 'Estilo de Vida',
          categoria: 'Alimentação',
          subcategoria: 'Restaurante',
          metodo_pagamento: 'debito',
        },
        pergunta_clarificacao: null,
        opcoes_sugestao: null,
        mensagem_amigavel: null,
      },
      error: null,
    })

    const res = await parseVoiceWithAi({ texto: 'Almoço 45 e 50 no débito' })

    expect(res.aiStatus).toBe('sucesso')
    expect(res.amountCents).toBe(4550)
    expect(res.amountFormatted).toBe('R$\u00a045,50')
    expect(res.description).toBe('Almoço no restaurante')
    expect(res.bucketSuggestion).toBe('lifestyle')
    expect(res.categoryNameSuggestion).toBe('Alimentação')
    expect(res.subcategoryNameSuggestion).toBe('Restaurante')
    expect(res.paymentMethod).toBe('debito')
    expect(res.processingSource).toBe('openai')
    expect(res.aiError).toBeNull()
  })

  it('quando a Edge Function responder com "invalido" (ex: "GPT ormini falando")', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        status: 'invalido',
        transacao: null,
        pergunta_clarificacao: null,
        opcoes_sugestao: null,
        mensagem_amigavel:
          "Não consegui entender esse lançamento financeiro. Tente algo como: 'Almoço 45 reais no débito no restaurante' ou 'supermercado do zé 180 no pix'",
      },
      error: null,
    })

    const res = await parseVoiceWithAi({ texto: 'GPT ormini falando' })

    expect(res.aiStatus).toBe('invalido')
    expect(res.amountCents).toBe(0)
    expect(res.friendlyMessage).toBe(
      "Não consegui entender esse lançamento financeiro. Tente algo como: 'Almoço 45 reais no débito no restaurante' ou 'supermercado do zé 180 no pix'",
    )
    expect(res.aiError).toBeNull()
  })

  it('quando a Edge Function responder com status "falta_valor", mapeia transação parcial sem valor', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        status: 'falta_valor',
        transacao: {
          descricao: '2 pacotes de peta',
          estabelecimento: 'Supermercado',
          valor: null,
          tipo: 'despesa',
          balde: 'Necessidades Essenciais',
          categoria: 'Alimentação',
          subcategoria: 'Supermercado',
          metodo_pagamento: null,
        },
        pergunta_clarificacao: 'Quanto custou?',
        opcoes_sugestao: null,
        mensagem_amigavel: 'Entendi o que você comprou! Quanto custou?',
      },
      error: null,
    })

    const res = await parseVoiceWithAi({ texto: '2 pacotes de peta no supermercado' })

    expect(res.aiStatus).toBe('falta_valor')
    expect(res.amountCents).toBe(0)
    expect(res.description).toBe('2 pacotes de peta')
    expect(res.establishment).toBe('Supermercado')
    expect(res.categoryNameSuggestion).toBe('Alimentação')
    expect(res.clarificationQuestion).toBe('Quanto custou?')
    expect(res.friendlyMessage).toContain('Quanto custou?')
    expect(res.aiError).toBeNull()
  })

  it('aceita e mapeia formalmente os 4 status suportados pela IA: sucesso, clarificacao, falta_valor, invalido', async () => {
    const statuses: Array<'sucesso' | 'clarificacao' | 'falta_valor' | 'invalido'> = [
      'sucesso',
      'clarificacao',
      'falta_valor',
      'invalido',
    ]

    for (const status of statuses) {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: {
          status,
          transacao:
            status === 'sucesso'
              ? {
                  descricao: 'Teste',
                  valor: 50,
                  tipo: 'despesa',
                  balde: 'Estilo de Vida',
                  categoria: 'Lazer',
                  subcategoria: 'Cinema',
                  metodo_pagamento: 'pix',
                }
              : status === 'falta_valor'
                ? {
                    descricao: 'Gasolina no posto',
                    valor: null,
                    tipo: 'despesa',
                    balde: 'Necessidades Essenciais',
                    categoria: 'Transporte',
                    subcategoria: 'Combustível',
                    metodo_pagamento: null,
                  }
                : null,
          pergunta_clarificacao: status === 'falta_valor' ? 'Quanto custou?' : null,
          opcoes_sugestao: null,
          mensagem_amigavel: 'ok',
        },
        error: null,
      })

      const res = await parseVoiceWithAi({ texto: 'teste' })
      expect(res.aiStatus).toBe(status)
    }
  })
})
