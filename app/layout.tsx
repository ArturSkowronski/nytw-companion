// app/layout.tsx
import type { Metadata } from 'next'
import { JetBrains_Mono, Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { MyPlanWidget } from '@/components/MyPlanWidget'
import { SiteNav } from '@/components/SiteNav'
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
        className="bg-[#0A0A0A] text-[#FAFAFA] font-sans antialiased min-h-screen"
        suppressHydrationWarning
      >
        <SiteNav />
        {children}
        <MyPlanWidget />
        <Toaster
          theme="dark"
          toastOptions={{
            classNames: {
              toast: 'bg-[#111111] border border-[#2A2A2A] text-[#FAFAFA] font-mono text-sm',
            },
          }}
        />
      </body>
    </html>
  )
}
