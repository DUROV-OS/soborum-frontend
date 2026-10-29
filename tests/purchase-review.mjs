import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const base=process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5173'
const browser=await chromium.launch({headless:true})
try {
 for(const failed of [false,true]){
  const ctx=await browser.newContext();await ctx.addInitScript(()=>localStorage.setItem('soborbum.auth.token','test-token'))
  const page=await ctx.newPage();let mutations=0
  const order={id:4,number:'4',supplier_id:1,supplier_name:'Поставщик',items:[],total_cost:100,paid:0,pending_payment:0,available_payment:100,unpaid:100,version:1,archived:false,status:'ordered',source_state:null,comment:null,expected_at:null}
  await page.route('**/api/**',async route=>{const url=new URL(route.request().url());let body=[],status=200
   if(route.request().method()!=='GET') mutations++
   if(url.pathname==='/api/auth/me')body={id:1,full_name:'Тест',email:'a@example.test',role:'admin',is_active:true,module_access:{}}
   else if(url.pathname==='/api/purchasing/catalog')body={suppliers:[],materials:[],accounts:[]}
   else if(url.pathname==='/api/purchasing/orders/4')body=order
   else if(url.pathname==='/api/purchasing/orders/4/automatic-review'){if(failed){status=503;body={detail:'offline'}}else body={decision:'manual_review',reasons:[{code:'price_evidence_missing',message:'Цена не подтверждена документами.'}]}}
   else if(url.pathname==='/api/purchasing/orders'||url.pathname==='/api/purchasing/receipts')body={total:0,items:[]}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
  })
  await page.goto(base+'/purchasing?order=4')
  if(failed) await page.getByText('Проверка недоступна.',{exact:false}).waitFor()
  else {await page.getByText('Цена не подтверждена документами.').waitFor();assert.ok(await page.getByText('Нужна ручная проверка').isVisible())}
  assert.equal(mutations,0);await ctx.close()
 }
 console.log('Purchase review: evidence gaps and error do not authorize actions')
} finally {await browser.close()}
