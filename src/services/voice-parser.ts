/**
 * Parser de texto e fala em pt-BR para Lançamento Inteligente por Voz com IA.
 * Converte linguagem natural falada em transação estruturada.
 */

import type { BudgetBucket } from '@/types/finance'
import {
  isBasketInput,
  analyzeBasketMission,
  interpretFreeTextBasketResponse,
  extractEnumeratedItems,
} from './basket-missions'

export type VoiceAiStatus =
  | 'sucesso'
  | 'clarificacao'
  | 'clarificacao_categoria'
  | 'falta_valor'
  | 'invalido'
  | 'consulta'
  | 'acao_executada'
  | 'modo_cesta'

export interface VoiceAiTransactionItem {
  descricao: string
  quantidade?: number | null
  valor?: number | null
  categoria_proposta?: string | null
  subcategoria_proposta?: string | null
  confianca?: number | null
  requer_confirmacao?: boolean
  duvida_categoria?: boolean
}

export interface VoiceAiTransaction {
  descricao: string
  estabelecimento?: string | null
  valor: number | null
  tipo: 'despesa' | 'receita'
  balde: string // 'Necessidades Essenciais' | 'Estilo de Vida' | 'Metas & Investimentos' | string
  categoria: string | null
  subcategoria: string | null
  metodo_pagamento: string | null
  itens?: VoiceAiTransactionItem[] | null
}

export type SuggestionOptionType = 'existente' | 'nova'

export interface StructuredSuggestionOption {
  tipo: SuggestionOptionType // 'existente' (categoria/subcategoria já no catálogo) vs 'nova' (categoria nova a ser criada)
  rotulo: string // Texto da pílula com ícone, ex: "📁 Usar existente: Lazer › subcategoria Manicure" ou "✨ Criar nova: Cuidados Pessoais (Estilo de Vida)"
  categoria: string // Nome da categoria principal (existente ou a criar)
  subcategoria?: string | null // Subcategoria existente ou provisória
  balde?: string | null // Balde correspondente ('Necessidades Essenciais', 'Estilo de Vida', 'Metas & Investimentos' ou chave)
  categoria_id?: string | null // ID se categoria existente
  subcategoria_id?: string | null // ID se subcategoria existente
}

export type VoiceAiSuggestionItem = string | StructuredSuggestionOption

export interface VoiceAiResponse {
  status: VoiceAiStatus
  acao?:
    | 'criar'
    | 'reclassificar'
    | 'ajustar_valor'
    | 'ajustar_descricao'
    | 'desfazer'
    | string
    | null
  tipo_resposta?: 'transacao' | 'consulta' | 'consultoria_categoria' | 'acao'
  intencao?:
    | 'consultiva'
    | 'escolha_categoria'
    | 'consulta'
    | 'transacao'
    | 'correcao'
    | 'desfazer'
    | 'social'
    | string
    | null
  router?: {
    classe: number | null
    nome_classe?: string | null
    confianca: number | null
    lacunas?: string[] | null
  } | null
  itens?: VoiceAiTransactionItem[] | null
  confianca?: number | null
  lacunas?: string[] | null
  resposta_consulta?: string | null
  transacao: VoiceAiTransaction | null
  pergunta_clarificacao: string | null
  opcoes_sugestao: VoiceAiSuggestionItem[] | null
  opcoes_estruturadas?: StructuredSuggestionOption[] | null
  mensagem_amigavel: string | null
  error?: string | null
  error_detail?: string | null
  openai_status?: number | null
}

export interface ParsedVoiceTransaction {
  rawText: string
  amountCents: number
  amountFormatted: string
  type: 'expense' | 'income'
  description: string
  establishment?: string
  paymentMethod?: 'pix' | 'debito' | 'credito' | 'dinheiro'
  categoryNameSuggestion?: string
  subcategoryNameSuggestion?: string
  bucketSuggestion?: BudgetBucket
  confidence: number
  // Campos da IA enriquecidos e transparência de processamento
  processingSource?: 'openai' | 'local'
  aiStatus?: VoiceAiStatus
  acao?:
    | 'criar'
    | 'reclassificar'
    | 'ajustar_valor'
    | 'ajustar_descricao'
    | 'desfazer'
    | string
    | null
  tipoResposta?: 'transacao' | 'consulta' | 'consultoria_categoria' | 'acao'
  intencao?:
    | 'consultiva'
    | 'escolha_categoria'
    | 'consulta'
    | 'transacao'
    | 'correcao'
    | 'desfazer'
    | string
    | null
  respostaConsulta?: string | null
  clarificationQuestion?: string | null
  clarificationOptions?: string[] | null
  structuredOptions?: StructuredSuggestionOption[] | null
  friendlyMessage?: string | null
  aiError?: string | null
  // Contrato v1.0 — Router de Intenções e Extração Estruturada (R39)
  routerClasse?: number | null
  routerConfianca?: number | null
  routerLacunas?: string[] | null
  extractedItems?: VoiceAiTransactionItem[] | null
  // Rodada 28: Modo Cesta
  isBasket?: boolean
  basketItemsDescription?: string
  basketEventTag?: string
  basketMissionType?: string
  isUncertainSuggestion?: boolean
}

// Mapeamento de números por extenso em português
const UNITS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
}

const TENS: Record<string, number> = {
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
}

const HUNDREDS: Record<string, number> = {
  cem: 100,
  cento: 100,
  duzentos: 200,
  duzentas: 200,
  trezentos: 300,
  trezentas: 300,
  quatrocentos: 400,
  quatrocentas: 400,
  quinhentos: 500,
  quinhentas: 500,
  seiscentos: 600,
  seiscentas: 600,
  setecentos: 700,
  setecentas: 700,
  oitocentos: 800,
  oitocentas: 800,
  novecentos: 900,
  novecentas: 900,
}

const MULTIPLIERS: Record<string, number> = {
  mil: 1000,
  milhao: 1000000,
  milhão: 1000000,
  milhoes: 1000000,
  milhões: 1000000,
}

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Converte sequência de palavras de números em pt-BR para valor numérico.
 * Ex: "oitenta e cinco" -> 85; "cento e cinquenta" -> 150; "dois mil e quinhentos" -> 2500
 */
export function parseWordsToNumber(words: string[]): number | null {
  if (words.length === 0) return null

  let total = 0
  let currentGroup = 0
  let hasNumber = false

  for (let i = 0; i < words.length; i++) {
    const raw = words[i]
    const w = normalizeWord(raw)

    if (w === 'e') continue

    // Verifica unidades
    if (UNITS[w] !== undefined) {
      currentGroup += UNITS[w]
      hasNumber = true
      continue
    }

    // Verifica dezenas
    if (TENS[w] !== undefined) {
      currentGroup += TENS[w]
      hasNumber = true
      continue
    }

    // Verifica centenas
    if (HUNDREDS[w] !== undefined) {
      currentGroup += HUNDREDS[w]
      hasNumber = true
      continue
    }

    // Verifica multiplicadores (mil, milhão)
    if (MULTIPLIERS[w] !== undefined) {
      const mult = MULTIPLIERS[w]
      if (currentGroup === 0) {
        currentGroup = 1
      }
      total += currentGroup * mult
      currentGroup = 0
      hasNumber = true
      continue
    }

    // Se encontramos uma palavra que não é número nem conectivo, encerramos o grupo se já tínhamos algo
    break
  }

  if (!hasNumber) return null
  return total + currentGroup
}

/**
 * Extrai valor monetário (em centavos) de um texto falado em português.
 * Suporta formatos:
 * - "45", "45 reais", "45,50", "45.50", "R$ 45", "45 reais e cinquenta centavos"
 * - "oitenta e cinco reais", "cento e cinquenta e dois reais e cinquenta centavos"
 */
