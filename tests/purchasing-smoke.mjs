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
  archived = false,
  edited = false
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
      materials: [
        { id: 1, title: 'Тестовый брус', warehouse: 'Склад Технология', unit: 'шт', price: 20 },
        { id: 2, title: 'Тестовая доска', warehouse: 'Склад Технология', unit: 'шт', price: 35 },
      ],
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
  else if (path === '/api/purchasing/orders/1' && req.method() === 'PATCH') {
    const payload = req.postDataJSON()
    assert.equal(url.searchParams.get('version'), '1')
    assert.equal(payload.items.length, 1)
    assert.equal(payload.items[0].material, 'Тестовый брус')
    assert.equal(payload.items[0].quantity, 4)
    assert.equal(payload.items[0].unit_price, 25.5)
    assert.equal(payload.reason, 'Согласована новая сумма')
    assert(!('key' in payload.items[0]))
    edited = true
    order = { ...order, items: payload.items, total_cost: 102, version: 2 }
    body = order
  }
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
  else if (path === '/api/purchasing/orders/1/documents') body = {
    invoices: [{ id: 91, number: 'С-91', date: '2026-11-06', amount: '200.00', currency: 'RUB', status: 'Оплачен' }],
    receipts: [{ id: 92, number: 'ПР-92', occurred_at: '2026-11-09T17:11:00+03:00', status: 'posted', lines: [{ quantity: 10, unit_price: 20 }] }],
    payments: [{ id: 93, number: 'П-93', date: '2026-11-06', amount: '200.00', currency: 'RUB', status: 'posted', refund: false, invoice_ids: [91] }],
    factures: [{ id: 94, number: 'СФ-94', date: '2026-11-09', amount: '200.00', currency: 'RUB', receipt_ids: [92] }],
    returns: [], opening_paid: 0,
  }
  else if (path === '/api/accounting/money-summary') body = { organizations: [] }
  else if (path === '/api/accounting/money-movements/93') body = {
    id: 93, external_number: 'П-93', direction: 'expense', subkind: 'supply_payment',
    status: 'posted', amount: 200, currency: 'RUB', tax: 0, assessment: 'actual',
    source_kind: 'supply', source_label: 'Заказ поставщику № 1', documents: [],
    doc_date: '2026-11-06', created_at: '2026-11-06', posted_at: '2026-11-06',
  }
  else if (path === '/api/purchasing/receipts' && req.method() === 'POST') {
    const b = req.postDataJSON()
    assert.equal(b.lines[0].quantity, '3')
    assert.match(b.request_id, /^[0-9a-f-]{36}$/)
    received = true
    order = {
      ...order,
      version: 3,
      has_receipts: true,
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
  const card = page.getByRole('region', {name: 'Заказ № 1', exact: true})
  const positions = card.getByRole('region', {name: 'Позиции заказа'})
  await positions.getByRole('cell', {name: 'Тестовый брус'}).waitFor()
  const material = positions.getByRole('link', { name: 'Тестовый брус', exact: true })
  assert.equal(await material.getAttribute('href'), '/warehouse?tab=materials&material=1')
  assert(await material.evaluate(link => getComputedStyle(link).textDecorationLine.includes('underline')))
  assert.deepEqual(await positions.getByRole('columnheader').allTextContents(),
    ['№', 'Наименование', 'Количество', 'Доступно', 'Остаток на складе', 'НДС', 'Цена', 'Сумма с НДС', 'Сумма'])
  await positions.getByRole('cell', {name: '8 шт', exact: true}).waitFor()
  await positions.getByRole('cell', {name: '12 шт', exact: true}).waitFor()
  await positions.getByRole('cell', {name: /166,67/}).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  assert(await positions.getByRole('table').evaluate(table => table.parentElement.scrollWidth > table.parentElement.clientWidth))
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await card.getByRole('tab', {name: /^Связанные документы/}).click()
  const documentMap = card.getByRole('region', {name: 'Связанные документы заказа', exact: true})
  await documentMap.waitFor()
  assert.equal(await page.getByRole('dialog').count(), 0)
  for (const [label, href] of [
    [/^№ С-91/, '/moysklad?type=invoicein&record=91'],
    [/^№ ПР-92/, '/purchasing?tab=receipts&receipt=92'],
    [/^№ СФ-94/, '/moysklad?type=facturein&record=94'],
    [/^№ П-93/, '/accounting?tab=register&workspace=purchasing&movement=93'],
  ]) assert.equal(await documentMap.getByRole('link', { name: label }).getAttribute('href'), href)
  await page.setViewportSize({ width: 390, height: 844 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await documentMap.getByRole('link', { name: /П-93/ }).click()
  await page.getByRole('heading', { name: 'Деньги', exact: true }).waitFor()
  const purchasingNavigation = page.getByRole('navigation', { name: 'Разделы закупок' })
  assert.equal(await purchasingNavigation.getByRole('link', {name: 'Деньги', exact: true}).getAttribute('aria-current'), 'page')
  await page.getByRole('dialog', { name: /^оплата поставки/i }).waitFor()
  await page.goBack()
  await documentMap.waitFor()
  await page.reload()
  await documentMap.waitFor()
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
  await card.getByRole('button', {name: 'К списку заказов', exact: true}).click()
  await page.getByRole('button', { name: 'Заказ поставщику', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Заказ поставщику', exact: true })
  await form.getByLabel('Организация', { exact: true }).selectOption({ label: 'Технология' })
  await form.getByLabel('Поставщик', { exact: true }).selectOption('1')
  await form.getByLabel('Складской материал').selectOption('1')
  await form.getByLabel('Количество заказа').fill('10')
  await form.getByRole('button', { name: 'Сохранить заказ' }).click()
  await card.getByRole('button', { name: 'Изменить', exact: true }).click()
  const edit = card.getByRole('region', { name: 'Редактирование позиций' })
  await edit.getByRole('button', { name: 'Тестовый брус', exact: true }).click()
  await edit.getByLabel('Найти материал').fill('доска')
  await edit.getByLabel('Складской материал').selectOption('2')
  await edit.getByRole('button', { name: 'Тестовая доска', exact: true }).waitFor()
  await edit.getByRole('button', { name: 'Удалить позицию 1', exact: true }).click()
  await edit.getByRole('button', { name: 'Добавить позицию' }).click()
  await edit.getByLabel('Складской материал').selectOption('1')
  await edit.getByLabel('Количество заказа').fill('4')
  await edit.getByLabel('Сумма позиции').fill('102,00')
  assert.equal(await edit.getByLabel('Цена заказа').inputValue(), '25.5')
  await card.getByRole('tab', { name: 'Файлы', exact: true }).click()
  await card.getByRole('tab', { name: 'Позиции', exact: true }).click()
  assert.equal(await edit.getByLabel('Количество заказа').inputValue(), '4')
  await card.getByLabel('Причина изменения заказа').fill('Согласована новая сумма')
  await card.getByRole('button', { name: 'Сохранить заказ' }).click()
  await edit.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Принять материалы' }).click()
  const receipt = page.getByRole('dialog', { name: 'Приёмка заказа № 1', exact: true })
  await receipt.getByLabel('Количество приёмки').fill('3')
  await receipt.getByRole('button', { name: 'Провести приёмку' }).click()
  await card.getByText('Частично получено / в пути', { exact: true }).waitFor()
  await card.getByRole('button', { name: 'Изменить', exact: true }).click()
  assert(await edit.getByRole('button', { name: 'Удалить позицию 1', exact: true }).isDisabled())
  await edit.getByRole('link', { name: 'Тестовый брус', exact: true }).waitFor()
  await card.getByRole('button', { name: 'Отмена', exact: true }).click()
  await page.getByRole('button', { name: 'Оплата частями' }).click()
  const payment = page.getByRole('dialog', { name: 'Оплата заказа № 1', exact: true })
  await payment.getByLabel('Сумма платежа').fill('50')
  await payment.getByRole('button', { name: 'На согласование' }).click()
  await page.getByText('На согласовании: 50 ₽', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'В архив', exact: true }).click()
  await page.getByRole('button', { name: 'Вернуть из архива' }).waitFor()
  await card.getByRole('button', { name: 'К списку заказов', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Заказы поставщикам', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
  await mkdir('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/purchasing-mobile.png', fullPage: true })
  assert.ok(created && edited && received && paid && archived)
  assert.deepEqual(errors, [])
  console.log('PASS: native order, partial receiving, partial payment, archive and mobile layout')
} finally {
  await browser.close()
}
