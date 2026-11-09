import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const base=process.env.SMOKE_BASE_URL??'http://127.0.0.1:5192',out='../../output/actual-costs-20261109'
await mkdir(out,{recursive:true})
const stamp='2026-11-09T17:00:00Z',hash='a'.repeat(64),errors=[],requests=[]
let actor='accountant',reject=true,unavailable=false,closure='open'
const categories={materials:'Материалы в производстве',work:'Работы и подряд',factory:'Цех',staff:'Штатные сотрудники',warehouse:'Склад',realtor:'Комиссия риелтора'}
const docs=[],records=[]
const proposed={net_revenue:'1000.00',final_cost:'125.01',actual_profit:'874.99',actual_margin_percent:'87.50',below_target:false}
const options=()=>({categories,projects:[{id:3,title:'Дом · синтетический тест',number:'П-3'}],organizations:[{id:1,name:'Организация · тест'}],documents:docs,receipts:[{id:1,number:'ПР-1',date:stamp,lines:[{material_id:9,title:'Доска',quantity:10,unit_price:12.505,stock_tracked:true}]}],movements:[{id:11,material_id:9,title:'Доска',quantity:'2',production:'Дом · тест',date:'2026-11-01'}],productions:[{id:1,name:'Дом · тест',client_id:1}],shipments:[{id:1,number:'ОТ-1',order_id:1,amount:'1000'}]})
const project=()=>({id:3,title:'Дом · синтетический тест',number:'П-3',client_id:1,sales_order_id:1,source_hash:hash,recognized_direct:records.filter(r=>r.review.state==='recognized').reduce((s,r)=>s+Number(r.net_amount),0).toFixed(2),allocated_overhead:'100.00',recognized_subtotal:(100+records.filter(r=>r.review.state==='recognized').reduce((s,r)=>s+Number(r.net_amount),0)).toFixed(2),categories:{materials:'25.01'},planned_cost:'130.00',planned_price:'1000.00',issues:[],record_ids:records.map(r=>r.id),complete:closure==='approved',final_cost:closure==='approved'?'125.01':null,actual_profit:closure==='approved'?'874.99':null,actual_margin_percent:closure==='approved'?'87.50':null,overhead:{month:'2026-11-01',plan_id:1,planned_units:10,project_units:'1',recognized_month_total:'1000.00',categories:{factory:'50.00',staff:'50.00',warehouse:'0.00'},record_ids:[]},closure:{state:closure,issues:[],...(closure!=='open'?{accounting_id:1,checked_by:'Татьяна · тест',proposed_result:proposed}:{})}})
const overview=()=>({as_of:stamp,projects:[project()],records,counts:Object.fromEntries(['pending','recognized','stale','void'].map(k=>[k,records.filter(r=>r.review.state===k).length])),can_edit:true,can_check:actor==='accountant',can_approve:actor==='director',responsible:{id:4,name:'Татьяна · тест'}})
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1050}})
await context.addInitScript(()=>{localStorage.setItem('soborbum.auth.token','synthetic-cost-test');localStorage.setItem('soborbum.onboarding.accounting','1')})
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
await page.route('**/api/**',async route=>{
 const r=route.request(),p=new URL(r.url()).pathname;let body=[],status=200
 if(p==='/api/auth/me')body={id:actor==='accountant'?4:1,role:'admin',job_role:actor,full_name:actor==='accountant'?'Татьяна · тест':'Руководитель · тест',email:'test@example.invalid',is_active:true,module_access:{accounting:'full',costing:'full'}}
 else if(p==='/api/auth/me/workspace')body={view:actor,blocks:[],sections:[]}
 else if(p==='/api/accounting/organizations')body=[{id:1,name:'Организация',short_name:'Организация',is_active:true,accounts:[{id:1,organization_id:1,name:'Счёт',currency:'RUB',is_active:true,is_default:true}]}]
 else if(p==='/api/accounting/money-summary')body={organizations:[],totals:{income:0,expense:0}}
 else if(p==='/api/accounting/actual-costs'){body=overview();if(unavailable){status=503;body={detail:'Сверка временно недоступна'}}}
 else if(p==='/api/accounting/actual-costs/material-valuation')body={amount:'25.01',previous_quantity:'0'}
 else if(p==='/api/accounting/actual-costs/options')body=options()
 else if(p==='/api/accounting/actual-costs/documents'){docs.push({id:1,filename:'Акт.pdf',integrity:'matches'});body={file_id:1};status=201}
 else if(p==='/api/accounting/actual-costs/records'){
  const data=r.postDataJSON();requests.push(data)
  if(reject){status=409;body={detail:'Основание изменилось; обновите карточку'}}
  else{const id=records.length+1;body={id,version:1,source_hash:hash,data,net_amount:data.allocations[0].amount,proof:{file_id:1,filename:'Акт.pdf',sha256:hash},review:{state:'pending',issues:[]},history:[{version:1,created_at:stamp,reason:data.reason,decisions:[]}]};records.push(body);status=201}
 }else if(/\/actual-costs\/records\/\d+$/.test(p))body=records.find(r=>r.id===Number(p.split('/').at(-1)))
 else if(p.endsWith('/decisions')){const data=r.postDataJSON(),row=records.find(r=>r.id===Number(p.split('/').at(-2)));assert.equal(actor,'accountant');assert.equal(data.confirmed,true);row.review={state:data.action==='recognize'?'recognized':'void',issues:[],checked_by:'Татьяна · тест',checked_at:stamp};row.history[0].decisions.push({action:data.action,actor_id:4,created_at:stamp,reason:data.reason});body=row}
 else if(p.endsWith('/accounting-close')){assert.equal(actor,'accountant');const data=r.postDataJSON();requests.push(data);assert.deepEqual(data.production_ids,[1]);assert.deepEqual(data.shipment_ids,[1]);assert.equal(data.zero_categories.length,3);closure='awaiting_director';body=project()}
 else if(p.endsWith('/director-close')){assert.equal(actor,'director');assert.equal(r.postDataJSON().accounting_closure_id,1);closure='approved';body=project()}
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
})
const settle=()=>page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))))
async function fit(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(await page.getByRole('dialog').count())assert.ok(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1))}
try{
 await page.goto(base+'/accounting?tab=costs');await page.getByRole('heading',{name:'Затраты проектов',exact:true}).waitFor()
 await page.getByRole('button',{name:'Добавить основание'}).click()
 await page.getByLabel('Организация',{exact:true}).selectOption('1')
 await page.getByLabel('Кто выдал документ / ИНН').fill('Подрядчик · ИНН 1234567890')
 await page.getByLabel('Номер документа',{exact:true}).fill('АКТ-1')
 await page.getByLabel('Дата документа',{exact:true}).fill('2026-11-01')
 await page.getByLabel('Номер строки документа').fill('Строка 1')
 await page.getByLabel('Загрузить новый PDF или скан').setInputFiles({name:'Акт.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')})
 await page.getByLabel('Документ или скан',{exact:true}).selectOption('1')
 await page.getByLabel('Страница, сумма и подтверждение исполнения').fill('Страница 1, итог и подписи')
 await page.getByLabel('Дата фактического расхода').fill('2026-11-01')
 await page.getByLabel('Полная сумма строки, ₽').fill('100.01')
 await page.getByLabel('Налог, исключаемый из затрат, ₽').fill('0')
 await page.getByLabel('Основание налогового учёта').fill('Налог не исключается по документу')
 await page.getByLabel('Статья 1',{exact:true}).selectOption('work')
 await page.getByLabel('Сумма распределения 1, ₽').fill('100.01')
 await page.getByLabel('Проект 1',{exact:true}).selectOption('3')
 await page.getByLabel('Основание распределения 1').fill('Страница 1, работа этого дома')
 await page.getByLabel('Почему расход относится к этому проекту / месяцу').fill('Работы приняты по акту данного дома')
 await page.getByRole('button',{name:'Сохранить для проверки'}).click();await page.getByRole('alert').waitFor()
 assert.equal(await page.getByLabel('Полная сумма строки, ₽').inputValue(),'100.01')
 reject=false;await page.getByRole('button',{name:'Сохранить для проверки'}).click();await page.getByRole('button',{name:/Документ №АКТ-1/}).waitFor()
 await page.getByRole('button',{name:/Документ №АКТ-1/}).click();await page.getByRole('checkbox',{name:/Я лично сверила/}).check()
 await page.getByLabel('Результат проверки затрат').fill('Сумма, исполнение и проект сверены')
 await page.getByRole('button',{name:'Признать затраты',exact:true}).click();await page.getByRole('button',{name:/Документ №АКТ-1/}).getByText('Затраты признаны',{exact:true}).waitFor()
 await settle();await page.screenshot({path:out+'/costs-desktop.png',fullPage:true})
 await page.getByRole('button',{name:/Документ №АКТ-1/}).click();await page.getByRole('checkbox',{name:/Я лично сверила/}).check();await page.getByLabel('Результат проверки затрат').fill('Ошибка первичного основания, отмена с историей')
 await page.getByRole('button',{name:'Отменить признание / основание'}).click();await page.getByRole('dialog').getByText('Признание отменено',{exact:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Закрыть',exact:true}).click()
 assert.match(await page.getByRole('button',{name:/Документ №АКТ-1/}).innerText(),/Признание отменено/)
 await page.getByRole('button',{name:'Добавить основание'}).click();await page.getByLabel('Вид основания').selectOption('material')
 await page.getByLabel('Партия поступления и строка').selectOption('1:0');await page.getByLabel('Фактическая выдача').selectOption('11');await page.getByLabel('Количество из этой партии').fill('2')
 await page.getByText('Стоимость по поступлению: 25,01', {exact:false}).waitFor();assert.equal(await page.getByLabel('Полная сумма строки, ₽').inputValue(),'25.01');assert.equal(await page.getByLabel('Дата фактического расхода').inputValue(),'2026-11-01')
 await page.setViewportSize({width:390,height:844});await fit();await settle();await page.screenshot({path:out+'/material-mobile.png'});await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'Сверить и закрыть проект'}).click()
 await page.getByLabel('Документ сверки полноты затрат',{exact:true}).selectOption('1')
 await page.getByLabel('Страница сверки и подтверждение полного расхода материалов').fill('Акты, материалы и постоянные затраты сверены полностью')
 for(const label of ['Работы и подряд','Склад','Комиссия риелтора'])await page.getByLabel(label,{exact:true}).fill('Страница 1, подтверждено отсутствие расхода')
 await page.getByRole('checkbox',{name:'Дом · тест · №1',exact:true}).check();await page.getByRole('checkbox',{name:/№ОТ-1/}).check()
 await page.getByLabel('Документ на фактическую выручку',{exact:true}).selectOption('1');await page.getByLabel('Страница / строка выручки').fill('Страница 1, отгрузка')
 await page.getByLabel('Налог, исключаемый из выручки, ₽').fill('0');await page.getByLabel('Основание налогового расчёта').fill('Налог указан в документе')
 await page.getByRole('checkbox',{name:/Лично сверила полноту затрат/}).check();await page.getByLabel('Комментарий к закрытию').fill('Проверила весь комплект документов')
 await fit();await settle();await page.screenshot({path:out+'/closure-mobile.png'})
 await page.getByRole('button',{name:'Передать результат руководителю'}).click();await page.getByText('Ожидает руководителя',{exact:true}).waitFor()
 actor='director';await page.goto(base+'/accounting?tab=costs');await page.getByRole('button',{name:'Проверить результат'}).click()
 assert.equal(await page.getByLabel('Документ сверки полноты затрат',{exact:true}).count(),0)
 await page.getByRole('checkbox',{name:/Проверил результат и утверждаю/}).check();await page.getByLabel('Комментарий к закрытию').fill('Итог проверен руководителем')
 await page.getByRole('button',{name:'Утвердить фактический результат'}).click();await page.getByText('Результат утверждён',{exact:true}).waitFor()
 await fit();await settle();await page.screenshot({path:out+'/result-mobile.png',fullPage:true})
 unavailable=true;await page.getByRole('button',{name:'Обновить',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByText('Результат утверждён',{exact:true}).count(),0)
 assert.deepEqual(errors,[])
 const report={document_create:true,conflict_preserves_input:true,personal_recognition:true,void_refreshes_totals:true,material_decimal_preview:true,accountant_then_director:true,unavailable_hides_totals:true,mobile_without_overflow:true,pageErrors:errors}
 await writeFile(out+'/ui-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}catch(e){await page.screenshot({path:out+'/failure.png',fullPage:true});console.log(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(-5000),requests}));throw e}finally{await browser.close()}
