import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { InstallPwaBanner } from '../InstallPwaBanner'

const mockTriggerInstall = vi.fn().mockResolvedValue(true)
const mockDismiss = vi.fn()
let mockCanShowBanner = true
let mockHasNativePrompt = true
let mockIsIos = false
let mockDeferredPrompt: unknown = {
  prompt: vi.fn().mockResolvedValue(undefined),
  userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
}

vi.mock('@/hooks/use-pwa-install', () => ({
  usePwaInstall: () => ({
    canShowBanner: mockCanShowBanner,
    isStandalone: false,
    isMobileDevice: true,
    isIos: mockIsIos,
    isDismissed: false,
    hasNativePrompt: mockHasNativePrompt,
    deferredPrompt: mockDeferredPrompt,
    dismiss: mockDismiss,
    triggerInstall: mockTriggerInstall,
  }),
}))

describe('InstallPwaBanner - 3 Cenários de Clique', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanShowBanner = true
    mockHasNativePrompt = true
    mockIsIos = false
    mockDeferredPrompt = {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    }
  })

  it('renders banner when canShowBanner is true', () => {
    render(<InstallPwaBanner />)
    expect(screen.getByRole('region', { name: 'Instalação do Curiangoo' })).toBeDefined()
    expect(screen.getByText('Instalar Curiangoo')).toBeDefined()
  })

  it('CENÁRIO A (Chrome / Edge / Android): button triggers prompt immediately without opening modal', async () => {
    mockDeferredPrompt = { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) }
    mockHasNativePrompt = true
    mockIsIos = false

    render(<InstallPwaBanner />)

    const installBtn = screen.getByRole('button', { name: /Instalar Aplicativo/i })
    fireEvent.click(installBtn)

    expect(mockTriggerInstall).toHaveBeenCalled()
    expect(screen.queryByText('Instalar no iPhone / iPad')).toBeNull()
  })

  it('CENÁRIO B (iOS / Safari): opens iOS instructions modal when clicked', () => {
    mockDeferredPrompt = null
    mockHasNativePrompt = false
    mockIsIos = true

    render(<InstallPwaBanner />)

    const actionBtn = screen.getByRole('button', { name: /Como Instalar/i })
    fireEvent.click(actionBtn)

    expect(mockTriggerInstall).not.toHaveBeenCalled()
    expect(screen.getByText('Instalar no iPhone / iPad')).toBeDefined()
    expect(screen.getByText(/Compartilhar/i)).toBeDefined()
  })

  it('CENÁRIO C (Outros navegadores): opens dynamic instructions modal with 3 dots', () => {
    mockDeferredPrompt = null
    mockHasNativePrompt = false
    mockIsIos = false

    render(<InstallPwaBanner />)

    const actionBtn = screen.getByRole('button', { name: /Ver Instruções/i })
    fireEvent.click(actionBtn)

    expect(mockTriggerInstall).not.toHaveBeenCalled()
    expect(screen.getByText('Instalar Curiangoo')).toBeDefined()
    expect(screen.getByText(/3 pontinhos/i)).toBeDefined()
  })

  it('calls dismiss when user clicks Entendido', () => {
    render(<InstallPwaBanner />)
    const dismissBtn = screen.getByRole('button', { name: /Entendido/i })
    fireEvent.click(dismissBtn)
    expect(mockDismiss).toHaveBeenCalled()
  })
})
