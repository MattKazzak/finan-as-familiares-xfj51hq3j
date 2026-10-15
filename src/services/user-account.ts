// Serviço da conta do usuário: nome, avatar e exclusão self-service (LGPD)
import { supabase } from '@/lib/supabase/client'

/** Exclui a conta do usuário logado no servidor (RPC transacional). */
export async function deleteUserAccount(): Promise<{
  success: boolean
  families_deleted: number
  families_left: number
}> {
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
