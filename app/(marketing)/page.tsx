import type { Metadata } from 'next'
import Link from 'next/link'
import { EditorsPicksCarousel } from '@/components/EditorsPicksCarousel'
import { PartnerInvite } from '@/components/PartnerInvite'
import { SectionHead } from '@/components/SectionHead'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'
import seedEvents from '@/data/seed-events.json' with { type: 'json' }
import { SITE_URL } from '@/lib/site-url'
import type { Event } from '@/lib/types'

const TOTAL_EVENTS = (seedEvents as Event[]).length
const MCP_ENDPOINT = `${SITE_URL}/mcp`

export const metadata: Metadata = {
  title: "NYTW Engineer's Companion — Tech Week NYC 2026",
  description: `Curated engineering events for Tech Week NYC 2026. Built for humans and AI agents — browse in the app, or connect via MCP.`,
}

export const revalidate = 3600

export default function HomePage() {
  const picks = (seedEvents as Event[]).filter((e) => e.is_editors_pick)

  return (
    <main className="min-h-screen bg-[#000000] text-[#F5F5F5]">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center gap-8 pt-10">
        <div className="space-y-4 max-w-2xl">
          <p className="text-[#FF5B25] font-mono text-sm tracking-widest uppercase">
            Tech Week NYC · June 1–7, 2026
          </p>
          <h1 className="font-mono text-5xl md:text-7xl font-bold tracking-tight leading-none">
            NYTW Engineer&apos;s<br />Companion
          </h1>
          <p className="text-[#9B9B9B] text-lg md:text-xl leading-relaxed">
            1,390 events scraped. 1,011 dropped. {TOTAL_EVENTS} kept.<br />
            Plan the week you actually want.
          </p>
          <p className="text-[#9B9B9B] text-sm font-mono pt-2">
            For humans <span className="text-[#FF5B25]">and</span> AI agents.{' '}
            <Link href="#mcp" className="underline underline-offset-4 hover:text-[#F5F5F5]">
              Connect via MCP →
            </Link>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/events"
            className="px-8 py-4 bg-[#FF5B25] text-white font-mono font-bold text-lg rounded-md hover:bg-[#e85a25] transition-colors inline-flex items-center justify-center"
          >
            Browse {TOTAL_EVENTS} events →
          </Link>
          <Link
            href="/plan"
            className="px-8 py-4 border border-[#9B9B9B] text-[#F5F5F5] font-mono font-bold text-lg rounded-md hover:border-[#F5F5F5] hover:bg-[#0B0B0B] transition-colors inline-flex items-center justify-center"
          >
            Plan my week with AI →
          </Link>
        </div>

        <p className="text-[#9B9B9B] text-sm font-mono">
          or{' '}
          <Link href="/beyond" className="hover:text-[#9B9B9B] underline underline-offset-4">
            see /beyond if you want it all →
          </Link>
        </p>
      </section>

      {/* 3-step flow strip */}
      <section className="px-6 py-16 border-t border-[#1A1A1A]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { n: '①', label: 'Browse or AI-plan', body: `Curated events, day-grouped, or describe yourself and let the AI propose a week.` },
            { n: '②', label: 'Add to My Plan', body: 'One-click add. Status tracking, conflict warnings, all stored in your browser.' },
            { n: '③', label: 'Sync to your calendar', body: 'Download .ics, drop it into Google Calendar / Outlook / Apple Calendar.' },
          ].map((step) => (
            <div key={step.n} className="space-y-2">
              <p className="text-[#FF5B25] font-mono text-2xl">{step.n}</p>
              <p className="font-mono font-bold text-[#F5F5F5] text-base">{step.label}</p>
              <p className="text-[#9B9B9B] text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Disclosure: VirtusLab events at NYTW — the conversion stopper. */}
      <PartnerInvite />

      {/* MCP for agents */}
      <section id="mcp" className="px-6 py-16 border-t border-[#1A1A1A]">
        <div className="max-w-3xl mx-auto space-y-6">
          <SectionHead num="00" label="For agents" title="Companion is MCP-native" />
          <p className="text-[#9B9B9B] text-base leading-relaxed">
            The same curated catalogue your browser uses is exposed over the
            Model Context Protocol. Point Claude, Cursor, or any MCP-aware agent
            at the URL below and it can browse, search, and pull events without
            scraping the UI.
          </p>

          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-widest text-[#FF5B25]">Endpoint</p>
            <code className="block bg-[#0B0B0B] border border-[#1A1A1A] rounded-md px-4 py-3 font-mono text-sm text-[#F5F5F5] break-all">
              {MCP_ENDPOINT}
            </code>
          </div>

          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-widest text-[#FF5B25]">Tools exposed</p>
            <ul className="space-y-2 text-[#9B9B9B] text-sm">
              <li><code className="text-[#F5F5F5]">catalogue_stats</code> — counts by day / tag / format. Start here.</li>
              <li><code className="text-[#F5F5F5]">list_events</code> — paginate, filter by day / tag / format / host.</li>
              <li><code className="text-[#F5F5F5]">search_events</code> — fuzzy search across title / host / description.</li>
              <li><code className="text-[#F5F5F5]">get_event</code> — full record by id.</li>
              <li><code className="text-[#F5F5F5]">next_up</code> — events starting in the next N hours (NYC time).</li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-widest text-[#FF5B25]">Claude Desktop config</p>
            <pre className="bg-[#0B0B0B] border border-[#1A1A1A] rounded-md px-4 py-3 font-mono text-xs text-[#F5F5F5] overflow-x-auto">{`{
  "mcpServers": {
    "nytw": {
      "url": "${MCP_ENDPOINT}"
    }
  }
}`}</pre>
          </div>

          <p className="text-[#9B9B9B] text-sm leading-relaxed">
            All MCP traffic uses the same data shipped to the browser — no auth,
            no rate limits beyond your hosting plan, no analytics on agent
            queries. The catalogue is open. Build whatever schedule-bot you
            want on top.
          </p>
        </div>
      </section>

      {/* Editor's Picks */}
      {picks.length > 0 && (
        <section className="px-6 py-16 border-t border-[#1A1A1A]">
          <div className="max-w-5xl mx-auto">
            <EditorsPicksCarousel picks={picks} />
          </div>
        </section>
      )}

      {/* Why we built this */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto space-y-5">
          <SectionHead num="01" label="Background" title="Why we built this" />
          <p className="text-[#9B9B9B] text-base leading-relaxed">
            Tech Week NYC runs over a thousand events in a single week. No existing
            aggregator filters for engineers who actually ship code — they all surface
            the same founder dinners, networking mixers, and demo nights. We wanted
            something we&apos;d send to a colleague.
          </p>
          <p className="text-[#9B9B9B] text-base leading-relaxed">
            So this is the opinionated cut: {TOTAL_EVENTS} events across AI infra,
            devtools, platform engineering, security, fintech, and open source —
            sifted from 1,390 scraped through two LLM curation passes that read every
            event description. Curation over filtering.
          </p>
          <p className="text-[#9B9B9B] text-sm font-mono pt-2">
            — Artur Skowroński, VirtusLab
          </p>
        </div>
      </section>

      {/* What we don't do */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto space-y-4">
          <SectionHead num="02" label="Honesty" title="What we don't do" />
          <ul className="space-y-3 text-[#9B9B9B] text-base leading-relaxed">
            <li className="flex gap-3">
              <span className="text-[#FF5B25] font-mono shrink-0">•</span>
              <span>We don&apos;t RSVP for you. You click through to Luma/Partiful, then mark status here.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#FF5B25] font-mono shrink-0">•</span>
              <span>We don&apos;t have every event — we have {TOTAL_EVENTS} we&apos;d recommend to an engineer friend.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#FF5B25] font-mono shrink-0">•</span>
              <span>We don&apos;t track you. Plan stored in your browser. Email link only if you want recovery. MCP traffic isn&apos;t logged either.</span>
            </li>
          </ul>
        </div>
      </section>

      <VirtusLabFooter />
    </main>
  )
}
