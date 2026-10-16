import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Home, Wallet, Plus, Target, User, TrendingUp, LogOut, ChevronRight } from 'lucide-react'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useFamily } from '@/hooks/use-family'
import { RecurringIncomesDialog } from '@/components/wallet/RecurringIncomesDialog'
import { NewTransactionDialog } from '@/components/transactions/NewTransactionDialog'
import { VoiceTransactionDialog } from '@/components/transactions/VoiceTransactionDialog'
import { ImportStatementDialog } from '@/components/transactions/ImportStatementDialog'

import { ApplyBudgetModelDialog } from '@/components/wallet/ApplyBudgetModelDialog'
import { OnboardingWizardDialog } from '@/components/wallet/OnboardingWizardDialog'
import { InstallPwaBanner } from '@/components/common/InstallPwaBanner'
// 16/10: FAB do Copilot removido do Layout (insight da Home cobre o acesso à IA).
// O componente e o teste continuam no código para a futura captura de voz global.
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
    isNewTransactionOpen,
    setIsNewTransactionOpen,
    openNewTransaction,
    editingRecurringRule,
    setEditingRecurringRule,
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
    isVoiceDialogOpen,
    setIsVoiceDialogOpen,
    loading,
  } = useFamily()

  // Dados globais de receitas fixas para o modal compartilhado
  const [globalRecurringIncomes, setGlobalRecurringIncomes] = useState<RecurringIncome[]>([])
  const [globalRecurringOverrides, setGlobalRecurringOverrides] = useState<
    RecurringIncomeOverride[]
  >([])

  const currentMonthDate = new Date()
  const currentMonthStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`

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
      case '/importar':
        return 'Revisão de Importação'
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-white flex flex-col md:flex-row text-foreground font-sans antialiased">
      {/* SIDEBAR DESKTOP (>= 768px) com identidade profunda #14213D */}
      <aside className="hidden md:flex md:w-60 flex-col bg-brand border-r border-brand/90 text-white fixed inset-y-0 left-0 z-40">
        {/* Logo & Marca Oficial Curiangoo */}
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-brand-amber shadow-md shadow-black/20 shrink-0">
            <CuriangoLogo size={24} color="#FCA311" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-sm text-white tracking-tight truncate">Curiangoo</h1>
            <p
              className="text-xs text-white/70 break-words line-clamp-2 leading-tight"
              title={family?.name ? formatFamilyDisplayName(family.name) : 'Finanças da Família'}
            >
              {family?.name ? formatFamilyDisplayName(family.name) : 'Finanças da Família'}
            </p>
          </div>
        </div>

        {/* Botão Nova Transação Desktop - Primary de ação #FCA311 */}
        <div className="p-4">
          <Button
            onClick={() => openNewTransaction()}
            className="w-full bg-brand-amber hover:bg-[#e08e08] text-brand font-bold py-2.5 shadow-md shadow-black/20 rounded-xl flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer border-0"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
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
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-white/15 text-brand-amber shadow-xs'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? 'text-brand-amber' : 'text-white/60 group-hover:text-white'
                  }`}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 text-brand-amber" />}
              </NavLink>
            )
          })}
        </nav>

        {/* Rodapé do Perfil Desktop (AFINAÇÃO 16/10: identidade vem do login —
            o clique vai pro Perfil; nada de "trocar quem está usando") */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between">
          {members.length > 1 ? (
            <button
              type="button"
              onClick={() => navigate('/perfil')}
              title="Abrir meu perfil"
              className="flex items-center gap-2.5 text-left hover:bg-white/10 p-1.5 rounded-xl transition-colors overflow-hidden flex-1 mr-1 cursor-pointer"
            >
              <Avatar className="w-8 h-8 border border-brand-amber/50 shrink-0">
                <AvatarFallback className="bg-brand-amber text-brand font-bold text-xs">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">
                  {currentMember?.name ? (
                    currentMember.name
                  ) : loading ? (
                    <span className="inline-block h-3 w-16 bg-white/20 rounded animate-pulse align-middle" />
                  ) : (
                    ''
                  )}
                </p>
                <p className="text-[10px] text-brand-amber truncate font-medium">
                  Trocar usuário ▾
                </p>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2.5 text-left p-1.5 rounded-xl overflow-hidden flex-1 mr-1">
              <Avatar className="w-8 h-8 border border-brand-amber/50 shrink-0">
                <AvatarFallback className="bg-brand-amber text-brand font-bold text-xs">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">
                  {currentMember?.name ? (
                    currentMember.name
                  ) : loading ? (
                    <span className="inline-block h-3 w-16 bg-white/20 rounded animate-pulse align-middle" />
                  ) : (
                    ''
                  )}
                </p>
                <p className="text-[10px] text-white/60 truncate font-medium">Administrador</p>
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            title="Sair da conta"
            className="p-1.5 text-white/60 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL COM SCROLL */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen bg-white">
        {/* HEADER TOP (visível em desktop e nas demais páginas; na Home (/inicio) o header moderno fintech já assume o topo no mobile e desktop, evitando cabeçalho duplicado ou barra cinza rígida) */}
        {location.pathname !== '/inicio' && (
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-border px-4 py-3 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-brand tracking-tight">
                {getHeaderTitle()}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {members.length > 1 ? (
                <div
                  onClick={() => navigate('/perfil')}
                  title="Abrir meu perfil"
                  className="flex items-center gap-2 cursor-pointer group bg-brand-gray/40 hover:bg-brand-amber/15 px-2.5 py-1 rounded-full border border-brand-gray transition-all"
                >
                  <Avatar className="w-7 h-7 border border-brand-amber/60 shadow-sm group-hover:ring-2 group-hover:ring-brand-amber transition-all">
                    <AvatarFallback className="bg-gradient-to-tr from-brand to-brand-light text-white font-bold text-xs">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-brand group-hover:text-brand transition-colors flex items-center gap-1">
                    {currentMember?.name ? (
                      <span>{currentMember.name}</span>
                    ) : loading ? (
                      <span className="inline-block h-3 w-14 bg-slate-200 rounded animate-pulse align-middle" />
                    ) : null}
                    <span className="text-[10px] text-slate-400">▾</span>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-brand-gray/40 px-2.5 py-1 rounded-full border border-brand-gray">
                  <Avatar className="w-7 h-7 border border-brand-amber/60 shadow-sm">
                    <AvatarFallback className="bg-gradient-to-tr from-brand to-brand-light text-white font-bold text-xs">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-brand">
                    {currentMember?.name ? (
                      <span>{currentMember.name}</span>
                    ) : loading ? (
                      <span className="inline-block h-3 w-14 bg-slate-200 rounded animate-pulse align-middle" />
                    ) : null}
                  </span>
                </div>
              )}
            </div>
          </header>
        )}

        {/* CONTEÚDO PRINCIPAL: Na Home (/inicio), o topo sangra sem padding superior e lateral para encostar nas bordas, e o miolo fica responsivo */}
        <main
          className={`flex-1 w-full overflow-x-hidden min-w-0 ${
            location.pathname === '/inicio'
              ? 'p-0 pb-32 md:pb-8'
              : 'max-w-[1200px] mx-auto p-4 sm:p-6 pb-32 md:pb-8'
          }`}
        >
          <Outlet />
        </main>

        {/* COPILOT (16/10): FAB REMOVIDO — o card de insight da Home (com a cabecinha
            animada do Curiango) já é o acesso vivo à IA na Home; 2 caminhos pro mesmo
            destino na mesma tela era redundância e poluição visual. Benchmarks:
            Nubank/Maybe/Monzo não usam FAB de IA — a inteligência mora no conteúdo.
            O FAB volta com função real quando existir captura de voz global. */}

        {/* BANNER EDUCATIVO DE INSTALAÇÃO PWA (POSICIONADO ACIMA DO DOCK FLUTUANTE) */}
        <InstallPwaBanner variant="bottom-nav" />

        {/* DOCK FLUTUANTE EM PÍLULA (MOBILE APENAS < 768px, 360–412px SAFE) — R58: Fundo Azul-Marinho #14213D espelhando o herói sangrado do topo */}
        <nav
          aria-label="Navegação Principal"
          className="md:hidden fixed bottom-3 sm:bottom-4 inset-x-0 z-40 px-3 sm:px-4 max-w-md mx-auto pointer-events-none"
        >
          <div className="pointer-events-auto w-full bg-[#14213D] border border-white/10 shadow-elevation-3 rounded-full px-2 py-1.5 flex items-center justify-between transition-all">
            {/* 1. Início */}
            <NavLink
              to="/inicio"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 rounded-full transition-all duration-200 active:scale-95 ${
                  isActive ? 'text-[#FCA311] font-semibold' : 'text-white/70 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1 rounded-full transition-all duration-200 ${
                      isActive ? 'bg-[#FCA311]/20 scale-105 text-[#FCA311]' : ''
                    }`}
                  >
                    <Home className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] tracking-tight mt-0.5 leading-none">Início</span>
                </>
              )}
            </NavLink>

            {/* 2. Carteira */}
            <NavLink
              to="/carteira"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 rounded-full transition-all duration-200 active:scale-95 ${
                  isActive ? 'text-[#FCA311] font-semibold' : 'text-white/70 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1 rounded-full transition-all duration-200 ${
                      isActive ? 'bg-[#FCA311]/20 scale-105 text-[#FCA311]' : ''
                    }`}
                  >
                    <Wallet className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] tracking-tight mt-0.5 leading-none">Carteira</span>
                </>
              )}
            </NavLink>

            {/* 3. BOTÃO CENTRAL "Nova" (AÇÃO ERGUIDA COM RÓTULO + ÍCONE — PADRÃO OURO R54/R55/R58) */}
            <div className="flex-1 flex flex-col items-center justify-center py-0.5 -mt-3.5">
              <button
                type="button"
                onClick={() => openNewTransaction()}
                className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#FCA311] via-[#fba825] to-[#ffb845] text-[#14213D] flex items-center justify-center shadow-lg shadow-[#FCA311]/30 border-2 border-[#14213D] active:scale-90 hover:scale-105 transition-all duration-200 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]"
                aria-label="Nova Transação"
                title="Nova Transação"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </button>
              <span className="text-[10px] font-semibold text-white tracking-tight mt-0.5 leading-none">
                Nova
              </span>
            </div>

            {/* 4. Metas */}
            <NavLink
              to="/metas"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 rounded-full transition-all duration-200 active:scale-95 ${
                  isActive ? 'text-[#FCA311] font-semibold' : 'text-white/70 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1 rounded-full transition-all duration-200 ${
                      isActive ? 'bg-[#FCA311]/20 scale-105 text-[#FCA311]' : ''
                    }`}
                  >
                    <Target className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] tracking-tight mt-0.5 leading-none">Metas</span>
                </>
              )}
            </NavLink>

            {/* 5. Perfil */}
            <NavLink
              to="/perfil"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 rounded-full transition-all duration-200 active:scale-95 ${
                  isActive ? 'text-[#FCA311] font-semibold' : 'text-white/70 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1 rounded-full transition-all duration-200 ${
                      isActive ? 'bg-[#FCA311]/20 scale-105 text-[#FCA311]' : ''
                    }`}
                  >
                    <User className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] tracking-tight mt-0.5 leading-none">Perfil</span>
                </>
              )}
            </NavLink>
          </div>{' '}
        </nav>
      </div>

      {/* DIÁLOGO GLOBAL DE LANÇAMENTO POR VOZ COM IA (Pronto para chamada via setIsVoiceDialogOpen) */}
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
        onEditRecurringRule={(rule) => {
          setIsRecurringIncomesOpen(false)
          openNewTransaction({
            editingRecurringRule: rule,
            type: (rule.type || 'income') as 'income' | 'expense',
            description: rule.name,
            amountCents: rule.amount_cents,
            categoryId: rule.category_id || undefined,
            subcategoryId: rule.subcategory_id || undefined,
            memberId: rule.member_id,
          })
        }}
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
          if (!open) {
            if (setVoiceTransactionData) setVoiceTransactionData(null)
            if (setEditingRecurringRule) setEditingRecurringRule(null)
          }
        }}
        editingRecurringRule={editingRecurringRule}
        onSuccess={async () => {
          triggerRefresh()
          await loadGlobalRecurring()
        }}
      />

      {/* DIÁLOGO GLOBAL DE IMPORTAÇÃO DE EXTRATO */}
      <ImportStatementDialog open={isImportStatementOpen} onOpenChange={setIsImportStatementOpen} />

      {/* AFINAÇÃO 16/10: diálogo "Quem está usando" removido — a identidade é o
          login (family_members.user_id === auth.uid). O filtro de membros continua
          nos chips da Home como visualização. */}

      {/* DIÁLOGO GLOBAL DE ONBOARDING AUTOMÁTICO (OnboardingWizardDialog: Renda Mensal Familiar -> Seu Orçamento em 3 Caixas) */}
      <OnboardingWizardDialog
        open={isOnboardingOpen}
        onOpenChange={(open) => {
          // Bloqueio de estado parcial: enquanto o onboarding estiver incompleto,
          // o wizard não pode ser simplesmente fechado para expor a Home em estado inconsistente
          setIsOnboardingOpen(open)
        }}
        family={family}
        onSuccess={async () => {
          // AFINAÇÃO 16/10: identidade vem do login — sem localStorage legado
          // nem diálogo "Quem está usando?".
          await reloadFamily()
          triggerRefresh()
        }}
      />
    </div>
  )
}
