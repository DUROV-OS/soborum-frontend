import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ApiError, apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Select, Textarea } from '@/shared/ui/Field'
import { ChatPickerModal } from '@/max/components/ChatPickerModal'
import { MaxMessageItem } from '@/max/components/MaxMessageItem'
import { MaxAttachButton, MaxPendingFile } from '@/max/components/MaxFilePicker'
import { useMaxEvents } from '@/max/realtime'
import type { MaxMessage } from '@/max/types'
import { currentCrmLink, linkCrmFromMax, type CurrentCrmLink } from '@/max/crmLinks'
import { PhoneCalls } from './PhoneCalls'
import { BrowserCallPanel } from './BrowserPhone'

type Chat = { key: string; chat_id: number; label: string; owner_id: number | null; can_unlink: boolean }
const reason = (error: unknown) => error instanceof Error ? error.message : 'Не удалось связаться с MAX'

export function CrmCommunications({ entityId, isDeal, canEdit, openMax = 0, openCalls }: { entityId: number; isDeal: boolean; canEdit: boolean; openMax?: number; openCalls?: { revision: number; phone: string } }) {
  const location = useLocation()
  const [tab, setTab] = useState<'calls' | 'max'>(() => new URLSearchParams(window.location.search).get('channel') === 'calls' ? 'calls' : 'max')
  const panel = useRef<HTMLElement>(null)
  useEffect(() => { const channel = new URLSearchParams(location.search).get('channel'); if (channel === 'calls' || channel === 'max') setTab(channel) }, [location.key])
  useEffect(() => { if (openMax) { setTab('max'); panel.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) } }, [openMax])
  useEffect(() => { if (openCalls?.revision) { setTab('calls'); panel.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) } }, [openCalls])
  return <section ref={panel} aria-label="Связь с клиентом" className="rounded-xl border border-border bg-surface p-3">
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="mr-auto text-sm font-semibold">Связь с клиентом</h4>
      <Button size="sm" variant={tab === 'calls' ? 'primary' : 'secondary'} aria-pressed={tab === 'calls'} onClick={() => setTab('calls')}>Звонки</Button>
      <Button size="sm" variant={tab === 'max' ? 'primary' : 'secondary'} aria-pressed={tab === 'max'} onClick={() => setTab('max')}>MAX</Button>
    </div>
    <div hidden={tab !== 'calls'}><BrowserCallPanel entityId={entityId} canEdit={canEdit} initialPhone={openCalls?.phone} /><PhoneCalls entityId={entityId} isDeal={isDeal} canEdit={canEdit} /></div>
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
  const binding = useRef(false)
  const [moving, setMoving] = useState<CurrentCrmLink | null>(null)
  const [phones, setPhones] = useState<{ phone: string; name: string }[] | null>(null)
  const [firstPhone, setFirstPhone] = useState('')
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [uncertain, setUncertain] = useState<Record<number, boolean>>({})
  const [files, setFiles] = useState<Record<number, File | null>>({})
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
  async function bind(work: () => Promise<void>) {
    if (binding.current || sending) return
    binding.current = true; setSending(true); setError('')
    try { await work() } catch (e) { setError(reason(e)) }
    finally { binding.current = false; setSending(false) }
  }
  return <div className="mt-4 space-y-3">
    <p className="text-xs text-muted">Отправитель — рабочий аккаунт MAX компании.</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {loading && <p className="text-sm text-muted">Загрузка привязок…</p>}
    {!loading && !error && !chats.length && <p className="text-sm text-muted">Выберите существующий чат MAX. Открытие карточки не создаёт контакт и не отправляет сообщение.</p>}
    {chats.length > 0 && <Select aria-label="Чат MAX" disabled={sending} value={selected ?? ''} onChange={event => setSelected(Number(event.target.value))}>
      {chats.map(item => <option key={item.key} value={item.chat_id}>{item.label}</option>)}
    </Select>}
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={sending} onClick={() => refresh(v => v + 1)}>Обновить чаты</Button>{canEdit && <>
      <Button size="sm" variant="secondary" disabled={sending} onClick={() => setPicker(true)}>Привязать диалог MAX</Button>
      <Button size="sm" disabled={sending} onClick={() => void bind(async () => {
        const result = await apiRequest<{ items: { phone: string; name: string }[] }>({ section: 'crm', path: '/entries/' + entityId + '/chat-phones' })
        setPhones(result.items); setFirstPhone(result.items[0]?.phone ?? '')
      })}>Написать первым в MAX</Button>
    </>}</div>
    {phones && <div className="space-y-3 rounded-lg border border-border p-3">
      {phones.length ? <>
        <Select aria-label="Номер получателя MAX" value={firstPhone} disabled={sending} onChange={event => setFirstPhone(event.target.value)}>{phones.map(item => <option key={item.phone} value={item.phone}>{item.name} · {item.phone}</option>)}</Select>
        <p className="text-xs text-muted">Найдём аккаунт по номеру из карточки и при необходимости добавим контакт в рабочий MAX. Сообщение вы напишете и отправите после открытия диалога.</p>
        <Button size="sm" disabled={sending || !firstPhone} onClick={() => void bind(async () => {
          const result = await apiRequest<{ chatId: number; name: string }>({ section: 'crm', path: path + '/start', method: 'POST', body: { phone: firstPhone } })
          setSelected(result.chatId); setPhones(null); refresh(v => v + 1)
        })}>Найти и открыть диалог</Button>
      </> : <p className="text-sm">Сначала добавьте телефон в карточку клиента или связанного контакта.</p>}
      <Button size="sm" variant="ghost" disabled={sending} onClick={() => setPhones(null)}>Закрыть</Button>
    </div>}
    {moving && <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm">Диалог связан с карточкой <strong>{moving.entity_name}</strong>. Перенести переписку в эту карточку?</p>
      <p className="text-xs text-muted">История сохранится, ответственный останется прежним.{moving.automatic_lead && ' Необработанная автоматическая заявка будет убрана в архив как дубль.'}</p>
      <Button size="sm" disabled={sending} onClick={() => void bind(async () => {
        await linkCrmFromMax({ max_chat_id: moving.max_chat_id, entity_id: entityId, move_from_id: moving.entity_id, move_from_version: moving.entity_version })
        setSelected(moving.max_chat_id); setMoving(null); refresh(v => v + 1)
      })}>Перенести переписку</Button>
      <Button size="sm" variant="ghost" disabled={sending} onClick={() => setMoving(null)}>Отмена</Button>
    </div>}
    {chat && <div>
      {!chat.can_unlink && <p className="mb-3 text-xs text-muted">Общий чат связанного клиента. Переписка может относиться к нескольким его заявкам.</p>}
      <MaxThread key={chat.chat_id} path={path + '/' + chat.chat_id + '/messages'} chat={chat} canEdit={canEdit} active={active}
        onSending={setSending}
        file={files[chat.chat_id] ?? null} setFile={value => setFiles(values => ({ ...values, [chat.chat_id]: value }))}
        draft={drafts[chat.chat_id] ?? ''} setDraft={value => setDrafts(values => ({ ...values, [chat.chat_id]: value }))}
        uncertain={uncertain[chat.chat_id] ?? false} setUncertain={value => setUncertain(values => ({ ...values, [chat.chat_id]: value }))} />
    </div>}
    <ChatPickerModal open={picker} onClose={() => setPicker(false)} requireLabel title="Привязать чат MAX к карточке" onPick={async (item, label) => {
      try {
        if (chats.some(chat => chat.chat_id === item.id)) { setSelected(item.id); return { ok: true } }
        const current = await currentCrmLink(item.id)
        if (current && current.entity_id !== entityId && !chats.some(chat => chat.chat_id === item.id)) {
          setMoving(current); return { ok: true }
        }
        await apiRequest({ section: 'crm', path, method: 'POST', body: { chat_id: item.id, label: label || item.title || 'MAX' } })
        setSelected(item.id); refresh(v => v + 1); return { ok: true }
      } catch (e) { return { ok: false, reason: reason(e) } }
    }} />
  </div>
}