export function extractAmountFromVoiceText(text: string): {
  amountCents: number
  matchedText: string
  cleanedText: string
} {
  const normalized = text.trim()
  if (!normalized) return { amountCents: 0, matchedText: '', cleanedText: text }

  interface CandidateMatch {
    amountCents: number
    matchedText: string
    startIndex: number
    endIndex: number
    hasExplicitTrigger: boolean
    triggerDistance: number
  }

  // 1 & 2. Extrair todos os candidatos numéricos baseados em dígitos
  // Padrão completo que cobre centavos explícitos e inteiros com centavos por extenso
  const digitRegex =
    /(?:r\$\s*)?(\d+)(?:[,.](\d{1,2}))?(?:\s*(?:reais|real))?(?:\s*e\s*(\d{1,2})\s*centavos?)?/gi

  // Gatilhos monetários para cálculo de proximidade
  const triggerRegex = /(?:r\$|reais|real|centavos?)/gi
  const triggers: Array<{ start: number; end: number }> = []
  let tMatch: RegExpExecArray | null
  while ((tMatch = triggerRegex.exec(normalized)) !== null) {
    triggers.push({ start: tMatch.index, end: tMatch.index + tMatch[0].length })
  }

  const digitCandidates: CandidateMatch[] = []
  let dMatch: RegExpExecArray | null

  while ((dMatch = digitRegex.exec(normalized)) !== null) {
    const fullMatch = dMatch[0].trim()
    if (!fullMatch || !dMatch[1]) continue

    const whole = parseInt(dMatch[1], 10)
    let cents = 0

    if (dMatch[2]) {
      let centsPart = dMatch[2]
      if (centsPart.length === 1) centsPart += '0'
      cents = parseInt(centsPart.slice(0, 2), 10)
    } else if (dMatch[3]) {
      cents = parseInt(dMatch[3], 10)
    }

    const amountCents = whole * 100 + cents
    if (amountCents <= 0) continue

    const startIndex = dMatch.index
    const endIndex = dMatch.index + dMatch[0].length

    // Tem gatilho diretamente dentro do match (ex: "R$ 45", "45 reais", "45 centavos")
    const hasExplicitTrigger = /(?:r\$|reais|real|centavos?)/i.test(fullMatch)

    // Calcula distância mínima até qualquer gatilho no texto
    let minDistance = Infinity
    for (const tr of triggers) {
      if (tr.start >= startIndex && tr.end <= endIndex) {
        minDistance = 0
        break
      }
      const dist = Math.min(Math.abs(startIndex - tr.end), Math.abs(tr.start - endIndex))
      if (dist < minDistance) {
        minDistance = dist
      }
    }

    digitCandidates.push({
      amountCents,
      matchedText: fullMatch,
      startIndex,
      endIndex,
      hasExplicitTrigger,
      triggerDistance: minDistance,
    })
  }

  // (1) Se houver candidato dígito com gatilho monetário explícito (R$ ou reais/real/centavos)
  const explicitCandidates = digitCandidates.filter((c) => c.hasExplicitTrigger)
  if (explicitCandidates.length > 0) {
    // Escolhe o candidato mais prioritário (distância 0) e em caso de múltiplos, o de maior valor ou primeiro
    const best = explicitCandidates[0]
    return {
      amountCents: best.amountCents,
      matchedText: best.matchedText,
      cleanedText: normalized
        .replace(best.matchedText, '')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    }
  }

  // (2) Entre múltiplos candidatos dígitos, o mais próximo de gatilho monetário (se triggerDistance < Infinity)
  const candidatesNearTrigger = digitCandidates.filter((c) => c.triggerDistance < Infinity)
  if (candidatesNearTrigger.length > 0) {
    candidatesNearTrigger.sort((a, b) => a.triggerDistance - b.triggerDistance)
    const best = candidatesNearTrigger[0]
    return {
      amountCents: best.amountCents,
      matchedText: best.matchedText,
      cleanedText: normalized
        .replace(best.matchedText, '')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    }
  }

  // (3) Procurar números por extenso (ex: "oitenta e cinco reais", "duzentos e cinquenta reais")
  const tokens = normalized.split(/\s+/)
  const isNumberWord = (word: string) => {
    const w = normalizeWord(word)
    return (
      w === 'e' ||
      UNITS[w] !== undefined ||
      TENS[w] !== undefined ||
      HUNDREDS[w] !== undefined ||
      MULTIPLIERS[w] !== undefined
    )
  }

  for (let start = 0; start < tokens.length; start++) {
    const firstWord = normalizeWord(tokens[start])
    if (
      firstWord !== 'e' &&
      (UNITS[firstWord] !== undefined ||
        TENS[firstWord] !== undefined ||
        HUNDREDS[firstWord] !== undefined ||
        MULTIPLIERS[firstWord] !== undefined)
    ) {
      let end = start
      while (end < tokens.length && isNumberWord(tokens[end])) {
        end++
      }

      const numberWords = tokens.slice(start, end)
      const whole = parseWordsToNumber(numberWords)

      if (whole !== null && whole > 0) {
        let matchedWords = [...numberWords]
        let currentIdx = end
        let cents = 0

        // Verificar se segue "reais" ou "real"
        if (
          currentIdx < tokens.length &&
          /^(reais|real)$/i.test(normalizeWord(tokens[currentIdx]))
        ) {
          matchedWords.push(tokens[currentIdx])
          currentIdx++
        }

        // Verificar se tem centavos: "e vinte centavos", "e 50 centavos"
        if (currentIdx < tokens.length && normalizeWord(tokens[currentIdx]) === 'e') {
          const nextIdx = currentIdx + 1
          if (nextIdx < tokens.length) {
            if (/^\d{1,2}$/.test(tokens[nextIdx])) {
              const cVal = parseInt(tokens[nextIdx], 10)
              matchedWords.push(tokens[currentIdx], tokens[nextIdx])
              currentIdx = nextIdx + 1
              if (
                currentIdx < tokens.length &&
                /^centavos?$/i.test(normalizeWord(tokens[currentIdx]))
              ) {
                matchedWords.push(tokens[currentIdx])
                currentIdx++
              }
              cents = cVal
            } else if (isNumberWord(tokens[nextIdx])) {
              let centEnd = nextIdx
              while (centEnd < tokens.length && isNumberWord(tokens[centEnd])) {
                centEnd++
              }
              const centsWords = tokens.slice(nextIdx, centEnd)
              const cVal = parseWordsToNumber(centsWords)
              if (cVal !== null) {
                matchedWords.push(tokens[currentIdx], ...centsWords)
                currentIdx = centEnd
                if (
                  currentIdx < tokens.length &&
                  /^centavos?$/i.test(normalizeWord(tokens[currentIdx]))
                ) {
                  matchedWords.push(tokens[currentIdx])
                  currentIdx++
                }
                cents = cVal
              }
            }
          }
        }

        const matchedString = matchedWords.join(' ')
        const cleaned = normalized
          .replace(matchedString, '')
          .replace(/\s{2,}/g, ' ')
          .trim()
        return {
          amountCents: whole * 100 + cents,
          matchedText: matchedString,
          cleanedText: cleaned,
        }
      }
    }
  }

  // (4) Último caso: primeiro número da frase (mantém "gastei 50" -> 5000)
  if (digitCandidates.length > 0) {
    const firstCandidate = digitCandidates[0]
    return {
      amountCents: firstCandidate.amountCents,
      matchedText: firstCandidate.matchedText,
      cleanedText: normalized
        .replace(firstCandidate.matchedText, '')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    }
  }

  return { amountCents: 0, matchedText: '', cleanedText: normalized }
}

/**
 * Detecta método de pagamento a partir do texto
 */
export function extractPaymentMethod(text: string): {
  method?: 'pix' | 'debito' | 'credito' | 'dinheiro'
  cleanedText: string
} {
  const norm = normalizeWord(text)
  let cleaned = text

  if (/\b(pix|no pix|via pix)\b/i.test(norm)) {
    cleaned = cleaned.replace(/\b(no\s+pix|via\s+pix|pix)\b/gi, '').trim()
    return { method: 'pix', cleanedText: cleaned }
  }

  if (/\b(debito|no debito|cartao de debito)\b/i.test(norm)) {
    cleaned = cleaned
      .replace(/\b(cart[aã]o\s+de\s+d[eé]bito|no\s+d[eé]bito|d[eé]bito)\b/gi, '')
      .trim()
    return { method: 'debito', cleanedText: cleaned }
  }

  if (/\b(credito|no credito|cartao de credito|cartao)\b/i.test(norm)) {
    cleaned = cleaned
      .replace(/\b(cart[aã]o\s+de\s+cr[eé]dito|no\s+cr[eé]dito|cr[eé]dito|no\s+cart[aã]o)\b/gi, '')
      .trim()
    return { method: 'credito', cleanedText: cleaned }
  }

  if (/\b(dinheiro|em dinheiro|especie|em especie)\b/i.test(norm)) {
    cleaned = cleaned
      .replace(/\b(em\s+dinheiro|dinheiro|em\s+esp[eé]cie|esp[eé]cie)\b/gi, '')
      .trim()
    return { method: 'dinheiro', cleanedText: cleaned }
  }

  return { cleanedText: cleaned }
}

/**
 * Detecta se é receita ou despesa
 */
export function extractTransactionType(text: string): {
  type: 'expense' | 'income'
  cleanedText: string
} {
  const norm = normalizeWord(text)
  const incomeKeywords = [
    'recebi',
    'recebimento',
    'salario',
    'salário',
    'renda',
    'pro-labore',
    'prolabore',
    'pix recebido',
    'deposito recebido',
    'venda',
    'reembolso',
    'dividendo',
    'rendimento',
  ]

  for (const kw of incomeKeywords) {
    const reg = new RegExp(`\\b${normalizeWord(kw)}\\b`, 'i')
    if (reg.test(norm)) {
      const cleanReg = new RegExp(`\\b${kw}\\b`, 'gi')
      return {
        type: 'income',
        cleanedText: text.replace(cleanReg, '').trim(),
      }
    }
  }

  // Palavras de despesa explícitas que podem ser removidas da descrição limpa
  const expensePrefixes = [
    'paguei',
    'gastei',
    'comprei',
    'compra de',
    'compra na',
    'compra no',
    'pagamento de',
    'pagamento da',
    'pagamento do',
    'gasto com',
    'gasto no',
    'gasto na',
  ]

  let cleaned = text
  for (const exp of expensePrefixes) {
    const reg = new RegExp(`^${exp}\\s*`, 'i')
    if (reg.test(cleaned)) {
      cleaned = cleaned.replace(reg, '').trim()
      break
    }
  }

  return {
    type: 'expense',
    cleanedText: cleaned,
  }
}

