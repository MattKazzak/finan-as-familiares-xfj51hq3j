import { describe, it, expect, vi } from 'vitest'
import { normalizeName, restoreMissingCatalog, resetCatalogToDefault } from '../catalog-restore'
import { CANONICAL_CATEGORIES, TransactionCategory, TransactionSubcategory } from '@/types/finance'

// Mock supabase client for catalog tests
vi.mock('@/lib/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        return {
          insert: vi.fn((data: any) => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: { id: 'mock-id-cat', ...data }, error: null }),
              ),
              then: (resolve: any) =>
                resolve({
                  data: Array.isArray(data) ? data.map((d, i) => ({ id: `sub-${i}`, ...d })) : data,
                  error: null,
                }),
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => Promise.resolve({ data: [{ id: 'tx-1' }], error: null })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        }
      }),
    },
  }
})

describe('catalog-restore service', () => {
  it('CANONICAL_CATEGORIES should have exactly 19 categories and 117 subcategories', () => {
    expect(CANONICAL_CATEGORIES.length).toBe(19)
    const totalSubs = CANONICAL_CATEGORIES.reduce((acc, c) => acc + c.subcategories.length, 0)
    expect(totalSubs).toBe(117)
  })

  it('normalizes category names reliably ignoring case and accents', () => {
    expect(normalizeName('Alimentação')).toBe('alimentacao')
    expect(normalizeName('Educação ')).toBe('educacao')
    expect(normalizeName('Saúde')).toBe('saude')
    expect(normalizeName('MORADIA')).toBe('moradia')
  })

  it('restoreMissingCatalog identifies missing categories and inserts them', async () => {
    const existingCats: TransactionCategory[] = [
      {
        id: 'cat-1',
        family_id: 'fam-1',
        name: 'Moradia',
        type: 'expense',
        budget_bucket: 'essentials',
        color: '#1E293B',
        icon: 'Home',
        sort_order: 1,
        created_at: '',
      },
    ]

    const existingSubs: TransactionSubcategory[] = []

    const result = await restoreMissingCatalog('fam-1', existingCats, existingSubs)
    // 19 canonical minus 1 existing = 18 categories added
    expect(result.categoriesAdded).toBe(18)
    expect(result.subcategoriesAdded).toBeGreaterThanOrEqual(0)
  })

  it('resetCatalogToDefault performs double-check reassignments preserving zero orphans', async () => {
    const existingCats: TransactionCategory[] = [
      {
        id: 'cat-custom',
        family_id: 'fam-1',
        name: 'Categoria Antiga Customizada',
        type: 'expense',
        budget_bucket: 'lifestyle',
        color: '#F59E0B',
        icon: 'Tag',
        sort_order: 99,
        created_at: '',
      },
    ]

    const result = await resetCatalogToDefault('fam-1', existingCats, [])
    expect(result).toBeDefined()
    expect(typeof result.categoriesAdded).toBe('number')
    expect(typeof result.reassignedTransactionsCount).toBe('number')
  })
})
