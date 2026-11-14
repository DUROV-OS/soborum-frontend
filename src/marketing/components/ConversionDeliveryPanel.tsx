import { useState } from 'react'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

type Batch = {id:number; status:string; version:number; row_count:number; payload_sha256:string;
  platform_upload_id:string|null; matched_rows:number|null; created_at:string}
export type DeliveryReport = {automatic_enabled:boolean; exportable_now:number; target:string; note:string;
  sent_confirmed?:number|null; matched_rows_confirmed?:number|null; attribution_check_pending?:boolean;
  last_checked_at?:string|null; batches?:Batch[]}
const names:Record<string,string> = {prepared:'Файл подготовлен', uploading:'Начата загрузка',
  submitted:'Принято Метрикой', processed:'Обработано Метрикой', uncertain:'Нужна сверка загрузки', rejected:'Отклонено'}
const transitions:Record<string,string[]> = {uploading:['submitted','uncertain','rejected'],
  uncertain:['submitted','rejected'], submitted:['processed','uncertain','rejected'], processed:['processed']}
const field = 'rounded border border-border bg-surface px-3 py-2 text-sm'
const figure = (value:number|null|undefined) => value == null ? 'Нет подтверждения' : String(value)

export function ConversionDeliveryPanel({delivery,canManage,onChanged,onError}:{delivery:DeliveryReport;
  canManage:boolean;onChanged:()=>Promise<void>;onError:(message:string)=>void}) {
  const [busy,setBusy] = useState(false)
  const [selected,setSelected] = useState<Batch|null>(null)
  const [status,setStatus] = useState('submitted')
  const [uploadId,setUploadId] = useState('')
  const [matched,setMatched] = useState('')
  const [note,setNote] = useState('')
  async function perform(action:()=>Promise<unknown>) {
    if(busy)return
    setBusy(true);onError('')
    try {await action();await onChanged()}
    catch(error) {onError(error instanceof Error?error.message:'Не удалось обновить передачу')}
    finally {setBusy(false)}
  }
  async function prepare() {
    const batch=await apiRequest<{id:number|null}>({section:'marketing',path:'/conversion-delivery/batches',method:'POST'})
    if(batch.id)await download(batch.id)
  }
  async function download(id:number) {
    const data=await apiRequest<{csv:string;filename:string}>({section:'marketing',path:`/conversion-delivery/batches/${id}/file`})
    const url=URL.createObjectURL(new Blob([data.csv],{type:'text/csv;charset=utf-8'}))
    const link=document.createElement('a');link.href=url;link.download=data.filename;link.click();URL.revokeObjectURL(url)
  }
  async function acknowledge(batch:Batch,next:string) {
    await apiRequest({section:'marketing',path:`/conversion-delivery/batches/${batch.id}/acknowledge`,method:'POST',
      body:{expected_version:batch.version,status:next,sha256:batch.payload_sha256,
        ...(uploadId.trim()?{upload_id:uploadId.trim()}:{}),
        ...(next==='processed'&&matched.trim()!==''?{matched_rows:Number(matched)}:{}),note}})
    setSelected(null)
  }
  function edit(batch:Batch) {
    setSelected(batch);setStatus((transitions[batch.status]||[])[0]||'uncertain')
    setUploadId(batch.platform_upload_id||'');setMatched(batch.matched_rows==null?'':String(batch.matched_rows));setNote('')
  }
  return <div className="space-y-3">
    <p className="text-sm text-muted">{delivery.note}</p>
    <div className="grid gap-3 sm:grid-cols-3">
      {[['Готовы к передаче',delivery.exportable_now],['Обработано Метрикой',delivery.sent_confirmed],
        ['Подтверждена связь с визитом',delivery.matched_rows_confirmed]].map(([label,value])=><div key={String(label)} className="rounded border border-border p-3"><div className="text-xs text-muted">{label}</div><div className="mt-1 font-medium">{figure(value as number|null|undefined)}</div></div>)}
    </div>
    {delivery.attribution_check_pending&&<p className="text-sm text-amber-800">Файл обработан, связь с визитами ещё проверяется. Это разные этапы.</p>}
    <p className="text-xs text-muted">{delivery.automatic_enabled?'Ежедневная передача включена, плановая проверка в 11:00 Москвы.':'Ежедневная передача выключена.'}{delivery.last_checked_at?` Последняя проверка: ${new Date(delivery.last_checked_at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}.`:''}</p>
    {canManage&&<div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={()=>void perform(()=>apiRequest({section:'marketing',path:'/conversion-delivery/control',method:'POST',body:{enabled:!delivery.automatic_enabled}}))}>{delivery.automatic_enabled?'Приостановить ежедневную передачу':'Включить ежедневную передачу'}</Button>
      <Button disabled={busy||!delivery.exportable_now} onClick={()=>void perform(prepare)}>Подготовить передачу ({delivery.exportable_now})</Button>
      <a className="self-center text-sm underline" target="_blank" rel="noreferrer" href="https://metrika.yandex.ru/settings?tab=uploads&id=95674381">Открыть Метрику</a>
    </div>}
    {canManage&&!!delivery.batches?.length&&<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Передача','Состояние','Связь с визитами','Действие'].map(label=><th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{delivery.batches.map(batch=><tr className="border-t border-border" key={batch.id}>
      <td className="p-2">№{batch.id} · {batch.row_count} обращений<div className="text-xs text-muted">{new Date(batch.created_at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}</div></td>
      <td className="p-2">{names[batch.status]||batch.status}{batch.platform_upload_id&&<div className="text-xs text-muted">Загрузка Метрики №{batch.platform_upload_id}</div>}</td>
      <td className="p-2">{figure(batch.matched_rows)}</td>
      <td className="p-2"><div className="flex flex-wrap gap-2">{batch.status==='prepared'?<><Button disabled={busy} onClick={()=>void perform(()=>download(batch.id))}>Скачать файл</Button><Button disabled={busy} onClick={()=>void perform(()=>acknowledge(batch,'uploading'))}>Начать загрузку</Button></>:transitions[batch.status]?.length?<Button disabled={busy} onClick={()=>edit(batch)}>Указать результат</Button>:null}</div></td>
    </tr>)}</tbody></table></div>}
    <p className="text-xs text-muted">Скачивание файла не подтверждает отправку. После начала загрузки повторная выгрузка блокируется до сверки с Метрикой. Контакты клиента и содержание разговора в файл не включаются. История передач ведётся с момента подключения очереди.</p>
    <Modal open={!!selected} onClose={()=>{if(!busy)setSelected(null)}} title={`Результат передачи №${selected?.id??''}`} footer={<Button disabled={busy||((status==='submitted'||status==='processed')&&!/^\d{1,80}$/.test(uploadId))||(status==='processed'&&matched!==''&&(!/^\d+$/.test(matched)||Number(matched)>(selected?.row_count??0)))} onClick={()=>selected&&void perform(()=>acknowledge(selected,status))}>Сохранить результат</Button>}>
      <div className="space-y-3">
        <p className="text-sm text-muted">Запишите фактический результат из Метрики. Обработка файла не доказывает привязку к визиту.</p>
        <label className="flex flex-col gap-1 text-sm">Состояние<select className={field} value={status} onChange={event=>setStatus(event.target.value)}>{(selected?transitions[selected.status]||[]:[]).map(value=><option key={value} value={value}>{names[value]}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">Номер загрузки из Метрики<input className={field} inputMode="numeric" maxLength={80} value={uploadId} onChange={event=>setUploadId(event.target.value)}/></label>
        {status==='processed'&&<label className="flex flex-col gap-1 text-sm">Подтверждено привязанных строк<input className={field} inputMode="numeric" value={matched} onChange={event=>setMatched(event.target.value)} placeholder="Оставьте пустым, если ещё неизвестно"/></label>}
        <label className="flex flex-col gap-1 text-sm">Пояснение<textarea className={field} maxLength={500} value={note} onChange={event=>setNote(event.target.value)} placeholder="Без телефонов и других личных данных"/></label>
      </div>
    </Modal>
  </div>
}
