import { useEffect, useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { getCatalog } from '@/house_models/api'
import { HouseModelCatalog } from '@/house_models/types'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { FileLink } from '@/shared/ui/FileLink'
import { useClientsStore } from '../store'
import { isGroupEditable, isGroupVisible } from '../rules'
import { Client, FileAsset, ORDER_TYPES, OrderType, orderTypeLabel, PAYMENT_PLANS, PaymentPlan, paymentPlanLabel } from '../types'
import { HousesCountControl } from './HousesCountControl'
import { ReadRow, Section } from './PanelPrimitives'

const SERIES_LABEL: Record<string, string> = {
  barn: 'Барн',
  flat: 'Флэт',
}

function HouseModelSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (key: string) => void
}) {
  const [catalog, setCatalog] = useState<HouseModelCatalog | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p className="text-[12px] text-muted">Нет доступа к каталогу домов.</p>
  if (!catalog) return <p className="text-[12px] text-muted">Загрузка каталога…</p>

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— не выбрано —</option>
      {catalog.series.map((group) => (
        <optgroup key={group.series} label={SERIES_LABEL[group.series] ?? group.series}>
          {group.models.map((m) => (
            <option key={m.key} value={m.key}>
              {m.title}
            </option>
          ))}
        </optgroup>
      ))}
      {catalog.individual.length > 0 && (
        <optgroup label="Индивидуальные проекты">
          {catalog.individual.map((m) => (
            <option key={m.key} value={m.key}>
              {m.title}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  )
}

export function DocumentPanel({ client }: { client: Client }) {
  const updateDocuments = useClientsStore((s) => s.updateDocuments)
  const editable = isGroupEditable(client, 'documents')
  const [orderType, setOrderType] = useState<OrderType | ''>(client.order_type ?? '')
  const [houseModelKey, setHouseModelKey] = useState(client.house_model_key ?? '')
  const [finalPrice, setFinalPrice] = useState(client.final_price ?? '')
  const [address, setAddress] = useState(client.installation_address ?? '')
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan | ''>(client.payment_plan ?? '')
  const [advanceAmount, setAdvanceAmount] = useState<number | ''>(client.advance_amount ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visible = isGroupVisible(client, 'documents')

  const needsAdvance = paymentPlan === 'advance_then_balance'
  const finalPriceNum = finalPrice === '' ? null : Number(finalPrice)
  const advanceNum = advanceAmount === '' ? null : Number(advanceAmount)

  function validate(): string | null {
    if (needsAdvance) {
      if (advanceNum === null || advanceNum <= 0) return 'Укажите сумму аванса'
      if (finalPriceNum !== null && advanceNum >= finalPriceNum) {
        return 'Аванс должен быть меньше итоговой стоимости'
      }
    }
    return null
  }

  async function save() {
    const localError = validate()
    if (localError) {
      setError(localError)
      return
    }
    setSaving(true)
    const result = await updateDocuments(client.id, {
      order_type: orderType || undefined,
      house_model_key: houseModelKey || null,
      final_price: finalPrice === '' ? undefined : Number(finalPrice),
      installation_address: address || undefined,
      payment_plan: paymentPlan || undefined,
      advance_amount: needsAdvance && advanceNum !== null ? advanceNum : undefined,
    })
    setSaving(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось сохранить')
  }

  if (!visible) return null

  if (!editable) {
    return (
      <>
        <Section title="Документы и договор">
          <ReadRow label="Проект" value={orderTypeLabel(client.order_type)} />
          <ReadRow label="Вид дома" value={client.house_model?.title} />
          <ReadRow
            label="Итоговая цена"
            value={client.final_price ? `${client.final_price.toLocaleString('ru-RU')} ₽` : undefined}
          />
          <ReadRow label="Формат расчёта" value={client.payment_plan ? paymentPlanLabel(client.payment_plan) : undefined} />
          {client.payment_plan === 'advance_then_balance' && (
            <ReadRow
              label="Сумма аванса"
              value={client.advance_amount ? `${client.advance_amount.toLocaleString('ru-RU')} ₽` : undefined}
            />
          )}
          <ReadRow label="Адрес установки" value={client.installation_address ?? undefined} />
          <ReadRow
            label="Проект дома"
            value={client.house_project_file && <FileLink id={client.house_project_file.id} filename={client.house_project_file.filename} />}
          />
          <ReadRow
            label="Договор"
            value={client.contract_file && <FileLink id={client.contract_file.id} filename={client.contract_file.filename} />}
          />
        </Section>
        <HousesCountControl client={client} />
      </>
    )
  }

  return (
    <>
      <Section title="Документы и договор">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Проект" required hint="Множественный — несколько домов у одного клиента, количество укажете отдельным полем ниже.">
            <Select value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType | '')}>
              <option value="">— выберите —</option>
              {ORDER_TYPES.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Вид дома" hint="Модель из каталога типовых проектов — необязательно, если дом индивидуальный и не совпадает ни с одной карточкой.">
            <HouseModelSelect value={houseModelKey} onChange={setHouseModelKey} />
          </Field>
          <Field label="Итоговая цена, ₽" required>
            <Input type="number" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value === '' ? '' : Number(e.target.value))} />
          </Field>
          <Field label="Адрес установки" required>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <div className={needsAdvance ? '' : 'sm:col-span-2'}>
            <Field label="Формат расчёта" required hint="Определяет, что подтверждают на «Оплате» и нужен ли приём остатка на «Постоплате».">
              <Select
                value={paymentPlan}
                onChange={(e) => {
                  const next = e.target.value as PaymentPlan | ''
                  setPaymentPlan(next)
                  if (next !== 'advance_then_balance') setAdvanceAmount('')
                }}
              >
                <option value="">— выберите —</option>
                {PAYMENT_PLANS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {needsAdvance && (
            <Field label="Сумма аванса, ₽" required hint="Меньше итоговой стоимости. Остаток принимается после получения дома.">
              <Input
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </Field>
          )}
          <Field label="Проект дома" required>
            <FileUploadButton
              asset={client.house_project_file}
              onUpload={(file) => useClientsStore.getState().uploadHouseProjectFile(client.id, file)}
            />
          </Field>
          <Field label="Договор" required>
            <FileUploadButton
              asset={client.contract_file}
              onUpload={(file) => useClientsStore.getState().uploadContractFile(client.id, file)}
            />
          </Field>
        </div>
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
        <div className="mt-4">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      </Section>
      <HousesCountControl client={client} orderTypeOverride={orderType} />
    </>
  )
}

function FileUploadButton({
  asset,
  onUpload,
}: {
  asset: FileAsset | null
  onUpload: (file: File) => Promise<{ ok: boolean; reason?: string }>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    const result = await onUpload(file)
    setUploading(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось загрузить файл')
  }

  const input = <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />

  if (asset) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-muted px-3 py-2">
          <FileLink id={asset.id} filename={asset.filename} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 text-[12px] text-muted hover:text-brand disabled:opacity-50"
          >
            {uploading ? 'Загрузка…' : 'Заменить'}
          </button>
        </div>
        {input}
        {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      {input}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-[13px] text-muted hover:border-brand/40 hover:text-brand disabled:opacity-50"
      >
        <Paperclip size={14} />
        {uploading ? 'Загрузка…' : 'Прикрепить файл'}
      </button>
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  )
}
