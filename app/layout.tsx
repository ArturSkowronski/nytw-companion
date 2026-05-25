// app/layout.tsx
import type { Metadata } from 'next'
import { JetBrains_Mono, Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { Analytics } from '@vercel/analytics/next'
import { MyPlanWidget } from '@/components/MyPlanWidget'
import { SiteNav } from '@/components/SiteNav'
import { StatusBar } from '@/components/StatusBar'
import { SITE_URL } from '@/lib/site-url'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "NYTW Engineer's Companion",
  description: "1,000+ events. 168 hours. Plan the week you actually want.",
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} ${inter.variable} dark`}
      suppressHydrationWarning
    >
      <body
        className="bg-[#000000] text-[#F5F5F5] font-sans antialiased min-h-screen"
        suppressHydrationWarning
      >
        <StatusBar />
        <SiteNav />
        {children}
        <MyPlanWidget />
        <Toaster
          theme="dark"
          toastOptions={{
            classNames: {
              toast: 'bg-[#0B0B0B] border border-[#262626] text-[#F5F5F5] font-mono text-sm',
            },
          }}
        />
        <Analytics />
      </body>
    </html>
  )
}
