import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Layout from '../Layout'

// Mock de contextos e hooks necessários para renderizar Layout
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'u-1', email: 'test@curiangoo.com' },
    profile: { id: 'p-1', name: 'Lucas' },
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: { id: 'fam-1', name: 'Família Teste' },
    members: [{ id: 'm-1', name: 'Lucas', is_admin: true }],
    currentMember: { id: 'm-1', name: 'Lucas', is_admin: true },
    categories: [],
    openNewTransaction: vi.fn(),
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

// 16/10: o FAB flutuante do Copilot foi REMOVIDO do Layout — o card de insight
// da Home (com a cabecinha do Curiango) cobre o acesso à IA. O caminho pro Copilot
// que restou é o botão-pássaro do header top nas telas internas ("Falar com o Curiango").
describe('Layout - Caminho para o Copilot (FAB removido, botão-pássaro no header)', () => {
  it('renderiza o botão-pássaro do header "Falar com o Curiango" em tela interna (/carteira)', () => {
    render(
      <MemoryRouter initialEntries={['/carteira']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="carteira" element={<div>Conteúdo da Carteira</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const birdBtn = screen.getByRole('button', { name: 'Falar com o Curiango' })
    expect(birdBtn).toBeDefined()
    expect(birdBtn.getAttribute('aria-label')).toBe('Falar com o Curiango')
    expect(birdBtn.getAttribute('title')).toBe('Falar com o Curiango')
    // Balão de fala "Oi! Sou o Curiangoo" não existe mais no Layout
    expect(screen.queryByText(/Oi! Sou o Curiangoo/i)).toBeNull()
  })

  it('NÃO renderiza o botão do header (nem FAB) na Home (/inicio), que tem hero próprio', () => {
    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="inicio" element={<div>Conteúdo da Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: /falar com o curiang?o/i })).toBeNull()
    expect(screen.queryByText(/Oi! Sou o Curiangoo/i)).toBeNull()
  })

  it('renderiza o botão-pássaro do header em /metas (tela interna com header top)', () => {
    render(
      <MemoryRouter initialEntries={['/metas']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="metas" element={<div>Conteúdo de Metas</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Falar com o Curiango' })).toBeDefined()
  })
})
