import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4192'
const browser = await chromium.launch({ headless: true })
const report = { base, synthetic_api: true, checks: [] }
const record = (id, kind, name, data = {}) => ({ id, kind, name, data, archived: false, version: 3, updated_at: '2026-11-04T09:00:00Z' })
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function setup({ level = 'full', failContact = false, delayed = false, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 } })
  await context.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'synthetic-tasks-token'))
  const page = await context.newPage(), reads = [], writes = [], errors = []
  page.setDefaultTimeout(12000)
  page.on('pageerror', error => errors.push(error.message))
  const entries = new Map()
  entries.set(100, record(100, 'deal', 'Дом для Анны', { pipeline_id: 1, stage_id: 10, contact_ids: [201, 202], amount: 7500000, responsible_user_id: 6 }))
  entries.set(201, record(201, 'contact', 'Анна Покупатель', { phone: '+7 (900) 111-22-33', responsible_user_id: 6 }))
  entries.set(202, record(202, 'contact', 'Игорь Покупатель', { phone: '+7 (900) 222-33-44', responsible_user_id: 6 }))
  const tasks = [record(1, 'task', 'Первый звонок', { entity_id: 100, responsible_user_id: 6, due_at: '2026-12-15T10:00:00Z', completed: false, description: 'Согласовать время', result: '' }), record(2, 'task', 'Отправить предложение', { entity_id: 100, responsible_user_id: 7, due_at: null, completed: true })]
  for (let index = 1; index <= 5; index++) {
    const dealId = 100 + index, contactId = 202 + index
    entries.set(dealId, record(dealId, 'deal', `Сделка ${index}`, { contact_ids: [contactId], responsible_user_id: 6 }))
    entries.set(contactId, record(contactId, 'contact', `Клиент ${index}`, { phone: `+7900333000${index}` }))
    tasks.push(record(index + 2, 'task', `Связаться с клиентом ${index}`, { entity_id: dealId, responsible_user_id: 6, completed: false }))
  }
  entries.set(300, record(300, 'inquiry', 'Заявка с сайта', { contact_name: 'Новый клиент', phone: '+7 (900) 555-66-77' }))
  tasks.push(record(8, 'task', 'Новая задача', { entity_id: 300, responsible_user_id: null, completed: false }))
  tasks.push(record(9, 'task', 'Задача без связи', { entity_id: null, responsible_user_id: 6, completed: false }))
  const archived = record(10, 'task', 'Архивная задача', { entity_id: 100, responsible_user_id: 7, completed: true })
  archived.archived = true; tasks.push(archived)
  if (delayed) {
    entries.set(600, record(600, 'contact', 'Устаревший клиент', { phone: '+79999999999' }))
    tasks.push(record(11, 'task', 'Задержанная задача', { entity_id: 600, responsible_user_id: 6, completed: false }))
  }
  const state = { active: 0, maxActive: 0, failContact, failNextPatch: 0, delayed, releaseDelayed: null, delayedStarted: false }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    let body = [], status = 200, counted = false
    if (request.method() !== 'GET') {
      const input = request.postDataJSON()
      writes.push({ method: request.method(), path, body: input })
      const match = path.match(/^\/api\/crm\/entries\/(\d+)$/), task = match ? tasks.find(value => value.id === Number(match[1])) : null
      if (request.method() === 'PATCH' && task) {
        if (state.failNextPatch) {
          status = state.failNextPatch; state.failNextPatch = 0
          if (status === 409) { task.version++; task.data.responsible_user_id = 8 }
          body = { detail: status === 409 ? 'Версия изменена' : 'Сохранение временно недоступно' }
        } else if (input.version !== task.version) { status = 409; body = { detail: 'Версия изменена' } }
        else {
          task.data = { ...task.data, ...input.data }; task.version++
          if (input.name) task.name = input.name
          body = task
        }
      } else { status = 400; body = { detail: 'Unexpected synthetic mutation' } }
    } else {
      reads.push(path + url.search)
      if (path === '/api/auth/me') body = { id: 6, full_name: 'Менеджер проверки', role: 'worker', job_role: 'manager', is_active: true, module_access: { clients: level, tasks: level } }
      else if (path === '/api/crm/catalog') body = { pipelines: [record(1, 'pipeline', 'Продажи')], stages: [record(10, 'stage', 'Новая заявка', { pipeline_id: 1, sort: 1, outcome: 'open' })], users: [{ id: 6, name: 'Денис' }, { id: 7, name: 'Антон' }, { id: 8, name: 'Мария' }], counts: { task: tasks.length } }
      else if (path === '/api/crm/entries') {
        const params = url.searchParams, query = (params.get('query') || '').toLowerCase(), archive = params.get('archive') || 'active'
        const items = params.get('kind') === 'task' ? tasks.filter(task => (!params.get('entity_id') || String(task.data.entity_id) === params.get('entity_id')) && task.name.toLowerCase().includes(query) && (archive === 'all' || task.archived === (archive === 'archived')) && (!params.get('owner_id') || String(task.data.responsible_user_id || 0) === params.get('owner_id'))) : []
        body = { total: items.length, items: items.slice(+(params.get('offset') || 0), +(params.get('offset') || 0) + +(params.get('limit') || 50)) }
      } else if (/^\/api\/crm\/entries\/\d+$/.test(path)) {
        const entryId = Number(path.split('/').at(-1))
        state.active++; state.maxActive = Math.max(state.maxActive, state.active); counted = true
        if (entryId === 600 && state.delayed) {
          state.delayedStarted = true
          await new Promise(resolve => { state.releaseDelayed = resolve })
        } else await wait(35)
        if (entryId === 201 && state.failContact) { state.failContact = false; status = 503; body = { detail: 'Попробуйте ещё раз' } }
        else { body = entries.get(entryId) || tasks.find(task => task.id === entryId); if (!body) { status = 404; body = { detail: 'Нет карточки' } } }
      } else if (/\/(history|files)$/.test(path)) body = { total: 0, items: [] }
      else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
    }
    if (counted) state.active--
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/crm?tab=task')
  return { page, context, reads, writes, errors, entries, tasks, state }
}

