import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PwaUpdateBanner } from '../PwaUpdateBanner'
import * as swHook from '@/hooks/use-service-worker'

describe('PwaUpdateBanner', () => {
  it('não renderiza nada quando hasUpdate é false', () => {
    vi.spyOn(swHook, 'useServiceWorkerUpdate').mockReturnValue({
      hasUpdate: false,
      isUpdating: false,
      updateServiceWorker: vi.fn(),
      dismissUpdate: vi.fn(),
    })

    const { container } = render(<PwaUpdateBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza o aviso discreto quando hasUpdate é true', () => {
    const mockUpdate = vi.fn()
    const mockDismiss = vi.fn()

    vi.spyOn(swHook, 'useServiceWorkerUpdate').mockReturnValue({
      hasUpdate: true,
      isUpdating: false,
      updateServiceWorker: mockUpdate,
      dismissUpdate: mockDismiss,
    })

    render(<PwaUpdateBanner />)

    expect(screen.getByText('Nova versão disponível')).toBeDefined()
    expect(screen.getByText('Atualize para carregar as melhorias recentes.')).toBeDefined()

    const updateBtn = screen.getByRole('button', { name: /Atualizar/i })
    expect(updateBtn).toBeDefined()

    fireEvent.click(updateBtn)
    expect(mockUpdate).toHaveBeenCalledTimes(1)

    const dismissBtn = screen.getByRole('button', {
      name: /Dispensar aviso de atualização/i,
    })
    fireEvent.click(dismissBtn)
    expect(mockDismiss).toHaveBeenCalledTimes(1)
  })
})
