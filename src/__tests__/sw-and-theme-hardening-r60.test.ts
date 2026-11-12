import { describe, it, expect } from 'vitest'
import swScriptRaw from '../../public/sw.js?raw'
import manifest from '../../public/manifest.json'
import indexHtmlRaw from '../../index.html?raw'
import mainCssRaw from '../main.css?raw'

describe('R60 — Service Worker, Manifest e Blindagem de Tema Claro', () => {
  describe('TAREFA 1 & 5 — Service Worker Atualização Forçada', () => {
    it('o service worker implementa self.skipWaiting() no evento de instalação', () => {
      expect(swScriptRaw).toContain('self.skipWaiting()')
      expect(swScriptRaw).toMatch(/addEventListener\(['"]install['"]/)
    })

    it('o service worker implementa self.clients.claim() no evento de ativação', () => {
      expect(swScriptRaw).toContain('self.clients.claim()')
      expect(swScriptRaw).toMatch(/addEventListener\(['"]activate['"]/)
    })

    it('o service worker implementa limpeza de caches antigos na ativação', () => {
      expect(swScriptRaw).toContain('caches.delete')
    })

    it('o service worker implementa network-first para navegações de página (HTML)', () => {
      expect(swScriptRaw).toContain("request.mode === 'navigate'")
      expect(swScriptRaw).toContain('fetch(request)')
    })

    it('o service worker escuta mensagem SKIP_WAITING vinda dos clientes', () => {
      expect(swScriptRaw).toContain("event.data.type === 'SKIP_WAITING'")
    })
  })

  describe('TAREFA 2 & 5 — Manifest do PWA Blindado com Cores Dark CDS v3.0', () => {
    it('o manifest tem theme_color e background_color com o preto neutro canônico oficial do CDS v3.0 (#161616)', () => {
      expect(manifest.theme_color).toBe('#161616')
      expect(manifest.background_color).toBe('#161616')
    })

    it('o manifest define name e short_name oficiais com a grafia Curiangoo', () => {
      expect(manifest.name).toContain('Curiangoo')
      expect(manifest.short_name).toBe('Curiangoo')
      expect(manifest.display).toBe('standalone')
    })
  })

  describe('TAREFA 3 & 5 — Declaração de Tema Dark Reforçada & Nenhuma media query prefers-color-scheme em conflito', () => {
    it('index.html declara meta color-scheme="dark" e theme-color #161616', () => {
      expect(indexHtmlRaw).toContain('<meta name="color-scheme" content="dark"')
      expect(indexHtmlRaw).toContain('<meta name="theme-color" content="#161616"')
    })

    it('CSS não possui nenhuma regra @media (prefers-color-scheme: dark) que altere o visual', () => {
      expect(mainCssRaw).not.toContain('@media (prefers-color-scheme: dark)')
      expect(mainCssRaw).not.toContain('prefers-color-scheme: dark')
    })
  })
})