/**
 * Sugere categoria e balde com base em palavras-chave inteligentes
 */
export interface CategoryWithSubcategoriesInput {
  id: string
  name: string
  type: string
  budget_bucket?: string | null
  subcategories?: Array<{ id: string; name: string }>
}

export function suggestCategoryAndBucket(
  description: string,
  categories: Array<CategoryWithSubcategoriesInput>,
): {
  categoryName?: string
  categoryId?: string
  subcategoryName?: string
  bucket?: BudgetBucket
  isExistingSubcategory?: boolean
} {
  const norm = normalizeWord(description)

  // 1. PRIORIDADE ABSOLUTA: Procurar se o termo falado casa diretamente com uma SUBCATEGORIA já existente de qualquer categoria da família
  for (const cat of categories) {
    if (cat.subcategories && cat.subcategories.length > 0) {
      for (const sub of cat.subcategories) {
        const subNorm = normalizeWord(sub.name)
        if (subNorm && (norm.includes(subNorm) || subNorm.includes(norm))) {
          return {
            categoryName: cat.name,
            categoryId: cat.id,
            subcategoryName: sub.name,
            bucket: normalizeBucketName(cat.budget_bucket),
            isExistingSubcategory: true,
          }
        }
      }
    }
  }

  // 2. Procurar nas categorias do usuário por correspondência direta de nome
  for (const cat of categories) {
    const catNorm = normalizeWord(cat.name)
    if (catNorm && (norm.includes(catNorm) || catNorm.includes(norm))) {
      return {
        categoryName: cat.name,
        categoryId: cat.id,
        bucket: normalizeBucketName(cat.budget_bucket),
      }
    }
  }

  // Mapeamentos semânticos comuns em pt-BR (respeitando que beleza/estética/lazer nunca vão para fixo)
  const KEYWORD_MAP: Array<{
    keywords: string[]
    defaultCategory: string
    bucket: BudgetBucket
    candidateExistingCategories?: string[]
  }> = [
    // Essenciais
    {
      keywords: [
        'supermercado',
        'mercado',
        'padaria',
        'acougue',
        'feira',
        'sacolao',
        'mercearia',
        'hortifruti',
      ],
      defaultCategory: 'Alimentação',
      bucket: 'essentials',
    },
    // Bebês & Crianças (Compras)
    {
      keywords: [
        'fralda',
        'fraldas',
        'enxoval',
        'bebe',
        'bebes',
        'crianca',
        'criancas',
        'ri happy',
      ],
      defaultCategory: 'Compras',
      bucket: 'lifestyle',
      candidateExistingCategories: ['Compras', 'Bebês & Crianças'],
    },
    // Tabaco & Cigarros (Compras) — rodada 27B
    {
      keywords: [
        'cigarro',
        'cigarros',
        'cigarro eletronico',
        'vape',
        'tabaco',
        'tabacaria',
        'charuto',
      ],
      defaultCategory: 'Compras',
      bucket: 'lifestyle',
      candidateExistingCategories: ['Compras'],
    },
    {
      keywords: [
        'farmacia',
        'remedio',
        'drogaria',
        'medico',
        'consulta',
        'exame',
        'dentista',
        'hospital',
        'saude',
      ],
      defaultCategory: 'Saúde',
      bucket: 'essentials',
    },
    {
      keywords: [
        'aluguel',
        'condominio',
        'luz',
        'energia',
        'agua',
        'gas',
        'internet',
        'iptu',
        'moradia',
        'casa',
      ],
      defaultCategory: 'Moradia',
      bucket: 'essentials',
    },
    {
      keywords: [
        'gasolina',
        'combustivel',
        'posto',
        'uber',
        'onibus',
        'metro',
        'estacionamento',
        'pedagio',
        'mecanico',
        'troca de oleo',
      ],
      defaultCategory: 'Transporte',
      bucket: 'essentials',
    },
    {
      keywords: ['escola', 'faculdade', 'curso', 'mensalidade', 'livro', 'caderno', 'educacao'],
      defaultCategory: 'Educação',
      bucket: 'essentials',
    },
    // Estilo de Vida
    {
      keywords: [
        'almoco',
        'jantar',
        'restaurante',
        'lanche',
        'pizza',
        'hamburguer',
        'cerveja',
        'chope',
        'bar',
        'boteco',
        'cafe',
        'sorvete',
        'ifood',
        'delivery',
      ],
      defaultCategory: 'Alimentação / Lazer',
      bucket: 'lifestyle',
    },
    {
      keywords: [
        'cinema',
        'show',
        'teatro',
        'viagem',
        'hotel',
        'passeio',
        'praia',
        'parque',
        'clube',
        'festa',
        'lazer',
      ],
      defaultCategory: 'Lazer',
      bucket: 'lifestyle',
    },
    {
      keywords: [
        'roupa',
        'calcado',
        'tenis',
        'camisa',
        'shopping',
        'vestuario',
        'acessorio',
        'perfume',
        'maquiagem',
        'salao',
        'barbearia',
        'corte de cabelo',
        'manicure',
        'pedicure',
        'unhas',
        'depilacao',
        'massagem',
        'estetica',
      ],
      defaultCategory: 'Cuidados Pessoais',
      bucket: 'lifestyle',
      candidateExistingCategories: ['Lazer', 'Estilo de Vida', 'Cuidados Pessoais', 'Beleza'],
    },
    {
      keywords: [
        'netflix',
        'spotify',
        'prime',
        'streaming',
        'assinatura',
        'jogos',
        'games',
        'videogame',
      ],
      defaultCategory: 'Assinaturas',
      bucket: 'lifestyle',
    },
    // Metas & Investimentos
    {
      keywords: [
        'investimento',
        'reserva',
        'poupanca',
        'acao',
        'cdb',
        'tesouro',
        'meta',
        'guardar',
        'cripto',
        'fundo',
      ],
      defaultCategory: 'Investimentos',
      bucket: 'future',
    },
    // Receitas
    {
      keywords: [
        'salario',
        'pagamento',
        'pro labore',
        'adiantamento',
        'vale',
        '13',
        'decimo terceiro',
      ],
      defaultCategory: 'Salário',
      bucket: 'essentials',
    },
  ]

  // 3. Procurar pelo KEYWORD_MAP respeitando priorização de categorias existentes da família
  for (const entry of KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (new RegExp(`\\b${normalizeWord(kw)}\\b`, 'i').test(norm)) {
        // Primeiro: verificar se a família já tem alguma categoria compatível no mesmo balde (ex: família tem "Lazer", gasto é "manicure")
        if (entry.candidateExistingCategories && entry.candidateExistingCategories.length > 0) {
          const compatibleExisting = categories.find((c) => {
            const cNorm = normalizeWord(c.name)
            const cBucket = normalizeBucketName(c.budget_bucket)
            if (cBucket !== entry.bucket) return false
            return entry.candidateExistingCategories!.some((cand) =>
              cNorm.includes(normalizeWord(cand)),
            )
          })

          if (compatibleExisting) {
            // Sugere a categoria existente da família e usa a palavra-chave como subcategoria
            return {
              categoryName: compatibleExisting.name,
              categoryId: compatibleExisting.id,
              subcategoryName: kw.charAt(0).toUpperCase() + kw.slice(1),
              bucket: normalizeBucketName(compatibleExisting.budget_bucket),
            }
          }
        }

        // Segundo: Encontrar categoria da família que melhor case com o defaultCategory ou keywords
        const matchedUserCat = categories.find((c) => {
          const cNameNorm = normalizeWord(c.name)
          return (
            cNameNorm.includes(normalizeWord(entry.defaultCategory)) ||
            entry.keywords.some((k) => cNameNorm.includes(normalizeWord(k)))
          )
        })

        if (matchedUserCat) {
          return {
            categoryName: matchedUserCat.name,
            categoryId: matchedUserCat.id,
            subcategoryName: kw.charAt(0).toUpperCase() + kw.slice(1),
            bucket: normalizeBucketName(matchedUserCat.budget_bucket),
          }
        }

        return {
          categoryName: entry.defaultCategory,
          subcategoryName: kw.charAt(0).toUpperCase() + kw.slice(1),
          bucket: entry.bucket,
        }
      }
    }
  }

  return {}
}

/**
 * Função principal que processa a frase falada completa
 */
export interface LocalParsePreviousContext {
  descricao?: string
  estabelecimento?: string | null
  categoria?: string
  subcategoria?: string
  balde?: string
  tipo?: 'despesa' | 'receita'
  valor?: number | null
  status?: string | null
  opcoes_sugestao?: any[] | null
  opcoes_estruturadas?: StructuredSuggestionOption[] | null
}

/**
 * Detecta se o usuário está perguntando se uma categoria já existe no catálogo da família.
 * Exemplos: "Nós temos essa categoria?", "Essa categoria já existe?", "Já temos essa categoria cadastrada?"
 */
