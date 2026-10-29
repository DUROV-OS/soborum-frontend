import { useEffect, useState } from 'react'
import { Plus, Play, Pencil, Trash2 } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Input, Select, Field } from '@/shared/ui/Field'
import { DataTable } from '@/shared/ui/DataTable'
import { Drawer } from '@/shared/ui/Drawer'
import { Modal } from '@/shared/ui/Modal'
import { Material } from '@/warehouse/types'

type Line = {
  source_id?: string | null
  material_id?: number | null
  title: string
  unit?: string
  quantity: string | number
}
type Content = { inputs: Line[]; outputs: Line[]; stages: Record<string, unknown>[]; warnings?: string[] }
type Recipe = { id: number; title: string; archived: boolean; version: number; content: Content }
type Preview = {
  inputs: { id: number; title: string; quantity: number; stock: number; available_quantity?: number; unit: string; enough: boolean }[]
  outputs: { id: number; title: string; quantity: number; unit: string }[]
}
const read = (query: string, archive: string) =>
  apiRequest<Recipe[]>({ section: 'moysklad', path: '/techcards', query: { query, archive } })
const qty = (n: string | number) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 6 })

export function RecipesPage() {
  const [items, setItems] = useState<Recipe[]>([])
  const [query, setQuery] = useState('')
  const [archive, setArchive] = useState('active')
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [editing, setEditing] = useState<{ row?: Recipe } | null>(null)
  const [producing, setProducing] = useState<Recipe | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const production = useAccessLevel('production')
  const warehouse = useAccessLevel('warehouse')
  const canEdit = accessLevelAtLeast(production, 'edit')
  const canProduce = canEdit && accessLevelAtLeast(warehouse, 'edit')
  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      setLoading(true)
      read(query, archive)
        .then((r) => {
          if (current) setItems(r)
        })
        .catch((e) => setError(e.message))
        .finally(() => {
          if (current) setLoading(false)
        })
    }, 150)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [query, archive, revision])
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink">Техкарты и выпуск</h1>
          <p className="mt-1 text-[13px] text-muted">
            Нормативы материалов, готовые изделия и выпуск с записью в складской журнал.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setEditing({})}>
            <Plus size={16} />
            Техкарта
          </Button>
        )}
      </div>
      <div className="mb-4 flex gap-2">
        <Input
          aria-label="Поиск техкарты"
          placeholder="Найти техкарту…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          aria-label="Архив техкарт"
          className="max-w-48"
          value={archive}
          onChange={(e) => setArchive(e.target.value)}
        >
          <option value="active">Действующие</option>
          <option value="archived">Архив</option>
          <option value="all">Все записи</option>
        </Select>
      </div>
      {error && (
        <p role="alert" className="mb-3 text-danger">
          {error}
        </p>
      )}
      <DataTable<Recipe>
        rows={items}
        keyOf={(r) => String(r.id)}
        onRowClick={setSelected}
        loading={loading}
        columns={[
          { header: 'Техкарта', accessor: (r) => <div className="font-medium">{r.title}</div> },
          { header: 'Материалов', accessor: (r) => r.content.inputs.length },
          {
            header: 'Продукция',
            accessor: (r) => r.content.outputs.map((l) => `${l.title} · ${qty(l.quantity)}`).join(', '),
          },
          {
            header: 'Статус',
            accessor: (r) =>
              r.archived
                ? 'Архив'
                : r.content.warnings?.length || !r.content.inputs.length
                  ? 'Нужна сверка норматива'
                  : 'Действует',
          },
        ]}
      />
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ''}
        subtitle={selected?.archived ? 'Архивная техкарта' : `Версия ${selected?.version ?? 1}`}
        width="max-w-3xl"
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex gap-2">
              {canEdit && (
                <Button variant="secondary" size="sm" onClick={() => setEditing({ row: selected })}>
                  <Pencil size={14} />
                  Изменить норматив
                </Button>
              )}
              {canProduce && !selected.archived && (
                <Button size="sm" onClick={() => setProducing(selected)}>
                  <Play size={14} />
                  Выпустить продукцию
                </Button>
              )}
            </div>
            {selected.content.warnings?.map((w, i) => (
              <p key={i} className="text-sm text-danger">
                {w}
              </p>
            ))}
            <RecipeLines title="Материалы на один выпуск" lines={selected.content.inputs} />
            <RecipeLines title="Готовые изделия" lines={selected.content.outputs} />
            <div>
              <h3 className="mb-2 text-sm font-medium">Этапы · {selected.content.stages.length}</h3>
              {selected.content.stages.map((s, i) => (
                <p key={i} className="mb-2 text-sm">
                  {String(s.title || s.name || `Этап ${i + 1}`)}
                </p>
              ))}
            </div>
          </div>
        )}
      </Drawer>
      {editing && (
        <RecipeEditor
          row={editing.row}
          canArchive={accessLevelAtLeast(production, 'full')}
          onClose={() => setEditing(null)}
          onSaved={(r) => {
            setEditing(null)
            setSelected(r)
            setRevision((v) => v + 1)
          }}
        />
      )}
      {producing && <ManufacturingModal recipe={producing} onClose={() => setProducing(null)} />}
    </div>
  )
}

