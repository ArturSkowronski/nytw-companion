import type { Metadata } from 'next'
import { SectionHead } from '@/components/SectionHead'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'

export const metadata: Metadata = {
  title: "Terms — NYTW Engineer's Companion",
  description:
    'Terms of use for NYTW Companion: independent project by VirtusLab, not affiliated with a16z or Tech Week NYC, no warranty.',
  alternates: { canonical: '/terms' },
}

function Section({ num, label, title, children }: { num: string; label: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <SectionHead num={num} label={label} title={title} />
      <p className="text-[#9B9B9B] text-base leading-relaxed">{children}</p>
    </section>
  )
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#000000] text-[#F5F5F5]">
      <section className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <h1 className="font-mono text-3xl md:text-4xl font-bold">Terms of use</h1>
        <p className="text-[#9B9B9B] text-base leading-relaxed">
          Short version: use at your own risk. We&apos;re not Tech Week.
        </p>

        <Section num="01" label="Project" title="Independence">
          NYTW Engineer&apos;s Companion is an independent project by VirtusLab. Not affiliated with a16z, Tech Week NYC, or any host listed.
        </Section>

        <Section num="02" label="Content" title="Event listings">
          Events shown are publicly listed elsewhere — we link them. Inclusion is not endorsement. Hosts, dates, venues can change without our knowledge; verify on the host&apos;s official page before showing up.
        </Section>

        <Section num="03" label="Disclaimer" title="No warranty">
          The site is provided &ldquo;as is&rdquo;. We don&apos;t guarantee accuracy, completeness, or uptime. We may add, remove, or change events at any time.
        </Section>

        <Section num="04" label="AI" title="AI proposals">
          The AI Concierge proposes ideas. They&apos;re suggestions, not advice. We don&apos;t guarantee fit, quality, or availability of suggested events.
        </Section>

        <Section num="05" label="Use" title="Your conduct">
          Don&apos;t abuse the API endpoints. Rate limits apply. If you find a bug or content issue, see{' '}
          <a href="/about" className="text-[#FF5B25] hover:underline">/about</a> for contact.
        </Section>

        <Section num="06" label="Legal" title="Liability">
          To the extent permitted by law, VirtusLab has no liability for any loss arising from your use of the site.
        </Section>
      </section>

      <VirtusLabFooter />
    </main>
  )
}
