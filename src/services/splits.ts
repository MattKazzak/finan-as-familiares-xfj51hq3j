// Serviço de rateio (splits) e acerto de contas entre membros
import { supabase } from '@/lib/supabase/client'
import type { FamilyMember } from '@/types/finance'

export interface TransactionSplit {
  id: string
  transaction_id: string
  family_id: string
  member_id: string
  share_cents: number
  created_by: string | null
  created_at: string
}

export interface SettlementRow {
  member_id: string
  member_name: string
  paid_cents: number
  consumed_cents: number
  balance_cents: number
}

/** Cria uma transação com rateio em uma chamada (RPC transacional no servidor). */
export async function createTransactionWithSplits(params: {
  familyId: string
  payerMemberId: string
  categoryId: string
  type: 'income' | 'expense'
  amountCents: number
  description: string
  transactionDate: string
  splits: Array<{ member_id: string; share_cents: number }>
  subcategoryId?: string | null
  paymentMethod?: string | null
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc('create_transaction_with_splits', {
    p_family_id: params.familyId,
    p_member_id: params.payerMemberId,
    p_category_id: params.categoryId,
    p_type: params.type,
    p_amount_cents: params.amountCents,
    p_description: params.description,
    p_transaction_date: params.transactionDate,
    p_splits: JSON.stringify(params.splits),
    p_subcategory_id: params.subcategoryId ?? null,
    p_payment_method: params.paymentMethod ?? null,
  })
  if (error) throw error
  return data as string
}

/** Busca os splits de um conjunto de transações (para badges no extrato). */
export async function fetchSplitsByTransactionIds(
  transactionIds: string[],
): Promise<TransactionSplit[]> {
  if (transactionIds.length === 0) return []
  const { data, error } = await (supabase as any)
    .from('transaction_splits')
    .select('*')
    .in('transaction_id', transactionIds)
  if (error) throw error
  return (data || []) as TransactionSplit[]
}

/** Acerto de contas do mês: quanto cada membro pagou vs consumiu. */
export async function fetchFamilySettlement(
  familyId: string,
  month: string,
): Promise<SettlementRow[]> {
  const { data, error } = await (supabase as any).rpc('get_family_settlement', {
    p_family_id: familyId,
    p_month: month,
  })
  if (error) throw error
  return (data || []) as SettlementRow[]
}

/** Divide um total em N partes iguais, com a diferença de centavos na primeira parte. */
export function splitEqually(
  totalCents: number,
  memberIds: string[],
): Array<{ member_id: string; share_cents: number }> {
  const n = memberIds.length
  if (n === 0 || totalCents <= 0) return []
  const base = Math.floor(totalCents / n)
  const remainder = totalCents - base * n
  return memberIds.map((member_id, i) => ({
    member_id,
    share_cents: base + (i < remainder ? 1 : 0),
  }))
}

/** Valida se as partes somam o total (usado antes de chamar a RPC). */
export function validateSplits(
  splits: Array<{ member_id: string; share_cents: number }>,
  totalCents: number,
): { ok: boolean; diffCents: number } {
  const sum = splits.reduce((acc, s) => acc + (s.share_cents || 0), 0)
  return { ok: sum === totalCents, diffCents: totalCents - sum }
}

/** Mensagem amigável do acerto de contas: quem deve pra quem. */
export function buildSettlementSummary(rows: SettlementRow[]): string[] {
  const creditors = rows.filter((r) => r.balance_cents > 0)
  const debtors = rows.filter((r) => r.balance_cents < 0)
  const messages: string[] = []

  const debtorQueue = [...debtors]
  for (const creditor of creditors) {
    let remaining = creditor.balance_cents
    for (const debtor of debtorQueue) {
      if (remaining <= 0) break
      const owed = Math.min(remaining, -debtor.balance_cents)
      if (owed > 0) {
        messages.push(
          `${debtor.member_name} deve ${formatCents(owed)} para ${creditor.member_name}`,
        )
        remaining -= owed
        debtor.balance_cents += owed
      }
    }
  }
  return messages.length > 0 ? messages : ['Tudo quitado este mês! 🎉']
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export type { FamilyMember }
