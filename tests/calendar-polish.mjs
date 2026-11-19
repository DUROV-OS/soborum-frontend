import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
const base='http://127.0.0.1:5186', api='http://127.0.0.1:8155'
const browser=await chromium.launch({headless:true,channel:'msedge'})
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Europe/Moscow'})
await context.addInitScript(()=>{localStorage.setItem('soborbum.auth.token','isolated-calendar-test');localStorage.setItem('soborbum.onboarding.chats','1')})
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
await page.clock.setFixedTime(new Date('2026-11-19T10:00:00+03:00'))
let lostResponse=true,calendarPosts=0
const chats=[{id:1,title:'Юлия',type:'DIALOG'},{id:2,title:'Производство',type:'CHAT'},{id:3,title:'Новости',type:'CHANNEL'}].map(c=>({...c,unread:0,lastMessage:null,lastEventTime:null,phone:null}))
await page.route('**/api/**',async route=>{
 const url=new URL(route.request().url()),path=url.pathname
 if(path.startsWith('/api/projects/calendar')) {
  const response=await route.fetch({url:api+path+url.search})
  if(path.endsWith('/people')) assert((await response.json()).some(p=>p.id===2&&p.can_work_tasks))
  if(path.endsWith('/events')&&route.request().method()==='POST') {
   calendarPosts++
   if(lostResponse){lostResponse=false;assert.equal(response.status(),201);return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Ответ потерян. Повторите сохранение.'})})}
  }
  return route.fulfill({response})
 }
 const body=path==='/api/auth/me'?{id:1,full_name:'Тестовый руководитель',role:'admin',is_active:true,module_access:{}}:path==='/api/max/chats'?{count:chats.length,chats}:path.includes('unread-count')?{count:0}:[]
 return route.fulfill({contentType:'application/json',body:JSON.stringify(body)})
})
const output='test-results/calendar-polish';await mkdir(output,{recursive:true})
const events=async()=>await (await context.request.get(api+'/api/projects/calendar/events',{params:{start:'2026-11-19T00:00:00Z',end:'2026-11-21T00:00:00Z'}})).json()
try {
 await page.goto(base+'/calendar');await page.getByRole('tab',{name:'День',exact:true}).click()
 await page.getByRole('button',{name:'Создать встречу 19.11.2026 08:00',exact:true}).waitFor()
 assert.equal(await page.getByRole('button',{name:/Создать встречу 19.11.2026/}).count(),26)
 assert.equal(await page.getByRole('button',{name:/Ночное событие,/}).count(),0)
 await page.getByRole('button',{name:/Пограничное событие,/}).waitFor()
 assert.equal(await page.getByRole('button',{name:/Создать встречу.*(07:30|21:00|23:30)/}).count(),0)
 await page.getByRole('button',{name:'Добавить',exact:true}).click();await page.getByRole('menuitem',{name:'Планёрка',exact:true}).click()
 assert(await page.getByRole('button',{name:'Сохранить',exact:true}).isEnabled())
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByRole('alert').filter({hasText:'Укажите тему'}).waitFor()
 assert.equal(await page.getByLabel('Тема встречи',{exact:true}).getAttribute('aria-invalid'),'true')
 await page.getByLabel('Тема встречи',{exact:true}).fill('Проверка планёрки')
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByRole('alert').filter({hasText:'Ответ потерян'}).waitFor()
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByRole('button',{name:/Проверка планёрки,/}).waitFor()
 assert.equal((await events()).filter(e=>e.title==='Проверка планёрки').length,1)
 for(const [type,title] of [['Юбилеи','Проверка юбилея'],['Задача','Проверка задачи']]) {
  await page.getByRole('button',{name:'Добавить',exact:true}).click();await page.getByRole('menuitem',{name:type,exact:true}).click()
  await page.getByLabel('Тема встречи',{exact:true}).fill(title)
  if(type==='Задача'){
   await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByRole('alert').filter({hasText:'Выберите исполнителя'}).waitFor()
   await page.getByRole('combobox',{name:'Исполнитель',exact:true}).selectOption('2');await page.getByRole('combobox',{name:'Проверяющий',exact:true}).selectOption('3')
  }
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByLabel('Тема встречи',{exact:true}).waitFor({state:'hidden'})
 }
 await page.reload();await page.getByRole('button',{name:/Проверка планёрки,/}).waitFor()
 const saved=await events();assert(saved.find(e=>e.title==='Проверка задачи').task?.id);assert(saved.find(e=>e.title==='Проверка юбилея').all_day)
 assert.equal(calendarPosts,4)
 await page.getByRole('link',{name:'Настройки',exact:true}).click();await page.getByLabel('Цвет: Планёрки').fill('#0072b2');await page.getByRole('button',{name:'Сохранить настройки'}).click();await page.getByText('Настройки сохранены.').waitFor()
 await page.reload();assert.equal(await page.getByLabel('Цвет: Планёрки').inputValue(),'#0072b2')
 await page.getByRole('link',{name:'Мой календарь',exact:true}).click();await page.getByRole('tab',{name:'День',exact:true}).click()
 const event=page.getByRole('button',{name:/Проверка планёрки,/});await event.waitFor()
 assert.equal(await event.evaluate(e=>getComputedStyle(e).borderLeftColor),'rgb(0, 114, 178)')
 assert.equal(await event.locator('[data-calendar-category="briefing"]').count(),1)
 const transfer=await page.evaluateHandle(()=>new DataTransfer());await event.dispatchEvent('dragstart',{dataTransfer:transfer})
 const column=page.locator('[data-calendar-day]').first(),bounds=await column.boundingBox()
 await column.dispatchEvent('drop',{dataTransfer:transfer,clientY:bounds.y+75*1.2});await page.getByText('Время события изменено',{exact:true}).waitFor()
 assert.equal(new Date((await events()).find(e=>e.title==='Проверка планёрки').start).toISOString(),'2026-11-19T06:15:00.000Z')
 await event.waitFor();await page.getByText('Загружаем календарь…',{exact:true}).waitFor({state:'hidden'})
 await page.screenshot({path:output+'/calendar-desktop.png'})
 await page.getByRole('tab',{name:'Расписание',exact:true}).click();await page.getByRole('button',{name:/Ночное событие/}).waitFor()
 await page.goto(base+'/chats');await page.getByRole('button',{name:/Мессенджер Макс Производство/}).waitFor()
 const tabs=page.getByRole('group',{name:'Категории чатов'});assert.equal(await tabs.getByRole('button',{name:'Все',exact:true}).getAttribute('aria-pressed'),'true')
 const colors=[]
 for(const name of ['Все','Группы','Личные чаты']) {
  const tab=tabs.getByRole('button',{name,exact:true});colors.push(await tab.evaluate(e=>getComputedStyle(e).color));await tab.click();assert.equal(await tab.getAttribute('aria-pressed'),'true')
 }
 assert.equal(new Set(colors).size,3)
 assert.equal(await page.getByRole('button',{name:/Мессенджер Макс Производство/}).count(),0)
 await tabs.getByRole('button',{name:'Все',exact:true}).click()
 assert.equal(await page.locator('.max-chat-icon').count(),3)
 for(const width of [1440,768,390]) {
  await page.setViewportSize({width,height:900})
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  assert.deepEqual(await page.locator('.max-chat-icon svg').first().evaluate(e=>[e.getBoundingClientRect().width,e.getBoundingClientRect().height]),[18,18])
  await page.screenshot({path:output+`/messenger-${width}.png`})
 }
 await page.goto(base+'/calendar');await page.getByRole('tab',{name:'День',exact:true}).click();await page.getByRole('button',{name:/Проверка планёрки,/}).waitFor()
 await page.screenshot({path:output+'/calendar-mobile.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 assert.deepEqual(errors,[])
 console.log('PASS: 08–21 grid, clipping, creation persisted for briefing/task/anniversary, full task, lost-response retry, saved category color, drag offset, MAX filters and 3 responsive sizes')
} finally {await browser.close()}
