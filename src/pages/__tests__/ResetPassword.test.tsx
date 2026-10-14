import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import ResetPassword from '../ResetPassword'

const mockUpdatePassword = vi.fn()
const mockClearPasswordRecovery = vi.fn()

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'u123', email: 'teste@curiangoo.com' },
    loading: false,
    isPasswordRecovery: true,
    updatePassword: mockUpdatePassword,
    clearPasswordRecovery: mockClearPasswordRecovery,
  }),
}))

describe('ResetPassword Page (R57 Refined UI & WCAG Contrast)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders brand header, inputs with underline style, linear icon and amber focus #FCA311 (R58)', () => {
    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Criar Nova Senha — Curiangoo' }),
    ).toBeDefined()

    const newPassInput = screen.getByLabelText(/^Nova Senha$/i)
    const confirmPassInput = screen.getByLabelText(/^Confirmar Nova Senha$/i)

    expect(newPassInput.className).toContain('placeholder:text-slate-400')
    expect(confirmPassInput.className).toContain('placeholder:text-slate-400')

    const newPassContainer = newPassInput.closest('div.border-b')
    expect(newPassContainer).not.toBeNull()
    expect(newPassContainer?.className).toContain('focus-within:border-[#FCA311]')

    const confirmPassContainer = confirmPassInput.closest('div.border-b')
    expect(confirmPassContainer).not.toBeNull()
    expect(confirmPassContainer?.className).toContain('focus-within:border-[#FCA311]')

    const submitBtn = screen.getByRole('button', { name: /Salvar Nova Senha/i })
    expect(submitBtn.className).toContain('shadow-elevation-1')
  })

  it('validates password minimum length and matching confirmation with human messages', async () => {
    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/^Nova Senha$/i), {
      target: { value: '123' },
    })
    fireEvent.change(screen.getByLabelText(/^Confirmar Nova Senha$/i), {
      target: { value: '123' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Salvar Nova Senha/i }))

    await waitFor(() => {
      expect(screen.getByText('A nova senha deve ter no mínimo 6 caracteres.')).toBeDefined()
    })

    fireEvent.change(screen.getByLabelText(/^Nova Senha$/i), {
      target: { value: '123456' },
    })
    fireEvent.change(screen.getByLabelText(/^Confirmar Nova Senha$/i), {
      target: { value: '654321' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Salvar Nova Senha/i }))

    await waitFor(() => {
      expect(
        screen.getByText('As senhas digitadas não coincidem. Verifique e tente novamente.'),
      ).toBeDefined()
    })
  })
})
