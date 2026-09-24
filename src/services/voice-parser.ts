/**
 * Parser de texto e fala em pt-BR para Lançamento Inteligente por Voz com IA.
 * Converte linguagem natural falada em transação estruturada.
 */

export type VoiceAiStatus = 'sucesso' | 'clarificacao' | 'falta_valor' | 'invalido'

export interface VoiceAiTransaction {
  descricao: string
  estabelecimento?: string | null
  valor: number | null
  tipo: 'despesa' | 'receita'
  balde: string // 'Necessidades Essenciais' | 'Estilo de Vida' | 'Metas & Investimentos' | string
  categoria: string
  subcategoria: string
  metodo_pagamento: string | null
}

export interface VoiceAiResponse {
  status: VoiceAiStatus
  transacao: VoiceAiTransaction | null
  pergunta_clarificacao: string | null
  opcoes_sugestao: string[] | null
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
  clarificationQuestion?: string | null
  clarificationOptions?: string[] | null
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
export function suggestCategoryAndBucket(
  description: string,
  categories: Array<{ id: string; name: string; type: string; budget_bucket?: string | null }>,
): {
  categoryName?: string
  categoryId?: string
  bucket?: 'essential' | 'lifestyle' | 'goals'
} {
  const norm = normalizeWord(description)

  // Mapeamentos comuns em pt-BR
  const KEYWORD_MAP: Array<{
    keywords: string[]
    defaultCategory: string
    bucket: 'essential' | 'lifestyle' | 'goals'
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
      ],
      defaultCategory: 'Cuidados Pessoais',
      bucket: 'lifestyle',
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

  // 1. Procurar nas categorias do usuário por correspondência direta de nome
  for (const cat of categories) {
    const catNorm = normalizeWord(cat.name)
    if (norm.includes(catNorm) || catNorm.includes(norm)) {
      return {
        categoryName: cat.name,
        categoryId: cat.id,
        bucket: (cat.budget_bucket as any) || 'lifestyle',
      }
    }
  }

  // 2. Procurar pelo KEYWORD_MAP
  for (const entry of KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (new RegExp(`\\b${normalizeWord(kw)}\\b`, 'i').test(norm)) {
        // Encontrar categoria do usuário que melhor case com o defaultCategory ou keywords
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
            bucket: (matchedUserCat.budget_bucket as any) || entry.bucket,
          }
        }

        return {
          categoryName: entry.defaultCategory,
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
}

/**
 * Função principal que processa a frase falada completa
 */
export function parseVoiceInput(
  rawText: string,
  categories: Array<{ id: string; name: string; type: string; budget_bucket?: string | null }> = [],
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

  // 5. Categoria & Balde
  const { categoryName, bucket } = suggestCategoryAndBucket(
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
      subcategoryNameSuggestion: finalSubcategory,
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
  // Se amountCents <= 0:
  //   - Se identificou categoria OU estabelecimento OU item reconhecível -> 'falta_valor'
  //   - Senão -> 'invalido'
  // Se amountCents > 0:
  //   - Se não identificou categoria conhecida e a descrição é desconhecida -> 'clarificacao'
  //   - Caso contrário -> 'sucesso'
  let aiStatus: VoiceAiStatus = 'invalido'
  let clarificationQuestion: string | null = null
  let clarificationOptions: string[] | null = null
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
    friendlyMessage = descFormatted
      ? `Entendi ${amountFormatted}! Mas o que foi ${descFormatted}?`
      : `Entendi ${amountFormatted}! Mas qual foi a categoria deste gasto?`
    clarificationOptions = ['Transporte / Passagem', 'Alimentação / Outro', 'Outro']
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
    bucketSuggestion: bucket,
    confidence: Math.min(confidence, 1.0),
    processingSource: 'local',
    aiStatus,
    clarificationQuestion,
    clarificationOptions,
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

  const confidenceByStatus = {
    sucesso: 0.95,
    falta_valor: 0.85,
    clarificacao: 0.7,
    invalido: 0.2,
  }

  return {
    rawText,
    amountCents,
    amountFormatted,
    type,
    description: transacao?.descricao || rawText,
    establishment: transacao?.estabelecimento || undefined,
    paymentMethod,
    categoryNameSuggestion: transacao?.categoria || undefined,
    subcategoryNameSuggestion: transacao?.subcategoria || undefined,
    bucketSuggestion: bucket,
    confidence: confidenceByStatus[aiData.status] ?? 0.2,
    processingSource: 'openai',
    aiStatus: aiData.status,
    clarificationQuestion: aiData.pergunta_clarificacao,
    clarificationOptions: aiData.opcoes_sugestao,
    friendlyMessage: aiData.mensagem_amigavel,
    aiError: aiData.error_detail || (aiData.error ? `Erro: ${aiData.error}` : null),
  }
}
