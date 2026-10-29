import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.addInitScript(() => {
  localStorage.setItem('soborbum.auth.token', 'synthetic-stock-document-test')
  localStorage.setItem('soborbum.onboarding.warehouse', '1')
})
const owner = {
  id: 1,
  full_name: 'Тестовый владелец',
  email: 'owner@example.test',
  role: 'admin',
  module_access: {},
  is_active: true,
  created_at: new Date().toISOString(),
}
const a = 'Склад Технология',
  b = 'Склад ИД Групп'
const materials = [
  {
    id: 1,
    title: 'Брус',
    code: 'B-1',
    warehouse: a,
    unit: 'м³',
    is_fractional: true,
    quantity_in_stock: 10,
    purchase_price: 20,
  },
  {
    id: 2,
    title: 'Крепёж',
    code: 'B-2',
    warehouse: a,
    unit: 'шт',
    is_fractional: false,
    quantity_in_stock: 5,
    purchase_price: 3,
  },
  {
    id: 3,
    title: 'Брус',
    code: 'B-1',
    warehouse: b,
    unit: 'м³',
    is_fractional: true,
    quantity_in_stock: 2,
    purchase_price: 10,
  },
].map((m) => ({
  ...m,
  category: 'без категории',
  is_archived: false,
  total_requested: 0,
  threshold: 0,
  needs_supply: false,
  created_at: new Date().toISOString(),
}))
const documents = [
  {
    id: 90,
    kind: 'transfer',
    status: 'historical',
    number: 'МС-1',
    warehouse: a,
    target_warehouse: b,
    occurred_at: new Date().toISOString(),
    note: 'История',
    lines: [],
    operation_ids: [],
    source_id: 'old-move',
    source_state: 'Проведён',
    version: 1,
    archived: false,
    actor_id: 1,
  },
]
let posts = 0,
  archives = 0
