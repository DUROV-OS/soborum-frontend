import { WarehouseReturns } from '../WarehouseControl'
import { WarehouseQueue } from '../WarehouseQueue'
import { getMaterial, listWarehouses } from '../api'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryChoice } from '@/shared/lib/useQueryChoice'
import { ClipboardList, PackageMinus, PackagePlus, Plus, Send, Truck } from 'lucide-react'
import { AskAiButton } from '@/ai/components/AskAiButton'
import { SectionAnalyticsCard } from '@/ai/components/SectionAnalyticsCard'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable'
import { Input, Select } from '@/shared/ui/Field'
import { HelpButton } from '@/shared/ui/HelpButton'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { Tabs } from '@/shared/ui/Tabs'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { useWarehouseStore } from '../store'
import { Material } from '../types'
import { CreateMaterialModal } from '../components/CreateMaterialModal'
import { SupplyIntakeModal } from '../components/SupplyIntakeModal'
import { MaterialDetailDrawer } from '../components/MaterialDetailDrawer'
import { RequestApprovalQueue } from '../components/RequestApprovalQueue'
import { JournalPanel } from '../components/JournalPanel'
import { InventoryOperationModal } from '../components/InventoryOperationModal'
import { TechcardIssueModal } from '../components/TechcardIssueModal'
import { ManualIssueModal } from '../components/ManualIssueModal'
import { StockDocumentsPanel } from '../components/StockDocumentsPanel'
import { ReservationsPanel } from '../ReservationsPanel'

const STOCK_VIEWS = [
  { key: 'materials', label: 'По товарам' },
  { key: 'queue', label: 'Очередь выдачи' },
  { key: 'returns', label: 'Возвраты' },
  { key: 'reservations', label: 'Резервы' },
  { key: 'history', label: 'Журнал операций' },
]

type Tab = 'queue' | 'returns' | 'materials' | 'requests' | 'history' | 'documents' | 'reservations' | 'warehouses'

type SortKey = 'name' | 'stock_desc' | 'stock_asc' | 'threshold_desc'

const SORT_LABEL: Record<SortKey, string> = {
  name: 'По названию',
  stock_desc: 'По остатку (убыв.)',
  stock_asc: 'По остатку (возр.)',
  threshold_desc: 'По порогу (убыв.)',
}

const catalogColumns: DataTableColumn<Material>[] = [
  { header: 'Ед. изм.', accessor: m => m.unit },
  { header: 'Статус', accessor: m => m.is_archived ? <Chip tone="neutral">Архив</Chip> : <Chip tone="success">Действует</Chip> },
]

const balanceColumns: DataTableColumn<Material>[] = [
  { header: 'На складе', align: 'right', accessor: m => `${m.quantity_in_stock} ${m.unit}`, className: 'tabular' },
  { header: 'В резерве', align: 'right', accessor: m => `${m.reserved_quantity ?? 0} ${m.unit}`, className: 'tabular' },
  { header: 'Свободно', align: 'right', accessor: m => `${m.available_quantity ?? m.quantity_in_stock} ${m.unit}`, className: 'tabular' },
  { header: 'Запрошено', align: 'right', accessor: m => `${m.total_requested} ${m.unit}`, className: 'tabular' },
  { header: 'Порог', align: 'right', accessor: m => `${m.threshold} ${m.unit}`, className: 'tabular' },
  {
    header: 'Статус',
    accessor: m => {
      if (m.is_archived) return <Chip tone="neutral">Архив</Chip>
      if ((m.reservation_shortage ?? 0) > 0) return <Chip tone="danger">Резерв не обеспечен</Chip>
      if (m.needs_supply) return <Chip tone="danger">Нужна поставка</Chip>
      return <Chip tone="success">В норме</Chip>
    },
  },
]

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    title: 'Работа со складом',
    body: (
      <p>
        В «Остатках» доступны очередь выдачи, возвраты, резервы и журнал операций.
        Для пересчёта откройте «Инвентаризацию», для передачи товара между складами — «Перемещения».
        Заявки на материалы находятся в разделе «Производство».
      </p>
    ),
  },
  {
    title: 'Приход и расход материала',
    body: (
      <p>
        Новую позицию создают в «Номенклатуре». Кнопка «Оформить поставку» фиксирует приход
        материала — остатки на складе обновятся автоматически. «Отпуск по техкарте» выдаёт материалы дома по
        нормативам КР, «Отпуск на объект / в цех» — вручную, без техкарты. «Оприходование» и «Списание» — для
        контроля остатков: излишки и недостачи, найденные при пересчёте.
      </p>
    ),
  },
  {
    title: 'Поиск и фильтры',
    body: (
      <p>
        В строке поиска можно найти материал по названию, коду или категории. Рядом — сортировка и
        переключатель «Нужна поставка», который оставляет только позиции ниже порога.
      </p>
    ),
  },
  {
    title: 'Детали и вопрос ИИ',
    body: (
      <p>
        Клик по строке материала открывает карточку с подробностями. Кнопка «Спросить ИИ» открывает чат, где
        можно задать вопрос по складу прямо в контексте раздела.
      </p>
    ),
  },
]

