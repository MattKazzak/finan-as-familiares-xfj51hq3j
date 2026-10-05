import React from 'react'

export interface CuriangoLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
  color?: string
  className?: string
  filled?: boolean
}

/**
 * CuriangoLogo — Símbolo do pássaro Curiango em traço contínuo minimalista (single-line / stroke style).
 * Representa o olhar vigilante, as asas voltadas para ascensão financeira e a elegância fintech.
 * Cores padrão: #FCA311 (laranja da marca) ou currentColor.
 */
export const CuriangoLogo: React.FC<CuriangoLogoProps> = ({
  size = 28,
  color = '#FCA311',
  className = '',
  filled = false,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Traço contínuo minimalista do pássaro em voo / perfil estilizado */}
      <path
        d="M6 31C10 27 15 22 21 19C26 16.5 31 16 35 18C37 19 39 21 40 23.5C40.6 25 40.2 26.5 39 27.5C37.5 28.7 35 28.5 33 27C30.5 25.2 27.5 24 24 24C19 24 14 27 10 32C7.5 35 5 39 4 41C6 39.5 9 37.5 12 37C15 36.5 18 37 21 38.5C25 40.5 30 40 34 38C38 36 41 32 43 27C44 24.5 44 21 42 17C39.5 12 34 8 27 7C19.5 6 13 10 8 16"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Asa superior estilizada em ascensão (pena contínua) */}
      <path
        d="M21 19C23 13 28 8 36 6C34 10 33 14 34 18"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Ponto / olho discreto do pássaro */}
      <circle cx="34" cy="22" r="1.5" fill={color} />
      {filled && (
        <path
          d="M21 19C26 16.5 31 16 35 18C37 19 39 21 40 23.5C40.6 25 40.2 26.5 39 27.5C37.5 28.7 35 28.5 33 27C30.5 25.2 27.5 24 24 24C19 24 14 27 10 32C14 27 19 24 24 24Z"
          fill={color}
          fillOpacity="0.15"
        />
      )}
    </svg>
  )
}

export default CuriangoLogo
