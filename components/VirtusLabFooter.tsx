import Link from 'next/link'

export function VirtusLabFooter() {
  return (
    <footer className="border-t border-[#1A1A1A] px-6 py-10 mt-16">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
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
    </footer>
  )
}
