import React from 'react'
import { Share, PlusSquare, MoreVertical, Smartphone, Check } from 'lucide-react'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Ícone estilizado da Apple para o cenário iOS
function AppleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 170 170" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.74 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.05-7.7-7.85-12.03-14.41-6.09-9.14-11.1-19.46-15.03-30.98-3.92-11.51-5.89-22.38-5.89-32.6 0-14.36 3.69-26.27 11.06-35.73 7.38-9.46 16.5-14.28 27.38-14.47 5.01 0 10.42 1.34 16.23 4.02 5.8 2.68 9.77 4.09 11.89 4.23 1.9-.14 6.09-1.68 12.56-4.63 6.47-2.95 12.18-4.24 17.13-3.87 13.38.87 23.96 5.68 31.74 14.42-11.75 7.17-17.5 16.96-17.26 29.37.24 10.02 4.18 18.52 11.81 25.5 3.59 3.37 7.63 5.99 12.12 7.86-2.5 7.4-5.55 14.74-9.14 22.02zM119.22 31.84c0-7.39 2.66-14.34 7.98-20.85 5.32-6.51 11.85-10.48 19.59-11.91.44 1.3.65 2.62.65 3.96 0 7.39-2.83 14.56-8.49 21.52-5.65 6.96-12.44 10.96-20.37 12-0.12-1.57-.18-3.14-.18-4.72z" />
    </svg>
  )
}

interface InstallInstructionsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isIos: boolean
}

export function InstallInstructionsModal({
  open,
  onOpenChange,
  isIos,
}: InstallInstructionsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-[92vw] rounded-3xl p-6 bg-white border border-line shadow-2xl">
        <DialogHeader className="text-center sm:text-center">
          {/* Logo oficial do Curiangoo */}
          <div
            data-testid="install-modal-logo"
            aria-label="Curiangoo"
            className="mx-auto w-16 h-16 rounded-2xl bg-ink p-2 shadow-lg shadow-black/25 mb-3 flex items-center justify-center border border-ink"
          >
            <CuriangoLogo size={40} color="#FFC629" />
          </div>

          <DialogTitle className="text-lg font-semibold text-ink tracking-tight flex items-center justify-center gap-1.5">
            {isIos ? (
              <span className="inline-flex items-center gap-1.5">
                <AppleIcon className="w-4 h-4 text-ink shrink-0" />
                <span>Instalar no iPhone / iPad</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Instalar Curiangoo</span>
              </span>
            )}
          </DialogTitle>

          <DialogDescription className="text-xs text-body2 mt-1">
            {isIos
              ? 'Siga os passos abaixo no Safari para adicionar à tela inicial do seu dispositivo Apple:'
              : 'Seu navegador não oferece instalação direta em 1 clique. Siga as instruções do menu:'}
          </DialogDescription>
        </DialogHeader>

        {isIos ? (
          /* CENÁRIO B: Instruções para iOS / iPhone / iPad */
          <div className="space-y-3 py-2 text-left">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-2 border border-line">
              <div className="w-8 h-8 rounded-xl bg-ink text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                <AppleIcon className="w-3.5 h-3.5 fill-white" />
              </div>
              <div className="text-xs text-body leading-relaxed">
                Toque no botão{' '}
                <strong className="text-ink font-semibold inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-lg border border-line">
                  <Share className="w-3.5 h-3.5 text-emerald-700 inline" /> Compartilhar
                </strong>{' '}
                (ícone com seta na barra inferior do Safari).
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                2
              </div>
              <div className="text-xs text-body leading-relaxed">
                Role o menu de compartilhamento para baixo e selecione a opção{' '}
                <strong className="text-emerald-900 font-semibold inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-lg border border-emerald-300">
                  <PlusSquare className="w-3.5 h-3.5 text-emerald-700 inline" /> Adicionar à Tela de
                  Início
                </strong>
                .
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-2 border border-line">
              <div className="w-8 h-8 rounded-xl bg-surface-2 text-body flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                3
              </div>
              <div className="text-xs text-body leading-relaxed">
                No canto superior direito, confirme tocando em{' '}
                <strong className="text-ink font-semibold">Adicionar</strong>. O ícone oficial do
                Curiangoo aparecerá na sua tela de início!
              </div>
            </div>
          </div>
        ) : (
          /* CENÁRIO C: Outros navegadores sem suporte ao prompt nativo direto */
          <div className="space-y-3 py-2 text-left">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-2 border border-line">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                1
              </div>
              <div className="text-xs text-body leading-relaxed">
                Toque no ícone de menu com{' '}
                <strong className="text-ink font-semibold inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-lg border border-line">
                  <MoreVertical className="w-3.5 h-3.5 text-emerald-700 inline" /> 3 pontinhos
                </strong>{' '}
                no canto superior ou inferior do navegador.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                2
              </div>
              <div className="text-xs text-body leading-relaxed">
                Procure e selecione a opção{' '}
                <strong className="text-emerald-900 font-semibold inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-lg border border-emerald-300">
                  &ldquo;Instalar aplicativo&rdquo;
                </strong>{' '}
                ou{' '}
                <strong className="text-emerald-900 font-semibold inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-lg border border-emerald-300">
                  &ldquo;Adicionar à tela inicial&rdquo;
                </strong>
                .
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-2 border border-line">
              <div className="w-8 h-8 rounded-xl bg-surface-2 text-body flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                3
              </div>
              <div className="text-xs text-body leading-relaxed">
                Confirme no diálogo do sistema para fixar o atalho com abertura em tela cheia.
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs h-10 gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Entendido</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
