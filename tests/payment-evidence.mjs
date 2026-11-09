import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const base=process.env.SMOKE_BASE_URL??'http://127.0.0.1:5184',output='../../output/financial-workspace-20261109'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true}),errors=[],requests=[],saved=[]
let actor='accountant',version=0,verified=false,reject=false,unavailable=false
const documents=[],versions=[]
const responsible={id:4,name:'Татьяна · тест'},stamp='2026-11-09T12:00:00Z'
const review=()=>({state:version?verified?'verified':'pending':documents.length?'unclassified':'no_document',version,issues:[]})
const detail=()=>({movement:{id:7,amount:'100.01',tax:'10',currency:'RUB',payment_purpose:'Оплата цеха',external_number:'7',doc_date:stamp},source_hash:'a'.repeat(64),status:'posted',counterparty:'Арендодатель · тест',account:'Основной счёт',review:review(),responsible,can_edit:true,can_check:actor==='accountant',documents,versions})
const context=await browser.newContext({viewport:{width:1440,height:1000}})
await context.addInitScript(()=>localStorage.setItem('soborbum.auth.token','synthetic-token'))
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
const settle=()=>page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))))
await page.route('**/api/**',async route=>{
 const request=route.request(),url=new URL(request.url()),path=url.pathname;requests.push(path)
 let body=[],status=200
 if(path==='/api/auth/me')body={id:actor==='accountant'?4:1,full_name:actor==='accountant'?responsible.name:'Руководитель · тест',role:'admin',job_role:actor,email:actor+'@test.invalid',is_active:true,module_access:{accounting:'full',costing:'full'}}
 else if(path==='/api/auth/me/workspace')body={view:actor,blocks:[],sections:[]}
 else if(path==='/api/dashboard/today')body={generated_at:stamp,actions:[],widgets:[],ai_configured:false}
 else if(path==='/api/dashboard/aktualnoe')body={items:[]}
 else if(path==='/api/accounting/organizations')body=[{id:1,name:'Организация · тест',short_name:'Организация',is_active:true,accounts:[{id:1,name:'Основной счёт',is_active:true,is_default:true,currency:'RUB',organization_id:1}]}]
 else if(path==='/api/accounting/money-summary')body={organizations:[],totals:{income:0,expense:0}}
 else if(path==='/api/accounting/evidence/overview'){
   if(unavailable){status=503;body={detail:'Сводка временно недоступна'}}
   else body={as_of:stamp,counts:{no_document:2,unclassified:1,pending:version&&!verified?1:0,stale:0,verified:verified?1:0,to_pay:0},totals:[{currency:'RUB',income:'100000',expense:'100.01',net:'99899.99',unverified_expense:verified?'0':'100.01'}],items:[{id:7,date:stamp,amount:'100.01',currency:'RUB',status:'posted',purpose:'Оплата цеха',counterparty:'Арендодатель · тест',account:'Основной счёт',review:review()}],total:1,responsible,bank_reconciled:false,actual_profit_available:false}
 }else if(path==='/api/accounting/evidence/options')body={categories:{factory:'Цех',staff:'Штатные сотрудники',materials:'Материалы',not_cost:'Не относится к затратам'},projects:[{id:3,number:'П-003',title:'Дом · тест'}]}
 else if(path==='/api/accounting/evidence/movements/7')body=detail()
 else if(path==='/api/accounting/evidence/movements/7/documents'&&request.method()==='POST'){
   documents.push({id:1,filename:'Счёт.pdf',sha256:'b'.repeat(64),size_bytes:500,integrity:'matches',created_at:stamp});status=201;body={file_id:1}
 }else if(path==='/api/accounting/evidence/movements/7/versions'){
   const payload=request.postDataJSON();saved.push(payload)
   if(reject){status=409;body={detail:'Платёж изменился; обновите карточку'}}
   else {version++;verified=false;versions.unshift({version,actor:'Татьяна · тест',created_at:stamp,data:payload,proofs:{'1':{filename:'Счёт.pdf',sha256:'b'.repeat(64)}},check:null});status=201;body=detail()}
 }else if(path==='/api/accounting/evidence/movements/7/check'){
   assert.equal(actor,'accountant');assert.equal(request.postDataJSON().confirmed,true);verified=true;versions[0].check={actor:responsible.name,created_at:stamp,reason:'Сверено лично'};body=detail()
 }else if(path==='/api/costing/governance/queue')body={items:[],estimates:[{id:3,version:2,title:'Дом · тест',number:'П-003',state:{production_approved:true,accounting_approved:true,director_approved:false,next_stage:'director'}}]}
 else if(path==='/api/costing/governance/month-plans')body=[]
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
})
try{
 await page.goto(base+'/accounting');await page.getByRole('heading',{name:'Деньги и подтверждения'}).waitFor()
 await page.getByRole('button',{name:/Платёж №7/}).waitFor();await page.screenshot({path:output+'/accounting-desktop.png',fullPage:true})
 await page.getByRole('button',{name:/Платёж №7/}).click()
 await page.getByLabel('Добавить документ платежа').setInputFiles({name:'Счёт.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nsynthetic')})
 await page.getByRole('button',{name:'Счёт.pdf',exact:true}).waitFor()
 await page.getByLabel('Назначение операции',{exact:true}).selectOption('expense')
 await page.getByLabel('Документ на сумму и налог платежа',{exact:true}).selectOption('1')
 await page.getByLabel('Страница / строки суммы и налога',{exact:true}).fill('Страница 1, итог и налог')
 await page.getByLabel('Статья строки 1',{exact:true}).selectOption('factory')
 await page.getByLabel('Месяц строки 1',{exact:true}).fill('2026-11')
 await page.getByLabel('Основание разнесения',{exact:true}).fill('Аренда цеха за ноябрь по счёту')
 reject=true
 await page.getByRole('button',{name:'Сохранить версию для проверки'}).click()
 await page.getByRole('alert').waitFor();assert.equal(await page.getByLabel('Основание разнесения',{exact:true}).inputValue(),'Аренда цеха за ноябрь по счёту')
 reject=false
 await page.getByRole('button',{name:'Сохранить версию для проверки'}).click()
 await page.getByRole('heading',{name:'Личная проверка бухгалтера'}).waitFor()
 assert.equal(saved.at(-1).allocations[0].evidence.file_id,1);assert.equal(saved.at(-1).allocations[0].amount,'100.01');assert.equal(saved.at(-1).allocations[0].month,'2026-11-01')
 await page.getByRole('checkbox',{name:'Я лично сверила документы и разнесение этой версии'}).check()
 await page.getByLabel('Комментарий проверки').fill('Сумма, налог и месяц сверены лично')
 await page.getByRole('button',{name:'Подтвердить проверку документов'}).click()
 await page.getByRole('dialog').getByText('Документы проверены',{exact:true}).waitFor()
 await page.setViewportSize({width:390,height:844});assert.ok(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1))
 await settle();await page.screenshot({path:output+'/accounting-review-mobile.png'});await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0)
 await page.goto(base+'/accounting');await page.getByRole('button',{name:/Платёж №7/}).waitFor();await settle()
 assert.ok((await page.getByRole('button',{name:/Платёж №7/}).boundingBox()).y<844,'First payment should be visible on mobile')
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await page.screenshot({path:output+'/accounting-mobile.png',fullPage:true})
 actor='director';verified=false
 await page.goto(base+'/accounting?tab=review&evidence=7');await page.getByRole('heading',{name:'Личная проверка бухгалтера'}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Подтвердить проверку документов'}).count(),0)
 await page.goto(base+'/today');await page.getByRole('heading',{name:'Решения и состояние дел'}).waitFor()
 await page.getByRole('button',{name:/Дом · тест/}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await settle();await page.screenshot({path:output+'/director-mobile.png',fullPage:true})
 await page.setViewportSize({width:1440,height:1000});await settle();await page.screenshot({path:output+'/director-desktop.png',fullPage:true})
 unavailable=true;await page.getByRole('button',{name:'Обновить данные',exact:true}).click();await page.getByRole('alert').filter({hasText:'Деньги и документы не загружены'}).waitFor()
 assert.ok(await page.getByRole('button',{name:/Без документов/}).innerText().then(t=>t.includes('—')&&t.includes('Данные недоступны')))
 assert.deepEqual(errors,[])
 const report={default_overview:true,scoped_document_and_month:true,personal_accounting_only:true,conflict_preserves_inputs:true,unavailable_is_not_zero:true,mobile_without_overflow:true,pageErrors:errors}
 await writeFile(output+'/ui-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}catch(e){await page.screenshot({path:output+'/failure.png',fullPage:true});console.log(JSON.stringify({errors,saved,body:(await page.locator('body').innerText()).slice(-6000)}));throw e}finally{await browser.close()}
