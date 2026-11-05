import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { apiRequest } from '@/shared/lib/httpClient'

export type Connection = { title: string; href: string; description: string; external: boolean }
export function CatalogConnections({ links, title = 'Связанные карточки и документы' }: { links: Connection[]; title?: string }) {
  const location = useLocation()
  const targets = links.filter(l => l.href !== location.pathname + location.search && l.href !== location.pathname)
  if (!targets.length) return null
  return <section className="space-y-3" aria-label={title}><h2 className="text-base font-semibold text-ink">{title}</h2><div className="grid gap-3 sm:grid-cols-2">{targets.map(link => {
    const body = <><span className="flex items-start justify-between gap-3 font-medium text-brand">{link.title}<ArrowUpRight size={17} className="shrink-0" /></span><span className="mt-2 block text-xs leading-relaxed text-muted">{link.description}</span></>
    const className = 'block min-w-0 rounded-xl border border-border bg-surface p-4 text-sm transition-colors hover:border-brand/50 hover:bg-brand/5'
    return link.external ? <a key={link.href} className={className} href={link.href} target="_blank" rel="noopener noreferrer">{body}</a> : <Link key={link.href} className={className} to={link.href}>{body}</Link>
  })}</div></section>
}

export function HouseConnections({ modelKey, production = false }: { modelKey: string; production?: boolean }) {
  const [links, setLinks] = useState<Connection[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLinks([]); setError('')
    apiRequest<{ connections: Connection[] }>({ section: production ? 'production' : 'costing', path: production ? `/library/models/${encodeURIComponent(modelKey)}/connections` : `/catalog/model-connections/${encodeURIComponent(modelKey)}` })
      .then(r => { if (active) setLinks(r.connections) }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [modelKey, production])
  return <>{error && <p role="alert" className="text-sm text-danger">Не удалось загрузить связи: {error}</p>}<CatalogConnections links={links} /></>
}
