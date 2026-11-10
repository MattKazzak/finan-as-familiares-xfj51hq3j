import React from 'react'

export type DockIconName = 'home' | 'wallet' | 'plus' | 'patrimony' | 'metas'

export interface DockIconProps extends React.SVGProps<SVGSVGElement> {
  name: DockIconName
  active?: boolean
  className?: string
  strokeWidth?: number
}

/**
 * Ícones do dock inferior com suporte a variantes outline (inativo, traço fino)
 * e solid/filled (ativo, totalmente preenchido), seguindo a linguagem visual
 * de apps como Instagram, Pinterest e Spotify.
 */
export function DockIcon({
  name,
  active = false,
  className = 'w-5 h-5 shrink-0',
  strokeWidth = 1.75,
  ...rest
}: DockIconProps) {
  switch (name) {
    case 'home':
      if (active) {
        // Casa preenchida sólida estilo Instagram/Spotify (telhado + corpo com porta arredondada recortada)
        return (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
            className={className}
            aria-hidden="true"
            {...rest}
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M11.268 2.378a1 1 0 0 1 1.464 0l8.5 8.78A1 1 0 0 1 21.5 11.87v8.63a1.5 1.5 0 0 1-1.5 1.5h-4.25a1 1 0 0 1-1-1v-4.5a1.75 1.75 0 0 0-3.5 0V21a1 1 0 0 1-1 1H4a1.5 1.5 0 0 1-1.5-1.5V11.87a1 1 0 0 1 .268-.712l8.5-8.78Z"
            />
          </svg>
        )
      }
      // Casa outline estilo Instagram/Spotify (contorno suave com arco de porta)
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
          {...rest}
        >
          <path d="M3 10.75 11.27 2.4a1 1 0 0 1 1.46 0l8.27 8.35a1 1 0 0 1 .27.71v8.54a1.5 1.5 0 0 1-1.5 1.5h-4.25a1 1 0 0 1-1-1v-4.5a1.75 1.75 0 0 0-3.5 0V20.5a1 1 0 0 1-1 1H4.5a1.5 1.5 0 0 1-1.5-1.5V11.46a1 1 0 0 1 .27-.71Z" />
        </svg>
      )

    case 'wallet':
      if (active) {
        // Carteira preenchida sólida com aba/fecho recortado
        return (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
            className={className}
            aria-hidden="true"
            {...rest}
          >
            <path d="M19 7V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-2h-5a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3h5Zm-3 5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6v-4h-6Zm3 2.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
          </svg>
        )
      }
      // Carteira outline (Lucide Wallet adaptada com fecho)
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
          {...rest}
        >
          <path d="M19 7V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-2" />
          <path d="M14 8h7a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-7a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z" />
          <circle cx="17.5" cy="13" r=".75" fill="currentColor" />
        </svg>
      )

    case 'plus':
      // Botão Criar: ícone de cruz (+)
      // Inativo: stroke 1.5–1.75; Ativo: stroke reforçado (2.75–3) com pontas arredondadas
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={active ? 2.85 : strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
          {...rest}
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )

    case 'patrimony':
      if (active) {
        // Trending up preenchido sólido (área preenchida abaixo do gráfico em alta com flecha)
        return (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
            className={className}
            aria-hidden="true"
            {...rest}
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M22 6.5a1 1 0 0 0-1-1h-6a1 1 0 1 0 0 2h3.586l-5.793 5.793-3.793-3.793a1 1 0 0 0-1.414 0l-7.293 7.293a1 1 0 0 0 1.414 1.414L8 12.414l3.793 3.793a1 1 0 0 0 1.414 0L20 9.414V13a1 1 0 1 0 2 0V6.5Z"
            />
          </svg>
        )
      }
      // TrendingUp outline fino
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
          {...rest}
        >
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      )

    case 'metas':
      if (active) {
        // Target preenchido sólido: anéis circulares concêntricos com centro sólido
        return (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
            className={className}
            aria-hidden="true"
            {...rest}
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 3a7 7 0 1 0 7 7 7.008 7.008 0 0 0-7-7Zm0 3a4 4 0 1 1-4 4 4.004 4.004 0 0 1 4-4Z"
            />
          </svg>
        )
      }
      // Target outline (Lucide Target)
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
          {...rest}
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      )

    default:
      return null
  }
}
