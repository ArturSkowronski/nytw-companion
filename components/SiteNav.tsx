'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { HelpModal } from '@/components/HelpModal'

type NavItem = { label: string; href: string; live: boolean }

const ITEMS: NavItem[] = [
  { label: 'Home',         href: '/',        live: true },
  { label: 'Browse',       href: '/events',  live: true },
  { label: 'Now',          href: '/now',     live: true },
  { label: 'My Plan',      href: '/my-plan', live: false },
  { label: 'Plan with AI', href: '/plan',    live: true },
  { label: 'Beyond',       href: '/beyond',  live: true },
  { label: 'About',        href: '/about',   live: true },
]

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  if (!item.live) {
    return (
      <span
        className="font-mono text-sm text-[#9B9B9B] cursor-not-allowed flex flex-col"
        aria-disabled="true"
      >
        {item.label}
        <span className="text-[10px] text-[#333333]">Coming soon</span>
      </span>
    )
  }
  return (
    <Link
      href={item.href}
      className={`font-mono text-sm ${active ? 'text-[#FF5B25]' : 'text-[#9B9B9B] hover:text-[#F5F5F5]'}`}
    >
      {item.label}
    </Link>
  )
}

export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="border-b border-[#1A1A1A] bg-[#000000]">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-mono font-bold text-[#F5F5F5] text-base">
          NYTW Companion
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-6 items-center">
          {ITEMS.filter((i) => i.href !== '/').map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>

        {/* Mobile hamburger */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  className="border-[#333333] text-[#F5F5F5] font-mono"
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
                <SheetTitle className="font-mono text-base text-[#F5F5F5] text-left">
                  Menu
                </SheetTitle>
              </SheetHeader>
              <ul className="flex flex-col gap-4">
                {ITEMS.map((item) => (
                  <li key={item.href} onClick={() => setOpen(false)}>
                    <NavLink item={item} active={isActive(item.href)} />
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
