import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import ProfilePage from '../Profile'

const mockTriggerInstall = vi.fn().mockResolvedValue(true)
let mockIsStandalone = false
let mockHasNativePrompt = true
let mockIsIos = false
let mockDeferredPrompt: unknown = {
  prompt: vi.fn().mockResolvedValue(undefined),
  userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
}

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { email: 'familiasilva@exemplo.com' },
    signOut: vi.fn(),
  }),
}))

let mockMembers = [{ id: 'm-1', name: 'Lucas', is_admin: true }]

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: { id: 'f-1', name: 'Silva', monthly_net_income_cents: 800000, avatar_url: null },
    members: mockMembers,
    categories: [],
    currentMember: mockMembers[0] || null,
    activeMemberId: mockMembers[0]?.id || null,
    setActiveMemberId: vi.fn(),
    openWhoIsUsing: vi.fn(),
    addMember: vi.fn(),
    editMember: vi.fn(),
    removeMember: vi.fn(),
    updateFamily: vi.fn(),
    uploadFamilyAvatar: vi.fn(),
    triggerRefresh: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-pwa-install', () => ({
  usePwaInstall: () => ({
    isStandalone: mockIsStandalone,
    isIos: mockIsIos,
    hasNativePrompt: mockHasNativePrompt,
    deferredPrompt: mockDeferredPrompt,
    triggerInstall: mockTriggerInstall,
  }),
}))

vi.mock('@/components/wallet/ApplyBudgetModelDialog', () => ({
  ApplyBudgetModelDialog: () => null,
}))

describe('ProfilePage PWA Install Shortcut - 3 Cenários de Clique', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsStandalone = false
    mockHasNativePrompt = true
    mockIsIos = false
    mockDeferredPrompt = {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    }
    mockMembers = [{ id: 'm-1', name: 'Lucas', is_admin: true }]
  })

  it('esconde o quadro "Quem está usando este aparelho?" quando há apenas 1 membro', () => {
    mockMembers = [{ id: 'm-1', name: 'Lucas', is_admin: true }]

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Quem está usando este aparelho?')).toBeNull()
    expect(screen.queryByText(/Alterne para personalizar a saudação/i)).toBeNull()
  })

  it('exibe o quadro "Quem está usando este aparelho?" quando a família possui 2 ou mais membros', () => {
    mockMembers = [
      { id: 'm-1', name: 'Lucas', is_admin: true },
      { id: 'm-2', name: 'Beatriz', is_admin: false },
    ]

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Quem está usando este aparelho?')).toBeDefined()
    expect(screen.getByText(/Alterne para personalizar a saudação/i)).toBeDefined()
    expect(screen.getByText('Lucas')).toBeDefined()
    expect(screen.getByText('Beatriz')).toBeDefined()
  })

  it('renders PWA install shortcut card when not standalone', () => {
    mockIsStandalone = false

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('📲 Instalar aplicativo no celular')).toBeDefined()
    expect(screen.getByText('Tenha acesso rápido direto da sua tela inicial')).toBeDefined()
  })

  it('hides PWA install shortcut card when app is running in standalone mode', () => {
    mockIsStandalone = true

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(screen.queryByText('📲 Instalar aplicativo no celular')).toBeNull()
  })

  it('CENÁRIO A (Chrome / Edge / Android): if deferredPrompt exists, executes prompt immediately without opening instructions modal', async () => {
    mockIsStandalone = false
    mockDeferredPrompt = { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) }
    mockHasNativePrompt = true
    mockIsIos = false

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const installBtn = screen.getByRole('button', { name: /Instalar Agora/i })
    fireEvent.click(installBtn)

    expect(mockTriggerInstall).toHaveBeenCalled()
    // Garante que NENHUM modal de instruções foi aberto nesse cenário
    expect(screen.queryByText('Instalar no iPhone / iPad')).toBeNull()
    expect(screen.queryByText(/Toque no ícone de menu com/i)).toBeNull()
  })

  it('CENÁRIO B (iOS / iPhone / iPad): opens iOS specific modal showing Apple icon and Safari instructions', async () => {
    mockIsStandalone = false
    mockDeferredPrompt = null
    mockHasNativePrompt = false
    mockIsIos = true

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const installBtn = screen.getByRole('button', { name: /Como Instalar/i })
    fireEvent.click(installBtn)

    expect(mockTriggerInstall).not.toHaveBeenCalled()
    expect(screen.getByText('Instalar no iPhone / iPad')).toBeDefined()
    expect(screen.getByText(/Compartilhar/i)).toBeDefined()
    expect(screen.getByText(/Adicionar à Tela de Início/i)).toBeDefined()
  })

  it('CENÁRIO C (Outros navegadores sem suporte ao prompt direto): opens dynamic instructions for 3-dots menu', async () => {
    mockIsStandalone = false
    mockDeferredPrompt = null
    mockHasNativePrompt = false
    mockIsIos = false

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const installBtn = screen.getByRole('button', { name: /Instalar Aplicativo/i })
    fireEvent.click(installBtn)

    expect(mockTriggerInstall).not.toHaveBeenCalled()
    expect(screen.getByText('Instalar Curiangoo')).toBeDefined()
    expect(screen.getByText(/3 pontinhos/i)).toBeDefined()
    expect(screen.getByText(/Instalar aplicativo/i)).toBeDefined()
  })

  it('renderiza o título da família sem classe truncate e com quebra responsiva', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const titleEl = screen.getByRole('heading', { level: 2, name: 'Família Silva' })
    expect(titleEl).toBeDefined()
    expect(titleEl.className).not.toContain('truncate')
    expect(titleEl.className).toContain('break-words')
  })
})
