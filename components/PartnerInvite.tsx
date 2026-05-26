// Disclosure-framed CTA section on the landing page.
// Surfaces the VirtusLab events at NYTW without breaking the editorial
// tone of the rest of the site — explicitly labelled "Made by VirtusLab".
import Image from 'next/image'
import { SectionHead } from '@/components/SectionHead'
import { PARTNER_EVENTS } from '@/lib/partner-events'

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
          <SectionHead num="03" label="Disclosure" title="Like this tool? Come say hi at NYTW." />
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#FF5B25] pt-1">
            Made by VirtusLab
          </p>
        </div>
        <p className="text-[#9B9B9B] text-base leading-relaxed max-w-3xl">
          We&rsquo;re an AI engineering team from Poland — and we built this companion
          to plan our own Tech Week. While you&rsquo;re here: we&rsquo;re hosting{' '}
          {events.length === 1 ? 'an event' : `${events.length} sessions`} at NYTW.
          Come meet us.
        </p>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((ev) => {
            const enabled = !!ev.rsvp_url
            const baseClasses =
              'group flex flex-col overflow-hidden border bg-[#0B0B0B] transition-colors h-full'
            const stateClasses = enabled
              ? 'border-[#262626] hover:border-[#FF5B25]'
              : 'border-[#1A1A1A] opacity-70'

            const card = (
              <>
                {ev.cover_url && (
                  <div className="relative aspect-[16/9] w-full bg-[#1A1A1A] overflow-hidden">
                    <Image
                      src={ev.cover_url}
                      alt={`${ev.title} — event cover`}
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                      unoptimized
                    />
                    <span className="absolute top-3 left-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#F5F5F5] bg-[#000000]/80 backdrop-blur px-2 py-1">
                      {ev.eyebrow}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-3 p-5 flex-1">
                  {!ev.cover_url && (
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FF5B25]">
                      {ev.eyebrow}
                    </p>
                  )}
                  <h3 className="font-mono text-lg leading-snug text-[#F5F5F5]">
                    {ev.title}
                  </h3>
                  <p className="text-sm text-[#9B9B9B] leading-relaxed">{ev.blurb}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-[#1A1A1A] text-xs font-mono text-[#737373]">
                    <span>
                      {ev.when ?? 'Date TBD'}
                      {ev.where ? ` · ${ev.where}` : ''}
                    </span>
                    <span className="text-[#FF5B25]">{enabled ? 'RSVP →' : 'soon'}</span>
                  </div>
                </div>
              </>
            )

            return (
              <li key={ev.id}>
                {enabled ? (
                  <a
                    href={ev.rsvp_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${baseClasses} ${stateClasses}`}
                  >
                    {card}
                  </a>
                ) : (
                  <div className={`${baseClasses} ${stateClasses}`} aria-disabled="true">
                    {card}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
