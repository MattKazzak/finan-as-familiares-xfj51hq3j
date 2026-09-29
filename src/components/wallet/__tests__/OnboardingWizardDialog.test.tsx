import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OnboardingWizardDialog } from '@/components/wallet/OnboardingWizardDialog'
import type { Family } from '@/types/finance'

const mockFamily: Family = {
  id: 'fam-test-1',
  name: 'Silva',
  created_by: 'user-1',
  created_at: '2026-01-01',
  monthly_net_income_cents: 0,
}

describe('OnboardingWizardDialog', () => {
  it('renderiza etapa 1 com marca oficial Curiangoo e pergunta sobre renda líquida', () => {
    render(<OnboardingWizardDialog open={true} onOpenChange={vi.fn()} family={mockFamily} />)

    expect(screen.getByText('Boas-vindas ao Curiangoo')).toBeDefined()
    expect(screen.getByText('Renda Mensal Familiar')).toBeDefined()
    expect(screen.getByText('Quanto entra líquido na conta da família por mês?')).toBeDefined()
    expect(screen.getByText('Renda Líquida Total dos Membros')).toBeDefined()
  })

  it('permite digitar renda e avançar para etapa 2 (Seu Orçamento em 3 Caixas)', async () => {
    render(<OnboardingWizardDialog open={true} onOpenChange={vi.fn()} family={mockFamily} />)

    const input = screen.getByPlaceholderText('0,00')
    fireEvent.change(input, { target: { value: '5000,00' } })

    const continueBtn = screen.getByRole('button', { name: /Continuar para as 3 Caixas/i })
    fireEvent.click(continueBtn)

    // Deve estar no Passo 2
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
  })

  it('abre seletor de modelos ao clicar no link sutil', () => {
    render(
      <OnboardingWizardDialog
        open={true}
        onOpenChange={vi.fn()}
        family={{ ...mockFamily, monthly_net_income_cents: 600000 }}
      />,
    )

    const continueBtn = screen.getByRole('button', { name: /Continuar para as 3 Caixas/i })
    fireEvent.click(continueBtn)

    const linkToggle = screen.getByText(/Prefere outro modelo\?/i)
    fireEvent.click(linkToggle)

    expect(screen.getByText('Modelo 60 / 25 / 15')).toBeDefined()
    expect(screen.getByText('Modelo 70 / 20 / 10')).toBeDefined()
  })
})
