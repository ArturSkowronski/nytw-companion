'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { isTypingTarget } from '@/lib/keyboard'

const SHORTCUTS: { key: string; label: string }[] = [
  { key: '?', label: 'Show this help' },
  { key: '/', label: 'Focus search (Browse page)' },
  { key: 'm', label: 'Toggle map / timeline (Browse page)' },
  { key: 'Esc', label: 'Close drawer / modal' },
]

export function HelpModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== '?') return
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      setOpen(true)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-[#0A0A0A] border border-[#1A1A1A] text-[#FAFAFA] max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="font-mono text-base text-[#FAFAFA] text-left">
            Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <ul className="mt-4 space-y-3">
          {SHORTCUTS.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-4 font-mono text-sm">
              <kbd className="px-2 py-1 rounded border border-[#2A2A2A] bg-[#111111] text-[#FAFAFA] text-xs min-w-[36px] text-center">
                {s.key}
              </kbd>
              <span className="text-[#A3A3A3]">{s.label}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
