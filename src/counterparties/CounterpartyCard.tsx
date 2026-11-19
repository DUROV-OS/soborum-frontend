import { useEffect, useRef, useState } from 'react'
import { ApiError, downloadFile } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { Tabs } from '@/shared/ui/Tabs'
import { DocumentInput } from '@/purchasing/PurchaseControlForms'
import { CardForm } from './CardForm'
import { Documents } from './Documents'
import { HistoryChanges } from './HistoryChanges'
import { useAuthStore } from '@/auth/store'
import { blank, call, Card, labels, message, Preview, Row, statusLabels, types } from './api'

type History = { id:number;actor_id:number;created_at:string;before:Row|null;after:Row;source:{kind:string;proof?:{role:'supplier'|'client';filename:string;locator:string}};kind?:string }
export function CounterpartyCard({ id, close, saved, openProfile }: { id:number|null; close:()=>void; saved:()=>void; openProfile:(id:number)=>void }) {
  const canOpenProfile=useAuthStore(s=>s.hasAccess('warehouse'))
  const canReadClient=useAuthStore(s=>s.hasAccess('clients'))
  const canReadAccounting=useAuthStore(s=>s.hasAccess('accounting'))
  const [row,setRow]=useState<Row|null>(null), [form,setForm]=useState<Card>(blank), [supplier,setSupplier]=useState(true)
  const [tab,setTab]=useState<'requisites'|'documents'|'history'>('requisites'), [history,setHistory]=useState<History[]>([]), [historyOffset,setHistoryOffset]=useState(0)
  const [loading,setLoading]=useState(id!==null), [busy,setBusy]=useState(false), [error,setError]=useState(''), [errors,setErrors]=useState<Record<string,string>>({})
  const [preview,setPreview]=useState<Preview|null>(null), [selected,setSelected]=useState<string[]>([]), [evidence,setEvidence]=useState({file_id:0,locator:''})
  const retry=useRef({key:'',id:''}), content=useRef<HTMLDivElement>(null)
  const dirty=row && JSON.stringify(form)!==JSON.stringify(row.card), canEdit=id===null || !!row?.can_edit
  const accept=(r:Row)=>{setRow(r);setForm(r.card);setErrors({});setError('')}
  useEffect(()=>{if(id===null)return;let active=true;call<Row>(`/${id}`).then(r=>{if(active)accept(r)}).catch(e=>{if(active)setError(message(e))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[id])
  useEffect(()=>{if(tab!=='history'||!row)return;let active=true;setLoading(true);call<History[]>(`/${row.id}/history`,'GET',undefined,{offset:historyOffset}).then(r=>{if(active)setHistory(r)}).catch(e=>{if(active)setError(message(e))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[tab,row?.id,historyOffset])
  const requestId=(key:unknown)=>{const value=JSON.stringify(key);if(value!==retry.current.key)retry.current={key:value,id:crypto.randomUUID()};return retry.current.id}
  const focusError=()=>requestAnimationFrame(()=>content.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus())
  const fail=(e:unknown)=>{setError(message(e));if(e instanceof ApiError&&e.data?.fields){setErrors(e.data.fields as Record<string,string>);focusError()}}
  async function save(){const missing:Record<string,string>={};if(!form.name.trim())missing.name='Укажите наименование';if(id===null&&!row){if(!form.inn.trim())missing.inn='Укажите ИНН';if(!form.legal_type)missing.legal_type='Выберите тип контрагента'}setErrors(missing);if(Object.keys(missing).length){setError('Проверьте выделенные поля');focusError();return}setBusy(true);setError('');const data={etag:row?.etag||'',card:form,supplier};try{accept(await call<Row>(row?`/${row.id}`:'',row?'PATCH':'POST',{...data,request_id:requestId(data)}));saved()}catch(e){fail(e)}finally{setBusy(false)}}
  async function compare(){if(!row)return;setBusy(true);setError('');try{const p=await call<Preview>(`/${row.id}/moysklad/preview`,'POST');setPreview(p);setSelected(p.changes.filter(c=>c.fill_empty).map(c=>c.key))}catch(e){fail(e)}finally{setBusy(false)}}
  async function apply(){if(!row||!preview)return;setBusy(true);setError('');const data={preview_id:preview.id,fields:selected};try{accept(await call<Row>(`/${row.id}/moysklad/apply`,'POST',{...data,request_id:requestId(data)}));setPreview(null);saved()}catch(e){fail(e)}finally{setBusy(false)}}
  async function verify(){if(!row)return;setBusy(true);setError('');const data={etag:row.etag,evidence};try{accept(await call<Row>(`/${row.id}/verify-bank`,'POST',{...data,request_id:requestId(data)}));saved()}catch(e){fail(e)}finally{setBusy(false)}}
  const finish=()=>{if(busy)return;if(dirty&&!window.confirm('Закрыть карточку без сохранения изменений?'))return;close()}
  return <Modal open onClose={finish} title={preview?'Обновить данные из МойСклад':row?.card.name||(id?'Контрагент':'Новый контрагент')} width="max-w-4xl" mobileFull footer={preview?<><Button variant="ghost" disabled={busy} onClick={()=>setPreview(null)}>Отмена</Button><Button disabled={busy||!selected.length} onClick={()=>void apply()}>{busy?'Применение…':'Применить выбранное'}</Button></>:<><Button variant="ghost" disabled={busy} onClick={finish}>Закрыть</Button>{canEdit&&tab==='requisites'&&<Button disabled={busy||loading} onClick={()=>void save()}>{busy?'Сохранение…':'Сохранить'}</Button>}</>}>
    <div ref={content} className="space-y-4">{error&&<p role="alert" className="rounded-lg border border-danger/30 p-3 text-sm text-danger">{error}</p>}{loading&&<p role="status">Загрузка…</p>}
    {preview?<><p className="text-sm text-muted">{preview.source.kind==='moysklad_live'?'Данные получены сейчас из МойСклада.':'Используется сохранённый снимок. Это не запрос к МойСклад в реальном времени.'} Дата: {new Date(preview.source.fetched_at).toLocaleString('ru-RU')}.</p><p className="text-sm">Пустые поля выбраны для заполнения. Замены существующих значений отметьте отдельно.</p>
      {preview.warnings.map(w=><p key={w} className="text-xs text-muted">{w}</p>)}{!preview.changes.length&&<p>Различий для обновления нет.</p>}
      <div className="space-y-2">{preview.changes.map(c=>{const parts=c.key.split('.'),label=labels[parts[parts.length-1]]||c.key;return <label key={c.key} className="flex gap-3 rounded-lg border border-border p-3"><input type="checkbox" className="mt-1" disabled={busy} checked={selected.includes(c.key)} onChange={e=>setSelected(v=>e.target.checked?[...v,c.key]:v.filter(k=>k!==c.key))}/><div className="min-w-0 flex-1 break-words"><strong className="text-sm">{parts[0]==='accounts'?'Банк · ':parts[0]==='contacts'?'Контакт · ':''}{label}</strong><p className="text-xs text-muted">У нас: {(c.key === 'legal_type' ? types[c.old] : c.old) || c.old || 'Не заполнено'}</p><p className="text-sm">В МойСклад: {(c.key === 'legal_type' ? types[c.value] : c.value) || c.value}</p><span className="text-xs text-muted">{c.fill_empty?'Заполнение пустого поля':'Замена требует вашего выбора'}</span></div></label>})}</div>
    </>:<>
      {row&&<div className="overflow-x-auto"><Tabs tabs={[{key:'requisites' as const,label:'Реквизиты'},{key:'documents' as const,label:'Документы'},{key:'history' as const,label:'История'}]} activeKey={tab} onChange={setTab}/></div>}
      {tab==='requisites'&&(!id||row)&&<>
        {row&&<div className="flex flex-wrap gap-2">{canEdit&&<Button variant="secondary" disabled={busy||!!dirty} onClick={()=>void compare()}>Обновить данные из МойСклад</Button>}{row.supplier_id&&canOpenProfile&&<Button variant="ghost" disabled={busy} onClick={()=>{if(!dirty||window.confirm('Открыть закупочный профиль без сохранения изменений?'))openProfile(row.supplier_id!)}}>Прайс, заказы и MAX</Button>}</div>}
        {dirty&&<p className="text-xs text-muted">Перед обновлением из МойСклад сохраните изменения.</p>}
        {row&&!row.complete&&<p className="rounded-lg bg-surface-muted p-3 text-sm">Карточка требует дополнения: укажите тип и ИНН. История и существующие документы сохранены.</p>}
        {!row&&<label className="flex gap-2 text-sm"><input type="checkbox" checked={supplier} onChange={e=>setSupplier(e.target.checked)}/>Использовать в закупках как поставщика</label>}
        <CardForm value={form} change={setForm} errors={errors} disabled={!canEdit||busy||loading}/>
        {row&&<section className="space-y-3 rounded-xl border border-border p-4"><h3 className="font-semibold">Проверка банковских реквизитов</h3><p className="text-sm">{row.bank_verification.verified?'Реквизиты проверены по документу.':'Реквизиты не подтверждены для автоматической оплаты.'}</p><p className="text-xs text-muted">Ответственный: {row.bank_verification.reviewer||'бухгалтер ещё не назначен'}.</p>
          {row.supplier_id&&row.bank_verification.can_verify&&canEdit&&<><DocumentInput supplierId={row.supplier_id} value={evidence} change={setEvidence} title="Основание проверки реквизитов"/><Button disabled={busy||!!dirty||!evidence.file_id||!evidence.locator.trim()} onClick={()=>void verify()}>Подтвердить реквизиты по документу</Button></>}
        </section>}
      </>}
      {tab==='documents'&&row&&<Documents id={row.id}/>}
      {tab==='history'&&<><div className="space-y-3">{history.map(h=><article key={h.id} className="rounded-lg border border-border p-3"><p className="font-medium">{h.kind==='bank_verification'?'Проверка банковских реквизитов':h.kind==='registry_edit'?'Изменение реестра':h.before?'Изменение карточки':'Создание карточки'}</p><p className="text-xs text-muted">{new Date(h.created_at).toLocaleString('ru-RU')} · сотрудник №{h.actor_id} · {h.source.kind==='manual'?'Введено вручную':h.source.kind==='document'?'Документ':h.source.kind==='moysklad_live'?'МойСклад':'Снимок МойСклада'}</p><details className="mt-2 text-sm"><summary>Значения до и после</summary>{h.before?.status !== h.after.status && <p className="mt-2">Статус · {h.before?.status ? statusLabels[h.before.status] : '—'} → {h.after.status ? statusLabels[h.after.status] : '—'}</p>}
        {h.before?.comment !== h.after.comment && h.after.comment !== undefined && <div className="mt-2 space-y-1 whitespace-pre-wrap break-words"><p>Комментарий до: {h.before?.comment || '—'}</p><p>Комментарий после: {h.after.comment || '—'}</p></div>}
        {h.kind !== 'registry_edit' && <HistoryChanges before={h.before?.card} after={h.after.card}/>}
        </details>
        {h.source.proof && (h.source.proof.role === 'supplier' ? canReadAccounting : canReadClient) &&
          <Button variant="ghost" onClick={() => void downloadFile('counterparties', `/${id}/history/${h.id}/document`, h.source.proof!.filename).catch(fail)}>
            Скачать основание · {h.source.proof.locator}
          </Button>}</article>)}</div>{!loading&&!history.length&&<p className="text-sm text-muted">Новых изменений реквизитов ещё нет. Старая история учётных документов сохранена отдельно.</p>}<div className="flex gap-2"><Button variant="ghost" disabled={!historyOffset||loading} onClick={()=>setHistoryOffset(v=>Math.max(0,v-50))}>Назад</Button><Button variant="ghost" disabled={history.length<50||loading} onClick={()=>setHistoryOffset(v=>v+50)}>Далее</Button></div></>}
    </>}</div>
  </Modal>
}
