import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const baseURL=process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5174'
const browser=await chromium.launch({headless:true})
try {
 const ctx=await browser.newContext(); await ctx.addInitScript(()=>{localStorage.setItem('soborbum.auth.token','test-token');localStorage.setItem('soborbum.onboarding.clients','1')})
 const page=await ctx.newPage(); let submitted=null
 const client={id:21,cycle_id:21,stage:'lead',created_at:'2026-01-01T00:00:00Z',full_name:'Тестовый клиент',phone:'900',email:'',contacts:[],chat_links:[],notes:[],tasks:[],houses_count:1,via_agency:false,lead_unprocessed:false,manager_id:null,manager:null}
 await page.route('**/api/**',async route=>{const u=new URL(route.request().url());let status=200,body=[]
  if(u.pathname==='/api/auth/me')body={id:2,full_name:'Менеджер',email:'test@example.test',role:'worker',is_active:true,module_access:{clients:'view'}}
  else if(u.pathname==='/api/clients/')body=[client]
  else if(u.pathname==='/api/clients/margin-preview'){submitted=route.request().postDataJSON();body={status:'below_target',missing:[],cost:'65.00',fixed_share:'10.00',profit:'34.99',margin_percent:'34.99',markup_percent:'53.83',minimum_price:'100.00'}}
  else{status=404;body={detail:'not found'}}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
 })
 await page.goto(baseURL+'/clients/21')
 await page.getByText('Предварительный расчёт маржи изделия').click()
 for(const [label,value] of [['Цена продажи изделия, ₽','99,99'],['Материалы на изделие, ₽','30'],['Работы на изделие, ₽','15'],['Закупка изделия, ₽','0'],['Прочие расходы на изделие, ₽','10'],['Постоянные расходы за месяц, ₽','100'],['План изделий за календарный месяц, шт.','10']])await page.getByLabel(label,{exact:true}).fill(value)
 await page.getByRole('button',{name:'Рассчитать',exact:true}).click()
 await page.getByText('Маржа ниже 35%').waitFor()
 assert.equal(submitted.sale_price,'99.99');assert.equal(submitted.planned_items,10)
 assert.ok(await page.getByText('Минимальная цена при марже 35%:',{exact:false}).isVisible())
 assert.ok(await page.getByText('не блокирует оформление продажи',{exact:false}).isVisible())
 await ctx.close();console.log('Margin preview: inputs, decimal handling, results and scope disclosure passed')
} finally {await browser.close()}
