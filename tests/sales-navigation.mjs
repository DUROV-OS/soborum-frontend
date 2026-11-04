import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:4185'
const browser=await chromium.launch({headless:true,timeout:20000})
const closed=['/','/today','/work','/accounting','/accounting?tab=register','/recipes','/recipes/1','/production','/production/1','/warehouse','/purchasing','/moysklad?type=paymentin','/sales','/clients','/clients/1','/cycles/1','/partners','/chats','/meetings/1','/ai','/agents','/board','/admin','/feedback','/notifications','/crm?tab=pipeline','/crm?tab=stage','/tasks?scope=all']
const report={base_url:base,scope:'navigation-only; API responses synthetic',manager_routes:0,mobile:false,leaders:false,closed_api_requests:[],errors:[]}
await mkdir('test-results',{recursive:true})
async function setup({role='worker',job='manager',mobile=false,profile}={}) {
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}})
 await context.addInitScript(()=>{localStorage.setItem('soborbum.auth.token','synthetic-token');localStorage.setItem('soborbum.onboarding.tasks','1')})
 const page=await context.newPage();page.setDefaultTimeout(10000)
 const calls=[],errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());calls.push(url.pathname+url.search)
  let body=[]
  if(url.pathname==='/api/auth/me') body={id:2,email:'manager@example.test',full_name:'Менеджер',role,job_role:job,access_profile:profile,is_active:true,module_access:Object.fromEntries(['clients','tasks','tasks_all','production','warehouse','accounting','ai','board','marketing','installation','cycle','house_models'].map(s=>[s,'full']))}
  else if(url.pathname==='/api/crm/catalog') body={pipelines:[],stages:[],users:[],counts:{deal:0,contact:0,company:0,task:0,inquiry:0}}
  else if(url.pathname==='/api/crm/entries') body={items:[],total:0}
  else if(url.pathname==='/api/crm/attention') body={items:[],total:0,counts:{},settings:{response_hours:24,idle_days:3}}
  else if(url.pathname==='/api/auth/me/workspace') body=null
  else if(url.pathname==='/api/notifications/poll') body={items:[],unread_count:0}
  await route.fulfill({contentType:'application/json',body:JSON.stringify(body)})
 })
 return {page,context,calls,errors}
}
try {
 const manager=await setup()
 for(const path of closed){
  await manager.page.goto(base+path)
  await manager.page.getByRole('heading',{name:'CRM',exact:true}).waitFor()
  assert.equal(new URL(manager.page.url()).pathname,'/crm')
  assert.equal(new URL(manager.page.url()).search,'')
  report.manager_routes++
 }
 const menu=manager.page.getByRole('complementary',{name:'Главное меню'})
 const links=await menu.getByRole('link').evaluateAll(nodes=>nodes.map(n=>new URL(n.href).pathname))
 assert.deepEqual([...new Set(links)].sort(),['/crm','/tasks'])
 assert.equal(await manager.page.getByRole('button',{name:'Воронки и этапы',exact:true}).count(),0)
 await menu.getByRole('link',{name:'Задачи',exact:true}).click()
 await manager.page.getByRole('heading',{name:'Задачи',exact:true}).waitFor()
 assert.equal(manager.calls.some(path=>path.includes('scope=all')),false)
 await manager.page.getByRole('button',{name:'Меню учётной записи'}).click()
 assert.equal(await manager.page.getByRole('button',{name:'Изменить пароль',exact:true}).count(),1)
 assert.equal(await manager.page.getByRole('button',{name:'Выйти',exact:true}).count(),1)
 report.closed_api_requests=manager.calls.filter(path=>!path.startsWith('/api/crm/')&&!path.startsWith('/api/tasks/')&&path!=='/api/auth/me')
 assert.deepEqual(report.closed_api_requests,[])
 assert.deepEqual(manager.errors,[])
 await manager.context.close()
 const mobile=await setup({mobile:true})
 await mobile.page.goto(base+'/production/1')
 await mobile.page.getByRole('heading',{name:'CRM',exact:true}).waitFor()
 await mobile.page.getByRole('button',{name:'Открыть меню',exact:true}).click()
 await mobile.page.getByRole('complementary',{name:'Главное меню'}).getByRole('link',{name:'Задачи',exact:true}).waitFor()
 assert.equal(await mobile.page.getByRole('complementary',{name:'Главное меню'}).getByRole('link',{name:'Бухгалтерия',exact:true}).count(),0)
 assert.ok(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
 await mobile.page.screenshot({path:'test-results/sales-navigation-mobile.png',fullPage:true})
 assert.deepEqual(mobile.errors,[]);report.mobile=true;await mobile.context.close()
 for(const who of [{role:'admin',job:'manager'},{role:'worker',job:'director'}]){
  const leader=await setup(who)
  await leader.page.goto(base+'/crm?tab=pipeline')
  await leader.page.getByRole('heading',{name:'CRM',exact:true}).waitFor()
  assert.equal(new URL(leader.page.url()).search,'?tab=pipeline')
  assert.equal(await leader.page.getByRole('button',{name:'Воронки и этапы',exact:true}).count(),1)
  await leader.context.close()
 }
 report.leaders=true
 const profile=await setup({job:null,profile:'sales_manager'})
 await profile.page.goto(base+'/accounting')
 await profile.page.getByRole('heading',{name:'CRM',exact:true}).waitFor()
 assert.equal(new URL(profile.page.url()).pathname,'/crm');await profile.context.close()
 await writeFile('test-results/sales-navigation.json',JSON.stringify(report,null,2))
 console.log(JSON.stringify(report))
}finally{await browser.close()}
