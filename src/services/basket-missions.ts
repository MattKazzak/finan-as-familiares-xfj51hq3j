/**
 * basket-missions.ts
 *
 * Dicionário de Missões de Compra (Modo Cesta) - Rodada 28 (v0.0.277)
 *
 * Princípios e Decisões de Produto:
 * (a) Cesta = detecção de enumeração multi-item com valor total único na voz/texto;
 * (b) Cesta óbvia do dia a dia (arroz/feijão/leite/sabão etc.) → Alimentação / Supermercado & Atacado (ou Compras), SEM pergunta;
 * (c) Padrão que sugere ocasião (bebida alcoólica + petiscos/carne/carvão; pipoca + doces/refri; flores/perfume p/ presente; fralda+bebê etc.):
 *     - Evento social / churrasco / encontro → UMA pergunta em linguagem natural ("Percebi cerveja, salame e suco — parece um encontro ou churrasco?").
 *     - Resposta LIVRE interpretada (sem chips/cards).
 *     - Resposta parcial ("cerveja pro churrasco, resto é da casa") → DIVIDIR a cesta por contexto, pedindo valores faltantes ou estimando proporcionalmente com confirmação ("aproximadamente R$ 40 da cerveja?").
 * (d) Registro da cesta inteira: 1 transação na categoria da missão com a LISTA DE ITENS na descrição ("Salame, suco de maracujá, cerveja — churrasco"). Divisão em múltiplas transações SÓ quando o usuário pedir;
 * (e) Se a resposta livre for ambígua, UMA pergunta de follow-up (máximo 2 perguntas por cesta — nunca dez); desistência ambígua → categoriza na subcategoria mais específica do contexto + badge "sugestão incerta".
 * (f) Catálogo Canônico 19/117: Lazer › Shows & Eventos (ou Restaurantes & Bares), Compras › Presentes, Compras › Bebês & Crianças, Alimentação › Supermercado & Atacado.
 */

import { BudgetBucket } from '@/types/finance'

export type MissionType =
  | 'social_event' // Churrasco, encontro, resenha, festa com amigos
  | 'movie_party' // Cinema em casa, pipoca + refrigerante + guloseimas
  | 'gift' // Presente, flores + chocolate / perfume
  | 'baby' // Itens de bebê / enxoval
  | 'pantry_staple' // Cesta óbvia do dia a dia (mercado / feira / casa)
  | 'general_basket' // Cesta mista genérica

export interface DetectedBasketItem {
  raw: string
  name: string
  quantity?: number
  unit?: string
}

export interface BasketMissionPattern {
  id: MissionType
  name: string
  requiresUserConfirmation: boolean // true = SEMPRE passa por pergunta natural (nunca grava evento em silêncio)
  targetCategory: string
  targetSubcategory: string | null
  targetBucket: BudgetBucket
  questionTemplate: (itemsSummary: string) => string
  eventTag: string
  // Função para verificar se a cesta combina com esta missão
  matches: (items: string[], rawText: string) => boolean
}

export interface BasketAnalysisResult {
  isBasket: boolean
  items: DetectedBasketItem[]
  totalAmountCents: number
  matchedPattern?: BasketMissionPattern
  missionType: MissionType
  requiresConfirmation: boolean
  naturalQuestion?: string
  suggestedCategory: string
  suggestedSubcategory: string | null
  suggestedBucket: BudgetBucket
  itemsDescription: string
  eventTag?: string
}

export interface FreeTextInterpretationResult {
  intent: 'confirm_event' | 'reject_event' | 'split_basket' | 'ambiguous'
  category: string
  subcategory: string | null
  bucket: BudgetBucket
  splitItems?: Array<{
    description: string
    category: string
    subcategory: string | null
    bucket: BudgetBucket
    estimatedAmountCents?: number
    needsAmountConfirmation?: boolean
  }>
  confirmationQuestion?: string
  isUncertainSuggestion?: boolean
}

