import { describe, it, expect } from 'vitest'
import indexHtmlRaw from '../../index.html?raw'
import mainCssRaw from '../main.css?raw'
import manifest from '../../public/manifest.json'
import patrimonyRaw from '../pages/Patrimony.tsx?raw'
import goalsRaw from '../pages/Goals.tsx?raw'
import investmentsRaw from '../pages/Investments.tsx?raw'

describe('CDS v4.0 - Consistência de Tema Dark Preto Profundo e Piso Canônico', () => {
  it('declara meta tag color-scheme="dark" no index.html', () => {
    expect(indexHtmlRaw).toContain('<meta name="color-scheme" content="dark"')
  })

  it('declara theme-color e background_color preto de produto #101217 (CDS v4.0) no index.html e manifest.json para navegadores móveis', () => {
    expect(indexHtmlRaw).toContain('<meta name="theme-color" content="#101217"')
    expect(manifest.theme_color).toBe('#101217')
    expect(manifest.background_color).toBe('#101217')
  })

  it('declara color-scheme: dark no CSS raiz (main.css) com piso preto de produto #101217 explícito (CDS v4.0)', () => {
    expect(mainCssRaw).toMatch(/color-scheme:\s*dark/i)
    expect(mainCssRaw).toMatch(/background-color:\s*var\(--ink,\s*#101217\)\s*!important/i)
  })

  it('não possui media queries @media (prefers-color-scheme: dark) ativas no CSS', () => {
    expect(mainCssRaw).not.toContain('@media (prefers-color-scheme')
  })

  it('nenhum resquício do preto quente antigo (#221D1B) nem dos derivados marrons (#2B2523/#342E2B) no index.html, manifest e main.css', () => {
    expect(indexHtmlRaw).not.toMatch(/221d1b|2b2523|342e2b/i)
    expect(JSON.stringify(manifest)).not.toMatch(/221d1b|2b2523|342e2b/i)
    expect(mainCssRaw).not.toMatch(/221d1b|2b2523|342e2b/i)
  })

  it('declara tokens text-ink mapeando para alto contraste branco no CDS v3.0', () => {
    expect(mainCssRaw).toContain('--ink-text: #ffffff')
    expect(mainCssRaw).toContain('color: var(--ink-text, #ffffff) !important')
  })

  it('páginas secundárias Patrimony, Goals e Investments não possuem cartões brancos literais nem text-ink ilegíveis', () => {
    // Nenhuma dessas páginas deve ter text-ink nem bg-white puro em cards
    expect(patrimonyRaw).not.toContain('text-ink')
    expect(patrimonyRaw).not.toContain('bg-white ')
    expect(patrimonyRaw).not.toContain('bg-white"')
    expect(patrimonyRaw).not.toContain('bg-white/95')

    expect(goalsRaw).not.toContain('text-ink')
    expect(goalsRaw).not.toContain('bg-white')

    expect(investmentsRaw).not.toContain('text-ink')
    expect(investmentsRaw).not.toContain('bg-white')
  })
})
