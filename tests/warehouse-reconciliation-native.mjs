import assert from 'node:assert/strict'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:5194',out='../../output/warehouse-reconciliation-20261110'
await mkdir(out,{recursive:true})
let pdf='%PDF-1.4\n',offsets=[0]
for(const [i,v] of ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] >>'].entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${v}\nendobj\n`}
const xref=pdf.length
pdf+='xref\n0 4\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
const scan={name:'synthetic-warehouse.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)}
const browser=await chromium.launch({headless:true}),context=await browser.newContext({serviceWorkers:'block',locale:'ru-RU',viewport:{width:1440,height:1050}}),errors=[]
await context.addInitScript(()=>{localStorage.setItem('soborbum.auth.token','synthetic-warehouse-only');localStorage.setItem('soborbum.onboarding.warehouse','1')})
const request=context.request
async function call(path,method='get',data,as='owner'){const r=await request[method](base+'/api'+path,{data,headers:{'x-costing-test-role':as}});assert.ok(r.ok(),await r.text());return r.json()}
let role='accounting'
const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.stack||e.message))
await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname;if(p.startsWith('/api/ai/'))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'ИИ не подключён в изолированной складской проверке'})});if(p==='/api/auth/me'||p.startsWith('/api/warehouse/')||p.startsWith('/api/production/'))return route.continue({headers:{...route.request().headers(),'x-costing-test-role':role}});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(p==='/api/auth/me/workspace'?{view:'warehouse',blocks:[],sections:[]}:[])})})
try{
 const ids=await call('/reconciliation-test/data')
 role='production';await page.goto(base+`/production/${ids.production_id}/postavka`)
 await page.getByRole('button',{name:'Сверить распределение',exact:true}).click()
 const mapping=page.getByRole('dialog',{name:'Сверка распределения выдачи',exact:true})
 await mapping.getByLabel('Количество · Каркас',{exact:true}).fill('4')
 await mapping.getByLabel('Страница и строка · Каркас',{exact:true}).fill('Стр. 1, строка 1')
 await mapping.getByLabel('Количество · Кровля',{exact:true}).fill('2')
 await mapping.getByLabel('Страница и строка · Кровля',{exact:true}).fill('Стр. 1, строка 2')
 await mapping.locator('input[type=file]').setInputFiles(scan)
 await mapping.getByRole('button',{name:scan.name,exact:true}).waitFor()
 await mapping.getByLabel('Основание сверки или исправления').fill('Сверено с ведомостью выдачи')
 await mapping.getByRole('checkbox').check()
 await page.screenshot({path:out+'/legacy-desktop.png',fullPage:true})
 await page.setViewportSize({width:390,height:844})
 assert.ok(await mapping.evaluate(e=>e.scrollWidth<=e.clientWidth+1))
 await page.screenshot({path:out+'/legacy-mobile.png',fullPage:true})
 await mapping.getByRole('button',{name:'Подтвердить распределение',exact:true}).click()
 await mapping.waitFor({state:'hidden'})
 const state=await call('/warehouse/control/reconciliation')
 assert.ok(state.items[0].previous.intact)
 const returns=await call('/warehouse/control/returns')
 assert.equal(returns[0].movement_id,ids.movement_id);assert.equal(Number(returns[0].remaining),6)
 role='accounting';await page.setViewportSize({width:1440,height:1050});await page.goto(base+'/warehouse?tab=documents&kind=inventory')
 const rowName='Инвентаризация № '+ids.document_number
 await page.getByText(rowName,{exact:true}).click()
 const inventory=page.getByRole('dialog',{name:rowName,exact:true})
 assert.equal(await inventory.getByRole('button',{name:'Провести',exact:true}).count(),0)
 await inventory.locator('input[type=file]').setInputFiles(scan)
 await inventory.getByRole('button',{name:scan.name,exact:true}).waitFor()
 await inventory.getByLabel('Страницы и таблица акта').fill('Страница 1, ведомость пересчёта')
 await inventory.getByRole('checkbox').check()
 await inventory.getByRole('button',{name:'Подтвердить акт пересчёта',exact:true}).click()
 await inventory.locator('summary').filter({hasText:'Подтверждение пересчёта'}).waitFor()
 const prepared=await call(`/warehouse/inventory-evidence/${ids.document_id}`)
 assert.equal(prepared.length,1);assert.ok(prepared[0].current);assert.equal(prepared[0].actor_id,4)
 await inventory.locator('summary').click()
 await page.screenshot({path:out+'/count-prepared-desktop.png',fullPage:true})
 role='owner';await page.goto(base+'/warehouse?tab=documents&kind=inventory')
 await page.getByText(rowName,{exact:true}).click()
 const ownerDoc=page.getByRole('dialog',{name:rowName,exact:true})
 await ownerDoc.getByRole('button',{name:'Провести',exact:true}).click()
 await ownerDoc.getByRole('button',{name:'Подтвердить',exact:true}).click()
 await ownerDoc.getByText('Документ проведён. Остатки обновлены.',{exact:true}).waitFor()
 const posted=await call(`/warehouse/inventory-evidence/${ids.document_id}`)
 assert.equal(posted.length,2);assert.equal(posted[0].stage,'posted');assert.ok(posted[0].current);assert.equal(posted[0].actor_id,1)
 const preview=await call(`/warehouse/techcard-issue/${ids.production_id}/preview`)
 assert.equal(preview.lines[0].in_stock,23);assert.equal(preview.lines[0].provided,6)
 await ownerDoc.locator('summary').first().click()
 await page.screenshot({path:out+'/count-posted-desktop.png',fullPage:true})
 await page.setViewportSize({width:390,height:844})
 assert.ok(await ownerDoc.evaluate(e=>e.scrollWidth<=e.clientWidth+1))
 await page.screenshot({path:out+'/count-posted-mobile.png',fullPage:true})
 assert.deepEqual(errors,[])
 const report={real_api:true,real_documents:true,named_legacy_reconciliation:true,no_repeat_stock_issue:true,prepared_by_keeper:true,posted_by_full_access:true,immutable_count_history:true,mobile:true,pageErrors:errors,production_test_writes:false}
 for(const name of ['native-ui-report.json','ui-report.json'])await writeFile(out+'/'+name,JSON.stringify(report,null,2))
 console.log(JSON.stringify(report))
}catch(error){await page.screenshot({path:out+'/native-failure.png',fullPage:true});console.error(JSON.stringify({errors,url:page.url()}));console.error((await page.locator('body').innerText()).slice(-3500));throw error}finally{await browser.close()}
