'use client'

import GlobalError from '@/app/error'

export default function NowError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <GlobalError {...props} heading="Couldn't load /now." />
}
