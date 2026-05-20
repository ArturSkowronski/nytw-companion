type Window = { resetAt: number; count: number }

const store = new Map<string, Window>()

export function checkLimit(
  key: string,
  max: number,
  windowMs: number,
  nowMs: number = Date.now(),
): { ok: true } | { ok: false; retryAfterMs: number } {
  const existing = store.get(key)
  if (!existing || nowMs >= existing.resetAt) {
    store.set(key, { resetAt: nowMs + windowMs, count: 1 })
    return { ok: true }
  }
  if (existing.count < max) {
    existing.count += 1
    return { ok: true }
  }
  return { ok: false, retryAfterMs: existing.resetAt - nowMs }
}

export function resetForTests(): void {
  store.clear()
}
