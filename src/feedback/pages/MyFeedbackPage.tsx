import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Lightbulb, Paperclip } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { Modal } from '@/shared/ui/Modal'
import { SECTIONS } from '@/shared/sections'
import { AttachmentImage } from '../components/AttachmentImage'
import { FeedbackTimeline } from '../components/FeedbackTimeline'
import { useFeedbackStore } from '../store'
import { FEEDBACK_STATUS_LABEL, FEEDBACK_STATUS_TONE, FeedbackRequest } from '../types'

function updatesLabel(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} новое обновление`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} новых обновления`
  return `${n} новых обновлений`
}

/**
 * «Мои заявки» (0090): свои пожелания и предложения — статус, комментарии
 * администратора и изменения в системе по каждой. Раскрытие заявки помечает
 * её обновления прочитанными.
 */
export function MyFeedbackPage() {
  const navigate = useNavigate()
  const requests = useFeedbackStore((s) => s.mine)
  const loadMine = useFeedbackStore((s) => s.loadMine)
  const markSeen = useFeedbackStore((s) => s.markSeen)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // id раскрытой заявки → сколько записей подсветить: счётчик фиксируем в
  // момент раскрытия, иначе после отметки прочтения подсветка сразу пропадёт.
  const [open, setOpen] = useState<Record<number, number>>({})
  const [zoom, setZoom] = useState<string | null>(null)

  useEffect(() => {
    loadMine()
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить заявки'))
      .finally(() => setLoaded(true))
  }, [loadMine])

  function toggle(request: FeedbackRequest) {
    if (request.id in open) {
      setOpen(({ [request.id]: _, ...rest }) => rest)
      return
    }
    setOpen((prev) => ({ ...prev, [request.id]: request.unseen_updates }))
    if (request.unseen_updates > 0) {
      markSeen(request.id).catch((e) => setError(e instanceof Error ? e.message : 'Не удалось отметить прочитанной'))
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Мои заявки</h1>
          <p className="mt-1 text-[13px] text-muted">
            Ваши пожелания и предложения: статус, комментарии администратора и что изменилось в системе по
            каждой.
          </p>
        </div>
        <Button size="sm" className="shrink-0 self-start whitespace-nowrap" onClick={() => navigate('/feedback')}>
          <Lightbulb size={14} />
          Новая заявка
        </Button>
      </div>

      {error && <p className="mb-4 text-[13px] text-danger">{error}</p>}

      {loaded && requests.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-5 text-[13px] text-muted">
          Заявок пока нет. Напишите о проблеме или идее через кнопку «Пожелания» в верхней строке.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => {
            const expanded = request.id in open
            const screenshots = request.attachments.filter((a) => a.kind === 'screenshot')
            const lastNote = [...request.events].reverse().find((e) => e.kind !== 'status')
            return (
              <li
                key={request.id}
                className={`rounded-2xl border bg-surface ${request.unseen_updates > 0 ? 'border-brand/50' : 'border-border'}`}
              >
                <button
                  type="button"
                  onClick={() => toggle(request)}
                  aria-expanded={expanded}
                  className="flex w-full items-start gap-3 p-4 text-left"
                >
                  {expanded ? (
                    <ChevronDown size={16} className="mt-0.5 shrink-0 text-muted" />
                  ) : (
                    <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                      <Chip tone={FEEDBACK_STATUS_TONE[request.status]}>{FEEDBACK_STATUS_LABEL[request.status]}</Chip>
                      <span>{new Date(request.created_at).toLocaleString('ru-RU')}</span>
                      <span>·</span>
                      <span>{SECTIONS.find((s) => s.id === request.section)?.label ?? request.section}</span>
                      {screenshots.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip size={12} />
                          {screenshots.length}
                        </span>
                      )}
                      {request.unseen_updates > 0 && (
                        <span className="rounded-pill bg-brand px-2 py-0.5 text-[12px] font-medium text-white">
                          {updatesLabel(request.unseen_updates)}
                        </span>
                      )}
                    </div>
                    <p className={`mt-2 whitespace-pre-wrap text-[13px] text-ink ${expanded ? '' : 'line-clamp-3'}`}>
                      {request.text}
                    </p>
                    {!expanded && lastNote && (
                      <p className="mt-2 line-clamp-2 text-[12px] text-muted">
                        {lastNote.kind === 'change' ? 'Изменение в системе' : lastNote.author.full_name}:{' '}
                        {lastNote.text}
                      </p>
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 sm:pl-11">
                    {screenshots.length > 0 && (
                      <div className="mb-4 flex flex-wrap gap-3">
                        {screenshots.map((a) => (
                          <AttachmentImage
                            key={a.id}
                            requestId={request.id}
                            fileId={a.file_id}
                            alt={a.filename}
                            onOpen={setZoom}
                          />
                        ))}
                      </div>
                    )}
                    <FeedbackTimeline request={request} highlightNew={open[request.id]} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={zoom !== null} onClose={() => setZoom(null)} title="Скриншот">
        {zoom && <img src={zoom} alt="Скриншот заявки" className="max-h-[70vh] w-full object-contain" />}
      </Modal>
    </div>
  )
}
