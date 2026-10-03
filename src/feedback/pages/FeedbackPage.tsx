import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, MessageSquareText, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'
import { Field, Select, Textarea } from '@/shared/ui/Field'
import { SECTIONS, SectionId } from '@/shared/sections'
import { useFeedbackStore } from '../store'

const MAX_SCREENSHOTS = 5

/** Разделы на выбор в заявке — все пункты меню, кроме администраторских и самих «Моих заявок». */
const SELECTABLE_SECTIONS = SECTIONS.filter((s) => !s.adminOnly && s.id !== 'feedback_my')

/**
 * Страница «Пожелания и предложения» (0075-b). Доступна любому вошедшему:
 * текст, раздел, скриншоты. Лог сессии прикладывается автоматически — см.
 * `shared/lib/clientLog`.
 */
export function FeedbackPage() {
  const location = useLocation()
  const fromSection = (location.state as { section?: SectionId } | null)?.section
  const submit = useFeedbackStore((s) => s.submit)

  const [text, setText] = useState('')
  // Раздел текущего экрана как подсказка; администраторские экраны
  // («Доступ», сами «Заявки») в списке не предлагаются — берём первый обычный.
  const [section, setSection] = useState<string>(
    SELECTABLE_SECTIONS.some((s) => s.id === fromSection) ? (fromSection as string) : SELECTABLE_SECTIONS[0].id,
  )
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files])
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews])

  function addFiles(selected: FileList | null) {
    if (!selected) return
    const picked = Array.from(selected)
    const images = picked.filter((f) => f.type.startsWith('image/'))
    if (images.length < picked.length) {
      setError('К заявке прикладываются только изображения — остальные файлы не добавлены.')
    } else {
      setError(null)
    }
    setFiles((prev) => {
      const next = [...prev, ...images]
      if (next.length > MAX_SCREENSHOTS) {
        setError(`Можно приложить не больше ${MAX_SCREENSHOTS} скриншотов.`)
        return next.slice(0, MAX_SCREENSHOTS)
      }
      return next
    })
    if (fileInput.current) fileInput.current.value = ''
  }

  async function handleSubmit() {
    if (!text.trim()) return
    setSending(true)
    setError(null)
    setNotice(null)
    try {
      await submit({ text: text.trim(), section, screenshots: files })
      setText('')
      setFiles([])
      setNotice('Заявка отправлена. Статус, ответы администратора и изменения по ней — в разделе «Мои заявки».')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить заявку')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[20px] font-medium text-ink">Пожелания и предложения</h1>
      <p className="mt-1 text-[13px] text-muted">
        Опишите проблему или идею по работе системы. К заявке автоматически прикладывается лог вашей
        текущей сессии — переходы по экранам и ошибки, которые видел браузер.
      </p>

      <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <Field label="Что не так или что предлагаете" required>
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Например: на складе не сохраняется фильтр по складу при переходе в карточку материала"
          />
        </Field>

        <Field label="Раздел системы" required>
          <Select value={section} onChange={(e) => setSection(e.target.value)}>
            {SELECTABLE_SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Скриншоты" hint={`До ${MAX_SCREENSHOTS} изображений`}>
          <div className="flex flex-col gap-3">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => fileInput.current?.click()}
              disabled={files.length >= MAX_SCREENSHOTS}
            >
              <ImagePlus size={15} />
              Добавить скриншот
            </Button>
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {previews.map(({ file, url }, index) => (
                  <div key={`${file.name}-${index}`} className="relative">
                    <img
                      src={url}
                      alt={file.name}
                      className="h-24 w-32 rounded-md border border-border object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Убрать ${file.name}`}
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                      className="absolute -right-2 -top-2 rounded-pill border border-border bg-surface p-1 text-ink hover:border-danger/50"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>

        {error && <p className="text-[13px] text-danger">{error}</p>}
        {notice && (
          <p className="rounded-md bg-success-bg p-2.5 text-[13px] text-success">
            {notice}{' '}
            <Link to="/feedback/my" className="font-medium underline">
              Открыть «Мои заявки»
            </Link>
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={!text.trim() || sending}>
            {sending ? 'Отправка…' : 'Отправить заявку'}
          </Button>
        </div>
      </div>

      <Link
        to="/feedback/my"
        className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
      >
        <MessageSquareText size={14} />
        Мои заявки — статус и ответы по отправленным
      </Link>
    </div>
  )
}
