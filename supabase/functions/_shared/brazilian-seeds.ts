/**
 * Seed Brasileiro em Código (Camada Determinística Rápida - 0ms, zero tokens).
 *
 * Mapeia estabelecimentos frequentes para intenções semânticas:
 * - Alimentação/Mercado: ifood, ze delivery, carrefour, pao de acucar, assai, atacadao, mcdonalds, outback, burger king, spoleto
 * - Mobilidade: uber, 99app, 99 tecnologia, sem parar, veloe, shell, ipiranga, posto
 * - Assinaturas: netflix, spotify, amazon prime, max, disney, apple, google, openai, chatgpt, youtube
 * - Farmácia/Saúde: droga raia, drogasil, pacheco, panvel, pague menos, dpsp, consulta, clinica
 * - Educação/Infoprodutos: hotmart, kiwify, eduzz, monetizze, cpt, alura, udemy, instagram milionario
 *
 * Ao identificar a intenção, busca no catálogo da família a categoria que melhor corresponde àquela intenção:
 * (ex: "educacao_cursos" mapeia para categoria de Educação ou Desenvolvimento; se não houver, Estilo de Vida).
 */

export type SemanticIntent =
  | 'alimentacao_mercado'
  | 'mobilidade_transporte'
  | 'assinaturas_streaming'
  | 'farmacia_saude'
  | 'educacao_cursos'
  | 'dividas_emprestimos'
  | 'sorvete_acai'
  | 'conveniencia_posto'

export interface SeedMerchantEntry {
  patterns: readonly string[]
  intent: SemanticIntent
  suggestedSubcategoryNames?: readonly string[]
}

export const BRAZILIAN_MERCHANT_SEEDS: readonly SeedMerchantEntry[] = [
  // 1. Sorvete & Açaí (via Restaurantes & Delivery)
  {
    intent: 'sorvete_acai',
    patterns: [
      'sorvete',
      'sorveteria',
      'acai',
      'açaí',
      'gelato',
      'bacio di latte',
      'oakberry',
      'chiquinho sorvetes',
      'oggi sorvetes',
    ],
    suggestedSubcategoryNames: ['Sorvete & Açaí', 'Sorvete', 'Açaí', 'Restaurantes & Delivery'],
  },
  // 2. Conveniência & Lanchonetes de Posto (via Restaurantes & Delivery)
  {
    intent: 'conveniencia_posto',
    patterns: [
      'conveniencia',
      'loja de conveniencia',
      'am/pm',
      'ampm',
      'shell select',
      'br mania',
      'posto conveniencia',
    ],
    suggestedSubcategoryNames: [
      'Conveniência & Lanchonetes de Posto',
      'Conveniência',
      'Restaurantes & Delivery',
    ],
  },
  // 3. Dívidas & Empréstimos
  {
    intent: 'dividas_emprestimos',
    patterns: [
      'fatura anterior',
      'parcelamento de fatura',
      'parcelamento fatura',
      'rotativo',
      'emprestimo',
      'empréstimo',
      'emprestimo pessoal',
      'empréstimo pessoal',
      'crediario',
      'crediário',
      'financiamento',
      'cheque especial',
      'overdraft',
    ],
    suggestedSubcategoryNames: [
      'Fatura do Cartão (Rotativo & Parcelado)',
      'Empréstimos Pessoais',
      'Financiamentos (Casa/Auto)',
      'Cheque Especial & Overdraft',
    ],
  },
  // 4. Alimentação / Mercado / Delivery
  {
    intent: 'alimentacao_mercado',
    patterns: [
      'ifood',
      'ze delivery',
      'carrefour',
      'pao de acucar',
      'assai',
      'atacadao',
      'mcdonalds',
      'mc donald',
      'outback',
      'burger king',
      'spoleto',
      'rappi',
      'aiqfome',
      'sams club',
      'swift',
      'hortifruti',
      'subway',
      'habibs',
    ],
    suggestedSubcategoryNames: [
      'Mercado',
      'Restaurantes',
      'Delivery',
      'Supermercado',
      'Lanches',
      'Fast Food & Lanches',
      'Restaurantes & Bares',
    ],
  },
  // 5. Mobilidade / Transporte / Combustível / Pedágio
  {
    intent: 'mobilidade_transporte',
    patterns: [
      'uber',
      '99app',
      '99 tecnologia',
      '99 taxi',
      '99 pop',
      'sem parar',
      'veloe',
      'conectcar',
      'shell',
      'ipiranga',
      'posto',
      'auto posto',
      'estapar',
      'sptrans',
      'cptm',
      'metro',
    ],
    suggestedSubcategoryNames: [
      'Combustível',
      'Aplicativos',
      'Transporte',
      'Pedágio',
      'Estacionamento',
      'Aplicativos do Dia a Dia (Uber/99)',
    ],
  },
  // 6. Assinaturas / Streaming / Software
  {
    intent: 'assinaturas_streaming',
    patterns: [
      'netflix',
      'spotify',
      'amazon prime',
      'prime video',
      'max',
      'hbo max',
      'disney',
      'disney plus',
      'apple',
      'apple.com/bill',
      'google',
      'google one',
      'google storage',
      'openai',
      'chatgpt',
      'youtube',
      'deezer',
      'globoplay',
      'canva',
      'microsoft',
      'icloud',
    ],
    suggestedSubcategoryNames: [
      'Streaming',
      'Softwares & Ferramentas',
      'Softwares & Apps',
      'Assinaturas',
      'Serviços',
    ],
  },
  // 7. Farmácia / Saúde / Consultas
  {
    intent: 'farmacia_saude',
    patterns: [
      'droga raia',
      'drogasil',
      'pacheco',
      'panvel',
      'pague menos',
      'dpsp',
      'drogaria sao paulo',
      'consulta',
      'clinica',
      'ultrafarma',
      'unimed',
      'laboratorio',
      'fleury',
      'dentista',
      'hospital',
    ],
    suggestedSubcategoryNames: ['Farmácia', 'Remédios', 'Consultas & Exames', 'Saúde'],
  },
  // 8. Educação / Cursos / Infoprodutos
  {
    intent: 'educacao_cursos',
    patterns: [
      'hotmart',
      'kiwify',
      'eduzz',
      'monetizze',
      'cpt',
      'cursos cpt',
      'alura',
      'udemy',
      'instagram milionario',
      'coursera',
      'rocketseat',
      'empiricus',
      'escola',
      'faculdade',
    ],
    suggestedSubcategoryNames: ['Cursos & Treinamentos', 'Educação', 'Livros', 'Desenvolvimento'],
  },
] as const

