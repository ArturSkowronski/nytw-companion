// __tests__/lib/plan-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { usePlanStore } from '../../lib/plan-store'

describe('usePlanStore', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
  })

  it('initializes with empty items array', () => {
    expect(usePlanStore.getState().items).toHaveLength(0)
  })

  it('initializes with a non-empty anonymousToken string', () => {
    const { anonymousToken } = usePlanStore.getState()
    expect(typeof anonymousToken).toBe('string')
    expect(anonymousToken.length).toBeGreaterThan(0)
  })

  it('addItem appends event with status=interested and source=manual by default', () => {
    usePlanStore.getState().addItem('event-abc')
    const { items } = usePlanStore.getState()
    expect(items).toHaveLength(1)
    expect(items[0].event_id).toBe('event-abc')
    expect(items[0].status).toBe('interested')
    expect(items[0].source).toBe('manual')
    expect(items[0].added_at).toBeTruthy()
  })

  it('addItem does not add duplicate event_ids', () => {
    usePlanStore.getState().addItem('event-abc')
    usePlanStore.getState().addItem('event-abc')
    expect(usePlanStore.getState().items).toHaveLength(1)
  })

  it('removeItem removes the event with the matching event_id', () => {
    usePlanStore.getState().addItem('event-abc')
    usePlanStore.getState().removeItem('event-abc')
    expect(usePlanStore.getState().items).toHaveLength(0)
  })

  it('updateStatus changes the status of the matching event', () => {
    usePlanStore.getState().addItem('event-abc')
    usePlanStore.getState().updateStatus('event-abc', 'confirmed')
    expect(usePlanStore.getState().items[0].status).toBe('confirmed')
  })

  it('updateNotes sets the notes field on the matching event', () => {
    usePlanStore.getState().addItem('event-abc')
    usePlanStore.getState().updateNotes('event-abc', 'Bring business cards')
    expect(usePlanStore.getState().items[0].notes).toBe('Bring business cards')
  })

  it('clear resets items to an empty array', () => {
    usePlanStore.getState().addItem('event-abc')
    usePlanStore.getState().addItem('event-xyz')
    usePlanStore.getState().clear()
    expect(usePlanStore.getState().items).toHaveLength(0)
  })
})
