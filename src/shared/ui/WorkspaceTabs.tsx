import { Link } from 'react-router-dom'

export function WorkspaceTabs({ label, entries, activeId }: {
  label: string
  entries: { id: string; to: string; label: string }[]
  activeId: string
}) {
  return <nav aria-label={label} className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface px-2">
    {entries.map(entry => {
      const active = entry.id === activeId
      return <Link key={entry.id} to={entry.to} aria-current={active ? 'page' : undefined}
        ref={element => { if (element && active) element.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }}
        className={'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm ' +
          (active ? 'border-brand bg-brand/5 font-semibold text-brand-dark' : 'border-transparent text-ink hover:bg-surface-muted')}>
        {entry.label}
      </Link>
    })}
  </nav>
}
