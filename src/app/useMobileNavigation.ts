import { useEffect, useState } from 'react'

/** Keep focus and modal semantics aligned with Tailwind's lg breakpoint. */
export function useMobileNavigation() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)')
    const update = () => setMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return mobile
}
