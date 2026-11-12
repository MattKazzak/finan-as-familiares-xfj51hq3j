import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  CategoryIconBox,
  getHarmonizedCategoryColor,
  getCategoryTintBackground,
} from '../CategoryIcon'

describe('CategoryIcon helpers & CategoryIconBox (CDS v1.0 Soft Tint)', () => {
  describe('getHarmonizedCategoryColor', () => {
    it('retorna null para valores nulos, vazios ou indefinidos', () => {
      expect(getHarmonizedCategoryColor(null)).toBeNull()
      expect(getHarmonizedCategoryColor(undefined)).toBeNull()
      expect(getHarmonizedCategoryColor('')).toBeNull()
      expect(getHarmonizedCategoryColor('   ')).toBeNull()
    })

    it('suaviza cores berrantes/saturadas conhecidas', () => {
      // Rosa chiclete
      expect(getHarmonizedCategoryColor('#EC4899')).toBe('#BE185D')
      expect(getHarmonizedCategoryColor('#f43f5e')).toBe('#E11D48')
      // Roxo elétrico
      expect(getHarmonizedCategoryColor('#8B5CF6')).toBe('#6D28D9')
      expect(getHarmonizedCategoryColor('#a855f7')).toBe('#6D28D9')
      // Turquesa / ciano neon
      expect(getHarmonizedCategoryColor('#06B6D4')).toBe('#0E7490')
      expect(getHarmonizedCategoryColor('#14B8A6')).toBe('#0F766E')
    })

    it('mantém cores hex sóbrias já compatíveis', () => {
      expect(getHarmonizedCategoryColor('#10B981')).toBe('#10B981')
      expect(getHarmonizedCategoryColor('#14213D')).toBe('#14213D')
      expect(getHarmonizedCategoryColor('#FFC629')).toBe('#FFC629')
    })
  })

  describe('getCategoryTintBackground', () => {
    it('retorna null quando nenhuma cor é fornecida', () => {
      expect(getCategoryTintBackground(null)).toBeNull()
      expect(getCategoryTintBackground(undefined)).toBeNull()
    })

    it('gera rgba com alpha correto para hex de 6 dígitos', () => {
      // #14213D -> r: 20, g: 33, b: 61
      const tint = getCategoryTintBackground('#14213D', 0.12)
      expect(tint).toBe('rgba(20, 33, 61, 0.12)')
    })

    it('gera rgba com alpha customizado', () => {
      const tint = getCategoryTintBackground('#14213D', 0.2)
      expect(tint).toBe('rgba(20, 33, 61, 0.2)')
    })

    it('gera rgba para hex de 3 dígitos', () => {
      // #f00 -> r: 255, g: 0, b: 0
      const tint = getCategoryTintBackground('#f00', 0.15)
      expect(tint).toBe('rgba(255, 0, 0, 0.15)')
    })
  })

  describe('CategoryIconBox component', () => {
    it('renderiza fallback neutro quando cor não é informada', () => {
      const { container } = render(<CategoryIconBox icon="Home" color={null} />)
      const box = container.firstElementChild as HTMLElement

      expect(box).toBeDefined()
      // Deve conter as classes de fallback neutro
      expect(box.className).toContain('bg-slate-100')
      expect(box.className).toContain('dark:bg-slate-800')
      // Não deve ter estilo inline de background-color
      expect(box.style.backgroundColor).toBe('')
    })

    it('renderiza fallback neutro quando cor é string vazia', () => {
      const { container } = render(<CategoryIconBox icon="Utensils" color="" />)
      const box = container.firstElementChild as HTMLElement

      expect(box.className).toContain('bg-slate-100')
      expect(box.style.backgroundColor).toBe('')
    })

    it('renderiza container com soft tint quando cor válida é informada', () => {
      const { container } = render(
        <CategoryIconBox icon="Utensils" color="#14213D" className="custom-box" />,
      )
      const box = container.firstElementChild as HTMLElement

      expect(box).toBeDefined()
      expect(box.className).toContain('custom-box')
      expect(box.className).not.toContain('bg-slate-100')
      expect(box.style.backgroundColor).toBe('rgba(20, 33, 61, 0.12)')

      // O ícone filho deve carregar a cor harmonizada
      const iconWrapper = box.querySelector('span') as HTMLElement
      expect(iconWrapper).toBeDefined()
      expect(iconWrapper.style.color).toBe('rgb(20, 33, 61)')
    })

    it('harmoniza cores saturadas ao renderizar o box', () => {
      // #EC4899 harmoniza para #BE185D (rgb: 190, 24, 93)
      const { container } = render(<CategoryIconBox icon="Tag" color="#EC4899" />)
      const box = container.firstElementChild as HTMLElement

      expect(box.style.backgroundColor).toBe('rgba(190, 24, 93, 0.12)')
      const iconWrapper = box.querySelector('span') as HTMLElement
      expect(iconWrapper.style.color).toBe('rgb(190, 24, 93)')
    })
  })
})
