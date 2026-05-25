import type { Metadata } from 'next'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'

export const metadata: Metadata = {
  title: "About — NYTW Engineer's Companion",
  description:
    'Why we built NYTW Companion, how we curate the 87 events, and who is behind the project.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#000000] text-[#F5F5F5]">
      <section className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        <h1 className="font-mono text-3xl md:text-4xl font-bold">
          About NYTW Companion
        </h1>

        <section className="space-y-3">
          <h2 className="font-mono text-xl font-bold">Why this exists</h2>
          <p className="text-[#9B9B9B] text-base leading-relaxed">
            Tech Week NYC runs about a thousand events in a single week. No existing
            aggregator filters for engineers who ship code — they surface the same
            founder dinners, mixers, and demo nights. NYTW Companion is one engineer&apos;s
            opinionated cut: 87 events across AI infra, devtools, platform engineering,
            security, and open source. Day-grouped, mapped, with honest blurbs on the
            Editor&apos;s Picks.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-mono text-xl font-bold">How we curate</h2>
          <ul className="space-y-2 text-[#9B9B9B] text-base leading-relaxed">
            <li className="flex gap-3">
              <span className="text-[#FF5B25] font-mono shrink-0">•</span>
              <span>We read every event description, not just the title.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#FF5B25] font-mono shrink-0">•</span>
              <span>We pick for engineers who ship — devtools, AI infra, platform engineering, security, open source.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#FF5B25] font-mono shrink-0">•</span>
              <span>We disclose when VirtusLab hosts an event (see Editor&apos;s Picks).</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#FF5B25] font-mono shrink-0">•</span>
              <span>We link to alternatives we don&apos;t cover (see /beyond).</span>
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <p className="text-[#9B9B9B] text-sm leading-relaxed">
            NYTW Engineer&apos;s Companion is an independent project by VirtusLab. Not affiliated with a16z, Tech Week NYC, or any host listed.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-mono text-xl font-bold">Who built this</h2>
          <div className="flex items-start gap-4">
            <div
              aria-label="Artur Skowroński"
              className="shrink-0 w-16 h-16 rounded-full bg-[#FF5B25] flex items-center justify-center text-white font-mono font-bold text-lg"
            >
              AS
            </div>
            <div className="space-y-2">
              <p className="font-mono font-bold text-[#F5F5F5]">Artur Skowroński</p>
              <p className="font-mono text-sm text-[#9B9B9B]">Engineer at VirtusLab</p>
              {/* TODO: replace with real bio */}
              <p className="text-[#9B9B9B] text-sm leading-relaxed">
                Engineer working on developer experience and AI infrastructure. NYTW Companion is a side project to learn about NYC tech events from the inside.
              </p>
              {/* TODO: replace with real LinkedIn URL */}
              <a
                href="https://www.linkedin.com/in/askowronski/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[#FF5B25] hover:underline font-mono text-sm"
              >
                LinkedIn →
              </a>
            </div>
          </div>
        </section>
      </section>

      <VirtusLabFooter />
    </main>
  )
}
