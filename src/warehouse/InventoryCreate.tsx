import { useState } from 'react'
import { Search, Smartphone } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { useWarehouseStore } from './store'
import { createStockDocument, StockDocument } from './documents'

export function InventoryCreate({onClose,onSaved}:{onClose:()=>void;onSaved:(row:StockDocument)=>void}) {
  const materials=useWarehouseStore(s=>s.materials).filter(m=>!m.is_archived)
  const loading=useWarehouseStore(s=>s.loading)
  const warehouses=Array.from(new Set(materials.map(m=>m.warehouse))).sort()
  const [warehouse,setWarehouse]=useState(warehouses[0]||''),[all,setAll]=useState(true),[selected,setSelected]=useState<number[]>([])
  const [search,setSearch]=useState(''),[note,setNote]=useState('Плановая электронная инвентаризация'),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [key,setKey]=useState(()=>crypto.randomUUID()),[occurredAt]=useState(()=>new Date().toISOString())
  const activeWarehouse=warehouses.includes(warehouse)?warehouse:(warehouses[0]||'')
  const available=materials.filter(m=>m.warehouse===activeWarehouse)
  const ids=all?available.map(m=>m.id):selected
  const shown=available.filter(m=>(m.title+' '+m.code).toLowerCase().includes(search.toLowerCase())).slice(0,60)
  function changed(){setKey(crypto.randomUUID());setError('')}
  async function start(){
    setBusy(true);setError('')
    try{onSaved(await createStockDocument({request_id:key,kind:'inventory',warehouse:activeWarehouse,occurred_at:occurredAt,note,lines:ids.map(material_id=>({material_id,quantity:null}))}))}
    catch(e){setError(e instanceof Error?e.message:'Не удалось начать пересчёт')}finally{setBusy(false)}
  }
  return <Modal mobileFull open title="Электронная инвентаризация" onClose={()=>{if(!busy)onClose()}} width="max-w-2xl" footer={<Button className="min-h-12 w-full sm:w-auto" disabled={busy||!note.trim()||!ids.length||ids.length>5000} onClick={()=>void start()}>{busy?'Создание…':`Начать пересчёт · ${ids.length}`}</Button>}>
    <div className="space-y-5"><div className="flex gap-3 rounded-xl bg-brand/5 p-4"><Smartphone className="shrink-0 text-brand"/><p className="text-sm">Пересчитывайте товары с телефона. Сохраняйте каждую позицию и продолжайте в удобное время. Акт сформируется из ваших результатов.</p></div>
      {!warehouses.length&&<p role="status" className="text-sm text-muted">{loading?'Загружаем список товаров…':'Для начала пересчёта добавьте действующие товары на склад.'}</p>}<Field label="Склад инвентаризации"><Select disabled={busy} value={activeWarehouse} onChange={e=>{changed();setWarehouse(e.target.value);setSelected([])}}>{warehouses.map(w=><option key={w}>{w}</option>)}</Select></Field>
      <Field label="Основание инвентаризации"><Input disabled={busy} value={note} maxLength={1000} onChange={e=>{changed();setNote(e.target.value)}}/></Field>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Что пересчитываем</legend><label className="flex min-h-12 items-center gap-3 rounded-xl border border-border p-3"><input type="radio" name="inventory-scope" checked={all} disabled={busy} onChange={()=>{changed();setAll(true)}}/>Весь склад · {available.length} позиций</label><label className="flex min-h-12 items-center gap-3 rounded-xl border border-border p-3"><input type="radio" name="inventory-scope" checked={!all} disabled={busy} onChange={()=>{changed();setAll(false)}}/>Выбрать позиции</label></fieldset>
      {!all&&<div className="space-y-3"><div className="relative"><Search size={17} className="absolute left-3 top-3 text-muted"/><Input aria-label="Найти позицию для инвентаризации" className="pl-10" placeholder="Название или код товара" value={search} onChange={e=>setSearch(e.target.value)}/></div><p className="text-xs text-muted">Выбрано: {selected.length}. Показано до 60 совпадений — уточните поиск.</p><div className="space-y-2">{shown.map(m=><label key={m.id} className="flex min-h-14 items-center gap-3 rounded-xl border border-border p-3"><input type="checkbox" disabled={busy} checked={selected.includes(m.id)} onChange={e=>{changed();setSelected(v=>e.target.checked?[...v,m.id]:v.filter(id=>id!==m.id))}}/><span className="min-w-0"><span className="block text-sm font-medium">{m.title}</span><span className="text-xs text-muted">{m.code} · {m.unit}</span></span></label>)}</div></div>}
      {ids.length>5000&&<p role="alert" className="text-sm text-warning">Выберите до 5000 позиций для одного пересчёта.</p>}{error&&<p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  </Modal>
}
