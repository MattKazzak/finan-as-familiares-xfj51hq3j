import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { FamilyProvider, useFamily } from '@/hooks/use-family'
import * as familyService from '@/services/family'

const mockUser: any = {
  id: 'u-post-reset-1',
  email: 'novousuario@curiangoo.com',
  user_metadata: { name: 'Novo Usuário' },
}

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

describe('Onboarding de Nova Família Pós-Reset (R53)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('família nova criada do zero após o reset passa pelo onboarding completo (0 transações, renda zero)', async () => {
    vi.spyOn(familyService, 'fetchFamilyData').mockResolvedValue({
      family: {
        id: 'fam-brand-new',
        name: 'Família Nova',
        monthly_net_income_cents: 0,
        avatar_url: null,
        created_at: new Date().toISOString(),
      } as any,
      members: [
        {
          id: 'member-admin',
          name: 'Novo Usuário',
          is_admin: true,
          family_id: 'fam-brand-new',
        },
      ] as any,
      categories: [],
      subcategories: [],
      completeness: {
        isIncomplete: true,
        categoryCount: 0,
        subcategoryCount: 0,
        ruleCount: 0,
        transactionCount: 0,
        hasAnyTransactions: false,
      },
      hasAnyTransactions: false,
      transactionCount: 0,
    } as any)

    vi.spyOn(familyService, 'checkFamilyHasTransactions').mockResolvedValue(false)

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(FamilyProvider, null, children)

    const { result } = renderHook(() => useFamily(), { wrapper })

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await vi.waitFor(() => {
      expect(result.current.isOnboardingOpen).toBe(true)
    })
    expect(result.current.hasAnyTransactions).toBe(false)
    expect(result.current.family?.name).toBe('Família Nova')
  })

  it('blindagem da R50 permanece intacta: apenas famílias com transações reais têm onboarding bloqueado', async () => {
    vi.spyOn(familyService, 'fetchFamilyData').mockResolvedValue({
      family: {
        id: 'fam-with-txs',
        name: 'Família Existente',
        monthly_net_income_cents: 800000,
        avatar_url: null,
        created_at: new Date().toISOString(),
      } as any,
      members: [
        {
          id: 'member-1',
          name: 'Usuário Ativo',
          is_admin: true,
          family_id: 'fam-with-txs',
        },
      ] as any,
      categories: [
        { id: 'cat-1', name: 'Alimentação', type: 'expense', budget_bucket: 'essentials' },
      ] as any,
      subcategories: [],
      completeness: {
        isIncomplete: false,
        categoryCount: 19,
        subcategoryCount: 118,
        ruleCount: 41,
        transactionCount: 20,
        hasAnyTransactions: true,
      },
      hasAnyTransactions: true,
      transactionCount: 20,
    } as any)

    vi.spyOn(familyService, 'checkFamilyHasTransactions').mockResolvedValue(true)

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(FamilyProvider, null, children)

    const { result } = renderHook(() => useFamily(), { wrapper })

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isOnboardingOpen).toBe(false)
    expect(result.current.hasAnyTransactions).toBe(true)
  })
})
