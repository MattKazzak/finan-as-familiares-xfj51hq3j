import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { AuthProvider, useAuth } from '../use-auth'
import { supabase } from '@/lib/supabase/client'

let authStateChangeCallback: ((event: string, session: any) => void) | null = null

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb) => {
        authStateChangeCallback = cb
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        }
      }),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      resend: vi.fn(),
      signOut: vi.fn(),
      exchangeCodeForSession: vi.fn(),
    },
  },
}))

describe('useAuth - Confirmação de Cadastro vs Recuperação de Senha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authStateChangeCallback = null
    window.location.hash = ''
    window.location.search = ''
    window.history.replaceState({}, '', '/')
  })

  it('configura emailRedirectTo para /inicio no signUp', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )
    const { result } = renderHook(() => useAuth(), { wrapper })

    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: { user: { id: 'u-1', email: 'novo@curiangoo.com' } as any, session: null },
      error: null,
    })

    await act(async () => {
      await result.current.signUp('novo@curiangoo.com', 'senha123', { name: 'Matheus' })
    })

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'novo@curiangoo.com',
      password: 'senha123',
      options: {
        emailRedirectTo: `${window.location.origin}/inicio`,
        data: {
          name: 'Matheus',
        },
      },
    })
  })

  it('configura emailRedirectTo para /inicio no resendConfirmationEmail', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )
    const { result } = renderHook(() => useAuth(), { wrapper })

    vi.mocked(supabase.auth.resend).mockResolvedValueOnce({
      data: {} as any,
      error: null,
    })

    await act(async () => {
      await result.current.resendConfirmationEmail('novo@curiangoo.com')
    })

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'novo@curiangoo.com',
      options: {
        emailRedirectTo: `${window.location.origin}/inicio`,
      },
    })
  })

  it('NÃO marca isPasswordRecovery se a URL contiver confirmação de cadastro (type=signup)', () => {
    window.location.hash = '#access_token=token123&type=signup&refresh_token=refresh123'

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isPasswordRecovery).toBe(false)
  })

  it('NÃO marca isPasswordRecovery se query search contiver code com type=signup', () => {
    window.location.search = '?code=supabase-code-123&type=signup'

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isPasswordRecovery).toBe(false)
  })

  it('marca isPasswordRecovery como true quando o evento for PASSWORD_RECOVERY', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )
    const { result } = renderHook(() => useAuth(), { wrapper })

    act(() => {
      authStateChangeCallback?.('PASSWORD_RECOVERY', {
        user: { id: 'u-1', email: 'recupera@curiangoo.com' },
      })
    })

    expect(result.current.isPasswordRecovery).toBe(true)
  })

  it('mantém isPasswordRecovery falso ao disparar SIGNED_IN em link com type=signup', () => {
    window.location.hash = '#access_token=xyz&type=signup'

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )
    const { result } = renderHook(() => useAuth(), { wrapper })

    act(() => {
      authStateChangeCallback?.('SIGNED_IN', {
        user: { id: 'u-1', email: 'confirmado@curiangoo.com' },
      })
    })

    expect(result.current.isPasswordRecovery).toBe(false)
    expect(result.current.user?.email).toBe('confirmado@curiangoo.com')
  })

  it('marca isPasswordRecovery como true quando a URL contiver explicitamente type=recovery', () => {
    window.location.hash = '#access_token=token123&type=recovery&refresh_token=refresh123'

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isPasswordRecovery).toBe(true)
  })
})
