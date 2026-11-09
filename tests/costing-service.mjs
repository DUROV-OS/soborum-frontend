import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { approveItem, approveQuote } from './costing-approval-fixtures.mjs'
const base=process.env.COSTING_TEST_URL??'http://127.0.0.1:5182'
const browser=await chromium.launch({headless:true}),errors=[]
try {
  const context=await browser.newContext({viewport:{width:1440,height:1050}})
  await context.addInitScript(()=>localStorage.setItem('soborbum.auth.token','synthetic-only'))
  assert.equal((await context.request.post(base+'/api/costing-test/reset')).status(),200)
  const native=await (await context.request.post(base+'/api/costing-test/native')).json()
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
  await page.goto(base+'/costing?tab=template')
  await page.getByRole('button',{name:'Добавить типовую смету',exact:true}).click()
  let dialog=page.getByRole('dialog')
  await dialog.getByLabel('Название',{exact:true}).fill('Проектирование · услуга')
  await dialog.getByRole('checkbox',{name:'Услуга без материалов и складского учёта'}).check()
  await dialog.getByLabel('Замороженная цена, ₽',{exact:true}).fill('1000')
  await dialog.getByRole('button',{name:'Указать нули для всех расходов'}).click()
  await dialog.getByLabel('Основание расходов').fill('Синтетическая модель услуги')
  await dialog.getByRole('button',{name:'Сохранить',exact:true}).click()
  await dialog.waitFor({state:'hidden'})
  await approveItem(context.request,base,'Проектирование · услуга')
  await page.reload()
  await page.getByRole('article',{name:'Типовая смета: Проектирование · услуга',exact:true}).getByRole('button',{name:'Для клиента',exact:true}).click()
  dialog=page.getByRole('dialog')
  await dialog.getByLabel('Название / клиент').fill('Услуга для тестового клиента')
  await dialog.getByRole('button',{name:'Создать смету',exact:true}).click()
  await dialog.getByRole('link',{name:'Согласования и документы',exact:true}).waitFor()
  const quote=await approveQuote(context.request,base,'Услуга для тестового клиента')
  const response=await context.request.post(`${base}/api/costing/integration/estimates/${quote.id}/create-order`,{data:{version:quote.version,request_id:crypto.randomUUID(),reason:'Синтетическая услуга',counterparty_id:native.buyer_id,organization_id:native.organization_id}})
  assert.ok(response.ok(),await response.text())
  const linked=await response.json(),order=await (await context.request.get(base+'/api/sales/orders/'+linked.order_id)).json()
  assert.equal(order.lines[0].stock_tracked,false);assert.equal(order.lines[0].material_id,null)
  await page.goto(base+'/costing?tab=estimates&estimate='+quote.id)
  await page.getByRole('dialog').getByText('Расчёт закреплён',{exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Передать норматив в производство',exact:true}).count(),0)
  assert.deepEqual(errors,[])
  await writeFile('test-results/costing/service.json',JSON.stringify({service_without_stock:true,three_named_approvals:true,pageErrors:errors}))
  console.log('Service browser workflow passed: explicit service type, documented approval and normal sales order without stock/production controls.')
} finally {await browser.close()}