function RecipeLines({ title, lines }: { title: string; lines: Line[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <div className="divide-y divide-border rounded-lg border border-border">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span>{l.title}</span>
            <span className="shrink-0 tabular-nums">
              {qty(l.quantity)} {l.unit ?? ''}
            </span>
          </div>
        ))}
        {!lines.length && <p className="p-3 text-sm text-muted">Норматив не заполнен</p>}
      </div>
    </div>
  )
}

function RecipeEditor({
  row,
  canArchive,
  onClose,
  onSaved,
}: {
  row?: Recipe
  canArchive: boolean
  onClose: () => void
  onSaved: (r: Recipe) => void
}) {
  const [title, setTitle] = useState(row?.title ?? '')
  const [archived, setArchived] = useState(row?.archived ?? false)
  const [content, setContent] = useState<Content>(
    row?.content ?? { inputs: [], outputs: [], stages: [], warnings: [] },
  )
  const [materials, setMaterials] = useState<Material[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    apiRequest<Material[]>({ section: 'warehouse', path: '/materials' })
      .then((r) => setMaterials(r.filter((m) => !m.is_archived)))
      .catch((e) => setError(e.message))
  }, [])
  const updateLine = (key: 'inputs' | 'outputs', index: number, patch: Partial<Line>) =>
    setContent((c) => ({ ...c, [key]: c[key].map((l, i) => (i === index ? { ...l, ...patch } : l)) }))
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await apiRequest<Recipe>({
        section: 'moysklad',
        path: row ? `/techcards/${row.id}` : '/techcards',
        method: row ? 'PATCH' : 'POST',
        body: { title, archived, content, version: row?.version },
      })
      onSaved(r)
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
      title={row ? 'Изменить техкарту' : 'Новая техкарта'}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={busy || !title.trim()} onClick={save}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Название" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        {canArchive && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
            Архивная техкарта
          </label>
        )}
        {(['inputs', 'outputs'] as const).map((key) => (
          <div key={key}>
            <h3 className="mb-2 text-sm font-medium">
              {key === 'inputs' ? 'Материалы' : 'Готовая продукция'}
            </h3>
            <div className="space-y-2">
              {content[key].map((line, index) => (
                <div key={index} className="flex items-start gap-2 rounded-lg border border-border p-2">
                  <MaterialChoice
                    line={line}
                    materials={materials}
                    onChange={(patch) => updateLine(key, index, patch)}
                  />
                  <Input
                    aria-label="Норма количества"
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    className="max-w-32"
                    value={line.quantity}
                    onChange={(e) => updateLine(key, index, { quantity: e.target.value })}
                  />
                  <button
                    aria-label="Удалить позицию"
                    className="p-2 text-muted"
                    onClick={() => setContent((c) => ({ ...c, [key]: c[key].filter((_, i) => i !== index) }))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() =>
                setContent((c) => ({
                  ...c,
                  [key]: [...c[key], { title: '', material_id: null, source_id: null, quantity: 1 }],
                }))
              }
            >
              <Plus size={14} />
              Добавить позицию
            </Button>
          </div>
        ))}
        <div>
          <h3 className="mb-2 text-sm font-medium">Этапы</h3>
          {content.stages.map((s, i) => (
            <Input
              key={i}
              className="mb-2"
              aria-label={`Название этапа ${i + 1}`}
              value={String(s.title || s.name || `Этап ${i + 1}`)}
              onChange={(e) =>
                setContent((c) => ({
                  ...c,
                  stages: c.stages.map((v, n) => (n === i ? { ...v, title: e.target.value } : v)),
                }))
              }
            />
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setContent((c) => ({ ...c, stages: [...c.stages, { title: 'Новый этап' }] }))}
          >
            Добавить этап
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function MaterialChoice({
  line,
  materials,
  onChange,
}: {
  line: Line
  materials: Material[]
  onChange: (patch: Partial<Line>) => void
}) {
  const [query, setQuery] = useState(line.title)
  const [open, setOpen] = useState(false)
  const matches = materials
    .filter((m) => (m.title + ' ' + m.code).toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')))
    .slice(0, 20)
  return (
    <div className="relative min-w-0 flex-1">
      <Input
        aria-label="Материал или изделие"
        value={query}
        placeholder="Найти в каталоге склада…"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange({ title: e.target.value, material_id: null, source_id: null, unit: '' })
          setOpen(true)
        }}
      />
      {open && (
        <div className="absolute z-10 max-h-52 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-panel">
          {matches.map((m) => (
            <button
              key={m.id}
              className="block w-full px-3 py-2 text-left text-xs hover:bg-surface-muted"
              onClick={() => {
                onChange({ title: m.title, material_id: m.id, source_id: null, unit: m.unit })
                setQuery(m.title)
                setOpen(false)
              }}
            >
              {m.title}
              <span className="block text-muted">
                {m.warehouse} · {m.code} · {m.unit}
              </span>
            </button>
          ))}
          <button
            className="w-full px-3 py-2 text-xs text-muted"
            onClick={() => {
              setQuery(line.title)
              setOpen(false)
            }}
          >
            Закрыть поиск
          </button>
        </div>
      )}
    </div>
  )
}

function ManufacturingModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const [warehouse, setWarehouse] = useState('Склад Технология')
  const [quantity, setQuantity] = useState(1)
  const [requestId, setRequestId] = useState(crypto.randomUUID())
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const parameters = { warehouse, multiplier: quantity, request_id: requestId }
  const reset = () => {
    setPreview(null)
    setRequestId(crypto.randomUUID())
    setError('')
  }
  const check = async () => {
    setBusy(true)
    setError('')
    try {
      setPreview(
        await apiRequest<Preview>({
          section: 'moysklad',
          path: `/techcards/${recipe.id}/preview`,
          method: 'POST',
          body: parameters,
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка проверки')
    } finally {
      setBusy(false)
    }
  }
  const produce = async () => {
    setBusy(true)
    setError('')
    try {
      await apiRequest({
        section: 'moysklad',
        path: `/techcards/${recipe.id}/manufacture`,
        method: 'POST',
        body: parameters,
      })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось провести выпуск')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Выпуск · ${recipe.title}`}
      width="max-w-2xl"
      footer={
        done ? (
          <Button onClick={onClose}>Готово</Button>
        ) : (
          <>
            <Button variant="secondary" disabled={busy} onClick={check}>
              Проверить материалы
            </Button>
            <Button disabled={busy || !preview || preview.inputs.some((l) => !l.enough)} onClick={produce}>
              Выпустить и провести
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className="py-5 text-success">
          Продукция оприходована, материалы списаны. Обе операции сохранены в складском журнале.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Склад">
              <Select
                value={warehouse}
                onChange={(e) => {
                  setWarehouse(e.target.value)
                  reset()
                }}
              >
                <option>Склад Технология</option>
                <option>Склад ИД Групп</option>
              </Select>
            </Field>
            <Field label="Количество выпусков">
              <Input
                type="number"
                min="0.000001"
                step="0.000001"
                value={quantity}
                onChange={(e) => {
                  setQuantity(Number(e.target.value))
                  reset()
                }}
              />
            </Field>
          </div>
          {preview && (
            <>
              <h3 className="text-sm font-medium">Расход материалов</h3>
              <DataTable
                rows={preview.inputs}
                keyOf={(r) => String(r.id)}
                columns={[
                  { header: 'Материал', accessor: (r) => r.title },
                  { header: 'Нужно', accessor: (r) => `${qty(r.quantity)} ${r.unit}` },
                  {
                    header: 'На складе',
                    accessor: (r) => (
                      <span className={r.enough ? '' : 'text-danger'}>
                        {qty(r.stock)} {r.unit}
                        <span className="block text-xs text-muted">свободно: {qty(r.available_quantity??r.stock)}</span>
                      </span>
                    ),
                  },
                ]}
              />
              <h3 className="text-sm font-medium">Будет выпущено</h3>
              {preview.outputs.map((r, i) => (
                <p className="text-sm" key={i}>
                  {r.title} · {qty(r.quantity)} {r.unit}
                </p>
              ))}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
