import { useEffect, useMemo, useState } from 'react'
import { Download, FileClock, Paperclip } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { SECTIONS } from '@/shared/sections'
import { AttachmentImage } from '../components/AttachmentImage'
import { fetchAttachment } from '../api'
import { useFeedbackStore } from '../store'
import { FEEDBACK_STATUS_LABEL, FeedbackRequest, FeedbackStatus } from '../types'

type Filter = FeedbackStatus | 'open' | 'all'

const FILTERS: [Filter, string][] = [
  ['open', 'Открытые'],
  ['all', 'Все'],
  ['new', FEEDBACK_STATUS_LABEL.new],
  ['in_progress', FEEDBACK_STATUS_LABEL.in_progress],
  ['done', FEEDBACK_STATUS_LABEL.done],
  ['rejected', FEEDBACK_STATUS_LABEL.rejected],
]

/** Раздел «Заявки» — все пожелания и предложения сотрудников (0075-c). */
export function FeedbackAdminPage() {
  const requests = useFeedbackStore((s) => s.requests)
  const load = useFeedbackStore((s) => s.load)
  const setStatus = useFeedbackStore((s) => s.setStatus)
  const [filter, setFilter] = useState<Filter>('open')
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить заявки'))
  }, [load])

  const visible = useMemo(
    () =>
      requests.filter((r) => {
        if (filter === 'all') return true
        if (filter === 'open') return r.status === 'new' || r.status === 'in_progress'
        return r.status === filter
      }),
    [requests, filter],
  )
  const newCount = requests.filter((r) => r.status === 'new').length

  async function download(request: FeedbackRequest, fileId: number, filename: string) {
    setError(null)
    try {
      const blob = await fetchAttachment(request.id, fileId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось скачать файл')
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Заявки</h1>
          <p className="mt-1 text-[13px] text-muted">
            Пожелания и предложения сотрудников по работе системы. Новых: {newCount}.
          </p>
        </div>
        <Select
          aria-label="Фильтр по статусу"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="w-52 self-start"
        >
          {FILTERS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {error && <p className="mb-4 text-[13px] text-danger">{error}</p>}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-5 text-[13px] text-muted">
          Заявок в этом фильтре нет.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((request) => {
            const screenshots = request.attachments.filter((a) => a.kind === 'screenshot')
            const log = request.attachments.find((a) => a.kind === 'log')
            return (
              <li key={request.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-medium text-ink">{request.author.full_name}</p>
                    <p className="text-[12px] text-muted">
                      {request.author.email} · {new Date(request.created_at).toLocaleString('ru-RU')} ·{' '}
                      {SECTIONS.find((s) => s.id === request.section)?.label ?? request.section}
                    </p>
                  </div>
                  <Select
                    aria-label={`Статус заявки №${request.id}`}
                    value={request.status}
                    onChange={(e) =>
                      setStatus(request.id, e.target.value as FeedbackStatus).catch((err) =>
                        setError(err instanceof Error ? err.message : 'Не удалось сменить статус'),
                      )
                    }
                    className="w-44"
                  >
                    {(Object.keys(FEEDBACK_STATUS_LABEL) as FeedbackStatus[]).map((value) => (
                      <option key={value} value={value}>
                        {FEEDBACK_STATUS_LABEL[value]}
                      </option>
                    ))}
                  </Select>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-[13px] text-ink">{request.text}</p>

                {screenshots.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-4">
                    {screenshots.map((attachment) => (
                      <div key={attachment.id} className="flex flex-col gap-1.5">
                        <AttachmentImage
                          requestId={request.id}
                          fileId={attachment.file_id}
                          alt={attachment.filename}
                          onOpen={setZoom}
                        />
                        <button
                          type="button"
                          onClick={() => download(request, attachment.file_id, attachment.filename)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-pill border border-border px-2.5 py-1 text-[12px] text-ink hover:border-brand/40"
                        >
                          <Download size={12} />
                          Скачать
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!log}
                    onClick={() => log && download(request, log.file_id, log.filename)}
                  >
                    <FileClock size={14} />
                    Скачать логи пользователя
                  </Button>
                  {!log && <span className="text-[12px] text-muted">Логи не приложены</span>}
                  {screenshots.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                      <Paperclip size={12} />
                      Скриншотов: {screenshots.length}
                    </span>
                  )}
                </div>
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
