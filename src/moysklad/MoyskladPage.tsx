import { useEffect, useState } from 'react'
import { Archive, Database, Download, Search } from 'lucide-react'
import { apiRequest, downloadFile } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Input, Select } from '@/shared/ui/Field'
import { DataTable } from '@/shared/ui/DataTable'
import { Drawer } from '@/shared/ui/Drawer'
import { Chip } from '@/shared/ui/Chip'

type Category = { type: string; title: string; count: number; archived: number }
type Catalog = {
  categories: Category[]
  imported_at: string | null
  source_completed_at: string | null
  warnings: string[]
}
type Row = {
  id: number
  title: string
  type: string
  archived: boolean
  state: string | null
  code?: string
  moment?: string
  sum_rub?: number | null
  applicable?: boolean
  agent?: string
}
type Detail = Row & { payload: Record<string, unknown> }
const money = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽'
const date = (s?: string | null) =>
  s ? new Date(s.includes('T') ? s : s.replace(' ', 'T')).toLocaleString('ru-RU') : '—'
const labels: Record<string, string> = {
  name: 'Название',
  code: 'Код',
  description: 'Описание',
  archived: 'Архив',
  moment: 'Дата документа',
  updated: 'Обновлено в источнике',
  created: 'Создано',
  externalCode: 'Внешний код',
  article: 'Артикул',
  agent: 'Контрагент',
  organization: 'Организация',
  organizationAccount: 'Счёт организации',
  agentAccount: 'Счёт контрагента',
  store: 'Склад',
  sourceStore: 'Со склада',
  targetStore: 'На склад',
  materialsStore: 'Склад материалов',
  productsStore: 'Склад продукции',
  state: 'Статус',
  applicable: 'Проведён',
  sum: 'Сумма',
  vatSum: 'НДС',
  vat: 'НДС, %',
  vatEnabled: 'Учитывать НДС',
  vatIncluded: 'НДС включён',
  payedSum: 'Оплачено',
  shippedSum: 'Отгружено',
  invoicedSum: 'Выставлено счетов',
  reservedSum: 'Зарезервировано на сумму',
  waitSum: 'Ожидается на сумму',
  quantity: 'Количество',
  price: 'Цена',
  cost: 'Стоимость',
  discount: 'Скидка, %',
  positions: 'Позиции документа',
  assortment: 'Номенклатура',
  materials: 'Материалы',
  products: 'Продукция',
  components: 'Состав комплекта',
  stages: 'Этапы',
  processingPlan: 'Техкарта',
  processingProcess: 'Техпроцесс',
  processingStage: 'Этап производства',
  productionStage: 'Производственный этап',
  productionRows: 'Изделия задания',
  productionVolume: 'Произведено',
  processingSum: 'Стоимость работ',
  labourUnitCost: 'Трудозатраты на единицу',
  processingUnitCost: 'Стоимость обработки единицы',
  standardHourCost: 'Стоимость нормо-часа',
  standardHourUnit: 'Нормо-часов на единицу',
  productionStart: 'Начало производства',
  productionEnd: 'Окончание производства',
  deliveryPlannedMoment: 'План поставки',
  paymentPlannedMoment: 'План оплаты',
  paymentPurpose: 'Назначение платежа',
  incomingNumber: 'Входящий номер',
  incomingDate: 'Входящая дата',
  invoiceIn: 'Счёт поставщика',
  invoicesIn: 'Счета поставщика',
  invoicesOut: 'Счета покупателю',
  purchaseOrder: 'Заказ поставщику',
  customerOrder: 'Заказ покупателя',
  supplies: 'Приёмки',
  payments: 'Платежи',
  operations: 'Связанные документы',
  uom: 'Единица измерения',
  buyPrice: 'Закупочная цена',
  minPrice: 'Минимальная цена',
  salePrices: 'Цены продажи',
  value: 'Значение',
  priceType: 'Тип цены',
  currency: 'Валюта',
  rate: 'Курс',
  multiplicity: 'Кратность',
  product: 'Базовый товар',
  productFolder: 'Группа',
  pathName: 'Путь группы',
  parent: 'Родительская группа',
  characteristics: 'Характеристики',
  attributes: 'Дополнительные поля',
  barcodes: 'Штрихкоды',
  weight: 'Вес',
  volume: 'Объём',
  phone: 'Телефон',
  email: 'Почта',
  contactpersons: 'Контактные лица',
  notes: 'Заметки',
  text: 'Текст',
  address: 'Адрес',
  legalTitle: 'Юридическое название',
  legalAddress: 'Юридический адрес',
  actualAddress: 'Фактический адрес',
  inn: 'ИНН',
  kpp: 'КПП',
  ogrn: 'ОГРН',
  okpo: 'ОКПО',
  accounts: 'Банковские счета',
  bankName: 'Банк',
  accountNumber: 'Номер счёта',
  correspondentAccount: 'Корреспондентский счёт',
  bic: 'БИК',
  owner: 'Ответственный',
  project: 'Проект',
  firstName: 'Имя',
  middleName: 'Отчество',
  lastName: 'Фамилия',
  fullName: 'Полное имя',
  position: 'Должность',
  salary: 'Оклад',
  stockByStore: 'Остатки по складам',
  stock: 'Остаток',
  reserve: 'Резерв',
  inTransit: 'Ожидается',
  quantityInStock: 'На складе',
  expenseItem: 'Статья расходов',
  tags: 'Группы',
  shipmentAddress: 'Адрес доставки',
  salesAmount: 'Сумма продаж',
  balance: 'Баланс',
  debt: 'Долг',
  demand: 'Отгрузка',
  supply: 'Приёмка',
  files: 'Файлы',
  images: 'Изображения',
}
const hidden = new Set([
  'meta',
  'id',
  'accountId',
  'group',
  'shared',
  'printed',
  'published',
  '_downloaded_files',
])
const kopecks = new Set([
  'sum',
  'vatSum',
  'payedSum',
  'shippedSum',
  'invoicedSum',
  'reservedSum',
  'waitSum',
  'price',
  'cost',
  'processingSum',
  'labourUnitCost',
  'processingUnitCost',
  'standardHourCost',
  'salesAmount',
  'salary',
])

