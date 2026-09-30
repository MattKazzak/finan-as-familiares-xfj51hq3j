import { describe, it, expect } from 'vitest'
import {
  getMerchantSignature,
  areTransactionsSimilar,
  findSimilarReviewItems,
} from '../similar-matcher'
import type { ReviewItem } from '@/components/transactions/ImportStatementDialog'

describe('similar-matcher', () => {
  it('extrai assinatura correta de estabelecimentos comuns', () => {
    expect(getMerchantSignature('IFOOD *RESTAURANTE DA VILA')).toBe('IFOOD')
    expect(getMerchantSignature('UBER *TRIP SAO PAULO')).toBe('UBER')
    expect(getMerchantSignature('DROGASIL SAO PAULO')).toBe('DROGASIL')
    expect(getMerchantSignature('PAG*PADARIA SAO PEDRO')).toBe('PAG')
  })

  it('detecta se dois lançamentos são similares', () => {
    expect(areTransactionsSimilar('IFOOD *RESTAURANTE 1', 'IFOOD *LANCHES DA HORA')).toBe(true)

    expect(areTransactionsSimilar('UBER *TRIP 1234', 'UBER *EATS 9876')).toBe(true)

    expect(areTransactionsSimilar('DROGASIL 01', 'DROGASIL 02')).toBe(true)

    expect(areTransactionsSimilar('IFOOD *BURGER', 'POSTO SHELL')).toBe(false)
  })

  it('encontra lançamentos semelhantes em uma lista de revisão', () => {
    const baseItem: ReviewItem = {
      id: 'item-1',
      date: '2025-02-10',
      description: 'IFOOD *BURGER KING',
      amount_cents: 4500,
      type: 'expense',
      selected: true,
      category_id: 'cat-alimentacao',
      member_id: 'mem-1',
      isDuplicate: false,
    }

    const items: ReviewItem[] = [
      baseItem,
      {
        id: 'item-2',
        date: '2025-02-11',
        description: 'IFOOD *PIZZARIA BELLA',
        amount_cents: 6200,
        type: 'expense',
        selected: true,
        category_id: null,
        member_id: 'mem-1',
        isDuplicate: false,
      },
      {
        id: 'item-3',
        date: '2025-02-12',
        description: 'POSTO IPIRANGA',
        amount_cents: 12000,
        type: 'expense',
        selected: true,
        category_id: null,
        member_id: 'mem-1',
        isDuplicate: false,
      },
      {
        id: 'item-4',
        date: '2025-02-13',
        description: 'IFOOD *SUSHI BAR',
        amount_cents: 8900,
        type: 'expense',
        selected: true,
        category_id: null,
        member_id: 'mem-1',
        isDuplicate: false,
      },
    ]

    const similar = findSimilarReviewItems(baseItem, items)
    expect(similar.length).toBe(2)
    expect(similar.map((s) => s.id)).toEqual(['item-2', 'item-4'])
  })
})