export function WarehousePage() {
  const [params] = useSearchParams()
  const tab = params.get('tab')
  const view = params.get('view')
  const workspace = tab === 'requests' ? 'requests' : tab === 'materials' && (view === 'catalog' || view === 'filter') ? 'catalog' : 'warehouse'
  return <WarehouseWorkspace key={workspace} />
}

function WarehouseWorkspace() {
  const navigate = useNavigate()
  const accountingLevel = useAccessLevel('accounting')
  const materials = useWarehouseStore((s) => s.materials)
  const loading = useWarehouseStore((s) => s.loading)
  const load = useWarehouseStore((s) => s.load)
  const [params, setParams] = useSearchParams()
  const [tab] = useQueryChoice<Tab>(
    'tab', ['queue', 'materials', 'requests', 'returns', 'history', 'documents', 'reservations', 'warehouses'], 'queue',
  )
  const view = params.get('view')
  const filterView = tab === 'materials' && view === 'filter'
  const catalogView = tab === 'materials' && (view === 'catalog' || filterView)
  const reason = params.get('reason')
  const operationKind = tab === 'history' && (reason === 'receipt' || reason === 'write_off') ? reason : undefined
  const stockView = !catalogView && !operationKind && STOCK_VIEWS.some(entry => entry.key === tab)
  const warehouse = params.get('warehouse') || ''
  const title = tab === 'requests' ? 'Заявки производства' : filterView ? 'Фильтр номенклатуры' : catalogView ? 'Товары и материалы' : 'Склад'
  const [creatingMaterial, setCreatingMaterial] = useState(false)
  const [supplying, setSupplying] = useState(false)
  const [selected, setSelected] = useState<Material | null>(null)
  const [cardError, setCardError] = useState('')
  const linkedMaterialId = tab === 'materials' ? params.get('material') : null
  useEffect(() => {
    if (!linkedMaterialId || !/^\d+$/.test(linkedMaterialId)) return
    let active = true
    getMaterial(Number(linkedMaterialId)).then(row => { if (active) setSelected(row) }).catch(e => { if (active) setCardError(e.message) })
    return () => { active = false }
  }, [linkedMaterialId])
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [onlyNeedsSupply, setOnlyNeedsSupply] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [archiveFilter, setArchiveFilter] = useState('active')
  const [page, setPage] = useState(0)
  useEffect(() => setPage(0), [query, sortKey, onlyNeedsSupply, categoryFilter, archiveFilter, warehouse])
  const onboarding = useSectionOnboarding('warehouse')
  const accessLevel = useAccessLevel('warehouse')
  const canEdit = accessLevelAtLeast(accessLevel, 'edit')
  // Оприходование/списание меняют остаток без поставки и отпуска — как и
  // списание из карточки (0030-e), только с полным доступом.
  const canFull = accessLevelAtLeast(accessLevel, 'full')
  const [inventoryKind, setInventoryKind] = useState<'receipt' | 'write_off' | null>(null)
  const [issuingByTechcard, setIssuingByTechcard] = useState(false)
  const [issuingHouseId,setIssuingHouseId]=useState<number|undefined>()
  const [issuingManually, setIssuingManually] = useState(false)

  useEffect(() => {
    load()
  }, [load])

  // `selected` — снимок на момент клика; после правки материала в карточке
  // (0078) берём свежую версию из стора, иначе drawer показывал бы старое
  const selectedMaterial = selected ? materials.find((m) => m.id === selected.id) ?? selected : null

  const categories = Array.from(
    new Set(materials.map((m) => (m.catalog_path || m.category || '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'ru'))

  const warehouseOptions = [...new Set([...materials.map(m => m.warehouse), warehouse].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ru'))
  const q = query.trim().toLowerCase()
  const visibleMaterials = materials
    .filter(m => !warehouse || m.warehouse === warehouse)
    .filter((m) => archiveFilter === 'all' || Boolean(m.is_archived) === (archiveFilter === 'archived'))
    .filter((m) => !onlyNeedsSupply || m.needs_supply)
    .filter((m) => categoryFilter === 'all' || (m.catalog_path || m.category || '').trim() === categoryFilter)
    .filter(
      (m) =>
        !q ||
        (m.title ?? '').toLowerCase().includes(q) ||
        (m.code ?? '').toLowerCase().includes(q) ||
        (m.catalog_path || m.category || '').toLowerCase().includes(q),
    )
    .sort((a, b) => {
      if (sortKey === 'name') return a.title.localeCompare(b.title, 'ru')
      if (sortKey === 'stock_desc') return b.quantity_in_stock - a.quantity_in_stock
      if (sortKey === 'stock_asc') return a.quantity_in_stock - b.quantity_in_stock
      return b.threshold - a.threshold
    })

  return (
    <div>
      {stockView && <SectionAnalyticsCard section="warehouse" />}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">{title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {stockView && <AskAiButton domain="warehouse" />}
          {canEdit && catalogView && (
            <Button variant="secondary" onClick={() => setCreatingMaterial(true)}>
              <Plus size={16} />
              Материал
            </Button>
          )}
          {canEdit && stockView && (
            <>
              <Button onClick={() => accessLevelAtLeast(accountingLevel,'view') ? navigate('/purchasing?receive=1') : setSupplying(true)}>
                <Truck size={16} />
                Оформить поставку
              </Button>
              <Button variant="secondary" onClick={() => {setIssuingHouseId(undefined);setIssuingByTechcard(true)}}>
                <ClipboardList size={16} />
                Отпуск по техкарте
              </Button>
              <Button variant="secondary" onClick={() => setIssuingManually(true)}>
                <Send size={16} />
                Отпуск на объект / в цех
              </Button>
            </>
          )}
          {canFull && operationKind === 'receipt' && (
            <Button onClick={() => setInventoryKind('receipt')}>
              <PackagePlus size={16} />
              Оприходование
            </Button>
          )}
          {canFull && operationKind === 'write_off' && (
            <Button onClick={() => setInventoryKind('write_off')}>
              <PackageMinus size={16} />
              Списание
            </Button>
          )}
          {stockView && <HelpButton onClick={onboarding.show} />}
        </div>
      </div>

      {stockView && <div className="mb-4">
        <Tabs tabs={STOCK_VIEWS} activeKey={tab} onChange={next => setParams({ tab: next })} />
      </div>}

      {tab === 'materials' && (
        <>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={archiveFilter} onChange={(e) => setArchiveFilter(e.target.value)} aria-label="Архив материалов" className="w-full sm:w-44">
              <option value="active">Действующие</option><option value="archived">Архив</option><option value="all">Все записи</option>
            </Select>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию, коду, категории…"
              className="sm:max-w-xs"
            />
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Категория товара"
              className="w-full sm:w-56"
            >
              <option value="all">Все категории</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            {(filterView || stockView) && <Select
              value={warehouse}
              aria-label="Склад"
              className="w-full sm:w-56"
              onChange={(e) => setParams(q => {
                if (e.target.value) q.set('warehouse', e.target.value)
                else q.delete('warehouse')
                return q
              })}
            >
              <option value="">Все склады</option>
              {warehouseOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </Select>}
            <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="w-full sm:w-56">
              {Object.entries(SORT_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
            {stockView && <Button
              variant={onlyNeedsSupply ? 'primary' : 'secondary'}
              size="sm"
              className="shrink-0"
              onClick={() => setOnlyNeedsSupply((v) => !v)}
            >
              Нужна поставка
            </Button>}
          </div>
          <DataTable<Material>
            columns={[
              {
                header: 'Категория',
                accessor: (m) => {
                  const c = (m.catalog_path || m.category || '').trim()
                  return c && c !== 'без категории' ? (
                    <Chip tone="neutral">{c}</Chip>
                  ) : (
                    <span className="text-[12px] text-muted">—</span>
                  )
                },
              },
              { header: catalogView ? 'Товар' : 'Материал', accessor: (m) => <MaterialCell material={m} /> },
              { header: 'Склад', accessor: (m) => m.warehouse },
              ...(catalogView ? catalogColumns : balanceColumns),
            ]}
            rows={visibleMaterials.slice(page * 100, (page + 1) * 100)}
            keyOf={(m) => String(m.id)}
            onRowClick={setSelected}
            loading={loading}
          />
          <div className="mt-3 flex items-center justify-between gap-2 text-sm"><span className="text-muted">Позиций: {visibleMaterials.length}</span><div className="flex gap-2"><Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(v => v - 1)}>Назад</Button><Button variant="secondary" size="sm" disabled={(page + 1) * 100 >= visibleMaterials.length} onClick={() => setPage(v => v + 1)}>Далее</Button></div></div>
        </>
      )}

      {tab === 'requests' && <RequestApprovalQueue />}
      {tab === 'history' && <JournalPanel key={operationKind ?? 'journal'} fixedReason={operationKind} />}
      {tab === 'documents' && <StockDocumentsPanel />}
      {tab === 'warehouses' && <WarehousesPanel />}
      {tab === 'queue' && <WarehouseQueue onIssue={id=>{setIssuingHouseId(id);setIssuingByTechcard(true)}} onRequests={()=>setParams({tab:'requests'})} onCount={()=>setParams({tab:'documents',kind:'inventory'})} onMaterial={async id=>{
        const material = await getMaterial(id)
        useWarehouseStore.setState(state => ({ materials: state.materials.map(row => row.id === id ? material : row) }))
        setSelected(material)
      }} />}
      {tab === 'returns' && <WarehouseReturns />}
      {tab === 'reservations' && <ReservationsPanel materialId={Number(params.get('material'))||undefined} createMaterialId={Number(params.get('reserve'))||undefined} onCreateHandled={()=>{const query=new URLSearchParams(params);query.delete('reserve');setParams(query,{replace:true})}} onIssueHouse={id=>{setIssuingHouseId(id);setIssuingByTechcard(true)}} />}

      <CreateMaterialModal open={creatingMaterial} onClose={() => setCreatingMaterial(false)} />
      <SupplyIntakeModal open={supplying} onClose={() => setSupplying(false)} />
      <InventoryOperationModal kind={inventoryKind} onClose={() => setInventoryKind(null)} />
      <TechcardIssueModal open={issuingByTechcard} initialProductionId={issuingHouseId} onClose={() => {setIssuingByTechcard(false);setIssuingHouseId(undefined)}} />
      <ManualIssueModal open={issuingManually} onClose={() => setIssuingManually(false)} />
      {cardError && <p role="alert" className="text-danger">{cardError}</p>}
      <MaterialDetailDrawer material={selectedMaterial} onClose={() => { setSelected(null); if (linkedMaterialId) setParams(p => { p.delete('material'); return p }) }} onReserves={create=>{if(selectedMaterial){setParams({tab:'reservations',material:String(selectedMaterial.id),...(create?{reserve:String(selectedMaterial.id)}:{})});setSelected(null)}}}/>

      {stockView && <OnboardingDialog
        open={onboarding.open}
        onClose={onboarding.close}
        title="Раздел «Склад»"
        pages={ONBOARDING_PAGES}
      />}
    </div>
  )
}

function WarehousesPanel() {
  const [names, setNames] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    listWarehouses()
      .then(rows => { if (active) setNames(rows) })
      .catch(e => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  return error ? <p role="alert" className="text-danger">{error}</p> : <DataTable
    columns={[
      { header: 'Склад', accessor: name => (
        <Link className="text-accent underline" to={'/warehouse?' + new URLSearchParams({ tab: 'materials', warehouse: name })}>
          {name}
        </Link>
      ) },
    ]}
    rows={names}
    keyOf={name => name}
    loading={loading}
    emptyLabel="Склады не найдены"
  />
}

function MaterialCell({ material }: { material: Material }) {
  const meta = [material.code].filter((v) => v && v !== 'без категории')
  return (
    <div>
      <div className="font-medium text-ink">{material.title}</div>
      {meta.length > 0 && <div className="text-[12px] text-muted">{meta.join(' · ')}</div>}
    </div>
  )
}
