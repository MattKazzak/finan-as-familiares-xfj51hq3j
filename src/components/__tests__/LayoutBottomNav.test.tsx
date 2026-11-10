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

describe('Layout - Bottom Navigation (estilo Instagram/Pinterest/Spotify)', () => {
  it('exibe o + como item comum da pílula: sem círculo, sem sombra, sem borda, com rótulo "Criar" visível', () => {
    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Layout />
      </MemoryRouter>,
    )

    // Rótulo "Criar" visível embaixo do ícone, igual aos demais itens da pílula
    const criarLabel = screen.getByText('Criar')
    expect(criarLabel.className).toContain('text-[10px]')
    expect(criarLabel.className).toContain('leading-none')
    expect(criarLabel.className).toContain('mt-0.5')
    expect(criarLabel.className).not.toContain('invisible')

    // Botão central acessível por aria-label (acessibilidade fica) e mantém o teste
    const centralBtn = screen.getByRole('button', { name: /Nova Transação/i })
    expect(centralBtn).toBeDefined()
    expect(centralBtn.getAttribute('aria-label')).toBe('Nova Transação')

    // Sem FAB erguido: sem fundo colorido, sem sombra de flutuação, sem borda
    // e sem a margem negativa que o erguia (-mt-3.5)
    expect(centralBtn.className).not.toContain('bg-action')
    expect(centralBtn.className).not.toContain('shadow-lg')
    expect(centralBtn.className).not.toContain('border-2')
    expect(centralBtn.className).not.toContain('-mt-3.5')

    // Ícone de linha igual aos demais (w-5 h-5, strokeWidth 1.5 via lucide)
    const plusIcon = centralBtn.querySelector('svg')
    expect(plusIcon).not.toBeNull()

    // Sem espaçador invisível: o + tem rótulo de verdade como os outros itens
    expect(centralBtn.querySelector('span.invisible')).toBeNull()

    // Dock inferior plano: pílula navy (bg-ink) com sombra de dock CDS v2.0
    const navBar = screen.getByRole('navigation', { name: /Navegação Principal/i })
    const navContainer = navBar.querySelector('.bg-ink')
    expect(navContainer).not.toBeNull()
    expect(navContainer?.className).toContain('shadow-cds-dock')
    expect(navContainer?.className).toContain('rounded-full')

    // Rótulos dos 4 itens de navegação da pílula
    expect(screen.getByText('Início')).toBeDefined()
    expect(screen.getByText('Carteira')).toBeDefined()
    expect(screen.getByText('Patrimônio')).toBeDefined()
    expect(screen.getByText('Metas')).toBeDefined()
  })

  it('destaca o item ativo com preenchimento total sólido (bg-white/15), cobrindo ícone e rótulo sem balãozinho', () => {
    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Layout />
      </MemoryRouter>,
    )

    const inicioLink = screen.getByText('Início').closest('a')
    expect(inicioLink).not.toBeNull()
    expect(inicioLink?.className).toContain('bg-white/15')
    expect(inicioLink?.className).toContain('text-white')
    expect(inicioLink?.className).toContain('rounded-2xl')

    // Não há balãozinho/halo separado (sem span .animate-dock-pill)
    expect(inicioLink?.querySelector('.animate-dock-pill')).toBeNull()

    // Item inativo não possui o preenchimento bg-white/15
    const carteiraLink = screen.getByText('Carteira').closest('a')
    expect(carteiraLink?.className).not.toContain('bg-white/15')
    expect(carteiraLink?.className).toContain('text-white/60')
  })

  it('aplica preenchimento total consistente quando outras rotas estão ativas (Carteira, Patrimônio, Metas)', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/carteira']}>
        <Layout />
      </MemoryRouter>,
    )

    const carteiraLink = screen.getByText('Carteira').closest('a')
    expect(carteiraLink?.className).toContain('bg-white/15')
    expect(carteiraLink?.className).toContain('text-white')

    const inicioInativo = screen.getByText('Início').closest('a')
    expect(inicioInativo?.className).not.toContain('bg-white/15')
    unmount()

    const { unmount: unmountPatrimonio } = render(
      <MemoryRouter initialEntries={['/patrimonio']}>
        <Layout />
      </MemoryRouter>,
    )
    const patrimonioLink = screen.getByText('Patrimônio').closest('a')
    expect(patrimonioLink?.className).toContain('bg-white/15')
    unmountPatrimonio()

    const { unmount: unmountMetas } = render(
      <MemoryRouter initialEntries={['/metas']}>
        <Layout />
      </MemoryRouter>,
    )
    const metasLink = screen.getByText('Metas').closest('a')
    expect(metasLink?.className).toContain('bg-white/15')
    unmountMetas()
  })

  it('o botão Criar (+) possui a mesma estrutura e preenchimento sólido ao toque ou quando o modal está aberto', () => {
    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Layout />
      </MemoryRouter>,
    )

    const centralBtn = screen.getByRole('button', { name: /Nova Transação/i })
    expect(centralBtn.className).toContain('rounded-2xl')
    expect(centralBtn.className).toContain('flex-1')
    expect(centralBtn.className).toContain('py-1.5')
    // Tem preenchimento ao toque (active:bg-white/15) e hover sutil
    expect(centralBtn.className).toContain('active:bg-white/15')
  })

  it('aciona openNewTransaction() ao clicar no item + da pílula', () => {
    mockOpenNewTransaction.mockClear()

    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Layout />
      </MemoryRouter>,
    )

    const centralBtn = screen.getByRole('button', { name: /Nova Transação/i })
    fireEvent.click(centralBtn)

    expect(mockOpenNewTransaction).toHaveBeenCalledTimes(1)
    // Sem argumentos: o hook aplica o padrão de criação (despesa) como antes
    expect(mockOpenNewTransaction).toHaveBeenCalledWith()
  })
})
