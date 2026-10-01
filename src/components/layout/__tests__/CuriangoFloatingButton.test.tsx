import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { CuriangoFloatingButton } from '../CuriangoFloatingButton'

describe('CuriangoFloatingButton', () => {
  it('renderiza com estilo acessível e aria-label', () => {
    const handleClick = vi.fn()
    render(<CuriangoFloatingButton onClick={handleClick} />)

    const btn = screen.getByRole('button', { name: /abrir curiangoo copilot por voz/i })
    expect(btn).toBeDefined()
    expect(btn.getAttribute('title')).toContain('Curiangoo Copilot')

    fireEvent.click(btn)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
