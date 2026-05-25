'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface ConciergeFormProps {
  existingCount: number
  submitting: boolean
  error: string | null
  onSubmit: (profileText: string) => void
}

const PLACEHOLDER =
  "I'm a CTO at a 30-person AI startup, flying in from Warsaw. Looking for GenAI infrastructure talks, fundraising contacts, and AI talent. Available Tue-Fri."

export function ConciergeForm({ existingCount, submitting, error, onSubmit }: ConciergeFormProps) {
  const [text, setText] = useState('')
  const isTooShort = text.trim().length < 10

  function handleSubmit() {
    if (isTooShort || submitting) return
    onSubmit(text.trim())
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#A3A3A3]">
        {existingCount > 0
          ? `You have ${existingCount} events in your plan. AI will suggest more — it won't replace your plan.`
          : 'Tell us about yourself and AI will pick 5–8 events you\'d like.'}
      </p>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={4}
        className="bg-[#111111] border-[#1A1A1A] text-[#FAFAFA] font-mono text-sm"
      />

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSubmit}
          disabled={isTooShort || submitting}
          className="bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono"
        >
          Get 5–8 suggestions →
        </Button>
        {submitting && (
          <span className="text-xs font-mono text-[#7A7A7A]">
            Claude is reading the catalog…
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm font-mono text-red-400 bg-red-500/10 border border-red-500/30 rounded-md p-3">
          {error}
        </p>
      )}
    </div>
  )
}
