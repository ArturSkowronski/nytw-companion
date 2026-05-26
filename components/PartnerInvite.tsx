// Disclosure-framed CTA section on the landing page.
// Surfaces the VirtusLab events at NYTW without breaking the editorial
// tone of the rest of the site — explicitly labelled "Made by VirtusLab".
import Image from 'next/image'
import { AttentionPulse } from '@/components/AttentionPulse'
import { SectionHead } from '@/components/SectionHead'
import { PARTNER_EVENTS, type PartnerEvent } from '@/lib/partner-events'

function SpeakerChip({ name, url, initials }: { name: string; url: string; initials: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 border border-[#262626] hover:border-[#FF5B25] bg-[#0B0B0B] px-2 py-1 text-xs text-[#9B9B9B] hover:text-[#F5F5F5] transition-colors"
      aria-label={`${name} on LinkedIn`}
    >
      <span
        aria-hidden="true"
        className="inline-flex w-5 h-5 items-center justify-center rounded-full border border-[#FF5B25] text-[10px] font-mono text-[#FF5B25]"
      >
        {initials}
      </span>
      <span className="font-mono">{name}</span>
      <span aria-hidden="true" className="text-[#FF5B25]">↗</span>
    </a>
  )
}

function Card({ ev }: { ev: PartnerEvent }) {
  const enabled = !!ev.rsvp_url

  return (
    <article
      className={`group flex flex-row gap-4 overflow-hidden border bg-[#0B0B0B] transition-colors h-full p-4 ${
        enabled ? 'border-[#262626] hover:border-[#FF5B25]' : 'border-[#1A1A1A] opacity-70'
      }`}
    >
      {ev.cover_url && (
        <a
          href={ev.rsvp_url ?? '#meet-us'}
          target={enabled ? '_blank' : undefined}
          rel={enabled ? 'noopener noreferrer' : undefined}
          className="relative w-24 h-24 sm:w-32 sm:h-32 shrink-0 bg-[#1A1A1A] overflow-hidden block"
          aria-label={`${ev.title} — open RSVP`}
        >
          <Image
            src={ev.cover_url}
            alt={`${ev.title} — event cover`}
            fill
            sizes="128px"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
            unoptimized
          />
        </a>
      )}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FF5B25]">
          {ev.eyebrow}
        </p>
        <h3 className="font-mono text-base leading-snug text-[#F5F5F5]">
          {enabled ? (
            <a
              href={ev.rsvp_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#FF5B25] transition-colors"
            >
              {ev.title}
            </a>
          ) : (
            ev.title
          )}
        </h3>
        {ev.speakers.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5">
            {ev.speakers.map((sp) => (
              <li key={sp.url}>
                <SpeakerChip {...sp} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[#9B9B9B] leading-relaxed line-clamp-3">{ev.blurb}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-2 border-t border-[#1A1A1A] text-xs font-mono text-[#737373]">
          <span className="truncate">
            {ev.when ?? 'Date TBD'}
            {ev.where ? ` · ${ev.where}` : ''}
          </span>
          {enabled ? (
            <a
              href={ev.rsvp_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FF5B25] hover:underline shrink-0"
            >
              RSVP →
            </a>
          ) : (
            <span className="text-[#FF5B25] shrink-0">soon</span>
          )}
        </div>
      </div>
    </article>
  )
}

export function PartnerInvite() {
  const events = PARTNER_EVENTS
  if (events.length === 0) return null

  return (
    <section
      id="meet-us"
      className="px-6 py-16 border-t border-[#1A1A1A]"
      aria-label="Meet the makers at NY Tech Week"
    >
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <AttentionPulse>
            <SectionHead num="03" label="Disclosure" title="Like this tool? Come say hi at NYTW." />
          </AttentionPulse>
          <a
            href="https://virtuslab.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block pt-1 transition-opacity hover:opacity-80"
            aria-label="Made by VirtusLab — visit virtuslab.com"
          >
            <Image
              src="/virtuslab-badge.png"
              alt="Made by VirtusLab"
              width={194}
              height={55}
              className="h-7 w-auto"
              priority
            />
          </a>
        </div>
        <p className="text-[#9B9B9B] text-base leading-relaxed max-w-3xl">
          We&rsquo;re an AI engineering team from Poland — and we built this companion
          to plan our own Tech Week. While you&rsquo;re here: we&rsquo;re hosting{' '}
          {events.length === 1 ? 'an event' : `${events.length} sessions`} at NYTW.
          Come meet us.
        </p>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((ev) => (
            <li key={ev.id}>
              <Card ev={ev} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
