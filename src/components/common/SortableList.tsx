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
  dragHandleOnly?: boolean // se false, aceita long-press em qualquer lugar sem clique em botão
}

export interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent) => void
  style?: React.CSSProperties
  className?: string
  'data-drag-handle'?: boolean
  'aria-grabbed'?: boolean
}

/**
 * Componente leve de reordenação arrastável (Drag & Drop) com Pointer Events.
 * - Suporta mouse no desktop e toque no mobile.
 * - Suporte a pegar pelo ícone ≡ direto (arraste imediato) OU toque longo / segurar no card.
 * - Exibe linha indicadora de inserção ou visual suave sem causar conflitos de React 19.
 * - Não bloqueia cliques curtos (abrir modal / botões).
 */
export function SortableList<T>({
  items,
  keyExtractor,
  onReorder,
  renderItem,
  className = '',
}: SortableListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Estado de arraste
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [isPointerActive, setIsPointerActive] = useState<boolean>(false)

  // Refs de controle para touch/mouse
  const activePointerId = useRef<number | null>(null)
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const currentPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggingRef = useRef<boolean>(false)
  const draggedIndexRef = useRef<number | null>(null)
  const overIndexRef = useRef<number | null>(null)
  const itemsRef = useRef<T[]>(items)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const clearTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const cleanupDrag = useCallback(() => {
    clearTimer()
    isDraggingRef.current = false
    draggedIndexRef.current = null
    overIndexRef.current = null
    activePointerId.current = null
    setDraggedIndex(null)
    setOverIndex(null)
    setIsPointerActive(false)
    document.body.style.userSelect = ''
    document.body.style.touchAction = ''
  }, [])

  const findHoveredIndex = useCallback(
    (clientY: number): number | null => {
      const list = itemsRef.current
      if (!list || list.length === 0) return null

      // Percorre cada elemento de item medindo seu bounding rect
      for (let i = 0; i < list.length; i++) {
        const id = keyExtractor(list[i])
        const el = itemRefs.current.get(id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        // Se clientY está no topo/meio ou dentro deste item
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
      return null
    },
    [keyExtractor],
  )

  // Iniciar o arraste de fato
  const startDrag = useCallback((index: number) => {
    isDraggingRef.current = true
    draggedIndexRef.current = index
    overIndexRef.current = index
    setDraggedIndex(index)
    setOverIndex(index)
    setIsPointerActive(true)

    document.body.style.userSelect = 'none'
    document.body.style.touchAction = 'none'

    // Vibração suave no mobile (haptic feedback) se disponível
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(30)
      } catch {
        // Ignora caso navegador restrinja
      }
    }
  }, [])

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return

      currentPos.current = { x: e.clientX, y: e.clientY }

      if (!isDraggingRef.current) {
        // Se mover mais que 8px antes do long-press, cancela timer para permitir scroll normal
        const dx = Math.abs(e.clientX - startPos.current.x)
        const dy = Math.abs(e.clientY - startPos.current.y)
        if (dx > 8 || dy > 8) {
          clearTimer()
        }
        return
      }

      // Se estiver arrastando, impede scroll nativo e calcula a nova posição
      e.preventDefault()
      const targetIdx = findHoveredIndex(e.clientY)
      if (targetIdx !== null && targetIdx !== overIndexRef.current) {
        overIndexRef.current = targetIdx
        setOverIndex(targetIdx)
      }
    },
    [findHoveredIndex],
  )

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return

      clearTimer()

      if (
        isDraggingRef.current &&
        draggedIndexRef.current !== null &&
        overIndexRef.current !== null
      ) {
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
    },
    [cleanupDrag, handlePointerMove, onReorder],
  )

  // Iniciar ao tocar no botão de arrasto (≡) -> arrasto imediato
  const createDragHandleProps = (index: number): DragHandleProps => ({
    onPointerDown: (e: React.PointerEvent) => {
      // Apenas botão esquerdo ou toque
      if (e.button !== 0 && e.pointerType === 'mouse') return
      e.stopPropagation()

      activePointerId.current = e.pointerId
      startPos.current = { x: e.clientX, y: e.clientY }
      currentPos.current = { x: e.clientX, y: e.clientY }

      startDrag(index)

      window.addEventListener('pointermove', handlePointerMove, { passive: false })
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointercancel', handlePointerUp)
    },
    'data-drag-handle': true,
    'aria-grabbed': draggedIndex === index,
  })

  // Toque longo no card como um todo
  const handleCardPointerDown = (e: React.PointerEvent, index: number) => {
    // Se o clique foi num botão, input ou elemento interativo, não ativa long-press
    const target = e.target as HTMLElement | null
    if (
      target &&
      (target.closest('button') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('a') ||
        target.closest('[role="menuitem"]') ||
        target.closest('[data-drag-handle]'))
    ) {
      return
    }

    if (e.button !== 0 && e.pointerType === 'mouse') return

    activePointerId.current = e.pointerId
    startPos.current = { x: e.clientX, y: e.clientY }
    currentPos.current = { x: e.clientX, y: e.clientY }

    clearTimer()

    // 400ms para pressão longa (padrão mobile consagrado)
    longPressTimer.current = setTimeout(() => {
      startDrag(index)
    }, 400)

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }

  return (
    <div
      ref={containerRef}
      className={`space-y-3 relative ${isPointerActive ? 'select-none' : ''} ${className}`}
    >
      {items.map((item, index) => {
        const id = keyExtractor(item)
        const isDragging = draggedIndex === index
        const isOver = overIndex === index && draggedIndex !== null && !isDragging
        const dragHandleProps = createDragHandleProps(index)

        return (
          <div
            key={id}
            ref={(el) => {
              if (el) itemRefs.current.set(id, el)
              else itemRefs.current.delete(id)
            }}
            onPointerDown={(e) => handleCardPointerDown(e, index)}
            className={`transition-all duration-150 relative ${
              isDragging
                ? 'opacity-60 scale-[0.98] shadow-lg ring-2 ring-emerald-500 rounded-2xl z-20'
                : isOver
                  ? 'scale-[1.01] ring-2 ring-emerald-400/70 rounded-2xl z-10'
                  : ''
            }`}
          >
            {/* Linha indicadora visual sutil quando outro card estiver passando por cima */}
            {isOver && draggedIndex !== null && draggedIndex > index && (
              <div className="absolute -top-1.5 left-2 right-2 h-1 bg-emerald-500 rounded-full animate-pulse z-30 pointer-events-none" />
            )}

            {renderItem(item, index, dragHandleProps, isDragging)}

            {isOver && draggedIndex !== null && draggedIndex < index && (
              <div className="absolute -bottom-1.5 left-2 right-2 h-1 bg-emerald-500 rounded-full animate-pulse z-30 pointer-events-none" />
            )}
          </div>
        )
      })}
    </div>
  )
}
