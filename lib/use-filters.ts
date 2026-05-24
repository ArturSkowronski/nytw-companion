'use client'

import { startTransition, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  parseFilters,
  serializeFilters,
  activeFilterCount,
  type Filters,
} from './filters'

const FILTER_PARAM_KEYS = ['tags', 'editorsPicks', 'freeFood', 'hideInviteOnly'] as const

type BoolKey = 'editorsPicks' | 'freeFood' | 'hideInviteOnly'

function buildUrl(pathname: string, params: URLSearchParams): string {
  const sortedEntries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b))
  const sorted = new URLSearchParams()
  for (const [k, v] of sortedEntries) sorted.set(k, v)
  const qs = sorted.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

function writeFilters(
  base: URLSearchParams,
  next: Filters
): URLSearchParams {
  const out = new URLSearchParams(base.toString())
  for (const key of FILTER_PARAM_KEYS) out.delete(key)
  const filterQs = serializeFilters(next)
  if (filterQs) {
    for (const [k, v] of new URLSearchParams(filterQs).entries()) out.set(k, v)
  }
  return out
}

export function useFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )

  const commit = useCallback(
    (next: Filters) => {
      const merged = writeFilters(new URLSearchParams(searchParams.toString()), next)
      const url = buildUrl(pathname, merged)
      startTransition(() => {
        router.replace(url, { scroll: false })
      })
    },
    [router, pathname, searchParams]
  )

  const toggleTag = useCallback(
    (tag: string) => {
      const t = tag.trim().toLowerCase()
      if (!t) return
      const present = filters.tags.includes(t)
      const tags = present ? filters.tags.filter((x) => x !== t) : [...filters.tags, t]
      commit({ ...filters, tags })
    },
    [filters, commit]
  )

  const setFilter = useCallback(
    (key: BoolKey, value: boolean) => {
      commit({ ...filters, [key]: value })
    },
    [filters, commit]
  )

  const reset = useCallback(() => {
    commit({ tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false })
  }, [commit])

  const activeCount = activeFilterCount(filters)

  return { filters, toggleTag, setFilter, reset, activeCount }
}
