import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const base=process.env.SMOKE_BASE_URL??'http://127.0.0.1:5190',output='../../output/ai-evidence-20261109'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true}),errors=[]
const stamp='2026-11-09T12:00:00Z'
let unavailable=false,changed=false,legacy=false
const context=await browser.newContext({viewport:{width:1440,height:1050}})
await context.addInitScript(()=>{localStorage.setItem('soborbum.auth.token','synthetic-only');for(const section of ['warehouse','agents','production','today','ai'])localStorage.setItem('soborbum.onboarding.'+section,'1')})
await context.route('**/api/**',async route=>{
 const url=new URL(route.request().url());let body=[],status=200
 if(url.pathname==='/api/auth/me')body={id:1,full_name:'Руководитель · тест',email:'owner@test.invalid',role:'admin',job_role:'general',is_active:true,module_access:{}}
 else if(url.pathname==='/api/auth/me/workspace')body={view:'general',blocks:['aktualnoe'],sections:[]}
 else if(url.pathname==='/api/dashboard/today')body={generated_at:stamp,summary:'Факты',widgets:[],actions:[],ai_configured:true}
 else if(url.pathname==='/api/dashboard/aktualnoe')body={generated_at:stamp,source:'database',items:[{cycle_id:7,client_name:'Дом · тест',stage:'Производство дома',percent:legacy?80:null,phrase:legacy?'Готово на 80%':'Заметка по клиенту',last_activity:stamp,recent_events:2,source_hash:legacy?null:'a'.repeat(64),sources:legacy?[]:[{entity:'client_notes',record_id:9,field:'created_at',label:'Заметка по клиенту',at:stamp}]}]}
 else if(url.pathname==='/api/ai/warehouse/analytics'){
  if(unavailable){status=503;body={detail:'Аналитика временно недоступна'}}
  else body={section:'warehouse',generated_at:stamp,data_as_of:stamp,checked_at:stamp,summary:'Нужно проверить складские позиции.',status:'yellow',source:'ai',source_hash:'b'.repeat(64),analysis_version:'section-evidence-v1',snapshot:{total_materials:10,materials_needing_supply:2},citations:['materials_needing_supply'],rule_findings:['Позиции склада требуют пополнения или сверки: 2'],human_approved:false,cached:true,input_changed:changed}
 }else if(url.pathname==='/api/agents/shifts/latest')body={id:1,created_at:stamp,charts_as_of:stamp,charts_source_hash:'c'.repeat(64),summary:'Есть автоматические проверки.',verdict:'allow',claude_used:false,autorun:false,items:[
  {id:1,agent_id:'sales',daily_question:'Какие сделки требуют внимания?',stance:'Сохранённый вывод: одна сделка.',stance_source:'live',citations:['Срез продаж'],legal_verdict:'allow',reviews:[{reviewer:'lawyer',kind:'legal',status:'checked_ok',method:'rules',text:'Автоматический фильтр не нашёл совпадений. Согласования человека нет.',escalate:false,input_hash:'d'.repeat(64),input_text:'Проверяемый текст смены',rules_version:'legal-rules-v1',matched_rules:[],human_approved:false}]},
  {id:2,agent_id:'warehouse',daily_question:'Что на складе?',stance:'Исторический вывод.',citations:[],legal_verdict:'allow',reviews:[{reviewer:'lawyer',kind:'legal',status:'checked_ok',text:'Юрист проверил и согласовал',escalate:false}]},
 ],approvals:[],charts:[{id:'sales',title:'Текущие сделки',unit:'шт',agents:['sales'],lead:'Сейчас три сделки.',bars:[{label:'Сделок',value:3}]}]}
 else if(url.pathname==='/api/agents/stats')body={week:[],legal:{allow:0,allow_with_conditions:0,block:0,escalate_human:0},routing:[],traces:[],totals:{runs:0,blocked:0,escalated:0,released:0}}
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
})
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
const settle=()=>page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))))
try {
 await page.goto(base+'/today');await page.getByText('Дом · тест',{exact:true}).waitFor()
 await page.getByText('Записи-основания',{exact:true}).click()
 await page.getByText('Заметка по клиенту · запись №9',{exact:false}).waitFor()
 assert.equal(await page.getByRole('progressbar').count(),0)
 await page.screenshot({path:output+'/activity-desktop.png',fullPage:true})
 legacy=true;await page.getByRole('button',{name:'Обновить данные',exact:true}).click()
 await page.getByText('Основания этой записи не зафиксированы. Обновите данные.',{exact:true}).waitFor()
 assert.equal(await page.getByText('80%',{exact:false}).count(),0)
 await page.goto(base+'/warehouse');await page.getByText('Черновик вывода ИИ · сотрудником не согласован',{exact:true}).waitFor()
 await page.getByText('Исходные данные и основания',{exact:true}).click()
 await page.getByText('Позиций склада:',{exact:true}).waitFor()
 await page.screenshot({path:output+'/analysis-desktop.png',fullPage:true})
 changed=true;await page.getByRole('button',{name:'Обновить ИИ-резюме'}).click()
 await page.getByRole('alert').filter({hasText:'Данные изменились во время анализа'}).waitFor()
 unavailable=true;await page.getByRole('button',{name:'Обновить ИИ-резюме'}).click()
 await page.getByText('Аналитика временно недоступна',{exact:false}).waitFor()
 assert.equal(await page.getByText('Нужно проверить складские позиции.',{exact:true}).count(),0)
 assert.equal(await page.getByText('Оценка ИИ: Нужно внимание',{exact:true}).count(),0)
 await page.goto(base+'/agents?tab=shift');await page.getByRole('heading',{name:'Команда работает сама'}).waitFor()
 await page.getByText('Автоматический запуск выключен.',{exact:false}).waitFor()
 await page.getByText('Сохранённый вывод: одна сделка.',{exact:true}).waitFor()
 await page.getByText('Сейчас три сделки.',{exact:true}).waitFor()
 assert.equal(await page.getByText('Юрист проверил и согласовал',{exact:false}).count(),0)
 assert.equal(await page.getByText('держит сам',{exact:true}).count(),0)
 await page.getByText('Основания автоматической проверки',{exact:true}).click()
 await page.getByText('Проверяемый текст смены',{exact:true}).waitFor()
 await page.screenshot({path:output+'/agents-desktop.png',fullPage:true})
 await page.setViewportSize({width:390,height:844});await settle()
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await page.screenshot({path:output+'/agents-mobile.png'})
 unavailable=false;changed=false;await page.goto(base+'/warehouse');await page.getByText('Черновик вывода ИИ · сотрудником не согласован').waitFor()
 await page.getByText('Исходные данные и основания',{exact:true}).click();await settle()
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await page.screenshot({path:output+'/analysis-mobile.png'})
 assert.deepEqual(errors,[])
 const result={no_invented_progress:true,legacy_values_hidden:true,source_records_visible:true,ai_snapshot_visible:true,changed_input_warning:true,failed_refresh_hides_old_claims:true,rules_not_human_approval:true,historical_and_current_sources_separate:true,mobile_without_overflow:true,pageErrors:errors}
 await writeFile(output+'/ui-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
}catch(e){await page.screenshot({path:output+'/failure.png',fullPage:true});console.log(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(-5000)}));throw e}finally{await browser.close()}
