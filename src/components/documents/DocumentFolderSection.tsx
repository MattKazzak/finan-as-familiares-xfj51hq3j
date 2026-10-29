import React, { useState, useEffect, useMemo } from 'react'
import {
  Folder,
  Plus,
  ChevronRight,
  Shield,
  FileText,
  Clock,
  Eye,
  Lock,
  Search,
  AlertCircle,
  Loader2,
  UserCheck,
  Users,
  Home,
  HeartPulse,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  FamilyDocument,
  fetchFamilyDocuments,
  getDocumentExpirationStatus,
  formatDocumentSize,
} from '@/services/family-documents'
import { AddDocumentModal } from './AddDocumentModal'
import { DocumentViewerModal } from './DocumentViewerModal'

interface DocumentFolderSectionProps {
  familyId: string
  currentUserId: string
  currentUserName: string
  isOpen: boolean
  onToggle: () => void
}

const CATEGORY_ICON_MAP: Record<DocumentCategory, React.ElementType> = {
  identidade: UserCheck,
  familia: Users,
  residencia: Home,
  saude: HeartPulse,
  outros: Folder,
}

export const DocumentFolderSection: React.FC<DocumentFolderSectionProps> = ({
  familyId,
  currentUserId,
  currentUserName,
  isOpen,
  onToggle,
}) => {
  const [documents, setDocuments] = useState<FamilyDocument[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedFolder, setSelectedFolder] = useState<DocumentCategory | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Modais
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false)
  const [addDefaultCategory, setAddDefaultCategory] = useState<DocumentCategory>('identidade')
  const [selectedDoc, setSelectedDoc] = useState<FamilyDocument | null>(null)

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

  // Contagem por pasta
  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = { all: documents.length }
    DOCUMENT_CATEGORIES.forEach((cat) => {
      counts[cat.id] = documents.filter((d) => d.category === cat.id).length
    })
    return counts
  }, [documents])

  // Documentos filtrados
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesFolder = selectedFolder === 'all' || doc.category === selectedFolder
      const matchesSearch =
        !searchTerm.trim() ||
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesFolder && matchesSearch
    })
  }, [documents, selectedFolder, searchTerm])

  // Alerta de documentos próximos de vencer ou vencidos
  const expiringAlertCount = useMemo(() => {
    return documents.filter((d) => {
      const status = getDocumentExpirationStatus(d.expires_at)
      return status.isExpired || status.isExpiringSoon
    }).length
  }, [documents])

  return (
    <section
      className="bg-white/95 rounded-3xl border border-[rgba(20,33,61,0.06)] shadow-elevation-1 overflow-hidden"
      aria-label="Pasta de Documentos"
    >
      {/* Botão acordeão da seção */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-slate-50/60 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-[#FCA311] flex items-center justify-center shrink-0">
          <Folder className="w-5 h-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[#14213D] leading-tight">
              Pasta de Documentos
            </p>
            {documents.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {documents.length}
              </span>
            )}
            {expiringAlertCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-[#B45309]">
                {expiringAlertCount} {expiringAlertCount === 1 ? 'alerta' : 'alertas'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#64748B] truncate mt-0.5">
            RG, CNH, Certidões, Comprovantes e Saúde da família
          </p>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-90' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="px-5 py-4 border-t border-slate-100 space-y-4">
          {/* Banner de Segurança & Privacidade acordado com a usuária */}
          <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/60 flex items-start gap-2.5 text-[11px] text-[#64748B]">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-semibold text-[#14213D] block">Cofre Seguro da Família</span>
              <span>
                Arquivos armazenados em bucket privado e visualizados apenas por URL assinada. Você
                pode compartilhar cópias temporárias com expiração rápida.
              </span>
            </div>
          </div>

          {/* Barra de Ações: Buscar + Botão (+) Adicionar Documento */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Buscar documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-8 pr-3 text-xs bg-[#F8F9FB] rounded-xl border-slate-200"
              />
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                setAddDefaultCategory(selectedFolder === 'all' ? 'identidade' : selectedFolder)
                setIsAddOpen(true)
              }}
              className="h-9 px-3.5 bg-[#14213D] hover:bg-[#1f3159] text-white rounded-xl text-xs font-semibold shrink-0 gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4 text-[#FCA311]" />
              <span>Adicionar</span>
            </Button>
          </div>

          {/* Pastas de Organização (Filtros no topo estilo abas/pastas) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
            <button
              type="button"
              onClick={() => setSelectedFolder('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                selectedFolder === 'all'
                  ? 'bg-[#14213D] text-white shadow-xs'
                  : 'bg-[#F8F9FB] text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Todos ({countsByCategory.all || 0})
            </button>

            {DOCUMENT_CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICON_MAP[cat.id] || Folder
              const isSelected = selectedFolder === cat.id
              const count = countsByCategory[cat.id] || 0
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedFolder(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-[#14213D] text-white shadow-xs'
                      : 'bg-[#F8F9FB] text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${isSelected ? 'text-[#FCA311]' : 'text-slate-400'}`}
                  />
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] ${isSelected ? 'text-slate-200' : 'text-slate-400'}`}
                  >
                    ({count})
                  </span>
                </button>
              )
            })}
          </div>

          {/* Lista de Documentos */}
          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#FCA311]" />
              <p className="text-xs">Carregando documentos...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="py-8 px-4 text-center rounded-2xl bg-[#F8F9FB] border border-dashed border-slate-200 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#FCA311] flex items-center justify-center mx-auto">
                <Folder className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-[#14213D]">
                {searchTerm
                  ? 'Nenhum documento encontrado com esta busca'
                  : 'Nenhum documento nesta pasta ainda'}
              </p>
              <p className="text-[11px] text-[#64748B] max-w-xs mx-auto">
                Adicione tirando uma foto, importando do aparelho ou escaneando com filtro.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAddDefaultCategory(selectedFolder === 'all' ? 'identidade' : selectedFolder)
                  setIsAddOpen(true)
                }}
                className="text-xs font-semibold rounded-xl border-slate-300 text-[#14213D] hover:bg-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1 text-[#FCA311]" />
                Adicionar primeiro documento
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-2xl border border-[rgba(20,33,61,0.06)] bg-white overflow-hidden shadow-xs">
              {filteredDocuments.map((doc) => {
                const Icon = CATEGORY_ICON_MAP[doc.category] || FileText
                const expiration = getDocumentExpirationStatus(doc.expires_at)
                const isOwner = doc.uploaded_by === currentUserId

                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDoc(doc)}
                    className="w-full flex items-center justify-between gap-3 p-3.5 text-left hover:bg-slate-50/70 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Ícone de categoria */}
                      <div className="w-10 h-10 rounded-xl bg-[#F8F9FB] text-[#14213D] flex items-center justify-center shrink-0 border border-slate-100 group-hover:border-slate-200 transition-colors">
                        <Icon className="w-5 h-5 text-slate-700" />
                      </div>

                      {/* Nome, pasta e tamanho */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-semibold text-[#14213D] truncate leading-tight">
                            {doc.title}
                          </p>

                          {/* Badge de visibilidade */}
                          {!doc.is_shared_with_family && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              <Lock className="w-2.5 h-2.5" />
                              Privado
                            </span>
                          )}

                          {/* Badge de vencimento */}
                          {expiration.label && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                expiration.isExpired
                                  ? 'bg-rose-100 text-[#E11D48]'
                                  : 'bg-amber-100 text-[#B45309]'
                              }`}
                            >
                              {expiration.label}
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-[#64748B] truncate mt-0.5">
                          {DOCUMENT_CATEGORIES.find((c) => c.id === doc.category)?.label} •{' '}
                          {formatDocumentSize(doc.file_size_bytes)} • por {doc.uploaded_by_name}
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Adicionar Documento */}
      <AddDocumentModal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        familyId={familyId}
        uploadedByName={currentUserName}
        defaultCategory={addDefaultCategory}
        onSuccess={(newDoc) => {
          setDocuments((prev) => [newDoc, ...prev])
        }}
      />

      {/* Modal Visualizador / Ações do Documento */}
      <DocumentViewerModal
        open={Boolean(selectedDoc)}
        onOpenChange={(open) => {
          if (!open) setSelectedDoc(null)
        }}
        document={selectedDoc}
        currentUserId={currentUserId}
        onUpdated={(updatedDoc) => {
          setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)))
          setSelectedDoc(updatedDoc)
        }}
        onDeleted={(deletedId) => {
          setDocuments((prev) => prev.filter((d) => d.id !== deletedId))
          setSelectedDoc(null)
        }}
      />
    </section>
  )
}
