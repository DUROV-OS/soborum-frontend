import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER_CHANNEL })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'synthetic-purchasing-test'))
const owner = {
  id: 1,
  full_name: 'Тестовый владелец',
  email: 'owner@example.test',
  role: 'admin',
  module_access: {},
  is_active: true,
  created_at: new Date().toISOString(),
}
let order = {
  id: 1,
  number: '1',
  supplier_id: 1,
  supplier_name: 'Тестовый поставщик',
  items: [
    {
      material: 'Тестовый брус',
      quantity: 10,
      unit_price: 20,
      received_quantity: 0,
      warehouse_material_id: 1,
      unit: 'шт',
      stock_tracked: true,
    },
  ],
  total_cost: 200,
  paid: 0,
  pending_payment: 0,
  available_payment: 200,
  unpaid: 200,
  version: 1,
  archived: false,
  status: 'ordered',
  source_state: null,
  comment: null,
  expected_at: null,
}
let created = false,
  received = false,
  paid = false,
  archived = false
const uploads = []
await page.route('**/api/**', async (route) => {
  const req = route.request(),
    url = new URL(req.url()),
    path = url.pathname
  let body = []
  if (path === '/api/auth/me') body = owner
  else if (path === '/api/auth/users') body = [owner]
  else if (path.includes('/unread')) body = { count: 0, unread_count: 0 }
  else if (path === '/api/purchasing/catalog')
    body = {
      organizations: [{ id: 2, name: 'Технология' }, { id: 3, name: 'ИД Групп' }],
      suppliers: [{ id: 1, name: 'Тестовый поставщик', archived: false }],
      materials: [{ id: 1, title: 'Тестовый брус', warehouse: 'Склад Технология', unit: 'шт', price: 20 }],
      accounts: [{ id: 1, name: 'Тестовый счёт' }],
    }
  else if (path === '/api/purchasing/orders' && req.method() === 'POST') {
    const b = req.postDataJSON()
    assert.equal(b.supplier_id, 1)
    assert.equal(b.organization_id, 2)
    assert.equal(b.items[0].warehouse_material_id, 1)
    assert.equal(b.items[0].quantity, 10)
    created = true
    order = { ...order, organization_id: 2, organization_name: 'Технология' }
    body = order
  } else if (path === '/api/purchasing/orders') body = { total: 1, items: [order] }
  else if (path === '/api/purchasing/orders/1') body = order
  else if (path === '/api/purchasing/orders/1/positions') body = [{
    number: 1, name: 'Тестовый брус', quantity: 10, unit: 'шт', received_quantity: received ? 3 : 0,
    unit_price: 20, stock_unit: 'шт', stock: '12', available: '8', vat: 'included', vat_rate: '20',
    amount_with_vat: '200.00', amount: '166.67',
  }]
  else if (path === '/api/purchasing/orders/1/files') {
    if (req.method() === 'POST') {
      assert.match(req.postData(), /filename="test-order.pdf"/)
      assert.match(req.postData(), /request_id/)
      body = {key: 'local-1', filename: 'test-order.pdf', size: 20, source: 'Durov OS', path: '/orders/1/files/1'}
      uploads.push(body)
    } else body = uploads
  }
  else if (path === '/api/purchasing/orders/1/files/1')
    return route.fulfill({status: 200, contentType: 'application/pdf', body: '%PDF-1.7\nsynthetic'})
  else if (path === '/api/purchasing/orders/1/documents') body = { receipts: [], payments: [], returns: [], opening_paid: 0 }
  else if (path === '/api/purchasing/receipts' && req.method() === 'POST') {
    const b = req.postDataJSON()
    assert.equal(b.lines[0].quantity, '3')
    assert.match(b.request_id, /^[0-9a-f-]{36}$/)
    received = true
    order = {
      ...order,
      version: 2,
      status: 'in_transit',
      items: [{ ...order.items[0], received_quantity: 3 }],
    }
    body = { id: 1 }
  } else if (path === '/api/purchasing/receipts') body = { total: 0, items: [] }
  else if (path === '/api/purchasing/orders/1/payments') {
    const b = req.postDataJSON()
    assert.equal(b.amount, '50')
    assert.match(b.request_id, /^[0-9a-f-]{36}$/)
    paid = true
    order = { ...order, pending_payment: 50, available_payment: 150 }
    body = { id: 1, status: 'draft' }
  } else if (path === '/api/purchasing/orders/1/archive') {
    archived = true
    order = { ...order, version: 3, archived: true }
    body = order
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
})
try {
  await page.goto((process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173') + '/purchasing?tab=orders')
  await page.getByRole('heading', { name: 'Заказы поставщикам', exact: true }).waitFor()
  await page.getByRole('button', {name: '№ 1', exact: true}).click()
  const card = page.getByRole('dialog', {name: 'Заказ № 1', exact: true})
  const positions = card.getByRole('region', {name: 'Позиции заказа'})
  await positions.getByRole('cell', {name: 'Тестовый брус'}).waitFor()
  assert.deepEqual(await positions.getByRole('columnheader').allTextContents(),
    ['№', 'Наименование', 'Количество', 'Доступно', 'Остаток на складе', 'НДС', 'Цена', 'Сумма с НДС', 'Сумма'])
  await positions.getByRole('cell', {name: '8 шт', exact: true}).waitFor()
  await positions.getByRole('cell', {name: '12 шт', exact: true}).waitFor()
  await positions.getByRole('cell', {name: /166,67/}).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  assert(await positions.getByRole('table').evaluate(table => table.parentElement.scrollWidth > table.parentElement.clientWidth))
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await card.getByRole('tab', {name: 'Файлы', exact: true}).click()
  const files = card.getByRole('region', {name: 'Файлы заказа'})
  await files.getByText('К заказу пока нет вложений.').waitFor()
  await files.getByLabel('Выбрать файл заказа').setInputFiles({
    name: 'test-order.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nsynthetic'),
  })
  const download = page.waitForEvent('download')
  await files.getByRole('button', {name: 'Скачать test-order.pdf'}).click()
  assert.equal((await download).suggestedFilename(), 'test-order.pdf')
  await card.getByRole('button', {name: 'Закрыть', exact: true}).click()
  await page.getByRole('button', { name: 'Заказ поставщику', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Заказ поставщику', exact: true })
  await form.getByLabel('Организация', { exact: true }).selectOption({ label: 'Технология' })
  await form.getByLabel('Поставщик', { exact: true }).selectOption('1')
  await form.getByLabel('Складской материал').selectOption('1')
  await form.getByLabel('Количество заказа').fill('10')
  await form.getByRole('button', { name: 'Сохранить заказ' }).click()
  await page.getByRole('button', { name: 'Принять материалы' }).click()
  const receipt = page.getByRole('dialog', { name: 'Приёмка заказа № 1', exact: true })
  await receipt.getByLabel('Количество приёмки').fill('3')
  await receipt.getByRole('button', { name: 'Провести приёмку' }).click()
  await page.getByRole('button', { name: 'Оплата частями' }).click()
  const payment = page.getByRole('dialog', { name: 'Оплата заказа № 1', exact: true })
  await payment.getByLabel('Сумма платежа').fill('50')
  await payment.getByRole('button', { name: 'На согласование' }).click()
  await page.getByText('На согласовании: 50 ₽', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'В архив', exact: true }).click()
  await page.getByRole('button', { name: 'Вернуть из архива' }).waitFor()
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Заказы поставщикам', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
  await mkdir('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/purchasing-mobile.png', fullPage: true })
  assert.ok(created && received && paid && archived)
  assert.deepEqual(errors, [])
  console.log('PASS: native order, partial receiving, partial payment, archive and mobile layout')
} finally {
  await browser.close()
}
