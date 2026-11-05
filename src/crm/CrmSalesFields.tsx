import { useEffect, useState } from 'react'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import type { Entry } from './api'
import { useAuthStore } from '@/auth/store'

export const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
type Change = (value: Record<string, unknown>) => void
type Spec = { key: string; label: string; type?: 'date' | 'number' | 'url'; options?: [string, string][] }
export const TEMPERATURES: [string, string][] = [['hot', 'Горячий'], ['warm', 'Тёплый'], ['cold', 'Холодный']]
const customerSpecs: Spec[] = [
  { key: 'last_name', label: 'Фамилия' }, { key: 'first_name', label: 'Имя' }, { key: 'middle_name', label: 'Отчество' },
  { key: 'gender', label: 'Пол', options: [['male', 'Мужской'], ['female', 'Женский']] },
  { key: 'phone_2', label: 'Телефон №2' }, { key: 'phone_3', label: 'Телефон №3' },
  { key: 'source_label', label: 'Источник со слов клиента' }, { key: 'deal_timeframe', label: 'Срок выхода на сделку' },
  { key: 'birth_date', label: 'Дата рождения', type: 'date' }, { key: 'marital_status', label: 'Семейное положение' },
  { key: 'marriage_date', label: 'Дата заключения брака', type: 'date' }, { key: 'city', label: 'Город' },
  { key: 'temperature', label: 'Температура клиента', options: TEMPERATURES },
]
const needsSpecs: Spec[] = [
  { key: 'purchase_goal', label: 'Цель покупки', options: [['living', 'Проживание'], ['renting', 'Сдача в аренду']] },
  { key: 'construction_city', label: 'Город застройки' },
  { key: 'property_type', label: 'Тип объекта', options: [['barn', 'Барн'], ['flat', 'Флэт'], ['undecided', 'Не определился']] },
  { key: 'rooms', label: 'Количество комнат', type: 'number' },
  { key: 'finishing', label: 'Отделка', options: [['warm_shell', 'Тёплый контур'], ['eco', 'Эко'], ['standard', 'Стандарт'], ['premium', 'Премиум']] },
]
const purchaseSpecs: Spec[] = [
  { key: 'payment_form', label: 'Форма оплаты', options: [['cash', 'Наличные'], ['mortgage', 'Ипотека'], ['installments', 'Рассрочка'], ['trade_in', 'Трейд-ин']] },
  { key: 'initial_payment', label: 'Первоначальный взнос, ₽', type: 'number' },
  { key: 'mortgage_approved', label: 'Ипотека оформлена', options: [['true', 'Да'], ['false', 'Нет']] },
]
const saleSpecs: Spec[] = [
  { key: 'object_url', label: 'Ссылка на конкретный объект', type: 'url' },
  { key: 'final_customer_price', label: 'Окончательная стоимость для клиента, ₽', type: 'number' },
  { key: 'final_payment_timeframe', label: 'Ориентировочные сроки окончательных расчётов' },
  { key: 'partner_deal', label: 'Партнёрская сделка', options: [['true', 'Да'], ['false', 'Нет']] },
  { key: 'payment_status', label: 'Статус оплаты клиента' },
]
const extras: [string, string][] = [['sauna', 'Баня'], ['hot_tub', 'Чан'], ['utility_building', 'Хозблок']]
const legal: [string, string][] = [['ooo', 'ООО'], ['ip', 'ИП'], ['self_employed', 'Самозанятый']]
const boolFields = new Set(['mortgage_approved', 'partner_deal'])
const privateCustomerKeys = new Set(['birth_date', 'marital_status', 'marriage_date', 'children_birth_dates'])

