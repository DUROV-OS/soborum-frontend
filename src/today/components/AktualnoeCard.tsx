import { ArrowRight } from 'lucide-react'
import { AktualnoeItem } from '../types'

export function AktualnoeCard({ item, onClick }: { item: AktualnoeItem; onClick?: () => void }) {
  const evidenced = Boolean(item.source_hash && item.sources?.length)
  return <article className="rounded-xl border border-border bg-bg p-4">
    <button type="button" onClick={onClick} className="flex w-full items-start justify-between gap-3 text-left">
      <span className="min-w-0"><span className="block break-words text-sm font-semibold">{item.client_name}</span><span className="mt-1 block text-xs text-muted">{item.stage}</span></span>
      <ArrowRight size={16} className="shrink-0 text-brand" />
    </button>
    <p className="mt-3 text-xs text-muted">Процент готовности не рассчитан: стадия и активность не подтверждают объём выполненных работ.</p>
    {evidenced ? <><p className="mt-3 text-sm">{item.phrase} · {item.last_activity ? new Date(item.last_activity).toLocaleString('ru-RU') : 'дата не указана'}</p><p className="mt-1 text-xs text-muted">Заметок и изменений задач за 21 день: {item.recent_events ?? '—'}</p>
      <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium text-brand">Записи-основания</summary><ul className="mt-2 space-y-2">{item.sources!.map(s => <li key={s.entity + s.record_id + s.field}>{s.label} · запись №{s.record_id}<span className="block text-muted">{new Date(s.at).toLocaleString('ru-RU')}</span></li>)}</ul><p className="mt-3 text-muted">Отметки в карточке не заменяют проверку документов.</p><code className="mt-2 block break-all text-muted">{item.source_hash}</code></details></> : <p className="mt-3 text-xs text-muted">Основания этой записи не зафиксированы. Обновите данные.</p>}
  </article>
}
