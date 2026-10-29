import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Point, QuadCorners } from '@/services/document-scanner-core'

interface DocumentCropCanvasProps {
  imageSrc: string
  corners: QuadCorners
  onChangeCorners: (corners: QuadCorners) => void
  onImageLoaded?: (dimensions: { width: number; height: number }) => void
}

type CornerKey = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft'

export const DocumentCropCanvas: React.FC<DocumentCropCanvasProps> = ({
  imageSrc,
  corners,
  onChangeCorners,
  onImageLoaded,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })
  const [displaySize, setDisplaySize] = useState<{
    width: number
    height: number
    left: number
    top: number
  }>({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
  })
  const [activeCorner, setActiveCorner] = useState<CornerKey | null>(null)

  // Carrega imagem e armazena dimensões reais
  useEffect(() => {
    if (!imageSrc) return
    const img = new Image()
    img.onload = () => {
      setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight })
      if (onImageLoaded) {
        onImageLoaded({ width: img.naturalWidth, height: img.naturalHeight })
      }
    }
    img.src = imageSrc
  }, [imageSrc, onImageLoaded])

  // Recalcula tamanho do render letterbox dentro do container
  const updateDisplaySize = useCallback(() => {
    if (!containerRef.current || !naturalDimensions.width || !naturalDimensions.height) return
    const rect = containerRef.current.getBoundingClientRect()
    const containerW = rect.width
    const containerH = rect.height

    const imageAspect = naturalDimensions.width / naturalDimensions.height
    const containerAspect = containerW / containerH

    let displayW = 0
    let displayH = 0
    let left = 0
    let top = 0

    if (imageAspect > containerAspect) {
      displayW = containerW
      displayH = containerW / imageAspect
      top = (containerH - displayH) / 2
    } else {
      displayH = containerH
      displayW = containerH * imageAspect
      left = (containerW - displayW) / 2
    }

    setDisplaySize({
      width: Math.max(1, displayW),
      height: Math.max(1, displayH),
      left,
      top,
    })
  }, [naturalDimensions])

  useEffect(() => {
    updateDisplaySize()
    window.addEventListener('resize', updateDisplaySize)
    return () => window.removeEventListener('resize', updateDisplaySize)
  }, [updateDisplaySize])

  // Converte ponto natural -> coordenadas na tela (pixels dentro do container)
  const toDisplayPoint = useCallback(
    (pt: Point): Point => {
      if (!naturalDimensions.width || !naturalDimensions.height || !displaySize.width) {
        return { x: 0, y: 0 }
      }
      return {
        x: displaySize.left + (pt.x / naturalDimensions.width) * displaySize.width,
        y: displaySize.top + (pt.y / naturalDimensions.height) * displaySize.height,
      }
    },
    [displaySize, naturalDimensions],
  )

  // Converte coordenadas na tela (mouse/touch relativo ao container) -> ponto natural
  const toNaturalPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!containerRef.current || !displaySize.width || !displaySize.height) {
        return { x: 0, y: 0 }
      }
      const rect = containerRef.current.getBoundingClientRect()
      const relX = clientX - rect.left - displaySize.left
      const relY = clientY - rect.top - displaySize.top

      // Clampa dentro dos limites da imagem
      const clampedX = Math.max(0, Math.min(displaySize.width, relX))
      const clampedY = Math.max(0, Math.min(displaySize.height, relY))

      return {
        x: Math.round((clampedX / displaySize.width) * naturalDimensions.width),
        y: Math.round((clampedY / displaySize.height) * naturalDimensions.height),
      }
    },
    [displaySize, naturalDimensions],
  )

  // Movimento de arrasto
  const handlePointerDown = (corner: CornerKey, e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveCorner(corner)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeCorner) return
    e.preventDefault()
    const newNaturalPt = toNaturalPoint(e.clientX, e.clientY)

    onChangeCorners({
      ...corners,
      [activeCorner]: newNaturalPt,
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!activeCorner) return
    try {
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    } catch {
      // Ignora se não puder liberar
    }
    setActiveCorner(null)
  }

  // Pontos de visualização
  const dTL = toDisplayPoint(corners.topLeft)
  const dTR = toDisplayPoint(corners.topRight)
  const dBR = toDisplayPoint(corners.bottomRight)
  const dBL = toDisplayPoint(corners.bottomLeft)

  const polygonPoints = `${dTL.x},${dTL.y} ${dTR.x},${dTR.y} ${dBR.x},${dBR.y} ${dBL.x},${dBL.y}`

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-full h-full min-h-[250px] max-h-[340px] select-none touch-none overflow-hidden bg-slate-900 rounded-2xl flex items-center justify-center border border-[rgba(20,33,61,0.08)]"
      style={{ touchAction: 'none' }}
    >
      {/* Imagem de fundo */}
      {imageSrc && (
        <img
          src={imageSrc}
          alt="Foto do documento para ajuste"
          draggable={false}
          className="absolute object-contain pointer-events-none select-none max-h-full max-w-full"
          style={{
            width: displaySize.width > 0 ? `${displaySize.width}px` : 'auto',
            height: displaySize.height > 0 ? `${displaySize.height}px` : 'auto',
            left: `${displaySize.left}px`,
            top: `${displaySize.top}px`,
          }}
        />
      )}

      {/* Camada SVG para o polígono de corte e linhas */}
      {displaySize.width > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Máscara escura fora do polígono */}
          <defs>
            <mask id="crop-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <polygon points={polygonPoints} fill="black" />
            </mask>
          </defs>

          {/* Sombra escura semi-transparente fora do documento */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.45)"
            mask="url(#crop-mask)"
          />

          {/* Linha de borda do documento */}
          <polygon
            points={polygonPoints}
            fill="rgba(252, 163, 17, 0.12)"
            stroke="#FCA311"
            strokeWidth="2.5"
            strokeDasharray={activeCorner ? '4 3' : 'none'}
            strokeLinejoin="round"
          />

          {/* Linhas guias tipo terços para alinhamento */}
          <line
            x1={(dTL.x + dBL.x) / 2}
            y1={(dTL.y + dBL.y) / 2}
            x2={(dTR.x + dBR.x) / 2}
            y2={(dTR.y + dBR.y) / 2}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <line
            x1={(dTL.x + dTR.x) / 2}
            y1={(dTL.y + dTR.y) / 2}
            x2={(dBL.x + dBR.x) / 2}
            y2={(dBL.y + dBR.y) / 2}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        </svg>
      )}

      {/* 4 Handles arrastáveis (cantos com hitbox de toque mobile 44px+) */}
      {displaySize.width > 0 && (
        <>
          <CornerHandle
            corner="topLeft"
            point={dTL}
            isActive={activeCorner === 'topLeft'}
            onPointerDown={(e) => handlePointerDown('topLeft', e)}
          />
          <CornerHandle
            corner="topRight"
            point={dTR}
            isActive={activeCorner === 'topRight'}
            onPointerDown={(e) => handlePointerDown('topRight', e)}
          />
          <CornerHandle
            corner="bottomRight"
            point={dBR}
            isActive={activeCorner === 'bottomRight'}
            onPointerDown={(e) => handlePointerDown('bottomRight', e)}
          />
          <CornerHandle
            corner="bottomLeft"
            point={dBL}
            isActive={activeCorner === 'bottomLeft'}
            onPointerDown={(e) => handlePointerDown('bottomLeft', e)}
          />
        </>
      )}

      {/* Dica de usabilidade sutil no topo do canvas */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none px-2 py-1 rounded-lg bg-black/60 backdrop-blur-xs text-[10px] text-white/90">
        <span>Arraste os círculos âmbar para alinhar aos cantos</span>
        <span className="font-mono text-amber-400 text-[9px] font-bold">4 cantos</span>
      </div>
    </div>
  )
}

interface CornerHandleProps {
  corner: CornerKey
  point: Point
  isActive: boolean
  onPointerDown: (e: React.PointerEvent) => void
}

const CornerHandle: React.FC<CornerHandleProps> = ({ corner, point, isActive, onPointerDown }) => {
  // Hitbox de 44x44px para toque mobile acessível com visualizador de 22x22px
  return (
    <div
      data-testid={`corner-handle-${corner}`}
      onPointerDown={onPointerDown}
      className="absolute -translate-x-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center cursor-grab active:cursor-grabbing z-20 touch-none"
      style={{
        left: `${point.x}px`,
        top: `${point.y}px`,
      }}
    >
      <div
        className={`w-6 h-6 rounded-full border-2 border-white shadow-md transition-transform flex items-center justify-center ${
          isActive
            ? 'scale-125 bg-[#FCA311] ring-4 ring-amber-400/50'
            : 'bg-[#14213D] hover:scale-110 hover:bg-[#FCA311]'
        }`}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-white" />
      </div>
    </div>
  )
}
