import Link from 'next/link'

export function VirtusLabFooter() {
  return (
    <footer className="border-t border-[#1A1A1A] px-6 py-10 mt-16">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[#A3A3A3] text-sm font-mono">
          Made by{' '}
          <a
            href="https://virtuslab.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FF6B35] hover:underline"
          >
            VirtusLab
          </a>
        </p>
        <p className="text-[#A3A3A3] text-sm font-mono">
          Not affiliated with a16z or Tech Week NYC
        </p>
        <nav className="flex gap-4 text-[#555555] text-xs font-mono">
          <Link href="/about" className="hover:text-[#A3A3A3]">
            About
          </Link>
          <Link href="/beyond" className="hover:text-[#A3A3A3]">
            Beyond
          </Link>
          <Link href="/privacy" className="hover:text-[#A3A3A3]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[#A3A3A3]">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  )
}
