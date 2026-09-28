import { useEffect, useState } from 'react'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { ReadRow, Section } from '@/clients/components/PanelPrimitives'
import { Button } from '@/shared/ui/Button'
import { usePartnersStore } from '../store'
import { categoryLabel } from '../types'
import { PartnerFormModal } from '../components/PartnerFormModal'
import { PartnerNotesPanel } from '../components/PartnerNotesPanel'

export function PartnerDetailPage() {
  const { id = '' } = useParams()
  const partnerId = Number(id)
  const navigate = useNavigate()
  const partners = usePartnersStore((s) => s.partners)
  const loading = usePartnersStore((s) => s.loading)
  const load = usePartnersStore((s) => s.load)
  const remove = usePartnersStore((s) => s.remove)
  const level = useAccessLevel('clients')
  const canEdit = accessLevelAtLeast(level, 'edit')
  const canFull = accessLevelAtLeast(level, 'full')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (partners.length === 0) load()
  }, [partners.length, load])

  const partner = partners.find((p) => p.id === partnerId)

  if (!partner) {
    return (
      <p className="text-[13px] text-muted">
        {loading ? 'Загрузка…' : 'Партнёр не найден — возможно, его удалили.'}
      </p>
    )
  }

  async function handleDelete() {
    if (!partner) return
    if (!window.confirm(`Удалить партнёра «${partner.name}» из базы? Отменить нельзя.`)) return
    setDeleting(true)
    const result = await remove(partnerId)
    if (result.ok) {
      navigate('/partners', { replace: true })
      return
    }
    setDeleting(false)
    setError(result.reason ?? 'Не удалось удалить партнёра')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/partners" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} />
        База партнёров
      </Link>

      <div className="mb-6 rounded-md border border-border bg-surface p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[18px] font-medium text-ink">{partner.name}</h1>
            <p className="mt-1 text-[13px] text-muted">
              {categoryLabel(partner.category)} · {partner.city}
              {partner.organization && ` · ${partner.organization}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <Pencil size={14} />
                Изменить
              </Button>
            )}
            {canFull && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Удалить партнёра"
                title="Удалить партнёра"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:bg-danger/40"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
      </div>

      <div className="flex flex-col gap-4">
        <Section title="Контакты">
          <ReadRow label="Телефон" value={partner.phone} />
          <ReadRow label="Почта" value={partner.email} />
          {partner.contacts.map((c, i) => (
            <ReadRow key={i} label={c.messenger} value={c.contact} />
          ))}
          <ReadRow label="В базе с" value={new Date(partner.created_at).toLocaleDateString('ru-RU')} />
        </Section>

        {partner.comment && (
          <Section title="Комментарий">
            <p className="whitespace-pre-line text-[13px] text-ink">{partner.comment}</p>
          </Section>
        )}

        <PartnerNotesPanel partner={partner} />
      </div>

      <PartnerFormModal open={editing} onClose={() => setEditing(false)} partner={partner} />
    </div>
  )
}