function MaxThread({ path, chat, canEdit, active, draft, setDraft, uncertain, setUncertain, onSending, file, setFile }: {
  path: string; chat: Chat; canEdit: boolean; active: boolean; draft: string
  setDraft: (value: string) => void; uncertain: boolean; setUncertain: (value: boolean) => void
  onSending: (value: boolean) => void
  file: File | null; setFile: (value: File | null) => void
}) {
  const [messages, setMessages] = useState<MaxMessage[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, refresh] = useState(0)
  const [checked, setChecked] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [isGroup, setIsGroup] = useState(false)
  const lock = useRef(false)
  const live = useRef(true)
  const request = useRef(0)
  const scroll = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const read = useCallback(async (silent = false) => {
    const ticket = ++request.current
    if (!silent) setBusy(true)
    try {
      const result = await apiRequest<{ messages: MaxMessage[]; isGroup?: boolean }>({ section: 'crm', path, query: { limit: 100 } })
      if (!result || !Array.isArray(result.messages)) throw new Error('MAX не вернул переписку. Обновите её ещё раз.')
      if (live.current && ticket === request.current) {
        setMessages(result.messages.slice().sort((a, b) => a.time - b.time)); setIsGroup(!!result.isGroup)
        setLoaded(true)
        if (!silent) { setError(''); setChecked(true) }
      }
    } catch (e) { if (live.current && ticket === request.current && !silent) { setError(reason(e)); setLoaded(false) } }
    finally { if (live.current && !silent) setBusy(false) }
  }, [path])
  useEffect(() => {
    if (!active) return
    void read()
    return () => { request.current++ }
  }, [read, revision, active])
  const online = useMaxEvents(({ chatIds, resync }) => {
    if (active && !lock.current && (resync || chatIds.has(chat.chat_id))) void read(true)
  })
  useEffect(() => {
    if (!active || online) return
    const timer = window.setInterval(() => { if (!document.hidden && !lock.current) void read(true) }, 30000)
    return () => window.clearInterval(timer)
  }, [active, online, read])
  useEffect(() => { if (atBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight }, [messages])
  async function send() {
    if (busy || lock.current || uncertain || !canEdit || (!draft.trim() && !file)) return
    lock.current = true; setBusy(true); onSending(true); setError('')
    try {
      const form = new FormData()
      if (file) { form.append('file', file, file.name); form.append('text', draft.trim()) }
      const result = await apiRequest<{ message?: MaxMessage }>({ section: 'crm', path: file ? path + '/attachment' : path, method: 'POST',
        ...(file ? { form, timeoutMs: 120000 } : { body: { text: draft.trim() } }) })
      if (!live.current) return
      setDraft(''); setFile(null); atBottom.current = true
      if (result.message) setMessages(old => [...old.filter(m => m.id !== result.message!.id), result.message!])
      refresh(v => v + 1)
    } catch (e) {
      if (live.current) {
        setError(reason(e))
        if (!(e instanceof ApiError) || ![403, 404, 409, 413, 422].includes(e.status)) { setUncertain(true); setChecked(false) }
      }
    } finally { lock.current = false; if (live.current) { setBusy(false); onSending(false) } }
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap justify-between gap-2">
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => refresh(v => v + 1)}>Обновить переписку</Button>
      <span className="self-center text-xs text-muted">{online ? 'Новые сообщения появляются автоматически' : 'Проверяем новые сообщения каждые 30 секунд'}</span>
    </div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div ref={scroll} aria-label="История переписки" onScroll={() => { const node = scroll.current; if (node) atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80 }} className="max-h-[420px] min-h-24 space-y-3 overflow-y-auto rounded-lg border border-border p-3">
      {messages.length >= 100 && <p className="text-xs text-muted">Последние 100 сообщений этого диалога</p>}
      {messages.map(message => <MaxMessageItem key={message.id} message={message} chatId={chat.chat_id} isGroup={isGroup} />)}
      {!messages.length && loaded && !error && <p className="text-sm text-muted">Сообщений пока нет.</p>}
      {busy && !loaded && <p className="text-sm text-muted">Загрузка переписки…</p>}
    </div>
    {canEdit && <form className="space-y-2" onSubmit={event => { event.preventDefault(); void send() }}>
      {file && <MaxPendingFile file={file} onRemove={() => setFile(null)} disabled={busy || uncertain} />}
      <Textarea aria-label="Сообщение клиенту в MAX" rows={3} maxLength={4000} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} placeholder="Написать клиенту…" />
      {uncertain && <p className="text-xs text-muted">Результат отправки неизвестен. Обновите переписку и проверьте, есть ли сообщение.</p>}
      {uncertain && checked && <Button size="sm" variant="secondary" onClick={() => { setUncertain(false); setError('') }}>Проверил: сообщение не доставлено</Button>}
      <div className="flex items-center gap-2"><MaxAttachButton onPick={setFile} onError={setError} disabled={busy || uncertain} /><Button size="sm" type="submit" disabled={busy || uncertain || (!draft.trim() && !file)}>Отправить в MAX</Button></div>
    </form>}
  </div>
}
