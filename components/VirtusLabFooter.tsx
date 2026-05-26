import Link from 'next/link'

export function VirtusLabFooter() {
  return (
    <footer className="border-t border-[#1A1A1A] px-6 py-10 mt-16">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Subtle one-line disclosure pointing at our own NYTW sessions.
            Renders above the standard footer row — single sentence, no
            bright colors, embedded in the same monospace cadence as the
            rest of the footer. */}
        <p className="text-[#737373] text-xs font-mono leading-relaxed">
          Hosting at NYTW Tue Jun 2:{' '}
          <Link
            href="/#meet-us"
            className="text-[#9B9B9B] hover:text-[#FF5B25] underline underline-offset-4 decoration-[#262626] hover:decoration-[#FF5B25]"
          >
            Visdom session
          </Link>{' '}
          and{' '}
          <Link
            href="/#meet-us"
            className="text-[#9B9B9B] hover:text-[#FF5B25] underline underline-offset-4 decoration-[#262626] hover:decoration-[#FF5B25]"
          >
            book launch with Tomek
          </Link>
          . Come say hi.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[#9B9B9B] text-sm font-mono">
            Made by{' '}
            <a
              href="https://virtuslab.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FF5B25] hover:underline"
            >
              VirtusLab
            </a>
          </p>
          <p className="text-[#9B9B9B] text-sm font-mono">
            Not affiliated with a16z or Tech Week NYC
          </p>
          <nav className="flex gap-4 text-[#9B9B9B] text-xs font-mono">
            <Link href="/about" className="hover:text-[#9B9B9B]">
              About
            </Link>
            <Link href="/beyond" className="hover:text-[#9B9B9B]">
              Beyond
            </Link>
            <Link href="/privacy" className="hover:text-[#9B9B9B]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[#9B9B9B]">
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
