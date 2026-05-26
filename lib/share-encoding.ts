export const MAX_SHARE_EVENTS = 25

interface SharePayload {
  ids: string[]
  name?: string
}

function toBase64Url(input: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }
  // Browser path.
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(input: string): string | null {
  const trimmed = input.startsWith('#') ? input.slice(1) : input
  if (!trimmed) return null
  const padded = trimmed.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (trimmed.length % 4)) % 4)
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8')
    }
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function uniqueInOrder(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function encodePlan({ ids, name }: SharePayload): string {
  const cleaned = uniqueInOrder(ids).slice(0, MAX_SHARE_EVENTS)
  const parts: string[] = []
  if (name && name.trim()) parts.push(`n=${encodeURIComponent(name.trim())}`)
  parts.push(`i=${cleaned.join(',')}`)
  return toBase64Url(parts.join('|'))
}

export function decodePlan(hash: string): SharePayload {
  const raw = fromBase64Url(hash)
  if (!raw) return { ids: [], name: undefined }
  const segments = raw.split('|')
  const out: SharePayload = { ids: [], name: undefined }
  for (const segment of segments) {
    const eq = segment.indexOf('=')
    if (eq === -1) continue
    const key = segment.slice(0, eq)
    const value = segment.slice(eq + 1)
    if (key === 'i') {
      out.ids = uniqueInOrder(
        value.split(',').map((s) => s.trim()).filter(Boolean)
      ).slice(0, MAX_SHARE_EVENTS)
    } else if (key === 'n') {
      try {
        out.name = decodeURIComponent(value) || undefined
      } catch {
        out.name = undefined
      }
    }
    // Unknown keys are ignored — forward compatible.
  }
  return out
}
