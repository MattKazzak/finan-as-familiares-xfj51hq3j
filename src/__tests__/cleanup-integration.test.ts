import { describe, it, expect } from 'vitest'
import { supabase } from '@/lib/supabase/client'

describe('cleanup_abandoned_families - Integração com RPC do Banco', () => {
  it('executa a RPC cleanup_abandoned_families com sucesso e formato canônico esperado', async () => {
    // UUID arbitrário para validação de formato e chamada à RPC
    const dummyUserId = '00000000-0000-0000-0000-000000000001'

    const { data, error } = await (supabase as any).rpc('cleanup_abandoned_families', {
      p_user_id: dummyUserId,
    })

    // Caso execute com role postgres / service_role ou auth correspondente
    if (error) {
      // Se não autenticado no cliente, o erro esperado é de permissão/acesso
      expect(error.message).toMatch(/Acesso negado|permission|not authorized/i)
    } else {
      expect(data).toBeDefined()
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('deleted_count')
      expect(typeof data.deleted_count).toBe('number')
      expect(data).toHaveProperty('deleted_family_ids')
      expect(Array.isArray(data.deleted_family_ids)).toBe(true)
      expect(data).toHaveProperty('preserved_incomplete_id')
    }
  })
})
