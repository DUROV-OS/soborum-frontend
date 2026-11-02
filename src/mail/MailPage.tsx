import { useEffect, useRef, useState } from 'react'
import { downloadMailAttachment, listMail, mailStatus, readMail, type MailList, type MailMessage, type MailStatus } from './api'

const errorText = (error: unknown) => error instanceof Error ? error.message : 'Не удалось загрузить почту'
const button = 'min-h-11 rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-muted disabled:opacity-50'

export function MailPage() {
  const [status, setStatus] = useState<MailStatus | null>(null)
  const [list, setList] = useState<MailList | null>(null)
  const [message, setMessage] = useState<MailMessage | null>(null)
  const [busy, setBusy] = useState(false)
  const [opening, setOpening] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)

  useEffect(() => {
    let active = true
    setBusy(true)
    mailStatus().then(async result => {
      if (!active) return
      setStatus(result)
      if (result.configured) {
        const page = await listMail()
        if (active) setList(page)
      }
    }).catch(e => { if (active) setError(errorText(e)) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false; generation.current++ }
  }, [])

  async function load(before?: number) {
    generation.current++
    setMessage(null); setError(''); setBusy(true); setOpening(false)
    try {
      const result = await listMail(before)
      setList(previous => before && previous?.uidvalidity === result.uidvalidity
        ? { ...result, items: [...previous.items, ...result.items] }
        : result)
    } catch (e) { setError(errorText(e)) }
    finally { setBusy(false) }
  }

  async function open(uid: number) {
    if (!list) return
    const request = ++generation.current
    setMessage(null); setError(''); setOpening(true)
    try {
      const result = await readMail(uid, list.uidvalidity)
      if (generation.current === request) setMessage(result)
    } catch (e) { if (generation.current === request) setError(errorText(e)) }
    finally { if (generation.current === request) setOpening(false) }
  }

  async function download(part: number, filename: string) {
    if (!message || !list) return
    setError(''); setDownloading(true)
    try { await downloadMailAttachment(message.uid, list.uidvalidity, part, filename) }
    catch (e) { setError(errorText(e)) }
    finally { setDownloading(false) }
  }

  return <main className="space-y-5 p-4 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Почта</h1><p className="mt-1 text-sm text-muted">{status?.address ?? 'Общий ящик компании'} · NIC.RU</p></div>
      {status?.configured && <button className={button} disabled={busy} onClick={() => void load()}>Обновить входящие</button>}
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {busy && !list && <p role="status">Загрузка почты…</p>}
    {status && !status.configured && <div className="rounded-xl border border-border p-5">
      <h2 className="font-medium">Почтовый ящик ещё не подключён</h2>
      <p className="mt-2 text-sm text-muted">Администратору нужно настроить доступ к ящику NIC.RU на сервере Durov OS. После подключения входящие письма и вложения будут доступны всем сотрудникам.</p>
    </div>}
    {list && <>
      <p className="text-sm text-muted">Входящие доступны всем сотрудникам. Просмотр здесь сохраняет отметку прочтения в NIC.RU. Ответить на письмо можно в <a className="underline" href="https://www.mail.nic.ru/" target="_blank" rel="noreferrer">веб-почте</a>.</p>
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
        <section aria-label="Входящие письма" className="min-w-0 space-y-2">
          {!list.items.length && <p className="rounded-xl border border-border p-5 text-sm text-muted">Входящих писем пока нет.</p>}
          {list.items.map(item => <button key={item.uid} className={`w-full rounded-xl border p-4 text-left ${message?.uid === item.uid ? 'border-brand bg-surface-muted' : 'border-border'}`} disabled={busy} onClick={() => void open(item.uid)}>
            <p className="break-words text-xs text-muted">{item.sender || 'Отправитель не указан'}</p>
            <p className={`mt-1 break-words text-sm ${item.unread ? 'font-semibold' : ''}`}>{item.subject || 'Без темы'}</p>
            <p className="mt-2 text-xs text-muted">{item.date}</p>
          </button>)}
          {list.next_before !== null && <button className={button + ' w-full'} disabled={busy} onClick={() => void load(list.next_before!)}>{busy ? 'Загрузка…' : 'Более ранние письма'}</button>}
        </section>
        <section aria-label="Содержимое письма" aria-busy={opening} className="min-w-0 rounded-xl border border-border p-4 md:p-6">
          {opening ? <p role="status">Загрузка письма…</p> : message ? <>
            <h2 className="break-words text-xl font-semibold">{message.subject || 'Без темы'}</h2>
            <dl className="mt-4 space-y-1 break-words text-sm text-muted"><div><dt className="inline">От: </dt><dd className="inline">{message.sender}</dd></div><div><dt className="inline">Кому: </dt><dd className="inline">{message.to}</dd></div>{message.cc && <div>Копия: {message.cc}</div>}<div>{message.date}</div></dl>
            <p className="mt-6 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text || 'Текст письма отсутствует.'}</p>
            {message.attachments.length > 0 && <div className="mt-6 border-t border-border pt-4"><h3 className="mb-2 font-medium">Вложения</h3><div className="flex flex-wrap gap-2">{message.attachments.map(file => <button key={file.part} className={button + ' max-w-full break-all text-left'} disabled={downloading} onClick={() => void download(file.part, file.filename)}>{file.filename} · {Math.ceil(file.size / 1024)} КБ</button>)}</div></div>}
          </> : <p className="text-sm text-muted">Выберите письмо из списка.</p>}
        </section>
      </div>
    </>}
  </main>
}
