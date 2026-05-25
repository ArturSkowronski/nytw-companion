import type { Metadata } from 'next'
import Link from 'next/link'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'

export const metadata: Metadata = {
  title: "Offline — NYTW Engineer's Companion",
  description: "You're offline. Some pages may still work from local cache.",
  robots: { index: false },
}

const LINKS = [
  { href: '/my-plan', label: 'My Plan', hint: 'Works offline natively (stored in your browser).' },
  { href: '/now', label: 'Now', hint: "Works offline if you've visited it before." },
  { href: '/events', label: 'Browse events', hint: "Works offline if you've visited it before." },
]

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <section className="max-w-2xl mx-auto px-6 py-16 space-y-8">
        <div className="space-y-3">
          <h1 className="font-mono text-3xl md:text-4xl font-bold">You&apos;re offline.</h1>
          <p className="text-[#A3A3A3] text-base leading-relaxed">
            We can&apos;t reach the network right now. The pages you&apos;ve already visited should still work.
          </p>
        </div>

        <ul className="space-y-4">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block rounded-lg border border-[#1A1A1A] bg-[#111111] p-5 hover:border-[#FF6B35] transition-colors"
              >
                <p className="font-mono text-lg text-[#FAFAFA]">{link.label} →</p>
                <p className="text-[#A3A3A3] text-sm mt-1">{link.hint}</p>
              </Link>
            </li>
          ))}
        </ul>

        <p className="text-[#555555] text-sm font-mono">
          When you&apos;re back online, everything reconnects automatically.
        </p>
      </section>

      <VirtusLabFooter />
    </main>
  )
}
