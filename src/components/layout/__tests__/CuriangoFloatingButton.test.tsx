import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { CuriangoFloatingButton } from '../CuriangoFloatingButton'

describe('CuriangoFloatingButton', () => {
  it('renderiza com estilo acessível, rótulo "Falar com o Curiangoo" e dispara clique', () => {
    const handleClick = vi.fn()
    render(<CuriangoFloatingButton onClick={handleClick} />)

    const btn = screen.getByRole('button', { name: /falar com o curiangoo/i })
    expect(btn).toBeDefined()
    expect(btn.getAttribute('title')).toContain('Falar com o Curiangoo')
    expect(screen.getByText('Falar com o Curiangoo')).toBeDefined()

    fireEvent.click(btn)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
