import { describe, it, expect } from 'vitest'
import manifest from '../../public/manifest.json'

describe('PWA Manifest & Metadata', () => {
  it('valida propriedades essenciais do manifest.json', () => {
    expect(manifest.name).toBe('Curiangoo — Finanças Familiares')
    expect(manifest.short_name).toBe('Curiangoo')
    expect(manifest.theme_color).toBe('#F8F9FB')
    expect(manifest.background_color).toBe('#F8F9FB')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
  })

  it('valida configuração de ícones no manifest apontando para os novos SVGs', () => {
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)

    const standardIcon = manifest.icons.find(
      (icon: { purpose?: string; src: string }) =>
        icon.purpose === 'any' || !icon.purpose || icon.src.includes('icon.svg'),
    )
    expect(standardIcon).toBeDefined()
    expect(standardIcon?.src).toBe('/icon.svg')
    expect(standardIcon?.type).toBe('image/svg+xml')

    const maskableIcon = manifest.icons.find(
      (icon: { purpose?: string }) => icon.purpose === 'maskable',
    )
    expect(maskableIcon).toBeDefined()
    expect(maskableIcon?.src).toBe('/icon-maskable.svg')
    expect(maskableIcon?.type).toBe('image/svg+xml')
  })
})
