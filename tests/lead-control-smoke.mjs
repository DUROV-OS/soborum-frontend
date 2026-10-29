import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'synthetic-lead-control-test'))
const owner = {
  id: 1,
  full_name: 'Тестовый владелец',
  email: 'owner@example.test',
  role: 'admin',
  module_access: {},
  is_active: true,
  created_at: new Date().toISOString(),
}
const deal = {
  id: 10,
  kind: 'deal',
  name: 'Дом без следующего шага',
  version: 1,
  archived: false,
  data: { pipeline_id: 1, stage_id: 2, responsible_user_id: 1, amount: 100 },
}
let created = false,
  configured = false,
  settings = { response_hours: 24, idle_days: 3 }
await page.route('**/api/**', async (route) => {
  const req = route.request(),
    url = new URL(req.url()),
    path = url.pathname
  let body = []
  if (path === '/api/auth/me') body = owner
  else if (path === '/api/auth/users') body = [owner]
  else if (path.includes('/unread')) body = { count: 0, unread_count: 0 }
  else if (path === '/api/crm/catalog')
    body = {
      pipelines: [{ id: 1, name: 'Продажи', data: {} }],
      stages: [{ id: 2, name: 'Новый', data: { pipeline_id: 1, outcome: 'open' } }],
      users: [{ id: 1, name: owner.full_name }],
      counts: { deal: 1, contact: 0, company: 0, task: created ? 1 : 0, inquiry: 0 },
    }
  else if (path === '/api/crm/attention')
    body = {
      total: created ? 0 : 1,
      counts: created ? {} : { no_next_step: 1 },
      items: created
        ? []
        : [
            {
              entry_id: 10,
              kind: 'deal',
              name: deal.name,
              reason: 'no_next_step',
              title: 'Нет следующего шага',
              due_at: null,
            },
          ],
      settings,
    }
  else if (path === '/api/crm/settings' && req.method() === 'PUT') {
    settings = req.postDataJSON()
    assert.equal(settings.response_hours, 4)
    configured = true
    body = settings
  } else if (path === '/api/crm/entries') body = { total: 1, items: [deal] }
  else if (path === '/api/crm/entries/10') body = deal
  else if (path.endsWith('/files') || path.endsWith('/history')) body = { total: 0, items: [] }
  else if (path === '/api/crm/entries/task' && req.method() === 'POST') {
    const b = req.postDataJSON()
    assert.equal(b.data.entity_id, 10)
    assert.ok(b.data.due_at)
    created = true
    body = {
      id: 11,
      kind: 'task',
      name: b.name,
      version: 1,
      archived: false,
      data: b.data,
      board_task_id: 101,
    }
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
})
try {
  await page.goto('http://127.0.0.1:5173/crm')
  await page.getByRole('button', { name: 'Требует внимания · 1' }).click()
  await page.getByRole('button', { name: 'Настроить контроль' }).click()
  const config = page.getByRole('dialog', { name: 'Контроль новых лидов', exact: true })
  await config.getByLabel('Срок первого шага').fill('4')
  await config.getByRole('button', { name: 'Сохранить правила' }).click()
  await page.getByRole('button', { name: 'Назначить шаг' }).click()
  const task = page.getByRole('dialog', { name: 'Создать · Задача', exact: true })
  await task.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await page.getByRole('link', { name: 'Общий список задач' }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Общий список задач' }).getAttribute('href'), '/tasks')
  assert.ok(created && configured)
  assert.deepEqual(errors, [])
  console.log('PASS: lead attention, owner settings, next-step task with deadline and shared task board link')
} finally {
  await browser.close()
}
