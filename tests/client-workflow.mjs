import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseURL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5173'
const user = { id: 2, full_name: 'Менеджер', email: 'manager@example.test', role: 'worker', is_active: true, module_access: { clients: 'edit' } }
const base = { cycle_id: 1, stage: 'lead', created_at: '2026-10-01T08:00:00Z', phone: '9000000000', email: '', contacts: [], chat_links: [], notes: [], tasks: [], houses_count: 1, via_agency: false, lead_unprocessed: false, manager_id: null, manager: null, payment_locked_at: null, documents_locked_at: null }
const task = (id, deadline) => ({ id, title: 'Позвонить', status: 'ready', deadline, blocking: false, assignee_ids: [], reports: [] })
const clients = [
  { ...base, id: 1, full_name: 'Без задачи' },
  { ...base, id: 2, full_name: 'Просроченный контакт', tasks: [task(1, '2026-10-29T09:00:00Z')] },
  { ...base, id: 3, full_name: 'Контакт сегодня', tasks: [task(2, '2026-10-29T11:00:00Z')] },
  { ...base, id: 4, full_name: 'Завершённый клиент', stage: 'completed' },
]
let managerPatch = null
let failAssignees = true
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Moscow' })
await context.addInitScript(() => {
  localStorage.setItem('soborbum.auth.token', 'test-token')
  localStorage.setItem('soborbum.onboarding.clients', '1')
})
const page = await context.newPage()
await page.clock.setFixedTime(new Date('2026-10-29T10:00:00Z'))
await page.route('**/api/**', async route => {
  const { pathname } = new URL(route.request().url())
  const method = route.request().method()
  let status = 200, body = []
  if (pathname === '/api/auth/me') body = user
  else if (pathname === '/api/clients/') body = clients
  else if (pathname === '/api/clients/assignees') {
    if (failAssignees) { status = 503; body = { detail: 'Временно недоступно' }; failAssignees = false }
    else body = [{ id: 2, full_name: 'Менеджер' }, { id: 3, full_name: 'Коллега' }]
  }
  else if (pathname === '/api/clients/1/manager' && method === 'PATCH') {
    managerPatch = route.request().postDataJSON()
    clients[0].manager_id = managerPatch.manager_id
    clients[0].manager = { id: 3, full_name: 'Коллега' }
    body = clients[0]
  } else { status = 404; body = { detail: 'Не найдено' } }
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
})
try {
  await page.goto(baseURL + '/clients')
  await page.getByText('Без задачи', { exact: true }).first().waitFor()
  assert.ok(await page.getByText('просрочено сегодня', { exact: false }).first().isVisible())
  const filter = page.getByLabel('Фильтр задач по клиентам')
  await filter.selectOption('no_task')
  assert.ok(await page.getByText('Без задачи', { exact: true }).first().isVisible())
  assert.equal(await page.getByText('Завершённый клиент', { exact: true }).count(), 0)
  assert.equal(await page.getByText('Просроченный контакт', { exact: true }).count(), 0)
  await filter.selectOption('overdue')
  assert.ok(await page.getByText('Просроченный контакт', { exact: true }).first().isVisible())
  assert.equal(await page.getByText('Контакт сегодня', { exact: true }).count(), 0)
  await filter.selectOption('today')
  assert.ok(await page.getByText('Контакт сегодня', { exact: true }).first().isVisible())
  await filter.selectOption('all')
  await page.getByText('Без задачи', { exact: true }).first().click()
  const panel = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Ответственный менеджер' }) }).filter({ has: page.getByRole('button', { name: 'Изменить' }) }).last()
  await panel.getByRole('button', { name: 'Изменить' }).click()
  await page.getByText('Не удалось загрузить список сотрудников.', { exact: false }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Сохранить', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await page.getByLabel('Ответственный менеджер').selectOption('3')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  assert.deepEqual(managerPatch, { manager_id: 3 })
  await page.getByText('Коллега', { exact: true }).first().waitFor({ state: 'visible' })
  console.log('Client workflow: filters, same-day deadline and manager assignment passed')
} finally {
  await context.close()
  await browser.close()
}
