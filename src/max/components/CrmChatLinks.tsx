import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCrmChatLinks, type CrmChatLink } from '../crmLinks'

export function CrmChatLinks({ entryId, canEdit }: { entryId: number; canEdit: boolean }) {
  const [links, setLinks] = useState<CrmChatLink[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLinks([]); setError(false); setLoading(true)
    listCrmChatLinks(entryId).then(rows => { if (!cancelled) setLinks(rows) })
      .catch(() => { if (!cancelled) setError(true) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [entryId, attempt])
  return <section className="space-y-2 text-[12px]" aria-label="Связанные чаты MAX">
    <h3 className="font-medium text-ink">Чаты MAX</h3>
    {loading ? <p className="text-muted">Загрузка связей…</p> : error ? <p className="text-danger">Не удалось загрузить связи. <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Повторить</button></p>
      : links.length ? links.map(link => <Link className="block break-words text-brand-dark underline" key={link.id} to={`/chats/${link.max_chat_id}`}>{link.label} · открыть переписку</Link>)
        : <p className="text-muted">Связанных чатов пока нет.{canEdit && ' Откройте диалог в MAX и выберите «Привязать чат».'}</p>}
  </section>
}
