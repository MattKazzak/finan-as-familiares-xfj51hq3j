import { useFamily } from '@/hooks/use-family'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Check, Sparkles } from 'lucide-react'

interface WhoIsUsingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WhoIsUsingDialog({ open, onOpenChange }: WhoIsUsingDialogProps) {
  const { members, activeMemberId, setActiveMemberId } = useFamily()

  // Regra de segurança: se houver menos de 2 membros, o diálogo não deve ser exibido.
  // Seleciona automaticamente o membro único caso haja 1 membro.
  const hasMultipleMembers = members.length > 1
  const isActuallyOpen = open && hasMultipleMembers

  const handleSelectMember = (id: string) => {
    setActiveMemberId(id)
    onOpenChange(false)
  }

  if (!hasMultipleMembers) {
    return null
  }

  return (
    <Dialog open={isActuallyOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-[92vw] rounded-3xl p-6">
        <DialogHeader className="text-center sm:text-center pb-2">
          <div className="w-12 h-12 rounded-2xl bg-surface-2 text-ink flex items-center justify-center mx-auto mb-2 shadow-inner">
            <Sparkles className="w-6 h-6 stroke-[2]" />
          </div>
          <DialogTitle className="text-lg font-bold text-ink">Quem está usando?</DialogTitle>
          <DialogDescription className="text-xs text-body2">
            Selecione seu perfil para personalizar a experiência e saudações neste aparelho.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 pt-2">
          {members.map((member) => {
            const isSelected = activeMemberId === member.id
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => handleSelectMember(member.id)}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all duration-150 ${
                  isSelected
                    ? 'border-action bg-action/10 shadow-sm ring-2 ring-action/25'
                    : 'border-line hover:bg-surface-2 hover:border-line'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 border border-emerald-200">
                    <AvatarFallback className="bg-gradient-to-tr from-ink to-ink/80 text-action font-bold text-sm">
                      {member.name.charAt(0).toUpperCase()}
                    </AvatarFallback>{' '}
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-ink">
                        <span>{member.name}</span>
                      </span>
                      {member.is_admin ? (
                        <span className="text-[10px] bg-surface-2 text-body font-semibold px-2 py-0.5 rounded-full">
                          <span>Admin</span>
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[11px] text-body2">
                      <span>
                        {isSelected
                          ? 'Perfil ativo neste aparelho'
                          : member.user_id
                            ? 'Toque para selecionar'
                            : 'Sem conta (excluída) — histórico da família'}
                      </span>
                    </span>
                  </div>
                </div>

                {isSelected ? (
                  <div className="w-6 h-6 rounded-full bg-action text-white flex items-center justify-center shadow-sm font-semibold">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
