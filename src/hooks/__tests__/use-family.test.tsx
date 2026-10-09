import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { FamilyProvider, useFamily } from '../use-family'
import * as familyService from '@/services/family'

const mockUser: any = {
  id: 'u-1',
  email: 'teste@curiangoo.com',
  user_metadata: { name: 'Matheus' },
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

describe('useFamily - Comportamento de Membro Ativo e "Quem está usando?"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('com exatamente 1 membro, seleciona-o automaticamente no localStorage e NUNCA abre o diálogo "Quem está usando?"', async () => {
    const singleMember = { id: 'm-single-1', name: 'Matheus', is_admin: true, family_id: 'fam-1' }
    vi.spyOn(familyService, 'fetchFamilyData').mockResolvedValue({
      family: {
        id: 'fam-1',
        name: 'Família Matheus',
        monthly_net_income_cents: 500000,
        avatar_url: null,
        created_at: new Date().toISOString(),
      } as any,
      members: [singleMember] as any,
      categories: [
        { id: 'cat-1', name: 'Alimentação', type: 'expense', budget_bucket: 'essentials' },
      ] as any,
      subcategories: [],
      completeness: {
        isIncomplete: false,
        categoryCount: 19,
        subcategoryCount: 117,
        ruleCount: 41,
      },
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FamilyProvider>{children}</FamilyProvider>
    )
    const { result } = renderHook(() => useFamily(), { wrapper })

    // Aguarda o término do carregamento inicial
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // O membro único deve ter sido auto-selecionado no localStorage
    expect(localStorage.getItem('financas_familiares_active_member_id')).toBe('m-single-1')
    expect(result.current.activeMemberId).toBe('m-single-1')
    expect(result.current.currentMember?.id).toBe('m-single-1')

    // O diálogo de "Quem está usando?" NUNCA deve ser aberto
    expect(result.current.isWhoIsUsingOpen).toBe(false)

    // Se o usuário tentar chamar openWhoIsUsing() com 1 membro, o diálogo NÃO abre
    act(() => {
      result.current.openWhoIsUsing()
    })
    expect(result.current.isWhoIsUsingOpen).toBe(false)
  })

  it('com 2 ou mais membros e SEM membro salvo, abre o diálogo "Quem está usando?" quando há renda configurada', async () => {
    const members = [
      { id: 'm-1', name: 'Matheus', is_admin: true, family_id: 'fam-1' },
      { id: 'm-2', name: 'Fernanda', is_admin: false, family_id: 'fam-1' },
    ]
    vi.spyOn(familyService, 'fetchFamilyData').mockResolvedValue({
      family: {
        id: 'fam-1',
        name: 'Família Matheus',
        monthly_net_income_cents: 600000,
        avatar_url: null,
        created_at: new Date().toISOString(),
      } as any,
      members: members as any,
      categories: [
        { id: 'cat-1', name: 'Alimentação', type: 'expense', budget_bucket: 'essentials' },
      ] as any,
      subcategories: [],
      completeness: {
        isIncomplete: false,
        categoryCount: 19,
        subcategoryCount: 117,
        ruleCount: 41,
      },
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FamilyProvider>{children}</FamilyProvider>
    )
    const { result } = renderHook(() => useFamily(), { wrapper })

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Com 2 membros e nenhuma seleção prévia salva, deve abrir o diálogo
    expect(result.current.isWhoIsUsingOpen).toBe(true)

    // Ao selecionar um membro, fecha o diálogo e salva no localStorage
    act(() => {
      result.current.setActiveMemberId('m-2')
      result.current.setIsWhoIsUsingOpen(false)
    })

    expect(localStorage.getItem('financas_familiares_active_member_id')).toBe('m-2')
    expect(result.current.activeMemberId).toBe('m-2')
    expect(result.current.isWhoIsUsingOpen).toBe(false)

    // Ao chamar openWhoIsUsing() com 2 membros, deve abrir normalmente
    act(() => {
      result.current.openWhoIsUsing()
    })
    expect(result.current.isWhoIsUsingOpen).toBe(true)
  })

  it('controla a abertura do VoiceTransactionDialog via openVoiceDialog e setIsVoiceDialogOpen', async () => {
    vi.spyOn(familyService, 'fetchFamilyData').mockResolvedValue({
      family: {
        id: 'fam-1',
        name: 'Família Matheus',
        monthly_net_income_cents: 600000,
        avatar_url: null,
        created_at: new Date().toISOString(),
      } as any,
      members: [{ id: 'm-1', name: 'Matheus', is_admin: true, family_id: 'fam-1' }] as any,
      categories: [],
      subcategories: [],
      completeness: {
        isIncomplete: false,
        categoryCount: 19,
        subcategoryCount: 117,
        ruleCount: 41,
      },
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FamilyProvider>{children}</FamilyProvider>
    )
    const { result } = renderHook(() => useFamily(), { wrapper })

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isVoiceDialogOpen).toBe(false)

    act(() => {
      result.current.openVoiceDialog()
    })
    expect(result.current.isVoiceDialogOpen).toBe(true)

    act(() => {
      result.current.setIsVoiceDialogOpen(false)
    })
    expect(result.current.isVoiceDialogOpen).toBe(false)
  })

  it('com 2 ou mais membros e membro já salvo no localStorage, NÃO abre o diálogo automaticamente', async () => {
    localStorage.setItem('financas_familiares_active_member_id', 'm-2')

    const members = [
      { id: 'm-1', name: 'Matheus', is_admin: true, family_id: 'fam-1' },
      { id: 'm-2', name: 'Fernanda', is_admin: false, family_id: 'fam-1' },
    ]
    vi.spyOn(familyService, 'fetchFamilyData').mockResolvedValue({
      family: {
        id: 'fam-1',
        name: 'Família Matheus',
        monthly_net_income_cents: 600000,
        avatar_url: null,
        created_at: new Date().toISOString(),
      } as any,
      members: members as any,
      categories: [
        { id: 'cat-1', name: 'Alimentação', type: 'expense', budget_bucket: 'essentials' },
      ] as any,
      subcategories: [],
      completeness: {
        isIncomplete: false,
        categoryCount: 19,
        subcategoryCount: 117,
        ruleCount: 41,
      },
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FamilyProvider>{children}</FamilyProvider>
    )
    const { result } = renderHook(() => useFamily(), { wrapper })

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isWhoIsUsingOpen).toBe(false)
    expect(result.current.activeMemberId).toBe('m-2')
    expect(result.current.currentMember?.name).toBe('Fernanda')
  })
})
