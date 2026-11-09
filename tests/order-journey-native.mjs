import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import {approveItem,approveQuote} from './costing-approval-fixtures.mjs'
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:5194',out='../../output/order-journey-20261109'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1050}}),errors=[]
await context.addInitScript(()=>localStorage.setItem('soborbum.auth.token','synthetic-native-journey'))
const request=context.request
async function call(path,method='get',data,role='owner'){const r=await request[method](base+'/api'+path,{data,headers:{'x-costing-test-role':role}});assert.ok(r.ok(),await r.text());return r.json()}
let role='owner'
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname;if(['/api/auth/me','/api/sales/','/api/costing/','/api/purchasing/'].some(prefix=>p===prefix||p.startsWith(prefix)))return route.continue({headers:{...route.request().headers(),'x-costing-test-role':role}});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(p==='/api/auth/me/workspace'?{view:'director',blocks:[],sections:[]}:[])})})
try{
 const ids=await call('/journey-test/data')
 const imported=await call(`/costing/integration/recipes/${ids.recipe_id}/import`,'post',{warehouse:'Склад Технология'})
 const items=await call('/costing/items?kind=template'),item=items.find(i=>i.id===imported.item_id)
 assert.ok(item)
 const expenses=Object.fromEntries(['labor','transport','subcontract','overhead','commercial','advertising','taxes','reserve'].map(k=>[k,'0']));expenses.evidence='Синтетическое основание'
 await call(`/costing/items/${item.id}`,'put',{version:item.version,kind:'template',title:item.title,content:{...item.content,expenses,retail_price:'1000'}})
 await approveItem(request,base,item.title)
 let quote=await call('/costing/estimates','post',{request_id:crypto.randomUUID(),title:'Маршрут изолированного дома',template_id:item.id,quantity:'1'})
 await approveQuote(request,base,quote.title)
 quote=await call(`/costing/estimates/${quote.id}`)
 const version=()=>({version:quote.version,request_id:crypto.randomUUID(),reason:'Изолированный маршрут'})
 const link=await call(`/costing/integration/estimates/${quote.id}/create-order`,'post',{...version(),counterparty_id:ids.buyer_id,organization_id:ids.organization_id})
 const oid=link.order_id
 await call(`/costing/integration/estimates/${quote.id}/production-recipe`,'post',{...version(),order_id:oid,line_index:0})
 await call(`/sales/orders/${oid}/confirm`,'post',{version:1})
 let route=await call(`/sales/orders/${oid}/journey`)
 assert.equal(route.lines[0].next.code,'manufacture');assert.equal(route.lines[0].estimate.approved,true)
 const material=route.lines[0].materials[0]
 const purchase=await call('/purchasing/orders','post',{supplier_id:ids.supplier_id,items:[{warehouse_material_id:material.id,material:material.title,unit:material.unit,quantity:2,unit_price:50,stock_tracked:true}]})
 const before=await call('/sales/catalog')
 await page.goto(base+`/sales?order=${oid}`);await page.getByText('Выпустить изделие по утверждённому нормативу',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Связать с закупкой',exact:true}).click()
 let dialog=page.getByRole('dialog',{name:'Закупка для заказа',exact:true})
 await dialog.getByLabel('Позиция закупки').selectOption(`${purchase.id}:0`)
 await dialog.getByLabel('Количество для этого заказа').fill('2');await dialog.getByRole('button',{name:'Закрепить количество'}).click()
 await page.getByRole('button',{name:'Снять закрепление',exact:true}).waitFor()
 route=await call(`/sales/orders/${oid}/journey`);assert.equal(route.lines[0].purchases.length,1);assert.equal(route.lines[0].purchases[0].fresh,true)
 assert.deepEqual(await call('/sales/catalog'),before)
 await page.screenshot({path:out+'/native-route-desktop.png',fullPage:true})
 await page.getByRole('button',{name:'Снять закрепление',exact:true}).click()
 dialog=page.getByRole('dialog',{name:'Снять закрепление закупки',exact:true});await dialog.getByLabel('Причина снятия').fill('Перераспределение · изолированный сценарий');await dialog.getByRole('button',{name:'Снять закрепление',exact:true}).click()
 await dialog.waitFor({state:'hidden'})
 await page.getByRole('button',{name:'Снять закрепление',exact:true}).waitFor({state:'hidden'})
 assert.equal((await call(`/sales/orders/${oid}/journey`)).lines[0].purchases.length,0)
 const denied=await request.get(base+`/api/sales/orders/${oid}/journey`,{headers:{'x-costing-test-role':'sales'}});assert.equal(denied.status(),404)
 await call(`/journey-test/assign/${quote.id}`,'post')
 role='sales';await page.setViewportSize({width:390,height:844});await page.goto(base+`/costing?tab=estimates&estimate=${quote.id}`)
 await page.getByRole('button',{name:'Открыть маршрут заказа',exact:true}).click()
 const managerRoute=page.getByRole('dialog',{name:`Маршрут заказа №${oid}`,exact:true})
 await managerRoute.getByText('Выпустить изделие по утверждённому нормативу',{exact:true}).waitFor()
 assert.equal(await managerRoute.getByRole('button',{name:'Связать с закупкой'}).count(),0)
 assert.equal(await managerRoute.getByRole('link',{name:'Перейти к действию'}).count(),0)
 assert.ok(await managerRoute.evaluate(e=>e.scrollWidth<=e.clientWidth+1))
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await page.screenshot({path:out+'/native-manager-mobile.png',fullPage:true})
 assert.deepEqual(errors,[])
 const report={real_api:true,real_approval_documents:true,allocation_and_release:true,stock_unchanged:true,manager_ownership:true,manager_mobile:true,pageErrors:errors,production_test_writes:false}
 await writeFile(out+'/native-ui-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}catch(error){await page.screenshot({path:out+'/native-failure.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(-3000));throw error}finally{await browser.close()}
