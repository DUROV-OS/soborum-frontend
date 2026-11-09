import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Select, Textarea } from '@/shared/ui/Field'
import { ChatPickerModal } from '@/max/components/ChatPickerModal'
import type { MaxMessage } from '@/max/types'
import { PhoneCalls } from './PhoneCalls'

type Chat = { key: string; chat_id: number; label: string; owner_id: number | null; can_unlink: boolean }
const reason = (error: unknown) => error instanceof Error ? error.message : 'Не удалось связаться с MAX'

export function CrmCommunications({ entityId, isDeal, canEdit }: { entityId: number; isDeal: boolean; canEdit: boolean }) {
  const [tab, setTab] = useState<'calls' | 'max'>('calls')
  return <section aria-label="Связь с клиентом" className="rounded-xl border border-border bg-surface p-3">
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="mr-auto text-sm font-semibold">Связь с клиентом</h4>
      <Button size="sm" variant={tab === 'calls' ? 'primary' : 'secondary'} aria-pressed={tab === 'calls'} onClick={() => setTab('calls')}>Звонки</Button>
      <Button size="sm" variant={tab === 'max' ? 'primary' : 'secondary'} aria-pressed={tab === 'max'} onClick={() => setTab('max')}>MAX</Button>
    </div>
    <div hidden={tab !== 'calls'}><PhoneCalls entityId={entityId} isDeal={isDeal} canEdit={canEdit} /></div>
    <div hidden={tab !== 'max'}><MaxPanel entityId={entityId} canEdit={canEdit} active={tab === 'max'} /></div>
  </section>
}

