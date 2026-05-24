'use client'

import GlobalError from '@/app/error'

export default function EventsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <GlobalError {...props} heading="Couldn't load events." />
}
