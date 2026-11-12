import { useCallback, useEffect, useRef } from 'react'

interface LongPressOptions {
  /** Disparado quando o long-press completa (500ms); recebe o elemento pressionado */
  onLongPress: (target: Element | null) => void
  /** Duração do hold em ms (padrão de mercado: ~500ms) */
  delay?: number
  /** Deslocamento máximo (px) antes de cancelar o hold — usuário está rolando a lista */
  moveTolerance?: number
  /** Quando false, todo o hook fica inerte (nenhum timer dispara) */
  enabled?: boolean
}

/**
 * Long-press sem biblioteca (padrão de mercado — seleção de e-mails/fotos).
 * Retorna handlers prontos para espalhar num CONTAINER clicável (delegação:
 * o callback recebe o elemento real pressionado, o chamador resolve o item
 * via closest('[data-...]')). Um único hook comanda a lista inteira.
 *
 * O toque curto NÃO é disparado aqui — quem decide o que é "toque curto" é o
 * onClick do item, consultando `consumeClickIfLongPress()` (evita duplo
 * disparo: long-press completa → soltar o dedo NÃO pode também abrir detalhe).
 */
export function useLongPress({
  onLongPress,
  delay = 500,
  moveTolerance = 10,
  enabled = true,
}: LongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)
  const targetRef = useRef<Element | null>(null)
  const longPressFiredRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback(
    (x: number, y: number, target: Element | null) => {
      if (!enabled) return
      startPosRef.current = { x, y }
      targetRef.current = target
      longPressFiredRef.current = false
      clearTimer()
      timerRef.current = setTimeout(() => {
        longPressFiredRef.current = true
        // Feedback háptico sutil, se a plataforma expuser vibração
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate?.(35)
          } catch {
            // ignora
          }
        }
        onLongPress(targetRef.current)
      }, delay)
    },
    [clearTimer, delay, enabled, onLongPress],
  )

  const move = useCallback(
    (x: number, y: number) => {
      if (timerRef.current === null || !startPosRef.current) return
      const dx = Math.abs(x - startPosRef.current.x)
      const dy = Math.abs(y - startPosRef.current.y)
      if (dx > moveTolerance || dy > moveTolerance) {
        // Usuário começou a rolar a lista — cancela o hold
        clearTimer()
      }
    },
    [clearTimer, moveTolerance],
  )

  const cancel = useCallback(() => {
    clearTimer()
    startPosRef.current = null
  }, [clearTimer])

  /** Consumido pelo onClick do item: se o long-press acabou de disparar,
      engole o clique subsequente (solta o dedo após segurar). */
  const consumeClickIfLongPress = useCallback(() => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return true
    }
    return false
  }, [])

  // Cleanup: se o componente desmontar com timer pendente, limpa
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      start(e.clientX, e.clientY, e.target as Element | null)
    },
    onPointerMove: (e: React.PointerEvent) => {
      move(e.clientX, e.clientY)
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      // Long-press no mobile dispara contextmenu nativo (seleção de texto);
      // suprime quando foi um hold intencional
      if (longPressFiredRef.current) {
        e.preventDefault()
      }
    },
  }

  return { handlers, consumeClickIfLongPress }
}
