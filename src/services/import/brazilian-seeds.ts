/**
 * Reexporta os utilitários do Seed Brasileiro para consumo pelo frontend Vite/React.
 */
export {
  BRAZILIAN_MERCHANT_SEEDS,
  matchMerchantSeed,
  normalizeMerchantString,
  resolveCategoryForIntent,
  resolveBrazilianMerchantSeed,
  type SemanticIntent,
  type SeedMerchantEntry,
  type GenericCategoryInput,
  type SeedResolvedCategoryResult,
} from '../../../supabase/functions/_shared/brazilian-seeds'
