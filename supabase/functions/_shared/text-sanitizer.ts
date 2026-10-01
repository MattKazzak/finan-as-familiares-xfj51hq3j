/**
 * Utilitário de sanitização de texto contra caracteres de controle e ruídos de codificação.
 *
 * Arquivos PDF (especialmente processados por pdf.js em extratos/faturas bancárias como Rico, XP, etc.)
 * frequentemente contêm caracteres de controle ASCII inválidos (\u0000-\u0008, \u000B, \u000C, \u000E-\u001F, \u007F),
 * caracteres de substituição Unicode (\uFFFD), BOM (\uFEFF) e outros códigos invisíveis/inválidos que fazem
 * a API da OpenAI recusar o payload com HTTP 400 Bad Request ("Invalid JSON", "malformed string", etc.).
 *
 * Preserva:
 * - \t (tab - \u0009)
 * - \n (line feed - \u000A)
 * - \r (carriage return - \u000D)
 * - Todos os caracteres imprimíveis padrão, acentuações (PT-BR) e pontuação.
 */

// Regex para caracteres de controle ASCII proibidos (excluindo \t, \n, \r)
// \u0000-\u0008, \u000B, \u000C, \u000E-\u001F, \u007F-\u009F
// Além de \uFFFD (replacement character), \uFEFF (zero width no-break space / BOM) e outros formatos invisíveis
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD\uFEFF]/g

// Caracteres invisíveis adicionais de controle Unicode (soft hyphen, zero-width spaces, directional marks)
const INVISIBLE_FORMAT_CHARS_REGEX = /[\u200B-\u200F\u2028-\u202F\u2060-\u206F]/g

/**
 * Remove caracteres de controle e substituição mantendo quebras de linha e tabs normais.
 * Normaliza quebras de linha CRLF para \n e remove sequências NUL (\0).
 */
export function sanitizeRawText(input: unknown): string {
  if (input === null || input === undefined) {
    return ''
  }

  let text = typeof input === 'string' ? input : String(input)

  if (!text) {
    return ''
  }

  // 1. Remove caracteres de controle proibidos
  text = text.replace(CONTROL_CHARS_REGEX, '')

  // 2. Remove formatos invisíveis zero-width problemáticos (mantendo \n e \t)
  text = text.replace(INVISIBLE_FORMAT_CHARS_REGEX, '')

  // 3. Normaliza quebras de linha CRLF (\r\n) ou \r solto para \n
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  return text
}
