import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Sparkles } from 'lucide-react'
import { apiRequest } from '@/shared/lib/httpClient'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { useAiStore } from '@/ai/store'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { Drawer } from '@/shared/ui/Drawer'
import { Modal } from '@/shared/ui/Modal'
import { Field, Input, Select } from '@/shared/ui/Field'
import { Entry } from './api'

type Signal = {
  entry_id: number
  kind: string
  name: string
  reason: string
  title: string
  due_at: string | null
}
type Report = {
  total: number
  counts: Record<string, number>
  items: Signal[]
  settings: { response_hours: number; idle_days: number }
}
const empty: Report = { total: 0, counts: {}, items: [], settings: { response_hours: 24, idle_days: 3 } }
export function LeadControl({
  revision,
  canEdit,
  canFull,
  onOpen,
  onTask,
}: {
  revision: number
  canEdit: boolean
  canFull: boolean
  onOpen: (entry: Entry) => void
  onTask: (entry: Entry) => void
}) {
  const navigate = useNavigate()
  const ai = useAccessLevel('ai')
  const [report, setReport] = useState<Report>(empty)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false),
    [offset, setOffset] = useState(0),
    [error, setError] = useState('')
  const [config, setConfig] = useState<Report['settings'] | null>(null),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0)
  useEffect(() => {
    let current = true
    setLoading(true)
    setError('')
    apiRequest<Report>({ section: 'crm', path: '/attention', query: { offset, reason: reason || undefined } })
      .then((r) => {
        if (current) setReport(r)
      })
      .catch((e) => {
        if (current) setError(e.message)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [revision, offset, version, reason])
  const entry = async (signal: Signal, task = false) => {
    try {
      const row = await apiRequest<Entry>({ section: 'crm', path: `/entries/${signal.entry_id}` })
      setOpen(false)
      if (task) onTask(row)
      else onOpen(row)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const discuss = () => {
    useAiStore.getState().startDraft('clients')
    navigate('/ai', {
      state: {
        draftMessage:
          'Проверь контроль лидов в наших продажах: входящие, просроченные задачи, сделки без следующего шага и ответственного. Расставь приоритеты и предложи конкретные следующие действия со ссылками на карточки.',
      },
    })
  }
  const save = async () => {
    if (!config) return
    setBusy(true)
    try {
      await apiRequest({ section: 'crm', path: '/settings', method: 'PUT', body: config })
      setConfig(null)
      setVersion((v) => v + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="mb-5 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-medium">
              <ShieldCheck size={18} />
              Контроль лидов
            </h2>
            <p className="mt-1 text-xs text-muted">
              {loading
                ? 'Проверяем актуальные данные…'
                : error
                  ? 'Данные контроля требуют обновления'
                  : `Первый шаг — в течение ${report.settings.response_hours} ч. Контроль отсутствия активности — ${report.settings.idle_days} дн.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={loading}
              onClick={() => {
                setOffset(0)
                setReason('')
                setVersion((v) => v + 1)
                setOpen(true)
              }}
            >
              {loading ? 'Проверяем…' : error ? 'Повторить проверку' : `Требует внимания · ${report.total}`}
            </Button>
            {accessLevelAtLeast(ai, 'view') && (
              <Button size="sm" variant="secondary" onClick={discuss}>
                <Sparkles size={14} />
                Разобрать с Мариной
              </Button>
            )}
          </div>
        </div>
        {!loading && !error && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span>
              Входящие: <b>{report.counts.inquiry || 0}</b>
            </span>
            <span>
              Просроченные задачи: <b>{report.counts.overdue || 0}</b>
            </span>
            <span>
              Без следующего шага: <b>{report.counts.no_next_step || 0}</b>
            </span>
            <span>
              Без ответственного: <b>{report.counts.no_owner || 0}</b>
            </span>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Контроль лидов"
        subtitle="Причины внимания по данным продаж"
      >
        <div className="space-y-4 text-sm">
          <p className="text-muted">
            Новые заявки сайта и новые сделки получают контрольную задачу. После принятия заявки задача
            остаётся связанной со сделкой до выполнения первого контакта. Для старых сделок следующий шаг
            можно назначить здесь.
          </p>
          {canFull && (
            <Button
              size="sm"
              variant="secondary"
              disabled={loading || !!error}
              onClick={() => setConfig({ ...report.settings })}
            >
              Настроить контроль
            </Button>
          )}
          <Select
            aria-label="Причина внимания"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setOffset(0)
            }}
          >
            <option value="">Все причины</option>
            <option value="inquiry">Входящие обращения</option>
            <option value="overdue">Просроченные задачи</option>
            <option value="no_next_step">Без следующего шага</option>
            <option value="no_deadline">Без срока</option>
            <option value="no_owner">Без ответственного</option>
            <option value="idle">Нет активности</option>
          </Select>
          <DataTable
            loading={loading}
            rows={report.items}
            keyOf={(r) => r.entry_id + '/' + r.reason}
            onRowClick={(r) => entry(r)}
            columns={[
              { header: 'Лид / задача', accessor: (r) => r.name },
              {
                header: 'Что требует внимания',
                accessor: (r) => (
                  <div>
                    <p>{r.title}</p>
                    {r.due_at && (
                      <p className="text-xs text-muted">{new Date(r.due_at).toLocaleString('ru-RU')}</p>
                    )}
                  </div>
                ),
              },
              {
                header: 'Действие',
                accessor: (r) =>
                  canEdit && r.kind === 'deal' && r.reason === 'no_next_step' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation()
                        entry(r, true)
                      }}
                    >
                      Назначить шаг
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation()
                        entry(r)
                      }}
                    >
                      {r.kind === 'inquiry' ? 'Обработать' : 'Открыть'}
                    </Button>
                  ),
              },
            ]}
          />
          <div className="flex justify-between gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!offset}
              onClick={() => setOffset((v) => Math.max(0, v - 50))}
            >
              Назад
            </Button>
            <span>
              {report.total ? offset + 1 : 0}–{Math.min(offset + 50, report.total)} из {report.total}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={offset + 50 >= report.total}
              onClick={() => setOffset((v) => v + 50)}
            >
              Далее
            </Button>
          </div>
        </div>
      </Drawer>
      <Modal
        open={!!config}
        onClose={() => setConfig(null)}
        title="Контроль новых лидов"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfig(null)}>
              Отмена
            </Button>
            <Button disabled={busy} onClick={save}>
              Сохранить правила
            </Button>
          </>
        }
      >
        {config && (
          <div className="space-y-4 text-sm">
            <Field label="Первый шаг, часов">
              <Input
                aria-label="Срок первого шага"
                type="number"
                min="1"
                max="168"
                value={config.response_hours}
                onChange={(e) => setConfig({ ...config, response_hours: Number(e.target.value) })}
              />
            </Field>
            <Field label="Нет активности, дней">
              <Input
                aria-label="Дней без активности"
                type="number"
                min="1"
                max="90"
                value={config.idle_days}
                onChange={(e) => setConfig({ ...config, idle_days: Number(e.target.value) })}
              />
            </Field>
            <p className="text-muted">
              Правило срока применяется к новым контрольным задачам. Сроки уже назначенных задач сохраняются.
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
