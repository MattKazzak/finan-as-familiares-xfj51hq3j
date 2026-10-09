import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OnboardingWizardDialog } from '@/components/wallet/OnboardingWizardDialog'
import type { Family } from '@/types/finance'

const mockFamily: Family = {
  id: 'fam-test-1',
  name: 'Matheus',
  created_by: 'user-1',
  created_at: '2026-01-01',
  monthly_net_income_cents: 0,
}

describe('OnboardingWizardDialog', () => {
  it('renderiza etapa 1 "Vamos criar o espaço da sua família" com sugestão "Família {nome}" editável', () => {
    render(<OnboardingWizardDialog open={true} onOpenChange={vi.fn()} family={mockFamily} />)

    expect(screen.getByText('Boas-vindas ao Curiangoo')).toBeDefined()
    expect(screen.getByText('Vamos criar o espaço da sua família')).toBeDefined()
    expect(screen.getByText('Nome da família')).toBeDefined()

    const familyNameInput = screen.getByDisplayValue('Matheus')
    expect(familyNameInput).toBeDefined()

    // Permite editar o nome
    fireEvent.change(familyNameInput, { target: { value: 'Família Ferreira' } })
    expect(screen.getByDisplayValue('Família Ferreira')).toBeDefined()
  })

  it('mantém o input de nome vazio quando não há metadados de usuário nem nome gravado', () => {
    const emptyFamily: Family = {
      id: 'fam-test-empty',
      name: '',
      created_by: 'user-1',
      created_at: '2026-01-01',
      monthly_net_income_cents: 0,
    }
    render(<OnboardingWizardDialog open={true} onOpenChange={vi.fn()} family={emptyFamily} />)
    const input = screen.getByPlaceholderText(/Ex.: Família/i) as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('permite definir nome da família e avançar pela renda até etapa 3 (Seu Orçamento em 3 Caixas)', async () => {
    render(<OnboardingWizardDialog open={true} onOpenChange={vi.fn()} family={mockFamily} />)

    // Etapa 1: Nome da família
    const step1Btn = screen.getByRole('button', { name: /Continuar para a Renda/i })
    fireEvent.click(step1Btn)

    // Etapa 2: Renda Mensal Familiar
    expect(screen.getByText('Renda Mensal Familiar')).toBeDefined()
    expect(screen.getByText('Renda Líquida Total dos Membros')).toBeDefined()

    const input = screen.getByPlaceholderText('0,00')
    fireEvent.change(input, { target: { value: '5000,00' } })

    const continueBtn = screen.getByRole('button', { name: /Continuar para as 3 Caixas/i })
    fireEvent.click(continueBtn)

    // Deve estar no Passo 3
    expect(screen.getByText('Seu Orçamento em 3 Caixas')).toBeDefined()
    expect(screen.getByText(/Necessidades/)).toBeDefined()
    expect(screen.getByText(/Estilo de Vida/)).toBeDefined()
    expect(screen.getByText(/Futuro & Metas/)).toBeDefined()

    // 50% de 5000 = 2.500, 30% = 1.500, 20% = 1.000
    expect(screen.getByText('R$ 2.500,00')).toBeDefined()
    expect(screen.getByText('R$ 1.500,00')).toBeDefined()
    expect(screen.getByText('R$ 1.000,00')).toBeDefined()

    // Link sutil para alternar modelo
    expect(screen.getByText('Prefere outro modelo?')).toBeDefined()

    // Botão de conclusão
    expect(screen.getByRole('button', { name: /Concluir e Ativar meu Plano/i })).toBeDefined()

    // Valida que o container do DialogContent possui classes de centralização e prevenção de overflow horizontal
    const dialogContent = screen.getByRole('dialog')
    expect(dialogContent.className).toContain('left-1/2')
    expect(dialogContent.className).toContain('top-1/2')
    expect(dialogContent.className).toContain('-translate-x-1/2')
    expect(dialogContent.className).toContain('-translate-y-1/2')
    expect(dialogContent.className).toContain('overflow-x-hidden')
  })

  it('abre seletor de modelos ao clicar no link sutil', () => {
    render(
      <OnboardingWizardDialog
        open={true}
        onOpenChange={vi.fn()}
        family={{ ...mockFamily, monthly_net_income_cents: 600000 }}
      />,
    )

    const step1Btn = screen.getByRole('button', { name: /Continuar para a Renda/i })
    fireEvent.click(step1Btn)

    const continueBtn = screen.getByRole('button', { name: /Continuar para as 3 Caixas/i })
    fireEvent.click(continueBtn)

    const linkToggle = screen.getByText(/Prefere outro modelo\?/i)
    fireEvent.click(linkToggle)

    expect(screen.getByText('Modelo 60 / 25 / 15')).toBeDefined()
    expect(screen.getByText('Modelo 70 / 20 / 10')).toBeDefined()
  })

  it('não possui textos truncados nem abreviações forçadas nas caixas 50/30/20', () => {
    render(
      <OnboardingWizardDialog
        open={true}
        onOpenChange={vi.fn()}
        family={{ ...mockFamily, monthly_net_income_cents: 800000 }}
      />,
    )

    const step1Btn = screen.getByRole('button', { name: /Continuar para a Renda/i })
    fireEvent.click(step1Btn)

    const continueBtn = screen.getByRole('button', { name: /Continuar para as 3 Caixas/i })
    fireEvent.click(continueBtn)

    // Valida que os nomes completos das caixas e descrições aparecem
    expect(screen.getByText('Necessidades')).toBeDefined()
    expect(screen.getByText('Estilo de Vida')).toBeDefined()
    expect(screen.getByText('Futuro & Metas')).toBeDefined()
    expect(screen.getByText('Moradia, alimentação, transporte, saúde e contas')).toBeDefined()
    expect(screen.getByText('Lazer, restaurantes, compras, assinaturas e pets')).toBeDefined()
    expect(screen.getByText('Reserva de emergência, investimentos e sonhos')).toBeDefined()

    // O Dialog não deve ter elementos com a classe truncate
    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('.truncate')).toBeNull()
  })

  it('exibe estado de carregamento e desabilita botão com texto "Criando categorias e ativando..." durante a ativação', async () => {
    let resolveSeed: () => void = () => {}
    const deferredPromise = new Promise<{
      createdCategoriesCount: number
      createdSubcategoriesCount: number
      totalBudgetCents: number
    }>((resolve) => {
      resolveSeed = () =>
        resolve({
          createdCategoriesCount: 16,
          createdSubcategoriesCount: 55,
          totalBudgetCents: 600000,
        })
    })

    const onboardingService = await import('@/services/onboarding')
    const seedSpy = vi
      .spyOn(onboardingService, 'seedStandardizedCategoriesAndApplyPlan')
      .mockImplementation(() => deferredPromise)

    render(
      <OnboardingWizardDialog
        open={true}
        onOpenChange={vi.fn()}
        family={{ ...mockFamily, monthly_net_income_cents: 600000 }}
      />,
    )

    const step1Btn = screen.getByRole('button', { name: /Continuar para a Renda/i })
    fireEvent.click(step1Btn)

    const continueBtn = screen.getByRole('button', { name: /Continuar para as 3 Caixas/i })
    fireEvent.click(continueBtn)

    const activateBtn = screen.getByRole('button', { name: /Concluir e Ativar meu Plano/i })
    fireEvent.click(activateBtn)

    // Enquanto carrega, deve exibir o spinner com o texto requerido
    expect(screen.getByText('Criando categorias e ativando...')).toBeDefined()
    expect(activateBtn.hasAttribute('disabled')).toBe(true)

    // Finaliza
    resolveSeed()
    seedSpy.mockRestore()
  })

  it('ao concluir com 60/25/15 selecionado, a RPC é chamada com p_model_preset_id="60_25_15" e NÃO há chamada de updateFamily com budget_model em paralelo', async () => {
    const onboardingService = await import('@/services/onboarding')
    const seedSpy = vi
      .spyOn(onboardingService, 'seedStandardizedCategoriesAndApplyPlan')
      .mockResolvedValueOnce({
        createdCategoriesCount: 16,
        createdSubcategoriesCount: 55,
        totalBudgetCents: 500000,
      })

    // Mock do hook useFamily
    const useFamilyModule = await import('@/hooks/use-family')
    const mockUpdateFamily = vi.fn().mockResolvedValue({
      ...mockFamily,
      name: 'Família Matheus',
    })
    const mockTriggerRefresh = vi.fn()

    const useFamilySpy = vi.spyOn(useFamilyModule, 'useFamily').mockReturnValue({
      family: mockFamily,
      members: [],
      categories: [],
      selectedMemberId: null,
      setSelectedMemberId: vi.fn(),
      activeMemberId: null,
      setActiveMemberId: vi.fn(),
      currentMember: null,
      isWhoIsUsingOpen: false,
      setIsWhoIsUsingOpen: vi.fn(),
      openWhoIsUsing: vi.fn(),
      loading: false,
      reloadFamily: vi.fn(),
      updateFamily: mockUpdateFamily,
      uploadFamilyAvatar: vi.fn(),
      addMember: vi.fn(),
      editMember: vi.fn(),
      removeMember: vi.fn(),
      leaveFamily: vi.fn(),
      joinFamilyWithCode: vi.fn(),
      addNewCategory: vi.fn(),
      editCategory: vi.fn(),
      removeCategory: vi.fn(),
      checkCategoryUsage: vi.fn(),
      addNewSubcategory: vi.fn(),
      editSubcategory: vi.fn(),
      removeSubcategory: vi.fn(),
      checkSubcategoryUsage: vi.fn(),
      reorderCategoriesList: vi.fn(),
      reorderSubcategoriesList: vi.fn(),
      isNewTransactionOpen: false,
      setIsNewTransactionOpen: vi.fn(),
      newTransactionDefaultType: 'expense',
      newTransactionPrefill: null,
      openNewTransaction: vi.fn(),
      isActionSheetOpen: false,
      setIsActionSheetOpen: vi.fn(),
      openActionSheet: vi.fn(),
      isRecurringIncomesOpen: false,
      setIsRecurringIncomesOpen: vi.fn(),
      openRecurringIncomes: vi.fn(),
      isImportStatementOpen: false,
      setIsImportStatementOpen: vi.fn(),
      openImportStatement: vi.fn(),
      isOnboardingOpen: false,
      setIsOnboardingOpen: vi.fn(),
      openOnboarding: vi.fn(),
      isVoiceDialogOpen: false,
      setIsVoiceDialogOpen: vi.fn(),
      openVoiceDialog: vi.fn(),
      lastImportSummary: null,
      setLastImportSummary: vi.fn(),
      refreshTrigger: 0,
      triggerRefresh: mockTriggerRefresh,
    })

    render(
      <OnboardingWizardDialog
        open={true}
        onOpenChange={vi.fn()}
        family={{ ...mockFamily, monthly_net_income_cents: 500000 }}
      />,
    )

    // Etapa 1 -> Etapa 2
    const step1Btn = screen.getByRole('button', { name: /Continuar para a Renda/i })
    fireEvent.click(step1Btn)

    // Etapa 2 -> Etapa 3
    const step2Btn = screen.getByRole('button', { name: /Continuar para as 3 Caixas/i })
    fireEvent.click(step2Btn)

    // Etapa 3: Abre seletor de modelos e escolhe 60 / 25 / 15
    const linkToggle = screen.getByText(/Prefere outro modelo\?/i)
    fireEvent.click(linkToggle)

    const model60Option = screen.getByText('Modelo 60 / 25 / 15')
    fireEvent.click(model60Option)

    // Clica em Concluir e Ativar meu Plano
    const activateBtn = screen.getByRole('button', { name: /Concluir e Ativar meu Plano/i })
    fireEvent.click(activateBtn)

    // Verifica que seedStandardizedCategoriesAndApplyPlan foi chamado com modelPresetId = '60_25_15'
    expect(seedSpy).toHaveBeenCalledWith({
      familyId: mockFamily.id,
      monthlyNetIncomeCents: 500000,
      modelPresetId: '60_25_15',
    })

    // Verifica que updateFamily foi chamado APENAS para atualizar o nome da família,
    // e NUNCA enviou budget_model ou monthly_net_income_cents (sem concorrência de escrita)
    expect(mockUpdateFamily).toHaveBeenCalledTimes(1)
    const updateFamilyCallArg = mockUpdateFamily.mock.calls[0][0]
    expect(updateFamilyCallArg).toEqual({
      name: 'Matheus',
    })
    expect(updateFamilyCallArg.budget_model).toBeUndefined()
    expect(updateFamilyCallArg.monthly_net_income_cents).toBeUndefined()

    seedSpy.mockRestore()
    useFamilySpy.mockRestore()
  })

  it('hidrata selectedModelId a partir do family.budget_model existente quando o wizard reabre', () => {
    const familyWith60Model: Family = {
      ...mockFamily,
      monthly_net_income_cents: 600000,
      budget_model: '60_25_15',
    }

    render(<OnboardingWizardDialog open={true} onOpenChange={vi.fn()} family={familyWith60Model} />)

    // Avança até a etapa 3 para inspecionar os percentuais e tetos ativos
    const step1Btn = screen.getByRole('button', { name: /Continuar para a Renda/i })
    fireEvent.click(step1Btn)

    const step2Btn = screen.getByRole('button', { name: /Continuar para as 3 Caixas/i })
    fireEvent.click(step2Btn)

    // No modelo 60_25_15 para R$ 6.000,00:
    // Necessidades: 60% = R$ 3.600,00
    // Estilo de Vida: 25% = R$ 1.500,00
    // Futuro & Metas: 15% = R$ 900,00
    expect(screen.getByText('Modelo 60 / 25 / 15')).toBeDefined()
    expect(screen.getByText('60%')).toBeDefined()
    expect(screen.getByText('25%')).toBeDefined()
    expect(screen.getByText('15%')).toBeDefined()
    expect(screen.getByText('R$ 3.600,00')).toBeDefined()
    expect(screen.getByText('R$ 1.500,00')).toBeDefined()
    expect(screen.getByText('R$ 900,00')).toBeDefined()
  })
})
