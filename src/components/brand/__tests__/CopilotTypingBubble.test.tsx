import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { CopilotTypingBubble } from '@/components/brand/CopilotTypingBubble'

describe('CopilotTypingBubble - Padrão Ouro CDS', () => {
  it('renderiza os 3 pontos com cor neutra CDS #64748B e sem cor verde hardcoded', () => {
    const { container } = render(<CopilotTypingBubble label="Testando digitação" />)

    const dots = container.querySelectorAll('[data-testid="copilot-typing-dots"] span')
    expect(dots.length).toBe(3)

    dots.forEach((dot) => {
      // Confirma que não tem a cor verde #059669
      expect(dot.className).not.toContain('#059669')
      expect(dot.className).not.toContain('bg-emerald')
      // Confirma cor neutra CDS #64748B
      expect(dot.className).toContain('bg-[#64748B]')
      // Confirma tamanho pequeno (w-1.5 h-1.5 = 6px)
      expect(dot.className).toContain('w-1.5')
      expect(dot.className).toContain('h-1.5')
    })
  })

  it('renderiza o ícone do pássaro com animação de respiração', () => {
    render(<CopilotTypingBubble />)
    const avatar = screen.getByTestId('copilot-typing-avatar')
    expect(avatar).toBeDefined()
    expect(avatar.className).toContain('animate-pulse')
  })
})
