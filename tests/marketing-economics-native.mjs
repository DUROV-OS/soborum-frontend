import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:5194'
assert.equal(new URL(base).hostname,'127.0.0.1')
const output='../../output/marketing-economics-20261110';await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true}),report={real_api:true,synthetic_database:true,checks:[]}
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1050},timezoneId:'America/Los_Angeles'})
  await context.addInitScript(()=>{localStorage.setItem('soborbum.auth.token','synthetic-only');localStorage.setItem('soborbum.onboarding.marketing','1');localStorage.setItem('soborbum.onboarding.accounting','1')})
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  try{
   await page.goto(base+'/marketing?tab=economics')
   await page.getByRole('link',{name:/Дом с подтверждённым расходом рекламы/}).waitFor()
   await page.screenshot({path:output+`/overview-${mobile?'mobile':'desktop'}.png`})
   await page.getByText('Документы и что проверить',{exact:true}).click()
   await page.getByText('Рекламный акт.pdf',{exact:false}).waitFor()
   assert.equal(await page.getByText('Результат утверждён',{exact:true}).count(),1) // metric label only
   await page.getByText('Сверка затрат не завершена',{exact:true}).waitFor()
   const data=await (await context.request.get(base+'/api/marketing/economics?date_from=2026-11-01&date_to=2026-11-30')).json()
   assert.equal(data.period_advertising.recognized_amount,'10000.00');assert.equal(data.closed_project_profit,null)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
   await page.screenshot({path:output+`/economics-${mobile?'mobile':'desktop'}.png`,fullPage:true})
   await page.getByRole('link',{name:'Открыть затраты и сканы проекта',exact:true}).click()
   await page.getByRole('heading',{name:'Затраты проектов',exact:true}).waitFor()
   assert.equal(new URL(page.url()).searchParams.get('project'),'1')
   await page.goto(base+'/marketing?tab=economics')
   await page.getByRole('link',{name:/Дом с подтверждённым расходом рекламы/}).waitFor()
   await page.route('**/api/marketing/economics*',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Документы временно недоступны'})}))
   await page.getByRole('button',{name:'Перепроверить',exact:true}).click()
   await page.getByRole('alert').filter({hasText:'Документы временно недоступны'}).waitFor()
   assert.equal(await page.getByText('Прибыль закрытых проектов',{exact:true}).count(),0)
   await page.unroute('**/api/marketing/economics*')
   await page.reload();await page.getByRole('link',{name:/Дом с подтверждённым расходом рекламы/}).waitFor()
   await page.getByLabel('Конец периода экономики',{exact:true}).fill('2026-10-31')
   await page.getByRole('alert').filter({hasText:'Укажите начало и конец периода'}).waitFor()
   assert.equal(await page.getByText('Прибыль закрытых проектов',{exact:true}).count(),0)
   assert.deepEqual(errors,[])
   report.checks.push({mobile,documentProof:true,accountingLink:true,staleHidden:true,invalidDates:true,pageErrors:errors})
  }catch(e){await page.screenshot({path:output+'/failure.png',fullPage:true});console.log(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(-5000)}));throw e}
  finally{await context.close()}
 }
 await writeFile(output+'/native-ui-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await browser.close()}
