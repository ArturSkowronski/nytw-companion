'use client'

import GlobalError from '@/app/error'

export default function MyPlanError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <GlobalError {...props} heading="Couldn't load your plan." />
}