function Fields({ specs, value, onChange }: { specs: Spec[]; value: unknown; onChange: Change }) {
  const data = asObject(value)
  return <div className="grid gap-3 sm:grid-cols-2">{specs.map(spec => <Field key={spec.key} label={spec.label}>
    {spec.options ? <Select aria-label={spec.label} value={String(data[spec.key] ?? '')} onChange={event => onChange({ ...data, [spec.key]: event.target.value === '' ? null : boolFields.has(spec.key) ? event.target.value === 'true' : event.target.value })}>
      <option value="">Не указано</option>{spec.options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </Select> : <Input type={spec.type || 'text'} min={spec.type === 'number' ? 0 : undefined} step={spec.key === 'rooms' ? 1 : spec.type === 'number' ? '0.01' : undefined}
      value={String(data[spec.key] ?? '')} onChange={event => onChange({ ...data, [spec.key]: spec.type === 'number' ? event.target.value === '' ? null : Number(event.target.value) : (spec.type === 'date' || spec.type === 'url') && !event.target.value ? null : event.target.value })} />}
  </Field>)}</div>
}

export function CrmCustomerFields({ value, onChange }: { value: unknown; onChange: Change }) {
  const canReadPrivate = useAuthStore(state => state.current?.role === 'admin')
  const customer = asObject(value)
  const dates = Array.isArray(customer.children_birth_dates) ? customer.children_birth_dates.map(String) : []
  return <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">Данные клиента</legend>
    <Fields specs={customerSpecs.filter(spec => canReadPrivate || !privateCustomerKeys.has(spec.key))} value={customer} onChange={onChange} />
    {canReadPrivate && <div className="space-y-2">{dates.map((date, index) => <div key={index} className="flex items-end gap-2">
      <Field label={`Дата рождения ребёнка ${index + 1}`}><Input type="date" value={date} onChange={event => onChange({ ...customer, children_birth_dates: dates.map((item, i) => i === index ? event.target.value : item) })} /></Field>
      <Button variant="ghost" aria-label={`Убрать дату ребёнка ${index + 1}`} onClick={() => onChange({ ...customer, children_birth_dates: dates.filter((_, i) => i !== index) })}>Убрать</Button>
    </div>)}<Button variant="secondary" size="sm" disabled={dates.length >= 50} onClick={() => onChange({ ...customer, children_birth_dates: [...dates, ''] })}>Добавить дату рождения ребёнка</Button></div>}
  </fieldset>
}

export function CrmCommercialFields({ data, put }: { data: Record<string, unknown>; put: (key: string, value: unknown) => void }) {
  const needs = asObject(data.needs)
  const selected = Array.isArray(needs.extras) ? needs.extras.map(String) : []
  return <>
    <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">Потребность клиента</legend>
      <Fields specs={needsSpecs} value={needs} onChange={value => put('needs', value)} />
      <div role="group" aria-label="Допы" className="flex flex-wrap gap-4">{extras.map(([key, label]) => <label key={key} className="flex gap-2 text-sm"><input type="checkbox" checked={selected.includes(key)} onChange={event => put('needs', { ...needs, extras: event.target.checked ? [...selected, key] : selected.filter(item => item !== key) })} />{label}</label>)}</div>
    </fieldset>
    <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">Условия покупки</legend><Fields specs={purchaseSpecs} value={data.purchase_terms} onChange={value => put('purchase_terms', value)} /></fieldset>
    <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">Условия сделки</legend><Fields specs={saleSpecs} value={data.sale_terms} onChange={value => put('sale_terms', value)} /></fieldset>
  </>
}

type Agency = { id: number; name: string; contacts: { id: number; name: string; phone: string }[] }
export function CrmReferralFields({ value, onChange }: { value: unknown; onChange: (value: Record<string, unknown> | null) => void }) {
  const referral = asObject(value)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<{ total: number; items: Agency[]; configured: boolean } | null>(null)
  const [chosen, setChosen] = useState<Agency | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setError(''); setResult(null)
      apiRequest<{ total: number; items: Agency[]; configured: boolean }>({ section: 'crm', path: '/agency-sources', query: { query, limit: 100 } })
        .then(value => {
          if (!value || !Array.isArray(value.items) || typeof value.total !== 'number') throw new Error('Не удалось загрузить агентства')
          if (active) setResult(value)
        }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Не удалось загрузить агентства') })
    }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [query])
  const agency = chosen?.id === referral.agency_id ? chosen : result?.items.find(item => item.id === referral.agency_id)
  return <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">Источник · Агентство недвижимости</legend>
    {referral.agency_id != null && <div className="space-y-2 text-sm"><p>Выбрано: {String(agency?.name || referral.agency_name || 'Выберите сотрудника агентства')}</p>
      {!agency && referral.agent_name ? <p>Сотрудник на момент выбора: {String(referral.agent_name)}</p> : null}
      <Button size="sm" variant="ghost" onClick={() => { setChosen(null); onChange(null) }}>Убрать связь с агентством</Button></div>}
    <Field label="Найти подключённое агентство"><Input value={query} onChange={event => setQuery(event.target.value)} /></Field>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {result?.total === 0 && <p role="status" className="text-sm text-muted">{query ? 'Подключённое агентство с таким названием не найдено.' : 'Подключённых агентств пока нет. Они появятся после подключения к партнёрскому каналу.'}</p>}
    {result != null && result.total > result.items.length && <p className="text-xs text-muted">Уточните название: найдено {result.total} агентств.</p>}
    <div className="max-h-40 space-y-1 overflow-y-auto">{result?.items.map(item => <button type="button" key={item.id} className="block w-full rounded border border-border p-2 text-left text-sm hover:bg-surface-muted" onClick={() => { setChosen(item); onChange({ agency_id: item.id, agent_contact_id: 0 }) }}>{item.name}</button>)}</div>
    {agency && <Field label="Сотрудник выбранного агентства" required><Select aria-label="Сотрудник выбранного агентства" value={String(referral.agent_contact_id || '')} onChange={event => onChange({ agency_id: agency.id, agent_contact_id: Number(event.target.value) })}>
      <option value="">Выберите сотрудника</option>{agency.contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}{contact.phone ? ` · ${contact.phone}` : ''}</option>)}
    </Select></Field>}
    {agency && !agency.contacts.length && <p className="text-sm text-muted">У агентства ещё нет связанных контактов сотрудников.</p>}
  </fieldset>
}

