import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Package, Plus, StickyNote, Trash2, Upload } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { Drawer } from '@/shared/ui/Drawer'
import { Field, Input, Select, Textarea } from '@/shared/ui/Field'
import { Tabs } from '@/shared/ui/Tabs'
import { useSuppliersStore } from '../store'
import {
  CONTACT_KIND_LABEL,
  CONTACT_KINDS,
  ContactKind,
  PriceTier,
  SUPPLIER_STATUS_LABEL,
  SupplierContact,
  SupplierStatus,
  tierLabel,
} from '../types'
import { LinkMaxChatModal } from './LinkMaxChatModal'
import { PriceListImportModal } from './PriceListImportModal'
import { SupplierOrdersSection } from './SupplierOrdersSection'

// Инициалы для аватара-плашки — по образцу карточки контрагента из
// gpt_prototype/design-history/counterparty-card.html (референс 0011-l):
// первые буквы первых двух слов названия.
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')
}

type TabKey = 'overview' | 'prices' | 'orders' | 'notes'

export function SupplierDetailDrawer({
  supplierId,
  onClose,
}: {
  supplierId: number | null
  onClose: () => void
}) {
  const supplier = useSuppliersStore((s) => s.suppliers.find((x) => x.id === supplierId))
  const update = useSuppliersStore((s) => s.update)
  const removePriceItem = useSuppliersStore((s) => s.removePriceItem)
  const addNote = useSuppliersStore((s) => s.addNote)
  const removeNote = useSuppliersStore((s) => s.removeNote)
  const removeSupplier = useSuppliersStore((s) => s.remove)
  const level = useAccessLevel('warehouse')
  const canEdit = accessLevelAtLeast(level, 'edit')
  const canFull = accessLevelAtLeast(level, 'full')
  const navigate = useNavigate()

  const [tab, setTab] = useState<TabKey>('overview')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<SupplierStatus>('active')
  const [categories, setCategories] = useState('')
  const [contacts, setContacts] = useState<SupplierContact[]>([])
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteBusy, setNoteBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!supplier) return
    setTab('overview')
    setName(supplier.name)
    setStatus(supplier.status)
    setCategories(supplier.categories.join(', '))
    setContacts(supplier.contacts.map((c) => ({ ...c })))
    setProfileError(null)
    setPriceError(null)
    setAdding(false)
    setNoteDraft('')
  }, [supplier?.id])

  const profileDirty = useMemo(() => {
    if (!supplier) return false
    return (
      name.trim() !== supplier.name ||
      status !== supplier.status ||
      categories !==
        supplier.categories.join(', ') ||
      JSON.stringify(contacts) !== JSON.stringify(supplier.contacts)
    )
  }, [supplier, name, status, categories, contacts])

  if (!supplier) return null
  const supplierId_ = supplier.id

  async function saveProfile() {
    setSavingProfile(true)
    const result = await update(supplierId_, {
      name: name.trim(),
      status,
      categories: categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      contacts: contacts
        .filter((c) => c.value.trim())
        .map((c) => ({ kind: c.kind, value: c.value.trim(), person: c.person?.trim() || null })),
    })
    setSavingProfile(false)
    setProfileError(result.ok ? null : result.reason ?? 'Не удалось сохранить')
  }

  async function unlinkChat() {
    await useSuppliersStore.getState().unlinkChat(supplierId_)
  }

  async function deletePrice(itemId: number) {
    const result = await removePriceItem(supplierId_, itemId)
    setPriceError(result.ok ? null : result.reason ?? 'Не удалось удалить строку')
  }

  async function saveNote() {
    if (!noteDraft.trim()) return
    setNoteBusy(true)
    const result = await addNote(supplierId_, noteDraft.trim())
    setNoteBusy(false)
    if (result.ok) setNoteDraft('')
  }

  async function handleDeleteSupplier() {
    if (!supplier) return
    if (!window.confirm(`Удалить поставщика «${supplier.name}»? Отменить нельзя.`)) return
    setDeleting(true)
    const result = await removeSupplier(supplierId_)
    if (result.ok) {
      onClose()
      return
    }
    setDeleting(false)
    setProfileError(result.reason ?? 'Не удалось удалить поставщика')
  }

  return (
    <Drawer
      open={supplierId !== null}
      onClose={onClose}
      title={supplier.name}
      width="max-w-2xl"
      subtitle={
        <div className="flex items-center gap-2">
          <Chip tone={supplier.status === 'active' ? 'success' : 'neutral'}>
            {SUPPLIER_STATUS_LABEL[supplier.status]}
          </Chip>
          <span>
            {supplier.price_items_count} позиций прайса
            {supplier.notes.length > 0 && ` · ${supplier.notes.length} заметок`}
          </span>
        </div>
      }
    >
      {/* Плашка-аватар + категории — общая шапка над вкладками, по образцу
          identity-блока в gpt_prototype/design-history/counterparty-card.html */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand/10 text-[15px] font-medium text-brand-dark">
          {initialsOf(supplier.name) || '—'}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {supplier.categories.length === 0 && <span className="text-[12px] text-muted">Без категорий</span>}
          {supplier.categories.map((c) => (
            <Chip key={c} tone="neutral">
              {c}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <Tabs<TabKey>
          tabs={[
            { key: 'overview', label: 'Обзор' },
            { key: 'prices', label: 'Прайс-лист' },
            { key: 'orders', label: 'Заказы и оплата' },
            { key: 'notes', label: 'Заметки' },
          ]}
          activeKey={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* Профиль */}
          <section className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Название" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="Статус">
                <Select value={status} onChange={(e) => setStatus(e.target.value as SupplierStatus)} disabled={!canEdit}>
                  {Object.entries(SUPPLIER_STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Категории" hint="Через запятую">
              <Input value={categories} onChange={(e) => setCategories(e.target.value)} disabled={!canEdit} />
            </Field>

            {/* Контакты */}
            <div>
              <div className="mb-2 text-[13px] font-medium text-ink">Контакты</div>
              <div className="flex flex-col gap-2">
                {contacts.map((contact, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <Select
                      value={contact.kind}
                      onChange={(e) => patchContact(index, { kind: e.target.value as ContactKind })}
                      className="w-36"
                      disabled={!canEdit}
                    >
                      {CONTACT_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {CONTACT_KIND_LABEL[kind]}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={contact.value}
                      onChange={(e) => patchContact(index, { value: e.target.value })}
                      placeholder="Значение"
                      className="min-w-[10rem] flex-1"
                      disabled={!canEdit}
                    />
                    <Input
                      value={contact.person ?? ''}
                      onChange={(e) => patchContact(index, { person: e.target.value })}
                      placeholder="Контактное лицо"
                      className="min-w-[9rem] flex-1"
                      disabled={!canEdit}
                    />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setContacts(contacts.filter((_, i) => i !== index))}
                        aria-label="Удалить контакт"
                        className="rounded-md p-2 text-muted hover:bg-surface-muted hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setContacts([...contacts, { kind: 'phone', value: '', person: '' }])}
                    className="inline-flex w-fit items-center gap-1.5 text-[13px] text-brand hover:text-brand-dark"
                  >
                    <Plus size={14} /> Добавить контакт
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {canEdit && (
                <Button size="sm" onClick={saveProfile} disabled={!profileDirty || savingProfile || !name.trim()}>
                  {savingProfile ? 'Сохранение…' : 'Сохранить'}
                </Button>
              )}
              {canFull && (
                <button
                  type="button"
                  onClick={handleDeleteSupplier}
                  disabled={deleting}
                  aria-label="Удалить поставщика"
                  title="Удалить поставщика"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:bg-danger/40"
                >
                  <Trash2 size={14} />
                </button>
              )}
              {profileError && <span className="text-[12px] text-danger">{profileError}</span>}
            </div>
          </section>

          {/* Чат MAX */}
          <section className="rounded-md border border-border p-4">
            <div className="mb-2 text-[13px] font-medium text-ink">Чат в MAX</div>
            {supplier.max_chat_id != null ? (
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <Chip tone="info">Чат #{supplier.max_chat_id}</Chip>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/chats/${supplier.max_chat_id}`)}>
                  <ExternalLink size={14} /> Открыть чат
                </Button>
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={unlinkChat}>
                    Открепить
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-muted">Чат не привязан.</span>
                {canEdit && (
                  <Button size="sm" variant="secondary" onClick={() => setLinkOpen(true)}>
                    Привязать чат
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'prices' && (
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] font-medium text-ink">Прайс-лист</div>
            {canEdit && (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
                  <Upload size={14} /> Загрузить таблицей
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
                  <Plus size={14} /> Строка прайса
                </Button>
              </div>
            )}
          </div>

          {adding && canEdit && (
            <PriceItemForm
              onCancel={() => setAdding(false)}
              onDone={() => {
                setAdding(false)
                setPriceError(null)
              }}
              supplierId={supplierId_}
            />
          )}

          {priceError && <p className="mb-2 text-[12px] text-danger">{priceError}</p>}

          <div className="flex flex-col gap-2">
            {supplier.price_items.length === 0 && !adding && (
              <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
                Строк прайса пока нет
              </p>
            )}
            {supplier.price_items.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-md border border-border px-3 py-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted">
                  <Package size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-ink">{item.material}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-[12px] text-muted">
                        {item.category && <Chip tone="neutral">{item.category}</Chip>}
                        {item.lead_time && <span>срок: {item.lead_time}</span>}
                        {item.round != null && <span>раунд: {item.round}</span>}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => deletePrice(item.id)}
                        aria-label="Удалить строку прайса"
                        className="rounded-md p-2 text-muted hover:bg-surface-muted hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {item.tiers.map((tier, i) => (
                      <Chip key={i} tone="brand">
                        {tierLabel(tier)}
                      </Chip>
                    ))}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">
                    обновлено {new Date(item.updated_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'orders' && (
        <SupplierOrdersSection
          supplierId={supplierId_}
          totalOrdered={supplier.total_ordered}
          totalPaid={supplier.total_paid}
          balance={supplier.balance}
        />
      )}

      {tab === 'notes' && (
        <section>
          <div className="mb-2 text-[13px] font-medium text-ink">Заметки</div>
          <div className="flex flex-col gap-2">
            {canEdit && (
              <div className="flex gap-2">
                <Textarea
                  rows={2}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Напр.: завышает цены на метизы; долго отвечает; сменился менеджер"
                />
                <Button
                  size="sm"
                  className="self-start"
                  disabled={!noteDraft.trim() || noteBusy}
                  onClick={saveNote}
                >
                  {noteBusy ? '…' : 'Добавить'}
                </Button>
              </div>
            )}
            {supplier.notes.length === 0 && (
              <p className="text-[12px] text-muted">Заметок пока нет.</p>
            )}
            {supplier.notes.map((note) => (
              <div key={note.id} className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted">
                  <StickyNote size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="whitespace-pre-wrap text-[13px] text-ink">{note.text}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {note.author_name ?? 'сотрудник'} · {new Date(note.created_at).toLocaleString('ru-RU')}
                  </div>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeNote(supplierId_, note.id)}
                    aria-label="Удалить заметку"
                    className="rounded-md p-2 text-muted hover:bg-surface-muted hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <LinkMaxChatModal supplierId={supplierId_} open={linkOpen} onClose={() => setLinkOpen(false)} />
      <PriceListImportModal
        supplierId={supplierId_}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onRequestLinkChat={() => setLinkOpen(true)}
      />
    </Drawer>
  )

  function patchContact(index: number, patch: Partial<SupplierContact>) {
    setContacts(contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }
}

const EMPTY_TIER: PriceTier = { min_qty: 0, max_qty: null, price: 0 }

function PriceItemForm({
  supplierId,
  onCancel,
  onDone,
}: {
  supplierId: number
  onCancel: () => void
  onDone: () => void
}) {
  const addPriceItem = useSuppliersStore((s) => s.addPriceItem)
  const [material, setMaterial] = useState('')
  const [category, setCategory] = useState('')
  const [leadTime, setLeadTime] = useState('')
  const [round, setRound] = useState<number | ''>('')
  const [tiers, setTiers] = useState<PriceTier[]>([{ ...EMPTY_TIER }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasPrice = tiers.some((t) => t.price > 0)
  const valid = material.trim().length > 0 && hasPrice

  function patchTier(index: number, patch: Partial<PriceTier>) {
    setTiers(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)))
  }

  async function submit() {
    if (!valid) {
      setError('Нужен материал и хотя бы один диапазон с ценой')
      return
    }
    setSaving(true)
    const result = await addPriceItem(supplierId, {
      material: material.trim(),
      category: category.trim() || null,
      lead_time: leadTime.trim() || null,
      round: round === '' ? null : Number(round),
      tiers: tiers.map((t) => ({ min_qty: Number(t.min_qty) || 0, max_qty: t.max_qty, price: Number(t.price) || 0 })),
    })
    setSaving(false)
    if (result.ok) onDone()
    else setError(result.reason ?? 'Не удалось сохранить строку')
  }

  return (
    <div className="mb-3 rounded-md border border-border bg-surface-muted/40 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Материал" required>
          <Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Доска 150×50×6000" />
        </Field>
        <Field label="Категория">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="брусы/доска" />
        </Field>
        <Field label="Срок поставки">
          <Input value={leadTime} onChange={(e) => setLeadTime(e.target.value)} placeholder="10 дней" />
        </Field>
        <Field label="Раунд переговоров">
          <Input
            type="number"
            value={round}
            onChange={(e) => setRound(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-[12px] font-medium text-ink">Цена по размеру партии</div>
        <div className="flex flex-col gap-2">
          {tiers.map((tier, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                value={tier.min_qty}
                onChange={(e) => patchTier(index, { min_qty: Number(e.target.value) })}
                placeholder="от"
                className="w-20"
              />
              <span className="text-[12px] text-muted">–</span>
              <Input
                type="number"
                value={tier.max_qty ?? ''}
                onChange={(e) =>
                  patchTier(index, { max_qty: e.target.value === '' ? null : Number(e.target.value) })
                }
                placeholder="до (пусто = ∞)"
                className="w-28"
              />
              <Input
                type="number"
                value={tier.price}
                onChange={(e) => patchTier(index, { price: Number(e.target.value) })}
                placeholder="цена, ₽"
                className="w-28"
              />
              {tiers.length > 1 && (
                <button
                  type="button"
                  onClick={() => setTiers(tiers.filter((_, i) => i !== index))}
                  aria-label="Удалить диапазон"
                  className="rounded-md p-2 text-muted hover:bg-surface-muted hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setTiers([...tiers, { ...EMPTY_TIER }])}
            className="inline-flex w-fit items-center gap-1.5 text-[13px] text-brand hover:text-brand-dark"
          >
            <Plus size={14} /> Диапазон
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}

      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving ? 'Сохранение…' : 'Добавить'}
        </Button>
      </div>
    </div>
  )
}