// Normalizador de texto
function norm(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Subpalavras para detecção
const ALCOHOL_KEYWORDS = [
  'cerveja',
  'cervejas',
  'chopp',
  'chope',
  'cachaca',
  'cachaça',
  'vodka',
  'whisky',
  'whiskey',
  'vinho',
  'vinhos',
  'gin',
  'caipirinha',
  'heineken',
  'brahma',
  'skol',
  'amstel',
  'corona',
  'budweiser',
  'latão',
  'latao',
  'long neck',
]

const BBQ_PETISCO_KEYWORDS = [
  'salame',
  'carne',
  'picanha',
  'linguica',
  'linguiça',
  'carvao',
  'carvão',
  'gelo',
  'queijo coalho',
  'torresmo',
  'amendoim',
  'azeitona',
  'farofa',
  'pao de alho',
  'pão de alho',
  'costela',
  'fraldinha',
  'asa de frango',
  'coracao',
  'coração',
  'espetinho',
  'petisco',
  'petiscos',
]

const MOVIE_PARTY_KEYWORDS = [
  'pipoca',
  'chocolate',
  'bala',
  'doces',
  'doce',
  'refrigerante',
  'coca cola',
  'coca',
  'guarana',
  'guaraná',
  'doritos',
  'batata frita',
  'ruffles',
  'brigadeiro',
  'guloseimas',
  'sorvete',
]

const GIFT_KEYWORDS = [
  'flores',
  'buque',
  'buquê',
  'perfume',
  'presente',
  'embalagem de presente',
  'cartao de presente',
  'cartão de presente',
  'bombom',
  'caixa de bombom',
]

const BABY_KEYWORDS = [
  'fralda',
  'fraldas',
  'lenco umedecido',
  'lenço umedecido',
  'pomada de assadura',
  'leite ninho',
  'formula infantil',
  'chupeta',
  'mamadeira',
  'shampoo de bebe',
  'sabonete de bebe',
  'sabonete liquido de bebe',
]

const PANTRY_STAPLE_KEYWORDS = [
  'arroz',
  'feijao',
  'feijão',
  'oleo',
  'óleo',
  'leite',
  'acucar',
  'açúcar',
  'sal',
  'cafe',
  'café',
  'macarrao',
  'macarrão',
  'farinha',
  'detergente',
  'sabao',
  'sabão',
  'amaciante',
  'desinfetante',
  'papel higienico',
  'papel higiênico',
  'pasta de dente',
  'creme dental',
  'shampoo',
  'sabonete',
  'esponja',
  'agua sanitaria',
  'água sanitária',
  'cebola',
  'alho',
  'tomate',
  'batata',
  'frango congelado',
]

/**
 * Padrões de Missão do Dicionário
 */
export const BASKET_MISSION_PATTERNS: BasketMissionPattern[] = [
  // 1. Evento Social / Churrasco / Resenha (cerveja/cachaça + carne/carvão/salame/queijo/gelo)
  {
    id: 'social_event',
    name: 'Evento Social & Churrasco',
    requiresUserConfirmation: true, // NUNCA grava evento em silêncio!
    targetCategory: 'Lazer',
    targetSubcategory: 'Eventos & Reuniões',
    targetBucket: 'lifestyle',
    eventTag: 'churrasco',
    matches: (items: string[], rawText: string) => {
      const allText = items.join(' ') + ' ' + rawText
      const normText = norm(allText)
      const hasAlcohol = ALCOHOL_KEYWORDS.some((kw) => normText.includes(kw))
      const hasBbqOrPetisco = BBQ_PETISCO_KEYWORDS.some((kw) => normText.includes(kw))
      const hasExplicitEventWord =
        normText.includes('churrasco') ||
        normText.includes('encontro') ||
        normText.includes('resenha') ||
        normText.includes('festa') ||
        normText.includes('amigos')

      return (hasAlcohol && hasBbqOrPetisco) || (hasAlcohol && hasExplicitEventWord)
    },
    questionTemplate: (itemsSummary: string) =>
      `Percebi ${itemsSummary} — parece um encontro ou churrasco?`,
  },

  // 2. Festa / Noite de Filme / Cinema em Casa (pipoca + refri/doces)
  {
    id: 'movie_party',
    name: 'Cinema em Casa & Noite de Filmes',
    requiresUserConfirmation: true,
    targetCategory: 'Lazer',
    targetSubcategory: 'Cinema',
    targetBucket: 'lifestyle',
    eventTag: 'noite de filme',
    matches: (items: string[], rawText: string) => {
      const allText = items.join(' ') + ' ' + rawText
      const normText = norm(allText)
      const matched = MOVIE_PARTY_KEYWORDS.filter((kw) => normText.includes(kw))
      // Pipoca + doce ou refri
      const hasPipoca = normText.includes('pipoca')
      const hasSweetOrDrink =
        normText.includes('refrigerante') ||
        normText.includes('coca') ||
        normText.includes('chocolate') ||
        normText.includes('doce')
      return (hasPipoca && hasSweetOrDrink) || matched.length >= 3
    },
    questionTemplate: (itemsSummary: string) =>
      `Percebi ${itemsSummary} — isso foi para uma noite de filme ou lanche especial?`,
  },

  // 3. Presente (flores + chocolate/perfume)
  {
    id: 'gift',
    name: 'Presente',
    requiresUserConfirmation: true,
    targetCategory: 'Compras',
    targetSubcategory: 'Presentes',
    targetBucket: 'lifestyle',
    eventTag: 'presente',
    matches: (items: string[], rawText: string) => {
      const allText = items.join(' ') + ' ' + rawText
      const normText = norm(allText)
      const hasGiftWord = GIFT_KEYWORDS.some((kw) => normText.includes(kw))
      const hasChocolate = normText.includes('chocolate') || normText.includes('bombom')
      const hasFlowers =
        normText.includes('flor') || normText.includes('flores') || normText.includes('buque')
      return (hasFlowers && hasChocolate) || (hasGiftWord && items.length >= 2)
    },
    questionTemplate: (itemsSummary: string) =>
      `Percebi ${itemsSummary} — isso é um presente para alguém?`,
  },

  // 4. Bebê / Crianças (fralda + lencinho + leite)
  {
    id: 'baby',
    name: 'Cuidados com Bebê & Crianças',
    requiresUserConfirmation: false, // Compra de bebê é Compras › Bebês & Crianças direta
    targetCategory: 'Compras',
    targetSubcategory: 'Bebês & Crianças',
    targetBucket: 'lifestyle',
    eventTag: 'bebê',
    matches: (items: string[], rawText: string) => {
      const allText = items.join(' ') + ' ' + rawText
      const normText = norm(allText)
      const matchesCount = BABY_KEYWORDS.filter((kw) => normText.includes(kw)).length
      return matchesCount >= 2 || (normText.includes('fralda') && items.length >= 2)
    },
    questionTemplate: (itemsSummary: string) =>
      `Percebi itens de bebê (${itemsSummary}) — deseja registrar em Compras › Bebês & Crianças?`,
  },

  // 5. Cesta Óbvia do Dia a Dia (arroz, feijão, leite, sabão, etc.)
  {
    id: 'pantry_staple',
    name: 'Abastecimento da Casa / Mercado',
    requiresUserConfirmation: false, // SEM pergunta! Grava direto em Alimentação
    targetCategory: 'Alimentação',
    targetSubcategory: 'Supermercado & Atacado',
    targetBucket: 'essentials',
    eventTag: 'supermercado',
    matches: (items: string[], rawText: string) => {
      const allText = items.join(' ') + ' ' + rawText
      const normText = norm(allText)
      const pantryMatches = PANTRY_STAPLE_KEYWORDS.filter((kw) => normText.includes(kw)).length
      return pantryMatches >= 2
    },
    questionTemplate: () => '',
  },
]

/**
 * Detecta itens enumerados em texto ou voz (ex: "1 salame, 1 suco de maracujá e 1 caixa de cerveja")
 */
export function extractEnumeratedItems(text: string): DetectedBasketItem[] {
  // Remove menções de valor total no fim ou início (ex: "tudo 100 reais", "deu 100 reais", "por 100", "total 100 reais")
  const cleanedText = text
    .replace(
      /(,?\s*(tudo|deu|total|no total|ficou tudo|deu tudo|por)\s*(de\s*)?(r\$\s*)?\d+([,.]\d{1,2})?\s*(reais)?)/gi,
      '',
    )
    .trim()

  // Separadores de itens: vírgula, " e ", " mais ", " com "
  // Trata itens precedidos por números/quantidades (ex: "1 salame", "2 caixas de cerveja", "1 suco de maracujá")
  const rawSegments = cleanedText
    .split(/,|\s+e\s+|\s+mais\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)

  const items: DetectedBasketItem[] = []

  for (const seg of rawSegments) {
    // Limpa palavras de ligação e prefixos
    const cleanedSeg = seg
      .replace(/^(comprei|peguei|paguei|gastei|leva|levar)\s+/i, '')
      .replace(/^(um|uma|dois|duas|tres|três|quatro|1|2|3|4|5)\s+/i, '')
      .replace(/^(caixa de|fardo de|garrafa de|lata de|pacote de|quilo de|kg de|litro de)\s+/i, '')
      .trim()

    // Detecta quantidade se houver
    const qtyMatch = seg.match(/^(\d+|um|uma|dois|duas|tres|três)\b/i)
    let qty: number | undefined
    if (qtyMatch) {
      const qNorm = norm(qtyMatch[1])
      if (qNorm === 'um' || qNorm === 'uma') qty = 1
      else if (qNorm === 'dois' || qNorm === 'duas') qty = 2
      else if (qNorm === 'tres' || qNorm === 'três') qty = 3
      else qty = parseInt(qtyMatch[1], 10) || undefined
    }

    if (cleanedSeg.length > 1) {
      items.push({
        raw: seg,
        name: cleanedSeg.charAt(0).toUpperCase() + cleanedSeg.slice(1),
        quantity: qty,
      })
    }
  }

  return items
}

/**
 * Detecta se a entrada é uma "Cesta" (enumeração multi-item com valor total único)
 * Ex: "1 salame, 1 suco de maracujá e 1 caixa de cerveja, tudo 100 reais"
 */
export function isBasketInput(text: string): boolean {
  const normText = norm(text)

  // Marcadores de total único comum
  const hasTotalMarker =
    /\b(tudo|deu tudo|ficou tudo|total|no total|deu|por tudo)\s*(de\s*)?(r\$\s*)?\d+/i.test(text) ||
    /\btudo\s+\d+/i.test(text) ||
    /\b(tudo|total)\b/i.test(normText)

  // Enumeração: presença de vírgula ou conectivos de lista com múltiplos itens
  const hasMultipleItems =
    (text.includes(',') && (normText.includes(' e ') || normText.includes(' mais '))) ||
    normText.split(/\s+e\s+/).length >= 3 ||
    extractEnumeratedItems(text).length >= 2

  return hasMultipleItems && (hasTotalMarker || extractEnumeratedItems(text).length >= 3)
}

/**
 * Analisa a cesta completa e determina a missão de compra
 */
export function analyzeBasketMission(text: string, totalAmountCents: number): BasketAnalysisResult {
  const items = extractEnumeratedItems(text)
  const itemNames = items.map((i) => i.name)
  const itemsSummary = itemNames.join(', ').toLowerCase()

  // Busca padrão no dicionário
  let matchedPattern: BasketMissionPattern | undefined

  for (const pattern of BASKET_MISSION_PATTERNS) {
    if (pattern.matches(itemNames, text)) {
      matchedPattern = pattern
      break
    }
  }

  // Se nenhum casou, cai em pantry_staple ou general_basket
  if (!matchedPattern) {
    // Se tiver itens alimentares comuns
    const normText = norm(text)
    const hasFood = PANTRY_STAPLE_KEYWORDS.some((k) => normText.includes(k))
    if (hasFood) {
      matchedPattern = BASKET_MISSION_PATTERNS.find((p) => p.id === 'pantry_staple')
    }
  }

  const missionType: MissionType = matchedPattern?.id || 'general_basket'
  const requiresConfirmation = matchedPattern?.requiresUserConfirmation ?? false

  const suggestedCategory = matchedPattern?.targetCategory || 'Alimentação'
  const suggestedSubcategory = matchedPattern?.targetSubcategory || 'Supermercado & Atacado'
  const suggestedBucket = matchedPattern?.targetBucket || 'essentials'
  const eventTag = matchedPattern?.eventTag || ''

  // Formatação da descrição oficial dos itens (Regra d):
  // "Salame, suco de maracujá, cerveja — churrasco"
  const formattedItemsList = itemNames.join(', ')
  const itemsDescription = eventTag ? `${formattedItemsList} — ${eventTag}` : formattedItemsList

  let naturalQuestion: string | undefined
  if (requiresConfirmation && matchedPattern) {
    naturalQuestion = matchedPattern.questionTemplate(itemsSummary)
  }

  return {
    isBasket: items.length >= 2,
    items,
    totalAmountCents,
    matchedPattern,
    missionType,
    requiresConfirmation,
    naturalQuestion,
    suggestedCategory,
    suggestedSubcategory,
    suggestedBucket,
    itemsDescription,
    eventTag,
  }
}

/**
 * Interpreta a resposta livre do usuário para a pergunta de missão de compra.
 * NÃO usa chips/cards: interpreta a fala/texto livremente (doutrina R25/R26).
 *
 * Exemplos:
 * - "foi um churrasco sim", "sim, churrasco com a galera", "isso mesmo, resenha" -> confirm_event
 * - "não, compra de casa", "nada disso, comprei pra deixar aqui em casa", "não foi evento não" -> reject_event
 * - "cerveja pro churrasco, resto é da casa", "só a cerveja pro churrasco" -> split_basket
 * - "sei lá", "talvez" -> ambiguous
 */
export function interpretFreeTextBasketResponse(
  userResponse: string,
  analysis: BasketAnalysisResult,
): FreeTextInterpretationResult {
  const normResp = norm(userResponse)

  // 1. Resposta Parcial: DIVISÃO CONTEXTUAL (Regra c)
  // "cerveja pro churrasco, resto é da casa", "cerveja foi pro churrasco e o resto pra casa"
  const isSplitIntent =
    (normResp.includes('pro churrasco') ||
      normResp.includes('pra festa') ||
      normResp.includes('pro evento')) &&
    (normResp.includes('resto') ||
      normResp.includes('casa') ||
      normResp.includes('alimentacao') ||
      normResp.includes('mercado'))

  const isPartialBeer =
    normResp.includes('so a cerveja') ||
    normResp.includes('só a cerveja') ||
    normResp.includes('apenas a cerveja')

  if (isSplitIntent || isPartialBeer) {
    // Estimativa proporcional para sugerir ao usuário com confirmação
    // Cerveja normalmente ~40% a 50% de uma cesta mista
    const totalCents = analysis.totalAmountCents
    const estimatedBeerCents = totalCents > 0 ? Math.round(totalCents * 0.4) : 0
    const estimatedPantryCents = totalCents > 0 ? totalCents - estimatedBeerCents : 0

    const formattedBeer = (estimatedBeerCents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
    const formattedPantry = (estimatedPantryCents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

    return {
      intent: 'split_basket',
      category: 'Lazer',
      subcategory: 'Eventos & Reuniões',
      bucket: 'lifestyle',
      splitItems: [
        {
          description: 'Cerveja — churrasco',
          category: 'Lazer',
          subcategory: 'Eventos & Reuniões',
          bucket: 'lifestyle',
          estimatedAmountCents: estimatedBeerCents,
          needsAmountConfirmation: true,
        },
        {
          description: 'Salame e suco — casa',
          category: 'Alimentação',
          subcategory: 'Supermercado & Atacado',
          bucket: 'essentials',
          estimatedAmountCents: estimatedPantryCents,
          needsAmountConfirmation: true,
        },
      ],
      confirmationQuestion: `Dividi a cesta: aproximadamente ${formattedBeer} para Cerveja (Lazer) e ${formattedPantry} para compras da casa (Alimentação). Posso confirmar esses valores?`,
    }
  }

  // 2. Confirmação do Evento: "sim", "foi churrasco", "com certeza", "isso aí", "com os amigos"
  const positiveConfirmations = [
    'sim',
    'foi sim',
    'churrasco',
    'churrasco sim',
    'foi um churrasco',
    'foi churrasco sim',
    'foi um churrasco sim',
    'isso',
    'isso mesmo',
    'com certeza',
    'com a galera',
    'com os amigos',
    'encontro',
    'resenha',
    'festa',
    'presente',
    'presente sim',
    'noite de filme',
    'filme sim',
    'filme',
    'lanche especial',
    'pode colocar em lazer',
    'lazer',
    'evento',
  ]

  const isPositive = positiveConfirmations.some(
    (term) => normResp === term || normResp.includes(term),
  )
  const hasNegative =
    normResp.startsWith('nao') ||
    normResp.startsWith('não') ||
    normResp.includes('nao foi') ||
    normResp.includes('não foi')

  if (isPositive && !hasNegative) {
    return {
      intent: 'confirm_event',
      category: analysis.suggestedCategory,
      subcategory: analysis.suggestedSubcategory,
      bucket: analysis.suggestedBucket,
    }
  }

  // 3. Rejeição do Evento: "não", "compra de casa", "mercado normal", "dia a dia"
  const negativePhrases = [
    'nao',
    'não',
    'compra de casa',
    'da casa',
    'casa',
    'mercado',
    'supermercado',
    'alimentacao',
    'alimentação',
    'dia a dia',
    'normal',
    'nada disso',
    'nao foi evento',
    'não foi evento',
    'pro mes',
    'pro mês',
  ]

  const isNegative = negativePhrases.some((term) => normResp.includes(term))

  if (isNegative) {
    return {
      intent: 'reject_event',
      category: 'Alimentação',
      subcategory: 'Supermercado & Atacado',
      bucket: 'essentials',
    }
  }

  // 4. Resposta ambígua
  return {
    intent: 'ambiguous',
    category: analysis.suggestedCategory,
    subcategory: analysis.suggestedSubcategory,
    bucket: analysis.suggestedBucket,
    confirmationQuestion:
      'Não entendi se foi para a casa ou um evento social. Prefere registrar em Alimentação (Casa) ou Lazer (Evento)?',
    isUncertainSuggestion: true,
  }
}
