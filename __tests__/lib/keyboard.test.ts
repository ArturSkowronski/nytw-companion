import { describe, it, expect } from 'vitest'
import { isTypingTarget } from '../../lib/keyboard'

describe('isTypingTarget', () => {
  it('returns true for <input>', () => {
    const el = document.createElement('input')
    expect(isTypingTarget(el)).toBe(true)
  })

  it('returns true for <textarea>', () => {
    const el = document.createElement('textarea')
    expect(isTypingTarget(el)).toBe(true)
  })

  it('returns true for <select>', () => {
    const el = document.createElement('select')
    expect(isTypingTarget(el)).toBe(true)
  })

  it('returns true for contentEditable element', () => {
    const el = document.createElement('div')
    el.contentEditable = 'true'
    expect(isTypingTarget(el)).toBe(true)
  })

  it('returns false for plain <div>', () => {
    expect(isTypingTarget(document.createElement('div'))).toBe(false)
  })

  it('returns false for null', () => {
    expect(isTypingTarget(null)).toBe(false)
  })
})
