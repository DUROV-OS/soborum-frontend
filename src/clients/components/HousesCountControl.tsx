import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'
import { useClientsStore } from '../store'
import { Client, OrderType } from '../types'
import { Section } from './PanelPrimitives'

/**
 * Количество домов — единственное документное поле, которое редактируется в
 * любой момент, даже после того, как остальные данные «Документов и
 * договора» зафиксированы (0044). Поэтому у него своё состояние и своя
 * кнопка сохранения, отдельно от общей формы.
 *
 * `orderTypeOverride` — при открытой форме «Документов» показывает/прячет
 * этот блок по ещё не сохранённому локальному выбору «Проекта», а не по
 * уже сохранённому `client.order_type` (иначе поле появлялось бы только
 * после отдельного сохранения формы выше).
 */
export function HousesCountControl({
  client,
  orderTypeOverride,
}: {
  client: Client
  orderTypeOverride?: OrderType | ''
}) {
  const updateHousesCount = useClientsStore((s) => s.updateHousesCount)
  const [value, setValue] = useState<number | ''>(client.houses_count > 1 ? client.houses_count : 2)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValue(client.houses_count > 1 ? client.houses_count : 2)
  }, [client.houses_count])

  const effectiveOrderType = orderTypeOverride !== undefined ? orderTypeOverride : client.order_type
  if (effectiveOrderType !== 'multiple') return null

  async function save() {
    if (value === '' || value < 2) {
      setError('Не меньше 2')
      return
    }
    setSaving(true)
    const result = await updateHousesCount(client.id, { houses_count: Number(value) })
    setSaving(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось сохранить')
  }

  return (
    <Section title="Количество домов">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Количество" hint="Не меньше 2. Редактируется в любой момент, даже после фиксации остальных документных данных.">
          <Input
            type="number"
            min={2}
            value={value}
            onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </Field>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </div>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </Section>
  )
}
