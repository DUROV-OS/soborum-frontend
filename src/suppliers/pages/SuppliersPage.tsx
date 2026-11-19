import { usePurchaseSelection, usePurchaseViewState } from '@/purchasing/PurchaseViewState'
import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { CounterpartyCard } from '@/counterparties/CounterpartyCard'
import { call, message, type Preview, type Row, type RegistryStatus } from '@/counterparties/api'
import { RegistryFilters, RegistryTable, defaultSort, emptyFilters, type Sort, type TextFilters } from './CounterpartyRegistry'
import { RegistryEditor, type RegistryEdit } from './RegistryEditor'
import { SupplierDetailDrawer } from '../components/SupplierDetailDrawer'
import { useSuppliersStore } from '../store'

type Batch = {id:number;preview?:Preview;error?:unknown}
export function SuppliersPage() {
  const [params,setParams]=useSearchParams(),[offset,setOffset]=usePurchaseViewState('suppliers','offset',0),[revision,setRevision]=useState(0)
  const { pathname } = useLocation()
  const [filters, setFilters] = usePurchaseViewState<TextFilters>('suppliers', 'filters', emptyFilters)
  const [statuses, setStatuses] = usePurchaseViewState<RegistryStatus[]>('suppliers', 'statuses', [])
  const [sort, setSort] = usePurchaseViewState<Sort>('suppliers', 'sort', defaultSort)
  const selection = usePurchaseSelection('suppliers')
  const [filtersOpen, setFiltersOpen] = usePurchaseViewState('suppliers', 'filters-open', false)
  const [edit, setEdit] = useState<RegistryEdit | null>(null)
  const [archive, setArchive] = usePurchaseViewState('suppliers', 'archive', 'active')
  const [archiveAction, setArchiveAction] = useState<{ row: Row; requestId: string; dirty: boolean } | null>(null)
  const [archiveError, setArchiveError] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [data,setData]=useState<{items:Row[];total:number;can_create:boolean}>({items:[],total:0,can_create:false})
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[creating,setCreating]=useState(false),[profile,setProfile]=useState<number|null>(null)
  const [batch,setBatch]=useState<Batch[]|null>(null),[busy,setBusy]=useState(false),[report,setReport]=useState('')
  const selected=params.get('counterparty'),selectedId=selected&&/^\d+$/.test(selected)?Number(selected):null
  const loadSuppliers=useSuppliersStore(s=>s.load)
  useEffect(()=>{let active=true;setLoading(true);setError('');const timer=setTimeout(()=>{
    call<typeof data>('', 'GET', undefined, { ...filters, status: statuses, sort: sort.key, direction: sort.direction, archive, offset, limit: 20 }).then(r => {
      if (!active) return
      if (offset > 0 && offset >= r.total) {
        setOffset(Math.max(0, Math.floor((r.total - 1) / 20) * 20))
        return
      }
      setData(r)
    }).catch(e=>{if(active)setError(message(e))}).finally(()=>{if(active)setLoading(false)})
  },200);return()=>{active=false;clearTimeout(timer)}},[filters,statuses,sort,archive,offset,revision])
  const select=(id:number|null)=>setParams(previous=>{const p=new URLSearchParams(previous);if(id)p.set('counterparty',String(id));else p.delete('counterparty');return p})
  const cardUrl = (row: Row) => {
    const search = new URLSearchParams(params)
    search.set('counterparty', String(row.id))
    return pathname + '?' + search
  }
  const sortBy = (key: Sort['key']) => {
    setSort(previous => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))
    setOffset(0)
  }
  const openArchive = (row: Row, dirty = false) => {
    setArchiveError('')
    setArchiveAction({ row, requestId: crypto.randomUUID(), dirty })
  }
  const closeArchive = () => {
    if (!archiving) setArchiveAction(null)
  }
  async function saveArchive() {
    if (!archiveAction || archiving) return
    const { row, requestId } = archiveAction
    setArchiving(true)
    setArchiveError('')
    try {
      await call<Row>(`/${row.id}/archive`, 'POST', {
        request_id: requestId, etag: row.etag, archived: row.active,
      })
      if (selection.keys.includes(String(row.id))) selection.toggle(String(row.id))
      if (selectedId === row.id) select(null)
      setArchiveAction(null)
      setReport(row.active ? 'Контрагент перемещён в архив.' : 'Контрагент восстановлен.')
      setRevision(value => value + 1)
    } catch (error) {
      setArchiveError(message(error))
    } finally {
      setArchiving(false)
    }
  }
  async function openProfile(id:number){setBusy(true);await loadSuppliers();const state=useSuppliersStore.getState();setBusy(false);if(state.loadError){setError(state.loadError);return}setCreating(false);select(null);setProfile(id)}
  async function previewBatch(){
    setBusy(true);setError('');setReport('');const items:Batch[]=[]
    try{for(const row of data.items){setReport(`Сравнение: ${items.length+1} из ${data.items.length}`)
      try{items.push({id:row.id,preview:await call<Preview>(`/${row.id}/moysklad/preview`,'POST')})}
      catch(e){items.push({id:row.id,error:message(e)})}
    }setBatch(items);setReport('')}finally{setBusy(false)}
  }
  async function applyBatch(){
    if(!batch)return;setBusy(true);setError('');let updated=0,unchanged=0;const failed:Batch[]=[]
    try{for(const item of batch){if(!item.preview){failed.push(item);continue}
      const fields=item.preview.changes.filter(c=>c.fill_empty).map(c=>c.key)
      if(!fields.length){unchanged++;continue}
      try{await call(`/${item.id}/moysklad/apply`,'POST',{request_id:item.preview.id,preview_id:item.preview.id,fields});updated++}
      catch(e){failed.push({...item,error:message(e),preview:undefined})}
    }setReport(`Обновлено: ${updated}. Без изменений: ${unchanged}. Требуют проверки: ${failed.length}.`);setBatch(failed.length?failed:null);setRevision(v=>v+1)}finally{setBusy(false)}
  }
  return <div className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold text-ink">Контрагенты</h1><p className="mt-1 text-sm text-muted">Реквизиты, контакты, документы и история изменений.</p></div>{data.can_create&&<Button onClick={()=>setCreating(true)}><Plus size={16}/>Добавить</Button>}</div>
    <div className="flex flex-wrap gap-3">
      <Select aria-label="Архив контрагентов" className="w-full sm:!w-auto" value={archive}
        onChange={event => { setArchive(event.target.value); setOffset(0) }}>
        <option value="active">Действующие</option>
        <option value="archived">Архив</option>
        <option value="all">Все контрагенты</option>
      </Select>
      <Button variant="ghost" disabled={loading||busy} onClick={()=>setRevision(v=>v+1)}>Обновить список</Button>{data.can_create&&<Button variant="secondary" disabled={busy||loading||!data.items.length} onClick={()=>void previewBatch()}>Заполнить пустые поля на этой странице</Button>}</div>
    <RegistryFilters open={filtersOpen} onOpen={setFiltersOpen} values={filters} selected={statuses}
      onText={(key, value) => { setFilters(previous => ({ ...previous, [key]: value })); setOffset(0) }}
      onStatus={status => { setStatuses(previous => previous.includes(status) ? previous.filter(value => value !== status) : [...previous, status]); setOffset(0) }}
      onReset={() => { setFilters(emptyFilters); setStatuses([]); setOffset(0) }} />
    {error&&<p role="alert" className="text-sm text-danger">{error}</p>}{report&&<p role="status" className="text-sm">{report}</p>}
    {!error && <RegistryTable selection={selection} rows={data.items} loading={loading || busy} sort={sort} onSort={sortBy} cardUrl={cardUrl}
      onArchive={openArchive}
      onComment={row => setEdit({ row })} onStatus={(row, status) => setEdit({ row, status })} />}
    {(creating||selectedId!==null)&&<CounterpartyCard key={creating?'new':selectedId} id={creating?null:selectedId} close={()=>{setCreating(false);select(null)}} saved={()=>setRevision(v=>v+1)} openProfile={id=>void openProfile(id)} onArchive={openArchive}/>}
    {archiveAction && <Modal open onClose={closeArchive}
      title={archiveAction.row.active ? 'Удалить контрагента?' : 'Восстановить контрагента?'}
      footer={<>
        <Button variant="secondary" disabled={archiving} onClick={closeArchive}>Отмена</Button>
        <Button variant={archiveAction.row.active ? 'danger' : 'primary'} disabled={archiving} onClick={() => void saveArchive()}>
          {archiving ? 'Сохранение…' : archiveAction.row.active ? 'Удалить' : 'Восстановить'}
        </Button>
      </>}>
      <p className="break-words font-semibold">{archiveAction.row.card.name}</p>
      <p className="mt-2 text-sm text-muted">{archiveAction.row.active
        ? 'Карточка переместится в архив. Связанные документы и история сохранятся. Карточку можно восстановить.'
        : 'Карточка вернётся в список действующих контрагентов.'}</p>
      {archiveAction.dirty && <p className="mt-2 text-sm text-danger">Изменения в форме будут сброшены.</p>}
      {archiveError && <p role="alert" className="mt-3 text-sm text-danger">{archiveError}</p>}
    </Modal>}
    {edit && <RegistryEditor edit={edit} close={() => setEdit(null)} saved={() => {
      setEdit(null)
      setRevision(value => value + 1)
    }} />}
    <div className="flex items-center gap-3"><Button variant="ghost" disabled={!offset||loading} onClick={()=>setOffset(v=>Math.max(0,v-20))}>Назад</Button><span className="text-sm">{data.total?`${offset+1}–${Math.min(offset+20,data.total)} из ${data.total}`:'0'}</span><Button variant="ghost" disabled={offset+20>=data.total||loading} onClick={()=>setOffset(v=>v+20)}>Далее</Button></div>
    <SupplierDetailDrawer supplierId={profile} onClose={()=>{setProfile(null);setRevision(v=>v+1)}}/>
    <Modal open={batch!==null} onClose={()=>{if(!busy)setBatch(null)}} title="Заполнение пустых реквизитов" width="max-w-2xl" footer={<><Button variant="ghost" disabled={busy} onClick={()=>setBatch(null)}>Закрыть</Button><Button disabled={busy||!batch?.some(r=>r.preview)} onClick={()=>void applyBatch()}>{busy?'Применение…':'Подтвердить заполнение пустых полей'}</Button></>}>
      <p className="mb-3 text-sm">Обрабатываются только карточки этой страницы. Заполненные значения сохранятся. Для следующих карточек перейдите на следующую страницу.</p>
      {batch?.map(item=><div key={item.id} className="mb-3 rounded-lg border border-border p-3"><strong>{data.items.find(r=>r.id===item.id)?.card.name||`Карточка №${item.id}`}</strong>{item.preview?<><p className="text-sm">Пустых полей для заполнения: {item.preview.changes.filter(c=>c.fill_empty).length}. Конфликтов оставляем без замены: {item.preview.changes.filter(c=>!c.fill_empty).length}.</p><p className="text-xs text-muted">{item.preview.source.kind==='moysklad_live'?'МойСклад сейчас':'Сохранённый снимок'} · {new Date(item.preview.source.fetched_at).toLocaleString('ru-RU')}</p>{item.preview.warnings.map(w=><p key={w} className="text-xs text-muted">{w}</p>)}</>:<p className="text-sm text-danger">{typeof item.error==='string'?item.error:typeof item.error==='object'&&item.error&&'detail' in item.error?String(item.error.detail):'Не удалось обновить карточку'}</p>}</div>)}
    </Modal>
  </div>
}
