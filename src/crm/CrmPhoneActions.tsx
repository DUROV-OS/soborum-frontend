import { useEffect, useRef, useState } from 'react'
import { Copy, MessageCircle, Phone, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { ApiError } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import * as maxApi from '@/max/api'
import type { MaxMessage } from '@/max/types'

export function crmPhoneNumber(raw: string): string | null {
  const compact = raw.trim().replace(/[\s().-]/g, '')
  if (!/^\+?\d{10,15}$/.test(compact)) return null
  let digits = compact.replace(/^\+/, '')
  if (digits.length === 10) digits = '7' + digits
  else if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1)
  return /^[1-9]\d{9,14}$/.test(digits) ? '+' + digits : null
}

function maxError(error: unknown, sending = false) {
  if (error instanceof ApiError && error.status === 404) return 'Пользователь с этим номером не найден в MAX. Проверьте номер или настройки поиска у получателя.'
  if (error instanceof ApiError && error.status === 403) return 'Недостаточно прав для этого действия в MAX.'
  if (error instanceof ApiError && error.status === 422) return 'Проверьте номер и имя получателя. Диалог с собственным номером аккаунта недоступен.'
  return sending
    ? 'Не удалось подтвердить отправку. Проверьте переписку перед повторной отправкой: сообщение могло быть доставлено.'
    : 'Рабочее подключение MAX недоступно. Руководителю нужно восстановить вход в аккаунт MAX; сообщения сейчас не отправляются.'
}

