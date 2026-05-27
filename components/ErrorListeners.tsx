'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/report-error'

export function ErrorListeners() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      reportError(event.error ?? event.message, 'window')
    }
    function handleRejection(event: PromiseRejectionEvent) {
      reportError(event.reason, 'rejection')
    }
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])
  return null
}
