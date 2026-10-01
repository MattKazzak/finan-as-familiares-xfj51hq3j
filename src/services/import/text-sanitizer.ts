/**
 * Utilitário de sanitização de texto contra caracteres de controle e ruídos de codificação.
 *
 * Arquivos PDF (especialmente processados por pdf.js em extratos/faturas bancárias como Rico, XP, Nubank, etc.)
 * frequentemente contêm caracteres de controle ASCII inválidos (\u0000-\u0008, \u000B, \u000C, \u000E-\u001F, \u007F-\u009F),
 * caracteres de substituição Unicode (\uFFFD), BOM (\uFEFF), formatos invisíveis/direcionais (\u200B-\u200F, \u2028-\u202F, \u2060-\u206F),
 * e outros códigos que quebram o JSON schema / validação da API da OpenAI, resultando em HTTP 400 Bad Request.
 *
 * Preserva:
 * - \t (tab - \u0009)
 * - \n (line feed - \u000A)
 * - Caracteres imprimíveis padrão, acentuações (PT-BR) e pontuação.
 * Normaliza CRLF (\r\n) e CR (\r) para LF (\n).
 */

// Regex para caracteres de controle ASCII e Unicode proibidos (excluindo \t e \n)
// \u0000-\u0008, \u000B, \u000C, \u000E-\u001F, \u007F-\u009F
// Além de \uFFFD (replacement character), \uFEFF (zero width no-break space / BOM)
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD\uFEFF]/g

// Caracteres invisíveis adicionais de controle Unicode (soft hyphen, zero-width spaces, directional marks, paragraph separators)
const INVISIBLE_FORMAT_CHARS_REGEX = /[\u00AD\u200B-\u200F\u2028-\u202F\u2060-\u206F]/g

/**
 * Remove caracteres de controle e substituição mantendo quebras de linha e tabs normais.
 * Normaliza quebras de linha CRLF para \n e remove sequências NUL (\0) e caracteres invisíveis.
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

  // 2. Remove formatos invisíveis zero-width e direcionais problemáticos (mantendo \n e \t)
  text = text.replace(INVISIBLE_FORMAT_CHARS_REGEX, '')

  // 3. Normaliza quebras de linha CRLF (\r\n) ou \r solto para \n
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  return text
}
