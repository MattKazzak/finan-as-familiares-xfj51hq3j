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
          <div className="w-12 h-12 rounded-2xl bg-[#E5E5E5] text-[#14213D] flex items-center justify-center mx-auto mb-2 shadow-inner">
            <Sparkles className="w-6 h-6 stroke-[2]" />
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900">Quem está usando?</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
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
                    ? 'border-[#FCA311] bg-[#FCA311]/10 shadow-sm ring-2 ring-[#FCA311]/25'
                    : 'border-[#E5E5E5] hover:bg-[#E5E5E5]/40 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 border border-emerald-200">
                    <AvatarFallback className="bg-gradient-to-tr from-[#14213D] to-[#1f3159] text-[#FCA311] font-bold text-sm">
                      {member.name.charAt(0).toUpperCase()}
                    </AvatarFallback>{' '}
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        <span>{member.name}</span>
                      </span>
                      {member.is_admin ? (
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                          <span>Admin</span>
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[11px] text-slate-500">
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
                  <div className="w-6 h-6 rounded-full bg-[#FCA311] text-[#14213D] flex items-center justify-center shadow-sm font-semibold">
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
