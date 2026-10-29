import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const baseURL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5174'
const browser = await chromium.launch({ headless: true })
const task = (id, title, assignees, reviewers = []) => ({ id, title, status: 'ready', deadline: null, assignees, reviewers, responsible: null })
const person = { id: 2, full_name: 'Тестовый сотрудник' }
const dashboard = { generated_at: new Date().toISOString(), summary: 'Общая сводка', widgets: [
  { section: 'accounting', title: 'Проводок', value: '4', tone: 'neutral' },
  { section: 'production', title: 'Заказов', value: '3', tone: 'neutral' },
], actions: [
  { id: 'clients:leads_stuck_over_14_days', section: 'clients', href: '/clients', title: 'Зависшие обращения', count: 1, tone: 'warning', description: 'Операционная CRM' },
  { id: 'production:problem', section: 'production', href: '/production', title: 'Риски производства', count: 1, tone: 'warning', description: 'Для руководителя' },
  { id: 'accounting:drafts', section: 'accounting', href: '/accounting', title: 'Проверить проводки', count: 1, tone: 'warning', description: 'Для бухгалтера' },
] }
async function setup({ jobRole = null, access = { tasks: 'view', clients: 'view', accounting: 'view', production: 'view' }, state = { prefs: null }, failSave = false } = {}) {
 const context = await browser.newContext()
 await context.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'test-token'))
 const page = await context.newPage(); const requests = []
 await page.route('**/api/**', async route => {
  const url = new URL(route.request().url()); requests.push(url.pathname)
  let body = [], status = 200
  if (url.pathname === '/api/auth/me') body = { id: 2, full_name: 'Тестовый сотрудник', email: 'worker@example.test', role: 'worker', job_role: jobRole, is_active: true, module_access: access }
  else if (url.pathname === '/api/auth/me/workspace') {
    if (route.request().method() === 'PUT') { if (failSave) { status = 503; body = { detail: 'Недоступно' } } else { state.prefs = route.request().postDataJSON(); body = state.prefs } }
    else body = state.prefs
  }
  else if (url.pathname === '/api/dashboard/today') body = dashboard
  else if (url.pathname === '/api/dashboard/aktualnoe') body = { items: [], degraded: false }
  else if (url.pathname === '/api/tasks/') body = [task(1, 'Своя задача', [person]), task(2, 'Свободная задача', []), task(3, 'Проверить работу', [], [person]), task(4, 'Чужая задача', [{ id: 9 }])]
  else if (url.pathname === '/api/clients/') body = [
   { id: 10, stage: 'lead', full_name: 'Мой клиент', manager_id: 2, tasks: [{ id: 1, title: 'Позвонить', status: 'ready', deadline: '2030-01-01T10:00:00Z', assignee_ids: [2] }] },
   { id: 11, stage: 'lead', full_name: 'Чужой клиент', manager_id: 9, tasks: [] },
  ]
  else { status = 404; body = { detail: 'Не найдено' } }
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
 })
 await page.goto(baseURL + '/today')
 await page.getByText('Выбрать блоки и направления').click()
 await page.getByRole('button', { name: 'Сохранить настройки' }).waitFor()
 return { context, page, requests, state }
}
try {
 const state = { prefs: null }
 const a = await setup({ state })
 await a.page.getByRole('button', { name: 'Руководитель', exact: true }).click()
 await a.page.getByRole('button', { name: 'Сохранить настройки' }).click()
 await a.page.getByText('Сохранено', { exact: true }).waitFor()
 await a.page.getByText('Своя задача', { exact: true }).waitFor()
 assert.equal(await a.page.getByText('Свободная задача', { exact: true }).count(), 0)
 assert.equal(await a.page.getByText('Проверить работу', { exact: true }).count(), 1)
 assert.equal(await a.page.getByText('Зависшие обращения', { exact: true }).count(), 0)
 assert.equal(await a.page.getByText('Риски производства', { exact: true }).count(), 1)
 await a.page.getByRole('checkbox', { name: 'Производство', exact: true }).uncheck()
 await a.page.getByRole('button', { name: 'Сохранить настройки' }).click()
 await a.page.getByText('Сохранено', { exact: true }).waitFor()
 assert.equal(await a.page.getByText('Риски производства', { exact: true }).count(), 0)
 await a.context.close()
 const anotherDevice = await setup({ state })
 assert.equal(await anotherDevice.page.getByRole('button', { name: 'Руководитель', exact: true }).getAttribute('aria-pressed'), 'true')
 assert.equal(await anotherDevice.page.getByRole('checkbox', { name: 'Производство', exact: true }).isChecked(), false)
 await anotherDevice.context.close()
 const m = await setup({ jobRole: 'manager' })
 await m.page.getByText('Мой клиент · Позвонить').waitFor()
 assert.equal(await m.page.getByText('Чужой клиент', { exact: false }).count(), 0)
 assert.equal(await m.page.getByRole('button', { name: 'Руководитель', exact: true }).count(), 0)
 await m.context.close()
 const b = await setup({ jobRole: 'accountant', access: { accounting: 'view' } })
 assert.equal(await b.page.getByRole('checkbox', { name: 'Бухгалтерия' }).count(), 1)
 assert.equal(await b.page.getByRole('checkbox', { name: 'Производство' }).count(), 0)
 assert.equal(b.requests.filter(x => x === '/api/tasks/' || x === '/api/clients/').length, 0)
 await b.page.getByText('Проверить проводки').waitFor()
 assert.equal(await b.page.getByText('Риски производства').count(), 0)
 await b.context.close()
 const c = await setup({ failSave: true })
 await c.page.getByRole('button', { name: 'Бухгалтер', exact: true }).click()
 await c.page.getByRole('button', { name: 'Сохранить настройки' }).click()
 await c.page.getByText('Не удалось сохранить настройки.', { exact: false }).waitFor()
 assert.equal(await c.page.getByText('Сохранено', { exact: true }).count(), 0)
 await c.context.close()
 console.log('Workspaces: role templates, permissions, personal data, server persistence and error handling passed')
} finally { await browser.close() }
