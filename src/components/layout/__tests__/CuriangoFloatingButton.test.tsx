import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { CuriangoFloatingButton } from '../CuriangoFloatingButton'

describe('CuriangoFloatingButton (FAB com balão de fala 1x e pulso R54)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renderiza como FAB com pulso sutil animate-fab-breathe, exibe balão de fala 1x na primeira visita e dispara clique', () => {
    const handleClick = vi.fn()
    render(<CuriangoFloatingButton onClick={handleClick} />)

    const btn = screen.getByRole('button', { name: /falar com o curiangoo/i })
    expect(btn).toBeDefined()
    expect(btn.className).toContain('w-12 h-12')
    expect(btn.className).toContain('sm:w-14 sm:h-14')
    expect(btn.className).toContain('animate-fab-breathe')
    expect(btn.getAttribute('title')).toContain('Falar com o Curiangoo')

    // Balão de fala 1x: "Oi! Sou o Curiangoo — lanço, consulto e analiso pra você"
    expect(screen.getByText(/Oi! Sou o Curiangoo/i)).toBeDefined()
    expect(screen.getByText(/lanço, consulto e analiso pra você/i)).toBeDefined()

    fireEvent.click(btn)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('não exibe o balão de fala se já tiver sido dispensada anteriormente no localStorage', () => {
    localStorage.setItem('curiangoo_copilot_fab_bubble_dismissed_v2', 'true')
    render(<CuriangoFloatingButton />)

    expect(screen.queryByText(/Oi! Sou o Curiangoo/i)).toBeNull()
    const btn = screen.getByRole('button', { name: /falar com o curiangoo/i })
    expect(btn).toBeDefined()
  })

  it('fecha o balão ao clicar no botão de fechar ✕', () => {
    render(<CuriangoFloatingButton />)

    const closeBtn = screen.getByRole('button', { name: /fechar dica/i })
    expect(closeBtn).toBeDefined()
    fireEvent.click(closeBtn)

    expect(screen.queryByText(/Oi! Sou o Curiangoo/i)).toBeNull()
    expect(localStorage.getItem('curiangoo_copilot_fab_bubble_dismissed_v2')).toBe('true')
  })
})
