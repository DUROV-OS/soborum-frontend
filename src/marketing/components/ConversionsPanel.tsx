import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

type Outcome = 'unreviewed' | 'qualified' | 'unqualified' | 'spam' | 'duplicate'
type Row = { id:number; received_at:string; client_id:number|null; repeat_contact:boolean;
  source:string; medium:string; campaign:string; form:string; outcome:Outcome; version:number;
  reason:string; has_visit_id:boolean; sales_inbox_open:boolean; awaiting_quality_hours:number|null; feedback_status:string }
type Report = { total_requests:number; unique_contacts:number; qualified_unique_contacts:number; with_visit_id:number;
  unprocessed_inbox:number; can_review:boolean; can_open_clients:boolean; can_export:boolean;
  partial_today:boolean; issues:string[]; rows:Row[]; checked_at:string;
  delivery:{ automatic_enabled:boolean; exportable_now:number; target:string; note:string } }
const labels:Record<Outcome,string> = { unreviewed:'Нужна оценка', qualified:'Целевой запрос', unqualified:'Не подходит', spam:'Спам', duplicate:'Дубликат' }
const feedback:Record<string,string> = { awaiting_quality:'Ждёт оценки', excluded:'Не передаётся', ready_for_export:'Готово к выгрузке', missing_visit_id:'Нет связи с визитом', repeat_qualified_contact:'Повторный целевой контакт', outside_matching_window:'Вне срока сопоставления' }
const box = 'rounded-md border border-border bg-surface p-4'
const input = 'rounded border border-border bg-surface px-3 py-2 text-sm'
function moscowToday() { return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(new Date()) }

