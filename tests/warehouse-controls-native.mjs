import assert from 'node:assert/strict'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:5194',out='../../output/warehouse-controls-20261109'
await mkdir(out,{recursive:true})
let pdf='%PDF-1.4\n',offsets=[0]
for(const [i,v] of ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] >>'].entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${v}\nendobj\n`}
const xref=pdf.length
pdf+='xref\n0 4\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
const scan={name:'synthetic-warehouse.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)}
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1050}}),errors=[]
await context.addInitScript(()=>{localStorage.setItem('soborbum.auth.token','synthetic-warehouse-only');localStorage.setItem('soborbum.onboarding.warehouse','1')})
const request=context.request
async function call(path,method='get',data,as='owner'){const r=await request[method](base+'/api'+path,{data,headers:{'x-costing-test-role':as}});assert.ok(r.ok(),await r.text());return r.json()}
let role='accounting'
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname;if(p==='/api/auth/me'||p.startsWith('/api/warehouse/')||p.startsWith('/api/production/'))return route.continue({headers:{...route.request().headers(),'x-costing-test-role':role}});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(p==='/api/auth/me/workspace'?{view:'warehouse',blocks:[],sections:[]}:[])})})
try{
 const ids=await call('/warehouse-test/data')
 await page.goto(base+'/warehouse')
 const onboarding=page.getByRole('dialog',{name:'Работа со складом'});if(await onboarding.count())await page.keyboard.press('Escape')
 await page.getByRole('heading',{name:'Выдача в производство',exact:true}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Комплектовать',exact:true}).isEnabled(),false)
 await page.screenshot({path:out+'/queue-pending.png',fullPage:true})
 role='production';await page.goto(base+`/production/${ids.production_id}/postavka`)
 await page.getByRole('button',{name:'Проверить норматив',exact:true}).click()
 await page.locator('input[type=file]').setInputFiles(scan)
 await page.getByRole('button',{name:scan.name,exact:true}).waitFor()
 await page.getByLabel('Страница и таблица норматива').fill('Страница 1, строки 1 и 2')
 await page.getByRole('checkbox').check()
 await page.getByRole('button',{name:'Подтвердить и передать на склад',exact:true}).click()
 await page.getByText('Подтверждено: Тестовый начальник производства',{exact:true}).waitFor()
 assert.ok((await call(`/warehouse/control/houses/${ids.production_id}`)).approved)
 await page.screenshot({path:out+'/production-handoff.png',fullPage:true})
 role='accounting';await page.goto(base+'/warehouse')
 await page.getByRole('button',{name:'Комплектовать',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Отпуск по техкарте — Дом проверки склада',exact:true})
 await dialog.getByLabel('К отпуску: Брус для каркаса').fill('6')
 await dialog.getByPlaceholder('ФИО ответственного').fill('Получатель цеха')
 await dialog.getByRole('button',{name:'Провести отпуск',exact:true}).click()
 await dialog.waitFor({state:'hidden'})
 const first=(await call('/warehouse/control/returns'))[0]
 assert.equal(Number(first.issued),6)
 await page.getByRole('tab',{name:'Возвраты',exact:true}).click()
 await page.getByRole('button',{name:'Оформить возврат',exact:true}).click()
 const returning=page.getByRole('dialog',{name:'Возврат по исходной выдаче',exact:true})
 await returning.getByLabel('Количество возврата').fill('2')
 await returning.getByLabel('Принял на склад').fill('Специалист склада')
 await returning.getByLabel('Причина возврата').fill('Неиспользованные материалы')
 await returning.locator('input[type=file]').setInputFiles(scan)
 await returning.getByRole('button',{name:scan.name,exact:true}).waitFor()
 await returning.getByLabel('Страница и строка документа').fill('Страница 1, строка 1')
 await returning.getByRole('button',{name:'Провести возврат',exact:true}).click()
 await returning.waitFor({state:'hidden'})
 await page.getByText(/Возврат проведён, операция/).waitFor()
 const after=(await call('/warehouse/control/returns'))[0]
 assert.equal(Number(after.returned),2);assert.equal(Number(after.remaining),4)
 const preview=await call(`/warehouse/techcard-issue/${ids.production_id}/preview`)
 assert.equal(preview.lines[0].provided,4);assert.equal(preview.lines[0].to_issue,6);assert.equal(preview.lines[0].in_stock,26)
 await page.screenshot({path:out+'/returns-desktop.png',fullPage:true})
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/warehouse?tab=queue')
 await page.getByRole('heading',{name:'Выдача в производство',exact:true}).waitFor()
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await page.getByRole('heading',{name:'Дом проверки склада',exact:true}).waitFor()
 await page.screenshot({path:out+'/queue-mobile.png',fullPage:true})
 await page.getByRole('tab',{name:'Возвраты',exact:true}).click()
 await page.getByRole('button',{name:'Оформить возврат',exact:true}).click()
 assert.ok(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1))
 await page.screenshot({path:out+'/return-mobile.png',fullPage:true})
 const denied=await request.post(base+`/api/warehouse/control/returns/${first.movement_id}`,{headers:{'x-costing-test-role':'sales'},data:{request_id:crypto.randomUUID(),quantity:1,file_id:1,locator:'Page 1',reason:'Synthetic',received_by:'Test'}})
 assert.equal(denied.status(),403)
 assert.deepEqual(errors,[])
 const report={real_api:true,real_documents:true,named_production_handoff:true,partial_issue:true,documented_return:true,stock_and_norm_reconciled:true,mobile:true,manager_denied:true,pageErrors:errors,production_test_writes:false}
 for(const name of ['native-ui-report.json','ui-report.json'])await writeFile(out+'/'+name,JSON.stringify(report,null,2))
 console.log(JSON.stringify(report))
}catch(error){await page.screenshot({path:out+'/native-failure.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(-3500));throw error}finally{await browser.close()}
