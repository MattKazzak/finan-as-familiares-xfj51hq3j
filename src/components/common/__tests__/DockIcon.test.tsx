import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { DockIcon } from '../DockIcon'

describe('DockIcon component', () => {
  it('renderiza variante outline quando active=false para home', () => {
    const { container } = render(<DockIcon name="home" active={false} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('fill')).toBe('none')
    expect(svg?.getAttribute('stroke')).toBe('currentColor')
    expect(svg?.getAttribute('stroke-width')).toBe('1.75')
  })

  it('renderiza variante solid quando active=true para home', () => {
    const { container } = render(<DockIcon name="home" active={true} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('fill')).toBe('currentColor')
    expect(svg?.getAttribute('stroke')).toBe('none')
  })

  it('renderiza variante outline e solid para wallet', () => {
    const { container: outline } = render(<DockIcon name="wallet" active={false} />)
    expect(outline.querySelector('svg')?.getAttribute('fill')).toBe('none')

    const { container: solid } = render(<DockIcon name="wallet" active={true} />)
    expect(solid.querySelector('svg')?.getAttribute('fill')).toBe('currentColor')
  })

  it('renderiza variante outline e solid para patrimony', () => {
    const { container: outline } = render(<DockIcon name="patrimony" active={false} />)
    expect(outline.querySelector('svg')?.getAttribute('fill')).toBe('none')

    const { container: solid } = render(<DockIcon name="patrimony" active={true} />)
    expect(solid.querySelector('svg')?.getAttribute('fill')).toBe('currentColor')
  })

  it('renderiza variante outline e solid para metas', () => {
    const { container: outline } = render(<DockIcon name="metas" active={false} />)
    expect(outline.querySelector('svg')?.getAttribute('fill')).toBe('none')

    const { container: solid } = render(<DockIcon name="metas" active={true} />)
    expect(solid.querySelector('svg')?.getAttribute('fill')).toBe('currentColor')
  })

  it('renderiza plus com stroke reforçado quando active=true', () => {
    const { container: inactive } = render(<DockIcon name="plus" active={false} />)
    expect(inactive.querySelector('svg')?.getAttribute('stroke-width')).toBe('1.75')

    const { container: active } = render(<DockIcon name="plus" active={true} />)
    expect(active.querySelector('svg')?.getAttribute('stroke-width')).toBe('2.85')
  })
})
