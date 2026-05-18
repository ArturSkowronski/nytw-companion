// lib/plan-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlanItem, PlanStatus, PlanItemSource } from './types'

interface PlanStore {
  planId: string | null
  anonymousToken: string
  items: PlanItem[]
  addItem: (event_id: string, status?: PlanStatus, source?: PlanItemSource) => void
  removeItem: (event_id: string) => void
  updateStatus: (event_id: string, status: PlanStatus) => void
  updateNotes: (event_id: string, notes: string) => void
  clear: () => void
  hydrate: (items: PlanItem[]) => void
}

export const usePlanStore = create<PlanStore>()(
  persist(
    (set, get) => ({
      planId: null,
      anonymousToken: crypto.randomUUID(),
      items: [],

      addItem: (event_id, status = 'interested', source = 'manual') => {
        if (get().items.some((item) => item.event_id === event_id)) return
        set({
          items: [
            ...get().items,
            {
              event_id,
              status,
              source,
              added_at: new Date().toISOString(),
            },
          ],
        })
      },

      removeItem: (event_id) => {
        set({ items: get().items.filter((item) => item.event_id !== event_id) })
      },

      updateStatus: (event_id, status) => {
        set({
          items: get().items.map((item) =>
            item.event_id === event_id ? { ...item, status } : item
          ),
        })
      },

      updateNotes: (event_id, notes) => {
        set({
          items: get().items.map((item) =>
            item.event_id === event_id ? { ...item, notes } : item
          ),
        })
      },

      clear: () => set({ items: [] }),

      hydrate: (items) => set({ items }),
    }),
    {
      name: 'nytw-my-plan',
    }
  )
)
