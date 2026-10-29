import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseURL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5179'
const client = {id:21,cycle_id:21,stage:'lead',created_at:'2026-10-01T08:00:00Z',full_name:'Тестовый клиент',phone:'9000000000',email:'',contacts:[],chat_links:[],notes:[],tasks:[],houses_count:1,via_agency:false,lead_unprocessed:false,manager_id:null,manager:null,payment_locked_at:null,documents_locked_at:null,is_paid:false,balance_paid:false,balance_state:'pending',payment_plan:null,final_price:null,advance_amount:null,order_type:null,contract_file:null,contract_appendix_file:null,house_project_file:null,ar_file:null,kr_file:null,balance_due_date:null}
const fixture = {id:1,phone:'79000000000',direction:'in',employee:'Тестовый сотрудник',started_at:'2026-10-29T10:00:00Z',duration:65,status:'Success',client_id:21,crm_entity_id:null,match_status:'matched',audio_ready:true,processing:'ready',error:'',transcript:'Пришлите расчёт завтра.',segments:[{start:0,end:3,text:'Пришлите расчёт завтра.'}],analysis:{summary:'Клиент запросил расчёт.',key_points:[{text:'Нужен расчёт',quote:'Пришлите расчёт завтра.'}],tasks:[]},reviewed_at:null}
const browser = await chromium.launch({headless:true})
let mediaRequests=0, reviews=0, links=0
try {
  for (const [level,width] of [['edit',1440],['view',390]]) {
    const context=await browser.newContext({viewport:{width,height:1000}})
    await context.addInitScript(()=>localStorage.setItem('soborbum.auth.token','test-token'))
    const page=await context.newPage()
    await page.route('**/api/**',async route=>{
      const req=route.request(),url=new URL(req.url())
      let body=[],status=200
      if(url.pathname==='/api/auth/me') body={id:2,full_name:'Сотрудник',role:'worker',email:'test@example.test',is_active:true,module_access:{clients:level}}
      else if(url.pathname==='/api/clients/') body=[client]
      else if(url.pathname==='/api/crm/calls') body={total:1,items:[url.searchParams.get('unmatched')==='true'?{...fixture,id:2,client_id:null,match_status:'unmatched'}:fixture]}
      else if(url.pathname==='/api/crm/calls/1/audio') {
        assert.equal(req.headers().authorization,'Bearer test-token');mediaRequests++
        return route.fulfill({status:200,contentType:'audio/mpeg',body:Buffer.from('test')})
      }
      else if(url.pathname.endsWith('/review')) {reviews++;body={...fixture,reviewed_at:new Date().toISOString()}}
      else if(url.pathname.endsWith('/link')) {links++;assert.equal(req.postDataJSON().client_id,21);body=fixture}
      else {status=404;body={detail:'Не найдено'}}
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
    })
    await page.goto(baseURL+'/clients/21')
    await page.getByText('Звонки клиента',{exact:false}).waitFor()
    await page.getByText('Входящий · 79000000000',{exact:true}).click()
    await page.getByRole('button',{name:'Открыть запись',exact:true}).click()
    await page.locator('audio').waitFor()
    assert.match(await page.locator('audio').getAttribute('src'),/^blob:/)
    await page.getByText('Полный текст разговора',{exact:true}).click()
    assert.ok(await page.getByText('0:00',{exact:true}).isVisible())
    assert.ok(await page.getByText('Клиент запросил расчёт.',{exact:true}).isVisible())
    if(level==='edit') {
      await page.getByRole('button',{name:'Отметить проверенным',exact:true}).click()
      assert.equal(reviews,1)
      await page.screenshot({path:'phone-calls-preview.png',fullPage:true})
      await page.getByRole('button',{name:'Без привязки / спорные номера',exact:true}).click()
      await page.getByText('Входящий · 79000000000',{exact:true}).click()
      await page.getByRole('button',{name:'Привязать к этой карточке',exact:true}).click()
      assert.equal(links,1)
    } else {
      assert.equal(await page.getByRole('button',{name:'Отметить проверенным',exact:true}).count(),0)
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth))
    }
    await context.close()
  }
  assert.equal(mediaRequests,2)
  console.log('Phone calls: desktop/mobile, transcript, authenticated audio, review, manual linking and view-only permissions passed')
} finally {await browser.close()}
