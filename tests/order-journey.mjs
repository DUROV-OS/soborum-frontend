import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:5192',out='../../output/order-journey-20261109'
await mkdir(out,{recursive:true})
const errors=[],writes=[];let fail=false,reject=true,allocation=false,version=2
const order=()=>({id:1,number:'ЗК-101',counterparty_name:'Тестовый покупатель',organization_name:'Тестовая организация',counterparty_id:1,organization_id:1,status:'confirmed',fulfillment:'waiting',version,total:1000,currency:'RUB',opening_paid:0,source_id:null,source_state:null,archived:false,financial_fields_locked:true,expected_at:'2026-11-15',address:'Тестовая площадка',note:'',lines:[{material_id:1,title:'Дом по утверждённой комплектации',unit:'шт',stock_tracked:true,quantity:'1',unit_price:'1000',line_total:'1000',order_line:0,shipped_quantity:0,remaining_quantity:1,reserved_quantity:0}],events:[],shipments:[]})
const routeData=()=>({order_id:1,number:'ЗК-101',version,status:'confirmed',archived:false,expected_at:'2026-11-15',overdue:false,as_of:'2026-11-09T19:00:00Z',source_hash:'a'.repeat(64),can_release:true,note:'Закрепление закупки не выполняет оплату, приёмку или резерв.',lines:[{index:0,title:'Дом по утверждённой комплектации',unit:'шт',quantity:'1',shipped:'0',remaining:'1',reserved:'0',free_for_line:'0',shortage:'1',stock_tracked:true,estimate:{id:1,number:'СМ-101',revision:2,approved:true,fresh:true,stages:[{stage:'production',person:'Илья · тест',approved:true,signoff_id:11},{stage:'accounting',person:'Татьяна · тест',approved:true,signoff_id:12},{stage:'director',person:'Руководитель · тест',approved:true,signoff_id:13}]},quote_href:'/costing?tab=estimates&estimate=1',recipe:{id:3,title:'Норматив дома',valid:true,completed_fraction:'0',runs:[]},materials:[{id:4,title:'Доска по проекту',unit:'м3',norm:'4',remaining:'4',available:'1',shortage:'3'}],purchases:allocation?[{id:9,number:'ЗП-88',quantity:'3',fresh:true,material_id:4,supplier_order_id:8,supplier_line:0,expected_at:'2026-11-11',receipts:[]}]:[],shipments:[],next:{code:'purchase_materials',title:'Обеспечить недостающие материалы',responsible:'Специалист склада и снабжения',href:'/purchasing',section:'purchasing'},warnings:[],can_allocate:true}]})
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1050}})
await context.addInitScript(()=>localStorage.setItem('soborbum.auth.token','synthetic-journey'))
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
await page.route('**/api/**',async route=>{
 const request=route.request(),p=new URL(request.url()).pathname;let body=[],status=200
 if(p==='/api/auth/me')body={id:1,role:'admin',job_role:'director',full_name:'Руководитель · тест',email:'test@example.invalid',is_active:true,module_access:{}}
 else if(p==='/api/auth/me/workspace')body={view:'director',blocks:[],sections:[]}
 else if(p==='/api/sales/orders')body={items:[order()],total:1}
 else if(p==='/api/sales/orders/1')body=order()
 else if(p==='/api/sales/orders/1/journey'){body=routeData();if(fail){status=503;body={detail:'Проверка временно недоступна'}}}
 else if(p==='/api/sales/orders/1/supply-options')body=[{supplier_order_id:8,supplier_line:0,supplier_version:2,number:'ЗП-88',material_id:4,title:'Доска по проекту',unit:'м3',available_quantity:'3',expected_at:'2026-11-11'}]
 else if(p==='/api/sales/orders/1/supply-allocations'){
  writes.push(request.postDataJSON());if(reject){status=409;body={detail:'Проверьте доступное количество'}}else{allocation=true;version++;body={id:9}}
 }else if(p==='/api/sales/orders/1/supply-allocations/9/release'){writes.push(request.postDataJSON());allocation=false;version++;body={released:true}}
 else if(p==='/api/costing/context')body={title:'Заказ',estimates:[],templates:[],links:[],order_version:version,can_import_recipe:false,order_lines:null}
 else if(p==='/api/sales/catalog')body={counterparties:[{id:1,name:'Тестовый покупатель',active:true}],organizations:[{id:1,name:'Тестовая организация'}],materials:[]}
 else if(p==='/api/sales/shipments')body={items:[],total:0}
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
})
async function fit(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));for(const d of await page.getByRole('dialog').all())assert.ok(await d.evaluate(e=>e.scrollWidth<=e.clientWidth+1))}
try{
 await page.goto(base+'/sales?order=1');await page.getByRole('heading',{name:'Маршрут заказа',exact:true}).waitFor()
 await page.getByText('Обеспечить недостающие материалы',{exact:true}).waitFor();await fit()
 await page.screenshot({path:out+'/journey-desktop.png',fullPage:true})
 await page.getByText('Материалы для оставшегося выпуска',{exact:true}).click()
 await page.getByText('Доска по проекту',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Связать с закупкой',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Закупка для заказа',exact:true})
 await dialog.getByLabel('Позиция закупки',{exact:true}).selectOption('8:0')
 assert.equal(await dialog.getByLabel('Количество для этого заказа').inputValue(),'')
 await dialog.getByLabel('Количество для этого заказа').fill('4');assert.equal(await dialog.getByRole('button',{name:'Закрепить количество'}).isEnabled(),false)
 await dialog.getByLabel('Количество для этого заказа').fill('3');await dialog.getByRole('button',{name:'Закрепить количество'}).click()
 await dialog.getByRole('alert').waitFor();assert.equal(await dialog.getByLabel('Количество для этого заказа').inputValue(),'3')
 reject=false;await dialog.getByRole('button',{name:'Закрепить количество'}).click()
 await page.getByText('Закупка №ЗП-88, строка 1',{exact:true}).waitFor()
 assert.equal(writes[0].request_id,writes[1].request_id);assert.equal(writes[1].quantity,'3')
 await page.getByRole('button',{name:'Снять закрепление',exact:true}).click()
 const release=page.getByRole('dialog',{name:'Снять закрепление закупки',exact:true})
 assert.equal(await release.getByRole('button',{name:'Снять закрепление',exact:true}).isEnabled(),false)
 await release.getByLabel('Причина снятия').fill('Заказ обеспечивается другой поставкой');await release.getByRole('button',{name:'Снять закрепление',exact:true}).click()
 await page.getByText('Закупка №ЗП-88, строка 1',{exact:true}).waitFor({state:'hidden'})
 await page.setViewportSize({width:390,height:844});await page.reload();await page.getByText('Обеспечить недостающие материалы',{exact:true}).waitFor();await fit()
 await page.screenshot({path:out+'/journey-mobile.png',fullPage:true})
 await page.getByRole('button',{name:'Связать с закупкой',exact:true}).click();await page.getByRole('dialog',{name:'Закупка для заказа'}).getByLabel('Позиция закупки').waitFor();await fit()
 await page.screenshot({path:out+'/allocation-mobile.png',fullPage:true})
 await page.getByRole('dialog',{name:'Закупка для заказа'}).getByRole('button',{name:'Закрыть',exact:true}).last().click()
 fail=true;await page.getByRole('button',{name:'Обновить маршрут'}).click();await page.getByText('Статусы скрыты до успешной повторной проверки.').waitFor()
 assert.equal(await page.getByText('Обеспечить недостающие материалы',{exact:true}).count(),0)
 fail=false;await page.getByRole('button',{name:'Повторить проверку'}).click();await page.getByText('Обеспечить недостающие материалы',{exact:true}).waitFor()
 assert.deepEqual(errors,[])
 const result={desktop:true,mobile:true,explicit_empty_quantity:true,limits:true,conflict_preserves_input:true,idempotent_retry:true,reasoned_release:true,failed_refresh_hides_old_data:true,pageErrors:errors}
 await writeFile(out+'/ui-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
}finally{await browser.close()}
