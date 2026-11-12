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

describe('Login / Cadastro Page Brand Header & WCAG Contrast (R57)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders official Curiangoo brand icon, title and subtitle in login mode with clean light theme', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    const brandLogo = screen.getByTestId('brand-logo-container')
    expect(brandLogo).toBeDefined()
    expect(brandLogo.getAttribute('aria-label')).toBe('Curiangoo')

    expect(screen.getByRole('heading', { level: 1, name: 'Curiangoo' })).toBeDefined()
    expect(
      screen.getByText(
        'Acesse sua conta familiar para acompanhar despesas, receitas e investimentos.',
      ),
    ).toBeDefined()
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

    const brandLogo = screen.getByTestId('brand-logo-container')
    expect(brandLogo).toBeDefined()
    expect(brandLogo.getAttribute('aria-label')).toBe('Curiangoo')

    expect(screen.getByRole('heading', { level: 1, name: 'Curiangoo' })).toBeDefined()
    expect(screen.getByText('Passo 1 de 2: Crie suas credenciais de acesso seguro.')).toBeDefined()
  })

  it('no modo cadastro, organiza em passos focados: Passo 1 (Credenciais) → Passo 2 (Seu Nome)', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    const signupTab = screen.getByText('Criar Nova Conta')
    fireEvent.click(signupTab)

    // Passo 1: Credenciais
    expect(screen.getByText('Passo 1 de 2: Crie suas credenciais de acesso seguro.')).toBeDefined()
    expect(screen.getByLabelText(/^E-mail/i)).toBeDefined()
    expect(screen.getByLabelText(/^Senha/i)).toBeDefined()
    expect(screen.getByLabelText(/^Confirmar Senha/i)).toBeDefined()
    // Nome ainda não aparece no passo 1
    expect(screen.queryByLabelText(/Seu Nome/i)).toBeNull()

    // Preenche credenciais válidas e avança
    fireEvent.change(screen.getByLabelText(/^E-mail/i), {
      target: { value: 'novo.membro@curiangoo.com' },
    })
    fireEvent.change(screen.getByLabelText(/^Senha/i), {
      target: { value: 'senha123' },
    })
    fireEvent.change(screen.getByLabelText(/^Confirmar Senha/i), {
      target: { value: 'senha123' },
    })

    const continueBtn = screen.getByRole('button', { name: /Continuar/i })
    fireEvent.click(continueBtn)

    // Passo 2: Pergunta apenas "Seu Nome" (pessoa) e NÃO pede nome da família
    await waitFor(() => {
      expect(screen.getByText('Passo 2 de 2: Como podemos chamar você?')).toBeDefined()
    })
    expect(screen.getByLabelText('Seu Nome')).toBeDefined()
    expect(screen.getByPlaceholderText('Ex: Matheus')).toBeDefined()

    // Decisão do produto: nome da família é definido no onboarding, NUNCA no signup
    expect(screen.queryByLabelText(/Nome da Família/i)).toBeNull()
    expect(screen.queryByPlaceholderText(/Ex.: Silva/i)).toBeNull()

    // Preenche nome e submete
    fireEvent.change(screen.getByLabelText('Seu Nome'), {
      target: { value: 'Matheus Silva' },
    })
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    })

    const submitBtn = screen.getByRole('button', { name: /Criar Minha Conta/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('novo.membro@curiangoo.com', 'senha123', {
        name: 'Matheus Silva',
      })
    })
  })

  it('assegura contraste nos placeholders e labels e campos em estilo underline com foco acentuado no amarelo de ação (token --action, CDS v4.0)', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    const emailInput = screen.getByLabelText(/E-mail/i)
    expect(emailInput.className).toContain('placeholder:text-body3')
    expect(emailInput.className).toContain('border-0')
    expect(emailInput.className).toContain('bg-transparent')
    expect(emailInput.className).toContain('text-ink')

    // Container com estilo underline e acento amarelo de ação (#FFC629) no foco
    const emailContainer = emailInput.closest('div.border-b')
    expect(emailContainer).not.toBeNull()
    expect(emailContainer?.className).toContain('border-b')
    expect(emailContainer?.className).toContain('focus-within:border-action')

    const passInput = screen.getByLabelText(/^Senha$/i)
    expect(passInput.className).toContain('placeholder:text-body3')
    expect(passInput.className).toContain('border-0')
    expect(passInput.className).toContain('bg-transparent')

    const passContainer = passInput.closest('div.border-b')
    expect(passContainer).not.toBeNull()
    expect(passContainer?.className).toContain('focus-within:border-action')

    // Botão de submissão com sombra de card tokenizada (shadow-cds, CDS v4.0)
    const submitBtn = screen.getByRole('button', { name: /Entrar na minha conta/i })
    expect(submitBtn.className).toContain('shadow-cds')
  })
})

