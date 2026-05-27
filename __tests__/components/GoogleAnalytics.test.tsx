import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'

// Mock next/script — it renders a placeholder we can query.
vi.mock('next/script', () => ({
  default: ({ src, children, id }: { src?: string; children?: string; id?: string }) => (
    // eslint-disable-next-line @next/next/no-sync-scripts
    <script data-testid={src ? `script-src-${id ?? 'external'}` : `script-inline-${id}`} src={src}>
      {children}
    </script>
  ),
}))

// usePathname / useSearchParams are used by the manual pageview tracker.
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

describe('GoogleAnalytics', () => {
  const original = process.env.NEXT_PUBLIC_GA_ID

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_GA_ID
    else process.env.NEXT_PUBLIC_GA_ID = original
  })

  it('renders nothing when NEXT_PUBLIC_GA_ID is unset', async () => {
    delete process.env.NEXT_PUBLIC_GA_ID
    const { GoogleAnalytics } = await import('../../components/GoogleAnalytics')
    const { container } = render(<GoogleAnalytics />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when NEXT_PUBLIC_GA_ID is empty', async () => {
    process.env.NEXT_PUBLIC_GA_ID = ''
    const { GoogleAnalytics } = await import('../../components/GoogleAnalytics')
    const { container } = render(<GoogleAnalytics />)
    expect(container.firstChild).toBeNull()
  })

  it('renders loader + init scripts with cookieless config when GA_ID is set', async () => {
    process.env.NEXT_PUBLIC_GA_ID = 'G-TEST123'
    const { GoogleAnalytics } = await import('../../components/GoogleAnalytics')
    const { container } = render(<GoogleAnalytics />)
    const html = container.innerHTML
    expect(html).toContain('googletagmanager.com/gtag/js?id=G-TEST123')
    expect(html).toContain("client_storage: 'none'")
    expect(html).toContain('anonymize_ip: true')
    expect(html).toContain('allow_google_signals: false')
    expect(html).toContain("'config', 'G-TEST123'")
  })

  it('disables auto pageview tracking (send_page_view: false) to avoid the SPA history-replaceState loop', async () => {
    process.env.NEXT_PUBLIC_GA_ID = 'G-TEST123'
    const { GoogleAnalytics } = await import('../../components/GoogleAnalytics')
    const { container } = render(<GoogleAnalytics />)
    expect(container.innerHTML).toContain('send_page_view: false')
  })

  it('sends a manual page_view via gtag on mount when GA_ID is set', async () => {
    process.env.NEXT_PUBLIC_GA_ID = 'G-TEST123'
    const gtagSpy = vi.fn()
    ;(window as unknown as { gtag: typeof gtagSpy }).gtag = gtagSpy
    const { GoogleAnalytics } = await import('../../components/GoogleAnalytics')
    render(<GoogleAnalytics />)
    expect(gtagSpy).toHaveBeenCalledWith('event', 'page_view', { page_path: '/' })
    delete (window as unknown as { gtag?: unknown }).gtag
  })
})
