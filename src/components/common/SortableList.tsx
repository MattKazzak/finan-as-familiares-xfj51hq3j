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
  longPressDelay?: number // milissegundos para disparar long press (default: 320ms)
}

export interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent) => void
  onTouchStart?: (e: React.TouchEvent) => void
  onTouchEnd?: (e: React.TouchEvent) => void
  onTouchCancel?: (e: React.TouchEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
  style?: React.CSSProperties
  className?: string
  'data-drag-handle'?: boolean
  'aria-grabbed'?: boolean
}

/**
 * Utilitário de Scroll Lock Físico de Nível Compositor (iOS Safari / Android Chrome proof):
 * Quando o drag ativa, fixa o <body> com position: fixed no scrollY atual.
 * Isso garante que o navegador (mesmo iOS WebKit com momentum scroll) NÃO consiga
 * rolar a página por baixo do dedo em movimento, eliminando o sintoma "a página continua mexendo".
 */
interface ScrollLockState {
  scrollY: number
  scrollX: number
  originalStyles: {
    position: string
    top: string
    left: string
    right: string
    width: string
    overflow: string
  }
}

let scrollLockState: ScrollLockState | null = null
let lockCount = 0

function acquireBodyScrollLock(): void {
  if (typeof document === 'undefined') return
  lockCount++
  if (lockCount > 1 && scrollLockState) return

  const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0
  const scrollX = window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || 0
  const body = document.body
  const html = document.documentElement

  scrollLockState = {
    scrollY,
    scrollX,
    originalStyles: {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    },
  }

  // Aplica lock no <body>
  body.style.position = 'fixed'
  body.style.top = `-${scrollY}px`
  body.style.left = `-${scrollX}px`
  body.style.right = '0'
  body.style.width = '100%'
  body.style.overflow = 'hidden'

  // Adiciona classes para regras adicionais de CSS
  body.classList.add('dragging-active')
  html.classList.add('dragging-active')
}

function releaseBodyScrollLock(): void {
  if (typeof document === 'undefined') return
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0 || !scrollLockState) return

  const { scrollY, scrollX, originalStyles } = scrollLockState
  const body = document.body
  const html = document.documentElement

  body.style.position = originalStyles.position
  body.style.top = originalStyles.top
  body.style.left = originalStyles.left
  body.style.right = originalStyles.right
  body.style.width = originalStyles.width
  body.style.overflow = originalStyles.overflow

  body.classList.remove('dragging-active')
  html.classList.remove('dragging-active')

  scrollLockState = null

  // Restaura a posição exata de scroll
  window.scrollTo(scrollX, scrollY)
}

/**
 * Componente de reordenação arrastável (Drag & Drop) com arquitetura híbrida touch + pointer:
 * - Em telas touch: opera 100% via Touch Events nativos do window, imunes a pointercancel
 * - Em desktop: opera via Pointer Events de alta performance
 * - Lock físico de scroll do body: garante que em dispositivos reais iOS Safari e Android Chrome
 *   a página fique completamente imóvel enquanto o card acompanha o dedo
 * - Efeito FLIP suave: cards adjacentes abrem espaço suavemente
 * - Toques rápidos abrem gavetas/modais sem interferência
 */
