import React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { TransactionCategory, TransactionSubcategory } from '@/types/finance'

interface DeleteCategoryConfirmDialogProps {
  category: TransactionCategory | null
  usageCount: number
  loadingUsage: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export const DeleteCategoryConfirmDialog: React.FC<DeleteCategoryConfirmDialogProps> = ({
  category,
  usageCount,
  loadingUsage,
  onClose,
  onConfirm,
}) => {
  const [deleting, setDeleting] = React.useState(false)

  const handleConfirm = async () => {
    try {
      setDeleting(true)
      await onConfirm()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const subCount = category?.subcategories?.length || 0

  return (
    <AlertDialog open={Boolean(category)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="rounded-3xl max-w-sm">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <AlertDialogTitle className="text-base font-bold text-ink">
              <span>Excluir categoria?</span>
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="text-xs text-body2 space-y-2">
              <p>
                <span>Tem certeza que deseja excluir a categoria </span>
                <strong className="text-ink">{category?.name}</strong>?
              </p>

              {subCount > 0 ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs">
                  <span>
                    Esta categoria possui{' '}
                    <strong>
                      {subCount} {subCount === 1 ? 'subcategoria' : 'subcategorias'}
                    </strong>{' '}
                    vinculada(s). Todas as suas subcategorias também serão removidas.
                  </span>
                </div>
              ) : null}

              {loadingUsage ? (
                <div className="flex items-center gap-2 text-body3 py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verificando lançamentos associados...</span>
                </div>
              ) : usageCount > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
                  <span>
                    Atenção: existem <strong>{usageCount} lançamentos</strong> vinculados a esta
                    categoria. Eles continuarão registrados no histórico, mas ficarão desassociados
                    (sem categoria).
                  </span>
                </div>
              ) : (
                <p className="text-body3 text-[11px]">
                  <span>Nenhum lançamento está utilizando esta categoria atualmente.</span>
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className="text-xs rounded-xl" disabled={deleting}>
            <span>Cancelar</span>
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={deleting || loadingUsage}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl"
          >
            <span className="flex items-center gap-1.5">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Excluir categoria</span>
            </span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface DeleteSubcategoryConfirmDialogProps {
  subcategory: TransactionSubcategory | null
  parentCategoryName?: string
  usageCount: number
  loadingUsage: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export const DeleteSubcategoryConfirmDialog: React.FC<DeleteSubcategoryConfirmDialogProps> = ({
  subcategory,
  parentCategoryName,
  usageCount,
  loadingUsage,
  onClose,
  onConfirm,
}) => {
  const [deleting, setDeleting] = React.useState(false)

  const handleConfirm = async () => {
    try {
      setDeleting(true)
      await onConfirm()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={Boolean(subcategory)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="rounded-3xl max-w-sm">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <AlertDialogTitle className="text-base font-bold text-ink">
              <span>Excluir subcategoria?</span>
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="text-xs text-body2 space-y-2">
              <p>
                <span>Tem certeza que deseja excluir a subcategoria </span>
                <strong className="text-ink">{subcategory?.name}</strong>
                {parentCategoryName ? (
                  <span>
                    {' '}
                    da categoria <strong className="text-ink">{parentCategoryName}</strong>
                  </span>
                ) : null}
                <span>?</span>
              </p>

              {loadingUsage ? (
                <div className="flex items-center gap-2 text-body3 py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verificando lançamentos associados...</span>
                </div>
              ) : usageCount > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
                  <span>
                    Atenção: existem <strong>{usageCount} lançamentos</strong> vinculados a esta
                    subcategoria. Eles permanecerão na categoria principal, mas com a subcategoria
                    desassociada.
                  </span>
                </div>
              ) : (
                <p className="text-body3 text-[11px]">
                  <span>Nenhum lançamento está utilizando esta subcategoria atualmente.</span>
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className="text-xs rounded-xl" disabled={deleting}>
            <span>Cancelar</span>
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={deleting || loadingUsage}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl"
          >
            <span className="flex items-center gap-1.5">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Excluir subcategoria</span>
            </span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
