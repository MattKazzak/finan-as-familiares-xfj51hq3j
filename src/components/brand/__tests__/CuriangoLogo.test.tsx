import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import React from 'react'
import { CuriangoLogo } from '../CuriangoLogo'

describe('CuriangoLogo', () => {
  it('renderiza o SVG do logo com atributos padrão', () => {
    const { container } = render(<CuriangoLogo />)
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    expect(svg?.getAttribute('width')).toBe('28')
    expect(svg?.getAttribute('height')).toBe('28')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100')
    const bodyPath = container.querySelector('path')
    expect(bodyPath?.getAttribute('fill')).toBe('var(--brand-ink)')
    const eyeCircle = container.querySelector('circle')
    expect(eyeCircle?.getAttribute('fill')).toBe('#FFFFFF')
  })

  it('respeita propriedades de tamanho e cor personalizadas (amarelo marca CDS v4.0)', () => {
    const { container } = render(<CuriangoLogo size={36} color="#FFC629" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('36')
    expect(svg?.getAttribute('height')).toBe('36')
    const bodyPath = container.querySelector('path')
    expect(bodyPath?.getAttribute('fill')).toBe('#FFC629')
  })

  it('mantém compatibilidade com a prop filled sem quebrar renderização', () => {
    const { container } = render(<CuriangoLogo filled color="#FFC629" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    const paths = container.querySelectorAll('path')
    // Pelo menos o caminho do corpo e o traço da asa
    expect(paths.length).toBeGreaterThanOrEqual(2)
  })
})
