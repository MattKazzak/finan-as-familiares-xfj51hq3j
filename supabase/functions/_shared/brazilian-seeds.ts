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
  | 'bebes_criancas'
  | 'marmitas_refeicoes'
  | 'coparticipacao'
  | 'restituicao_ir'
  | 'salario_13_ferias'
  | 'investimentos_tesouro'
  | 'investimentos_renda_fixa'
  | 'rendimentos_dividendos'
  | 'aposentadoria_pensao'

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
      'Financiamento Imobiliário',
      'Financiamento de Veículo',
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
      'Supermercado & Atacado',
      'Supermercado',
      'Mercado',
      'Açougue & Peixaria',
      'Hortifruti & Feira',
      'Padaria & Mercearia',
      'Restaurantes & Bares',
      'Delivery (iFood/Rappi)',
      'Fast Food & Lanches',
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
      'Transporte Público',
      'Apps & Táxi (Uber/99)',
      'Estacionamento & Pedágio',
      'Oficina & Manutenção',
      'IPVA & Licenciamento',
      'Seguro do Veículo',
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
      'Streaming de Vídeo',
      'Música & Podcasts',
      'Softwares & Apps',
      'Jogos & Gaming',
      'Armazenamento & Nuvem',
      'Clubes de Assinatura',
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
    suggestedSubcategoryNames: [
      'Farmácia & Medicamentos',
      'Farmácia',
      'Consultas & Exames',
      'Plano de Saúde & Convênio',
      'Odontologia',
      'Saúde',
    ],
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
    suggestedSubcategoryNames: [
      'Cursos & Idiomas',
      'Faculdade',
      'Escola & Creche',
      'Material & Livros Didáticos',
      'Educação',
    ],
  },
  // 9. Bebês & Crianças (Compras)
  {
    intent: 'bebes_criancas',
    patterns: ['fralda', 'enxoval', 'bebe', 'ri happy', 'alo bebe', 'pampers', 'huggies'],
    suggestedSubcategoryNames: ['Bebês & Crianças', 'Compras'],
  },
  // 10. Marmitas & Refeições no Trabalho (Restaurantes & Delivery)
  {
    intent: 'marmitas_refeicoes',
    patterns: ['marmita', 'marmitaria', 'quentinha', 'almoco executivo', 'refeicao trabalho'],
    suggestedSubcategoryNames: ['Marmitas & Refeições no Trabalho', 'Restaurantes & Delivery'],
  },
  // 11. Coparticipação (Saúde)
  {
    intent: 'coparticipacao',
    patterns: ['coparticipacao', 'coparticipação', 'coparticipacao unimed', 'copart unimed'],
    suggestedSubcategoryNames: ['Coparticipação', 'Plano de Saúde & Convênio', 'Saúde'],
  },
  // 12. Restituição de Imposto de Renda (Outras Receitas)
  {
    intent: 'restituicao_ir',
    patterns: ['restituicao', 'restituição', 'restituicao ir', 'restituicao irpf', 'rest irpf'],
    suggestedSubcategoryNames: ['Restituição de Imposto de Renda', 'Outras Receitas'],
  },
  // 13. 13º & Férias (Salário)
  {
    intent: 'salario_13_ferias',
    patterns: [
      '13o',
      '13º',
      'decimo terceiro',
      'décimo terceiro',
      'adiantamento 13',
      'ferias',
      'férias',
    ],
    suggestedSubcategoryNames: ['13º & Férias', 'Salário'],
  },
  // 14. Tesouro Direto (Investimentos)
  {
    intent: 'investimentos_tesouro',
    patterns: ['tesouro direto', 'tesouro selic', 'tesouro ipca', 'tesouro prefixado', 'tesouro'],
    suggestedSubcategoryNames: ['Tesouro Direto', 'Investimentos'],
  },
  // 15. Renda Fixa (Investimentos)
  {
    intent: 'investimentos_renda_fixa',
    patterns: ['cdb', 'lci', 'lca', 'cra', 'cri', 'debenture', 'renda fixa'],
    suggestedSubcategoryNames: ['Renda Fixa (CDB/LCI/LCA)', 'Investimentos'],
  },
  // 16. Dividendos & JCP (Rendimentos)
  {
    intent: 'rendimentos_dividendos',
    patterns: ['dividendo', 'dividendos', 'jcp', 'juros sobre capital', 'rendimento fii'],
    suggestedSubcategoryNames: ['Dividendos & JCP', 'Rendimentos'],
  },
  // 17. Aposentadoria & Pensão (Rendimentos)
  {
    intent: 'aposentadoria_pensao',
    patterns: ['pensao', 'pensão', 'pensao inss', 'aposentadoria', 'beneficio inss', 'inss pensao'],
    suggestedSubcategoryNames: ['Aposentadoria & Pensão', 'Rendimentos'],
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

      // Guardas de Word-boundary para termos curtos/genéricos
      // ('max', 'metro', 'google', 'apple', 'swift', 'posto', 'cpt', 'bebe', 'cdb', 'lci', 'lca', 'cra', 'cri', 'jcp', '13o')
      const SHORT_BOUNDARY_TERMS = new Set([
        'posto',
        'cpt',
        'max',
        'metro',
        'google',
        'apple',
        'swift',
        'bebe',
        'cdb',
        'lci',
        'lca',
        'cra',
        'cri',
        'jcp',
        '13o',
      ])

      if (SHORT_BOUNDARY_TERMS.has(normPat)) {
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

      // Match por inclusão direta (ex: "ifood", "uber", "drogasil", "sorvete", "fralda", "restituicao", "tesouro", "dividendo", "marmita")
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

  if (
    intent === 'sorvete_acai' ||
    intent === 'conveniencia_posto' ||
    intent === 'marmitas_refeicoes'
  ) {
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
  } else if (intent === 'bebes_criancas') {
    // Busca Compras / Vestuário / Bebês
    matchedCat =
      pool.find((c) => {
        const n = normalize(c.name)
        return n.includes('compras') || n.includes('vestuario') || n.includes('bebe')
      }) ||
      pool.find((c) => c.budget_bucket === 'lifestyle') ||
      pool[0] ||
      null
  } else if (intent === 'coparticipacao') {
    // Busca Saúde
    matchedCat =
      pool.find((c) => {
        const n = normalize(c.name)
        return n.includes('saude') || n.includes('medico') || n.includes('farmacia')
      }) ||
      pool.find((c) => c.budget_bucket === 'essentials') ||
      pool[0] ||
      null
  } else if (intent === 'investimentos_tesouro' || intent === 'investimentos_renda_fixa') {
    // Busca Investimentos
    matchedCat =
      pool.find((c) => {
        const n = normalize(c.name)
        return n.includes('investimento') || n.includes('aplicacao')
      }) ||
      pool.find((c) => c.budget_bucket === 'future') ||
      pool[0] ||
      null
  } else if (intent === 'salario_13_ferias') {
    // Busca Salário
    matchedCat =
      catalog.find((c) => {
        const n = normalize(c.name)
        return (
          c.type === 'income' &&
          (n.includes('salario') || n.includes('renda') || n.includes('remuneracao'))
        )
      }) ||
      catalog.find((c) => c.type === 'income') ||
      pool[0] ||
      null
  } else if (intent === 'restituicao_ir') {
    // Busca Outras Receitas
    matchedCat =
      catalog.find((c) => {
        const n = normalize(c.name)
        return (
          c.type === 'income' &&
          (n.includes('outras receitas') || n.includes('receitas') || n.includes('extra'))
        )
      }) ||
      catalog.find((c) => c.type === 'income') ||
      pool[0] ||
      null
  } else if (intent === 'rendimentos_dividendos' || intent === 'aposentadoria_pensao') {
    // Busca Rendimentos
    matchedCat =
      catalog.find((c) => {
        const n = normalize(c.name)
        return (
          c.type === 'income' &&
          (n.includes('rendimento') ||
            n.includes('aposentadoria') ||
            n.includes('pensao') ||
            n.includes('dividendo'))
        )
      }) ||
      catalog.find((c) => c.type === 'income') ||
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
