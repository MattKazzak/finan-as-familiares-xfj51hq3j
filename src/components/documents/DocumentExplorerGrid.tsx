import React, { useState, useEffect } from 'react'
import { Plus, Loader2, FolderOpen, Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  FamilyDocument,
  fetchFamilyDocuments,
  shareDocumentFileOrLink,
  shareMultipleDocuments,
  MAX_MULTI_SHARE_BYTES,
} from '@/services/family-documents'
import { DocumentItemCard } from './DocumentItemCard'
import { AddDocumentModal } from './AddDocumentModal'
import { DocumentViewerModal } from './DocumentViewerModal'
import { DeleteDocumentConfirmDialog } from './DeleteDocumentConfirmDialog'
import { toast } from '@/hooks/use-toast'

export interface DocumentExplorerGridProps {
  familyId: string
  currentUserId: string
  currentUserName: string
}

/**
 * Grade simplificada estilo explorador de arquivos (Windows Explorer):
 * - Página limpa e branca com cabeçalho contendo botão Adicionar destacado
 * - Matriz de cartões lado a lado que quebra responsivamente para a linha de baixo (2-3 colunas em 360-412px, 3-4 em telas maiores)
 * - Miniatura da imagem para JPG/PNG, ícone estilizado para PDF
 * - Ações embaixo de cada cartão: visualizar, compartilhar, excluir
 * - Mantém todo o ecossistema existente: 3 formas de captura, cofre seguro, links temporários e exclusão com backup
 */
