// Utilitário de mapeamento dinâmico de ícones Lucide (CDS v1.0)
import React from 'react'
import {
  Utensils,
  Car,
  Home,
  Film,
  HeartPulse,
  GraduationCap,
  Shirt,
  Tag,
  Briefcase,
  TrendingUp,
  ShoppingBag,
  Zap,
  Coffee,
  Plane,
  Gift,
  HelpCircle,
  Sparkles,
  Smartphone,
  ShieldCheck,
  CreditCard,
  Building,
  PiggyBank,
  PawPrint,
  Ticket,
  Tv,
  Target,
  ShoppingCart,
  Beef,
  Apple,
  Fuel,
  Bus,
  ShieldAlert,
  CircleParking,
  Wrench,
  Pill,
  Stethoscope,
  Shield,
  Smile,
  BookOpen,
  Bike,
  Scissors,
  Package,
  Activity,
  Terminal,
  Laptop,
  Sun,
  Droplets,
  Flame,
  Wifi,
  Landmark,
  ArrowDownRight,
  AlertCircle,
  Hammer,
  Dumbbell,
  PartyPopper,
  LucideIcon,
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  Utensils,
  Car,
  Home,
  Film,
  HeartPulse,
  GraduationCap,
  Shirt,
  Tag,
  Briefcase,
  TrendingUp,
  ShoppingBag,
  Zap,
  Coffee,
  Plane,
  Gift,
  Sparkles,
  Smartphone,
  ShieldCheck,
  CreditCard,
  Building,
  PiggyBank,
  PawPrint,
  Dog: PawPrint,
  Ticket,
  Tv,
  Target,
  ShoppingCart,
  Beef,
  Apple,
  Fuel,
  Bus,
  ShieldAlert,
  CircleParking,
  Wrench,
  Pill,
  Stethoscope,
  Shield,
  Smile,
  BookOpen,
  Bike,
  Scissors,
  Package,
  Activity,
  Terminal,
  Laptop,
  Sun,
  Droplets,
  Flame,
  Wifi,
  Landmark,
  ArrowDownRight,
  AlertCircle,
  Hammer,
  Dumbbell,
  PartyPopper,
}

interface CategoryIconProps {
  name: string | null | undefined
  className?: string
  strokeWidth?: number
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name,
  className = 'w-4 h-4',
  strokeWidth = 1.5,
}) => {
  if (!name) return <Tag className={className} strokeWidth={strokeWidth} />
  const IconComponent = iconMap[name] || HelpCircle
  return <IconComponent className={className} strokeWidth={strokeWidth} />
}

/**
 * Normaliza e suaviza a cor de uma categoria para o padrão sofisticado do CDS v1.0.
 * Evita cores saturadas berrantes (rosa chiclete, roxo elétrico, turquesa neon).
 */
export function getHarmonizedCategoryColor(color: string | null | undefined): string | null {
  if (!color || typeof color !== 'string') return null
  const trimmed = color.trim()
  if (!trimmed) return null

  // Mapeamento de cores gritantes conhecidas para versões mais elegantes/sóbrias do CDS
  const upper = trimmed.toUpperCase()
  const tonedDownMap: Record<string, string> = {
    // Rosa chiclete (#EC4899 / #F43F5E / #FF1493) -> Tom bordeaux ou rosa pó refinado
    '#EC4899': '#BE185D',
    '#F43F5E': '#E11D48',
    '#FF1493': '#BE185D',
    '#FF69B4': '#DB2777',
    // Roxo elétrico (#8B5CF6 / #A855F7 / #7C3AED) -> Tom índigo/violeta sóbrio
    '#8B5CF6': '#6D28D9',
    '#A855F7': '#6D28D9',
    '#7C3AED': '#5B21B6',
    // Turquesa neon / Ciano elétrico (#06B6D4 / #14B8A6 / #00FFFF) -> Tom petróleo/teal sóbrio
    '#06B6D4': '#0E7490',
    '#14B8A6': '#0F766E',
    '#00FFFF': '#0F766E',
    '#22D3EE': '#0E7490',
  }

  if (tonedDownMap[upper]) {
    return tonedDownMap[upper]
  }

  return trimmed
}

/**
 * Converte qualquer cor hex ou rgb válida em rgba com opacidade customizada (ex: 0.12 para 12%).
 */
export function getCategoryTintBackground(
  color: string | null | undefined,
  alpha = 0.12,
): string | null {
  const harmonized = getHarmonizedCategoryColor(color)
  if (!harmonized) return null

  // Se já for rgb/rgba
  if (harmonized.startsWith('rgb')) {
    const match = harmonized.match(/\d+/g)
    if (match && match.length >= 3) {
      return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${alpha})`
    }
  }

  // Hex (#RGB ou #RRGGBB)
  const hex = harmonized.replace('#', '')
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16)
    const g = parseInt(hex[1] + hex[1], 16)
    const b = parseInt(hex[2] + hex[2], 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  return null
}

export interface CategoryIconBoxProps {
  icon?: string | null
  color?: string | null
  className?: string
  iconClassName?: string
  strokeWidth?: number
}

/**
 * Container oficial de ícone de categoria CDS v1.0 com Soft Tint.
 * - Fundo com a cor da categoria em tom suave (~11-12% de opacidade)
 * - Glifo na cor sóbria/harmonizada da categoria com strokeWidth 1.5 e tamanho w-4 h-4
 * - Fallback elegante para o container neutro (slate-100 dark:bg-slate-800) se a cor não existir
 * - Compatível com dark mode via opacidade sobre rgba
 */
export const CategoryIconBox: React.FC<CategoryIconBoxProps> = ({
  icon,
  color,
  className = 'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
  iconClassName = 'w-4 h-4',
  strokeWidth = 1.5,
}) => {
  const harmonizedColor = getHarmonizedCategoryColor(color)
  const tintBg = getCategoryTintBackground(harmonizedColor, 0.12)

  const hasTint = Boolean(harmonizedColor && tintBg)

  return (
    <div
      className={`${className} ${
        hasTint
          ? 'transition-all border border-black/5 shadow-2xs'
          : 'bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-[rgba(20,33,61,0.04)] shadow-2xs'
      }`}
      style={hasTint ? { backgroundColor: tintBg! } : undefined}
    >
      <span
        className="inline-flex items-center justify-center transition-transform group-hover:scale-105"
        style={hasTint ? { color: harmonizedColor! } : undefined}
      >
        <CategoryIcon name={icon} className={iconClassName} strokeWidth={strokeWidth} />
      </span>
    </div>
  )
}

export const AVAILABLE_ICONS = [
  'Home',
  'ShoppingCart',
  'Car',
  'HeartPulse',
  'GraduationCap',
  'Utensils',
  'Ticket',
  'Sparkles',
  'Tv',
  'ShoppingBag',
  'PawPrint',
  'ShieldCheck',
  'Target',
  'TrendingUp',
  'Film',
  'Smartphone',
  'Plane',
  'Shirt',
  'Briefcase',
  'PiggyBank',
  'CreditCard',
  'Tag',
  'Zap',
  'Coffee',
  'Gift',
  'ArrowDownRight',
  'AlertCircle',
  'Hammer',
  'Dumbbell',
  'PartyPopper',
]
