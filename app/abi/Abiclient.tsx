'use client'

import { useSearchParams } from 'next/navigation'

export default function AbiClient() {
  const params = useSearchParams()

  const subject = params.get("subject")

  return <div>{subject}</div>
}