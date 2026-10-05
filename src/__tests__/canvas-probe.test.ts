import { describe, it } from 'vitest'

describe('canvas probe', () => {
  it('checks canvas availability', () => {
    console.log('has window:', typeof window)
    console.log('has document:', typeof document)
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas')
      console.log('canvas getContext:', typeof canvas.getContext)
      const ctx = canvas.getContext('2d')
      console.log('ctx2d:', !!ctx)
    }
  })
})
