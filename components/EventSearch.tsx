// components/EventSearch.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'

interface EventSearchProps {
  onSearch: (query: string) => void
}

export function EventSearch({ onSearch }: EventSearchProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus on '/' keypress anywhere on the page
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onSearch(e.target.value)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setQuery('')
      onSearch('')
      inputRef.current?.blur()
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="search"
        role="searchbox"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder='Search events… (press "/" to focus)'
        className="bg-[#111111] border-[#2A2A2A] text-[#FAFAFA] placeholder:text-[#555555] font-mono pr-16 focus-visible:ring-[#FF6B35]"
      />
      {query && (
        <button
          onClick={() => { setQuery(''); onSearch('') }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-[#A3A3A3] text-xs font-mono"
        >
          ESC
        </button>
      )}
    </div>
  )
}
