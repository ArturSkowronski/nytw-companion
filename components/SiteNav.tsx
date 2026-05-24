'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

type NavItem = { label: string; href: string; live: boolean }

const ITEMS: NavItem[] = [
  { label: 'Home',         href: '/',        live: true },
  { label: 'Browse',       href: '/events',  live: true },
  { label: 'Now',          href: '/now',     live: true },
  { label: 'My Plan',      href: '/my-plan', live: false },
  { label: 'Plan with AI', href: '/plan',    live: true },
  { label: 'Beyond',       href: '/beyond',  live: true },
  { label: 'About',        href: '/about',   live: false },
]

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  if (!item.live) {
    return (
      <span
        className="font-mono text-sm text-[#555555] cursor-not-allowed flex flex-col"
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
      className={`font-mono text-sm ${active ? 'text-[#FF6B35]' : 'text-[#A3A3A3] hover:text-[#FAFAFA]'}`}
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
    <div className="border-b border-[#1A1A1A] bg-[#0A0A0A]">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-mono font-bold text-[#FAFAFA] text-base">
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
                  className="border-[#333333] text-[#FAFAFA] font-mono"
                  aria-label="Open menu"
                >
                  ☰
                </Button>
              }
            />
            <SheetContent
              side="right"
              className="bg-[#0A0A0A] border-[#1A1A1A] text-[#FAFAFA] w-[280px] p-6"
            >
              <SheetHeader className="mb-6 p-0">
                <SheetTitle className="font-mono text-base text-[#FAFAFA] text-left">
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
    </div>
  )
}
