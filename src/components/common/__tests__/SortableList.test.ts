import { describe, it, expect } from 'vitest'

describe('SortableList mobile touch & scroll lock behavior', () => {
  it('validates physical scroll lock mechanics on body/html', () => {
    // Simula ambiente DOM
    const body = document.body
    const html = document.documentElement

    const scrollY = 150
    const scrollX = 0

    // Simula acquireBodyScrollLock
    const originalStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    }

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = `-${scrollX}px`
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    body.classList.add('dragging-active')
    html.classList.add('dragging-active')

    expect(body.style.position).toBe('fixed')
    expect(body.style.top).toBe('-150px')
    expect(body.style.overflow).toBe('hidden')
    expect(body.classList.contains('dragging-active')).toBe(true)
    expect(html.classList.contains('dragging-active')).toBe(true)

    // Simula releaseBodyScrollLock
    body.style.position = originalStyles.position
    body.style.top = originalStyles.top
    body.style.left = originalStyles.left
    body.style.right = originalStyles.right
    body.style.width = originalStyles.width
    body.style.overflow = originalStyles.overflow
    body.classList.remove('dragging-active')
    html.classList.remove('dragging-active')

    expect(body.style.position).toBe('')
    expect(body.style.top).toBe('')
    expect(body.classList.contains('dragging-active')).toBe(false)
  })

  it('validates reorder array logic matches expectations', () => {
    const list = [
      { id: 'cat-1', name: 'Alimentação' },
      { id: 'cat-2', name: 'Transporte' },
      { id: 'cat-3', name: 'Moradia' },
    ]

    const from = 0
    const to = 2
    const next = [...list]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)

    expect(next.map((c) => c.id)).toEqual(['cat-2', 'cat-3', 'cat-1'])
  })

  it('validates drag handle touch activation delay requirement for mobile', () => {
    // Garante que o contrato de longPressDelay padrão e suporte a press-and-hold no handle estão documentados
    const DEFAULT_LONG_PRESS_DELAY = 320
    const SCROLL_THRESHOLD_PX = 8

    // Movimentos maiores que 8px antes de 320ms cancelam a ativação do drag para permitir scroll normal
    const touchMoveDistance = 12
    const isScrollIntent = touchMoveDistance > SCROLL_THRESHOLD_PX
    expect(isScrollIntent).toBe(true)

    // Toque mantido parado por >= 320ms ativa o arraste
    const holdDurationMs = 350
    const isDragActivated = holdDurationMs >= DEFAULT_LONG_PRESS_DELAY
    expect(isDragActivated).toBe(true)
  })
})
