'use client'

import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
  heading?: string
}

export default function GlobalError({ error, reset, heading = 'Something broke.' }: ErrorProps) {
  return (
    <main className="min-h-[60vh] bg-[#0A0A0A] text-[#FAFAFA] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="font-mono text-2xl font-bold">{heading}</h1>
        <p className="font-mono text-sm text-[#A3A3A3] break-words">
          {error.message || 'Unknown error.'}
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 bg-[#FF6B35] text-white font-mono text-sm rounded hover:bg-[#e85a25] transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 border border-[#2A2A2A] text-[#A3A3A3] font-mono text-sm rounded hover:bg-[#111111] hover:text-[#FAFAFA] transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  )
}
