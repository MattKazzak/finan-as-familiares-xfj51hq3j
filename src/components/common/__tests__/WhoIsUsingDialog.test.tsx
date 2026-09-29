import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { WhoIsUsingDialog } from '../WhoIsUsingDialog'

let mockMembers: any[] = []
let mockActiveMemberId: string | null = null
const mockSetActiveMemberId = vi.fn()

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    members: mockMembers,
    activeMemberId: mockActiveMemberId,
    setActiveMemberId: mockSetActiveMemberId,
  }),
}))

describe('WhoIsUsingDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveMemberId = null
    mockMembers = []
  })

  it('NÃO renderiza nada e NUNCA abre quando há apenas 1 membro na família', () => {
    mockMembers = [{ id: 'm-1', name: 'Lucas', is_admin: true }]

    render(<WhoIsUsingDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.queryByText('Quem está usando?')).toBeNull()
    expect(screen.queryByText('Lucas')).toBeNull()
    expect(
      screen.queryByText(
        'Selecione seu perfil para personalizar a experiência e saudações neste aparelho.',
      ),
    ).toBeNull()
  })

  it('NÃO renderiza nada quando a lista de membros está vazia', () => {
    mockMembers = []

    render(<WhoIsUsingDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.queryByText('Quem está usando?')).toBeNull()
  })

  it('renderiza e abre normalmente quando a família tem 2 ou mais membros', () => {
    mockMembers = [
      { id: 'm-1', name: 'Lucas', is_admin: true },
      { id: 'm-2', name: 'Beatriz', is_admin: false },
    ]

    render(<WhoIsUsingDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText('Quem está usando?')).toBeDefined()
    expect(
      screen.getByText(
        'Selecione seu perfil para personalizar a experiência e saudações neste aparelho.',
      ),
    ).toBeDefined()
    expect(screen.getByText('Lucas')).toBeDefined()
    expect(screen.getByText('Beatriz')).toBeDefined()
  })

  it('ao selecionar um membro com 2+ membros, chama setActiveMemberId e fecha o diálogo', () => {
    mockMembers = [
      { id: 'm-1', name: 'Lucas', is_admin: true },
      { id: 'm-2', name: 'Beatriz', is_admin: false },
    ]
    const onOpenChange = vi.fn()

    render(<WhoIsUsingDialog open={true} onOpenChange={onOpenChange} />)

    const beatrizBtn = screen.getByRole('button', { name: /Beatriz/i })
    fireEvent.click(beatrizBtn)

    expect(mockSetActiveMemberId).toHaveBeenCalledWith('m-2')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
