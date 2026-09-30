/**
 * Termos canônicos da Blocklist Determinística de Não-Transações.
 * Conforme Requisito 1:
 * - Totais e Saldos
 * - Pagamentos e Quitações
 * - Limites e Crédito
 * - Parcelamento e Mínimo
 * - Encargos e Institucionais
 */
export const NON_TRANSACTION_TERMS: readonly string[] = [
  // Totais e Saldos
  'TOTAL FATURA',
  'TOTAL DA FATURA',
  'VALOR TOTAL',
  'TOTAL A PAGAR',
  'VALOR DA FATURA',
  'SALDO DA FATURA',
  'TOTAL DESTA FATURA',
  'SALDO ANTERIOR',
  'SALDO ATUAL',
  'SALDO DEVEDOR',
  'SALDO REMANESCENTE',
  'SUBTOTAL',
  'SUB-TOTAL',
  'TOTAL DOS LANCAMENTOS',
  'TOTAL DE COMPRAS',

  // Pagamentos e Quitações
  'PAGAMENTO DE FATURA',
  'PAGAMENTO RECEBIDO',
  'PGTO FATURA',
  'PAGTO FATURA',
  'PAGAMENTO EFETUADO',
  'PAGAMENTO ON-LINE',
  'CREDITO DE PAGAMENTO',
  'RECEBIMENTO DE FATURA',

  // Limites e Crédito
  'LIMITE TOTAL',
  'LIMITE DE CREDITO',
  'LIMITE DISPONIVEL',
  'LIMITE UTILIZADO',
  'LIMITE PARA SAQUE',
  'LIMITE A VISTA',
  'LIMITE PARCELADO',

  // Parcelamento e Mínimo
  'PAGAMENTO MINIMO',
  'PAGTO MINIMO',
  'VALOR MINIMO',
  'PARCELAMENTO DE FATURA',
  'PARCELA FACIL',
  'FATURA PARCELADA',
  'OPCAO DE PARCELAMENTO',
  'FINANCIAMENTO ROTATIVO',

  // Encargos e Institucionais
  'CUSTO EFETIVO TOTAL',
  'CET ANUAL',
  'CET MENSAL',
  'PROJECAO DE ENCARGOS',
  'TAXA DE JUROS',
  'OUVIDORIA',
  'CANAIS DE ATENDIMENTO',
] as const

export function normalizeTextWithSpaces(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeDescriptionForDedup(desc: string): string {
  return (desc || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function containsExactWordOrPhrase(text: string, phrase: string): boolean {
  if (!text || !phrase) return false
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i')
  return regex.test(text)
}

const NORMALIZED_NON_TRANSACTION_SPACED: string[] = NON_TRANSACTION_TERMS.map((t) =>
  normalizeTextWithSpaces(t),
)
const NORMALIZED_NON_TRANSACTION_COMPACT: string[] = NON_TRANSACTION_TERMS.map((t) =>
  normalizeDescriptionForDedup(t),
)

/**
 * Função utilitária determinística universal:
 * Verifica se uma descrição (ou linha de extrato) corresponde a uma linha de resumo,
 * cabeçalho, limite, pagamento de fatura ou termo institucional que DEVE ser SUMARIAMENTE
 * descartada do array de transações a importar.
 *
 * Case-insensitive, sem acentuação.
 */
export function isNonTransactionLine(description: string): boolean {
  if (!description) return false

  const spaced = normalizeTextWithSpaces(description)
  if (!spaced) return false

  const compact = normalizeDescriptionForDedup(description)

  for (let i = 0; i < NORMALIZED_NON_TRANSACTION_SPACED.length; i++) {
    const termSpaced = NORMALIZED_NON_TRANSACTION_SPACED[i]
    const termCompact = NORMALIZED_NON_TRANSACTION_COMPACT[i]

    if (!termSpaced.includes(' ')) {
      if (containsExactWordOrPhrase(spaced, termSpaced)) {
        return true
      }
      if (
        termCompact.length >= 7 &&
        (compact === termCompact ||
          compact.startsWith(termCompact) ||
          compact.endsWith(termCompact))
      ) {
        return true
      }
    } else {
      if (spaced.includes(termSpaced)) {
        return true
      }
      if (termCompact.length >= 6 && compact.includes(termCompact)) {
        return true
      }
    }
  }

  if (spaced.includes('central de atendimento') || compact.includes('centraldeatendimento')) {
    return true
  }
  if (
    spaced.includes('sac 0800') ||
    spaced.includes('ouvidoria 0800') ||
    compact.includes('ouvidoria0800')
  ) {
    return true
  }

  return false
}
