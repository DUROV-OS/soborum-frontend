import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const baseURL=process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5174'
const browser=await chromium.launch({headless:true})
try {
 const ctx=await browser.newContext()
 await ctx.addInitScript(()=>{localStorage.setItem('soborbum.auth.token','test-token');localStorage.setItem('soborbum.onboarding.warehouse','1')})
 const page=await ctx.newPage(), requests=[]
 let remaining=5, stock=3, issued=0
 await page.route('**/api/**',async route=>{
  const u=new URL(route.request().url()), method=route.request().method(); requests.push(u.pathname)
  let body=[],status=200
  if(u.pathname==='/api/auth/me') body={id:8,full_name:'Специалист склада',email:'keeper@example.test',role:'worker',job_role:'storekeeper',is_active:true,module_access:{warehouse:'edit'}}
  else if(u.pathname==='/api/warehouse/materials') body=[]
  else if(u.pathname==='/api/warehouse/requests' && method==='GET') body=remaining ? [{id:5,production_id:1,production_name:'Дом',block_name:'Каркас',material_title:'Брус',unit:'шт',quantity:remaining,in_stock:stock,is_fractional:false,requested_by:'Илья',created_at:'2026-01-01T00:00:00Z'}] : []
  else if(u.pathname==='/api/warehouse/requests/5/approve' && method==='POST'){ const qty=route.request().postDataJSON().quantity; if(qty>remaining||qty>stock){status=400;body={detail:'Превышен остаток'}} else {issued+=qty;remaining-=qty;stock-=qty;body={id:5,quantity:remaining}} }
  else {status=404;body={detail:'not found'}}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
 })
 await page.goto(baseURL+'/warehouse?tab=requests')
 await page.getByText('Брус · Дом').waitFor()
 assert.ok(await page.getByText('Запросил: Илья',{exact:false}).isVisible())
 assert.ok(await page.getByText('Не хватает 2',{exact:false}).isVisible())
 const input=page.getByRole('textbox',{name:'К выдаче: Брус'});assert.equal(await input.inputValue(),'3')
 await input.fill('4');assert.ok(await page.getByRole('button',{name:'Выдать',exact:true}).isDisabled())
 await input.fill('2');await page.getByRole('button',{name:'Выдать',exact:true}).click()
 await page.getByText('Выдача проведена.',{exact:false}).waitFor()
 await page.getByText('Осталось по заявке: 3',{exact:false}).waitFor()
 assert.equal(issued,2);assert.equal(stock,1)
 assert.equal(requests.filter(x=>x.startsWith('/api/tasks')).length,0)
 await ctx.close()
 console.log('Warehouse queue: access, shortages, partial issue and remaining request passed')
} finally {await browser.close()}
