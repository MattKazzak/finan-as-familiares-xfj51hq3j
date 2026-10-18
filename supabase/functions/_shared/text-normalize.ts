// Normalização de texto compartilhada (edge functions)
// Espelha src/services/import/categorization.ts (normalizeText) — usada para
// casar descrições de transação com padrões de regras da família.
export function normalizeText(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
