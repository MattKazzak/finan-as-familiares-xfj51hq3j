/**
 * Higienizador Determinístico de Adquirentes Brasileiras e Ruídos Bancários.
 *
 * Limpa prefixos de adquirentes e ruídos bancários antes de enviar para a categorização:
 * - Prefixos: /^((PAG\*|MP\*|IFD\*|UBR\*|PAGARME\*|SUMUP\*|STONE\*|CIELO\*|GETNET\*|REDE\*|DEB |CRED |COMPRA )+)/i
 * - Sufixos de parcelas e locais: /\s+(\d{1,2}\/\d{1,2}|PARC\s*\d+|BR|SP|RJ|SAO PAULO)\s*$/i
 *
 * Exemplo: "PAG*DROGASIL 02/03 SP" -> "Drogasil"
 */

const PREFIX_REGEX =
  /^((PAG\*|MP\*|IFD\*|UBR\*|PAGARME\*|SUMUP\*|STONE\*|CIELO\*|GETNET\*|REDE\*|DEB |CRED |COMPRA )+)/i
const SUFFIX_REGEX = /\s+(\d{1,2}\/\d{1,2}|PARC\s*\d+|BR|SP|RJ|SAO PAULO)\s*$/i

/**
 * Converte string para formato Title Case amigável preservando siglas conhecidas
 */
export function toTitleCase(str: string): string {
  if (!str) return ''
  const words = str.toLowerCase().split(/\s+/)
  return words
    .map((word) => {
      if (!word) return ''
      // Se for sigla comum de 2 ou 3 letras como XP, C6, etc
      if (['xp', 'c6', 'iof', 'btg', 'itau', 'bb'].includes(word)) {
        return word.toUpperCase()
      }
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * Limpa uma descrição bruta de extrato/fatura bancária brasileira:
 * 1. Remove prefixos de adquirentes e modalidades repetidas em loop
 * 2. Remove sufixos de parcelas e cidades/estados comuns em loop
 * 3. Normaliza espaços múltiplos e aplica Title Case
 */
export function cleanMerchantDescription(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''

  let text = raw.trim()
  if (!text) return ''

  // Remover prefixos repetidos (ex.: "COMPRA PAG*MP*DROGASIL" -> "DROGASIL")
  let prev = ''
  while (text !== prev) {
    prev = text
    text = text.replace(PREFIX_REGEX, '').trim()
    // Tratar asteriscos soltos após prefixos (ex.: "PAG* DROGASIL" ou "MP * DROGASIL")
    text = text.replace(/^\*+\s*/, '').trim()
  }

  // Remover sufixos repetidos de parcela ou localização (ex.: "DROGASIL 02/03 SP" -> "DROGASIL")
  prev = ''
  while (text !== prev) {
    prev = text
    text = text.replace(SUFFIX_REGEX, '').trim()
  }

  // Normalizar múltiplos espaços internos
  text = text.replace(/\s+/g, ' ').trim()

  if (!text) {
    return raw.trim()
  }

  // Se o texto original for todo em caixa alta ou todo em caixa baixa, formata para Title Case
  if (text === text.toUpperCase() || text === text.toLowerCase()) {
    return toTitleCase(text)
  }

  return text
}