/**
 * Normaliza string para correspondência case-insensitive e sem acentos
 */
export function normalizeMerchantString(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Identifica se uma descrição corresponde a uma das intenções do Seed Brasileiro.
 */
export function matchMerchantSeed(description: string): {
  intent: SemanticIntent
  matchedPattern: string
  entry: SeedMerchantEntry
} | null {
  if (!description) return null
  const norm = normalizeMerchantString(description)
  if (!norm) return null

  for (const entry of BRAZILIAN_MERCHANT_SEEDS) {
    for (const pat of entry.patterns) {
      const normPat = normalizeMerchantString(pat)
      if (!normPat) continue

      // 4.1 Guardas de Word-boundary para termos curtos/genéricos
      // ('max', 'metro', 'google', 'apple', 'swift', 'posto', 'cpt')
      if (
        normPat === 'posto' ||
        normPat === 'cpt' ||
        normPat === 'max' ||
        normPat === 'metro' ||
        normPat === 'google' ||
        normPat === 'apple' ||
        normPat === 'swift'
      ) {
        if (normPat === 'posto') {
          const regex = /(^|\s)posto(\s|$)/i
          if (regex.test(norm) && !norm.includes('salario') && !norm.includes('imposto')) {
            return { intent: entry.intent, matchedPattern: pat, entry }
          }
          continue
        }

        const escaped = normPat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const boundaryRegex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i')
        if (boundaryRegex.test(norm)) {
          return { intent: entry.intent, matchedPattern: pat, entry }
        }
        continue
      }

      // Match por inclusão direta (ex: "ifood", "uber", "drogasil", "sorvete", "acai")
      if (norm.includes(normPat)) {
        return { intent: entry.intent, matchedPattern: pat, entry }
      }
    }
  }

  return null
}

/**
 * Interface mínima de categoria para resolução agnóstica de ambiente (Edge Function ou Frontend React)
 */
export interface GenericCategoryInput {
  id: string
  name: string
  type?: string | null
  budget_bucket?: string | null
  transaction_subcategories?: Array<{ id: string; name: string }> | null
  subcategories?: Array<{ id: string; name: string }> | null
}

export interface SeedResolvedCategoryResult {
  categoryId: string
  subcategoryId: string | null
  intent: SemanticIntent
  confidence: number
  reasoning: string
}

/**
 * Resolve a melhor categoria no catálogo da família para uma intenção semântica identificada:
 *
 * 1. "alimentacao_mercado":
 *    - Busca categoria cujo nome contenha Alimentação, Mercado, Restaurante, Delivery, Gastronomia, Refeição
 *    - Se não achar, busca categoria de lifestyle ou essentials
 *
 * 2. "mobilidade_transporte":
 *    - Busca categoria cujo nome contenha Transporte, Mobilidade, Combustível, Veículo, Carro
 *    - Se não achar, busca categoria em essentials ou lifestyle
 *
 * 3. "assinaturas_streaming":
 *    - Busca categoria cujo nome contenha Assinatura, Streaming, Serviços, Conectividade, Lazer
 *    - Se não achar, busca no balde lifestyle (ou nome contendo Outros / Diversos)
 *
 * 4. "farmacia_saude":
 *    - Busca categoria cujo nome contenha Saúde, Cuidados Médicos, Farmácia, Remédios
 *    - Se não achar, busca no balde essentials
 *
 * 5. "educacao_cursos":
 *    - Busca categoria de Educação ou Desenvolvimento
 *    - Se não houver, busca categoria no balde "lifestyle" (ex.: Outros, Lazer, Assinaturas, Serviços)
 *    - JAMAIS Moradia ou Alimentação!
 */
export function resolveCategoryForIntent(
  intent: SemanticIntent,
  catalog: readonly GenericCategoryInput[],
  suggestedSubs?: readonly string[],
): { categoryId: string; subcategoryId: string | null } | null {
  if (!catalog || catalog.length === 0) return null

  // Filtra apenas categorias de despesa se houver type especificado
  const expenseCats = catalog.filter((c) => !c.type || c.type === 'expense')
  const pool = expenseCats.length > 0 ? expenseCats : catalog

  const normalize = (s: string) => normalizeMerchantString(s)

  let matchedCat: GenericCategoryInput | null = null

  if (intent === 'sorvete_acai' || intent === 'conveniencia_posto') {
    // Busca preferencialmente Restaurantes & Delivery / Gastronomia
    matchedCat =
      pool.find((c) => {
        const n = normalize(c.name)
        return n.includes('restaurante') || n.includes('delivery') || n.includes('gastronomia')
      }) ||
      pool.find((c) => {
        const n = normalize(c.name)
        return n.includes('alimentacao') || n.includes('mercado')
      }) ||
      pool.find((c) => c.budget_bucket === 'lifestyle') ||
      pool[0] ||
      null
  } else if (intent === 'dividas_emprestimos') {
    // Busca Dívidas & Empréstimos / Financiamentos
    matchedCat =
      pool.find((c) => {
        const n = normalize(c.name)
        return n.includes('divida') || n.includes('emprestimo') || n.includes('financiamento')
      }) ||
      pool.find((c) => c.budget_bucket === 'essentials') ||
      pool[0] ||
      null
  } else if (intent === 'alimentacao_mercado') {
    // 1. Alimentação / Mercado / Restaurantes / Gastronomia / Delivery
    matchedCat =
      pool.find((c) => {
        const n = normalize(c.name)
        return (
          n.includes('alimentacao') ||
          n.includes('mercado') ||
          n.includes('restaurante') ||
          n.includes('delivery') ||
          n.includes('gastronomia')
        )
      }) || null

    if (!matchedCat) {
      // Fallback para categoria do balde essentials ou lifestyle
      matchedCat = pool.find((c) => c.budget_bucket === 'essentials') || pool[0] || null
    }
  } else if (intent === 'mobilidade_transporte') {
    // 2. Transporte / Mobilidade / Combustível
    matchedCat =
      pool.find((c) => {
        const n = normalize(c.name)
        return (
          n.includes('transporte') ||
          n.includes('mobilidade') ||
          n.includes('combustivel') ||
          n.includes('veiculo')
        )
      }) || null

    if (!matchedCat) {
      matchedCat = pool.find((c) => c.budget_bucket === 'essentials') || pool[0] || null
    }
  } else if (intent === 'assinaturas_streaming') {
    // 3. Assinaturas / Conectividade / Serviços / Streaming
    matchedCat =
      pool.find((c) => {
        const n = normalize(c.name)
        return (
          n.includes('assinatura') ||
          n.includes('streaming') ||
          n.includes('conectividade') ||
          n.includes('servico') ||
          n.includes('lazer')
        )
      }) || null

    if (!matchedCat) {
      // Fallback para balde lifestyle ou Outros / Diversos
      matchedCat =
        pool.find((c) => c.budget_bucket === 'lifestyle') ||
        pool.find((c) => {
          const n = normalize(c.name)
          return n.includes('outro') || n.includes('diverso')
        }) ||
        pool[0] ||
        null
    }
  } else if (intent === 'farmacia_saude') {
    // 4. Saúde & Cuidados Médicos / Farmácia
    matchedCat =
      pool.find((c) => {
        const n = normalize(c.name)
        return (
          n.includes('saude') ||
          n.includes('medico') ||
          n.includes('farmacia') ||
          n.includes('cuidado')
        )
      }) || null

    if (!matchedCat) {
      matchedCat = pool.find((c) => c.budget_bucket === 'essentials') || pool[0] || null
    }
  } else if (intent === 'educacao_cursos') {
    // 5. Educação / Cursos / Infoprodutos
    // Busca categoria de Educação ou Desenvolvimento
    matchedCat =
      pool.find((c) => {
        const n = normalize(c.name)
        return (
          n.includes('educacao') ||
          n.includes('curso') ||
          n.includes('desenvolvimento') ||
          n.includes('treinamento')
        )
      }) || null

    // Se NÃO houver categoria de Educação/Desenvolvimento:
    // mapeia OBRIGATORIAMENTE para categoria de Estilo de Vida (lifestyle) ou Outros/Diversos.
    // NUNCA Moradia ou Alimentação!
    if (!matchedCat) {
      matchedCat =
        pool.find((c) => {
          const n = normalize(c.name)
          return (
            (c.budget_bucket === 'lifestyle' &&
              !n.includes('moradia') &&
              !n.includes('alimentacao')) ||
            n.includes('outro') ||
            n.includes('diverso') ||
            n.includes('estilo de vida')
          )
        }) ||
        pool.find((c) => c.budget_bucket === 'lifestyle') ||
        null
    }
  }

  if (!matchedCat) return null

  // Tentar casar subcategoria adequada
  let subcategoryId: string | null = null
  const subList = matchedCat.transaction_subcategories || matchedCat.subcategories || []
  if (subList.length > 0 && suggestedSubs && suggestedSubs.length > 0) {
    for (const sug of suggestedSubs) {
      const normSug = normalize(sug)
      const foundSub = subList.find((s) => {
        const normSub = normalize(s.name)
        return normSub.includes(normSug) || normSug.includes(normSub)
      })
      if (foundSub) {
        subcategoryId = foundSub.id
        break
      }
    }
  }

  return {
    categoryId: matchedCat.id,
    subcategoryId,
  }
}

/**
 * Camada determinística rápida: verifica se uma descrição bate no Seed Brasileiro
 * e resolve instantaneamente no catálogo da família (0ms, zero tokens de IA).
 */
export function resolveBrazilianMerchantSeed(
  rawDescription: string,
  catalog: readonly GenericCategoryInput[],
): SeedResolvedCategoryResult | null {
  const match = matchMerchantSeed(rawDescription)
  if (!match) return null

  const resolved = resolveCategoryForIntent(
    match.intent,
    catalog,
    match.entry.suggestedSubcategoryNames,
  )
  if (!resolved || !resolved.categoryId) return null

  return {
    categoryId: resolved.categoryId,
    subcategoryId: resolved.subcategoryId,
    intent: match.intent,
    confidence: 0.98,
    reasoning: `Seed brasileiro em código: estabelecimento "${match.matchedPattern}" mapeado para a intenção ${match.intent}`,
  }
}
