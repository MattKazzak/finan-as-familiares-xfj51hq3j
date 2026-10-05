import { useState, useEffect, useCallback } from 'react'

const PRIVACY_STORAGE_KEY = 'curiangoo_hide_values'

/**
 * Hook para alternar e persistir a visibilidade de valores monetários.
 * Permite esconder o saldo e valores em público com máscara (ex: R$ ••••).
 */
export function useValuePrivacy() {
  const [hideValues, setHideValues] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PRIVACY_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, String(hideValues))
    } catch {
      // Ignora erro se localStorage estiver inacessível
    }
  }, [hideValues])

  const toggleHideValues = useCallback(() => {
    setHideValues((prev) => !prev)
  }, [])

  const maskValue = useCallback(
    (formattedValue: string, mask: string = 'R$ ••••') => {
      return hideValues ? mask : formattedValue
    },
    [hideValues],
  )

  return {
    hideValues,
    setHideValues,
    toggleHideValues,
    maskValue,
  }
}

/**
 * Retorna saudação dinâmica baseada no horário LOCAL do usuário.
 * 05:00 - 11:59: "Bom dia" ☕
 * 12:00 - 17:59: "Boa tarde" ☀️
 * 18:00 - 04:59: "Boa noite" 🌙
 */
export function getTimeGreeting(date: Date = new Date()): {
  greeting: string
  emoji: string
  fullGreeting: (name?: string | null) => string
} {
  const hour = date.getHours() // Sempre horário LOCAL do dispositivo

  let greeting = 'Boa noite'
  let emoji = '🌙'

  if (hour >= 5 && hour < 12) {
    greeting = 'Bom dia'
    emoji = '☕'
  } else if (hour >= 12 && hour < 18) {
    greeting = 'Boa tarde'
    emoji = '☀️'
  }

  return {
    greeting,
    emoji,
    fullGreeting: (name?: string | null) => {
      const cleanName = (name || '').trim()
      if (cleanName) {
        return `${greeting}, ${cleanName} ${emoji}`
      }
      return `${greeting}! ${emoji}`
    },
  }
}