/** Opening the menu never calls, creates a contact or sends a message. */
export function CrmPhoneActions({ phone, name, canMessage = true, className = '' }: {
  phone: string; name: string; canMessage?: boolean; className?: string
}) {
  const currentUser = useAuthStore(state => state.current)
  const normalized = crmPhoneNumber(phone)
  const [mode, setMode] = useState<'closed' | 'actions' | 'max' | 'call' | 'telegram'>('closed')
  const [recipientName, setRecipientName] = useState(name.slice(0, 64))
  const [chatId, setChatId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MaxMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const generation = useRef(0)
  const mutation = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; generation.current++ }
  }, [])
  useEffect(() => {
    generation.current++; setMode('closed'); setRecipientName(name.slice(0, 64)); setChatId(null)
    setMessages([]); setDraft(''); setError(''); setNotice(''); setUncertain(false); setBusy(false)
  }, [phone, name])
  const close = () => { if (busy) return; generation.current++; setMode('closed'); setBusy(false); trigger.current?.focus() }
  useEffect(() => {
    if (mode === 'closed') return
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [mode, busy])

  async function copy() {
    try { await navigator.clipboard.writeText(normalized || phone); if (mounted.current) { setNotice('Номер скопирован'); setError('') } }
    catch { if (mounted.current) setError('Не удалось скопировать. Выделите номер вверху окна и скопируйте вручную.') }
  }
  async function openMax() {
    if (!normalized || !recipientName.trim() || !canMessage || busy || mutation.current) return
    mutation.current = true
    const ticket = ++generation.current
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await maxApi.startDialog({ phone: normalized, firstName: recipientName.trim() })
      if (!mounted.current || ticket !== generation.current) return
      if (!Number.isSafeInteger(result.chatId) || result.chatId === 0) throw new Error('Invalid dialog')
      setChatId(result.chatId)
      const history = await maxApi.getChat(result.chatId, { limit: 30 })
      if (mounted.current && ticket === generation.current) setMessages(history.messages)
    } catch (cause) { if (mounted.current && ticket === generation.current) setError(maxError(cause)) }
    finally { mutation.current = false; if (mounted.current && ticket === generation.current) setBusy(false) }
  }
  async function refreshMax() {
    if (chatId == null || busy) return
    const ticket = ++generation.current
    setBusy(true); setError('')
    try {
      const history = await maxApi.getChat(chatId, { limit: 30 })
      if (mounted.current && ticket === generation.current) {
        setMessages(history.messages)
        setNotice(uncertain ? 'Переписка обновлена. Убедитесь, что сообщение ещё не отправлено, прежде чем повторять.' : 'Переписка обновлена')
      }
    } catch (cause) { if (mounted.current && ticket === generation.current) setError(maxError(cause)) }
    finally { if (mounted.current && ticket === generation.current) setBusy(false) }
  }
  async function send() {
    const value = draft.trim()
    if (chatId == null || !value || busy || uncertain || !canMessage || mutation.current) return
    mutation.current = true
    const ticket = ++generation.current
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await maxApi.sendMessage(chatId, value)
      if (!mounted.current || ticket !== generation.current) return
      setDraft(''); setNotice('Сообщение отправлено')
      const sentMessage = result.message
      if (sentMessage) setMessages(previous => [...previous.filter(item => item.id !== sentMessage.id), sentMessage])
    } catch (cause) {
      if (mounted.current && ticket === generation.current) {
        setError(maxError(cause, true))
        if (!(cause instanceof ApiError) || ![403, 404, 422].includes(cause.status)) setUncertain(true)
      }
    } finally { mutation.current = false; if (mounted.current && ticket === generation.current) setBusy(false) }
  }

  return <>
    <button ref={trigger} type="button" aria-label={`Действия с номером ${phone}`} aria-haspopup="dialog" aria-expanded={mode !== 'closed'}
      className={`inline-flex items-start gap-2 break-all text-left text-brand hover:underline ${className}`}
      onClick={() => { setMode('actions'); setNotice(''); setError('') }}>
      <Phone size={14} className="mt-0.5 shrink-0" /><span>{phone}</span>
    </button>
    <Modal open={mode !== 'closed'} onClose={close} title={mode === 'max' ? 'Переписка в MAX' : mode === 'call' ? 'Звонок из CRM' : mode === 'telegram' ? 'Корпоративный Telegram' : 'Действия с номером'} width="max-w-xl">
      <div className="space-y-4">
        <div><p className="break-words font-medium">{name}</p><p className="mt-1 select-all break-all text-sm text-muted">{phone}</p></div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {notice && <p role="status" className="text-sm text-brand">{notice}</p>}
        {mode === 'actions' && <>
          {!normalized && <p className="text-sm text-muted">Для связи нужен один номер с кодом страны. Исправьте телефон в карточке.</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => void copy()}><Copy size={16} />Копировать номер</Button>
            <Button variant="secondary" disabled={!normalized || !canMessage} onClick={() => { setMode('max'); setError(''); setNotice('') }}><MessageCircle size={16} />Написать в MAX</Button>
            <Button variant="secondary" disabled={!normalized || !canMessage} onClick={() => { setMode('telegram'); setError(''); setNotice('') }}><MessageCircle size={16} />Написать в Telegram</Button>
            <Button variant="secondary" disabled={!normalized || !canMessage} onClick={() => { setMode('call'); setError(''); setNotice('') }}><Phone size={16} />Позвонить</Button>
          </div>
          <p className="text-xs text-muted">Для Telegram используется общий корпоративный аккаунт.</p>
        </>}
        {mode === 'max' && <>
          <p className="text-xs text-muted">Сообщения отправляются из рабочего аккаунта MAX, подключённого к Durov OS.</p>
          {chatId == null ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); void openMax() }}>
            <Field label="Имя получателя" required><Input value={recipientName} maxLength={64} onChange={event => setRecipientName(event.target.value)} /></Field>
            <p className="text-xs text-muted">Откроем диалог по этому номеру. Если контакта ещё нет в рабочем MAX, он будет добавлен. Сообщение отправится только кнопкой «Отправить».</p>
            <Button type="submit" disabled={busy || !recipientName.trim() || !canMessage}>{busy ? 'Открываем…' : 'Открыть переписку'}</Button>
          </form> : <>
            <div className="flex flex-wrap justify-between gap-2"><Button size="sm" variant="secondary" disabled={busy} onClick={() => void refreshMax()}>Обновить переписку</Button><Link to={`/chats/${chatId}`} className="text-sm text-brand hover:underline">Открыть весь чат MAX</Link></div>
            <div aria-label="Сообщения MAX" className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
              {messages.length ? messages.map(message => <div key={message.id} className={`rounded-lg p-2 text-sm ${message.isOutgoing ? 'ml-6 bg-brand/10' : 'mr-6 bg-surface-muted'}`}><p className="mb-1 text-xs text-muted">{message.isOutgoing ? 'Рабочий аккаунт' : 'Клиент'}</p><p className="whitespace-pre-wrap break-words">{message.text || (message.attaches?.length ? 'Вложение — доступно в полном чате MAX' : 'Служебное сообщение')}</p></div>) : <p className="text-sm text-muted">Сообщений пока нет.</p>}
            </div>
            <form className="space-y-3" onSubmit={event => { event.preventDefault(); void send() }}>
              <Textarea aria-label="Сообщение клиенту в MAX" placeholder="Написать клиенту…" rows={3} maxLength={4000} value={draft} onChange={event => setDraft(event.target.value)} />
              {uncertain && <label className="flex items-start gap-2 text-xs text-muted"><input type="checkbox" onChange={event => { if (event.target.checked) { setUncertain(false); setError('') } }} />Я проверил переписку: сообщение не отправлено, разрешить повторную отправку</label>}
              <Button type="submit" disabled={busy || uncertain || !draft.trim() || !canMessage}><Send size={15} />{busy ? 'Подождите…' : 'Отправить'}</Button>
            </form>
          </>}
        </>}
        {mode === 'telegram' && <div className="space-y-3 text-sm">
          <p>Отправитель: <strong>общий корпоративный аккаунт Telegram</strong>.</p>
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3">Корпоративный Telegram пока не подключён к CRM. Руководителю нужно указать рабочий аккаунт и завершить его подключение. Сообщение не отправлено.</p>
        </div>}
        {mode === 'call' && <div className="space-y-3 text-sm">
          <p>Сотрудник: <strong>{currentUser?.full_name || 'Не определён'}</strong></p>
          <p>Рабочий номер: <strong>{currentUser?.work_phone || 'Не указан в личной карточке'}</strong></p>
          <p>Внутренний номер ВАТС: <strong>{currentUser?.telephony_extension || 'Не назначен'}</strong></p>
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3">Звонки через CRM пока не подключены. Требуется настроить ВАТС и проверить связь с рабочим номером сотрудника. Звонок не выполнен.</p>
        </div>}
        {mode !== 'actions' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { generation.current++; setMode('actions'); setError(''); setNotice('') }}>Назад к действиям</Button>}
      </div>
    </Modal>
  </>
}
