import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../Layout'

const mockOpenNewTransaction = vi.fn()

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'u-1', email: 'teste@curiangoo.com' },
    profile: { id: 'p-1', name: 'Lucas' },
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: { id: 'fam-1', name: 'Silva' },
    members: [{ id: 'm-1', name: 'Lucas', is_admin: true }],
    currentMember: { id: 'm-1', name: 'Lucas', is_admin: true },
    categories: [],
    openNewTransaction: mockOpenNewTransaction,
    openVoiceDialog: vi.fn(),
    refreshTrigger: 0,
    triggerRefresh: vi.fn(),
  }),
}))

vi.mock('@/contexts/ActiveMonthContext', () => ({
  useActiveMonth: () => ({
    activeMonth: '2026-03',
    setActiveMonth: vi.fn(),
    prevMonth: vi.fn(),
    nextMonth: vi.fn(),
    isNextMonthDisabled: false,
    currentSystemMonth: '2026-03',
  }),
}))

describe('Layout - Bottom Navigation R54/R58', () => {
  it('exibe dock com fundo azul-marinho #14213D, rótulo "Nova" e botão central erguido com sombra e destaque', () => {
    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Layout />
      </MemoryRouter>,
    )

    // Rótulo "Nova" abaixo do +
    const newTxLabel = screen.getByText('Nova')
    expect(newTxLabel).toBeDefined()
    expect(newTxLabel.className).toContain('text-white')

    // Botão central com aria-label "Nova Transação" e elevação (-mt-3.5)
    const centralBtn = screen.getByRole('button', { name: /Nova Transação/i })
    expect(centralBtn).toBeDefined()
    expect(centralBtn.className).toContain('w-11 h-11')
    expect(centralBtn.className).toContain('shadow-lg')

    // Container erguido
    const centralContainer = centralBtn.closest('div')
    expect(centralContainer?.className).toContain('-mt-3.5')

    // Dock inferior tem fundo marinho #14213D
    const navBar = screen.getByRole('navigation', { name: /Navegação Principal/i })
    const navContainer = navBar.querySelector('.bg-\\[\\#14213D\\]')
    expect(navContainer).not.toBeNull()

    // Rótulos consistentes dos itens da pílula (Perfil foi pro topo; Patrimônio entrou)
    expect(screen.getByText('Início')).toBeDefined()
    expect(screen.getByText('Carteira')).toBeDefined()
    expect(screen.getByText('Patrimônio')).toBeDefined()
    expect(screen.getByText('Metas')).toBeDefined()
  })

  it('aciona openNewTransaction("income") ao clicar no FAB central "Nova Transação" (R67)', () => {
    mockOpenNewTransaction.mockClear()

    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Layout />
      </MemoryRouter>,
    )

    const centralBtn = screen.getByRole('button', { name: /Nova Transação/i })
    fireEvent.click(centralBtn)

    expect(mockOpenNewTransaction).toHaveBeenCalledTimes(1)
    expect(mockOpenNewTransaction).toHaveBeenCalledWith('income')
  })
})
