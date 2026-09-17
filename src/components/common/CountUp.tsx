import React, { useEffect, useState } from 'react'

interface CountUpProps {
  end: number // valor em centavos ou unidades
  duration?: number // ms
  formatter?: (val: number) => string
  className?: string
}

export const CountUp: React.FC<CountUpProps> = ({
  end,
  duration = 600,
  formatter = (v) => v.toString(),
  className,
}) => {
  const [displayValue, setDisplayValue] = useState(end)

  useEffect(() => {
    let startTimestamp: number | null = null
    const startVal = 0
    const difference = end - startVal

    if (difference === 0) {
      setDisplayValue(end)
      return
    }

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      // Ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startVal + difference * easeOut)
      setDisplayValue(current)

      if (progress < 1) {
        window.requestAnimationFrame(step)
      } else {
        setDisplayValue(end)
      }
    }

    const animId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(animId)
  }, [end, duration])

  return <span className={className}>{formatter(displayValue)}</span>
}
