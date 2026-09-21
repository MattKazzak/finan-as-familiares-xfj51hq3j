import React, { useRef, useState, useCallback, useEffect } from 'react'

export interface SortableListProps<T> {
  items: T[]
  keyExtractor: (item: T) => string
  onReorder: (newOrder: T[]) => void
  renderItem: (
    item: T,
    index: number,
    dragHandleProps: DragHandleProps,
    isDragging: boolean,
  ) => React.ReactNode
  className?: string
  dragHandleOnly?: boolean // se true, apenas o handle inicia o drag
  longPressDelay?: number // milissegundos para disparar long press (default: 350ms)
}

export interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent) => void
  style?: React.CSSProperties
  className?: string
  'data-drag-handle'?: boolean
  'aria-grabbed'?: boolean
}

/**
 * Componente refinado de reordenação arrastável (Drag & Drop) mobile-first com Pointer Events:
 * - Pressão longa (long-press ~350ms) em qualquer lugar do card ativa o modo de arrasto
 * - Toque simples abre gavetas/modais sem interferência (não dispara long-press nem drag)
 * - Enquanto arrasta, o item selecionado ganha elevação, escala suave e segue o movimento vertical
 * - Os outros itens abrem espaço suavemente com translateY animado (estilo iOS / FLIP reordering)
 * - Haptic feedback (vibração leve de 25ms) no momento exato em que a pressão longa é confirmada
 */
