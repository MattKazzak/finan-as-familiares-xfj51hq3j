import { normalizeText, extractPatternFromDescription } from './categorization'
import type { ReviewItem } from '@/components/transactions/ImportStatementDialog'

/**
 * Normaliza e simplifica uma string de estabelecimento para agrupamento de "semelhantes".
 * Exemplo:
 *  "IFOOD *RESTAURANTE DA VILA" -> "IFOOD"
 *  "UBER *TRIP SAO PAULO" -> "UBER"
 *  "DROGASIL SAO PAULO" -> "DROGASIL"
 */
export function getMerchantSignature(description: string): string {
  if (!description) return ''
  const norm = normalizeText(description)
  if (!norm) return ''

  // Se houver asterisco comum em adquirentes (ex: IFOOD *RESTAURANTE, PAG*FULANO, MP *LOJA, UBER *TRIP)
  const starParts = norm.split('*')
  if (starParts.length > 1) {
    const prefix = starParts[0].trim()
    // Prefixos conhecidos de grandes apps
    if (prefix.length >= 3) {
      return prefix
    }
    const suffix = starParts[1].trim().split(' ')[0]
    if (suffix.length >= 3) {
      return suffix
    }
  }

  // Tenta extrair o padrão limpo do classificador
  const pattern = extractPatternFromDescription(description)
  if (pattern) {
    const firstWord = pattern.split(' ')[0]
    if (firstWord && firstWord.length >= 3) {
      return firstWord
    }
    return pattern
  }

  const firstToken = norm.split(' ')[0]
  return firstToken || norm
}

/**
 * Retorna se duas descrições de lançamentos são consideradas do mesmo estabelecimento/semelhantes.
 */
export function areTransactionsSimilar(descA: string, descB: string): boolean {
  if (!descA || !descB) return false
  const normA = normalizeText(descA)
  const normB = normalizeText(descB)
  if (normA === normB) return true

  const sigA = getMerchantSignature(descA)
  const sigB = getMerchantSignature(descB)

  if (sigA && sigB) {
    if (sigA === sigB) return true
    if (sigA.length >= 4 && (sigB.includes(sigA) || sigA.includes(sigB))) return true
  }

  return false
}

/**
 * Encontra todos os itens da revisão que são semelhantes ao item base
 * e que ainda não têm a mesma categoria ou estão pendentes.
 */
export function findSimilarReviewItems(baseItem: ReviewItem, allItems: ReviewItem[]): ReviewItem[] {
  return allItems.filter((item) => {
    if (item.id === baseItem.id) return false
    return areTransactionsSimilar(baseItem.description, item.description)
  })
}