describe('Fluxo de Erros e Reenvio de E-mail de Confirmação', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exibe erro genérico quando credenciais são inválidas (anti user-enumeration mantido)', async () => {
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
    fireEvent.change(screen.getByLabelText(/^Senha$/i), {
      target: { value: 'senha123' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Entrar na minha conta/i }))

    await waitFor(() => {
      expect(screen.getByText('E-mail ou senha incorretos.')).toBeDefined()
    })

    // Garante que o alerta específico de não confirmado NÃO foi exibido
    expect(screen.queryByTestId('email-not-confirmed-alert')).toBeNull()
    expect(screen.queryByText(/Seu cadastro ainda não foi ativado/i)).toBeNull()

    // O link de apoio anti-frustração está presente
    expect(screen.getByText('Ainda não tem conta? Clique para se cadastrar')).toBeDefined()
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
    fireEvent.change(screen.getByLabelText(/^Senha$/i), {
      target: { value: 'minhasenha' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Entrar na minha conta/i }))

    await waitFor(() => {
      expect(
        screen.getByText('Seu cadastro ainda não foi ativado. Verifique seu e-mail.'),
      ).toBeDefined()
    })

    const resendBtn = screen.getByRole('button', {
      name: /Reenviar E-mail de Confirmação/i,
    })
    expect(resendBtn).toBeDefined()

    // O erro vermelho genérico NÃO deve aparecer quando for email_not_confirmed
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
    fireEvent.change(screen.getByLabelText(/^Senha$/i), {
      target: { value: '123456' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Entrar na minha conta/i }))

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

    expect(mockResend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'teste@curiangoo.com',
      options: {
        emailRedirectTo: `${window.location.origin}/inicio`,
      },
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: 'E-mail enviado!',
      description: 'Novo link de ativação enviado! Confira sua caixa de entrada e o spam.',
    })

    // Cooldown de 60s ativo
    expect(screen.getByText(/Reenviar em 60s/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /Reenviar em 60s/i })).toHaveProperty(
      'disabled',
      true,
    )

    act(() => {
      vi.advanceTimersByTime(15000)
    })
    expect(screen.getByText(/Reenviar em 45s/i)).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(45000)
    })
    expect(screen.queryByText(/Reenviar em/i)).toBeNull()
    expect(screen.getByRole('button', { name: /Reenviar E-mail de Confirmação/i })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('alterna visibilidade da senha de login (Eye / EyeOff) alterando o input type', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    const passInput = screen.getByLabelText(/^Senha$/i)
    expect(passInput.getAttribute('type')).toBe('password')

    const toggleBtn = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(toggleBtn).toBeDefined()
    expect(toggleBtn.getAttribute('type')).toBe('button')

    fireEvent.click(toggleBtn)
    expect(passInput.getAttribute('type')).toBe('text')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(passInput.getAttribute('type')).toBe('password')
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeDefined()
  })

  it('no modo cadastro, possui botões de olho independentes para Senha e Confirmar Senha no Passo 1', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByText('Criar Nova Conta'))

    const passInput = screen.getByLabelText(/^Senha$/i)
    const confirmInput = screen.getByLabelText(/^Confirmar Senha$/i)

    expect(passInput.getAttribute('type')).toBe('password')
    expect(confirmInput.getAttribute('type')).toBe('password')

    const toggleButtons = screen.getAllByRole('button', { name: 'Mostrar senha' })
    expect(toggleButtons).toHaveLength(2)

    fireEvent.click(toggleButtons[0])
    expect(passInput.getAttribute('type')).toBe('text')
    expect(confirmInput.getAttribute('type')).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(passInput.getAttribute('type')).toBe('text')
    expect(confirmInput.getAttribute('type')).toBe('text')

    fireEvent.click(screen.getAllByRole('button', { name: 'Ocultar senha' })[0])
    expect(passInput.getAttribute('type')).toBe('password')
    expect(confirmInput.getAttribute('type')).toBe('text')
  })
})
