import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../Login'

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    user: null,
  }),
}))

vi.mock('@/components/common/InstallPwaBanner', () => ({
  InstallPwaBanner: () => <div data-testid="install-pwa-banner" />,
}))

describe('Login / Cadastro Page Brand Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders official Curiangoo brand icon, title and subtitle in login mode', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    const brandImg = screen.getByAltText('Curiangoo')
    expect(brandImg).toBeDefined()
    expect(brandImg.getAttribute('src')).toBe('/icon-192.png')

    expect(screen.getByRole('heading', { level: 1, name: 'Curiangoo' })).toBeDefined()
    expect(screen.getByText('Finanças Familiares no Prumo')).toBeDefined()
    expect(screen.getByText('Entrar na Conta')).toBeDefined()
  })

  it('maintains the same brand header when toggled to signup mode', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    const signupTab = screen.getByText('Criar Nova Conta')
    fireEvent.click(signupTab)

    const brandImg = screen.getByAltText('Curiangoo')
    expect(brandImg).toBeDefined()
    expect(brandImg.getAttribute('src')).toBe('/icon-192.png')

    expect(screen.getByRole('heading', { level: 1, name: 'Curiangoo' })).toBeDefined()
    expect(screen.getByText('Finanças Familiares no Prumo')).toBeDefined()
  })
})
