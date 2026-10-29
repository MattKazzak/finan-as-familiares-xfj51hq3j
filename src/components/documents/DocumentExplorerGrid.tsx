import React, { useState, useEffect } from 'react'
import { Plus, Loader2, FolderOpen, Camera, Upload, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FamilyDocument, fetchFamilyDocuments } from '@/services/family-documents'
import { DocumentItemCard } from './DocumentItemCard'
import { AddDocumentModal } from './AddDocumentModal'
import { DocumentViewerModal } from './DocumentViewerModal'
import { ShareDocumentDialog } from './ShareDocumentDialog'
import { DeleteDocumentConfirmDialog } from './DeleteDocumentConfirmDialog'

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
  const [shareDoc, setShareDoc] = useState<FamilyDocument | null>(null)
  const [deleteDoc, setDeleteDoc] = useState<FamilyDocument | null>(null)

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
    <div className="w-full bg-white rounded-3xl border border-[rgba(20,33,61,0.06)] shadow-sm p-4 sm:p-6 space-y-4 sm:space-y-5">
      {/* Barra superior estilo explorador: Título limpo + Botão "Adicionar" bem visível no topo */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-[#14213D] tracking-tight">
              Documentos
            </h3>
            {documents.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {documents.length}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#64748B] truncate mt-0.5">Cofre de arquivos da família</p>
        </div>

        {/* Botão Adicionar destacado no topo */}
        <Button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="h-10 px-4 bg-[#14213D] hover:bg-[#1f3159] text-white rounded-2xl text-xs sm:text-sm font-semibold shrink-0 gap-2 shadow-xs transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4 text-[#FCA311]" />
          <span>Adicionar</span>
        </Button>
      </div>

      {/* Grade de Documentos estilo explorador */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2.5">
          <Loader2 className="w-6 h-6 animate-spin text-[#FCA311]" />
          <p className="text-xs font-medium">Carregando documentos...</p>
        </div>
      ) : documents.length === 0 ? (
        /* Estado vazio limpo */
        <div className="py-12 px-4 text-center rounded-2xl bg-[#F8F9FB] border border-dashed border-slate-200 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-[#FCA311] flex items-center justify-center mx-auto shadow-xs">
            <FolderOpen className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#14213D]">
              Nenhum documento adicionado ainda
            </p>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto leading-relaxed">
              Tire uma foto na hora, importe um PDF ou escaneie RG, CNH, comprovantes e certidões.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="text-xs font-semibold bg-[#14213D] text-white hover:bg-[#1f3159] rounded-xl h-9 px-4 gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#FCA311]" />
            Adicionar Primeiro Documento
          </Button>
        </div>
      ) : (
        /* Matriz de documentos: 2 colunas em telas pequenas (360-412px), 3 em sm, 4 em md+ sem overflow */
        <div
          data-testid="documents-grid"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 w-full"
        >
          {documents.map((doc) => (
            <DocumentItemCard
              key={doc.id}
              document={doc}
              currentUserId={currentUserId}
              onOpenViewer={(d) => setViewerDoc(d)}
              onShare={(d) => setShareDoc(d)}
              onRequestDelete={(d) => setDeleteDoc(d)}
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

      {/* Diálogo Rápido de Compartilhamento Temporário (15m, 1h, 24h) */}
      <ShareDocumentDialog
        open={Boolean(shareDoc)}
        onOpenChange={(open) => {
          if (!open) setShareDoc(null)
        }}
        document={shareDoc}
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
