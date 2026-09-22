import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import type { FamilyMember } from '@/types/finance'
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  LogOut,
  Loader2,
  DollarSign,
  Camera,
  Check,
  Smartphone,
  Pencil,
  Download,
  Share,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatBRL, formatNumberBRL, parseBRLToCents } from '@/lib/formatters'
import { ApplyBudgetModelDialog } from '@/components/wallet/ApplyBudgetModelDialog'
import { InstallInstructionsModal } from '@/components/common/InstallInstructionsModal'
import { Sparkles, Landmark } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const {
    family,
    members,
    categories,
    currentMember,
    activeMemberId,
    setActiveMemberId,
    openWhoIsUsing,
    addMember,
    editMember,
    removeMember,
    updateFamily,
    uploadFamilyAvatar,
    triggerRefresh,
  } = useFamily()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { isStandalone, isIos, hasNativePrompt, deferredPrompt, triggerInstall } = usePwaInstall()

  // Estado do modal de instruções PWA (iOS / Outros sem prompt nativo)
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  // Diálogo Editar Família (Nome e Avatar/Logo)
  const [isEditFamilyOpen, setIsEditFamilyOpen] = useState(false)
  const [familyNameInput, setFamilyNameInput] = useState('')
  const [savingFamily, setSavingFamily] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Renda Líquida Mensal da Família
  const [isEditingIncome, setIsEditingIncome] = useState(false)
  const [incomeInputStr, setIncomeInputStr] = useState('')
  const [savingIncome, setSavingIncome] = useState(false)
  const [isApplyModelOpen, setIsApplyModelOpen] = useState(false)

  // Diálogo Adicionar/Editar Membro
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)
  const [memberName, setMemberName] = useState('')
  const [savingMember, setSavingMember] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null)

  const openEditFamilyDialog = () => {
    setFamilyNameInput(family?.name || '')
    setIsEditFamilyOpen(true)
  }

  const handleSaveFamily = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!familyNameInput.trim()) return

    try {
      setSavingFamily(true)
      await updateFamily({ name: familyNameInput.trim() })
      setIsEditFamilyOpen(false)
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao salvar dados da família',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingFamily(false)
    }
  }

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingAvatar(true)
      await uploadFamilyAvatar(file)
      triggerRefresh()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível enviar a imagem.',
        variant: 'destructive',
      })
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    try {
      setUploadingAvatar(true)
      await updateFamily({ avatar_url: null })
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao remover imagem',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const openAddMemberDialog = () => {
    setEditingMember(null)
    setMemberName('')
    setIsMemberDialogOpen(true)
  }

  const openEditMemberDialog = (member: FamilyMember) => {
    setEditingMember(member)
    setMemberName(member.name)
    setIsMemberDialogOpen(true)
  }

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberName.trim()) return

    try {
      setSavingMember(true)
      if (editingMember) {
        await editMember(editingMember.id, memberName)
      } else {
        await addMember(memberName)
      }
      setIsMemberDialogOpen(false)
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao salvar membro',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingMember(false)
    }
  }

  const handleConfirmDeleteMember = async () => {
    if (!memberToDelete) return
    try {
      await removeMember(memberToDelete.id)
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao remover membro',
        description: 'Verifique se ele possui transações vinculadas.',
        variant: 'destructive',
      })
    } finally {
      setMemberToDelete(null)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleInstallShortcutClick = async () => {
    // CENÁRIO A: se deferredPrompt existir (Chrome / Edge / Android), dispara imediatamente o prompt nativo
    // NÃO abre nenhum modal de instruções nesse caso — a janela nativa do sistema assume a tela.
    if (deferredPrompt) {
      try {
        setIsInstalling(true)
        const accepted = await triggerInstall()
        if (accepted) {
          toast({
            title: 'Aplicativo instalado!',
            description: 'O Curiangoo já está disponível na sua tela de início.',
          })
        }
      } finally {
        setIsInstalling(false)
      }
    } else {
      // CENÁRIO B (iOS / iPhone / iPad) ou CENÁRIO C (Outros navegadores sem suporte ao prompt direto)
      // Abre o modal de instruções correspondente dinamicamente
      setIsInstallModalOpen(true)
    }
  }

  const familyInitial = family?.name?.charAt(0).toUpperCase() || 'F'

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 1. Card da Família (Hero Editável) */}
      <div className="bg-gradient-to-br from-[#059669] to-[#0F766E] rounded-3xl p-6 sm:p-7 text-white shadow-xl shadow-emerald-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden group">
        <div className="flex items-center gap-4">
          {/* Avatar Interativo com Troca de Imagem / Inicial */}
          <div className="relative group/avatar">
            <Avatar className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white font-black text-2xl sm:text-3xl shadow-lg shrink-0 overflow-hidden">
              {family?.avatar_url && (
                <AvatarImage
                  src={family.avatar_url}
                  alt={family.name}
                  className="w-full h-full object-cover"
                />
              )}
              <AvatarFallback className="bg-emerald-800/60 text-white font-black text-2xl sm:text-3xl flex items-center justify-center w-full h-full">
                {familyInitial}
              </AvatarFallback>
            </Avatar>

            {/* Botão de Câmera sobreposto no avatar */}
            <button
              type="button"
              onClick={openEditFamilyDialog}
              className="absolute -bottom-1 -right-1 p-1.5 bg-white text-emerald-800 rounded-xl shadow-md hover:scale-105 active:scale-95 transition-transform"
              title="Editar foto ou nome da família"
              aria-label="Editar foto ou nome da família"
            >
              <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          <div className="overflow-hidden">
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-100/90 block">
              Família Registrada
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white truncate">
                Família {family?.name || 'Silva'}
              </h2>
              <button
                type="button"
                onClick={openEditFamilyDialog}
                className="p-1 hover:bg-white/20 rounded-lg text-emerald-100 hover:text-white transition-colors"
                title="Editar nome da família"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-emerald-100/80 mt-0.5 truncate">
              Conta: {user?.email || 'Usuário'}
            </p>
          </div>
        </div>

        <Button
          onClick={openEditFamilyDialog}
          variant="secondary"
          size="sm"
          className="bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-semibold rounded-xl self-start sm:self-center shadow-sm"
        >
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          Editar Família
        </Button>
      </div>

      {/* 1.5. Card de Renda Líquida Mensal da Família (Base do Orçamento) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">
                  Renda Líquida Mensal Familiar
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Base dos cálculos
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Valor líquido que efetivamente entra na conta familiar para cálculo dos tetos
                ideais.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              onClick={() => setIsApplyModelOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs font-semibold rounded-xl border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Aplicar modelo sugerido</span>
            </Button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {isEditingIncome ? (
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  R$
                </span>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={incomeInputStr}
                  onChange={(e) => setIncomeInputStr(e.target.value)}
                  className="pl-9 text-sm font-bold rounded-xl h-9"
                  autoFocus
                />
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    setSavingIncome(true)
                    const cents = parseBRLToCents(incomeInputStr)
                    await updateFamily({ monthly_net_income_cents: cents })
                    setIsEditingIncome(false)
                    triggerRefresh()
                  } catch {
                    toast({
                      title: 'Erro ao salvar renda',
                      description: 'Tente novamente.',
                      variant: 'destructive',
                    })
                  } finally {
                    setSavingIncome(false)
                  }
                }}
                disabled={savingIncome}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl h-9 font-semibold"
              >
                Salvar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingIncome(false)}
                disabled={savingIncome}
                className="text-xs rounded-xl h-9 text-slate-500"
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Renda Líquida Cadastrada
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
                  {family?.monthly_net_income_cents && family.monthly_net_income_cents > 0
                    ? formatBRL(family.monthly_net_income_cents)
                    : 'Não definida'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const curr = family?.monthly_net_income_cents || 0
                  setIncomeInputStr(curr > 0 ? formatNumberBRL(curr) : '')
                  setIsEditingIncome(true)
                }}
                className="text-xs text-emerald-700 hover:bg-emerald-50 rounded-xl h-8 px-2.5 font-semibold"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1" />
                {family?.monthly_net_income_cents && family.monthly_net_income_cents > 0
                  ? 'Alterar valor'
                  : 'Definir agora'}
              </Button>
            </div>
          )}

          <div className="text-right sm:text-left text-[11px] text-slate-400">
            <span>Usado para ajustar tetos por % e farol preventivo</span>
          </div>
        </div>
      </div>

      {/* 2. Seletor 'Quem está usando?' por Aparelho */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Quem está usando este aparelho?
              </h3>
              <p className="text-xs text-slate-500">
                Alterne para personalizar a saudação "Olá, {currentMember?.name || 'Nome'}!" neste
                dispositivo.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
          {members.map((member) => {
            const isSelected = (activeMemberId || currentMember?.id) === member.id
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => {
                  setActiveMemberId(member.id)
                  toast({
                    title: `Olá, ${member.name}!`,
                    description: 'Perfil ativo atualizado neste dispositivo.',
                  })
                }}
                className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-600/20'
                    : 'border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <Avatar className="w-8 h-8 border border-emerald-200 shrink-0">
                    <AvatarFallback className="bg-gradient-to-tr from-emerald-600 to-teal-700 text-white font-bold text-xs">
                      {member.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className="font-bold text-xs text-slate-900 truncate">{member.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {member.is_admin ? 'Administrador' : 'Membro'}
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shadow-sm shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Membros da Família */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="font-bold text-base text-slate-900">Membros da Família</h3>
              <p className="text-xs text-slate-500">
                Pessoas atribuíveis para controle de receitas e despesas
              </p>
            </div>
          </div>

          <Button
            onClick={openAddMemberDialog}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm gap-1"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar membro</span>
          </Button>
        </div>

        <div className="divide-y divide-slate-100">
          {members.map((member) => (
            <div
              key={member.id}
              className="py-3.5 flex items-center justify-between hover:bg-slate-50/70 rounded-2xl px-2 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border border-emerald-100">
                  <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-sm">
                    {member.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{member.name}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        member.is_admin
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {member.is_admin ? 'Administrador' : 'Membro'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Atribuível em transações</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditMemberDialog(member)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                  title="Renomear membro"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                {!member.is_admin && (
                  <button
                    onClick={() => setMemberToDelete(member)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Remover membro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Atalho de Instalação no Celular (apenas quando não estiver em modo standalone) */}
      {!isStandalone && (
        <div className="bg-gradient-to-br from-emerald-900 via-[#064E3B] to-teal-950 rounded-3xl p-5 sm:p-6 text-white shadow-lg shadow-emerald-950/15 border border-emerald-600/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-1 flex items-center justify-center shrink-0 shadow-inner">
                <img
                  src="/icon-192.png"
                  alt="Curiangoo"
                  className="w-full h-full object-contain rounded-xl"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = '/icon.svg'
                  }}
                />
              </div>
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-1.5">
                  <span>📲 Instalar aplicativo no celular</span>
                </h3>
                <p className="text-xs text-emerald-100/90 mt-0.5">
                  Tenha acesso rápido direto da sua tela inicial
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleInstallShortcutClick}
              disabled={isInstalling}
              className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-xs rounded-xl h-10 px-4 shadow-md active:scale-95 transition-all self-start sm:self-center shrink-0 flex items-center gap-1.5"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  <span>Instalando...</span>
                </>
              ) : hasNativePrompt ? (
                <>
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Instalar Agora</span>
                </>
              ) : isIos ? (
                <>
                  <Share className="w-4 h-4 stroke-[2.5]" />
                  <span>Como Instalar</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Instalar Aplicativo</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 6. Configurações do Sistema */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
        <h4 className="font-bold text-sm text-slate-900 mb-2">Preferências</h4>

        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs font-semibold text-slate-800">Formato de Moeda</p>
              <p className="text-[11px] text-slate-500">Padrão nacional do sistema</p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
            BRL (R$)
          </span>
        </div>

        {/* Botão Sair */}
        <div className="pt-2">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-xs font-semibold text-red-600 hover:text-red-700 p-2 rounded-xl hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair da conta compartilhada</span>
          </button>
        </div>
      </div>

      {/* DIÁLOGO EDITAR FAMÍLIA (NOME E FOTO) */}
      <Dialog open={isEditFamilyOpen} onOpenChange={setIsEditFamilyOpen}>
        <DialogContent className="max-w-sm w-[92vw] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Editar Dados da Família
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Altere o sobrenome da família e adicione uma foto ou logotipo personalizado.
            </DialogDescription>
          </DialogHeader>

          {/* Área do Avatar e Upload */}
          <div className="flex flex-col items-center justify-center py-2 space-y-3">
            <div className="relative">
              <Avatar className="w-24 h-24 rounded-3xl border-2 border-emerald-500/30 shadow-md overflow-hidden bg-slate-100">
                {family?.avatar_url && (
                  <AvatarImage
                    src={family.avatar_url}
                    alt={family.name}
                    className="w-full h-full object-cover"
                  />
                )}
                <AvatarFallback className="bg-emerald-700 text-white font-black text-3xl">
                  {familyInitial}
                </AvatarFallback>
              </Avatar>

              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center text-white backdrop-blur-xs">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}
            </div>

            {/* Input escondido para upload de arquivo */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="text-xs rounded-xl"
              >
                <Camera className="w-3.5 h-3.5 mr-1.5" />
                {family?.avatar_url ? 'Trocar foto' : 'Enviar foto/logo'}
              </Button>

              {family?.avatar_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl"
                >
                  Remover foto
                </Button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Formatos aceitos: JPG, PNG, WEBP até 5MB. Se não enviar foto, exibiremos a inicial "
              {familyInitial}".
            </p>
          </div>

          <form onSubmit={handleSaveFamily} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="family-name-input" className="text-xs font-semibold text-slate-700">
                Sobrenome da Família
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-2 rounded-xl border border-slate-200">
                  Família
                </span>
                <Input
                  id="family-name-input"
                  type="text"
                  placeholder="Ex.: Silva, Oliveira, Ferreira"
                  value={familyNameInput}
                  onChange={(e) => setFamilyNameInput(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditFamilyOpen(false)}
                disabled={savingFamily || uploadingAvatar}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingFamily || uploadingAvatar || !familyNameInput.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {savingFamily && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO ADICIONAR / EDITAR MEMBRO */}
      <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
        <DialogContent className="max-w-xs w-[90vw] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingMember ? 'Renomear Membro' : 'Adicionar Membro da Família'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveMember} className="space-y-4">
            <p className="text-xs text-slate-500">
              {editingMember
                ? 'Atualize o nome de identificação.'
                : 'Adiciona um novo familiar para vincular gastos e receitas. Não cria um novo usuário de login.'}
            </p>

            <div>
              <Label htmlFor="mbr-name" className="text-xs font-semibold text-slate-700">
                Nome do Membro
              </Label>
              <Input
                id="mbr-name"
                type="text"
                placeholder="Ex.: Lucas, Maria, Vovô"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="mt-1"
                autoFocus
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsMemberDialogOpen(false)}
                disabled={savingMember}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingMember}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {savingMember && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                {editingMember ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE APLICAÇÃO DO MODELO ORÇAMENTÁRIO */}
      <ApplyBudgetModelDialog
        open={isApplyModelOpen}
        onOpenChange={setIsApplyModelOpen}
        family={family}
        categories={categories}
        onSuccess={() => {
          triggerRefresh()
        }}
      />

      {/* DIÁLOGO / MODAL DE INSTRUÇÕES DE INSTALAÇÃO DO PWA */}
      <InstallInstructionsModal
        open={isInstallModalOpen}
        onOpenChange={setIsInstallModalOpen}
        isIos={isIos}
      />

      {/* Rodapé de Versão */}
      <div className="text-center pt-2 pb-4">
        <span className="text-[11px] text-slate-400 font-medium">
          Versão 0.0.17 • Finanças Familiares
        </span>
      </div>

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE MEMBRO */}
      <AlertDialog
        open={!!memberToDelete}
        onOpenChange={(open) => !open && setMemberToDelete(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Remover familiar?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              Deseja remover <strong>{memberToDelete?.name}</strong> da lista da família? Se houver
              transações vinculadas a este membro, elas deverão ser reatribuídas antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteMember}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
