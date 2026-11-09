import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4192'
const browser = await chromium.launch({ headless: true })
const report = { base, synthetic_api: true, checks: [] }
const person = id => ({ id, full_name: id === 6 ? 'Денис' : 'Антон', role: 'worker', is_active: true })
const entry = (id, kind, name, data = {}) => ({ id, kind, name, data, archived: false, version: 1, updated_at: '2026-11-04T09:00:00Z', source_created_at: '2026-11-04T09:00:00Z', source_created_at_kind: 'local' })
const commonTask = (id, title, crmId, owner = 6, assigned = [6]) => ({ id, title, description: '', priority: 'medium', status: 'ready', deadline: null, created_at: '2026-11-04T09:00:00Z', block_id: null, link_type: 'none', link_id: null, link_meta: crmId ? { crm_task_id: crmId } : null, assignees: assigned.map(person), responsible: owner ? person(owner) : null, reviewers: [], images: [], reports: [], depends_on_ids: [], review_policy: 'auto_close_allowed', review_blocked_reason: null })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

async function setup({ clients = true, delayed = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await context.addInitScript(() => { localStorage.setItem('soborbum.auth.token', 'synthetic-task-context'); localStorage.setItem('soborbum.onboarding.tasks', '1') })
  const page = await context.newPage(), reads = [], writes = [], errors = []
  page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message))
  const common = [commonTask(11, 'Задача по сделке', 900), commonTask(12, 'Задача другого ответственного', 901, 7), commonTask(13, 'Единственный исполнитель', null, null), commonTask(14, 'Чужая закрытая область', null, 7, [7]), commonTask(15, 'Проверить старую связь', 902), commonTask(16, 'Свободная задача', null, null, [])]
  const records = new Map([
    entry(100, 'deal', 'Дом Анны', { contact_ids: [201], pipeline_id: 1, stage_id: 10, responsible_user_id: 6 }),
    entry(101, 'inquiry', 'Заявка Бориса', { contact_name: 'Борис', phone: '+7 900 222-33-44' }),
    entry(201, 'contact', 'Анна', { phone: '+7 900 111-22-33' }),
    { ...entry(900, 'task', 'CRM задача Анны', { entity_id: 100, responsible_user_id: 6, completed: false }), board_task_id: 11, priority: 'medium' },
    { ...entry(901, 'task', 'CRM задача Бориса', { entity_id: 101, responsible_user_id: 7, completed: false }), board_task_id: 12, priority: 'medium' },
    { ...entry(902, 'task', 'CRM старая связь', { entity_id: 100, responsible_user_id: 6, completed: false }), board_task_id: 9999, priority: 'medium' },
  ].map(value => [value.id, value]))
  const state = { delayed, delayedStarted: false, release: null }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, query = url.searchParams
    if (request.method() !== 'GET') { writes.push({ method: request.method(), path }); return route.fulfill({ status: 400, contentType: 'application/json', body: '{}' }) }
    reads.push(path + url.search)
    let body = [], status = 200
    if (path === '/api/auth/me') body = { ...person(6), job_role: 'manager', module_access: { tasks: 'view', ...(clients ? { clients: 'view' } : {}) } }
    else if (path === '/api/tasks/') {
      if (query.get('scope') === 'all') { status = 403; body = { detail: 'Нет доступа' } }
      else body = common.filter(task => task.assignees.some(user => user.id === 6) || task.responsible?.id === 6 || !task.assignees.length).filter(task => !query.has('responsible_id') || String(task.responsible?.id || (task.assignees.length === 1 ? task.assignees[0].id : 0)) === query.get('responsible_id')).filter(task => !query.get('priority') || task.priority === query.get('priority'))
    } else if (path === '/api/crm/catalog') body = { pipelines: [entry(1, 'pipeline', 'Продажи')], stages: [entry(10, 'stage', 'Новая заявка', { pipeline_id: 1, outcome: 'open', sort: 1 })], users: [{ id: 6, name: 'Денис' }, { id: 7, name: 'Антон' }], counts: { task: 3, deal: 1, inquiry: 1 } }
    else if (path === '/api/crm/entries') {
      const items = [...records.values()].filter(row => row.kind === query.get('kind')).filter(row => !query.has('owner_id') || String(row.data.responsible_user_id || 0) === query.get('owner_id')).filter(row => !query.get('priority') || row.priority === query.get('priority'))
      const offset = +(query.get('offset') || 0), limit = +(query.get('limit') || 50)
      body = { total: items.length, items: items.slice(offset, offset + limit) }
    } else if (/^\/api\/crm\/entries\/\d+$/.test(path)) {
      const id = Number(path.split('/').at(-1)); body = records.get(id)
      if (!body) { status = 404; body = { detail: 'Нет карточки' } }
      if (id === 100 && state.delayed) { state.delayed = false; state.delayedStarted = true; await new Promise(resolve => { state.release = resolve }) }
    } else if (/\/(history|files)$/.test(path)) body = { total: 0, items: [] }
    else if (path === '/api/crm/kanban-summary') body = { columns: [{ pipeline_id: 1, stage_id: 10, count: 2, amounts: {}, unpriced_count: 2 }], unmapped_count: 0 }
    else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return { page, context, reads, writes, errors, records, state }
}

