import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
// Auditoria 16/10: imports do settlement removidos (migraram pra Carteira/Orçamentos)
import { CreditCard, ExternalLink, ChevronRight, Settings, RotateCcw } from 'lucide-react'
import {
  fetchMySubscription,
  requestCancelSubscription,
  isSubscriptionActive,
  CHECKOUT_URLS,
  type MySubscription,
} from '@/services/subscription'
import { fetchMyAccessStatus, type AccessStatusInfo } from '@/services/access-status'
import { deleteUserAccount, updateUserName, uploadUserAvatar } from '@/services/user-account'
import { evaluatePasswordStrength, isPasswordStrongEnough } from '@/pages/Login'
import { supabase } from '@/lib/supabase/client'
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
  User as UserIcon,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatBRL, formatFamilyDisplayName, normalizeFamilyName } from '@/lib/formatters'
import { ApplyBudgetModelDialog } from '@/components/wallet/ApplyBudgetModelDialog'
import { InstallInstructionsModal } from '@/components/common/InstallInstructionsModal'
import { CategoryManagementDialog } from '@/components/categories/CategoryManagementDialog'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import { Sparkles, AlertCircle } from 'lucide-react'
import { APP_VERSION } from '@/lib/app-version'
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
    openWhoIsUsing,
    addMember,
    editMember,
    removeMember,
    leaveFamily,
    joinFamilyWithCode,
    updateFamily,
    uploadFamilyAvatar,
    triggerRefresh,
    reloadFamily,
  } = useFamily()
  const { toast } = useToast()
  const navigate = useNavigate()
  const {
    isStandalone,
    isIos,
    hasNativePrompt,
    deferredPrompt,
    triggerInstall,
    isDismissed: isPwaBannerDismissed,
  } = usePwaInstall()

  // Estado do modal de instruções PWA (iOS / Outros sem prompt nativo)
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // ===== Minha Conta: avatar, nome, senha e exclusão (LGPD) =====
  const [isAccountNameOpen, setIsAccountNameOpen] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [userNameInput, setUserNameInput] = useState('')
  const [savingUserName, setSavingUserName] = useState(false)
  const [uploadingUserAvatar, setUploadingUserAvatar] = useState(false)
  const userAvatarInputRef = useRef<HTMLInputElement | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const newPasswordStrength = useMemo(() => evaluatePasswordStrength(newPassword), [newPassword])

  const userAvatarUrl = (user?.user_metadata?.avatar_url as string) || null
  const userDisplayName =
    (user?.user_metadata?.name as string) || user?.email?.split('@')[0] || 'Usuário'

  const handleSaveUserName = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = userNameInput.trim()
    if (!trimmed) return
    try {
      setSavingUserName(true)
      await updateUserName(trimmed)
      setIsAccountNameOpen(false)
      toast({ title: 'Nome atualizado!', description: 'Seu nome foi salvo com sucesso.' })
    } catch {
      toast({
        title: 'Erro ao salvar nome',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingUserName(false)
    }
  }

  const handleUserAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    try {
      setUploadingUserAvatar(true)
      await uploadUserAvatar(user.id, file)
      toast({ title: 'Foto atualizada!', description: 'Sua nova foto foi salva.' })
    } catch {
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível enviar a imagem.',
        variant: 'destructive',
      })
    } finally {
      setUploadingUserAvatar(false)
      if (userAvatarInputRef.current) userAvatarInputRef.current.value = ''
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isPasswordStrongEnough(newPassword)) {
      toast({
        title: 'Senha muito fraca',
        description: 'Use no mínimo 8 caracteres, uma letra maiúscula e um número.',
        variant: 'destructive',
      })
      return
    }
    if (newPassword !== confirmNewPassword) {
      toast({
        title: 'As senhas não coincidem',
        description: 'Verifique a confirmação da nova senha.',
        variant: 'destructive',
      })
      return
    }
    try {
      setSavingPassword(true)
      // Reautenticação: confirma a senha atual antes de trocar (padrão de segurança)
      const email = user?.email
      if (!email) throw new Error('Sessão inválida.')
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (signInError) {
        toast({
          title: 'Senha atual incorreta',
          description: 'Confirme sua senha atual para prosseguir.',
          variant: 'destructive',
        })
        return
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setIsPasswordDialogOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      toast({ title: 'Senha alterada!', description: 'Use a nova senha no próximo login.' })
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar senha',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR') return
    try {
      setIsDeletingAccount(true)
      await deleteUserAccount()
      // Limpa o estado local e sai (a sessão já não existe no servidor)
      try {
        localStorage.removeItem('financas_familiares_active_member_id')
      } catch {
        // localStorage indisponível
      }
      try {
        await signOut()
      } catch {
        // Sessão já invalidada no servidor
      }
      toast({ title: 'Conta excluída', description: 'Seus dados foram removidos. Até logo! 💛' })
      navigate('/', { replace: true })
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir conta',
        description: err?.message || 'Tente novamente ou fale com o suporte.',
        variant: 'destructive',
      })
      setIsDeletingAccount(false)
      setIsDeleteAccountOpen(false)
    }
  }
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false)

  // Diálogo Editar Família (Nome e Avatar/Logo)
  const [isEditFamilyOpen, setIsEditFamilyOpen] = useState(false)
  const [familyNameInput, setFamilyNameInput] = useState('')
  const [savingFamily, setSavingFamily] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Renda Líquida Mensal da Família
  // Auditoria 16/10: estados da renda líquida removidos junto do bloco duplicado
  // (a renda agora vive só na aba Orçamentos)
  const [isApplyModelOpen, setIsApplyModelOpen] = useState(false)

  // Redesign estilo Pleo (16/10): hub com acordeão — cada seção é uma LINHA GRANDE
  // (ícone + título + subtítulo + chevron) que expande ao toque. Só 1 aberta por vez.
  const [openSection, setOpenSection] = useState<string | null>(null)
  const toggleSection = (key: string) => setOpenSection((prev) => (prev === key ? null : key))

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

  // ===== Minha Assinatura (billing) =====
  const [subscription, setSubscription] = useState<MySubscription | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(true)
  const [isCancellingSub, setIsCancellingSub] = useState(false)
  // Acesso (modelo C2, 17/10): trial 7d por família → gratuito essencial
  const [accessStatus, setAccessStatus] = useState<AccessStatusInfo>({
    status: 'free',
    days_left: 0,
    trial_end: null,
    plan: null,
    period_end: null,
  })
  const [accessLoading, setAccessLoading] = useState(true)

  const loadAccess = useCallback(async () => {
    try {
      setAccessLoading(true)
      setAccessStatus(await fetchMyAccessStatus())
    } catch (err) {
      console.warn('Erro ao carregar status de acesso:', err)
    } finally {
      setAccessLoading(false)
    }
  }, [])

  const loadSubscription = useCallback(async () => {
    try {
      setSubscriptionLoading(true)
      const sub = await fetchMySubscription()
      setSubscription(sub)
    } catch (err) {
      console.warn('Erro ao carregar assinatura:', err)
      setSubscription(null)
    } finally {
      setSubscriptionLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSubscription()
  }, [loadSubscription])

  useEffect(() => {
    loadAccess()
  }, [loadAccess])

  const handleCancelSubscription = async () => {
    if (!subscription) return
    const confirmed = window.confirm(
      'Cancelar a assinatura? Você continua com acesso até o fim do período já pago.',
    )
    if (!confirmed) return
    try {
      setIsCancellingSub(true)
      await requestCancelSubscription(subscription.id)
      await loadSubscription()
      toast({
        title: 'Assinatura cancelada',
        description: 'Seu acesso continua até o fim do período já pago.',
      })
    } catch (err) {
      console.error('Erro ao cancelar assinatura:', err)
      toast({
        title: 'Não foi possível cancelar',
        description: 'Tente novamente ou fale com o suporte em contato@curiangoo.com.',
        variant: 'destructive',
      })
    } finally {
      setIsCancellingSub(false)
    }
  }

  // ===== Acerto de contas do mês (rateio) =====
  // Auditoria 16/10: estados do settlement removidos (migraram pra Carteira/Orçamentos)

  // Auditoria 16/10: settlement (acerto de contas) migrou pra aba Orçamentos da Carteira —
  // estado e fetch removidos daqui junto com o card.

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
    // Logout completo: limpa o membro ativo do dispositivo (evita herdar seleção em outro login)
    try {
      localStorage.removeItem('financas_familiares_active_member_id')
    } catch {
      // localStorage indisponível
    }
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
  const appVersion = APP_VERSION

  return (
    <div className="space-y-5 max-w-4xl mx-auto w-full min-w-0">
      {/* ================================================
          HERO — Família (versão calma, auditoria 16/10): card branco igual ao resto
          da página, sem selo, sem botão chamativo. Editar = ícone de lápis discreto.
          Premium = badge sutil. A ação de assinatura vive na linha Assinatura do hub.
          ================================================ */}
      <div className="bg-white/95 rounded-3xl p-5 shadow-elevation-1 border border-[rgba(20,33,61,0.06)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <Avatar className="w-12 h-12 rounded-full border border-[rgba(20,33,61,0.08)] text-slate-700 font-semibold text-lg shadow-sm overflow-hidden shrink-0">
            {family?.avatar_url && (
              <AvatarImage
                src={family.avatar_url}
                alt={family.name}
                className="w-full h-full object-cover"
              />
            )}
            <AvatarFallback className="bg-slate-100 text-slate-600 font-semibold text-lg flex items-center justify-center w-full h-full">
              {familyInitial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold tracking-tight text-slate-900 leading-tight break-words [text-wrap:balance] min-h-[1.4rem] flex items-center">
              {family?.name ? (
                formatFamilyDisplayName(family.name)
              ) : isLongLoading ? (
                <span className="text-sm font-medium text-slate-400 animate-pulse">
                  Carregando seus dados...
                </span>
              ) : (
                <span className="inline-block h-5 w-32 bg-slate-100 rounded-lg animate-pulse" />
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{user?.email || 'Usuário'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {subscriptionLoading || accessLoading ? null : (
            <>
              {isSubscriptionActive(subscription) ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  Premium
                </span>
              ) : accessStatus.status === 'trial' ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  Trial: {accessStatus.days_left}d
                </span>
              ) : null}
            </>
          )}
          <button
            type="button"
            onClick={openEditFamilyDialog}
            aria-label="Editar família"
            className="w-9 h-9 rounded-full border border-[rgba(20,33,61,0.08)] bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center transition-colors shadow-sm"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================================================
          GRUPO: FAMÍLIA (linha Pleo — expande ao toque)
          ================================================ */}
      <section
        className="bg-white/95 rounded-3xl border border-[rgba(20,33,61,0.06)] shadow-elevation-1 overflow-hidden"
        aria-label="Família"
      >
        <button
          type="button"
          onClick={() => toggleSection('familia')}
          className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-slate-50/60 transition-colors"
          aria-expanded={openSection === 'familia'}
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 leading-tight">Família</p>
            <p className="text-[11px] text-slate-500 truncate">
              Membros, convites e acerto de contas
            </p>
          </div>
          <ChevronRight
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${openSection === 'familia' ? 'rotate-90' : ''}`}
          />
        </button>
        {openSection === 'familia' && (
          <div>
            {/* Auditoria 16/10: "Renda líquida mensal" REMOVIDA do Perfil — duplicava o
        card de Orçamentos (mesmo diálogo setIsApplyModelOpen em 2 lugares). A renda
        vive exclusivamente na aba Orçamentos, onde tem contexto de baldes. */}
            {/* Resquício removido (17/10): o bloco "Quem está usando este aparelho?" usava
        activeMemberId do localStorage (identidade por APARELHO) — contraria a decisão
        v0.0.386/389: identidade = LOGIN (family_members.user_id). O chip da Home e a
        saudação derivam do login; nada aqui deve trocar "quem está usando". */}{' '}
            {/* Auditoria 16/10: "Acerto de contas do mês" MIGROU pra aba Orçamentos da
            Carteira — é operação do dia a dia (rateio), não configuração de conta. */}
            {/* Membros da família */}{' '}
            <div className="px-5 py-3.5 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-slate-900">Membros da família</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                    {members.length}/5 membros
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isFamilyAdmin ? (
                    <Button
                      onClick={handleOpenInviteModal}
                      className="bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold text-xs rounded-xl shadow-sm gap-1.5 h-8 px-3 border-0"
                    >
                      <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Convidar membro</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setIsLeaveDialogOpen(true)}
                      variant="outline"
                      className="text-xs font-semibold text-red-600 border-red-200 hover:bg-red-50 rounded-xl h-8 gap-1 px-3"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sair da família</span>
                    </Button>
                  )}
                  <Button
                    onClick={() => setIsJoinDialogOpen(true)}
                    variant="outline"
                    className="text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 rounded-xl h-8 gap-1 px-3"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Entrar com código</span>
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-slate-100 mt-1">
                {members.map((member) => (
                  <div key={member.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Avatar className="w-8 h-8 border border-emerald-100 shrink-0">
                        <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-xs">
                          {member.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {member.name}
                          </span>
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${member.is_admin ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
                          >
                            {member.is_admin ? 'Admin' : 'Membro'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {isFamilyAdmin && (
                        <button
                          type="button"
                          onClick={() => openEditMemberDialog(member)}
                          className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Renomear membro"
                          aria-label={`Renomear ${member.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isFamilyAdmin && !member.is_admin && (
                        <button
                          type="button"
                          onClick={() => setMemberToDelete(member)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remover membro"
                          aria-label={`Remover ${member.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ================================================
         GRUPO: ASSINATURA (linha Pleo — expande ao toque)
         ================================================ */}
      <section
        id="sec-assinatura"
        className="bg-white/95 rounded-3xl border border-[rgba(20,33,61,0.06)] shadow-elevation-1 overflow-hidden"
        aria-label="Assinatura"
      >
        <button
          type="button"
          onClick={() => toggleSection('assinatura')}
          className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-slate-50/60 transition-colors"
          aria-expanded={openSection === 'assinatura'}
        >
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 leading-tight">Assinatura</p>
            <p className="text-[11px] text-slate-500 truncate">Plano, cobrança e cancelamento</p>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              subscriptionLoading || accessLoading
                ? 'bg-slate-100 text-slate-400'
                : isSubscriptionActive(subscription)
                  ? 'bg-emerald-100 text-emerald-700'
                  : accessStatus.status === 'trial'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-[#FCA311]/15 text-[#B45309]'
            }`}
          >
            {subscriptionLoading || accessLoading
              ? '…'
              : isSubscriptionActive(subscription)
                ? 'Premium'
                : accessStatus.status === 'trial'
                  ? `Trial ${accessStatus.days_left}d`
                  : 'Inativo'}
          </span>
          <ChevronRight
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${openSection === 'assinatura' ? 'rotate-90' : ''}`}
          />
        </button>
        {openSection === 'assinatura' && (
          <div className="px-5 py-3.5 border-t border-slate-100">
            {subscriptionLoading ? (
              <div className="py-3 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando assinatura...
              </div>
            ) : !subscription ||
              subscription.status === 'canceled' ||
              subscription.status === 'expired' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Você ainda não tem assinatura ativa. Escolha um plano para desbloquear tudo:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href={CHECKOUT_URLS.monthly}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 py-3 px-4 rounded-2xl border-2 border-[#059669] text-[#14213D] hover:bg-emerald-50 transition-colors"
                  >
                    <span className="flex flex-col leading-tight">
                      <span className="font-semibold">R$ 19,90/mês</span>
                      <span className="text-[10px] font-medium text-slate-500">Pix ou cartão</span>
                    </span>
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                  </a>{' '}
                  <a
                    href={CHECKOUT_URLS.yearly}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#059669] to-[#0aa278] text-white hover:opacity-95 transition-opacity"
                  >
                    <span className="flex flex-col leading-tight">
                      <span className="font-semibold">R$ 149,90/ano</span>
                      <span className="text-[10px] font-medium text-emerald-100">
                        Pix ou cartão · economize R$ 89,90
                      </span>
                    </span>
                    <ExternalLink className="w-4 h-4" />
                  </a>{' '}
                </div>
                <p className="text-[11px] text-slate-500">
                  Pagamento processado com segurança. Após assinar, o acesso é liberado
                  automaticamente no e-mail da sua conta.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    Plano {subscription.plan === 'yearly' ? 'Anual' : 'Mensal'}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${isSubscriptionActive(subscription) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                  >
                    {subscription.status === 'active'
                      ? 'Ativa'
                      : subscription.status === 'trial'
                        ? 'Em teste'
                        : subscription.status === 'past_due'
                          ? 'Pagamento pendente'
                          : 'Pendente'}
                  </span>
                </div>
                {subscription.current_period_end && (
                  <p className="text-xs text-slate-600">
                    {isSubscriptionActive(subscription)
                      ? `Próxima renovação em ${new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}`
                      : `Acesso válido até ${new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}`}
                  </p>
                )}
                <p className="text-[11px] text-slate-500">
                  O cartão é cobrado automaticamente. Você pode cancelar quando quiser — sem multa,
                  sem burocracia.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isCancellingSub}
                  onClick={handleCancelSubscription}
                  className="w-full rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                >
                  {isCancellingSub ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    'Cancelar assinatura'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ================================================
         GRUPO: MINHA CONTA (linha Pleo — expande ao toque)
         ================================================ */}
      <section
        className="bg-white/95 rounded-3xl border border-[rgba(20,33,61,0.06)] shadow-elevation-1 overflow-hidden"
        aria-label="Minha conta"
      >
        {' '}
        <button
          type="button"
          onClick={() => toggleSection('conta')}
          className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-slate-50/60 transition-colors"
          aria-expanded={openSection === 'conta'}
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <UserIcon className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 leading-tight">Minha conta</p>
            <p className="text-[11px] text-slate-500 truncate">Nome, senha, sair e excluir</p>
          </div>
          <ChevronRight
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${openSection === 'conta' ? 'rotate-90' : ''}`}
          />
        </button>
        {openSection === 'conta' && (
          <div>
            {/* Identidade: avatar + nome */}
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center gap-3">
              {' '}
              <div className="relative shrink-0">
                <Avatar className="w-11 h-11 border border-[#FCA311]/40">
                  {userAvatarUrl && (
                    <AvatarImage
                      src={userAvatarUrl}
                      alt={userDisplayName}
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="bg-gradient-to-tr from-[#14213D] to-[#1f3159] text-[#FCA311] font-bold text-sm">
                    {userDisplayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => userAvatarInputRef.current?.click()}
                  disabled={uploadingUserAvatar}
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FCA311] text-[#14213D] flex items-center justify-center shadow border-2 border-white"
                  aria-label="Alterar minha foto"
                >
                  {uploadingUserAvatar ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <Camera className="w-2.5 h-2.5" />
                  )}
                </button>
                <input
                  ref={userAvatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUserAvatarChange}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{userDisplayName}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUserNameInput(userDisplayName)
                  setIsAccountNameOpen(true)
                }}
                className="text-[11px] font-semibold text-[#FCA311] hover:bg-[#FCA311]/10 rounded-xl h-8 shrink-0"
              >
                Editar meu nome
              </Button>
            </div>

            {/* Trocar senha */}
            <button
              type="button"
              onClick={() => setIsPasswordDialogOpen(true)}
              className="w-full px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">Alterar senha</p>
                  <p className="text-[11px] text-slate-500">Troque sem sair do aplicativo</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Sair da conta */}
            <button
              type="button"
              onClick={() => setIsSignOutConfirmOpen(true)}
              className="w-full px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <LogOut className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">Sair da conta</p>
                  <p className="text-[11px] text-slate-500">No dispositivo, sem apagar dados</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Excluir conta (LGPD) */}
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmText('')
                setIsDeleteAccountOpen(true)
              }}
              className="w-full px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3 hover:bg-red-50/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-red-700">Excluir minha conta</p>
                  <p className="text-[11px] text-slate-500">Apaga seus dados para sempre (LGPD)</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          </div>
        )}
      </section>

      {/* ================================================
          GRUPO: PREFERÊNCIAS (linha Pleo — expande ao toque)
          ================================================ */}
      <section
        className="bg-white/95 rounded-3xl border border-[rgba(20,33,61,0.06)] shadow-elevation-1 overflow-hidden"
        aria-label="Preferências"
      >
        <button
          type="button"
          onClick={() => toggleSection('preferencias')}
          className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-slate-50/60 transition-colors"
          aria-expanded={openSection === 'preferencias'}
        >
          <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 leading-tight">Preferências</p>
            <p className="text-[11px] text-slate-500 truncate">Catálogo, moeda e instalar app</p>
          </div>
          <ChevronRight
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${openSection === 'preferencias' ? 'rotate-90' : ''}`}
          />
        </button>
        {openSection === 'preferencias' && (
          <div>
            {/* Instalar app — só quando o banner flutuante foi dispensado (auditoria 16/10:
            banner + linha na mesma tela era redundância; agora um complementa o outro) */}
            {!isStandalone && isPwaBannerDismissed && (
              <button
                type="button"
                onClick={handleInstallShortcutClick}
                disabled={isInstalling}
                className="w-full px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    data-testid="profile-install-logo"
                    aria-label="Curiangoo"
                    className="w-9 h-9 rounded-xl bg-[#14213D] flex items-center justify-center shrink-0"
                  >
                    <CuriangoLogo size={20} color="#FCA311" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      📲 Instalar aplicativo no celular
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Tenha acesso rápido direto da sua tela inicial
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#FCA311] shrink-0 flex items-center gap-1">
                  {isInstalling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Instalando...
                    </>
                  ) : hasNativePrompt ? (
                    <>
                      Instalar Agora
                      <Download className="w-3.5 h-3.5" />
                    </>
                  ) : isIos ? (
                    <>
                      Como Instalar
                      <Share className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      Instalar Aplicativo
                      <Download className="w-3.5 h-3.5" />
                    </>
                  )}
                </span>
              </button>
            )}

            {/* Catálogo de categorias */}
            <button
              type="button"
              onClick={() => setIsCategoryManagementOpen(true)}
              className="w-full px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">Catálogo de Categorias</p>
                  <p className="text-[11px] text-slate-500">
                    Gerencie gavetas ou restaure o catálogo padrão canônico
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Moeda */}
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">Formato de Moeda</p>
                  <p className="text-[11px] text-slate-500">Padrão nacional do sistema</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full shrink-0">
                BRL (R$)
              </span>
            </div>

            {/* Reiniciar tour (19/10, Matheus): o usuário pode rever o walkthrough
                quando quiser — padrão Duolingo (revisitar onboarding). Limpa o
                progresso e recarrega: a Home mostra o tour de novo. */}
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">Reiniciar tour</p>
                  <p className="text-[11px] text-slate-500">Rever a apresentação do Curiango</p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { error } = await (supabase as any).rpc('reset_family_tour')
                    if (error) throw error
                    // BUG (19/10, Matheus): reset_family_tour limpa o banco, mas o
                    // contexto continuava com tour_steps_done antigo → a Home não
                    // mostrava o tour, só o toast ("manda uma mensagem"). Agora:
                    // recarrega a família ANTES de navegar — a Home já abre com o
                    // estado zerado e o walkthrough nasce na hora.
                    await reloadFamily()
                    toast({
                      title: 'Tour reiniciado! 🪶',
                      description: 'O Curiango vai te apresentar tudo de novo.',
                    })
                    navigate('/inicio')
                  } catch {
                    toast({
                      title: 'Não foi possível reiniciar',
                      description: 'Tente novamente em instantes.',
                      variant: 'destructive',
                    })
                  }
                }}
                className="shrink-0 text-xs font-bold text-[#14213D] bg-[#FCA311]/15 hover:bg-[#FCA311]/25 px-3.5 py-2 rounded-full transition-colors"
              >
                Reiniciar
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ================================================
          GRUPO: SOBRE (linha Pleo — expande ao toque)
          ================================================ */}
      <section
        className="bg-white/95 rounded-3xl border border-[rgba(20,33,61,0.06)] shadow-elevation-1 overflow-hidden"
        aria-label="Sobre o Curiangoo"
      >
        <button
          type="button"
          onClick={() => toggleSection('sobre')}
          className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-slate-50/60 transition-colors"
          aria-expanded={openSection === 'sobre'}
        >
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 leading-tight">Sobre o Curiangoo</p>
            <p className="text-[11px] text-slate-500 truncate">Privacidade, termos e FAQ</p>
          </div>
          <ChevronRight
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${openSection === 'sobre' ? 'rotate-90' : ''}`}
          />
        </button>
        {openSection === 'sobre' && (
          <div>
            <Link
              to="/privacidade"
              className="px-5 py-3 border-t border-slate-100 flex items-center justify-between hover:bg-slate-50/70"
            >
              {' '}
              <span className="text-sm font-medium text-slate-800">Privacidade</span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </Link>
            <Link
              to="/termos"
              className="px-5 py-3 border-t border-slate-100 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
            >
              <span className="text-sm font-medium text-slate-800">Termos de Uso</span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </Link>
            <Link
              to="/faq"
              className="px-5 py-3 border-t border-slate-100 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
            >
              <span className="text-sm font-medium text-slate-800">Perguntas frequentes</span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </Link>
            <Link
              to="/contato"
              className="px-5 py-3 border-t border-slate-100 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
            >
              <span className="text-sm font-medium text-slate-800">Fale conosco</span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </Link>
          </div>
        )}
      </section>

      {/* Rodapé de Versão com versão dinâmica sincronizada */}
      <div className="text-center pt-1 pb-4">
        <span className="text-[11px] text-slate-400 font-medium">
          Versão {appVersion} • Finanças Familiares
        </span>
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

      {/* CONFIRMAÇÃO DE SAIR DA CONTA (LOGOUT) */}
      <AlertDialog
        open={isSignOutConfirmOpen}
        onOpenChange={(open) => !open && setIsSignOutConfirmOpen(false)}
      >
        <AlertDialogContent className="rounded-3xl max-w-sm w-[92vw] p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Sair da conta?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              Você precisará entrar com e-mail e senha novamente para acessar as finanças da
              família.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel className="text-xs rounded-xl h-9">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setIsSigningOut(true)
                await handleSignOut()
                setIsSigningOut(false)
              }}
              disabled={isSigningOut}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl h-9"
            >
              {isSigningOut && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Sair da conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE CONTA (LGPD) */}
      <AlertDialog
        open={isDeleteAccountOpen}
        onOpenChange={(open) => !open && !isDeletingAccount && setIsDeleteAccountOpen(false)}
      >
        <AlertDialogContent className="rounded-3xl max-w-sm w-[92vw] p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <span>Excluir minha conta?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
              <p>
                Esta ação é <strong>permanente</strong>: suas famílias exclusivas, lançamentos,
                metas e o histórico do Copilot serão apagados para sempre.
              </p>
              <p>
                Famílias com outros membros conectados continuarão existindo — você apenas sai
                delas.
              </p>
              <p className="pt-1 font-semibold">
                Digite <span className="text-red-700">EXCLUIR</span> para confirmar:
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="EXCLUIR"
            className="h-10 text-sm"
            autoComplete="off"
          />
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel className="text-xs rounded-xl h-9" disabled={isDeletingAccount}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteAccount()
              }}
              disabled={isDeletingAccount || deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR'}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl h-9"
            >
              {isDeletingAccount && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Excluir para sempre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALTERAR SENHA (com medidor de força) */}
      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={(open) => !savingPassword && setIsPasswordDialogOpen(open)}
      >
        <DialogContent className="max-w-sm w-[92vw] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-700" />
              <span>Alterar minha senha</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Confirme sua senha atual e escolha uma nova (mín. 8 caracteres, 1 maiúscula, 1
              número).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-3 pt-1">
            <div>
              <Label htmlFor="cur-pass" className="text-xs font-semibold text-slate-700">
                Senha atual
              </Label>
              <Input
                id="cur-pass"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1"
                autoComplete="current-password"
                required
              />
            </div>
            <div>
              <Label htmlFor="new-pass" className="text-xs font-semibold text-slate-700">
                Nova senha
              </Label>
              <div className="relative mt-1">
                <Input
                  id="new-pass"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword && (
                <div className="mt-1.5">
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        [
                          'bg-red-500',
                          'bg-red-500',
                          'bg-amber-500',
                          'bg-emerald-500',
                          'bg-emerald-600',
                        ][newPasswordStrength.score]
                      }`}
                      style={{ width: `${(newPasswordStrength.score / 4) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{newPasswordStrength.label}</p>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="conf-pass" className="text-xs font-semibold text-slate-700">
                Confirmar nova senha
              </Label>
              <Input
                id="conf-pass"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="mt-1"
                autoComplete="new-password"
                required
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPasswordDialogOpen(false)}
                disabled={savingPassword}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingPassword}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {savingPassword && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                Salvar nova senha
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDITAR MEU NOME */}
      <Dialog open={isAccountNameOpen} onOpenChange={setIsAccountNameOpen}>
        <DialogContent className="max-w-xs w-[90vw] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Editar meu nome
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveUserName} className="space-y-4">
            <div>
              <Label htmlFor="acct-name" className="text-xs font-semibold text-slate-700">
                Meu nome
              </Label>
              <Input
                id="acct-name"
                value={userNameInput}
                onChange={(e) => setUserNameInput(e.target.value)}
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
                onClick={() => setIsAccountNameOpen(false)}
                disabled={savingUserName}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingUserName}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {savingUserName && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
