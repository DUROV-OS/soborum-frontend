import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4185'
const browser = await chromium.launch({ headless: true })
const report = { base_url: base, synthetic_api: true, clicks: [], closed_routes: 0, leaders: false, mobile: false }
async function setup(role = 'worker', mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'test-token')
    for (const key of ['max', 'tasks', 'crm']) localStorage.setItem('soborbum.onboarding.' + key, '1')
  })
  const page = await context.newPage(), calls = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); calls.push(url.pathname)
    let body = []
    if (url.pathname === '/api/auth/me') body = { id: 6, full_name: 'Гостев Денис', email: 'manager@example.test', role, job_role: 'manager', is_active: true, module_access: Object.fromEntries(['clients', 'tasks', 'ai', 'accounting', 'production', 'cycle', 'house_models', 'warehouse'].map(key => [key, 'full'])) }
    else if (url.pathname === '/api/crm/catalog') body = { pipelines: [], stages: [], users: [{ id: 6, name: 'Менеджер тест' }], counts: {} }
    else if (url.pathname === '/api/crm/entries') body = { items: [], total: 0 }
    else if (url.pathname === '/api/crm/attention') body = { items: [], total: 0, counts: {}, settings: { response_hours: 24, idle_days: 3 } }
    else if (url.pathname === '/api/max/chats') body = { count: 0, chats: [] }
    else if (url.pathname === '/api/notifications/unread-count') body = { unread_count: 0 }
    else if (url.pathname === '/api/notifications/') body = [
      { id: 1, kind: 'money_movement_update', title: 'FORBIDDEN FINANCE', body: 'PRIVATE MONEY', object_type: 'money_movement', object_id: 1, read_at: null, created_at: new Date().toISOString() },
      { id: 2, kind: 'production_update', title: 'FORBIDDEN PRODUCTION', body: 'PRIVATE RECIPE', object_type: 'production', object_id: 1, read_at: null, created_at: new Date().toISOString() },
      { id: 3, kind: 'task_due', title: 'Разрешённая задача', body: 'Связаться с клиентом', object_type: 'task', object_id: 3, read_at: null, created_at: new Date().toISOString() },
    ]
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  return { page, context, calls, errors }
}
try {
  const m = await setup(); m.page.setDefaultTimeout(12000)
  await m.page.goto(base + '/today')
  await m.page.getByRole('heading', { name: 'Главное на сегодня.' }).waitFor()
  assert.equal(m.calls.some(path => /^\/api\/(dashboard|clients|sales|moysklad|accounting|production|ai)/.test(path)), false)
  const menu = m.page.getByRole('complementary', { name: 'Главное меню' })
  for (const [label, path, heading] of [
    ['CRM', '/crm', 'CRM'],
    ['Команда', '/team', 'Команда'], ['Задачи', '/tasks', 'Задачи'],
    ['Уведомления', '/notifications', 'Уведомления'], ['Мои заявки', '/feedback/my', 'Мои заявки'],
  ]) {
    await menu.getByRole('link', { name: label, exact: true }).click()
    await m.page.getByRole('heading', { name: heading, exact: true }).waitFor()
    assert.equal(new URL(m.page.url()).pathname + new URL(m.page.url()).search, path)
    report.clicks.push(label)
  }
  for (const [path, heading] of [['/crm?tab=company', 'CRM'], ['/sales', 'Продажи.'], ['/work', 'Работа.']]) {
    await m.page.goto(base + path)
    await m.page.getByRole('heading', { name: heading, exact: true }).waitFor()
  }
  for (const label of ['Компании', 'Продажи', 'Работа']) assert.equal(await menu.getByRole('link', { name: label, exact: true }).count(), 0)
  await menu.getByRole('link', { name: 'CRM', exact: true }).click()
  await m.page.getByRole('button', { name: 'Воронки и этапы', exact: true }).click()
  assert.equal(new URL(m.page.url()).search, '?tab=pipeline')
  await menu.getByRole('link', { name: 'Команда', exact: true }).click()
  await m.page.getByText('Менеджер тест', { exact: true }).waitFor()
  await menu.getByRole('link', { name: 'Уведомления', exact: true }).click()
  await m.page.getByText('Разрешённая задача', { exact: true }).waitFor()
  assert.equal(await m.page.getByText(/FORBIDDEN|PRIVATE MONEY|PRIVATE RECIPE/).count(), 0)
  for (const path of ['/accounting', '/production', '/recipes', '/warehouse', '/suppliers', '/moysklad?type=paymentin', '/clients/1', '/cycles/1', '/admin', '/ai', '/feedback/all', '/tasks?scope=all']) {
    await m.page.goto(base + path)
    await m.page.getByRole('heading', { name: 'Главное на сегодня.' }).waitFor()
    assert.equal(new URL(m.page.url()).pathname, '/today'); report.closed_routes++
  }
  const noGo = m.calls.filter(path => /^\/api\/(dashboard|clients|sales|moysklad|accounting|production|ai)/.test(path))
  assert.deepEqual(noGo, [])
  assert.deepEqual(m.errors, [])
  await mkdir('test-results', { recursive: true })
  await m.page.screenshot({ path: 'test-results/sales-workspace-desktop.png', fullPage: true })
  await m.context.close()
  const mobile = await setup('worker', true)
  await mobile.page.goto(base + '/today'); await mobile.page.getByRole('heading', { name: 'Главное на сегодня.' }).waitFor()
  await mobile.page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  await mobile.page.getByRole('complementary').getByRole('link', { name: 'MAX', exact: true }).click()
  assert.equal(new URL(mobile.page.url()).pathname, '/chats')
  assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await mobile.page.screenshot({ path: 'test-results/sales-workspace-mobile.png', fullPage: true })
  assert.deepEqual(mobile.errors, []); report.mobile = true; await mobile.context.close()
  const leader = await setup('admin'); await leader.page.goto(base + '/crm?tab=pipeline')
  await leader.page.getByRole('button', { name: 'Воронки и этапы', exact: true }).waitFor()
  assert.equal(new URL(leader.page.url()).search, '?tab=pipeline'); report.leaders = true; await leader.context.close()
  await writeFile('test-results/sales-workspace.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report))
} finally { await browser.close() }
