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
import { Share2, ShieldCheck, Check, Loader2, Copy, Trash2 } from 'lucide-react'
import {
  FamilyDocument,
  ShareDurationOption,
  SHARE_DURATION_CONFIG,
  createDocumentTemporaryShare,
  fetchDocumentActiveShares,
  revokeDocumentShare,
  FamilyDocumentShare,
} from '@/services/family-documents'
import { toast } from '@/hooks/use-toast'

interface ShareDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: FamilyDocument | null
}

export const ShareDocumentDialog: React.FC<ShareDocumentDialogProps> = ({
  open,
  onOpenChange,
  document: doc,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<ShareDurationOption>('1h')
  const [generatingShare, setGeneratingShare] = useState<boolean>(false)
  const [activeShares, setActiveShares] = useState<FamilyDocumentShare[]>([])
  const [copiedShareUrl, setCopiedShareUrl] = useState<string | null>(null)

  React.useEffect(() => {
    if (open && doc) {
      fetchDocumentActiveShares(doc.id)
        .then(setActiveShares)
        .catch(() => setActiveShares([]))
    } else {
      setCopiedShareUrl(null)
    }
  }, [open, doc])

  if (!doc) return null

  const handleCreateShare = async () => {
    try {
      setGeneratingShare(true)
      const { share, publicUrl } = await createDocumentTemporaryShare(doc, selectedDuration)
      setActiveShares((prev) => [share, ...prev])
      await navigator.clipboard.writeText(publicUrl)
      setCopiedShareUrl(publicUrl)
      toast({
        title: 'Link temporário copiado! 🔗',
        description: `Válido por ${SHARE_DURATION_CONFIG[selectedDuration].label.toLowerCase()}. Pronto para enviar.`,
      })
      setTimeout(() => setCopiedShareUrl(null), 3000)
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar link',
        description: err.message || 'Não foi possível gerar link temporário.',
        variant: 'destructive',
      })
    } finally {
      setGeneratingShare(false)
    }
  }

  const handleRevokeShare = async (shareId: string) => {
    try {
      await revokeDocumentShare(shareId)
      setActiveShares((prev) => prev.filter((s) => s.id !== shareId))
      toast({
        title: 'Link revogado',
        description: 'O link foi cancelado e não é mais acessível.',
      })
    } catch {
      toast({
        title: 'Erro ao revogar',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[92vw] rounded-3xl p-5 sm:p-6 bg-white">
        <DialogHeader className="text-left space-y-1">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mb-1">
            <Share2 className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-semibold text-ink leading-tight">
            Compartilhar Documento
          </DialogTitle>
          <DialogDescription className="text-xs text-body2">
            Gere um link temporário seguro para &quot;{doc.title}&quot;. O link abre sem login
            apenas enquanto estiver no prazo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Seletor de tempo */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink">Validade do link</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['15m', '1h', '24h'] as ShareDurationOption[]).map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setSelectedDuration(dur)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                    selectedDuration === dur
                      ? 'bg-ink text-white border-ink'
                      : 'bg-bg text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {dur === '15m' ? '15 min' : dur === '1h' ? '1 hora' : '24 horas'}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleCreateShare}
            disabled={generatingShare}
            className="w-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 gap-1.5 shadow-xs"
          >
            {generatingShare ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : copiedShareUrl ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            {copiedShareUrl
              ? 'Link Copiado para Área de Transferência!'
              : 'Gerar e Copiar Link Seguro'}
          </Button>

          {/* Links ativos */}
          {activeShares.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                Links ativos ({activeShares.length}):
              </span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {activeShares.map((share) => {
                  const shareUrl = `${window.location.origin}/doc/${share.token}`
                  const isExpired = new Date(share.expires_at) < new Date()
                  if (isExpired) return null

                  return (
                    <div
                      key={share.id}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-[11px]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[10px] text-slate-700 truncate">
                          .../doc/{share.token.slice(0, 10)}...
                        </p>
                        <p className="text-[10px] text-body2">
                          Expira{' '}
                          {new Date(share.expires_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          • {share.view_count} visualizações
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(shareUrl)
                            toast({ title: 'Link copiado!' })
                          }}
                          className="p-1 rounded-lg text-slate-600 hover:bg-slate-200"
                          title="Copiar link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevokeShare(share.id)}
                          className="p-1 rounded-lg text-rose-600 hover:bg-rose-100"
                          title="Revogar agora"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full text-xs rounded-xl h-9 border-slate-200 text-slate-700"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
