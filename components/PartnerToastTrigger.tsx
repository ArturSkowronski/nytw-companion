// Single-fire toast that introduces the VirtusLab NYTW sessions after the
// user has built some signal of intent (3 events in plan). Fires at most
// once per browser — flag in localStorage prevents repeats.
'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { usePlanStore } from '@/lib/plan-store'

const FIRED_KEY = 'nytw-vl-intro-toast-fired'
const TRIGGER_AT = 3 // active items needed to fire

export function PartnerToastTrigger() {
  const items = usePlanStore((s) => s.items)
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    if (typeof window === 'undefined') return
    if (localStorage.getItem(FIRED_KEY) === '1') {
      firedRef.current = true
      return
    }
    const active = items.filter((i) => i.status !== 'declined').length
    if (active < TRIGGER_AT) return

    firedRef.current = true
    localStorage.setItem(FIRED_KEY, '1')

    toast('Made by VirtusLab', {
      description:
        "Hosting 2 NYTW sessions on Tue Jun 2 — Visdom × book launch with Tomek. Come say hi.",
      duration: 12_000,
      action: {
        label: 'See →',
        onClick: () => {
          // Use full URL so it works regardless of current route.
          window.location.href = '/#meet-us'
        },
      },
    })
  }, [items])

  return null
}