export function SortableList<T>({
  items,
  keyExtractor,
  onReorder,
  renderItem,
  className = '',
  dragHandleOnly = false,
  longPressDelay = 350,
}: SortableListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Estado de arraste
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [dragTranslateY, setDragTranslateY] = useState<number>(0)
  const [isPressing, setIsPressing] = useState<number | null>(null) // feedback visual durante o hold antes de ativar

  // Refs de controle para touch/mouse
  const activePointerId = useRef<number | null>(null)
  const activeTargetEl = useRef<HTMLElement | null>(null)
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggingRef = useRef<boolean>(false)
  const draggedIndexRef = useRef<number | null>(null)
  const overIndexRef = useRef<number | null>(null)
  const initialRectsRef = useRef<Map<string, DOMRect>>(new Map())
  const itemsRef = useRef<T[]>(items)
  const itemHeightsRef = useRef<number[]>([])
  const draggedElHeightRef = useRef<number>(0)
  const hasDraggedRecently = useRef<boolean>(false)
  const activeCardIndex = useRef<number | null>(null)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const clearTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    setIsPressing(null)
  }

  const cleanupDrag = useCallback(() => {
    clearTimer()
    if (activeTargetEl.current && activePointerId.current !== null) {
      try {
        if (activeTargetEl.current.hasPointerCapture(activePointerId.current)) {
          activeTargetEl.current.releasePointerCapture(activePointerId.current)
        }
      } catch {
        // Ignora caso já tenha sido liberado
      }
    }
    isDraggingRef.current = false
    draggedIndexRef.current = null
    overIndexRef.current = null
    activePointerId.current = null
    activeTargetEl.current = null
    activeCardIndex.current = null
    initialRectsRef.current.clear()
    setDraggedIndex(null)
    setOverIndex(null)
    setDragTranslateY(0)
    setIsPressing(null)
    document.body.style.userSelect = ''
    document.body.style.touchAction = ''
  }, [])

  // Calcula qual índice da lista o ponteiro está sobrevoando
  const findHoveredIndex = useCallback(
    (clientY: number): number | null => {
      const list = itemsRef.current
      if (!list || list.length === 0) return null

      for (let i = 0; i < list.length; i++) {
        const id = keyExtractor(list[i])
        const rect = initialRectsRef.current.get(id)
        if (!rect) continue
        if (clientY >= rect.top && clientY <= rect.bottom) {
          return i
        }
        if (i === 0 && clientY < rect.top) {
          return 0
        }
        if (i === list.length - 1 && clientY > rect.bottom) {
          return list.length - 1
        }
      }
      // Se não encontrou por faixa direta, acha o mais próximo pelo centro
      let closestIdx = 0
      let minDist = Infinity
      for (let i = 0; i < list.length; i++) {
        const id = keyExtractor(list[i])
        const rect = initialRectsRef.current.get(id)
        if (!rect) continue
        const centerY = rect.top + rect.height / 2
        const dist = Math.abs(clientY - centerY)
        if (dist < minDist) {
          minDist = dist
          closestIdx = i
        }
      }
      return closestIdx
    },
    [keyExtractor],
  )

  // Iniciar o arraste após confirmação (seja por handle imediato ou por timer de long press)
  const startDrag = useCallback(
    (index: number) => {
      isDraggingRef.current = true
      draggedIndexRef.current = index
      overIndexRef.current = index
      setDraggedIndex(index)
      setOverIndex(index)
      setDragTranslateY(0)
      setIsPressing(null)

      document.body.style.userSelect = 'none'
      document.body.style.touchAction = 'none'

      // Atualiza/valida posições estáticas iniciais dos elementos caso não tenham sido gravadas
      if (initialRectsRef.current.size === 0) {
        const heights: number[] = []
        const rects = new Map<string, DOMRect>()
        itemsRef.current.forEach((it) => {
          const id = keyExtractor(it)
          const el = itemRefs.current.get(id)
          if (el) {
            rects.set(id, el.getBoundingClientRect())
            heights.push(el.offsetHeight)
          } else {
            heights.push(64)
          }
        })
        initialRectsRef.current = rects
        itemHeightsRef.current = heights
        draggedElHeightRef.current = heights[index] || 64
      }
      // Tenta pointer capture no elemento ativo para garantir fluxo contínuo de pointermove no mobile
      if (activeTargetEl.current && activePointerId.current !== null) {
        try {
          activeTargetEl.current.setPointerCapture(activePointerId.current)
        } catch {
          // Ignora caso o browser não permita ou elemento tenha saído
        }
      }

      // Haptic feedback (vibração mobile nativa)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate?.([25])
        } catch {
          // Ignora se não for suportado
        }
      }
    },
    [keyExtractor],
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return

      if (!isDraggingRef.current) {
        // Se mover mais de 8px antes de completar o long press, cancela o timer (o usuário está fazendo scroll normal)
        const dx = Math.abs(e.clientX - startPos.current.x)
        const dy = Math.abs(e.clientY - startPos.current.y)
        if (dx > 8 || dy > 8) {
          clearTimer()
          window.removeEventListener('pointermove', handlePointerMove)
          window.removeEventListener('pointerup', handlePointerUp)
          window.removeEventListener('pointercancel', handlePointerUp)
        }
        return
      }

      // Se já estiver arrastando, impede scroll nativo e calcula a nova posição
      e.preventDefault()

      const deltaY = e.clientY - startPos.current.y
      setDragTranslateY(deltaY)

      // Calcula a linha central do item arrastado na tela para detecção de hover muito mais precisa
      const draggedH = draggedElHeightRef.current || 64
      const fromIdx = draggedIndexRef.current ?? 0
      const initialItemRect = itemsRef.current[fromIdx]
        ? initialRectsRef.current.get(keyExtractor(itemsRef.current[fromIdx]))
        : null
      const currentCenterY = initialItemRect
        ? initialItemRect.top + deltaY + draggedH / 2
        : e.clientY

      const targetIdx = findHoveredIndex(currentCenterY)
      if (targetIdx !== null && targetIdx !== overIndexRef.current) {
        overIndexRef.current = targetIdx
        setOverIndex(targetIdx)
      }
    },
    [findHoveredIndex, keyExtractor],
  )

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return

      clearTimer()

      const wasDragging = isDraggingRef.current
      if (wasDragging && draggedIndexRef.current !== null && overIndexRef.current !== null) {
        const from = draggedIndexRef.current
        const to = overIndexRef.current

        if (from !== to && from >= 0 && to >= 0) {
          const next = [...itemsRef.current]
          const [moved] = next.splice(from, 1)
          next.splice(to, 0, moved)
          onReorder(next)
        }
      }

      cleanupDrag()
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)

      if (wasDragging) {
        hasDraggedRecently.current = true
        setTimeout(() => {
          hasDraggedRecently.current = false
        }, 200)
      }
    },
    [cleanupDrag, handlePointerMove, onReorder],
  )

  // Iniciar pelo grip handle dedicado (se o usuário preferir usar o ícone)
  const createDragHandleProps = (index: number): DragHandleProps => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      e.stopPropagation()

      activePointerId.current = e.pointerId
      activeTargetEl.current =
        (e.currentTarget.closest('[data-sortable-index]') as HTMLElement) ||
        (e.currentTarget as HTMLElement)
      startPos.current = { x: e.clientX, y: e.clientY }

      // Mede as posições antes de iniciar
      const rects = new Map<string, DOMRect>()
      const heights: number[] = []
      itemsRef.current.forEach((it) => {
        const id = keyExtractor(it)
        const el = itemRefs.current.get(id)
        if (el) {
          rects.set(id, el.getBoundingClientRect())
          heights.push(el.offsetHeight)
        } else {
          heights.push(64)
        }
      })
      initialRectsRef.current = rects
      itemHeightsRef.current = heights
      draggedElHeightRef.current = heights[index] || 64

      startDrag(index)

      window.addEventListener('pointermove', handlePointerMove, { passive: false })
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointercancel', handlePointerUp)
    },
    'data-drag-handle': true,
    'aria-grabbed': draggedIndex === index,
  })

  // Cancela o drag caso a janela perca foco (ex: popup ou troca de aba)
  useEffect(() => {
    const handleBlur = () => {
      cleanupDrag()
    }
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('blur', handleBlur)
    }
  }, [cleanupDrag])

  // Long-press no card como um todo
  const handleCardPointerDown = (e: React.PointerEvent, index: number) => {
    if (dragHandleOnly) return

    // Se o toque iniciou em botão, input, select, link ou elemento interativo, NÃO inicia long press
    const target = e.target as HTMLElement | null
    if (
      target &&
      (target.closest('button') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('a') ||
        target.closest('[role="menuitem"]') ||
        target.closest('[role="dialog"]') ||
        target.closest('[data-drag-handle]'))
    ) {
      return
    }

    // Se o clique foi com botão direito ou do meio do mouse, ignora
    if (e.button !== 0 && e.pointerType === 'mouse') return

    activePointerId.current = e.pointerId
    const cardEl =
      (e.currentTarget.closest('[data-sortable-index]') as HTMLElement) ||
      (e.currentTarget as HTMLElement)
    activeTargetEl.current = cardEl
    startPos.current = { x: e.clientX, y: e.clientY }

    clearTimer()
    activeCardIndex.current = index
    setIsPressing(index)

    // Mede as posições dos itens logo no pointerdown para garantir coordenadas limpas antes de qualquer movimento
    const rects = new Map<string, DOMRect>()
    const heights: number[] = []
    itemsRef.current.forEach((it) => {
      const id = keyExtractor(it)
      const el = itemRefs.current.get(id)
      if (el) {
        rects.set(id, el.getBoundingClientRect())
        heights.push(el.offsetHeight)
      } else {
        heights.push(64)
      }
    })
    initialRectsRef.current = rects
    itemHeightsRef.current = heights
    draggedElHeightRef.current = heights[index] || 64

    // No desktop com mouse, 200ms de segurada ou arrasto intencional é ainda mais confortável,
    // enquanto no toque mobile respeitamos os 350ms de longPressDelay configurados.
    const effectiveDelay =
      e.pointerType === 'mouse' ? Math.min(220, longPressDelay) : longPressDelay

    longPressTimer.current = setTimeout(() => {
      startDrag(index)
    }, effectiveDelay)

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }

  const handleCaptureClick = (e: React.MouseEvent) => {
    if (isDraggingRef.current || hasDraggedRecently.current) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  // Também limpar os listeners no unmount
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  return (
    <div
      ref={containerRef}
      className={`space-y-3 relative ${draggedIndex !== null ? 'select-none' : ''} ${className}`}
      onClickCapture={handleCaptureClick}
    >
      {items.map((item, index) => {
        const id = keyExtractor(item)
        const isDragging = draggedIndex === index
        const isOver = overIndex === index && draggedIndex !== null && !isDragging
        const isCurrentlyPressing = isPressing === index && draggedIndex === null
        const dragHandleProps = createDragHandleProps(index)

        // Efeito de deslocamento suave dos outros itens:
        // Se este item não está sendo arrastado, mas o item arrastado se moveu por ele:
        // - se draggedIndex < overIndex e o item está entre (draggedIndex, overIndex], ele sobe (-offset)
        // - se draggedIndex > overIndex e o item está entre [overIndex, draggedIndex), ele desce (+offset)
        let displacementY = 0
        if (draggedIndex !== null && !isDragging && overIndex !== null) {
          const itemHeight = draggedElHeightRef.current + 12 // altura do item + gap da lista
          if (draggedIndex < overIndex && index > draggedIndex && index <= overIndex) {
            displacementY = -itemHeight
          } else if (draggedIndex > overIndex && index >= overIndex && index < draggedIndex) {
            displacementY = itemHeight
          }
        }

        const inlineStyle: React.CSSProperties = isDragging
          ? {
              transform: `translate3d(0, ${dragTranslateY}px, 0) scale(1.02)`,
              zIndex: 50,
              touchAction: 'none',
              pointerEvents: 'none',
            }
          : {
              transform: displacementY !== 0 ? `translate3d(0, ${displacementY}px, 0)` : undefined,
              zIndex: isOver ? 10 : 1,
            }

        return (
          <div
            key={id}
            data-sortable-index={index}
            ref={(el) => {
              if (el) itemRefs.current.set(id, el)
              else itemRefs.current.delete(id)
            }}
            onPointerDown={(e) => handleCardPointerDown(e, index)}
            onPointerUp={() => {
              if (!isDraggingRef.current) clearTimer()
            }}
            onPointerCancel={() => {
              if (!isDraggingRef.current) clearTimer()
            }}
            style={inlineStyle}
            className={`relative ${
              isDragging
                ? 'shadow-2xl ring-2 ring-emerald-500 rounded-2xl opacity-95 pointer-events-none transition-none cursor-grabbing touch-none select-none'
                : isCurrentlyPressing
                  ? 'scale-[0.99] transition-transform duration-200 touch-pan-y'
                  : 'transition-transform duration-250 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform touch-pan-y'
            }`}
          >
            {renderItem(item, index, dragHandleProps, isDragging)}
          </div>
        )
      })}
    </div>
  )
}
