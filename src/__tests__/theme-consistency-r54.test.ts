import { describe, it, expect } from 'vitest'
import indexHtmlRaw from '../../index.html?raw'
import mainCssRaw from '../main.css?raw'
import manifest from '../../public/manifest.json'

describe('CDS v3.0 - Consistência de Tema Dark Spotify e Piso Navy Canônico', () => {
  it('declara meta tag color-scheme="dark" no index.html', () => {
    expect(indexHtmlRaw).toContain('<meta name="color-scheme" content="dark"')
  })

  it('declara theme-color e background_color navy #0B111E no index.html e manifest.json para navegadores móveis', () => {
    expect(indexHtmlRaw).toContain('<meta name="theme-color" content="#0B111E"')
    expect(manifest.theme_color).toBe('#0B111E')
    expect(manifest.background_color).toBe('#0B111E')
  })

  it('declara color-scheme: dark no CSS raiz (main.css) com piso navy #0B111E explícito', () => {
    expect(mainCssRaw).toContain('color-scheme: dark')
    expect(mainCssRaw).toMatch(/background-color:\s*var\(--ink,\s*#0b111e\)\s*!important/i)
  })

  it('não possui media queries @media (prefers-color-scheme: dark) ativas no CSS', () => {
    expect(mainCssRaw).not.toContain('@media (prefers-color-scheme')
  })

  it('declara tokens text-ink mapeando para alto contraste branco no CDS v3.0', () => {
    expect(mainCssRaw).toContain('--ink-text: #ffffff')
    expect(mainCssRaw).toContain('color: var(--ink-text, #ffffff) !important')
  })
})
