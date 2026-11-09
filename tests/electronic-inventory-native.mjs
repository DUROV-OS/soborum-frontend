import assert from 'node:assert/strict'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:5194',out='../../output/electronic-inventory-20261110'
await mkdir(out,{recursive:true})
let pdf='%PDF-1.4\n',offsets=[0]
for(const [i,v] of ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] >>'].entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${v}\nendobj\n`}
const xref=pdf.length
pdf+='xref\n0 4\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
const scan={name:'synthetic-warehouse.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)}
const browser=await chromium.launch({headless:true}),context=await browser.newContext({serviceWorkers:'block',locale:'ru-RU',viewport:{width:390,height:844}}),errors=[]
await context.addInitScript(()=>{localStorage.setItem('soborbum.auth.token','synthetic-warehouse-only');localStorage.setItem('soborbum.onboarding.warehouse','1')})
const request=context.request
async function call(path,method='get',data,as='owner'){const r=await request[method](base+'/api'+path,{data,headers:{'x-costing-test-role':as}});assert.ok(r.ok(),await r.text());return r.json()}
let role='accounting', failNextCount=false
const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.stack||e.message))
await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname;if(failNextCount&&p.startsWith('/api/warehouse/inventory-counts/')&&route.request().method()==='POST'){failNextCount=false;return route.abort('internetdisconnected')}if(p.startsWith('/api/ai/'))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'ИИ не подключён в изолированной складской проверке'})});if(p==='/api/auth/me'||p.startsWith('/api/warehouse/')||p.startsWith('/api/production/'))return route.continue({headers:{...route.request().headers(),'x-costing-test-role':role}});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(p==='/api/auth/me/workspace'?{view:'warehouse',blocks:[],sections:[]}:[])})})
try{
 const ids=await call('/electronic-test/data')
 await page.goto(base+'/warehouse?tab=documents&kind=inventory')
 await page.getByRole('button',{name:'Начать инвентаризацию',exact:true}).click()
 const creation=page.getByRole('dialog',{name:'Электронная инвентаризация',exact:true})
 assert.ok(await creation.evaluate(e=>e.scrollWidth<=e.clientWidth+1))
 await creation.getByRole('button',{name:'Начать пересчёт · 3',exact:true}).waitFor()
 await page.screenshot({path:out+'/mobile-create.png',fullPage:true})
 scan.name='synthetic-count.png';scan.mimeType='image/png';scan.buffer=await readFile(out+'/mobile-create.png')
 const created=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/warehouse/documents'&&r.request().method()==='POST'&&r.status()===201)
 await creation.getByRole('button',{name:'Начать пересчёт · 3',exact:true}).click();await created
 const docs=await call('/warehouse/documents?kind=inventory&archive=active')
 const doc=docs.items[0],name='Инвентаризация № '+doc.number
 let session=page.getByRole('dialog',{name,exact:true})
 await session.getByLabel('Позиция пересчёта').selectOption(String(ids.material_id))
 await session.getByLabel('Фактическое количество',{exact:true}).fill('29')
 await session.getByLabel('Комментарий к пересчёту',{exact:true}).fill('Пересчитал пачку у ворот')
 await session.getByText('Фото или документ к позиции · необязательно',{exact:true}).click()
 await session.locator('input[capture=environment]').setInputFiles(scan)
 await session.getByRole('button',{name:scan.name,exact:true}).waitFor()
 await page.screenshot({path:out+'/mobile-count.png',fullPage:true})
 failNextCount=true
 await session.getByRole('button',{name:'Сохранить и далее',exact:true}).click()
 await session.getByRole('button',{name:'Повторить сохранение',exact:true}).waitFor()
 assert.equal((await call(`/warehouse/inventory-counts/${doc.id}`)).length,0)
 // Reload on the same device: unsent physical input and uploaded proof survive.
 await page.reload()
 await page.getByText(name,{exact:true}).click()
 session=page.getByRole('dialog',{name,exact:true})
 await session.getByLabel('Позиция пересчёта').selectOption(String(ids.material_id))
 assert.equal(await session.getByLabel('Фактическое количество',{exact:true}).inputValue(),'29')
 await session.getByRole('button',{name:'Сохранить и далее',exact:true}).click()
 await session.getByText('Позиция сохранена в системе',{exact:true}).waitFor()
 for(const [id,quantity] of [[ids.zero_id,'0'],[ids.fractional_id,'2,25']]){
  await session.getByLabel('Позиция пересчёта').selectOption(String(id))
  await session.getByLabel('Фактическое количество',{exact:true}).fill(quantity)
  const saved=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/warehouse/inventory-counts/${doc.id}`&&r.request().method()==='POST'&&r.status()===200);await session.getByRole('button',{name:'Сохранить и далее',exact:true}).click();await saved
 }
 await session.getByRole('button',{name:'Подтвердить электронный акт',exact:true}).waitFor()
 await session.getByRole('checkbox',{name:'Проверил все результаты пересчёта и подтверждаю электронный акт'}).check()
 await session.getByRole('button',{name:'Подтвердить электронный акт',exact:true}).click()
 await session.getByText('Акт готов к проверке. Проведение доступно сотруднику с полными правами склада.',{exact:true}).waitFor()
 const acts=await call(`/warehouse/inventory-evidence/${doc.id}`)
 assert.equal(acts.length,1);assert.equal(acts[0].mode,'electronic');assert.ok(acts[0].current)
 await session.locator('summary').filter({hasText:'Подтверждение пересчёта'}).click()
 await page.screenshot({path:out+'/mobile-electronic-act.png',fullPage:true})
 await session.getByRole('button',{name:'История',exact:true}).click()
 await session.getByText('Пересчитал пачку у ворот',{exact:true}).waitFor()
 assert.equal((await call(`/warehouse/inventory-counts/${doc.id}`)).length,3)
 assert.ok(await session.evaluate(e=>e.scrollWidth<=e.clientWidth+1))
 await page.screenshot({path:out+'/mobile-history.png',fullPage:true})
 role='owner';await page.setViewportSize({width:1440,height:1050});await page.goto(base+'/warehouse?tab=documents&kind=inventory')
 await page.getByText(name,{exact:true}).click()
 session=page.getByRole('dialog',{name,exact:true})
 await session.getByRole('button',{name:'Акт',exact:true}).click()
 await session.getByRole('checkbox',{name:'Проверил акт и расхождения. Подтверждаю изменение остатков.'}).check()
 await session.getByRole('button',{name:'Провести инвентаризацию',exact:true}).click()
 await session.getByText('Инвентаризация проведена. Остатки обновлены.',{exact:true}).waitFor()
 const result=await call(`/warehouse/inventory-evidence/${doc.id}`)
 assert.equal(result[0].stage,'posted');assert.equal(result[0].mode,'electronic');assert.ok(result[0].current)
 await session.locator('summary').filter({hasText:'Проведение по акту'}).click()
 await page.screenshot({path:out+'/desktop-posted.png',fullPage:true})
 const download=page.waitForEvent('download')
 await session.getByRole('button',{name:'Скачать электронный акт',exact:true}).first().click()
 const file=await download;assert.ok(file.suggestedFilename().endsWith('.html'));await file.saveAs(out+'/electronic-act.html')
 await page.setViewportSize({width:390,height:844});assert.ok(await session.evaluate(e=>e.scrollWidth<=e.clientWidth+1))
 await page.screenshot({path:out+'/mobile-posted.png',fullPage:true})
 const preview=await call(`/warehouse/techcard-issue/${ids.production_id}/preview`);assert.equal(preview.lines[0].in_stock,29)
 assert.deepEqual(errors,[])
 const report={real_api:true,electronic_act:true,per_line_personal_history:true,optional_photo:true,zero_and_fractional_counts:true,network_failure_recovered:true,device_draft_survives_reload:true,full_access_posting:true,downloaded_act:true,mobile:true,pageErrors:errors,production_test_writes:false}
 for(const name of ['native-ui-report.json','ui-report.json'])await writeFile(out+'/'+name,JSON.stringify(report,null,2))
 console.log(JSON.stringify(report))
}catch(error){await page.screenshot({path:out+'/native-failure.png',fullPage:true});console.error(JSON.stringify({errors,url:page.url()}));console.error((await page.locator('body').innerText()).slice(-4500));throw error}finally{await browser.close()}
