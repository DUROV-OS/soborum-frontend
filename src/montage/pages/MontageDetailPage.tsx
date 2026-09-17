import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Textarea } from '@/shared/ui/Field'
import { Stepper } from '@/shared/ui/Stepper'
import { useMontageStore } from '../store'
import { INSTALLATION_STAGES } from '../types'

export function MontageDetailPage() {
  const { id = '' } = useParams()
  const installationId = Number(id)
  const installation = useMontageStore((s) => s.installation)
  const loadInstallation = useMontageStore((s) => s.loadInstallation)
  const update = useMontageStore((s) => s.update)
  const advance = useMontageStore((s) => s.advance)
  const complete = useMontageStore((s) => s.complete)
  const canEdit = accessLevelAtLeast(useAccessLevel('installation'), 'edit')

  const [address, setAddress] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadInstallation(installationId)
  }, [installationId, loadInstallation])

  useEffect(() => {
    if (installation) {
      setAddress(installation.address ?? '')
      setScheduledDate(installation.scheduled_date ?? '')
      setNotes(installation.notes ?? '')
    }
  }, [installation])

  if (!installation || installation.id !== installationId) {
    return <p className="text-[13px] text-muted">Загрузка…</p>
  }

  async function save() {
    setSaving(true)
    const result = await update(installationId, {
      address: address || undefined,
      scheduled_date: scheduledDate || undefined,
      notes: notes || undefined,
    })
    setSaving(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось сохранить')
  }

  const isFollowup = installation.stage === 'followup'

  async function handleAdvance() {
    setAdvancing(true)
    const result = isFollowup ? await complete(installationId) : await advance(installationId)
    setAdvancing(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось перевести стадию')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/montage" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} />
        Все монтажи
      </Link>

      <div className="mb-6 rounded-md border border-border bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-[18px] font-medium text-ink">Монтаж №{installation.id}</h1>
          {canEdit && (
            <Button size="sm" onClick={handleAdvance} disabled={advancing}>
              {advancing ? 'Переход…' : installation.stage === 'followup' ? 'Завершить цикл' : 'Следующая стадия'}
            </Button>
          )}
        </div>
        <Stepper steps={INSTALLATION_STAGES} currentKey={installation.stage} />
        {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
      </div>

      <div className="rounded-md border border-border bg-surface p-5">
        <h3 className="mb-4 text-[14px] font-medium text-ink">Детали монтажа</h3>
        <div className="flex flex-col gap-4">
          <Field label="Адрес">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="Дата монтажа">
            <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="Заметки">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
          </Field>
        </div>
        {canEdit && (
          <div className="mt-4">
            <Button size="sm" variant="secondary" onClick={save} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
