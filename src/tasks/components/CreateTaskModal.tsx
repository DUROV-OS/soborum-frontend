import { useState } from 'react'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { useTasksStore } from '../store'
import { Task } from '../types'

export function CreateTaskModal({
  open,
  onClose,
  blockId,
}: {
  open: boolean
  onClose: () => void
  /** Если задача создаётся из блока производства — привязывает её к нему. */
  blockId?: number
}) {
  const accounts = useAuthStore((s) => s.accounts)
  const tasks = useTasksStore((s) => s.tasks)
  const create = useTasksStore((s) => s.create)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<number[]>([])
  const [reviewerIds, setReviewerIds] = useState<number[]>([])
  const [dependsOn, setDependsOn] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = title.trim().length > 0

  function reset() {
    setTitle('')
    setDescription('')
    setDeadline('')
    setAssigneeIds([])
    setReviewerIds([])
    setDependsOn([])
    setError(null)
  }

  function toggle(list: number[], id: number, setter: (v: number[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  async function handleSubmit() {
    if (!valid) return
    setSaving(true)
    const result = await create({
      title,
      description: description || undefined,
      deadline: deadline || undefined,
      assignee_ids: assigneeIds,
      reviewer_ids: reviewerIds,
      depends_on_ids: dependsOn,
      block_id: blockId,
    })
    setSaving(false)
    if (result.ok) {
      reset()
      onClose()
    } else {
      setError(result.reason ?? 'Не удалось создать задачу')
    }
  }

  const openDependencyOptions: Task[] = tasks.filter((t) => t.status !== 'done')

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Новая задача"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || saving}>
            {saving ? 'Сохранение…' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Название" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: подготовить смету" />
        </Field>
        <Field label="Описание">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Дедлайн">
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>

        {accounts.length === 0 ? (
          <p className="text-[12px] text-muted">
            Список сотрудников доступен только администратору — войдите под администратором, чтобы
            назначить конкретных исполнителей, либо создайте задачу без них.
          </p>
        ) : (
          <>
            <Field label="Исполнители" hint="Любой из них может взять задачу в работу">
              <div className="flex flex-col gap-1.5">
                {accounts.map((account) => (
                  <label key={account.id} className="flex items-center gap-2 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      checked={assigneeIds.includes(account.id)}
                      onChange={() => toggle(assigneeIds, account.id, setAssigneeIds)}
                      className="h-4 w-4 accent-[#395b4b]"
                    />
                    {account.full_name}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Проверяющие" hint="Необязательно — без проверяющего задача завершается автоматически">
              <div className="flex flex-col gap-1.5">
                {accounts.map((account) => (
                  <label key={account.id} className="flex items-center gap-2 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      checked={reviewerIds.includes(account.id)}
                      onChange={() => toggle(reviewerIds, account.id, setReviewerIds)}
                      className="h-4 w-4 accent-[#395b4b]"
                    />
                    {account.full_name}
                  </label>
                ))}
              </div>
            </Field>
          </>
        )}

        {openDependencyOptions.length > 0 && (
          <Field label="Зависит от" hint="Задача станет доступна после выполнения выбранных">
            <div className="flex flex-col gap-1.5">
              {openDependencyOptions.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={dependsOn.includes(t.id)}
                    onChange={() => toggle(dependsOn, t.id, setDependsOn)}
                    className="h-4 w-4 accent-[#395b4b]"
                  />
                  {t.title}
                </label>
              ))}
            </div>
          </Field>
        )}
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
