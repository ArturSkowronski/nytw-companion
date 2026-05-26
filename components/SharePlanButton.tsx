'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { encodePlan, MAX_SHARE_EVENTS } from '@/lib/share-encoding'

interface SharePlanButtonProps {
  eventIds: string[]
}

function buildShareUrl(eventIds: string[], name: string): string {
  const payload = encodePlan({ ids: eventIds, name })
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://nytw.dev'
  return `${origin}/plan/share#${payload}`
}

export function SharePlanButton({ eventIds }: SharePlanButtonProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const url = useMemo(() => buildShareUrl(eventIds, name), [eventIds, name])
  const overCap = eventIds.length > MAX_SHARE_EVENTS

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied — paste it in your DM')
    } catch {
      toast('Could not copy. Select the link and copy it manually.')
    }
  }

  function handleNativeShare() {
    if (typeof navigator.share !== 'function') {
      handleCopy()
      return
    }
    navigator.share({ title: 'My NYTW plan', url }).catch(() => {
      // User cancelled — silent.
    })
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <>
      <Button
        variant="outline"
        className="font-mono text-xs"
        onClick={() => setOpen(true)}
        disabled={eventIds.length === 0}
        title={eventIds.length === 0 ? 'Add events to share' : 'Share my plan'}
      >
        Share my plan
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share my plan</DialogTitle>
            <DialogDescription>
              Anyone with this link can view your plan and add individual events to theirs.
              {overCap
                ? ` Your plan has ${eventIds.length} events — the link will include the first ${MAX_SHARE_EVENTS}.`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <label className="text-xs font-mono text-[#9B9B9B]">
              Your name <span className="text-[#737373]">— optional, shown in the link</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Marcin"
                className="mt-1"
                aria-label="Your name"
              />
            </label>

            <label className="text-xs font-mono text-[#9B9B9B]">
              Share link
              <Input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-1"
              />
            </label>

            <div className="flex gap-2 justify-end">
              {canShare && (
                <Button onClick={handleNativeShare} className="font-mono text-xs">
                  Share…
                </Button>
              )}
              <Button onClick={handleCopy} variant="outline" className="font-mono text-xs">
                Copy link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
