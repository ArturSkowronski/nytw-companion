'use client'

import GlobalError from '@/app/error'

export default function PlanError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <GlobalError {...props} heading="AI concierge unavailable." />
}
