import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

describe('Layout - Botão do Copilot (Regra da Home única)', () => {
  it('renderiza o botão flutuante do Copilot "Falar com o Curiangoo" quando na rota /inicio (Home)', () => {
    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="inicio" element={<div>Conteúdo da Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const copilotBtn = screen.queryByRole('button', { name: /falar com o curiangoo/i })
    expect(copilotBtn).not.toBeNull()
    // O FAB agora é silencioso com aria-label/title e dica 1x "Fale com o Curiangoo"
    expect(copilotBtn?.getAttribute('aria-label')).toBe('Falar com o Curiangoo')
    expect(screen.getByText('Fale com o Curiangoo')).toBeDefined()
  })

  it('NÃO renderiza o botão flutuante do Copilot em outras abas (ex: /carteira)', () => {
    render(
      <MemoryRouter initialEntries={['/carteira']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="carteira" element={<div>Conteúdo da Carteira</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const copilotBtn = screen.queryByRole('button', { name: /falar com o curiangoo/i })
    expect(copilotBtn).toBeNull()
  })

  it('NÃO renderiza o botão flutuante do Copilot na aba de metas (/metas)', () => {
    render(
      <MemoryRouter initialEntries={['/metas']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="metas" element={<div>Conteúdo de Metas</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const copilotBtn = screen.queryByRole('button', { name: /falar com o curiangoo/i })
    expect(copilotBtn).toBeNull()
  })
})
