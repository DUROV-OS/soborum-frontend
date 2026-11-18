import { Card, labels, types } from './api'

export function HistoryChanges({ before, after }: { before?:Card;after:Card }) {
  const values=(card?:Card):Record<string,string>=>{
    if(!card)return {}
    const result:Record<string,string>={}
    for(const [key,value] of Object.entries(card)){
      if(key==='accounts')result[key]=card.accounts.map(r=>`${r.bank_name || 'Банк не указан'} · ${r.account_number} · БИК ${r.bik} · корр. счёт ${r.correspondent_account || 'не указан'}${r.bank_address ? ' · '+r.bank_address : ''}${r.primary?' · основной':''}${r.archived?' · архив':''}`).join('\n')
      else if(key==='contacts')result[key]=card.contacts.map(r=>[r.name,r.phone,r.email,r.primary?'основной':'',r.archived?'архив':''].filter(Boolean).join(' · ')).join('\n')
      else result[key]=typeof value==='boolean'?(value?'Да':'Нет'):types[String(value)]||String(value||'')
    }
    return result
  }
  const old=values(before),next=values(after),changed=Object.keys(next).filter(key=>(old[key]||'')!==(next[key]||''))
  return <div className="mt-3 space-y-3">{changed.length ? changed.map(key=><div key={key} className="rounded-md bg-surface-muted p-3"><strong className="text-xs">{labels[key]||({accounts:'Банковские счета',contacts:'Контактные лица',addresses_same:'Адреса совпадают'} as Record<string,string>)[key]||key}</strong><div className="mt-2 grid gap-2 sm:grid-cols-2"><p className="whitespace-pre-wrap break-words text-xs text-muted">Было: {old[key]||'Не заполнено'}</p><p className="whitespace-pre-wrap break-words text-xs">Стало: {next[key]||'Не заполнено'}</p></div></div>):<p className="text-xs text-muted">Значения реквизитов не изменились.</p>}</div>
}
