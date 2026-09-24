/**
 * Parser de texto e fala em pt-BR para Lançamento Inteligente por Voz com IA.
 * Converte linguagem natural falada em transação estruturada.
 */

export type VoiceAiStatus =
  | 'sucesso'
  | 'clarificacao'
  | 'clarificacao_categoria'
  | 'falta_valor'
  | 'invalido'
  | 'consulta'

export interface VoiceAiTransaction {
  descricao: string
  estabelecimento?: string | null
  valor: number | null
  tipo: 'despesa' | 'receita'
  balde: string // 'Necessidades Essenciais' | 'Estilo de Vida' | 'Metas & Investimentos' | string
  categoria: string | null
  subcategoria: string | null
  metodo_pagamento: string | null
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
  tipo_resposta?: 'transacao' | 'consulta' | 'consultoria_categoria'
  intencao?: 'consultiva' | 'escolha_categoria' | 'consulta' | 'transacao' | string | null
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
  bucketSuggestion?: 'essential' | 'lifestyle' | 'goals'
  confidence: number
  // Campos da IA enriquecidos e transparência de processamento
  processingSource?: 'openai' | 'local'
  aiStatus?: VoiceAiStatus
  tipoResposta?: 'transacao' | 'consulta' | 'consultoria_categoria'
  intencao?: 'consultiva' | 'escolha_categoria' | 'consulta' | 'transacao' | string | null
  respostaConsulta?: string | null
  clarificationQuestion?: string | null
  clarificationOptions?: string[] | null
  structuredOptions?: StructuredSuggestionOption[] | null
  friendlyMessage?: string | null
  aiError?: string | null
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

  // 1. Procurar dígitos com centavos explícitos: ex: "R$ 45,90", "45,50 reais", "45.90"
  const digitsWithCentsRegex = /(?:r\$\s*)?(\d+)[,.](\d{1,2})\s*(?:reais|real)?/i
  const digitsMatch = normalized.match(digitsWithCentsRegex)
  if (digitsMatch) {
    const whole = parseInt(digitsMatch[1], 10)
    let centsPart = digitsMatch[2]
    if (centsPart.length === 1) centsPart += '0'
    const cents = parseInt(centsPart.slice(0, 2), 10)
    const amountCents = whole * 100 + cents

    return {
      amountCents,
      matchedText: digitsMatch[0],
      cleanedText: normalized
        .replace(digitsMatch[0], '')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    }
  }

  // 2. Procurar dígitos inteiros com ou sem "reais" e centavos por extenso
  // Ex: "45 reais e 50 centavos", "45 reais"
  const digitsWithCentavosRegex =
    /(?:r\$\s*)?(\d+)\s*(?:reais|real)?(?:\s*e\s*(\d{1,2})\s*centavos?)?/i
  const intWithCentavosMatch = normalized.match(digitsWithCentavosRegex)
  if (intWithCentavosMatch && intWithCentavosMatch[1]) {
    // Evitar capturar dígitos que sejam parte de outra coisa se não tiver "reais"
    const hasExplicitCurrency = /r\$|reais|real/i.test(normalized)
    const whole = parseInt(intWithCentavosMatch[1], 10)
    const centavos = intWithCentavosMatch[2] ? parseInt(intWithCentavosMatch[2], 10) : 0

    if (hasExplicitCurrency || whole > 0) {
      // Se não tem currency explícita, só aceita se fizer sentido monetário
      const fullMatch = intWithCentavosMatch[0]
      // Apenas se tiver 'reais' ou for o único número
      if (hasExplicitCurrency || /\b\d+\b/.test(fullMatch)) {
        return {
          amountCents: whole * 100 + centavos,
          matchedText: fullMatch,
          cleanedText: normalized
            .replace(fullMatch, '')
            .replace(/\s{2,}/g, ' ')
            .trim(),
        }
      }
    }
  }

  // 3. Procurar números por extenso (ex: "oitenta e cinco reais", "quarenta e cinco reais e cinquenta centavos")
  // Tokenizar palavras
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

  // Achar sequências contínuas de palavras numéricas
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

