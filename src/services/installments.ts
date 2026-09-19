// Utilitários para detecção e geração de parcelas e projeções futuras
// Suporta detecção de formatos: "XX/YY", "PARC XX/YY", "PARC XX", "PARCELA XX DE YY"

export interface ParsedInstallmentInfo {
  isInstallment: boolean
  current: number
  total: number
  cleanDescription: string
  rawPattern?: string
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

    // Formatar descrição com sufixo claro da parcela (ex: "Geladeira (01/10)")
    const descWithSuffix = baseDescription.includes(`${i}/${totalInstallments}`)
      ? baseDescription
      : `${baseDescription} (${String(i).padStart(2, '0')}/${String(totalInstallments).padStart(2, '0')})`

    transactions.push({
      family_id: familyId,
      member_id: memberId,
      category_id: categoryId || null,
      subcategory_id: subcategoryId || null,
      type: 'expense' as const,
      amount_cents: amountCents,
      description: descWithSuffix,
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
