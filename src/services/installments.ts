// Utilitários para detecção e geração de parcelas e projeções futuras
// Suporta detecção de formatos: "XX/YY", "PARC XX/YY", "PARC XX", "PARCELA XX DE YY"

export interface ParsedInstallmentInfo {
  isInstallment: boolean
  current: number
  total: number
  cleanDescription: string
  rawPattern?: string
}

export interface GroupedTransactionItem {
  id: string
  isGroup: boolean
  baseDescription: string
  currentInstallment: number
  totalInstallments: number
  installmentCount: number
  representativeTx: any // Transaction
  transactions: any[] // Transaction[]
  amountCents: number // Valor da parcela mais recente
  transactionDate: string // Data da parcela mais recente
}

/**
 * Remove qualquer marcação de parcela pré-existente de uma descrição (ex.: "- Parcela 1/10",
 * "Parcela 1/10", "(02/10)", "PARC 02/10", etc.) para obter o nome base limpo do estabelecimento.
 */
export function cleanInstallmentBaseDescription(description: string): string {
  if (!description) return ''
  let text = description.trim()

  // 1. Remove sufixos com parênteses no final, ex: "(02/10)", "(2/10)", "(02)"
  text = text.replace(
    /\s*\(\s*(?:parc(?:ela)?\.?\s*)?\d{1,2}\s*(?:\/|\s+de\s+)?\s*\d{0,2}\s*\)\s*$/i,
    '',
  )

  // 2. Remove sufixos com hífen / traço como " - Parcela 1/10", " - Parc 1/10", " - 01/10"
  text = text.replace(
    /\s*[-–—/]\s*(?:parc(?:ela)?\.?\s*)?\d{1,2}\s*(?:\/|\s+de\s+)\s*\d{1,2}\s*$/i,
    '',
  )

  // 3. Remove "Parcela X/Y" ou "Parc X/Y" no final sem hífen
  text = text.replace(
    /\s+\b(?:parc(?:ela)?\.?)\s*[:#-]?\s*\d{1,2}\s*(?:\/|\s+de\s+)\s*\d{1,2}\s*$/i,
    '',
  )

  // 4. Remove " X/Y" no final se for padrão de parcela
  text = text.replace(/\s+\d{1,2}\s*\/\s*\d{1,2}\s*$/i, '')

  // 5. Remove "Parcela X de Y" ou "Parc X"
  text = text.replace(/\s+\b(?:parc(?:ela)?\.?)\s*[:#-]?\s*\d{1,2}\s*(?:\s+de\s+\d{1,2})?\s*$/i, '')

  // Limpa pontuações / espaços residuais nas bordas
  text = text.replace(/^[-–—/,\s]+|[-–—/,\s]+$/g, '').trim()

  return text || description.trim()
}

/**
 * Monta o título formatado exibido na interface para uma transação.
 * Se a transação for parcela (ou contiver indicação de parcela no banco):
 * - Reconstrói com a parcela correta baseada em installment_number e installment_total reais.
 * - Evita absurdos como "Flavios Calcados - Parcela 1/10 (10/10)" ou duplicações.
 * Para transações comuns, retorna a descrição limpa ou fallback.
 */
export function formatTransactionTitle(tx: {
  description?: string | null
  is_installment?: boolean | null
  installment_number?: number | null
  installment_total?: number | null
  category?: { name?: string } | null
}): string {
  const rawDesc = tx.description?.trim() || ''
  const isInstallment = !!tx.is_installment

  if (isInstallment) {
    const num = tx.installment_number || 1
    const total = tx.installment_total || Math.max(num, 1)
    const base = cleanInstallmentBaseDescription(rawDesc) || tx.category?.name || 'Despesa'
    return `${base} - Parcela ${num}/${total}`
  }

  // Se não foi marcada com is_installment mas a descrição tem padrão de parcela explícito
  if (rawDesc && /\bparc(?:ela)?\b/i.test(rawDesc)) {
    const parsed = parseInstallmentFromDescription(rawDesc)
    if (parsed.isInstallment) {
      const base =
        cleanInstallmentBaseDescription(parsed.cleanDescription) || tx.category?.name || 'Despesa'
      return `${base} - Parcela ${parsed.current}/${parsed.total}`
    }
  }

  return rawDesc || tx.category?.name || 'Sem descrição'
}

/**
 * Detecta se a descrição contém padrão de compra parcelada e extrai número da parcela e total.
 * Exemplos aceitos:
 *  - "Compra 03/10" -> current: 3, total: 10, cleanDescription: "Compra"
 *  - "Mercado Livre PARC 3/10" -> current: 3, total: 10
 *  - "PARC 2/5 Magazine Luiza" -> current: 2, total: 5
 *  - "LOJA XYZ 01/12" -> current: 1, total: 12
 *  - "UBER TRIP PARC 02" -> current: 2, total: 2 (ou fallback)
 *  - "Compra 1 de 10" -> current: 1, total: 10
 *  - "PARCELA 04/06" -> current: 4, total: 6
 */
export function parseInstallmentFromDescription(description: string): ParsedInstallmentInfo {
  if (!description) {
    return { isInstallment: false, current: 1, total: 1, cleanDescription: '' }
  }

  const trimmed = description.trim()

  // 1. Padrão "PARC(ELA)? (\d{1,2})[/ DE]+(\d{1,2})"
  const parcWithTotalRegex =
    /\b(?:PARC(?:ELA)?\.?)\s*[:#-]?\s*(\d{1,2})\s*(?:\/|\s+DE\s+)\s*(\d{1,2})\b/i
  let match = trimmed.match(parcWithTotalRegex)
  if (match) {
    const cur = parseInt(match[1], 10)
    const tot = parseInt(match[2], 10)
    if (cur > 0 && tot >= cur && tot <= 99) {
      const cleanDesc = trimmed
        .replace(match[0], '')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[-–—/,\s]+|[-–—/,\s]+$/g, '')
        .trim()
      return {
        isInstallment: true,
        current: cur,
        total: tot,
        cleanDescription: cleanDesc || trimmed,
        rawPattern: match[0],
      }
    }
  }

  // 2. Padrão "(\d{1,2})\s*(?:\/|\s+DE\s+)\s*(\d{1,2})" com cuidado para não capturar datas como 12/05 ou 20/24
  // Procura padrões como " 03/10", " 1/6", " 01/12"
  const slashWithTotalRegex = /(?:\s|^|\()(\d{1,2})\s*(?:\/|\s+DE\s+)\s*(\d{1,2})(?:\)|\s|$)/i
  match = trimmed.match(slashWithTotalRegex)
  if (match) {
    const cur = parseInt(match[1], 10)
    const tot = parseInt(match[2], 10)
    // Para não confundir com datas normais (ex: 15/03 ou 05/12):
    // Em parcelamento brasileiro, tot é normalmente até 48x (ex: 2 a 48) e cur <= tot.
    // Se cur for 1..tot e tot for entre 2 e 48, consideramos parcela.
    if (cur > 0 && cur <= tot && tot >= 2 && tot <= 48) {
      const cleanDesc = trimmed
        .replace(match[0], ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[-–—/,\s]+|[-–—/,\s]+$/g, '')
        .trim()
      return {
        isInstallment: true,
        current: cur,
        total: tot,
        cleanDescription: cleanDesc || trimmed,
        rawPattern: match[0].trim(),
      }
    }
  }

  // 3. Padrão "PARC(ELA)? (\d{1,2})" isolado sem total explícito (ex: "PARC 02")
  const parcSingleRegex = /\b(?:PARC(?:ELA)?\.?)\s*[:#-]?\s*(\d{1,2})\b/i
  match = trimmed.match(parcSingleRegex)
  if (match) {
    const cur = parseInt(match[1], 10)
    if (cur > 0 && cur <= 48) {
      const cleanDesc = trimmed
        .replace(match[0], '')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[-–—/,\s]+|[-–—/,\s]+$/g, '')
        .trim()
      return {
        isInstallment: true,
        current: cur,
        total: Math.max(cur, 2), // Total desconhecido, no mínimo >= cur
        cleanDescription: cleanDesc || trimmed,
        rawPattern: match[0].trim(),
      }
    }
  }

  return {
    isInstallment: false,
    current: 1,
    total: 1,
    cleanDescription: trimmed,
  }
}

/**
 * Adiciona N meses a uma data YYYY-MM-DD preservando o dia desejado sempre que possível,
 * respeitando os limites do mês (ex: 31 de janeiro + 1 mês -> 28 ou 29 de fevereiro).
 */
export function addMonthsToDate(dateStr: string, monthsToAdd: number): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-')
  const originalYear = parseInt(yearStr, 10)
  const originalMonth = parseInt(monthStr, 10) // 1..12
  const originalDay = parseInt(dayStr, 10) // 1..31

  let targetYear = originalYear
  let targetMonth = originalMonth + monthsToAdd

  while (targetMonth > 12) {
    targetYear += 1
    targetMonth -= 12
  }
  while (targetMonth < 1) {
    targetYear -= 1
    targetMonth += 12
  }

  // Quantidade de dias no mês destino
  const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate()
  const targetDay = Math.min(originalDay, daysInTargetMonth)

  const yStr = String(targetYear)
  const mStr = String(targetMonth).padStart(2, '0')
  const dStr = String(targetDay).padStart(2, '0')

  return `${yStr}-${mStr}-${dStr}`
}

/**
 * Gera as parcelas para criação a partir de uma compra parcelada.
 * A parcela inicial (startInstallment) recebe status 'confirmed' (ou o status solicitado).
 * As parcelas subsequentes futuras recebem status 'projected'.
 */
export interface GenerateInstallmentsParams {
  familyId: string
  memberId: string
  categoryId?: string | null
  subcategoryId?: string | null
  baseDescription: string
  amountCents: number // valor de CADA parcela
  baseDate: string // YYYY-MM-DD da parcela inicial
  startInstallmentNumber?: number // default 1
  totalInstallments: number
  groupId?: string
}

export function generateInstallmentTransactions(params: GenerateInstallmentsParams) {
  const {
    familyId,
    memberId,
    categoryId,
    subcategoryId,
    baseDescription,
    amountCents,
    baseDate,
    startInstallmentNumber = 1,
    totalInstallments,
    groupId = crypto.randomUUID
      ? crypto.randomUUID()
      : `grp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  } = params

  const transactions = []

  for (let i = startInstallmentNumber; i <= totalInstallments; i++) {
    const monthsOffset = i - startInstallmentNumber
    const date = addMonthsToDate(baseDate, monthsOffset)
    const isFirst = i === startInstallmentNumber
    const status: 'confirmed' | 'projected' = isFirst ? 'confirmed' : 'projected'

    // Se a descrição base já tiver sufixos como " - Parcela X/Y", "Parcela X/Y" ou "(X/Y)", limpamos a base
    const cleanBase = cleanInstallmentBaseDescription(baseDescription)
    const formattedDesc = `${cleanBase} - Parcela ${i}/${totalInstallments}`

    transactions.push({
      family_id: familyId,
      member_id: memberId,
      category_id: categoryId || null,
      subcategory_id: subcategoryId || null,
      type: 'expense' as const,
      amount_cents: amountCents,
      description: formattedDesc,
      transaction_date: date,
      is_installment: true,
      installment_number: i,
      installment_total: totalInstallments,
      installment_group_id: groupId,
      status,
    })
  }

  return { groupId, transactions }
}

/**
 * Agrupa transações de parcelamento para visualização consolidada (estilo banco).
 * Transações normais permanecem como itens únicos.
 * Transações pertencentes ao mesmo parcelamento (mesmo grupo ou mesma base limpa + membro + valor)
 * são condensadas em uma única linha, mostrando a parcela mais recente, descrição limpa completa
 * e métricas consolidadas.
 */
export function groupInstallmentTransactions<
  T extends {
    id: string
    member_id?: string | null
    description?: string | null
    is_installment?: boolean | null
    installment_number?: number | null
    installment_total?: number | null
    installment_group_id?: string | null
    transaction_date: string
    amount_cents: number
    status?: string | null
    category?: { name?: string } | null
  },
>(transactions: T[]): GroupedTransactionItem[] {
  if (!transactions || transactions.length === 0) return []

  const groupsMap = new Map<
    string,
    {
      key: string
      baseDescription: string
      transactions: T[]
    }
  >()

  // Lista mantendo a ordem original da primeira ocorrência de cada grupo/transação
  const orderedGroupKeys: string[] = []

  for (const tx of transactions) {
    const isInst =
      !!tx.is_installment || (!!tx.description && /\bparc(?:ela)?\b/i.test(tx.description))

    if (!isInst) {
      // Transação normal: gera chave única por ID
      const singleKey = `tx-${tx.id}`
      orderedGroupKeys.push(singleKey)
      groupsMap.set(singleKey, {
        key: singleKey,
        baseDescription: tx.description?.trim() || tx.category?.name || 'Sem descrição',
        transactions: [tx],
      })
      continue
    }

    // Identificar a chave do grupo de parcelamento
    const cleanBase =
      cleanInstallmentBaseDescription(tx.description?.trim() || '') ||
      tx.category?.name ||
      'Despesa'
    const memberKey = tx.member_id || 'none'

    // Se tiver installment_group_id válido, usa ele
    const groupKey = tx.installment_group_id
      ? `grp-${tx.installment_group_id}`
      : `base-${memberKey}-${cleanBase.toLowerCase()}-${tx.installment_total || 0}`

    if (!groupsMap.has(groupKey)) {
      orderedGroupKeys.push(groupKey)
      groupsMap.set(groupKey, {
        key: groupKey,
        baseDescription: cleanBase,
        transactions: [tx],
      })
    } else {
      groupsMap.get(groupKey)!.transactions.push(tx)
    }
  }

  // Monta o array de itens consolidando cada grupo e identificando sua parcela/data mais recente
  const groupedItems = orderedGroupKeys.map((key) => {
    const group = groupsMap.get(key)!
    const txs = group.transactions

    // Se só tem 1 transação e ela não é parcelada, é uma transação simples
    const isInstallmentTx =
      !!txs[0].is_installment ||
      (!!txs[0].description && /\bparc(?:ela)?\b/i.test(txs[0].description || ''))

    // Ordena transações do grupo para pegar a mais recente (data desc, installment_number desc)
    txs.sort((a, b) => {
      const dateCmp = b.transaction_date.localeCompare(a.transaction_date)
      if (dateCmp !== 0) return dateCmp
      const numA = a.installment_number || 0
      const numB = b.installment_number || 0
      return numB - numA
    })

    const mostRecentTx = txs[0]

    let current = mostRecentTx.installment_number || 1
    let total = mostRecentTx.installment_total || Math.max(current, txs.length)

    // Se não tinha installment_number no objeto, tenta extrair da descrição
    if (!mostRecentTx.installment_number && mostRecentTx.description) {
      const parsed = parseInstallmentFromDescription(mostRecentTx.description)
      if (parsed.isInstallment) {
        current = parsed.current
        total = parsed.total
      }
    }

    return {
      id: mostRecentTx.id,
      isGroup: isInstallmentTx,
      baseDescription: group.baseDescription,
      currentInstallment: current,
      totalInstallments: total,
      installmentCount: txs.length,
      representativeTx: mostRecentTx,
      transactions: txs,
      amountCents: mostRecentTx.amount_cents,
      transactionDate: mostRecentTx.transaction_date,
    }
  })

  // Ordena os itens finais em ordem decrescente de data (mais recente primeiro)
  groupedItems.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))

  return groupedItems
}
