import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  fetchFamilyInvites,
  fetchFamilyData,
} from '../family'
import { supabase } from '@/lib/supabase/client'

vi.mock('@/lib/supabase/client', () => {
  return {
    supabase: {
      rpc: vi.fn(),
      from: vi.fn(),
    },
  }
})

describe('Family Service - Camada de Serviço e Hardening RLS/RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('addFamilyMember', () => {
    it('chama a RPC add_family_member_without_account com parâmetros sanitizados', async () => {
      const mockMember = {
        id: 'member-uuid-1',
        family_id: 'family-uuid-1',
        name: 'Maria Silva',
        is_admin: false,
        user_id: null,
      }
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockMember,
        error: null,
      } as any)

      const result = await addFamilyMember('family-uuid-1', '  Maria Silva  ')

      expect(supabase.rpc).toHaveBeenCalledTimes(1)
      expect(supabase.rpc).toHaveBeenCalledWith('add_family_member_without_account', {
        p_family_id: 'family-uuid-1',
        p_name: 'Maria Silva',
      })
      expect(result).toEqual(mockMember)
    })

    it('propaga erro caso a RPC rejeite o pedido (ex.: não autorizado)', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: new Error('Apenas o administrador da família pode adicionar membros.'),
      } as any)

      await expect(addFamilyMember('family-uuid-1', 'Novo Membro')).rejects.toThrow(
        'Apenas o administrador da família pode adicionar membros.',
      )
    })
  })

  describe('updateFamilyMember', () => {
    it('chama a RPC rename_family_member com o memberId e novo nome trimado', async () => {
      const mockUpdated = {
        id: 'member-uuid-1',
        family_id: 'family-uuid-1',
        name: 'Maria de Souza',
        is_admin: false,
        user_id: null,
      }
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockUpdated,
        error: null,
      } as any)

      const result = await updateFamilyMember('member-uuid-1', '  Maria de Souza  ')

      expect(supabase.rpc).toHaveBeenCalledTimes(1)
      expect(supabase.rpc).toHaveBeenCalledWith('rename_family_member', {
        p_member_id: 'member-uuid-1',
        p_new_name: 'Maria de Souza',
      })
      expect(result).toEqual(mockUpdated)
    })

    it('propaga erro caso o chamador não seja admin da família', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: new Error('Apenas o administrador da família pode renomear membros.'),
      } as any)

      await expect(updateFamilyMember('member-uuid-1', 'Novo Nome')).rejects.toThrow(
        'Apenas o administrador da família pode renomear membros.',
      )
    })
  })

  describe('deleteFamilyMember', () => {
    it('chama a RPC remove_family_member garantindo fluxo seguro sem deleção direta no cliente', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      } as any)

      const result = await deleteFamilyMember('member-uuid-1')

      expect(supabase.rpc).toHaveBeenCalledTimes(1)
      expect(supabase.rpc).toHaveBeenCalledWith('remove_family_member', {
        p_member_id: 'member-uuid-1',
      })
      expect(result).toEqual({ success: true })
    })
  })

  describe('fetchFamilyData - Guard Reentrante', () => {
    it('quando duas chamadas simultâneas ocorrem para usuário sem família, não duplica a criação da workspace', async () => {
      // Mock auth.getUser
      vi.mocked(supabase as any).auth = {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-unique-race-1',
              email: 'usuario@teste.com',
              user_metadata: { name: 'Pessoa Teste' },
            },
          },
        }),
      }

      let createdCount = 0
      const mockCreatedFamily = {
        id: 'fam-created-1',
        name: 'Minha Família',
        owner_id: 'user-unique-race-1',
        created_at: '2026-10-20T12:00:00Z',
      }

      vi.mocked(supabase.rpc).mockImplementation(((method: string) => {
        if (method === 'create_new_family_workspace') {
          createdCount++
          // Simula pequena latência da RPC
          return new Promise((r) => setTimeout(r, 20)).then(() => ({
            data: 'fam-created-1',
            error: null,
          })) as any
        }
        return Promise.resolve({ data: null, error: null }) as any
      }) as any)

      // Simula banco: inicialmente vazio; após criação, passa a ter mockCreatedFamily
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'families') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockImplementation(async () => {
                  if (createdCount > 0) {
                    return { data: [mockCreatedFamily], error: null }
                  }
                  return { data: [], error: null }
                }),
              }),
            }),
          } as any
        }

        // family_members, transaction_categories, transaction_subcategories
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        } as any
      })

      // Dispara 2 chamadas concorrentes idênticas a fetchFamilyData()
      const [res1, res2] = await Promise.all([fetchFamilyData(), fetchFamilyData()])

      // Apenas UMA família deve ter sido criada via RPC
      expect(createdCount).toBe(1)
      expect(res1.family?.id).toBe('fam-created-1')
      expect(res2.family?.id).toBe('fam-created-1')
    })
  })

  describe('fetchFamilyInvites', () => {
    it('consulta family_invites selecionando colunas específicas e ordenando por created_at desc', async () => {
      const mockInvites = [
        {
          id: 'inv-1',
          code: 'CURI-ABCD',
          role: 'member',
          status: 'pending',
          uses_count: 0,
          max_uses: 1,
          expires_at: '2026-10-12T00:00:00.000Z',
          created_at: '2026-10-05T00:00:00.000Z',
          family_id: 'family-uuid-1',
          created_by: 'user-admin-1',
          accepted_by: null,
          accepted_at: null,
        },
      ]

      const orderMock = vi.fn().mockResolvedValueOnce({
        data: mockInvites,
        error: null,
      })
      const eqMock = vi.fn().mockReturnValue({
        order: orderMock,
      })
      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock,
      })
      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
      } as any)

      const result = await fetchFamilyInvites('family-uuid-1')

      expect(supabase.from).toHaveBeenCalledWith('family_invites')
      expect(selectMock).toHaveBeenCalledWith(
        'id, code, role, status, uses_count, max_uses, expires_at, created_at, family_id, created_by, accepted_by, accepted_at',
      )
      expect(eqMock).toHaveBeenCalledWith('family_id', 'family-uuid-1')
      expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toEqual(mockInvites)
    })
  })
})
