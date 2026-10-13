import { describe, it, expect } from 'vitest'
import indexHtmlRaw from '../../index.html?raw'
import mainCssRaw from '../main.css?raw'
import manifest from '../../public/manifest.json'

describe('R54 - Consistência de Tema Claro e Proteção Anti-Dark Mode Forçado', () => {
  it('declara meta tag color-scheme="light" no index.html', () => {
    expect(indexHtmlRaw).toContain('<meta name="color-scheme" content="light"')
  })

  it('declara theme-color consistente com a marca Curiangoo (#14213D) no index.html e manifest.json', () => {
    expect(indexHtmlRaw).toContain('<meta name="theme-color" content="#14213D"')
    expect(manifest.theme_color).toBe('#14213D')
    expect(manifest.background_color).toBe('#FFFFFF')
  })

  it('declara color-scheme: light only no CSS raiz (main.css)', () => {
    expect(mainCssRaw).toContain('color-scheme: light only')
    expect(mainCssRaw).toContain('background-color: #F8F9FB')
  })

  it('não possui media queries @media (prefers-color-scheme: dark) ativas no CSS', () => {
    expect(mainCssRaw).not.toContain('@media (prefers-color-scheme')
  })
})
