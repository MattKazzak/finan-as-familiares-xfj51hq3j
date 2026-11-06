import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  FileText,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Download,
  ExternalLink,
  Loader2,
  Calendar,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import {
  fetchSharedDocumentByToken,
  SharedDocumentPublicInfo,
  getDocumentSignedUrl,
  formatDocumentSize,
  formatDocumentSubtitle,
} from '@/services/family-documents'

export default function SharedDocumentPage() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState<boolean>(true)
  const [docInfo, setDocInfo] = useState<SharedDocumentPublicInfo | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [timeRemainingStr, setTimeRemainingStr] = useState<string>('')

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setDocInfo({ valid: false, error: 'Link de documento inválido.' })
      return
    }

    let isMounted = true

    const loadDoc = async () => {
      try {
        setLoading(true)
        const info = await fetchSharedDocumentByToken(token)
        if (!isMounted) return
        setDocInfo(info)

        if (info.valid && info.storage_path) {
          // Obtém URL assinada de curta duração para download/visualização direta
          const signedUrl = await getDocumentSignedUrl(info.storage_path, 1800)
          if (isMounted) setFileUrl(signedUrl)
        }
      } catch (err) {
        if (isMounted) {
          setDocInfo({
            valid: false,
            error: 'Ocorreu um erro ao consultar o documento.',
          })
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadDoc()

    return () => {
      isMounted = false
    }
  }, [token])

  // Contador de tempo restante de expiração do link
  useEffect(() => {
    if (!docInfo?.expires_at) return

    const updateTimer = () => {
      const expires = new Date(docInfo.expires_at!).getTime()
      const now = Date.now()
      const diff = expires - now

      if (diff <= 0) {
        setTimeRemainingStr('Link expirado')
        setDocInfo((prev) =>
          prev ? { ...prev, valid: false, error: 'Este link temporário expirou.' } : prev,
        )
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (hours > 0) {
        setTimeRemainingStr(`${hours}h ${minutes}m restantes`)
      } else {
        setTimeRemainingStr(`${minutes}m ${seconds}s restantes`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [docInfo?.expires_at])

  const isImage = docInfo?.mime_type?.startsWith('image/')
  const isPdf = docInfo?.mime_type === 'application/pdf'

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between p-4 sm:p-6 text-ink">
      {/* Cabeçalho de marca seguro */}
      <header className="max-w-md mx-auto w-full pt-2 pb-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-ink flex items-center justify-center shadow-xs">
            <CuriangoLogo size={18} color="#FCA311" />
          </div>
          <span className="text-sm font-bold tracking-tight text-ink">Curiangoo</span>
        </Link>

        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-income-subtle border border-line px-2.5 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-income" />
          Link Seguro
        </span>
      </header>

      {/* Conteúdo Central */}
      <main className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center my-auto">
        {loading ? (
          <div className="bg-surface rounded-3xl p-8 border border-line shadow-cds text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-action mx-auto" />
            <p className="text-sm font-semibold text-ink">Acessando documento seguro...</p>
            <p className="text-xs text-body2">Verificando prazo de expiração e chave do link</p>
          </div>
        ) : !docInfo?.valid ? (
          <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-line shadow-cds text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-expense-subtle text-expense flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-base font-semibold text-ink">Acesso Indisponível</h1>
              <p className="text-xs text-body2">
                {docInfo?.error || 'Este link de compartilhamento não é mais válido.'}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-surface-2 border border-line text-[11px] text-body2 text-left">
              <p className="font-semibold text-ink mb-0.5">Por que isso acontece?</p>
              <p>
                Os links de documentos do Curiangoo são temporários e seguros (máximo 24h) ou podem
                ter sido revogados pelo proprietário. Solicite um novo link se necessário.
              </p>
            </div>
            <Link to="/">
              <Button
                type="button"
                variant="outline"
                className="w-full text-xs rounded-xl border-line mt-2"
              >
                Conhecer o Curiangoo
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-surface rounded-3xl p-5 sm:p-6 border border-line shadow-cds space-y-4">
            {/* Topo do documento */}
            <div className="space-y-1 text-left">
              <div className="flex items-center justify-end gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-warning border border-line">
                  <Clock className="w-3 h-3" />
                  {timeRemainingStr}
                </span>
              </div>
              <h1 className="text-base font-semibold text-ink leading-snug">{docInfo.title}</h1>
              <p className="text-xs text-body2">
                {docInfo.file_name} •{' '}
                {formatDocumentSubtitle(
                  docInfo.mime_type,
                  docInfo.file_size_bytes || 0,
                  docInfo.file_name,
                )}
              </p>
            </div>

            {/* Visualização inline da imagem ou PDF */}
            <div className="rounded-2xl bg-surface-2 overflow-hidden border border-line flex items-center justify-center min-h-[220px] max-h-[380px]">
              {fileUrl ? (
                isImage ? (
                  <img
                    src={fileUrl}
                    alt={docInfo.title}
                    className="w-full h-full object-contain max-h-[360px]"
                  />
                ) : isPdf ? (
                  <div className="p-6 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-expense-subtle text-expense flex items-center justify-center shadow-xs">
                      <FileText className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink">{docInfo.file_name}</p>
                      <p className="text-[11px] text-body2 mt-0.5">Documento PDF seguro</p>
                    </div>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ink text-white text-xs font-semibold hover:bg-ink-hover transition-colors"
                    >
                      <span>Abrir PDF Completo</span>
                      <ExternalLink className="w-3.5 h-3.5 text-action" />
                    </a>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <FileText className="w-8 h-8 text-body3 mx-auto mb-2" />
                    <p className="text-xs text-ink">{docInfo.file_name}</p>
                  </div>
                )
              ) : (
                <Loader2 className="w-6 h-6 animate-spin text-action" />
              )}
            </div>

            {/* Ações: Download do arquivo */}
            {fileUrl && (
              <a
                href={fileUrl}
                download={docInfo.file_name}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-ink hover:bg-ink-hover text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Download className="w-4 h-4 text-action" />
                <span>Baixar Documento</span>
              </a>
            )}

            {/* Aviso de privacidade e expiração */}
            <div className="p-3 rounded-2xl bg-surface-2 border border-line flex items-start gap-2 text-[11px] text-body2">
              <Lock className="w-3.5 h-3.5 text-body3 shrink-0 mt-0.5" />
              <span>
                Este link expira automaticamente. Nenhum dado cadastral pessoal além deste arquivo
                foi exposto.
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Rodapé simples */}
      <footer className="max-w-md mx-auto w-full pt-4 pb-2 text-center text-[11px] text-slate-400">
        Curiangoo • Finanças Familiares com Proteção de Dados
      </footer>
    </div>
  )
}
