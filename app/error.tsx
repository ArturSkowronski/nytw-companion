'use client'

import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
  heading?: string
}

export default function GlobalError({ error, reset, heading = 'Something broke.' }: ErrorProps) {
  return (
    <main className="min-h-[60vh] bg-[#000000] text-[#F5F5F5] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="font-mono text-2xl font-bold">{heading}</h1>
        <p className="font-mono text-sm text-[#9B9B9B] break-words">
          {error.message || 'Unknown error.'}
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 bg-[#FF5B25] text-white font-mono text-sm rounded hover:bg-[#e85a25] transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 border border-[#262626] text-[#9B9B9B] font-mono text-sm rounded hover:bg-[#0B0B0B] hover:text-[#F5F5F5] transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  )
}