export function isAskingIfCategoryExists(text: string): boolean {
  const norm = normalizeWord(text)
  const patterns = [
    /temos\s+essa\s+categoria/,
    /temos\s+a\s+categoria/,
    /essa\s+categoria\s+ja\s+existe/,
    /essa\s+categoria\s+existe/,
    /ja\s+temos\s+essa\s+categoria/,
    /ja\s+temos\s+essa/,
    /ja\s+esta\s+cadastrada/,
    /ja\s+ta\s+cadastrada/,
    /categoria\s+ja\s+cadastrada/,
    /a\s+gente\s+tem\s+essa/,
    /tem\s+essa\s+categoria/,
    /existe\s+essa\s+categoria/,
  ]
  return patterns.some((p) => p.test(norm))
}

/**
 * Helper para verificar honestamente se uma categoria ou subcategoria de fato consta na lista da família.
 */
export function categoryExistsInFamilyList(
  categoryName: string,
  categories: Array<
    CategoryWithSubcategoriesInput | { id?: string; name: string; subcategories?: any[] }
  >,
): boolean {
  const norm = normalizeWord(categoryName)
  if (!norm) return false
  return categories.some((c) => {
    const cNorm = normalizeWord(c.name)
    if (cNorm === norm || cNorm.includes(norm) || norm.includes(cNorm)) return true
    if (c.subcategories && Array.isArray(c.subcategories)) {
      return c.subcategories.some((s: any) => {
        const sName = typeof s === 'string' ? s : s?.name || ''
        const sNorm = normalizeWord(sName)
        return sNorm && (sNorm === norm || sNorm.includes(norm) || norm.includes(sNorm))
      })
    }
    return false
  })
}

/**
 * Valida se um par (categoria, subcategoria) existe legitimamente no catálogo da família.
 * Se subcategoria for informada, ela DEVE pertencer à categoria indicada.
 * NUNCA permite pares órfãos ou cruzados como "Alimentação › Utilidades & Casa".
 */
export function isCategorySubcategoryPairValid(
  categoryName: string,
  subcategoryName: string | null | undefined,
  categories: Array<
    CategoryWithSubcategoriesInput | { id?: string; name: string; subcategories?: any[] }
  >,
): boolean {
  if (!categoryName) return false
  const catNorm = normalizeWord(categoryName)
  const matchedCat = categories.find((c) => {
    const cNorm = normalizeWord(c.name)
    return cNorm === catNorm || cNorm.includes(catNorm) || catNorm.includes(cNorm)
  })

  if (!matchedCat) return false
  if (!subcategoryName) return true

  const subNorm = normalizeWord(subcategoryName)
  if (!matchedCat.subcategories || !Array.isArray(matchedCat.subcategories)) {
    return false
  }

  return matchedCat.subcategories.some((s: any) => {
    const sName = typeof s === 'string' ? s : s?.name || ''
    const sNorm = normalizeWord(sName)
    return sNorm === subNorm || sNorm.includes(subNorm) || subNorm.includes(sNorm)
  })
}

/**
 * Detecta se a mensagem é uma pergunta de dúvida, reflexiva ou metaconversa (ex: "Qual faz mais sentido?", "O que você acha?")
 * NUNCA deve ser interpretada como nome de categoria!
 */
export function isConsultativeOrReflectiveQuestion(text: string): boolean {
  const norm = normalizeWord(text)
  const patterns = [
    /qual\s+(faz\s+mais\s+sentido|voce\s+acha|escolho|recomenda|e\s+melhor|a\s+diferenca|seria\s+melhor)/,
    /o\s+que\s+(voce\s+acha|e\s+melhor|faz\s+sentido|recomenda)/,
    /me\s+ajuda(\s+a\s+escolher)?/,
    /nao\s+sei(\s+qual)?/,
    /tanto\s+faz/,
    /qual\s+a\s+diferenca/,
    /por\s+que\s+separar/,
    /onde\s+(fica\s+melhor|e\s+melhor)/,
    /qual\s+das\s+duas/,
    /como\s+funciona/,
    /qual\s+opcao/,
    /qual\s+sugere/,
  ]

  return patterns.some((regex) => regex.test(norm))
}

/**
 * Detecta confirmação ou escolha de categoria em linguagem natural (ex: "fechado em cuidados pessoais", "pode ser essa", "pode ser cuidados pessoais")
 */
