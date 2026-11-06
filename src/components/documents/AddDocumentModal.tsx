import React, { useState, useRef } from 'react'
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
  Camera,
  Upload,
  Sparkles,
  FileText,
  Loader2,
  Eye,
  Lock,
  AlertCircle,
  X,
} from 'lucide-react'
import {
  DocumentCategory,
  uploadFamilyDocument,
  FamilyDocument,
  MAX_DOCUMENT_FILE_SIZE,
  formatDocumentSize,
} from '@/services/family-documents'
import { DocumentScannerModal } from './DocumentScannerModal'
import { toast } from '@/hooks/use-toast'

interface AddDocumentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  familyId: string
  uploadedByName: string
  defaultCategory?: DocumentCategory
  onSuccess: (newDoc: FamilyDocument) => void
}

export const AddDocumentModal: React.FC<AddDocumentModalProps> = ({
  open,
  onOpenChange,
  familyId,
  uploadedByName,
  defaultCategory = 'outros',
  onSuccess,
}) => {
  const [title, setTitle] = useState<string>('')
  const [isSharedWithFamily, setIsSharedWithFamily] = useState<boolean>(true)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  // Scanner modal state
  const [scannerOpen, setScannerOpen] = useState<boolean>(false)
  const [rawScanFile, setRawScanFile] = useState<File | null>(null)

  // Input refs para as 3 formas
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setTitle('')
      setIsSharedWithFamily(true)
      setFile(null)
      setLoading(false)
    }
  }, [open])

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>, isScan: boolean = false) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (selected.size > MAX_DOCUMENT_FILE_SIZE) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O limite máximo para documentos é de 10 MB.',
        variant: 'destructive',
      })
      e.target.value = ''
      return
    }

    // Se veio do fluxo de scanner e for imagem, abre o modal de scanner
    if (isScan && selected.type.startsWith('image/')) {
      setRawScanFile(selected)
      setScannerOpen(true)
      e.target.value = ''
      return
    }

    setFile(selected)
    if (!title.trim()) {
      // Sugere título limpo a partir do nome do arquivo
      const baseName = selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      setTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1))
    }
    e.target.value = ''
  }

  const handleScannerProcessed = (processedFile: File) => {
    setFile(processedFile)
    if (!title.trim()) {
      const baseName = processedFile.name
        .replace(/\.[^/.]+$/, '')
        .replace(/-(escaneado|digitalizado)$/i, '')
        .replace(/[-_]/g, ' ')
      setTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast({
        title: 'Nenhum arquivo selecionado',
        description: 'Tire uma foto, importe um arquivo ou escaneie o documento.',
        variant: 'destructive',
      })
      return
    }

    if (!title.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome para identificar o documento (ex.: RG Matheus).',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      const newDoc = await uploadFamilyDocument({
        familyId,
        file,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        title: title.trim(),
        category: defaultCategory || 'outros',
        expiresAt: null,
        isSharedWithFamily,
        uploadedByName,
      })

      toast({
        title: 'Documento salvo! 📁',
        description: `"${newDoc.title}" adicionado à pasta com sucesso.`,
      })

      onSuccess(newDoc)
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar documento',
        description: err.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md w-[92vw] rounded-3xl p-5 sm:p-6 bg-white max-h-[92vh] overflow-y-auto">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-semibold text-ink">
              Adicionar Documento
            </DialogTitle>
            <DialogDescription className="text-xs text-body2">
              Salve comprovantes, certidões ou contratos seguros no cofre da família
            </DialogDescription>{' '}
          </DialogHeader>

          {/* Inputs escondidos para as 3 formas */}
          {/* 1. Tirar foto direto na câmera */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleSelectFile(e, false)}
          />

          {/* 2. Importar arquivo do aparelho (PDF, JPG, PNG) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="hidden"
            onChange={(e) => handleSelectFile(e, false)}
          />

          {/* 3. Escanear com tratamento de imagem */}
          <input
            ref={scanInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleSelectFile(e, true)}
          />

          {/* Seletor das 3 formas de captura se nenhum arquivo foi escolhido */}
          {!file ? (
            <div className="space-y-2.5 pt-2">
              <Label className="text-xs font-semibold text-ink">Como deseja adicionar?</Label>
              <div className="grid grid-cols-3 gap-2">
                {/* Botão Tirar Foto */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-line bg-bg hover:bg-slate-100 transition-colors text-center group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <Camera className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <span className="text-xs font-semibold text-ink leading-tight">Tirar Foto</span>
                  <span className="text-[10px] text-body2 mt-0.5">Câmera na hora</span>
                </button>

                {/* Botão Importar Arquivo */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-line bg-bg hover:bg-slate-100 transition-colors text-center group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <Upload className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <span className="text-xs font-semibold text-ink leading-tight">Importar</span>
                  <span className="text-[10px] text-body2 mt-0.5">PDF ou foto</span>
                </button>

                {/* Botão Escanear */}
                <button
                  type="button"
                  onClick={() => scanInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-line bg-bg hover:bg-slate-100 transition-colors text-center group"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <span className="text-xs font-semibold text-ink leading-tight">Escanear</span>
                  <span className="text-[10px] text-body2 mt-0.5">Filtro limpo</span>
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5 text-[11px] text-body2">
                <AlertCircle className="w-4 h-4 text-action shrink-0 mt-0.5" />
                <span>
                  <strong>Aviso de segurança:</strong> o app armazena apenas o arquivo e metadados.
                  Nunca solicitamos digitar números de RG ou CPF.
                </span>
              </div>
            </div>
          ) : (
            /* Card do arquivo selecionado com botão de trocar */
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-emerald-950 truncate">{file.name}</p>
                  <p className="text-[10px] text-emerald-700">
                    {file.type.includes('pdf') ? 'Documento PDF' : 'Imagem'} •{' '}
                    {formatDocumentSize(file.size)}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFile(null)}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl h-8 px-2 shrink-0"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Trocar
              </Button>
            </div>
          )}

          {/* Formulário com metadados mínimos acordados */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Nome do documento */}
            <div className="space-y-1.5">
              <Label htmlFor="doc-title" className="text-xs font-semibold text-ink">
                Título do documento <span className="text-rose-500">*</span>
              </Label>{' '}
              <Input
                id="doc-title"
                type="text"
                placeholder="Ex.: RG Matheus, Comprovante de Luz, Certidão de Casamento"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 text-xs rounded-xl border-slate-200"
                required
              />
            </div>

            {/* Visibilidade na família */}
            <div className="p-3 rounded-2xl bg-bg border border-line flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isSharedWithFamily ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isSharedWithFamily ? <Eye className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink">
                    {isSharedWithFamily ? 'Compartilhado com a família' : 'Documento Privado'}
                  </p>
                  <p className="text-[10px] text-body2">
                    {isSharedWithFamily
                      ? 'Todos os membros da família podem visualizar'
                      : 'Visível somente para quem enviou'}
                  </p>
                </div>
              </div>
              <Switch checked={isSharedWithFamily} onCheckedChange={setIsSharedWithFamily} />
            </div>

            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="text-xs rounded-xl h-10 border-slate-200"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading || !file || !title.trim()}
                className="text-xs font-semibold bg-ink text-white hover:opacity-90 rounded-xl h-10 px-5"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-action" />}
                Salvar na Pasta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Scanner */}
      <DocumentScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        rawFile={rawScanFile}
        onProcessed={handleScannerProcessed}
      />
    </>
  )
}