const row = (page, id) => page.locator(`[data-task-id="${id}"]`)
async function ready(page) { await row(page, 1).getByRole('link', { name: '+7 (900) 111-22-33', exact: true }).waitFor() }
async function saved(page, id, owner) {
  await page.waitForFunction(({ id, owner }) => {
    const row = document.querySelector(`[data-task-id="${id}"]`)
    return row?.getAttribute('aria-busy') === 'false' && row.querySelector('select')?.value === owner
  }, { id, owner })
}

try {
  const t = await setup(), { page } = t
  await ready(page)
  await row(page, 7).getByRole('link', { name: '+79003330005', exact: true }).waitFor()
  assert.equal(await row(page, 1).getByLabel('Ответственный: Первый звонок', { exact: true }).inputValue(), '6')
  assert.equal(await row(page, 1).getByRole('link', { name: '+7 (900) 111-22-33', exact: true }).getAttribute('href'), 'tel:+79001112233')
  assert.equal(await row(page, 1).getByRole('link').count(), 2)
  await row(page, 8).getByRole('button', { name: 'Новый клиент', exact: true }).waitFor()
  await row(page, 9).getByText('Не привязана', { exact: true }).waitFor()
  assert.equal(t.reads.filter(path => path === '/api/crm/entries/100').length, 1)
  assert.equal(t.reads.filter(path => path === '/api/crm/entries/201').length, 1)
  assert.equal(t.reads.filter(path => path === '/api/crm/entries/202').length, 1)
  assert.ok(t.state.maxActive <= 3, `Concurrent CRM reference requests: ${t.state.maxActive}`)
  report.checks.push('owners, linked CRM cards and both contact phones visible immediately; shared references fetched once; at most three concurrent requests')

  const before = structuredClone(t.tasks[0].data)
  await row(page, 1).getByLabel('Ответственный: Первый звонок', { exact: true }).selectOption('7')
  await saved(page, 1, '7')
  assert.deepEqual(t.writes.at(-1), { method: 'PATCH', path: '/api/crm/entries/1', body: { version: 3, data: { responsible_user_id: 7 } } })
  assert.deepEqual(t.tasks[0].data, { ...before, responsible_user_id: 7 })
  await page.reload(); await ready(page); await saved(page, 1, '7')
  await row(page, 1).getByRole('button', { name: 'Выполнить', exact: true }).click()
  await row(page, 1).getByText('Выполнена', { exact: true }).waitFor()
  assert.equal(t.writes.at(-1).body.version, 4)
  await page.reload(); await ready(page)
  await row(page, 1).getByText('Выполнена', { exact: true }).waitFor()
  report.checks.push('owner changes use current version and preserve relation/deadline/details; assignment and completed status survive full reload')

  t.state.failNextPatch = 503
  await row(page, 1).getByLabel('Ответственный: Первый звонок', { exact: true }).selectOption('6')
  await row(page, 1).getByRole('alert').filter({ hasText: 'Сохранение временно недоступно' }).waitFor()
  await saved(page, 1, '7')
  t.state.failNextPatch = 409
  await row(page, 1).getByLabel('Ответственный: Первый звонок', { exact: true }).selectOption('6')
  await row(page, 1).getByRole('alert').filter({ hasText: 'Задача уже изменена' }).waitFor()
  await saved(page, 1, '8')
  report.checks.push('failed assignment retains confirmed owner; version conflict reloads authoritative server assignment')

  await row(page, 1).getByRole('button', { name: 'Дом для Анны', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('dialog').getByText('Дом для Анны', { exact: true }).first().waitFor()
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await row(page, 1).getByRole('button', { name: 'Изменить', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Изменить · Задача' })
  await editor.waitFor()
  assert.equal(await editor.getByLabel(/^Название/).inputValue(), 'Первый звонок')
  await editor.getByRole('button', { name: 'Отмена', exact: true }).click()
  assert.ok(t.reads.every(path => !/^\/api\/clients(?:\/|\?|$)/.test(path)))
  assert.deepEqual(t.errors, [])
  await t.context.close()
  report.checks.push('client opens the CRM card; existing task editor remains available; no ERP clients or costs endpoint is used')

  const retry = await setup({ failContact: true })
  await row(retry.page, 1).getByRole('button', { name: 'Повторить загрузку', exact: true }).waitFor()
  assert.match(await row(retry.page, 1).innerText(), /Не удалось загрузить карточку/)
  await row(retry.page, 1).getByRole('button', { name: 'Повторить загрузку', exact: true }).click()
  await ready(retry.page)
  assert.equal(retry.reads.filter(path => path === '/api/crm/entries/100').length, 1)
  assert.equal(retry.reads.filter(path => path === '/api/crm/entries/201').length, 2)
  assert.deepEqual(retry.writes, []); assert.deepEqual(retry.errors, [])
  await retry.context.close()
  report.checks.push('failed contact lookup can be retried without reloading cached parent records or mutating data')

  const stale = await setup({ delayed: true })
  await ready(stale.page)
  for (let attempts = 0; attempts < 100 && !stale.state.delayedStarted; attempts++) await wait(20)
  assert.ok(stale.state.delayedStarted)
  await stale.page.getByLabel('Поиск в продажах').fill('Новая задача')
  await row(stale.page, 1).waitFor({ state: 'detached' })
  await row(stale.page, 8).getByRole('button', { name: 'Новый клиент', exact: true }).waitFor()
  const oldResponse = stale.page.waitForResponse(response => new URL(response.url()).pathname === '/api/crm/entries/600')
  stale.state.releaseDelayed(); await oldResponse
  assert.equal(await stale.page.getByText('Устаревший клиент', { exact: true }).count(), 0)
  assert.equal(await stale.page.locator('[data-task-id]').count(), 1)
  assert.deepEqual(stale.writes, []); assert.deepEqual(stale.errors, [])
  await stale.context.close()
  report.checks.push('late response from previous task filter cannot overwrite current client details')

  const viewer = await setup({ level: 'view', mobile: true })
  await ready(viewer.page)
  assert.equal(await viewer.page.getByRole('table', { name: 'Задачи CRM' }).locator('select').count(), 0)
  assert.equal(await viewer.page.getByRole('table', { name: 'Задачи CRM' }).getByRole('button', { name: /^Изменить$|^Выполнить$|^Возобновить$/ }).count(), 0)
  await row(viewer.page, 1).getByText('Денис', { exact: true }).waitFor()
  assert.ok(await viewer.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  assert.deepEqual(viewer.writes, []); assert.deepEqual(viewer.errors, [])
  await viewer.context.close()
  const archive = await setup()
  await ready(archive.page)
  await archive.page.getByLabel('Архив продаж').selectOption('archived')
  await row(archive.page, 10).waitFor()
  assert.equal(await row(archive.page, 10).locator('select').count(), 0)
  assert.equal(await row(archive.page, 10).getByRole('button', { name: /^Изменить$|^Выполнить$|^Возобновить$/ }).count(), 0)
  assert.deepEqual(archive.writes, []); assert.deepEqual(archive.errors, [])
  await archive.context.close()
  report.checks.push('read-only and archived tasks expose no mutation controls; mobile table stays within scrollable viewport')

  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/crm-tasks.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
