interface SectionHeadProps {
  num: string
  label: string
  title: string
  meta?: string
}

export function SectionHead({ num, label, title, meta }: SectionHeadProps) {
  return (
    <header className="grid grid-cols-1 md:grid-cols-[90px_1fr_auto] items-end gap-3 md:gap-6 pt-5 pb-6 border-t border-[#1A1A1A] mt-16">
      <span className="font-mono text-xs tracking-[0.16em] text-[#FF5B25]">§ {num}</span>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#9B9B9B] mb-1">{label}</p>
        <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-[#F5F5F5]">
          {title}
        </h2>
      </div>
      {meta && (
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#737373]">{meta}</p>
      )}
    </header>
  )
}
