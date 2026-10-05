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
    expect(svg?.getAttribute('viewBox')).toBe('0 0 48 48')
  })

  it('respeita propriedades de tamanho e cor personalizadas', () => {
    const { container } = render(<CuriangoLogo size={36} color="#14213D" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('36')
    expect(svg?.getAttribute('height')).toBe('36')
    const path = container.querySelector('path')
    expect(path?.getAttribute('stroke')).toBe('#14213D')
  })

  it('renderiza variante preenchida quando filled=true', () => {
    const { container } = render(<CuriangoLogo filled color="#FCA311" />)
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBeGreaterThanOrEqual(3)
  })
})
