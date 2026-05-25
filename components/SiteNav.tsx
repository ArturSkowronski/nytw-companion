'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { HelpModal } from '@/components/HelpModal'

type NavItem = { label: string; href: string; live: boolean }

const ITEMS: NavItem[] = [
  { label: 'Home',    href: '/',        live: true },
  { label: 'Browse',  href: '/events',  live: true },
  { label: 'Now',     href: '/now',     live: true },
  { label: 'My Plan', href: '/my-plan', live: true },
  { label: 'Plan',    href: '/plan',    live: true },
  { label: 'Beyond',  href: '/beyond',  live: true },
  { label: 'About',   href: '/about',   live: true },
]

export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  const tabItems = ITEMS.filter((i) => i.live && i.href !== '/')

  return (
    <div className="border-b border-[#1A1A1A] bg-[#000000]">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Brand mark */}
        <Link href="/" className="flex items-center gap-3.5">
          <span className="relative grid place-items-center w-9 h-9 border border-[#FF5B25] text-[#FF5B25] font-mono font-bold text-sm">
            §§
            <span className="absolute inset-[3px] border border-[#FF5B25]/[0.35] pointer-events-none" />
          </span>
          <span className="font-mono text-sm font-bold uppercase tracking-[0.08em] text-[#F5F5F5]">
            NYTW <span className="text-[#737373] font-normal">Companion</span>
          </span>
        </Link>

        {/* Desktop tabs (skip "Home" — already the mark) */}
        <nav className="hidden md:flex border border-[#262626]">
          {tabItems.map((item, idx) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                'font-mono text-xs uppercase tracking-[0.1em] px-4 py-2.5 transition-colors ' +
                (idx < tabItems.length - 1 ? 'border-r border-[#262626] ' : '') +
                (isActive(item.href)
                  ? 'bg-[#FF5B25] text-black'
                  : 'text-[#9B9B9B] hover:text-[#F5F5F5]')
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  className="border-[#262626] text-[#F5F5F5] font-mono uppercase tracking-wide"
                  aria-label="Open menu"
                >
                  ☰
                </Button>
              }
            />
            <SheetContent
              side="right"
              className="bg-[#000000] border-[#1A1A1A] text-[#F5F5F5] w-[280px] p-6"
            >
              <SheetHeader className="mb-6 p-0">
                <SheetTitle className="font-mono text-base text-[#F5F5F5] text-left uppercase tracking-wide">
                  Menu
                </SheetTitle>
              </SheetHeader>
              <ul className="flex flex-col gap-4">
                {ITEMS.filter((i) => i.live).map((item) => (
                  <li key={item.href} onClick={() => setOpen(false)}>
                    <Link
                      href={item.href}
                      className={
                        'font-mono text-sm uppercase tracking-wide ' +
                        (isActive(item.href)
                          ? 'text-[#FF5B25]'
                          : 'text-[#9B9B9B] hover:text-[#F5F5F5]')
                      }
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <HelpModal />
    </div>
  )
}
