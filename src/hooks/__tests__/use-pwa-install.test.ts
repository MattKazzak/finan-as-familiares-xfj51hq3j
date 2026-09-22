import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePwaInstall } from '../use-pwa-install'

describe('usePwaInstall', () => {
  const STORAGE_KEY = 'curiangoo_pwa_install_dismissed'

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('detects when already in standalone mode and does not show banner', () => {
    // Mock matchMedia standalone true
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { result } = renderHook(() => usePwaInstall())

    expect(result.current.isStandalone).toBe(true)
    expect(result.current.canShowBanner).toBe(false)
  })

  it('shows banner when not standalone on mobile viewport and not dismissed', () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    // Simula viewport mobile
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { result } = renderHook(() => usePwaInstall())

    expect(result.current.isStandalone).toBe(false)
    expect(result.current.isMobileDevice).toBe(true)
    expect(result.current.canShowBanner).toBe(true)
  })

  it('hides banner and persists to localStorage on dismiss()', () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    const { result } = renderHook(() => usePwaInstall())
    expect(result.current.canShowBanner).toBe(true)

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.isDismissed).toBe(true)
    expect(result.current.canShowBanner).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('detects iOS user agent correctly', () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })

    const { result } = renderHook(() => usePwaInstall())
    expect(result.current.isIos).toBe(true)
  })
})