function Value({ value, field = '', depth = 0 }: { value: unknown; field?: string; depth?: number }) {
  if (value === null || value === undefined) return <span className="text-muted">—</span>
  if (typeof value === 'boolean') return <span>{value ? 'Да' : 'Нет'}</span>
  if (typeof value === 'number')
    return <span>{kopecks.has(field) ? money(value / 100) : value.toLocaleString('ru-RU')}</span>
  if (typeof value === 'string') return <span className="whitespace-pre-wrap break-words">{value}</span>
  if (Array.isArray(value))
    return value.length ? (
      <div className="space-y-2">
        {value.map((v, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <Value value={v} depth={depth + 1} field={field} />
          </div>
        ))}
      </div>
    ) : (
      <span className="text-muted">Нет записей</span>
    )
  const obj = value as Record<string, unknown>
  if ('rows' in obj) return <Value value={obj.rows} depth={depth + 1} field={field} />
  if (
    (field === 'buyPrice' || field === 'minPrice' || field === 'salePrices') &&
    typeof obj.value === 'number'
  )
    return (
      <span>
        {money(obj.value / 100)}{' '}
        {obj.priceType && typeof obj.priceType === 'object'
          ? String((obj.priceType as Record<string, unknown>).name ?? '')
          : ''}
      </span>
    )
  const entries = Object.entries(obj).filter(([k]) => !hidden.has(k))
  if (entries.length === 1 && entries[0][0] === 'name') return <span>{String(obj.name)}</span>
  if (!entries.length) return <span className="text-muted">Связанная запись</span>
  if (depth > 6) return <span className="text-muted">Подробности — в исходных данных ниже</span>
  return (
    <dl className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k} className="grid gap-1 sm:grid-cols-[minmax(100px,0.7fr)_minmax(0,1.3fr)]">
          <dt className="text-muted">{labels[k] ?? k.replace(/([A-Z])/g, ' $1')}</dt>
          <dd className="min-w-0">
            <Value field={k} value={v} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function MoyskladPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [type, setType] = useState('')
  const [query, setQuery] = useState('')
  const [archive, setArchive] = useState('active')
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState<{ total: number; items: Row[] }>({ total: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Detail | null>(null)
  useEffect(() => {
    apiRequest<Catalog>({ section: 'moysklad', path: '/catalog' })
      .then(setCatalog)
      .catch((e) => setError(e.message))
  }, [])
  useEffect(() => {
    let current = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      apiRequest<{ total: number; items: Row[] }>({
        section: 'moysklad',
        path: '/records',
        query: { query, entity_type: type || undefined, archive, offset },
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
      window.clearTimeout(timer)
    }
  }, [type, query, archive, offset])
  const open = (row: Row) => {
    setError('')
    apiRequest<Detail>({ section: 'moysklad', path: `/records/${row.id}` })
      .then(setDetail)
      .catch((e) => setError(e.message))
  }
  const total = catalog?.categories.reduce((n, c) => n + c.count, 0) ?? 0
  const archived = catalog?.categories.reduce((n, c) => n + c.archived, 0) ?? 0
  const files = (detail?.payload._downloaded_files ?? []) as { filename: string; content_type?: string }[]
  return (
    <div>
      <div className="mb-5 flex items-start gap-3">
        <Database className="mt-1 text-brand" size={25} />
        <div>
          <h1 className="text-[22px] font-medium text-ink">МойСклад · данные компании</h1>
          <p className="mt-1 text-[13px] text-muted">
            Документы, товары и техкарты сохранены в Соборуме. Снимок на {date(catalog?.source_completed_at)}.
          </p>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ['Сохранено записей', total],
          ['В архиве', archived],
          ['Разделов', catalog?.categories.length ?? 0],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[12px] text-muted">{label}</p>
            <p className="mt-1 text-xl font-medium">{Number(n).toLocaleString('ru-RU')}</p>
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="absolute left-3 top-3 text-muted" />
          <Input
            className="pl-9"
            placeholder="Название, код, контрагент, номер документа…"
            aria-label="Поиск в данных МоегоСклада"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOffset(0)
            }}
          />
        </div>
        <Select
          aria-label="Раздел МоегоСклада"
          value={type}
          onChange={(e) => {
            setType(e.target.value)
            setOffset(0)
          }}
          className="sm:max-w-72"
        >
          <option value="">Все разделы</option>
          {catalog?.categories.map((c) => (
            <option key={c.type} value={c.type}>
              {c.title} · {c.count}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Архив"
          value={archive}
          onChange={(e) => {
            setArchive(e.target.value)
            setOffset(0)
          }}
          className="sm:max-w-44"
        >
          <option value="active">Действующие</option>
          <option value="archived">Архив</option>
          <option value="all">Все записи</option>
        </Select>
      </div>
      {catalog?.warnings.map((w, i) => (
        <p key={i} className="mb-3 rounded-lg border border-warning bg-warning-bg p-3 text-sm">
          {w}
        </p>
      ))}
      {error && (
        <p role="alert" className="mb-3 text-danger">
          {error}
        </p>
      )}
      <DataTable<Row>
        rows={result.items}
        keyOf={(r) => String(r.id)}
        loading={loading}
        onRowClick={open}
        emptyLabel="Записей по этим условиям нет"
        columns={[
          {
            header: 'Название',
            accessor: (r) => (
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted">
                  {catalog?.categories.find((c) => c.type === r.type)?.title ?? r.type}
                  {r.code ? ` · ${r.code}` : ''}
                </p>
              </div>
            ),
          },
          { header: 'Контрагент', accessor: (r) => r.agent ?? '—' },
          { header: 'Дата', accessor: (r) => (r.moment ? date(r.moment) : '—') },
          {
            header: 'Статус',
            accessor: (r) => (
              <div className="flex flex-wrap gap-1">
                {r.archived && <Chip tone="neutral">Архив</Chip>}
                {r.state && <Chip tone="neutral">{r.state}</Chip>}
                {r.applicable !== undefined && (
                  <Chip tone={r.applicable ? 'success' : 'neutral'}>
                    {r.applicable ? 'Проведён' : 'Не проведён'}
                  </Chip>
                )}
              </div>
            ),
          },
          {
            header: 'Сумма',
            align: 'right',
            accessor: (r) => (r.sum_rub !== null && r.sum_rub !== undefined ? money(r.sum_rub) : '—'),
          },
        ]}
      />
      <div className="mt-4 flex items-center justify-between gap-2 text-sm">
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
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title ?? ''}
        width="max-w-3xl"
        subtitle={
          detail?.archived ? (
            <span className="flex items-center gap-1">
              <Archive size={14} />
              Архивная запись
            </span>
          ) : (
            detail?.state
          )
        }
      >
        {detail && (
          <div className="text-[13px] leading-relaxed">
            <Value value={detail.payload} />
            {files.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <h3 className="mb-2 font-medium">Сохранённые вложения</h3>
                {files.map((f, i) => (
                  <Button
                    key={i}
                    variant="secondary"
                    className="mb-2 mr-2"
                    onClick={() =>
                      downloadFile('moysklad', `/records/${detail.id}/files/${i}`, f.filename).catch((e) =>
                        setError(e.message),
                      )
                    }
                  >
                    <Download size={14} />
                    {f.filename}
                  </Button>
                ))}
              </div>
            )}
            <details className="mt-5">
              <summary className="cursor-pointer text-muted">Исходные данные</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs">
                {JSON.stringify(detail.payload, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </Drawer>
    </div>
  )
}