export function SortableList<T>({
  items,
  keyExtractor,
  onReorder,
  renderItem,
  className = '',
  dragHandleOnly = false,
  longPressDelay = 320,
}: SortableListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Estado de arraste
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [dragTranslateY, setDragTranslateY] = useState<number>(0)
  const [isPressing, setIsPressing] = useState<number | null>(null)

  // Refs de controle de interação
  const isTouchModeRef = useRef<boolean>(false)
  const activeTouchIdRef = useRef<number | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const activeTargetElRef = useRef<HTMLElement | null>(null)
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const initialScrollYRef = useRef<number>(0)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggingRef = useRef<boolean>(false)
  const draggedIndexRef = useRef<number | null>(null)
  const overIndexRef = useRef<number | null>(null)
  const initialRectsRef = useRef<Map<string, DOMRect>>(new Map())
  const itemsRef = useRef<T[]>(items)
  const itemHeightsRef = useRef<number[]>([])
  const draggedElHeightRef = useRef<number>(0)
  const hasDraggedRecently = useRef<boolean>(false)
  const isScrollLockedRef = useRef<boolean>(false)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const clearHoldTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (!isDraggingRef.current) {
      setIsPressing(null)
    }
  }, [])

  // Limpa qualquer seleção de texto nativa residual no DOM
  const clearWindowSelection = useCallback(() => {
    if (typeof window !== 'undefined' && window.getSelection) {
      try {
        const sel = window.getSelection()
        if (sel && sel.empty) {
          sel.empty()
        } else if (sel && sel.removeAllRanges) {
          sel.removeAllRanges()
        }
      } catch {
        // Ignora
      }
    }
  }, [])

  // Garante liberação do lock físico de scroll
  const unlockBodyScroll = useCallback(() => {
    if (isScrollLockedRef.current) {
      isScrollLockedRef.current = false
      releaseBodyScrollLock()
    }
  }, [])

  // Limpeza completa do estado de drag
  const cleanupDrag = useCallback(() => {
    clearHoldTimer()
    unlockBodyScroll()

    if (activeTargetElRef.current && activePointerIdRef.current !== null) {
      try {
        if (activeTargetElRef.current.hasPointerCapture(activePointerIdRef.current)) {
          activeTargetElRef.current.releasePointerCapture(activePointerIdRef.current)
        }
      } catch {
        // Ignora
      }
    }

    isDraggingRef.current = false
    draggedIndexRef.current = null
    overIndexRef.current = null
    activeTouchIdRef.current = null
    activePointerIdRef.current = null
    activeTargetElRef.current = null
    isTouchModeRef.current = false
    initialRectsRef.current.clear()

    setDraggedIndex(null)
    setOverIndex(null)
    setDragTranslateY(0)
    setIsPressing(null)
  }, [clearHoldTimer, unlockBodyScroll])

  // Calcula qual item da lista o ponteiro/dedo está sobrevoando
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

      // Fallback por proximidade do centro
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

  // Medição precisa e estática das posições antes do início do arrasto
  const measureItems = useCallback(
    (index: number) => {
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
    },
    [keyExtractor],
  )

  // Disparar início do arrasto
  const startDrag = useCallback(
    (index: number) => {
      // 1. Limpa qualquer seleção de texto nativa que possa ter iniciado
      clearWindowSelection()

      // 2. Mede imediatamente posições caso ainda não tenham sido medidas
      if (initialRectsRef.current.size === 0) {
        measureItems(index)
      }

      // 3. Trava o scroll do body fisicamente (position: fixed)
      if (!isScrollLockedRef.current) {
        isScrollLockedRef.current = true
        acquireBodyScrollLock()
      }

      // 4. Atualiza estado para arrastando
      isDraggingRef.current = true
      draggedIndexRef.current = index
      overIndexRef.current = index
      setDraggedIndex(index)
      setOverIndex(index)
      setDragTranslateY(0)
      setIsPressing(null)

      // 5. Pointer capture se estiver em modo mouse/pointer
      if (
        !isTouchModeRef.current &&
        activeTargetElRef.current &&
        activePointerIdRef.current !== null
      ) {
        try {
          activeTargetElRef.current.setPointerCapture(activePointerIdRef.current)
        } catch {
          // Ignora
        }
      }

      // 6. Haptic feedback imediato (vibração suave no celular)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate?.([30])
        } catch {
          // Ignora
        }
      }
    },
    [clearWindowSelection, measureItems],
  )

  // Finaliza a reordenação com sucesso se os índices forem válidos
  const commitReorderIfChanged = useCallback(() => {
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
  }, [onReorder])

  // =========================================================================
  // TOUCH ENGINE DEDICADA: Touch Events nativos com passive: false e lock
  // =========================================================================
  useEffect(() => {
    const handleNativeTouchMove = (e: TouchEvent) => {
      if (!isTouchModeRef.current) return

      // Encontra o touch ativo pelo identifier registrado
      let activeTouch: Touch | null = null
      for (let i = 0; i < e.touches.length; i++) {
        if (
          activeTouchIdRef.current === null ||
          e.touches[i].identifier === activeTouchIdRef.current
        ) {
          activeTouch = e.touches[i]
          break
        }
      }
      if (!activeTouch) return

      // FASE 1: Long press ainda pendente (usuário acabou de tocar no card)
      if (!isDraggingRef.current) {
        const dx = Math.abs(activeTouch.clientX - startPos.current.x)
        const dy = Math.abs(activeTouch.clientY - startPos.current.y)
        // Se mover mais de 8px antes de completar o delay do long press, cancela o timer:
        // significa que o usuário quer fazer scroll normal da lista, então deixamos o scroll fluir livremente
        if (dx > 8 || dy > 8) {
          clearHoldTimer()
          isTouchModeRef.current = false
          activeTouchIdRef.current = null
        }
        return
      }

      // FASE 2: Drag já ativado pelo long press!
      // Bloqueia categoricamente qualquer rolagem da tela no nível do evento touch
      if (e.cancelable) {
        e.preventDefault()
      }

      // Calcula o deslocamento vertical a partir do ponto onde o drag foi iniciado
      const deltaY = activeTouch.clientY - startPos.current.y
      setDragTranslateY(deltaY)

      // Calcula a linha central do item arrastado para detecção de hover precisa
      const draggedH = draggedElHeightRef.current || 64
      const fromIdx = draggedIndexRef.current ?? 0
      const initialItemRect = itemsRef.current[fromIdx]
        ? initialRectsRef.current.get(keyExtractor(itemsRef.current[fromIdx]))
        : null
      const currentCenterY = initialItemRect
        ? initialItemRect.top + deltaY + draggedH / 2
        : activeTouch.clientY

      const targetIdx = findHoveredIndex(currentCenterY)
      if (targetIdx !== null && targetIdx !== overIndexRef.current) {
        overIndexRef.current = targetIdx
        setOverIndex(targetIdx)
      }
    }

    const handleNativeTouchEnd = (e: TouchEvent) => {
      if (!isTouchModeRef.current) return

      clearHoldTimer()

      if (isDraggingRef.current) {
        if (e.cancelable) {
          e.preventDefault()
        }
        commitReorderIfChanged()
        cleanupDrag()

        hasDraggedRecently.current = true
        setTimeout(() => {
          hasDraggedRecently.current = false
        }, 250)
      } else {
        cleanupDrag()
      }
    }

    // Registra listeners de touch no window com capture: true e passive: false
    // para intervir antes de qualquer outro handler e ter autorização de chamar preventDefault()
    window.addEventListener('touchmove', handleNativeTouchMove, {
      passive: false,
      capture: true,
    })
    window.addEventListener('touchend', handleNativeTouchEnd, {
      passive: false,
      capture: true,
    })
    window.addEventListener('touchcancel', handleNativeTouchEnd, {
      passive: false,
      capture: true,
    })

    return () => {
      window.removeEventListener('touchmove', handleNativeTouchMove, { capture: true })
      window.removeEventListener('touchend', handleNativeTouchEnd, { capture: true })
      window.removeEventListener('touchcancel', handleNativeTouchEnd, { capture: true })
    }
  }, [clearHoldTimer, cleanupDrag, commitReorderIfChanged, findHoveredIndex, keyExtractor])

  // =========================================================================
  // MOUSE / POINTER ENGINE DEDICADA: Para desktop / laptops
  // =========================================================================
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (isTouchModeRef.current) return // Toque é gerenciado pelo Touch Engine
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return

      if (!isDraggingRef.current) {
        const dx = Math.abs(e.clientX - startPos.current.x)
        const dy = Math.abs(e.clientY - startPos.current.y)
        if (dx > 6 || dy > 6) {
          clearHoldTimer()
          activePointerIdRef.current = null
        }
        return
      }

      e.preventDefault()
      const deltaY = e.clientY - startPos.current.y
      setDragTranslateY(deltaY)

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
    }

    const handleWindowPointerUp = (e: PointerEvent) => {
      if (isTouchModeRef.current) return
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return

      clearHoldTimer()
      if (isDraggingRef.current) {
        commitReorderIfChanged()
        cleanupDrag()

        hasDraggedRecently.current = true
        setTimeout(() => {
          hasDraggedRecently.current = false
        }, 200)
      } else {
        cleanupDrag()
      }
    }

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false })
    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointercancel', handleWindowPointerUp)

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerUp)
    }
  }, [clearHoldTimer, cleanupDrag, commitReorderIfChanged, findHoveredIndex, keyExtractor])

  // Limpeza de segurança em unmount ou perda de foco
  useEffect(() => {
    const handleBlur = () => {
      cleanupDrag()
    }
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('blur', handleBlur)
      unlockBodyScroll()
    }
  }, [cleanupDrag, unlockBodyScroll])

  // Previne menu de contexto (long-press nativo) durante o drag
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (isDraggingRef.current || isPressing !== null) {
        e.preventDefault()
      }
    }
    window.addEventListener('contextmenu', handleContextMenu, { capture: true })
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true })
    }
  }, [isPressing])

  // =========================================================================
  // HANDLERS DE INICIAÇÃO: Touch e Pointer
  // =========================================================================
  const isInteractiveTarget = (target: HTMLElement | null): boolean => {
    if (!target) return false
    return Boolean(
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('a') ||
      target.closest('[role="menuitem"]') ||
      target.closest('[role="dialog"]') ||
      target.closest('[data-drag-handle]'),
    )
  }

  // Toque iniciado no card (Mobile)
  const handleCardTouchStart = (e: React.TouchEvent, index: number) => {
    if (dragHandleOnly) return
    if (isInteractiveTarget(e.target as HTMLElement | null)) return
    if (e.touches.length !== 1) {
      clearHoldTimer()
      return
    }

    const touch = e.touches[0]
    const cardEl =
      (e.currentTarget.closest('[data-sortable-index]') as HTMLElement) ||
      (e.currentTarget as HTMLElement)

    isTouchModeRef.current = true
    activeTouchIdRef.current = touch.identifier
    activePointerIdRef.current = null
    activeTargetElRef.current = cardEl
    startPos.current = { x: touch.clientX, y: touch.clientY }
    initialScrollYRef.current = window.scrollY || window.pageYOffset || 0

    clearHoldTimer()
    setIsPressing(index)
    measureItems(index)

    // Inicia timer para ativação de drag por long press
    longPressTimer.current = setTimeout(() => {
      startDrag(index)
    }, longPressDelay)
  }

  // Pointerdown (Mouse no Desktop)
  const handleCardPointerDown = (e: React.PointerEvent, index: number) => {
    if (dragHandleOnly) return
    // Se o evento for de touch, ignoramos aqui porque handleCardTouchStart já capturou
    if (e.pointerType === 'touch') return
    if (e.button !== 0) return
    if (isInteractiveTarget(e.target as HTMLElement | null)) return

    const cardEl =
      (e.currentTarget.closest('[data-sortable-index]') as HTMLElement) ||
      (e.currentTarget as HTMLElement)

    isTouchModeRef.current = false
    activePointerIdRef.current = e.pointerId
    activeTouchIdRef.current = null
    activeTargetElRef.current = cardEl
    startPos.current = { x: e.clientX, y: e.clientY }

    clearHoldTimer()
    setIsPressing(index)
    measureItems(index)

    // No desktop com mouse, 200ms de segurada ativa o arraste
    longPressTimer.current = setTimeout(
      () => {
        startDrag(index)
      },
      Math.min(220, longPressDelay),
    )
  }

  // Grip handle dedicado (ícone de arrasto explícito)
  const createDragHandleProps = (index: number): DragHandleProps => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (e.button !== 0) return
      e.stopPropagation()

      isTouchModeRef.current = false
      activePointerIdRef.current = e.pointerId
      activeTargetElRef.current =
        (e.currentTarget.closest('[data-sortable-index]') as HTMLElement) ||
        (e.currentTarget as HTMLElement)
      startPos.current = { x: e.clientX, y: e.clientY }

      // No desktop com mouse, arrasto imediato pelo handle
      measureItems(index)
      startDrag(index)
    },
    onTouchStart: (e: React.TouchEvent) => {
      // NÃO chamamos stopPropagation() aqui para que os listeners nativos de window (touchmove/touchend)
      // e eventuais eventos pais possam coordenar scroll sem quebrar.
      if (e.touches.length !== 1) {
        clearHoldTimer()
        return
      }
      const touch = e.touches[0]

      isTouchModeRef.current = true
      activeTouchIdRef.current = touch.identifier
      activePointerIdRef.current = null
      activeTargetElRef.current =
        (e.currentTarget.closest('[data-sortable-index]') as HTMLElement) ||
        (e.currentTarget as HTMLElement)
      startPos.current = { x: touch.clientX, y: touch.clientY }
      initialScrollYRef.current = window.scrollY || window.pageYOffset || 0

      clearHoldTimer()
      setIsPressing(index)
      measureItems(index)

      // No mobile / touch: exige PRESS-AND-HOLD (long press) exatamente igual às categorias.
      // Se o usuário apenas deslizar o dedo (scroll normal), o handle cancela e a página rola livremente.
      longPressTimer.current = setTimeout(() => {
        startDrag(index)
      }, longPressDelay)
    },
    onTouchEnd: () => {
      if (!isDraggingRef.current) clearHoldTimer()
    },
    onTouchCancel: () => {
      if (!isDraggingRef.current) clearHoldTimer()
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
    },
    style: {
      WebkitTouchCallout: 'none',
      WebkitUserSelect: 'none',
      userSelect: 'none',
    },
    'data-drag-handle': true,
    'aria-grabbed': draggedIndex === index,
  })

  // Bloqueia clique sintético se foi um arraste recente
  const handleCaptureClick = (e: React.MouseEvent) => {
    if (isDraggingRef.current || hasDraggedRecently.current) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

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

        // Efeito visual FLIP: os outros itens abrem espaço de forma suave
        let displacementY = 0
        if (draggedIndex !== null && !isDragging && overIndex !== null) {
          const itemHeight = draggedElHeightRef.current + 12
          if (draggedIndex < overIndex && index > draggedIndex && index <= overIndex) {
            displacementY = -itemHeight
          } else if (draggedIndex > overIndex && index >= overIndex && index < draggedIndex) {
            displacementY = itemHeight
          }
        }

        const inlineStyle: React.CSSProperties = isDragging
          ? {
              transform: `translate3d(0, ${dragTranslateY}px, 0)`,
              zIndex: 50,
              touchAction: 'none',
              pointerEvents: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }
          : {
              transform: displacementY !== 0 ? `translate3d(0, ${displacementY}px, 0)` : undefined,
              zIndex: isOver ? 10 : 1,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }

        return (
          <div
            key={id}
            data-sortable-index={index}
            ref={(el) => {
              if (el) itemRefs.current.set(id, el)
              else itemRefs.current.delete(id)
            }}
            onTouchStart={(e) => handleCardTouchStart(e, index)}
            onTouchEnd={() => {
              if (!isDraggingRef.current) clearHoldTimer()
            }}
            onTouchCancel={() => {
              if (!isDraggingRef.current) clearHoldTimer()
            }}
            onPointerDown={(e) => handleCardPointerDown(e, index)}
            onPointerUp={() => {
              if (!isDraggingRef.current) clearHoldTimer()
            }}
            onPointerCancel={() => {
              if (!isDraggingRef.current) clearHoldTimer()
            }}
            onContextMenu={(e) => {
              if (isDraggingRef.current || isCurrentlyPressing) {
                e.preventDefault()
              }
            }}
            style={inlineStyle}
            className={`relative select-none [-webkit-touch-callout:none] [-webkit-user-select:none] ${
              isDragging
                ? 'shadow-lg ring-1.5 ring-emerald-500/80 rounded-2xl opacity-95 pointer-events-none transition-none cursor-grabbing touch-none'
                : isCurrentlyPressing
                  ? 'transition-colors duration-150 sortable-card-pressing'
                  : 'transition-transform duration-250 ease-out will-change-transform touch-pan-y'
            }`}
          >
            {renderItem(item, index, dragHandleProps, isDragging)}
          </div>
        )
      })}
    </div>
  )
}
