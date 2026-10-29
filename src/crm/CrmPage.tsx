import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users, Archive, Pencil, Download } from 'lucide-react'
import { apiRequest, downloadFile } from '@/shared/lib/httpClient'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { Input, Select, Textarea, Field } from '@/shared/ui/Field'
import { DataTable } from '@/shared/ui/DataTable'
import { Drawer } from '@/shared/ui/Drawer'
import { Modal } from '@/shared/ui/Modal'
import { Tabs } from '@/shared/ui/Tabs'
import * as api from './api'
import { Catalog, Entry, Kind, History } from './api'

const labels: Record<Kind, string> = {
  deal: 'Сделки',
  contact: 'Контакты',
  company: 'Компании',
  task: 'Задачи',
  pipeline: 'Воронки',
  stage: 'Этапы',
  inquiry: 'Входящие',
}
const single: Record<Kind, string> = {
  deal: 'Сделка',
  contact: 'Контакт',
  company: 'Компания',
  task: 'Задача',
  pipeline: 'Воронка',
  stage: 'Этап',
  inquiry: 'Входящая заявка',
}
const money = (n: unknown) => Number(n ?? 0).toLocaleString('ru-RU') + ' ₽'
const localTime = (s: unknown) => {
  if (!s) return ''
  const d = new Date(String(s))
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const date = (s: unknown) => (s ? new Date(String(s)).toLocaleString('ru-RU') : 'Срок не указан')
const tabs: { key: Kind; label: string }[] = ['inquiry', 'deal', 'contact', 'company', 'task'].map((k) => ({
  key: k as Kind,
  label: labels[k as Kind],
}))

export function CrmPage() {
  const [catalog, setCatalog] = useState<Catalog>({ pipelines: [], stages: [], users: [], counts: {} })
  const [kind, setKind] = useState<Kind>('deal')
  const [pipeline, setPipeline] = useState('')
  const [stage, setStage] = useState('')
  const [archive, setArchive] = useState('active')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState<{ total: number; items: Entry[] }>({ total: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Entry | null>(null)
  const [history, setHistory] = useState<History>({ total: 0, items: [] })
  const [note, setNote] = useState('')
  const [attached, setAttached] = useState<{ total: number; items: SourceFile[] }>({ total: 0, items: [] })
  const [editing, setEditing] = useState<{ entry?: Entry; kind: Kind; inquiry?: Entry } | null>(null)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [fileLibrary, setFileLibrary] = useState(false)
  const level = useAccessLevel('clients')
  const canEdit = accessLevelAtLeast(level, 'edit')
  const canFull = accessLevelAtLeast(level, 'full')
  useEffect(() => {
    api
      .catalog()
      .then(setCatalog)
      .catch((e) => setError(e.message))
  }, [revision])
  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      setLoading(true)
      api
        .list(kind, {
          query,
          archive,
          pipeline_id: kind === 'deal' && pipeline ? Number(pipeline) : undefined,
          stage_id: kind === 'deal' && stage ? Number(stage) : undefined,
          offset,
        })
        .then((r) => {
          if (current) setResult(r)
        })
        .catch((e) => {
          if (current) setError(e.message)
        })
        .finally(() => {
          if (current) setLoading(false)
        })
    }, 200)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [kind, query, archive, pipeline, stage, offset, revision])
  const refreshHistory = (entry: Entry, offset = 0) =>
    api
      .history(entry.id, offset)
      .then((h) =>
        setHistory((prev) => (offset ? { total: h.total, items: [...prev.items, ...h.items] } : h)),
      )
      .catch((e) => setError(e.message))
  const open = (entry: Entry) => {
    setSelected(entry)
    setHistory({ total: 0, items: [] })
    setAttached({ total: 0, items: [] })
    setNote('')
    refreshHistory(entry)
    apiRequest<{ total: number; items: SourceFile[] }>({ section: 'crm', path: `/entries/${entry.id}/files` })
      .then(setAttached)
      .catch((e) => setError(e.message))
  }
  const update = async (entry: Entry, fields: Parameters<typeof api.patch>[1]) => {
    setBusy(true)
    setError('')
    try {
      const next = await api.patch(entry, fields)
      setSelected(next)
      setRevision((v) => v + 1)
      refreshHistory(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }
  const selectedStage = catalog.stages.find((s) => s.id === selected?.data.stage_id)
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink">Продажи</h1>
          <p className="mt-1 text-[13px] text-muted">
            Воронки, сделки, контакты и последующие действия — в Соборуме.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setFileLibrary(true)}>
            Файлы
          </Button>
          {canFull && (
            <Button
              variant="secondary"
              onClick={() => {
                setKind('pipeline')
                setOffset(0)
              }}
            >
              Воронки и этапы
            </Button>
          )}
          {canEdit && kind !== 'inquiry' && (
            <Button onClick={() => setEditing({ kind })}>
              <Plus size={16} />
              {single[kind]}
            </Button>
          )}
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setKind(t.key)
              setOffset(0)
            }}
            className="rounded-xl border border-border bg-surface p-4 text-left hover:border-brand/40"
          >
            <p className="text-xs text-muted">{t.label}</p>
            <p className="mt-1 text-xl font-medium">{(catalog.counts[t.key] ?? 0).toLocaleString('ru-RU')}</p>
          </button>
        ))}
      </div>
      <Tabs
        tabs={
          canFull ? [...tabs, { key: 'pipeline', label: 'Воронки' }, { key: 'stage', label: 'Этапы' }] : tabs
        }
        activeKey={kind}
        onChange={(k) => {
          setKind(k)
          setOffset(0)
          setStage('')
        }}
      />
      <div className="my-4 flex flex-wrap gap-2">
        <Input
          aria-label="Поиск в продажах"
          className="min-w-48 flex-1"
          placeholder="Название, телефон, почта…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOffset(0)
          }}
        />
        {kind === 'deal' && (
          <>
            <Select
              aria-label="Воронка"
              className="sm:max-w-64"
              value={pipeline}
              onChange={(e) => {
                setPipeline(e.target.value)
                setStage('')
                setOffset(0)
              }}
            >
              <option value="">Все воронки</option>
              {catalog.pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Этап"
              className="sm:max-w-64"
              value={stage}
              onChange={(e) => {
                setStage(e.target.value)
                setOffset(0)
              }}
            >
              <option value="">Все этапы</option>
              {catalog.stages
                .filter((s) => !pipeline || s.data.pipeline_id === Number(pipeline))
                .sort((a, b) => Number(a.data.sort) - Number(b.data.sort))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </>
        )}
        <Select
          aria-label="Архив продаж"
          className="sm:max-w-44"
          value={archive}
          onChange={(e) => {
            setArchive(e.target.value)
            setOffset(0)
          }}
        >
          <option value="active">Действующие</option>
          <option value="archived">Архив</option>
          <option value="all">Все записи</option>
        </Select>
      </div>
      {error && (
        <p role="alert" className="my-3 text-danger">
          {error}
        </p>
      )}
      <DataTable<Entry>
        rows={result.items}
        loading={loading}
        keyOf={(r) => String(r.id)}
        onRowClick={open}
        columns={[
          {
            header: 'Название',
            accessor: (r) => (
              <div className="font-medium">
                {r.name}
                {r.archived && <span className="ml-2 text-xs text-muted">Архив</span>}
              </div>
            ),
          },
          {
            header: kind === 'deal' ? 'Этап' : 'Контакт / срок',
            accessor: (r) =>
              kind === 'deal' ? (
                <Chip tone="neutral">
                  {catalog.stages.find((s) => s.id === r.data.stage_id)?.name ?? '—'}
                </Chip>
              ) : kind === 'task' ? (
                <span
                  className={
                    !r.data.completed && r.data.due_at && new Date(String(r.data.due_at)) < new Date()
                      ? 'text-danger'
                      : ''
                  }
                >
                  {date(r.data.due_at)}
                </span>
              ) : (
                String(r.data.phone || r.data.email || '—')
              ),
          },
          {
            header: kind === 'deal' ? 'Бюджет' : 'Статус',
            accessor: (r) =>
              kind === 'deal' ? (
                money(r.data.amount)
              ) : kind === 'task' ? (
                <Chip tone={r.data.completed ? 'success' : 'neutral'}>
                  {r.data.completed ? 'Выполнена' : 'Открыта'}
                </Chip>
              ) : r.archived ? (
                'В архиве'
              ) : (
                'Действует'
              ),
          },
          {
            header: 'Ответственный',
            accessor: (r) =>
              catalog.users.find((u) => u.id === r.data.responsible_user_id)?.name ?? 'Не назначен',
          },
        ]}
      />
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted">
          {result.total ? offset + 1 : 0}–{Math.min(offset + 50, result.total)} из{' '}
          {result.total.toLocaleString('ru-RU')}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={!offset || loading}
            onClick={() => setOffset((v) => Math.max(0, v - 50))}
          >
            Назад
          </Button>
          <Button
            variant="secondary"
            disabled={offset + 50 >= result.total || loading}
            onClick={() => setOffset((v) => v + 50)}
          >
            Далее
          </Button>
        </div>
      </div>
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected?.archived ? 'Архивная запись' : selectedStage?.name}
      >
        {selected && (
          <div className="space-y-5 text-[13px]">
            <div className="flex flex-wrap gap-2">
              {!!selected.data.client_id && (
                <Link
                  to={`/clients/${selected.data.client_id}`}
                  className="inline-flex items-center rounded-full border border-border px-3 py-2 font-medium text-accent"
                >
                  Карточка клиента
                </Link>
              )}
              {canEdit && selected.kind !== 'inquiry' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditing({ entry: selected, kind: selected.kind })}
                >
                  <Pencil size={14} />
                  Редактировать
                </Button>
              )}
              {canEdit && selected.kind === 'inquiry' && !selected.archived && (
                <Button size="sm" onClick={() => setEditing({ kind: 'deal', inquiry: selected })}>
                  Принять в работу
                </Button>
              )}
              {canFull && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => update(selected, { archived: !selected.archived })}
                >
                  <Archive size={14} />
                  {selected.archived ? 'Вернуть из архива' : 'В архив'}
                </Button>
              )}
              {canEdit && selected.kind === 'task' && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => update(selected, { data: { completed: !selected.data.completed } })}
                >
                  {selected.data.completed ? 'Открыть заново' : 'Выполнить задачу'}
                </Button>
              )}
            </div>
            {selected.kind === 'deal' && (
              <div className="rounded-xl bg-surface-muted p-4">
                <p className="text-lg font-medium">{money(selected.data.amount)}</p>
                <p className="mt-1 text-muted">
                  {catalog.pipelines.find((p) => p.id === selected.data.pipeline_id)?.name} ·{' '}
                  {selectedStage?.name}
                </p>
                {selected.data.loss_reason ? (
                  <p className="mt-2">Причина отказа: {String(selected.data.loss_reason)}</p>
                ) : null}
              </div>
            )}
            {['contact', 'company', 'inquiry'].includes(selected.kind) && (
              <div className="space-y-2">
                <p>Телефон: {String(selected.data.phone || '—')}</p>
                <p>Почта: {String(selected.data.email || '—')}</p>
              </div>
            )}
            {selected.kind === 'task' && (
              <div>
                <p>{date(selected.data.due_at)}</p>
                <p className="mt-2 whitespace-pre-wrap">{String(selected.data.result || '')}</p>
              </div>
            )}
            {canEdit && (
              <div>
                <h3 className="mb-2 font-medium">Добавить заметку</h3>
                <Textarea
                  aria-label="Текст заметки"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Результат разговора, договорённость, следующий шаг…"
                  rows={3}
                />
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={busy || !note.trim()}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await api.note(selected.id, note)
                      setNote('')
                      refreshHistory(selected)
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Ошибка')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Сохранить заметку
                </Button>
              </div>
            )}
            <div>
              <h3 className="mb-2 font-medium">Файлы · {attached.total}</h3>
              {attached.items.map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant="secondary"
                  className="mb-2 mr-2"
                  onClick={() =>
                    downloadFile('crm', `/files/${f.id}/download`, f.name).catch((e) => setError(e.message))
                  }
                >
                  <Download size={14} />
                  {f.name}
                </Button>
              ))}
            </div>
            <div>
              <h3 className="mb-3 font-medium">История · {history.total}</h3>
              <div className="space-y-3">
                {history.items.map((h) => (
                  <div key={h.id} className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-xs text-muted">
                      {date(h.created_at)} · {h.source === 'soborum' ? 'Соборум' : 'История amoCRM'}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{h.text}</p>
                  </div>
                ))}
              </div>
              {history.items.length < history.total && (
                <Button
                  className="mt-3"
                  variant="secondary"
                  onClick={() => refreshHistory(selected, history.items.length)}
                >
                  Ещё записи
                </Button>
              )}
            </div>
            {!!(selected.data.custom_fields as unknown[] | undefined)?.length && (
              <details>
                <summary className="cursor-pointer text-muted">Дополнительные поля</summary>
                <div className="mt-2 space-y-2">
                  {(
                    selected.data.custom_fields as { field_name?: string; values?: { value: unknown }[] }[]
                  ).map((f, i) => (
                    <p key={i}>
                      <span className="text-muted">{f.field_name}: </span>
                      {f.values?.map((v) => String(v.value)).join(', ')}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </Drawer>
      {fileLibrary && <FilesLibrary onClose={() => setFileLibrary(false)} />}
      {editing && (
        <Editor
          kind={editing.kind}
          entry={editing.entry}
          inquiry={editing.inquiry}
          catalog={catalog}
          onClose={() => setEditing(null)}
          onSaved={(entry) => {
            setEditing(null)
            setRevision((v) => v + 1)
            open(entry)
          }}
        />
      )}
    </div>
  )
}

function Editor({
  kind,
  entry,
  inquiry,
  catalog,
  onClose,
  onSaved,
}: {
  kind: Kind
  entry?: Entry
  inquiry?: Entry
  catalog: Catalog
  onClose: () => void
  onSaved: (entry: Entry) => void
}) {
  const [name, setName] = useState(entry?.name ?? inquiry?.name ?? '')
  const first = catalog.pipelines[0]?.id
  const [data, setData] = useState<Record<string, unknown>>(
    entry?.data ??
      (kind === 'deal'
        ? {
            pipeline_id: first,
            stage_id: catalog.stages.find((s) => s.data.pipeline_id === first && s.data.outcome === 'open')
              ?.id,
            amount: 0,
            currency: 'RUB',
          }
        : kind === 'stage'
          ? { pipeline_id: first, outcome: 'open', color: '#dbeafe', sort: 0 }
          : {}),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [contactQuery, setContactQuery] = useState('')
  const [contacts, setContacts] = useState<Entry[]>([])
  const put = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }))
  useEffect(() => {
    if (kind !== 'deal' || !contactQuery.trim()) {
      setContacts([])
      return
    }
    let current = true
    const timer = setTimeout(
      () =>
        api.list('contact', { query: contactQuery, limit: 20 }).then((r) => {
          if (current) setContacts(r.items)
        }),
      250,
    )
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [contactQuery, kind])
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      onSaved(
        inquiry
          ? await api.accept(inquiry.id, name, data)
          : entry
            ? await api.patch(entry, { name, data })
            : await api.create(kind, name, data),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`${entry ? 'Изменить' : 'Создать'} · ${single[kind]}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={busy || !name.trim()} onClick={save}>
            {busy ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Название" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {['contact', 'company'].includes(kind) && (
          <>
            <Field label="Телефон">
              <Input value={String(data.phone ?? '')} onChange={(e) => put('phone', e.target.value)} />
            </Field>
            <Field label="Почта">
              <Input
                type="email"
                value={String(data.email ?? '')}
                onChange={(e) => put('email', e.target.value)}
              />
            </Field>
          </>
        )}
        {['deal', 'stage'].includes(kind) && (
          <Field label="Воронка" required>
            <Select
              value={String(data.pipeline_id ?? '')}
              onChange={(e) => {
                const pid = Number(e.target.value)
                setData((d) => ({
                  ...d,
                  pipeline_id: pid,
                  ...(kind === 'deal'
                    ? {
                        stage_id: catalog.stages.find(
                          (s) => s.data.pipeline_id === pid && s.data.outcome === 'open',
                        )?.id,
                      }
                    : {}),
                }))
              }}
            >
              <option value="" disabled>
                Выберите воронку
              </option>
              {catalog.pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {kind === 'deal' && (
          <>
            <Field label="Этап" required>
              <Select
                value={String(data.stage_id ?? '')}
                onChange={(e) => put('stage_id', Number(e.target.value))}
              >
                {catalog.stages
                  .filter((s) => s.data.pipeline_id === data.pipeline_id)
                  .sort((a, b) => Number(a.data.sort) - Number(b.data.sort))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Бюджет, ₽">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={String(data.amount ?? 0)}
                onChange={(e) => put('amount', Number(e.target.value))}
              />
            </Field>
            {catalog.stages.find((s) => s.id === data.stage_id)?.data.outcome === 'lost' && (
              <Field label="Причина отказа" required>
                <Textarea
                  value={String(data.loss_reason ?? '')}
                  onChange={(e) => put('loss_reason', e.target.value)}
                />
              </Field>
            )}
            <Field label="Привязать контакт">
              <Input
                placeholder="Найти по имени или телефону"
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
              />
            </Field>
            {contacts.map((c) => (
              <button
                key={c.id}
                className="block w-full rounded-lg border border-border p-2 text-left text-sm"
                onClick={() => {
                  put('contact_ids', [c.id])
                  setContactQuery(c.name)
                  setContacts([])
                }}
              >
                <Users size={14} className="mr-2 inline" />
                {c.name} · {String(c.data.phone ?? '')}
              </button>
            ))}
            {Array.isArray(data.contact_ids) && data.contact_ids.length > 0 && (
              <p className="text-xs text-muted">Привязано контактов: {data.contact_ids.length}</p>
            )}
          </>
        )}
        {kind === 'task' && (
          <>
            <Field label="Срок">
              <Input
                type="datetime-local"
                value={localTime(data.due_at)}
                onChange={(e) =>
                  put('due_at', e.target.value ? new Date(e.target.value).toISOString() : null)
                }
              />
            </Field>
            <Field label="Результат">
              <Textarea value={String(data.result ?? '')} onChange={(e) => put('result', e.target.value)} />
            </Field>
          </>
        )}
        {['deal', 'contact', 'company', 'task'].includes(kind) && (
          <Field label="Ответственный">
            <Select
              value={String(data.responsible_user_id ?? '')}
              onChange={(e) => put('responsible_user_id', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Не назначен</option>
              {catalog.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {kind === 'stage' && (
          <>
            <Field label="Результат этапа">
              <Select value={String(data.outcome ?? 'open')} onChange={(e) => put('outcome', e.target.value)}>
                <option value="open">В работе</option>
                <option value="won">Успешно завершено</option>
                <option value="lost">Отказ</option>
              </Select>
            </Field>
            <Field label="Порядок">
              <Input
                type="number"
                value={String(data.sort ?? 0)}
                onChange={(e) => put('sort', Number(e.target.value))}
              />
            </Field>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

type SourceFile = { id: number; name: string; size: number; archived: boolean }
function FilesLibrary({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState<{ total: number; items: SourceFile[] }>({ total: 0, items: [] })
  const [error, setError] = useState('')
  useEffect(() => {
    let current = true
    const timer = setTimeout(
      () =>
        apiRequest<{ total: number; items: SourceFile[] }>({
          section: 'crm',
          path: '/files',
          query: { query, offset },
        })
          .then((r) => {
            if (current) setResult(r)
          })
          .catch((e) => setError(e.message)),
      150,
    )
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [query, offset])
  return (
    <Modal open onClose={onClose} title="Файлы компании" width="max-w-3xl">
      <Input
        aria-label="Поиск файла"
        className="mb-3"
        placeholder="Название файла…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOffset(0)
        }}
      />
      {error && (
        <p role="alert" className="mb-2 text-danger">
          {error}
        </p>
      )}
      <DataTable<SourceFile>
        rows={result.items}
        keyOf={(r) => String(r.id)}
        columns={[
          {
            header: 'Файл',
            accessor: (r) => (
              <span>
                {r.name}
                {r.archived ? ' · Архив' : ''}
              </span>
            ),
          },
          {
            header: 'Размер',
            accessor: (r) =>
              (r.size / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' МБ',
          },
          {
            header: '',
            accessor: (r) => (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  downloadFile('crm', `/files/${r.id}/download`, r.name).catch((e) => setError(e.message))
                }
              >
                <Download size={14} />
                Скачать
              </Button>
            ),
          },
        ]}
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted">Всего файлов: {result.total}</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!offset}
            onClick={() => setOffset((v) => Math.max(0, v - 50))}
          >
            Назад
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={offset + 50 >= result.total}
            onClick={() => setOffset((v) => v + 50)}
          >
            Далее
          </Button>
        </div>
      </div>
    </Modal>
  )
}
