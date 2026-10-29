import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'
await mkdir('test-results', { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const owner = {
  id: 1,
  full_name: 'Владелец · тестовая среда',
  email: 'owner@example.test',
  role: 'admin',
  is_active: true,
  module_access: {},
  created_at: new Date().toISOString(),
}
let deal = {
  id: 20,
  kind: 'deal',
  name: 'Тестовый дом',
  archived: false,
  version: 1,
  data: { pipeline_id: 1, stage_id: 2, amount: 1200000, contact_ids: [] },
}
const pipeline = {
  id: 1,
  kind: 'pipeline',
  name: 'Продажи домов',
  archived: false,
  version: 1,
  data: { sort: 1 },
}
const stage = {
  id: 2,
  kind: 'stage',
  name: 'Первый контакт',
  archived: false,
  version: 1,
  data: { pipeline_id: 1, sort: 1, outcome: 'open' },
}
const inquiry = {
  id: 3,
  kind: 'inquiry',
  name: 'Заявка с сайта',
  archived: false,
  version: 1,
  data: { pipeline_id: 1, phone: '+79990000000', client_id: 7 },
}
const recipe = {
  id: 1,
  title: 'Тестовая техкарта',
  archived: false,
  version: 1,
  content: {
    inputs: [{ material_id: 1, title: 'Брус', quantity: '0.0025', unit: 'м³' }],
    outputs: [{ material_id: 2, title: 'Изделие', quantity: 1, unit: 'шт' }],
    stages: [{ title: 'Сборка' }],
  },
}
let created = false,
  noted = false,
  accepted = false,
  manufactured = false
await page.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'synthetic-test-token'))
await page.route('**/api/**', async (route) => {
  const request = route.request(),
    url = new URL(request.url()),
    path = url.pathname
  let body = []
  if (path === '/api/auth/me') body = owner
  else if (path === '/api/auth/users') body = [owner]
  else if (path.includes('/unread')) body = { count: 0, unread_count: 0 }
  else if (path === '/api/crm/catalog')
    body = {
      pipelines: [pipeline],
      stages: [stage],
      users: [{ id: 1, name: owner.full_name }],
      counts: { deal: 1, contact: 1, company: 0, task: 0, inquiry: 1 },
    }
  else if (path === '/api/crm/entries' && request.method() === 'GET')
    body = { total: 1, items: [url.searchParams.get('kind') === 'inquiry' ? inquiry : deal] }
  else if (path === '/api/crm/entries/deal') {
    const b = request.postDataJSON()
    assert.equal(b.name, 'Новая сделка')
    assert.equal(b.data.amount, 2500000)
    created = true
    deal = { ...deal, id: 21, name: b.name, data: b.data }
    body = deal
  } else if (path.endsWith('/notes') && request.method() === 'POST') {
    noted = request.postDataJSON().text === 'Обсудили проект'
    body = { id: 1 }
  } else if (path === '/api/crm/entries/3/accept') {
    accepted = true
    deal = { ...deal, id: 22, name: request.postDataJSON().name }
    body = deal
  } else if (path.endsWith('/history') || path.endsWith('/files')) body = { total: 0, items: [] }
  else if (path === '/api/moysklad/catalog')
    body = {
      imported_at: new Date().toISOString(),
      source_completed_at: new Date().toISOString(),
      categories: [{ type: 'product', title: 'Товары', count: 2, archived: 1 }],
      warnings: [],
    }
  else if (path === '/api/moysklad/records') {
    const archived = url.searchParams.get('archive') === 'archived'
    body = {
      total: 1,
      items: [
        {
          id: 7,
          type: 'product',
          title: archived ? 'Архивная деталь' : 'Новая деталь',
          archived,
          state: null,
        },
      ],
    }
  } else if (path === '/api/moysklad/records/7')
    body = {
      id: 7,
      type: 'product',
      title: 'Архивная деталь',
      archived: true,
      payload: { name: 'Архивная деталь', archived: true, code: 'OLD-1' },
    }
  else if (path === '/api/moysklad/techcards') body = [recipe]
  else if (path.endsWith('/preview'))
    body = {
      inputs: [{ id: 1, title: 'Брус', quantity: 0.0025, unit: 'м³', stock: 1, enough: true }],
      outputs: [{ id: 2, title: 'Изделие', quantity: 1, unit: 'шт' }],
    }
  else if (path.endsWith('/manufacture')) {
    const b = request.postDataJSON()
    assert.match(b.request_id, /^[0-9a-f-]{36}$/)
    manufactured = true
    body = { run_id: 1 }
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
})
try {
  await page.goto(base + '/moysklad')
  await page.getByLabel('Архив', { exact: true }).selectOption('archived')
  await page.getByText('Архивная деталь', { exact: true }).click()
  await page.getByText('Архивная запись', { exact: true }).waitFor()
  await page.screenshot({ path: 'test-results/migration-archive.png' })
  await page.goto(base + '/crm')
  await page.getByRole('button', { name: 'Сделка', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Создать · Сделка' })
  await editor.getByLabel('Название').fill('Новая сделка')
  await editor.getByLabel('Бюджет, ₽').fill('2500000')
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await page.getByRole('dialog', { name: 'Новая сделка' }).waitFor()
  await page.getByLabel('Текст заметки').fill('Обсудили проект')
  await page.getByRole('button', { name: 'Сохранить заметку' }).click()
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await page.getByRole('tab', { name: 'Входящие', exact: true }).click()
  await page.getByText('Заявка с сайта', { exact: true }).click()
  assert.equal(await page.getByRole('link', { name: 'Карточка клиента' }).getAttribute('href'), '/clients/7')
  await page.getByRole('button', { name: 'Принять в работу' }).click()
  await page
    .getByRole('dialog', { name: 'Создать · Сделка' })
    .getByRole('button', { name: 'Сохранить', exact: true })
    .click()
  await page.getByRole('dialog', { name: 'Заявка с сайта' }).waitFor()
  await page.screenshot({ path: 'test-results/migration-crm.png' })
  await page.goto(base + '/recipes')
  await page.getByText('Тестовая техкарта', { exact: true }).click()
  await page.getByRole('button', { name: 'Выпустить продукцию' }).click()
  await page.getByRole('button', { name: 'Проверить материалы' }).click()
  await page.getByRole('button', { name: 'Выпустить и провести' }).click()
  await page.getByText('Продукция оприходована, материалы списаны.', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'Готово', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base + '/crm')
  await page.getByRole('heading', { name: 'Продажи', exact: true }).waitFor()
  await page.getByRole('cell', { name: deal.name, exact: true }).waitFor()
  await page.screenshot({ path: 'test-results/migration-mobile.png' })
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
    'mobile overflow',
  )
  assert.ok(created && noted && accepted && manufactured)
  assert.deepEqual(errors, [])
  console.log(
    'PASS: archive, deal creation, notes, inquiry acceptance, atomic manufacturing UI, mobile layout',
  )
} finally {
  await browser.close()
}
