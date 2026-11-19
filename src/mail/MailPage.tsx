import { ModuleNavigation } from '@/app/SectionNavigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ExternalLink, Folder, Mail, Paperclip, RefreshCw, Search } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { downloadMailAttachment, listFolders, listMail, mailStatus, markMailRead, readMail, type MailFolder, type MailHeader, type MailList, type MailMessage, type MailStatus } from './api'

const errorText = (e: unknown) => e instanceof Error ? e.message : 'Не удалось загрузить почту'
const dateText = (s: string) => Number.isNaN(Date.parse(s)) ? s : new Date(s).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

export function MailPage() {
  const userId = useAuthStore(s => s.current?.id)
  const [status, setStatus] = useState<MailStatus | null>(null)
  const [folders, setFolders] = useState<MailFolder[]>([])
  const [folder, setFolder] = useState('')
  const [list, setList] = useState<MailList | null>(null)
  const [message, setMessage] = useState<MailMessage | null>(null)
  const [query, setQuery] = useState(''), [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true), [opening, setOpening] = useState(false)
  const [mutating, setMutating] = useState(false), [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0), [updated, setUpdated] = useState('')
  const generation = useRef(0), detail = useRef(0)

  useEffect(() => {
    let active = true
    generation.current++; detail.current++
    setStatus(null); setFolders([]); setFolder(''); setList(null); setMessage(null); setLoading(true); setError('')
    mailStatus().then(async s => {
      if (!active) return
      setStatus(s)
      if (s.configured && s.can_access) {
        const rows = await listFolders()
        if (!active) return
        setFolders(rows); setFolder(rows.find(f => f.inbox)?.id || rows[0]?.id || '')
        setUpdated(new Date().toLocaleTimeString('ru-RU'))
      }
    }).catch(e => { if (active) setError(errorText(e)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; generation.current++; detail.current++ }
  }, [userId, refresh])

  useEffect(() => {
    if (!folder || !status?.configured || !status.can_access) return
    const request = ++generation.current
    detail.current++
    setList(null); setMessage(null); setOpening(false); setLoading(true); setError('')
    listMail(folder, search).then(result => {
      if (request === generation.current) { setList(result); setUpdated(new Date().toLocaleTimeString('ru-RU')) }
    }).catch(e => { if (request === generation.current) setError(errorText(e)) })
      .finally(() => { if (request === generation.current) setLoading(false) })
    return () => { generation.current++; detail.current++ }
  }, [folder, search, status])

  async function more() {
    if (!list?.next_before || loading) return
    const request = generation.current
    setLoading(true); setError('')
    try {
      const next = await listMail(folder, search, list.next_before)
      if (request !== generation.current) return
      if (next.uidvalidity !== list.uidvalidity) throw new Error('Папка изменилась. Обновите почту.')
      setList(previous => previous && ({ ...next, items: [...previous.items, ...next.items.filter(item => !previous.items.some(old => old.uid === item.uid))] }))
    } catch (e) { if (request === generation.current) setError(errorText(e)) }
    finally { if (request === generation.current) setLoading(false) }
  }

  async function setRead(uid: number, read: boolean, request: number) {
    if (!list) return
    const result = await markMailRead(uid, list.uidvalidity, folder, read)
    if (request !== detail.current) return
    setList(previous => previous && ({ ...previous, items: previous.items.map(item => item.uid === uid ? { ...item, unread: result.unread } : item) }))
    setMessage(previous => previous?.uid === uid ? { ...previous, unread: result.unread } : previous)
    const counts = await listFolders()
    if (request === detail.current) setFolders(counts)
  }

  async function open(item: MailHeader) {
    if (!list) return
    const request = ++detail.current
    setMessage(null); setOpening(true); setError('')
    try {
      const value = await readMail(item.uid, list.uidvalidity, folder)
      if (request !== detail.current) return
      setMessage({ ...value, unread: item.unread })
      if (item.unread) await setRead(item.uid, true, request)
    } catch (e) { if (request === detail.current) setError(errorText(e)) }
    finally { if (request === detail.current) setOpening(false) }
  }

  async function toggleRead() {
    if (!message) return
    setMutating(true); setError('')
    try { await setRead(message.uid, message.unread, detail.current) }
    catch (e) { setError(errorText(e)) }
    finally { setMutating(false) }
  }

  async function download(part: number, filename: string) {
    if (!message || !list) return
    setMutating(true); setError('')
    try { await downloadMailAttachment(message.uid, list.uidvalidity, part, filename, folder) }
    catch (e) { setError(errorText(e)) }
    finally { setMutating(false) }
  }

  const showing = !!message || opening
  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Почта</h1><p className="text-sm text-muted">{status?.address || 'sales@durov.house'} · NIC.RU{updated && ` · Обновлено ${updated}`}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={loading || opening || mutating} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={16} />Обновить</Button>
        <a href="https://www.mail.nic.ru/" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-surface-muted">Веб-почта<ExternalLink size={14}/></a></div>
    </header>
    {error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-bg p-4 text-sm text-danger">{error} <button className="underline" onClick={() => setRefresh(v => v + 1)}>Повторить</button></div>}
    {status && !status.can_access && <section className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold">Нет доступа к общему ящику</h2><p className="mt-2 text-sm text-muted">Руководитель или администратор может назначить вам доступ к корпоративной почте.</p></section>}
    {status?.can_access && !status.configured && <section className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold">Почтовый ящик ещё не подключён</h2><p className="mt-2 text-sm text-muted">Для отображения писем нужно настроить доступ NIC.RU на сервере. Пароль ящика не передаётся в браузер.</p></section>}
    {loading && !folder && <p role="status">Загрузка почты…</p>}
    {status?.can_access && status.configured && !loading && !error && !folders.length && <p className="text-muted">Почтовый сервис не вернул доступных папок.</p>}
    {!!folders.length && <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
      <ModuleNavigation label="Разделы почты"><nav aria-label="Почтовые папки" className="flex gap-1 overflow-x-auto border-b border-border pb-2">
        {folders.map(f => <button key={f.id} disabled={mutating} aria-current={folder === f.id ? 'page' : undefined} onClick={() => { setFolder(f.id); setQuery(''); setSearch('') }} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-left text-sm ${f.id === folder ? 'bg-brand/10 text-brand-dark' : 'hover:bg-surface-muted'}`}><Folder size={15}/><span className="flex-1">{f.name}</span>{f.unread !== null && f.unread > 0 && <span className="rounded-pill bg-brand px-2 text-xs text-white">{f.unread}</span>}</button>)}
      </nav></ModuleNavigation>
      <section aria-label="Список писем" className={`${showing ? 'hidden xl:block' : ''} min-w-0 rounded-xl border border-border bg-surface p-3`}>
        <form className="mb-3 flex gap-2" onSubmit={e => { e.preventDefault(); setSearch(query.trim()) }}><Input aria-label="Поиск писем" placeholder="Поиск писем" maxLength={200} value={query} onChange={e => setQuery(e.target.value)}/><Button variant="secondary" type="submit" aria-label="Найти письма"><Search size={16}/></Button></form>
        {loading && !list && <p role="status" className="p-3 text-sm text-muted">Загрузка писем…</p>}
        {list && !list.items.length && <p className="p-3 text-sm text-muted">{search ? 'Писем по запросу не найдено.' : 'В этой папке пока нет писем.'}</p>}
        <div className="space-y-1">{list?.items.map(item => <button key={item.uid} disabled={mutating} onClick={() => void open(item)} className={`block w-full rounded-lg border p-3 text-left ${message?.uid === item.uid ? 'border-brand bg-brand/5' : 'border-transparent hover:bg-surface-muted'}`}>
          <span className="flex items-center gap-2 text-xs text-muted"><Mail size={14} className={item.unread ? 'text-brand' : ''}/><span className="truncate">{item.sender || 'Отправитель не указан'}</span></span>
          <span className={`mt-1 block break-words text-sm ${item.unread ? 'font-semibold' : ''}`}>{item.subject || 'Без темы'}</span><span className="mt-2 block text-xs text-muted">{dateText(item.date)}</span>
        </button>)}</div>
        {list?.next_before != null && <Button variant="ghost" disabled={loading} onClick={() => void more()}>{loading ? 'Загрузка…' : 'Более ранние письма'}</Button>}
      </section>
      <section aria-label="Содержимое письма" aria-busy={opening} className={`${showing ? '' : 'hidden xl:block'} min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-5`}>
        <Button variant="ghost" className="mb-3 xl:hidden" onClick={() => { detail.current++; setMessage(null); setOpening(false) }}><ArrowLeft size={16}/>К списку писем</Button>
        {opening && <p role="status">Загрузка письма…</p>}
        {message ? <>
          <h2 className="break-words text-xl font-semibold">{message.subject || 'Без темы'}</h2><div className="mt-3 space-y-1 break-words text-sm text-muted"><p>От: {message.sender}</p><p>Кому: {message.to}</p>{message.cc && <p>Копия: {message.cc}</p>}<p>{dateText(message.date)}</p></div>
          <Button variant="ghost" disabled={mutating || opening} onClick={() => void toggleRead()}>{message.unread ? 'Отметить прочитанным' : 'Отметить непрочитанным'}</Button>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text || 'Текст письма отсутствует.'}</p>
          {!!message.attachments.length && <div className="mt-5 space-y-2 border-t border-border pt-4"><h3 className="font-medium">Вложения</h3>{message.attachments.map(file => <Button key={file.part} variant="secondary" className="max-w-full whitespace-normal break-all text-left" disabled={mutating} onClick={() => void download(file.part, file.filename)}><Paperclip size={16} className="shrink-0"/>{file.filename} · {Math.ceil(file.size / 1024)} КБ</Button>)}</div>}
          <p className="mt-5 text-xs text-muted">Отправка и ответы доступны в корпоративной веб-почте. Отметка прочтения общая для пользователей ящика.</p>
        </> : !opening && <p className="text-sm text-muted">Выберите письмо из списка.</p>}
      </section>
    </div>}
  </div>
}
