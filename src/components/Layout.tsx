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
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { formatFamilyDisplayName } from '@/lib/formatters'
import { fetchRecurringIncomes, fetchRecurringIncomeOverrides } from '@/services/recurring-incomes'
import type { RecurringIncome, RecurringIncomeOverride } from '@/types/finance'

export default function Layout() {
  const { signOut, user } = useAuth()
  // Foto do usuário (Minha Conta → user_metadata.avatar_url) — aparece no bottom nav
  // (item Perfil, estilo Pinterest) e na sidebar desktop. Antes não aparecia em lugar nenhum.
  const userAvatarUrl = (user as any)?.user_metadata?.avatar_url || null
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
      case '/patrimonio':
      case '/investimentos':
        return 'Gestão de Patrimônio'
      case '/perfil':
        return 'Família & Configurações'
      case '/perfil/documentos':
        return 'Documentos da Família'
      case '/importar':
        return 'Revisão de Importação'
      default:
        return 'Finanças da Família'
    }
  }

  const navItems = [
    { to: '/inicio', label: 'Início', icon: Home },
    { to: '/carteira', label: 'Carteira', icon: Wallet },
    { to: '/patrimonio', label: 'Patrimônio', icon: TrendingUp },
    { to: '/metas', label: 'Metas', icon: Target },
    { to: '/perfil', label: 'Perfil', icon: User },
  ]

  const userInitial = currentMember?.name?.charAt(0).toUpperCase() || 'F'

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-white flex flex-col md:flex-row text-foreground font-sans antialiased">
      {/* EDGE-TO-EDGE (18/10, Matheus): pinta o fundo POR BAIXO das barras do sistema
          (barra de status wifi/bateria em cima, barra de gestos embaixo) — sensação
          de unidade que apps como Nubank/Pinterest/Instagram têm. */}
      <div
        aria-hidden="true"
        className="md:hidden fixed inset-x-0 top-0 h-[env(safe-area-inset-top)] bg-[#14213D] z-[60]"
      />
      <div
        aria-hidden="true"
        className="md:hidden fixed inset-x-0 bottom-0 h-[env(safe-area-inset-bottom)] bg-[#14213D] z-[60]"
      />
      {/* SIDEBAR DESKTOP (>= 768px) com identidade profunda #14213D */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-[#14213D] text-white sticky top-0 h-screen">
        {/* Logo + Nome */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <CuriangoLogo
              size={28}
              color="#FCA311"
              eyeColor="#14213D"
              eyeRadius={3.4}
              eyeHighlight
            />
            <span className="text-lg font-bold tracking-tight">Curiangoo</span>
          </div>
        </div>

        {/* Navegação */}
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
                {userAvatarUrl ? <AvatarImage src={userAvatarUrl} alt="Meu perfil" /> : null}
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
                <p className="text-[10px] text-brand-amber truncate font-medium">Meu perfil ▾</p>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2.5 text-left p-1.5 rounded-xl overflow-hidden flex-1 mr-1">
              <Avatar className="w-8 h-8 border border-brand-amber/50 shrink-0">
                {userAvatarUrl ? <AvatarImage src={userAvatarUrl} alt="Meu perfil" /> : null}
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
                <p className="text-[10px] text-brand-amber truncate font-medium">Meu perfil</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            title="Sair da conta"
            className="text-white/70 hover:text-white hover:bg-white/10 shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </aside>

      <div className="flex-1 md:ml-60 flex flex-col min-h-screen bg-white">
        {/* HEADER TOP (visível em desktop e nas demais páginas; na Home (/inicio) o header moderno fintech já assume o topo no mobile e desktop, evitando cabeçalho duplicado ou barra cinza rígida) */}
        {location.pathname !== '/inicio' && (
          <header className="sticky top-0 z-30 bg-[#14213D] text-white pl-4 pr-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {/* FIX 25/10 (Matheus): o pássaro agora é CAMINHO PRO COPILOT em toda
                  tela interna — padrão Duolingo (mascote = atalho da feature de IA).
                  40px (era 32px): alinhado ao card de insight da Home e ao toque
                  confortável (44px de área com padding). */}
              <button
                type="button"
                onClick={() => navigate('/copilot')}
                aria-label="Falar com o Curiango"
                title="Falar com o Curiango"
                className="shrink-0 rounded-full p-1 -m-1 active:scale-90 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]"
              >
                <CuriangoLogo
                  size={40}
                  color="#FCA311"
                  eyeColor="#14213D"
                  eyeRadius={3.4}
                  eyeHighlight
                />
              </button>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {getHeaderTitle()}
              </h2>
            </div>

            {/* FRENTE 1: Avatar do topo estilo Spotify/Pinterest — toque abre DIRETO o perfil */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/perfil')}
                data-testid="header-profile-avatar"
                aria-label="Abrir Perfil e Configurações"
                title="Meu Perfil e Configurações da Família"
                className="flex items-center gap-2 rounded-full p-0.5 ring-2 ring-white/20 hover:ring-[#FCA311] active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]"
              >
                <Avatar className="w-8 h-8 shrink-0">
                  {userAvatarUrl ? (
                    <AvatarImage src={userAvatarUrl} alt={currentMember?.name || 'Meu perfil'} />
                  ) : null}
                  <AvatarFallback className="bg-[#FCA311] text-[#14213D] font-bold text-xs">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>
          </header>
        )}

        {/* CONTEÚDO PRINCIPAL: Na Home (/inicio), o topo sangra sem padding superior e lateral para encostar nas bordas, e o miolo fica responsivo */}
        <main
          className={`flex-1 w-full overflow-x-hidden min-w-0 ${
            location.pathname === '/inicio'
              ? 'p-0 pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-8'
              : 'max-w-[1200px] mx-auto p-4 sm:p-6 pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-8'
          }`}
        >
          <Outlet />
        </main>

        {/* COPILOT (16/10): FAB REMOVIDO — o card de insight da Home (com a cabecinha
            animada do Curiango) já cobre o acesso à IA e evita redundância de caminhos.
            O FAB volta com função real quando existir captura de voz global. */}

        {/* BANNER EDUCATIVO DE INSTALAÇÃO PWA (POSICIONADO ACIMA DO DOCK FLUTUANTE) */}
        <InstallPwaBanner variant="bottom-nav" />

        {/* DOCK FLUTUANTE EM PÍLULA (MOBILE APENAS < 768px, 360–412px SAFE) — R58: Fundo Azul-Marinho #14213D espelhando o herói sangrado do topo. REVERTIDO 18/10 (decisão do Matheus: barra cheia sem rótulos ficou estranho — a pílula é a identidade do Curiangoo) */}
        <nav
          aria-label="Navegação Principal"
          className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] inset-x-0 z-40 px-3 sm:px-4 max-w-md mx-auto pointer-events-none"
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
                data-testid="dock-new-transaction"
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

            {/* 4. Patrimônio (FRENTE 2 — substitui o slot da pílula) */}
            <NavLink
              to="/patrimonio"
              data-testid="dock-patrimony"
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
                    <TrendingUp className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] tracking-tight mt-0.5 leading-none">Patrimônio</span>
                </>
              )}
            </NavLink>

            {/* 5. Metas */}
            <NavLink
              to="/metas"
              data-testid="dock-metas"
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
          </div>
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
