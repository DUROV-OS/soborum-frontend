import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { Project, ProjectOptions, projectError, projectOptions, request } from './projectsApi'

export function ProjectEditor({ initial, onClose, onSaved }: { initial?: Project; onClose:()=>void; onSaved:(id:number|null)=>void }) {
  const actor = useAuthStore(s=>s.current)
  const [options,setOptions] = useState<ProjectOptions|null>(null), [search,setSearch] = useState('')
  const [name,setName] = useState(initial?.name||''), [description,setDescription] = useState(initial?.description||'')
  const [owner,setOwner] = useState(initial?.owner_id||actor?.id||0), [members,setMembers] = useState(initial?.members.map(m=>m.id)||[])
  const [deadline,setDeadline] = useState(initial?.deadline||''), [status,setStatus] = useState(initial?.status||'active')
  const linked=(kind:string)=>initial?.links.find(link=>link.kind===kind)?.id||0
  const [client,setClient]=useState(linked('client_id')), [deal,setDeal]=useState(linked('deal_id')), [production,setProduction]=useState(linked('production_id'))
  const [error,setError]=useState(''), [busy,setBusy]=useState(false)
  const attempt=useRef<{json:string;key:string}|null>(null)
  useEffect(()=>{let active=true;const timer=setTimeout(()=>{projectOptions(search).then(value=>{if(active){setOptions(value);setError('')}}).catch(err=>{if(active)setError(projectError(err))})},200);return()=>{active=false;clearTimeout(timer)}},[search])
  async function save(){
    if(!options||busy)return
    const body={name:name.trim(),description,owner_id:owner,member_ids:[...new Set([...members,owner])],deadline:deadline||null,...(options.can_link_clients?{client_id:client||null,deal_id:deal||null}:{}),...(options.can_link_production?{production_id:production||null}:{})}
    const json=JSON.stringify(body);if(attempt.current?.json!==json)attempt.current={json,key:crypto.randomUUID()}
    setBusy(true);setError('')
    try{const result=await request<Project & {removed?:boolean}>(initial?`/${initial.id}`:'/',initial?'PATCH':'POST',initial?{...body,version:initial.version,status}:{...body,request_id:attempt.current!.key});onSaved(result.removed?null:result.id)}catch(err){setError(projectError(err))}finally{setBusy(false)}
  }
  const people=[...(options?.people||[]),...(initial?.members.filter(member=>!options?.people.some(p=>p.id===member.id))||[])]
  const selectLink=(label:string,value:number,set:(value:number)=>void,rows:{id:number;name:string}[])=><Field label={label}><Select value={value} onChange={e=>set(Number(e.target.value))} disabled={busy}><option value={0}>Не связан</option>{value>0&&!rows.some(row=>row.id===value)&&<option value={value}>Запись №{value}</option>}{rows.map(row=><option key={row.id} value={row.id}>№{row.id} · {row.name}</option>)}</Select></Field>
  return <Modal open onClose={()=>{if(!busy)onClose()}} title={initial?'Настройки проекта':'Новый проект'} width="max-w-2xl" footer={<Button disabled={busy||!options||!name.trim()||!owner} onClick={()=>void save()}>{busy?'Сохранение…':initial?'Сохранить изменения':'Создать проект'}</Button>}>
    <div className="space-y-4">{error&&<p role="alert" className="text-sm text-danger">{error}</p>}
      <Field label="Название проекта" required><Input value={name} maxLength={200} disabled={busy} onChange={e=>setName(e.target.value)} placeholder="Например, дом Барн DH 64"/></Field>
      <Field label="Описание"><Textarea value={description} maxLength={10000} disabled={busy} onChange={e=>setDescription(e.target.value)} rows={3}/></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Ответственный"><Select value={owner} disabled={busy||!options} onChange={e=>setOwner(Number(e.target.value))}>{people.filter(p=>p.active).map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</Select></Field><Field label="Плановый срок"><Input type="date" value={deadline} disabled={busy} onChange={e=>setDeadline(e.target.value)}/></Field></div>
      <fieldset className="rounded-xl border border-border p-3"><legend className="px-1 text-sm font-semibold">Участники проекта</legend><p className="mb-3 text-xs text-muted">Участники видят обсуждение и файлы. Ответственный управляет составом команды. Руководитель с административным доступом видит все проекты.</p><div className="grid max-h-48 gap-2 overflow-auto sm:grid-cols-2">{people.map(person=><label key={person.id} className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" disabled={busy||person.id===owner} checked={person.id===owner||members.includes(person.id)} onChange={e=>setMembers(old=>e.target.checked?[...old,person.id]:old.filter(id=>id!==person.id))}/>{person.name}{!person.active?' · отключён':''}</label>)}</div></fieldset>
      {options&&(options.can_link_clients||options.can_link_production)&&<fieldset className="space-y-3 rounded-xl border border-border p-3"><legend className="px-1 text-sm font-semibold">Связанные записи</legend><Input aria-label="Поиск связанных записей" placeholder="Найти клиента, сделку или производство" value={search} onChange={e=>setSearch(e.target.value)}/><p className="text-xs text-muted">Поиск показывает до 50 последних совпадений в каждом доступном разделе.</p>{options.can_link_clients&&<>{selectLink('Клиент',client,setClient,options.clients)}{selectLink('Сделка',deal,setDeal,options.deals)}</>}{options.can_link_production&&selectLink('Производство дома',production,setProduction,options.productions)}</fieldset>}
      {initial&&<Field label="Состояние проекта"><Select value={status} disabled={busy} onChange={e=>setStatus(e.target.value as typeof status)}><option value="active">В работе</option><option value="completed">Завершён</option><option value="archived">В архиве</option></Select></Field>}
    </div>
  </Modal>
}