await page.route('**/api/**', async (route) => {
  const req = route.request(),
    url = new URL(req.url()),
    path = url.pathname,
    method = req.method()
  let body = []
  if (path === '/api/auth/me') body = owner
  else if (path === '/api/auth/users') body = [owner]
  else if (path.includes('/unread')) body = { count: 0, unread_count: 0 }
  else if (path === '/api/warehouse/materials') body = materials
  else if (path === '/api/warehouse/documents' && method === 'GET')
    body = { total: documents.length, items: documents }
  else if (path === '/api/warehouse/documents' && method === 'POST') {
    const input = req.postDataJSON()
    assert.match(input.request_id, /^[0-9a-f-]{36}$/)
    body = {
      ...input,
      id: documents.length + 1,
      version: 1,
      status: 'draft',
      number: 'ТЕСТ-' + (documents.length + 1),
      archived: false,
      actor_id: 1,
      operation_ids: [],
      source_id: null,
      lines: input.lines.map((l) => {
        const m = materials.find((m) => m.id === l.material_id)
        return {
          ...l,
          title: m.title,
          code: m.code,
          unit: m.unit,
          is_fractional: m.is_fractional,
          expected_quantity: String(m.quantity_in_stock),
        }
      }),
    }
    documents.unshift(body)
  } else if (path.match(/\/documents\/\d+/)) {
    const id = Number(path.match(/\/documents\/(\d+)/)[1]),
      row = documents.find((d) => d.id === id)
    assert.ok(row)
    if (method === 'GET') body = row
    else if (method === 'PATCH') {
      const input = req.postDataJSON()
      assert.equal(input.version, row.version)
      row.note = input.note
      row.lines = row.lines.map((l, i) => ({ ...l, quantity: input.lines[i].quantity }))
      row.version++
      body = row
    } else if (path.endsWith('/recount')) {
      row.lines = row.lines.map((l) => ({ ...l, quantity: null }))
      row.version++
      body = row
    } else if (path.endsWith('/post')) {
      const input = req.postDataJSON()
      assert.equal(input.version, row.version)
      assert.ok(input.request_id)
      row.status = 'posted'
      row.version++
      row.operation_ids = [posts + 1]
      posts++
      if (row.kind === 'transfer') {
        materials[0].quantity_in_stock -= 2
        materials[2].quantity_in_stock += 2
      } else
        for (const l of row.lines)
          materials.find((m) => m.id === l.material_id).quantity_in_stock = Number(l.quantity)
      body = row
    } else if (path.endsWith('/archive')) {
      archives++
      row.archived = true
      row.version++
      body = row
    }
  } else if (path.endsWith('/analytics'))
    body = {
      status: 'unknown',
      source: 'rules',
      generated_at: new Date().toISOString(),
      summary: 'Тестовый пересчёт',
    }
  await route.fulfill({
    status: method === 'POST' && path === '/api/warehouse/documents' ? 201 : 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
})
await page.goto(base + '/warehouse?tab=documents', { waitUntil: 'networkidle' })
await page.getByText('Перемещение № МС-1', { exact: true }).click()
let dialog = page.getByRole('dialog')
await dialog.getByText('Перенесённый документ МойСклада.', { exact: false }).waitFor()
assert.equal(await dialog.getByRole('button', { name: 'Провести', exact: true }).count(), 0)
await dialog.getByRole('button', { name: 'Закрыть', exact: true }).last().click()
await page.getByRole('button', { name: 'Переместить', exact: true }).click()
dialog = page.getByRole('dialog')
await dialog.getByLabel('Склад документа', { exact: true }).selectOption(a)
await dialog.getByLabel('Склад назначения', { exact: true }).selectOption(b)
await dialog.getByLabel('Основание складского документа').fill('Пополнение второго склада')
await dialog.getByLabel('Добавить материал в документ').selectOption('1')
await dialog.getByRole('button', { name: 'Добавить', exact: true }).click()
await dialog.getByLabel('Количество · B-1', { exact: true }).fill('2')
await dialog.getByRole('button', { name: 'Сохранить черновик', exact: true }).click()
dialog = page.getByRole('dialog')
await dialog.getByRole('button', { name: 'Провести', exact: true }).click()
await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click()
await dialog.getByText('Документ проведён. Остатки обновлены.', { exact: true }).waitFor()
assert.equal(posts, 1)
await dialog.getByRole('button', { name: 'В архив', exact: true }).click()
await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click()
await dialog.getByText('Архив обновлён', { exact: true }).waitFor()
assert.equal(archives, 1)
assert.equal(posts, 1)
await dialog.getByRole('button', { name: 'Закрыть', exact: true }).last().click()
await page.getByRole('button', { name: 'Начать инвентаризацию', exact: true }).click()
dialog = page.getByRole('dialog')
await dialog.getByLabel('Склад документа', { exact: true }).selectOption(a)
await dialog.getByLabel('Основание складского документа').fill('Плановый пересчёт')
await dialog.getByRole('button', { name: 'Весь склад · 2 позиций', exact: true }).click()
await dialog.getByRole('button', { name: 'Сохранить черновик', exact: true }).click()
dialog = page.getByRole('dialog')
await dialog.getByLabel('Факт · B-1', { exact: true }).fill('0')
await dialog.getByLabel('Факт · B-2', { exact: true }).fill('6')
assert.equal(await dialog.getByRole('button', { name: 'Провести', exact: true }).isDisabled(), true)
await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
await dialog.getByText('Черновик сохранён', { exact: true }).waitFor()
await dialog.getByRole('button', { name: 'Переснять остатки', exact: true }).click()
await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click()
await dialog.getByText('Остатки пересняты. Внесите фактический пересчёт.', { exact: true }).waitFor()
assert.equal(await dialog.getByLabel('Факт · B-1', { exact: true }).inputValue(), '')
await dialog.getByLabel('Факт · B-1', { exact: true }).fill('0')
await dialog.getByLabel('Факт · B-2', { exact: true }).fill('6')
await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
await dialog.getByText('Черновик сохранён', { exact: true }).waitFor()
await dialog.getByRole('button', { name: 'Провести', exact: true }).click()
await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click()
await dialog.getByText('Документ проведён. Остатки обновлены.', { exact: true }).waitFor()
assert.equal(posts, 2)
assert.equal(materials[0].quantity_in_stock, 0)
assert.equal(materials[1].quantity_in_stock, 6)
await page.setViewportSize({ width: 390, height: 844 })
await page.reload({ waitUntil: 'networkidle' })
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
  'Mobile page overflow',
)
await page.getByText('Инвентаризация № ТЕСТ-3', { exact: true }).click()
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
  'Mobile document overflow',
)
await page.screenshot({
  path: 'C:/Users/trans/.codex/data/stock-documents-mobile-20261029.png',
  fullPage: true,
})
assert.deepEqual(errors, [])
await browser.close()
console.log(
  'Stock documents: transfer, historical immutability, archive, inventory zero counts, recount, posting and mobile passed',
)
