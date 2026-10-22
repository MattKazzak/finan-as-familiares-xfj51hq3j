// REFERRAL — programa "Convide e ganhe dias" (22/10, decisão do Matheus).
// Regra de negócio: +7 dias de trial por convidado que ATIVAR (1ª transação),
// teto de 5 indicações (+35 dias). Convidado entra com o link e ganha o trial
// normal de 7 dias (o bônus de quem indicou é o motor).
// Tudo no servidor (RPCs security definer) — cliente só lê.
import { supabase } from '@/lib/supabase/client'

export interface ReferralSummary {
  code: string | null
  total: number
  activated: number
  bonus_days: number
  cap: number
}

/** Resumo do programa pro Perfil (código, contagens, teto). */
export async function getReferralSummary(): Promise<ReferralSummary> {
  const { data, error } = await (supabase as any).rpc('get_my_referral_summary')
  if (error) throw error
  return {
    code: data?.code ?? null,
    total: Number(data?.total || 0),
    activated: Number(data?.activated || 0),
    bonus_days: Number(data?.bonus_days || 0),
    cap: Number(data?.cap || 5),
  }
}

/** Gera (ou devolve) o código de indicação do usuário. */
export async function getOrCreateReferralCode(): Promise<string> {
  const { data, error } = await (supabase as any).rpc('get_or_create_referral_code')
  if (error) throw error
  return String(data || '')
}

/** Link completo de indicação (compartilhável). */
export async function getReferralLink(): Promise<string> {
  const code = await getOrCreateReferralCode()
  const base = window.location.origin
  return `${base}/?ref=${code}`
}

/** Registra o código do link na sessão do visitante (chamado no 1º load com ?ref=). */
export async function applyReferralCode(code: string): Promise<boolean> {
  try {
    const { data } = await (supabase as any).rpc('apply_referral_code', { p_code: code })
    return Boolean(data?.ok)
  } catch {
    return false
  }
}

/** Mensagem pronta pro WhatsApp (padrão Nubank: texto natural, link no fim). */
export function buildReferralMessage(link: string): string {
  return `Tô usando o Curiango pra organizar as finanças da família — dá pra lançar despesa falando, e ele categoriza sozinho. Entra com meu convite: ${link}`
}
