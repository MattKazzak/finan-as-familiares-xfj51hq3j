import React from 'react'

export interface CuriangoLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
  color?: string
  className?: string
  /**
   * Mantido por retrocompatibilidade: a nova silhueta agora é nativamente sólida/preenchida.
   */
  filled?: boolean
  /** Cor do olho — padrão #FFFFFF (retrocompatível). Use #14213D p/ olho azul-marinho. */
  eyeColor?: string
  /** Raio do olho — padrão 2.25 (retrocompatível). Use 3.4 p/ olho expressivo. */
  eyeRadius?: number
  /** Brilho branco no olho (padrão false) — deixa o pássaro "vivo". */
  eyeHighlight?: boolean
}

/**
 * CuriangoLogo — Símbolo oficial da marca Curiangoo:
 * Silhueta sólida e minimalista do pássaro Curiango virado para a esquerda,
 * com corpo arredondado, cauda longa e elegante afinando para a direita,
 * olho circular branco na cabeça e linha curva branca sugerindo a dobra da asa.
 * Cores padrão: #14213D (azul-marinho oficial) ou currentColor, com suporte total a #FCA311.
 */
export const CuriangoLogo: React.FC<CuriangoLogoProps> = ({
  size = 28,
  color = '#14213D',
  className = '',
  // filled é mantido na assinatura para compatibilidade retroativa
  filled: _filled,
  eyeColor = '#FFFFFF',
  eyeRadius = 2.25,
  eyeHighlight = false,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Silhueta sólida do pássaro Curiango virado para a esquerda */}
      <path
        d="M 11.6 22.3 C 12.8 22.8 14.6 23.6 16.4 22.8 C 19.8 21.4 24.6 21.6 29.6 24.8 C 36.8 29.8 44.8 40.2 53.2 49.8 C 61.2 58.8 70.8 67.8 82.8 76.6 C 86.8 79.5 88.6 80.6 88.2 79.6 C 87.2 78.2 83.4 74.2 78.2 69.5 C 69.8 62.4 61.4 56.6 52.8 53.6 C 47.4 51.8 44.5 52.2 41.2 53.2 C 45.4 60.2 47.8 65.4 47.8 67.2 C 47.8 68.4 45.6 69.2 42.8 69.4 C 36.4 69.6 28.6 67.2 22.8 61.4 C 18.2 56.8 16.8 50.8 17.2 41.5 C 17.5 34.2 16.8 29.8 14.8 26.2 C 13.6 24.2 12.2 23.2 11.6 22.3 Z"
        fill={color}
      />
      {/* Olho redondo na cabeça (cor/raio configuráveis) */}
      <circle cx="22.2" cy="27.2" r={eyeRadius} fill={eyeColor} />
      {eyeHighlight && (
        <circle cx="23.2" cy="26.2" r={eyeRadius * 0.3} fill="#FFFFFF" opacity="0.9" />
      )}
      {/* Asa — batida sutil a cada 9,6s: levanta e assenta em ~380ms (ajuste de penas, não flap; SMIL nativo) */}
      <path
        d="M 28.2 42.8 C 28.5 46.8 29.8 52.4 33.8 57 C 37 60.8 41 63.8 45.4 65.6"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      >
        <animate
          attributeName="d"
          values="M 28.2 42.8 C 28.5 46.8 29.8 52.4 33.8 57 C 37 60.8 41 63.8 45.4 65.6;M 28.2 42.8 C 28.5 46.8 29.8 52.4 33.8 57 C 37 60.8 41 63.8 45.4 65.6;M 28.2 42.8 C 28.5 42.4 29.8 44.2 33.8 47.6 C 37 50.6 41 53 45.4 55;M 28.2 42.8 C 28.5 46.8 29.8 52.4 33.8 57 C 37 60.8 41 63.8 45.4 65.6;M 28.2 42.8 C 28.5 46.8 29.8 52.4 33.8 57 C 37 60.8 41 63.8 45.4 65.6"
          keyTimes="0;0.92;0.94;0.96;1"
          dur="9.6s"
          repeatCount="indefinite"
        />
      </path>
      {/* Pálpebra — piscar DUPLO a cada 4,8s (como pássaros reais; SMIL nativo, à prova de bundler) */}
      <ellipse
        cx="22.2"
        cy="27.2"
        rx={eyeRadius + 1.4}
        ry={eyeRadius + 1.4}
        fill={color}
        opacity="0"
      >
        <animate
          attributeName="opacity"
          values="0;0;1;1;0;0;1;1;0;0"
          keyTimes="0;0.93;0.94;0.955;0.96;0.965;0.975;0.99;0.995;1"
          dur="4.8s"
          repeatCount="indefinite"
        />
      </ellipse>
    </svg>
  )
}

