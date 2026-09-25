import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../Login'

const mockSignIn = vi.fn()
const mockSignUp = vi.fn()
const mockResetPasswordForEmail = vi.fn()
const mockResend = vi.fn()
const mockToast = vi.fn()

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signUp: mockSignUp,
    resetPasswordForEmail: mockResetPasswordForEmail,
    user: null,
  }),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      resend: (...args: any[]) => mockResend(...args),
    },
  },
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
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

describe('Fluxo de Reenvio de E-mail de Confirmação', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exibe erro genérico quando credenciais são inválidas (anti-enumeração)', async () => {
    mockSignIn.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
    })

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: 'usuario@exemplo.com' },
    })
    fireEvent.change(screen.getByLabelText(/Senha/i), {
      target: { value: 'senha123' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^Entrar$/i }))

    await waitFor(() => {
      expect(screen.getByText('E-mail ou senha incorretos.')).toBeDefined()
    })

    // Garante que o alerta específico de não confirmado NÃO foi exibido
    expect(screen.queryByTestId('email-not-confirmed-alert')).toBeNull()
    expect(screen.queryByText(/Seu cadastro ainda não foi ativado/i)).toBeNull()
  })

  it('captura erro de e-mail não confirmado e exibe alerta com botão de reenvio', async () => {
    mockSignIn.mockResolvedValueOnce({
      error: { message: 'Email not confirmed', code: 'email_not_confirmed' },
    })

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: 'pendente@exemplo.com' },
    })
    fireEvent.change(screen.getByLabelText(/Senha/i), {
      target: { value: 'minhasenha' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^Entrar$/i }))

    await waitFor(() => {
      expect(
        screen.getByText('Seu cadastro ainda não foi ativado. Verifique seu e-mail.'),
      ).toBeDefined()
    })

    // Botão de reenvio presente
    const resendBtn = screen.getByRole('button', {
      name: /Reenviar E-mail de Confirmação/i,
    })
    expect(resendBtn).toBeDefined()

    // O erro vermelho genérico NÃO deve aparecer
    expect(screen.queryByText('E-mail ou senha incorretos.')).toBeNull()
  })

  it('chama supabase.auth.resend com o e-mail digitado e ativa cooldown de 60s com toast de sucesso', async () => {
    vi.useFakeTimers()
    mockSignIn.mockResolvedValueOnce({
      error: { message: 'Email not confirmed' },
    })
    mockResend.mockResolvedValueOnce({ data: {}, error: null })

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: 'teste@curiangoo.com' },
    })
    fireEvent.change(screen.getByLabelText(/Senha/i), {
      target: { value: '123456' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^Entrar$/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(
      screen.getByText('Seu cadastro ainda não foi ativado. Verifique seu e-mail.'),
    ).toBeDefined()

    const resendBtn = screen.getByRole('button', {
      name: /Reenviar E-mail de Confirmação/i,
    })

    await act(async () => {
      fireEvent.click(resendBtn)
    })

    // Verifica que supabase.auth.resend foi chamado com os dados corretos
    expect(mockResend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'teste@curiangoo.com',
      options: expect.objectContaining({
        emailRedirectTo: expect.any(String),
      }),
    })

    // Verifica toast de sucesso
    expect(mockToast).toHaveBeenCalledWith({
      title: 'E-mail enviado!',
      description: 'Novo link de ativação enviado! Confira sua caixa de entrada e o spam.',
    })

    // Verifica cooldown de 60s
    expect(screen.getByText(/Reenviar em 60s/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /Reenviar em 60s/i })).toHaveProperty(
      'disabled',
      true,
    )

    // Avança o tempo em 15s
    act(() => {
      vi.advanceTimersByTime(15000)
    })
    expect(screen.getByText(/Reenviar em 45s/i)).toBeDefined()

    // Avança mais 45s para zerar o cooldown
    act(() => {
      vi.advanceTimersByTime(45000)
    })
    expect(screen.queryByText(/Reenviar em/i)).toBeNull()
    expect(screen.getByRole('button', { name: /Reenviar E-mail de Confirmação/i })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('exibe toast de erro caso supabase.auth.resend falhe', async () => {
    mockSignIn.mockResolvedValueOnce({
      error: { message: 'email_not_confirmed' },
    })
    mockResend.mockResolvedValueOnce({
      error: { message: 'For security purposes, you can only request this once every 60 seconds.' },
    })

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: 'falha@curiangoo.com' },
    })
    fireEvent.change(screen.getByLabelText(/Senha/i), {
      target: { value: 'senha123' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^Entrar$/i }))

    await waitFor(() => {
      expect(screen.getByText(/Seu cadastro ainda não foi ativado/i)).toBeDefined()
    })

    const resendBtn = screen.getByRole('button', {
      name: /Reenviar E-mail de Confirmação/i,
    })

    fireEvent.click(resendBtn)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Não foi possível reenviar',
          description: expect.stringContaining('For security purposes'),
          variant: 'destructive',
        }),
      )
    })
  })
})
