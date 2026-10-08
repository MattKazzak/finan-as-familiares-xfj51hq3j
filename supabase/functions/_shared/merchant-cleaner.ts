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

// Ruídos comuns de extração de PDF que colam no início ou fim do nome:
// - Marcadores de página (ex.: "PAG 1/3", "PAGINA 2", "FL. 01")
// - Timestamps e horários soltos (ex.: "14:32:05", "10:15", "14h30")
// - Valores monetários grudados no texto (ex.: "R$ 123,45", "123,45 BRL", "R$ 50.00")
const PAGE_NOISE_REGEX =
  /(^|\s+)(?:P[AÁ]G(?:\.|\b|\s*\d+)|P[AÁ]GINA\s*\d+|FLS?\.?\s*\d+)(?:\s*\/\s*\d+)?(\s+|$)/gi
const TIMESTAMP_NOISE_REGEX = /(^|\s+)\d{1,2}[:h]\d{2}(?::\d{2})?(?:\s*(?:AM|PM|HRS?))?(\s+|$)/gi
const CURRENCY_NOISE_REGEX = /(^|\s+)(?:R\$\s*[\d.,]+|[\d.,]+\s*BRL|US\$\s*[\d.,]+)(\s+|$)/gi

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

  // Remover ruído de extração de PDF (números de página, timestamps, valores grudados)
  prev = ''
  while (text !== prev) {
    prev = text
    text = text
      .replace(PAGE_NOISE_REGEX, ' ')
      .replace(TIMESTAMP_NOISE_REGEX, ' ')
      .replace(CURRENCY_NOISE_REGEX, ' ')
      .trim()
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
