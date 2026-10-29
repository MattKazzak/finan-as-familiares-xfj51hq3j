import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Download, Loader2 } from 'lucide-react'
import {
  FamilyDocument,
  deleteFamilyDocument,
  triggerLocalDocumentBackup,
} from '@/services/family-documents'
import { toast } from '@/hooks/use-toast'

interface DeleteDocumentConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: FamilyDocument | null
  onDeleted: (docId: string) => void
}

export const DeleteDocumentConfirmDialog: React.FC<DeleteDocumentConfirmDialogProps> = ({
  open,
  onOpenChange,
  document: doc,
  onDeleted,
}) => {
  const [deleting, setDeleting] = useState<boolean>(false)
  const [backingUp, setBackingUp] = useState<boolean>(false)

  if (!doc) return null

  const handleBackupDownload = async () => {
    try {
      setBackingUp(true)
      await triggerLocalDocumentBackup(doc.storage_path, doc.file_name)
      toast({
        title: 'Backup concluído! 💾',
        description: 'O arquivo foi baixado no seu dispositivo.',
      })
    } catch {
      toast({
        title: 'Erro no backup',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBackingUp(false)
    }
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await deleteFamilyDocument(doc)
      toast({
        title: 'Documento excluído 🗑️',
        description: `"${doc.title}" foi removido com sucesso.`,
      })
      onDeleted(doc.id)
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err.message || 'Não foi possível remover o documento.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs w-[90vw] rounded-3xl p-5 bg-white">
        <DialogHeader className="text-left">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-[#E11D48] flex items-center justify-center mb-1">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-semibold text-[#14213D]">
            Excluir Documento?
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            Esta ação apaga &quot;{doc.title}&quot; permanentemente do cofre da família.
          </DialogDescription>
        </DialogHeader>

        {/* Recomendação de backup antes de apagar */}
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-950 space-y-1.5 mt-1">
          <p className="font-semibold flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-amber-700" />
            Deseja salvar uma cópia antes?
          </p>
          <p className="text-[10px] text-amber-900 leading-tight">
            Recomendamos baixar o arquivo antes de excluir para você não perder este documento.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBackupDownload}
            disabled={backingUp}
            className="w-full text-xs h-8 bg-white border-amber-300 text-amber-900 hover:bg-amber-100 rounded-xl font-medium"
          >
            {backingUp ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Download className="w-3 h-3 mr-1" />
            )}
            Fazer backup agora
          </Button>
        </div>

        <DialogFooter className="flex-col gap-2 pt-2 sm:flex-col">
          <Button
            type="button"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="w-full text-xs font-semibold bg-[#E11D48] text-white hover:bg-rose-700 rounded-xl h-10"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Sim, Excluir Documento
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
            className="w-full text-xs text-[#64748B] hover:text-[#14213D] rounded-xl h-9"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
