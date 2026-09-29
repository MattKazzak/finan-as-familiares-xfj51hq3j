import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Home, Wallet, Plus, Target, User, TrendingUp, LogOut, ChevronRight } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useFamily } from '@/hooks/use-family'
import { NewTransactionActionSheet } from '@/components/transactions/NewTransactionActionSheet'
import { RecurringIncomesDialog } from '@/components/wallet/RecurringIncomesDialog'
import { NewTransactionDialog } from '@/components/transactions/NewTransactionDialog'
import { VoiceTransactionDialog } from '@/components/transactions/VoiceTransactionDialog'
import { ImportStatementDialog } from '@/components/transactions/ImportStatementDialog'
import { WhoIsUsingDialog } from '@/components/common/WhoIsUsingDialog'
import { ApplyBudgetModelDialog } from '@/components/wallet/ApplyBudgetModelDialog'
import { OnboardingWizardDialog } from '@/components/wallet/OnboardingWizardDialog'
import { InstallPwaBanner } from '@/components/common/InstallPwaBanner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { formatFamilyDisplayName } from '@/lib/formatters'
import { fetchRecurringIncomes, fetchRecurringIncomeOverrides } from '@/services/recurring-incomes'
import type { RecurringIncome, RecurringIncomeOverride } from '@/types/finance'

