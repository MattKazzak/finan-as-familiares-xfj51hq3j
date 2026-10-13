import { describe, it, expect } from 'vitest'
import pkg from '../../package.json'
import tailwindConfig from '../../tailwind.config'

describe('R56 — Sistema de Profundidade, Respiro e Refinamento Visual', () => {
  it('tailwind.config define os tokens de elevação elevation-1, elevation-2 e elevation-3', () => {
    const config = tailwindConfig as { theme?: { extend?: { boxShadow?: Record<string, string> } } }
    const shadows = config?.theme?.extend?.boxShadow || {}

    expect(shadows['elevation-1']).toBeDefined()
    expect(shadows['elevation-2']).toBeDefined()
    expect(shadows['elevation-3']).toBeDefined()

    expect(shadows['elevation-1']).toContain('rgba(20, 33, 61, 0.04)')
    expect(shadows['elevation-2']).toContain('rgba(20, 33, 61, 0.05)')
    expect(shadows['elevation-3']).toContain('rgba(20, 33, 61, 0.08)')
  })

  it('package.json está bumpado para a versão 0.0.321', () => {
    expect(pkg.version).toBe('0.0.321')
  })
})
