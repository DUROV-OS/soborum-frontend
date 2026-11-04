import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import * as crm from '@/crm/api'
import * as partnersApi from '@/partners/api'
import { PartnerFormModal } from '@/partners/components/PartnerFormModal'
import type { Partner } from '@/partners/types'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { chatLinkError, crmCardPath, linkCrmFromMax } from '../crmLinks'
import type { MaxDialogPeer } from '../types'

type Choice = { id: number; name: string; phone: string }
type Kind = 'contact' | 'company' | 'partner'

/** Sales cards only. Opening this modal never requests the ERP clients API. */
export function LinkClientModal({ chatId, peer, chatTitle, open, onClose, onLinked }: {
  chatId: number; peer: MaxDialogPeer | null; chatTitle: string | null
  open: boolean; onClose: () => void; onLinked: () => void
}) {
  const navigate = useNavigate()
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')
  const [kind, setKind] = useState<Kind>('contact')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [choices, setChoices] = useState<Choice[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState<'contact' | 'company' | null>(null)
  const [creatingPartner, setCreatingPartner] = useState(false)
  const [pendingPartner, setPendingPartner] = useState<Partner | null>(null)
  const [uncertainPartner, setUncertainPartner] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const mutation = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (!open) { setOffset(0); setChoices([]) } }, [open])
  useEffect(() => {
    if (!open || !canEdit || creating || creatingPartner || pendingPartner) return
    let cancelled = false
    setLoading(true); setError('')
    const timer = window.setTimeout(async () => {
      try {
        let rows: Choice[], count: number
        if (kind === 'partner') {
          const found = (await partnersApi.listPartners()).filter(row => [row.name, row.phone, row.email, row.city].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
          rows = found.slice(offset, offset + 50).map(row => ({ id: row.id, name: row.name, phone: row.phone || '' })); count = found.length
        } else {
          const found = await crm.list(kind, { query, offset, limit: 50 })
          rows = found.items.map(row => ({ id: row.id, name: row.name, phone: typeof row.data.phone === 'string' ? row.data.phone : '' })); count = found.total
        }
        if (!cancelled) { setChoices(previous => offset ? [...previous, ...rows] : rows); setTotal(count) }
      } catch { if (!cancelled) { setError('Не удалось загрузить карточки. Повторите поиск.'); setChoices([]); setTotal(0) } }
      finally { if (!cancelled) setLoading(false) }
    }, 150)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [open, canEdit, kind, query, offset, creating, creatingPartner, pendingPartner])

  function beginCreate(next: 'contact' | 'company') {
    setOffset(0); setCreating(next); setName(peer?.name || chatTitle || ''); setPhone(peer?.phone || ''); setEmail(''); setError('')
  }
  function close() { if (!mutation.current) onClose() }
  async function bindExisting(choice: Choice) {
    if (mutation.current || !canEdit) return
    mutation.current = true; setBusy(true); setError('')
    try {
      if (kind === 'partner') {
        await partnersApi.createChatLink(choice.id, chatId, 'MAX')
        if (!mounted.current) return
        onLinked(); onClose(); navigate(`/partners/${choice.id}`)
      } else {
        const link = await linkCrmFromMax({ max_chat_id: chatId, entity_id: choice.id })
        if (!mounted.current) return
        onLinked(); onClose(); navigate(crmCardPath(link.entity_kind, link.entity_id))
      }
    } catch (cause) { if (mounted.current) setError(chatLinkError(cause)) }
    finally { mutation.current = false; if (mounted.current) setBusy(false) }
  }
  async function createCard() {
    if (!creating || !name.trim() || mutation.current || !canEdit) return
    mutation.current = true; setBusy(true); setError('')
    try {
      const link = await linkCrmFromMax({ max_chat_id: chatId, create: { kind: creating, name: name.trim(), phone: phone.trim(), email: email.trim() } })
      if (!mounted.current) return
      onLinked(); onClose(); navigate(crmCardPath(link.entity_kind, link.entity_id))
    } catch (cause) { if (mounted.current) setError(chatLinkError(cause)) }
    finally { mutation.current = false; if (mounted.current) setBusy(false) }
  }
  async function bindCreatedPartner(partner: Partner) {
    if (mutation.current || !canEdit) return
    setCreatingPartner(false); setPendingPartner(partner)
    mutation.current = true; setBusy(true); setError('')
    try {
      // Retry reuses the already-created partner, including a lost bind response.
      const current = await partnersApi.getPartner(partner.id)
      if (!current.chat_links.some(link => link.max_chat_id === chatId)) await partnersApi.createChatLink(partner.id, chatId, 'MAX')
      if (!mounted.current) return
      setPendingPartner(null); onLinked(); onClose(); navigate(`/partners/${partner.id}`)
    } catch (cause) { if (mounted.current) setError(`Партнёр уже создан. ${chatLinkError(cause)}`) }
    finally { mutation.current = false; if (mounted.current) setBusy(false) }
  }

  if (!canEdit) return null
  return <>
    <Modal open={open && !creatingPartner} onClose={close} title={creating ? (creating === 'company' ? 'Новая компания из чата' : 'Новый клиент из чата') : 'Привязать чат'} width="max-w-xl">
      <div className="space-y-3">
        {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
        {pendingPartner ? <>
          <p className="text-[13px]">Партнёр «{pendingPartner.name}» создан. Осталось связать с ним этот чат.</p>
          <Button onClick={() => bindCreatedPartner(pendingPartner)} disabled={busy}>Повторить привязку</Button>
        </> : creating ? <>
          <Field label={creating === 'company' ? 'Название компании' : 'Имя клиента'}><Input autoFocus value={name} maxLength={1000} onChange={event => setName(event.target.value)} disabled={busy} /></Field>
          <Field label="Телефон"><Input value={phone} maxLength={100} onChange={event => setPhone(event.target.value)} disabled={busy} /></Field>
          <Field label="Email"><Input value={email} maxLength={255} onChange={event => setEmail(event.target.value)} disabled={busy} /></Field>
          <p className="text-[12px] text-muted">Карточка появится в CRM вместе со связью с этим чатом. Сообщение отправлено не будет.</p>
          <div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => { setCreating(null); setError('') }}>Назад</Button><Button disabled={busy || !name.trim()} onClick={createCard}>{busy ? 'Сохранение…' : 'Создать и привязать'}</Button></div>
        </> : <>
          <Field label="Раздел"><Select value={kind} disabled={busy} onChange={event => { setKind(event.target.value as Kind); setOffset(0); setChoices([]) }}><option value="contact">Контакты CRM</option><option value="company">Компании CRM</option><option value="partner">Партнёры</option></Select></Field>
          <Input placeholder="Поиск по имени, телефону, email…" value={query} disabled={busy} onChange={event => { setQuery(event.target.value); setOffset(0) }} />
          {uncertainPartner && <p role="alert" className="text-[13px] text-danger">Не удалось подтвердить создание партнёра. Проверьте найденные карточки: партнёр мог уже сохраниться. Выберите существующего партнёра для привязки.</p>}
          {peer && chatId !== 0 && !uncertainPartner && <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => beginCreate('contact')}>Новый клиент из этого чата</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => beginCreate('company')}>Новая компания</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setCreatingPartner(true); setError('') }}>Новый партнёр</Button>
          </div>}
          <div className="max-h-[45vh] space-y-1 overflow-y-auto">
            {choices.map(choice => <button type="button" disabled={busy || loading} key={choice.id} className="block w-full rounded border border-border p-3 text-left text-[13px] disabled:opacity-50" onClick={() => bindExisting(choice)}><span className="block font-medium">{choice.name}</span>{choice.phone && <span className="block text-[12px] text-muted">{choice.phone}</span>}</button>)}
            {loading && <p className="text-[13px] text-muted">Загрузка карточек…</p>}
            {!loading && !error && !choices.length && <p className="text-[13px] text-muted">Карточки не найдены</p>}
            {choices.length < total && <Button variant="ghost" size="sm" disabled={loading || busy} onClick={() => setOffset(choices.length)}>Загрузить ещё</Button>}
          </div>
        </>}
      </div>
    </Modal>
    {open && creatingPartner && peer && <PartnerFormModal open onClose={() => setCreatingPartner(false)} initial={{ name: peer.name || chatTitle || '', phone: peer.phone || '', contacts: [{ messenger: 'MAX', contact: peer.phone || peer.name || chatTitle || '' }] }} onCreated={bindCreatedPartner} onCreateUncertain={createdName => { setCreatingPartner(false); setUncertainPartner(true); setKind('partner'); setOffset(0); setQuery(createdName) }} />}
  </>
}
