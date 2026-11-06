import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Sparkles,
  Loader2,
  RotateCcw,
  Check,
  SlidersHorizontal,
  Crop,
  Layers,
  Plus,
  Trash2,
  FileCheck,
  ChevronRight,
  ArrowLeft,
  Zap,
} from 'lucide-react'
import { processScannedImage } from '@/services/family-documents'
import {
  QuadCorners,
  ScanFilterMode,
  detectDocumentCorners,
  createMultiPagePdfFromBlobs,
} from '@/services/document-scanner-core'
import { DocumentCropCanvas } from './DocumentCropCanvas'

export interface DocumentScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rawFile: File | null
  onProcessed: (processedFile: File) => void
}

interface PageItem {
  id: string
  rawFile: File
  rawUrl: string
  corners: QuadCorners | null
  processedBlob: Blob | null
  previewUrl: string | null
  naturalDimensions: { width: number; height: number }
}

type StepMode = 'crop' | 'filter'

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
  open,
  onOpenChange,
  rawFile,
  onProcessed,
}) => {
  // Lista de páginas capturadas (multi-página)
  const [pages, setPages] = useState<PageItem[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0)
  const [step, setStep] = useState<StepMode>('crop')

  // Filtros pós-processamento da página atual
  const [filterMode, setFilterMode] = useState<ScanFilterMode>('color')
  const [contrast, setContrast] = useState<number>(1.25)
  const [brightness, setBrightness] = useState<number>(1.05)
  const [sharpen, setSharpen] = useState<boolean>(true)
  const [showAdvancedSliders, setShowAdvancedSliders] = useState<boolean>(false)

  // Status de processamento
  const [processing, setProcessing] = useState<boolean>(false)
  const [isDetecting, setIsDetecting] = useState<boolean>(false)

  // Input oculto para adicionar mais páginas
  const addPageInputRef = useRef<HTMLInputElement>(null)

  // Inicializa quando abre ou quando rawFile muda
  useEffect(() => {
    if (!open || !rawFile) {
      // Limpa blobs e URLs criados ao fechar
      pages.forEach((p) => {
        if (p.rawUrl) URL.revokeObjectURL(p.rawUrl)
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
      })
      setPages([])
      setCurrentPageIndex(0)
      setStep('crop')
      return
    }

    const firstPageUrl = URL.createObjectURL(rawFile)
    const initialPage: PageItem = {
      id: crypto.randomUUID(),
      rawFile,
      rawUrl: firstPageUrl,
      corners: null,
      processedBlob: null,
      previewUrl: null,
      naturalDimensions: { width: 0, height: 0 },
    }

    setPages([initialPage])
    setCurrentPageIndex(0)
    setStep('crop')
    setFilterMode('color')
    setContrast(1.25)
    setBrightness(1.05)
    setSharpen(true)

    // Detecção automática de bordas inicial
    detectCornersForFile(rawFile, initialPage.id)
  }, [open, rawFile])

  // Detecção de bordas inteligente
  const detectCornersForFile = async (file: File, pageId: string) => {
    try {
      setIsDetecting(true)
      const img = new Image()
      const url = URL.createObjectURL(file)

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        img.src = url
      })

      const origW = img.naturalWidth || img.width
      const origH = img.naturalHeight || img.height

      // Renderiza em thumbnail para análise rápida de bordas
      const sampleW = Math.min(480, origW)
      const sampleH = Math.round((sampleW / origW) * origH)

      const canvas = document.createElement('canvas')
      canvas.width = sampleW
      canvas.height = sampleH
      const ctx = canvas.getContext('2d')

      let detectedCorners: QuadCorners

      if (ctx) {
        ctx.drawImage(img, 0, 0, sampleW, sampleH)
        const sampleData = ctx.getImageData(0, 0, sampleW, sampleH)
        detectedCorners = detectDocumentCorners(sampleData, origW, origH)
      } else {
        // Fallback margem de 7%
        detectedCorners = {
          topLeft: { x: Math.round(origW * 0.07), y: Math.round(origH * 0.07) },
          topRight: { x: Math.round(origW * 0.93), y: Math.round(origH * 0.07) },
          bottomRight: { x: Math.round(origW * 0.93), y: Math.round(origH * 0.93) },
          bottomLeft: { x: Math.round(origW * 0.07), y: Math.round(origH * 0.93) },
        }
      }

      URL.revokeObjectURL(url)

      setPages((prev) =>
        prev.map((p) =>
          p.id === pageId
            ? {
                ...p,
                corners: detectedCorners,
                naturalDimensions: { width: origW, height: origH },
              }
            : p,
        ),
      )
    } catch (err) {
      console.error('Erro na detecção de bordas:', err)
    } finally {
      setIsDetecting(false)
    }
  }

  const currentPage = pages[currentPageIndex] || null

  // Atualiza cantos da página atual
  const handleCornersChange = (newCorners: QuadCorners) => {
    if (!currentPage) return
    setPages((prev) =>
      prev.map((p, idx) => (idx === currentPageIndex ? { ...p, corners: newCorners } : p)),
    )
  }

  // Avança do recorte para o filtro gerando o blob processado com debounce
  const handleConfirmCrop = async (skipCrop: boolean = false) => {
    if (!currentPage) return
    try {
      setProcessing(true)
      const cornersToUse = skipCrop ? null : currentPage.corners

      const blob = await processScannedImage(currentPage.rawFile, {
        corners: cornersToUse,
        filterMode,
        contrast,
        brightness,
        sharpen,
        quality: 0.88,
      })

      const newPreviewUrl = URL.createObjectURL(blob)

      setPages((prev) =>
        prev.map((p, idx) =>
          idx === currentPageIndex
            ? {
                ...p,
                corners: cornersToUse,
                processedBlob: blob,
                previewUrl: newPreviewUrl,
              }
            : p,
        ),
      )
      setStep('filter')
    } catch (err) {
      console.error('Erro ao recortar imagem:', err)
    } finally {
      setProcessing(false)
    }
  }

  // Recalcula preview quando filtros mudam na etapa de filtros (com debounce de 150ms para mobile fluido)
  useEffect(() => {
    if (step !== 'filter' || !currentPage) return

    let isMounted = true
    const timer = setTimeout(async () => {
      try {
        setProcessing(true)
        const blob = await processScannedImage(currentPage.rawFile, {
          corners: currentPage.corners,
          filterMode,
          contrast,
          brightness,
          sharpen,
          quality: 0.85,
        })

        if (!isMounted) return

        const newUrl = URL.createObjectURL(blob)
        setPages((prev) =>
          prev.map((p, idx) =>
            idx === currentPageIndex
              ? {
                  ...p,
                  processedBlob: blob,
                  previewUrl: newUrl,
                }
              : p,
          ),
        )
      } catch (err) {
        console.error('Erro ao atualizar filtros:', err)
      } finally {
        if (isMounted) setProcessing(false)
      }
    }, 150)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [step, filterMode, contrast, brightness, sharpen, currentPageIndex])

  // Adiciona nova página via captura/upload
  const handleAddNewPage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const newUrl = URL.createObjectURL(file)
    const newPage: PageItem = {
      id: crypto.randomUUID(),
      rawFile: file,
      rawUrl: newUrl,
      corners: null,
      processedBlob: null,
      previewUrl: null,
      naturalDimensions: { width: 0, height: 0 },
    }

    setPages((prev) => [...prev, newPage])
    const newIdx = pages.length
    setCurrentPageIndex(newIdx)
    setStep('crop')
    e.target.value = ''

    await detectCornersForFile(file, newPage.id)
  }

  // Remove uma página
  const handleRemovePage = (indexToRemove: number) => {
    if (pages.length <= 1) return
    const removed = pages[indexToRemove]
    if (removed.rawUrl) URL.revokeObjectURL(removed.rawUrl)
    if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl)

    const updated = pages.filter((_, i) => i !== indexToRemove)
    setPages(updated)
    const nextIdx = Math.min(currentPageIndex, updated.length - 1)
    setCurrentPageIndex(nextIdx)
  }

  // Finalização: exporta como PDF (se multipágina) ou como JPG otimizado
  const handleFinalSave = async () => {
    if (pages.length === 0) return
    try {
      setProcessing(true)

      // Garante que todas as páginas tenham blob processado em alta resolução (quality 0.90)
      const finalBlobs: Blob[] = []
      for (const p of pages) {
        const finalBlob = await processScannedImage(p.rawFile, {
          corners: p.corners,
          filterMode,
          contrast,
          brightness,
          sharpen,
          quality: 0.9,
        })
        finalBlobs.push(finalBlob)
      }

      const baseName = (rawFile?.name || 'documento')
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .trim()

      if (pages.length > 1) {
        // Multi-página -> Gera PDF multipágina nativo
        const pdfBlob = await createMultiPagePdfFromBlobs(finalBlobs)
        const pdfFileName = `${baseName}-digitalizado.pdf`
        const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' })
        onProcessed(pdfFile)
      } else {
        // Página única -> Salva JPG otimizado como no fluxo original
        const jpgFileName = `${baseName}-escaneado.jpg`
        const finalFile = new File([finalBlobs[0]], jpgFileName, { type: 'image/jpeg' })
        onProcessed(finalFile)
      }

      onOpenChange(false)
    } catch (err) {
      console.error('Erro ao gerar documento final:', err)
    } finally {
      setProcessing(false)
    }
  }

  // Botão de restaurar ajustes
  const handleResetFilters = () => {
    setFilterMode('color')
    setContrast(1.25)
    setBrightness(1.05)
    setSharpen(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[94vw] sm:w-[92vw] rounded-3xl p-4 sm:p-6 bg-white max-h-[92vh] overflow-y-auto border border-line shadow-cds">
        <DialogHeader className="text-left pb-1">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-ink flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-50 text-action flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </span>
              Digitalizar Documento
            </DialogTitle>

            {/* Badge de páginas */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-medium text-ink">
              <Layers className="w-3.5 h-3.5 text-action" />
              <span>
                Pág. {currentPageIndex + 1} de {pages.length}
              </span>
            </div>
          </div>
          <DialogDescription className="text-xs text-body2 pt-0.5">
            {step === 'crop'
              ? 'Ajuste os 4 cantos para alinhar as bordas do papel.'
              : 'Escolha o melhoramento e confira o resultado antes de salvar.'}
          </DialogDescription>
        </DialogHeader>

        {/* Input escondido para capturar nova página */}
        <input
          ref={addPageInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleAddNewPage}
        />

        {/* Carrossel/Thumbnails de Páginas (quando houver 2+ ou para adicionar) */}
        <div className="flex items-center gap-2 overflow-x-auto py-1.5 no-scrollbar">
          {pages.map((p, idx) => {
            const isSelected = idx === currentPageIndex
            return (
              <div
                key={p.id}
                onClick={() => setCurrentPageIndex(idx)}
                className={`relative group shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium cursor-pointer border transition-all ${
                  isSelected
                    ? 'bg-ink text-white border-ink shadow-xs'
                    : 'bg-bg text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>Página {idx + 1}</span>
                {pages.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemovePage(idx)
                    }}
                    className={`p-0.5 rounded-full hover:bg-red-500/20 ${
                      isSelected
                        ? 'text-slate-300 hover:text-white'
                        : 'text-slate-400 hover:text-red-600'
                    }`}
                    title="Excluir esta página"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addPageInputRef.current?.click()}
            className="shrink-0 h-7 text-[11px] px-2.5 rounded-xl border-dashed border-amber-300 text-amber-800 bg-amber-50/50 hover:bg-amber-100/60"
          >
            <Plus className="w-3 h-3 mr-1 text-action" />+ Página
          </Button>
        </div>

        {/* ÁREA PRINCIPAL: ETAPA 1 (CORTE/PERSPECTIVA) OU ETAPA 2 (FILTROS) */}
        {step === 'crop' ? (
          <div className="space-y-3 pt-1">
            {/* Visualizador de corte com cantos arrastáveis */}
            <div className="relative rounded-2xl bg-slate-900 overflow-hidden min-h-[260px] max-h-[340px] flex items-center justify-center">
              {currentPage && currentPage.corners ? (
                <DocumentCropCanvas
                  imageSrc={currentPage.rawUrl}
                  corners={currentPage.corners}
                  onChangeCorners={handleCornersChange}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-action" />
                  <span className="text-xs">Detectando bordas do documento...</span>
                </div>
              )}

              {isDetecting && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center gap-2 text-white text-xs z-30">
                  <Loader2 className="w-4 h-4 animate-spin text-action" />
                  <span>Detectando papel automaticamente...</span>
                </div>
              )}
            </div>

            {/* Ações da etapa de corte */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleConfirmCrop(true)}
                className="text-xs text-body2 hover:text-ink rounded-xl h-9 px-2.5"
              >
                Pular recorte
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="text-xs rounded-xl h-9 border-slate-200"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleConfirmCrop(false)}
                  disabled={processing || !currentPage?.corners}
                  className="text-xs font-semibold bg-ink text-white hover:opacity-90 rounded-xl h-9 gap-1.5 px-4 shadow-sm"
                >
                  {processing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Crop className="w-3.5 h-3.5 text-action" />
                  )}
                  Ajustar e avançar
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* ETAPA 2: FILTROS E MELHORAMENTO COM 1 TOQUE */
          <div className="space-y-3 pt-1">
            {/* Preview do documento corrigido */}
            <div className="relative rounded-2xl bg-slate-100 overflow-hidden border border-line flex items-center justify-center min-h-[230px] max-h-[300px]">
              {currentPage?.previewUrl ? (
                <img
                  src={currentPage.previewUrl}
                  alt="Prévia do documento com perspectiva corrigida"
                  className="w-full h-full object-contain max-h-[290px]"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-action" />
                  <span className="text-xs">Aplicando aprimoramento...</span>
                </div>
              )}

              {processing && currentPage?.previewUrl && (
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-ink" />
                </div>
              )}
            </div>

            {/* SELETORES DE MODO COM 1 TOQUE: Colorido / Cinza / P&B Alto Contraste */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-action" />
                Modo de aprimoramento
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFilterMode('color')}
                  className={`p-2.5 rounded-2xl border text-center transition-all ${
                    filterMode === 'color'
                      ? 'bg-ink text-white border-ink shadow-xs'
                      : 'bg-bg text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <p className="text-xs font-semibold leading-tight">Colorido</p>
                  <p
                    className={`text-[9px] mt-0.5 ${
                      filterMode === 'color' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Cores vivas
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('grayscale')}
                  className={`p-2.5 rounded-2xl border text-center transition-all ${
                    filterMode === 'grayscale'
                      ? 'bg-ink text-white border-ink shadow-xs'
                      : 'bg-bg text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <p className="text-xs font-semibold leading-tight">Cinza</p>
                  <p
                    className={`text-[9px] mt-0.5 ${
                      filterMode === 'grayscale' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Tons neutros
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('bw')}
                  className={`p-2.5 rounded-2xl border text-center transition-all ${
                    filterMode === 'bw'
                      ? 'bg-ink text-white border-ink shadow-xs'
                      : 'bg-bg text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <p className="text-xs font-semibold leading-tight">P&B Alto Contraste</p>
                  <p
                    className={`text-[9px] mt-0.5 ${
                      filterMode === 'bw' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Binarizado limpo
                  </p>
                </button>
              </div>
            </div>

            {/* Alternar sliders de ajuste fino */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setShowAdvancedSliders(!showAdvancedSliders)}
                className="text-xs font-medium text-ink hover:text-action flex items-center gap-1.5 transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-body2" />
                <span>
                  {showAdvancedSliders
                    ? 'Ocultar ajuste fino'
                    : 'Ajuste fino (contraste e nitidez)'}
                </span>
              </button>

              {showAdvancedSliders && (
                <div className="space-y-3 pt-2.5 pb-1 px-3 rounded-2xl bg-bg border border-line mt-2">
                  {/* Nitidez */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-ink flex items-center gap-1">
                        <Zap className="w-3 h-3 text-action" />
                        Nitidez extra (Unsharp Mask)
                      </p>
                      <p className="text-[10px] text-body2">Realça letras pequenas e carimbos</p>
                    </div>
                    <Switch checked={sharpen} onCheckedChange={setSharpen} />
                  </div>

                  {/* Contraste */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <Label className="text-ink text-[11px] font-medium">Contraste</Label>
                      <span className="text-[11px] text-body2 font-mono">
                        {Math.round(contrast * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[contrast]}
                      min={0.9}
                      max={2.0}
                      step={0.05}
                      onValueChange={([val]) => setContrast(val)}
                      className="py-1"
                    />
                  </div>

                  {/* Brilho */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <Label className="text-ink text-[11px] font-medium">Brilho do papel</Label>
                      <span className="text-[11px] text-body2 font-mono">
                        {Math.round(brightness * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[brightness]}
                      min={0.85}
                      max={1.4}
                      step={0.02}
                      onValueChange={([val]) => setBrightness(val)}
                      className="py-1"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé da Etapa 2 */}
            <DialogFooter className="flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100 sm:justify-between">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('crop')}
                  className="text-xs text-body2 hover:text-ink rounded-xl h-9 px-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Voltar ao corte
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-xs text-body2 hover:text-ink rounded-xl h-9 px-2"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Restaurar
                </Button>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={handleFinalSave}
                disabled={processing || !currentPage?.previewUrl}
                className="text-xs font-semibold bg-ink text-white hover:opacity-90 rounded-xl h-9 gap-1.5 px-4 shadow-sm"
              >
                {processing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-action" />
                )}
                {pages.length > 1 ? (
                  <span className="flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5" />
                    Salvar {pages.length} págs (PDF)
                  </span>
                ) : (
                  'Salvar documento'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
