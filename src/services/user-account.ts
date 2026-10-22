// Serviço da conta do usuário: nome, avatar e exclusão self-service (LGPD)
import { supabase } from '@/lib/supabase/client'

/**
 * Exclui a conta do usuário logado no servidor (RPC transacional).
 * FIX C3 (22/10, auditoria da exclusão): ANTES de apagar, cancela a assinatura
 * Asaas no provedor (edge com JWT — a RPC do banco não alcança o Asaas).
 * Sem isso, usuário excluído com assinatura ativa CONTINUARIA sendo cobrado.
 * Falha no cancelamento NÃO bloqueia a exclusão (marca no console; a RPC
 * também deixa a linha local 'canceled' via cascade + webhook).
 */
export async function deleteUserAccount(): Promise<{
  success: boolean
  families_deleted: number
  families_left: number
}> {
  // 1) Cancela assinatura ativa no Asaas (best-effort, antes da conta sumir)
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (token) {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-asaas-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: '{}',
        },
      )
      if (!res.ok && res.status !== 404) {
        console.warn('[deleteAccount] cancelamento Asaas falhou:', res.status)
      }
    }
  } catch (err) {
    console.warn('[deleteAccount] edge de cancelamento indisponível:', err)
  }

  // 2) Exclui a conta (RPC transacional no servidor)
  const { data, error } = await (supabase as any).rpc('delete_user_account')
  if (error) throw error
  return data as { success: boolean; families_deleted: number; families_left: number }
}

/** Atualiza o nome do usuário nos metadados de autenticação. */
export async function updateUserName(name: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: { name: name.trim() } })
  if (error) throw error
}

/** Envia a foto do usuário para o Storage e salva a URL nos metadados. */
export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'png'
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `user-avatars/${fileName}`

  let publicUrl: string | null = null
  const { error: uploadError } = await supabase.storage
    .from('user-avatars')
    .upload(filePath, file, { upsert: true, contentType: file.type })

  if (!uploadError) {
    const { data: publicData } = supabase.storage.from('user-avatars').getPublicUrl(filePath)
    publicUrl = publicData?.publicUrl || null
  }

  // Fallback: se Storage falhar, guarda como Data URL Base64 nos metadados
  let finalUrl = publicUrl
  if (!finalUrl) {
    finalUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result)
        else reject(new Error('Erro ao converter imagem'))
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  const { error: metaError } = await supabase.auth.updateUser({
    data: { avatar_url: finalUrl },
  })
  if (metaError) throw metaError
  return finalUrl
}
