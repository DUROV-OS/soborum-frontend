import { useEffect, useRef, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { ProofInput } from './ProofInput'
import { Proof, downloadProof } from './controlApi'

type Block = {block_material_id:number;block_name:string;unit:string;provided:string;attributed_elsewhere:string;available:string}
type Row = {movement_id:number;production_id:number;house:string;material:string;unit:string;quantity:string;source_hash:string;blocks:Block[];can_change:boolean;blocked_reason:string|null;previous:{record_id:number;proof:Proof;intact:boolean;allocations:{blocks:{block_material_id:number;quantity:string;locator?:string}[]}[]}|null}
type Result = {items:Row[];can_confirm:boolean;responsible:{id:number;name:string}|null}
const errorText=(e:unknown)=>e instanceof Error?e.message:'Не удалось выполнить сверку'
const getRows=(production_id?:number)=>apiRequest<Result>({section:'warehouse',path:'/control/reconciliation',query:{production_id}})

export function LegacyIssueReconciliation({productionId}:{productionId?:number}){
  const [data,setData]=useState<Result|null>(null),[selected,setSelected]=useState<Row|null>(null)
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
  const [values,setValues]=useState<Record<number,string>>({}),[locators,setLocators]=useState<Record<number,string>>({})
  const [file,setFile]=useState<Proof|null>(null),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false)
  const attempt=useRef<{json:string;key:string}|null>(null)
  async function load(){const result=await getRows(productionId);setData(result);return result}
  useEffect(()=>{let active=true;setData(null);setError('');getRows(productionId).then(r=>{if(active)setData(r)}).catch(e=>{if(active)setError(errorText(e))});return()=>{active=false}},[productionId])
  function choose(row:Row){setSelected(row);setFile(null);setReason('');setConfirmed(false);setError('');attempt.current=null;const prior=row.previous?.allocations[0]?.blocks||[];setValues(Object.fromEntries(prior.map(b=>[b.block_material_id,b.quantity])));setLocators(Object.fromEntries(prior.map(b=>[b.block_material_id,b.locator||''])))}
  const qty=(raw:string)=>Number(raw.trim().replace(',','.'))
  const total=selected?.blocks.reduce((sum,b)=>sum+(qty(values[b.block_material_id]||'')||0),0)||0
  const valid=!!selected&&selected.can_change&&confirmed&&!!file&&reason.trim().length>=3&&Math.abs(total-Number(selected.quantity))<0.0000001&&selected.blocks.every(b=>{const value=qty(values[b.block_material_id]||'');return Number.isFinite(value)&&value>=0&&value<=Math.max(0,Number(b.available))&&(value===0||(locators[b.block_material_id]||'').trim().length>=3)})
  async function submit(){
    if(!selected||!file||!valid||busy)return
    const body={source_hash:selected.source_hash,file_id:file.file_id,reason,confirmed:true,allocations:selected.blocks.filter(b=>qty(values[b.block_material_id]||'')>0).map(b=>({block_material_id:b.block_material_id,quantity:values[b.block_material_id].trim().replace(',','.'),locator:locators[b.block_material_id]}))}
    const json=JSON.stringify(body);if(attempt.current?.json!==json)attempt.current={json,key:crypto.randomUUID()}
    setBusy(true);setError('')
    try{await apiRequest({section:'warehouse',path:`/control/reconciliation/${selected.movement_id}`,method:'POST',body:{...body,request_id:attempt.current!.key}});setSelected(null);setNotice('Распределение подтверждено. Возврат теперь можно оформить по исходной выдаче.');await load();window.dispatchEvent(new Event('warehouse-reconciled'))}catch(e){setError(errorText(e))}finally{setBusy(false)}
  }
  if(!data?.items.length&&!error)return null
  return <section className="mb-4 space-y-3 rounded-xl border border-border bg-surface p-4">
    <div className="flex gap-3"><ClipboardCheck size={20} className="shrink-0 text-brand-dark"/><div><h2 className="text-sm font-semibold">Сверка старых выдач</h2><p className="mt-1 text-xs text-muted">Распределение подтверждает {data?.responsible?.name||'назначенный начальник производства'} по документу, отдельно для каждого блока.</p></div></div>
    {notice&&<p role="status" className="text-sm text-success">{notice}</p>}{error&&!selected&&<p role="alert" className="text-sm text-danger">{error}</p>}
    {data?.items.map(row=><div key={row.movement_id} className="rounded-lg bg-surface-muted p-3"><p className="text-sm font-medium">Выдача №{row.movement_id} · {row.material}</p><p className="mt-1 text-xs text-muted">{row.house} · {row.quantity} {row.unit} · {row.previous?(row.previous.intact?'Распределение подтверждено':'Основание требует проверки'):'Нужно распределить по блокам'}</p>{row.blocked_reason&&<p className="mt-2 text-xs text-warning">{row.blocked_reason}</p>}<div className="mt-2 flex flex-wrap gap-2">{data.can_confirm&&row.can_change&&<Button size="sm" variant="secondary" onClick={()=>choose(row)}>{row.previous?'Исправить распределение':'Сверить распределение'}</Button>}{row.previous&&<Button size="sm" variant="ghost" onClick={()=>void downloadProof(row.previous!.proof).catch(e=>setError(errorText(e)))}>Документ сверки №{row.previous.record_id}</Button>}</div></div>)}
    <Modal open={!!selected} title="Сверка распределения выдачи" width="max-w-3xl" onClose={()=>{if(!busy)setSelected(null)}} footer={<Button onClick={()=>void submit()} disabled={busy||!valid}>{busy?'Подтверждение…':'Подтвердить распределение'}</Button>}>
      {selected&&<div className="space-y-4"><p className="text-sm">Выдача №{selected.movement_id} · {selected.material} · {selected.house}. Распределите по документу ровно {selected.quantity} {selected.unit}.</p><p className="rounded-lg bg-surface-muted p-3 text-sm">Сверка подтверждает, в какие блоки уже передан материал. Для физического возврата затем оформляется отдельная операция.</p>
        <div className="space-y-3">{selected.blocks.map(b=><div key={b.block_material_id} className="rounded-lg border border-border p-3"><p className="text-sm font-medium">{b.block_name}</p><p className="mb-3 mt-1 text-xs text-muted">Учтено выданным: {b.provided} · Отнесено к другим выдачам: {b.attributed_elsewhere} · Доступно для сверки: {b.available} {b.unit}</p><div className="grid gap-3 sm:grid-cols-2"><Field label={`Количество · ${b.block_name}`}><Input inputMode="decimal" disabled={busy} value={values[b.block_material_id]||''} onChange={e=>{setValues({...values,[b.block_material_id]:e.target.value});setConfirmed(false)}}/></Field><Field label={`Страница и строка · ${b.block_name}`}><Input disabled={busy} value={locators[b.block_material_id]||''} onChange={e=>{setLocators({...locators,[b.block_material_id]:e.target.value});setConfirmed(false)}}/></Field></div></div>)}</div>
        <p className="text-sm font-semibold">Распределено: {total.toLocaleString('ru-RU',{maximumFractionDigits:6})} из {selected.quantity} {selected.unit}</p>
        <ProofInput value={file} onChange={v=>{setFile(v);setConfirmed(false)}} disabled={busy}/><Field label="Основание сверки или исправления"><Input disabled={busy} value={reason} onChange={e=>setReason(e.target.value)}/></Field>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>Количество каждого блока сверено с указанной строкой документа</label>
        <Button size="sm" variant="secondary" disabled={busy} onClick={()=>{setConfirmed(false);void load().then(r=>{const current=r.items.find(x=>x.movement_id===selected.movement_id);if(current)setSelected(current)}).catch(e=>setError(errorText(e)))}}>Обновить данные сверки</Button>
        {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
      </div>}
    </Modal>
  </section>
}
