import { describe, it, expect } from 'vitest'
import indexHtmlRaw from '../../index.html?raw'
import mainCssRaw from '../main.css?raw'
import manifest from '../../public/manifest.json'

describe('R54 - Consistência de Tema Claro e Proteção Anti-Dark Mode Forçado', () => {
  it('declara meta tag color-scheme="light" no index.html', () => {
    expect(indexHtmlRaw).toContain('<meta name="color-scheme" content="light"')
  })

  it('declara theme-color e background_color CLAROS no index.html e manifest.json para navegadores móveis', () => {
    expect(indexHtmlRaw).toContain('<meta name="theme-color" content="#F8F9FB"')
    expect(manifest.theme_color).toBe('#F8F9FB')
    expect(manifest.background_color).toBe('#F8F9FB')
  })

  it('declara color-scheme: light only no CSS raiz (main.css) com background explícito', () => {
    expect(mainCssRaw).toContain('color-scheme: light only')
    expect(mainCssRaw).toContain('background-color: #f8f9fb !important')
  })

  it('não possui media queries @media (prefers-color-scheme: dark) ativas no CSS', () => {
    expect(mainCssRaw).not.toContain('@media (prefers-color-scheme')
  })
})
