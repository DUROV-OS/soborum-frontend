import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const base=process.env.SMOKE_BASE_URL??'http://127.0.0.1:5186',output='../../output/financial-workspace-20261109'
await mkdir(output,{recursive:true})
let pdf='%PDF-1.4\n',offsets=[0]
for(const [i,value] of ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] >>'].entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${value}\nendobj\n`}
const xref=pdf.length
pdf+='xref\n0 4\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[]
await context.addInitScript(()=>localStorage.setItem('soborbum.auth.token','synthetic-native-test'))
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
page.on('requestfailed',r=>console.log(JSON.stringify({failed:new URL(r.url()).pathname,error:r.failure()?.errorText})))
page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&r.status()>=400)console.log(JSON.stringify({path:new URL(r.url()).pathname,status:r.status()}))})
await page.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname
 if(path.startsWith('/api/accounting/')||path==='/api/auth/me'||path.startsWith('/api/costing/governance/'))return route.continue({headers:{...route.request().headers(),'x-costing-test-role':'accounting'}})
 let body=[]
 if(path==='/api/auth/me/workspace')body={view:'accountant',blocks:[],sections:[]}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
})
try{
 const initial=await context.request.get(base+'/api/accounting/evidence/overview',{headers:{'x-costing-test-role':'accounting'}})
 assert.equal(initial.status(),200);const rows=await initial.json();assert.equal(rows.counts.no_document,1);const id=rows.items[0].id
 const before=await context.request.get(base+`/api/accounting/evidence/movements/${id}`,{headers:{'x-costing-test-role':'accounting'}}).then(r=>r.json())
 await page.goto(base+`/accounting?tab=review&evidence=${id}`)
 await page.getByLabel('Добавить документ платежа').setInputFiles({name:'Синтетический счёт.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)})
 await page.getByRole('button',{name:'Синтетический счёт.pdf',exact:true}).waitFor()
 const docs=await context.request.get(base+`/api/accounting/evidence/movements/${id}`,{headers:{'x-costing-test-role':'accounting'}}).then(r=>r.json())
 assert.equal(docs.documents[0].integrity,'matches')
 await page.getByLabel('Назначение операции',{exact:true}).selectOption('expense')
 await page.getByLabel('Документ на сумму и налог платежа',{exact:true}).selectOption(String(docs.documents[0].id))
 await page.getByLabel('Страница / строки суммы и налога',{exact:true}).fill('Страница 1, сумма и налог — тест')
 await page.getByLabel('Статья строки 1',{exact:true}).selectOption('factory')
 await page.getByLabel('Месяц строки 1',{exact:true}).fill('2026-11')
 await page.getByLabel('Основание разнесения',{exact:true}).fill('Синтетическая аренда цеха за ноябрь')
 await page.getByRole('button',{name:'Сохранить версию для проверки'}).click()
 await page.getByRole('heading',{name:'Личная проверка бухгалтера'}).waitFor()
 const denied=await context.request.post(base+`/api/accounting/evidence/movements/${id}/check`,{headers:{'x-costing-test-role':'owner'},data:{request_id:crypto.randomUUID(),version:1,confirmed:true,reason:'Owner cannot replace accountant'}})
 assert.equal(denied.status(),403)
 await page.getByRole('checkbox',{name:'Я лично сверила документы и разнесение этой версии'}).check()
 await page.getByLabel('Комментарий проверки').fill('Синтетические документы сверены в изолированной базе')
 await page.getByRole('button',{name:'Подтвердить проверку документов'}).click()
 await page.getByRole('dialog').getByText('Документы проверены',{exact:true}).waitFor()
 const after=await context.request.get(base+`/api/accounting/evidence/movements/${id}`,{headers:{'x-costing-test-role':'accounting'}}).then(r=>r.json())
 assert.deepEqual(after.movement,before.movement);assert.equal(after.status,'posted');assert.equal(after.review.state,'verified');assert.equal(after.versions.length,1);assert.equal(after.versions[0].check.actor,'Тестовый бухгалтер')
 const noAccess=await context.request.get(base+'/api/accounting/evidence/overview',{headers:{'x-costing-test-role':'production'}});assert.equal(noAccess.status(),403)
 await page.screenshot({path:output+'/native-accounting-reviewed.png'})
 assert.deepEqual(errors,[])
 const report={real_api:true,synthetic_database:true,production_writes:false,pdf_bytes_verified:true,posted_payment_preserved:true,named_accountant_only:true,production_access_denied:true,pageErrors:errors}
 await writeFile(output+'/native-ui-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}catch(e){console.log(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(-4000)}));throw e}finally{await browser.close()}
