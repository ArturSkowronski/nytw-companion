const MAX_FIELD_LENGTH = 2048
const TRUNCATION_SUFFIX = '…(truncated)'

export type ErrorKind = 'boundary' | 'window' | 'rejection'

export interface ReportErrorPayload {
  message: string
  stack?: string
  url?: string
  userAgent?: string
  kind: ErrorKind
}

function truncate(value: string): string {
  if (value.length <= MAX_FIELD_LENGTH) return value
  return value.slice(0, MAX_FIELD_LENGTH - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX
}

function normalizeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: truncate(error.message || error.name || 'Unknown error'),
      stack: error.stack ? truncate(error.stack) : undefined,
    }
  }
  if (typeof error === 'string') {
    return { message: truncate(error) }
  }
  return { message: truncate(String(error)) }
}

export function reportError(error: unknown, kind: ErrorKind): void {
  if (typeof window === 'undefined') return
  const normalized = normalizeError(error)
  const payload: ReportErrorPayload = {
    ...normalized,
    kind,
    url: window.location?.href,
    userAgent: window.navigator?.userAgent,
  }
  try {
    void fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // swallow — never throw from the reporter
    })
  } catch {
    // synchronous fetch error (rare) — swallow
  }
}
