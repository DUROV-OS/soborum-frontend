import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { ReferrerPicker } from '@/partners/components/ReferrerPicker'
import { categoryLabel, PartnerBrief } from '@/partners/types'
import { Button } from '@/shared/ui/Button'
import { useClientsStore } from '../store'
import { Client } from '../types'
import { ReadRow, Section } from './PanelPrimitives'

/**
 * Кто рекомендовал клиента — партнёр из базы партнёров (0083-c). В отличие
 * от остальных базовых данных не замораживается после создания: рекомендатель
 * нередко выясняется позже, уже в работе с клиентом.
 *
 * Текстовое агентство из 0079-c у старых карточек показывается как есть и
 * при смене рекомендателя сохраняется: бэкенд принимает источник целиком,
 * поэтому agency_* уходят обратно без изменений.
 */
export function SourcePanel({ client }: { client: Client }) {
  const updateSource = useClientsStore((s) => s.updateSource)
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')
  const [editing, setEditing] = useState(false)
  const [referrer, setReferrer] = useState<PartnerBrief | null>(client.referrer)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setReferrer(client.referrer)
  }, [client.referrer])

  async function save() {
    setSaving(true)
    const result = await updateSource(client.id, {
      via_agency: client.via_agency,
      agency_name: client.agency_name,
      agency_contact: client.agency_contact,
      referrer_partner_id: referrer?.id ?? null,
    })
    setSaving(false)
    if (result.ok) {
      setEditing(false)
      setError(null)
      return
    }
    setError(result.reason ?? 'Не удалось сохранить')
  }

  const legacyAgency = client.via_agency && (
    <>
      <ReadRow label="Агентство (указано вручную)" value={client.agency_name} />
      {client.agency_contact && <ReadRow label="Контакт агента" value={client.agency_contact} />}
    </>
  )

  if (!editing) {
    return (
      <Section title="Кто рекомендовал">
        <ReadRow
          label="Рекомендатель"
          value={
            client.referrer ? (
              <Link to={`/partners/${client.referrer.id}`} className="text-brand-dark hover:underline">
                {client.referrer.name}, {categoryLabel(client.referrer.category).toLocaleLowerCase('ru')},{' '}
                {client.referrer.city}
              </Link>
            ) : (
              'Пришёл напрямую'
            )
          }
        />
        {legacyAgency}
        {canEdit && (
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => setEditing(true)}>
            Изменить
          </Button>
        )}
      </Section>
    )
  }

  return (
    <Section title="Кто рекомендовал">
      <ReferrerPicker value={referrer} onChange={setReferrer} />
      {legacyAgency && <div className="mt-3">{legacyAgency}</div>}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setReferrer(client.referrer)
            setEditing(false)
            setError(null)
          }}
        >
          Отмена
        </Button>
      </div>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </Section>
  )
}