      // tokens[start...end] é a sequência numérica inteira (reais)
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
            // Pode ser número dígito ou palavra
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
  bucket?: 'essential' | 'lifestyle' | 'goals'
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
    bucket: 'essential' | 'lifestyle' | 'goals'
    candidateExistingCategories?: string[]
  }> = [
    // Essencial
    {
      keywords: [
        'supermercado',
        'mercado',
        'compras',
        'padaria',
        'acougue',
        'feira',
        'sacolao',
        'mercearia',
        'hortifruti',
      ],
      defaultCategory: 'Alimentação',
      bucket: 'essential',
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
      bucket: 'essential',
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
      bucket: 'essential',
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
      bucket: 'essential',
    },
    {
      keywords: ['escola', 'faculdade', 'curso', 'mensalidade', 'livro', 'caderno', 'educacao'],
      defaultCategory: 'Educação',
      bucket: 'essential',
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
      bucket: 'goals',
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
      bucket: 'essential',
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

  // 5. Categoria & Balde
  const { categoryName, bucket, subcategoryName } = suggestCategoryAndBucket(
    `${description} ${rawText}`,
    categories.filter((c) => c.type === effectiveType),
  )

  // Formatação em BRL
  const amountFormatted = (amountCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  // Se houver contexto anterior com valor identificado na nova fala (ex: "foi 80 reais", "80 no pix")
  if (contextoAnterior && amountCents > 0) {
    const finalDesc = contextoAnterior.descricao || description
    const finalEstablishment = contextoAnterior.estabelecimento || establishment
    const finalCategory = contextoAnterior.categoria || categoryName
    const finalSubcategory = contextoAnterior.subcategoria
    const finalBucket = contextoAnterior.balde
      ? normalizeBucketName(contextoAnterior.balde)
      : bucket || 'lifestyle'

    return {
      rawText,
      amountCents,
      amountFormatted,
      type: effectiveType,
      description: finalDesc,
      establishment: finalEstablishment || undefined,
      paymentMethod: method,
      categoryNameSuggestion: finalCategory,
      subcategoryNameSuggestion: finalSubcategory || subcategoryName,
      bucketSuggestion: finalBucket,
      confidence: 0.95,
      processingSource: 'local',
      aiStatus: 'sucesso',
      clarificationQuestion: null,
      clarificationOptions: null,
      friendlyMessage: null,
    }
  }

  // Determinar status do fallback local:
  let aiStatus: VoiceAiStatus = 'invalido'
  let clarificationQuestion: string | null = null
  let clarificationOptions: string[] | null = null
  let structuredOptions: StructuredSuggestionOption[] | null = null
  let friendlyMessage: string | null = null

  if (amountCents <= 0) {
    const hasRecognizableContext = Boolean(
      categoryName ||
      establishment ||
      ESTABLISHMENT_WORDS.some((est) => new RegExp(`\\b${est}\\b`, 'i').test(rawLower)),
    )

    if (hasRecognizableContext) {
      aiStatus = 'falta_valor'
      clarificationQuestion = 'Quanto custou?'
      friendlyMessage = 'Entendi o que você comprou! Quanto custou?'
    } else {
      aiStatus = 'invalido'
      friendlyMessage =
        "Não consegui entender esse lançamento financeiro. Tente algo como: 'Almoço 45 reais no débito no restaurante' ou 'supermercado do zé 180 no pix'"
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
    clarificationQuestion,
    clarificationOptions,
    structuredOptions,
    friendlyMessage,
  }
}

/**
 * Normaliza o nome do balde retornado pela IA para o enum interno ('essential' | 'lifestyle' | 'goals')
 */
export function normalizeBucketName(
  baldeText?: string | null,
): 'essential' | 'lifestyle' | 'goals' {
  if (!baldeText) return 'lifestyle'
  const norm = normalizeWord(baldeText)
  if (norm.includes('essencia') || norm.includes('necessidade')) {
    return 'essential'
  }
  if (norm.includes('meta') || norm.includes('invest')) {
    return 'goals'
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
  }

  const isConsulta = aiData.status === 'consulta' || aiData.tipo_resposta === 'consulta'
  const isConsultoria =
    aiData.tipo_resposta === 'consultoria_categoria' || aiData.intencao === 'consultiva'

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
          rotulo = `📁 Usar existente: ${opt.categoria || 'Geral'}${opt.subcategoria ? ` › subcategoria ${opt.subcategoria}` : ''}`
        } else {
          rotulo = `✨ Criar nova: ${opt.categoria || 'Geral'}${opt.balde ? ` (${opt.balde})` : ''}`
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
    confidence: confidenceByStatus[aiData.status] ?? 0.2,
    processingSource: 'openai',
    aiStatus: aiData.status,
    tipoResposta: isConsulta ? 'consulta' : isConsultoria ? 'consultoria_categoria' : 'transacao',
    intencao: aiData.intencao,
    respostaConsulta: aiData.resposta_consulta || (isConsulta ? aiData.mensagem_amigavel : null),
    clarificationQuestion: aiData.pergunta_clarificacao,
    clarificationOptions,
    structuredOptions,
    friendlyMessage: aiData.mensagem_amigavel,
    aiError: aiData.error_detail || (aiData.error ? `Erro: ${aiData.error}` : null),
  }
}
