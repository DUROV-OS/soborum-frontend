import type { CSSProperties } from 'react'

/** Local assets captured from the reference portal. No third-party requests. */
export function BitrixIcon({ name, size = 20, className = '' }: {
  name: 'search' | 'settings' | 'outline-plus-m' | 'crm' | 'notification' | 'open-channels' | 'robot' | 'cross-l' | 'edit-m' | 'chevron-down-s'
  size?: number
  className?: string
}) {
  return <span aria-hidden="true" className={`bitrix-icon ${className}`} style={{
    width: size, height: size, '--icon-url': `url('/bitrix-ui/${name}.svg')`,
  } as CSSProperties} />
}
