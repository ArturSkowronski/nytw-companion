'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'

// gtag.js intercepts history API by default for SPA pageview tracking.
// In Next.js App Router that creates a feedback loop with the router's
// own history listeners → >100 replaceState calls in 10s → iOS Safari/Chrome
// throw a security error → app crashes. send_page_view:false disables the
// auto-instrumentation; we send pageviews ourselves on pathname change.
//
// useSearchParams() forces a Suspense boundary at build time (else every
// statically prerendered page bails out to CSR). The tracker lives inside
// a local Suspense to scope that requirement to GA, not the whole app.
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

function PageviewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
    const qs = searchParams?.toString()
    const page_path = qs ? `${pathname}?${qs}` : pathname
    window.gtag('event', 'page_view', { page_path })
  }, [pathname, searchParams])

  return null
}

export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID
  if (!id) return null
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${id}', {
            client_storage: 'none',
            anonymize_ip: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
            send_page_view: false,
          });
        `}
      </Script>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
    </>
  )
}