function MaxPanel({ entityId, canEdit, active }: { entityId: number; canEdit: boolean; active: boolean }) {
  const [chats, setChats] = useState<Chat[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [picker, setPicker] = useState(false)
  const [revision, refresh] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [uncertain, setUncertain] = useState<Record<number, boolean>>({})
  const path = '/entries/' + entityId + '/chats'
  useEffect(() => {
    if (!active) return
    let live = true
    setLoading(true)
    apiRequest<{ items: Chat[] }>({ section: 'crm', path }).then(result => {
      if (!result || !Array.isArray(result.items)) throw new Error('Не удалось загрузить привязанные чаты.')
      if (!live) return
      setChats(result.items); setError('')
      setSelected(previous => result.items.some(c => c.chat_id === previous) ? previous : result.items[0]?.chat_id ?? null)
    }).catch(e => { if (live) setError(reason(e)) }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [path, revision, active])
  const chat = chats.find(c => c.chat_id === selected)
  return <div className="mt-4 space-y-3">
    <p className="text-xs text-muted">Отправитель — рабочий аккаунт MAX компании.</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {loading && <p className="text-sm text-muted">Загрузка привязок…</p>}
    {!loading && !error && !chats.length && <p className="text-sm text-muted">Выберите существующий чат MAX. Открытие карточки не создаёт контакт и не отправляет сообщение.</p>}
    {chats.length > 0 && <Select aria-label="Чат MAX" disabled={sending} value={selected ?? ''} onChange={event => setSelected(Number(event.target.value))}>
      {chats.map(item => <option key={item.key} value={item.chat_id}>{item.label}</option>)}
    </Select>}
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={sending} onClick={() => refresh(v => v + 1)}>Обновить чаты</Button>{canEdit && <Button size="sm" variant="secondary" disabled={sending} onClick={() => setPicker(true)}>Привязать чат MAX</Button>}</div>
    {chat && <div>
      {!chat.can_unlink && <p className="mb-3 text-xs text-muted">Общий чат связанного клиента. Переписка может относиться к нескольким его заявкам.</p>}
      <MaxThread key={chat.chat_id} path={path + '/' + chat.chat_id + '/messages'} chat={chat} canEdit={canEdit} active={active}
        onSending={setSending}
        draft={drafts[chat.chat_id] ?? ''} setDraft={value => setDrafts(values => ({ ...values, [chat.chat_id]: value }))}
        uncertain={uncertain[chat.chat_id] ?? false} setUncertain={value => setUncertain(values => ({ ...values, [chat.chat_id]: value }))} />
    </div>}
    <ChatPickerModal open={picker} onClose={() => setPicker(false)} requireLabel title="Привязать чат MAX к карточке" onPick={async (item, label) => {
      try {
        await apiRequest({ section: 'crm', path, method: 'POST', body: { chat_id: item.id, label: label || item.title || 'MAX' } })
        setSelected(item.id); refresh(v => v + 1); return { ok: true }
      } catch (e) { return { ok: false, reason: reason(e) } }
    }} />
  </div>
}

function MaxThread({ path, chat, canEdit, active, draft, setDraft, uncertain, setUncertain, onSending }: {
  path: string; chat: Chat; canEdit: boolean; active: boolean; draft: string
  setDraft: (value: string) => void; uncertain: boolean; setUncertain: (value: boolean) => void
  onSending: (value: boolean) => void
}) {
  const [messages, setMessages] = useState<MaxMessage[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, refresh] = useState(0)
  const [checked, setChecked] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const lock = useRef(false)
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  useEffect(() => {
    if (!active) return
    let current = true
    setBusy(true)
    apiRequest<{ messages: MaxMessage[] }>({ section: 'crm', path }).then(result => {
      if (!result || !Array.isArray(result.messages)) throw new Error('MAX не вернул переписку. Обновите её ещё раз.')
      if (current) { setMessages(result.messages); setError(''); setLoaded(true); if (uncertain) setChecked(true) }
    }).catch(e => { if (current) { setError(reason(e)); setLoaded(false) } }).finally(() => { if (current) setBusy(false) })
    return () => { current = false }
  }, [path, revision, active])
  async function send() {
    if (busy || lock.current || uncertain || !canEdit || !draft.trim()) return
    lock.current = true; setBusy(true); onSending(true); setError('')
    try {
      const result = await apiRequest<{ message?: MaxMessage }>({ section: 'crm', path, method: 'POST', body: { text: draft.trim() } })
      if (!live.current) return
      setDraft('')
      if (result.message) setMessages(old => [...old.filter(m => m.id !== result.message!.id), result.message!])
      refresh(v => v + 1)
    } catch (e) {
      if (live.current) {
        setError(reason(e))
        if (!(e instanceof ApiError) || ![403, 404, 409, 422].includes(e.status)) { setUncertain(true); setChecked(false) }
      }
    } finally { lock.current = false; if (live.current) { setBusy(false); onSending(false) } }
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap justify-between gap-2">
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => refresh(v => v + 1)}>Обновить переписку</Button>
      <Link className="text-sm text-brand underline" to={'/chats/' + chat.chat_id}>Открыть полный чат MAX</Link>
    </div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div aria-label="История переписки" className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
      {messages.map(message => <article key={message.id} className={'rounded-lg p-2 text-sm ' + (message.isOutgoing ? 'ml-6 bg-brand/10' : 'mr-6 bg-surface-muted')}>
        <p className="mb-1 text-xs text-muted">{message.isOutgoing ? 'Рабочий аккаунт' : message.senderName || 'Клиент'}</p>
        <p className="whitespace-pre-wrap break-words">{message.text || (message.attaches?.length ? 'Вложение — откройте полный чат MAX' : 'Служебное сообщение')}</p>
      </article>)}
      {!messages.length && loaded && !error && <p className="text-sm text-muted">Сообщений пока нет.</p>}
      {busy && !loaded && <p className="text-sm text-muted">Загрузка переписки…</p>}
    </div>
    {canEdit && <form className="space-y-2" onSubmit={event => { event.preventDefault(); void send() }}>
      <Textarea aria-label="Сообщение клиенту в MAX" rows={3} maxLength={4000} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} placeholder="Написать клиенту…" />
      {uncertain && <p className="text-xs text-muted">Результат отправки неизвестен. Обновите переписку и проверьте, есть ли сообщение.</p>}
      {uncertain && checked && <Button size="sm" variant="secondary" onClick={() => { setUncertain(false); setError('') }}>Проверил: сообщение не доставлено</Button>}
      <Button size="sm" type="submit" disabled={busy || uncertain || !draft.trim()}>Отправить в MAX</Button>
    </form>}
  </div>
}
