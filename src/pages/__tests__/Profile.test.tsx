import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import ProfilePage from '../Profile'

const mockTriggerInstall = vi.fn()
let mockIsStandalone = false
let mockHasNativePrompt = true
let mockIsIos = false

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { email: 'familiasilva@exemplo.com' },
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: { id: 'f-1', name: 'Silva', monthly_net_income_cents: 800000, avatar_url: null },
    members: [{ id: 'm-1', name: 'Lucas', is_admin: true }],
    categories: [],
    currentMember: { id: 'm-1', name: 'Lucas', is_admin: true },
    activeMemberId: 'm-1',
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
    triggerInstall: mockTriggerInstall,
  }),
}))

vi.mock('@/components/wallet/ApplyBudgetModelDialog', () => ({
  ApplyBudgetModelDialog: () => null,
}))

describe('ProfilePage PWA Install Shortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsStandalone = false
    mockHasNativePrompt = true
    mockIsIos = false
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

  it('triggers native prompt on Android/Chrome when clicked', () => {
    mockIsStandalone = false
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
  })

  it('opens instructions modal when clicked on iOS or without native prompt', () => {
    mockIsStandalone = false
    mockHasNativePrompt = false
    mockIsIos = true

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const installBtn = screen.getByRole('button', { name: /Instalar Agora/i })
    fireEvent.click(installBtn)

    expect(screen.getByText('Instalar Curiangoo')).toBeDefined()
    expect(screen.getByText(/Toque no ícone/i)).toBeDefined()
    expect(screen.getByText(/Adicionar à Tela de Início/i)).toBeDefined()
  })
})
