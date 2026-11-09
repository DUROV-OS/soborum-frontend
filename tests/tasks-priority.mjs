import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4192'
const browser = await chromium.launch({ headless: true })
const report = { base, synthetic_api: true, checks: [] }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const priorities = ['high', 'medium', 'low']
const person = { id: 6, full_name: 'Денис', role: 'worker', is_active: true }
const task = index => ({ id: index + 1, title: `Общая задача ${index + 1}`, description: '', status: index === 0 ? 'done' : 'ready', priority: priorities[index % 3], created_at: '2026-11-04T09:00:00Z', deadline: null, block_id: null, link_type: 'none', link_id: null, link_meta: null, assignees: [person], responsible: person, reviewers: [], images: [], reports: [], depends_on_ids: [], review_policy: 'auto_close_allowed', review_blocked_reason: null })
const entry = (id, kind, name, data = {}) => ({ id, kind, name, data, archived: false, version: 1, created_at: '2026-11-04T09:00:00Z', source_created_at: '2026-11-04T09:00:00Z', source_created_at_kind: 'local', updated_at: '2026-11-04T09:00:00Z' })

async function setup({ all = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await context.addInitScript(() => { localStorage.setItem('soborbum.auth.token', 'synthetic-priority-token'); localStorage.setItem('soborbum.onboarding.tasks', '1') })
  const page = await context.newPage(), reads = [], writes = [], errors = []
  page.setDefaultTimeout(12000)
  page.on('pageerror', error => errors.push(error.message))
  const common = Array.from({ length: 11 }, (_, index) => task(index))
  const crm = Array.from({ length: 129 }, (_, index) => ({ ...entry(1000 + index, 'task', `CRM задача ${index}`, { entity_id: null, responsible_user_id: 6, completed: false }), board_task_id: index < 127 ? 2000 + index : null, priority: index < 127 ? priorities[index % 3] : null }))
  const state = { delayHigh: false, releaseHigh: null, highStarted: false }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, params = url.searchParams
    let body = [], status = 200
    if (request.method() !== 'GET') { writes.push({ method: request.method(), path }); return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: 'Unexpected synthetic mutation' }) }) }
    reads.push(path + url.search)
    if (path === '/api/auth/me') body = { ...person, job_role: all ? null : 'manager', module_access: { tasks: 'view', clients: 'view', ...(all ? { tasks_all: 'view' } : {}) } }
    else if (path === '/api/tasks/') {
      if (params.get('scope') === 'all' && !all) { status = 403; body = { detail: 'Нет доступа' } }
      else body = common.filter(item => (!params.get('priority') || item.priority === params.get('priority')) && (params.get('status') !== 'open' || item.status !== 'done'))
      if (params.get('priority') === 'high' && state.delayHigh) {
        state.delayHigh = false; state.highStarted = true
        await new Promise(resolve => { state.releaseHigh = resolve })
      }
    } else if (path === '/api/crm/catalog') body = { pipelines: [], stages: [], users: [{ id: 6, name: 'Денис' }], counts: { task: crm.length } }
    else if (path === '/api/crm/entries') {
      const query = (params.get('query') || '').toLowerCase(), offset = +(params.get('offset') || 0), limit = +(params.get('limit') || 50)
      const items = params.get('kind') === 'task' ? crm.filter(item => (!params.get('priority') || item.priority === params.get('priority')) && item.name.toLowerCase().includes(query)) : []
      body = { total: items.length, items: items.slice(offset, offset + limit) }
    } else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return { page, context, reads, writes, errors, common, crm, state }
}

async function commonCount(page, count, priority) {
  await page.waitForFunction(({ count, priority }) => {
    const cards = [...document.querySelectorAll('[data-task-card-id]')]
    return cards.length === count && (!priority || cards.every(card => card.dataset.priority === priority))
  }, { count, priority })
  await page.getByRole('status').filter({ hasText: `Задач: ${count}` }).waitFor()
}

