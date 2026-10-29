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
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Sparkles, Loader2, RotateCcw, Check, SlidersHorizontal } from 'lucide-react'
import { processScannedImage } from '@/services/family-documents'

interface DocumentScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rawFile: File | null
  onProcessed: (processedFile: File) => void
}

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
  open,
  onOpenChange,
  rawFile,
  onProcessed,
}) => {
  const [contrast, setContrast] = useState<number>(1.3)
  const [brightness, setBrightness] = useState<number>(1.08)
  const [grayscale, setGrayscale] = useState<boolean>(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState<boolean>(false)

  // Atualiza preview quando rawFile muda ou filtros mudam
  React.useEffect(() => {
    if (!open || !rawFile) {
      setPreviewUrl(null)
      return
    }

    let isMounted = true
    const updatePreview = async () => {
      try {
        setProcessing(true)
        const blob = await processScannedImage(rawFile, {
          contrast,
          brightness,
          grayscale,
          quality: 0.85,
        })
        if (isMounted) {
          const url = URL.createObjectURL(blob)
          setPreviewUrl(url)
        }
      } catch (err) {
        console.error('Erro ao processar preview do scan:', err)
      } finally {
        if (isMounted) setProcessing(false)
      }
    }

    updatePreview()

    return () => {
      isMounted = false
    }
  }, [open, rawFile, contrast, brightness, grayscale])

  const handleApply = async () => {
    if (!rawFile) return
    try {
      setProcessing(true)
      const blob = await processScannedImage(rawFile, {
        contrast,
        brightness,
        grayscale,
        quality: 0.9,
      })
      const finalFileName = rawFile.name.replace(/\.[^/.]+$/, '') + '-escaneado.jpg'
      const finalFile = new File([blob], finalFileName, { type: 'image/jpeg' })
      onProcessed(finalFile)
      onOpenChange(false)
    } catch (err) {
      console.error('Erro ao finalizar scan:', err)
    } finally {
      setProcessing(false)
    }
  }

  const handleReset = () => {
    setContrast(1.3)
    setBrightness(1.08)
    setGrayscale(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[92vw] rounded-3xl p-5 sm:p-6 bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold text-[#14213D] flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-[#FCA311] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            Escanear Documento
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            Ajuste o contraste e nitidez para dar aparência de documento digitalizado limpo.
          </DialogDescription>
        </DialogHeader>

        {/* Preview da imagem */}
        <div className="relative mt-2 rounded-2xl bg-slate-100 overflow-hidden border border-[rgba(20,33,61,0.08)] flex items-center justify-center min-h-[220px] max-h-[300px]">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Prévia do documento escaneado"
              className="w-full h-full object-contain max-h-[280px]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#FCA311]" />
              <span className="text-xs">Processando imagem...</span>
            </div>
          )}

          {processing && previewUrl && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#14213D]" />
            </div>
          )}
        </div>

        {/* Controles de ajuste */}
        <div className="space-y-4 pt-2">
          {/* Contraste */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <Label className="text-[#14213D] font-medium flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#64748B]" />
                Contraste
              </Label>
              <span className="text-[11px] text-[#64748B] font-mono">
                {Math.round(contrast * 100)}%
              </span>
            </div>
            <Slider
              value={[contrast]}
              min={1.0}
              max={2.0}
              step={0.05}
              onValueChange={([val]) => setContrast(val)}
              className="py-1"
            />
          </div>

          {/* Brilho */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <Label className="text-[#14213D] font-medium">Brilho do fundo</Label>
              <span className="text-[11px] text-[#64748B] font-mono">
                {Math.round(brightness * 100)}%
              </span>
            </div>
            <Slider
              value={[brightness]}
              min={0.9}
              max={1.4}
              step={0.02}
              onValueChange={([val]) => setBrightness(val)}
              className="py-1"
            />
          </div>

          {/* Preto e Branco */}
          <div className="flex items-center justify-between py-1 border-t border-slate-100">
            <div>
              <p className="text-xs font-medium text-[#14213D]">Documento P&B</p>
              <p className="text-[10px] text-[#64748B]">
                Remove cores para certidões e comprovantes
              </p>
            </div>
            <Switch checked={grayscale} onCheckedChange={setGrayscale} />
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 pt-3 border-t border-slate-100 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-[#64748B] hover:text-[#14213D] rounded-xl h-9"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Restaurar
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
              onClick={handleApply}
              disabled={processing || !previewUrl}
              className="text-xs font-semibold bg-[#14213D] text-white hover:bg-[#1f3159] rounded-xl h-9 gap-1.5 px-4 shadow-sm"
            >
              {processing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5 text-[#FCA311]" />
              )}
              Usar documento
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