export interface CuriangoHeadLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
  color?: string
  /** Cor do olho — padrão #14213D (azul-marinho CDS) para destacar sobre o âmbar */
  eyeColor?: string
  className?: string
}

/**
 * CuriangoHeadLogo — Retrato da cabecinha do Curiango (16/10, pedido do Matheus):
 * recorte da cabeça do pássaro (bico + olho grande) para assinaturas compactas
 * onde o pássaro inteiro ficaria ilegível (ex.: card de insight da Home).
 * Olho grande em #14213D (azul-marinho) sobre o corpo âmbar — expressivo e legível.
 */
export const CuriangoHeadLogo: React.FC<CuriangoHeadLogoProps> = ({
  size = 28,
  color = '#FCA311',
  eyeColor = '#14213D',
  className = '',
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="4 12 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Cabeça + início do corpo (recorte do path oficial, mantém a curva do bico) */}
      <path
        d="M 11.6 22.3 C 12.8 22.8 14.6 23.6 16.4 22.8 C 19.8 21.4 24.6 21.6 29.6 24.8 C 36.8 29.8 44.8 40.2 53.2 49.8 C 53.8 50.6 54.2 51.2 54.4 51.8 C 49.4 49.4 44.8 47.6 41.2 53.2 C 45.4 60.2 47.8 65.4 47.8 67.2 C 47.8 68.4 45.6 69.2 42.8 69.4 C 36.4 69.6 28.6 67.2 22.8 61.4 C 18.2 56.8 16.8 50.8 17.2 41.5 C 17.5 34.2 16.8 29.8 14.8 26.2 C 13.6 24.2 12.2 23.2 11.6 22.3 Z"
        fill={color}
      />
      {/* Olho grande azul-marinho (assinatura expressiva da cabeça) */}
      <circle cx="22.2" cy="27.2" r="3.4" fill={eyeColor} />
      {/* Brilho no olho */}
      <circle cx="23.2" cy="26.2" r="1" fill="#FFFFFF" opacity="0.9" />
    </svg>
  )
}

export interface CuriangoChatBustProps {
  size?: number | string
  className?: string
  /** true (padrão): espelhado pra olhar para a DIREITA — para a conversa ao lado dele */
  lookRight?: boolean
}

/**
 * CuriangoChatBust — o Curiango "persona" dos balões de conversa (19/10, Matheus):
 * busto (pescoço pra cima), RINDO (sorriso desenhado no bico), PISCANDO (pálpebra
 * SMIL dupla, mesma assinatura do logo, 4,8s) e OLHANDO PARA A CONVERSA — fica à
 * esquerda do balão espelhado pra direita, encarando o texto. Não é enfeite: é quem fala.
 */
export const CuriangoChatBust: React.FC<CuriangoChatBustProps> = ({
  size = 48,
  className = '',
  lookRight = true,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="4 12 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={lookRight ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden="true"
    >
      {/* Busto: cabeça + peito (recorte do path oficial; o viewBox corta no peito) */}
      <path
        d="M 11.6 22.3 C 12.8 22.8 14.6 23.6 16.4 22.8 C 19.8 21.4 24.6 21.6 29.6 24.8 C 36.8 29.8 44.8 40.2 53.2 49.8 C 53.8 50.6 54.2 51.2 54.4 51.8 C 49.4 49.4 44.8 47.6 41.2 53.2 C 45.4 60.2 47.8 65.4 47.8 67.2 C 47.8 68.4 45.6 69.2 42.8 69.4 C 36.4 69.6 28.6 67.2 22.8 61.4 C 18.2 56.8 16.8 50.8 17.2 41.5 C 17.5 34.2 16.8 29.8 14.8 26.2 C 13.6 24.2 12.2 23.2 11.6 22.3 Z"
        fill="#FCA311"
      />
      {/* Sorriso — o riso no bico (assinatura do balão de conversa) */}
      <path
        d="M 12.6 27.6 C 14.2 30.8 17.8 31.6 20.6 30"
        stroke="#14213D"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Olho expressivo + brilho */}
      <circle cx="22.2" cy="27.2" r="3.4" fill="#14213D" />
      <circle cx="23.2" cy="26.2" r="1" fill="#FFFFFF" opacity="0.9" />
      {/* Pálpebra — piscar DUPLO a cada 4,8s (mesma assinatura do logo oficial) */}
      <ellipse cx="22.2" cy="27.2" rx="4.8" ry="4.8" fill="#FCA311" opacity="0">
        <animate
          attributeName="opacity"
          values="0;0;1;1;0;0;1;1;0;0"
          keyTimes="0;0.93;0.94;0.955;0.96;0.965;0.975;0.99;0.995;1"
          dur="4.8s"
          repeatCount="indefinite"
        />
      </ellipse>
    </svg>
  )
}

export default CuriangoLogo
