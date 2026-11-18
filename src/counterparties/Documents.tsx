import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Field, Input, Select } from '@/shared/ui/Field'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { call, Doc, download, message } from './api'

export function Documents({ id }: { id: number }) {
  const [filters,setFilters] = useState({ types: '', date_from: '', date_to: '' }), [offset,setOffset] = useState(0)
  const [data,setData] = useState<{items:Doc[]; total:number; warnings:string[]}>({ items:[],total:0,warnings:[] })
  const [loading,setLoading] = useState(false), [error,setError] = useState(''), [exporting,setExporting] = useState(false)
  useEffect(() => { let active=true;setLoading(true);setError('')
    call<typeof data>(`/${id}/documents`,'GET',undefined,{ types:filters.types, date_from:filters.date_from || undefined, date_to:filters.date_to || undefined,offset })
      .then(r => { if(active)setData(r) }).catch(e => { if(active){setData({items:[],total:0,warnings:[]});setError(message(e))} }).finally(() => { if(active)setLoading(false) });return () => {active=false}
  },[id,filters,offset])
  const change = (key:keyof typeof filters,value:string) => {setFilters({...filters,[key]:value});setOffset(0)}
  const exportFile = async(format:string) => {setExporting(true);setError('');try{await download(id,format,Object.fromEntries(Object.entries(filters).filter(([,v]) => !!v)))}catch(e){setError(message(e))}finally{setExporting(false)}}
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Field label="Тип документа"><Select value={filters.types} onChange={e => change('types',e.target.value)}><option value="">Все типы</option><option value="purchaseorder">Заказы поставщику</option><option value="supply">Приёмки</option><option value="facturein">Счета-фактуры</option><option value="paymentout">Исходящие платежи</option></Select></Field>
    <Field label="Дата с"><Input type="date" value={filters.date_from} onChange={e => change('date_from',e.target.value)} /></Field><Field label="Дата по"><Input type="date" value={filters.date_to} onChange={e => change('date_to',e.target.value)} /></Field></div>
    <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={exporting || loading} onClick={() => void exportFile('xlsx')}>Excel</Button><Button variant="secondary" disabled={exporting || loading} onClick={() => void exportFile('csv')}>CSV</Button><span className="self-center text-xs text-muted">Выгружаются все документы выбранного фильтра</span></div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}{data.warnings.map(w => <p key={w} className="text-xs text-muted">{w}</p>)}
    <DataTable rows={data.items} keyOf={r => r.key} loading={loading} emptyLabel="Нет доступных документов за выбранный период" columns={[
      {header:'Документ',accessor:r => <Link className="text-brand-dark underline" to={r.url}>{r.type_label} № {r.number}</Link>},
      {header:'Дата',accessor:r => r.date || '—'}, {header:'Сумма',accessor:r => r.amount===null ? 'Не указана' : `${Number(r.amount).toLocaleString('ru-RU',{minimumFractionDigits:2})} ${r.currency || '(валюта не указана)'}`},
      {header:'Статус',accessor:r => r.status}, {header:'Источник',accessor:r => r.source}]} />
    <div className="flex flex-wrap items-center gap-3"><Button variant="ghost" disabled={!offset || loading} onClick={() => setOffset(v => Math.max(0,v-50))}>Назад</Button><span className="text-sm">Всего: {data.total}</span><Button variant="ghost" disabled={offset+50>=data.total || loading} onClick={() => setOffset(v => v+50)}>Далее</Button></div>
  </div>
}
