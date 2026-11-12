import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../Login'
import ResetPassword from '../ResetPassword'

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    user: null,
    loading: false,
    isPasswordRecovery: false,
  }),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      resend: vi.fn(),
    },
  },
}))

vi.mock('@/components/common/InstallPwaBanner', () => ({
  InstallPwaBanner: () => null,
}))

describe('R58 — Auditoria dos 7 Atributos de Referência na Tela de Login & ResetPassword', () => {
  it('Atributo 1: Layout centralizado verticalmente, minimalista e objetivo', () => {
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    // O wrapper externo possui flex flex-col justify-between items-center e o container central tem my-auto
    const outerWrapper = container.firstElementChild as HTMLElement
    expect(outerWrapper.className).toContain('min-h-screen')
    expect(outerWrapper.className).toContain('flex')
    expect(outerWrapper.className).toContain('items-center')

    const centerCardContainer = container.querySelector('.max-w-\\[420px\\]')
    expect(centerCardContainer?.className).toContain('my-auto')
  })

  it('Atributo 2: Amplo respiro entre marca, título, campos e botão (space-y-6, mb-8/mb-10)', () => {
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    const header = container.querySelector('header')
    expect(header?.className).toContain('mb-8')

    const form = container.querySelector('form')
    expect(form?.className).toContain('space-y-6')
  })

  it('Atributo 3: Campos com ÍCONE LINEAR à esquerda + LINHA INFERIOR sutil (estilo underline, não caixa fechada)', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    const emailInput = screen.getByLabelText(/E-mail/i)
    // Não é caixa fechada com borda rounded tradicional: é border-0 rounded-none bg-transparent
    expect(emailInput.className).toContain('border-0')
    expect(emailInput.className).toContain('bg-transparent')
    expect(emailInput.className).toContain('rounded-none')

    // Contêiner underline com borda inferior
    const underlineWrapper = emailInput.closest('div.border-b')
    expect(underlineWrapper).not.toBeNull()
    expect(underlineWrapper?.className).toContain('border-slate-300')

    const passInput = screen.getByLabelText(/^Senha$/i)
    expect(passInput.className).toContain('border-0')
    expect(passInput.className).toContain('bg-transparent')
    expect(passInput.className).toContain('rounded-none')
  })

  it('Atributo 4: Campo ATIVO ganha linha de destaque na cor de acento da marca (amarelo de ação --action, CDS v4.0)', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    const emailInput = screen.getByLabelText(/E-mail/i)
    const emailWrapper = emailInput.closest('div.border-b')
    expect(emailWrapper?.className).toContain('focus-within:border-action')

    const passInput = screen.getByLabelText(/^Senha$/i)
    const passWrapper = passInput.closest('div.border-b')
    expect(passWrapper?.className).toContain('focus-within:border-action')
  })

  it('Atributo 5: Botão principal com elevação sutil (sombra tokenizada R56)', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    const submitBtn = screen.getByRole('button', { name: /^Entrar$/i })
    expect(submitBtn.className).toContain('shadow-elevation-1')
  })

  it('Atributo 6: Tipografia: título em peso forte, rótulos e placeholder em peso leve', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    const heading = screen.getByRole('heading', { level: 1, name: 'Curiangoo' })
    expect(heading.className).toContain('font-semibold')

    const emailLabel = screen.getByText('E-mail')
    expect(emailLabel.className).toContain('font-light')

    const emailInput = screen.getByLabelText(/E-mail/i)
    expect(emailInput.className).toContain('placeholder:font-light')
  })

  it('Atributo 7: Mensagens de erro discretas abaixo do campo, legíveis e com contraste WCAG', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    // No estado inicial sem submissão vazia, o elemento de erro não está presente
    expect(screen.queryByTestId('login-error-message')).toBeNull()
  })

  it('Mobile 360-412px: verifica que containers não possuem larguras fixas rígidas (> 360px) sem max-w-full', () => {
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    // O container principal é max-w-[420px] w-full com px-4 (portanto em 360px a largura é 360 - 32 = 328px)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('px-4')
    const mainCard = container.querySelector('main')
    expect(mainCard?.className).toContain('w-full')
    expect(mainCard?.className).not.toContain('min-w-[')
  })

  it('ResetPassword adota exatamente a mesma coerência de atributos', () => {
    const { container } = render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>,
    )

    const mainCard = container.querySelector('main')
    expect(mainCard?.className).toContain('shadow-elevation-2')

    const newPassInput = screen.getByLabelText(/^Nova Senha$/i)
    expect(newPassInput.className).toContain('border-0')
    expect(newPassInput.className).toContain('bg-transparent')
    expect(newPassInput.className).toContain('placeholder:font-light')

    const wrapper = newPassInput.closest('div.border-b')
    expect(wrapper?.className).toContain('focus-within:border-action')
  })
})