export function extractCategoryChoiceIntent(
  text: string,
  options?: any[] | null,
): { isChoice: boolean; chosenOption?: string; cleanCategoryName?: string } {
  const norm = normalizeWord(text)

  // Prefixos comuns de escolha
  const choicePrefixRegex =
    /^(fechado\s+em|pode\s+ser\s+(em\s+)?|coloca\s+em\s+|prefiro\s+|deixa\s+em\s+|vincula\s+em\s+|quero\s+|escolho\s+|vai\s+de\s+|marca\s+como\s+)/i

  const stringOptions: string[] = (options || []).map((opt) =>
    typeof opt === 'string' ? opt : opt?.rotulo || opt?.categoria || '',
  )

  // Se houver opções disponíveis
  if (stringOptions.length > 0) {
    // Escolha por ordem: "a primeira", "a segunda", "a 1", "a 2", "a opção 1", etc.
    if (/\b(a\s+primeira|primeira\s+opcao|opcao\s+1|primeira)\b/i.test(norm)) {
      return { isChoice: true, chosenOption: stringOptions[0] }
    }
    if (
      /\b(a\s+segunda|segunda\s+opcao|opcao\s+2|segunda)\b/i.test(norm) &&
      stringOptions.length > 1
    ) {
      return { isChoice: true, chosenOption: stringOptions[1] }
    }

    // Match direto com uma das opções (mesmo com prefixos)
    for (const opt of stringOptions) {
      const optNorm = normalizeWord(opt)
      // Se a fala contém o nome da opção ou partes significativas (ex: "cuidados pessoais")
      // Extrair nomes simples de dentro da opção (removendo prefixos como 📁 Usar existente: ou ✨ Criar nova:)
      const cleanOpt = opt.replace(/^[📁✨]\s*(usar\s+existente|criar\s+nova)\s*:\s*/i, '').trim()
      const parts = cleanOpt
        .split(/[›>(/]/)
        .map((p) => normalizeWord(p.trim()))
        .filter((p) => p.length >= 3)
      const matchesAnyPart = parts.some((part) => norm.includes(part))

      if (norm.includes(optNorm) || optNorm.includes(norm) || matchesAnyPart) {
        return { isChoice: true, chosenOption: opt }
      }
    }
  }

  if (choicePrefixRegex.test(text.trim())) {
    const cleaned = text.trim().replace(choicePrefixRegex, '').trim()
    if (cleaned.length > 0) {
      return { isChoice: true, cleanCategoryName: cleaned }
    }
  }

  return { isChoice: false }
}

/**
 * Função principal que processa a frase falada completa
 */
export function parseVoiceInput(
  rawText: string,
  categories: Array<{
    id: string
    name: string
    type: string
    budget_bucket?: string | null
    subcategories?: Array<{ id: string; name: string }>
  }> = [],
  contextoAnterior?: LocalParsePreviousContext | null,
): ParsedVoiceTransaction {
  const trimmed = rawText.trim()

  // 1. Tipo
  const { type, cleanedText: textAfterType } = extractTransactionType(trimmed)

  // 2. Valor
  const { amountCents, cleanedText: textAfterAmount } = extractAmountFromVoiceText(textAfterType)

  // 3. Método de Pagamento
  const { method, cleanedText: textAfterPayment } = extractPaymentMethod(textAfterAmount)

  // 4. Limpar descrição restante
  let description = textAfterPayment
    // Remover preposições e conectivos órfãos no início ou fim
    .replace(/^(no|na|em|de|do|da|com|por|para|o|a|os|as)\s+/i, '')
    .replace(/\s+(no|na|em|de|do|da|com|por|para)$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Capitalizar primeira letra
  if (description.length > 0) {
    description = description.charAt(0).toUpperCase() + description.slice(1)
  } else {
    description = type === 'income' ? 'Receita' : 'Despesa'
  }

  // Lista de palavras de estabelecimento / comércio comuns para detecção inteligente
  const ESTABLISHMENT_WORDS = [
    'supermercado',
    'mercado',
    'mercearia',
    'padaria',
    'farmacia',
    'drogaria',
    'restaurante',
    'lanchonete',
    'pizzaria',
    'bar',
    'boteco',
    'posto',
    'acougue',
    'feira',
    'sacolao',
    'hortifruti',
    'loja',
    'shopping',
    'oficina',
    'petshop',
    'salao',
    'barbearia',
    'clinica',
    'hospital',
    'otica',
  ]

  // Extrair estabelecimento se mencionado na descrição
  let establishment: string | undefined
  const rawLower = normalizeWord(rawText)
  for (const est of ESTABLISHMENT_WORDS) {
    if (new RegExp(`\\b${est}\\b`, 'i').test(rawLower)) {
      // Tentar capturar nome composto como "mercearia do zé" ou "supermercado são paulo"
      const estRegex = new RegExp(
        `\\b(${est}(?:\\s+(?:do|da|de|dos|das|sao|santa|são)\\s+[a-zA-Zá-úÁ-Ú]+)?)\\b`,
        'i',
      )
      const estMatch = rawText.match(estRegex)
      if (estMatch) {
        establishment = estMatch[1].charAt(0).toUpperCase() + estMatch[1].slice(1)
      } else {
        establishment = est.charAt(0).toUpperCase() + est.slice(1)
      }
      break
    }
  }

  const effectiveType =
    contextoAnterior?.tipo === 'receita'
      ? 'income'
      : contextoAnterior?.tipo === 'despesa'
        ? 'expense'
        : type

  // Se houver contexto anterior com clarificação de categoria em aberto:
  // Avaliar rigorosamente a intenção do usuário antes de mexer em categorias!
  if (
    contextoAnterior &&
    (contextoAnterior.status === 'clarificacao_categoria' ||
      (contextoAnterior.opcoes_sugestao && contextoAnterior.opcoes_sugestao.length > 0))
  ) {
    const pendingAmountCents =
      contextoAnterior.valor !== undefined && contextoAnterior.valor !== null
        ? Math.round(Number(contextoAnterior.valor) * 100)
        : amountCents
    const pendingFormatted = (pendingAmountCents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

    // CASO A0: Usuário perguntando se a categoria já existe no catálogo da família
    if (isAskingIfCategoryExists(trimmed)) {
      // Checar estritamente a lista de categorias reais
      const targetCategoryName =
        contextoAnterior.categoria ||
        (contextoAnterior.opcoes_sugestao && contextoAnterior.opcoes_sugestao[0]
          ? typeof contextoAnterior.opcoes_sugestao[0] === 'string'
            ? contextoAnterior.opcoes_sugestao[0]
            : contextoAnterior.opcoes_sugestao[0].categoria
          : 'Cuidados Pessoais')

      const cleanCatTarget = targetCategoryName
        .replace(/^[📁✨]\s*(usar\s+existente|criar\s+nova)\s*:\s*/i, '')
        .split(/[›>(/]/)[0]
        .trim()

      const existsInDb = categoryExistsInFamilyList(cleanCatTarget, categories)

      let friendlyMsg = ''
      if (existsInDb) {
        friendlyMsg = `Sim! Nós já temos a categoria '${cleanCatTarget}' cadastrada no perfil da família. Posso vincular diretamente nela!`
      } else {
        friendlyMsg = `Ainda não temos essa categoria cadastrada! Ela é uma sugestão que posso criar agora mesmo para deixar seus gastos de estética organizados. O que você prefere: criar a categoria nova '${cleanCatTarget}' ou encaixar dentro da existente 'Lazer'?`
      }

      const stringOptions = (contextoAnterior.opcoes_sugestao || []).map((o) =>
        typeof o === 'string' ? o : o?.rotulo || o?.categoria || '',
      )

      return {
        rawText,
        amountCents: pendingAmountCents,
        amountFormatted: pendingFormatted,
        type: effectiveType,
        description: contextoAnterior.descricao || description,
        establishment: contextoAnterior.estabelecimento || undefined,
        paymentMethod: method,
        categoryNameSuggestion: contextoAnterior.categoria || undefined,
        subcategoryNameSuggestion: contextoAnterior.subcategoria || undefined,
        bucketSuggestion: normalizeBucketName(contextoAnterior.balde),
        confidence: 0.95,
        processingSource: 'local',
        aiStatus: 'clarificacao_categoria',
        tipoResposta: 'consultoria_categoria',
        intencao: 'consultiva',
        clarificationQuestion: 'O que você prefere?',
        clarificationOptions: stringOptions,
        structuredOptions: (contextoAnterior.opcoes_estruturadas as any) || null,
        friendlyMessage: friendlyMsg,
      }
    }

    // CASO A: Usuário fez uma pergunta de dúvida/metaconversa/consultiva
    if (isConsultativeOrReflectiveQuestion(trimmed)) {
      const rawOptions = contextoAnterior.opcoes_sugestao || []
      const stringOptions = rawOptions.map((o) =>
        typeof o === 'string' ? o : o?.rotulo || o?.categoria || '',
      )
      const optA = stringOptions[0] || '✨ Criar nova: Cuidados Pessoais (Estilo de Vida)'
      const optB = stringOptions[1] || '📁 Usar existente: Lazer'

      const friendlyMsg = `Recomendo '${optA}'! Assim você separa o que é estética/bem-estar dos passeios de '${optB}' (restaurantes, viagens), facilitando enxergar seu orçamento real (Regra 50/30/20) no fim do mês. Quer que eu vincule em ${optA} ou prefere deixar tudo em ${optB} mesmo?`

      return {
        rawText,
        amountCents: pendingAmountCents,
        amountFormatted: pendingFormatted,
        type: effectiveType,
        description: contextoAnterior.descricao || description,
        establishment: contextoAnterior.estabelecimento || undefined,
        paymentMethod: method,
        categoryNameSuggestion: contextoAnterior.categoria || undefined,
        subcategoryNameSuggestion: contextoAnterior.subcategoria || undefined,
        bucketSuggestion: normalizeBucketName(contextoAnterior.balde),
        confidence: 0.95,
        processingSource: 'local',
        aiStatus: 'clarificacao_categoria',
        tipoResposta: 'consultoria_categoria',
        intencao: 'consultiva',
        clarificationQuestion: 'Onde prefere organizar esse lançamento?',
        clarificationOptions: stringOptions,
        structuredOptions: (contextoAnterior.opcoes_estruturadas as any) || null,
        friendlyMessage: friendlyMsg,
      }
    }

    // CASO B: Escolha de categoria pelo usuário
    const choice = extractCategoryChoiceIntent(trimmed, contextoAnterior.opcoes_sugestao)
    if (choice.isChoice) {
      const resolvedChoiceStr = choice.chosenOption || choice.cleanCategoryName || trimmed
      return {
        rawText,
        amountCents: pendingAmountCents,
        amountFormatted: pendingFormatted,
        type: effectiveType,
        description: contextoAnterior.descricao || description,
        establishment: contextoAnterior.estabelecimento || undefined,
        paymentMethod: method,
        categoryNameSuggestion: resolvedChoiceStr,
        subcategoryNameSuggestion: contextoAnterior.subcategoria || undefined,
        bucketSuggestion: normalizeBucketName(contextoAnterior.balde),
        confidence: 0.95,
        processingSource: 'local',
        aiStatus: 'sucesso',
        tipoResposta: 'transacao',
        intencao: 'escolha_categoria',
        clarificationQuestion: null,
        clarificationOptions: null,
        friendlyMessage: `Perfeito! Vinculei em "${resolvedChoiceStr}". Confira o lançamento abaixo:`,
      }
    }
  }

  // Se houver contexto anterior de slot-filling (falta_valor) ou valor identificado na nova fala isolada (ex: "60", "foi 80 reais", "80 no pix"):
  // O item pendente no turno anterior PRESERVA descrição, estabelecimento, tipo e categoria/subcategoria já identificadas!
  const amountFormatted = (amountCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  if (contextoAnterior && amountCents > 0) {
    const finalDesc = contextoAnterior.descricao || description
    const finalEstablishment = contextoAnterior.estabelecimento || establishment
    const finalCategory = contextoAnterior.categoria || undefined
    const finalSubcategory = contextoAnterior.subcategoria || undefined
    const finalBucket = contextoAnterior.balde
      ? normalizeBucketName(contextoAnterior.balde)
      : 'lifestyle'

    // Valida par categoria/subcategoria contra catálogo real
    const catExists = finalCategory ? categoryExistsInFamilyList(finalCategory, categories) : false
    const subExists =
      finalCategory && finalSubcategory
        ? isCategorySubcategoryPairValid(finalCategory, finalSubcategory, categories)
        : true

    const friendlyConfirmation =
      finalCategory && finalSubcategory && subExists
        ? `Lançado: ${amountFormatted} em ${finalCategory} › ${finalSubcategory}! 👍`
        : finalCategory
          ? `Lançado: ${amountFormatted} em ${finalCategory}! 👍`
          : `Lançado: ${amountFormatted}! 👍`

    return {
      rawText,
      amountCents,
      amountFormatted,
      type: effectiveType,
      description: finalDesc,
      establishment: finalEstablishment || undefined,
      paymentMethod: method,
      categoryNameSuggestion: catExists || !finalCategory ? finalCategory : undefined,
      subcategoryNameSuggestion: subExists ? finalSubcategory : undefined,
      bucketSuggestion: finalBucket,
      confidence: 0.95,
      processingSource: 'local',
      aiStatus: 'sucesso',
      clarificationQuestion: null,
      clarificationOptions: null,
      friendlyMessage: friendlyConfirmation,
    }
  }

  // 4.5. Detecção de Modo Cesta (Rodada 28)
  // Se for uma enumeração multi-item com valor total único na voz/texto

  // Turno 2 do Modo Cesta: o usuário respondeu à pergunta da cesta livremente
  if (
    contextoAnterior &&
    (contextoAnterior.status === 'modo_cesta' || (contextoAnterior as any)?.isBasket)
  ) {
    const basketPendingTotal =
      contextoAnterior.valor !== undefined && contextoAnterior.valor !== null
        ? Math.round(Number(contextoAnterior.valor) * 100)
        : amountCents

    const fakeAnalysis = analyzeBasketMission(
      contextoAnterior.descricao || description,
      basketPendingTotal,
    )

    const freeInterpretation = interpretFreeTextBasketResponse(trimmed, fakeAnalysis)

    // Validação estrita do par canônico no catálogo real da família (Regra R25/R26/R32)
    // Se a categoria/subcategoria sugerida não existir no catálogo da família, NÃO grava gaveta inexistente;
    // em vez disso, pergunta ao usuário.
    const checkPairInCatalog = (
      catName: string,
      subName?: string,
    ): { exists: boolean; categoryId?: string; subcategoryId?: string } => {
      const cat = categories.find(
        (c) => normalizeWord(c.name) === normalizeWord(catName) && c.type === effectiveType,
      )
      if (!cat) return { exists: false }
      if (!subName) return { exists: true, categoryId: cat.id }

      const subs = (cat as any).subcategories || (cat as any).transaction_subcategories || []
      const sub = subs.find((s: any) => normalizeWord(s.name) === normalizeWord(subName))
      if (!sub) return { exists: false, categoryId: cat.id }
      return { exists: true, categoryId: cat.id, subcategoryId: sub.id }
    }

    if (freeInterpretation.intent === 'confirm_event') {
      const finalCat = freeInterpretation.category
      const finalSub = freeInterpretation.subcategory
      const finalBucket = freeInterpretation.bucket
      const itemsDesc = fakeAnalysis.itemsDescription || contextoAnterior.descricao || description

      const pairCheck = checkPairInCatalog(finalCat, finalSub)
      if (categories.length > 0 && !pairCheck.exists) {
        // Par canônico inexistente na família -> perguntar, nunca gravar par inexistente (R32)
        const askMsg = `Entendi o evento (${finalSub || finalCat}), mas não encontrei essa gaveta na sua família. Onde prefere organizar esse lançamento?`
        return {
          rawText,
          amountCents: basketPendingTotal,
          amountFormatted: (basketPendingTotal / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }),
          type: effectiveType,
          description: itemsDesc,
          establishment: contextoAnterior.estabelecimento || establishment,
          paymentMethod: method,
          categoryNameSuggestion: finalCat,
          subcategoryNameSuggestion: finalSub || undefined,
          bucketSuggestion: finalBucket,
          confidence: 0.6,
          processingSource: 'local',
          aiStatus: 'clarificacao',
          tipoResposta: 'transacao',
          intencao: 'transacao',
          clarificationQuestion: askMsg,
          clarificationOptions: null,
          friendlyMessage: askMsg,
          isBasket: true,
          basketItemsDescription: itemsDesc,
        }
      }

      const formattedTotal = (basketPendingTotal / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
      const friendlyMsg = finalSub
        ? `Lançado: ${formattedTotal} em ${finalCat} › ${finalSub} 👍!`
        : `Lançado: ${formattedTotal} em ${finalCat} 👍!`

      return {
        rawText,
        amountCents: basketPendingTotal,
        amountFormatted: formattedTotal,
        type: effectiveType,
        description: itemsDesc,
        establishment: contextoAnterior.estabelecimento || establishment,
        paymentMethod: method,
        categoryNameSuggestion: finalCat,
        subcategoryNameSuggestion: finalSub || undefined,
        bucketSuggestion: finalBucket,
        confidence: 0.95,
        processingSource: 'local',
        aiStatus: 'sucesso',
        tipoResposta: 'transacao',
        intencao: 'transacao',
        clarificationQuestion: null,
        clarificationOptions: null,
        friendlyMessage: friendlyMsg,
        isBasket: true,
        basketItemsDescription: itemsDesc,
        basketEventTag: fakeAnalysis.eventTag,
      }
    }

    if (freeInterpretation.intent === 'reject_event') {
      const finalCat = 'Alimentação'
      const finalSub = 'Supermercado & Atacado'
      const finalBucket = 'essentials' as BudgetBucket
      const itemsList = fakeAnalysis.items.map((i) => i.name).join(', ')
      const itemsDesc = itemsList
        ? `${itemsList} — casa`
        : contextoAnterior.descricao || description

      const pairCheck = checkPairInCatalog(finalCat, finalSub)
      if (categories.length > 0 && !pairCheck.exists) {
        const askMsg = `Entendi que é para a casa, mas não encontrei ${finalCat} › ${finalSub} na sua família. Onde deseja registrar?`
        return {
          rawText,
          amountCents: basketPendingTotal,
          amountFormatted: (basketPendingTotal / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }),
          type: effectiveType,
          description: itemsDesc,
          establishment: contextoAnterior.estabelecimento || establishment,
          paymentMethod: method,
          categoryNameSuggestion: finalCat,
          subcategoryNameSuggestion: finalSub,
          bucketSuggestion: finalBucket,
          confidence: 0.6,
          processingSource: 'local',
          aiStatus: 'clarificacao',
          tipoResposta: 'transacao',
          intencao: 'transacao',
          clarificationQuestion: askMsg,
          clarificationOptions: null,
          friendlyMessage: askMsg,
          isBasket: true,
          basketItemsDescription: itemsDesc,
        }
      }

      const formattedTotal = (basketPendingTotal / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
      const friendlyMsg = `Lançado: ${formattedTotal} em Alimentação › Supermercado & Atacado 👍!`

      return {
        rawText,
        amountCents: basketPendingTotal,
        amountFormatted: formattedTotal,
        type: effectiveType,
        description: itemsDesc,
        establishment: contextoAnterior.estabelecimento || establishment,
        paymentMethod: method,
        categoryNameSuggestion: finalCat,
        subcategoryNameSuggestion: finalSub,
        bucketSuggestion: finalBucket,
        confidence: 0.95,
        processingSource: 'local',
        aiStatus: 'sucesso',
        tipoResposta: 'transacao',
        intencao: 'transacao',
        clarificationQuestion: null,
        clarificationOptions: null,
        friendlyMessage: friendlyMsg,
        isBasket: true,
        basketItemsDescription: itemsDesc,
      }
    }

    if (freeInterpretation.intent === 'split_basket') {
      return {
        rawText,
        amountCents: basketPendingTotal,
        amountFormatted: (basketPendingTotal / 100).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }),
        type: effectiveType,
        description: contextoAnterior.descricao || description,
        establishment: contextoAnterior.estabelecimento || establishment,
        paymentMethod: method,
        categoryNameSuggestion: 'Lazer',
        subcategoryNameSuggestion: 'Eventos & Reuniões',
        bucketSuggestion: 'lifestyle',
        confidence: 0.9,
        processingSource: 'local',
        aiStatus: 'modo_cesta',
        tipoResposta: 'transacao',
        intencao: 'transacao',
        clarificationQuestion: freeInterpretation.confirmationQuestion || null,
        clarificationOptions: null,
        friendlyMessage: freeInterpretation.confirmationQuestion || null,
        isBasket: true,
      }
    }

    // Ambíguo
    return {
      rawText,
      amountCents: basketPendingTotal,
      amountFormatted: (basketPendingTotal / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
      type: effectiveType,
      description: fakeAnalysis.itemsDescription || contextoAnterior.descricao || description,
      establishment: contextoAnterior.estabelecimento || establishment,
      paymentMethod: method,
      categoryNameSuggestion: freeInterpretation.category,
      subcategoryNameSuggestion: freeInterpretation.subcategory || undefined,
      bucketSuggestion: freeInterpretation.bucket,
      confidence: 0.7,
      processingSource: 'local',
      aiStatus: 'clarificacao',
      tipoResposta: 'transacao',
      intencao: 'transacao',
      clarificationQuestion: freeInterpretation.confirmationQuestion || null,
      clarificationOptions: null,
      friendlyMessage: freeInterpretation.confirmationQuestion || null,
      isBasket: true,
      isUncertainSuggestion: true,
    }
  }

  // Turno 1 do Modo Cesta: Detecção inicial de enumeração multi-item com valor total único
  if (amountCents > 0 && isBasketInput(rawText)) {
    const basketAnalysis = analyzeBasketMission(rawText, amountCents)
    if (basketAnalysis.isBasket) {
      // (b) Cesta óbvia do dia a dia (arroz/feijão/leite/sabão) -> Alimentação/Compras direto, SEM pergunta
      if (!basketAnalysis.requiresConfirmation) {
        const cat = basketAnalysis.suggestedCategory
        const sub = basketAnalysis.suggestedSubcategory
        const bucket = basketAnalysis.suggestedBucket
        const desc = basketAnalysis.itemsDescription || description

        const friendlyMsg = sub
          ? `Lançado: ${amountFormatted} em ${cat} › ${sub} 👍!`
          : `Lançado: ${amountFormatted} em ${cat} 👍!`

        return {
          rawText,
          amountCents,
          amountFormatted,
          type: effectiveType,
          description: desc,
          establishment,
          paymentMethod: method,
          categoryNameSuggestion: cat,
          subcategoryNameSuggestion: sub || undefined,
          bucketSuggestion: bucket,
          confidence: 0.95,
          processingSource: 'local',
          aiStatus: 'sucesso',
          tipoResposta: 'transacao',
          intencao: 'transacao',
          clarificationQuestion: null,
          clarificationOptions: null,
          friendlyMessage: friendlyMsg,
          isBasket: true,
          basketItemsDescription: desc,
          basketEventTag: basketAnalysis.eventTag,
          basketMissionType: basketAnalysis.missionType,
        }
      }

      // (c) Padrão que sugere ocasião (cerveja+salame/carne/gelo etc.) -> UMA pergunta em linguagem natural
      const question =
        basketAnalysis.naturalQuestion ||
        `Percebi ${basketAnalysis.items.map((i) => i.name).join(', ')} — parece um encontro ou churrasco?`

      return {
        rawText,
        amountCents,
        amountFormatted,
        type: effectiveType,
        description: basketAnalysis.itemsDescription || description,
        establishment,
        paymentMethod: method,
        categoryNameSuggestion: basketAnalysis.suggestedCategory,
        subcategoryNameSuggestion: basketAnalysis.suggestedSubcategory || undefined,
        bucketSuggestion: basketAnalysis.suggestedBucket,
        confidence: 0.95,
        processingSource: 'local',
        aiStatus: 'modo_cesta',
        tipoResposta: 'transacao',
        intencao: 'transacao',
        clarificationQuestion: question,
        clarificationOptions: null, // SEM CHIPS/CARDS DE RESPOSTA RÁPIDA (UX FIXA)
        friendlyMessage: question,
        isBasket: true,
        basketItemsDescription: basketAnalysis.itemsDescription,
        basketEventTag: basketAnalysis.eventTag,
        basketMissionType: basketAnalysis.missionType,
      }
    }
  }

  // DETECÇÃO DA CLASSE 5 NO PARSER LOCAL: Itens heterogêneos (o caso da chupeta)
  // Mensagem contendo múltiplos itens de categorias claramente diferentes (ex: bebê + pet + casa + doação)
  const isHeterogeneousInput = (() => {
    const normT = normalizeWord(rawText)
    const hasBaby = /chupeta|mamadeira|fralda|lenco umedecido/.test(normT)
    const hasPet = /sache|racao|pet|cachorro|gato/.test(normT)
    const hasHome = /copo|jogo de copo|panela|prato|toalha/.test(normT)
    const hasDonation = /doacao|catador|esmola|ajuda/.test(normT)
    const heterogeneousThemes = [hasBaby, hasPet, hasHome, hasDonation].filter(Boolean).length
    return heterogeneousThemes >= 2
  })()

  if (isHeterogeneousInput) {
    const rawItems = extractEnumeratedItems(rawText)
    const proposedItems: VoiceAiTransactionItem[] = rawItems.map((it) => {
      const itName = normalizeWord(it.name)
      if (/chupeta|mamadeira|fralda|bebe|bebê|filho/.test(itName)) {
        return {
          descricao: it.name,
          quantidade: it.quantity || 1,
          valor: null,
          categoria_proposta: 'Compras',
          subcategoria_proposta: 'Bebês & Crianças',
          confianca: 0.9,
          requer_confirmacao: true,
          duvida_categoria: false,
        }
      }
      if (/sache|sachê|cachorro|gato|pet|racao|ração/.test(itName)) {
        return {
          descricao: it.name,
          quantidade: it.quantity || 4,
          valor: null,
          categoria_proposta: 'Pets',
          subcategoria_proposta: 'Alimentação Pet',
          confianca: 0.9,
          requer_confirmacao: true,
          duvida_categoria: false,
        }
      }
      if (/copo|jogo de copo|panela|cozinha|casa/.test(itName)) {
        return {
          descricao: it.name,
          quantidade: it.quantity || 1,
          valor: null,
          categoria_proposta: 'Casa & Conforto',
          subcategoria_proposta: 'Utensílios & Cozinha',
          confianca: 0.85,
          requer_confirmacao: true,
          duvida_categoria: false,
        }
      }
      if (/doacao|doação|catador|esmola|ajuda/.test(itName)) {
        return {
          descricao: it.name,
          quantidade: 1,
          valor: null,
          categoria_proposta: null,
          subcategoria_proposta: null,
          confianca: 0.4,
          requer_confirmacao: true,
          duvida_categoria: true,
        }
      }
      return {
        descricao: it.name,
        quantidade: it.quantity || null,
        valor: null,
        categoria_proposta: 'Outros',
        subcategoria_proposta: null,
        confianca: 0.5,
        requer_confirmacao: true,
        duvida_categoria: true,
      }
    })

    const hasDonationItem = proposedItems.some((pi) => pi.duvida_categoria)
    const questionText = hasDonationItem
      ? 'Identifiquei itens de categorias diferentes (bebê, pet, casa e doação). Como prefere classificar a doação e quais foram os valores de cada um?'
      : 'Identifiquei itens de categorias diferentes. Como prefere organizar as categorias e valores de cada um?'

    return {
      rawText,
      amountCents,
      amountFormatted,
      type: effectiveType,
      description,
      establishment,
      paymentMethod: method,
      categoryNameSuggestion: undefined,
      subcategoryNameSuggestion: undefined,
      bucketSuggestion: 'lifestyle',
      confidence: 0.8,
      processingSource: 'local',
      aiStatus: 'clarificacao',
      tipoResposta: 'transacao',
      intencao: 'transacao',
      routerClasse: 5,
      routerConfianca: 0.9,
      routerLacunas: ['itens', 'valor'],
      extractedItems: proposedItems,
      clarificationQuestion: questionText,
      clarificationOptions: null,
      friendlyMessage: questionText,
      isBasket: true,
      isUncertainSuggestion: true,
    }
  }

  // 5. Categoria & Balde
  const { categoryName, bucket, subcategoryName } = suggestCategoryAndBucket(
    `${description} ${rawText}`,
    categories.filter((c) => c.type === effectiveType),
  )

  // Determinar status do fallback local:
  let aiStatus: VoiceAiStatus = 'invalido'
  let clarificationQuestion: string | null = null
  let clarificationOptions: string[] | null = null
  let structuredOptions: StructuredSuggestionOption[] | null = null
  let friendlyMessage: string | null = null
  let localRouterClasse: number | null = null
  let localRouterLacunas: string[] | null = null

  if (amountCents <= 0) {
    // Contrato v1.0 — Classe 2 (Ordem Canônica: (1) itens -> (2) valor -> (3) local -> (4) data)
    // Se a descrição for genérica ("comprei algumas coisas", "umas coisas", "compras", "umas comprinhas", "umas paradas"),
    // perguntar primeiro OS ITENS ("O que você comprou?"), NUNCA o valor!
    const GENERIC_EXPENSE_TERMS = [
      'algumas coisas',
      'umas coisas',
      'umas paradas',
      'umas comprinhas',
      'umas compras',
      'compras',
      'comprei coisas',
      'comprei algo',
      'coisinhas',
      'coisas',
    ]
    const isGenericDescription = GENERIC_EXPENSE_TERMS.some((kw) => rawLower.includes(kw))

    const isPureGreeting =
      rawLower === 'bom dia' ||
      rawLower === 'boa tarde' ||
      rawLower === 'boa noite' ||
      rawLower === 'oi' ||
      rawLower === 'ola' ||
      rawLower === 'olá' ||
      rawLower.startsWith('como vai') ||
      rawLower.startsWith('tudo bem')

    if (isPureGreeting) {
      aiStatus = 'consulta'
      localRouterClasse = 7
      let greetingReply = 'Olá! Pronto pra registrar algo ou ver como estão as finanças de vocês?'
      if (rawLower.includes('bom dia')) {
        greetingReply = 'Bom dia! Pronto pra registrar algo ou ver como estão as finanças de vocês?'
      } else if (rawLower.includes('boa tarde')) {
        greetingReply =
          'Boa tarde! Pronto pra registrar algo ou ver como estão as finanças de vocês?'
      } else if (rawLower.includes('boa noite')) {
        greetingReply =
          'Boa noite! Pronto pra registrar algo ou ver como fecharam as finanças de hoje?'
      }
      clarificationQuestion = null
      friendlyMessage = greetingReply
    } else if (isGenericDescription) {
      // Ordem canônica: 1º itens
      aiStatus = 'falta_valor'
      localRouterClasse = 2
      localRouterLacunas = ['itens', 'valor']
      clarificationQuestion = 'O que você comprou?'
      friendlyMessage = 'O que você comprou? Me conta os itens que eu já organizo pra você!'
    } else {
      const hasRecognizableContext = Boolean(
        categoryName ||
        establishment ||
        ESTABLISHMENT_WORDS.some((est) => new RegExp(`\\b${est}\\b`, 'i').test(rawLower)),
      )

      if (hasRecognizableContext) {
        // Ordem canônica: itens já existem, 2º valor
        aiStatus = 'falta_valor'
        localRouterClasse = 2
        localRouterLacunas = ['valor']
        clarificationQuestion = 'Quanto custou?'
        friendlyMessage = 'Entendi o que você comprou! Quanto custou?'
      } else {
        aiStatus = 'invalido'
        friendlyMessage =
          "Não consegui entender esse lançamento financeiro. Tente algo como: 'Almoço 45 reais no débito no restaurante' ou 'supermercado do zé 180 no pix'"
      }
    }
  } else if (!categoryName) {
    // Valor existe, mas o termo/descrição não casou com nenhuma categoria/subcategoria nem termo genérico conhecido
    aiStatus = 'clarificacao'
    const descFormatted =
      description && description !== 'Despesa' && description !== 'Receita'
        ? description.charAt(0).toUpperCase() + description.slice(1)
        : null
    clarificationQuestion = descFormatted
      ? `O que foi ${descFormatted}?`
      : 'Qual é a categoria desse gasto?'
    // Se o termo/descrição for claro mas não casar com categoria cadastrada, ou se for ambíguo:
    // Mantém o formato padrão amigável citando o item e o valor quando houver descrição
    friendlyMessage = descFormatted
      ? `Identifiquei ${descFormatted} ${amountFormatted}! Onde prefere organizar esse gasto?`
      : `Identifiquei ${amountFormatted}! Onde prefere organizar esse gasto?`

    // Verificar se existe alguma categoria compatível
    const hasExistingLazer = categories.some((c) => /lazer|estilo/i.test(c.name))
    if (hasExistingLazer) {
      structuredOptions = [
        {
          tipo: 'existente',
          rotulo: '📁 Usar existente: Lazer › subcategoria Outros',
          categoria: 'Lazer',
          subcategoria: 'Outros',
          balde: 'lifestyle',
        },
        {
          tipo: 'nova',
          rotulo: '✨ Criar nova: Despesas Gerais (Estilo de Vida)',
          categoria: 'Despesas Gerais',
          subcategoria: null,
          balde: 'lifestyle',
        },
      ]
      clarificationOptions = structuredOptions.map((s) => s.rotulo)
    } else {
      clarificationOptions = ['Transporte / Passagem', 'Alimentação / Outro', 'Outro']
    }
  } else {
    aiStatus = 'sucesso'
  }

  // Confiança
  let confidence = 0.5
  if (amountCents > 0) confidence += 0.3
  if (description && description !== 'Despesa' && description !== 'Receita') confidence += 0.1
  if (categoryName) confidence += 0.1

  return {
    rawText,
    amountCents,
    amountFormatted,
    type,
    description,
    establishment,
    paymentMethod: method,
    categoryNameSuggestion: categoryName,
    subcategoryNameSuggestion: subcategoryName,
    bucketSuggestion: bucket,
    confidence: Math.min(confidence, 1.0),
    processingSource: 'local',
    aiStatus,
    routerClasse: localRouterClasse,
    routerLacunas: localRouterLacunas,
    clarificationQuestion,
    clarificationOptions,
    structuredOptions,
    friendlyMessage,
  }
}

/**
 * Normaliza o nome do balde retornado pela IA para o enum interno canônico ('essentials' | 'lifestyle' | 'future')
 */
export function normalizeBucketName(baldeText?: string | null): BudgetBucket {
  if (!baldeText) return 'lifestyle'
  const norm = normalizeWord(baldeText)
  if (norm.includes('essencia') || norm.includes('necessidade')) {
    return 'essentials'
  }
  if (norm.includes('meta') || norm.includes('invest')) {
    return 'future'
  }
  return 'lifestyle'
}

/**
 * Converte resposta da Edge Function Voice AI em ParsedVoiceTransaction compatível
 */
export function mapAiResponseToParsedTransaction(
  aiData: VoiceAiResponse,
  rawText: string,
): ParsedVoiceTransaction {
  const transacao = aiData.transacao
  const amountNumber = transacao?.valor ? Number(transacao.valor) : 0
  const amountCents = Math.round(amountNumber * 100)
  const amountFormatted = (amountCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  let paymentMethod: 'pix' | 'debito' | 'credito' | 'dinheiro' | undefined
  if (transacao?.metodo_pagamento) {
    const pm = normalizeWord(transacao.metodo_pagamento)
    if (pm.includes('pix')) paymentMethod = 'pix'
    else if (pm.includes('debito')) paymentMethod = 'debito'
    else if (pm.includes('credito')) paymentMethod = 'credito'
    else if (pm.includes('dinheiro') || pm.includes('especie')) paymentMethod = 'dinheiro'
  }

  const type = transacao?.tipo === 'receita' ? 'income' : 'expense'
  const bucket = normalizeBucketName(transacao?.balde)

  const confidenceByStatus: Record<VoiceAiStatus, number> = {
    sucesso: 0.95,
    falta_valor: 0.85,
    clarificacao: 0.7,
    clarificacao_categoria: 0.85,
    invalido: 0.2,
    consulta: 0.95,
    acao_executada: 0.95,
    modo_cesta: 0.95,
  }

  const isConsulta = aiData.status === 'consulta' || aiData.tipo_resposta === 'consulta'
  const isConsultoria =
    aiData.tipo_resposta === 'consultoria_categoria' || aiData.intencao === 'consultiva'
  const isAcao =
    aiData.status === 'acao_executada' ||
    aiData.tipo_resposta === 'acao' ||
    aiData.acao === 'desfazer'

  // Normalização de opções de sugestão para formato string[] e structuredOptions
  let clarificationOptions: string[] | null = null
  let structuredOptions: StructuredSuggestionOption[] | null = null

  if (Array.isArray(aiData.opcoes_sugestao) && aiData.opcoes_sugestao.length > 0) {
    structuredOptions = aiData.opcoes_sugestao.map((opt: any) => {
      if (typeof opt === 'string') {
        const isExistente =
          opt.toLowerCase().includes('usar existente') ||
          opt.toLowerCase().includes('existente') ||
          opt.includes('📁') ||
          opt.includes('› dentro de')
        const cleanText = opt
          .replace(/^[📁✨]\s*(usar\s+existente|criar\s+nova)\s*:\s*/i, '')
          .trim()
        return {
          tipo: isExistente ? 'existente' : 'nova',
          rotulo:
            opt.startsWith('📁') || opt.startsWith('✨')
              ? opt
              : isExistente
                ? `📁 Usar existente: ${cleanText}`
                : `✨ Criar nova: ${cleanText}`,
          categoria: cleanText,
          subcategoria: null,
          balde: null,
        }
      }
      const tipo = opt?.tipo === 'existente' ? 'existente' : 'nova'
      let rotulo = opt?.rotulo || ''
      if (!rotulo) {
        if (tipo === 'existente') {
          rotulo = `📁 Usar existente: ${opt.categoria || opt.subcategoria || 'Outro'}${opt.subcategoria && opt.categoria ? ` › subcategoria ${opt.subcategoria}` : ''}`
        } else {
          rotulo = `✨ Criar nova: ${opt.categoria || 'Nova Categoria'}${opt.balde ? ` (${opt.balde})` : ''}`
        }
      }
      return {
        tipo,
        rotulo,
        categoria: opt.categoria || '',
        subcategoria: opt.subcategoria || null,
        balde: opt.balde || null,
      }
    })
    clarificationOptions = structuredOptions.map((s) => s.rotulo)
  }

  return {
    rawText,
    amountCents,
    amountFormatted,
    type,
    description: isConsulta ? rawText : transacao?.descricao || rawText,
    establishment: transacao?.estabelecimento || undefined,
    paymentMethod,
    categoryNameSuggestion: transacao?.categoria || undefined,
    subcategoryNameSuggestion: transacao?.subcategoria || undefined,
    bucketSuggestion: bucket,
    confidence:
      typeof aiData.confianca === 'number'
        ? aiData.confianca
        : typeof aiData.router?.confianca === 'number'
          ? aiData.router.confianca
          : (confidenceByStatus[aiData.status] ?? 0.2),
    processingSource: 'openai',
    aiStatus: aiData.status,
    acao: aiData.acao || null,
    tipoResposta: isConsulta
      ? 'consulta'
      : isConsultoria
        ? 'consultoria_categoria'
        : isAcao
          ? 'acao'
          : 'transacao',
    intencao: aiData.intencao,
    routerClasse: typeof aiData.router?.classe === 'number' ? aiData.router.classe : null,
    routerConfianca:
      typeof aiData.router?.confianca === 'number'
        ? aiData.router.confianca
        : typeof aiData.confianca === 'number'
          ? aiData.confianca
          : null,
    routerLacunas: Array.isArray(aiData.lacunas)
      ? aiData.lacunas
      : Array.isArray(aiData.router?.lacunas)
        ? aiData.router.lacunas
        : null,
    extractedItems: Array.isArray(aiData.itens)
      ? aiData.itens
      : Array.isArray(transacao?.itens)
        ? transacao.itens
        : null,
    respostaConsulta: aiData.resposta_consulta || (isConsulta ? aiData.mensagem_amigavel : null),
    clarificationQuestion: aiData.pergunta_clarificacao,
    clarificationOptions,
    structuredOptions,
    friendlyMessage: aiData.mensagem_amigavel,
    aiError: aiData.error_detail || (aiData.error ? `Erro: ${aiData.error}` : null),
    isUncertainSuggestion:
      (typeof aiData.confianca === 'number' && aiData.confianca < 0.6) ||
      (typeof aiData.router?.confianca === 'number' && aiData.router.confianca < 0.6) ||
      (Array.isArray(aiData.itens) &&
        aiData.itens.some(
          (it) => it.duvida_categoria || (typeof it.confianca === 'number' && it.confianca < 0.6),
        )),
  }
}
