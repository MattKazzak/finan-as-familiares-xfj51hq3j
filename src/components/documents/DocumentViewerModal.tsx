import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  FileText,
  Share2,
  Trash2,
  Edit2,
  Clock,
  Eye,
  Lock,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Calendar,
} from 'lucide-react'
import {
  FamilyDocument,
  DocumentCategory,
  getDocumentSignedUrl,
  updateFamilyDocument,
  deleteFamilyDocument,
  createDocumentTemporaryShare,
  ShareDurationOption,
  SHARE_DURATION_CONFIG,
  fetchDocumentActiveShares,
  revokeDocumentShare,
  FamilyDocumentShare,
  getDocumentExpirationStatus,
  formatDocumentSize,
  formatDocumentSubtitle,
  triggerLocalDocumentBackup,
  shareDocumentFileOrLink,
} from '@/services/family-documents'
import { toast } from '@/hooks/use-toast'

interface DocumentViewerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: FamilyDocument | null
  currentUserId: string
  onUpdated: (updatedDoc: FamilyDocument) => void
  onDeleted: (docId: string) => void
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  open,
  onOpenChange,
  document,
  currentUserId,
  onUpdated,
  onDeleted,
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loadingUrl, setLoadingUrl] = useState<boolean>(true)

  // Modos de edição/compartilhamento
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [editTitle, setEditTitle] = useState<string>('')
  const [editCategory, setEditCategory] = useState<DocumentCategory>('outros')
  const [editShared, setEditShared] = useState<boolean>(true)
  const [savingEdit, setSavingEdit] = useState<boolean>(false)

  // Compartilhamento
  const [isSharingOpen, setIsSharingOpen] = useState<boolean>(false)
  const [selectedDuration, setSelectedDuration] = useState<ShareDurationOption>('1h')
  const [generatingShare, setGeneratingShare] = useState<boolean>(false)
  const [activeShares, setActiveShares] = useState<FamilyDocumentShare[]>([])
  const [copiedShareUrl, setCopiedShareUrl] = useState<string | null>(null)
  const [isDirectSharing, setIsDirectSharing] = useState<boolean>(false)

  // Confirmação de exclusão com backup
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [backingUp, setBackingUp] = useState<boolean>(false)

  useEffect(() => {
    if (!open || !document) {
      setSignedUrl(null)
      setIsEditing(false)
      setIsSharingOpen(false)
      setIsDeleteConfirmOpen(false)
      return
    }

    setEditTitle(document.title)
    setEditCategory(document.category)
    setEditShared(document.is_shared_with_family)

    let isMounted = true
    const loadUrl = async () => {
      try {
        setLoadingUrl(true)
        const url = await getDocumentSignedUrl(document.storage_path, 3600)
        if (isMounted) setSignedUrl(url)
      } catch (err) {
        console.error('Erro ao obter signedUrl:', err)
      } finally {
        if (isMounted) setLoadingUrl(false)
      }
    }

    const loadShares = async () => {
      try {
        const shares = await fetchDocumentActiveShares(document.id)
        if (isMounted) setActiveShares(shares)
      } catch (err) {
        console.error('Erro ao buscar shares:', err)
      }
    }

    loadUrl()
    loadShares()

    return () => {
      isMounted = false
    }
  }, [open, document])

  if (!document) return null

  const isOwner = document.uploaded_by === currentUserId
  const expirationStatus = getDocumentExpirationStatus(document.expires_at)
  const isImage = document.mime_type.startsWith('image/')
  const isPdf = document.mime_type === 'application/pdf'

  const handleSaveEdit = async () => {
    try {
      setSavingEdit(true)
      const updated = await updateFamilyDocument(document.id, {
        title: editTitle.trim(),
        category: editCategory,
        isSharedWithFamily: editShared,
      })
      toast({
        title: 'Documento atualizado! ✏️',
        description: 'Metadados salvos com sucesso.',
      })
      onUpdated(updated)
      setIsEditing(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDirectShare = async () => {
    if (isDirectSharing) return
    setIsDirectSharing(true)
    try {
      const result = await shareDocumentFileOrLink(document, '24h')
      if (result.method === 'clipboard-link') {
        toast({
          title: 'Link copiado para compartilhar 📋',
          description: 'Link válido por 24 horas copiado para a área de transferência.',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Não foi possível compartilhar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsDirectSharing(false)
    }
  }

  const handleCreateShare = async () => {
    try {
      setGeneratingShare(true)
      const { share, publicUrl } = await createDocumentTemporaryShare(document, selectedDuration)
      setActiveShares((prev) => [share, ...prev])
      await navigator.clipboard.writeText(publicUrl)
      setCopiedShareUrl(publicUrl)
      toast({
        title: 'Link temporário copiado! 🔗',
        description: `Válido por ${SHARE_DURATION_CONFIG[selectedDuration].label.toLowerCase()}. Pode ser enviado com segurança.`,
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
        description: 'O link foi cancelado e ninguém mais conseguirá acessar.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao revogar',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleBackupDownload = async () => {
    try {
      setBackingUp(true)
      await triggerLocalDocumentBackup(document.storage_path, document.file_name)
      toast({
        title: 'Backup concluído! 💾',
        description: 'O arquivo foi baixado no seu dispositivo.',
      })
    } catch (err) {
      toast({
        title: 'Erro no backup',
        description: 'Tente abrir o arquivo e salvar manualmente.',
        variant: 'destructive',
      })
    } finally {
      setBackingUp(false)
    }
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await deleteFamilyDocument(document)
      toast({
        title: 'Documento excluído 🗑️',
        description: 'O documento foi removido permanentemente.',
      })
      onDeleted(document.id)
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md w-[92vw] rounded-3xl p-5 sm:p-6 bg-white max-h-[92vh] overflow-y-auto">
          <DialogHeader className="text-left pb-1">
            {expirationStatus.label && (
              <div className="flex items-center justify-end pb-1">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    expirationStatus.isExpired
                      ? 'bg-rose-100 text-expense'
                      : 'bg-amber-100 text-[#B45309]'
                  }`}
                >
                  {expirationStatus.label}
                </span>
              </div>
            )}

            <DialogTitle className="text-base font-semibold text-ink leading-snug break-words">
              {document.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-body2">
              Enviado por {document.uploaded_by_name} •{' '}
              {formatDocumentSubtitle(
                document.mime_type,
                document.file_size_bytes,
                document.file_name,
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Área de Visualização do Arquivo */}
          <div className="relative mt-2 rounded-2xl bg-slate-100 overflow-hidden border border-line flex items-center justify-center min-h-[220px] max-h-[340px]">
            {loadingUrl ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-action" />
                <span className="text-xs">Carregando visualização segura...</span>
              </div>
            ) : signedUrl ? (
              isImage ? (
                <img
                  src={signedUrl}
                  alt={document.title}
                  className="w-full h-full object-contain max-h-[320px]"
                />
              ) : isPdf ? (
                <div className="p-6 flex flex-col items-center justify-center text-center gap-3 w-full">
                  <div className="w-14 h-14 rounded-2xl bg-rose-50 text-expense flex items-center justify-center shadow-xs">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink">{document.file_name}</p>
                    <p className="text-[11px] text-body2 mt-0.5">
                      Documento digital em formato PDF
                    </p>
                  </div>
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ink text-white text-xs font-semibold hover:opacity-90 transition-colors"
                  >
                    <span>Abrir PDF Completo</span>
                    <ExternalLink className="w-3.5 h-3.5 text-action" />
                  </a>
                </div>
              ) : (
                <div className="p-6 flex flex-col items-center justify-center text-center gap-2">
                  <FileText className="w-8 h-8 text-slate-400" />
                  <p className="text-xs text-ink">{document.file_name}</p>
                  <a
                    href={signedUrl}
                    download={document.file_name}
                    className="text-xs font-semibold text-blue-600 underline"
                  >
                    Baixar arquivo
                  </a>
                </div>
              )
            ) : (
              <p className="text-xs text-slate-400">Não foi possível carregar o arquivo.</p>
            )}
          </div>

          {/* Badges de Metadados e Status */}
          <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-bg border border-line flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  document.is_shared_with_family
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {document.is_shared_with_family ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-ink block truncate">
                  {document.is_shared_with_family ? 'Família toda' : 'Apenas você'}
                </span>
                <span className="text-[10px] text-body2">Visibilidade</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-bg border border-line flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-ink block truncate">
                  {document.expires_at
                    ? new Date(`${document.expires_at}T12:00:00`).toLocaleDateString('pt-BR')
                    : 'Sem validade'}
                </span>
                <span className="text-[10px] text-body2">Validade</span>
              </div>
            </div>
          </div>

          {/* Formulário de Edição inline (se aberto) */}
          {isEditing && (
            <div className="p-4 rounded-2xl bg-bg border border-line space-y-3 mt-1">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-ink">Nome do documento</Label>
                <Input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-9 text-xs bg-white"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs text-ink font-medium block">
                    Visível para toda a família
                  </span>
                  <span className="text-[10px] text-body2">Desative para torná-lo privado seu</span>
                </div>
                <Switch checked={editShared} onCheckedChange={setEditShared} />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="text-xs h-8"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editTitle.trim()}
                  className="text-xs bg-ink text-white hover:opacity-90 h-8 rounded-xl"
                >
                  {savingEdit && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}

          {/* Painel de Compartilhamento Temporário (se aberto) */}
          {isSharingOpen && (
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70 space-y-3 mt-1">
              <div className="flex items-center gap-2 text-amber-950">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs font-semibold">Link Temporário Seguro</p>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Gere um link com expiração curta para enviar a banco, escola ou terceiro. O link
                abre sem login apenas enquanto estiver no prazo.
              </p>

              {/* Seletor de tempo */}
              <div className="flex items-center gap-1.5">
                {(['15m', '1h', '24h'] as ShareDurationOption[]).map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setSelectedDuration(dur)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                      selectedDuration === dur
                        ? 'bg-ink text-white border-ink'
                        : 'bg-white text-slate-700 border-amber-200 hover:bg-slate-50'
                    }`}
                  >
                    {dur === '15m' ? '15 min' : dur === '1h' ? '1 hora' : '24 horas'}
                  </button>
                ))}
              </div>

              <Button
                type="button"
                onClick={handleCreateShare}
                disabled={generatingShare}
                className="w-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 gap-1.5 shadow-xs"
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

              {/* Links ativos gerados */}
              {activeShares.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-amber-200/60">
                  <span className="text-[10px] font-bold text-amber-900 uppercase">
                    Links ativos ({activeShares.length}):
                  </span>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {activeShares.map((share) => {
                      const shareUrl = `${window.location.origin}/doc/${share.token}`
                      const isExpired = new Date(share.expires_at) < new Date()
                      if (isExpired) return null

                      return (
                        <div
                          key={share.id}
                          className="p-2 rounded-xl bg-white border border-amber-200/80 flex items-center justify-between gap-2 text-[11px]"
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
                              className="p-1 rounded-lg text-slate-600 hover:bg-slate-100"
                              title="Copiar link"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeShare(share.id)}
                              className="p-1 rounded-lg text-rose-600 hover:bg-rose-50"
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
          )}

          {/* Barra de Ações Principais */}
          <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100">
            {/* Compartilhar direto (folha nativa ou link copiado) */}
            <button
              type="button"
              onClick={handleDirectShare}
              disabled={isDirectSharing}
              className="flex flex-col items-center justify-center p-2 rounded-xl border bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 text-center transition-colors cursor-pointer"
              title="Compartilhar arquivo ou link"
            >
              {isDirectSharing ? (
                <Loader2 className="w-4 h-4 mb-1 animate-spin text-amber-700" />
              ) : (
                <Share2 className="w-4 h-4 mb-1" />
              )}
              <span className="text-[10px] font-semibold leading-tight">Compartilhar</span>
            </button>

            {/* Alternar / Editar */}
            <button
              type="button"
              onClick={() => {
                setIsEditing(!isEditing)
                setIsSharingOpen(false)
              }}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-colors ${
                isEditing
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-bg text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Edit2 className="w-4 h-4 mb-1" />
              <span className="text-[10px] font-semibold leading-tight">Editar</span>
            </button>

            {/* Baixar Backup local */}
            <button
              type="button"
              onClick={handleBackupDownload}
              disabled={backingUp}
              className="flex flex-col items-center justify-center p-2 rounded-xl border bg-bg text-slate-700 border-slate-200 hover:bg-slate-100 text-center transition-colors"
            >
              {backingUp ? (
                <Loader2 className="w-4 h-4 mb-1 animate-spin text-ink" />
              ) : (
                <Download className="w-4 h-4 mb-1" />
              )}
              <span className="text-[10px] font-semibold leading-tight">Baixar</span>
            </button>

            {/* Excluir (com confirmação e aviso de backup) */}
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="flex flex-col items-center justify-center p-2 rounded-xl border bg-rose-50 text-expense border-rose-200 hover:bg-rose-100 text-center transition-colors"
            >
              <Trash2 className="w-4 h-4 mb-1" />
              <span className="text-[10px] font-semibold leading-tight">Excluir</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão (com recomendação de Backup) */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-xs w-[90vw] rounded-3xl p-5 bg-white">
          <DialogHeader className="text-left">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-expense flex items-center justify-center mb-1">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-semibold text-ink">
              Excluir Documento?
            </DialogTitle>
            <DialogDescription className="text-xs text-body2">
              Esta ação apaga o documento da pasta familiar de forma permanente.
            </DialogDescription>
          </DialogHeader>

          {/* Recomendação de backup antes de apagar */}
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-950 space-y-1.5">
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
              className="w-full text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-xl h-10"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Sim, Excluir Documento
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={deleting}
              className="w-full text-xs text-body2 hover:text-ink rounded-xl h-9"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