const card = (page, id) => page.locator(`[data-task-card-id="${id}"]`).first()
async function boardCount(page, count) { await page.getByRole('status').filter({ hasText: new RegExp(`^Задач: ${count}$`) }).waitFor() }

try {
  const t = await setup(), { page } = t
  await page.goto(base + '/tasks'); await boardCount(page, 5)
  const owner = page.getByLabel('Фильтр по ответственному', { exact: true })
  await owner.selectOption('7'); await boardCount(page, 1)
  assert.equal(await card(page, 12).count(), 1); assert.equal(await card(page, 14).count(), 0)
  assert.ok(t.reads.includes('/api/tasks/?scope=mine&responsible_id=7'))
  await owner.selectOption('6'); await boardCount(page, 3)
  assert.equal(await card(page, 13).count(), 1)
  await owner.selectOption('0'); await boardCount(page, 1)
  await card(page, 16).waitFor()
  await owner.selectOption(''); await boardCount(page, 5)
  assert.equal(await page.getByRole('tab', { name: 'Все задачи', exact: true }).count(), 0)
  report.checks.push('common Mine has responsible filter without All permission; explicit owner/sole-assignee fallback/unassigned/reset are consistent and cannot reveal another employee private task')

  await card(page, 11).click()
  let dialog = page.getByRole('dialog', { name: 'Задача по сделке', exact: true })
  const client = dialog.getByRole('region', { name: 'Клиент по задаче' })
  await client.getByRole('button', { name: 'Открыть CRM-карточку: Анна', exact: true }).waitFor()
  await client.getByRole('button', { name: 'Действия с номером +7 900 111-22-33', exact: true }).click()
  const phone = page.getByRole('dialog', { name: 'Действия с номером', exact: true })
  await phone.getByRole('button', { name: 'Копировать номер', exact: true }).waitFor()
  assert.equal(await phone.locator('a[href^="tel:"]').count(), 0)
  await phone.getByRole('button', { name: 'Закрыть', exact: true }).click()
  assert.deepEqual(t.writes, [])
  await client.getByRole('button', { name: 'Открыть CRM-карточку: Анна', exact: true }).click()
  await page.getByRole('dialog', { name: 'Анна', exact: true }).waitFor()
  assert.equal(new URL(page.url()).pathname, '/crm')
  report.checks.push('open common task contains its CRM client and phone; canonical board link is checked; phone opens actions without calling; client opens CRM instead of ERP')

  await page.goto(base + '/crm?tab=task')
  await page.locator('[data-task-id="900"]').waitFor()
  await page.getByLabel('Фильтр по ответственному', { exact: true }).selectOption('7')
  await page.locator('[data-task-id="900"]').waitFor({ state: 'detached' })
  await page.locator('[data-task-id="901"]').getByRole('button', { name: 'CRM задача Бориса', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'CRM задача Бориса', exact: true })
  await dialog.getByRole('region', { name: 'Клиент по задаче' }).getByRole('button', { name: 'Действия с номером +7 900 222-33-44', exact: true }).waitFor()
  assert.ok(t.reads.some(path => path.startsWith('/api/crm/entries?') && new URL('http://test' + path).searchParams.get('owner_id') === '7'))
  assert.deepEqual(t.errors, []); assert.deepEqual(t.writes, [])
  assert.equal(t.reads.some(path => /^\/api\/(clients|production|warehouse|accounting|moysklad)/.test(path)), false)
  await t.context.close()
  report.checks.push('CRM Tasks tab responsible filter works; opened task itself displays inquiry client/phone, with no ERP or cost endpoints')

  const mismatch = await setup()
  await mismatch.page.goto(base + '/tasks'); await boardCount(mismatch.page, 5)
  await card(mismatch.page, 15).click()
  const mismatchDialog = mismatch.page.getByRole('dialog', { name: 'Проверить старую связь', exact: true })
  await mismatchDialog.getByRole('alert').waitFor()
  assert.equal(mismatch.reads.includes('/api/crm/entries/100'), false)
  mismatch.records.get(902).board_task_id = 15
  await mismatchDialog.getByRole('button', { name: 'Повторить загрузку клиента', exact: true }).click()
  await mismatchDialog.getByRole('button', { name: 'Действия с номером +7 900 111-22-33', exact: true }).waitFor()
  assert.deepEqual(mismatch.writes, []); assert.deepEqual(mismatch.errors, [])
  await mismatch.context.close()
  report.checks.push('stale noncanonical CRM pointer does not expose a client; safe retry recovers after canonical link is restored in synthetic fixture')

  const stale = await setup({ delayed: true })
  await stale.page.goto(base + '/tasks'); await boardCount(stale.page, 5)
  await card(stale.page, 11).click()
  for (let attempt = 0; attempt < 100 && !stale.state.delayedStarted; attempt++) await pause(10)
  assert.ok(stale.state.delayedStarted)
  await stale.page.getByRole('dialog', { name: 'Задача по сделке', exact: true }).getByRole('button', { name: 'Закрыть', exact: true }).click()
  await card(stale.page, 12).click()
  const nextDialog = stale.page.getByRole('dialog', { name: 'Задача другого ответственного', exact: true })
  await nextDialog.getByRole('button', { name: 'Действия с номером +7 900 222-33-44', exact: true }).waitFor()
  const late = stale.page.waitForResponse(response => new URL(response.url()).pathname === '/api/crm/entries/100')
  stale.state.release(); await late; await pause(50)
  assert.equal(await nextDialog.getByRole('button', { name: 'Действия с номером +7 900 111-22-33', exact: true }).count(), 0)
  assert.deepEqual(stale.errors, []); assert.deepEqual(stale.writes, []); await stale.context.close()
  const denied = await setup({ clients: false })
  await denied.page.goto(base + '/tasks'); await boardCount(denied.page, 5)
  await card(denied.page, 11).click()
  await denied.page.getByRole('dialog', { name: 'Задача по сделке', exact: true }).waitFor()
  assert.equal(await denied.page.getByRole('region', { name: 'Клиент по задаче' }).count(), 0)
  assert.equal(denied.reads.some(path => path.startsWith('/api/crm/')), false)
  assert.deepEqual(denied.errors, []); assert.deepEqual(denied.writes, []); await denied.context.close()
  report.checks.push('late client lookup cannot replace another opened task; users without CRM view do not request or see CRM client details')

  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/task-client-context.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