export function ConversionsPanel() {
  const today = moscowToday()
  const [from,setFrom] = useState(today.slice(0,8)+'01')
  const [to,setTo] = useState(today)
  const [report,setReport] = useState<Report|null>(null)
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')
  const [selected,setSelected] = useState<Row|null>(null)
  const [outcome,setOutcome] = useState<Outcome>('unreviewed')
  const [reason,setReason] = useState('')
  const [facts,setFacts] = useState([false,false,false])
  const [saving,setSaving] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setReport(await apiRequest<Report>({section:'marketing',path:'/conversions',query:{date_from:from,date_to:to}})) }
    catch(e) { setReport(null); setError(e instanceof Error?e.message:'Не удалось загрузить конверсии') }
    finally { setLoading(false) }
  },[from,to])
  useEffect(()=>{ void load() },[load])
  function edit(row:Row) { setSelected(row);setOutcome(row.outcome);setReason(row.reason);setFacts([false,false,false]);setError('') }
  async function save() {
    if (!selected || saving) return
    setSaving(true);setError('')
    try {
      await apiRequest({section:'marketing',path:`/conversions/${selected.id}/review`,method:'POST',body:{
        expected_version:selected.version,outcome,reason,contact_confirmed:facts[0],need_confirmed:facts[1],region_confirmed:facts[2]}})
      setSelected(null);await load()
    } catch(e) { setError(e instanceof Error?e.message:'Не удалось сохранить оценку') }
    finally { setSaving(false) }
  }
  async function download() {
    setError('')
    try {
      const data = await apiRequest<{csv:string;filename:string}>({section:'marketing',path:'/conversions-export'})
      const url = URL.createObjectURL(new Blob(['\uFEFF'+data.csv],{type:'text/csv;charset=utf-8'}))
      const a = document.createElement('a');a.href=url;a.download=data.filename;a.click();URL.revokeObjectURL(url)
    } catch(e) { setError(e instanceof Error?e.message:'Не удалось подготовить файл') }
  }
  return <section aria-label="Конверсии и качество обращений" className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">С<input aria-label="Начало периода конверсий" type="date" className={input} value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label className="flex flex-col gap-1 text-sm">По<input aria-label="Конец периода конверсий" type="date" className={input} value={to} onChange={e=>setTo(e.target.value)}/></label>
      <Button disabled={loading} onClick={()=>void load()}>Обновить</Button>
      <span className="text-xs text-muted">Московское время. {report?.partial_today?'Сегодняшний день ещё не завершён.':''}</span>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading && <p className="text-sm text-muted">Загружаю обращения…</p>}
    {report && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Заявки с сайта',report.total_requests],['Уникальные контакты',report.unique_contacts],['Целевые контакты',report.qualified_unique_contacts],['Связь с визитом',`${report.with_visit_id} из ${report.total_requests}`]].map(([label,value])=><div key={label} className={box}><div className="text-sm text-muted">{label}</div><div className="mt-1 text-2xl font-medium">{value}</div></div>)}
      </div>
      <div className={box}>
        <h2 className="font-medium">Обратная связь по рекламе</h2>
        <p className="mt-2 text-sm">Сначала подтвердите качество обращения по результату общения. Клик по телефону и открытие формы здесь не считаются заявкой.</p>
        {report.issues.map(issue=><p key={issue} className="mt-2 text-sm text-amber-800">{issue}</p>)}
        <p className="mt-2 text-sm text-muted">{report.delivery.note} Звонки, переписка и договоры пока не включены в этот реестр.</p>
        {report.can_export && <div className="mt-3"><Button disabled={!report.delivery.exportable_now} onClick={()=>void download()}>Подготовить файл для Метрики ({report.delivery.exportable_now})</Button><p className="mt-2 text-xs text-muted">Все пригодные подтверждённые обращения за доступное окно, независимо от фильтра таблицы. Скачивание не означает отправку.</p></div>}
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm"><thead className="bg-surface-muted"><tr>{['Получено','Источник','Качество','Обратная связь','Действие'].map(x=><th key={x} className="p-3 font-medium">{x}</th>)}</tr></thead>
        <tbody>{report.rows.map(row=><tr key={row.id} className="border-t border-border">
          <td className="p-3 whitespace-nowrap">{new Date(row.received_at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}<div className="text-xs text-muted">Обращение №{row.id}{row.repeat_contact?' · повторный контакт':''}</div></td>
          <td className="p-3">{row.source}<div className="text-xs text-muted break-all">{[row.medium,row.campaign,row.form].filter(Boolean).join(' · ')}</div></td>
          <td className="p-3">{labels[row.outcome]}{row.awaiting_quality_hours!==null && row.awaiting_quality_hours>=24 && <div className="text-xs text-amber-800">Ожидает более суток</div>}</td>
          <td className="p-3">{feedback[row.feedback_status]}{row.sales_inbox_open&&<div className="text-xs text-muted">Входящее ещё открыто</div>}</td>
          <td className="p-3"><div className="flex flex-wrap gap-2">{report.can_review&&<Button onClick={()=>edit(row)}>Оценить</Button>}{row.client_id&&<a className="underline" href={`/clients/${row.client_id}`}>Клиент</a>}</div></td>
        </tr>)}{report.rows.length===0&&<tr><td colSpan={5} className="p-5 text-muted">За выбранный период сохранённых заявок с сайта нет.</td></tr>}</tbody></table>
      </div>
      <p className="text-xs text-muted">Источник основан на сохранённых метках, это не подтверждение рекламной атрибуции. История без идентификаторов не восстанавливается догадками.</p>
    </>}
    <Modal open={!!selected} onClose={()=>{if(!saving)setSelected(null)}} title={`Оценка обращения №${selected?.id??''}`} footer={<Button disabled={saving||reason.trim().length<10||(outcome==='qualified'&&!facts.every(Boolean))} onClick={()=>void save()}>{saving?'Сохраняю…':'Сохранить оценку'}</Button>}>
      <div className="space-y-3">
        <label className="flex flex-col gap-1 text-sm">Результат<select className={input} value={outcome} onChange={e=>setOutcome(e.target.value as Outcome)}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <p className="text-sm text-muted">Оценивайте по фактам общения с клиентом. Сам по себе переход на другую стадию не подтверждает качество.</p>
        {outcome==='qualified'&&['Контакт с человеком состоялся','Потребность в нашем продукте подтверждена','Строительство возможно в согласованных регионах'].map((text,i)=><label key={text} className="flex gap-2 text-sm"><input type="checkbox" checked={facts[i]} onChange={e=>setFacts(facts.map((v,j)=>i===j?e.target.checked:v))}/>{text}</label>)}
        <label className="flex flex-col gap-1 text-sm">Основание оценки<textarea className={input} rows={4} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Что подтвердил клиент; для отказа — причина. Без телефонов и других личных данных."/></label>
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
    </Modal>
  </section>
}
