import { describe, it, expect } from 'vitest'
import {
  findReconciliationMatch,
  getDaysDifference,
  isEligibleManualTransaction,
  calculateDescriptionSimilarity,
  type BankStatementCandidate,
} from '../reconciliation'
import type { Transaction } from '@/types/finance'

describe('Smart Reconciliation (Conciliação Inteligente)', () => {
  describe('getDaysDifference', () => {
    it('calcula a diferença exata em dias corridos', () => {
      expect(getDaysDifference('2026-03-15', '2026-03-15')).toBe(0)
      expect(getDaysDifference('2026-03-17', '2026-03-15')).toBe(2)
      expect(getDaysDifference('2026-03-12', '2026-03-15')).toBe(-3)
      expect(getDaysDifference('2026-04-01', '2026-03-31')).toBe(1)
    })
  })

  describe('isEligibleManualTransaction', () => {
    it('retorna true para transação sem bank_transaction_id e não projetada', () => {
      const tx: Partial<Transaction> = {
        id: 'tx-1',
        status: 'confirmed',
        bank_transaction_id: null,
      }
      expect(isEligibleManualTransaction(tx as Transaction)).toBe(true)
    })

    it('retorna false para transação projetada', () => {
      const tx: Partial<Transaction> = {
        id: 'tx-1',
        status: 'projected',
        bank_transaction_id: null,
      }
      expect(isEligibleManualTransaction(tx as Transaction)).toBe(false)
    })

    it('retorna false para transação que já possui bank_transaction_id', () => {
      const tx: Partial<Transaction> = {
        id: 'tx-1',
        status: 'confirmed',
        bank_transaction_id: 'FITID-999',
      }
      expect(isEligibleManualTransaction(tx as Transaction)).toBe(false)
    })
  })

  describe('calculateDescriptionSimilarity', () => {
    it('mede similaridade entre descrições semelhantes', () => {
      const sim = calculateDescriptionSimilarity('Padaria do Bairro', 'PADARIA DO BAIRRO SP')
      expect(sim).toBeGreaterThanOrEqual(0.7)
    })

    it('retorna 0 para descrições totalmente desconexas', () => {
      const sim = calculateDescriptionSimilarity('Farmácia Raia', 'Posto Shell')
      expect(sim).toBe(0)
    })
  })

  describe('findReconciliationMatch', () => {
    const mockManualTxs: Transaction[] = [
      {
        id: 'manual-1',
        family_id: 'fam-1',
        member_id: 'user-1',
        category_id: 'cat-alimentacao',
        subcategory_id: 'sub-mercado',
        amount_cents: 15450, // R$ 154,50
        type: 'expense',
        transaction_date: '2026-03-15',
        description: 'Supermercado Pão de Açúcar',
        is_installment: false,
        status: 'confirmed',
        bank_transaction_id: null,
        created_at: '2026-03-15T10:00:00Z',
      },
      {
        id: 'manual-2',
        family_id: 'fam-1',
        member_id: 'user-1',
        category_id: 'cat-lazer',
        amount_cents: 8000, // R$ 80,00
        type: 'expense',
        transaction_date: '2026-03-10',
        description: 'Cinema UCI',
        is_installment: false,
        status: 'confirmed',
        bank_transaction_id: null,
        created_at: '2026-03-10T15:00:00Z',
      },
      {
        id: 'manual-already-linked',
        family_id: 'fam-1',
        member_id: 'user-1',
        category_id: 'cat-transporte',
        amount_cents: 5000,
        type: 'expense',
        transaction_date: '2026-03-15',
        description: 'Uber',
        is_installment: false,
        status: 'confirmed',
        bank_transaction_id: 'FITID-EXISTING',
        created_at: '2026-03-15T12:00:00Z',
      },
    ]

    it('encontra correspondência única (single_match) para despesa manual no dia 15 e extrato no dia 17 com mesmo valor', () => {
      const statementItem: BankStatementCandidate = {
        id: 'stmt-1',
        date: '2026-03-17', // +2 dias (dentro de ±3)
        amount_cents: 15450,
        type: 'expense',
        description: 'COMPRA CARTAO PAO DE ACUCAR SP',
        fitid: 'FITID-PA-154',
      }

      const match = findReconciliationMatch(statementItem, mockManualTxs, new Set(), 3)

      expect(match.status).toBe('single_match')
      expect(match.suggestAutoMerge).toBe(true)
      expect(match.matchedTransaction).not.toBeNull()
      expect(match.matchedTransaction?.id).toBe('manual-1')
      expect(match.matchedTransaction?.category_id).toBe('cat-alimentacao')
      expect(match.matchedTransaction?.subcategory_id).toBe('sub-mercado')
    })

    it('não casa se o valor for diferente', () => {
      const statementItem: BankStatementCandidate = {
        id: 'stmt-2',
        date: '2026-03-15',
        amount_cents: 15451, // 1 centavo de diferença
        type: 'expense',
        description: 'Supermercado Pão de Açúcar',
      }

      const match = findReconciliationMatch(statementItem, mockManualTxs, new Set(), 3)
      expect(match.status).toBe('unmatched')
      expect(match.matchedTransaction).toBeNull()
    })

    it('não casa se a data estiver fora da janela de ±3 dias corridos (ex: dia 19 vs dia 15 = 4 dias)', () => {
      const statementItem: BankStatementCandidate = {
        id: 'stmt-3',
        date: '2026-03-19', // 4 dias de diferença
        amount_cents: 15450,
        type: 'expense',
        description: 'Supermercado Pão de Açúcar',
      }

      const match = findReconciliationMatch(statementItem, mockManualTxs, new Set(), 3)
      expect(match.status).toBe('unmatched')
      expect(match.matchedTransaction).toBeNull()
    })

    it('não casa se o tipo for diferente (despesa vs receita)', () => {
      const statementItem: BankStatementCandidate = {
        id: 'stmt-4',
        date: '2026-03-15',
        amount_cents: 15450,
        type: 'income', // receita
        description: 'Reembolso Pão de Açúcar',
      }

      const match = findReconciliationMatch(statementItem, mockManualTxs, new Set(), 3)
      expect(match.status).toBe('unmatched')
      expect(match.matchedTransaction).toBeNull()
    })

    it('ignora transação manual que já possui bank_transaction_id vinculado', () => {
      const statementItem: BankStatementCandidate = {
        id: 'stmt-5',
        date: '2026-03-15',
        amount_cents: 5000,
        type: 'expense',
        description: 'UBER TRIP 123',
      }

      const match = findReconciliationMatch(statementItem, mockManualTxs, new Set(), 3)
      expect(match.status).toBe('unmatched')
    })

    it('detecta múltiplas candidatas e NÃO mescla automaticamente (multiple_candidates)', () => {
      const poolWithDuplicates: Transaction[] = [
        ...mockManualTxs,
        {
          id: 'manual-3-almoço',
          family_id: 'fam-1',
          member_id: 'user-1',
          category_id: 'cat-refeicao',
          amount_cents: 15450, // mesmo valor da manual-1
          type: 'expense',
          transaction_date: '2026-03-16', // também dentro de ±3 dias
          description: 'Restaurante Família',
          is_installment: false,
          status: 'confirmed',
          bank_transaction_id: null,
          created_at: '2026-03-16T12:00:00Z',
        },
      ]

      const statementItem: BankStatementCandidate = {
        id: 'stmt-multi',
        date: '2026-03-16',
        amount_cents: 15450,
        type: 'expense',
        description: 'COMPRA CARTAO INDEFINIDA',
      }

      const match = findReconciliationMatch(statementItem, poolWithDuplicates, new Set(), 3)

      expect(match.status).toBe('multiple_candidates')
      expect(match.suggestAutoMerge).toBe(false)
      expect(match.matchedTransaction).toBeNull()
      expect(match.candidateTransactions.length).toBe(2)
      expect(match.candidateTransactions.map((c) => c.id)).toContain('manual-1')
      expect(match.candidateTransactions.map((c) => c.id)).toContain('manual-3-almoço')
    })

    it('não permite que dois itens do extrato reivindiquem a mesma transação manual (alreadyClaimedManualIds)', () => {
      const statementItem1: BankStatementCandidate = {
        id: 'stmt-first',
        date: '2026-03-15',
        amount_cents: 15450,
        type: 'expense',
        description: 'Pão de açúcar loja 1',
      }

      const claimed = new Set<string>()
      const match1 = findReconciliationMatch(statementItem1, mockManualTxs, claimed, 3)
      expect(match1.status).toBe('single_match')
      expect(match1.matchedTransaction?.id).toBe('manual-1')

      // Registra que a manual-1 foi reivindicada
      claimed.add(match1.matchedTransaction!.id)

      const statementItem2: BankStatementCandidate = {
        id: 'stmt-second',
        date: '2026-03-16',
        amount_cents: 15450,
        type: 'expense',
        description: 'Pão de açúcar loja 2',
      }

      const match2 = findReconciliationMatch(statementItem2, mockManualTxs, claimed, 3)
      // Como a única candidata já foi alocada, agora fica unmatched
      expect(match2.status).toBe('unmatched')
      expect(match2.matchedTransaction).toBeNull()
    })
  })
})