export const DocumentExplorerGrid: React.FC<DocumentExplorerGridProps> = ({
  familyId,
  currentUserId,
  currentUserName,
}) => {
  const [documents, setDocuments] = useState<FamilyDocument[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Modais de ação
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false)
  const [viewerDoc, setViewerDoc] = useState<FamilyDocument | null>(null)
  const [deleteDoc, setDeleteDoc] = useState<FamilyDocument | null>(null)
  const [sharingDocId, setSharingDocId] = useState<string | null>(null)

  // Estado da seleção múltipla
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false)
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())
  const [isBatchSharing, setIsBatchSharing] = useState<boolean>(false)

  // Funções de seleção
  const handleEnterSelectionMode = (initialDoc?: FamilyDocument) => {
    setIsSelectionMode(true)
    if (initialDoc) {
      setSelectedDocIds(new Set([initialDoc.id]))
    }
  }

  const handleExitSelectionMode = () => {
    setIsSelectionMode(false)
    setSelectedDocIds(new Set())
  }

  const handleToggleSelectDoc = (doc: FamilyDocument) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev)
      if (next.has(doc.id)) {
        next.delete(doc.id)
      } else {
        next.add(doc.id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedDocIds.size === documents.length) {
      // Se já estavam todos selecionados, limpa
      setSelectedDocIds(new Set())
    } else {
      setSelectedDocIds(new Set(documents.map((d) => d.id)))
    }
  }

  // Compartilhamento em lote dos itens selecionados
  const handleBatchShare = async () => {
    if (isBatchSharing) return
    const docsToShare = documents.filter((d) => selectedDocIds.has(d.id))
    if (docsToShare.length === 0) {
      toast({
        title: 'Selecione ao menos um documento',
        description: 'Toque nos documentos que deseja compartilhar.',
      })
      return
    }

    setIsBatchSharing(true)
    try {
      const result = await shareMultipleDocuments(docsToShare, '24h')
      if (result.method === 'clipboard-links') {
        toast({
          title: `${result.count} link${result.count > 1 ? 's' : ''} copiado${result.count > 1 ? 's' : ''} 📋`,
          description: `Links válidos por 24 horas copiados para a área de transferência.`,
        })
      } else if (result.method === 'native-files') {
        toast({
          title: `${result.count} documento${result.count > 1 ? 's' : ''} compartilhado${result.count > 1 ? 's' : ''} 🎉`,
        })
      }
      // Sai do modo de seleção após compartilhar com sucesso
      handleExitSelectionMode()
    } catch (err: any) {
      toast({
        title: 'Não foi possível compartilhar em lote',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsBatchSharing(false)
    }
  }

  const handleShareDocument = async (doc: FamilyDocument) => {
    if (sharingDocId) return
    setSharingDocId(doc.id)
    try {
      const result = await shareDocumentFileOrLink(doc, '24h')
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
      setSharingDocId(null)
    }
  }

  const loadDocuments = async () => {
    if (!familyId) return
    try {
      setLoading(true)
      const data = await fetchFamilyDocuments(familyId)
      setDocuments(data)
    } catch (err) {
      console.error('Erro ao carregar documentos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (familyId) {
      loadDocuments()
    }
  }, [familyId])

  return (
    <div className="w-full bg-white rounded-3xl border border-line shadow-sm p-4 sm:p-6 space-y-4 sm:space-y-5">
      {/* Barra superior normal OU Barra de Ação de Seleção Múltipla */}
      {isSelectionMode ? (
        <div
          data-testid="selection-mode-bar"
          className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 p-3 sm:p-3.5 bg-ink text-white rounded-2xl shadow-md border border-ink"
        >
          {/* Lado esquerdo: Botão fechar + Contador */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleExitSelectionMode}
              className="h-8 w-8 p-0 text-white hover:bg-white/10 rounded-xl"
              title="Cancelar seleção"
              aria-label="Cancelar seleção"
            >
              <X className="w-4 h-4" />
            </Button>
            <div>
              <p className="text-xs sm:text-sm font-bold tracking-tight">
                {selectedDocIds.size} {selectedDocIds.size === 1 ? 'selecionado' : 'selecionados'}
              </p>
              <p className="text-[10px] text-slate-300 hidden sm:block">
                Toque nos cartões para marcar ou desmarcar
              </p>
            </div>
          </div>

          {/* Lado direito: Selecionar tudo + Compartilhar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {documents.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="h-8 px-2.5 text-xs text-slate-200 hover:text-white hover:bg-white/10 rounded-xl font-medium"
              >
                {selectedDocIds.size === documents.length ? 'Desmarcar tudo' : 'Selecionar tudo'}
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleBatchShare}
              disabled={selectedDocIds.size === 0 || isBatchSharing}
              className="h-9 px-3.5 bg-action hover:opacity-90 text-white font-bold text-xs sm:text-sm rounded-xl gap-1.5 shadow-xs transition-transform active:scale-95 disabled:opacity-50"
            >
              {isBatchSharing ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Share2 className="w-4 h-4 text-white" />
              )}
              <span>Compartilhar</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-ink tracking-tight">Documentos</h3>
              {documents.length > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {documents.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-body2 truncate mt-0.5">Cofre de arquivos da família</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Adicionar destacado no topo */}
            <Button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="h-10 px-4 bg-ink hover:opacity-90 text-white rounded-2xl text-xs sm:text-sm font-semibold shrink-0 gap-2 shadow-xs transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4 text-action" />
              <span>Adicionar</span>
            </Button>
          </div>
        </div>
      )}

      {/* Grade de Documentos estilo explorador */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2.5">
          <Loader2 className="w-6 h-6 animate-spin text-action" />
          <p className="text-xs font-medium">Carregando documentos...</p>
        </div>
      ) : documents.length === 0 ? (
        /* Estado vazio limpo */
        <div className="py-12 px-4 text-center rounded-2xl bg-bg border border-dashed border-slate-200 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-action flex items-center justify-center mx-auto shadow-xs">
            <FolderOpen className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">Nenhum documento adicionado ainda</p>
            <p className="text-xs text-body2 max-w-sm mx-auto leading-relaxed">
              Tire uma foto na hora, importe um PDF ou escaneie RG, CNH, comprovantes e certidões.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="text-xs font-semibold bg-ink text-white hover:opacity-90 rounded-xl h-9 px-4 gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-action" />
            Adicionar Primeiro Documento
          </Button>
        </div>
      ) : (
        /* Matriz de documentos: 2 colunas em telas pequenas (360-412px), 3 em sm, 4 em md+ sem overflow */
        <div
          data-testid="documents-grid"
          onContextMenu={(e) => {
            // Suprime contextmenu nativo na área da grade se o clique ocorrer sobre cartões
            const target = e.target as HTMLElement | null
            if (target?.closest('[data-testid^="doc-card-"]')) {
              e.preventDefault()
            }
          }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 w-full"
        >
          {documents.map((doc) => (
            <DocumentItemCard
              key={doc.id}
              document={doc}
              currentUserId={currentUserId}
              isSelectionMode={isSelectionMode}
              isSelected={selectedDocIds.has(doc.id)}
              onOpenViewer={(d) => setViewerDoc(d)}
              onShare={(d) => handleShareDocument(d)}
              onRequestDelete={(d) => setDeleteDoc(d)}
              onToggleSelect={(d) => handleToggleSelectDoc(d)}
              onLongPressSelect={(d) => handleEnterSelectionMode(d)}
            />
          ))}
        </div>
      )}

      {/* Modal Adicionar Documento (3 formas: foto, importar, escanear) */}
      <AddDocumentModal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        familyId={familyId}
        uploadedByName={currentUserName}
        onSuccess={(newDoc) => {
          setDocuments((prev) => [newDoc, ...prev])
        }}
      />

      {/* Modal Visualizador e Edição Completa */}
      <DocumentViewerModal
        open={Boolean(viewerDoc)}
        onOpenChange={(open) => {
          if (!open) setViewerDoc(null)
        }}
        document={viewerDoc}
        currentUserId={currentUserId}
        onUpdated={(updatedDoc) => {
          setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)))
          setViewerDoc(updatedDoc)
        }}
        onDeleted={(deletedId) => {
          setDocuments((prev) => prev.filter((d) => d.id !== deletedId))
          setViewerDoc(null)
        }}
      />

      {/* Diálogo Rápido de Confirmação de Exclusão (com backup antes de apagar) */}
      <DeleteDocumentConfirmDialog
        open={Boolean(deleteDoc)}
        onOpenChange={(open) => {
          if (!open) setDeleteDoc(null)
        }}
        document={deleteDoc}
        onDeleted={(deletedId) => {
          setDocuments((prev) => prev.filter((d) => d.id !== deletedId))
          setDeleteDoc(null)
        }}
      />
    </div>
  )
}
