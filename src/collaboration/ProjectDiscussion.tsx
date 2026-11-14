import { useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Input, Select, Textarea } from '@/shared/ui/Field'
import { ApiError } from '@/shared/lib/httpClient'
import { Project, ProjectFile, ProjectMessage, downloadProjectFile, getMessages, projectError, request, uploadProjectFile } from './projectsApi'

export function ProjectDiscussion({project,active,onChanged,onDenied,onTask}:{project:Project;active:boolean;onChanged:()=>void;onDenied:()=>void;onTask:(message:number)=>void}){
  const [rows,setRows]=useState<ProjectMessage[]>([]),[query,setQuery]=useState(''),[more,setMore]=useState(false),[loading,setLoading]=useState(true)
  const [draft,setDraft]=useState(''),[reply,setReply]=useState<number|null>(null),[mentions,setMentions]=useState<number[]>([]),[files,setFiles]=useState<ProjectFile[]>([])
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[pendingFile,setPendingFile]=useState<File|null>(null)
  const attempt=useRef<{json:string;key:string}|null>(null),uploadKey=useRef(''),generation=useRef(0),latest=useRef(0)
  function failed(err:unknown){if(err instanceof ApiError&&(err.status===403||err.status===404)){setRows([]);onDenied()}else setError(projectError(err))}
  useEffect(()=>{
    if(!active)return
    const version=++generation.current;let timer:ReturnType<typeof setTimeout>;let first=true
    setRows([]);latest.current=0;setLoading(true);setError('')
    async function poll(){try{
      const result=await getMessages(project.id,query,0,first||query?0:latest.current)
      if(version!==generation.current)return
      const replace=first||Boolean(query)
      setRows(previous=>replace?result.items:[...previous,...result.items.filter(item=>!previous.some(old=>old.id===item.id))])
      if(first||query)setMore(result.has_more)
      if(result.items.length)latest.current=result.items[result.items.length-1].id
      if(!first&&result.items.length)onChanged()
      first=false;setError('')
    }catch(err){if(version===generation.current)failed(err)}finally{if(version===generation.current){setLoading(false);timer=setTimeout(poll,10000)}}}
    timer=setTimeout(poll,200)
    return()=>{generation.current++;clearTimeout(timer)}
  },[project.id,query,active])
  async function older(){if(!rows.length)return;setLoading(true);const version=generation.current;try{const result=await getMessages(project.id,query,rows[0].id);if(version===generation.current){setRows(old=>[...result.items.filter(item=>!old.some(existing=>existing.id===item.id)),...old]);setMore(result.has_more)}}catch(err){if(version===generation.current)failed(err)}finally{if(version===generation.current)setLoading(false)}}
  async function upload(){if(!pendingFile||busy)return;setBusy(true);setError('');try{const file=await uploadProjectFile(project.id,pendingFile,uploadKey.current);setFiles(old=>old.some(item=>item.id===file.id)?old:[...old,file]);setPendingFile(null);onChanged()}catch(err){failed(err)}finally{setBusy(false)}}
  async function send(){if(busy||(!draft.trim()&&!files.length))return;const body={body:draft,reply_to_id:reply,file_ids:files.map(file=>file.id),mention_ids:mentions};const json=JSON.stringify(body);if(attempt.current?.json!==json)attempt.current={json,key:crypto.randomUUID()};setBusy(true);setError('');try{
    const item=await request<ProjectMessage>(`/${project.id}/messages`,'POST',{...body,request_id:attempt.current!.key})
    setDraft('');setFiles([]);setReply(null);setMentions([]);attempt.current=null
    if(!query)setRows(old=>old.some(row=>row.id===item.id)?old:[...old,item].sort((a,b)=>a.id-b.id))
    onChanged()
  }catch(err){failed(err)}finally{setBusy(false)}}
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2"><Input aria-label="Поиск в обсуждении" placeholder="Найти сообщение в проекте" value={query} onChange={e=>setQuery(e.target.value)}/>{project.unread>0&&<Button size="sm" variant="secondary" disabled={!rows.length||!!query} onClick={()=>void request(`/${project.id}/read`,'POST',{message_id:rows[rows.length-1].id}).then(onChanged).catch(failed)}>Прочитано · новых {project.unread}</Button>}</div>
    {error&&<p role="alert" className="text-sm text-danger">{error} Если отправка не подтверждена, повторите её с тем же текстом — система проверит повтор.</p>}
    {more&&<Button variant="secondary" size="sm" disabled={loading} onClick={()=>void older()}>Предыдущие сообщения</Button>}
    {loading&&<p className="text-sm text-muted">Загрузка обсуждения…</p>}{!loading&&!rows.length&&<p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">{query?'Сообщения не найдены.':'Обсуждение пока пустое. Задайте первый вопрос команде проекта.'}</p>}
    <div className="space-y-3">{rows.map(row=><article id={`project-message-${row.id}`} key={row.id} className="rounded-xl border border-border bg-surface p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{row.author.name}</strong><span className="text-xs text-muted">№{row.id} · {new Date(row.created_at).toLocaleString('ru-RU')}</span></div>{row.reply_to_id&&<p className="mt-2 text-xs text-muted">Ответ на сообщение №{row.reply_to_id}</p>}{row.mentions.length>0&&<p className="mt-2 text-xs text-brand-dark">Кому: {row.mentions.map(person=>person.name).join(', ')}</p>}<p className="mt-3 whitespace-pre-wrap break-words text-sm">{row.body}</p>{row.files.map(file=><button key={file.id} className="mt-2 block max-w-full break-words text-left text-sm text-brand-dark underline" onClick={()=>void downloadProjectFile(project.id,file).catch(failed)}>{file.filename}</button>)}{project.can_write&&<div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="ghost" onClick={()=>setReply(row.id)}>Ответить</Button>{project.can_create_task&&<Button size="sm" variant="ghost" onClick={()=>onTask(row.id)}>Создать задачу</Button>}</div>}</article>)}</div>
    {project.can_write?<section className="rounded-xl border border-border bg-surface p-4"><h3 className="mb-3 font-semibold">Сообщение команде</h3>{reply&&<div className="mb-2 flex items-center gap-3 text-xs">Ответ на №{reply}<button className="text-brand-dark" onClick={()=>setReply(null)}>Отменить ответ</button></div>}<Textarea aria-label="Текст сообщения проекта" value={draft} maxLength={10000} disabled={busy} rows={3} onChange={e=>setDraft(e.target.value)} placeholder="Напишите вопрос или зафиксируйте договорённость"/>
      <div className="mt-3 flex flex-wrap items-center gap-2"><Select aria-label="Упомянуть участника" disabled={busy} value="" onChange={e=>setMentions(old=>[...new Set([...old,Number(e.target.value)])])}><option value="">Упомянуть участника…</option>{project.members.filter(person=>person.active&&!mentions.includes(person.id)).map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</Select>{mentions.map(id=><button key={id} disabled={busy} className="rounded-lg bg-surface-muted px-2 py-1 text-xs" onClick={()=>setMentions(old=>old.filter(value=>value!==id))}>@{project.members.find(p=>p.id===id)?.name} ×</button>)}</div>
      <div className="mt-3 space-y-2"><input aria-label="Файл к сообщению" type="file" disabled={busy||files.length>=10} accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt,.csv" className="max-w-full text-xs" onChange={e=>{setPendingFile(e.target.files?.[0]||null);uploadKey.current=crypto.randomUUID()}}/>{pendingFile&&<Button size="sm" variant="secondary" disabled={busy} onClick={()=>void upload()}>Загрузить {pendingFile.name}</Button>}{files.map(file=><p key={file.id} className="break-words text-xs">{file.filename} · загружен <button disabled={busy} onClick={()=>setFiles(old=>old.filter(item=>item.id!==file.id))} className="text-brand-dark">Убрать из сообщения</button></p>)}</div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="max-w-md text-xs text-muted">Внутреннее сообщение. Клиенту не отправляется. Исправления фиксируйте новым сообщением; загруженные файлы остаются в документах проекта.</p><Button disabled={busy||!!pendingFile||(!draft.trim()&&!files.length)} onClick={()=>void send()}>{busy?'Сохранение…':'Отправить команде'}</Button></div>
    </section>:<p className="text-sm text-muted">Проект закрыт для новых сообщений. История и документы доступны для просмотра.</p>}
  </div>
}