type Member = { contact_id: number; roles: string[] }
export function CrmAgencyFields({ value, contacts, onChange }: { value: unknown; contacts: Entry[]; onChange: Change }) {
  const profile = asObject(value)
  const members: Member[] = Array.isArray(profile.members) ? profile.members as Member[] : []
  const agents = members.filter(item => item.roles.includes('agent'))
  const [slots, setSlots] = useState(10)
  function setRole(role: string, oldId: number | undefined, nextId: number) {
    const next = members.map(item => ({ ...item, roles: item.contact_id === oldId ? item.roles.filter(value => value !== role) : [...item.roles] })).filter(item => item.roles.length)
    if (nextId) {
      const existing = next.find(item => item.contact_id === nextId)
      if (existing && !existing.roles.includes(role)) existing.roles.push(role)
      else if (!existing) next.push({ contact_id: nextId, roles: [role] })
    }
    onChange({ ...profile, members: next })
  }
  function roleField(label: string, role: string, selected?: number) {
    return <Field key={label} label={label}><Select aria-label={label} value={String(selected || '')} onChange={event => setRole(role, selected, Number(event.target.value))}>
      <option value="">Не указан</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}{contact.data.phone ? ` · ${String(contact.data.phone)}` : ''}</option>)}
    </Select></Field>
  }
  return <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">Карточка агентства</legend>
    <Fields specs={[{ key: 'legal_status', label: 'Юридический статус', options: legal }]} value={profile} onChange={onChange} />
    <p className="text-xs text-muted">Выберите сотрудников из связанных контактов агентства. Один человек может совмещать несколько ролей.</p>
    <div className="grid gap-3 sm:grid-cols-2">{([['owner', 'Собственник компании'], ['decision_maker', 'ЛПР'], ['marketer', 'Маркетолог']] as const).map(([role, label]) => roleField(label, role, members.find(item => item.roles.includes(role))?.contact_id))}
      {Array.from({ length: Math.max(slots, agents.length) }, (_, index) => roleField(`Агент ${index + 1}`, 'agent', agents[index]?.contact_id))}</div>
    <Button size="sm" variant="secondary" disabled={slots >= 100} onClick={() => setSlots(value => value + 1)}>Добавить место для агента</Button>
  </fieldset>
}

function show(spec: Spec, value: unknown) {
  if (value == null || value === '') return 'Не указано'
  return spec.options?.find(([key]) => key === String(value))?.[1] || String(value)
}
export function CrmSalesDetails({ data, customerOnly = false }: { data: Record<string, unknown>; customerOnly?: boolean }) {
  const canReadPrivate = useAuthStore(state => state.current?.role === 'admin')
  const groups: [string, unknown, Spec[]][] = [['Данные клиента', data.customer, customerSpecs.filter(spec => canReadPrivate || !privateCustomerKeys.has(spec.key))]]
  if (!customerOnly) groups.push(['Потребность клиента', data.needs, needsSpecs], ['Условия покупки', data.purchase_terms, purchaseSpecs], ['Условия сделки', data.sale_terms, saleSpecs], ['Агентство', data.agency_profile, [{ key: 'legal_status', label: 'Юридический статус', options: legal }]])
  const referral = asObject(data.referral)
  return <>{groups.filter(([, value]) => value != null).map(([title, value, specs]) => <section key={title} className="space-y-2 border-t border-border pt-3"><h3 className="text-sm font-medium">{title}</h3>
    <dl className="space-y-2 text-[13px]">{specs.map(spec => <div key={spec.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3"><dt className="text-muted">{spec.label}</dt><dd className="break-words">{show(spec, asObject(value)[spec.key])}</dd></div>)}
      {canReadPrivate && Array.isArray(asObject(value).children_birth_dates) && <div><dt className="text-muted">Даты рождения детей</dt><dd>{(asObject(value).children_birth_dates as string[]).join(', ') || 'Не указаны'}</dd></div>}
      {Array.isArray(asObject(value).extras) && <div><dt className="text-muted">Допы</dt><dd>{(asObject(value).extras as string[]).map(key => extras.find(item => item[0] === key)?.[1] || key).join(', ') || 'Не указаны'}</dd></div>}
    </dl></section>)}
    {referral.agency_id != null && <section className="space-y-1 border-t border-border pt-3 text-[13px]"><h3 className="font-medium">Партнёрский источник на момент выбора</h3><p>{String(referral.agency_name || '')}</p><p>{String(referral.agent_name || '')}{referral.agent_phone ? ` · ${String(referral.agent_phone)}` : ''}</p></section>}
  </>
}