export default function Layout() {
  const { signOut } = useAuth()
  const {
    family,
    members,
    currentMember,
    refreshTrigger,
    triggerRefresh,
    openWhoIsUsing,
    isWhoIsUsingOpen,
    setIsWhoIsUsingOpen,
    isNewTransactionOpen,
    setIsNewTransactionOpen,
    openNewTransaction,
    isActionSheetOpen,
    setIsActionSheetOpen,
    openActionSheet,
    isRecurringIncomesOpen,
    setIsRecurringIncomesOpen,
    openRecurringIncomes,
    openImportStatement,
    isImportStatementOpen,
    setIsImportStatementOpen,
    isOnboardingOpen,
    voiceTransactionData,
    setVoiceTransactionData,
    setIsOnboardingOpen,
    categories,
    reloadFamily,
  } = useFamily()

  // Dados globais de receitas fixas para o modal compartilhado
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false)
  const [globalRecurringIncomes, setGlobalRecurringIncomes] = useState<RecurringIncome[]>([])
  const [globalRecurringOverrides, setGlobalRecurringOverrides] = useState<
    RecurringIncomeOverride[]
  >([])

  const currentMonthDate = new Date()
  const currentMonthStr = currentMonthDate.toISOString().slice(0, 7)

  const loadGlobalRecurring = useCallback(async () => {
    if (!family) return
    try {
      const [recIncomes, recOverrides] = await Promise.all([
        fetchRecurringIncomes(family.id),
        fetchRecurringIncomeOverrides(family.id, currentMonthStr),
      ])
      setGlobalRecurringIncomes(recIncomes)
      setGlobalRecurringOverrides(recOverrides)
    } catch (err) {
      console.warn('Erro ao carregar receitas fixas no layout:', err)
    }
  }, [family, currentMonthStr])

  useEffect(() => {
    if (family) {
      loadGlobalRecurring()
    }
  }, [family, loadGlobalRecurring, refreshTrigger])
  const location = useLocation()
  const navigate = useNavigate()

  // Mapeamento de títulos para o header condicional
  const getHeaderTitle = () => {
    switch (location.pathname) {
      case '/inicio':
        return 'Visão Geral'
      case '/carteira':
        return 'Carteira & Extrato'
      case '/orcamentos':
        return 'Orçamentos & 3 Baldes'
      case '/metas':
        return 'Planejamento de Metas'
      case '/investimentos':
        return 'Carteira de Investimentos'
      case '/perfil':
        return 'Família & Configurações'
      default:
        return 'Finanças da Família'
    }
  }

  const navItems = [
    { to: '/inicio', label: 'Início', icon: Home },
    { to: '/carteira', label: 'Carteira', icon: Wallet },
    // FAB no centro no mobile
    { to: '/metas', label: 'Metas', icon: Target },
    { to: '/investimentos', label: 'Investimentos', icon: TrendingUp },
    { to: '/perfil', label: 'Perfil', icon: User },
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const userInitial = currentMember?.name?.charAt(0).toUpperCase() || 'F'

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans antialiased">
      {/* SIDEBAR DESKTOP (>= 768px) */}
      <aside className="hidden md:flex md:w-60 flex-col bg-white border-r border-slate-200/80 fixed inset-y-0 left-0 z-40">
        {/* Logo & Marca */}
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-900/10">
            <span className="text-lg">💰</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-sm text-slate-900 truncate">Finanças da Família</h1>
            <p
              className="text-xs text-slate-500 break-words line-clamp-2 leading-tight"
              title={family ? formatFamilyDisplayName(family.name) : 'Controle Conjunto'}
            >
              {family ? formatFamilyDisplayName(family.name) : 'Controle Conjunto'}
            </p>
          </div>
        </div>

        {/* Botão Nova Transação Desktop */}
        <div className="p-4">
          <Button
            onClick={openActionSheet}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-semibold py-2.5 shadow-md shadow-emerald-700/20 rounded-xl flex items-center justify-center gap-2 transition-all transform active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Nova Transação
          </Button>
        </div>

        {/* Links de navegação */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.to
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 text-emerald-600" />}
              </NavLink>
            )
          })}
        </nav>

        {/* Rodapé do Perfil Desktop */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          {members.length > 1 ? (
            <button
              type="button"
              onClick={openWhoIsUsing}
              title="Trocar quem está usando"
              className="flex items-center gap-2.5 text-left hover:bg-slate-50 p-1.5 rounded-xl transition-colors overflow-hidden flex-1 mr-1 cursor-pointer"
            >
              <Avatar className="w-8 h-8 border border-emerald-200 shrink-0">
                <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-xs">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {currentMember?.name || 'Família'}
                </p>
                <p className="text-[10px] text-emerald-600 truncate font-medium">
                  Trocar usuário ▾
                </p>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2.5 text-left p-1.5 rounded-xl overflow-hidden flex-1 mr-1">
              <Avatar className="w-8 h-8 border border-emerald-200 shrink-0">
                <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-xs">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {currentMember?.name || 'Família'}
                </p>
                <p className="text-[10px] text-slate-400 truncate font-medium">Administrador</p>
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            title="Sair da conta"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL COM SCROLL */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* HEADER TOP (visível em desktop e mobile) */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 py-3 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
              {getHeaderTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {members.length > 1 ? (
              <div
                onClick={openWhoIsUsing}
                title="Toque para trocar quem está usando"
                className="flex items-center gap-2 cursor-pointer group bg-slate-50 hover:bg-emerald-50 px-2.5 py-1 rounded-full border border-slate-200/80 transition-all"
              >
                <Avatar className="w-7 h-7 border border-emerald-200 shadow-sm group-hover:ring-2 group-hover:ring-emerald-400 transition-all">
                  <AvatarFallback className="bg-gradient-to-tr from-emerald-600 to-teal-700 text-white font-bold text-xs">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-slate-700 group-hover:text-emerald-800 transition-colors flex items-center gap-1">
                  <span>{currentMember?.name || 'Família'}</span>
                  <span className="text-[10px] text-slate-400">▾</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200/80">
                <Avatar className="w-7 h-7 border border-emerald-200 shadow-sm">
                  <AvatarFallback className="bg-gradient-to-tr from-emerald-600 to-teal-700 text-white font-bold text-xs">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-slate-700">
                  <span>{currentMember?.name || 'Família'}</span>
                </span>
              </div>
            )}
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL (max-width 1200px centralizado) */}
        <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 sm:p-6 pb-28 md:pb-8 overflow-x-hidden min-w-0">
          <Outlet />
        </main>

        {/* BANNER EDUCATIVO DE INSTALAÇÃO PWA (POSICIONADO ACIMA DO MENU INFERIOR) */}
        <InstallPwaBanner variant="bottom-nav" />

        {/* BOTTOM NAVIGATION (MOBILE APENAS < 768px) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200/80 z-40 px-2 py-1 shadow-lg shadow-slate-900/5">
          <div className="relative flex items-center justify-around h-14">
            {/* 1. Início */}
            <NavLink
              to="/inicio"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                  isActive ? 'text-emerald-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              <Home className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Início</span>
            </NavLink>

            {/* 2. Carteira */}
            <NavLink
              to="/carteira"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                  isActive ? 'text-emerald-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              <Wallet className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Carteira</span>
            </NavLink>

            {/* 3. FAB CENTRAL ELEVADO COM GRADIENTE */}
            <div className="flex-1 flex justify-center -translate-y-5">
              <button
                type="button"
                onClick={openActionSheet}
                className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/30 ring-4 ring-white active:scale-95 transition-transform cursor-pointer"
                aria-label="Nova Transação"
              >
                <Plus className="w-7 h-7 stroke-[2.5]" />
              </button>
            </div>

            {/* 4. Metas */}
            <NavLink
              to="/metas"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                  isActive ? 'text-emerald-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              <Target className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Metas</span>
            </NavLink>

            {/* 5. Perfil */}
            <NavLink
              to="/perfil"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                  isActive ? 'text-emerald-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              <User className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Perfil</span>
            </NavLink>
          </div>
        </nav>
      </div>

      {/* ACTION SHEET GLOBAL DO FAB / NOVA TRANSAÇÃO */}
      <NewTransactionActionSheet
        open={isActionSheetOpen}
        onOpenChange={setIsActionSheetOpen}
        onSelectExpense={() => openNewTransaction('expense')}
        onSelectIncome={() => openNewTransaction('income')}
        onSelectVoiceAI={() => setIsVoiceDialogOpen(true)}
      />

      {/* DIÁLOGO GLOBAL DE LANÇAMENTO POR VOZ COM IA */}
      <VoiceTransactionDialog
        open={isVoiceDialogOpen}
        onOpenChange={setIsVoiceDialogOpen}
        onOpenManualTransaction={(data) => {
          setVoiceTransactionData?.(data)
          openNewTransaction(data.type)
        }}
        onSuccess={() => {
          triggerRefresh()
        }}
      />

      {/* DIÁLOGO GLOBAL DE RECEITAS FIXAS RECORRENTES */}
      <RecurringIncomesDialog
        open={isRecurringIncomesOpen}
        onOpenChange={setIsRecurringIncomesOpen}
        currentMonthDate={currentMonthDate}
        recurringIncomes={globalRecurringIncomes}
        recurringOverrides={globalRecurringOverrides}
        onSuccess={async () => {
          triggerRefresh()
          await loadGlobalRecurring()
        }}
      />

      {/* DIÁLOGO GLOBAL DE NOVA TRANSAÇÃO */}
      <NewTransactionDialog
        open={isNewTransactionOpen}
        onOpenChange={(open) => {
          setIsNewTransactionOpen(open)
          if (!open && setVoiceTransactionData) {
            setVoiceTransactionData(null)
          }
        }}
      />

      {/* DIÁLOGO GLOBAL DE IMPORTAÇÃO DE EXTRATO */}
      <ImportStatementDialog open={isImportStatementOpen} onOpenChange={setIsImportStatementOpen} />

      {/* DIÁLOGO GLOBAL QUEM ESTÁ USANDO */}
      <WhoIsUsingDialog open={isWhoIsUsingOpen} onOpenChange={setIsWhoIsUsingOpen} />

      {/* DIÁLOGO GLOBAL DE ONBOARDING AUTOMÁTICO (OnboardingWizardDialog: Renda Mensal Familiar -> Seu Orçamento em 3 Caixas) */}
      <OnboardingWizardDialog
        open={isOnboardingOpen}
        onOpenChange={(open) => {
          setIsOnboardingOpen(open)
          if (!open && family?.id) {
            sessionStorage.setItem(`onboarding_dismissed_${family.id}`, 'true')
          }
        }}
        family={family}
        onSuccess={async () => {
          if (family?.id) {
            sessionStorage.setItem(`onboarding_dismissed_${family.id}`, 'true')
          }
          // Se a família possui apenas 1 membro, garante que ele esteja imediatamente
          // definido como membro ativo no localStorage e fecha qualquer diálogo "Quem está usando?"
          if (members.length === 1) {
            localStorage.setItem('financas_familiares_active_member_id', members[0].id)
            setIsWhoIsUsingOpen(false)
          }
          await reloadFamily()
          triggerRefresh()
        }}
      />
    </div>
  )
}
