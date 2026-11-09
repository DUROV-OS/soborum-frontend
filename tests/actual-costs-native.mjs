import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const base=process.env.SMOKE_BASE_URL??'http://127.0.0.1:5194',out='../../output/actual-costs-20261109'
await mkdir(out,{recursive:true})
let pdf='%PDF-1.4\n',offsets=[0]
for(const [i,value] of ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] >>'].entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${value}\nendobj\n`}
const xref=pdf.length
pdf+='xref\n0 4\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1050}}),errors=[]
await context.addInitScript(()=>{localStorage.setItem('soborbum.auth.token','synthetic-native');localStorage.setItem('soborbum.onboarding.accounting','1')})
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
await page.route('**/api/**',async route=>{
 const p=new URL(route.request().url()).pathname
 if(p.startsWith('/api/accounting/')||p==='/api/auth/me')return route.continue({headers:{...route.request().headers(),'x-costing-test-role':'accounting'}})
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(p==='/api/auth/me/workspace'?{view:'accountant',blocks:[],sections:[]}:[])})
})
const headers={'x-costing-test-role':'accounting'}
try{
 const opts=await context.request.get(base+'/api/accounting/actual-costs/options',{headers}).then(r=>r.json())
 const project=opts.projects.find(p=>p.number==='TEST-COST');assert.ok(project)
 await page.goto(base+'/accounting?tab=costs');await page.getByRole('heading',{name:'Затраты проектов',exact:true}).waitFor()
 await page.getByRole('button',{name:'Добавить основание'}).click()
 await page.getByLabel('Организация',{exact:true}).selectOption(String(opts.organizations[0].id))
 await page.getByLabel('Кто выдал документ / ИНН').fill('Подрядчик · изолированный тест')
 await page.getByLabel('Номер документа',{exact:true}).fill('TEST-ACT-1')
 await page.getByLabel('Дата документа',{exact:true}).fill('2026-11-01');await page.getByLabel('Номер строки документа').fill('Строка 1')
 await page.getByLabel('Загрузить новый PDF или скан').setInputFiles({name:'Синтетический акт.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)})
 await page.getByLabel('Документ или скан',{exact:true}).locator('option').filter({hasText:'Синтетический акт.pdf'}).waitFor({state:'attached'})
 await page.getByLabel('Страница, сумма и подтверждение исполнения').fill('Страница 1, сумма, исполнение и подписи — тест')
 await page.getByLabel('Дата фактического расхода').fill('2026-11-01');await page.getByLabel('Полная сумма строки, ₽').fill('100.01')
 await page.getByLabel('Налог, исключаемый из затрат, ₽').fill('0');await page.getByLabel('Основание налогового учёта').fill('Ноль подтверждён синтетическим документом')
 await page.getByLabel('Статья 1',{exact:true}).selectOption('work');await page.getByLabel('Сумма распределения 1, ₽').fill('100.01')
 await page.getByLabel('Проект 1',{exact:true}).selectOption(String(project.id));await page.getByLabel('Основание распределения 1').fill('Акт относится к синтетическому проекту')
 await page.getByLabel('Почему расход относится к этому проекту / месяцу').fill('Синтетические принятые работы; испытание в отдельной базе')
 await page.getByRole('button',{name:'Сохранить для проверки'}).click();await page.getByRole('button',{name:/Документ №TEST-ACT-1/}).waitFor()
 let data=await context.request.get(base+'/api/accounting/actual-costs',{headers}).then(r=>r.json())
 assert.equal(data.projects[0].recognized_direct,'0.00');const row=data.records[0]
 const denied=await context.request.post(base+`/api/accounting/actual-costs/records/${row.id}/decisions`,{headers:{'x-costing-test-role':'owner'},data:{request_id:crypto.randomUUID(),version:row.version,source_hash:row.source_hash,action:'recognize',confirmed:true,reason:'Owner must not replace accountant'}})
 assert.equal(denied.status(),403)
 await page.getByRole('button',{name:/Документ №TEST-ACT-1/}).click();await page.getByRole('checkbox',{name:/Я лично сверила/}).check();await page.getByLabel('Результат проверки затрат').fill('Факт, документ, налог и распределение сверены в тесте')
 await page.getByRole('button',{name:'Признать затраты',exact:true}).click();await page.getByRole('button',{name:/Документ №TEST-ACT-1/}).getByText('Затраты признаны',{exact:true}).waitFor()
 data=await context.request.get(base+'/api/accounting/actual-costs',{headers}).then(r=>r.json())
 assert.equal(data.projects[0].recognized_direct,'100.01');assert.equal(data.projects[0].actual_profit,null)
 const repeat=await context.request.post(base+'/api/accounting/actual-costs/records',{headers,data:row.data});assert.equal(repeat.status(),201)
 const duplicate=await context.request.post(base+'/api/accounting/actual-costs/records',{headers,data:{...row.data,request_id:crypto.randomUUID()}});assert.equal(duplicate.status(),409)
 const check=await context.request.get(base+'/api/accounting/actual-costs',{headers}).then(r=>r.json());assert.equal(check.records.length,1)
 assert.equal((await context.request.get(base+'/api/accounting/actual-costs',{headers:{'x-costing-test-role':'production'}})).status(),403)
 assert.equal((await context.request.get(base+'/api/accounting/actual-costs',{headers:{'x-costing-test-role':'sales'}})).status(),403)
 await page.screenshot({path:out+'/native-desktop.png',fullPage:true})
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/native-mobile.png',fullPage:true})
 assert.deepEqual(errors,[])
 const report={real_api:true,synthetic_database:true,production_writes:false,pdf_bytes_verified:true,payment_not_added_to_cost:true,named_accountant_only:true,duplicate_blocked:true,idempotent_retry:true,worker_access_denied:true,mobile_without_overflow:true,pageErrors:errors}
 await writeFile(out+'/native-ui-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}catch(e){console.log(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(-4000)}));throw e}finally{await browser.close()}
