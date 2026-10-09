import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import type { FamilyMember, FamilyInvite } from '@/types/finance'
import {
  generateFamilyInvite,
  fetchFamilyInvites,
  fetchUserIncompleteFamilies,
  deleteFamilyWorkspaceManually,
} from '@/services/family'
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
  UserPlus,
  Copy,
  Clock,
  KeyRound,
  Shield,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  formatBRL,
  formatFamilyDisplayName,
  formatNumberBRL,
  parseBRLToCents,
  normalizeFamilyName,
} from '@/lib/formatters'
import { ApplyBudgetModelDialog } from '@/components/wallet/ApplyBudgetModelDialog'
import { InstallInstructionsModal } from '@/components/common/InstallInstructionsModal'
import { CategoryManagementDialog } from '@/components/categories/CategoryManagementDialog'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import { Sparkles, Landmark } from 'lucide-react'
import packageJson from '../../package.json'
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
    leaveFamily,
    joinFamilyWithCode,
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
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false)

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

  // Carregamento prolongado (> ~2s): substitui skeleton por estado textual honesto
  const [isLongLoading, setIsLongLoading] = useState(false)
  const isFamilyResolved = Boolean(family?.id)

  useEffect(() => {
    if (isFamilyResolved) {
      setIsLongLoading(false)
      return
    }
    const timer = setTimeout(() => {
      setIsLongLoading(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [isFamilyResolved])

  // Diálogo Adicionar/Editar Membro
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)
  const [memberName, setMemberName] = useState('')
  const [savingMember, setSavingMember] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null)

  // Sistema de Convites
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [currentInvite, setCurrentInvite] = useState<FamilyInvite | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Ação: Entrar em uma Família com Código
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false)
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [joiningFamily, setJoiningFamily] = useState(false)

  // Ação: Sair da Família (Convidado)
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false)
  const [leavingFamilyState, setLeavingFamilyState] = useState(false)

  // Gestão de outras famílias incompletas (Tarefa 2.3)
  const [incompleteFamilies, setIncompleteFamilies] = useState<Array<any>>([])
  const [deletingIncompleteFamId, setDeletingIncompleteFamId] = useState<string | null>(null)

  const loadIncompleteFamilies = useCallback(async () => {
    try {
      const list = await fetchUserIncompleteFamilies(family?.id)
      setIncompleteFamilies(list)
    } catch (err) {
      console.warn('Erro ao carregar famílias incompletas no Perfil:', err)
    }
  }, [family?.id])

  useEffect(() => {
    loadIncompleteFamilies()
  }, [loadIncompleteFamilies])

  const handleDeleteIncompleteFamily = async (famId: string) => {
    try {
      setDeletingIncompleteFamId(famId)
      await deleteFamilyWorkspaceManually(famId)
      toast({
        title: 'Família removida',
        description: 'O workspace incompleto foi excluído com sucesso.',
      })
      await loadIncompleteFamilies()
      triggerRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir família',
        description: err?.message || 'Não foi possível excluir a família incompleta.',
        variant: 'destructive',
      })
    } finally {
      setDeletingIncompleteFamId(null)
    }
  }

  const openEditFamilyDialog = () => {
    // Se o nome atual começar com 'Família ', preenche apenas o sufixo no input
    // para casar com o prefixo visual fixo 'Família'
    const currentName = family?.name?.trim() || ''
    const strippedName = currentName.replace(/^Família\s+/i, '').trim()
    setFamilyNameInput(strippedName || currentName)
    setIsEditFamilyOpen(true)
  }

  const handleSaveFamily = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = familyNameInput.trim()
    if (!trimmed) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite o nome da sua família.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSavingFamily(true)
      const normalized = normalizeFamilyName(trimmed)
      await updateFamily({ name: normalized })
      setIsEditFamilyOpen(false)
      triggerRefresh()
      toast({
        title: 'Nome da família atualizado!',
        description: `O espaço agora se chama ${normalized}.`,
      })
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

  // Determina se o usuário conectado é Admin da Família
  const isFamilyAdmin =
    family?.created_by === user?.id || members.some((m) => m.user_id === user?.id && m.is_admin)

  // Abre modal de convite e carrega último convite ativo ou gera um novo
  const handleOpenInviteModal = async () => {
    if (!family) return
    setIsInviteModalOpen(true)
    setCopiedCode(false)
    setCopiedLink(false)

    try {
      setGeneratingInvite(true)
      const list = await fetchFamilyInvites(family.id)
      const active = list.find(
        (i) =>
          i.status === 'pending' &&
          new Date(i.expires_at) > new Date() &&
          i.uses_count < i.max_uses,
      )
      if (active) {
        setCurrentInvite(active)
      } else {
        const fresh = await generateFamilyInvite(family.id)
        setCurrentInvite(fresh)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar convite',
        description: err?.message || 'Não foi possível gerar convite no momento.',
        variant: 'destructive',
      })
    } finally {
      setGeneratingInvite(false)
    }
  }

  const handleRegenerateInvite = async () => {
    if (!family) return
    try {
      setGeneratingInvite(true)
      const fresh = await generateFamilyInvite(family.id)
      setCurrentInvite(fresh)
      setCopiedCode(false)
      setCopiedLink(false)
      toast({
        title: 'Novo convite gerado!',
        description: 'Código e link de 7 dias criados com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar convite',
        description: err?.message || 'Limite atingido ou permissão negada.',
        variant: 'destructive',
      })
    } finally {
      setGeneratingInvite(false)
    }
  }

  const handleCopy = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'code') {
        setCopiedCode(true)
        setTimeout(() => setCopiedCode(false), 2500)
      } else {
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2500)
      }
      toast({
        title: 'Copiado para a área de transferência!',
        description: type === 'code' ? 'Código de convite copiado.' : 'Link mágico copiado.',
      })
    } catch {
      toast({
        title: 'Falha ao copiar',
        description: 'Selecione e copie manualmente o texto.',
        variant: 'destructive',
      })
    }
  }

  const handleJoinFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = joinCodeInput.trim().toUpperCase()
    if (!clean) return

    try {
      setJoiningFamily(true)
      await joinFamilyWithCode(clean)
      setIsJoinDialogOpen(false)
      setJoinCodeInput('')
      triggerRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro ao entrar na família',
        description: err?.message || 'Código inválido, expirado ou família cheia.',
        variant: 'destructive',
      })
    } finally {
      setJoiningFamily(false)
    }
  }

  const handleConfirmLeaveFamily = async () => {
    try {
      setLeavingFamilyState(true)
      await leaveFamily()
      setIsLeaveDialogOpen(false)
      triggerRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro ao sair da família',
        description: err?.message || 'Não foi possível sair no momento.',
        variant: 'destructive',
      })
    } finally {
      setLeavingFamilyState(false)
    }
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
  const appVersion = packageJson.version || '0.0.181'

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full min-w-0">
      {/* 1. Card da Família (Hero Editável) - Identidade Azul-Marinho #14213D */}
      <div className="bg-gradient-to-br from-[#14213D] via-[#192a4f] to-[#0e172a] rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-[#14213D]/20 border border-[#14213D] flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
          {/* Avatar da Família com Inicial ou Imagem */}
          <div className="shrink-0">
            <Avatar className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-sm border-2 border-[#FCA311]/50 text-white font-semibold text-2xl sm:text-3xl shadow-lg overflow-hidden">
              {family?.avatar_url && (
                <AvatarImage
                  src={family.avatar_url}
                  alt={family.name}
                  className="w-full h-full object-cover"
                />
              )}
              <AvatarFallback className="bg-[#14213D] text-[#FCA311] font-semibold text-2xl sm:text-3xl flex items-center justify-center w-full h-full">
                {familyInitial}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-semibold tracking-widest text-[#FCA311] block mb-0.5">
              Família Registrada
            </span>
            <h2 className="text-lg sm:text-2xl font-semibold tracking-tight text-white leading-tight break-words [text-wrap:balance] min-h-[1.75rem] flex items-center">
              {family?.name ? (
                formatFamilyDisplayName(family.name)
              ) : isLongLoading ? (
                <span className="text-sm font-medium text-white/70 animate-pulse">
                  Carregando seus dados...
                </span>
              ) : (
                <span className="inline-block h-6 w-36 bg-white/20 rounded-lg animate-pulse" />
              )}
            </h2>
            <p className="text-xs text-white/70 mt-1 truncate">Conta: {user?.email || 'Usuário'}</p>
          </div>
        </div>

        {/* ÚNICA ação de edição clara e bem posicionada */}
        <Button
          onClick={openEditFamilyDialog}
          variant="secondary"
          size="sm"
          className="bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-semibold rounded-xl h-9 px-3.5 shadow-sm shrink-0 w-full sm:w-auto justify-center gap-1.5"
        >
          <Pencil className="w-3.5 h-3.5 text-[#FCA311]" />
          <span>Editar Família</span>
        </Button>
      </div>

      {/* 2. Card de Renda Líquida Mensal da Família (Base do Orçamento) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
        {/* Cabeçalho padronizado: Ícone + Título + Badge + Descrição + Ação alinhada */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-[#E5E5E5] text-[#14213D] flex items-center justify-center font-bold shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-[#14213D] leading-tight">
                  Renda Líquida Mensal Familiar
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E5E5E5] text-[#14213D] shrink-0">
                  Base dos cálculos
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-normal break-words">
                Valor líquido que efetivamente entra na conta familiar para cálculo dos tetos
                ideais.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setIsApplyModelOpen(true)}
            variant="outline"
            size="sm"
            className="text-xs font-bold rounded-xl border-[#E5E5E5] text-[#14213D] hover:bg-[#E5E5E5]/50 gap-1.5 h-9 shrink-0 w-full sm:w-auto justify-center"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FCA311]" />
            <span>Aplicar modelo sugerido</span>
          </Button>
        </div>

        {/* Linha de Valor com hierarquia clara e alinhamento responsivo */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {isEditingIncome ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-md w-full">
              <div className="relative flex-1 min-w-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  R$
                </span>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={incomeInputStr}
                  onChange={(e) => setIncomeInputStr(e.target.value)}
                  className="pl-9 text-sm font-bold rounded-xl h-9 w-full"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
                  className="bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] text-xs rounded-xl h-9 font-bold flex-1 sm:flex-initial px-4"
                >
                  Salvar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingIncome(false)}
                  disabled={savingIncome}
                  className="text-xs rounded-xl h-9 text-slate-500 flex-1 sm:flex-initial px-3"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-3 flex-wrap">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Renda Líquida Cadastrada
                </span>
                <span className="text-xl sm:text-2xl font-semibold text-slate-900 tabular-nums">
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
                className="text-xs text-[#14213D] hover:bg-[#E5E5E5]/60 rounded-xl h-8 px-2.5 font-bold self-center"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1" />
                {family?.monthly_net_income_cents && family.monthly_net_income_cents > 0
                  ? 'Alterar valor'
                  : 'Definir agora'}
              </Button>
            </div>
          )}

          <p className="text-left sm:text-right text-[11px] text-slate-400 shrink-0">
            Usado para ajustar tetos por % e farol preventivo
          </p>
        </div>
      </div>

      {/* 3. Seletor 'Quem está usando?' por Aparelho (apenas quando houver 2 ou mais membros) */}
      {members.length > 1 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
          <div className="flex items-start sm:items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base text-slate-900 leading-tight">
                Quem está usando este aparelho?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-normal break-words">
                Alterne para personalizar a saudação "Olá, {currentMember?.name || 'Nome'}!" neste
                dispositivo.
              </p>
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
                  className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all min-w-0 ${
                    isSelected
                      ? 'border-[#FCA311] bg-[#FCA311]/10 shadow-sm ring-2 ring-[#FCA311]/25'
                      : 'border-[#E5E5E5] hover:bg-[#E5E5E5]/40 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden mr-2">
                    <Avatar className="w-8 h-8 border border-[#FCA311]/50 shrink-0">
                      <AvatarFallback className="bg-gradient-to-tr from-[#14213D] to-[#1f3159] text-[#FCA311] font-bold text-xs">
                        {member.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-slate-900 truncate">{member.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {member.is_admin ? 'Administrador' : 'Membro'}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-[#FCA311] text-[#14213D] flex items-center justify-center text-xs shadow-sm shrink-0 font-semibold">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Gestão de Famílias Incompletas (Tarefa 2.3) */}
      {incompleteFamilies.length > 0 && (
        <div className="bg-amber-50/70 rounded-3xl p-5 sm:p-6 border border-amber-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base leading-tight">
                Outras Famílias Incompletas
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Workspaces antigos com configuração pendente vinculados à sua conta.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {incompleteFamilies.map((incFam) => (
              <div
                key={incFam.id}
                className="bg-white rounded-2xl p-3.5 sm:p-4 border border-amber-200/60 flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800 text-sm truncate">
                    {incFam.name || 'Família sem nome'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {incFam.catCount}/19 categorias • {incFam.subcatCount}/116 subcategorias •{' '}
                    {incFam.ruleCount} regras
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={deletingIncompleteFamId === incFam.id}
                  onClick={() => handleDeleteIncompleteFamily(incFam.id)}
                  className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 h-8 sm:h-9 rounded-xl text-xs font-semibold shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  {deletingIncompleteFamId === incFam.id ? 'Excluindo...' : 'Apagar'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Membros da Família */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-slate-900 leading-tight">
                  Membros da Família
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                  {members.length}/5 membros
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-normal break-words">
                Pessoas com acesso à conta compartilhada e lançamentos
              </p>
            </div>
          </div>

          {/* Botões perfeitamente alinhados: grid no mobile, flex no sm+ */}
          <div className="grid grid-cols-1 sm:flex items-center gap-2 w-full sm:w-auto shrink-0">
            {isFamilyAdmin ? (
              <Button
                onClick={handleOpenInviteModal}
                className="bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold text-xs rounded-xl shadow-sm gap-1.5 h-9 w-full sm:w-auto justify-center border-0"
              >
                <UserPlus className="w-4 h-4 stroke-[2.5]" />
                <span>Convidar membro</span>
              </Button>
            ) : (
              <Button
                onClick={() => setIsLeaveDialogOpen(true)}
                variant="outline"
                className="text-xs font-semibold text-red-600 border-red-200 hover:bg-red-50 rounded-xl h-9 gap-1 w-full sm:w-auto justify-center"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair da família</span>
              </Button>
            )}

            <Button
              onClick={() => setIsJoinDialogOpen(true)}
              variant="outline"
              className="text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 rounded-xl h-9 gap-1.5 w-full sm:w-auto justify-center"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
              <span>Entrar com código</span>
            </Button>
          </div>
        </div>

        {/* Lista de Membros com alinhamento refinado */}
        <div className="divide-y divide-slate-100">
          {members.map((member) => (
            <div
              key={member.id}
              className="py-3 sm:py-3.5 flex items-center justify-between hover:bg-slate-50/70 rounded-2xl px-2 transition-colors gap-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar className="w-10 h-10 border border-emerald-100 shrink-0">
                  <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-sm">
                    {member.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900 truncate">{member.name}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        member.is_admin
                          ? 'bg-emerald-100 text-emerald-800 flex items-center gap-1'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {member.is_admin && <Shield className="w-3 h-3 text-emerald-700" />}
                      {member.is_admin ? 'Admin' : 'Membro'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {member.is_admin
                      ? 'Gerencia convites e configurações'
                      : 'Acesso total a lançamentos'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {isFamilyAdmin && (
                  <button
                    type="button"
                    onClick={() => openEditMemberDialog(member)}
                    className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors"
                    title="Renomear membro"
                    aria-label={`Renomear ${member.name}`}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                {isFamilyAdmin && !member.is_admin && (
                  <button
                    type="button"
                    onClick={() => setMemberToDelete(member)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Remover membro"
                    aria-label={`Remover ${member.name}`}
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
        <div className="bg-gradient-to-br from-[#14213D] via-[#192a4f] to-[#0e172a] rounded-3xl p-5 sm:p-6 text-white shadow-lg shadow-[#14213D]/25 border border-[#14213D]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
              <div
                data-testid="profile-install-logo"
                aria-label="Curiangoo"
                className="w-12 h-12 rounded-2xl bg-[#14213D] border border-white/20 p-1 flex items-center justify-center shrink-0 shadow-inner"
              >
                <CuriangoLogo size={32} color="#FCA311" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base text-white flex items-center gap-1.5 leading-tight">
                  <span>📲 Instalar aplicativo no celular</span>
                </h3>
                <p className="text-xs text-emerald-100/90 mt-1 leading-normal break-words">
                  Tenha acesso rápido direto da sua tela inicial
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleInstallShortcutClick}
              disabled={isInstalling}
              className="bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold text-xs rounded-xl h-9 px-4 shadow-md active:scale-95 transition-all w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 border-0"
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

      {/* 6. Configurações do Sistema e Preferências */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-base text-slate-900 leading-tight">Preferências</h4>
            <p className="text-xs text-slate-500 mt-1">Configurações regionais e da sua conta</p>
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-b border-slate-100 gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800">Catálogo de Categorias</p>
            <p className="text-[11px] text-slate-500">
              Gerencie gavetas ou restaure o catálogo padrão canônico
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsCategoryManagementOpen(true)}
            className="text-xs rounded-xl h-8 border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
          >
            Gerenciar / Restaurar
          </Button>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-slate-100 gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800">Formato de Moeda</p>
            <p className="text-[11px] text-slate-500">Padrão nacional do sistema</p>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full shrink-0">
            BRL (R$)
          </span>
        </div>

        {/* Botão Sair com visual limpo */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 text-xs font-semibold text-red-600 hover:text-red-700 p-2.5 rounded-xl hover:bg-red-50 transition-colors w-full sm:w-auto"
          >
            <LogOut className="w-4 h-4 shrink-0" />
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
                <AvatarFallback className="bg-emerald-700 text-white font-semibold text-3xl">
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
                Nome da família
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-2 rounded-xl border border-slate-200 shrink-0">
                  Família
                </span>
                <Input
                  id="family-name-input"
                  type="text"
                  placeholder="Ex.: Silva, Oliveira, Ferreira"
                  value={familyNameInput}
                  onChange={(e) => setFamilyNameInput(e.target.value)}
                  className="text-xs flex-1"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                O nome atualizado aparecerá imediatamente no cabeçalho e na tela inicial.
              </p>
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

      {/* MODAL DE GERENCIAMENTO E RESTAURAÇÃO DE CATEGORIAS */}
      <CategoryManagementDialog
        open={isCategoryManagementOpen}
        onOpenChange={setIsCategoryManagementOpen}
      />

      {/* Rodapé de Versão com versão dinâmica sincronizada */}
      <div className="text-center pt-2 pb-4">
        <span className="text-[11px] text-slate-400 font-medium">
          Versão {appVersion} • Finanças Familiares
        </span>
      </div>

      {/* MODAL CONVIDAR MEMBRO (ADMIN GERA CÓDIGO E LINK) */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="max-w-md w-[92vw] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-700" />
              <span>Convidar Cônjuge ou Familiar</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Envie o código ou o link mágico para seu parceiro(a) entrar nesta mesma família.
            </DialogDescription>
          </DialogHeader>

          {generatingInvite ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <p className="text-xs">Gerando código seguro...</p>
            </div>
          ) : currentInvite ? (
            <div className="space-y-4 pt-1">
              {/* Código de Convite */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Código de Convite (6–8 caracteres)
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xl sm:text-2xl font-semibold tracking-wider text-emerald-950 font-mono">
                    {currentInvite.code}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(currentInvite.code, 'code')}
                    className="h-9 px-3 rounded-xl border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold gap-1.5"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar Código</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Link Mágico */}
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <span className="text-[11px] font-semibold text-emerald-900 block mb-1">
                  Link Mágico (Ideal para WhatsApp)
                </span>
                <p className="text-[11px] text-slate-600 mb-2 leading-relaxed">
                  Quem abrir este link já se cadastra ou entra diretamente na sua família, sem
                  precisar digitar código.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/convite/${currentInvite.code}`}
                    className="text-xs bg-white text-slate-700 h-9 rounded-xl font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      handleCopy(`${window.location.origin}/convite/${currentInvite.code}`, 'link')
                    }
                    className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shrink-0 gap-1.5"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Validade de 7 dias e Regras */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-amber-50/60 border border-amber-200/60 p-2.5 rounded-xl">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Validade de 7 dias:</strong> expira em{' '}
                  {new Date(currentInvite.expires_at).toLocaleDateString('pt-BR')}. Famílias
                  suportam até 5 membros.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerateInvite}
                  disabled={generatingInvite}
                  className="text-xs text-slate-600 hover:text-slate-900"
                >
                  Regerar novo convite
                </Button>
                <Button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs rounded-xl h-9 px-4 font-semibold"
                >
                  Fechar
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO ENTRAR EM UMA FAMÍLIA (COM CÓDIGO) */}
      <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
        <DialogContent className="max-w-sm w-[92vw] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-700" />
              <span>Entrar em uma Família</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cole o código de convite (ex: CURI-7K2X) enviado pelo cônjuge ou administrador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleJoinFamilySubmit} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="join-code-input" className="text-xs font-semibold text-slate-700">
                Código de Convite
              </Label>
              <Input
                id="join-code-input"
                type="text"
                placeholder="Ex: CURI-XXXX"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                className="mt-1 h-11 text-center font-mono font-bold tracking-widest text-base uppercase rounded-xl"
                autoFocus
                required
              />
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Ao entrar, você terá acesso imediato aos lançamentos e categorias desta família.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsJoinDialogOpen(false)}
                disabled={joiningFamily}
                className="rounded-xl text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={joiningFamily || !joinCodeInput.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 font-semibold"
              >
                {joiningFamily && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Entrar na Família
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO CONFIRMAÇÃO DE SAIR DA FAMÍLIA (CONVIDADO) */}
      <AlertDialog
        open={isLeaveDialogOpen}
        onOpenChange={(open) => !open && setIsLeaveDialogOpen(false)}
      >
        <AlertDialogContent className="rounded-3xl max-w-sm w-[92vw] p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <span>Sair da família?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
              <p>
                Você deixará de ter acesso às despesas, receitas, orçamentos e relatórios de{' '}
                <strong>{family?.name}</strong>.
              </p>
              <p>
                Para voltar futuramente, você precisará receber um novo convite do administrador.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel className="text-xs rounded-xl h-9">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLeaveFamily}
              disabled={leavingFamilyState}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl h-9"
            >
              {leavingFamilyState && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Confirmar e Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE MEMBRO (PELO ADMIN) */}
      <AlertDialog
        open={!!memberToDelete}
        onOpenChange={(open) => !open && setMemberToDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl max-w-sm w-[92vw] p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Remover familiar?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              Deseja remover <strong>{memberToDelete?.name}</strong> da família? O usuário perderá o
              acesso imediato ao aplicativo compartilhado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel className="text-xs rounded-xl h-9">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteMember}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl h-9"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