try {
  const t = await setup(), { page } = t
  await page.goto(base + '/tasks')
  await commonCount(page, 11)
  await page.getByLabel('Фильтр по приоритету', { exact: true }).selectOption('high')
  await commonCount(page, 4, 'high')
  assert.ok(t.reads.includes('/api/tasks/?scope=mine&priority=high'))
  await page.getByRole('tab', { name: 'Все задачи', exact: true }).click()
  await commonCount(page, 4, 'high')
  assert.ok(t.reads.includes('/api/tasks/?scope=all&priority=high'))
  await page.getByLabel('Фильтр по приоритету', { exact: true }).selectOption('medium')
  await commonCount(page, 4, 'medium')
  await page.getByRole('button', { name: 'Сбросить приоритет', exact: true }).click()
  await commonCount(page, 11)
  report.checks.push('common board uses existing low/medium/high values for mine/all; displayed count and column cards match; clearing priority restores all tasks')

  t.state.delayHigh = true
  await page.getByLabel('Фильтр по приоритету', { exact: true }).selectOption('high')
  for (let attempt = 0; attempt < 100 && !t.state.highStarted; attempt++) await wait(10)
  assert.ok(t.state.highStarted)
  await page.getByLabel('Фильтр по приоритету', { exact: true }).selectOption('low')
  await commonCount(page, 3, 'low')
  const staleResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/tasks/' && new URL(response.url()).searchParams.get('priority') === 'high')
  t.state.releaseHigh(); await staleResponse
  await commonCount(page, 3, 'low')
  await page.goto(base + '/tasks?scope=all&status=open')
  await commonCount(page, 10)
  assert.equal(await page.getByLabel('Фильтр по приоритету', { exact: true }).inputValue(), '')
  await page.getByLabel('Фильтр по приоритету', { exact: true }).selectOption('high')
  await commonCount(page, 3, 'high')
  assert.ok(t.reads.includes('/api/tasks/?scope=all&status=open&priority=high'))
  await page.getByText('Показаны открытые задачи выбранного приоритета.', { exact: false }).waitFor()
  report.checks.push('late priority response cannot replace newer selection; Pulse open-status entry resets filters and combines with priority correctly')

  await page.goto(base + '/crm?tab=task')
  await page.locator('[data-task-id="1000"]').waitFor()
  assert.equal(await page.locator('[data-task-id]').count(), 50)
  await page.getByRole('button', { name: 'Далее', exact: true }).click()
  await page.locator('[data-task-id="1050"]').waitFor()
  await page.getByLabel('Фильтр по приоритету', { exact: true }).selectOption('high')
  await page.locator('[data-task-id="1000"]').waitFor()
  await page.waitForFunction(() => document.querySelectorAll('[data-task-id]').length === 43)
  await page.getByText(/1–43 из\s*43/).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Далее', exact: true }).isDisabled(), true)
  const highRead = t.reads.filter(path => path.startsWith('/api/crm/entries?') && new URL('http://test' + path).searchParams.get('priority') === 'high').at(-1)
  assert.equal(new URL('http://test' + highRead).searchParams.get('offset'), '0')
  assert.deepEqual(await page.locator('[data-task-id]').evaluateAll(nodes => nodes.map(node => Number(node.dataset.taskId))), t.crm.filter(item => item.priority === 'high').map(item => item.id))
  await page.locator('[data-task-id="1000"]').getByText('Высокий', { exact: true }).waitFor()
  await page.getByLabel('Фильтр по приоритету', { exact: true }).selectOption('low')
  await page.waitForFunction(() => document.querySelectorAll('[data-task-id]').length === 42)
  await page.getByText(/1–42 из\s*42/).waitFor()
  await page.getByLabel('Фильтр по приоритету', { exact: true }).selectOption('')
  await page.locator('[data-task-id="1000"]').waitFor()
  await page.getByText(/1–50 из\s*129/).waitFor()
  assert.equal(await page.locator('[data-task-id]').count(), 50)
  assert.equal(await page.getByRole('table', { name: 'Задачи CRM' }).locator('select').count(), 0)
  assert.deepEqual(t.writes, []); assert.deepEqual(t.errors, [])
  await t.context.close()
  report.checks.push('CRM priority is filtered before pagination; changing filter on page 2 resets offset; counts and exact IDs match all 129 canonical tasks; clearing includes unlinked tasks; read-only users can filter without writes')

  const restricted = await setup({ all: false })
  await restricted.page.goto(base + '/tasks?scope=mine')
  await commonCount(restricted.page, 11)
  assert.equal(await restricted.page.getByRole('tab', { name: 'Все задачи', exact: true }).count(), 0)
  await restricted.page.getByLabel('Фильтр по приоритету', { exact: true }).selectOption('low')
  await commonCount(restricted.page, 3, 'low')
  assert.equal(restricted.reads.some(path => path.startsWith('/api/tasks/?scope=all')), false)
  assert.deepEqual(restricted.writes, []); assert.deepEqual(restricted.errors, [])
  await restricted.context.close()
  report.checks.push('priority filter retains permission-limited mine scope; no unauthorized all-scope requests or mutation controls')

  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/tasks-priority.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
