import React, { useState, useEffect, useRef } from 'react'
import {
  FileText,
  FileImage,
  MoreVertical,
  Share2,
  Trash2,
  Eye,
  Download,
  Lock,
  Clock,
  Sparkles,
  Camera,
  Upload,
  Plus,
  Loader2,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react'
import {
  FamilyDocument,
  getDocumentExpirationStatus,
  formatDocumentSubtitle,
  getDocumentSignedUrl,
  shareDocumentFileOrLink,
} from '@/services/family-documents'
import { renderPdfFirstPageThumbnail } from '@/services/pdf-thumbnail'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from '@/hooks/use-toast'

interface DocumentItemCardProps {
  document: FamilyDocument
  currentUserId: string
  onOpenViewer: (doc: FamilyDocument) => void
  onShare?: (doc: FamilyDocument) => void
  onRequestDelete: (doc: FamilyDocument) => void
}

/**
 * Item individual de documento exibido no grid estilo explorador de arquivos.
 * Carrega miniatura com lazy-load seguro para imagens via URL assinada;
 * para PDFs ou outros tipos, exibe ícone estilizado característico do tipo.
 */
export const DocumentItemCard: React.FC<DocumentItemCardProps> = ({
  document: doc,
  currentUserId,
  onOpenViewer,
  onShare,
  onRequestDelete,
}) => {
  const isImage = doc.mime_type.startsWith('image/')
  const isPdf = doc.mime_type === 'application/pdf'
  const isOwner = doc.uploaded_by === currentUserId
  const expiration = getDocumentExpirationStatus(doc.expires_at)
  const isMobile = useIsMobile()

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [thumbLoading, setThumbLoading] = useState<boolean>(isImage || isPdf)
  const [actionSheetOpen, setActionSheetOpen] = useState<boolean>(false)
  const [pdfRenderFailed, setPdfRenderFailed] = useState<boolean>(false)
  const [isSharing, setIsSharing] = useState<boolean>(false)
  const [isVisibleInViewport, setIsVisibleInViewport] = useState<boolean>(false)
  const cardContainerRef = useRef<HTMLDivElement | null>(null)

  // Lazy loading via IntersectionObserver: só dispara o carregamento da miniatura
  // quando o cartão entra no campo de visão (viewport)
  useEffect(() => {
    const el = cardContainerRef.current
    if (!el || typeof window === 'undefined') {
      setIsVisibleInViewport(true)
      return
    }

    if (!('IntersectionObserver' in window)) {
      setIsVisibleInViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry && (entry.isIntersecting || entry.intersectionRatio > 0)) {
          setIsVisibleInViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px 0px' }, // Inicia 200px antes para sensação fluida
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
    }
  }, [])

  // Carrega miniatura com URL assinada:
  // - Para imagem: exibe a imagem direta
  // - Para PDF: renderiza a primeira página via pdfjs-dist em canvas e gera dataURL com fallback gracioso
  useEffect(() => {
    if (!isVisibleInViewport) return

    let isMounted = true

    if (isImage) {
      setThumbLoading(true)
      getDocumentSignedUrl(doc.storage_path, 3600)
        .then((url) => {
          if (isMounted) setThumbnailUrl(url)
        })
        .catch(() => {
          if (isMounted) setThumbnailUrl(null)
        })
        .finally(() => {
          if (isMounted) setThumbLoading(false)
        })
    } else if (isPdf) {
      setThumbLoading(true)
      setPdfRenderFailed(false)

      getDocumentSignedUrl(doc.storage_path, 3600)
        .then(async (signedUrl) => {
          if (!isMounted) return
          try {
            const pageDataUrl = await renderPdfFirstPageThumbnail(signedUrl, {
              targetWidth: 360,
              timeoutMs: 12000,
            })
            if (isMounted) {
              setThumbnailUrl(pageDataUrl)
            }
          } catch (renderErr) {
            console.warn(
              '[DocumentItemCard] Falha ao renderizar miniatura do PDF, usando ícone:',
              renderErr,
            )
            if (isMounted) {
              setPdfRenderFailed(true)
              setThumbnailUrl(null)
            }
          }
        })
        .catch((err) => {
          console.warn('[DocumentItemCard] Erro ao obter signedUrl para PDF:', err)
          if (isMounted) {
            setPdfRenderFailed(true)
            setThumbnailUrl(null)
          }
        })
        .finally(() => {
          if (isMounted) setThumbLoading(false)
        })
    } else {
      setThumbLoading(false)
    }

    return () => {
      isMounted = false
    }
  }, [isVisibleInViewport, doc.storage_path, isImage, isPdf])

  const handleDirectShare = async () => {
    if (onShare) {
      onShare(doc)
      return
    }

    if (isSharing) return
    setIsSharing(true)
    try {
      const result = await shareDocumentFileOrLink(doc, '24h')
      if (result.method === 'clipboard-link') {
        toast({
          title: 'Link copiado para compartilhar 📋',
          description: 'Link válido por 24 horas gerado e copiado para a área de transferência.',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Não foi possível compartilhar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <>
      <div
        ref={cardContainerRef}
        className="group relative flex flex-col bg-white rounded-2xl border border-[rgba(20,33,61,0.08)] shadow-[0_4px_20px_-4px_rgba(20,33,61,0.05)] hover:shadow-md hover:border-slate-300 transition-all overflow-hidden select-none"
        data-testid={`doc-card-${doc.id}`}
      >
        {/* Badges flutuantes no topo da miniatura */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none z-10">
          {/* Badge Privado se não compartilhado com a família */}
          {!doc.is_shared_with_family ? (
            <span
              className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-900/80 text-white backdrop-blur-xs shadow-xs"
              title="Visível apenas para você"
            >
              <Lock className="w-2.5 h-2.5" />
              Privado
            </span>
          ) : (
            <span />
          )}

          {/* Badge de vencimento */}
          {expiration.label && (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs ${
                expiration.isExpired
                  ? 'bg-rose-100 text-[#E11D48] border border-rose-200'
                  : 'bg-amber-100 text-[#B45309] border border-amber-200'
              }`}
            >
              {expiration.label}
            </span>
          )}
        </div>

        {/* Área de miniatura / ícone (clicável para abrir visualizador) */}
        <button
          type="button"
          onClick={() => onOpenViewer(doc)}
          className="relative w-full aspect-[4/3] bg-gradient-to-b from-slate-50 to-slate-100/90 flex items-center justify-center overflow-hidden focus:outline-hidden focus:ring-2 focus:ring-[#FCA311] focus:ring-inset text-left cursor-pointer"
          title={`Abrir ${doc.title}`}
          aria-label={`Visualizar documento ${doc.title}`}
        >
          {thumbLoading ? (
            <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-[#FCA311]" />
              <span className="text-[10px]">Carregando...</span>
            </div>
          ) : thumbnailUrl ? (
            // Miniatura renderizada com sucesso (tanto para imagem quanto para 1ª página do PDF)
            <div className="relative w-full h-full">
              <img
                src={thumbnailUrl}
                alt={doc.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              {/* Se for PDF, adiciona uma pílula sutil identificadora de tipo */}
              {isPdf && (
                <span className="absolute bottom-1.5 right-1.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-900/80 text-white backdrop-blur-xs shadow-xs tracking-wider uppercase pointer-events-none">
                  PDF
                </span>
              )}
            </div>
          ) : isPdf || pdfRenderFailed ? (
            // Fallback gracioso para PDF: ícone clássico elegante caso a renderização falhe
            <div className="flex flex-col items-center justify-center gap-1.5 p-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-[#E11D48] border border-rose-100 flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <span className="text-[10px] font-bold tracking-wider text-rose-700 uppercase bg-rose-50 px-1.5 py-0.5 rounded-md">
                PDF
              </span>
            </div>
          ) : isImage ? (
            <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
              <FileImage className="w-8 h-8 text-blue-500" strokeWidth={1.5} />
              <span className="text-[10px] font-medium text-slate-500">Imagem</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 p-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <span className="text-[10px] font-bold text-slate-600 uppercase">
                {doc.file_name.split('.').pop() || 'ARQUIVO'}
              </span>
            </div>
          )}

          {/* Overlay sutil ao hover */}
          <div className="absolute inset-0 bg-[#14213D]/0 group-hover:bg-[#14213D]/10 transition-colors pointer-events-none" />
        </button>

        {/* Rodapé do cartão: Nome e ações embaixo */}
        <div className="p-2.5 sm:p-3 flex flex-col justify-between flex-1 gap-2 bg-white">
          {/* Nome e metadados rápidos */}
          <div
            className="cursor-pointer"
            onClick={() => onOpenViewer(doc)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onOpenViewer(doc)
            }}
          >
            <p
              className="text-xs font-semibold text-[#14213D] line-clamp-2 leading-snug break-words"
              title={doc.title}
            >
              {doc.title}
            </p>
            <p className="text-[10px] text-[#64748B] truncate mt-0.5">
              {formatDocumentSubtitle(doc.mime_type, doc.file_size_bytes, doc.file_name)}
            </p>
          </div>

          {/* Barra de ações embaixo do cartão */}
          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1">
            {/* Ações diretas compactas */}
            <div className="flex items-center gap-1 min-w-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenViewer(doc)}
                className="h-7 w-7 p-0 rounded-lg text-slate-600 hover:text-[#14213D] hover:bg-slate-100"
                title="Visualizar documento"
                aria-label={`Visualizar ${doc.title}`}
              >
                <Eye className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDirectShare}
                disabled={isSharing}
                className="h-7 w-7 p-0 rounded-lg text-slate-600 hover:text-[#14213D] hover:bg-slate-100"
                title="Compartilhar documento"
                aria-label={`Compartilhar ${doc.title}`}
              >
                {isSharing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                ) : (
                  <Share2 className="w-3.5 h-3.5 text-blue-600" />
                )}
              </Button>
            </div>

            {/* Menu três pontinhos ou botão mobile com bottom sheet */}
            {isMobile ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActionSheetOpen(true)}
                className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-[#14213D] hover:bg-slate-100"
                title="Mais opções"
                aria-label={`Mais opções para ${doc.title}`}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-[#14213D] hover:bg-slate-100"
                    title="Mais opções"
                    aria-label={`Mais opções para ${doc.title}`}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-44 rounded-2xl p-1 bg-white shadow-xl"
                >
                  <DropdownMenuItem
                    onClick={() => onOpenViewer(doc)}
                    className="text-xs rounded-xl cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 mr-2 text-slate-500" />
                    Visualizar / Detalhes
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDirectShare}
                    className="text-xs rounded-xl cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-2 text-blue-600" />
                    Compartilhar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onRequestDelete(doc)}
                    className="text-xs rounded-xl text-rose-600 focus:text-rose-700 focus:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2 text-rose-600" />
                    Excluir Documento
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Sheet para mobile mantendo o padrão do app */}
      {isMobile && (
        <Sheet open={actionSheetOpen} onOpenChange={setActionSheetOpen}>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl border-t border-slate-200/90 bg-white p-5 pb-7 text-slate-800"
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 -mt-1" />
            <SheetHeader className="text-left space-y-1 mb-4">
              <SheetTitle className="text-base font-bold text-[#14213D] leading-tight truncate">
                {doc.title}
              </SheetTitle>
              <SheetDescription className="text-xs text-[#64748B]">
                {formatDocumentSubtitle(doc.mime_type, doc.file_size_bytes, doc.file_name)} • por{' '}
                {doc.uploaded_by_name}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  setActionSheetOpen(false)
                  onOpenViewer(doc)
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 text-left transition-colors text-xs font-semibold text-[#14213D]"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <p className="leading-tight">Visualizar documento</p>
                  <p className="text-[10px] text-[#64748B] font-normal">
                    Abrir arquivo em tela cheia e editar metadados
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActionSheetOpen(false)
                  handleDirectShare()
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-blue-50/60 text-left transition-colors text-xs font-semibold text-blue-700"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="leading-tight">Compartilhar</p>
                  <p className="text-[10px] text-[#64748B] font-normal">
                    Enviar arquivo via WhatsApp, Telegram ou copiar link
                  </p>
                </div>
              </button>

              <div className="pt-2 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActionSheetOpen(false)
                    onRequestDelete(doc)
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-rose-50 text-left transition-colors text-xs font-semibold text-rose-600"
                >
                  <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="leading-tight">Excluir documento</p>
                    <p className="text-[10px] text-rose-400 font-normal">
                      Oferece cópia de backup antes de apagar
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
