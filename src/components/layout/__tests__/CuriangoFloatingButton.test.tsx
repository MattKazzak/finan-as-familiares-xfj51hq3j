import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { CuriangoFloatingButton } from '../CuriangoFloatingButton'

describe('CuriangoFloatingButton (FAB silencioso R52)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renderiza como FAB acessível via aria-label e title, exibe dica na primeira visita e dispara clique', () => {
    const handleClick = vi.fn()
    render(<CuriangoFloatingButton onClick={handleClick} />)

    const btn = screen.getByRole('button', { name: /falar com o curiangoo/i })
    expect(btn).toBeDefined()
    expect(btn.className).toContain('w-12 h-12')
    expect(btn.className).toContain('sm:w-14 sm:h-14')
    expect(btn.className).not.toContain('sm:w-13')
    expect(btn.getAttribute('title')).toContain('Falar com o Curiangoo')

    // Dica da 1ª visita "Fale com o Curiangoo"
    expect(screen.getByText('Fale com o Curiangoo')).toBeDefined()

    fireEvent.click(btn)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('não exibe o balão de dica se já tiver sido dispensada anteriormente no localStorage', () => {
    localStorage.setItem('curiangoo_copilot_fab_hint_dismissed_v1', 'true')
    render(<CuriangoFloatingButton />)

    expect(screen.queryByText('Fale com o Curiangoo')).toBeNull()
    const btn = screen.getByRole('button', { name: /falar com o curiangoo/i })
    expect(btn).toBeDefined()
  })
})
