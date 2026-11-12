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
  it('não renderiza o header top navy na rota /perfil, mas renderiza em /carteira', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/perfil']}>
        <Layout />
      </MemoryRouter>,
    )

    // Na rota /perfil, o header com a barra navy sticky NÃO deve existir
    expect(screen.queryByTestId('header-profile-avatar')).toBeNull()
    expect(screen.queryByLabelText('Falar com o Curiango')).toBeNull()

    unmount()

    render(
      <MemoryRouter initialEntries={['/carteira']}>
        <Layout />
      </MemoryRouter>,
    )

    // Em /carteira o header sticky navy permanece normal
    expect(screen.getByTestId('header-profile-avatar')).toBeDefined()
    expect(screen.getByLabelText('Falar com o Curiango')).toBeDefined()
  })

  it('exibe o + como item comum da barra: sem círculo, sem sombra, sem borda, com rótulo "Criar" visível', () => {
    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Layout />
      </MemoryRouter>,
    )

    // Rótulo "Criar" visível embaixo do ícone, igual aos demais itens da barra
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

    // Ícone de linha igual aos demais (w-5 h-5, DockIcon variante plus)
    const plusIcon = centralBtn.querySelector('svg')
    expect(plusIcon).not.toBeNull()
    expect(plusIcon?.getAttribute('stroke-width')).toBe('1.75')

    // Sem espaçador invisível: o + tem rótulo de verdade como os outros itens
    expect(centralBtn.querySelector('span.invisible')).toBeNull()

    // Barra inferior EDGE-TO-EDGE (estilo Instagram/Spotify): container com fundo
    // preto neutro (bg-ink / #161616), largura total, SEM cantos arredondados, sem borda lateral e
    // com separador superior sutil translúcido
    const navBar = screen.getByTestId('bottom-nav-bar')
    expect(navBar.className).toContain('bg-ink')
    expect(navBar.className).toContain('bg-[#161616]')
    expect(navBar.className).toContain('inset-x-0')
    expect(navBar.className).toContain('bottom-0')
    expect(navBar.className).not.toContain('rounded-full')
    expect(navBar.className).not.toContain('border-line')
    expect(navBar.className).toContain('border-t')
    expect(navBar.className).toContain('border-white/10')
    expect(navBar.getAttribute('style')).toContain('safe-area-inset-bottom')
    expect(navBar.getAttribute('style')).toContain('#161616')

    // Rótulos dos 4 itens de navegação da barra
    expect(screen.getByText('Início')).toBeDefined()
    expect(screen.getByText('Carteira')).toBeDefined()
    expect(screen.getByText('Patrimônio')).toBeDefined()
    expect(screen.getByText('Metas')).toBeDefined()
  })

  it('destaca o item ativo SEM fundo (estilo Spotify): ícone sólido branco + rótulo branco, sem mancha bg-white', () => {
    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Layout />
      </MemoryRouter>,
    )

    const inicioLink = screen.getByText('Início').closest('a')
    expect(inicioLink).not.toBeNull()
    // NENHUM fundo no item ativo (nem permanente, nem hover/press)
    expect(inicioLink?.className).not.toContain('bg-white/15')
    expect(inicioLink?.className).not.toContain('bg-white/10')
    expect(inicioLink?.className).not.toContain('bg-white/5')
    expect(inicioLink?.className).not.toContain('hover:bg-white')
    expect(inicioLink?.className).not.toContain('active:bg-white')
    // Destaque vem da cor do texto (branco + semibold) e do ícone sólido
    expect(inicioLink?.className).toContain('text-white')
    expect(inicioLink?.className).toContain('font-semibold')
    expect(inicioLink?.className).toContain('rounded-2xl')

    // Não há balãozinho/halo/camada de fundo separada (sem span .animate-dock-pill)
    expect(inicioLink?.querySelector('.animate-dock-pill')).toBeNull()
    expect(inicioLink?.querySelector('span.absolute')).toBeNull()

    // Ícone ativo do Início deve usar variante sólida (fill="currentColor", stroke="none")
    const inicioIcon = inicioLink?.querySelector('svg')
    expect(inicioIcon?.getAttribute('fill')).toBe('currentColor')
    expect(inicioIcon?.getAttribute('stroke')).toBe('none')

    // Item inativo mantém ícone outline e rótulo translúcido, sem fundo
    const carteiraLink = screen.getByText('Carteira').closest('a')
    expect(carteiraLink?.className).not.toContain('bg-white/15')
    expect(carteiraLink?.className).toContain('text-white/80')

    const carteiraIcon = carteiraLink?.querySelector('svg')
    expect(carteiraIcon?.getAttribute('fill')).toBe('none')
    expect(carteiraIcon?.getAttribute('stroke')).toBe('currentColor')
  })

  it('aplica destaque sem fundo de forma consistente nas outras rotas ativas (Carteira, Patrimônio, Metas)', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/carteira']}>
        <Layout />
      </MemoryRouter>,
    )

    const carteiraLink = screen.getByText('Carteira').closest('a')
    expect(carteiraLink?.className).not.toContain('bg-white/15')
    expect(carteiraLink?.className).toContain('text-white')
    expect(carteiraLink?.querySelector('svg')?.getAttribute('fill')).toBe('currentColor')

    const inicioInativo = screen.getByText('Início').closest('a')
    expect(inicioInativo?.className).not.toContain('bg-white/15')
    expect(inicioInativo?.querySelector('svg')?.getAttribute('fill')).toBe('none')
    unmount()

    const { unmount: unmountPatrimonio } = render(
      <MemoryRouter initialEntries={['/patrimonio']}>
        <Layout />
      </MemoryRouter>,
    )
    const patrimonioLink = screen.getByText('Patrimônio').closest('a')
    expect(patrimonioLink?.className).not.toContain('bg-white/15')
    expect(patrimonioLink?.querySelector('svg')?.getAttribute('fill')).toBe('currentColor')
    unmountPatrimonio()

    const { unmount: unmountMetas } = render(
      <MemoryRouter initialEntries={['/metas']}>
        <Layout />
      </MemoryRouter>,
    )
    const metasLink = screen.getByText('Metas').closest('a')
    expect(metasLink?.className).not.toContain('bg-white/15')
    expect(metasLink?.querySelector('svg')?.getAttribute('fill')).toBe('currentColor')
    unmountMetas()
  })

  it('o botão Criar (+) mantém a mesma estrutura e NÃO pinta fundo ao toque nem com o modal aberto', () => {
    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Layout />
      </MemoryRouter>,
    )

    const centralBtn = screen.getByRole('button', { name: /Nova Transação/i })
    expect(centralBtn.className).toContain('rounded-2xl')
    expect(centralBtn.className).toContain('flex-1')
    expect(centralBtn.className).toContain('py-1.5')
    // Sem NENHUM fundo: nem no estado aberto, nem hover, nem press
    expect(centralBtn.className).not.toContain('bg-white/15')
    expect(centralBtn.className).not.toContain('hover:bg-white')
    expect(centralBtn.className).not.toContain('active:bg-white')
    // Reforço ao toque fica só no scale (sem pintura)
    expect(centralBtn.className).toContain('active:scale-95')
  })

  it('aciona openNewTransaction() ao clicar no item + da barra', () => {
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
