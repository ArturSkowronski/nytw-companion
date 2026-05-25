import type { Metadata } from 'next'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'

export const metadata: Metadata = {
  title: "Privacy — NYTW Engineer's Companion",
  description:
    'How NYTW Companion handles your data: plan stored in your browser, no first-party tracking, AI calls go to Anthropic.',
  alternates: { canonical: '/privacy' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-mono text-xl font-bold">{title}</h2>
      <p className="text-[#9B9B9B] text-base leading-relaxed">{children}</p>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#000000] text-[#F5F5F5]">
      <section className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <h1 className="font-mono text-3xl md:text-4xl font-bold">Privacy</h1>
        <p className="text-[#9B9B9B] text-base leading-relaxed">
          NYTW Companion is built to be unintrusive. Here&apos;s exactly what happens with your data.
        </p>

        <Section title="Plan storage">
          Your plan lives in your browser&apos;s localStorage. We don&apos;t send it anywhere. Clearing site data deletes it.
        </Section>

        <Section title="AI Concierge">
          When you submit a profile to <code>/plan</code>, the text is sent to Anthropic&apos;s API to generate proposals. We don&apos;t store the text on our servers; we don&apos;t log it. Anthropic&apos;s terms apply to their handling — see their{' '}
          <a href="https://www.anthropic.com/legal" target="_blank" rel="noopener noreferrer" className="text-[#FF5B25] hover:underline">
            legal page
          </a>
          . Without an Anthropic API key configured the app serves deterministic mock proposals; nothing leaves your browser.
        </Section>

        <Section title="Analytics">
          We use Vercel Analytics for aggregate pageviews and Web Vitals. No per-user IDs, no cross-site tracking, no PII. You can disable it at the browser level with a content blocker.
        </Section>

        <Section title="Map tiles">
          When the map view is open, your browser fetches tiles from Mapbox. Mapbox sees the URL and your IP. See their{' '}
          <a href="https://www.mapbox.com/legal" target="_blank" rel="noopener noreferrer" className="text-[#FF5B25] hover:underline">
            legal page
          </a>
          .
        </Section>

        <Section title="Geolocation">
          <code>/now</code> offers a &ldquo;Get travel times&rdquo; button. If you tap it, your browser asks for permission. The position is used only on your device — we don&apos;t transmit it. We cache it for 5 minutes then forget.
        </Section>

        <Section title="Cookies">
          None set by us. The hosting provider may set deployment-related cookies; the analytics layer does not use cookies.
        </Section>

        <Section title="Changes">
          We may update this page. Material changes go in the GitHub history.
        </Section>
      </section>

      <VirtusLabFooter />
    </main>
  )
}
