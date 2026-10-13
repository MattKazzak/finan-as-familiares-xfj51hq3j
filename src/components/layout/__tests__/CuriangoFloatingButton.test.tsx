import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import {
  CuriangoFloatingButton,
  COPILOT_FAB_SPEECH_BUBBLE_DISMISSED_KEY,
  COPILOT_FAB_PULSE_STOPPED_KEY,
} from '../CuriangoFloatingButton'
import tailwindConfig from '../../../../tailwind.config'

describe('CuriangoFloatingButton (FAB com balão de fala 1x e pulso lento R55)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renderiza como FAB com pulso sutil animate-fab-breathe na primeira visita e dispara clique', () => {
    const handleClick = vi.fn()
    render(<CuriangoFloatingButton onClick={handleClick} />)

    const btn = screen.getByRole('button', { name: /falar com o curiangoo/i })
    expect(btn).toBeDefined()
    expect(btn.className).toContain('w-12 h-12')
    expect(btn.className).toContain('sm:w-14 sm:h-14')
    expect(btn.className).toContain('animate-fab-breathe')
    expect(btn.className).toContain('motion-reduce:animate-none')
    expect(btn.getAttribute('title')).toContain('Falar com o Curiangoo')

    // Balão de fala 1x: "Oi! Sou o Curiangoo — lanço, consulto e analiso pra você"
    expect(screen.getByText(/Oi! Sou o Curiangoo/i)).toBeDefined()
    expect(screen.getByText(/lanço, consulto e analiso pra você/i)).toBeDefined()

    fireEvent.click(btn)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('T1(a)(b)(c)(d): configuração da animação tailwind tem duração ≥ 3s, amplitude ≤ 4%, easing suave e pausa', () => {
    const animConfig = tailwindConfig.theme?.extend?.animation?.['fab-breathe']
    expect(animConfig).toBeDefined()
    expect(animConfig).toContain('ease-in-out')

    // Extrai duração total da animação (ex: 19s)
    const matchSeconds = animConfig?.match(/(\d+(\.\d+)?)s/)
    expect(matchSeconds).not.toBeNull()
    const totalDurationSeconds = parseFloat(matchSeconds![1])
    expect(totalDurationSeconds).toBeGreaterThanOrEqual(3)

    // Keyframes: amplitude de escala máxima deve ser <= 1.04 (<= 4%)
    const keyframes = tailwindConfig.theme?.extend?.keyframes?.['fab-breathe'] as Record<
      string,
      { transform?: string; boxShadow?: string }
    >
    expect(keyframes).toBeDefined()

    // Encontrar todas as transformações de scale
    let maxScale = 1.0
    Object.values(keyframes).forEach((step) => {
      if (step.transform) {
        const scaleMatch = step.transform.match(/scale\(([\d.]+)\)/)
        if (scaleMatch) {
          const val = parseFloat(scaleMatch[1])
          if (val > maxScale) maxScale = val
        }
      }
    })

    // Amplitude de escala máxima ≤ 4% (ex: 1.03 = 3%)
    const maxAmplitudePercent = (maxScale - 1) * 100
    expect(maxAmplitudePercent).toBeLessThanOrEqual(4.01)
    expect(maxAmplitudePercent).toBeGreaterThan(0.5)

    // Verifica que existe período de pausa (100% volta para scale(1))
    expect(keyframes['0%']?.transform).toBe('scale(1)')
    expect(keyframes['100%']?.transform).toBe('scale(1)')
  })

  it('T1(e): respeita prefers-reduced-motion desativando animate-fab-breathe', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(<CuriangoFloatingButton />)
    const btn = screen.getByRole('button', { name: /falar com o curiangoo/i })
    // Com redução de movimento ativada pelo SO, a classe animate-fab-breathe não deve ser injetada
    expect(btn.className).not.toContain('animate-fab-breathe')
  })

  it('T1(f): o pulso CESSA DEFINITIVAMENTE após a primeira interação do usuário com o FAB', () => {
    const handleClick = vi.fn()
    const { unmount } = render(<CuriangoFloatingButton onClick={handleClick} />)

    const btn = screen.getByRole('button', { name: /falar com o curiangoo/i })
    expect(btn.className).toContain('animate-fab-breathe')

    // Primeira interação (clique no FAB)
    fireEvent.click(btn)

    // Deve ter gravado a chave definitiva de interrupção no localStorage
    expect(localStorage.getItem(COPILOT_FAB_PULSE_STOPPED_KEY)).toBe('true')

    unmount()

    // Nova renderização (simula recarregamento da página): pulso NUNCA mais volta
    render(<CuriangoFloatingButton />)
    const btnAfterReload = screen.getByRole('button', { name: /falar com o curiangoo/i })
    expect(btnAfterReload.className).not.toContain('animate-fab-breathe')
  })

  it('não exibe o balão de fala se já tiver sido dispensada anteriormente no localStorage', () => {
    localStorage.setItem(COPILOT_FAB_SPEECH_BUBBLE_DISMISSED_KEY, 'true')
    render(<CuriangoFloatingButton />)

    expect(screen.queryByText(/Oi! Sou o Curiangoo/i)).toBeNull()
    const btn = screen.getByRole('button', { name: /falar com o curiangoo/i })
    expect(btn).toBeDefined()
  })

  it('fecha o balão ao clicar no botão de fechar ✕', () => {
    render(<CuriangoFloatingButton />)

    const closeBtn = screen.getByRole('button', { name: /fechar dica/i })
    expect(closeBtn).toBeDefined()
    fireEvent.click(closeBtn)

    expect(screen.queryByText(/Oi! Sou o Curiangoo/i)).toBeNull()
    expect(localStorage.getItem(COPILOT_FAB_SPEECH_BUBBLE_DISMISSED_KEY)).toBe('true')
  })
})
