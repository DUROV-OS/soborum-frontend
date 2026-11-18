import { Field, Input, Select, Textarea } from '@/shared/ui/Field'
import { Button } from '@/shared/ui/Button'
import { Card, Bank, Person, labels, types } from './api'

export function CardForm({ value, change, errors, disabled }: { value: Card; change: (v: Card) => void; errors: Record<string,string>; disabled: boolean }) {
  const patch = (key: keyof Card, val: unknown) => change({ ...value, [key]: val, ...(['legal_address', 'actual_address'].includes(key) ? { addresses_same: false } : {}) })
  const field = (key: keyof Card, required = false, area = false) => {
    const props = { 'aria-label': labels[key], value: String(value[key]), disabled, 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `error-${key}` : undefined, className: errors[key] ? '!border-danger' : '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => patch(key, e.target.value) }
    return <Field key={key} label={labels[key]} required={required}>{area ? <Textarea {...props} rows={2} /> : <Input {...props} inputMode={['inn', 'ogrn'].includes(key) ? 'numeric' : undefined} />}{errors[key] && <span id={`error-${key}`} className="mt-1 block text-xs text-danger">{errors[key]}</span>}</Field>
  }
  const rowField = (kind: 'accounts' | 'contacts', index: number, key: string, label: string) => {
    const row = value[kind][index], name = `${kind}.${index}.${key}`, error = errors[name]
    return <Field key={key} label={label}><Input aria-label={`${label} ${index + 1}`} disabled={disabled || row.archived} value={String((row as unknown as Record<string,unknown>)[key] ?? '')} aria-invalid={!!error} className={error ? '!border-danger' : ''} onChange={e => change({ ...value, [kind]: value[kind].map((r,i) => i === index ? { ...r, [key]: e.target.value } : r) })} />{error && <span className="text-xs text-danger">{error}</span>}</Field>
  }
  const archive = (kind: 'accounts' | 'contacts', index: number) => change({ ...value, [kind]: value[kind].map((r,i) => i===index ? { ...r, archived: !r.archived, primary: false } : r) })
  return <div className="space-y-6">
    <section className="space-y-3"><h3 className="font-semibold text-ink">Основные данные</h3><div className="grid gap-4 sm:grid-cols-2">
      {field('name', true)}<Field label="Тип контрагента" required><Select aria-label="Тип контрагента" value={value.legal_type} disabled={disabled} aria-invalid={!!errors.legal_type} className={errors.legal_type ? '!border-danger' : ''} onChange={e => {
        if (e.target.value !== 'legal_entity' && (value.kpp || value.ogrn) && !window.confirm('При смене типа КПП и ОГРН будут убраны из действующих реквизитов. Продолжить?')) return
        change({ ...value, legal_type: e.target.value, ...(e.target.value === 'legal_entity' ? {} : { kpp: '', ogrn: '', director: '' }) })
      }}><option value="">Выберите тип</option>{Object.entries(types).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</Select>{errors.legal_type && <span className="text-xs text-danger">{errors.legal_type}</span>}</Field>
      {field('inn',true)}{value.legal_type === 'legal_entity' && <>{field('kpp')}{field('ogrn')}{field('director')}</>}
    </div></section>
    <section className="space-y-3"><h3 className="font-semibold text-ink">Адреса</h3>{field('legal_address',false,true)}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.addresses_same} disabled={disabled} onChange={e => change({ ...value, addresses_same: e.target.checked, actual_address: e.target.checked ? value.legal_address : value.actual_address })} />Юридический и фактический адреса совпадают</label>
      {field('actual_address',false,true)}
    </section>
    <section className="space-y-3"><h3 className="font-semibold text-ink">Банковские реквизиты</h3>{errors.accounts && <p className="text-sm text-danger">{errors.accounts}</p>}
      {value.accounts.map((row,index) => <div key={row.id} className={`space-y-3 rounded-xl border border-border p-4 ${row.archived ? 'bg-surface-muted' : ''}`}>
        <div className="flex items-center justify-between gap-2"><strong className="text-sm">Счёт {index + 1}{row.archived ? ' · в архиве' : ''}</strong><Button variant="ghost" size="sm" disabled={disabled} onClick={() => archive('accounts',index)}>{row.archived ? 'Восстановить' : 'В архив'}</Button></div>
        {!row.archived && <><div className="grid gap-3 sm:grid-cols-2">{['account_number','bik','bank_name','correspondent_account','bank_address'].map(key => rowField('accounts',index,key,labels[key]))}</div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={row.primary} onChange={e => change({ ...value, accounts: value.accounts.map((r,i) => ({ ...r, primary: i===index ? e.target.checked : false })) })} />Основной счёт</label></>}
      </div>)}
      {!disabled && <Button variant="secondary" onClick={() => change({ ...value, accounts: [...value.accounts, { id: crypto.randomUUID(), account_number: '', bik: '', bank_name: '', correspondent_account: '', bank_address: '', primary: !value.accounts.some(a => !a.archived), archived: false } satisfies Bank] })}>Добавить банковский счёт</Button>}
      <p className="text-xs text-muted">Новые и изменённые реквизиты требуют документальной проверки бухгалтером. Импорт не разрешает автооплату.</p>
    </section>
    <section className="space-y-3"><h3 className="font-semibold text-ink">Контактные лица</h3>{errors.contacts && <p className="text-sm text-danger">{errors.contacts}</p>}
      {value.contacts.map((row,index) => <div key={row.id} className="space-y-3 rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-2"><strong className="text-sm">Контакт {index+1}{row.archived ? ' · в архиве' : ''}</strong><Button variant="ghost" size="sm" disabled={disabled} onClick={() => archive('contacts',index)}>{row.archived ? 'Восстановить' : 'В архив'}</Button></div>
        {!row.archived && <><div className="grid gap-3 sm:grid-cols-2">{rowField('contacts',index,'name','Контактное лицо (ФИО)')}{rowField('contacts',index,'phone','Телефон контактного лица')}{rowField('contacts',index,'email','E-mail контактного лица')}</div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={row.primary} onChange={e => change({ ...value, contacts: value.contacts.map((r,i) => ({ ...r, primary: i===index ? e.target.checked : false })) })} />Основной контакт</label></>}
      </div>)}
      {!disabled && <Button variant="secondary" onClick={() => change({ ...value, contacts: [...value.contacts, { id: crypto.randomUUID(), name: '', phone: '', email: '', primary: !value.contacts.some(c => !c.archived), archived: false } satisfies Person] })}>Добавить контактное лицо</Button>}
    </section>
  </div>
}
