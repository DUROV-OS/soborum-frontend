import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:5194'
assert.equal(new URL(base).hostname,'127.0.0.1')
const output='../../output/assistant-provenance-20261110'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true}),report={real_api:true,synthetic_database:true,provider_stubbed:true,checks:[]}
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1050},timezoneId:'America/Los_Angeles'})
  const response=await context.request.get(base+'/api/assistant-test/data');assert.equal(response.status(),200)
  const ids=await response.json();assert.equal(ids.synthetic,true)
  await context.addInitScript(()=>{localStorage.setItem('soborbum.auth.token','synthetic-evidence');for(const x of ['ai','tasks'])localStorage.setItem('soborbum.onboarding.'+x,'1')})
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  try{
   await page.goto(base+'/ai/'+ids.chat)
   const detail=page.locator('details').filter({has:page.locator('summary',{hasText:'Источники ответа · 1'})}).last()
   await detail.locator('summary').first().click()
   await detail.getByRole('button',{name:'Показать сохранённые данные',exact:true}).click()
   await detail.getByText('Проверить подтверждающий документ',{exact:true}).waitFor()
   await detail.getByText('Снимок на момент чтения.',{exact:false}).waitFor()
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
   await detail.scrollIntoViewIfNeeded()
   await page.screenshot({path:output+`/sources-${mobile?'mobile':'desktop'}.png`})
   const beforeAnswers=await page.getByText('Источники ответа · 1',{exact:true}).count()
   await page.getByRole('textbox',{name:'Сообщение Марине'}).fill('Перечитай задачу и укажи основание')
   await page.getByRole('button',{name:'Отправить сообщение',exact:true}).click()
   await page.getByRole('button',{name:'Отправить сообщение',exact:true}).waitFor()
   await page.waitForFunction(n=>[...document.querySelectorAll('summary')].filter(s=>s.textContent==='Источники ответа · 1').length>n,beforeAnswers)
   const chat=await (await context.request.get(base+'/api/ai/chats/'+ids.chat)).json()
   const answers=chat.messages.filter(m=>m.role==='assistant'&&m.content.some(b=>b.type==='answer_evidence'))
   assert.ok(answers.length>=2)
   const meta=answers.at(-1).content.find(b=>b.type==='answer_evidence')
   assert.equal(meta.sources.length,1);assert.equal(meta.citations.length,1);assert.equal(meta.unknown_citations.length,0)
   await page.goto(base+'/ai/'+ids.unknown_chat)
   await page.getByText('Ответ без прочитанных источников системы',{exact:true}).click()
   await page.getByText('В ответе есть ссылки без сохранённого источника:',{exact:false}).waitFor()
   await page.goto(base+'/ai/'+ids.legacy_chat)
   await page.getByText('Источники этого ответа не зафиксированы.',{exact:true}).waitFor()
   await page.goto(base+'/tasks?scope=mine')
   const plan=page.locator('div.mb-5').filter({hasText:'План на день'}).first()
   await plan.getByText('Выбор задач предложен ИИ',{exact:false}).waitFor()
   assert.equal(await page.getByText('Выдуманное согласование руководителя',{exact:false}).count(),0)
   await plan.getByText('Исходные данные и основания',{exact:true}).click()
   await plan.getByText('Проверить подтверждающий документ',{exact:true}).first().waitFor()
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
   await page.screenshot({path:output+`/plan-${mobile?'mobile':'desktop'}.png`,fullPage:true})
   if(!mobile){
    const before=await (await context.request.get(base+'/api/ai/tasks/daily-plan')).json()
    assert.equal(before.cached,true)
    assert.equal((await context.request.post(base+'/api/assistant-test/change-deadline')).status(),200)
    await plan.getByRole('button',{name:'Обновить',exact:true}).click()
    await plan.getByText('Вы назначены исполнителем или проверяющим',{exact:false}).waitFor()
    const after=await (await context.request.get(base+'/api/ai/tasks/daily-plan')).json()
    assert.notEqual(after.source_hash,before.source_hash)
   }
   await page.route('**/api/ai/tasks/daily-plan*',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'План временно недоступен'})}))
   await plan.getByRole('button',{name:'Обновить',exact:true}).click()
   await plan.getByText('План временно недоступен',{exact:true}).waitFor()
   assert.equal(await plan.getByText('Выбор задач предложен ИИ',{exact:false}).count(),0)
   assert.equal(await plan.getByText('На сегодня открытых задач для плана нет.',{exact:true}).count(),0)
   await page.addInitScript(()=>{if(localStorage.getItem('synthetic-consult-initialized'))return;localStorage.setItem('synthetic-consult-initialized','1');localStorage.setItem('soborbum.consult.voiceReply','0');localStorage.setItem('soborbum.consult.visible',JSON.stringify({chatId:null,messages:[{id:991,role:'assistant',content:[{type:'text',text:'Локальный текст другого сотрудника'}]}]}));localStorage.setItem('soborbum.onboarding.agents','1')})
   await page.goto(base+'/agents?tab=consult')
   assert.equal(await page.getByText('Локальный текст другого сотрудника',{exact:true}).count(),0)
   await page.getByRole('textbox',{name:'Сообщение Марине'}).fill('Проверь задачу в консультации')
   await page.getByRole('button',{name:'Отправить сообщение',exact:true}).click()
   await page.getByText('Источники ответа · 1',{exact:true}).waitFor()
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('soborbum.consult.visible')))
   assert.ok(saved.chatId);assert.equal(saved.messages,undefined)
   await page.reload()
   await page.getByText('Источники ответа · 1',{exact:true}).waitFor()
   assert.deepEqual(errors,[])
   report.checks.push({mobile,snapshot:true,streaming:true,unknownCitation:true,legacy:true,plan:true,failedRefresh:true,consultCanonicalHistory:true,pageErrors:errors})
  }catch(e){await page.screenshot({path:output+'/failure.png',fullPage:true});console.log(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(-6000)}));throw e}
  finally{await context.close()}
 }
 await writeFile(output+'/native-ui-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await browser.close()}
