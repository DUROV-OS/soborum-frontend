import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { DataTable } from '@/shared/ui/DataTable'
import { Modal } from '@/shared/ui/Modal'
import { Chip } from '@/shared/ui/Chip'
import { CounterpartyCard } from '@/counterparties/CounterpartyCard'
import { call, message, Preview, Row, types } from '@/counterparties/api'
import { SupplierDetailDrawer } from '../components/SupplierDetailDrawer'
import { useSuppliersStore } from '../store'

type Batch = {id:number;preview?:Preview;error?:unknown}
export function SuppliersPage() {
  const [params,setParams]=useSearchParams(),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0)
  const [data,setData]=useState<{items:Row[];total:number;can_create:boolean}>({items:[],total:0,can_create:false})
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[creating,setCreating]=useState(false),[profile,setProfile]=useState<number|null>(null)
  const [batch,setBatch]=useState<Batch[]|null>(null),[busy,setBusy]=useState(false),[report,setReport]=useState('')
  const selected=params.get('counterparty'),selectedId=selected&&/^\d+$/.test(selected)?Number(selected):null
  const loadSuppliers=useSuppliersStore(s=>s.load)
  useEffect(()=>{let active=true;setLoading(true);setError('');const timer=setTimeout(()=>{
    call<typeof data>('','GET',undefined,{q:query,offset,limit:20}).then(r=>{if(active)setData(r)}).catch(e=>{if(active)setError(message(e))}).finally(()=>{if(active)setLoading(false)})
  },200);return()=>{active=false;clearTimeout(timer)}},[query,offset,revision])
  const select=(id:number|null)=>setParams(previous=>{const p=new URLSearchParams(previous);if(id)p.set('counterparty',String(id));else p.delete('counterparty');return p})
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
    <div className="flex flex-wrap gap-3"><Input aria-label="Поиск контрагентов" placeholder="Название или ИНН" className="sm:max-w-sm" value={query} onChange={e=>{setQuery(e.target.value);setOffset(0)}}/><Button variant="ghost" disabled={loading||busy} onClick={()=>setRevision(v=>v+1)}>Обновить список</Button>{data.can_create&&<Button variant="secondary" disabled={busy||loading||!data.items.length} onClick={()=>void previewBatch()}>Заполнить пустые поля на этой странице</Button>}</div>
    {error&&<p role="alert" className="text-sm text-danger">{error}</p>}{report&&<p role="status" className="text-sm">{report}</p>}
    {!error&&<DataTable rows={data.items} keyOf={r=>String(r.id)} loading={loading} onRowClick={r=>select(r.id)} emptyLabel="Контрагенты не найдены" columns={[
      {header:'Контрагент',accessor:r=><span className="font-medium">{r.card.name}</span>},{header:'ИНН',accessor:r=>r.card.inn||'Не заполнен'},
      {header:'Тип',accessor:r=>types[r.card.legal_type]||'Нужно уточнить'},{header:'Роль',accessor:r=>r.supplier_id?'Поставщик':r.client_id?'Клиент':'Другой контрагент'},
      {header:'Карточка',accessor:r=><Chip tone={!r.active?'neutral':r.complete?'success':'warning'}>{!r.active?'Архив':r.complete?'Заполнена':'Нужно дополнить'}</Chip>}
    ]}/>}
    <div className="flex items-center gap-3"><Button variant="ghost" disabled={!offset||loading} onClick={()=>setOffset(v=>Math.max(0,v-20))}>Назад</Button><span className="text-sm">{data.total?`${offset+1}–${Math.min(offset+20,data.total)} из ${data.total}`:'0'}</span><Button variant="ghost" disabled={offset+20>=data.total||loading} onClick={()=>setOffset(v=>v+20)}>Далее</Button></div>
    {(creating||selectedId!==null)&&<CounterpartyCard key={creating?'new':selectedId} id={creating?null:selectedId} close={()=>{setCreating(false);select(null)}} saved={()=>setRevision(v=>v+1)} openProfile={id=>void openProfile(id)}/>}
    <SupplierDetailDrawer supplierId={profile} onClose={()=>{setProfile(null);setRevision(v=>v+1)}}/>
    <Modal open={batch!==null} onClose={()=>{if(!busy)setBatch(null)}} title="Заполнение пустых реквизитов" width="max-w-2xl" footer={<><Button variant="ghost" disabled={busy} onClick={()=>setBatch(null)}>Закрыть</Button><Button disabled={busy||!batch?.some(r=>r.preview)} onClick={()=>void applyBatch()}>{busy?'Применение…':'Подтвердить заполнение пустых полей'}</Button></>}>
      <p className="mb-3 text-sm">Обрабатываются только карточки этой страницы. Заполненные значения сохранятся. Для следующих карточек перейдите на следующую страницу.</p>
      {batch?.map(item=><div key={item.id} className="mb-3 rounded-lg border border-border p-3"><strong>{data.items.find(r=>r.id===item.id)?.card.name||`Карточка №${item.id}`}</strong>{item.preview?<><p className="text-sm">Пустых полей для заполнения: {item.preview.changes.filter(c=>c.fill_empty).length}. Конфликтов оставляем без замены: {item.preview.changes.filter(c=>!c.fill_empty).length}.</p><p className="text-xs text-muted">{item.preview.source.kind==='moysklad_live'?'МойСклад сейчас':'Сохранённый снимок'} · {new Date(item.preview.source.fetched_at).toLocaleString('ru-RU')}</p>{item.preview.warnings.map(w=><p key={w} className="text-xs text-muted">{w}</p>)}</>:<p className="text-sm text-danger">{typeof item.error==='string'?item.error:typeof item.error==='object'&&item.error&&'detail' in item.error?String(item.error.detail):'Не удалось обновить карточку'}</p>}</div>)}
    </Modal>
  </div>
}
