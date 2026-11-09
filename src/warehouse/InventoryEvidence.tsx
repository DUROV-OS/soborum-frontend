import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'
import { ProofInput } from './ProofInput'
import { Proof, downloadProof } from './controlApi'
import { StockDocument } from './documents'

type Act={id:number;stage:'prepared'|'posted';mode:'scan'|'electronic';actor_id:number;actor_name:string;created_at:string;proof:Proof;intact:boolean;current:boolean;snapshot:{lines:{material_id:number;title:string;unit:string;expected_quantity:string;quantity:string}[]};operation_ids:number[]}
const message=(e:unknown)=>e instanceof Error?e.message:'Не удалось загрузить акт'

export function InventoryEvidence({row,canEdit,disabled,onReady,electronic=false}:{electronic?:boolean;row:StockDocument;canEdit:boolean;disabled:boolean;onReady:(id:number|null)=>void}){
  const [acts,setActs]=useState<Act[]|null>(null),[file,setFile]=useState<Proof|null>(null),[locator,setLocator]=useState('')
  const [digitalConfirmed,setDigitalConfirmed]=useState(false)
  const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const attempt=useRef<{json:string;key:string}|null>(null)
  const ready=(values:Act[])=>onReady(row.status==='draft'?(values.find(a=>a.stage==='prepared'&&a.current)?.id??null):null)
  async function load(){const values=await apiRequest<Act[]>({section:'warehouse',path:`/inventory-evidence/${row.id}`});setActs(values);ready(values)}
  useEffect(()=>{let active=true;onReady(null);setConfirmed(false);setDigitalConfirmed(false);setError('');apiRequest<Act[]>({section:'warehouse',path:`/inventory-evidence/${row.id}`}).then(values=>{if(active){setActs(values);ready(values)}}).catch(e=>{if(active)setError(message(e))});return()=>{active=false}},[row])
  async function attach(){
    if(!file||!confirmed||busy||disabled)return
    const body={version:row.version,file_id:file.file_id,locator,confirmed:true},json=JSON.stringify(body)
    if(attempt.current?.json!==json)attempt.current={json,key:crypto.randomUUID()}
    setBusy(true);setError('')
    try{await apiRequest({section:'warehouse',path:`/inventory-evidence/${row.id}`,method:'POST',body:{...body,request_id:attempt.current!.key}});await load();setConfirmed(false)}catch(e){setError(message(e))}finally{setBusy(false)}
  }
  async function confirmElectronic(){
    if(!digitalConfirmed||busy||disabled)return
    const body={version:row.version,confirmed:true},json=JSON.stringify(body)
    if(attempt.current?.json!==json)attempt.current={json,key:crypto.randomUUID()}
    setBusy(true);setError('')
    try{await apiRequest({section:'warehouse',path:`/inventory-counts/${row.id}/confirm`,method:'POST',body:{...body,request_id:attempt.current!.key}});await load();setDigitalConfirmed(false)}catch(e){setError(message(e))}finally{setBusy(false)}
  }
  return <section className="space-y-3 rounded-xl border border-border bg-surface-muted p-4">
    <h3 className="text-sm font-semibold">Акт фактического пересчёта</h3>
    <p className="text-xs text-muted">Акт фиксирует сохранённые количества и ответственных. После проверки сотрудник с полными правами склада проводит документ и обновляет остатки.</p>
    {acts?.length===0&&<p className="text-sm text-warning">Акт пока не подтверждён.{row.status==='draft'?' До его подтверждения проведение недоступно.':''}</p>}
    {acts?.map(a=><details key={a.id} className="rounded-lg border border-border bg-surface p-3"><summary className="cursor-pointer text-sm">{a.stage==='posted'?'Проведение по акту':'Подтверждение пересчёта'} №{a.id} · {new Date(a.created_at).toLocaleString('ru-RU')} · {!a.intact?'Основание требует проверки':a.current?'Действует':a.stage==='posted'?'Проведение требует сверки':'К предыдущей версии'}</summary><div className="mt-3 space-y-2"><button className="break-all text-sm text-brand-dark underline" onClick={()=>void downloadProof(a.proof).catch(e=>setError(message(e)))}>{a.mode==='electronic'?'Скачать электронный акт':a.proof.filename}</button><p className="text-xs text-muted">{a.proof.locator} · {a.actor_name}</p><div className="max-h-56 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Материал</th><th className="p-2">Учёт</th><th className="p-2">Факт по акту</th></tr></thead><tbody>{a.snapshot.lines.map(l=><tr key={l.material_id} className="border-t border-border"><td className="p-2">{l.title}</td><td className="p-2">{l.expected_quantity}</td><td className="p-2">{l.quantity} {l.unit}</td></tr>)}</tbody></table></div></div></details>)}
    {electronic&&canEdit&&row.status==='draft'&&!row.archived&&<div className="space-y-3"><p className="text-sm">Электронный акт формируется из сохранённых пересчётов. В нём будут количества, сотрудники, время и комментарии.</p>{row.lines.some(l=>!l.count_id)&&<p className="text-sm text-warning">Сначала сохраните электронный пересчёт каждой позиции.</p>}<label className="flex gap-3 text-sm"><input type="checkbox" checked={digitalConfirmed} disabled={busy||disabled||row.lines.some(l=>!l.count_id)} onChange={e=>setDigitalConfirmed(e.target.checked)}/>Проверил все результаты пересчёта и подтверждаю электронный акт</label><Button className="min-h-12 w-full sm:w-auto" disabled={busy||disabled||!digitalConfirmed||row.lines.some(l=>!l.count_id)} onClick={()=>void confirmElectronic()}>{busy?'Формирование…':'Подтвердить электронный акт'}</Button></div>}
    {canEdit&&row.status==='draft'&&!row.archived&&<details open={!electronic}><summary className="cursor-pointer py-2 text-sm font-medium">Прикрепить бумажный акт</summary><div className="space-y-3 pt-3"><ProofInput value={file} onChange={v=>{setFile(v);setConfirmed(false)}} disabled={busy||disabled}/><Field label="Страницы и таблица акта"><Input value={locator} disabled={busy||disabled} placeholder="Стр. 1–3, ведомость фактического наличия" onChange={e=>{setLocator(e.target.value);setConfirmed(false)}}/></Field><label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy||disabled} onChange={e=>setConfirmed(e.target.checked)}/>Все фактические количества сверены с этим актом</label><Button size="sm" variant="secondary" disabled={busy||disabled||!file||!confirmed||locator.trim().length<3||row.lines.some(l=>l.quantity===null)||!row.note.trim()} onClick={()=>void attach()}>{busy?'Сохранение…':'Подтвердить акт пересчёта'}</Button></div></details>}
    {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
  </section>
}
