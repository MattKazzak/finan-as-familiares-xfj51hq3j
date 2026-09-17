// Utilitário de mapeamento dinâmico de ícones Lucide
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
}

interface CategoryIconProps {
  name: string | null | undefined
  className?: string
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ name, className = 'w-4 h-4' }) => {
  if (!name) return <Tag className={className} />
  const IconComponent = iconMap[name] || HelpCircle
  return <IconComponent className={className} />
}

export const AVAILABLE_ICONS = [
  'Utensils',
  'ShoppingBag',
  'Car',
  'Home',
  'HeartPulse',
  'GraduationCap',
  'Film',
  'Smartphone',
  'Plane',
  'PawPrint',
  'Shirt',
  'Briefcase',
  'TrendingUp',
  'PiggyBank',
  'Sparkles',
  'CreditCard',
  'Tag',
  'Zap',
  'Coffee',
  'Gift',
]
