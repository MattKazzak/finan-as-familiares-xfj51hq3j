import React, { useState, useEffect, useRef } from 'react'
import {
  FileText,
  FileImage,
  MoreVertical,
  Share2,
  Trash2,
  Eye,
  Lock,
  Loader2,
  Check,
  CheckSquare,
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
  /** Modo de seleção múltipla ativo */
  isSelectionMode?: boolean
  /** Se este cartão está selecionado */
  isSelected?: boolean
  /** Alterna a seleção deste cartão */
  onToggleSelect?: (doc: FamilyDocument) => void
  /** Disparado ao segurar o cartão por ~500ms (long press) para entrar no modo de seleção */
  onLongPressSelect?: (doc: FamilyDocument) => void
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
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onLongPressSelect,
}) => {
  const isImage = doc.mime_type.startsWith('image/')
  const isPdf = doc.mime_type === 'application/pdf'
  const expiration = getDocumentExpirationStatus(doc.expires_at)
  const isMobile = useIsMobile()

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [thumbLoading, setThumbLoading] = useState<boolean>(isImage || isPdf)
  const [actionSheetOpen, setActionSheetOpen] = useState<boolean>(false)
  const [pdfRenderFailed, setPdfRenderFailed] = useState<boolean>(false)
  const [isSharing, setIsSharing] = useState<boolean>(false)
  const [isVisibleInViewport, setIsVisibleInViewport] = useState<boolean>(false)
  const cardContainerRef = useRef<HTMLDivElement | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressTriggeredRef = useRef<boolean>(false)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null)

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

  // Limpeza de timer de long-press
  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    isLongPressTriggeredRef.current = false
    const touch = e.touches[0]
    if (touch) {
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
    }
    clearLongPressTimer()
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate?.(40)
        } catch {
          // ignore
        }
      }
      if (onLongPressSelect) {
        onLongPressSelect(doc)
      } else if (onToggleSelect) {
        onToggleSelect(doc)
      }
    }, 500)
  }

  // Suporte a long press também via mouse (desktop) com botão principal (esquerdo)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Ignora cliques com outros botões que não o esquerdo (button !== 0)
    if (e.button !== 0) return
    isLongPressTriggeredRef.current = false
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY }
    clearLongPressTimer()
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true
      if (onLongPressSelect) {
        onLongPressSelect(doc)
      } else if (onToggleSelect) {
        onToggleSelect(doc)
      }
    }, 500)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mouseDownPosRef.current) {
      const dx = Math.abs(e.clientX - mouseDownPosRef.current.x)
      const dy = Math.abs(e.clientY - mouseDownPosRef.current.y)
      if (dx > 10 || dy > 10) {
        clearLongPressTimer()
      }
    }
  }

  const handleMouseUp = () => {
    clearLongPressTimer()
  }

  // Suprime o menu de contexto nativo do navegador especificamente nos cartões
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    // Se o usuário rolou o dedo mais de 10px, cancela o long press para não atrapalhar o scroll
    if (touchStartPosRef.current && e.touches[0]) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x)
      const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y)
      if (dx > 10 || dy > 10) {
        clearLongPressTimer()
      }
    }
  }

  const handleTouchEnd = () => {
    clearLongPressTimer()
  }

  // Toque / clique no cartão
  const handleCardClick = () => {
    // Se acabou de disparar o long press no mesmo toque, não abre o viewer
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false
      return
    }

    if (isSelectionMode) {
      onToggleSelect?.(doc)
    } else {
      onOpenViewer(doc)
    }
  }

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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
        style={{
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
        className={`group relative flex flex-col bg-white rounded-2xl border transition-all overflow-hidden select-none document-card-touch-suppress ${
          isSelected
            ? 'border-[#FCA311] ring-2 ring-[#FCA311]/50 shadow-md bg-amber-50/20'
            : isSelectionMode
              ? 'border-slate-300 hover:border-[#FCA311]/60 shadow-[0_4px_20px_-4px_rgba(20,33,61,0.05)]'
              : 'border-[rgba(20,33,61,0.08)] shadow-[0_4px_20px_-4px_rgba(20,33,61,0.05)] hover:shadow-md hover:border-slate-300'
        }`}
        data-testid={`doc-card-${doc.id}`}
        data-selected={isSelected}
      >
        {/* Checkbox / Botão de Seleção (visível no modo de seleção ou no hover desktop para facilitar entrada) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (isSelectionMode) {
              onToggleSelect?.(doc)
            } else {
              onLongPressSelect?.(doc)
            }
          }}
          className={`absolute top-2 left-2 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-[#FCA311] text-[#14213D] shadow-md ring-2 ring-white scale-105'
              : isSelectionMode
                ? 'bg-white/90 text-slate-400 border border-slate-300 hover:border-[#FCA311] shadow-xs'
                : 'opacity-0 group-hover:opacity-100 bg-white/90 text-slate-400 border border-slate-300 hover:text-[#14213D] shadow-xs'
          }`}
          title={isSelected ? 'Desmarcar documento' : 'Selecionar documento'}
          aria-label={isSelected ? `Desmarcar ${doc.title}` : `Selecionar ${doc.title}`}
        >
          {isSelected ? (
            <Check className="w-4 h-4 stroke-[3]" />
          ) : (
            <span className="w-3.5 h-3.5 rounded-full border border-slate-400" />
          )}
        </button>

        {/* Badges flutuantes no topo da miniatura (deslocadas para a direita quando no modo de seleção) */}
        <div className="absolute top-2 right-2 flex items-center gap-1 pointer-events-none z-10">
          {/* Badge Privado se não compartilhado com a família */}
          {!doc.is_shared_with_family && (
            <span
              className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-900/80 text-white backdrop-blur-xs shadow-xs"
              title="Visível apenas para você"
            >
              <Lock className="w-2.5 h-2.5" />
              Privado
            </span>
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

        {/* Área de miniatura / ícone (clicável: alterna seleção se estiver no modo de seleção, ou abre visualizador) */}
        <button
          type="button"
          onClick={handleCardClick}
          onContextMenu={handleContextMenu}
          style={{
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
          className="relative w-full aspect-[4/3] bg-gradient-to-b from-slate-50 to-slate-100/90 flex items-center justify-center overflow-hidden focus:outline-hidden focus:ring-2 focus:ring-[#FCA311] focus:ring-inset text-left cursor-pointer select-none document-card-touch-suppress"
          title={isSelectionMode ? (isSelected ? 'Desmarcar' : 'Selecionar') : `Abrir ${doc.title}`}
          aria-label={
            isSelectionMode
              ? isSelected
                ? `Desmarcar ${doc.title}`
                : `Selecionar ${doc.title}`
              : `Visualizar documento ${doc.title}`
          }
        >
          {thumbLoading ? (
            <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-[#FCA311]" />
              <span className="text-[10px]">Carregando...</span>
            </div>
          ) : thumbnailUrl ? (
            // Miniatura renderizada com sucesso (tanto para imagem quanto para 1ª página do PDF)
            <div
              className="relative w-full h-full select-none"
              style={{
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}
            >
              <img
                src={thumbnailUrl}
                alt={doc.title}
                draggable={false}
                onContextMenu={handleContextMenu}
                style={{
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  pointerEvents: 'none', // Previne ações nativas do navegador de arrastar e chamar menu contextual
                }}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none pointer-events-none"
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
            onClick={handleCardClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (isSelectionMode) onToggleSelect?.(doc)
                else onOpenViewer(doc)
              }
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
            {isSelectionMode ? (
              /* No modo de seleção: botão grande e direto para alternar a seleção */
              <Button
                type="button"
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSelect?.(doc)
                }}
                className={`w-full h-7 text-[11px] font-semibold rounded-lg gap-1.5 transition-colors ${
                  isSelected
                    ? 'bg-[#14213D] text-white hover:bg-[#1f3159]'
                    : 'text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Check className={`w-3 h-3 ${isSelected ? 'text-[#FCA311]' : 'text-slate-400'}`} />
                <span>{isSelected ? 'Selecionado' : 'Selecionar'}</span>
              </Button>
            ) : (
              <>
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
                        onClick={() => {
                          if (onLongPressSelect) onLongPressSelect(doc)
                          else onToggleSelect?.(doc)
                        }}
                        className="text-xs rounded-xl cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5 mr-2 text-[#FCA311]" />
                        Selecionar
                      </DropdownMenuItem>
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
              </>
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
                  if (onLongPressSelect) onLongPressSelect(doc)
                  else onToggleSelect?.(doc)
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-amber-50/60 text-left transition-colors text-xs font-semibold text-[#14213D]"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#FCA311] flex items-center justify-center">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <p className="leading-tight">Selecionar vários</p>
                  <p className="text-[10px] text-[#64748B] font-normal">
                    Entra no modo para compartilhar múltiplos arquivos
                  </p>
                </div>
              </button>

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
