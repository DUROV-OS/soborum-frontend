import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const baseURL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5174'
const browser = await chromium.launch({ headless: true })
const me = { id: 2, full_name: 'Тестовый сотрудник', email: 'worker@example.test', role: 'worker', is_active: true, module_access: { tasks: 'view', clients: 'view' } }
const task = (id, title, assignees, reviewers = []) => ({ id, title, status: 'ready', deadline: null, assignees, reviewers, responsible: null })
const person = { id: 2, full_name: 'Тестовый сотрудник' }
const dashboard = { generated_at: new Date().toISOString(), summary: 'Общая сводка', widgets: [], actions: [
  { id: 'clients:leads_stuck_over_14_days', section: 'clients', href: '/clients', title: 'Зависшие обращения', count: 1, tone: 'warning', description: 'Операционная CRM' },
  { id: 'production:problem', section: 'production', href: '/production', title: 'Риски производства', count: 1, tone: 'warning', description: 'Для руководителя' },
] }
async function setup({ access = true, fail = false } = {}) {
 const context = await browser.newContext()
 await context.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'test-token'))
 const page = await context.newPage(); const requests = []
 await page.route('**/api/**', async route => {
  const url = new URL(route.request().url()); requests.push(url.pathname)
  let body = [], status = 200
  if (url.pathname === '/api/auth/me') body = { ...me, module_access: access ? me.module_access : {} }
  else if (url.pathname === '/api/dashboard/today') body = dashboard
  else if (url.pathname === '/api/dashboard/aktualnoe') body = { items: [], degraded: false }
  else if (url.pathname === '/api/tasks/') { if (fail) { status = 503; body = { detail: 'Недоступно' } } else body = [task(1, 'Своя задача', [person]), task(2, 'Свободная задача', []), task(3, 'Проверить работу', [], [person]), task(4, 'Чужая задача', [{ id: 9 }])] }
  else if (url.pathname === '/api/clients/') body = [
   { id: 10, stage: 'lead', full_name: 'Мой клиент', manager_id: 2, tasks: [{ id: 1, title: 'Позвонить', status: 'ready', deadline: '2030-01-01T10:00:00Z', assignee_ids: [2] }] },
   { id: 11, stage: 'lead', full_name: 'Чужой клиент', manager_id: 9, tasks: [{ id: 2, title: 'Чужой звонок', status: 'ready', deadline: null, assignee_ids: [2] }] },
   { id: 12, stage: 'completed', full_name: 'Завершённый клиент', manager_id: 2, tasks: [] },
  ]
  else { status = 404; body = { detail: 'Не найдено' } }
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
 })
 await page.goto(baseURL + '/today')
 return { context, page, requests }
}
try {
 const a = await setup()
 await a.page.getByRole('button', { name: 'Руководитель', exact: true }).click()
 await a.page.getByText('Своя задача', { exact: true }).waitFor()
 assert.equal(await a.page.getByText('Свободная задача', { exact: true }).count(), 0)
 assert.equal(await a.page.getByText('Чужая задача', { exact: true }).count(), 0)
 assert.equal(await a.page.getByText('Проверить работу', { exact: true }).count(), 1)
 assert.equal(await a.page.getByText('Зависшие обращения', { exact: true }).count(), 0)
 assert.equal(await a.page.getByText('Риски производства', { exact: true }).count(), 1)
 await a.page.getByRole('button', { name: 'Менеджер', exact: true }).click()
 await a.page.getByText('Мой клиент · Позвонить').waitFor()
 assert.equal(await a.page.getByText('Чужой клиент', { exact: false }).count(), 0)
 assert.equal(await a.page.getByText('Риски производства', { exact: true }).count(), 0)
 await a.page.reload()
 await a.page.getByText('Мой клиент · Позвонить').waitFor()
 assert.equal(await a.page.getByRole('button', { name: 'Менеджер', exact: true }).getAttribute('aria-pressed'), 'true')
 await a.context.close()
 const b = await setup({ access: false })
 await b.page.getByRole('button', { name: 'Менеджер', exact: true }).click()
 await b.page.getByText('Доступ к задачам не назначен.').waitFor()
 assert.equal(b.requests.filter(x => x === '/api/tasks/' || x === '/api/clients/').length, 0)
 await b.context.close()
 const c = await setup({ fail: true })
 await c.page.getByRole('button', { name: 'Руководитель', exact: true }).click()
 await c.page.getByText('Не удалось загрузить задачи.', { exact: false }).waitFor()
 assert.equal(await c.page.getByText('Открытых назначенных задач нет.').count(), 0)
 await c.context.close()
 console.log('Workspace views: assignments, CRM placement, persistence, access and errors passed')
} finally { await browser.close() }
