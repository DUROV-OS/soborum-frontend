import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import {approveItem,approveQuote} from './costing-approval-fixtures.mjs'
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:5194',out='../../output/purchase-controls-20261110'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true}),context=await browser.newContext({serviceWorkers:'block',locale:'ru-RU',viewport:{width:390,height:844}}),errors=[]
await context.addInitScript(()=>localStorage.setItem('soborbum.auth.token','synthetic-purchase-control'))
const request=context.request
async function call(path,method='get',data,role='owner'){const r=await request[method](base+'/api'+path,{data,headers:{'x-costing-test-role':role}});assert.ok(r.ok(),await r.text());return r.json()}
let role='owner',abortNext=false
const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.stack||e.message))
await page.route('**/api/**',async route=>{
 const p=new URL(route.request().url()).pathname
 if(abortNext&&p.endsWith('/price-evidence')&&route.request().method()==='POST'){abortNext=false;return route.abort('internetdisconnected')}
 if(p.startsWith('/api/ai/'))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Unavailable in isolated test'})})
 if(p==='/api/auth/me'||['/api/sales/','/api/costing/','/api/purchasing/'].some(prefix=>p.startsWith(prefix)))return route.continue({headers:{...route.request().headers(),'x-costing-test-role':role}})
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(p==='/api/auth/me/workspace'?{view:'director',blocks:[],sections:[]}:[])})
})
const scan={name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')}
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(new Date()),until='2027-12-31'
let region
async function open(id){
 await page.goto(base+'/purchasing?order='+id)
 region=page.getByRole('region',{name:'Контроль закупки'})
 await region.getByRole('button',{name:'Обновить проверку',exact:true}).waitFor()
 await region.getByText('Сверяем документы и связи…',{exact:true}).waitFor({state:'hidden'})
 assert.ok(await region.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'mobile overflow')
}
async function terms(form){
 await form.getByLabel('НДС в цене',{exact:true}).selectOption('included')
 for(const [label,value] of [['Ставка НДС, %','20'],['Доставка на единицу, с НДС','0'],['Место доставки','Цех компании'],['Партия от, ед.','1'],['Партия до, ед.','100'],['Условия оплаты','Предоплата 100%']])await form.getByLabel(label,{exact:true}).fill(value)
 const uploaded=page.waitForResponse(r=>r.url().endsWith('/documents')&&r.request().method()==='POST'&&r.status()===201)
 await form.getByLabel('Документ и место в нём: загрузить',{exact:true}).setInputFiles(scan)
 await uploaded
 await form.getByText('Загружаем документ…',{exact:true}).waitFor({state:'hidden'})
 await form.getByLabel('Документ и место в нём: файл',{exact:true}).locator('option').filter({hasText:'synthetic.png'}).last().waitFor({state:'attached'})
 await form.getByLabel('Документ и место в нём: место',{exact:true}).fill('Страница 1, цена и условия')
}
try {
 const ids=await call('/purchase-test/data')
 const imported=await call(`/costing/integration/recipes/${ids.recipe_id}/import`,'post',{warehouse:'Склад Технология'})
 const item=(await call('/costing/items?kind=template')).find(i=>i.id===imported.item_id)
 const expenses=Object.fromEntries(['labor','transport','subcontract','overhead','commercial','advertising','taxes','reserve'].map(k=>[k,'0']));expenses.evidence='Синтетическое основание'
 await call(`/costing/items/${item.id}`,'put',{version:item.version,kind:'template',title:item.title,content:{...item.content,expenses,retail_price:'1000'}})
 await approveItem(request,base,item.title)
 let quote=await call('/costing/estimates','post',{request_id:crypto.randomUUID(),title:'Проверка закупки дома',template_id:item.id,quantity:'2'})
 await approveQuote(request,base,quote.title);quote=await call(`/costing/estimates/${quote.id}`)
 const version=()=>({version:quote.version,request_id:crypto.randomUUID(),reason:'Изолированная закупка'})
 const {order_id:oid}=await call(`/costing/integration/estimates/${quote.id}/create-order`,'post',{...version(),counterparty_id:ids.buyer_id,organization_id:ids.organization_id})
 await call(`/costing/integration/estimates/${quote.id}/production-recipe`,'post',{...version(),order_id:oid,line_index:0})
 await call(`/sales/orders/${oid}/confirm`,'post',{version:1})
 const sale=await call(`/sales/orders/${oid}`)
 await call(`/sales/orders/${oid}/supply-allocations`,'post',{request_id:crypto.randomUUID(),version:sale.version,order_line:0,supplier_order_id:ids.order_id,supplier_version:1,supplier_line:0,quantity:'4'})
 await open(ids.order_id)
 scan.buffer=await page.screenshot()
 await region.getByRole('button',{name:'Статус поставщика',exact:true}).click()
 let form=page.getByRole('form',{name:'Проверка поставщика'})
 await form.getByLabel('Причина решения',{exact:true}).fill('Проверены договор и сведения о поставщике')
 await form.getByLabel('Основание статуса поставщика: загрузить',{exact:true}).setInputFiles(scan)
 await form.getByLabel('Основание статуса поставщика: файл',{exact:true}).locator('option').filter({hasText:'synthetic.png'}).waitFor({state:'attached'})
 await form.getByLabel('Основание статуса поставщика: место',{exact:true}).fill('Договор, страница 1')
 await form.getByRole('button',{name:'Сохранить личное решение',exact:true}).click()
 await region.getByText('Поставщик: проверен',{exact:true}).waitFor()
 await region.locator('summary').filter({hasText:'Документы поставщика'}).click()
 const addedDocument=page.waitForResponse(r=>r.url().endsWith('/documents')&&r.request().method()==='POST'&&r.status()===201)
 await region.getByLabel('Добавить документ поставщика',{exact:true}).setInputFiles(scan)
 await addedDocument
 await region.getByText('Поставщик: проверен',{exact:true}).waitFor()
 role='accounting'
 for(const id of [ids.previous_id,ids.order_id]){
  await open(id);await region.getByRole('button',{name:'Проверить цены',exact:true}).click()
  form=page.getByRole('form',{name:'Подтверждение цен'})
  await form.getByLabel('Номер счёта',{exact:true}).fill('СЧ-'+id)
  await form.getByLabel('Дата документа',{exact:true}).fill(today)
  await form.getByLabel('Цена действует до',{exact:true}).fill(until)
  await terms(form)
  if(id===ids.previous_id){
   await form.getByLabel('Приёмка для истории',{exact:true}).selectOption(String(ids.receipt_id))
   await form.getByLabel('Документ приёмки: файл',{exact:true}).selectOption({index:1})
   await form.getByLabel('Документ приёмки: место',{exact:true}).fill('Накладная, строка 1')
  }
  await form.scrollIntoViewIfNeeded()
  await page.screenshot({path:out+'/mobile-price-'+id+'.png',fullPage:true})
  if(id===ids.order_id)abortNext=true
  await form.getByRole('button',{name:'Подтверждаю цены и условия по документам',exact:true}).click()
  if(id===ids.order_id){await form.getByRole('alert').waitFor();assert.equal(await form.getByLabel('Номер счёта',{exact:true}).inputValue(),'СЧ-'+id);await form.getByRole('button',{name:'Подтверждаю цены и условия по документам',exact:true}).click()}
  await region.getByText('Цена: документы проверены',{exact:true}).waitFor()
 }
 await region.getByText('Условия выполнены',{exact:true}).waitFor()
 await region.getByRole('button',{name:'Добавить предложение другого поставщика',exact:true}).click()
 form=page.getByRole('form',{name:'Предложение рынка'})
 await form.getByLabel('Поставщик предложения',{exact:true}).selectOption(String(ids.competitor_id))
 await form.getByLabel('Цена предложения',{exact:true}).fill('40')
 await form.getByLabel('Номер предложения',{exact:true}).fill('КП-01')
 await form.getByLabel('Предложение действует до',{exact:true}).fill(until)
 await terms(form)
 await form.getByRole('button',{name:'Подтвердить предложение по документу',exact:true}).click()
 await region.getByText('Другой поставщик: 40 RUB',{exact:true}).waitFor()
 await region.getByRole('button',{name:'Проверить и зафиксировать согласование',exact:true}).click()
 await region.getByText('Закупка согласована по правилам',{exact:true}).waitFor()
 await region.getByRole('button',{name:'История проверок',exact:true}).click()
 await region.getByText(/Согласование по правилам ·/).waitFor()
 assert.ok(await region.evaluate(e=>e.scrollWidth<=e.clientWidth+1))
 await region.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/mobile-approved.png',fullPage:true})
 await page.setViewportSize({width:1440,height:1050});await page.screenshot({path:out+'/desktop-approved.png',fullPage:true})
 const evidence=(await call(`/purchasing/orders/${ids.order_id}/automatic-review`)).lines[0].offers[0].evidence
 const response=await request.get(base+`/api/purchasing/suppliers/${ids.competitor_id}/documents/${evidence.file_id}`)
 assert.ok(response.ok());assert.ok((await response.body()).length>0)
 await call('/purchase-test/change-price','post',{})
 await region.getByRole('button',{name:'Обновить проверку',exact:true}).click()
 await region.getByText('Нужны подтверждения',{exact:true}).waitFor()
 assert.equal((await call(`/purchasing/orders/${ids.order_id}/automatic-review`)).decision,'manual_review')
 await page.screenshot({path:out+'/desktop-stale.png',fullPage:true})
 assert.deepEqual(await call('/purchase-test/counts'),{stock_movements:0,payments:0})
 assert.deepEqual(errors,[])
 const report={real_api:true,mobile:true,desktop:true,personal_trust:true,price_and_receipt_evidence:true,competitor_quote:true,approval:true,stale_decision_blocked:true,network_retry:true,document_download:true,standalone_document_upload:true,pageErrors:errors,production_test_writes:false}
 for(const name of ['native-ui-report.json','ui-report.json'])await writeFile(out+'/'+name,JSON.stringify(report,null,2))
 console.log(JSON.stringify(report))
}catch(error){await page.screenshot({path:out+'/native-failure.png',fullPage:true});console.error(JSON.stringify({errors,url:page.url(),invalid:await page.locator('input:invalid,select:invalid,textarea:invalid').evaluateAll(els=>els.map(e=>({label:e.getAttribute('aria-label'),value:e.value,message:e.validationMessage})))}));console.error((await page.locator('body').innerText()).slice(-4000));throw error}finally{await browser.close()}
